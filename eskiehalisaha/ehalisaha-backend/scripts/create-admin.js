const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function createAdmin() {
  try {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const result = await pool.query(
      `INSERT INTO users (full_name, username, email, phone, password, role, account_status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id, full_name, username, email, role, account_status`,
      ['Admin User', 'admin', 'admin@ehalisaha.com', '05559999999', hashedPassword, 'Admin', 'active']
    );
    
    console.log('✅ Admin kullanıcısı oluşturuldu:');
    console.log('   Kullanıcı Adı:', result.rows[0].username);
    console.log('   E-posta:', result.rows[0].email);
    console.log('   Şifre: admin123');
    console.log('\nGiriş için: http://localhost:5174/login');
  } catch (error) {
    if (error.code === '23505') {
      console.log('⚠️  Admin kullanıcısı zaten mevcut!');
      console.log('   Kullanıcı Adı: admin');
      console.log('   E-posta: admin@ehalisaha.com');
      console.log('   Şifre: admin123');
    } else {
      console.error('❌ Hata:', error.message);
    }
  } finally {
    await pool.end();
  }
}

createAdmin();
