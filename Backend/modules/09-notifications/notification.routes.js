import { Router } from 'express';
import * as notificationController from './notification.controller.js';
import { protect, admin } from '../../middleware/authMiddleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Targeted Institutional Alerts, Office Broadcasts & User Inbox (Module 09 - Platform)
 */

/**
 * @swagger
 * /api/notifications/my-notifications:
 *   get:
 *     summary: Retrieve Authenticated User Inbox Notifications
 *     tags: [Notifications]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Inbox notifications array
 */
router.get('/my-notifications', protect, notificationController.getMyInbox);

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     summary: Unread Notification Count for Frontend Bell Badge
 *     tags: [Notifications]
 *     security:
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Unread notification count
 */
router.get('/unread-count', protect, notificationController.getUnreadCount);

/**
 * @swagger
 * /api/notifications/{id}/mark-read:
 *   patch:
 *     summary: Mark a Specific Notification as Read
 *     tags: [Notifications]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: NotificationRecipient UUID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Marked as read
 */
router.patch('/:id/mark-read', protect, notificationController.markAsRead);

/**
 * @swagger
 * /api/notifications/mark-all-read:
 *   patch:
 *     summary: Mark All Unread Notifications as Read
 *     tags: [Notifications]
 *     security:
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: All marked as read
 */
router.patch('/mark-all-read', protect, notificationController.markAllAsRead);

/**
 * @swagger
 * /api/notifications:
 *   post:
 *     summary: Dispatch a Targeted Notification to an Office Scope
 *     tags: [Notifications]
 *     security:
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - message
 *             properties:
 *               targetOfficeId:
 *                 type: string
 *               includeSubOffices:
 *                 type: boolean
 *                 default: false
 *               title:
 *                 type: string
 *                 example: URGENT - Submit Q1 KPI Report
 *               message:
 *                 type: string
 *                 example: The evaluation reporting portal closes this Friday at 5:00 PM.
 *     responses:
 *       201:
 *         description: Notification broadcasted
 */
router.post('/', protect, admin, notificationController.dispatchNotification);

export default router;
