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

    if (process.env.NODE_ENV === 'development') {
      try {
        await sequelize.sync({ alter: true });
      } catch (alterErr) {
        console.warn('⚠️  sync({ alter }) failed, falling back to basic sync:', alterErr.message);
        await sequelize.sync();
      }
      console.log('Database models synced');
    }
  } catch (error) {
    console.error('❌ Unable to connect to database:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
