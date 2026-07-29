'use strict';

const httpStatus = require('http-status');
const config = require('../config');

exports.handleNotFound = (req, res, next) => {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    message: 'Requested resource not found',
  });
};

exports.handleError = (err, req, res, next) => {
  const status = err.status || httpStatus.INTERNAL_SERVER_ERROR;

  const response = {
    success: false,
    message: err.message || 'Internal Server Error',
  };

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    response.message = 'Invalid ID format';
    return res.status(httpStatus.BAD_REQUEST).json(response);
  }

  // Mongoose ValidationError
  if (err.name === 'ValidationError') {
    response.message = 'Validation Error';
    response.errors = Object.values(err.errors).map((e) => ({
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
