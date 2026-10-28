import { prisma } from '../../config/database.js';
import { notImplemented } from '../../utils/httpError.js';

// ===== Office types =====

export const listOfficeTypes = async () => notImplemented('listOfficeTypes');

export const createOfficeType = async (data, actor) => notImplemented('createOfficeType');

// ===== Offices =====

export const getOfficeTree = async () => notImplemented('getOfficeTree');

export const listOffices = async ({ officeTypeId, parentOfficeId, isActive, search } = {}) => notImplemented('listOffices');

export const getOfficeById = async (id) => notImplemented('getOfficeById');

export const createOffice = async (data, actor) => notImplemented('createOffice');

export const updateOffice = async (id, data, actor) => notImplemented('updateOffice');

// ===== Positions =====

export const listPositions = async (officeId) => notImplemented('listPositions');

export const createPosition = async (officeId, data, actor) => notImplemented('createPosition');

// ===== Members (OfficePerson placements) =====

export const listMembers = async (officeId) => notImplemented('listMembers');

export const assignMember = async (officeId, data, actor) => notImplemented('assignMember');

export default {
  listOfficeTypes,
  createOfficeType,
  getOfficeTree,
  listOffices,
  getOfficeById,
  createOffice,
  updateOffice,
  listPositions,
  createPosition,
  listMembers,
  assignMember,
};
