const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function checkBookings() {
  try {
    console.log('📋 Tüm rezervasyonlar:\n');
    const bookings = await pool.query(`
      SELECT 
        b.*,
        p.name as pitch_name,
        f.name as facility_name
      FROM bookings b
      JOIN pitches p ON b.pitch_id = p.id
      JOIN facilities f ON p.facility_id = f.id
      ORDER BY b.created_at DESC
    `);
    
    if (bookings.rows.length === 0) {
      console.log('⚠️  Hiç rezervasyon bulunamadı!');
    } else {
      console.table(bookings.rows);
    }
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
  } finally {
    await pool.end();
  }
}

checkBookings();
