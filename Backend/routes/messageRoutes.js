const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { 
  searchUsers, 
  sendMessage, 
  getMessages, 
  getConversations,
  getUnreadCount,
  markAsRead,
  uploadFile,
  deleteMessage,
  deleteAttachment
} = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

const { messageStorage } = require('../services/uploadService');

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

module.exports = router;
