'use strict';

const Joi = require('joi');
const { ROLE_LIST, ROLES } = require('../config/constants');

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/);

module.exports = {
  createUser: {
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(8).max(128).required(),
      firstname: Joi.string().max(50).required(),
      lastname: Joi.string().max(50).required(),
      role: Joi.string().valid(...ROLE_LIST).default(ROLES.STAFF),
      status: Joi.string().valid('active', 'deactive').default('active'),
      branchId: objectId.allow(null).optional(),
      username: Joi.string().max(50).optional(),
      thumbnail: Joi.string().uri().optional(),
    }),
  },

  getUser: {
    params: Joi.object({
      userId: objectId.required(),
    }),
  },

  updateUser: {
    params: Joi.object({
      userId: objectId.required(),
    }),
    body: Joi.object({
      email: Joi.string().email().optional(),
      firstname: Joi.string().max(50).optional(),
      lastname: Joi.string().max(50).optional(),
      role: Joi.string().valid(...ROLE_LIST).optional(),
      status: Joi.string().valid('active', 'deactive').optional(),
      branchId: objectId.allow(null).optional(),
      username: Joi.string().max(50).optional(),
      thumbnail: Joi.string().uri().optional(),
    }),
  },

  deleteUser: {
    params: Joi.object({
      userId: objectId.required(),
    }),
  },

  listUsers: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
      search: Joi.string().allow('').optional(),
      role: Joi.string().valid(...ROLE_LIST).optional(),
      status: Joi.string().valid('active', 'deactive').optional(),
    }),
  },
};
