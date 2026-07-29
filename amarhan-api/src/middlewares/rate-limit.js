'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * Хүсэлтийн хязгаарлалт.
 *
 * ⚠ БИЗНЕСИЙН ХЯЗГААРЛАЛТ: §1.4-ийн дагуу карго өдөрт хэдэн зуу, мянган ачаа
 * бүртгэдэг. Салбарын бүх ажилтан НЭГ гадаад IP-аас ханддаг тул IP-д тулгуурласан
 * хязгаар хэт бага байвал ажлын өдрийн дундуур бүх ажилтныг хааж, бүртгэлийн
 * урсгалыг тасалдуулна. Тиймээс глобал хязгаарыг өгөөмөр (default 1,000 / 15 мин)
 * тавьж, ХОРТ ХЭРЭГЛЭЭНИЙ хамгаалалтыг нэвтрэлтийн endpoint-д (`authLimiter`)
 * хатуу байлгав.
 *
 * Phase 9 (хатууруулалт): хэрэглэгч тус бүрээр (`req.user._id`) тоолох, IP-ээр
 * биш — тэр үед `trust proxy` тохиргоог мөн шалгах шаардлагатай.
 */
const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    message: 'Хүсэлт хэт олон. Хэсэг хугацааны дараа дахин оролдоно уу',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Тест нь ХЭДЭН ЗУУН хүсэлт явуулдаг. Хязгаарыг тестэд үлдээвэл тестийн
  // дараалал өөрчлөгдөх бүрт санамсаргүй 429 гарч, шалтгааныг олоход хүндрэнэ.
  skip: () => config.env === 'test',
});

/**
 * Нэвтрэх/нууц үг сэргээх endpoint — нууц үг тааварлахаас хамгаална.
 * Энэ хязгаар тестэд ч хүчинтэй байх шаардлагагүй тул мөн алгасана.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Нэвтрэх оролдлого хэт олон. Хэсэг хугацааны дараа дахин оролдоно уу',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.env === 'test',
});

module.exports = { globalLimiter, authLimiter };
