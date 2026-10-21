const { v4: uuidv4 } = require('uuid');

function correlationIdMiddleware(req, res, next) {
  req.correlationId = req.headers['x-correlation-id'] || `corr_${uuidv4()}`;
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (err.status ? err.status : 500);
  const errorCode = err.code || (statusCode === 404 ? 'NOT_FOUND' : statusCode === 403 ? 'FORBIDDEN' : statusCode === 401 ? 'UNAUTHORIZED' : 'INTERNAL_SERVER_ERROR');

  const response = {
    error: {
      code: errorCode,
      message: err.message || 'An unexpected error occurred.',
      correlationId: req.correlationId
    }
  };

  if (err.details) {
    response.error.details = err.details;
  }

  if (process.env.NODE_ENV === 'development' && statusCode === 500) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = {
  correlationIdMiddleware,
  errorHandler
};
