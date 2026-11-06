import * as messageService from './message.service.js';

const send = (res, data, status = 200) => res.status(status).json({ status: 'success', data });
const me = (req) => req.user.personId;

// Inline only for images, with the type fixed so a browser cannot run the file
const sendStoredFile = (res, { absolutePath, fileName, mimeType, inline }) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-cache');
  res.type(mimeType);
  if (inline) return res.sendFile(absolutePath);
  return res.download(absolutePath, fileName);
};

export const listConversations = async (req, res) => send(res, await messageService.listConversations(me(req)));
export const getHistory = async (req, res) => send(res, await messageService.getHistory(me(req), req.params.personId, { limit: req.query.limit }));
export const countUnread = async (req, res) => send(res, await messageService.countUnread(me(req)));
export const searchPeople = async (req, res) => send(res, await messageService.searchPeople(me(req), req.query.query));
export const getPerson = async (req, res) => send(res, await messageService.getPerson(me(req), req.params.personId));
export const uploadAttachment = async (req, res) => send(res, await messageService.uploadAttachment(req.file, me(req)), 201);
export const sendMessage = async (req, res) => send(res, await messageService.sendMessage(me(req), req.body || {}), 201);
export const markConversationRead = async (req, res) => send(res, await messageService.markConversationRead(me(req), req.params.personId));
export const deleteMessage = async (req, res) => send(res, await messageService.deleteMessage(req.params.id, me(req)));
export const deleteAttachment = async (req, res) => send(res, await messageService.deleteAttachment(req.params.id, req.params.fileId, me(req)));
export const getAttachment = async (req, res) => sendStoredFile(res, await messageService.getAttachmentForDownload(req.params.fileId, me(req)));
