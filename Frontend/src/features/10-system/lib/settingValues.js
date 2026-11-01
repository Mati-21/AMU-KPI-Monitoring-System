const pad = (number) => String(number).padStart(2, '0');

// A datetime-local input works in the viewer's own time zone, the server stores UTC
const toLocalInput = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * A setting's stored value as what its form control holds.
 */
export const toFormValue = ({ type, value }) => {
  if (type === 'boolean') return Boolean(value);
  if (type === 'json') return (value ?? []).join(', ');
  if (type === 'datetime') return toLocalInput(value);
  return value === null || value === undefined ? '' : String(value);
};

/**
 * What the form holds as the value to send. Empty means back to the default, except a day list, where it means no days.
 */
export const fromFormValue = ({ type }, formValue) => {
  if (type === 'boolean') return formValue;
  if (type === 'json') {
    const days = formValue.split(',').map((day) => day.trim()).filter(Boolean);
    return days.map(Number);
  }
  if (formValue === '') return null;
  if (type === 'number') return Number(formValue);
  if (type === 'datetime') return new Date(formValue).toISOString();
  return formValue;
};

/**
 * Readable text for an option: TARGET becomes Target, AUTO_FILL_ZERO becomes Auto fill zero. Time zones stay as they are.
 */
export const optionLabel = (option) => {
  if (option.includes('/')) return option.replace(/_/g, ' ');
  const words = option.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * The limits of a number setting as a short hint.
 */
export const rangeHint = ({ type, min, max }) => (type === 'number' && min !== undefined && max !== undefined ? `Between ${min} and ${max}.` : '');

/**
 * The server's message about one setting, without the key it starts with. It lists one problem per setting.
 */
export const settingError = (error, key) => {
  const message = error?.response?.data?.details?.errors?.find((text) => text.startsWith(`${key} `));
  if (!message) return null;
  const text = message.slice(key.length + 1);
  return text.charAt(0).toUpperCase() + text.slice(1);
};
