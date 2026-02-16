const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function addAccountHolderName() {
  try {
    console.log('🔧 Hesap sahibi bilgisi ekleniyor...\n');
    
    await pool.query(
      `UPDATE facilities SET account_holder_name = $1 WHERE id = 1`,
      ['Ahmet Yılmaz']
    );
    
    console.log('✅ Hesap sahibi eklendi!');
    
    const result = await pool.query('SELECT id, name, iban, account_holder_name FROM facilities WHERE id = 1');
    
    console.table(result.rows);
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
  } finally {
    await pool.end();
  }
}

addAccountHolderName();
