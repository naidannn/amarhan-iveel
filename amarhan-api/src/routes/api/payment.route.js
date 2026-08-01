'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../../controllers/payment.controller');
const authorize = require('../../middlewares/authorization');
const validate = require('../../middlewares/validate');
const validation = require('../../validations/payment.validation');
const Constants = require('../../config/constants');

/**
 * Төлбөрийн модуль — introduction.md §1.8, §2
 *
 * §9.1 эрхийн матриц (BR-36). UI-д товч нуух нь ХАМГААЛАЛТ БИШ.
 *
 *   Төлбөр бүртгэх / нэхэмжлэх үүсгэх / харах → Ажилтан ба дээш
 *   Төлбөр ХҮЧИНГҮЙ болгох                    → Менежер, Админ
 *   Нэхэмжлэх хүчингүй болгох                 → Менежер, Админ
 *
 * ЯАГААД ХҮЧИНГҮЙ БОЛГОХ НЬ ӨНДӨР ЭРХТЭЙ: төлбөрийг хүчингүй болгох нь
 * ачааны үлдэгдлийг ӨСГӨНӨ, өөрөөр хэлбэл орсон мөнгийг "байхгүй" болгоно.
 * Ажилтан өөрөө хийж чадвал кассын дутагдлыг нуух зам болно.
 */
router.use(authorize(Constants.ROLE_GROUP.STAFF));

// ── Нэгтгэсэн нэхэмжлэх (§2.3) ────────────────────────────────────────────
// `/invoices/...` нь `/:paymentId`-аас ӨМНӨ байх шаардлагагүй (тусдаа замууд),
// гэхдээ уншихад ойлгомжтой байхын тулд дээр байрлуулав.

router
  .route('/invoices')
  .get(validate(validation.listInvoices), controller.listInvoices)
  .post(validate(validation.createInvoice), controller.createInvoice);

// §2.3 — нэхэмжлэх үүсгэхийн ӨМНӨХ дэлгэц: утсаар төлбөр хүлээгдэж буй ачаа
router.get(
  '/invoices/payable/:phone',
  validate(validation.payableByPhone),
  controller.payableByPhone
);

router.get('/invoices/:invoiceId', validate(validation.getInvoice), controller.getInvoice);

router.put(
  '/invoices/:invoiceId/cancel',
  authorize(Constants.ROLE_GROUP.MANAGEMENT),
  validate(validation.cancelInvoice),
  controller.cancelInvoice
);

// ── Төлбөр (§1.8, §2.2) ───────────────────────────────────────────────────

// §2.2 — жагсаалтын дээрх нийлбэрүүд (өдрийн касс тулгах).
// `/:paymentId`-аас ӨМНӨ байх ёстой, эс тэгвээс "summary" нь ID гэж уншигдана.
router.get('/summary', validate(validation.summary), controller.summary);

// Ачаанд орсон төлбөрүүд — ачааны дэлгэрэнгүй хуудсанд
router.get('/package/:packageId', validate(validation.listForPackage), controller.listForPackage);

router
  .route('/')
  .get(validate(validation.list), controller.list)
  .post(validate(validation.create), controller.create);

router.get('/:paymentId', validate(validation.getOne), controller.get);

// BR-18 — устгахгүй, хүчингүй болгоно. Менежер, Админ.
router.put(
  '/:paymentId/void',
  authorize(Constants.ROLE_GROUP.MANAGEMENT),
  validate(validation.void),
  controller.void
);

/**
 * Roadmap 5.8 — харилцагчийн банкны шилжүүлэг (`pending`) бодитоор ирснийг
 * баталгаажуулна. §9.1-д "Төлбөр бүртгэх" Ажилтанд байгаатай ижил эрхийн
 * түвшин — Менежментийн тусгай эрх шаардахгүй (татгалзах/`void` л өндөр эрхтэй).
 */
router.put('/:paymentId/confirm', validate(validation.confirm), controller.confirm);

module.exports = router;
