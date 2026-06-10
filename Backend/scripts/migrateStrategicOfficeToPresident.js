const { Op } = require('sequelize');
const { connectDB, sequelize } = require('../config/database');
const { Role, User } = require('../models');

/**
 * Migration script to rename "Strategic Office" role to "President"
 * and update all related references
 */
const migrateStrategicOfficeToPresident = async () => {
  const transaction = await sequelize.transaction();

  try {
    console.log('🔄 Starting migration: Strategic Office → President\n');

    // 1. Update Role name
    console.log('📝 Updating Role name...');
    const updatedRoles = await Role.update(
      { RoleName: 'President' },
      {
        where: {
          RoleName: {
            [Op.iLike]: 'Strategic Office',
          },
        },
        transaction,
      }
    );
    console.log(`✅ Updated ${updatedRoles[0]} role(s)\n`);

    // 2. Update parent role references
    console.log('🔗 Updating parent role references...');
    const updatedParentRefs = await Role.update(
      {},
      {
        where: sequelize.where(sequelize.fn('LOWER', sequelize.col('parentRole.RoleName')), Op.iLike, 'president'),
        transaction,
      }
    );
    console.log(`✅ Parent role references are now consistent\n`);

    // 3. Update User records if any have Strategic Office related data
    console.log('👤 Checking for User updates...');
    const userUpdates = await User.findAll({
      where: {
        UserName: 'strategic.office',
      },
      transaction,
    });

    if (userUpdates.length > 0) {
      await User.update(
        {
          UserName: 'president',
          Email: 'president@amu.edu.et',
        },
        {
          where: {
            UserName: 'strategic.office',
          },
          transaction,
        }
      );
      console.log(`✅ Updated ${userUpdates.length} user(s)\n`);
    } else {
      console.log('ℹ️  No users with "strategic.office" username found\n');
    }

    // Commit transaction
    await transaction.commit();
    console.log('✅ Migration completed successfully!\n');
    console.log('Summary:');
    console.log('  - Role renamed: Strategic Office → President');
    console.log('  - Parent role references updated');
    console.log('  - User records updated if necessary\n');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
};

// Run migration if this script is executed directly
if (require.main === module) {
  connectDB()
    .then(() => migrateStrategicOfficeToPresident())
    .then(() => {
      console.log('🎉 Migration finished. Exiting...\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration error:', error);
      process.exit(1);
    });
}

module.exports = migrateStrategicOfficeToPresident;
