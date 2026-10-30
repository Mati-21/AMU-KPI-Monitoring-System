import path from 'path';

/**
 * Module 08 — What may be uploaded. Pure functions with no database or disk access.
 * A file must really be what its extension says, so its first bytes are checked rather than trusting the browser.
 */

const startsWith = (bytes) => (buffer) => buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);

const isPdf = startsWith([0x25, 0x50, 0x44, 0x46]);
const isPng = startsWith([0x89, 0x50, 0x4e, 0x47]);
const isJpeg = startsWith([0xff, 0xd8, 0xff]);
const isZipBased = startsWith([0x50, 0x4b, 0x03, 0x04]); // docx, xlsx, pptx
const isOldOffice = startsWith([0xd0, 0xcf, 0x11, 0xe0]); // doc, xls, ppt
const isWebp = (buffer) => buffer.length >= 12 && buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP';
const isPlainText = (buffer) => !buffer.subarray(0, 4096).includes(0);

const SIGNATURES = {
  pdf: isPdf,
  png: isPng,
  jpg: isJpeg,
  jpeg: isJpeg,
  webp: isWebp,
  doc: isOldOffice,
  xls: isOldOffice,
  ppt: isOldOffice,
  docx: isZipBased,
  xlsx: isZipBased,
  pptx: isZipBased,
  csv: isPlainText,
  txt: isPlainText,
};

export const KNOWN_EXTENSIONS = Object.keys(SIGNATURES);
export const LOGO_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

export const extensionOf = (fileName) => path.extname(fileName).slice(1).toLowerCase();

/**
 * Keep a display name free of folders and control characters. It is never used as a path on disk.
 */
export const cleanFileName = (fileName) =>
  path
    .basename(String(fileName).replace(/\\/g, '/'))
    .replace(/[\p{Cc}"]/gu, '')
    .slice(-200) || 'file';

export const matchesExtension = (buffer, extension) => Boolean(SIGNATURES[extension]?.(buffer));

/**
 * "pdf, .DOCX" -> ['pdf', 'docx']. Empty means every known type.
 */
export const parseExtensionList = (text) =>
  (text ? String(text).split(',') : [])
    .map((item) => item.trim().replace(/^\./, '').toLowerCase())
    .filter(Boolean);

export default { KNOWN_EXTENSIONS, LOGO_EXTENSIONS, extensionOf, cleanFileName, matchesExtension, parseExtensionList };
