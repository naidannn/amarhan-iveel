'use strict';

const Joi = require('joi');

module.exports = {
  register: {
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(4).max(128).required(),
      firstname: Joi.string().max(50).required(),
      lastname: Joi.string().max(50).required(),
      role: Joi.string().valid('user', 'admin', 'manager', 'senior_manager').default('user'),
    }),
  },

  login: {
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
    }),
  },

  changePassword: {
    body: Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: Joi.string().min(4).max(128).required(),
    }),
  },
};
