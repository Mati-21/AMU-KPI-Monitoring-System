const express = require('express');
const { assignRoleToUser, getUserCurrentRole, getAllUserRoles, endUserRole, deleteUserRole } = require('../controllers/userRoleController');
const { protect, admin, requireModulePermission } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/').post(protect, admin, assignRoleToUser).get(protect, requireModulePermission('KPI Management', 'view'), getAllUserRoles);

router.route('/user/:userId').get(protect, requireModulePermission('KPI Management', 'view'), getUserCurrentRole);

router.route('/:id/end').put(protect, admin, endUserRole);

router.route('/:id').delete(protect, admin, deleteUserRole);

module.exports = router;
