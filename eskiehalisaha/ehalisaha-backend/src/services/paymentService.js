const axios = require('axios');
const crypto = require('crypto');
const db = require('../config/database');
const SlotLockService = require('./slotLockService');

class PaymentService {
  constructor() {
    this.apiKey = process.env.IYZICO_API_KEY;
    this.secretKey = process.env.IYZICO_SECRET_KEY;
    this.baseUrl = process.env.IYZICO_BASE_URL;
  }

  generateAuthHeader(requestBody) {
    const randomString = crypto.randomBytes(16).toString('hex');
    const dataToHash = randomString + JSON.stringify(requestBody);
    const hash = crypto
      .createHmac('sha256', this.secretKey)
      .update(dataToHash)
      .digest('base64');
    
    return `IYZWS ${this.apiKey}:${hash}`;
  }

  async initializePayment(bookingData) {
    const { bookingId, userId, pitchId, startTime, endTime, totalAmount, userInfo } = bookingData;
    
    const depositAmount = (totalAmount * 0.3).toFixed(2);
    
    const booking = await db.query(
      `INSERT INTO bookings (pitch_id, user_id, start_time, end_time, status, total_price, deposit_amount)
       VALUES ($1, $2, $3, $4, 'Pending', $5, $6) 
       RETURNING id`,
      [pitchId, userId, startTime, endTime, totalAmount, depositAmount]
    );
    
    const newBookingId = booking.rows[0].id;
    
    const paymentRequest = {
      locale: 'tr',
      conversationId: newBookingId.toString(),
      price: depositAmount,
      paidPrice: depositAmount,
      currency: 'TRY',
      basketId: newBookingId.toString(),
      paymentGroup: 'PRODUCT',
      callbackUrl: `${process.env.BASE_URL}/api/payment/callback`,
      enabledInstallments: [1],
      buyer: {
        id: userId.toString(),
        name: userInfo.name,
        surname: userInfo.surname,
        gsmNumber: userInfo.phone,
        email: userInfo.email,
        identityNumber: '11111111111',
        registrationAddress: 'Adres',
        city: 'Istanbul',
        country: 'Turkey',
      },
      shippingAddress: {
        contactName: userInfo.name,
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Adres',
      },
      billingAddress: {
        contactName: userInfo.name,
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Adres',
      },
      basketItems: [
        {
          id: pitchId.toString(),
          name: 'Halı Saha Rezervasyonu',
          category1: 'Spor',
          itemType: 'VIRTUAL',
          price: depositAmount,
        },
      ],
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/payment/iyzipos/checkoutform/initialize/auth/ecom`,
        paymentRequest,
        {
          headers: {
            'Authorization': this.generateAuthHeader(paymentRequest),
            'Content-Type': 'application/json',
          },
        }
      );

      await db.query(
        `INSERT INTO transactions (booking_id, amount, type, provider, provider_transaction_id, status)
         VALUES ($1, $2, 'deposit', 'iyzico', $3, 'pending')`,
        [newBookingId, depositAmount, response.data.token]
      );

      return {
        success: true,
        bookingId: newBookingId,
        paymentPageUrl: response.data.paymentPageUrl,
        token: response.data.token,
      };
    } catch (error) {
      console.error('Payment initialization error:', error.response?.data || error);
      
      await db.query(
        `UPDATE bookings SET status = 'Failed' WHERE id = $1`,
        [newBookingId]
      );
      
      throw new Error('Ödeme başlatılamadı');
    }
  }

  async handleCallback(token) {
    try {
      const request = {
        locale: 'tr',
        conversationId: token,
        token: token,
      };

      const response = await axios.post(
        `${this.baseUrl}/payment/iyzipos/checkoutform/auth/ecom/detail`,
        request,
        {
          headers: {
            'Authorization': this.generateAuthHeader(request),
            'Content-Type': 'application/json',
          },
        }
      );

      const { status, paymentStatus, basketId } = response.data;

      if (status === 'success' && paymentStatus === 'SUCCESS') {
        await db.query(
          `UPDATE bookings SET status = 'Confirmed' WHERE id = $1`,
          [basketId]
        );

        await db.query(
          `UPDATE transactions SET status = 'success' WHERE provider_transaction_id = $1`,
          [token]
        );

        const booking = await db.query(
          `SELECT pitch_id, start_time, user_id FROM bookings WHERE id = $1`,
          [basketId]
        );

        if (booking.rows.length > 0) {
          const { pitch_id, start_time, user_id } = booking.rows[0];
          await SlotLockService.releaseLock(pitch_id, start_time, user_id);
        }

        return { success: true, bookingId: basketId };
      } else {
        await db.query(
          `UPDATE bookings SET status = 'Failed' WHERE id = $1`,
          [basketId]
        );

        return { success: false, reason: 'Ödeme başarısız' };
      }
    } catch (error) {
      console.error('Payment callback error:', error.response?.data || error);
      throw new Error('Ödeme doğrulanamadı');
    }
  }

  async refundPayment(bookingId, refundPercentage) {
    const booking = await db.query(
      `SELECT deposit_amount, status FROM bookings WHERE id = $1`,
      [bookingId]
    );

    if (booking.rows.length === 0 || booking.rows[0].status !== 'Confirmed') {
      throw new Error('Rezervasyon bulunamadı veya iptal edilemez');
    }

    const refundAmount = (booking.rows[0].deposit_amount * refundPercentage / 100).toFixed(2);

    const transaction = await db.query(
      `SELECT provider_transaction_id FROM transactions 
       WHERE booking_id = $1 AND status = 'success' AND type = 'deposit'`,
      [bookingId]
    );

    if (transaction.rows.length === 0) {
      throw new Error('Ödeme işlemi bulunamadı');
    }

    const refundRequest = {
      locale: 'tr',
      conversationId: bookingId.toString(),
      paymentTransactionId: transaction.rows[0].provider_transaction_id,
      price: refundAmount,
      currency: 'TRY',
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/payment/refund`,
        refundRequest,
        {
          headers: {
            'Authorization': this.generateAuthHeader(refundRequest),
            'Content-Type': 'application/json',
          },
        }
      );

      await db.query(
        `INSERT INTO transactions (booking_id, amount, type, provider, status)
         VALUES ($1, $2, 'refund', 'iyzico', 'success')`,
        [bookingId, refundAmount]
      );

      await db.query(
        `UPDATE bookings SET status = 'Cancelled' WHERE id = $1`,
        [bookingId]
      );

      return { success: true, refundAmount };
    } catch (error) {
      console.error('Refund error:', error.response?.data || error);
      throw new Error('İade işlemi başarısız');
    }
  }

  async processCancellation(bookingId, userId) {
    const booking = await db.query(
      `SELECT * FROM bookings WHERE id = $1 AND user_id = $2 AND status = 'Confirmed'`,
      [bookingId, userId]
    );

    if (booking.rows.length === 0) {
      throw new Error('Rezervasyon bulunamadı');
    }

    const startTime = new Date(booking.rows[0].start_time);
    const now = new Date();
    const hoursUntilMatch = (startTime - now) / (1000 * 60 * 60);

    let refundPercentage = 0;
    if (hoursUntilMatch > 24) {
      refundPercentage = 100;
    } else if (hoursUntilMatch > 6) {
      refundPercentage = 50;
    } else {
      throw new Error('İptal süresi dolmuş. Lütfen işletme ile iletişime geçin.');
    }

    return await this.refundPayment(bookingId, refundPercentage);
  }
}

module.exports = new PaymentService();
