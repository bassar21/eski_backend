const express = require('express');
const BookingController = require('../controllers/bookingController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/availability/:pitchId/:date', BookingController.getAvailability);

router.post('/lock', authMiddleware, BookingController.lockSlot);
router.post('/extend-lock', authMiddleware, BookingController.extendLock);
router.post('/release-lock', authMiddleware, BookingController.releaseLock);

router.post('/', authMiddleware, BookingController.createBooking);
router.get('/my-bookings', authMiddleware, BookingController.getUserBookings);
router.post('/cancel/:bookingId', authMiddleware, BookingController.cancelBooking);

router.get(
  '/facility/:facilityId',
  authMiddleware,
  roleMiddleware('SahaSahibi', 'Admin'),
  BookingController.getFacilityBookings
);

router.post(
  '/manual',
  authMiddleware,
  roleMiddleware('SahaSahibi', 'Admin'),
  BookingController.createManualBooking
);

router.patch(
  '/:bookingId/status',
  authMiddleware,
  roleMiddleware('SahaSahibi', 'Admin'),
  BookingController.updateBookingStatus
);

router.delete(
  '/:bookingId',
  authMiddleware,
  roleMiddleware('SahaSahibi', 'Admin'),
  BookingController.deleteBooking
);

module.exports = router;
