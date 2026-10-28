import * as personService from './person.service.js';

export const listPersons = async (req, res) => {
  const { search, status, officeId, hasAccount, page, limit } = req.query;
  const result = await personService.listPersons({ search, status, officeId, hasAccount, page, limit });
  res.json({ status: 'success', ...result });
};

export const getPersonById = async (req, res) => {
  const person = await personService.getPersonById(req.params.id);
  res.json({ status: 'success', data: person });
};

export const createPerson = async (req, res) => {
  const person = await personService.createPerson(req.body || {});
  res.status(201).json({ status: 'success', message: 'Person registered successfully', data: person });
};

export const updatePerson = async (req, res) => {
  const person = await personService.updatePerson(req.params.id, req.body || {});
  res.json({ status: 'success', message: 'Person updated successfully', data: person });
};

export const deletePerson = async (req, res) => {
  const result = await personService.deletePerson(req.params.id);
  res.json({ status: 'success', ...result });
};

export const upsertAccount = async (req, res) => {
  const { created, account } = await personService.upsertAccount(req.params.id, req.body || {});
  res.status(created ? 201 : 200).json({
    status: 'success',
    message: created ? 'User account created successfully' : 'User account updated successfully',
    data: account,
  });
};

export const toggleActive = async (req, res) => {
  const account = await personService.setAccountActive(req.params.id, req.body?.isActive);
  res.json({
    status: 'success',
    message: `User account ${account.isActive ? 'activated' : 'deactivated'} successfully`,
    data: account,
  });
};

export const resetPassword = async (req, res) => {
  const account = await personService.resetPassword(req.params.id, req.body?.temporaryPassword);
  res.json({
    status: 'success',
    message: 'Password reset. The user must change it on next login.',
    data: account,
  });
};

export const listAccountSessions = async (req, res) => {
  const sessions = await personService.listAccountSessions(req.params.id, { includeRevoked: req.query.includeRevoked });
  res.json({ status: 'success', data: sessions });
};

export const revokeAccountSessions = async (req, res) => {
  const result = await personService.revokeAccountSessions(req.params.id);
  res.json({ status: 'success', message: `Revoked ${result.revokedCount} session(s)`, data: result });
};

export default {
  listPersons,
  getPersonById,
  createPerson,
  updatePerson,
  deletePerson,
  upsertAccount,
  toggleActive,
  resetPassword,
  listAccountSessions,
  revokeAccountSessions,
};
