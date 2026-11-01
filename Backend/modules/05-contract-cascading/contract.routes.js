import { Router } from 'express';
import * as contractController from './contract.controller.js';
import { protect, requirePermission } from '../../middleware/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();
const canRead = requirePermission(PERMISSIONS.CONTRACT_READ);
const canManage = requirePermission(PERMISSIONS.CONTRACT_MANAGE);
const canApprove = requirePermission(PERMISSIONS.CONTRACT_APPROVE);
const canAcknowledge = requirePermission(PERMISSIONS.CONTRACT_ACKNOWLEDGE);
const canRequest = requirePermission(PERMISSIONS.CONTRACT_REQUEST_CHANGE, PERMISSIONS.CONTRACT_MANAGE);

/**
 * @swagger
 * tags:
 *   name: Contracts & Cascading
 *   description: Module 05 — Performance contracts, KPI assignments, baselines, targets, weights, responsibility split and change requests
 */

// ===== Contracts =====

/**
 * @swagger
 * /api/v1/contracts:
 *   get:
 *     summary: Contracts of the offices you have authority over
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: query, name: fiscalYearId, schema: { type: string, format: uuid } }
 *       - { in: query, name: officeId, schema: { type: string, format: uuid } }
 *       - { in: query, name: status, schema: { type: string, enum: [DRAFT, SUBMITTED, APPROVED, SIGNED, CLOSED] } }
 *     responses:
 *       200: { description: Contracts }
 *   post:
 *     summary: Create an office's contract for a fiscal year
 *     description: The assigning office is the receiving office's parent. Needs contract:manage over that parent (university-wide for the top office).
 *     tags: [Contracts & Cascading]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fiscalYearId, officeId]
 *             properties:
 *               fiscalYearId: { type: string, format: uuid }
 *               officeId: { type: string, format: uuid }
 *     responses:
 *       201: { description: Created }
 *       409: { description: Office already has a contract, or the year is closed }
 */
router.get('/contracts', protect, canRead, contractController.listContracts);
router.post('/contracts', protect, canManage, contractController.createContract);

/**
 * @swagger
 * /api/v1/contracts/{id}:
 *   get:
 *     summary: Contract with its assignments and weight total
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: "Contract with assignments, totalWeight and isWeightBalanced" }
 */
router.get('/contracts/:id', protect, canRead, contractController.getContractById);

/**
 * @swagger
 * /api/v1/contract-rejections:
 *   get:
 *     summary: Past rejections of contracts, with their notes and flagged KPIs, for the offices the user can read
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: query, name: fiscalYearId, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Rejections, newest first }
 * /api/v1/contracts/{id}/assign:
 *   patch:
 *     summary: The office above sends a draft contract to the receiving office, once weights reach the required total
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Assigned }
 *       409: { description: A baseline is pending, or weights do not reach the total }
 * /api/v1/contracts/{id}/reject:
 *   patch:
 *     summary: The receiving office rejects an assigned contract. Needs a flagged KPI or a comment
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { comment: { type: string } } }
 *     responses:
 *       200: { description: Rejected }
 * /api/v1/contracts/{id}/sign:
 *   patch:
 *     summary: The receiving office accepts an assigned contract and every KPI on it
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Signed }
 *       409: { description: Some KPIs are flagged }
 */
router.get('/contract-rejections', protect, canRead, contractController.listRejections);
router.patch('/contracts/:id/assign', protect, canManage, contractController.assignContract);
router.patch('/contracts/:id/reject', protect, canAcknowledge, contractController.rejectContract);
router.patch('/contracts/:id/sign', protect, canAcknowledge, contractController.signContract);

/**
 * @swagger
 * /api/v1/contracts/{id}/assignments:
 *   post:
 *     summary: Assign a KPI on a draft contract, with its official baseline, target and weight
 *     description: |
 *       Fields follow the KPI's measurement type. NUMBER and MONEY use value; PERCENTAGE and RATIO use numerator and
 *       denominator (a target may give just value); STAGE and CATEGORY use scaleLevelId. An unknown baseline sends
 *       status UNKNOWN with a justification and no value. Every office but the top one needs parentAssignmentId.
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [kpiId, baseline, target, weight]
 *             properties:
 *               kpiId: { type: string, format: uuid }
 *               parentAssignmentId: { type: string, format: uuid }
 *               reportingFrequencyId: { type: string, format: uuid, description: Defaults to the KPI's frequency }
 *               scopeRelation: { type: string, enum: [EXCLUSIVE_COMPLETE, OVERLAPPING, INSTITUTION_WIDE] }
 *               maxOverAllocationPercent: { type: number }
 *               baseline: { type: object, example: { value: 40 } }
 *               target: { type: object, example: { value: 70 } }
 *               weight: { type: number, example: 30 }
 *     responses:
 *       201: { description: Created }
 *       400: { description: Values do not match the measurement type }
 */
router.post('/contracts/:id/assignments', protect, canManage, contractController.createAssignment);

// ===== Assignments =====

/**
 * @swagger
 * /api/v1/assignments/tree:
 *   get:
 *     summary: The cascade of one KPI in one fiscal year, as a tree
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: query, name: fiscalYearId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: kpiId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Assignment tree }
 */
router.get('/assignments/tree', protect, canRead, contractController.getAssignmentTree);

