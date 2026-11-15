const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Vercel loads this file directly, so production configuration must be loaded here.
const { loadProductionSecrets } = require('./config/secrets');
const { loadEnv } = require('./config/env');
const logger = require('./utils/logger');

const configurationReady = loadProductionSecrets()
  .then(() => loadEnv())
  .catch((error) => {
    console.error(JSON.stringify({ event: 'startup_configuration_failed', message: error.message }));
    throw error;
  });

const express = require('express');
const mongoose = require('mongoose');
const { connectDatabase } = require('./config/database');
const cors = require('cors');

// Connect to database at startup (not per-request)
connectDatabase().catch((err) => {
  logger.error({ err }, 'MongoDB connection failed at startup');
  process.exit(1);
});
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const { doubleCsrf } = require('csrf-csrf');
const morgan = require('morgan');
const pinoHttp = require('pino-http');
const crypto = require('crypto');
const { globalLimiter } = require('./middleware/rateLimiter');

const urlRoutes = require('./routes/urlRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const bioRoutes = require('./routes/bioRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorMiddleware');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();
const PORT = process.env.PORT || 5000;

// Delay requests until optional production secrets have finished loading.
app.use((req, res, next) => {
  configurationReady.then(() => next()).catch(next);
});

// Trust proxy for accurate client IP behind reverse proxies (Cloudflare, Nginx, Vercel, etc.)
const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS || '1', 10);
app.set('trust proxy', Number.isInteger(trustProxyHops) && trustProxyHops >= 0 ? trustProxyHops : 1);

// Startup validation: verify configured hop count makes sense for the deployment topology.
// Operator must set TRUST_PROXY_HOPS to match the actual number of trusted proxy hops
// from client to app in their real deployment. Wrong count can allow IP spoofing.
const trustProxyWarningMessages = [];
if (trustProxyHops === 0) {
  trustProxyWarningMessages.push('WARNING: TRUST_PROXY_HOPS is 0 — proxy trust is disabled; req.ip will be the raw client IP, spoofable via X-Forwarded-For');
} else if (trustProxyHops > 5) {
  trustProxyWarningMessages.push(`WARNING: TRUST_PROXY_HOPS is ${trustProxyHops} — this is unusually high. Verify this matches your actual proxy topology (typically 1-3 hops behind Cloudflare/load balancers).`);
}
// Note: Do NOT hardcode a value here. The env var is operator-controlled after topology verification.
// If no warning was emitted, the configured value is accepted as-is.
if (trustProxyWarningMessages.length > 0) {
  trustProxyWarningMessages.forEach((msg) => logger.warn({ event: 'trust_proxy_startup_warning', message: msg }));
} else {
  logger.info({ event: 'trust_proxy_startup_configured', trustProxyHops }, 'Trust proxy configuration loaded');
}

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    }
  },
  // HSTS: Force HTTPS for 1 year, include subdomains, enable preload
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  // Additional security headers
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: {
    features: {
      camera: [], microphone: [], geolocation: [], payment: []
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  originAgentCluster: true,
  xContentTypeOptions: true,
  xDnsPrefetchControl: { allow: false },
  xDownloadOptions: true,
  xFrameOptions: { action: 'deny' },
  xPermittedCrossDomainPolicies: { permittedPolicies: 'none' },
  xXssProtection: true
}));
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : ['http://localhost:5173'];

// Helper to match origin against allowed list with wildcard subdomain support
const isOriginAllowed = (origin) => {
  if (!origin) return true; // Allow non-browser clients (curl, Postman, server-to-server)

  // Direct match
  if (allowedOrigins.includes(origin)) return true;

  // Wildcard subdomain support (e.g., "*.example.com")
  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.hostname;

    for (const allowed of allowedOrigins) {
      const allowedUrl = new URL(allowed);
      const allowedHost = allowedUrl.hostname;

      // Check for wildcard subdomain
      if (allowedHost.startsWith('*.')) {
        const baseDomain = allowedHost.slice(2);
        if (originHost === baseDomain || originHost.endsWith('.' + baseDomain)) {
          // Ensure protocol matches for security
          if (originUrl.protocol === allowedUrl.protocol) return true;
        }
      }
    }
  } catch {
    // Invalid URL format, deny
  }

  return false;
};

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      const err = new Error('Not allowed by CORS');
      err.status = 403;
      callback(err);
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());

