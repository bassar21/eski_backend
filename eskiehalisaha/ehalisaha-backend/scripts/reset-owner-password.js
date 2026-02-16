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

async function resetPassword() {
  try {
    const newPassword = 'owner123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const result = await pool.query(
      `UPDATE users SET password = $1 WHERE username = 'basar' RETURNING id, username, email, role`,
      [hashedPassword]
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Owner şifresi sıfırlandı:');
      console.table(result.rows);
      console.log('\n📝 Yeni şifre: owner123');
    } else {
      console.log('⚠️  Kullanıcı bulunamadı');
    }
  } catch (error) {
    console.error('❌ Hata:', error.message);
  } finally {
    await pool.end();
  }
}

resetPassword();
