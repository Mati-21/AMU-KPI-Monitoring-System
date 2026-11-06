import { prisma } from '../../config/database.js';
import { pushToPerson } from '../../realtime/socket.js';
import { activeOn } from '../../utils/dates.js';
import { badRequest, forbidden, notFound } from '../../utils/httpError.js';
import { parseUuid } from '../../utils/validation.js';
import { KNOWN_EXTENSIONS } from '../08-evidence-documents/file.rules.js';
import { deleteStoredFile, storeFile, toDownload } from '../08-evidence-documents/file.service.js';
import { UPLOAD_FOLDERS } from '../08-evidence-documents/file.storage.js';

/**
 * Module 13 — Direct messages between two people. Any signed-in person may write to any other active person.
 * A message belongs to its two people only: nobody else can read it, and deleting it removes it for both.
 */

const MAX_CONTENT_LENGTH = 4000;
const MAX_ATTACHMENTS = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_HISTORY = 200;
const MAX_SEARCH_RESULTS = 10;

// People who can be messaged: active, with a login, and not archived
const MESSAGEABLE = { isActive: true, archivedAt: null, userAccount: { is: { isActive: true } } };

const PERSON_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  profilePictureFileId: true,
  userAccount: { select: { username: true } },
  officePersons: {
    where: activeOn('startDate', 'endDate'),
    orderBy: { isPrimary: 'desc' },
    take: 1,
    select: { office: { select: { name: true } }, position: { select: { title: true } } },
  },
};

const MESSAGE_INCLUDE = { attachments: { include: { file: true } } };

const toPerson = (person) => ({
  id: person.id,
  firstName: person.firstName,
  lastName: person.lastName,
  email: person.email,
  username: person.userAccount?.username ?? null,
  profilePictureFileId: person.profilePictureFileId,
  position: person.officePersons[0]?.position.title ?? null,
  officeName: person.officePersons[0]?.office.name ?? null,
});

const toAttachment = (file) => ({
  fileId: file.id,
  fileName: file.originalName,
  fileType: file.mimeType,
  size: Number(file.sizeBytes),
  fileUrl: `/api/v1/messages/files/${file.id}`,
});

const toMessage = (message) => ({
  id: message.id,
  senderId: message.senderPersonId,
  receiverId: message.receiverPersonId,
  content: message.content,
  isRead: Boolean(message.readAt),
  createdAt: message.createdAt,
  attachments: message.attachments.map(({ file }) => toAttachment(file)),
});

const getMessageablePerson = async (personId, me) => {
  const id = parseUuid(personId, 'personId');
  if (id === me) throw badRequest('You cannot message yourself');
  const person = await prisma.person.findFirst({ where: { id, ...MESSAGEABLE }, select: PERSON_SELECT });
  if (!person) throw notFound('That person cannot receive messages');
  return person;
};

// Tell both people, including the sender's other open tabs
const tell = (message, event, payload) => {
  pushToPerson(message.receiverPersonId, event, payload);
  pushToPerson(message.senderPersonId, event, payload);
};

// ===== Reading =====

/**
 * People the person has talked with, most recent first, each with the last message and the number they have not read.
 */
export const listConversations = async (me) => {
  const latest = await prisma.$queryRaw`
    SELECT DISTINCT ON (partner_id) id, partner_id
    FROM (
      SELECT id, created_at,
             CASE WHEN sender_person_id = ${me}::uuid THEN receiver_person_id ELSE sender_person_id END AS partner_id
      FROM message
      WHERE sender_person_id = ${me}::uuid OR receiver_person_id = ${me}::uuid
    ) AS mine
    ORDER BY partner_id, created_at DESC`;
  if (latest.length === 0) return [];

  const [messages, people, unread] = await Promise.all([
    prisma.message.findMany({ where: { id: { in: latest.map((row) => row.id) } }, include: MESSAGE_INCLUDE }),
    prisma.person.findMany({ where: { id: { in: latest.map((row) => row.partner_id) } }, select: PERSON_SELECT }),
    prisma.message.groupBy({ by: ['senderPersonId'], where: { receiverPersonId: me, readAt: null }, _count: true }),
  ]);

  const messageById = new Map(messages.map((message) => [message.id, message]));
  const personById = new Map(people.map((person) => [person.id, person]));
  const unreadFrom = new Map(unread.map((row) => [row.senderPersonId, row._count]));

  return latest
    .map((row) => ({ person: personById.get(row.partner_id), lastMessage: messageById.get(row.id) }))
    .filter(({ person, lastMessage }) => person && lastMessage)
    .sort((a, b) => b.lastMessage.createdAt - a.lastMessage.createdAt)
    .map(({ person, lastMessage }) => ({ person: toPerson(person), lastMessage: toMessage(lastMessage), unreadCount: unreadFrom.get(person.id) ?? 0 }));
};

/**
 * The latest messages between the person and one other, oldest first.
 */
export const getHistory = async (me, personId, { limit } = {}) => {
  const other = parseUuid(personId, 'personId');
  const take = Math.min(Math.max(Number.parseInt(limit, 10) || MAX_HISTORY, 1), MAX_HISTORY);
  const messages = await prisma.message.findMany({
    where: { OR: [{ senderPersonId: me, receiverPersonId: other }, { senderPersonId: other, receiverPersonId: me }] },
    orderBy: { createdAt: 'desc' },
    take,
    include: MESSAGE_INCLUDE,
  });
  return messages.reverse().map(toMessage);
};

export const countUnread = async (me) => ({ unread: await prisma.message.count({ where: { receiverPersonId: me, readAt: null } }) });

