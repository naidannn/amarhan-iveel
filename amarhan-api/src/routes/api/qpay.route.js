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
 *
 * QPay бодит production-д callback-аа **GET**-ээр (`?paymentId=...&qpay_
 * payment_id=...` query) илгээдэг нь баталгаажсан (2026-08-17, `pm2 logs
 * iveelt-api`-с олдсон 404-үүд). Баримт бичигт заримдаа POST гэж бичсэн ч
 * бодит серверийн зан төлөвт итгэнэ — аль аргаар ирсэн ч адилхан боловсруулна.
 */
router.use(qpayLimiter);
router.get('/callback', validate(validation.callback), controller.callback);
router.post('/callback', validate(validation.callback), controller.callback);

module.exports = router;
