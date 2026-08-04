'use strict';

const Joi = require('joi');

module.exports = {
  login: {
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
    }),
  },

  changePassword: {
    body: Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: Joi.string().min(8).max(128).required(),
    }),
  },

  forgotPassword: {
    body: Joi.object({
      email: Joi.string().email().required(),
    }),
  },

  resetPassword: {
    body: Joi.object({
      token: Joi.string().required(),
      newPassword: Joi.string().min(8).max(128).required(),
    }),
  },
};
