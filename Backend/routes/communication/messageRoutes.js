import express from 'express';
const router = express.Router();
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { searchUsers, 
  sendMessage, 
  getMessages, 
  getConversations,
  getUnreadCount,
  markAsRead,
  uploadFile,
  deleteMessage,
  deleteAttachment
 } from '../../controllers/communication/messageController.js';
import { protect  } from '../../middleware/authMiddleware.js';

import { messageStorage  } from '../../services/uploadService.js';

const upload = multer({
  storage: messageStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
});

router.use(protect);

router.get('/search', searchUsers);
router.post('/send', sendMessage);
router.get('/history/:userId', getMessages);
router.get('/conversations', getConversations);
router.get('/unread-count', getUnreadCount);
router.patch('/read/:userId', markAsRead);
router.post('/upload', upload.single('file'), uploadFile);
router.delete('/:messageId', deleteMessage);
router.post('/delete-attachment', deleteAttachment);

export default router;
