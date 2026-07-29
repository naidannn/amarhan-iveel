'use strict';

const config = require('../config');

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const currentLevel =
  config.env === 'production' ? 'info' : config.env === 'test' ? 'error' : 'debug';

function shouldLog(level) {
  return LOG_LEVELS[level] <= LOG_LEVELS[currentLevel];
}

function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  const base = { timestamp, level, message };
  if (meta && Object.keys(meta).length > 0) {
    base.meta = meta;
  }
  return config.env === 'production' ? JSON.stringify(base) : `[${timestamp}] ${level.toUpperCase()}: ${message}${meta ? ' ' + JSON.stringify(meta) : ''}`;
}

const logger = {
  error(message, meta = {}) {
    if (shouldLog('error')) console.error(formatMessage('error', message, meta));
  },
  warn(message, meta = {}) {
    if (shouldLog('warn')) console.warn(formatMessage('warn', message, meta));
  },
  info(message, meta = {}) {
    if (shouldLog('info')) console.log(formatMessage('info', message, meta));
  },
  debug(message, meta = {}) {
    if (shouldLog('debug')) console.log(formatMessage('debug', message, meta));
  },
};

module.exports = logger;
