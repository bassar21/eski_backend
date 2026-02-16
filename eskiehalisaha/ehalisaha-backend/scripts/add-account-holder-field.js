const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function addAccountHolderField() {
  try {
    console.log('🔧 Facilities tablosuna account_holder_name alanı ekleniyor...\n');
    
    await pool.query(`
      ALTER TABLE facilities 
      ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(255)
    `);
    
    console.log('✅ account_holder_name alanı eklendi');
    
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'facilities' AND column_name = 'account_holder_name'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Doğrulama: account_holder_name field mevcut\n');
      console.log('Field detayları:', result.rows[0]);
    }
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
  } finally {
    await pool.end();
  }
}

addAccountHolderField();
