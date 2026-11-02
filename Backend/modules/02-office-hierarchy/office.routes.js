import { Router } from 'express';
import * as officeController from './office.controller.js';
import { protect, requirePermission } from '../../middleware/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Offices
 *   description: Module 02 — Office types, university office tree, positions and staff placement
 */

/**
 * @swagger
 * /api/v1/office-types:
 *   get:
 *     summary: List office types ordered by levelOrder
 *     tags: [Offices]
 *     responses:
 *       200: { description: Office types }
 *   post:
 *     summary: Define a new office tier level
 *     tags: [Offices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: College }
 *               description: { type: string }
 *               levelOrder: { type: integer, example: 2 }
 *     responses:
 *       201: { description: Created }
 */
router.get('/office-types', protect, officeController.listOfficeTypes);
router.post('/office-types', protect, requirePermission(PERMISSIONS.OFFICE_MANAGE), officeController.createOfficeType);

/**
 * @swagger
 * /api/v1/office-types/{id}:
 *   put:
 *     summary: Update an office type's name, description or level
 *     tags: [Offices]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               levelOrder: { type: integer }
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     summary: Delete an office type no office uses
 *     tags: [Offices]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Deleted, or archived when it was held before (data.archived) }
 *       409: { description: Still used by offices }
 */
router.put('/office-types/:id', protect, requirePermission(PERMISSIONS.OFFICE_MANAGE), officeController.updateOfficeType);
router.delete('/office-types/:id', protect, requirePermission(PERMISSIONS.OFFICE_MANAGE), officeController.deleteOfficeType);

/**
 * @swagger
 * /api/v1/offices/tree:
 *   get:
 *     summary: Complete university office structure as a nested tree
 *     tags: [Offices]
 *     responses:
 *       200: { description: Office tree }
 */
router.get('/offices/tree', protect, officeController.getOfficeTree);

/**
 * @swagger
 * /api/v1/offices:
 *   get:
 *     summary: Flat list of offices with filters
 *     tags: [Offices]
 *     parameters:
 *       - { in: query, name: officeTypeId, schema: { type: string, format: uuid } }
 *       - { in: query, name: parentOfficeId, schema: { type: string, format: uuid } }
 *       - { in: query, name: isActive, schema: { type: boolean } }
 *       - { in: query, name: search, schema: { type: string } }
 *     responses:
 *       200: { description: Offices }
 *   post:
 *     summary: Create an office under a parent office
 *     tags: [Offices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, officeTypeId]
 *             properties:
 *               name: { type: string, example: College of Natural Sciences }
 *               code: { type: string, example: CNS }
 *               officeTypeId: { type: string, format: uuid }
 *               canAssignKpi: { type: boolean, default: true }
 *               parentOfficeId: { type: string, format: uuid }
 *     responses:
 *       201: { description: Created }
 */
router.get('/offices', protect, officeController.listOffices);
router.post('/offices', protect, requirePermission(PERMISSIONS.OFFICE_CREATE), officeController.createOffice);

/**
 * @swagger
 * /api/v1/offices/{id}:
 *   get:
 *     summary: Office profile with sub-offices, positions and current head
 *     tags: [Offices]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Office }
 *   put:
 *     summary: Update office name, code, parent, type or active flag
 *     tags: [Offices]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               code: { type: string }
 *               officeTypeId: { type: string, format: uuid }
 *               canAssignKpi: { type: boolean }
 *               reason: { type: string, description: Why the office moved (kept in its hierarchy history) }
 *               parentOfficeId: { type: string, format: uuid }
 *               isActive: { type: boolean }
 *     responses:
 *       200: { description: Updated }
 */
router.get('/offices/:id', protect, officeController.getOfficeById);
router.put('/offices/:id', protect, requirePermission(PERMISSIONS.OFFICE_UPDATE), officeController.updateOffice);

/**
 * @swagger
 * /api/v1/offices/{id}:
 *   delete:
 *     summary: Delete an office with no sub-offices, current people, contracts or other records that depend on it
 *     tags: [Offices]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Deleted, or archived when it was held before (data.archived) }
 *       409: { description: "Still in use; details.dependencies lists what depends on it" }
 */
router.delete('/offices/:id', protect, requirePermission(PERMISSIONS.OFFICE_MANAGE), officeController.deleteOffice);

/**
 * @swagger
 * /api/v1/offices/{id}/history:
 *   get:
 *     summary: Parents this office has had and when, newest first
 *     tags: [Offices]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Hierarchy history rows }
 *       404: { description: Office not found }
 */
router.get('/offices/:id/history', protect, officeController.getOfficeHistory);

/**
 * @swagger
 * /api/v1/offices/{id}/positions:
 *   get:
 *     summary: Positions defined under an office
 *     tags: [Offices]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Positions }
 *   post:
 *     summary: Add a position title to an office
 *     tags: [Offices]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string, example: Dean }
 *               isHead: { type: boolean, default: false }
 *     responses:
 *       201: { description: Created }
 */
router.get('/offices/:id/positions', protect, officeController.listPositions);
router.post('/offices/:id/positions', protect, requirePermission(PERMISSIONS.OFFICE_MANAGE), officeController.createPosition);

/**
 * @swagger
 * /api/v1/positions/{id}:
 *   put:
 *     summary: Rename a position or change whether it heads the office
 *     tags: [Offices]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               isHead: { type: boolean }
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     summary: Remove a position nobody holds today. Never held, it is deleted; held before, it is archived and kept for history
 *     tags: [Offices]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Deleted, or archived when it was held before (data.archived) }
 *       409: { description: Someone holds it today }
 */
router.put('/positions/:id', protect, requirePermission(PERMISSIONS.OFFICE_MANAGE), officeController.updatePosition);
router.delete('/positions/:id', protect, requirePermission(PERMISSIONS.OFFICE_MANAGE), officeController.deletePosition);

/**
 * @swagger
 * /api/v1/offices/{id}/members:
 *   get:
 *     summary: Active staff placed in the office
 *     tags: [Offices]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Members }
 *   post:
 *     summary: Place a person in the office and position
 *     tags: [Offices]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [personId, positionId, startDate]
 *             properties:
 *               personId: { type: string, format: uuid }
 *               positionId: { type: string, format: uuid }
 *               startDate: { type: string, format: date }
 *               endDate: { type: string, format: date }
 *               isPrimary: { type: boolean, default: false }
 *     responses:
 *       201: { description: Placement created }
 */
router.get('/offices/:id/members', protect, officeController.listMembers);
router.post('/offices/:id/members', protect, requirePermission(PERMISSIONS.OFFICE_ASSIGN), officeController.assignMember);

/**
 * @swagger
 * /api/v1/office-persons/{id}/end:
 *   patch:
 *     summary: Set the last day of a person's placement in an office
 *     tags: [Offices]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [endDate]
 *             properties:
 *               endDate: { type: string, format: date }
 *     responses:
 *       200: { description: Placement updated }
 */
router.patch('/office-persons/:id/end', protect, requirePermission(PERMISSIONS.OFFICE_ASSIGN), officeController.endPlacement);

export default router;
