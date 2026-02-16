const db = require('../config/database');

class BookingController {
  
  // Müsaitlik Durumu (Dolu Saatleri Getir)
  static async getAvailability(req, res) {
    try {
      const { pitchId, date } = req.query; // Query params olarak alabilir

      // Flutter tarafı tarih formatını YYYY-MM-DD string olarak gönderiyor
      // Dolu saatleri çekiyoruz
      const result = await db.query(
        `SELECT rezHour FROM Reservations 
         WHERE pitchId = @p1 
         AND CAST(rezDate AS DATE) = CAST(@p2 AS DATE) 
         AND status = 1`,
        [pitchId, date]
      );

      // Sadece saat listesi dönüyoruz: [18, 19, 20]
      const bookedHours = result.rows.map(row => row.rezHour);

      res.json({ success: true, data: bookedHours });
    } catch (error) {
      console.error('Get availability error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Yeni Rezervasyon Oluştur
  static async createBooking(req, res) {
      try {
          // Flutter 'rezervasyonYap' metodundan gelen veri
          const { pitchId, userId, rezDate, rezHour, note } = req.body;
          const user_id = userId || req.user.id; // Token'dan veya body'den

          // Çakışma Kontrolü
          const check = await db.query(
              `SELECT id FROM Reservations 
               WHERE pitchId = @p1 AND rezDate = @p2 AND rezHour = @p3 AND status = 1`,
              [pitchId, rezDate, rezHour]
          );

          if (check.rows.length > 0) {
              return res.status(409).json({ error: 'Bu saat maalesef dolu.' });
          }

          // Rezervasyon Kaydı
          const result = await db.query(
              `INSERT INTO Reservations (pitchId, userId, rezDate, rezHour, note, status, createdAt)
               OUTPUT INSERTED.*
               VALUES (@p1, @p2, @p3, @p4, @p5, 1, GETDATE())`,
              [pitchId, user_id, rezDate, rezHour, note || '']
          );

          res.status(201).json({ success: true, data: result.rows[0] });
      } catch (error) {
          console.error('Create booking error:', error);
          res.status(500).json({ error: error.message });
      }
  }

  // Rezervasyon Silme
  static async deleteBooking(req, res) {
    try {
      const { bookingId } = req.params;
      
      // MSSQL Delete
      await db.query('DELETE FROM Reservations WHERE id = @p1', [bookingId]);

      res.json({ success: true, message: 'Rezervasyon silindi' });
    } catch (error) {
      console.error('Delete booking error:', error);
      res.status(500).json({ error: error.message });
    }
  }
  
  // Rezervasyonlarım
  static async getMyBookings(req, res) {
      try {
          const userId = req.user.id;
          const result = await db.query('SELECT * FROM Reservations WHERE userId = @p1 ORDER BY rezDate DESC', [userId]);
          res.json({ success: true, data: result.rows });
      } catch (error) {
           res.status(500).json({ error: error.message });
      }
  }
}

module.exports = BookingController;