const { sequelize } = require('../config/database');
const { User, RoleCategory, Role, UserRole } = require('../models');

const now = () => new Date();

const ADMIN_PROFILE = {
  firstName: process.env.SYSTEM_ADMIN_FIRST_NAME || 'System',
  fatherName: process.env.SYSTEM_ADMIN_FATHER_NAME || 'Administrator',
  grandFatherName: process.env.SYSTEM_ADMIN_GRANDFATHER_NAME || 'Account',
  username: process.env.SYSTEM_ADMIN_USERNAME || 'admin',
  email: process.env.SYSTEM_ADMIN_EMAIL || 'admin@amu.edu.et',
  phone: process.env.SYSTEM_ADMIN_PHONE || '0911000000',
  password: process.env.SYSTEM_ADMIN_PASSWORD || 'Admin@12345',
};

const resetToSystemAdmin = async () => {
  const transaction = await sequelize.transaction();

  try {
    await sequelize.authenticate();

    // Recreate the whole schema from models.
    await sequelize.sync({ force: true, transaction });

    const roleCategory = await RoleCategory.create(
      {
        CategoryName: 'Administration',
        Description: 'System administration roles',
        CreatedAt: now(),
        CreatedBy: null,
        IsArchived: false,
      },
      { transaction }
    );

    const adminRole = await Role.create(
      {
        RoleCategoryId: roleCategory.Id,
        RoleName: 'System Administrator',
        ParentRoleId: null,
        Description: 'Full administrative access to the KPI system',
        HasExtraMeasures: true,
        CreatedAt: now(),
        CreatedBy: null,
        IsArchived: false,
      },
      { transaction }
    );

    const adminUser = await User.create(
      {
        FirstName: ADMIN_PROFILE.firstName,
        FatherName: ADMIN_PROFILE.fatherName,
        GrandFatherName: ADMIN_PROFILE.grandFatherName,
        UserName: ADMIN_PROFILE.username,
        Email: ADMIN_PROFILE.email,
        Phone: ADMIN_PROFILE.phone,
        password: ADMIN_PROFILE.password,
        CreatedAt: now(),
        CreatedBy: null,
        IsArchived: false,
      },
      { transaction }
    );

    await UserRole.create(
      {
        UserId: adminUser.Id,
        RoleId: adminRole.Id,
        FromDate: now(),
        ToDate: null,
        CreatedAt: now(),
        CreatedBy: adminUser.Id,
        IsArchived: false,
      },
      { transaction }
    );

    await transaction.commit();

    console.log('Database reset complete.');
    console.log('All tables were recreated and only System Administrator remains.');
    console.log(`Username: ${ADMIN_PROFILE.username}`);
    console.log(`Email: ${ADMIN_PROFILE.email}`);
    console.log('Password: [set via SYSTEM_ADMIN_PASSWORD or default Admin@12345]');
  } catch (error) {
    await transaction.rollback();
    console.error('Reset failed:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

if (require.main === module) {
  resetToSystemAdmin();
}

module.exports = { resetToSystemAdmin };
