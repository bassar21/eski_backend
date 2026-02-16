const db = require('../config/database');

class AdminController {
  // Onay Bekleyen İşletmeler
  static async getPendingOwners(req, res) {
    try {
      // isApproved = 0 (false) ve rolü 'isletme' olanları getir
      const result = await db.query(`
        SELECT id, fullName, email, phoneNumber, createdAt 
        FROM Users 
        WHERE role = 'isletme' AND (isApproved = 0 OR isApproved IS NULL)
        ORDER BY createdAt DESC
      `);

      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Get pending owners error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getDashboardStats(req, res) {
    try {
      // Kullanıcı Sayısı
      const usersResult = await db.query('SELECT COUNT(*) as count FROM Users');
      const totalUsers = usersResult.rows[0].count;

      // Saha Sayısı
      // Eğer Pitches tablosu yoksa burası hata verebilir, tablo adını kontrol etmeliyiz.
      // Flutter'da Pitches tablosu var kabul ediyoruz.
      let totalFacilities = 0;
      try {
          const facilitiesResult = await db.query('SELECT COUNT(*) as count FROM Pitches');
          totalFacilities = facilitiesResult.rows[0].count;
      } catch (e) { console.log("Pitches tablosu henüz yok"); }

      // Rezervasyon Sayısı
      const bookingsResult = await db.query('SELECT COUNT(*) as count FROM Reservations');
      const totalBookings = bookingsResult.rows[0].count;

      // Ciro (Opsiyonel, fiyat kolonu varsa)
      // const revenueResult = await db.query('SELECT SUM(price) as total FROM Reservations');

      res.json({
        success: true,
        stats: {
          totalUsers,
          totalFacilities,
          totalBookings,
          totalRevenue: 0 
        }
      });
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Kullanıcı Silme
  static async deleteUser(req, res) {
      try {
          const { id } = req.params;
          // Önce ilişkili kayıtları silmek gerekebilir (Foreign Key hatası almamak için)
          await db.query('DELETE FROM Reservations WHERE userId = @p1', [id]);
          await db.query('DELETE FROM Users WHERE id = @p1', [id]);
          
          res.json({ success: true, message: 'Kullanıcı silindi' });
      } catch (error) {
          res.status(500).json({ error: error.message });
      }
  }
  
  // Kullanıcı Onayla
  static async approveUser(req, res) {
      try {
          const { id } = req.params;
          await db.query('UPDATE Users SET isApproved = 1 WHERE id = @p1', [id]);
          res.json({ success: true, message: 'Kullanıcı onaylandı' });
      } catch (error) {
          res.status(500).json({ error: error.message });
      }
  }
}

module.exports = AdminController;