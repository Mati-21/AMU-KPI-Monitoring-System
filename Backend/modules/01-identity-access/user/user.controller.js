import * as userService from './user.service.js';

export const getUsers = async (req, res, next) => {
  try {
    const { search, status, officeId, hasAccount, page, limit } = req.query;
    const result = await userService.getUsers({
      search,
      status,
      officeId,
      hasAccount,
      page,
      limit,
    });
    res.json({
      status: 'success',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ status: 'success', data: user });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const user = await userService.createUser(req.body);
    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: user,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const updated = await userService.updateUser(req.params.id, req.body);
    res.json({
      status: 'success',
      message: 'User updated successfully',
      data: updated,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const result = await userService.deleteUser(req.params.id);
    res.json({
      status: 'success',
      ...result,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const provisionAccount = async (req, res, next) => {
  try {
    const account = await userService.provisionAccount(req.params.id, req.body);
    res.status(201).json({
      status: 'success',
      message: 'User account provisioned successfully',
      data: account,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const toggleAccountActive = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const result = await userService.toggleAccountActive(req.params.id, isActive);
    res.json({
      status: 'success',
      message: `User account ${result.isActive ? 'activated' : 'deactivated'} successfully`,
      data: result,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { temporaryPassword } = req.body;
    const result = await userService.resetUserPassword(req.params.id, temporaryPassword);
    res.json({
      status: 'success',
      message: 'User password reset successfully. User must change password on next login.',
      data: result,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export default {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  provisionAccount,
  toggleAccountActive,
  resetPassword,
};
