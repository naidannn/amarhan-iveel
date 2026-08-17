'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../../controllers/qpay.controller');
const validate = require('../../middlewares/validate');
const validation = require('../../validations/qpay.validation');
const { qpayLimiter } = require('../../middlewares/rate-limit');

/**
 * QPay webhook — roadmap 5.6/5.7. ЗОРИУДААР танилтгүй, тусдаа router:
 * `payment.route.js` бүхэлдээ ажилтны `authorize()`-д хаагдсан тул QPay-ийн
 * сервер (staff JWT авчрахгүй) тэнд хандах боломжгүй. `public.route.js`-тэй
 * адилгүй — энэ бол зочны хайлт БИШ, webhook семантик тул тусдаа файлд.
 */
router.use(qpayLimiter);
router.post('/callback', validate(validation.callback), controller.callback);

module.exports = router;
