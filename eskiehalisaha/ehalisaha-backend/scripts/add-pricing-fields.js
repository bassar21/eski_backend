const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function addPricingFields() {
  try {
    console.log('🔧 Pitches tablosuna fiyatlandırma alanları ekleniyor...\n');
    
    // Gece fiyatı ve gece tarifesi başlangıç saati ekle
    await pool.query(`
      ALTER TABLE pitches 
      ADD COLUMN IF NOT EXISTS night_start_hour INTEGER DEFAULT 18,
      ADD COLUMN IF NOT EXISTS night_hourly_price NUMERIC(10, 2),
      ADD COLUMN IF NOT EXISTS night_deposit_price NUMERIC(10, 2)
    `);
    
    console.log('✅ Gece fiyatlandırma alanları eklendi');
    
    // Mevcut sahaların gece fiyatlarını gündüz fiyatının 1.5 katı yap
    await pool.query(`
      UPDATE pitches 
      SET 
        night_hourly_price = hourly_price * 1.5,
        night_deposit_price = deposit_price * 1.5,
        night_start_hour = 18
      WHERE night_hourly_price IS NULL
    `);
    
    console.log('✅ Mevcut sahalar için varsayılan gece fiyatları ayarlandı\n');
    
    // Kontrol et
    const result = await pool.query('SELECT * FROM pitches');
    
    console.log('📋 Güncel pitches tablosu:\n');
    console.table(result.rows.map(r => ({
      id: r.id,
      name: r.name,
      hourly_price: r.hourly_price,
      night_price: r.night_hourly_price,
      night_start: r.night_start_hour + ':00'
    })));
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
  } finally {
    await pool.end();
  }
}

addPricingFields();
