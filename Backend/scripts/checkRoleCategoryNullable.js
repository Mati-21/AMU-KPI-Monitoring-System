import { sequelize  } from '../models.js';

const run = async () => {
  try {
    const [rows] = await sequelize.query(
      "SELECT is_nullable FROM information_schema.columns WHERE table_name='Roles' AND column_name='RoleCategoryId'"
    );
    console.log(rows[0]);
  } catch (error) {
    console.error('Check failed:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

run();
