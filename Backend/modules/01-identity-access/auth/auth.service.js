import { prisma } from '../../../config/database.js';
import bcrypt from 'bcryptjs';
import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';
import { STAGE_TOKEN_TTL, TOKEN_TYPES, signToken, verifyToken } from '../../../config/jwt.js';
import { getActiveGrants, getPermissionCodes } from '../../03-access-control/access.service.js';
import { REVOKE_REASONS, createSession, revokeAllSessions } from './session.service.js';
import { auditAction, logActivity } from '../../../utils/auditLogger.js';
import { badRequest, forbidden, notFound, unauthorized } from '../../../utils/httpError.js';
import { parseUuid } from '../../../utils/validation.js';

export const MIN_PASSWORD_LENGTH = 8;

// Intermediate login stages carried in the `auth_stage` cookie
export const STAGES = Object.freeze({
  PASSWORD_CHANGE: 'FIRST_LOGIN_PASSWORD_CHANGE',
  MFA_SETUP: 'MFA_SETUP',
  MFA_VERIFY: 'MFA_VERIFY',
});

const ACCOUNT_INCLUDE = {
  person: {
    include: {
      officePersons: {
        include: {
          office: { select: { id: true, name: true, code: true } },
          position: { select: { id: true, title: true, isHead: true } },
          roles: { include: { role: { select: { id: true, name: true } } } },
        },
      },
    },
  },
};

export const assertPasswordStrength = (password) => {
  if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
    throw badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }
};

const isValidTotp = async (code, secret) => {
  if (!code || !secret) return false;
  const result = await verify({ token: String(code).trim(), secret });
  return Boolean(result?.valid);
};

// ===== Tokens =====

const issueStage = (accountId, stage) => signToken(TOKEN_TYPES.STAGE, { id: accountId, stage }, STAGE_TOKEN_TTL);

/**
 * Verify an `auth_stage` token and assert it is at the expected step.
 */
export const verifyStageToken = (token, expectedStage) => {
  if (!token) throw unauthorized('Login step cookie missing. Please login again.');
  let decoded;
  try {
    decoded = verifyToken(token, TOKEN_TYPES.STAGE);
  } catch {
    throw unauthorized('Login step expired or invalid. Please login again.');
  }
  if (decoded.stage !== expectedStage) {
    const hints = {
      [STAGES.PASSWORD_CHANGE]: 'You must change your temporary password first (POST /api/v1/auth/change-password-first-login).',
      [STAGES.MFA_SETUP]: 'Your account is on the MFA setup step (POST /api/v1/auth/mfa/setup).',
      [STAGES.MFA_VERIFY]: 'Your account is on the MFA verification step (POST /api/v1/auth/mfa/verify).',
    };
    throw badRequest(hints[decoded.stage] || 'Invalid login step');
  }
  return decoded;
};

// ===== Lookups =====

export const findAccountByIdentifier = (identifier) =>
  prisma.userAccount.findFirst({
    where: {
      OR: [{ username: identifier }, { person: { email: { equals: identifier, mode: 'insensitive' } } }],
    },
    include: ACCOUNT_INCLUDE,
  });

export const findAccountById = (id) => prisma.userAccount.findUnique({ where: { id }, include: ACCOUNT_INCLUDE });

const getAccountOrThrow = async (id) => {
  const account = await findAccountById(id);
  if (!account) throw notFound('User account not found');
  return account;
};

const sanitizeAccount = (account) => ({
  id: account.id,
  personId: account.personId,
  username: account.username,
  isActive: account.isActive,
  mustChangePassword: Boolean(account.mustChangePassword),
  mfaEnabled: account.mfaEnabled,
  mfaEnforced: account.mfaEnforced,
  person: account.person
    ? {
        firstName: account.person.firstName,
        middleName: account.person.middleName,
        lastName: account.person.lastName,
        email: account.person.email,
        phone: account.person.phone,
      }
    : null,
});

/**
 * Decide the next login step for an account whose password has been verified.
 * `context` ({ ipAddress, userAgent }) is recorded on the session once login completes.
 */
const nextLoginStep = async (account, context) => {
  if (account.mustChangePassword) {
    return {
      status: 'REQUIRE_PASSWORD_CHANGE',
      message: 'Temporary password detected. You must change your password before continuing.',
      stageToken: issueStage(account.id, STAGES.PASSWORD_CHANGE),
    };
  }
  if (account.mfaEnforced && !account.mfaEnabled) {
    return {
      status: 'REQUIRE_MFA_SETUP',
      message: 'Two-Factor Authentication is mandatory for your account. Please set it up.',
      stageToken: issueStage(account.id, STAGES.MFA_SETUP),
    };
  }
  if (account.mfaEnabled && account.mfaSecret) {
    return {
      status: 'REQUIRE_MFA_VERIFY',
      message: 'Enter the 6-digit verification code from your authenticator app.',
      stageToken: issueStage(account.id, STAGES.MFA_VERIFY),
    };
  }
  return completeLogin(account, context);
};

