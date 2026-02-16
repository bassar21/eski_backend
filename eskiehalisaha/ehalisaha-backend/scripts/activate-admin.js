const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function activateAdmin() {
  try {
    const result = await pool.query(
      `UPDATE users SET account_status = 'active' WHERE username = 'admin' RETURNING id, username, email, role, account_status`
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Admin hesabı aktif edildi:');
      console.table(result.rows);
    } else {
      console.log('⚠️  Admin hesabı bulunamadı');
    }
  } catch (error) {
    console.error('❌ Hata:', error.message);
  } finally {
    await pool.end();
  }
}

activateAdmin();
