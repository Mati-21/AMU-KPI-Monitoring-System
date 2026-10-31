import { Router } from 'express';
import * as notificationController from './notification.controller.js';
import { protect, requirePermission } from '../../middleware/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Module 09 — Targeted office broadcasts, personal inbox and read receipts
 */

/**
 * @swagger
 * /api/v1/notifications/my-notifications:
 *   get:
 *     summary: Current user's notification feed
 *     tags: [Notifications]
 *     parameters:
 *       - { in: query, name: unreadOnly, schema: { type: boolean } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *     responses:
 *       200: { description: Notifications }
 */
router.get('/notifications/my-notifications', protect, notificationController.listMyNotifications);

/**
 * @swagger
 * /api/v1/notifications/unread-count:
 *   get:
 *     summary: Unread count for the bell badge
 *     tags: [Notifications]
 *     responses:
 *       200: { description: "{ count }" }
 */
router.get('/notifications/unread-count', protect, notificationController.countUnread);

/**
 * @swagger
 * /api/v1/notifications/mark-all-read:
 *   patch:
 *     summary: Mark all of the current user's notifications as read
 *     tags: [Notifications]
 *     responses:
 *       200: { description: Updated }
 */
router.patch('/notifications/mark-all-read', protect, notificationController.markAllAsRead);

/**
 * @swagger
 * /api/v1/notifications/{id}/mark-read:
 *   patch:
 *     summary: Mark one notification as read
 *     tags: [Notifications]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid }, description: Notification id }
 *     responses:
 *       200: { description: Updated }
 */
router.patch('/notifications/:id/mark-read', protect, notificationController.markAsRead);

/**
 * @swagger
 * /api/v1/notifications:
 *   post:
 *     summary: Dispatch a notification to an office (optionally its sub-offices) and/or a permission group
 *     tags: [Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, message]
 *             properties:
 *               title: { type: string, example: Q1 reporting window open }
 *               message: { type: string }
 *               targetOfficeId: { type: string, format: uuid }
 *               includeSubOffices: { type: boolean, default: false }
 *               requiredPermissionCode: { type: string, example: "report:submit" }
 *               entityType: { type: string }
 *               entityId: { type: string, format: uuid }
 *     responses:
 *       201: { description: Dispatched }
 */
router.post('/notifications', protect, requirePermission(PERMISSIONS.NOTIFICATION_SEND), notificationController.dispatchNotification);

export default router;
