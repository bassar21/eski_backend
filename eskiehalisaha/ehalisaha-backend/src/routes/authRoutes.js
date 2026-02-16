const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

class AuthController {
  static async register(req, res) {
    try {
      // Flutter'dan gelen parametreler: fullName, email, password, phoneNumber, role
      // (pitchName ve location da gelebilir, şimdilik User tablosuna odaklanalım)
      const { fullName, email, phone, phoneNumber, password, role } = req.body;
      
      const finalPhone = phone || phoneNumber; // İki türlü de gelebilir

      if (!fullName || !email || !password) {
        return res.status(400).json({ error: 'Ad Soyad, E-posta ve Şifre zorunludur.' });
      }

      // 1. Kullanıcı var mı kontrol et (MSSQL)
      const existingUser = await db.query(
        'SELECT id FROM Users WHERE email = @p1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'Bu e-posta adresi zaten kayıtlı.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userRole = role || 'oyuncu'; // Varsayılan rol

      // 2. Kayıt Ol (MSSQL - OUTPUT INSERTED.* ile dönen veriyi alıyoruz)
      // account_status yerine isApproved (bit) kullanıyoruz (Varsayılan 1/true kabul ettik)
      const result = await db.query(
        `INSERT INTO Users (fullName, email, phoneNumber, password, role, isApproved, createdAt)
         OUTPUT INSERTED.id, INSERTED.fullName, INSERTED.email, INSERTED.role
         VALUES (@p1, @p2, @p3, @p4, @p5, 1, GETDATE())`,
        [fullName, email, finalPhone, hashedPassword, userRole]
      );

      const newUser = result.rows[0];

      res.status(201).json({
        success: true,
        message: 'Kullanıcı başarıyla oluşturuldu',
        user: newUser
      });

    } catch (error) {
      console.error('Register Error:', error);
      res.status(500).json({ error: 'Sunucu hatası oluştu.' });
    }
  }

  static async login(req, res) {
    try {
      // Flutter 'identifier' gönderiyor (email veya telefon olabilir)
      const { identifier, username, email, password } = req.body;
      
      // Frontend'den gelen 'username' veya 'email' alanlarını da destekleyelim
      const loginKey = identifier || email || username;

      if (!loginKey || !password) {
        return res.status(400).json({ error: 'Giriş bilgisi ve şifre gereklidir.' });
      }

      // Kullanıcıyı bul (Email veya Telefon ile)
      const result = await db.query(
        'SELECT * FROM Users WHERE email = @p1 OR phoneNumber = @p1',
        [loginKey]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
      }

      const user = result.rows[0];

      // Şifre kontrolü
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Hatalı şifre.' });
      }

      // Token oluştur
      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET || 'gizli_anahtar',
        { expiresIn: '30d' }
      );

      // Flutter User modeline uygun cevap dön
      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          isApproved: user.isApproved
        }
      });

    } catch (error) {
      console.error('Login Error:', error);
      res.status(500).json({ error: 'Giriş yapılırken hata oluştu.' });
    }
  }
  
  static async getMe(req, res) {
      try {
          const userId = req.user.id;
          const result = await db.query('SELECT id, fullName, email, phoneNumber, role, createdAt FROM Users WHERE id = @p1', [userId]);
          
          if (result.rows.length === 0) {
              return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
          }
          
          res.json({ success: true, user: result.rows[0] });
      } catch (error) {
          res.status(500).json({ error: error.message });
      }
  }
}

module.exports = AuthController;