/**
 * All login steps passed: open a tracked session.
 */
const completeLogin = async (account, context) => {
  await prisma.userAccount.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });
  const { token, refreshToken } = await createSession(account, context);
  await auditAccount(account, 'LOGIN_SUCCEEDED', context);
  return { status: 'SUCCESS', user: sanitizeAccount(account), token, refreshToken };
};

// ===== Flows =====

/**
 * Audit something an account did for itself. context ({ ipAddress, userAgent }) may be missing.
 */
const auditAccount = (account, action, context, values) =>
  logActivity({ actorPersonId: account?.personId, action, entityType: 'user_account', entityId: account?.id, newValues: values, ipAddress: context?.ipAddress, userAgent: context?.userAgent });

export const authenticate = async ({ identifier, password }, context) => {
  if (typeof identifier !== 'string' || typeof password !== 'string' || !identifier || !password) throw badRequest('Username (or email) and password are required');

  const account = await findAccountByIdentifier(identifier);
  // Same message for unknown user and wrong password to avoid account enumeration
  if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
    await auditAccount(account, 'LOGIN_FAILED', context, { identifier: identifier.slice(0, 100) });
    throw unauthorized('Invalid credentials');
  }
  if (!account.isActive) throw forbidden('User account is deactivated. Contact system administrator.');

  return nextLoginStep(account, context);
};

export const changePasswordFirstLogin = async ({ stageToken, newPassword }, context) => {
  const { id } = verifyStageToken(stageToken, STAGES.PASSWORD_CHANGE);
  assertPasswordStrength(newPassword);

  const account = await getAccountOrThrow(id);
  if (await bcrypt.compare(newPassword, account.passwordHash)) {
    throw badRequest('New password must be different from the temporary password');
  }

  const updated = await prisma.userAccount.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10), mustChangePassword: false },
    include: ACCOUNT_INCLUDE,
  });
  await auditAccount(updated, 'PASSWORD_CHANGED', context);
  return nextLoginStep(updated, context);
};

/**
 * Change own password. Every other session of the account is signed out; the current one stays.
 */
export const changePassword = async ({ accountId, sessionId, currentPassword, newPassword, code }, context) => {
  if (!currentPassword) throw badRequest('currentPassword is required');
  assertPasswordStrength(newPassword);

  const account = await getAccountOrThrow(accountId);
  if (!(await bcrypt.compare(currentPassword, account.passwordHash))) {
    throw badRequest('Current password does not match');
  }
  if (account.mfaEnabled && !(await isValidTotp(code, account.mfaSecret))) {
    throw badRequest('A valid Two-Factor Authentication code is required to change your password');
  }

  await prisma.userAccount.update({
    where: { id: accountId },
    data: { passwordHash: await bcrypt.hash(newPassword, 10), mustChangePassword: false },
  });
  const { revokedCount } = await revokeAllSessions(accountId, REVOKE_REASONS.PASSWORD_CHANGED, { exceptSessionId: sessionId });
  await auditAccount(account, 'PASSWORD_CHANGED', context, { otherSessionsSignedOut: revokedCount });
  return { status: 'SUCCESS', message: 'Password changed successfully.', otherSessionsSignedOut: revokedCount };
};

/**
 * Generate a pending TOTP secret + QR code. MFA stays disabled until verified.
 */
