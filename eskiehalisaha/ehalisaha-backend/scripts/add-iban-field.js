const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function addIbanField() {
  try {
    console.log('🔧 Facilities tablosuna IBAN alanı ekleniyor...\n');
    
    await pool.query(`
      ALTER TABLE facilities 
      ADD COLUMN IF NOT EXISTS iban VARCHAR(34)
    `);
    
    console.log('✅ IBAN alanı eklendi');
    
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'facilities' AND column_name = 'iban'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Doğrulama: IBAN field mevcut\n');
      console.log('Field detayları:', result.rows[0]);
    }
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
  } finally {
    await pool.end();
  }
}

addIbanField();
