const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  
  console.error(err);
  
  if (err.name === 'PrismaClientValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    return res.status(400).json({ message });
  }
  
  if (err.code === 'P2002') {
    return res.status(400).json({ message: 'Duplicate field value entered' });
  }
  
  res.status(error.statusCode || 500).json({
    message: error.message || 'Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : null
  });
};

export default errorHandler;