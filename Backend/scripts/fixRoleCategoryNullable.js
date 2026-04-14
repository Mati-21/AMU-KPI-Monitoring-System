const { sequelize } = require('../config/database');

const run = async () => {
  try {
    await sequelize.authenticate();

    await sequelize.query('ALTER TABLE "Roles" ALTER COLUMN "RoleCategoryId" DROP NOT NULL;');

    console.log('Schema updated: Roles.RoleCategoryId now allows NULL values.');
  } catch (error) {
    console.error('Failed to update schema:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

if (require.main === module) {
  run();
}

module.exports = { run };
