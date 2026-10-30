import * as officeService from './office.service.js';
import { actorOf } from '../../utils/requestContext.js';

export const listOfficeTypes = async (req, res) => {
  const officeTypes = await officeService.listOfficeTypes();
  res.json({ status: 'success', data: officeTypes });
};

export const createOfficeType = async (req, res) => {
  const officeType = await officeService.createOfficeType(req.body || {}, actorOf(req));
  res.status(201).json({ status: 'success', data: officeType });
};

export const getOfficeTree = async (req, res) => {
  const tree = await officeService.getOfficeTree();
  res.json({ status: 'success', data: tree });
};

export const listOffices = async (req, res) => {
  const { officeTypeId, parentOfficeId, isActive, search } = req.query;
  const offices = await officeService.listOffices({ officeTypeId, parentOfficeId, isActive, search });
  res.json({ status: 'success', data: offices });
};

export const getOfficeById = async (req, res) => {
  const office = await officeService.getOfficeById(req.params.id);
  res.json({ status: 'success', data: office });
};

export const createOffice = async (req, res) => {
  const office = await officeService.createOffice(req.body || {}, actorOf(req));
  res.status(201).json({ status: 'success', data: office });
};

export const updateOffice = async (req, res) => {
  const office = await officeService.updateOffice(req.params.id, req.body || {}, actorOf(req));
  res.json({ status: 'success', data: office });
};

export const getOfficeHistory = async (req, res) => {
  const history = await officeService.getOfficeHistory(req.params.id);
  res.json({ status: 'success', data: history });
};

export const listPositions = async (req, res) => {
  const positions = await officeService.listPositions(req.params.id);
  res.json({ status: 'success', data: positions });
};

export const createPosition = async (req, res) => {
  const position = await officeService.createPosition(req.params.id, req.body || {}, actorOf(req));
  res.status(201).json({ status: 'success', data: position });
};

export const listMembers = async (req, res) => {
  const members = await officeService.listMembers(req.params.id);
  res.json({ status: 'success', data: members });
};

export const assignMember = async (req, res) => {
  const placement = await officeService.assignMember(req.params.id, req.body || {}, actorOf(req));
  res.status(201).json({ status: 'success', data: placement });
};

export default {
  listOfficeTypes,
  createOfficeType,
  getOfficeTree,
  listOffices,
  getOfficeById,
  createOffice,
  updateOffice,
  getOfficeHistory,
  listPositions,
  createPosition,
  listMembers,
  assignMember,
};
