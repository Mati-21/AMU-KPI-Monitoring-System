import * as contractService from './contract.service.js';
import * as assignmentService from './assignment.service.js';
import * as allocationService from './allocation.service.js';
import * as changeRequestService from './changeRequest.service.js';
import { actorOf } from '../../utils/requestContext.js';

const send = (res, data, status = 200) => res.status(status).json({ status: 'success', data });

// ===== Contracts =====
export const listContracts = async (req, res) => {
  const { fiscalYearId, officeId, status } = req.query;
  send(res, await contractService.listContracts({ fiscalYearId, officeId, status }, actorOf(req)));
};
export const getContractById = async (req, res) => send(res, await contractService.getContractById(req.params.id, actorOf(req)));
export const createContract = async (req, res) => send(res, await contractService.createContract(req.body || {}, actorOf(req)), 201);
export const submitContract = async (req, res) => send(res, await contractService.submitContract(req.params.id, actorOf(req)));
export const approveContract = async (req, res) => send(res, await contractService.approveContract(req.params.id, actorOf(req)));
export const rejectContract = async (req, res) => send(res, await contractService.rejectContract(req.params.id, req.body || {}, actorOf(req)));
export const signContract = async (req, res) => send(res, await contractService.signContract(req.params.id, actorOf(req)));

// ===== Assignments =====
export const createAssignment = async (req, res) => send(res, await assignmentService.createAssignment(req.params.id, req.body || {}, actorOf(req)), 201);
export const getAssignmentTree = async (req, res) => {
  const { fiscalYearId, kpiId } = req.query;
  send(res, await assignmentService.getAssignmentTree({ fiscalYearId, kpiId }, actorOf(req)));
};
export const getAssignmentById = async (req, res) => send(res, await assignmentService.getAssignmentById(req.params.id, actorOf(req)));
export const updateAssignment = async (req, res) => send(res, await assignmentService.updateAssignment(req.params.id, req.body || {}, actorOf(req)));
export const submitAssignment = async (req, res) => send(res, await assignmentService.submitAssignment(req.params.id, actorOf(req)));
export const approveAssignment = async (req, res) => send(res, await assignmentService.approveAssignment(req.params.id, actorOf(req)));
export const rejectAssignment = async (req, res) => send(res, await assignmentService.rejectAssignment(req.params.id, req.body || {}, actorOf(req)));
export const acknowledgeAssignment = async (req, res) => send(res, await assignmentService.acknowledgeAssignment(req.params.id, actorOf(req)));
export const cancelAssignment = async (req, res) => send(res, await assignmentService.cancelAssignment(req.params.id, req.body || {}, actorOf(req)));
export const verifyBaseline = async (req, res) => send(res, await assignmentService.verifyBaseline(req.params.id, actorOf(req)));
export const addBaselineEvidence = async (req, res) => send(res, await assignmentService.addBaselineEvidence(req.params.id, req.body || {}, actorOf(req)), 201);

// ===== Responsibility =====
export const getAllocations = async (req, res) => send(res, await allocationService.getAllocations(req.params.id, actorOf(req)));
export const saveAllocations = async (req, res) => send(res, await allocationService.saveAllocations(req.params.id, req.body || {}, actorOf(req)));
export const justifyReconciliation = async (req, res) => send(res, await allocationService.justifyReconciliation(req.params.id, req.body || {}, actorOf(req)));

// ===== Change requests =====
export const createChangeRequest = async (req, res) => send(res, await changeRequestService.createChangeRequest(req.params.id, req.body || {}, actorOf(req)), 201);
export const listChangeRequests = async (req, res) => {
  const { status, assignmentId, officeId } = req.query;
  send(res, await changeRequestService.listChangeRequests({ status, assignmentId, officeId }, actorOf(req)));
};
export const getChangeRequestById = async (req, res) => send(res, await changeRequestService.getChangeRequestById(req.params.id, actorOf(req)));
export const reviewChangeRequest = async (req, res) => send(res, await changeRequestService.reviewChangeRequest(req.params.id, req.body || {}, actorOf(req)));
