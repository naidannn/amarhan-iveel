'use strict';

const path = require('path');
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
const APIError = require('../utils/APIError');
const httpStatus = require('http-status');
require('./passport-setup');

const app = express();

// nginx-ийн ард `req.ip` бодит клиент байх (rate-limit, audit) — config/index.js
app.set('trust proxy', config.trustProxy);

// Request ID for tracing
app.use(requestId);

// Compression
app.use(compression());

// Body parsing (express built-in). Зураг multipart-аар (multer) ирдэг тул JSON-д
// 1mb хангалттай (200 ачааны бөөн бүртгэл ч ~100kb) — 10mb нь нээлттэй
// endpoint-уудад санах ой дүүргэх гадаргуу байсан.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// NoSQL injection sanitization
app.use(sanitize);

// CORS — origins from .env
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (config.corsOrigins.includes(origin)) return callback(null, true);
    // 500 биш 403 — зөвшөөрөгдөөгүй origin бол серверийн алдаа биш
    return callback(new APIError('Not allowed by CORS', httpStatus.FORBIDDEN));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(helmet());

/**
 * Байршуулсан зураг (жишээ: хаяг холбох зааврын thumbnail) — локал диск,
 * `amarhan-api/uploads/` (`middlewares/upload.js`). `helmet`-ийн
 * default `Cross-Origin-Resource-Policy: same-origin` frontend (өөр origin,
 * localhost:3000)-ийг зургийг татахаас сэргийлэх тул энд сулруулна.
 */
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(path.join(__dirname, '../../uploads'))
);

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
  // Express 4-ийн `listen` callback алдаа ХҮЛЭЭН АВДАГГҮЙ — `error` эвентээр барина
  server = app.listen(config.port, () => {
    logger.info(`${config.app} is running on port ${config.port}`);
  });
  server.on('error', err => {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
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
