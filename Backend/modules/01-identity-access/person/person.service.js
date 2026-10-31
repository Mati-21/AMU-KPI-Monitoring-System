import { prisma } from '../../../config/database.js';
import bcrypt from 'bcryptjs';
import { assertPasswordStrength, findAccountByAnyId } from '../auth/auth.service.js';
import { REVOKE_REASONS, listSessions, revokeAllSessions } from '../auth/session.service.js';
import { auditAction } from '../../../utils/auditLogger.js';
import { badRequest, conflict, notFound } from '../../../utils/httpError.js';
import { parseBoolean, parseBooleanQuery } from '../../../utils/validation.js';

const ACCOUNT_SELECT = {
  id: true,
  username: true,
  isActive: true,
  mustChangePassword: true,
  mfaEnabled: true,
  mfaEnforced: true,
  mfaType: true,
  lastLoginAt: true,
};

const PLACEMENT_INCLUDE = {
  office: { select: { id: true, name: true, code: true } },
  position: { select: { id: true, title: true, isHead: true } },
  roles: { include: { role: { select: { id: true, name: true } } } },
};

const PERSON_INCLUDE = {
  userAccount: { select: ACCOUNT_SELECT },
  officePersons: { include: PLACEMENT_INCLUDE },
};

/**
 * Shape a Person (+ optional UserAccount) into the directory profile returned by the API.
 */
export const formatPerson = (person) => {
  if (!person) return null;
  const account = person.userAccount;
  return {
    id: person.id,
    staffNumber: person.staffNumber,
    firstName: person.firstName,
    middleName: person.middleName,
    lastName: person.lastName,
    fullName: [person.firstName, person.middleName, person.lastName].filter(Boolean).join(' '),
    email: person.email,
    phone: person.phone,
    isActive: person.isActive,
    hasAccount: Boolean(account),
    account: account || null,
    placements: person.officePersons || [],
  };
};

const normalizeEmail = (email) => (email ? String(email).trim().toLowerCase() : null);

const assertEmailAvailable = async (email, exceptPersonId) => {
  if (!email) return;
  // Case-insensitive: older rows may not be stored lowercased
  const existing = await prisma.person.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
  if (existing && existing.id !== exceptPersonId) throw conflict(`Email "${email}" is already registered`);
};

const assertUsernameAvailable = async (username, exceptAccountId) => {
  const existing = await prisma.userAccount.findUnique({ where: { username } });
  if (existing && existing.id !== exceptAccountId) throw conflict(`Username "${username}" is already taken`);
};

const assertStaffNumberAvailable = async (staffNumber, exceptPersonId) => {
  if (!staffNumber) return;
  const existing = await prisma.person.findUnique({ where: { staffNumber } });
  if (existing && existing.id !== exceptPersonId) throw conflict(`Staff number "${staffNumber}" is already registered`);
};

const getPersonOrThrow = async (id) => {
  const person = await prisma.person.findUnique({ where: { id }, include: { userAccount: true } });
  if (!person) throw notFound('Person not found');
  return person;
};

/**
 * List persons with pagination, search (name, email, phone, username) and filters.
 */
