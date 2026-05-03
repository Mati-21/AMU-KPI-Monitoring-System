const { UserKPI, UserRole, User } = require('./models');
const { Op } = require('sequelize');

async function diag() {
  try {
    const roleId = 'df3a5c88-b32c-4eff-8df0-fa37fa8fa3f8';
    const userRoles = await UserRole.findAll({ where: { RoleId: roleId, IsArchived: false } });
    const userIds = userRoles.map(ur => ur.UserId);
    
    console.log(`Users in role: ${userIds.join(', ')}`);

    const kpis = await UserKPI.findAll({
      where: { UserId: { [Op.in]: userIds }, IsArchived: false },
      include: [{ model: User, attributes: ['FirstName'] }]
    });

    console.log(`Found ${kpis.length} active KPIs for these users:`);
    kpis.forEach(k => {
      console.log(`- ID: ${k.Id}, KPIId: ${k.KPIId}, User: ${k.User?.FirstName}, Remark: "${k.Remark}"`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
diag();
