'use strict';

const mongoose = require('./services/mongoose');
const app = require('./services/express');
const logger = require('./utils/logger');

// DB бэлэн болсны ДАРАА л хүсэлт хүлээн авна — эс тэгвээс эхний хүсэлтүүд
// холболтгүй query-д буферлэгдэж timeout болно.
mongoose
  .connect()
  .then(() => app.start())
  .catch(err => {
    logger.error('Could not connect to MongoDB', { error: err.message });
    process.exit(1);
  });

// Graceful shutdown
const shutdown = async signal => {
  logger.info(`${signal} received. Shutting down gracefully...`);

  // Keep-alive холболт `server.close`-ыг хязгааргүй хүлээлгэхээс сэргийлнэ
  setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10000).unref();

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
  logger.error('Unhandled Rejection', { reason: reason?.toString(), stack: reason?.stack });
});

process.on('uncaughtException', err => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

module.exports = app;
