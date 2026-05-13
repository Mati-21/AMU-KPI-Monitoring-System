const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Message = sequelize.define('Message', {
  Id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  SenderId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'Id'
    }
  },
  ReceiverId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'Id'
    }
  },
  Content: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  FileUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  FileName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  FileType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  IsRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  Attachments: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'Messages'
});

module.exports = Message;
