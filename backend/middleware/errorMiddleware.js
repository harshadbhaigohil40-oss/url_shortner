const crypto = require('crypto');
const logger = require('../utils/logger');
const { AppError } = require('../utils/AppError');

const errorHandler = (err, req, res, next) => {
  const requestId = req.id || crypto.randomUUID();

  // Handle known operational errors (AppError subclasses)
  if (err instanceof AppError) {
    logger.warn({
      requestId,
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      userId: req.user?._id?.toString(),
      code: err.code,
      message: err.message
    }, 'operational error');

    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId
      }
    });
  }

  // Handle CSRF errors
  if (err.code === 'EBADCSRFTOKEN') {
    logger.warn({ requestId, ip: req.ip, path: req.originalUrl }, 'CSRF token invalid');
    return res.status(403).json({
      success: false,
      error: { code: 'CSRF_INVALID', message: 'Invalid CSRF token', requestId }
    });
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message
    }));
    logger.warn({ requestId, details }, 'Validation error');
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details, requestId }
    });
  }

  // Handle Mongoose duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    logger.warn({ requestId, field, value: err.keyValue?.[field] }, 'Duplicate key error');
    return res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: `${field} already exists`, requestId }
    });
  }

  // Handle Mongoose cast errors (invalid ObjectId)
  if (err.name === 'CastError') {
    logger.warn({ requestId, path: err.path, value: err.value }, 'Cast error');
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: `Invalid ${err.path}: ${err.value}`, requestId }
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    logger.warn({ requestId, name: err.name }, 'JWT error');
    return res.status(401).json({
      success: false,
      error: { code: 'AUTHENTICATION_ERROR', message: 'Invalid or expired token', requestId }
    });
  }

  // Unexpected errors - log full details but don't expose to client
  logger.error({ err, requestId, method: req.method, path: req.originalUrl, ip: req.ip, userId: req.user?._id?.toString() }, 'unexpected error');

  if (res.headersSent) return next(err);
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId }
  });
};

const notFoundHandler = (req, res) => res.status(404).json({
  success: false,
  error: { code: 'NOT_FOUND', message: 'Resource not found', requestId: req.id }
});

module.exports = { errorHandler, notFoundHandler };
