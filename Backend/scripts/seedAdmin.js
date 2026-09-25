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

const seedAdmin = async () => {
  console.log('🚀 Seeding System Admin User from Environment...\n');
  console.log(`📧 Target Email    : ${ADMIN_EMAIL}`);
  console.log(`👤 Target Username : ${ADMIN_USERNAME}`);

  try {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_USERNAME) {
      throw new Error('ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_USERNAME are required in .env');
    }

    // 1. Ensure Role Category "Administration" exists
    let roleCategory = await prisma.roleCategories.findFirst({
      where: { CategoryName: { equals: 'Administration', mode: 'insensitive' } },
    });

    if (!roleCategory) {
      roleCategory = await prisma.roleCategories.create({
        data: {
          CategoryName: 'Administration',
          Description: 'System administration roles',
          CreatedAt: now(),
          IsArchived: false,
        },
      });
      console.log('✅ Created Role Category: Administration');
    } else if (roleCategory.IsArchived) {
      roleCategory = await prisma.roleCategories.update({
        where: { Id: roleCategory.Id },
        data: { IsArchived: false },
      });
      console.log('✅ Reactivated Role Category: Administration');
    }

    // 2. Ensure Role "System Administrator" exists
    let adminRole = await prisma.roles.findFirst({
      where: { RoleName: { equals: 'System Administrator', mode: 'insensitive' } },
    });

    if (!adminRole) {
      adminRole = await prisma.roles.create({
        data: {
          RoleCategoryId: roleCategory.Id,
          RoleName: 'System Administrator',
          Description: 'Full administrative access to the KPI system',
          HasExtraMeasures: true,
          IsDistributable: true,
          PermissionVersion: 1,
          CreatedAt: now(),
          IsArchived: false,
        },
      });
      console.log('✅ Created Role: System Administrator');
    } else if (adminRole.IsArchived) {
      adminRole = await prisma.roles.update({
        where: { Id: adminRole.Id },
        data: {
          IsArchived: false,
          RoleCategoryId: adminRole.RoleCategoryId || roleCategory.Id,
        },
      });
      console.log('✅ Reactivated Role: System Administrator');
    }

    // 3. Hash Password
    const hashedPassword = bcrypt.hashSync(ADMIN_PASSWORD, 10);

    // 4. Upsert Admin User
    let adminUser = await prisma.users.findFirst({
      where: {
        OR: [
          { Email: { equals: ADMIN_EMAIL, mode: 'insensitive' } },
          { UserName: { equals: ADMIN_USERNAME, mode: 'insensitive' } },
        ],
      },
    });

    if (!adminUser) {
      adminUser = await prisma.users.create({
        data: {
          FirstName: ADMIN_FIRST_NAME,
          FatherName: ADMIN_FATHER_NAME,
          GrandFatherName: ADMIN_GRANDFATHER_NAME,
          Email: ADMIN_EMAIL,
          UserName: ADMIN_USERNAME,
          Phone: ADMIN_PHONE,
          password: hashedPassword,
          CreatedAt: now(),
          IsArchived: false,
        },
      });
      console.log(`✅ Created User: ${adminUser.FirstName} ${adminUser.FatherName} (${ADMIN_EMAIL})`);
    } else {
      adminUser = await prisma.users.update({
        where: { Id: adminUser.Id },
        data: {
          FirstName: ADMIN_FIRST_NAME,
          FatherName: ADMIN_FATHER_NAME,
          GrandFatherName: ADMIN_GRANDFATHER_NAME,
          Email: ADMIN_EMAIL,
          UserName: ADMIN_USERNAME,
          Phone: ADMIN_PHONE,
          password: hashedPassword,
          IsArchived: false,
        },
      });
      console.log(`✅ Updated User: ${adminUser.FirstName} ${adminUser.FatherName} (${ADMIN_EMAIL})`);
    }

    // 5. Assign User to System Administrator Role
    const existingUserRole = await prisma.userRoles.findFirst({
      where: { UserId: adminUser.Id, RoleId: adminRole.Id },
    });

    if (!existingUserRole) {
      await prisma.userRoles.create({
        data: {
          UserId: adminUser.Id,
          RoleId: adminRole.Id,
          FromDate: now(),
          CreatedAt: now(),
          CreatedBy: adminUser.Id,
          IsArchived: false,
        },
      });
      console.log('✅ Assigned User to System Administrator Role');
    } else if (existingUserRole.IsArchived) {
      await prisma.userRoles.update({
        where: { Id: existingUserRole.Id },
        data: { IsArchived: false, ToDate: null },
      });
      console.log('✅ Reactivated User Role Assignment');
    }

    console.log('\n========================================');
    console.log('🎉 SYSTEM ADMIN SEEDED SUCCESSFULLY!');
    console.log('========================================');
    console.log(`📧 Email       : ${ADMIN_EMAIL}`);
    console.log(`👤 Username    : ${ADMIN_USERNAME}`);
    console.log(`🔑 Password    : [HIDDEN] (Length: ${ADMIN_PASSWORD.length})`);
    console.log(`🏷️  Role        : System Administrator`);
    console.log('========================================\n');
  } catch (error) {
    console.error('❌ Failed to seed admin user:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    process.exit(process.exitCode || 0);
  }
};

seedAdmin();

