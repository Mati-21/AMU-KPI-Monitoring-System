const sentenceCase = (text) => {
  const words = text.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** ROLE_CREATED becomes Role created. */
export const actionLabel = sentenceCase;

/** office_person_role becomes Office person role. */
export const entityLabel = sentenceCase;

export const formatDateTime = (date) => new Date(date).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const formatValue = (value) => {
  if (value === null || value === undefined) return 'Empty';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
};
