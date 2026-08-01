'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../../controllers/public.controller');
const notificationController = require('../../controllers/notification.controller');
const validate = require('../../middlewares/validate');
const validation = require('../../validations/public.validation');
const notificationValidation = require('../../validations/notification.validation');
const { publicLimiter } = require('../../middlewares/rate-limit');

/**
 * Нэвтрэхгүйгээр хандах endpoint-ууд — introduction.md §3 (Phase 5)
 *
 * ⚠ Энд нэмэгдсэн ЗАМ БҮР интернэтэд ил болно. `authorize()` байхгүй нь
 * алдаа биш, ЗОРИЛГО — тиймээс шинэ endpoint нэмэхээсээ өмнө хариунд нь
 * ямар нэг хувийн мэдээлэл байгаа эсэхийг `public.service.js`-ийн цагаан
 * жагсаалтаар шалгана.
 *
 * Бүх зам `publicLimiter`-т захирагдана (дугаар дараалан туршихаас).
 */
router.use(publicLimiter);

// §3 — ачаа хайх. Хариу нь төлөв + маскласан утас, үнэ БАЙХГҮЙ.
router.get('/track/:trackingNumber', validate(validation.track), controller.track);

// §3 — утасны дугаараар хайх (ЯГ БҮТЭН тааралт, prefix БИШ — public.service.js-ийг үзнэ үү)
router.get('/track-by-phone/:phone', validate(validation.trackByPhone), controller.trackByPhone);

// §3, roadmap 5.10 — нүүр хуудасны нийтэлсэн үнийн жагсаалт (rate card)
router.get('/pricing', controller.pricing);

// §3, roadmap 5.9/5.10 — Эрээний хаяг, холбоо барих, түгээмэл асуулт
router.get('/content', controller.content);

/**
 * §7, roadmap 6.3 — нэвтрээгүй зочин ч харах идэвхтэй нийтийн зарлал.
 * Хариу цагаан жагсаалттай (`notification.service.js#listPublic`) — зөвхөн
 * title/body/огноо, дотоод ID/илгээсэн ажилтан гарахгүй.
 */
router.get(
  '/notifications',
  validate(notificationValidation.listPublic),
  notificationController.listPublic
);

module.exports = router;
