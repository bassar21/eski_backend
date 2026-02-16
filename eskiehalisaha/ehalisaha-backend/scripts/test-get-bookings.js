const axios = require('axios');

async function testGetBookings() {
  try {
    // 1. Owner ile login
    console.log('🔄 Owner hesabıyla login yapılıyor...\n');
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      login: 'basar',
      password: 'owner123'
    });
    
    console.log('✅ Login başarılı!');
    console.log('User:', loginResponse.data.user.username);
    console.log('User ID:', loginResponse.data.user.id);
    console.log('\n');
    
    const token = loginResponse.data.token;
    
    // 2. Owner'ın tesislerini getir
    console.log('🔄 Tesisler getiriliyor...\n');
    const facilitiesResponse = await axios.get('http://localhost:3000/api/facilities/my-facilities', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Tesisler bulundu!');
    console.log('Tesis sayısı:', facilitiesResponse.data.data.length);
    if (facilitiesResponse.data.data.length > 0) {
      const facility = facilitiesResponse.data.data[0];
      console.log('İlk tesis:', facility.name, '(ID:', facility.id + ')');
      console.log('\n');
      
      // 3. Bu tesisin rezervasyonlarını getir
      console.log('🔄 Rezervasyonlar getiriliyor...\n');
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7); // 7 gün öncesinden
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30); // 30 gün sonrasına
      
      console.log('Tarih aralığı:', startDate.toISOString().split('T')[0], '->', endDate.toISOString().split('T')[0]);
      
      const bookingsResponse = await axios.get(`http://localhost:3000/api/bookings/facility/${facility.id}`, {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('\n✅ API Response:');
      console.log('Status:', bookingsResponse.status);
      console.log('Rezervasyon sayısı:', bookingsResponse.data.data?.length || 0);
      
      if (bookingsResponse.data.data && bookingsResponse.data.data.length > 0) {
        console.log('\n📋 Rezervasyonlar:');
        bookingsResponse.data.data.forEach(booking => {
          console.log(`- ID: ${booking.id}, Müşteri: ${booking.customer_name || booking.user_name}, Tarih: ${booking.start_time}, Durum: ${booking.status}`);
        });
      } else {
        console.log('\n⚠️  Rezervasyon bulunamadı!');
      }
      
      console.log('\n📦 Tam veri:', JSON.stringify(bookingsResponse.data, null, 2));
    }
    
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

testGetBookings();
