/**
 * Global Error Handling Middleware Stub
 */
const errorHandler = (err, req, res, next) => {
  // TODO: Implement custom error handling from scratch
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
  });
};

export default errorHandler;