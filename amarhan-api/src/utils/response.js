'use strict';

const httpStatus = require('http-status');

exports.success = (res, data, statusCode = httpStatus.OK) => {
  return res.status(statusCode).json({
    success: true,
    data,
  });
};

exports.created = (res, data) => {
  return exports.success(res, data, httpStatus.CREATED);
};

exports.error = (res, message, statusCode = httpStatus.INTERNAL_SERVER_ERROR) => {
  return res.status(statusCode).json({
    success: false,
    message,
  });
};
