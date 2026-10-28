import { prisma } from '../../../config/database.js';
import bcrypt from 'bcryptjs';

/**
 * Helper to format a Person + UserAccount record into a unified User object
 */
export const formatUser = (person) => {
  if (!person) return null;
  const account = person.userAccount;
  return {
    id: account?.id || person.id,
    personId: person.id,
    userAccountId: account?.id || null,
    firstName: person.firstName,
    middleName: person.middleName,
    lastName: person.lastName,
    fullName: [person.firstName, person.middleName, person.lastName].filter(Boolean).join(' '),
    email: person.email,
    phone: person.phone,
    gender: person.gender,
    birthDate: person.birthDate,
    status: person.status,
    username: account?.username || null,
    hasAccount: Boolean(account),
    isActive: account ? account.isActive : false,
    mustChangePassword: account ? account.mustChangePassword : false,
    mfaEnabled: account ? account.mfaEnabled : false,
    mfaEnforced: account ? account.mfaEnforced : false,
    mfaType: account?.mfaType || 'totp',
    lastLoginAt: account?.lastLoginAt || null,
    officePersons: person.officePersons || [],
  };
};

/**
 * List all users with pagination, full-text search, and filtering
 */
export const getUsers = async ({
  search = '',
  status,
  officeId,
  hasAccount,
  page = 1,
  limit = 20,
} = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const where = {};

  if (status) {
    where.status = status;
  }

  if (hasAccount !== undefined && hasAccount !== '') {
    const wantsAccount = String(hasAccount).toLowerCase() === 'true';
    where.userAccount = wantsAccount ? { isNot: null } : null;
  }

  if (officeId) {
    where.officePersons = {
      some: {
        officeId,
      },
    };
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { firstName: { contains: q, mode: 'insensitive' } },
      { middleName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
      { userAccount: { username: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const [total, rawPersons] = await Promise.all([
    prisma.person.count({ where }),
    prisma.person.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      include: {
        userAccount: {
          select: {
            id: true,
            username: true,
            isActive: true,
            mustChangePassword: true,
            mfaEnabled: true,
            mfaEnforced: true,
            mfaType: true,
            lastLoginAt: true,
          },
        },
        officePersons: {
          select: {
            id: true,
            isPrimary: true,
            startDate: true,
            endDate: true,
            office: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            position: {
              select: {
                id: true,
                title: true,
                isHead: true,
              },
            },
            roles: {
              select: {
                id: true,
                role: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                scopeOfficeId: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
    data: rawPersons.map(formatUser),
  };
};

/**
 * Get unified user profile by either UserAccount ID or Person ID
 */
export const getUserById = async (id) => {
  const person = await prisma.person.findFirst({
    where: {
      OR: [{ id }, { userAccount: { id } }],
    },
    include: {
      userAccount: {
        select: {
          id: true,
          username: true,
          isActive: true,
          mustChangePassword: true,
          mfaEnabled: true,
          mfaEnforced: true,
          mfaType: true,
          lastLoginAt: true,
        },
      },
      officePersons: {
        include: {
          office: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          position: {
            select: {
              id: true,
              title: true,
              isHead: true,
            },
          },
          roles: {
            include: {
              role: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return formatUser(person);
};

/**
 * Create a new User (both Person and optional UserAccount credentials in one transaction)
 */
export const createUser = async ({
  firstName,
  middleName,
  lastName,
  gender,
  birthDate,
  email,
  phone,
  status = 'active',
  username,
  password,
  temporaryPassword,
  mustChangePassword = true,
  mfaEnforced = false,
  isActive = true,
  account, // supports nested { username, password } or top-level username/password
}) => {
  if (!firstName || !lastName) {
    throw new Error('firstName and lastName are required');
  }

  const cleanEmail = email ? email.trim().toLowerCase() : null;
  if (cleanEmail) {
    const existingEmail = await prisma.person.findUnique({
      where: { email: cleanEmail },
    });
    if (existingEmail) {
      throw new Error(`User with email "${cleanEmail}" already exists`);
    }
  }

  // Support credentials either at top-level or under account object
  const loginUsername = (username || account?.username)?.trim();
  const loginPassword = password || temporaryPassword || account?.password || account?.temporaryPassword;
  const isAccountActive = account?.isActive !== undefined ? account.isActive : isActive;
  const forcePasswordChange = account?.mustChangePassword !== undefined ? account.mustChangePassword : mustChangePassword;
  const enforce2FA = account?.mfaEnforced !== undefined ? account.mfaEnforced : mfaEnforced;

  if (loginUsername) {
    const existingUsername = await prisma.userAccount.findUnique({
      where: { username: loginUsername },
    });
    if (existingUsername) {
      throw new Error(`Username "${loginUsername}" is already taken`);
    }
  }

  return prisma.$transaction(async (tx) => {
    const person = await tx.person.create({
      data: {
        firstName: firstName.trim(),
        middleName: middleName ? middleName.trim() : null,
        lastName: lastName.trim(),
        gender: gender || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        email: cleanEmail,
        phone: phone ? phone.trim() : null,
        status,
      },
    });

    let createdAccount = null;
    if (loginUsername && loginPassword) {
      const passwordHash = await bcrypt.hash(loginPassword, 10);
      createdAccount = await tx.userAccount.create({
        data: {
          personId: person.id,
          username: loginUsername,
          passwordHash,
          isActive: isAccountActive,
          mustChangePassword: forcePasswordChange,
          mfaEnforced: enforce2FA,
          mfaEnabled: false,
        },
        select: {
          id: true,
          username: true,
          isActive: true,
          mustChangePassword: true,
          mfaEnforced: true,
          mfaEnabled: true,
          mfaType: true,
          lastLoginAt: true,
        },
      });
    }

    return formatUser({
      ...person,
      userAccount: createdAccount,
      officePersons: [],
    });
  });
};

/**
 * Update User details (demographics and/or username/status)
 */
export const updateUser = async (id, data) => {
  const existingPerson = await prisma.person.findFirst({
    where: {
      OR: [{ id }, { userAccount: { id } }],
    },
    include: { userAccount: true },
  });

  if (!existingPerson) {
    throw new Error('User not found');
  }

  const personUpdate = {};
  if (data.firstName !== undefined) personUpdate.firstName = data.firstName.trim();
  if (data.middleName !== undefined) personUpdate.middleName = data.middleName ? data.middleName.trim() : null;
  if (data.lastName !== undefined) personUpdate.lastName = data.lastName.trim();
  if (data.gender !== undefined) personUpdate.gender = data.gender;
  if (data.birthDate !== undefined) personUpdate.birthDate = data.birthDate ? new Date(data.birthDate) : null;
  if (data.phone !== undefined) personUpdate.phone = data.phone ? data.phone.trim() : null;
  if (data.status !== undefined) personUpdate.status = data.status;

  if (data.email !== undefined) {
    const formattedEmail = data.email ? data.email.trim().toLowerCase() : null;
    if (formattedEmail && formattedEmail !== existingPerson.email) {
      const duplicate = await prisma.person.findUnique({
        where: { email: formattedEmail },
      });
      if (duplicate) {
        throw new Error(`Email "${formattedEmail}" is already registered to another user`);
      }
    }
    personUpdate.email = formattedEmail;
  }

  return prisma.$transaction(async (tx) => {
    const updatedPerson = await tx.person.update({
      where: { id: existingPerson.id },
      data: personUpdate,
      include: {
        userAccount: true,
        officePersons: {
          include: {
            office: { select: { id: true, name: true, code: true } },
            position: { select: { id: true, title: true, isHead: true } },
            roles: { include: { role: { select: { id: true, name: true } } } },
          },
        },
      },
    });

    // Update account attributes if provided
    if (existingPerson.userAccount && (data.username !== undefined || data.isActive !== undefined)) {
      const accountUpdate = {};
      if (data.username !== undefined && data.username.trim() !== existingPerson.userAccount.username) {
        const cleanUser = data.username.trim();
        const dupUser = await tx.userAccount.findUnique({ where: { username: cleanUser } });
        if (dupUser) {
          throw new Error(`Username "${cleanUser}" is already taken`);
        }
        accountUpdate.username = cleanUser;
      }
      if (data.isActive !== undefined) {
        accountUpdate.isActive = Boolean(data.isActive);
      }

      if (Object.keys(accountUpdate).length > 0) {
        updatedPerson.userAccount = await tx.userAccount.update({
          where: { id: existingPerson.userAccount.id },
          data: accountUpdate,
        });
      }
    }

    return formatUser(updatedPerson);
  });
};

/**
 * Delete or archive User
 */
export const deleteUser = async (id) => {
  const existing = await prisma.person.findFirst({
    where: {
      OR: [{ id }, { userAccount: { id } }],
    },
    include: {
      ownedTargets: { select: { id: true } },
      reportsSubmitted: { select: { id: true } },
    },
  });

  if (!existing) {
    throw new Error('User not found');
  }

  // If user has critical institutional data, archive them instead of hard deleting
  if (existing.ownedTargets.length > 0 || existing.reportsSubmitted.length > 0) {
    await prisma.person.update({
      where: { id: existing.id },
      data: { status: 'archived' },
    });
    return { message: 'User has bound institutional records and was archived' };
  }

  await prisma.person.delete({
    where: { id: existing.id },
  });

  return { message: 'User deleted successfully' };
};

/**
 * Provision a UserAccount for an existing User who does not have login access yet
 */
export const provisionAccount = async (
  userId,
  {
    username,
    temporaryPassword,
    mustChangePassword = true,
    mfaEnforced = false,
  }
) => {
  if (!username || !temporaryPassword) {
    throw new Error('username and temporaryPassword are required');
  }

  const person = await prisma.person.findFirst({
    where: {
      OR: [{ id: userId }, { userAccount: { id: userId } }],
    },
    include: { userAccount: true },
  });

  if (!person) {
    throw new Error('User not found');
  }

  if (person.userAccount) {
    throw new Error(`User already has an associated login account (${person.userAccount.username})`);
  }

  const cleanUsername = username.trim();
  const duplicate = await prisma.userAccount.findUnique({
    where: { username: cleanUsername },
  });

  if (duplicate) {
    throw new Error(`Username "${cleanUsername}" is already taken`);
  }

  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  const account = await prisma.userAccount.create({
    data: {
      personId: person.id,
      username: cleanUsername,
      passwordHash,
      isActive: true,
      mustChangePassword,
      mfaEnforced,
      mfaEnabled: false,
    },
    select: {
      id: true,
      personId: true,
      username: true,
      isActive: true,
      mustChangePassword: true,
      mfaEnforced: true,
      mfaEnabled: true,
    },
  });

  return account;
};

/**
 * Enable or disable user login access
 */
export const toggleAccountActive = async (userId, isActive) => {
  const account = await prisma.userAccount.findFirst({
    where: {
      OR: [{ id: userId }, { personId: userId }],
    },
  });

  if (!account) {
    throw new Error('User account not found');
  }

  return prisma.userAccount.update({
    where: { id: account.id },
    data: { isActive: Boolean(isActive) },
    select: {
      id: true,
      username: true,
      isActive: true,
    },
  });
};

/**
 * Administrator reset user password
 */
export const resetUserPassword = async (userId, temporaryPassword) => {
  if (!temporaryPassword || temporaryPassword.length < 6) {
    throw new Error('Temporary password must be at least 6 characters');
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
  const account = await prisma.userAccount.findFirst({
    where: isUuid
      ? { OR: [{ id: userId }, { personId: userId }, { username: userId }] }
      : { username: userId },
  });

  if (!account) {
    throw new Error('User account not found');
  }

  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  return prisma.userAccount.update({
    where: { id: account.id },
    data: {
      passwordHash,
      mustChangePassword: true,
    },
    select: {
      id: true,
      username: true,
      mustChangePassword: true,
    },
  });
};

export default {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  provisionAccount,
  toggleAccountActive,
  resetUserPassword,
};
