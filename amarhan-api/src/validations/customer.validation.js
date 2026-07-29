'use strict';

const Joi = require('joi');
const { LOYALTY_TIER } = require('../config/constants');

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/);

/**
 * Утсыг ЭНД хатуу форматад оруулахгүй — нормчлолыг domain/phone.js хийнэ
 * (BR-27). Joi зөвхөн ерөнхий хэлбэрийг шалгана, ингэснээр "+976 9911-2233"
 * зэрэг бичлэгүүд валидацаас өнгөрч, нормчлогдоно.
 */
const phoneInput = Joi.string().trim().min(8).max(20);

module.exports = {
  list: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(50),
      search: Joi.string().allow('').optional(),
      phone: Joi.string().trim().max(20).optional(),
      loyaltyTier: Joi.string()
        .valid(...Object.values(LOYALTY_TIER))
        .optional(),
      status: Joi.string().valid('active', 'blocked').optional(),
      hasAccount: Joi.boolean().optional(),
    }),
  },

  getOne: {
    params: Joi.object({
      customerId: objectId.required(),
    }),
  },

  getByPhone: {
    params: Joi.object({
      phone: phoneInput.required(),
    }),
  },

  create: {
    body: Joi.object({
      phone: phoneInput.required(),
      name: Joi.string().trim().max(100).allow(null, '').optional(),
      email: Joi.string().email().allow(null, '').optional(),
      note: Joi.string().trim().max(1000).allow(null, '').optional(),
      addresses: Joi.array()
        .items(
          Joi.object({
            label: Joi.string().trim().max(50).optional(),
            address: Joi.string().trim().max(500).required(),
            note: Joi.string().trim().max(200).allow('').optional(),
          })
        )
        .optional(),
    }),
  },

  update: {
    params: Joi.object({
      customerId: objectId.required(),
    }),
    body: Joi.object({
      phone: phoneInput.optional(),
      name: Joi.string().trim().max(100).allow(null, '').optional(),
      email: Joi.string().email().allow(null, '').optional(),
      status: Joi.string().valid('active', 'blocked').optional(),
      phoneVerified: Joi.boolean().optional(),
      note: Joi.string().trim().max(1000).allow(null, '').optional(),
      addresses: Joi.array()
        .items(
          Joi.object({
            label: Joi.string().trim().max(50).optional(),
            address: Joi.string().trim().max(500).required(),
            note: Joi.string().trim().max(200).allow('').optional(),
          })
        )
        .optional(),
    }).min(1),
  },

  adjustLoyalty: {
    params: Joi.object({
      customerId: objectId.required(),
    }),
    body: Joi.object({
      loyaltyTier: Joi.string()
        .valid(...Object.values(LOYALTY_TIER))
        .optional(),
      loyaltyPoints: Joi.number().integer().min(0).optional(),
      // BR-33 — гараар өөрчлөхөд шалтгаан ЗААВАЛ
      reason: Joi.string().trim().min(3).max(500).required(),
    }).or('loyaltyTier', 'loyaltyPoints'),
  },

  history: {
    params: Joi.object({
      customerId: objectId.required(),
    }),
  },
};
