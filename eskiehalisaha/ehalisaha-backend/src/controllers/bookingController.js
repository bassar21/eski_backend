const SlotLockService = require('../services/slotLockService');
const BookingService = require('../services/bookingService');
const PaymentService = require('../services/paymentService');
const EmailService = require('../services/emailService');

class BookingController {
  static async getAvailability(req, res) {
    try {
      const { pitchId, date } = req.params;
      
      if (!pitchId || !date) {
        return res.status(400).json({ error: 'pitchId ve date parametreleri gerekli' });
      }

      const slots = await BookingService.getAvailableSlots(pitchId, date);
      res.json({ success: true, data: slots });
    } catch (error) {
      console.error('Get availability error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async lockSlot(req, res) {
    try {
      const { pitchId, dateTime } = req.body;
      const userId = req.user.id;

      if (!pitchId || !dateTime) {
        return res.status(400).json({ error: 'pitchId ve dateTime gerekli' });
      }

      const result = await SlotLockService.lockSlot(pitchId, dateTime, userId);
      
      if (!result.success) {
        return res.status(409).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error('Lock slot error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async extendLock(req, res) {
    try {
      const { pitchId, dateTime } = req.body;
      const userId = req.user.id;

      const result = await SlotLockService.extendLock(pitchId, dateTime, userId);
      
      if (!result.success) {
        return res.status(403).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error('Extend lock error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async releaseLock(req, res) {
    try {
      const { pitchId, dateTime } = req.body;
      const userId = req.user.id;

      const released = await SlotLockService.releaseLock(pitchId, dateTime, userId);
      res.json({ success: released });
    } catch (error) {
      console.error('Release lock error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async createBooking(req, res) {
    try {
      const { pitchId, startTime, endTime, userInfo, paymentMethod } = req.body;
      const userId = req.user.id;

      if (!pitchId || !startTime || !endTime) {
        return res.status(400).json({ error: 'Eksik parametreler' });
      }

      await BookingService.createBooking({
        pitchId,
        userId,
        startTime,
        endTime,
      });

      const totalAmount = await BookingService.calculatePrice(pitchId, new Date(startTime));

      if (paymentMethod === 'bank_transfer') {
        const db = require('../config/database');
        
        const depositAmount = totalAmount * 0.3;
        
        const result = await db.query(
          `INSERT INTO bookings 
           (pitch_id, user_id, start_time, end_time, total_price, deposit_amount, status, payment_method, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
           RETURNING *`,
          [pitchId, userId, startTime, endTime, totalAmount, depositAmount, 'Pending', 'bank_transfer']
        );

        const booking = result.rows[0];

        const pitchData = await db.query('SELECT p.*, f.* FROM pitches p JOIN facilities f ON p.facility_id = f.id WHERE p.id = $1', [pitchId]);
        const pitch = pitchData.rows[0];
        const facility = {
          name: pitch.name,
          address: pitch.address,
          iban: pitch.iban,
          account_holder_name: pitch.account_holder_name,
        };

        EmailService.sendBookingConfirmation(booking, facility, pitch, req.user).catch(err => 
          console.error('Email send error:', err)
        );

        return res.json({
          success: true,
          data: booking,
          message: 'Rezervasyon oluşturuldu. Havale/EFT ile ödeme yapıldıktan sonra tesis sahibi onayı ile aktif olacaktır.'
        });
      }

      const paymentResult = await PaymentService.initializePayment({
        userId,
        pitchId,
        startTime,
        endTime,
        totalAmount,
        userInfo: userInfo || req.user,
      });

      res.json(paymentResult);
    } catch (error) {
      console.error('Create booking error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getUserBookings(req, res) {
    try {
      const userId = req.user.id;
      const { status } = req.query;

      const bookings = await BookingService.getUserBookings(userId, status);
      res.json({ success: true, data: bookings });
    } catch (error) {
      console.error('Get user bookings error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async cancelBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const userId = req.user.id;

      const result = await PaymentService.processCancellation(bookingId, userId);
      res.json(result);
    } catch (error) {
      console.error('Cancel booking error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getFacilityBookings(req, res) {
    try {
      const { facilityId } = req.params;
      const { startDate, endDate } = req.query;

      if (req.user.role !== 'SahaSahibi' && req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Yetkisiz erişim' });
      }

      const bookings = await BookingService.getFacilityBookings(
        facilityId,
        startDate || new Date().toISOString(),
        endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      );

      res.json({ success: true, data: bookings });
    } catch (error) {
      console.error('Get facility bookings error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async createManualBooking(req, res) {
    try {
      const { customerName, customerPhone, customerEmail, bookingDate, startTime, duration, totalPrice, facilityId, pitchId } = req.body;
      const ownerId = req.user.id;

      // Validasyon
      if (!customerName || !customerPhone || !bookingDate || !startTime || !duration || !totalPrice) {
        return res.status(400).json({ error: 'Gerekli alanlar eksik' });
      }

      const db = require('../config/database');

      // Facility kontrolü - owner'a ait mi?
      let targetFacilityId = facilityId;
      if (!targetFacilityId) {
        // Facility belirtilmemişse owner'ın ilk facility'sini kullan
        const facilityResult = await db.query(
          'SELECT id FROM facilities WHERE owner_id = $1 LIMIT 1',
          [ownerId]
        );
        if (facilityResult.rows.length === 0) {
          return res.status(400).json({ error: 'Tesisiniz bulunmuyor' });
        }
        targetFacilityId = facilityResult.rows[0].id;
      }

      // Pitch kontrolü
      let targetPitchId = pitchId;
      if (!targetPitchId) {
        // Pitch belirtilmemişse facility'nin ilk pitch'ini kullan
        const pitchResult = await db.query(
          'SELECT id FROM pitches WHERE facility_id = $1 LIMIT 1',
          [targetFacilityId]
        );
        if (pitchResult.rows.length === 0) {
          return res.status(400).json({ error: 'Tesisinizde saha bulunmuyor' });
        }
        targetPitchId = pitchResult.rows[0].id;
      }

      // Start ve end time hesapla
      const startDateTime = new Date(`${bookingDate}T${startTime}`);
      const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 60 * 1000);
      
      // Rezervasyon oluştur
      const result = await db.query(
        `INSERT INTO bookings 
         (pitch_id, customer_name, customer_phone, customer_email, start_time, end_time, total_price, deposit_amount, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         RETURNING *`,
        [targetPitchId, customerName, customerPhone, customerEmail || null, startDateTime, endDateTime, totalPrice, totalPrice * 0.3, 'Confirmed']
      );

      res.status(201).json({ 
        success: true, 
        data: result.rows[0],
        message: 'Manuel rezervasyon başarıyla oluşturuldu'
      });
    } catch (error) {
      console.error('Create manual booking error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async updateBookingStatus(req, res) {
    try {
      const { bookingId } = req.params;
      const { status } = req.body;
      const ownerId = req.user.id;

      if (!status || !['Confirmed', 'Pending', 'Cancelled', 'Suspended'].includes(status)) {
        return res.status(400).json({ error: 'Geçersiz durum' });
      }

      const db = require('../config/database');

      // Rezervasyonun owner'a ait olup olmadığını kontrol et
      const checkResult = await db.query(
        `SELECT b.* FROM bookings b
         JOIN pitches p ON b.pitch_id = p.id
         JOIN facilities f ON p.facility_id = f.id
         WHERE b.id = $1 AND f.owner_id = $2`,
        [bookingId, ownerId]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Rezervasyon bulunamadı veya yetkiniz yok' });
      }

      const oldBooking = checkResult.rows[0];

      const result = await db.query(
        'UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [status, bookingId]
      );

      if (status === 'Confirmed' && oldBooking.status === 'Pending' && oldBooking.payment_method === 'bank_transfer' && oldBooking.user_id) {
        const userData = await db.query('SELECT * FROM users WHERE id = $1', [oldBooking.user_id]);
        const pitchData = await db.query('SELECT p.*, f.* FROM pitches p JOIN facilities f ON p.facility_id = f.id WHERE p.id = $1', [oldBooking.pitch_id]);
        
        if (userData.rows.length > 0 && pitchData.rows.length > 0) {
          const user = userData.rows[0];
          const pitch = pitchData.rows[0];
          const facility = {
            name: pitch.name,
            address: pitch.address,
          };

          EmailService.sendBookingApproved(oldBooking, facility, pitch, user).catch(err => 
            console.error('Email send error:', err)
          );
        }
      }

      res.json({ 
        success: true, 
        data: result.rows[0],
        message: 'Rezervasyon durumu güncellendi'
      });
    } catch (error) {
      console.error('Update booking status error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const ownerId = req.user.id;

      const db = require('../config/database');

      // Rezervasyonun owner'a ait olup olmadığını kontrol et
      const checkResult = await db.query(
        `SELECT b.* FROM bookings b
         JOIN pitches p ON b.pitch_id = p.id
         JOIN facilities f ON p.facility_id = f.id
         WHERE b.id = $1 AND f.owner_id = $2`,
        [bookingId, ownerId]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Rezervasyon bulunamadı veya yetkiniz yok' });
      }

      // İlişkili transaction'ları sil
      await db.query('DELETE FROM transactions WHERE booking_id = $1', [bookingId]);

      // Rezervasyonu sil
      await db.query('DELETE FROM bookings WHERE id = $1', [bookingId]);

      res.json({ 
        success: true,
        message: 'Rezervasyon silindi'
      });
    } catch (error) {
      console.error('Delete booking error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = BookingController;
