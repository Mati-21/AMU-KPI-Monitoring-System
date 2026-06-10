const express = require('express');
const router = express.Router();
const {
  createContactMessage,
  getContactMessages,
  updateContactMessageStatus,
} = require('../controllers/contactController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public route: anyone can submit a contact message
router.post('/', createContactMessage);

// Admin-only routes: read and manage messages
router.get('/', protect, admin, getContactMessages);
router.patch('/:id/status', protect, admin, updateContactMessageStatus);

module.exports = router;
