'use strict';

const Joi = require('joi');

module.exports = {
  summary: {
    // Dashboard-ын хугацаа, салбарыг client сонгодоггүй: branch scope нь JWT-ээс,
    // 30 хоногийн цонх нь server-ээс тодорхойлогдоно. Ингэснээр үнэтэй query
    // дураар өргөсөх болон салбарын эрх нээгдэх эрсдэлгүй.
    query: Joi.object({}),
  },
};
