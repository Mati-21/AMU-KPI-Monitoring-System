import { badRequest } from './httpError.js';

/**
 * Small input parsers for services. Each throws a 400 with the field name on invalid input.
 */

export const requireString = (value, field) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw badRequest(`${field} is required`);
  return text;
};

/**
 * Optional text: undefined = not provided (leave unchanged), '' or null = clear.
 */
export const optionalString = (value, field) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw badRequest(`${field} must be a string`);
  return value.trim() || null;
};

export const parseIntId = (value, field, { required = true } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest(`${field} is required`);
    return undefined;
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw badRequest(`${field} must be a positive integer`);
  return number;
};

/**
 * Body boolean: must be a real boolean when provided.
 */
export const parseBoolean = (value, field) => {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw badRequest(`${field} must be true or false`);
  return value;
};

/**
 * Query-string boolean: "true" / "false" (or empty = not provided).
 */
export const parseBooleanQuery = (value, field) => {
  if (value === undefined || value === '') return undefined;
  const text = String(value).toLowerCase();
  if (text === 'true') return true;
  if (text === 'false') return false;
  throw badRequest(`${field} must be true or false`);
};

/**
 * Calendar date ("YYYY-MM-DD" or ISO string) for @db.Date columns.
 */
export const parseDate = (value, field, { required = true } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest(`${field} is required`);
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest(`${field} must be a valid date (YYYY-MM-DD)`);
  return date;
};

export default { requireString, optionalString, parseIntId, parseBoolean, parseBooleanQuery, parseDate };
