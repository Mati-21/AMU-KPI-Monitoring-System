const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { getCurrentCycleYear } = require('../utils/kpiCycle');

const UserKPI = sequelize.define(
  'UserKPI',
  {
    Id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    KPIId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    CycleYear: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: getCurrentCycleYear,
    },
    UserId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    Baseline: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    Remark: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    CreatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    CreatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    IsArchived: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    timestamps: false,
  }
);

module.exports = UserKPI;
