import { Router } from 'express';
import * as messageController from './message.controller.js';
import { protect } from '../../middleware/authMiddleware.js';
import { uploadOneFile } from '../08-evidence-documents/upload.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Messaging
 *   description: Module 13 — Direct messages between two people, with file attachments. Any signed-in person may use it.
 * /api/v1/messages/conversations:
 *   get:
 *     summary: People I have talked with, most recent first, with the last message and my unread count
 *     tags: [Messaging]
 *     responses:
 *       200: { description: "[{ person, lastMessage, unreadCount }]" }
 * /api/v1/messages/unread-count:
 *   get:
 *     summary: How many messages sent to me are unread
 *     tags: [Messaging]
 *     responses:
 *       200: { description: "{ unread }" }
 * /api/v1/messages/search:
 *   get:
 *     summary: Find people to message by name, username or email (at least 2 letters, at most 10 results)
 *     tags: [Messaging]
 *     parameters:
 *       - { in: query, name: query, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: People }
 * /api/v1/messages/people/{personId}:
 *   get:
 *     summary: One person I can message
 *     tags: [Messaging]
 *     parameters:
 *       - { in: path, name: personId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Person }
 *       404: { description: That person cannot receive messages }
 * /api/v1/messages/history/{personId}:
 *   get:
 *     summary: My latest messages with one person, oldest first (at most 200)
 *     tags: [Messaging]
 *     parameters:
 *       - { in: path, name: personId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: limit, schema: { type: integer, default: 200, maximum: 200 } }
 *     responses:
 *       200: { description: Messages }
 * /api/v1/messages/upload:
 *   post:
 *     summary: Upload a file (multipart field "file", up to 10 MB) to attach to a message
 *     tags: [Messaging]
 *     responses:
 *       201: { description: "{ fileId, fileName, fileType, size, fileUrl }" }
 * /api/v1/messages/files/{fileId}:
 *   get:
 *     summary: A file in a message. Only the sender and the receiver can open it
 *     tags: [Messaging]
 *     parameters:
 *       - { in: path, name: fileId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: The file }
 *       404: { description: Not found, or not yours }
 * /api/v1/messages/send:
 *   post:
 *     summary: Send a message with text, files, or both
 *     description: The receiver and the sender's other tabs get a messages:new socket event.
 *     tags: [Messaging]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [receiverId]
 *             properties:
 *               receiverId: { type: string, format: uuid }
 *               content: { type: string, maxLength: 4000 }
 *               attachments:
 *                 type: array
 *                 maxItems: 5
 *                 items: { type: object, properties: { fileId: { type: string, format: uuid } } }
 *     responses:
 *       201: { description: The message }
 * /api/v1/messages/read/{personId}:
 *   patch:
 *     summary: Mark everything that person sent me as read
 *     tags: [Messaging]
 *     parameters:
 *       - { in: path, name: personId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: "{ markedRead }" }
 * /api/v1/messages/{id}:
 *   delete:
 *     summary: Delete one of my messages, for both people
 *     tags: [Messaging]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Deleted }
 *       403: { description: Not my message }
 * /api/v1/messages/{id}/attachments/{fileId}:
 *   delete:
 *     summary: Remove one file from one of my messages. A message left empty is deleted
 *     tags: [Messaging]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: fileId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Removed }
 */
router.get('/messages/conversations', protect, messageController.listConversations);
router.get('/messages/unread-count', protect, messageController.countUnread);
router.get('/messages/search', protect, messageController.searchPeople);
router.get('/messages/people/:personId', protect, messageController.getPerson);
router.get('/messages/history/:personId', protect, messageController.getHistory);
router.post('/messages/upload', protect, uploadOneFile, messageController.uploadAttachment);
router.get('/messages/files/:fileId', protect, messageController.getAttachment);
router.post('/messages/send', protect, messageController.sendMessage);
router.patch('/messages/read/:personId', protect, messageController.markConversationRead);
router.delete('/messages/:id', protect, messageController.deleteMessage);
router.delete('/messages/:id/attachments/:fileId', protect, messageController.deleteAttachment);

export default router;
