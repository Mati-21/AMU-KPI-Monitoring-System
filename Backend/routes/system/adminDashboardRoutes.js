import express from 'express';
const router = express.Router();
import { getAdminSummary  } from '../../controllers/system/adminDashboardController.js';
import { protect, admin  } from '../../middleware/authMiddleware.js';

// All admin dashboard routes require protection and admin privileges
router.use(protect);
router.use(admin);

router.get('/summary', getAdminSummary);

export default router;
