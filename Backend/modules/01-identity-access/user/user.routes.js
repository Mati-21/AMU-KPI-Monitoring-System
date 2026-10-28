import { Router } from 'express';
import * as userController from './user.controller.js';
import { protect, admin } from '../../../middleware/authMiddleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: University User Accounts & Faculty/Staff Management (Module 01 - Identity)
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: List All Users with Pagination, Full-Text Search & Filters
 *     description: Returns unified user profiles combining personal demographic data, login credentials, and office roles.
 *     tags: [Users]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, email, phone, or username
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, suspended, archived]
 *       - in: query
 *         name: hasAccount
 *         schema:
 *           type: boolean
 *         description: Filter users with or without active login accounts
 *       - in: query
 *         name: officeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Paginated list of unified user profiles
 *   post:
 *     summary: Register a New User (with Optional Immediate Login Credentials)
 *     description: Creates both the personal profile and the login account in a single transaction.
 *     tags: [Users]
 *     security:
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: Abebe
 *               middleName:
 *                 type: string
 *                 example: Kebede
 *               lastName:
 *                 type: string
 *                 example: Tadesse
 *               gender:
 *                 type: string
 *                 example: Male
 *               birthDate:
 *                 type: string
 *                 format: date
 *                 example: 1985-05-20
 *               email:
 *                 type: string
 *                 example: abebe.k@amu.edu.et
 *               phone:
 *                 type: string
 *                 example: "+251911223344"
 *               username:
 *                 type: string
 *                 example: abebe.k
 *               password:
 *                 type: string
 *                 example: AMU@Temp2026!
 *               mustChangePassword:
 *                 type: boolean
 *                 default: true
 *               mfaEnforced:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: User registered successfully
 */
router.get('/', protect, userController.getUsers);
router.post('/', protect, admin, userController.createUser);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get Full User Profile by ID (Demographics, Account, Office Placements & Roles)
 *     tags: [Users]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: UserAccount ID or Person ID
 *     responses:
 *       200:
 *         description: Unified user profile
 *       404:
 *         description: User not found
 *   put:
 *     summary: Update User Demographic & Account Information
 *     tags: [Users]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               username:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, suspended, archived]
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User updated successfully
 *   delete:
 *     summary: Delete or Archive a User
 *     tags: [Users]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted or archived
 */
router.get('/:id', protect, userController.getUserById);
router.put('/:id', protect, admin, userController.updateUser);
router.delete('/:id', protect, admin, userController.deleteUser);

/**
 * @swagger
 * /api/users/{id}/account:
 *   post:
 *     summary: Provision Login Credentials for an Existing User
 *     tags: [Users]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - temporaryPassword
 *             properties:
 *               username:
 *                 type: string
 *                 example: chala.t
 *               temporaryPassword:
 *                 type: string
 *                 example: AMU@Temp2026!
 *               mustChangePassword:
 *                 type: boolean
 *                 default: true
 *               mfaEnforced:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: User login credentials provisioned successfully
 */
router.post('/:id/account', protect, admin, userController.provisionAccount);

/**
 * @swagger
 * /api/users/{id}/account/toggle-active:
 *   patch:
 *     summary: Enable or Disable User Login Capabilities
 *     tags: [Users]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: User account status updated
 */
router.patch('/:id/account/toggle-active', protect, admin, userController.toggleAccountActive);

/**
 * @swagger
 * /api/users/{id}/account/reset-password:
 *   post:
 *     summary: Administrator Force-Reset of User Password
 *     description: Sets a new temporary password and marks mustChangePassword to true
 *     tags: [Users]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - temporaryPassword
 *             properties:
 *               temporaryPassword:
 *                 type: string
 *                 example: AMU@Reset2026!
 *     responses:
 *       200:
 *         description: User password reset successfully
 */
router.post('/:id/account/reset-password', protect, admin, userController.resetPassword);

export default router;
