import { prisma } from '../../../config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';

const JWT_SECRET = process.env.JWT_SECRET || 'amu_kpi_jwt_secret';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

/**
 * Generate standard access token
 */
export const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      personId: user.personId,
      username: user.username,
      email: user.person?.email,
      roles: user.person?.officePersons?.flatMap((op) => op.roles.map((r) => r.role?.name)) || [],
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRE }
  );
};

/**
 * Generate temporary token for intermediate auth steps (password change / MFA)
 */
export const generateTempToken = (userId, scope) => {
  return jwt.sign({ id: userId, scope }, JWT_SECRET, { expiresIn: '15m' });
};

/**
 * Verify a temporary token and return decoded payload
 */
export const verifyTempToken = (token, expectedScope) => {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (expectedScope && decoded.scope !== expectedScope) {
    if (decoded.scope === 'MFA_SETUP') {
      throw new Error('Password was already updated. Your account is on the MFA setup step. Please proceed to POST /api/auth/mfa/setup.');
    }
    if (decoded.scope === 'FIRST_LOGIN_PASSWORD_CHANGE') {
      throw new Error('You must change your temporary password first (POST /api/auth/change-password) before proceeding.');
    }
    throw new Error(`Invalid token scope: expected ${expectedScope}, but received ${decoded.scope}`);
  }
  return decoded;
};

/**
 * Find user by username or email with related person, office, and roles
 */
export const findUserByUsernameOrEmail = async (identifier) => {
  if (!identifier) return null;
  return prisma.userAccount.findFirst({
    where: {
      OR: [
        { username: identifier },
        { person: { email: { equals: identifier, mode: 'insensitive' } } },
      ],
    },
    include: {
      person: {
        include: {
          officePersons: {
            include: {
              office: true,
              position: true,
              roles: {
                include: { role: true },
              },
            },
          },
        },
      },
    },
  });
};

export const findUserByUsername = findUserByUsernameOrEmail;

/**
 * Find user by ID
 */
export const findUserById = async (id) => {
  return prisma.userAccount.findUnique({
    where: { id },
    include: {
      person: {
        include: {
          officePersons: {
            include: {
              office: true,
              position: true,
              roles: {
                include: { role: true },
              },
            },
          },
        },
      },
    },
  });
};

/**
 * Login verification with first-login & MFA gate checks
 */
export const authenticate = async ({ username, email, password }) => {
  const identifier = username || email;
  const user = await findUserByUsernameOrEmail(identifier);
  if (!user) {
    throw new Error('Invalid Credentials');
  }

  if (!user.isActive) {
    throw new Error('User account is deactivated. Contact system administrator.');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new Error('Invalid Credentials');
  }

  // Check 1: user_account.mustChangePassword
  if (user.mustChangePassword) {
    const tempToken = generateTempToken(user.id, 'FIRST_LOGIN_PASSWORD_CHANGE');
    return {
      status: 'REQUIRE_PASSWORD_CHANGE',
      mustChangePassword: true,
      tempToken,
    };
  }

  // Check 2: If MFA is enforced by admin/role but not yet configured by user
  if (user.mfaEnforced && !user.mfaEnabled) {
    const tempToken = generateTempToken(user.id, 'MFA_SETUP');
    return {
      status: 'REQUIRE_MFA_SETUP',
      mfa_required: true,
      tempToken,
    };
  }

  // Check 3: user_account.mfaEnabled is true -> require 2FA challenge
  if (user.mfaEnabled && user.mfaSecret) {
    const tempToken = generateTempToken(user.id, 'MFA_VERIFY');
    return {
      status: 'REQUIRE_MFA_VERIFY',
      message: 'Enter the 6-digit verification code from your authenticator app.',
      tempToken,
    };
  }

  // 4. Normal Successful Login
  await prisma.userAccount.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = generateAccessToken(user);
  return {
    status: 'SUCCESS',
    token,
    user: sanitizeUser(user),
  };
};

/**
 * First-login password change
 */
