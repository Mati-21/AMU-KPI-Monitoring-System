const { Sequelize } = require('sequelize');
require('dotenv').config();

const sqlLoggingEnabled = String(process.env.DB_LOG_SQL || 'false').toLowerCase() === 'true';

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: sqlLoggingEnabled ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL database connected successfully');

    // Optimization: Skip expensive 'alter' sync on every startup unless specifically requested.
    // This significantly speeds up server start times during development.
    const shouldSync = String(process.env.DB_SYNC_ALTER || 'false').toLowerCase() === 'true';
    
    if (shouldSync && process.env.NODE_ENV === 'development') {
      console.log('Syncing database models (alter: true)...');
      await sequelize.sync({ alter: true });
      console.log('Database models synced successfully');
    } else if (process.env.NODE_ENV === 'development') {
      console.log('Database sync skipped (set DB_SYNC_ALTER=true to update schema)');
    }
  } catch (error) {
    console.error('❌ Unable to connect to database:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
