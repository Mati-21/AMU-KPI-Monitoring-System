import { Router } from 'express';
import * as authController from './auth.controller.js';
import { protect, admin } from '../../../middleware/authMiddleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication, First-Login Password Change, MFA, and Session Management
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User Login via Username or Email (Sets HTTP-Only Session or Stage Cookie)
 *     description: Authenticates user credentials. First checks mustChangePassword, then checks mfaEnabled. Otherwise prompts for 2FA.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: mati.admin
 *               email:
 *                 type: string
 *                 example: Mati@gmail.com
 *               password:
 *                 type: string
 *                 example: AMU@Temp2026!
 *     responses:
 *       200:
 *         description: Login successful or transition state returned
 *         headers:
 *           Set-Cookie:
 *             description: Sets auth_stage cookie (if MFA/first-login) or token session cookie
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: REQUIRE_PASSWORD_CHANGE
 *                 mustChangePassword:
 *                   type: boolean
 *                   example: true
 *                 mfa_required:
 *                   type: boolean
 *                   example: true
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change Password (First-Time or Regular)
 *     description: Select an option from the Examples dropdown to switch between First-Time Password Change (requires auth_stage cookie) and Regular Password Change (requires currentPassword and session cookie).
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Required for regular password change
 *               newPassword:
 *                 type: string
 *                 description: The new password (min 8 characters)
 *               code:
 *                 type: string
 *                 description: Current 6-digit 2FA code (required if MFA is enabled on account)
 *                 example: "123456"
 *           examples:
 *             firstTimeChange:
 *               summary: First-Time Password Change (No current password or 2FA required)
 *               description: Used during first login with temporary credentials via auth_stage cookie.
 *               value:
 *                 newPassword: "MyNewPassword@2026!"
 *             regularChange:
 *               summary: Regular Password Change (Requires current password & 2FA code)
 *               description: Used by active authenticated users. Requires current password and current 6-digit 2FA code if MFA is enabled.
 *               value:
 *                 currentPassword: "AMU@Temp2026!"
 *                 newPassword: "MyNewPassword@2026!"
 *                 code: "123456"
 *     responses:
 *       200:
 *         description: Password updated successfully (prompts MFA setup if enforced)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: REQUIRE_MFA_SETUP
 *                 mfa_required:
 *                   type: boolean
 *                   example: true
 */
router.post('/change-password', authController.changePassword);
router.post('/change-password-first-login', authController.changePasswordFirstLogin);

/**
 * @swagger
 * /api/auth/mfa/setup:
 *   post:
 *     summary: Generate MFA TOTP Secret & QR Code (Uses auth_stage or token cookie)
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Returns TOTP secret, otpauth URI, and QR code Data URL
 */
router.post('/mfa/setup', authController.setupMfa);

/**
 * @swagger
 * /api/auth/mfa/verify-setup:
 *   post:
 *     summary: Verify Initial 6-digit Code to Activate MFA (Establishes token session cookie)
 *     description: Submit only the 6-digit code generated from your authenticator app. The server automatically uses the secret generated in /mfa/setup.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: MFA verified and activated; session cookie established
 */
router.post('/mfa/verify-setup', authController.verifyMfaSetup);

/**
 * @swagger
 * /api/auth/mfa/verify:
 *   post:
 *     summary: Verify 6-digit TOTP Code During Login Challenge (Uses auth_stage cookie)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: MFA code verified; final session established
 */
router.post('/mfa/verify', authController.verifyMfa);

/**
 * @swagger
 * /api/auth/mfa/disable:
 *   post:
 *     summary: Disable MFA for Current User (Requires session cookie and current code)
 *     tags: [Auth]
 *     security:
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: MFA disabled successfully
 */
router.post('/mfa/disable', protect, authController.disableMfa);

/**
 * @swagger
 * /api/auth/users/{id}/enforce-mfa:
 *   patch:
 *     summary: Enforce or Unenforce MFA on a User Account (Admin only)
 *     tags: [Auth]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: UserAccount ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - enforced
 *             properties:
 *               enforced:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: MFA enforcement status updated
 */
router.patch('/users/:id/enforce-mfa', protect, admin, authController.enforceUserMfa);

/**
 * @swagger
 * /api/auth/roles/enforce-mfa:
 *   post:
 *     summary: Enforce or Waive Mandatory 2FA for All Users Holding a Specific Role (Admin only)
 *     description: Bulk enforces 2FA across all users assigned to a role (e.g. Super Admin, Dean, Director, Department Head).
 *     tags: [Auth]
 *     security:
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roleName:
 *                 type: string
 *                 example: Dean
 *               roleId:
 *                 type: integer
 *               enforced:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *     responses:
 *       200:
 *         description: Role-level 2FA enforcement updated
 */
router.post('/roles/enforce-mfa', protect, admin, authController.enforceRoleMfa);


/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout (Clears all HTTP-only session cookies)
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Successfully logged out
 */
router.post('/logout', authController.logout);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get Current Authenticated User Profile (Requires token session cookie)
 *     tags: [Auth]
 *     security:
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Authenticated user details, person info, and roles
 *       401:
 *         description: Session cookie missing or invalid
 */
router.get('/me', protect, authController.getMe);

export default router;