export const changePasswordFirstLogin = async ({ tempToken, newPassword }) => {
  const decoded = verifyTempToken(tempToken, 'FIRST_LOGIN_PASSWORD_CHANGE');
  const user = await findUserById(decoded.id);

  if (!user) {
    throw new Error('User not found');
  }

  if (!newPassword || newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters long');
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  const updatedUser = await prisma.userAccount.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      mustChangePassword: false,
    },
    include: {
      person: {
        include: {
          officePersons: {
            include: { roles: { include: { role: true } } },
          },
        },
      },
    },
  });

  // After password change, if MFA is enforced, automatically proceed to MFA setup
  if (updatedUser.mfaEnforced && !updatedUser.mfaEnabled) {
    const mfaTempToken = generateTempToken(updatedUser.id, 'MFA_SETUP');
    return {
      status: 'REQUIRE_MFA_SETUP',
      mfa_required: true,
      tempToken: mfaTempToken,
    };
  }

  const token = generateAccessToken(updatedUser);
  return {
    status: 'SUCCESS',
    message: 'Password changed successfully.',
    token,
    user: sanitizeUser(updatedUser),
  };
};

/**
 * Regular password change for authenticated users
 */
export const changePasswordRegular = async ({ userId, currentPassword, newPassword, code, mfaCode }) => {
  const user = await prisma.userAccount.findUnique({
    where: { id: userId },
    include: {
      person: {
        include: {
          officePersons: {
            include: { roles: { include: { role: true } } },
          },
        },
      },
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (!currentPassword) {
    throw new Error('Current password is required for regular password change');
  }

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    throw new Error('Current password does not match');
  }

  // If user has MFA enabled, verify 2FA TOTP code
  if (user.mfaEnabled && user.mfaSecret) {
    const totpCode = code || mfaCode;
    if (!totpCode) {
      throw new Error('Two-Factor Authentication (2FA) 6-digit code is required to change password');
    }
    const isValid = verify({ token: String(totpCode).trim(), secret: user.mfaSecret });
    if (!isValid) {
      throw new Error('Invalid Two-Factor Authentication (2FA) code');
    }
  }

  if (!newPassword || newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters long');
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  const updatedUser = await prisma.userAccount.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      mustChangePassword: false,
    },
    include: {
      person: {
        include: {
          officePersons: {
            include: { roles: { include: { role: true } } },
          },
        },
      },
    },
  });

  const token = generateAccessToken(updatedUser);
  return {
    status: 'SUCCESS',
    message: 'Password changed successfully.',
    token,
    user: sanitizeUser(updatedUser),
  };
};

/**
 * Generate TOTP Secret and QR Code for MFA Setup
 */
export const generateMfaSetup = async ({ userId }) => {
  const user = await findUserById(userId);
  if (!user) throw new Error('User not found');

  const secret = generateSecret();
  const emailOrUser = user.person?.email || user.username;
  const otpauth = generateURI({
    issuer: 'AMU KPI Monitoring',
    label: emailOrUser,
    secret,
  });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

  // Store pending MFA secret on the user account (mfaEnabled remains false until verified)
  await prisma.userAccount.update({
    where: { id: userId },
    data: { mfaSecret: secret },
  });

  return {
    secret,
    otpauth,
    qrCodeDataUrl,
  };
};

/**
 * Verify initial code and enable MFA (Only requires code from client)
 */
export const verifyAndEnableMfa = async ({ userId, code, secret: providedSecret }) => {
  const user = await findUserById(userId);
  if (!user) throw new Error('User not found');

  const secretToVerify = providedSecret || user.mfaSecret;
  if (!secretToVerify) {
    throw new Error('MFA setup secret not found. Please call /mfa/setup first.');
  }

  const checkResult = await verify({ token: String(code).trim(), secret: secretToVerify });
  const isValid = Boolean(checkResult?.valid);
  if (!isValid) {
    throw new Error('Invalid verification code. Please check your authenticator app and try again.');
  }

  const updatedUser = await prisma.userAccount.update({
    where: { id: userId },
    data: {
      mfaSecret: secretToVerify,
      mfaEnabled: true,
      lastLoginAt: new Date(),
    },
    include: {
      person: {
        include: {
          officePersons: {
            include: { roles: { include: { role: true } } },
          },
        },
      },
    },
  });

  const token = generateAccessToken(updatedUser);
  return {
    status: 'SUCCESS',
    message: 'Two-Factor Authentication has been successfully configured and activated.',
    token,
    user: sanitizeUser(updatedUser),
  };
};

/**
 * Verify MFA Code during login
 */
