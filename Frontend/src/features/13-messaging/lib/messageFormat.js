export const fullNameOf = (person) => `${person.firstName} ${person.lastName}`.trim();

export const isImage = (file) => file.fileType?.startsWith('image/');

/**
 * What a conversation shows as its last line.
 */
export const previewOf = (message) => {
  if (message.content) return message.content;
  const count = message.attachments.length;
  return count === 1 ? message.attachments[0].fileName : `${count} files`;
};

// Icons for the types people send most
export const fileIconOf = (fileType = '', fileName = '') => {
  const type = fileType.toLowerCase();
  const name = fileName.toLowerCase();
  if (type.includes('pdf') || name.endsWith('.pdf')) return '/PdfIcon.png';
  if (type.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) return '/WordIcon.png';
  if (type.includes('excel') || type.includes('spreadsheetml') || type.includes('csv') || /\.(xls|xlsx|csv)$/.test(name)) return '/ExcelIcon.png';
  return null;
};
