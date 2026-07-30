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
};
