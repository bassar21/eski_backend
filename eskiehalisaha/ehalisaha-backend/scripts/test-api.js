const axios = require('axios');

async function testAPI() {
  try {
    // 1. Owner ile login
    console.log('🔄 Owner hesabıyla login yapılıyor...\n');
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      login: 'basar',
      password: 'owner123'
    });
    
    console.log('✅ Login başarılı!');
    console.log('Token:', loginResponse.data.token.substring(0, 30) + '...');
    console.log('User:', loginResponse.data.user);
    console.log('\n');
    
    const token = loginResponse.data.token;
    
    // 2. My Facilities endpoint'ini test et
    console.log('🔄 /my-facilities endpoint test ediliyor...\n');
    const facilitiesResponse = await axios.get('http://localhost:3000/api/facilities/my-facilities', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Facilities alındı!');
    console.log('Tesis sayısı:', facilitiesResponse.data.data.length);
    console.log('Tesisler:', JSON.stringify(facilitiesResponse.data.data, null, 2));
    
  } catch (error) {
    if (error.response) {
      console.error('❌ API Hatası:');
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('❌ Hata:', error.message);
    }
  }
}

testAPI();
