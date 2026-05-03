const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const OfficeReportSubmission = sequelize.define(
  'OfficeReportSubmission',
  {
    Id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    CycleYear: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    SourceRoleId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    ParentRoleId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    ReportPayload: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    SubmittedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    SubmittedBy: {
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

module.exports = OfficeReportSubmission;
