const { sequelize } = require('../config/database');

// Import all models
const User = require('./User');
const RoleCategory = require('./RoleCategory');
const Role = require('./Role');
const UserRole = require('./UserRole');
const KPI = require('./KPI');
const KPIType = require('./KPIType');
const Unit = require('./Unit');
const UserKPI = require('./UserKPI');
const UserKPIResult = require('./UserKPIResult');
const KPIDocument = require('./KPIDocument');
const OfficeReportSubmission = require('./OfficeReportSubmission');
const KPIYearPlan = require('./KPIYearPlan');

// Set up associations
RoleCategory.hasMany(Role, { foreignKey: 'RoleCategoryId' });
Role.belongsTo(RoleCategory, { foreignKey: 'RoleCategoryId' });

Role.hasMany(Role, { foreignKey: 'ParentRoleId', as: 'ChildRoles' });
Role.belongsTo(Role, { foreignKey: 'ParentRoleId', as: 'ParentRole' });

User.hasMany(UserRole, { foreignKey: 'UserId' });
UserRole.belongsTo(User, { foreignKey: 'UserId' });

Role.hasMany(UserRole, { foreignKey: 'RoleId' });
UserRole.belongsTo(Role, { foreignKey: 'RoleId' });

KPIType.hasMany(KPI, { foreignKey: 'KPITypeId' });
KPI.belongsTo(KPIType, { foreignKey: 'KPITypeId' });

Unit.hasMany(KPI, { foreignKey: 'UnitId' });
KPI.belongsTo(Unit, { foreignKey: 'UnitId' });

KPIType.hasMany(KPIType, { foreignKey: 'ParentKPIID', as: 'ChildKPIs' });
KPIType.belongsTo(KPIType, { foreignKey: 'ParentKPIID', as: 'ParentKPI' });

User.hasMany(UserKPI, { foreignKey: 'UserId' });
UserKPI.belongsTo(User, { foreignKey: 'UserId' });

KPI.hasMany(UserKPI, { foreignKey: 'KPIId' });
UserKPI.belongsTo(KPI, { foreignKey: 'KPIId' });

KPI.hasMany(KPIYearPlan, { foreignKey: 'KPIId' });
KPIYearPlan.belongsTo(KPI, { foreignKey: 'KPIId' });

KPIYearPlan.hasMany(UserKPI, { foreignKey: 'KPIYearPlanId' });
UserKPI.belongsTo(KPIYearPlan, { foreignKey: 'KPIYearPlanId' });

User.hasMany(UserKPIResult, { foreignKey: 'UserId' });
UserKPIResult.belongsTo(User, { foreignKey: 'UserId' });

KPI.hasMany(UserKPIResult, { foreignKey: 'KPIId' });
UserKPIResult.belongsTo(KPI, { foreignKey: 'KPIId' });

UserKPI.hasMany(UserKPIResult, { foreignKey: 'UserKPIId', as: 'Results' });
UserKPIResult.belongsTo(UserKPI, { foreignKey: 'UserKPIId', as: 'Assignment' });

User.hasMany(KPIDocument, { foreignKey: 'UserId' });
KPIDocument.belongsTo(User, { foreignKey: 'UserId' });

KPI.hasMany(KPIDocument, { foreignKey: 'KPIId' });
KPIDocument.belongsTo(KPI, { foreignKey: 'KPIId' });

// Export all models
module.exports = {
  sequelize,
  User,
  RoleCategory,
  Role,
  UserRole,
  KPI,
  KPIType,
  Unit,
  UserKPI,
  UserKPIResult,
  KPIDocument,
  OfficeReportSubmission,
  KPIYearPlan,
};
