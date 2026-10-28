import 'dotenv/config';
import { prisma } from '../config/database.js';
import bcrypt from 'bcryptjs';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'Mati@gmail.com').trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Mati@8196';
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'mati.admin').trim().toLowerCase();
const ADMIN_FIRST_NAME = (process.env.ADMIN_FIRST_NAME || 'Mati').trim();
const ADMIN_FATHER_NAME = (process.env.ADMIN_FATHER_NAME || 'Admin').trim();
const ADMIN_GRANDFATHER_NAME = (process.env.ADMIN_GRANDFATHER_NAME || 'User').trim();
const ADMIN_PHONE = (process.env.ADMIN_PHONE || '0911000000').trim();

export const seedAdmin = async () => {
  console.log('🚀 Seeding Super Admin and Institutional Foundation into New Schema...\n');

  try {
    // 1. Root Office Type
    console.log('🏛️ Creating/Upserting Root Office Type (University)...');
    let universityType = await prisma.officeType.findUnique({
      where: { name: 'University' },
    });
    if (!universityType) {
      universityType = await prisma.officeType.create({
        data: {
          name: 'University',
          levelOrder: 1,
        },
      });
    }

    // 2. Root Institutional Office
    console.log('🏢 Creating/Upserting Root Office (Arba Minch University)...');
    let rootOffice = await prisma.office.findFirst({
      where: { code: 'AMU' },
    });
    if (!rootOffice) {
      rootOffice = await prisma.office.create({
        data: {
          name: 'Arba Minch University',
          code: 'AMU',
          officeTypeId: universityType.id,
          isActive: true,
        },
      });
    }

    // 3. Position: System Administrator
    console.log('💼 Creating/Upserting Position (System Administrator)...');
    let adminPosition = await prisma.position.findFirst({
      where: {
        officeId: rootOffice.id,
        title: 'System Administrator',
      },
    });
    if (!adminPosition) {
      adminPosition = await prisma.position.create({
        data: {
          officeId: rootOffice.id,
          title: 'System Administrator',
          isHead: true,
        },
      });
    }

    // 4. Role: Super Admin
    console.log('🛡️ Creating/Upserting Super Admin Role...');
    let superAdminRole = await prisma.role.findUnique({
      where: { name: 'Super Admin' },
    });
    if (!superAdminRole) {
      superAdminRole = await prisma.role.create({
        data: {
          name: 'Super Admin',
          description: 'Full institutional authority, user registration, and platform governance',
        },
      });
    }

    // 5. Atomic Permissions Catalog
    console.log('🔑 Seeding Core Permissions Catalog...');
    const permissionCodes = [
      '*', // Super admin wildcard
      // Identity & User Management
      'user:create',
      'user:read',
      'user:update',
      'user:delete',
      'user:manage',
      // Dynamic Roles & Permissions
      'role:create',
      'role:read',
      'role:update',
      'role:delete',
      'role:assign',
      // Office Hierarchy
      'office:create',
      'office:read',
      'office:update',
      'office:delete',
      'office:assign',
      // Strategic KPI & Planning
      'kpi:create',
      'kpi:read',
      'kpi:update',
      'kpi:delete',
      'kpi:manage',
      // Target Cascading
      'target:create',
      'target:read',
      'target:update',
      'target:assign',
      'target:cascade',
      // Evaluation Cycles & Reports
      'cycle:manage',
      'report:create',
      'report:read',
      'report:submit',
      'report:review',
      // Scoring & Evaluations
      'evaluation:read',
      'evaluation:write',
      'evaluation:verify',
      'scorecard:read',
      // Files & Documents
      'file:upload',
      'file:read',
      'document:create',
      'document:read',
      'evidence:link',
      'evidence:read',
      // System & Notifications
      'notification:send',
      'settings:manage',
      'audit:read',
      'dashboard:read',
    ];

    for (const code of permissionCodes) {
      let perm = await prisma.permission.findUnique({
        where: { code },
      });
      if (!perm) {
        perm = await prisma.permission.create({
          data: { code },
        });
      }

      // Link to Super Admin role
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: superAdminRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: superAdminRole.id,
          permissionId: perm.id,
        },
      });
    }

    // 6. Super Admin Person Record
    console.log(`👤 Creating/Upserting Super Admin Person (${ADMIN_EMAIL})...`);
    let adminPerson = await prisma.person.findFirst({
      where: { email: ADMIN_EMAIL },
    });

    if (!adminPerson) {
      adminPerson = await prisma.person.create({
        data: {
          firstName: ADMIN_FIRST_NAME,
          middleName: ADMIN_FATHER_NAME,
          lastName: ADMIN_GRANDFATHER_NAME,
          email: ADMIN_EMAIL,
          phone: ADMIN_PHONE,
          gender: 'Male',
          status: 'active',
        },
      });
    }

    // 7. Super Admin UserAccount (Temporary Credentials & Mandatory MFA)
    console.log(`🔐 Creating/Upserting Super Admin UserAccount (${ADMIN_USERNAME})...`);
    
    // Generate secure temporary password
    const temporaryPassword = process.env.ADMIN_TEMP_PASSWORD || `AMU@Temp${Math.floor(1000 + Math.random() * 9000)}!`;
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    let userAccount = await prisma.userAccount.findUnique({
      where: { username: ADMIN_USERNAME },
    });

    if (!userAccount) {
      userAccount = await prisma.userAccount.create({
        data: {
          personId: adminPerson.id,
          username: ADMIN_USERNAME,
          passwordHash: hashedPassword,
          isActive: true,
          mustChangePassword: true,  // Forces password change on first login
          mfaEnforced: true,         // Super admin must have MFA enforced
          mfaEnabled: false,         // Not yet active until setup completed
          mfaSecret: null,
          mfaType: 'totp',
        },
      });
    } else {
      userAccount = await prisma.userAccount.update({
        where: { username: ADMIN_USERNAME },
        data: {
          passwordHash: hashedPassword,
          isActive: true,
          mustChangePassword: true,
          mfaEnforced: true,
          mfaEnabled: false,
          mfaSecret: null,
          mfaType: 'totp',
        },
      });
    }

    // 8. Place Super Admin Person in Root Office
    console.log('📍 Assigning Super Admin to Root Office & Position...');
    let officePerson = await prisma.officePerson.findFirst({
      where: {
        personId: adminPerson.id,
        officeId: rootOffice.id,
      },
    });

    if (!officePerson) {
      officePerson = await prisma.officePerson.create({
        data: {
          personId: adminPerson.id,
          officeId: rootOffice.id,
          positionId: adminPosition.id,
          startDate: new Date('2026-01-01'),
          isPrimary: true,
        },
      });
    }

    // 9. Assign Super Admin Role via OfficePersonRole (Global Scope)
    console.log('🎖️ Assigning Super Admin Role with Global Institutional Scope...');
    const existingRoleAssignment = await prisma.officePersonRole.findFirst({
      where: {
        officePersonId: officePerson.id,
        roleId: superAdminRole.id,
      },
    });

    if (!existingRoleAssignment) {
      await prisma.officePersonRole.create({
        data: {
          officePersonId: officePerson.id,
          roleId: superAdminRole.id,
          scopeOfficeId: null, // Null means unrestricted global university-wide scope
          validFrom: new Date('2026-01-01'),
        },
      });
    }

    console.log('\n======================================================');
    console.log('✅ SUPER ADMIN SEEDING COMPLETE WITH TEMPORARY PASSWORD!');
    console.log('======================================================');
    console.log(`👤 Name:               ${adminPerson.firstName} ${adminPerson.middleName} ${adminPerson.lastName}`);
    console.log(`📧 Email:              ${adminPerson.email}`);
    console.log(`🔑 Username:           ${userAccount.username}`);
    console.log(`🔒 Temporary Password: ${temporaryPassword}`);
    console.log(`⚠️  Must Change Pass:   YES (Enforced on First Login)`);
    console.log(`🛡️  MFA Enforced:       YES (Mandatory TOTP Setup on First Login)`);
    console.log(`🏛️ Role:               Super Admin (Global Scope)`);
    console.log(`🏢 Office:             ${rootOffice.name} (${rootOffice.code})`);
    console.log(`💼 Position:           ${adminPosition.title}`);
    console.log('======================================================');
    console.log('👉 First Login Workflow:');
    console.log('   1. Log in with the Temporary Password above.');
    console.log('   2. System returns status: REQUIRE_PASSWORD_CHANGE.');
    console.log('   3. Set a new permanent password.');
    console.log('   4. System automatically prompts mandatory MFA setup (TOTP QR Code).');
    console.log('   5. Scan QR code into Google Authenticator / Authy and verify 6-digit code.');
    console.log('======================================================\n');
  } catch (error) {
    console.error('❌ Error seeding Super Admin:', error);
    throw error;
  }
};

seedAdmin()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
