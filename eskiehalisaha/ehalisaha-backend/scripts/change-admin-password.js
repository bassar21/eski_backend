const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function changeAdminPassword() {
  const newPassword = process.argv[2];

  if (!newPassword) {
    console.error('❌ Kullanım: node change-admin-password.js <yeni_sifre>');
    process.exit(1);
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const result = await pool.query(
      'UPDATE users SET password = $1 WHERE email = $2 RETURNING id, email',
      [hashedPassword, 'admin@ehalisaha.com']
    );

    if (result.rows.length === 0) {
      console.error('❌ Admin kullanıcı bulunamadı!');
      process.exit(1);
    }

    console.log('✅ Admin şifresi başarıyla değiştirildi!');
    console.log('📧 Email: admin@ehalisaha.com');
    console.log('🔑 Yeni Şifre:', newPassword);
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
  } finally {
    await pool.end();
  }
}

changeAdminPassword();
