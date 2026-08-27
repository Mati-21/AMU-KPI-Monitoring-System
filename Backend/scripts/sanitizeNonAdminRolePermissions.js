import { sequelize  } from '../config/database.js';
import { Role  } from '../models.js';
import { normalizeRolePermissions  } from '../utils/rolePermissions.js';

const sanitizeNonAdminRolePermissions = async () => {
  try {
    await sequelize.authenticate();

    const roles = await Role.findAll({ where: { IsArchived: false } });
    let updatedCount = 0;

    for (const role of roles) {
      const currentPermissions = Array.isArray(role.Permissions) ? role.Permissions : [];
      const normalizedPermissions = normalizeRolePermissions(role.RoleName, currentPermissions);

      if (JSON.stringify(currentPermissions) !== JSON.stringify(normalizedPermissions)) {
        await role.update({ Permissions: normalizedPermissions });
        updatedCount += 1;
      }
    }

    console.log(`Permission cleanup complete. Updated ${updatedCount} non-admin role(s).`);
    await sequelize.close();
  } catch (error) {
    console.error('Permission cleanup failed:', error.message);
    process.exitCode = 1;
    await sequelize.close();
  }
};

if (require.main === module) {
  sanitizeNonAdminRolePermissions();
}

export {  sanitizeNonAdminRolePermissions  };
