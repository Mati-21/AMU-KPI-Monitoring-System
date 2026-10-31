import { Router } from 'express';
import * as authController from './auth.controller.js';
import { optionalAuth, protect, requireSuperAdmin } from '../../../middleware/authMiddleware.js';
import { limitFailedAttempts } from '../../../middleware/attemptLimiter.js';
import { TOKEN_TYPES, verifyToken } from '../../../config/jwt.js';

const router = Router();

// The account a login step belongs to, for counting failed attempts. A bad cookie is refused by the service.
const stageAccountOf = (req) => {
  try {
    return verifyToken(req.cookies?.auth_stage, TOKEN_TYPES.STAGE).id;
  } catch {
    return null;
  }
};
const limitLogin = limitFailedAttempts('login', (req) => String(req.body?.username || req.body?.email || '').trim().toLowerCase() || null);
const limitCodes = limitFailedAttempts('mfa', (req) => req.user?.id ?? stageAccountOf(req));
const limitPassword = limitFailedAttempts('password', (req) => req.user.id);

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Module 01 — Login, first-login password change, MFA (TOTP) and session cookies
 */

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Authenticate with username (or email) and password
 *     description: |
 *       On success sets the HTTP-only `token` and `refresh_token` cookies.
 *       If a password change or MFA step is required, sets the `auth_stage` cookie instead and returns
 *       `REQUIRE_PASSWORD_CHANGE`, `REQUIRE_MFA_SETUP` or `REQUIRE_MFA_VERIFY`. Tokens are never returned in the body.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string, example: mati.admin, description: Username or email }
 *               password: { type: string, example: "AMU@Temp3944!" }
 *     responses:
 *       200: { description: Login step result (SUCCESS or REQUIRE_*) }
 *       401: { description: Invalid credentials }
 *       403: { description: Account deactivated }
 */
router.post('/auth/login', limitLogin, authController.login);

/**
 * @swagger
 * /api/v1/auth/change-password-first-login:
 *   post:
 *     summary: Replace the temporary password on first login (requires `auth_stage` cookie)
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPassword]
 *             properties:
 *               newPassword: { type: string, example: "PermanentSecurePass123!" }
 *     responses:
 *       200: { description: SUCCESS (session cookies set) or REQUIRE_MFA_SETUP (auth_stage updated) }
 */
router.post('/auth/change-password-first-login', authController.changePasswordFirstLogin);

/**
 * @swagger
 * /api/v1/auth/mfa/setup:
 *   post:
 *     summary: Generate a TOTP secret and QR code (session or `auth_stage` cookie at MFA_SETUP)
 *     tags: [Auth]
 *     responses:
 *       200: { description: "{ secret, otpauth, qrCodeDataUrl }" }
 */
router.post('/auth/mfa/setup', optionalAuth, authController.setupMfa);

/**
 * @swagger
 * /api/v1/auth/mfa/verify-setup:
 *   post:
 *     summary: Verify the first TOTP code, enable MFA and establish the session
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, example: "123456" }
 *     responses:
 *       200: { description: MFA enabled, session cookies set }
 */
router.post('/auth/mfa/verify-setup', optionalAuth, limitCodes, authController.verifyMfaSetup);

/**
 * @swagger
 * /api/v1/auth/mfa/verify:
 *   post:
 *     summary: Verify the TOTP code during login (requires `auth_stage` cookie at MFA_VERIFY)
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, example: "123456" }
 *     responses:
 *       200: { description: Session cookies set }
 *       401: { description: Invalid code }
 */
router.post('/auth/mfa/verify', limitCodes, authController.verifyMfa);

/**
 * @swagger
 * /api/v1/auth/mfa/disable:
 *   post:
 *     summary: Disable optional MFA using a current code (forbidden when MFA is enforced)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, example: "123456" }
 *     responses:
 *       200: { description: MFA disabled }
 */
router.post('/auth/mfa/disable', protect, limitCodes, authController.disableMfa);

/**
 * @swagger
 * /api/v1/auth/refresh-token:
 *   post:
 *     summary: Rotate the `refresh_token` cookie and issue a new access token for the same session
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200: { description: New session cookies set }
 *       401: { description: Refresh token missing, expired, already used (session revoked) or account deactivated }
 */
router.post('/auth/refresh-token', authController.refreshToken);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: End the current session server-side and clear all auth cookies
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200: { description: Logged out }
 */
router.post('/auth/logout', authController.logout);

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Current user profile, office placements and effective permission codes
 *     tags: [Auth]
 *     responses:
 *       200: { description: Profile }
 */
router.get('/auth/me', protect, authController.getMe);

/**
 * @swagger
 * /api/v1/auth/sessions:
 *   get:
 *     summary: My active sessions (device, IP, last activity); the current one is flagged isCurrent
 *     tags: [Auth]
 *     responses:
 *       200: { description: Sessions }
 */
router.get('/auth/sessions', protect, authController.listMySessions);

/**
 * @swagger
 * /api/v1/auth/sessions/revoke-others:
 *   post:
 *     summary: Sign out of every session except the current one
 *     tags: [Auth]
 *     responses:
 *       200: { description: "{ revokedCount }" }
 */
router.post('/auth/sessions/revoke-others', protect, authController.revokeMyOtherSessions);

/**
 * @swagger
 * /api/v1/auth/sessions/{id}:
 *   delete:
 *     summary: Revoke one of my sessions (revoking the current one also clears cookies)
 *     tags: [Auth]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Revoked }
 *       403: { description: Session belongs to another user }
 */
router.delete('/auth/sessions/:id', protect, authController.revokeMySession);

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   post:
 *     summary: Change own password (requires the current password, plus a TOTP code if MFA is enabled)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string }
 *               code: { type: string, description: TOTP code when MFA is enabled }
 *     responses:
 *       200: { description: Password changed }
 */
router.post('/auth/change-password', protect, limitPassword, authController.changePassword);

/**
 * @swagger
 * /api/v1/auth/users/{id}/enforce-mfa:
 *   patch:
 *     summary: Enforce or lift mandatory MFA for one account (Super Admin)
 *     tags: [Auth]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string }, description: UserAccount id, Person id or username }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enforced: { type: boolean, default: true }
 *     responses:
 *       200: { description: Updated }
 */
router.patch('/auth/users/:id/enforce-mfa', protect, requireSuperAdmin, authController.enforceUserMfa);

/**
 * @swagger
 * /api/v1/auth/roles/enforce-mfa:
 *   post:
 *     summary: Enforce or lift mandatory MFA for every holder of a role (Super Admin)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roleId: { type: integer }
 *               roleName: { type: string, example: Dean }
 *               enforced: { type: boolean, default: true }
 *     responses:
 *       200: { description: Updated }
 */
router.post('/auth/roles/enforce-mfa', protect, requireSuperAdmin, authController.enforceRoleMfa);

export default router;
