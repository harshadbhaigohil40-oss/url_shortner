const crypto = require('crypto');
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  const requestId = req.id || crypto.randomUUID();
  const statusCode = err.code === 'EBADCSRFTOKEN' ? 403 : (err.statusCode && err.statusCode < 500 ? err.statusCode : 500);
  const code = err.code === 'EBADCSRFTOKEN' ? 'CSRF_INVALID' : (statusCode === 401 ? 'UNAUTHORIZED' : statusCode === 403 ? 'FORBIDDEN' : statusCode === 404 ? 'NOT_FOUND' : statusCode === 429 ? 'RATE_LIMITED' : statusCode >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
  const message = err.code === 'EBADCSRFTOKEN' ? 'Invalid CSRF token' : statusCode >= 500 ? 'An unexpected error occurred' : (err.publicMessage || err.message || 'Request failed');

  logger.error({ err, requestId, method: req.method, path: req.originalUrl, ip: req.ip, userId: req.user?._id?.toString() }, 'request failed');
  if (res.headersSent) return next(err);
  return res.status(statusCode).json({ success: false, error: { code, message, requestId } });
};

const notFoundHandler = (req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Resource not found', requestId: req.id } });

module.exports = { errorHandler, notFoundHandler };
