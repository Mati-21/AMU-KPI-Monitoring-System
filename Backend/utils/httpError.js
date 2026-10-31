/**
 * Error carrying an HTTP status code. Services throw these; errorMiddleware renders them.
 */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    if (details !== undefined) this.details = details;
  }
}

export const badRequest = (message = 'Bad request', details) => new HttpError(400, message, details);
export const unauthorized = (message = 'Not authenticated') => new HttpError(401, message);
export const forbidden = (message = 'You do not have permission to perform this action', details) => new HttpError(403, message, details);
export const notFound = (message = 'Resource not found') => new HttpError(404, message);
export const conflict = (message = 'Resource conflict', details) => new HttpError(409, message, details);
export const tooManyRequests = (message = 'Too many requests') => new HttpError(429, message);

/**
 * Placeholder for endpoints whose business logic has not been built yet.
 */
export const notImplemented = (feature) => {
  throw new HttpError(501, `${feature} is not implemented yet`);
};

export default { HttpError, badRequest, unauthorized, forbidden, notFound, conflict, tooManyRequests, notImplemented };
