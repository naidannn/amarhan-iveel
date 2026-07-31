'use strict';

const Joi = require('joi');

module.exports = {
  summary: {
    // Хугацаа client-ээс дур мэдэн уртсахгүй. 12 сар бол эхний ээлжийн хамгийн урт цонх.
    query: Joi.object({
      period: Joi.string().valid('7d', '30d', '12m').default('30d'),
    }),
  },
};
