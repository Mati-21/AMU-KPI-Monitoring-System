const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  Id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  FirstName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  FatherName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  GrandFatherName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  Email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  UserName: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  Phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  CreatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  CreatedBy: {
    type: DataTypes.UUID,
    allowNull: true
  },
  IsArchived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  LastActiveAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  ProfilePicture: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: false,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    }
  }
});

User.prototype.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

User.prototype.getPublicProfile = function() {
  return {
    Id: this.Id,
    FirstName: this.FirstName,
    FatherName: this.FatherName,
    GrandFatherName: this.GrandFatherName,
    FullName: `${this.FirstName} ${this.FatherName} ${this.GrandFatherName}`,
    Email: this.Email,
    UserName: this.UserName,
    Phone: this.Phone,
    ProfilePicture: this.ProfilePicture,
    CreatedAt: this.CreatedAt
  };
};

module.exports = User;