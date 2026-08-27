import { prisma  } from '../config/database.js';
import { emitToUser  } from '../realtime/socket.js';

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

  const created = await prisma.notifications.create({
    data: {
      RecipientUserId: recipientUserId,
      ActorUserId: actorUserId,
      Type: type,
      Title: title,
      Message: message,
      Priority: normalizePriority(priority),
      Data: data,
    }
  });

  try {
    emitToUser(String(recipientUserId), 'notifications:new', created);
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

  await prisma.notifications.createMany({ data: records });
  const created = records;

  try {
    created.forEach((row) => {
      emitToUser(String(row.RecipientUserId), 'notifications:new', row);
    });
  } catch {
    // ignore realtime failures
  }

  return created;
};

const getActiveRoleUserIds = async (roleId) => {
  if (!roleId) return [];

  const assignments = await prisma.userRoles.findMany({
    where: {
      RoleId: roleId,
      IsArchived: false,
      OR: [{ ToDate: null }, { ToDate: { gte: new Date() } }],
    },
    select: { UserId: true }
  });

  return [...new Set(assignments.map((assignment) => String(assignment.UserId)).filter(Boolean))];
};

export { 
  createNotification,
  createBulkNotifications,
  getActiveRoleUserIds,
 };
