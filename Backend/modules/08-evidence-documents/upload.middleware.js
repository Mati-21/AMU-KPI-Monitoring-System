import multer from 'multer';
import { badRequest } from '../../utils/httpError.js';

/**
 * Module 08 — Reads one multipart field named "file" into memory, so nothing reaches the disk before it is validated.
 * MAX_UPLOAD_MB is the hard limit; each document type can set a lower one.
 */
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 50;

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  defParamCharset: 'utf8',
}).single('file');

export const uploadOneFile = (req, res, next) => {
  parser(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE' ? `The file is larger than the ${MAX_UPLOAD_MB} MB limit` : `Upload failed: ${error.message}`;
      return next(badRequest(message));
    }
    return next(error);
  });
};

export default uploadOneFile;
