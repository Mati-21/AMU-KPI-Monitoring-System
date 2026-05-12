const { Role } = require('./models');

async function checkRoles() {
  try {
    const topRoles = await Role.findAll({ where: { ParentRoleId: null } });
    console.log('--- Top-Level Roles (Will be Spared) ---');
    topRoles.forEach(r => console.log(`- ${r.RoleName} (ID: ${r.Id})`));
    
    const childRoles = await Role.findAll({ where: { ParentRoleId: { [require('sequelize').Op.ne]: null } } });
    console.log('\n--- Subordinate Roles (Data will be REMOVED) ---');
    console.log(`Total count: ${childRoles.length}`);
  } catch (error) {
    console.error(error);
  } finally {
    process.exit();
  }
}

checkRoles();
