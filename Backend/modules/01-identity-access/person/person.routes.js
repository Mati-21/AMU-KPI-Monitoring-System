import { Router } from 'express';
import * as personController from './person.controller.js';
import { protect, requirePermission } from '../../../middleware/authMiddleware.js';
import { PERMISSIONS } from '../../../config/permissions.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Persons
 *   description: Module 01 — Person master registry and login account provisioning
 */

/**
 * @swagger
 * /api/v1/persons:
 *   get:
 *     summary: List persons with pagination, search and filters
 *     tags: [Persons]
 *     parameters:
 *       - { in: query, name: search, schema: { type: string }, description: Name, email, phone or username }
 *       - { in: query, name: isActive, schema: { type: boolean } }
 *       - { in: query, name: officeId, schema: { type: string, format: uuid } }
 *       - { in: query, name: hasAccount, schema: { type: boolean } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       200: { description: "{ data, pagination }" }
 *   post:
 *     summary: Register a person, optionally with a login account
 *     tags: [Persons]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName]
 *             properties:
 *               staffNumber: { type: string, example: AMU-00123 }
 *               firstName: { type: string, example: Abebe }
 *               middleName: { type: string, example: Kebede }
 *               lastName: { type: string, example: Alemu }
 *               email: { type: string, example: abebe.kebede@amu.edu.et }
 *               phone: { type: string, example: "0911223344" }
 *               account:
 *                 type: object
 *                 properties:
 *                   username: { type: string, example: abebe.k }
 *                   temporaryPassword: { type: string, example: "AMU@Temp1234!" }
 *                   mustChangePassword: { type: boolean, default: true }
 *                   mfaEnforced: { type: boolean, default: false }
 *     responses:
 *       201: { description: Person created }
 *       409: { description: Email or username already in use }
 */
router.get('/persons', protect, requirePermission(PERMISSIONS.USER_READ), personController.listPersons);
router.post('/persons', protect, requirePermission(PERMISSIONS.USER_CREATE), personController.createPerson);

/**
 * @swagger
 * /api/v1/persons/{id}:
 *   get:
 *     summary: Person profile with office placements, roles and login account
 *     tags: [Persons]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Person profile }
 *       404: { description: Not found }
 *   put:
 *     summary: Update demographic details
 *     tags: [Persons]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               staffNumber: { type: string }
 *               firstName: { type: string }
 *               middleName: { type: string }
 *               lastName: { type: string }
 *               email: { type: string }
 *               phone: { type: string }
 *               isActive: { type: boolean }
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     summary: Delete a person (deactivated instead when referenced by institutional records)
 *     tags: [Persons]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Deleted or archived }
 */
router.get('/persons/:id', protect, requirePermission(PERMISSIONS.USER_READ), personController.getPersonById);
router.put('/persons/:id', protect, requirePermission(PERMISSIONS.USER_UPDATE), personController.updatePerson);
router.delete('/persons/:id', protect, requirePermission(PERMISSIONS.USER_DELETE), personController.deletePerson);

/**
 * @swagger
 * /api/v1/persons/{id}/account:
 *   post:
 *     summary: Create or update the login account of an existing person
 *     tags: [Persons]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid }, description: Person id }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string, example: abebe.k }
 *               temporaryPassword: { type: string, example: "AMU@Temp1234!" }
 *               mustChangePassword: { type: boolean, default: true }
 *               mfaEnforced: { type: boolean, default: false }
 *               isActive: { type: boolean, default: true }
 *     responses:
 *       201: { description: Account created }
 *       200: { description: Account updated }
 */
router.post('/persons/:id/account', protect, requirePermission(PERMISSIONS.USER_MANAGE), personController.upsertAccount);

/**
 * @swagger
 * /api/v1/users/{id}/toggle-active:
 *   patch:
 *     summary: Enable or disable login for an account
 *     tags: [Persons]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string }, description: UserAccount id, Person id or username }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isActive]
 *             properties:
 *               isActive: { type: boolean }
 *     responses:
 *       200: { description: Updated }
 */
router.patch('/users/:id/toggle-active', protect, requirePermission(PERMISSIONS.USER_MANAGE), personController.toggleActive);

/**
 * @swagger
 * /api/v1/users/{id}/reset-password:
 *   post:
 *     summary: Set a temporary password that must be changed on next login
 *     tags: [Persons]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string }, description: UserAccount id, Person id or username }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [temporaryPassword]
 *             properties:
 *               temporaryPassword: { type: string, example: "AMU@Reset5678!" }
 *     responses:
 *       200: { description: Password reset }
 */
router.post('/users/:id/reset-password', protect, requirePermission(PERMISSIONS.USER_MANAGE), personController.resetPassword);

/**
 * @swagger
 * /api/v1/users/{id}/sessions:
 *   get:
 *     summary: Sessions of an account (active only unless includeRevoked=true)
 *     tags: [Persons]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string }, description: UserAccount id, Person id or username }
 *       - { in: query, name: includeRevoked, schema: { type: boolean, default: false } }
 *     responses:
 *       200: { description: Sessions }
 */
router.get('/users/:id/sessions', protect, requirePermission(PERMISSIONS.USER_MANAGE), personController.listAccountSessions);

/**
 * @swagger
 * /api/v1/users/{id}/sessions/revoke-all:
 *   post:
 *     summary: Force sign-out of every session of an account
 *     tags: [Persons]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string }, description: UserAccount id, Person id or username }
 *     responses:
 *       200: { description: "{ revokedCount }" }
 */
router.post('/users/:id/sessions/revoke-all', protect, requirePermission(PERMISSIONS.USER_MANAGE), personController.revokeAccountSessions);

export default router;
