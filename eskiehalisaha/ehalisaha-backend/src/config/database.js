const sql = require('mssql');
require('dotenv').config();

// VDS üzerindeki MSSQL Veritabanı Bilgileri
const config = {
  user: process.env.DB_USER,      // .env dosyasından gelir
  password: process.env.DB_PASSWORD, // .env dosyasından gelir
  server: process.env.DB_HOST,    // .env dosyasından gelir (Örn: localhost)
  port: parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_NAME,  // .env dosyasından gelir
  options: {
    encrypt: false, // Sertifika zorunluluğunu kaldırır
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

// Bağlantı Havuzu
const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('✅ MSSQL Veritabanına Başarıyla Bağlanıldı');
    return pool;
  })
  .catch(err => {
    console.error('❌ Veritabanı Bağlantı Hatası: ', err);
    process.exit(1);
  });

module.exports = {
  // Eski kodların kullandığı query fonksiyonunu taklit ediyoruz
  query: async (text, params) => {
    try {
      const pool = await poolPromise;
      const request = pool.request();

      // PostgreSQL ($1, $2) formatını MSSQL (@p1, @p2) formatına çeviriyoruz
      let mssqlText = text;
      
      if (params && params.length > 0) {
        params.forEach((param, index) => {
          // Parametreleri isteğe ekle
          request.input(`p${index + 1}`, param);
        });
        // Sorgu metnindeki $1, $2'leri @p1, @p2 yap
        mssqlText = text.replace(/\$([0-9]+)/g, '@p$1');
      }

      const result = await request.query(mssqlText);

      // Eski kodlar "rows" beklediği için dönen cevabı ona benzetiyoruz
      return {
        rows: result.recordset,
        rowCount: result.rowsAffected[0]
      };
    } catch (err) {
      console.error('SQL Sorgu Hatası:', err);
      throw err;
    }
  },
  poolPromise
};