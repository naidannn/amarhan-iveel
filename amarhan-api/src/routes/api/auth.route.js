'use strict';

const express = require('express');
const router = express.Router();
const authController = require('../../controllers/auth.controller');
const validate = require('../../middlewares/validate');
const authValidation = require('../../validations/auth.validation');
const authorize = require('../../middlewares/authorization');
const { authLimiter } = require('../../middlewares/rate-limit');

// Нээлттэй бүртгэл ЗӨВХӨН login. Ажилтны бүртгэл нээлттэй байсан нь эрх өөрөө
// өсгөх нүх байсан (хэн ч role: 'admin'-аар бүртгүүлэх боломжтой) тул хаасан.
// Ажилтныг зөвхөн Админ POST /api/v1/users-ээр үүсгэнэ (introduction.md §9.1),
// хамгийн эхний админыг `npm run seed:admin`-аар үүсгэнэ.
router.post('/login', authLimiter, validate(authValidation.login), authController.login);

// Нууц үг сэргээх — танилтгүй, имэйлээр (Resend). `authLimiter`-ийн адил
// хамгаалалт: сэргээх хүсэлт нэвтрэх оролдлогын нэг хэлбэр.
router.post(
  '/forgot-password',
  authLimiter,
  validate(authValidation.forgotPassword),
  authController.forgotPassword
);
router.post(
  '/reset-password',
  authLimiter,
  validate(authValidation.resetPassword),
  authController.resetPassword
);

// Protected routes
router.get('/me', authorize(), authController.me);
router.post('/logout', authorize(), authController.logout);
router.post(
  '/change-password',
  authorize(),
  validate(authValidation.changePassword),
  authController.changePassword
);

module.exports = router;
