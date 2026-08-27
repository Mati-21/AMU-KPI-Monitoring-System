import { prisma  } from '../config/database.js';
import bcrypt from 'bcryptjs'; // Assuming password hashing might be needed eventually, though it wasn't before? Wait, the model hook probably hashed it. With Prisma we must hash it explicitly!

const ADMIN_EMAIL = 'Mule@gmail.com';
const ADMIN_PASSWORD = 'Mule@123';
const ADMIN_USERNAME = 'mule.admin';

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
      Email: { equals: ADMIN_EMAIL, mode: 'insensitive' },
    }
  });

  const payload = {
    FirstName: 'Mule',
    FatherName: 'System',
    GrandFatherName: 'Admin',
    Email: ADMIN_EMAIL,
    UserName: ADMIN_USERNAME,
    Phone: '0911000000',
    password: ADMIN_PASSWORD, // Wait, if Prisma doesn't hash automatically we must hash it. 
    IsArchived: false,
  };
  
  if (bcrypt && typeof bcrypt.hashSync === 'function') {
      const salt = bcrypt.genSaltSync(10);
      payload.password = bcrypt.hashSync(payload.password, salt);
  }

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

  const activeAssignment = await prisma.userRoles.findFirst({
    where: {
      UserId: userId,
      RoleId: roleId,
      IsArchived: false,
      OR: [{ ToDate: null }, { ToDate: { gte: now() } }],
    }
  });

  if (activeAssignment) {
    return activeAssignment;
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

    console.log('Admin user seeded successfully.');
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Password: ${ADMIN_PASSWORD}`);
  } catch (error) {
    console.error('Failed to seed admin user:', error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

if (require.main === module) {
  seedAdmin();
}

export {  seedAdmin  };
