const axios = require('axios');

async function testLogin() {
  try {
    console.log('🔄 Login testi yapılıyor...\n');
    
    const response = await axios.post('http://localhost:3000/api/auth/login', {
      login: 'admin',
      password: 'admin123'
    });
    
    console.log('✅ Login başarılı!');
    console.log('Token:', response.data.token.substring(0, 20) + '...');
    console.log('User:', response.data.user);
  } catch (error) {
    console.error('❌ Login hatası:');
    console.error('Status:', error.response?.status);
    console.error('Mesaj:', error.response?.data);
  }
}

testLogin();
