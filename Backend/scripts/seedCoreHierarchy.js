const { Op } = require('sequelize');
const { connectDB, sequelize } = require('../config/database');
const { User, RoleCategory, Role, UserRole } = require('../models');

const now = () => new Date();

const CATEGORIES = [
  { CategoryName: 'Management', Description: 'Leadership and top-level office roles' },
  { CategoryName: 'Academic', Description: 'Academic and teaching roles' },
  { CategoryName: 'Administrator', Description: 'Administrative operations roles' },
  { CategoryName: 'Research', Description: 'Research and innovation roles' },
];

const CORE_ROLES = [
  {
    roleName: 'Strategic Office',
    categoryName: 'Management',
    parentRoleName: null,
    description: 'Top-level strategic role for university-wide KPI direction',
    hasExtraMeasures: true,
  },
  {
    roleName: 'Vice President',
    categoryName: 'Management',
    parentRoleName: 'Strategic Office',
    description: 'Leads sector-level performance and oversight',
    hasExtraMeasures: true,
  },
  {
    roleName: 'Higher Institution Director',
    categoryName: 'Management',
    parentRoleName: 'Vice President',
    description: 'Leads higher institution level KPI aggregation',
    hasExtraMeasures: true,
  },
  {
    roleName: 'Dean',
    categoryName: 'Academic',
    parentRoleName: 'Higher Institution Director',
    description: 'Faculty-level KPI leadership role',
    hasExtraMeasures: true,
  },
  {
    roleName: 'Chair',
    categoryName: 'Academic',
    parentRoleName: 'Dean',
    description: 'Department-level KPI assignment and evaluation role',
    hasExtraMeasures: false,
  },
  {
    roleName: 'Staff Member',
    categoryName: 'Academic',
    parentRoleName: 'Chair',
    description: 'Operational KPI execution and evidence submission role',
    hasExtraMeasures: false,
  },
];

const CORE_USERS = [
  {
    roleName: 'Strategic Office',
    FirstName: 'Hana',
    FatherName: 'Bekele',
    GrandFatherName: 'Alemu',
    UserName: 'strategic.office',
    Email: 'strategic.office@amu.edu.et',
    Phone: '0911000001',
    password: 'Amu@12345',
  },
  {
    roleName: 'Vice President',
    FirstName: 'Samuel',
    FatherName: 'Tadesse',
    GrandFatherName: 'Abate',
    UserName: 'vice.president',
    Email: 'vice.president@amu.edu.et',
    Phone: '0911000002',
    password: 'Amu@12345',
  },
  {
    roleName: 'Higher Institution Director',
    FirstName: 'Meron',
    FatherName: 'Desta',
    GrandFatherName: 'Bekele',
    UserName: 'higher.institution',
    Email: 'higher.institution@amu.edu.et',
    Phone: '0911000003',
    password: 'Amu@12345',
  },
  {
    roleName: 'Dean',
    FirstName: 'Abebe',
    FatherName: 'Kebede',
    GrandFatherName: 'Mekonnen',
    UserName: 'dean.academic',
    Email: 'dean.academic@amu.edu.et',
    Phone: '0911000004',
    password: 'Amu@12345',
  },
  {
    roleName: 'Chair',
    FirstName: 'Tigist',
    FatherName: 'Alemu',
    GrandFatherName: 'Wolde',
    UserName: 'chair.department',
    Email: 'chair.department@amu.edu.et',
    Phone: '0911000005',
    password: 'Amu@12345',
  },
  {
    roleName: 'Staff Member',
    FirstName: 'Yohannes',
    FatherName: 'Mulu',
    GrandFatherName: 'Demissie',
    UserName: 'staff.user',
    Email: 'staff.user@amu.edu.et',
    Phone: '0911000006',
    password: 'Amu@12345',
  },
];

const getOrCreateCategory = async (item, createdBy) => {
  const found = await RoleCategory.findOne({
    where: { CategoryName: item.CategoryName },
  });

  if (found) return found;

  return RoleCategory.create({
    CategoryName: item.CategoryName,
    Description: item.Description,
    CreatedAt: now(),
    CreatedBy: createdBy || null,
    IsArchived: false,
  });
};

const getOrCreateRole = async (item, categoryId, parentRoleId, createdBy) => {
  const found = await Role.findOne({
    where: { RoleName: item.roleName, IsArchived: false },
  });

  if (found) return found;

  return Role.create({
    RoleCategoryId: categoryId,
    RoleName: item.roleName,
    ParentRoleId: parentRoleId || null,
    Description: item.description,
    HasExtraMeasures: item.hasExtraMeasures,
    CreatedAt: now(),
    CreatedBy: createdBy || null,
    IsArchived: false,
  });
};

const getOrCreateUser = async (item, createdBy) => {
  const found = await User.findOne({
    where: {
      [Op.or]: [{ UserName: item.UserName }, { Email: item.Email }],
    },
  });

  if (found) return found;

  return User.create({
    FirstName: item.FirstName,
    FatherName: item.FatherName,
    GrandFatherName: item.GrandFatherName,
    Email: item.Email,
    UserName: item.UserName,
    Phone: item.Phone,
    password: item.password,
    CreatedAt: now(),
    CreatedBy: createdBy || null,
    IsArchived: false,
  });
};

const ensureRoleAssignment = async (userId, roleId, createdBy) => {
  const active = await UserRole.findOne({
    where: {
      UserId: userId,
      RoleId: roleId,
      IsArchived: false,
      [Op.or]: [{ ToDate: null }, { ToDate: { [Op.gte]: now() } }],
    },
  });

  if (active) return active;

  return UserRole.create({
    UserId: userId,
    RoleId: roleId,
    FromDate: now(),
    ToDate: null,
    CreatedAt: now(),
    CreatedBy: createdBy || null,
    IsArchived: false,
  });
};

const seedCoreHierarchy = async () => {
  try {
    await connectDB();
    await sequelize.sync();

    console.log('Seeding core hierarchy roles and users...');

    const adminUser = await User.findOne({ where: { UserName: 'admin' } });
    const createdBy = adminUser?.Id || null;

    const categoryMap = new Map();
    for (const category of CATEGORIES) {
      const row = await getOrCreateCategory(category, createdBy);
      categoryMap.set(category.CategoryName, row);
    }

    const roleMap = new Map();

    // Create roles in order so parent roles already exist.
    for (const role of CORE_ROLES) {
      const category = categoryMap.get(role.categoryName);
      const parentRole = role.parentRoleName ? roleMap.get(role.parentRoleName) : null;

      const row = await getOrCreateRole(role, category.Id, parentRole?.Id, createdBy);
      roleMap.set(role.roleName, row);
    }

    for (const user of CORE_USERS) {
      const userRow = await getOrCreateUser(user, createdBy);
      const roleRow = roleMap.get(user.roleName);
      await ensureRoleAssignment(userRow.Id, roleRow.Id, createdBy);
      console.log(`OK: ${user.UserName} => ${user.roleName}`);
    }

    console.log('\nDone. Core hierarchy users and roles are inserted.');
    console.log('Login password for core users: Amu@12345');
    process.exit(0);
  } catch (error) {
    console.error('Core hierarchy seed failed:', error.message);
    process.exit(1);
  }
};

seedCoreHierarchy();
