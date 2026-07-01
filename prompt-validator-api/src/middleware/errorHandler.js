const logger = require('../utils/logger');

function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  logger.error('Unhandled error', {
    endpoint: req.originalUrl,
    method: req.method,
    statusCode,
    error: err.message,
  });

  res.status(statusCode).json({
    success: false,
    message,
  });
}

module.exports = errorHandler;
