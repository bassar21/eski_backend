const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function addTestIban() {
  try {
    console.log('🔧 Test IBAN ekleniyor...\n');
    
    await pool.query(
      `UPDATE facilities SET iban = $1 WHERE id = 1`,
      ['TR330006100519786457841326']
    );
    
    console.log('✅ IBAN eklendi!');
    
    const result = await pool.query('SELECT id, name, iban FROM facilities WHERE id = 1');
    
    console.table(result.rows);
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
  } finally {
    await pool.end();
  }
}

addTestIban();
