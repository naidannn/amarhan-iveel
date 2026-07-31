'use strict';

const Joi = require('joi');

module.exports = {
  track: {
    params: Joi.object({
      // Нормчлолыг `domain/tracking-number.js` хийнэ (§1.3) — энд зөвхөн
      // хэт урт/хоосон утгыг таслана
      trackingNumber: Joi.string().trim().min(3).max(64).required(),
    }),
  },

  trackByPhone: {
    params: Joi.object({
      // Бүтэн нормчлолыг `domain/phone.js` хийнэ — энд зөвхөн хэт урт/хоосон утгыг таслана
      phone: Joi.string().trim().min(4).max(20).required(),
    }),
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(50).default(20),
    }),
  },
};
