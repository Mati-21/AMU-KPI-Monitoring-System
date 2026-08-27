import { sequelize  } from '../config/database.js';
import { User, RoleCategory, Role, UserRole  } from '../models.js';

const seedData = async () => {
  try {
    console.log('🌱 Starting data seeding...');
    console.log('=====================================\n');

    // Sync all tables (force: true will drop and recreate tables)
    await sequelize.sync({ force: true });
    console.log('✅ Database tables created/refreshed\n');

    // ============================================
    // 1. CREATE ADMIN USER
    // ============================================
    console.log('📝 Creating Admin User...');

    const adminUser = await User.create({
      FirstName: 'System',
      FatherName: 'Administrator',
      GrandFatherName: 'Admin',
      Email: 'admin@gmail.com',
      UserName: 'admin',
      Phone: '1234567890',
      password: 'Admin@123',
      CreatedAt: new Date(),
      CreatedBy: null,
      IsArchived: false,
    });

    console.log('✅ Admin User Created:');
    console.log(`   ID: ${adminUser.Id}`);
    console.log(`   Name: ${adminUser.FirstName} ${adminUser.FatherName} ${adminUser.GrandFatherName}`);
    console.log(`   Username: ${adminUser.UserName}`);
    console.log(`   Email: ${adminUser.Email}`);
    console.log(`   Password: Admin@123 (will be hashed)\n`);

    // ============================================
    // 2. CREATE SYSTEM ADMINISTRATION ROLE CATEGORY
    // ============================================
    console.log('📁 Creating Role Category...');

    const systemAdminCategory = await RoleCategory.create({
      CategoryName: 'System Administration',
      Description: 'System administrators with full system access and control',
      CreatedAt: new Date(),
      CreatedBy: adminUser.Id,
      IsArchived: false,
    });

    console.log('✅ Role Category Created:');
    console.log(`   ID: ${systemAdminCategory.Id}`);
    console.log(`   Name: ${systemAdminCategory.CategoryName}`);
    console.log(`   Description: ${systemAdminCategory.Description}\n`);

    // ============================================
    // 3. CREATE SYSTEM ADMINISTRATOR ROLE
    // ============================================
    console.log('👥 Creating System Administrator Role...');

    const systemAdminRole = await Role.create({
      RoleCategoryId: systemAdminCategory.Id,
      RoleName: 'System Administrator',
      ParentRoleId: null,
      Description: 'Full system administration with all privileges',
      HasExtraMeasures: false,
      CreatedAt: new Date(),
      CreatedBy: adminUser.Id,
      IsArchived: false,
    });

    console.log('✅ Role Created:');
    console.log(`   ID: ${systemAdminRole.Id}`);
    console.log(`   Name: ${systemAdminRole.RoleName}`);
    console.log(`   Category: System Administration`);
    console.log(`   Has Extra Measures: Yes\n`);

    // ============================================
    // 4. ASSIGN ADMIN ROLE TO ADMIN USER
    // ============================================
    console.log('👑 Assigning System Administrator role to admin user...');

    await UserRole.create({
      UserId: adminUser.Id,
      RoleId: systemAdminRole.Id,
      FromDate: new Date(),
      ToDate: null, // No end date - permanent role
      CreatedAt: new Date(),
      CreatedBy: adminUser.Id,
      IsArchived: false,
    });

    console.log(`✅ ${adminUser.UserName} assigned as ${systemAdminRole.RoleName}`);
    console.log(`   From Date: ${new Date().toLocaleDateString()}`);
    console.log(`   To Date: Permanent\n`);

    // ============================================
    // 5. VERIFICATION - QUERY ALL DATA
    // ============================================
    console.log('🔍 Verifying seeded data...\n');

    // Count users
    const userCount = await User.count();
    console.log(`📊 Users: ${userCount}`);

    // Count role categories
    const categoryCount = await RoleCategory.count();
    console.log(`📊 Role Categories: ${categoryCount}`);

    // Count roles
    const roleCount = await Role.count();
    console.log(`📊 Roles: ${roleCount}`);

    // Count user role assignments
    const assignmentCount = await UserRole.count();
    console.log(`📊 User Role Assignments: ${assignmentCount}`);

    // Get admin user with role
    const adminWithRole = await User.findByPk(adminUser.Id, {
      include: [
        {
          model: UserRole,
          where: { IsArchived: false },
          required: false,
          include: [
            {
              model: Role,
              include: ['RoleCategory'],
            },
          ],
        },
      ],
    });

    console.log('\n📋 Admin User Details:');
    console.log(`   Name: ${adminWithRole.FirstName} ${adminWithRole.FatherName} ${adminWithRole.GrandFatherName}`);
    console.log(`   Username: ${adminWithRole.UserName}`);
    console.log(`   Email: ${adminWithRole.Email}`);
    console.log(`   Current Role: ${adminWithRole.UserRoles?.[0]?.Role?.RoleName || 'None'}`);
    console.log(`   Role Category: ${adminWithRole.UserRoles?.[0]?.Role?.RoleCategory?.CategoryName || 'None'}`);
    console.log(`   Has Extra Measures: ${adminWithRole.UserRoles?.[0]?.Role?.HasExtraMeasures ? 'Yes' : 'No'}`);

    // ============================================
    // 6. SEEDING COMPLETE
    // ============================================
    console.log('\n=====================================');
    console.log('🎉 Seeding Completed Successfully!');
    console.log('=====================================\n');

    console.log('📝 Default Login Credentials:');
    console.log('   Username: admin');
    console.log('   Email: admin@gmail.com');
    console.log('   Password: Admin@123');
    console.log('\n⚠️  IMPORTANT: Please change the admin password after first login!\n');

    console.log('🏁 You can now test your API:');
    console.log('   1. npm run dev (start server)');
    console.log('   2. Test login: POST http://localhost:5000/api/auth/login');
    console.log('   3. Body: { "UserName": "admin", "password": "Admin@123" }');
    console.log('\n💡 Other role categories and roles can be added dynamically through the API!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
};

seedData();
