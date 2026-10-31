import { prisma } from '../../config/database.js';
import { PERMISSION_CODES, PERMISSIONS, SUPER_ADMIN_PERMISSION } from '../../config/permissions.js';
import { pushToPerson } from '../../realtime/socket.js';
import { auditAction } from '../../utils/auditLogger.js';
import { activeOn } from '../../utils/dates.js';
import { badRequest, forbidden } from '../../utils/httpError.js';
import { optionalString, parseBoolean, parseUuid, requireString } from '../../utils/validation.js';
import { getOfficeDescendantIds } from '../02-office-hierarchy/office.service.js';

/**
 * Module 09 — Sending notifications: work out who receives one, save it, and push it to anyone connected.
 */

const IN_APP = 'in_app';

const holdsPermission = (code) => ({
  roles: {
    some: {
      ...activeOn('validFrom', 'validTo'),
      role: { permissions: { some: { permission: { code: { in: [code, SUPER_ADMIN_PERMISSION] } } } } },
    },
  },
});

/**
 * People currently placed in the target offices and/or holding the permission.
 * With a permission and no office: everyone who holds it, wherever they are placed.
 */
const resolveRecipients = async ({ targetOfficeId, includeSubOffices, requiredPermissionCode }) => {
  const officeIds = targetOfficeId ? (includeSubOffices ? await getOfficeDescendantIds(targetOfficeId) : [targetOfficeId]) : null;
  const placements = await prisma.officePerson.findMany({
    where: {
      ...activeOn('startDate', 'endDate'),
      person: { isActive: true },
      ...(officeIds && { officeId: { in: officeIds } }),
      ...(requiredPermissionCode && holdsPermission(requiredPermissionCode)),
    },
    select: { personId: true },
  });
  return [...new Set(placements.map((placement) => placement.personId))];
};

/**
 * Save and deliver one notification. Returns the notification, or null when nobody should receive it.
 * personIds adds specific people on top of the office and permission targets.
 */
export const sendNotification = async ({
  title,
  message,
  notificationType = null,
  entityType = null,
  entityId = null,
  targetOfficeId = null,
  includeSubOffices = false,
  requiredPermissionCode = null,
  personIds = [],
  excludePersonId = null,
  createdByPersonId = null,
}) => {
  const hasTarget = Boolean(targetOfficeId || requiredPermissionCode);
  const resolved = hasTarget ? await resolveRecipients({ targetOfficeId, includeSubOffices, requiredPermissionCode }) : [];
  const recipients = [...new Set([...resolved, ...personIds])].filter((personId) => personId !== excludePersonId);
  if (recipients.length === 0) return null;

  const permission = requiredPermissionCode ? await prisma.permission.findUnique({ where: { code: requiredPermissionCode }, select: { id: true } }) : null;
  const notification = await prisma.notification.create({
    data: {
      title,
      message,
      notificationType,
      entityType,
      entityId,
      targetOfficeId,
      includeSubOffices,
      requiredPermissionId: permission?.id ?? null,
      createdByPersonId,
      recipients: { create: recipients.map((personId) => ({ personId, channel: IN_APP })) },
    },
  });

  const payload = { id: notification.id, title, message, notificationType, entityType, entityId, createdAt: notification.createdAt };
  const delivered = recipients.filter((personId) => pushToPerson(personId, 'notification', payload));
  if (delivered.length > 0) {
    await prisma.notificationRecipient.updateMany({ where: { notificationId: notification.id, personId: { in: delivered } }, data: { deliveredAt: new Date() } });
  }
  return { ...notification, recipientCount: recipients.length };
};

/**
 * A person sends a notification by hand. They need notification:send over the office,
 * or university-wide to reach a permission group across every office.
 */
export const dispatchNotification = async (data = {}, actor) => {
  const targetOfficeId = parseUuid(data.targetOfficeId, 'targetOfficeId', { required: false }) ?? null;
  const requiredPermissionCode = optionalString(data.requiredPermissionCode, 'requiredPermissionCode') ?? null;
  if (!targetOfficeId && !requiredPermissionCode) throw badRequest('Choose a targetOfficeId or a requiredPermissionCode');
  if (requiredPermissionCode && !PERMISSION_CODES.includes(requiredPermissionCode)) throw badRequest(`Unknown permission code: ${requiredPermissionCode}`);

  const allowed = targetOfficeId ? await actor.access.can(PERMISSIONS.NOTIFICATION_SEND, targetOfficeId) : actor.access.canGlobally(PERMISSIONS.NOTIFICATION_SEND);
  if (!allowed) throw forbidden('You cannot send notifications to that audience');
  if (targetOfficeId && !(await prisma.office.findUnique({ where: { id: targetOfficeId }, select: { id: true } }))) throw badRequest('Office not found');

  const notification = await sendNotification({
    title: requireString(data.title, 'title'),
    message: requireString(data.message, 'message'),
    notificationType: 'ANNOUNCEMENT',
    entityType: optionalString(data.entityType, 'entityType') ?? null,
    entityId: parseUuid(data.entityId, 'entityId', { required: false }) ?? null,
    targetOfficeId,
    includeSubOffices: parseBoolean(data.includeSubOffices, 'includeSubOffices') ?? false,
    requiredPermissionCode,
    excludePersonId: actor.personId,
    createdByPersonId: actor.personId,
  });
  if (!notification) throw badRequest('Nobody matches that audience');

  await auditAction(actor, {
    action: 'NOTIFICATION_SENT',
    entityType: 'notification',
    entityId: notification.id,
    newValues: { title: notification.title, targetOfficeId, requiredPermissionCode, recipientCount: notification.recipientCount },
  });
  return notification;
};

export default { sendNotification, dispatchNotification };
