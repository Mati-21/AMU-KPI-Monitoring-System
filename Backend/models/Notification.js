const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Notification = sequelize.define(
  'Notification',
  {
    Id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    RecipientUserId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    ActorUserId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    Type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    Title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    Message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    Priority: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      allowNull: false,
      defaultValue: 'medium',
    },
    Data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    IsRead: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    ReadAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    CreatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    IsArchived: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    timestamps: false,
    indexes: [
      { fields: ['RecipientUserId', 'IsArchived', 'CreatedAt'] },
      { fields: ['RecipientUserId', 'IsRead', 'IsArchived'] },
      { fields: ['Type'] },
    ],
  }
);

module.exports = Notification;
