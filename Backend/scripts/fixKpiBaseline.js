const { sequelize } = require('../config/database');

const run = async () => {
  try {
    await sequelize.authenticate();

    await sequelize.query('ALTER TABLE "KPIs" ADD COLUMN IF NOT EXISTS "Baseline" DECIMAL(10,2);');

    console.log('Schema updated: KPIs.Baseline is available.');
  } catch (error) {
    console.error('Failed to update KPI schema:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

if (require.main === module) {
  run();
}

module.exports = { run };