/**
 * @swagger
 * /api/v1/assignments/{id}:
 *   get:
 *     summary: Assignment with every baseline, target and weight version
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Assignment with history }
 *   put:
 *     summary: Edit a draft assignment
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reportingFrequencyId: { type: string, format: uuid }
 *               scopeRelation: { type: string, enum: [EXCLUSIVE_COMPLETE, OVERLAPPING, INSTITUTION_WIDE] }
 *               maxOverAllocationPercent: { type: number }
 *               baseline: { type: object }
 *               target: { type: object }
 *               weight: { type: number }
 *     responses:
 *       200: { description: Updated }
 *       409: { description: After assigning, values change only through the contract being rejected or a change request }
 */
router.get('/assignments/:id', protect, canRead, contractController.getAssignmentById);
router.put('/assignments/:id', protect, canManage, contractController.updateAssignment);

/**
 * @swagger
 * /api/v1/assignments/{id}/flag:
 *   patch:
 *     summary: The receiving office flags a KPI with a note while reviewing its contract, or clears the flag with no note
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { note: { type: string, nullable: true } } }
 *     responses:
 *       200: { description: Flag saved or cleared }
 * /api/v1/assignments/{id}/cancel:
 *   patch:
 *     summary: Cancel a draft assignment that has nothing cascaded from it
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [comment], properties: { comment: { type: string } } }
 *     responses:
 *       200: { description: Cancelled }
 */
router.patch('/assignments/:id/flag', protect, canAcknowledge, contractController.flagAssignment);
router.patch('/assignments/:id/cancel', protect, canManage, contractController.cancelAssignment);

/**
 * @swagger
 * /api/v1/assignments/{id}/baseline/verify:
 *   patch:
 *     summary: Verify the current baseline
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Verified }
 * /api/v1/assignments/{id}/baseline/evidence:
 *   post:
 *     summary: Attach a document to the current baseline
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [documentId]
 *             properties:
 *               documentId: { type: string, format: uuid }
 *               sourceDescription: { type: string, example: 2018 E.C. annual report }
 *               sourceDate: { type: string, format: date }
 *     responses:
 *       201: { description: Attached }
 */
router.patch('/assignments/:id/baseline/verify', protect, canApprove, contractController.verifyBaseline);
router.post('/assignments/:id/baseline/evidence', protect, canManage, contractController.addBaselineEvidence);

// ===== Responsibility =====

/**
 * @swagger
 * /api/v1/assignments/{id}/allocations:
 *   get:
 *     summary: How this KPI is shared between the offices below, with the offices that could still get a share
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: "Sharing; shareable is false for rates and other KPIs that cannot be split" }
 *   put:
 *     summary: Save how this KPI is shared, replacing the previous split
 *     description: Shares and the kept amount must reach at least the improvement. More is allowed. A KPI still in draft on an office's contract takes its new target from its share.
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [distributionMethod, shares]
 *             properties:
 *               distributionMethod: { type: string, enum: [EQUAL, CUSTOM] }
 *               retainedAmount: { type: number, example: 10 }
 *               shares:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [officeId, amount]
 *                   properties:
 *                     officeId: { type: string, format: uuid }
 *                     amount: { type: number, example: 20 }
 *     responses:
 *       200: { description: Saved }
 *       400: { description: "Short of the improvement, or an invalid split" }
 *       409: { description: "An office already has this KPI, or the KPI cannot be shared" }
 * /api/v1/assignments/{id}/reconciliation:
 *   patch:
 *     summary: Formally justify a difference that stays
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [note], properties: { note: { type: string } } }
 *     responses:
 *       200: { description: Justified }
 */
router.get('/assignments/:id/allocations', protect, canRead, contractController.getAllocations);
router.put('/assignments/:id/allocations', protect, canManage, contractController.saveAllocations);
router.patch('/assignments/:id/reconciliation', protect, canManage, contractController.justifyReconciliation);

// ===== Change requests =====

/**
 * @swagger
 * /api/v1/assignments/{id}/change-requests:
 *   post:
 *     summary: Ask for clarification, or request a correction or modification of an approved assignment
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [requestType, reason]
 *             properties:
 *               requestType: { type: string, enum: [CLARIFICATION, CORRECTION, MODIFICATION] }
 *               reason: { type: string }
 *               proposedValues:
 *                 type: object
 *                 properties:
 *                   baseline: { type: object }
 *                   target: { type: object }
 *                   weight: { type: number }
 *               evidenceDocumentIds: { type: array, items: { type: string, format: uuid } }
 *     responses:
 *       201: { description: Created }
 *       409: { description: Not approved yet, or a request is already waiting }
 * /api/v1/change-requests:
 *   get:
 *     summary: Change requests on assignments you can see
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [PENDING, APPROVED, REJECTED] } }
 *       - { in: query, name: assignmentId, schema: { type: string, format: uuid } }
 *       - { in: query, name: officeId, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Change requests }
 * /api/v1/change-requests/{id}:
 *   get:
 *     summary: One change request
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Change request }
 * /api/v1/change-requests/{id}/review:
 *   patch:
 *     summary: Approve or reject. Approval adds new versions and keeps the old ones
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [decision]
 *             properties:
 *               decision: { type: string, enum: [APPROVED, REJECTED] }
 *               comment: { type: string, description: Required when rejecting }
 *               effectiveFromPeriodId: { type: string, format: uuid }
 *     responses:
 *       200: { description: Reviewed }
 */
router.post('/assignments/:id/change-requests', protect, canRequest, contractController.createChangeRequest);
router.get('/change-requests', protect, canRead, contractController.listChangeRequests);
router.get('/change-requests/:id', protect, canRead, contractController.getChangeRequestById);
router.patch('/change-requests/:id/review', protect, canApprove, contractController.reviewChangeRequest);

export default router;
