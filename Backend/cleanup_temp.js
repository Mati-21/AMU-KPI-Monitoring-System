const { UserKPI, UserRole, Role, KPI } = require('./models');
const { Op } = require('sequelize');

async function cleanup() {
  try {
    const roleName = 'Programing Chair Head';
    const role = await Role.findOne({ where: { RoleName: roleName } });
    
    if (!role) {
      console.log(`Role "${roleName}" not found.`);
      return;
    }

    // Find users with this role
    const userRoles = await UserRole.findAll({
      where: {
        RoleId: role.Id,
        IsArchived: false,
        [Op.or]: [{ ToDate: null }, { ToDate: { [Op.gte]: new Date() } }]
      },
      attributes: ['UserId']
    });

    const userIds = userRoles.map(ur => ur.UserId);
    if (userIds.length === 0) return;

    // Find all UserKPIs for these users
    const assignments = await UserKPI.findAll({
      where: {
        UserId: { [Op.in]: userIds },
        IsArchived: false
      },
      include: [{ model: KPI }]
    });

    let archivedCount = 0;
    for (const assignment of assignments) {
      // If either the assignment OR the KPI has a remark, it's considered a Derived KPI
      if (assignment.Remark || (assignment.KPI && assignment.KPI.Remark)) {
        await assignment.update({ IsArchived: true });
        archivedCount++;
      }
    }

    console.log(`Archived ${archivedCount} Derived KPI assignments for ${roleName}.`);

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    process.exit();
  }
}

cleanup();
