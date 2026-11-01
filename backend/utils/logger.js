const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-api-key"]', 'password', 'token', 'accessToken', 'refreshToken'],
    censor: '[REDACTED]'
  },
  base: { service: 'shortly-api' },
  timestamp: pino.stdTimeFunctions.isoTime
});

module.exports = logger;
