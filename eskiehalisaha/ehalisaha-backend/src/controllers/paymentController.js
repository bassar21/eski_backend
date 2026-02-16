const PaymentService = require('../services/paymentService');

class PaymentController {
  static async callback(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ error: 'Token gerekli' });
      }

      const result = await PaymentService.handleCallback(token);

      if (result.success) {
        res.redirect(`${process.env.FRONTEND_URL}/booking-success?bookingId=${result.bookingId}`);
      } else {
        res.redirect(`${process.env.FRONTEND_URL}/booking-failed?reason=${result.reason}`);
      }
    } catch (error) {
      console.error('Payment callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/booking-failed?reason=system_error`);
    }
  }

  static async refund(req, res) {
    try {
      const { bookingId, percentage } = req.body;
      const userId = req.user.id;

      if (!bookingId || !percentage) {
        return res.status(400).json({ error: 'bookingId ve percentage gerekli' });
      }

      const result = await PaymentService.refundPayment(bookingId, percentage);
      res.json(result);
    } catch (error) {
      console.error('Refund error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = PaymentController;