export const listPersons = async ({ search = '', isActive, officeId, hasAccount, page = 1, limit = 20 } = {}) => {
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));

  const where = {};
  const active = parseBooleanQuery(isActive, 'isActive');
  if (active !== undefined) where.isActive = active;
  if (officeId) where.officePersons = { some: { officeId } };
  if (hasAccount !== undefined && hasAccount !== '') {
    where.userAccount = String(hasAccount).toLowerCase() === 'true' ? { isNot: null } : { is: null };
  }
  if (search.trim()) {
    const q = search.trim();
    where.OR = [
      { firstName: { contains: q, mode: 'insensitive' } },
      { middleName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
      { staffNumber: { contains: q, mode: 'insensitive' } },
      { userAccount: { username: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const [total, persons] = await Promise.all([
    prisma.person.count({ where }),
    prisma.person.findMany({
      where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      include: PERSON_INCLUDE,
    }),
  ]);

  return {
    data: persons.map(formatPerson),
    pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
  };
};

export const getPersonById = async (id) => {
  const person = await prisma.person.findUnique({ where: { id }, include: PERSON_INCLUDE });
  if (!person) throw notFound('Person not found');
  return formatPerson(person);
};

/**
 * Create a Person, optionally with a login account ({ account: { username, temporaryPassword, ... } }).
 */
export const createPerson = async ({ staffNumber, firstName, middleName, lastName, email, phone, account }, actor) => {
  if (!firstName?.trim() || !lastName?.trim()) throw badRequest('firstName and lastName are required');

  const cleanEmail = normalizeEmail(email);
  await assertEmailAvailable(cleanEmail);
  const cleanStaffNumber = staffNumber?.trim() || null;
  await assertStaffNumberAvailable(cleanStaffNumber);

  const username = account?.username?.trim();
  const temporaryPassword = account?.temporaryPassword;
  if (account && (!username || !temporaryPassword)) throw badRequest('account.username and account.temporaryPassword are required');
  if (username) {
    assertPasswordStrength(temporaryPassword);
    await assertUsernameAvailable(username);
  }

  const person = await prisma.$transaction(async (tx) => {
    const created = await tx.person.create({
      data: {
        staffNumber: cleanStaffNumber,
        firstName: firstName.trim(),
        middleName: middleName?.trim() || null,
        lastName: lastName.trim(),
        email: cleanEmail,
        phone: phone?.trim() || null,
      },
    });

    if (username) {
      await tx.userAccount.create({
        data: {
          personId: created.id,
          username,
          passwordHash: await bcrypt.hash(temporaryPassword, 10),
          isActive: account.isActive ?? true,
          mustChangePassword: account.mustChangePassword ?? true,
          mfaEnforced: account.mfaEnforced ?? false,
        },
      });
    }

    return tx.person.findUnique({ where: { id: created.id }, include: PERSON_INCLUDE });
  });

  await auditAction(actor, { action: 'PERSON_CREATED', entityType: 'person', entityId: person.id, newValues: { staffNumber: cleanStaffNumber, firstName: person.firstName, lastName: person.lastName, email: cleanEmail, username: username ?? null } });
  return formatPerson(person);
};

/**
 * Update the details of a person.
 */
export const updatePerson = async (id, data, actor) => {
  const existing = await getPersonOrThrow(id);

  const update = {};
  if (data.firstName !== undefined) {
    if (!String(data.firstName).trim()) throw badRequest('firstName cannot be empty');
    update.firstName = String(data.firstName).trim();
  }
  if (data.lastName !== undefined) {
    if (!String(data.lastName).trim()) throw badRequest('lastName cannot be empty');
    update.lastName = String(data.lastName).trim();
  }
  if (data.middleName !== undefined) update.middleName = data.middleName?.trim() || null;
  if (data.phone !== undefined) update.phone = data.phone?.trim() || null;
  const isActive = parseBoolean(data.isActive, 'isActive');
  if (isActive !== undefined) update.isActive = isActive;
  if (data.staffNumber !== undefined) {
    update.staffNumber = data.staffNumber?.trim() || null;
    await assertStaffNumberAvailable(update.staffNumber, existing.id);
  }
  if (data.email !== undefined) {
    update.email = normalizeEmail(data.email);
    await assertEmailAvailable(update.email, existing.id);
  }

  const person = await prisma.person.update({ where: { id }, data: update, include: PERSON_INCLUDE });
  await auditAction(actor, {
    action: 'PERSON_UPDATED',
    entityType: 'person',
    entityId: id,
    oldValues: Object.fromEntries(Object.keys(update).map((key) => [key, existing[key]])),
    newValues: update,
  });
  return formatPerson(person);
};

/**
 * Delete a person; if they are referenced by institutional records, deactivate them instead.
 */
export const deletePerson = async (id, actor) => {
  const existing = await getPersonOrThrow(id);
  const oldValues = { firstName: existing.firstName, lastName: existing.lastName, email: existing.email };
  try {
    await prisma.person.delete({ where: { id } });
    await auditAction(actor, { action: 'PERSON_DELETED', entityType: 'person', entityId: id, oldValues });
    return { deactivated: false, message: 'Person deleted successfully' };
  } catch (error) {
    if (error.code !== 'P2003') throw error;
    await prisma.$transaction([
      prisma.person.update({ where: { id }, data: { isActive: false } }),
      prisma.userAccount.updateMany({ where: { personId: id }, data: { isActive: false } }),
    ]);
    await auditAction(actor, { action: 'PERSON_DEACTIVATED', entityType: 'person', entityId: id, oldValues });
    return { deactivated: true, message: 'Person is referenced by institutional records and was deactivated instead' };
  }
};

/**
 * Create the login account for an existing person (or update it if one already exists).
 */
export const upsertAccount = async (personId, { username, temporaryPassword, mustChangePassword = true, mfaEnforced = false, isActive = true }, actor) => {
  const person = await getPersonOrThrow(personId);
  const existing = person.userAccount;

  const cleanUsername = username?.trim();
  if (!existing && (!cleanUsername || !temporaryPassword)) throw badRequest('username and temporaryPassword are required');
  if (cleanUsername) await assertUsernameAvailable(cleanUsername, existing?.id);
  if (temporaryPassword) assertPasswordStrength(temporaryPassword);

  const data = {
    ...(cleanUsername && { username: cleanUsername }),
    ...(temporaryPassword && { passwordHash: await bcrypt.hash(temporaryPassword, 10), mustChangePassword: Boolean(mustChangePassword) }),
    mfaEnforced: Boolean(mfaEnforced),
    isActive: Boolean(isActive),
  };

  const account = existing
    ? await prisma.userAccount.update({ where: { id: existing.id }, data, select: { personId: true, ...ACCOUNT_SELECT } })
    : await prisma.userAccount.create({ data: { personId, ...data }, select: { personId: true, ...ACCOUNT_SELECT } });

  await auditAction(actor, {
    action: existing ? 'ACCOUNT_UPDATED' : 'ACCOUNT_CREATED',
    entityType: 'user_account',
    entityId: account.id,
    oldValues: existing ? { username: existing.username, mfaEnforced: existing.mfaEnforced, isActive: existing.isActive } : undefined,
    newValues: { username: account.username, mfaEnforced: data.mfaEnforced, isActive: data.isActive, passwordReplaced: Boolean(temporaryPassword) },
  });
  return { created: !existing, account };
};

const getAccountByAnyIdOrThrow = async (accountId) => {
  const account = await findAccountByAnyId(accountId);
  if (!account) throw notFound('User account not found');
  return account;
};

/**
 * Enable or disable login for an account (by UserAccount id, Person id or username).
 * Deactivation also ends every active session.
 */
export const setAccountActive = async (accountId, isActive, actor) => {
  if (typeof isActive !== 'boolean') throw badRequest('isActive (boolean) is required');
  const account = await getAccountByAnyIdOrThrow(accountId);

  const updated = await prisma.userAccount.update({
    where: { id: account.id },
    data: { isActive },
    select: { id: true, username: true, isActive: true },
  });
  if (!isActive) await revokeAllSessions(account.id, REVOKE_REASONS.ACCOUNT_DEACTIVATED);
  await auditAction(actor, { action: isActive ? 'ACCOUNT_ACTIVATED' : 'ACCOUNT_DEACTIVATED', entityType: 'user_account', entityId: account.id, oldValues: { isActive: account.isActive }, newValues: { isActive } });
  return updated;
};

/**
 * Administrator password reset: sets a temporary password that must be changed on next login
 * and ends every active session of the account.
 */
export const resetPassword = async (accountId, temporaryPassword, actor) => {
  assertPasswordStrength(temporaryPassword);
  const account = await getAccountByAnyIdOrThrow(accountId);

  const updated = await prisma.userAccount.update({
    where: { id: account.id },
    data: { passwordHash: await bcrypt.hash(temporaryPassword, 10), mustChangePassword: true },
    select: { id: true, username: true, mustChangePassword: true },
  });
  const { revokedCount } = await revokeAllSessions(account.id, REVOKE_REASONS.PASSWORD_RESET);
  await auditAction(actor, { action: 'PASSWORD_RESET', entityType: 'user_account', entityId: account.id, newValues: { sessionsRevoked: revokedCount } });
  return { ...updated, sessionsRevoked: revokedCount };
};

/**
 * Administrator view of an account's sessions (includeRevoked shows the recent history too).
 */
export const listAccountSessions = async (accountId, { includeRevoked } = {}) => {
  const account = await getAccountByAnyIdOrThrow(accountId);
  return listSessions(account.id, { includeRevoked: String(includeRevoked).toLowerCase() === 'true' });
};

/**
 * Administrator: force sign-out of every session of an account.
 */
export const revokeAccountSessions = async (accountId, actor) => {
  const account = await getAccountByAnyIdOrThrow(accountId);
  const result = await revokeAllSessions(account.id, REVOKE_REASONS.ADMIN_REVOKED);
  await auditAction(actor, { action: 'SESSIONS_REVOKED', entityType: 'user_account', entityId: account.id, newValues: { revokedCount: result.revokedCount } });
  return result;
};

export default {
  listPersons,
  getPersonById,
  createPerson,
  updatePerson,
  deletePerson,
  upsertAccount,
  setAccountActive,
  resetPassword,
  listAccountSessions,
  revokeAccountSessions,
};
