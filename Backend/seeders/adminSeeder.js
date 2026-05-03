const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { User, RoleCategory, Role, UserRole } = require('../models');

const ADMIN_EMAIL = 'Mule@gmail.com';
const ADMIN_PASSWORD = 'Mule@123';
const ADMIN_USERNAME = 'mule.admin';

const now = () => new Date();

const ensureAdminRole = async (transaction) => {
  let roleCategory = await RoleCategory.findOne({
    where: {
      CategoryName: {
        [Op.iLike]: 'Administration',
      },
    },
    transaction,
  });

  if (!roleCategory) {
    roleCategory = await RoleCategory.create(
      {
        CategoryName: 'Administration',
        Description: 'System administration roles',
        CreatedAt: now(),
        CreatedBy: null,
        IsArchived: false,
      },
      { transaction }
    );
  } else if (roleCategory.IsArchived) {
    await roleCategory.update(
      {
        IsArchived: false,
        Description: roleCategory.Description || 'System administration roles',
      },
      { transaction }
    );
  }

  let adminRole = await Role.findOne({
    where: {
      RoleName: {
        [Op.iLike]: 'System Administrator',
      },
    },
    transaction,
  });

  if (!adminRole) {
    adminRole = await Role.create(
      {
        RoleCategoryId: roleCategory.Id,
        RoleName: 'System Administrator',
        ParentRoleId: null,
        Description: 'Full administrative access to the KPI system',
        HasExtraMeasures: true,
        CreatedAt: now(),
        CreatedBy: null,
        IsArchived: false,
        PermissionVersion: 1,
      },
      { transaction }
    );
  } else if (adminRole.IsArchived) {
    await adminRole.update(
      {
        IsArchived: false,
        RoleCategoryId: adminRole.RoleCategoryId || roleCategory.Id,
        PermissionVersion: adminRole.PermissionVersion || 1,
      },
      { transaction }
    );
  }

  return adminRole;
};

const upsertAdminUser = async (transaction) => {
  let adminUser = await User.findOne({
    where: {
      Email: {
        [Op.iLike]: ADMIN_EMAIL,
      },
    },
    transaction,
  });

  const payload = {
    FirstName: 'Mule',
    FatherName: 'System',
    GrandFatherName: 'Admin',
    Email: ADMIN_EMAIL,
    UserName: ADMIN_USERNAME,
    Phone: '0911000000',
    password: ADMIN_PASSWORD,
    IsArchived: false,
  };

  if (!adminUser) {
    adminUser = await User.create(
      {
        ...payload,
        CreatedAt: now(),
        CreatedBy: null,
      },
      { transaction }
    );

    return adminUser;
  }

  adminUser.set(payload);
  await adminUser.save({ transaction });
  return adminUser;
};

const ensureRoleAssignment = async ({ userId, roleId, transaction }) => {
  const latestAssignment = await UserRole.findOne({
    where: {
      UserId: userId,
      RoleId: roleId,
    },
    order: [['CreatedAt', 'DESC']],
    transaction,
  });

  if (latestAssignment) {
    await latestAssignment.update(
      {
        IsArchived: false,
        ToDate: null,
      },
      { transaction }
    );

    return latestAssignment;
  }

  const activeAssignment = await UserRole.findOne({
    where: {
      UserId: userId,
      RoleId: roleId,
      IsArchived: false,
      [Op.or]: [{ ToDate: null }, { ToDate: { [Op.gte]: now() } }],
    },
    transaction,
  });

  if (activeAssignment) {
    return activeAssignment;
  }

  return UserRole.create(
    {
      UserId: userId,
      RoleId: roleId,
      FromDate: now(),
      ToDate: null,
      CreatedAt: now(),
      CreatedBy: userId,
      IsArchived: false,
    },
    { transaction }
  );
};

const seedAdmin = async () => {
  const transaction = await sequelize.transaction();

  try {
    await sequelize.authenticate();
    await sequelize.sync();

    const adminRole = await ensureAdminRole(transaction);
    const adminUser = await upsertAdminUser(transaction);
    await ensureRoleAssignment({ userId: adminUser.Id, roleId: adminRole.Id, transaction });

    await transaction.commit();

    console.log('Admin user seeded successfully.');
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Password: ${ADMIN_PASSWORD}`);
  } catch (error) {
    await transaction.rollback();
    console.error('Failed to seed admin user:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

if (require.main === module) {
  seedAdmin();
}

module.exports = { seedAdmin };
