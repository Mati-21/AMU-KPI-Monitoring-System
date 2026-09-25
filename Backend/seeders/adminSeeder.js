import 'dotenv/config';
import { prisma } from '../config/database.js';
import bcrypt from 'bcryptjs';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'Mati@gmail.com').trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Mati@8196';
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'mati.admin').trim();
const ADMIN_FIRST_NAME = (process.env.ADMIN_FIRST_NAME || 'Mati').trim();
const ADMIN_FATHER_NAME = (process.env.ADMIN_FATHER_NAME || 'Admin').trim();
const ADMIN_GRANDFATHER_NAME = (process.env.ADMIN_GRANDFATHER_NAME || 'User').trim();
const ADMIN_PHONE = (process.env.ADMIN_PHONE || '0911000000').trim();

const now = () => new Date();

const ensureAdminRole = async () => {
  let roleCategory = await prisma.roleCategories.findFirst({
    where: {
      CategoryName: { equals: 'Administration', mode: 'insensitive' },
    }
  });

  if (!roleCategory) {
    roleCategory = await prisma.roleCategories.create({
      data: {
        CategoryName: 'Administration',
        Description: 'System administration roles',
        CreatedAt: now(),
        CreatedBy: null,
        IsArchived: false,
      }
    });
  } else if (roleCategory.IsArchived) {
    roleCategory = await prisma.roleCategories.update({
      where: { Id: roleCategory.Id },
      data: {
        IsArchived: false,
        Description: roleCategory.Description || 'System administration roles',
      }
    });
  }

  let adminRole = await prisma.roles.findFirst({
    where: {
      RoleName: { equals: 'System Administrator', mode: 'insensitive' },
    }
  });

  if (!adminRole) {
    adminRole = await prisma.roles.create({
      data: {
        RoleCategoryId: roleCategory.Id,
        RoleName: 'System Administrator',
        Description: 'Full administrative access to the KPI system',
        HasExtraMeasures: true,
        CreatedAt: now(),
        CreatedBy: null,
        IsArchived: false,
        PermissionVersion: 1,
      }
    });
  } else if (adminRole.IsArchived) {
    adminRole = await prisma.roles.update({
      where: { Id: adminRole.Id },
      data: {
        IsArchived: false,
        RoleCategoryId: adminRole.RoleCategoryId || roleCategory.Id,
        PermissionVersion: adminRole.PermissionVersion || 1,
      }
    });
  }

  return adminRole;
};

const upsertAdminUser = async () => {
  let adminUser = await prisma.users.findFirst({
    where: {
      OR: [
        { Email: { equals: ADMIN_EMAIL, mode: 'insensitive' } },
        { UserName: { equals: ADMIN_USERNAME, mode: 'insensitive' } },
      ],
    }
  });

  const hashedPassword = bcrypt.hashSync(ADMIN_PASSWORD, 10);

  const payload = {
    FirstName: ADMIN_FIRST_NAME,
    FatherName: ADMIN_FATHER_NAME,
    GrandFatherName: ADMIN_GRANDFATHER_NAME,
    Email: ADMIN_EMAIL,
    UserName: ADMIN_USERNAME,
    Phone: ADMIN_PHONE,
    password: hashedPassword,
    IsArchived: false,
  };

  if (!adminUser) {
    adminUser = await prisma.users.create({
      data: {
        ...payload,
        CreatedAt: now(),
        CreatedBy: null,
      }
    });
    return adminUser;
  }

  adminUser = await prisma.users.update({
    where: { Id: adminUser.Id },
    data: payload
  });
  
  return adminUser;
};

const ensureRoleAssignment = async ({ userId, roleId }) => {
  const latestAssignment = await prisma.userRoles.findFirst({
    where: {
      UserId: userId,
      RoleId: roleId,
    },
    orderBy: { CreatedAt: 'desc' }
  });

  if (latestAssignment) {
    return await prisma.userRoles.update({
      where: { Id: latestAssignment.Id },
      data: {
        IsArchived: false,
        ToDate: null,
      }
    });
  }

  return await prisma.userRoles.create({
    data: {
      UserId: userId,
      RoleId: roleId,
      FromDate: now(),
      ToDate: null,
      CreatedAt: now(),
      CreatedBy: userId,
      IsArchived: false,
    }
  });
};

const seedAdmin = async () => {
  try {
    const adminRole = await ensureAdminRole();
    const adminUser = await upsertAdminUser();
    await ensureRoleAssignment({ userId: adminUser.Id, roleId: adminRole.Id });

    console.log('\n========================================');
    console.log('🎉 SYSTEM ADMIN SEEDED SUCCESSFULLY!');
    console.log('========================================');
    console.log(`📧 Email       : ${ADMIN_EMAIL}`);
    console.log(`👤 Username    : ${ADMIN_USERNAME}`);
    console.log(`🔑 Password    : [HIDDEN] (Length: ${ADMIN_PASSWORD.length})`);
    console.log(`🏷️  Role        : System Administrator`);
    console.log('========================================\n');
  } catch (error) {
    console.error('Failed to seed admin user:', error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    process.exit(process.exitCode || 0);
  }
};

export { seedAdmin };

seedAdmin();

