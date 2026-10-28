import { Router } from 'express';
import * as roleController from './role.controller.js';
import { protect, requirePermission } from '../../middleware/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Access Control
 *   description: Module 03 — Roles, atomic permissions and office-scoped role assignments
 */

/**
 * @swagger
 * /api/v1/roles:
 *   get:
 *     summary: List roles with permission and member counts
 *     tags: [Access Control]
 *     responses:
 *       200: { description: Roles }
 *   post:
 *     summary: Create a role
 *     tags: [Access Control]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: Dean }
 *               description: { type: string }
 *     responses:
 *       201: { description: Created }
 */
router.get('/roles', protect, requirePermission(PERMISSIONS.ROLE_READ), roleController.listRoles);
router.post('/roles', protect, requirePermission(PERMISSIONS.ROLE_CREATE), roleController.createRole);

/**
 * @swagger
 * /api/v1/roles/{id}:
 *   get:
 *     summary: Role details with granted permission codes
 *     tags: [Access Control]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Role }
 *   put:
 *     summary: Rename or re-describe a role
 *     tags: [Access Control]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     summary: Delete a role that has no active assignments
 *     tags: [Access Control]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Deleted }
 */
router.get('/roles/:id', protect, requirePermission(PERMISSIONS.ROLE_READ), roleController.getRoleById);
router.put('/roles/:id', protect, requirePermission(PERMISSIONS.ROLE_UPDATE), roleController.updateRole);
router.delete('/roles/:id', protect, requirePermission(PERMISSIONS.ROLE_DELETE), roleController.deleteRole);

/**
 * @swagger
 * /api/v1/roles/{id}/permissions:
 *   post:
 *     summary: Replace the role's permission set
 *     tags: [Access Control]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [permissionCodes]
 *             properties:
 *               permissionCodes: { type: array, items: { type: string }, example: ["kpi:create", "target:cascade"] }
 *     responses:
 *       200: { description: Permissions synced }
 */
router.post('/roles/:id/permissions', protect, requirePermission(PERMISSIONS.ROLE_UPDATE), roleController.syncRolePermissions);

/**
 * @swagger
 * /api/v1/permissions:
 *   get:
 *     summary: All registered atomic permission codes
 *     tags: [Access Control]
 *     responses:
 *       200: { description: Permissions }
 */
router.get('/permissions', protect, requirePermission(PERMISSIONS.ROLE_READ), roleController.listPermissions);

/**
 * @swagger
 * /api/v1/office-persons/{officePersonId}/roles:
 *   post:
 *     summary: Assign a role to an office placement, optionally limited to an office scope and date window
 *     tags: [Access Control]
 *     parameters:
 *       - { in: path, name: officePersonId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roleId, validFrom]
 *             properties:
 *               roleId: { type: integer }
 *               scopeOfficeId: { type: string, format: uuid, description: Omit for university-wide scope }
 *               validFrom: { type: string, format: date }
 *               validTo: { type: string, format: date }
 *     responses:
 *       201: { description: Assigned }
 */
router.post('/office-persons/:officePersonId/roles', protect, requirePermission(PERMISSIONS.ROLE_ASSIGN), roleController.assignRole);

/**
 * @swagger
 * /api/v1/office-person-roles/{id}:
 *   delete:
 *     summary: Revoke a scoped role assignment
 *     tags: [Access Control]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Revoked }
 */
router.delete('/office-person-roles/:id', protect, requirePermission(PERMISSIONS.ROLE_ASSIGN), roleController.revokeRoleAssignment);

/**
 * @swagger
 * /api/v1/auth/check-permission:
 *   get:
 *     summary: Does the current user hold a permission (optionally within an office's scope)?
 *     tags: [Access Control]
 *     parameters:
 *       - { in: query, name: permission, required: true, schema: { type: string, example: "target:cascade" } }
 *       - { in: query, name: officeId, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: "{ allowed, heldPermissions }" }
 */
router.get('/auth/check-permission', protect, roleController.checkPermission);

export default router;
