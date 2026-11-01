require('dotenv').config();

// Vercel loads this file directly, so production configuration must be loaded here.
const { loadProductionSecrets } = require('./config/secrets');
const { loadEnv } = require('./config/env');

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
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const { doubleCsrf } = require('csrf-csrf');
const morgan = require('morgan');
const pinoHttp = require('pino-http');
const crypto = require('crypto');
const logger = require('./utils/logger');
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

// Security Middlewares
app.use(helmet());
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : ['http://localhost:5173'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || (process.env.NODE_ENV !== 'production' && allowedOrigins.includes('*')) || allowedOrigins.includes(origin)) {
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
  getSessionIdentifier: (req) => "stateless",
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

// Shared MongoDB connection pool for all requests and instances.
app.use(async (req, res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (err) {
    logger.error({ err }, 'MongoDB connection failed');
    const connectionError = new Error('Database unavailable');
    connectionError.statusCode = 503;
    next(connectionError);
  }
});

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

// Routes
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

let server;
if (process.env.NODE_ENV !== 'production') {
  server = app.listen(PORT, () => {
    logger.info({ port: PORT }, 'Server running');
  });

  const gracefulShutdown = () => {
    console.log('Received kill signal, shutting down gracefully');
    if (server) {
      server.close(() => {
        console.log('Closed out remaining connections');
        mongoose.connection.close(false).then(() => {
          console.log('MongoDB connection closed');
          process.exit(0);
        });
      });
    }
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

module.exports = app;