// Logging Middleware
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});
app.use(pinoHttp({ logger, genReqId: (req) => req.id, autoLogging: process.env.NODE_ENV !== 'test' }));

// Global distributed rate limiting. The limiter uses Redis when REDIS_URL is configured.
app.use('/api', globalLimiter);

// CSRF Protection
const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => {
    if (!process.env.CSRF_SECRET) throw new Error('CSRF_SECRET is required');
    return process.env.CSRF_SECRET;
  },
  cookieName: 'x-csrf-token',
  cookieOptions: {
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  },
  size: 64,
  getTokenFromRequest: (req) => req.headers["x-csrf-token"],
  ignoredMethods: ["GET", "HEAD", "OPTIONS"],
  // Bind CSRF token to user session (JWT user ID or IP for anonymous)
  // This prevents token reuse across different user sessions
  getSessionIdentifier: (req) => {
    // Use authenticated user ID if available
    if (req.user?.id) return `user:${req.user.id}`;
    // Fallback to IP for anonymous requests (rate limited anyway)
    return `anon:${req.ip}`;
  },
});

// API-key authentication is applied by protected routes. CSRF remains required for
// browser-cookie requests; API clients may use the explicit API-key route policy.
app.use((req, res, next) => {
  if (req.headers['x-api-key'] && req.path.startsWith('/api/')) return next();
  doubleCsrfProtection(req, res, next);
});

// CSRF Token Route (Frontend needs to fetch this initially)
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: generateCsrfToken(req, res) });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'url-shortener', timestamp: new Date().toISOString() });
});

app.get('/ready', async (req, res) => {
  const mongoReady = mongoose.connection.readyState === 1;
  const { redisStatus } = require('./middleware/rateLimiter');
  const redis = redisStatus();
  const dependencies = {
    mongodb: mongoReady ? 'ok' : 'unavailable',
    redis: !redis.configured ? 'not_configured' : (redis.ready ? 'ok' : 'unavailable')
  };
  const ready = mongoReady && (!redis.configured || redis.ready);
  return res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', dependencies });
});

// MongoDB connection is established at startup
// No per-request middleware needed

// Swagger Configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Ultimate URL Shortener API',
      version: '1.0.0',
      description: 'API documentation for the MERN URL Shortener project.',
    },
    servers: [
      { url: process.env.PUBLIC_API_URL || `http://localhost:${PORT}` }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        }
      }
    }
  },
  apis: ['./routes/*.js'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Routes - API v1 with versioning
const API_VERSION = process.env.API_VERSION || 'v1';
app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/admin`, adminRoutes);
app.use(`/api/${API_VERSION}/bio`, bioRoutes);
app.use(`/api/${API_VERSION}`, urlRoutes);

// Legacy routes for backward compatibility (can be removed after migration period)
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bio', bioRoutes);
app.use('/api', urlRoutes);
app.use('/', urlRoutes);
app.use('/root', urlRoutes);

// Consistent 404 and global error responses
app.use(notFoundHandler);
app.use(errorHandler);

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandled promise rejection');
});
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'uncaught exception');
  process.exit(1);
});

const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;

let server;
if (!isServerless) {
  server = app.listen(PORT, () => {
    logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'Server running');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use by another process. Please close the process using port ${PORT} or change PORT in .env.`);
    } else {
      logger.error({ err }, 'Server listen error');
    }
    process.exit(1);
  });

  const gracefulShutdown = async (signal) => {
    logger.info({ signal }, 'Received shutdown signal, shutting down gracefully');
    if (server) {
      server.close(async () => {
        logger.info('Closed out remaining HTTP connections');
        // Close Redis and EventBus connections if configured
        try {
          const eventBus = require('./utils/eventBus');
          await eventBus.close();
          const { redisClient } = require('./middleware/rateLimiter');
          if (redisClient && redisClient.isOpen) {
            await redisClient.quit();
            logger.info('Redis connection closed');
          }
        } catch (err) {
          logger.error({ err }, 'Error closing Redis/EventBus connections');
        }
        await mongoose.connection.close(false);
        logger.info('MongoDB connection closed');
        process.exit(0);
      });

      // Force exit after 10 seconds if connections refuse to close
      setTimeout(() => {
        logger.fatal('Graceful shutdown timed out, forcing exit');
        process.exit(1);
      }, 10000).unref();
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

module.exports = app;
