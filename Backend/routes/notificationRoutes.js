const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  getMyNotifications,
  getMyUnreadCount,
  markNotificationRead,
  markAllRead,
  archiveNotification,
} = require('../controllers/notificationController');

const router = express.Router();

router.get('/my', protect, getMyNotifications);
router.get('/my/unread-count', protect, getMyUnreadCount);
router.patch('/my/read-all', protect, markAllRead);
router.patch('/:id/read', protect, markNotificationRead);
router.delete('/:id', protect, archiveNotification);

module.exports = router;