export const verifyMfaLogin = async ({ tempToken, code }) => {
  const decoded = verifyTempToken(tempToken, 'MFA_VERIFY');
  const user = await findUserById(decoded.id);

  if (!user || !user.mfaSecret) {
    throw new Error('MFA is not configured for this account');
  }

  const checkResult = await verify({ token: String(code).trim(), secret: user.mfaSecret });
  const isValid = Boolean(checkResult?.valid);
  if (!isValid) {
    throw new Error('Invalid MFA code. Please enter the current 6-digit code from your authenticator app.');
  }

  await prisma.userAccount.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = generateAccessToken(user);
  return {
    status: 'SUCCESS',
    token,
    user: sanitizeUser(user),
  };
};

/**
 * Disable MFA (Allowed only if not enforced by admin/policy)
 */
export const disableMfa = async ({ userId, code }) => {
  const user = await findUserById(userId);
  if (!user) throw new Error('User not found');

  if (user.mfaEnforced) {
    throw new Error('MFA is strictly enforced on your account by policy and cannot be disabled.');
  }

  const checkResult = await verify({ token: String(code).trim(), secret: user.mfaSecret });
  const isValid = Boolean(checkResult?.valid);
  if (!isValid) {
    throw new Error('Invalid verification code');
  }

  await prisma.userAccount.update({
    where: { id: userId },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
    },
  });

  return { message: 'Two-Factor Authentication disabled' };
};

/**
 * Administrator: Enforce/Un-enforce MFA for a specific user (by UserAccount ID, Person ID, or Username)
 */
export const setMfaEnforced = async ({ userId, enforced = true }) => {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
  const user = await prisma.userAccount.findFirst({
    where: isUuid
      ? { OR: [{ id: userId }, { personId: userId }, { username: userId }] }
      : { username: userId },
  });

  if (!user) throw new Error('User account not found');

  return prisma.userAccount.update({
    where: { id: user.id },
    data: { mfaEnforced: Boolean(enforced) },
    select: {
      id: true,
      username: true,
      mfaEnforced: true,
      mfaEnabled: true,
    },
  });
};

/**
 * Administrator: Enforce/Un-enforce MFA for all users holding a specific role
 */
export const setMfaEnforcedForRole = async ({ roleName, roleId, enforced = true }) => {
  const where = {};
  if (roleId) {
    where.id = parseInt(roleId, 10);
  } else if (roleName) {
    where.name = { equals: roleName.trim(), mode: 'insensitive' };
  } else {
    throw new Error('roleName or roleId is required');
  }

  const role = await prisma.role.findFirst({
    where,
    include: {
      officePersonRoles: {
        include: {
          officePerson: {
            include: {
              person: {
                include: {
                  userAccount: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!role) {
    throw new Error(`Role "${roleName || roleId}" not found`);
  }

  const userAccounts = role.officePersonRoles
    .map((opr) => opr.officePerson?.person?.userAccount)
    .filter(Boolean);

  const userAccountIds = [...new Set(userAccounts.map((u) => u.id))];

  if (userAccountIds.length > 0) {
    await prisma.userAccount.updateMany({
      where: {
        id: { in: userAccountIds },
      },
      data: {
        mfaEnforced: Boolean(enforced),
      },
    });
  }

  return {
    roleId: role.id,
    roleName: role.name,
    mfaEnforced: Boolean(enforced),
    affectedUsersCount: userAccountIds.length,
    affectedUsernames: userAccounts.map((u) => u.username),
  };
};


const sanitizeUser = (user) => {
  return {
    id: user.id,
    personId: user.personId,
    username: user.username,
    isActive: user.isActive,
    mustPasswordChange: Boolean(user.mustChangePassword),
    mustChangePassword: Boolean(user.mustChangePassword),
    mfaEnabled: user.mfaEnabled,
    mfaEnforced: user.mfaEnforced,
    person: user.person
      ? {
          firstName: user.person.firstName,
          middleName: user.person.middleName,
          lastName: user.person.lastName,
          email: user.person.email,
          phone: user.person.phone,
        }
      : null,
  };
};

export default {
  authenticate,
  changePasswordFirstLogin,
  generateMfaSetup,
  verifyAndEnableMfa,
  verifyMfaLogin,
  disableMfa,
  setMfaEnforced,
  setMfaEnforcedForRole,
  generateAccessToken,
};

