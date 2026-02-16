const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function checkUsers() {
  try {
    console.log('📋 Tüm kullanıcılar:\n');
    const users = await pool.query(`
      SELECT id, username, email, role, account_status 
      FROM users 
      ORDER BY created_at DESC
    `);
    
    console.table(users.rows);
    
    console.log('\n📦 Tüm tesisler:\n');
    const facilities = await pool.query(`
      SELECT id, name, owner_id, address 
      FROM facilities 
      ORDER BY created_at DESC
    `);
    
    console.table(facilities.rows);
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
  } finally {
    await pool.end();
  }
}

checkUsers();
