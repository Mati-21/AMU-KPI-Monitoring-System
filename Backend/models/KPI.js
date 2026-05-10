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
    LifecycleType: {
      type: DataTypes.ENUM('RECURRING', 'PROGRESSIVE', 'ONE_TIME'),
      defaultValue: 'RECURRING',
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
    DefaultBaseline: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
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
    IsActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
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
