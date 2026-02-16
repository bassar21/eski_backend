const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function checkPitches() {
  try {
    console.log('📋 Mevcut tesisler:\n');
    const facilities = await pool.query('SELECT * FROM facilities ORDER BY id');
    console.table(facilities.rows);
    
    console.log('\n⚽ Mevcut sahalar:\n');
    const pitches = await pool.query('SELECT * FROM pitches ORDER BY facility_id, id');
    
    if (pitches.rows.length === 0) {
      console.log('⚠️  Hiç saha bulunamadı! Örnek saha oluşturuluyor...\n');
      
      // İlk facility için saha oluştur
      const firstFacility = facilities.rows[0];
      if (firstFacility) {
        const result = await pool.query(
          `INSERT INTO pitches (facility_id, name, type, capacity, hourly_price, deposit_price, opening_hour, closing_hour, slot_duration, is_active, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
           RETURNING *`,
          [firstFacility.id, 'Saha 1', 'Halı Saha', 14, 500, 150, 8, 23, 60, true]
        );
        
        console.log('✅ Yeni saha oluşturuldu:');
        console.table(result.rows);
      }
    } else {
      console.table(pitches.rows);
    }
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
  } finally {
    await pool.end();
  }
}

checkPitches();
