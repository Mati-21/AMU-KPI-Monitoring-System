const express = require('express');
const router = express.Router();
const { getAdminSummary } = require('../controllers/adminDashboardController');
const { protect, admin } = require('../middleware/authMiddleware');

// All admin dashboard routes require protection and admin privileges
router.use(protect);
router.use(admin);

router.get('/summary', getAdminSummary);

module.exports = router;
