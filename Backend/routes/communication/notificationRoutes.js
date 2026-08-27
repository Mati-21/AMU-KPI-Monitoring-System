import express from 'express';
import { protect  } from '../../middleware/authMiddleware.js';
import { getMyNotifications,
  getMyUnreadCount,
  markNotificationRead,
  markAllRead,
  archiveNotification,
 } from '../../controllers/communication/notificationController.js';

const router = express.Router();

router.get('/my', protect, getMyNotifications);
router.get('/my/unread-count', protect, getMyUnreadCount);
router.patch('/my/read-all', protect, markAllRead);
router.patch('/:id/read', protect, markNotificationRead);
router.delete('/:id', protect, archiveNotification);

export default router;
