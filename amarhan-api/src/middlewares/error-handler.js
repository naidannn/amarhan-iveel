'use strict';

const httpStatus = require('http-status');
const config = require('../config');
const logger = require('../utils/logger');

exports.handleNotFound = (req, res, _next) => {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    message: 'Хүссэн хаяг олдсонгүй',
  });
};

// Express алдааны middleware-ийг 4 аргументын тоогоор таньдаг тул _next-ийг хасч болохгүй
exports.handleError = (err, req, res, _next) => {
  const status = err.status || httpStatus.INTERNAL_SERVER_ERROR;

  // Хүлээгдээгүй алдаа чимээгүй алга болохоос сэргийлнэ.
  // 4xx нь хэрэглэгчийн алдаа тул зөвхөн 5xx-ийг error түвшинд бичнэ.
  if (status >= 500) {
    logger.error('Хүлээгдээгүй алдаа', {
      message: err.message,
      stack: err.stack,
      method: req.method,
      path: req.originalUrl,
      requestId: req.id,
    });
  }

  const response = {
    success: false,
    message: err.message || 'Дотоод алдаа гарлаа',
  };

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    response.message = 'Invalid ID format';
    return res.status(httpStatus.BAD_REQUEST).json(response);
  }

  // Mongoose ValidationError
  if (err.name === 'ValidationError') {
    response.message = 'Validation Error';
    response.errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(httpStatus.BAD_REQUEST).json(response);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    response.message = 'Duplicate entry';
    return res.status(httpStatus.CONFLICT).json(response);
  }

  // Include stack trace in development
  if (config.env === 'development') {
    response.stack = err.stack;
  }

  res.status(status).json(response);
};
