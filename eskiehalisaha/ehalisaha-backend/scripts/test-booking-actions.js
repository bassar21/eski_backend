const axios = require('axios');

async function testBookingActions() {
  try {
    // 1. Owner ile login
    console.log('🔄 Owner hesabıyla login yapılıyor...\n');
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      login: 'basar',
      password: 'owner123'
    });
    
    console.log('✅ Login başarılı!');
    const token = loginResponse.data.token;
    
    // 2. Rezervasyonları listele
    console.log('\n🔄 Rezervasyonlar getiriliyor...\n');
    const facilitiesResponse = await axios.get('http://localhost:3000/api/facilities/my-facilities', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const facilityId = facilitiesResponse.data.data[0].id;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    
    const bookingsResponse = await axios.get(`http://localhost:3000/api/bookings/facility/${facilityId}`, {
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log(`✅ Toplam ${bookingsResponse.data.data.length} rezervasyon bulundu\n`);
    
    if (bookingsResponse.data.data.length === 0) {
      console.log('⚠️  Test için rezervasyon bulunamadı!');
      return;
    }
    
    const testBooking = bookingsResponse.data.data[0];
    console.log(`📋 Test rezervasyonu: ID ${testBooking.id}, Müşteri: ${testBooking.customer_name}, Durum: ${testBooking.status}\n`);
    
    // 3. Askıya alma testi
    console.log('🔄 Rezervasyonu askıya alıyorum...\n');
    const suspendResponse = await axios.patch(
      `http://localhost:3000/api/bookings/${testBooking.id}/status`,
      { status: 'Suspended' },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('✅ Askıya alma başarılı!');
    console.log('Yeni durum:', suspendResponse.data.data.status);
    
    // 4. Tekrar onaylama testi
    console.log('\n🔄 Rezervasyonu tekrar onaylıyorum...\n');
    const confirmResponse = await axios.patch(
      `http://localhost:3000/api/bookings/${testBooking.id}/status`,
      { status: 'Confirmed' },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('✅ Onaylama başarılı!');
    console.log('Yeni durum:', confirmResponse.data.data.status);
    
    // 5. Test için yeni bir rezervasyon oluştur
    console.log('\n🔄 Test için yeni rezervasyon oluşturuyorum...\n');
    const newBookingResponse = await axios.post('http://localhost:3000/api/bookings/manual', {
      customerName: 'Test - Silinecek',
      customerPhone: '05551111111',
      bookingDate: '2026-01-29',
      startTime: '20:00',
      duration: 1,
      totalPrice: 500
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const newBookingId = newBookingResponse.data.data.id;
    console.log('✅ Test rezervasyonu oluşturuldu, ID:', newBookingId);
    
    // 6. Silme testi
    console.log('\n🔄 Test rezervasyonunu siliyorum...\n');
    const deleteResponse = await axios.delete(
      `http://localhost:3000/api/bookings/${newBookingId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('✅ Silme başarılı!');
    console.log('Mesaj:', deleteResponse.data.message);
    
    console.log('\n🎉 Tüm testler başarılı!');
    
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

testBookingActions();
