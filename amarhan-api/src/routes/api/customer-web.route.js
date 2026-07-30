'use strict';

const express = require('express');
const router = express.Router();
const authController = require('../../controllers/customer-auth.controller');
const portalController = require('../../controllers/customer-portal.controller');
const authorizeCustomer = require('../../middlewares/authorize-customer');
const validate = require('../../middlewares/validate');
const authValidation = require('../../validations/customer-auth.validation');
const portalValidation = require('../../validations/customer-portal.validation');
const { authLimiter } = require('../../middlewares/rate-limit');

/**
 * Харилцагчийн вэб — introduction.md §3 (Phase 5)
 *
 * ⚠ ЭНЭ ROUTER-Т АЖИЛТНЫ `authorize()` ХЭРЭГЛЭХГҮЙ. Танилт нь
 * `authorizeCustomer()`-оор, `aud: 'customer'` токеноор явна. Хоёрыг
 * холивол ажилтны токеноор харилцагчийн өгөгдөл рүү (эсрэгээр нь ч)
 * орох зам нээгдэнэ (docs/security-and-permissions.md §4).
 *
 * Хамрах хүрээ: харилцагч ЗӨВХӨН өөрийн өгөгдлийг харна. `customerId`
 * ҮРГЭЛЖ токеноос гарна — query/body-гоос ХЭЗЭЭ Ч биш.
 */

// ── Нээлттэй (танилтгүй) ────────────────────────────────────────────────

router.post(
  '/auth/register',
  authLimiter,
  validate(authValidation.register),
  authController.register
);
router.post('/auth/login', authLimiter, validate(authValidation.login), authController.login);

// §3 — Google OAuth. `/google` нь браузераар нээгддэг тул JSON биш redirect.
router.get('/auth/google', authController.googleStart);
router.get('/auth/google/callback', authController.googleCallback);
// Google-ээр орсон шинэ хэрэглэгч утсаа өгч бүртгэлээ дуусгана (BR-26)
router.post(
  '/auth/google/complete',
  authLimiter,
  validate(authValidation.googleComplete),
  authController.googleComplete
);

// ── Танилт шаардсан ─────────────────────────────────────────────────────

router.use(authorizeCustomer());

router.get('/auth/me', authController.me);
router.post('/auth/logout', authController.logout);
router.post(
  '/auth/change-password',
  validate(authValidation.changePassword),
  authController.changePassword
);

router.put('/me', validate(authValidation.updateProfile), authController.updateProfile);
router.put(
  '/me/addresses',
  validate(authValidation.updateAddresses),
  authController.updateAddresses
);

// §3 — өөрийн ачаа, төлбөр, хүргэлт
router.get('/summary', portalController.summary);
router.get('/packages', validate(portalValidation.listPackages), portalController.listPackages);
router.get(
  '/packages/:packageId',
  validate(portalValidation.getPackage),
  portalController.getPackage
);
router.get('/payments', validate(portalValidation.listPayments), portalController.listPayments);
router.get('/invoices', validate(portalValidation.listInvoices), portalController.listInvoices);
router.get(
  '/deliveries',
  validate(portalValidation.listDeliveries),
  portalController.listDeliveries
);

module.exports = router;
