import { prisma } from '../../config/database.js';
import { auditAction, logActivity } from '../../utils/auditLogger.js';
import { badRequest, notFound } from '../../utils/httpError.js';
import { optionalString, parseEmail, parseEnum, parseUuid, requireString } from '../../utils/validation.js';
import { supportRequestReceived } from '../09-notifications/notification.events.js';

/**
 * Module 12 — Support requests. Anyone can write to the administrators, including someone who cannot log in,
 * so submitting needs no account. Reading and handling requests needs support:manage.
 */

const STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED'];
const MAX_NAME_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_PAGE_SIZE = 100;

const PERSON_REF = { select: { id: true, firstName: true, lastName: true } };
const REQUEST_INCLUDE = { person: PERSON_REF, handledBy: PERSON_REF };

const limited = (text, max, field) => {
  if (text.length > max) throw badRequest(`${field} can be at most ${max} characters`);
  return text;
};

/**
 * The reply says only that it was received: the form is public, so it shows nothing stored.
 */
export const createSupportRequest = async ({ name, email, message } = {}, { personId, ipAddress, userAgent }) => {
  const request = await prisma.supportRequest.create({
    data: {
      requesterName: limited(requireString(name, 'name'), MAX_NAME_LENGTH, 'name'),
      requesterEmail: parseEmail(email),
      message: limited(requireString(message, 'message'), MAX_MESSAGE_LENGTH, 'message'),
      personId: personId ?? null,
      ipAddress,
    },
  });
  await logActivity({ actorPersonId: personId, action: 'SUPPORT_REQUEST_CREATED', entityType: 'support_request', entityId: request.id, ipAddress, userAgent });
  await supportRequestReceived(request);
  return { id: request.id, status: request.status };
};

export const listSupportRequests = async ({ status, search, page = 1, limit = 20 } = {}) => {
  const pageNumber = Math.max(Number.parseInt(page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), MAX_PAGE_SIZE);
  const text = search?.trim();
  const where = {
    ...(status && { status: parseEnum(status, 'status', STATUSES) }),
    ...(text && {
      OR: ['requesterName', 'requesterEmail', 'message'].map((field) => ({ [field]: { contains: text, mode: 'insensitive' } })),
    }),
  };

  const [requests, total, byStatus] = await Promise.all([
    prisma.supportRequest.findMany({ where, include: REQUEST_INCLUDE, orderBy: { createdAt: 'desc' }, skip: (pageNumber - 1) * pageSize, take: pageSize }),
    prisma.supportRequest.count({ where }),
    prisma.supportRequest.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  const counts = Object.fromEntries(STATUSES.map((name) => [name, byStatus.find((row) => row.status === name)?._count._all ?? 0]));
  return { requests, counts, pagination: { page: pageNumber, limit: pageSize, total, pages: Math.ceil(total / pageSize) } };
};

const getRequestOrThrow = async (id) => {
  const request = await prisma.supportRequest.findUnique({ where: { id: parseUuid(id, 'id') }, include: REQUEST_INCLUDE });
  if (!request) throw notFound('Support request not found');
  return request;
};

export const getSupportRequest = (id) => getRequestOrThrow(id);

/**
 * Move a request along or reopen it. Whoever changes it becomes its handler.
 */
export const updateSupportRequest = async (id, { status, resolutionNote } = {}, actor) => {
  const existing = await getRequestOrThrow(id);
  const data = { handledByPersonId: actor.personId };
  if (status !== undefined) {
    data.status = parseEnum(status, 'status', STATUSES);
    data.resolvedAt = data.status === 'RESOLVED' ? new Date() : null;
  }
  if (resolutionNote !== undefined) data.resolutionNote = optionalString(resolutionNote, 'resolutionNote') ?? null;

  const updated = await prisma.supportRequest.update({ where: { id: existing.id }, data, include: REQUEST_INCLUDE });
  await auditAction(actor, {
    action: 'SUPPORT_REQUEST_UPDATED',
    entityType: 'support_request',
    entityId: existing.id,
    oldValues: { status: existing.status },
    newValues: { status: updated.status },
  });
  return updated;
};

export default { createSupportRequest, listSupportRequests, getSupportRequest, updateSupportRequest };
