const { Op } = require('sequelize');
const { connectDB, sequelize } = require('../config/database');
const { User, RoleCategory, Role, UserRole } = require('../models');
const bcrypt = require('bcryptjs');

/**
 * Complete System Cleanup Script
 * This script will:
 * 1. Drop all existing data from the database
 * 2. Seed only a single System Admin user
 * 3. Admin credentials: admin@amu.edu.et / admin@123
 */
const cleanAndReseedDatabase = async () => {
  const transaction = await sequelize.transaction();

  try {
    console.log('🧹 Starting Complete System Cleanup and Reset\n');
    console.log('=====================================\n');

    // Step 1: Delete all data (respecting foreign key constraints)
    console.log('📋 Step 1: Clearing all data from database...\n');

    // Order matters due to foreign key constraints
    const tablesToClear = [
      'AuditLog',
      'ContactMessage',
      'Message',
      'Notification',
      'OfficeReportSubmission',
      'UserActivityLog',
      'UserKPIResult',
      'UserKPI',
      'KPIDocument',
      'KPIYearPlan',
      'KPI',
      'KPIType',
      'UserRole',
      'User',
      'Role',
      'RoleCategory',
      'SystemSetting',
      'Unit',
    ];

    for (const tableName of tablesToClear) {
      try {
        const model = sequelize.models[tableName];
        if (model) {
          const count = await model.destroy({
            where: {},
            force: true,
            transaction,
          });
          console.log(`  ✓ Cleared ${tableName}: ${count} records removed`);
        }
      } catch (error) {
        console.warn(`  ⚠ Warning clearing ${tableName}:`, error.message);
      }
    }

    console.log('\n✅ All data cleared\n');

    // Step 2: Create Admin Role Category
    console.log('📝 Step 2: Creating System Administration role category...\n');

    const adminCategory = await RoleCategory.create(
      {
        CategoryName: 'System Administration',
        Description: 'System administrators with full system access and control',
        CreatedAt: new Date(),
        CreatedBy: null,
        IsArchived: false,
      },
      { transaction }
    );

    console.log(`  ✓ Created role category: ${adminCategory.CategoryName}\n`);

    // Step 3: Create System Admin Role
    console.log('📝 Step 3: Creating System Administrator role...\n');

    const adminRole = await Role.create(
      {
        RoleCategoryId: adminCategory.Id,
        RoleName: 'System Administrator',
        ParentRoleId: null,
        Description: 'Full administrative access to the KPI system',
        HasExtraMeasures: true,
        CreatedAt: new Date(),
        CreatedBy: null,
        IsArchived: false,
        PermissionVersion: 1,
      },
      { transaction }
    );

    console.log(`  ✓ Created role: ${adminRole.RoleName}\n`);

    // Step 4: Create System Admin User
    console.log('📝 Step 4: Creating System Administrator user...\n');

    const ADMIN_EMAIL = 'admin@amu.edu.et';
    const ADMIN_PASSWORD = 'admin@123';
    const ADMIN_USERNAME = 'admin';

    // Hash password
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    const adminUser = await User.create(
      {
        FirstName: 'System',
        FatherName: 'Administrator',
        GrandFatherName: 'Admin',
        Email: ADMIN_EMAIL,
        UserName: ADMIN_USERNAME,
        Phone: '0911000000',
        password: hashedPassword,
        IsArchived: false,
        CreatedAt: new Date(),
        CreatedBy: null,
      },
      { transaction }
    );

    console.log(`  ✓ Created user: ${adminUser.FirstName} ${adminUser.FatherName}`);
    console.log(`    Email: ${adminUser.Email}`);
    console.log(`    Username: ${adminUser.UserName}\n`);

    // Step 5: Assign Admin Role to Admin User
    console.log('📝 Step 5: Assigning System Administrator role to user...\n');

    const userRole = await UserRole.create(
      {
        UserId: adminUser.Id,
        RoleId: adminRole.Id,
        CreatedAt: new Date(),
        CreatedBy: null,
        IsArchived: false,
      },
      { transaction }
    );

    console.log(`  ✓ Role assigned\n`);

    // Commit transaction
    await transaction.commit();

    console.log('=====================================\n');
    console.log('✅ System Cleanup and Reset Completed Successfully!\n');
    console.log('📊 Summary:\n');
    console.log('  ✓ All previous data has been deleted');
    console.log('  ✓ System Administration role category created');
    console.log('  ✓ System Administrator role created');
    console.log('  ✓ Admin user created with credentials:\n');
    console.log(`    Email: ${ADMIN_EMAIL}`);
    console.log(`    Password: ${ADMIN_PASSWORD}`);
    console.log(`    Username: ${ADMIN_USERNAME}\n`);
    console.log('⚠️  IMPORTANT: Store these credentials safely!\n');
    console.log('🎉 You can now log in with the admin account\n');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Cleanup and Reset Failed!\n');
    console.error('Error:', error.message);
    console.error('\nFull Error Details:');
    console.error(error);
    throw error;
  }
};

// Run cleanup if this script is executed directly
if (require.main === module) {
  connectDB()
    .then(() => cleanAndReseedDatabase())
    .then(() => {
      console.log('Exiting...\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = cleanAndReseedDatabase;
