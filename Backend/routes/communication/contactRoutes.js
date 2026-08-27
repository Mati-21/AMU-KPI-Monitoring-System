import express from 'express';
const router = express.Router();
import { createContactMessage,
  getContactMessages,
  updateContactMessageStatus,
 } from '../../controllers/communication/contactController.js';
import { protect, admin  } from '../../middleware/authMiddleware.js';

// Public route: anyone can submit a contact message
router.post('/', createContactMessage);

// Admin-only routes: read and manage messages
router.get('/', protect, admin, getContactMessages);
router.patch('/:id/status', protect, admin, updateContactMessageStatus);

export default router;
