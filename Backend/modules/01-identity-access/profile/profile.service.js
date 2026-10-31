import { prisma } from '../../../config/database.js';
import { auditAction } from '../../../utils/auditLogger.js';
import { badRequest, notFound } from '../../../utils/httpError.js';
import { optionalString, parseEmail, parseUuid } from '../../../utils/validation.js';
import { deleteStoredFile, storeFile, toDownload } from '../../08-evidence-documents/file.service.js';
import { IMAGE_EXTENSIONS } from '../../08-evidence-documents/file.rules.js';
import { UPLOAD_FOLDERS } from '../../08-evidence-documents/file.storage.js';
import { getSetting } from '../../10-system-governance/system.service.js';
import { getProfile } from '../auth/auth.service.js';
import { assertEmailAvailable } from '../person/person.service.js';

/**
 * Module 01 — What a person may change about themselves: their contact details and profile picture.
 * Names and staff numbers stay with user administrators.
 */

export const updateMyProfile = async ({ phone, email } = {}, actor) => {
  const existing = await prisma.person.findUnique({ where: { id: actor.personId } });
  const update = {};
  if (phone !== undefined) update.phone = optionalString(phone, 'phone') ?? null;
  if (email !== undefined) {
    update.email = email ? parseEmail(email) : null;
    await assertEmailAvailable(update.email, existing.id);
  }

  if (Object.keys(update).length > 0) {
    await prisma.person.update({ where: { id: existing.id }, data: update });
    await auditAction(actor, {
      action: 'PROFILE_UPDATED',
      entityType: 'person',
      entityId: existing.id,
      oldValues: Object.fromEntries(Object.keys(update).map((key) => [key, existing[key]])),
      newValues: update,
    });
  }
  return getProfile(actor.accountId);
};

/**
 * The file records no uploader, so it never stops a person from being deleted. The audit trail keeps who uploaded it.
 */
export const uploadMyProfilePicture = async (upload, actor) => {
  const maxMb = await getSetting('general', 'profile_picture_max_mb');
  if (upload && upload.size > maxMb * 1024 * 1024) throw badRequest(`The profile picture must be ${maxMb} MB or smaller`);

  const person = await prisma.person.findUnique({ where: { id: actor.personId }, include: { profilePicture: true } });
  const file = await storeFile(upload, UPLOAD_FOLDERS.PROFILE_PICTURES, IMAGE_EXTENSIONS, null);
  try {
    await prisma.person.update({ where: { id: person.id }, data: { profilePictureFileId: file.id } });
  } catch (error) {
    await deleteStoredFile(file);
    throw error;
  }
  if (person.profilePicture) await deleteStoredFile(person.profilePicture);

  await auditAction(actor, { action: 'PROFILE_PICTURE_CHANGED', entityType: 'person', entityId: person.id, newValues: { fileId: file.id, fileName: file.originalName } });
  return { profilePictureFileId: file.id };
};

export const removeMyProfilePicture = async (actor) => {
  const person = await prisma.person.findUnique({ where: { id: actor.personId }, include: { profilePicture: true } });
  if (!person.profilePicture) throw notFound('You have no profile picture');

  await prisma.person.update({ where: { id: person.id }, data: { profilePictureFileId: null } });
  await deleteStoredFile(person.profilePicture);
  await auditAction(actor, { action: 'PROFILE_PICTURE_REMOVED', entityType: 'person', entityId: person.id });
  return { profilePictureFileId: null };
};

/**
 * Anyone logged in may see a colleague's picture, as with their name.
 */
export const getProfilePicture = async (personId) => {
  const person = await prisma.person.findUnique({ where: { id: parseUuid(personId, 'id') }, select: { profilePicture: true } });
  if (!person?.profilePicture) throw notFound('This person has no profile picture');
  return toDownload(person.profilePicture, true);
};

export default { updateMyProfile, uploadMyProfilePicture, removeMyProfilePicture, getProfilePicture };
