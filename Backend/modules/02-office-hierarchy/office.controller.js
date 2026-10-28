import * as officeService from './office.service.js';

export const getOffices = async (req, res, next) => {
  try {
    const offices = await officeService.getOffices();
    res.json({ status: 'success', data: offices });
  } catch (error) {
    next(error);
  }
};

export const getOfficeTree = async (req, res, next) => {
  try {
    const tree = await officeService.getOfficeTree();
    res.json({ status: 'success', data: tree });
  } catch (error) {
    next(error);
  }
};

export const getOfficeById = async (req, res, next) => {
  try {
    const office = await officeService.getOfficeById(req.params.id);
    res.json({ status: 'success', data: office });
  } catch (error) {
    next(error);
  }
};

export const createOffice = async (req, res, next) => {
  try {
    res.status(201).json({ status: 'success', message: 'Office creation ready to implement' });
  } catch (error) {
    next(error);
  }
};

export const updateOffice = async (req, res, next) => {
  try {
    res.json({ status: 'success', message: 'Office update ready to implement' });
  } catch (error) {
    next(error);
  }
};

export const deleteOffice = async (req, res, next) => {
  try {
    res.json({ status: 'success', message: 'Office delete ready to implement' });
  } catch (error) {
    next(error);
  }
};

export default {
  getOffices,
  getOfficeTree,
  getOfficeById,
  createOffice,
  updateOffice,
  deleteOffice,
};
