const KB = 1024;
const MB = KB * 1024;

/**
 * A file size in words: 850 KB, 2.4 MB.
 */
export const formatSize = (bytes) => {
  if (!Number.isFinite(bytes)) return '-';
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / KB))} KB`;
};

/**
 * What a document type accepts, in words: "pdf, xlsx, up to 25 MB".
 */
export const describeType = (type) => {
  const extensions = type.allowedExtensions ? type.allowedExtensions.split(',').join(', ') : 'any supported file type';
  return type.maxSizeMb ? `${extensions}, up to ${type.maxSizeMb} MB` : extensions;
};

export const personName = (person) => (person ? `${person.firstName} ${person.lastName}` : '-');
