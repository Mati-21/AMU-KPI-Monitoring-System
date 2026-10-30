import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Module 08 — Where files live on disk. Files sit outside any public route and are named by random id,
 * so a stored path never depends on what the uploader called the file.
 */

const UPLOAD_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');

/**
 * Write a validated file. Returns the path relative to the upload root, which is what the database keeps.
 */
export const saveFile = async (folder, extension, buffer) => {
  const storedPath = path.posix.join(folder, `${crypto.randomUUID()}.${extension}`);
  const absolutePath = absolutePathOf(storedPath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);
  return storedPath;
};

export const absolutePathOf = (storedPath) => {
  const absolutePath = path.resolve(UPLOAD_ROOT, storedPath);
  if (!absolutePath.startsWith(UPLOAD_ROOT + path.sep)) throw new Error('Stored file path is outside the upload folder');
  return absolutePath;
};

export const fileExists = (storedPath) =>
  fs.access(absolutePathOf(storedPath)).then(
    () => true,
    () => false
  );

/**
 * Remove a file from disk. A missing file is not an error: the goal is that it is gone.
 */
export const removeFile = (storedPath) => fs.rm(absolutePathOf(storedPath), { force: true });

export const checksumOf = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

export default { saveFile, absolutePathOf, fileExists, removeFile, checksumOf };
