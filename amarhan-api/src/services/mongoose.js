'use strict';

const config = require('../config');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

mongoose.connection.on('connected', () => {
  logger.info('MongoDB is connected');
});

// Ажиллаж байх үеийн түр зуурын сүлжээний алдаанд процессыг УНТРААХГҮЙ —
// драйвер өөрөө дахин холбогдоно. Анхны холболт амжилтгүй бол `connect()`
// reject хийж, `src/index.js` процессыг зогсооно.
mongoose.connection.on('error', err => {
  logger.error('MongoDB connection error', { error: err.message });
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

if (config.env === 'development') {
  mongoose.set('debug', true);
}

exports.connect = async () => {
  const mongoURI = config.env === 'test' ? config.mongo.testURI : config.mongo.uri;
  await mongoose.connect(mongoURI, config.mongoOptions);
  return mongoose.connection;
};

exports.disconnect = () => {
  return mongoose.connection.close();
};
