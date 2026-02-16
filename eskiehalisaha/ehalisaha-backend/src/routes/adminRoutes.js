const express = require('express');
const AdminController = require('../controllers/adminController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware('Admin'));

router.get('/dashboard/stats', AdminController.getDashboardStats);
router.get('/pending-owners', AdminController.getPendingOwners);
router.post('/approve-owner/:applicationId', AdminController.approveOwner);
router.post('/reject-owner/:applicationId', AdminController.rejectOwner);

router.get('/users', AdminController.getAllUsers);
router.put('/users/:userId/status', AdminController.updateUserStatus);
router.put('/users/:userId', AdminController.updateUser);
router.delete('/users/:userId', AdminController.deleteUser);

module.exports = router;
