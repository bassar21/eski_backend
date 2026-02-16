const db = require('../config/database');
const { roleMiddleware } = require('../middleware/auth');

class AdminController {
  static async getPendingOwners(req, res) {
    try {
      const result = await db.query(`
        SELECT 
          oa.*,
          u.full_name,
          u.phone as user_phone,
          u.email as user_email,
          u.created_at as user_created_at
        FROM owner_applications oa
        JOIN users u ON oa.user_id = u.id
        WHERE oa.status = 'pending'
        ORDER BY oa.created_at DESC
      `);

      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Get pending owners error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getDashboardStats(req, res) {
    try {
      // Total users
      const usersResult = await db.query('SELECT COUNT(*) as count FROM users');
      const totalUsers = parseInt(usersResult.rows[0].count);

      // Total facilities
      const facilitiesResult = await db.query('SELECT COUNT(*) as count FROM facilities');
      const totalFacilities = parseInt(facilitiesResult.rows[0].count);

      // Total bookings
      const bookingsResult = await db.query('SELECT COUNT(*) as count FROM bookings');
      const totalBookings = parseInt(bookingsResult.rows[0].count);

      // Monthly revenue (confirmed bookings in current month)
      const revenueResult = await db.query(`
        SELECT COALESCE(SUM(total_price), 0) as revenue
        FROM bookings
        WHERE status = 'Confirmed'
        AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
      `);
      const monthlyRevenue = parseFloat(revenueResult.rows[0].revenue);

      // Growth rate (compare this month vs last month)
      const lastMonthBookings = await db.query(`
        SELECT COUNT(*) as count
        FROM bookings
        WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
      `);
      const thisMonthBookings = await db.query(`
        SELECT COUNT(*) as count
        FROM bookings
        WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
      `);
      
      const lastMonth = parseInt(lastMonthBookings.rows[0].count) || 1;
      const thisMonth = parseInt(thisMonthBookings.rows[0].count) || 0;
      const growthRate = ((thisMonth - lastMonth) / lastMonth * 100).toFixed(1);

      res.json({
        success: true,
        data: {
          totalUsers,
          totalFacilities,
          totalBookings,
          monthlyRevenue,
          growthRate: parseFloat(growthRate)
        }
      });
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async approveOwner(req, res) {
    try {
      const { applicationId } = req.params;
      const adminId = req.user.id;

      const application = await db.query(
        'SELECT user_id FROM owner_applications WHERE id = $1 AND status = \'pending\'',
        [applicationId]
      );

      if (application.rows.length === 0) {
        return res.status(404).json({ error: 'Başvuru bulunamadı veya zaten işleme alınmış' });
      }

      const userId = application.rows[0].user_id;

      await db.query('BEGIN');

      await db.query(
        'UPDATE users SET role = \'SahaSahibi\', account_status = \'active\' WHERE id = $1',
        [userId]
      );

      await db.query(
        'UPDATE owner_applications SET status = \'approved\', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2',
        [adminId, applicationId]
      );

      await db.query('COMMIT');

      res.json({ success: true, message: 'İşletme başvurusu onaylandı' });
    } catch (error) {
      await db.query('ROLLBACK');
      console.error('Approve owner error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async rejectOwner(req, res) {
    try {
      const { applicationId } = req.params;
      const { reason } = req.body;
      const adminId = req.user.id;

      if (!reason) {
        return res.status(400).json({ error: 'Red nedeni gerekli' });
      }

      const application = await db.query(
        'SELECT user_id FROM owner_applications WHERE id = $1 AND status = \'pending\'',
        [applicationId]
      );

      if (application.rows.length === 0) {
        return res.status(404).json({ error: 'Başvuru bulunamadı' });
      }

      const userId = application.rows[0].user_id;

      await db.query('BEGIN');

      await db.query(
        'UPDATE users SET account_status = \'rejected\' WHERE id = $1',
        [userId]
      );

      await db.query(
        'UPDATE owner_applications SET status = \'rejected\', reviewed_by = $1, reviewed_at = NOW(), rejection_reason = $2 WHERE id = $3',
        [adminId, reason, applicationId]
      );

      await db.query('COMMIT');

      res.json({ success: true, message: 'İşletme başvurusu reddedildi' });
    } catch (error) {
      await db.query('ROLLBACK');
      console.error('Reject owner error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getAllUsers(req, res) {
    try {
      const { role, status, search } = req.query;

      let query = `
        SELECT id, full_name, phone, email, role, account_status, created_at 
        FROM users 
        WHERE 1=1
      `;
      const params = [];
      let paramIndex = 1;

      if (role && role !== 'all') {
        query += ` AND role = $${paramIndex}`;
        params.push(role);
        paramIndex++;
      }

      if (status && status !== 'all') {
        query += ` AND account_status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (search) {
        query += ` AND (full_name ILIKE $${paramIndex} OR phone ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      query += ' ORDER BY created_at DESC';

      const result = await db.query(query, params);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async updateUserStatus(req, res) {
    try {
      const { userId } = req.params;
      const { status } = req.body;

      if (!['active', 'suspended'].includes(status)) {
        return res.status(400).json({ error: 'Geçersiz durum' });
      }

      await db.query(
        'UPDATE users SET account_status = $1 WHERE id = $2',
        [status, userId]
      );

      res.json({ success: true, message: 'Kullanıcı durumu güncellendi' });
    } catch (error) {
      console.error('Update user status error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async updateUser(req, res) {
    try {
      const { userId } = req.params;
      const { full_name, phone, email, username, role } = req.body;

      if (!full_name || !phone || !email) {
        return res.status(400).json({ error: 'Ad Soyad, telefon ve email gerekli' });
      }

      const emailCheck = await db.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Bu email adresi başka bir kullanıcı tarafından kullanılıyor' });
      }

      if (username) {
        const usernameCheck = await db.query(
          'SELECT id FROM users WHERE username = $1 AND id != $2',
          [username, userId]
        );

        if (usernameCheck.rows.length > 0) {
          return res.status(400).json({ error: 'Bu kullanıcı adı başka biri tarafından kullanılıyor' });
        }
      }

      let query = 'UPDATE users SET full_name = $1, phone = $2, email = $3';
      const params = [full_name, phone, email];
      let paramIndex = 4;

      if (username) {
        query += `, username = $${paramIndex}`;
        params.push(username);
        paramIndex++;
      }

      if (role && ['User', 'SahaSahibi', 'Admin'].includes(role)) {
        query += `, role = $${paramIndex}`;
        params.push(role);
        paramIndex++;
      }

      query += ` WHERE id = $${paramIndex} RETURNING *`;
      params.push(userId);

      const result = await db.query(query, params);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      }

      res.json({ success: true, data: result.rows[0], message: 'Kullanıcı güncellendi' });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteUser(req, res) {
    try {
      const { userId } = req.params;
      const adminId = req.user.id;

      if (userId === adminId.toString()) {
        return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz' });
      }

      const userCheck = await db.query('SELECT id, role FROM users WHERE id = $1', [userId]);

      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      }

      await db.query('BEGIN');

      // 1. Owner applications sil
      await db.query('DELETE FROM owner_applications WHERE user_id = $1', [userId]);

      // 2. Bookings ve ilişkili transactions sil
      const bookingsResult = await db.query('SELECT id FROM bookings WHERE user_id = $1', [userId]);
      for (const booking of bookingsResult.rows) {
        await db.query('DELETE FROM transactions WHERE booking_id = $1', [booking.id]);
      }
      await db.query('DELETE FROM bookings WHERE user_id = $1', [userId]);

      // 3. Eğer SahaSahibi veya Admin ise, facilities ve ilişkili verileri sil
      if (userCheck.rows[0].role === 'SahaSahibi' || userCheck.rows[0].role === 'Admin') {
        const facilitiesResult = await db.query('SELECT id FROM facilities WHERE owner_id = $1', [userId]);
        
        for (const facility of facilitiesResult.rows) {
          // Her facility'nin pitchlerini bul
          const pitchesResult = await db.query('SELECT id FROM pitches WHERE facility_id = $1', [facility.id]);
          
          for (const pitch of pitchesResult.rows) {
            // Pitch'e ait bookingları bul ve transactions sil
            const pitchBookings = await db.query('SELECT id FROM bookings WHERE pitch_id = $1', [pitch.id]);
            for (const booking of pitchBookings.rows) {
              await db.query('DELETE FROM transactions WHERE booking_id = $1', [booking.id]);
            }
            await db.query('DELETE FROM bookings WHERE pitch_id = $1', [pitch.id]);
          }
          
          // Pitchleri sil
          await db.query('DELETE FROM pitches WHERE facility_id = $1', [facility.id]);
        }
        
        // Facilities sil
        await db.query('DELETE FROM facilities WHERE owner_id = $1', [userId]);
      }

      // 4. Son olarak kullanıcıyı sil
      await db.query('DELETE FROM users WHERE id = $1', [userId]);

      await db.query('COMMIT');

      res.json({ success: true, message: 'Kullanıcı ve ilişkili veriler silindi' });
    } catch (error) {
      await db.query('ROLLBACK');
      console.error('Delete user error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = AdminController;