export const generateMfaSetup = async ({ accountId }) => {
  const account = await getAccountOrThrow(accountId);
  if (account.mfaEnabled) throw badRequest('Two-Factor Authentication is already enabled. Disable it before setting it up again.');

  const secret = generateSecret();
  const otpauth = generateURI({ issuer: 'AMU KPI Monitoring', label: account.person?.email || account.username, secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

  await prisma.userAccount.update({ where: { id: accountId }, data: { mfaSecret: secret } });
  return { secret, otpauth, qrCodeDataUrl };
};

/**
 * Verify the first TOTP code against the pending secret and enable MFA.
 * During login (startSession = true) this completes the login and opens a session;
 * from an existing session it only enables MFA.
 */
export const verifyAndEnableMfa = async ({ accountId, code, startSession }, context) => {
  const account = await getAccountOrThrow(accountId);
  if (!account.mfaSecret) throw badRequest('MFA setup has not been started. Call POST /api/v1/auth/mfa/setup first.');
  if (!(await isValidTotp(code, account.mfaSecret))) {
    throw badRequest('Invalid verification code. Please check your authenticator app and try again.');
  }

  const updated = await prisma.userAccount.update({
    where: { id: accountId },
    data: { mfaEnabled: true },
    include: ACCOUNT_INCLUDE,
  });
  await auditAccount(updated, 'MFA_ENABLED', context);
  const message = 'Two-Factor Authentication has been successfully configured and activated.';
  if (!startSession) return { status: 'SUCCESS', message };
  return { ...(await completeLogin(updated, context)), message };
};

export const verifyMfaLogin = async ({ stageToken, code }, context) => {
  const { id } = verifyStageToken(stageToken, STAGES.MFA_VERIFY);
  const account = await getAccountOrThrow(id);
  if (!account.mfaEnabled || !account.mfaSecret) throw badRequest('MFA is not configured for this account');
  if (!(await isValidTotp(code, account.mfaSecret))) {
    await auditAccount(account, 'MFA_LOGIN_FAILED', context);
    throw unauthorized('Invalid MFA code. Please enter the current 6-digit code from your authenticator app.');
  }
  return completeLogin(account, context);
};

export const disableMfa = async ({ accountId, code }, context) => {
  const account = await getAccountOrThrow(accountId);
  if (account.mfaEnforced) throw forbidden('MFA is enforced on your account by policy and cannot be disabled.');
  if (!account.mfaEnabled) throw badRequest('Two-Factor Authentication is not enabled');
  if (!(await isValidTotp(code, account.mfaSecret))) throw badRequest('Invalid verification code');

  await prisma.userAccount.update({ where: { id: accountId }, data: { mfaEnabled: false, mfaSecret: null } });
  await auditAccount(account, 'MFA_DISABLED', context);
  return { message: 'Two-Factor Authentication disabled' };
};

/**
 * Current user profile, active office placements and effective permission codes.
 */
export const getProfile = async (accountId) => {
  const account = await getAccountOrThrow(accountId);
  const grants = await getActiveGrants(account.personId);
  return {
    ...sanitizeAccount(account),
    lastLoginAt: account.lastLoginAt,
    placements: account.person.officePersons.map((placement) => ({
      id: placement.id,
      isPrimary: placement.isPrimary,
      startDate: placement.startDate,
      endDate: placement.endDate,
      office: placement.office,
      position: placement.position,
      roles: placement.roles.map((assignment) => ({
        id: assignment.id,
        role: assignment.role,
        scopeOfficeId: assignment.scopeOfficeId,
        validFrom: assignment.validFrom,
        validTo: assignment.validTo,
      })),
    })),
    permissions: getPermissionCodes(grants),
  };
};

// ===== Administration =====

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Find an account by UserAccount id, Person id, or username.
 */
export const findAccountByAnyId = (idOrUsername) =>
  prisma.userAccount.findFirst({
    where: UUID_PATTERN.test(idOrUsername)
      ? { OR: [{ id: idOrUsername }, { personId: idOrUsername }] }
      : { username: idOrUsername },
  });

export const setMfaEnforced = async ({ accountId, enforced }, actor) => {
  const account = await findAccountByAnyId(accountId);
  if (!account) throw notFound('User account not found');

  const updated = await prisma.userAccount.update({
    where: { id: account.id },
    data: { mfaEnforced: Boolean(enforced) },
    select: { id: true, username: true, mfaEnforced: true, mfaEnabled: true },
  });
  await auditAction(actor, { action: 'MFA_ENFORCEMENT_CHANGED', entityType: 'user_account', entityId: account.id, oldValues: { mfaEnforced: account.mfaEnforced }, newValues: { mfaEnforced: updated.mfaEnforced } });
  return updated;
};

export const setMfaEnforcedForRole = async ({ roleName, roleId, enforced }, actor) => {
  if (!roleId && !roleName) throw badRequest('roleName or roleId is required');

  const role = await prisma.role.findFirst({
    where: roleId ? { id: parseUuid(roleId, 'roleId') } : { name: { equals: String(roleName).trim(), mode: 'insensitive' } },
    include: {
      officePersonRoles: {
        include: { officePerson: { include: { person: { include: { userAccount: true } } } } },
      },
    },
  });
  if (!role) throw notFound(`Role "${roleName || roleId}" not found`);

  const accounts = role.officePersonRoles.map((assignment) => assignment.officePerson?.person?.userAccount).filter(Boolean);
  const accountIds = [...new Set(accounts.map((account) => account.id))];

  if (accountIds.length > 0) {
    await prisma.userAccount.updateMany({ where: { id: { in: accountIds } }, data: { mfaEnforced: Boolean(enforced) } });
  }
  await auditAction(actor, { action: 'MFA_ENFORCEMENT_CHANGED', entityType: 'role', entityId: role.id, newValues: { mfaEnforced: Boolean(enforced), affectedUsersCount: accountIds.length } });

  return {
    roleId: role.id,
    roleName: role.name,
    mfaEnforced: Boolean(enforced),
    affectedUsersCount: accountIds.length,
    affectedUsernames: [...new Set(accounts.map((account) => account.username))],
  };
};

export default {
  authenticate,
  changePasswordFirstLogin,
  changePassword,
  generateMfaSetup,
  verifyAndEnableMfa,
  verifyMfaLogin,
  disableMfa,
  getProfile,
  setMfaEnforced,
  setMfaEnforcedForRole,
};
