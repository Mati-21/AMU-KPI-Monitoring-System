import express from 'express';
import { getUsers, getUserById, updateUser, deleteUser, resetUserPassword, uploadProfilePicture  } from '../../controllers/user/userController.js';
import { protect, requirePermission, permissionKey  } from '../../middleware/authMiddleware.js';

const router = express.Router();

const viewUserPermissions = [
  permissionKey('view', 'User Management'),
  permissionKey('create', 'User Management'),
  permissionKey('edit', 'User Management'),
  permissionKey('delete', 'User Management'),
  permissionKey('manage', 'Users'),
  permissionKey('create', 'Child Office Accounts'),
];

router.route('/').get(protect, requirePermission(viewUserPermissions), getUsers);
router
  .route('/:id')
  .get(
    protect,
    (req, res, next) => {
      // Allow user to view their own profile
      if (String(req.user?.Id || '') === String(req.params.id)) {
        return next();
      }
      // Otherwise, require specific permissions
      requirePermission(viewUserPermissions)(req, res, next);
    },
    getUserById
  )
  .put(protect, updateUser)
  .delete(
    protect,
    requirePermission([permissionKey('delete', 'User Management'), permissionKey('edit', 'User Management'), permissionKey('manage', 'Users')]),
    deleteUser
  );
router
  .route('/:id/reset-password')
  .put(protect, requirePermission([permissionKey('edit', 'User Management'), permissionKey('manage', 'Users')]), resetUserPassword);

import multer from 'multer';
import { profileStorage  } from '../../services/uploadService.js';
const upload = multer({ storage: profileStorage });

router
  .route('/:id/profile')
  .post(protect, upload.single('profile'), uploadProfilePicture);

export default router;
