'use strict';

const httpStatus = require('http-status');

class APIError extends Error {
  constructor(message, status = httpStatus.INTERNAL_SERVER_ERROR) {
    super(message);
    this.name = 'APIError';
    this.status = status;
  }
}

module.exports = APIError;
