const db = require('../config/database');
const redis = require('../config/redis');

class BookingService {
  static async getAvailableSlots(pitchId, date) {
    const cacheKey = `availability:${pitchId}:${date}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const pitch = await db.query(
      `SELECT opening_hour, closing_hour, slot_duration FROM pitches WHERE id = $1`,
      [pitchId]
    );

    if (pitch.rows.length === 0) {
      throw new Error('Saha bulunamadı');
    }

    const { opening_hour, closing_hour, slot_duration } = pitch.rows[0];
    const slots = [];
    
    const bookedSlots = await db.query(
      `SELECT start_time, end_time FROM bookings
       WHERE pitch_id = $1 
       AND DATE(start_time) = $2
       AND status IN ('Confirmed', 'Pending')
       ORDER BY start_time`,
      [pitchId, date]
    );

    const lockedSlots = await this.getLockedSlotsFromRedis(pitchId, date);

    let currentHour = opening_hour;
    while (currentHour < closing_hour) {
      const slotStart = new Date(`${date}T${String(currentHour).padStart(2, '0')}:00:00`);
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + slot_duration);

      const isBooked = bookedSlots.rows.some(booking => {
        const bookingStart = new Date(booking.start_time);
        const bookingEnd = new Date(booking.end_time);
        return (slotStart >= bookingStart && slotStart < bookingEnd);
      });

      const isLocked = lockedSlots.includes(slotStart.toISOString());

      let status = 'available';
      if (isBooked) status = 'booked';
      else if (isLocked) status = 'locked';

      slots.push({
        startTime: slotStart.toISOString(),
        endTime: slotEnd.toISOString(),
        status,
        price: await this.calculatePrice(pitchId, slotStart),
      });

      currentHour += slot_duration / 60;
    }

    await redis.set(cacheKey, JSON.stringify(slots), 'EX', 60);
    return slots;
  }

  static async getLockedSlotsFromRedis(pitchId, date) {
    const pattern = `slot:${pitchId}:${date}*`;
    const keys = await redis.keys(pattern);
    return keys.map(key => key.split(':').slice(2).join(':'));
  }

  static async calculatePrice(pitchId, dateTime) {
    const pitch = await db.query(
      `SELECT hourly_price, night_start_hour, night_hourly_price FROM pitches WHERE id = $1`,
      [pitchId]
    );

    if (pitch.rows.length === 0) return 0;

    const hour = dateTime.getHours();
    const nightStartHour = pitch.rows[0].night_start_hour || 18;
    const dayPrice = parseFloat(pitch.rows[0].hourly_price);
    const nightPrice = parseFloat(pitch.rows[0].night_hourly_price || dayPrice);

    const finalPrice = hour >= nightStartHour ? nightPrice : dayPrice;

    return Math.round(finalPrice);
  }

  static async createBooking(bookingData) {
    const { pitchId, userId, startTime, endTime } = bookingData;

    const overlap = await db.query(
      `SELECT id FROM bookings
       WHERE pitch_id = $1
       AND status IN ('Confirmed', 'Pending')
       AND tsrange(start_time, end_time) && tsrange($2::timestamp, $3::timestamp)`,
      [pitchId, startTime, endTime]
    );

    if (overlap.rows.length > 0) {
      throw new Error('Seçtiğiniz saat aralığında çakışan rezervasyon var');
    }

    return bookingData;
  }

  static async getUserBookings(userId, status = null) {
    let query = `
      SELECT b.*, p.name as pitch_name, f.name as facility_name, f.address, f.iban as facility_iban
      FROM bookings b
      JOIN pitches p ON b.pitch_id = p.id
      JOIN facilities f ON p.facility_id = f.id
      WHERE b.user_id = $1
    `;

    const params = [userId];

    if (status) {
      query += ` AND b.status = $2`;
      params.push(status);
    }

    query += ` ORDER BY b.start_time DESC`;

    const result = await db.query(query, params);
    return result.rows;
  }

  static async getFacilityBookings(facilityId, startDate, endDate) {
    const result = await db.query(
      `SELECT 
         b.*, 
         p.name as pitch_name,
         COALESCE(b.customer_name, u.full_name) as user_name,
         COALESCE(b.customer_phone, u.phone) as user_phone
       FROM bookings b
       JOIN pitches p ON b.pitch_id = p.id
       LEFT JOIN users u ON b.user_id = u.id
       WHERE p.facility_id = $1
       AND b.start_time >= $2
       AND b.start_time < $3
       AND b.status IN ('Confirmed', 'Pending', 'Suspended')
       ORDER BY b.start_time`,
      [facilityId, startDate, endDate]
    );

    return result.rows;
  }
}

module.exports = BookingService;
