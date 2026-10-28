import * as targetService from './target.service.js';

export const getTargets = async (req, res, next) => {
  try {
    const targets = await targetService.getTargets();
    res.json({ status: 'success', data: targets });
  } catch (error) {
    next(error);
  }
};

export const getTargetTree = async (req, res, next) => {
  try {
    const tree = await targetService.getTargetTree();
    res.json({ status: 'success', data: tree });
  } catch (error) {
    next(error);
  }
};

export const createTarget = async (req, res, next) => {
  try {
    res.status(201).json({ status: 'success', message: 'Target creation ready to implement' });
  } catch (error) {
    next(error);
  }
};

export const cascadeTarget = async (req, res, next) => {
  try {
    res.status(201).json({ status: 'success', message: 'Cascade target ready to implement' });
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    res.json({ status: 'success', message: 'Update target status ready to implement' });
  } catch (error) {
    next(error);
  }
};

export default {
  getTargets,
  getTargetTree,
  createTarget,
  cascadeTarget,
  updateStatus,
};