export const searchPeople = async (me, query) => {
  const text = String(query ?? '').trim();
  if (text.length < 2) return [];
  const contains = (field) => ({ [field]: { contains: text, mode: 'insensitive' } });
  const people = await prisma.person.findMany({
    where: {
      ...MESSAGEABLE,
      id: { not: me },
      OR: [contains('firstName'), contains('middleName'), contains('lastName'), contains('email'), { userAccount: { is: contains('username') } }],
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    take: MAX_SEARCH_RESULTS,
    select: PERSON_SELECT,
  });
  return people.map(toPerson);
};

export const getPerson = async (me, personId) => toPerson(await getMessageablePerson(personId, me));

// ===== Writing =====

/**
 * Take a file for a later message. It stays private to the sender until a message attaches it.
 */
export const uploadAttachment = async (upload, me) => {
  if (upload && upload.size > MAX_FILE_BYTES) throw badRequest('Files sent in messages must be 10 MB or smaller');
  return toAttachment(await storeFile(upload, UPLOAD_FOLDERS.MESSAGE_ATTACHMENTS, KNOWN_EXTENSIONS, me));
};

const resolveAttachmentIds = async (attachments, me) => {
  if (attachments === undefined || attachments === null) return [];
  if (!Array.isArray(attachments)) throw badRequest('attachments must be a list');
  if (attachments.length > MAX_ATTACHMENTS) throw badRequest(`A message can carry at most ${MAX_ATTACHMENTS} files`);
  const fileIds = [...new Set(attachments.map((item) => parseUuid(item?.fileId, 'attachments[].fileId')))];
  const files = await prisma.fileUpload.findMany({
    where: { id: { in: fileIds }, uploadedByPersonId: me, storedPath: { startsWith: `${UPLOAD_FOLDERS.MESSAGE_ATTACHMENTS}/` }, messageAttachments: { none: {} } },
    select: { id: true },
  });
  if (files.length !== fileIds.length) throw badRequest('An attached file was not uploaded by you, or is already in a message');
  return fileIds;
};

export const sendMessage = async (me, data = {}) => {
  const receiver = await getMessageablePerson(data.receiverId, me);
  if (data.content !== undefined && data.content !== null && typeof data.content !== 'string') throw badRequest('content must be text');
  const content = data.content?.trim() || null;
  if (content && content.length > MAX_CONTENT_LENGTH) throw badRequest(`A message can be at most ${MAX_CONTENT_LENGTH} characters`);
  const fileIds = await resolveAttachmentIds(data.attachments, me);
  if (!content && fileIds.length === 0) throw badRequest('Write a message or attach a file');

  const created = await prisma.message.create({
    data: { senderPersonId: me, receiverPersonId: receiver.id, content, attachments: { create: fileIds.map((fileId) => ({ fileId })) } },
    include: MESSAGE_INCLUDE,
  });
  const message = toMessage(created);
  tell(created, 'messages:new', message);
  return message;
};

/**
 * Mark everything the other person sent as read, and tell them so their ticks update.
 */
export const markConversationRead = async (me, personId) => {
  const other = parseUuid(personId, 'personId');
  const { count } = await prisma.message.updateMany({ where: { senderPersonId: other, receiverPersonId: me, readAt: null }, data: { readAt: new Date() } });
  if (count > 0) pushToPerson(other, 'messages:read', { byPersonId: me });
  return { markedRead: count };
};

const getOwnMessage = async (messageId, me) => {
  const message = await prisma.message.findUnique({ where: { id: parseUuid(messageId, 'id') }, include: MESSAGE_INCLUDE });
  if (!message) throw notFound('Message not found');
  if (message.senderPersonId !== me) throw forbidden('You can only delete your own messages');
  return message;
};

const removeFiles = async (files) => {
  for (const file of files) await deleteStoredFile(file);
};

export const deleteMessage = async (messageId, me) => {
  const message = await getOwnMessage(messageId, me);
  await prisma.message.delete({ where: { id: message.id } });
  await removeFiles(message.attachments.map(({ file }) => file));
  tell(message, 'messages:deleted', { messageId: message.id });
  return { id: message.id };
};

/**
 * Remove one file from a message. A message left with neither text nor files is deleted.
 */
export const deleteAttachment = async (messageId, fileId, me) => {
  const message = await getOwnMessage(messageId, me);
  const id = parseUuid(fileId, 'fileId');
  const attachment = message.attachments.find((item) => item.fileId === id);
  if (!attachment) throw notFound('Attachment not found');
  if (!message.content && message.attachments.length === 1) return deleteMessage(message.id, me);

  await prisma.messageAttachment.delete({ where: { id: attachment.id } });
  await removeFiles([attachment.file]);
  tell(message, 'messages:deleted', { messageId: message.id });
  return { id: message.id };
};

/**
 * A file in a message, for the two people in it only. Anyone else is told it does not exist.
 */
export const getAttachmentForDownload = async (fileId, me) => {
  const attachment = await prisma.messageAttachment.findUnique({ where: { fileId: parseUuid(fileId, 'fileId') }, include: { message: true, file: true } });
  if (!attachment || (attachment.message.senderPersonId !== me && attachment.message.receiverPersonId !== me)) throw notFound('File not found');
  return toDownload(attachment.file, attachment.file.mimeType.startsWith('image/'));
};

export default {
  listConversations,
  getHistory,
  countUnread,
  searchPeople,
  getPerson,
  uploadAttachment,
  sendMessage,
  markConversationRead,
  deleteMessage,
  deleteAttachment,
  getAttachmentForDownload,
};
