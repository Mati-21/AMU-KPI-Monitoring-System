import { HttpError } from '../utils/httpError.js';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Field name(s) of a unique violation. With the pg driver adapter Prisma reports the index
 * (e.g. "office_type_name_key") instead of meta.target, so derive the field from it.
 */
const uniqueFields = (err) => {
  if (Array.isArray(err.meta?.target)) return err.meta.target.join(', ');
  const cause = err.meta?.driverAdapterError?.cause;
  const index = cause?.constraint?.index;
  if (index && cause.table) return index.replace(`${cause.table}_`, '').replace(/_key$/, '').replace(/_/g, ' ');
  return 'value';
};

// Prisma known-request error codes -> HTTP responses
const PRISMA_ERRORS = {
  P2002: (err) => [409, `A record with this ${uniqueFields(err)} already exists`],
  P2003: () => [409, 'Operation violates a relation to another record'],
  P2007: () => [400, 'Invalid input value (check identifier and field formats)'],
  P2023: () => [400, 'Invalid identifier format'],
  P2025: () => [404, 'Resource not found'],
};

/**
 * Global error handler. Express 5 forwards rejected promises from async handlers here.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = 500;
  let message = 'Internal Server Error';
  let details;

  if (err instanceof HttpError) {
    status = err.status;
    message = err.message;
    details = err.details;
  } else if (err.code && PRISMA_ERRORS[err.code]) {
    [status, message] = PRISMA_ERRORS[err.code](err);
  } else if (err.name === 'PrismaClientValidationError') {
    status = 400;
    message = 'Invalid request data';
  } else if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Session expired, please login again';
  } else if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid session. Please login.';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body';
  } else if (err.status && err.status < 500) {
    status = err.status;
    message = err.message;
  }

  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    if (!isProduction && err.message) message = err.message;
  }

  res.status(status).json({ status: 'error', message, ...(details !== undefined && { details }) });
};

export default errorHandler;
