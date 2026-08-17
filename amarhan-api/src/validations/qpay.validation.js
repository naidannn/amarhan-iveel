'use strict';

const Joi = require('joi');

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/);

/**
 * QPay webhook (roadmap 5.6/5.7) — payload-д ИТГЭХГҮЙ (`payment.service.js`
 * `handleQpayCallback`), тул энд зөвхөн бидний ӨӨРИЙН callback URL-д
 * суулгасан `paymentId`-г эвгүй утгаас хамгаална. QPay бусад ямар ч нэмэлт
 * талбар илгээж болно тул `.unknown(true)` — өөр эндпойнтуудын хатуу
 * `.unknown(false)`-оос ЗОРИУДААР ялгаатай (гадаад үйлчилгээний payload,
 * бидний удирдахгүй формат).
 */
module.exports = {
  callback: {
    query: Joi.object({
      paymentId: objectId.optional(),
    }).unknown(true),
    body: Joi.object().unknown(true).optional(),
  },
};
