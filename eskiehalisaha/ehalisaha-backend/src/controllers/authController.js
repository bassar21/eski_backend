const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

class AuthController {
  static async register(req, res) {
    try {
      const { fullName, username, email, phone, password, role, businessInfo } = req.body;

      if (!fullName || !username || !email || !password) {
        return res.status(400).json({ error: 'Ad Soyad, Kullanıcı Adı, E-posta ve Şifre gerekli' });
      }

      // Check if username or email already exists
      const existingUser = await db.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'Bu kullanıcı adı veya e-posta zaten kayıtlı' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      if (role === 'SahaSahibi') {
        if (!businessInfo || !businessInfo.businessName || !businessInfo.businessAddress) {
          return res.status(400).json({ error: 'İşletme bilgileri gerekli' });
        }

        const userResult = await db.query(
          `INSERT INTO users (full_name, username, email, phone, password, role, account_status, created_at)
           VALUES ($1, $2, $3, $4, $5, 'User', 'pending', NOW())
           RETURNING id, full_name, username, email, phone, role, account_status`,
          [fullName, username, email, phone || null, hashedPassword]
        );

        const newUser = userResult.rows[0];

        await db.query(
          `INSERT INTO owner_applications (user_id, business_name, business_address, tax_number, phone, email, additional_info, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())`,
          [
            newUser.id,
            businessInfo.businessName,
            businessInfo.businessAddress,
            businessInfo.taxNumber || null,
            businessInfo.phone || phone || null,
            businessInfo.email || email,
            businessInfo.additionalInfo || null
          ]
        );

        return res.status(201).json({
          success: true,
          message: 'Başvurunuz alındı. Admin onayı bekleniyor.',
          user: {
            id: newUser.id,
            fullName: newUser.full_name,
            username: newUser.username,
            email: newUser.email,
            phone: newUser.phone,
            role: 'User',
            accountStatus: 'pending'
          }
        });
      }

      const result = await db.query(
        `INSERT INTO users (full_name, username, email, phone, password, role, account_status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())
         RETURNING id, full_name, username, email, phone, role, account_status`,
        [fullName, username, email, phone || null, hashedPassword, role || 'User']
      );

      const user = result.rows[0];
      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      res.status(201).json({
        success: true,
        token,
        user: {
          id: user.id,
          fullName: user.full_name,
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: user.role,
          accountStatus: user.account_status
        },
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async login(req, res) {
    try {
      const { login, password } = req.body;

      if (!login || !password) {
        return res.status(400).json({ error: 'Kullanıcı adı/E-posta ve şifre gerekli' });
      }

      const result = await db.query(
        'SELECT * FROM users WHERE username = $1 OR email = $1',
        [login]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Geçersiz kullanıcı adı/e-posta veya şifre' });
      }

      const user = result.rows[0];

      if (user.account_status === 'suspended') {
        return res.status(403).json({ error: 'Hesabınız askıya alınmış. Lütfen destek ekibi ile iletişime geçin.' });
      }

      if (user.account_status === 'rejected') {
        return res.status(403).json({ error: 'İşletme başvurunuz reddedildi.' });
      }

      if (user.account_status === 'pending') {
        return res.status(403).json({ error: 'Hesabınız onay bekliyor. Admin onayından sonra giriş yapabilirsiniz.' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Geçersiz kullanıcı adı/e-posta veya şifre' });
      }

      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          fullName: user.full_name,
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: user.role,
          accountStatus: user.account_status
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getProfile(req, res) {
    try {
      const userId = req.user.id;

      const result = await db.query(
        'SELECT id, full_name, phone, role, email, account_status, created_at FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const { fullName, email } = req.body;

      const result = await db.query(
        `UPDATE users SET full_name = COALESCE($1, full_name), email = COALESCE($2, email)
         WHERE id = $3
         RETURNING id, full_name, phone, role, email, account_status`,
        [fullName, email, userId]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async createAdmin(req, res) {
    try {
      const { fullName, username, email, phone, password } = req.body;

      if (!fullName || !username || !email || !password) {
        return res.status(400).json({ error: 'Ad Soyad, Kullanıcı Adı, E-posta ve Şifre gerekli' });
      }

      const existingUser = await db.query(
        'SELECT * FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'Bu kullanıcı adı veya e-posta zaten kayıtlı' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await db.query(
        `INSERT INTO users (full_name, username, email, phone, password, role, account_status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'Admin', 'active', NOW())
         RETURNING id, full_name, username, email, phone, role, account_status`,
        [fullName, username, email, phone || null, hashedPassword]
      );

      const newAdmin = result.rows[0];

      res.status(201).json({
        success: true,
        message: 'Admin kullanıcısı oluşturuldu',
        user: {
          id: newAdmin.id,
          fullName: newAdmin.full_name,
          username: newAdmin.username,
          email: newAdmin.email,
          phone: newAdmin.phone,
          role: newAdmin.role,
          accountStatus: newAdmin.account_status
        }
      });
    } catch (error) {
      console.error('Create admin error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = AuthController;
