const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const KPIYearPlan = sequelize.define(
  'KPIYearPlan',
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
    },
    Baseline: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    Target: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    FinalPerformance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    Status: {
      type: DataTypes.ENUM('ACTIVE', 'LOCKED', 'COMPLETED'),
      defaultValue: 'ACTIVE',
    },
    IsLocked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    CreatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    timestamps: false,
  }
);

module.exports = KPIYearPlan;
