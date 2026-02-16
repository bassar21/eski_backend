const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function addPaymentMethodField() {
  try {
    console.log('🔧 Bookings tablosuna payment_method alanı ekleniyor...\n');
    
    await pool.query(`
      ALTER TABLE bookings 
      ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'online'
    `);
    
    console.log('✅ payment_method alanı eklendi (Değerler: online, bank_transfer)');
    
    const result = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'payment_method'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Doğrulama: payment_method field mevcut\n');
      console.log('Field detayları:', result.rows[0]);
    }
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
  } finally {
    await pool.end();
  }
}

addPaymentMethodField();
