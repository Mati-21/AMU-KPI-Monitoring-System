import * as targetService from './target.service.js';
import { actorOf } from '../../utils/requestContext.js';

export const listTargets = async (req, res) => {
  const { fiscalYearId, officeId, kpiId, status } = req.query;
  const targets = await targetService.listTargets({ fiscalYearId, officeId, kpiId, status });
  res.json({ status: 'success', data: targets });
};

export const getTargetTree = async (req, res) => {
  const { fiscalYearId, kpiId } = req.query;
  const tree = await targetService.getTargetTree({ fiscalYearId, kpiId });
  res.json({ status: 'success', data: tree });
};

export const listMyTargets = async (req, res) => {
  const targets = await targetService.listMyTargets({ fiscalYearId: req.query.fiscalYearId }, actorOf(req));
  res.json({ status: 'success', data: targets });
};

export const createTarget = async (req, res) => {
  const target = await targetService.createTarget(req.body || {}, actorOf(req));
  res.status(201).json({ status: 'success', data: target });
};

export const cascadeTarget = async (req, res) => {
  const children = await targetService.cascadeTarget(req.params.parentTargetId, req.body || {}, actorOf(req));
  res.status(201).json({ status: 'success', data: children });
};

export const updateTarget = async (req, res) => {
  const target = await targetService.updateTarget(req.params.id, req.body || {}, actorOf(req));
  res.json({ status: 'success', data: target });
};

export const updateTargetStatus = async (req, res) => {
  const target = await targetService.updateTargetStatus(req.params.id, req.body || {}, actorOf(req));
  res.json({ status: 'success', data: target });
};

export default {
  listTargets,
  getTargetTree,
  listMyTargets,
  createTarget,
  cascadeTarget,
  updateTarget,
  updateTargetStatus,
};
