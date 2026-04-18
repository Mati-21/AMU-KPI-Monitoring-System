const express = require('express');
const { getUsers, getUserById, deleteUser, resetUserPassword } = require('../controllers/userController');
const { protect, admin } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/').get(protect, admin, getUsers);
router.route('/:id').get(protect, admin, getUserById).delete(protect, admin, deleteUser);
router.route('/:id/reset-password').put(protect, admin, resetUserPassword);

module.exports = router;
