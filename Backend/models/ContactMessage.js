const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ContactMessage = sequelize.define('ContactMessage', {
  Id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  Username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  Email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true,
    },
  },
  Subject: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  Message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  Status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Unread', // Unread | Read | Resolved | Archived
  },
}, {
  timestamps: true,
});

module.exports = ContactMessage;
