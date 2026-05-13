const { Notification, UserRole } = require('../models');
const { Op } = require('sequelize');
const { emitToUser } = require('../realtime/socket');

const normalizePriority = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
    return normalized;
  }
  return 'medium';
};

const createNotification = async ({
  recipientUserId,
  actorUserId = null,
  type = null,
  title = null,
  message = null,
  priority = 'medium',
  data = null,
}) => {
  if (!recipientUserId) {
    throw new Error('recipientUserId is required');
  }

  const created = await Notification.create({
    RecipientUserId: recipientUserId,
    ActorUserId: actorUserId,
    Type: type,
    Title: title,
    Message: message,
    Priority: normalizePriority(priority),
    Data: data,
  });

  try {
    emitToUser(String(recipientUserId), 'notifications:new', created.toJSON());
  } catch {
    // ignore realtime failures
  }

  return created;
};

const createBulkNotifications = async ({
  recipientUserIds,
  actorUserId = null,
  type = null,
  title = null,
  message = null,
  priority = 'medium',
  data = null,
}) => {
  const ids = [...new Set((Array.isArray(recipientUserIds) ? recipientUserIds : []).filter(Boolean).map(String))];

  const records = ids.map((recipientUserId) => ({
    RecipientUserId: recipientUserId,
    ActorUserId: actorUserId,
    Type: type,
    Title: title,
    Message: message,
    Priority: normalizePriority(priority),
    Data: data,
  }));

  if (records.length === 0) {
    return [];
  }

  const created = await Notification.bulkCreate(records);

  try {
    created.forEach((row) => {
      emitToUser(String(row.RecipientUserId), 'notifications:new', row.toJSON());
    });
  } catch {
    // ignore realtime failures
  }

  return created;
};

const getActiveRoleUserIds = async (roleId) => {
  if (!roleId) return [];

  const assignments = await UserRole.findAll({
    where: {
      RoleId: roleId,
      IsArchived: false,
      [Op.or]: [{ ToDate: null }, { ToDate: { [Op.gte]: new Date() } }],
    },
    attributes: ['UserId'],
  });

  return [...new Set(assignments.map((assignment) => assignment.UserId).filter(Boolean))];
};

module.exports = {
  createNotification,
  createBulkNotifications,
  getActiveRoleUserIds,
};
