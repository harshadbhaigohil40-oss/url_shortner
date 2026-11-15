const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { createClient } = require('redis');
const { ipKeyGenerator } = rateLimit;

const redisUrl = process.env.REDIS_URL;
let redisClient;
let redisReady = false;
let redisConnecting = false;

if (redisUrl) {
  redisClient = createClient({ url: redisUrl });

  redisClient.on('ready', () => {
    redisReady = true;
    redisConnecting = false;
  });

  redisClient.on('end', () => {
    redisReady = false;
    redisConnecting = false;
  });

  redisClient.on('error', (error) => {
    redisReady = false;
    console.error(JSON.stringify({ event: 'redis_rate_limit_error', message: error.message }));
  });

  redisClient.on('reconnecting', () => {
    redisConnecting = true;
  });

  // Initial connection with reconnection logic
  const connectWithRetry = async () => {
    if (redisConnecting) return;
    redisConnecting = true;
    try {
      await redisClient.connect();
    } catch (error) {
      redisReady = false;
      redisConnecting = false;
      // Retry connection after 5 seconds
      setTimeout(connectWithRetry, 5000);
    }
  };

  connectWithRetry();
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
    path: req.path,
    userId: req.user?._id?.toString() || null,
    timestamp: new Date().toISOString()
  }));
};

const headers = (res, rateLimitInfo) => {
  if (!rateLimitInfo) return;
  const reset = rateLimitInfo.resetTime instanceof Date
    ? Math.ceil(rateLimitInfo.resetTime.getTime() / 1000)
    : rateLimitInfo.resetTime;
  if (reset) res.setHeader('Retry-After', Math.max(1, reset - Math.ceil(Date.now() / 1000)));
};

const createLimiter = (name, windowMs, max, message, options = {}) => rateLimit({
  windowMs,
  max,
  ...(redisClient ? { store: createStore(name) } : {}),
  standardHeaders: false,
  legacyHeaders: false,
  passOnStoreError: options.passOnStoreError ?? false,
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

const globalLimiter = createLimiter('global-api', 15 * 60 * 1000, 100, 'Too many requests, please try again later', {
  passOnStoreError: true
});

// Tightened authentication limits to mitigate credential stuffing attacks
const authLimiter = createLimiter('authentication', 15 * 60 * 1000, 5, 'Too many authentication attempts, please try again later');

const shortenLimiter = createLimiter('shorten', 15 * 60 * 1000, 30, 'Too many URLs created, please try again later');
const unlockLimiter = createLimiter('unlock', 15 * 60 * 1000, 20, 'Too many unlock attempts, please try again later');
const analysisLimiter = createLimiter('ai-analysis', 15 * 60 * 1000, 10, 'Too many analysis requests, please try again later');

// Rate limiter that applies different limits for authenticated vs unauthenticated users
const separateAuthRateLimiter = (windowMs, authenticatedMax, unauthenticatedMax, message) => {
  return rateLimit({
    windowMs,
    max: (req) => req.user ? authenticatedMax : unauthenticatedMax,
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: ipKeyGenerator,
    handler: (req, res) => {
      securityViolation('separate-auth', req);
      res.status(429).json({ message });
    }
  });
};

// Per-link rate limiting for unlock endpoint - prevents brute-force attacks on specific protected links
const perLinkUnlockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 attempts per link per IP/user per 15 minutes
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const { code } = req.params;
    if (!code) return 'unknown';
    const ipKey = ipKeyGenerator(req);
    return req.user
      ? `perlink-unlock:${req.user._id}:${code}`
      : `perlink-unlock-ip:${ipKey}:${code}`;
  },
  handler: (req, res) => {
    securityViolation('per-link-unlock', req);
    res.status(429).json({ message: 'Too many attempts on this specific link, please try again later' });
  }
});

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
  perLinkUnlockLimiter,
  separateAuthRateLimiter,
  enforceApiKeyRateLimit,
  redisStatus: () => ({ configured: !!redisClient, ready: redisReady }),
  redisClient
};
