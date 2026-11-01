const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { createClient } = require('redis');

const redisUrl = process.env.REDIS_URL;
let redisClient;
let redisReady = false;

if (redisUrl) {
  redisClient = createClient({ url: redisUrl });
  redisClient.on('ready', () => { redisReady = true; });
  redisClient.on('end', () => { redisReady = false; });
  redisClient.on('error', (error) => {
    redisReady = false;
    console.error(JSON.stringify({ event: 'redis_rate_limit_error', message: error.message }));
  });
  redisClient.connect().catch(() => { redisReady = false; });
}

const createStore = (name) => redisClient
  ? new RedisStore({
      prefix: `shortly:ratelimit:${name}:`,
      sendCommand: (...args) => redisClient.sendCommand(args)
    })
  : undefined;

const securityViolation = (name, req) => {
  console.error(JSON.stringify({
    event: 'rate_limit_violation',
    limiter: name,
    ip: req.ip,
    method: req.method,
    path: req.originalUrl,
    userId: req.user?._id?.toString() || null,
    timestamp: new Date().toISOString()
  }));
};

const headers = (res, rateLimitInfo) => {
  if (!rateLimitInfo) return;
  const reset = rateLimitInfo.resetTime instanceof Date
    ? Math.ceil(rateLimitInfo.resetTime.getTime() / 1000)
    : rateLimitInfo.resetTime;
  res.setHeader('X-RateLimit-Limit', rateLimitInfo.limit);
  res.setHeader('X-RateLimit-Remaining', rateLimitInfo.remaining);
  if (reset) res.setHeader('X-RateLimit-Reset', reset);
};

const createLimiter = (name, windowMs, max, message, options = {}) => rateLimit({
  windowMs,
  max,
  ...(redisClient ? { store: createStore(name) } : {}),
  standardHeaders: true,
  legacyHeaders: true,
  passOnStoreError: options.passOnStoreError ?? (name === 'global-api' || name === 'shorten'),
  ...options,
  handler: (req, res) => {
    securityViolation(name, req);
    const reset = req.rateLimit?.resetTime instanceof Date
      ? Math.ceil(req.rateLimit.resetTime.getTime() / 1000)
      : req.rateLimit?.resetTime;
    headers(res, req.rateLimit);
    if (reset) res.setHeader('Retry-After', Math.max(1, reset - Math.ceil(Date.now() / 1000)));
    res.status(429).json({ message });
  }
});

const globalLimiter = createLimiter('global-api', 15 * 60 * 1000, 100, 'Too many requests, please try again later');
const authLimiter = createLimiter('authentication', 15 * 60 * 1000, 10, 'Too many authentication attempts, please try again later');
const shortenLimiter = createLimiter('shorten', 15 * 60 * 1000, 30, 'Too many URLs created, please try again later');
const unlockLimiter = createLimiter('unlock', 15 * 60 * 1000, 20, 'Too many unlock attempts, please try again later');
const analysisLimiter = createLimiter('ai-analysis', 15 * 60 * 1000, 10, 'Too many analysis requests, please try again later');

const enforceApiKeyRateLimit = async (user, req, res, next) => {
  const limit = Math.max(1, Number(user.apiKeyRateLimit) || 1000);
  if (!redisClient || !redisReady) {
    if (process.env.NODE_ENV !== 'production') return next();
    return res.status(503).json({ message: 'API key service temporarily unavailable' });
  }
  const key = `shortly:ratelimit:api-key:${user._id}`;
  try {
    const count = await redisClient.incr(key);
    if (count === 1) await redisClient.expire(key, 15 * 60);
    if (count > limit) {
      const ttl = await redisClient.ttl(key);
      if (ttl > 0) res.setHeader('Retry-After', ttl);
      return res.status(429).json({ message: 'API key rate limit exceeded' });
    }
    return next();
  } catch (error) {
    console.error(JSON.stringify({ event: 'api_key_rate_limit_error', message: error.message }));
    if (process.env.NODE_ENV !== 'production') return next();
    return res.status(503).json({ message: 'API key service temporarily unavailable' });
  }
};

module.exports = {
  globalLimiter,
  authLimiter,
  shortenLimiter,
  unlockLimiter,
  analysisLimiter,
  enforceApiKeyRateLimit,
  redisStatus: () => ({ configured: !!redisClient, ready: redisReady })
};
