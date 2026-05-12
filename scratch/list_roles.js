
const { Role } = require('../Backend/models');

async function listAllRoles() {
  try {
    const roles = await Role.findAll();
    console.log('--- ALL ROLES ---');
    roles.forEach(r => {
      console.log(`ID: ${r.Id} | Name: ${r.RoleName}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

listAllRoles();
