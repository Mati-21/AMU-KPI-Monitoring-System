import { sequelize, Role, UserKPI, UserRole, OfficeReportSubmission  } from '../models.js';

const clearChildRoleKPIs = async () => {
  try {
    console.log('Starting clearance of KPIs from all child roles (roles with parent)...\n');

    // Authenticate with database
    await sequelize.authenticate();
    console.log('✓ Database connection established\n');

    // Step 1: Find all roles that have a parent (child roles)
    const childRoles = await Role.findAll({
      where: {
        IsArchived: false,
        ParentRoleId: { [sequelize.Sequelize.Op.ne]: null },
      },
      attributes: ['Id', 'RoleName', 'ParentRoleId'],
    });

    console.log(`Found ${childRoles.length} child roles:\n`);
    childRoles.forEach((role) => {
      console.log(`  - ${role.RoleName} (ID: ${role.Id}, Parent: ${role.ParentRoleId})`);
    });

    if (childRoles.length === 0) {
      console.log('\n✓ No child roles found. Nothing to clear.');
      await sequelize.close();
      return;
    }

    // Step 2: Find all users in these child roles
    const childRoleIds = childRoles.map((r) => r.Id);
    const usersInChildRoles = await UserRole.findAll({
      where: {
        IsArchived: false,
        RoleId: { [sequelize.Sequelize.Op.in]: childRoleIds },
      },
      attributes: ['UserId', 'RoleId'],
      raw: true,
    });

    const userIdsInChildRoles = usersInChildRoles.map((ur) => ur.UserId);
    console.log(`\nFound ${userIdsInChildRoles.length} users in child roles`);

    // Step 3: Delete UserKPI records for these users
    let kpisDeleted = 0;
    if (userIdsInChildRoles.length > 0) {
      const result = await UserKPI.destroy({
        where: {
          UserId: { [sequelize.Sequelize.Op.in]: userIdsInChildRoles },
        },
      });
      kpisDeleted = result;
      console.log(`\n✓ Deleted ${result} UserKPI allocation(s)`);
    }

    // Step 4: Delete OfficeReportSubmission records for these child roles
    let submissionsDeleted = 0;
    const result2 = await OfficeReportSubmission.destroy({
      where: {
        SourceRoleId: { [sequelize.Sequelize.Op.in]: childRoleIds },
      },
    });
    submissionsDeleted = result2;
    console.log(`✓ Deleted ${result2} report submission(s)`);

    // Step 5: Verify top-level roles still have their KPIs
    const topLevelRoles = await Role.findAll({
      where: {
        IsArchived: false,
        ParentRoleId: null,
      },
      attributes: ['Id', 'RoleName'],
    });

    console.log(`\n✓ Top-level roles (${topLevelRoles.length}) remain unchanged:`);
    topLevelRoles.forEach((role) => {
      console.log(`  - ${role.RoleName} (ID: ${role.Id})`);
    });

    console.log('\n═══════════════════════════════════════════════════');
    console.log('Summary:');
    console.log(`  Child roles cleared: ${childRoles.length}`);
    console.log(`  KPI allocations deleted: ${kpisDeleted}`);
    console.log(`  Report submissions deleted: ${submissionsDeleted}`);
    console.log('═══════════════════════════════════════════════════\n');

    console.log('✓ Clearance completed successfully!');

    await sequelize.close();
  } catch (error) {
    console.error('\n✗ Error during clearance:', error.message);
    process.exit(1);
  }
};

clearChildRoleKPIs();
