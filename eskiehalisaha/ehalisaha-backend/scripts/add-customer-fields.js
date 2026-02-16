const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function addCustomerFields() {
  try {
    console.log('🔧 Bookings tablosuna müşteri bilgisi sütunları ekleniyor...\n');
    
    // Sütunları ekle
    await pool.query(`
      ALTER TABLE bookings 
      ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20),
      ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255)
    `);
    
    console.log('✅ Sütunlar başarıyla eklendi!\n');
    
    // Kontrol et
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bookings'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Güncel bookings tablosu:\n');
    console.table(result.rows);
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
  } finally {
    await pool.end();
  }
}

addCustomerFields();
