'use strict';

const config = require('../config');
const express = require('express');
const morgan = require('morgan');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const errorHandler = require('../middlewares/error-handler');
const { globalLimiter } = require('../middlewares/rate-limit');
const requestId = require('../middlewares/request-id');
const sanitize = require('../middlewares/sanitize');
const apiRouter = require('../routes/api');
const passport = require('passport');
const passportJwt = require('../services/passport');
const logger = require('../utils/logger');
require('./passport-setup');

const app = express();

// Request ID for tracing
app.use(requestId);

// Compression
app.use(compression());

// Body parsing (express built-in)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// NoSQL injection sanitization
app.use(sanitize);

// CORS — origins from .env
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (config.corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(helmet());

// Rate limiting
app.use(globalLimiter);

// Logging
if (config.env !== 'test') app.use(morgan('combined'));

/**
 * Passport — SESSION БАЙХГҮЙ.
 *
 * Танилт бүхэлдээ JWT дээр тогтоно (ажилтан `aud: staff`, харилцагч
 * `aud: customer`). Boilerplate-ийн `express-session` нь ямар ч урсгалд
 * ашиглагдахаа больсон: Google OAuth `session: false`-оор ажиллана.
 * Хэрэглэгдэхгүй session нь production-д санах ой идэх MemoryStore үлдээж,
 * CSRF-ийн гадаргууг ч нэмнэ (docs/security-and-permissions.md §6).
 */
app.use(passport.initialize());
passport.use('jwt', passportJwt.jwt);
passport.use('jwt-customer', passportJwt.customerJwt);

// Routes
app.use('/api', apiRouter);

// Error handling
app.use(errorHandler.handleNotFound);
app.use(errorHandler.handleError);

let server;

exports.start = () => {
  server = app.listen(config.port, err => {
    if (err) {
      logger.error('Failed to start server', { error: err.message });
      process.exit(-1);
    }
    logger.info(`${config.app} is running on port ${config.port}`);
  });
  return server;
};

exports.stop = () => {
  if (server) {
    return new Promise(resolve => {
      server.close(resolve);
    });
  }
};

exports.app = app;
