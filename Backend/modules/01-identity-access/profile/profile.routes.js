import { Router } from 'express';
import * as profileController from './profile.controller.js';
import { protect } from '../../../middleware/authMiddleware.js';
import { uploadOneFile } from '../../08-evidence-documents/upload.middleware.js';

const router = Router();

/**
 * @swagger
 * /api/v1/auth/me:
 *   put:
 *     summary: Change your own phone and email. Other details stay with user administrators
 *     tags: [Auth]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { phone: { type: string }, email: { type: string } } }
 *     responses:
 *       200: { description: Your updated profile }
 *       409: { description: Email already in use }
 * /api/v1/auth/me/profile-picture:
 *   put:
 *     summary: Upload or replace your profile picture (png, jpg, jpeg or webp)
 *     description: The largest size follows the general.profile_picture_max_mb setting. The previous picture is removed.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema: { type: object, required: [file], properties: { file: { type: string, format: binary } } }
 *     responses:
 *       200: { description: "{ profilePictureFileId }" }
 *       400: { description: "Too large, wrong type, or contents do not match the extension" }
 *   delete:
 *     summary: Remove your profile picture
 *     tags: [Auth]
 *     responses:
 *       200: { description: Removed }
 *       404: { description: You have no profile picture }
 * /api/v1/persons/{id}/profile-picture:
 *   get:
 *     summary: A person's profile picture. Anyone logged in may see it
 *     tags: [Auth]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: The image }
 *       404: { description: This person has no profile picture }
 */
router.put('/auth/me', protect, profileController.updateMyProfile);
router.put('/auth/me/profile-picture', protect, uploadOneFile, profileController.uploadMyProfilePicture);
router.delete('/auth/me/profile-picture', protect, profileController.removeMyProfilePicture);
router.get('/persons/:id/profile-picture', protect, profileController.getProfilePicture);

export default router;
