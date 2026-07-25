require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const { doubleCsrf } = require('csrf-csrf');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const urlRoutes = require('./routes/urlRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const bioRoutes = require('./routes/bioRoutes');
const { errorHandler } = require('./middleware/errorMiddleware');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for accurate client IP behind reverse proxies (Cloudflare, Nginx, Vercel, etc.)
app.set('trust proxy', 1);

// Security Middlewares
app.use(helmet());
const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:5173'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      const err = new Error('Not allowed by CORS');
      err.status = 403;
      callback(err);
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Logging Middleware
app.use(morgan('dev'));

// Global Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, 
  legacyHeaders: false, 
});
app.use('/api', globalLimiter);

// CSRF Protection
const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || 'csrf-super-secret-key',
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

// CSRF Protection (Bypassed for programmatic requests authenticated via x-api-key)
app.use((req, res, next) => {
  if (req.headers['x-api-key']) {
    return next();
  }
  doubleCsrfProtection(req, res, next);
});

// CSRF Token Route (Frontend needs to fetch this initially)
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: generateCsrfToken(req, res) });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/url-shortener')
.then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

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
      { url: `http://localhost:${PORT}` }
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

// Global Error Handler
app.use(errorHandler);

let server;
if (process.env.NODE_ENV !== 'production') {
  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
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
