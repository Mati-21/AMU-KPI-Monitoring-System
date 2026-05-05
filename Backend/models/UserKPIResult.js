const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { getCurrentCycleYear, getCurrentQuarter } = require('../utils/kpiCycle');

const UserKPIResult = sequelize.define(
  'UserKPIResult',
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
    UserKPIId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    CycleYear: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: getCurrentCycleYear,
    },
    Quarter: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: getCurrentQuarter,
    },
    UserId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    KPIResult: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    Description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    PerformanceTitle: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    EvidenceURL: {
      type: DataTypes.STRING,
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

module.exports = UserKPIResult;
