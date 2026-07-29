'use strict';

const Joi = require('joi');

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/);

module.exports = {
  list: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(50),
      search: Joi.string().allow('').optional(),
      isActive: Joi.boolean().optional(),
    }),
  },

  getOne: {
    params: Joi.object({
      branchId: objectId.required(),
    }),
  },

  create: {
    body: Joi.object({
      // BR-22 — байршлын кодын форматтай нийцнэ
      code: Joi.string()
        .uppercase()
        .length(2)
        .pattern(/^[A-Za-z]{2}$/)
        .required()
        .messages({ 'string.pattern.base': 'Салбарын код 2 латин үсэг байх ёстой' }),
      name: Joi.string().trim().max(100).required(),
      country: Joi.string().trim().max(50).allow(null, '').optional(),
      address: Joi.string().trim().max(500).allow(null, '').optional(),
      phone: Joi.string().trim().max(50).allow(null, '').optional(),
      receiverName: Joi.string().trim().max(100).allow(null, '').optional(),
      isActive: Joi.boolean().default(true),
    }),
  },

  update: {
    params: Joi.object({
      branchId: objectId.required(),
    }),
    body: Joi.object({
      name: Joi.string().trim().max(100).optional(),
      country: Joi.string().trim().max(50).allow(null, '').optional(),
      address: Joi.string().trim().max(500).allow(null, '').optional(),
      phone: Joi.string().trim().max(50).allow(null, '').optional(),
      receiverName: Joi.string().trim().max(100).allow(null, '').optional(),
      isActive: Joi.boolean().optional(),
    }).min(1),
  },
};
