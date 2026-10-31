import * as profileService from './profile.service.js';
import { actorOf } from '../../../utils/requestContext.js';

const send = (res, data) => res.json({ status: 'success', data });

export const updateMyProfile = async (req, res) => send(res, await profileService.updateMyProfile(req.body || {}, actorOf(req)));
export const uploadMyProfilePicture = async (req, res) => send(res, await profileService.uploadMyProfilePicture(req.file, actorOf(req)));
export const removeMyProfilePicture = async (req, res) => send(res, await profileService.removeMyProfilePicture(actorOf(req)));

// Only ever a checked image, with the type fixed so a browser cannot treat it as anything else
export const getProfilePicture = async (req, res) => {
  const { absolutePath, mimeType } = await profileService.getProfilePicture(req.params.id);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-cache');
  res.type(mimeType);
  res.sendFile(absolutePath);
};
