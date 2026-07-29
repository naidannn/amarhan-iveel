'use strict';

const mongoose = require('./services/mongoose');
const app = require('./services/express');
const logger = require('./utils/logger');

// Start app and connect to database
app.start();
mongoose.connect();

// Graceful shutdown
const shutdown = async signal => {
  logger.info(`${signal} received. Shutting down gracefully...`);

  try {
    await app.stop();
    logger.info('HTTP server closed');

    await mongoose.disconnect();
    logger.info('Database connection closed');

    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown', { error: err.message });
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', reason => {
  logger.error('Unhandled Rejection', { reason: reason?.toString() });
});

process.on('uncaughtException', err => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

module.exports = app;
