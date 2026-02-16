// const PaymentService = require('../services/paymentService'); // Servis olmadığı için kapattım

class PaymentController {
  static async callback(req, res) {
    try {
      // Ödeme servisi olmadığı için direkt başarı sayfasına yönlendiriyorum (Test için)
      // Gerçek senaryoda burayı açmalısın
      res.redirect(`${process.env.FRONTEND_URL}/booking-success`);
    } catch (error) {
      console.error('Payment callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/booking-failed`);
    }
  }

  static async refund(req, res) {
    res.status(501).json({ message: 'İade işlemi henüz aktif değil.' });
  }
}

module.exports = PaymentController;