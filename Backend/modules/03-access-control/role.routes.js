import { Router } from 'express';
import * as roleController from './role.controller.js';
import { protect, admin } from '../../middleware/authMiddleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Roles & Permissions
 *   description: RBAC Roles, Scoped ABAC Delegations & Atomic Permissions (Module 03 - Governance)
 */

/**
 * @swagger
 * /api/roles/permissions:
 *   get:
 *     summary: List All Atomic Permissions Registered in the System
 *     tags: [Roles & Permissions]
 *     security:
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: List of permission codes
 *   post:
 *     summary: Register a New Atomic Permission Code
 *     tags: [Roles & Permissions]
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
 *                 example: kpi:cascade
 *     responses:
 *       201:
 *         description: Permission registered successfully
 */
router.get('/permissions', protect, roleController.getPermissions);
router.post('/permissions', protect, admin, roleController.createPermission);

/**
 * @swagger
 * /api/roles/scoped-assign:
 *   post:
 *     summary: Assign a Scoped Role to an Employee Office Placement (OfficePersonRole)
 *     description: Empowers location-scoped authority (e.g. Dean within College of Computing between specified dates)
 *     tags: [Roles & Permissions]
 *     security:
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - officePersonId
 *               - roleId
 *             properties:
 *               officePersonId:
 *                 type: string
 *                 description: UUID of OfficePerson placement record
 *               roleId:
 *                 type: integer
 *                 example: 2
 *               scopeOfficeId:
 *                 type: string
 *                 description: Optional UUID of Office where role is restricted
 *               validFrom:
 *                 type: string
 *                 format: date
 *                 example: 2026-09-01
 *               validTo:
 *                 type: string
 *                 format: date
 *                 example: 2027-08-31
 *     responses:
 *       201:
 *         description: Scoped role successfully assigned
 */
router.post('/scoped-assign', protect, admin, roleController.assignScopedRole);

/**
 * @swagger
 * /api/roles/scoped-assign/{id}:
 *   delete:
 *     summary: Revoke an Active Scoped Role Assignment
 *     tags: [Roles & Permissions]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: UUID of OfficePersonRole record
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Scoped role assignment revoked
 */
router.delete('/scoped-assign/:id', protect, admin, roleController.revokeScopedRole);

/**
 * @swagger
 * /api/roles:
 *   get:
 *     summary: List All Roles with Permission and Member Counts
 *     tags: [Roles & Permissions]
 *     security:
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Array of roles with assigned permissions
 *   post:
 *     summary: Create a New System Role
 *     tags: [Roles & Permissions]
 *     security:
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Quality Assurance Officer
 *               description:
 *                 type: string
 *                 example: Reviews academic and research KPI achievement reports
 *               permissionIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 5, 8]
 *     responses:
 *       201:
 *         description: Role created successfully
 */
router.get('/', protect, roleController.getRoles);
router.post('/', protect, admin, roleController.createRole);

/**
 * @swagger
 * /api/roles/{id}:
 *   get:
 *     summary: Get Role Details, Granted Permissions & Assigned Members
 *     tags: [Roles & Permissions]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Role profile with full permission list
 *       404:
 *         description: Role not found
 *   put:
 *     summary: Update Role Details
 *     tags: [Roles & Permissions]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Role updated successfully
 *   delete:
 *     summary: Delete a Custom Role
 *     tags: [Roles & Permissions]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Role deleted successfully
 */
router.get('/:id', protect, roleController.getRoleById);
router.put('/:id', protect, admin, roleController.updateRole);
router.delete('/:id', protect, admin, roleController.deleteRole);

/**
 * @swagger
 * /api/roles/{id}/permissions:
 *   post:
 *     summary: Synchronize Atomic Permissions Assigned to a Role
 *     tags: [Roles & Permissions]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - permissionIds
 *             properties:
 *               permissionIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 2, 3, 5, 10, 15]
 *     responses:
 *       200:
 *         description: Permissions updated for role
 */
router.post('/:id/permissions', protect, admin, roleController.assignPermissions);

export default router;
