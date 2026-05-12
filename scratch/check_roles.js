
const { Role } = require('../Backend/models');

async function checkRoles() {
  const ids = [
    '13262763-3484-4aa0-90af-a2af46be8af2',
    '15ded5f3-3c50-4d2a-a7a6-829ba5ec6fee',
    'e24aa7c6-1dd6-4060-b03e-13076220ac0d'
  ];

  try {
    const roles = await Role.findAll({
      where: { Id: ids }
    });

    console.log('--- SUBMITTED ROLES ---');
    roles.forEach(r => {
      console.log(`ID: ${r.Id} -> Name: ${r.RoleName}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

checkRoles();
