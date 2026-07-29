'use strict';

require('dotenv').config();

// Validate required environment variables
const requiredEnvVars = ['PORT', 'APP_SECRET', 'MONGOURI'];
const missing = requiredEnvVars.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

module.exports = {
  port: process.env.PORT || 4000,
  app: process.env.APP || 'amarhan-api',
  env: process.env.NODE_ENV || 'development',
  secret: process.env.APP_SECRET,
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
    : ['http://localhost:3000', 'http://localhost:3500'],
  sessionSecret: process.env.SESSION_SECRET || process.env.APP_SECRET,
  server: {
    googleClientID: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    frontendURL: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  mongo: {
    uri: process.env.MONGOURI,
    testURI: process.env.MONGOTESTURI,
  },
  jwt: {
    // Ажилтны токен — ажлын нэг ээлжийн урт
    staffAudience: 'staff',
    staffExpiresIn: process.env.JWT_STAFF_EXPIRES_IN || '8h',
    // Харилцагчийн токен (Phase 5-д ашиглагдана)
    customerAudience: 'customer',
    customerExpiresIn: process.env.JWT_CUSTOMER_EXPIRES_IN || '30d',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  },
};
