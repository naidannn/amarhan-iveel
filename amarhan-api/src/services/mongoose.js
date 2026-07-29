'use strict';

const config = require('../config');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

mongoose.connection.on('connected', () => {
  logger.info('MongoDB is connected');
});

mongoose.connection.on('error', (err) => {
  logger.error('Could not connect to MongoDB', { error: err.message });
  process.exit(-1);
});

if (config.env === 'development') {
  mongoose.set('debug', true);
}

exports.connect = () => {
  const mongoURI = config.env === 'test' ? config.mongo.testURI : config.mongo.uri;
  mongoose.connect(mongoURI);
  return mongoose.connection;
};

exports.disconnect = () => {
  return mongoose.connection.close();
};
