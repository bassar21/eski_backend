const axios = require('axios');

async function testManualBooking() {
  try {
    // 1. Owner ile login
    console.log('🔄 Owner hesabıyla login yapılıyor...\n');
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      login: 'basar',
      password: 'owner123'
    });
    
    console.log('✅ Login başarılı!');
    console.log('User:', loginResponse.data.user.username);
    console.log('\n');
    
    const token = loginResponse.data.token;
    
    // 2. Manuel rezervasyon oluştur
    console.log('🔄 Manuel rezervasyon oluşturuluyor...\n');
    const bookingResponse = await axios.post('http://localhost:3000/api/bookings/manual', {
      customerName: 'Test Müşteri',
      customerPhone: '05551234567',
      customerEmail: 'test@test.com',
      bookingDate: '2026-01-28',
      startTime: '18:00',
      duration: 2,
      totalPrice: 1000
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Rezervasyon oluşturuldu!');
    console.log('Rezervasyon ID:', bookingResponse.data.data.id);
    console.log('Müşteri:', bookingResponse.data.data.customer_name);
    console.log('Telefon:', bookingResponse.data.data.customer_phone);
    console.log('Durum:', bookingResponse.data.data.status);
    console.log('\nTam veri:', JSON.stringify(bookingResponse.data, null, 2));
    
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

testManualBooking();
