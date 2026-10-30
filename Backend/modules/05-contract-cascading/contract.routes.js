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
 * /api/v1/contracts/{id}/submit:
 *   patch:
 *     summary: Submit once every assignment is submitted and weights reach the required total
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Submitted }
 *       409: { description: Assignments not ready, or weights do not reach the total }
 * /api/v1/contracts/{id}/approve:
 *   patch:
 *     summary: Approve a submitted contract once all its assignments are approved
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Approved }
 * /api/v1/contracts/{id}/reject:
 *   patch:
 *     summary: Send a submitted contract back to draft with a comment
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [comment], properties: { comment: { type: string } } }
 *     responses:
 *       200: { description: Back in draft }
 * /api/v1/contracts/{id}/sign:
 *   patch:
 *     summary: The receiving office signs an approved contract once it has acknowledged every assignment
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Signed }
 */
router.patch('/contracts/:id/submit', protect, canManage, contractController.submitContract);
router.patch('/contracts/:id/approve', protect, canApprove, contractController.approveContract);
router.patch('/contracts/:id/reject', protect, canApprove, contractController.rejectContract);
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
 *     summary: Edit a draft or rejected assignment
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
 *       409: { description: Approved assignments change only through a change request }
 */
router.get('/assignments/:id', protect, canRead, contractController.getAssignmentById);
router.put('/assignments/:id', protect, canManage, contractController.updateAssignment);

/**
 * @swagger
 * /api/v1/assignments/{id}/submit:
 *   patch:
 *     summary: Submit a draft assignment for approval
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Submitted }
 * /api/v1/assignments/{id}/approve:
 *   patch:
 *     summary: Approve a submitted assignment. A pending baseline blocks it, and so does an unverified one if the setting requires verification
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Approved }
 * /api/v1/assignments/{id}/reject:
 *   patch:
 *     summary: Reject a submitted assignment with a comment
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [comment], properties: { comment: { type: string } } }
 *     responses:
 *       200: { description: Rejected }
 * /api/v1/assignments/{id}/acknowledge:
 *   patch:
 *     summary: The receiving office acknowledges an approved assignment
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Acknowledged }
 * /api/v1/assignments/{id}/cancel:
 *   patch:
 *     summary: Cancel an assignment that is not yet approved and has nothing cascaded from it
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
router.patch('/assignments/:id/submit', protect, canManage, contractController.submitAssignment);
router.patch('/assignments/:id/approve', protect, canApprove, contractController.approveAssignment);
router.patch('/assignments/:id/reject', protect, canApprove, contractController.rejectAssignment);
router.patch('/assignments/:id/acknowledge', protect, canAcknowledge, contractController.acknowledgeAssignment);
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
 *     summary: Distributed, retained and unallocated responsibility with the reconciliation status
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Responsibility summary }
 *   put:
 *     summary: Record how this office splits its responsibility, replacing the previous split
 *     description: FULL distributes everything, EQUAL shares it evenly, CUSTOM uses the amounts given, NONE keeps it all. A child with no amount gets its own assigned improvement. Differences are flagged, not corrected.
 *     tags: [Contracts & Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [distributionMethod]
 *             properties:
 *               distributionMethod: { type: string, enum: [EQUAL, CUSTOM, FULL, NONE] }
 *               retainedAmount: { type: number, example: 10 }
 *               retainedNote: { type: string }
 *               allocations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [childAssignmentId]
 *                   properties:
 *                     childAssignmentId: { type: string, format: uuid }
 *                     amount: { type: number, example: 20 }
 *                     note: { type: string }
 *     responses:
 *       200: { description: Saved, with the reconciliation status }
 *       400: { description: Invalid split, or over the over-allocation cap }
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
