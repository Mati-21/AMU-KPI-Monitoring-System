const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const KPI = sequelize.define(
  'KPI',
  {
    Id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    KPITypeId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    UnitId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    Weight: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 100,
      },
    },
    Baseline: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    Target: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    Description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    IsEvedenceRequired: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
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

module.exports = KPI;
