const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function addSuspendedStatus() {
  try {
    console.log('🔧 Bookings status constraint güncelleniyor...\n');
    
    // Önce mevcut constraint'i kaldır
    await pool.query(`
      ALTER TABLE bookings 
      DROP CONSTRAINT IF EXISTS bookings_status_check
    `);
    
    console.log('✓ Eski constraint kaldırıldı');
    
    // Yeni constraint ekle (Suspended dahil)
    await pool.query(`
      ALTER TABLE bookings 
      ADD CONSTRAINT bookings_status_check 
      CHECK (status IN ('Pending', 'Confirmed', 'Cancelled', 'Completed', 'NoShow', 'Suspended'))
    `);
    
    console.log('✓ Yeni constraint eklendi (Suspended dahil)');
    
    // Kontrol et
    const result = await pool.query(`
      SELECT 
        con.conname as constraint_name,
        pg_get_constraintdef(con.oid) as constraint_definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'bookings'
      AND con.contype = 'c'
    `);
    
    console.log('\n📋 Bookings tablosu check constraints:\n');
    console.table(result.rows);
    
    console.log('\n✅ Status constraint başarıyla güncellendi!');
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
  } finally {
    await pool.end();
  }
}

addSuspendedStatus();
