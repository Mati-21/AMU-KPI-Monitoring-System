const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SystemSetting = sequelize.define('SystemSetting', {
  Id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  Key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  Value: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  Type: {
    type: DataTypes.STRING,
    defaultValue: 'string'
  }
}, {
  timestamps: true
});

module.exports = SystemSetting;
