const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Role = sequelize.define(
  'Role',
  {
    Id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    RoleCategoryId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    RoleName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    ParentRoleId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    Description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    HasExtraMeasures: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    Permissions: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
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

module.exports = Role;
