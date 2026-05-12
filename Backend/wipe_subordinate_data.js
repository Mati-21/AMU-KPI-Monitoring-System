const { Role, UserKPI, UserKPIResult, OfficeReportSubmission, UserRole } = require('./models');
const { Op } = require('sequelize');

async function wipeData() {
  try {
    console.log('--- STARTING SYSTEM CLEANUP ---');

    // 1. Identify subordinate roles (those that HAVE a parent)
    const subordinateRoles = await Role.findAll({
      where: {
        ParentRoleId: { [Op.ne]: null }
      }
    });
    const subRoleIds = subordinateRoles.map(r => String(r.Id));
    console.log(`Found ${subRoleIds.length} subordinate roles.`);

    if (subRoleIds.length === 0) {
      console.log('No subordinate roles found to clean.');
      return;
    }

    // 2. Identify users assigned to these roles
    const userRoles = await UserRole.findAll({
      where: { RoleId: { [Op.in]: subRoleIds } }
    });
    const subUserIds = [...new Set(userRoles.map(ur => String(ur.UserId)))];
    console.log(`Found ${subUserIds.length} users in these roles.`);

    // 3. Delete Performance Results
    console.log('Deleting UserKPIResult records...');
    const resultsDeleted = await UserKPIResult.destroy({
      where: {
        UserId: { [Op.in]: subUserIds }
      }
    });
    console.log(`- Deleted ${resultsDeleted} result records.`);

    // 4. Delete KPI Allocations
    console.log('Deleting UserKPI (Allocations) records...');
    const allocationsDeleted = await UserKPI.destroy({
      where: {
        UserId: { [Op.in]: subUserIds }
      }
    });
    console.log(`- Deleted ${allocationsDeleted} allocation records.`);

    // 5. Delete Office Report Submissions
    console.log('Deleting OfficeReportSubmission records...');
    const submissionsDeleted = await OfficeReportSubmission.destroy({
      where: {
        [Op.or]: [
          { SourceRoleId: { [Op.in]: subRoleIds } },
          { ParentRoleId: { [Op.in]: subRoleIds } }
        ]
      }
    });
    console.log(`- Deleted ${submissionsDeleted} submission records.`);

    console.log('\n--- CLEANUP COMPLETE ---');
  } catch (error) {
    console.error('CRITICAL ERROR DURING CLEANUP:', error);
  } finally {
    process.exit();
  }
}

wipeData();
