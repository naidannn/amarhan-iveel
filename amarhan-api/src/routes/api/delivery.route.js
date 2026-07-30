'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../../controllers/delivery.controller');
const authorize = require('../../middlewares/authorization');
const validate = require('../../middlewares/validate');
const validation = require('../../validations/delivery.validation');
const Constants = require('../../config/constants');

/**
 * Хүргэлтийн модуль — introduction.md §5
 *
 * §9.1 эрхийн матриц (BR-36). UI-д товч нуух нь ХАМГААЛАЛТ БИШ.
 *
 *   Хүргэлт үүсгэх / засах / төлөв солих → Ажилтан ба дээш
 *   Хүргэлт ЦУЦЛАХ                        → Менежер, Админ
 *
 * §5.2-ЫН ХААЛТАД ЭРХИЙН ҮЛ ХАМААРАХ ТОХИОЛДОЛ БАЙХГҮЙ: төлбөр дутуу ачааг
 * хүргэлтэнд гаргах нь Админд ч хориотой. Тиймээс энд «өндөр эрхтэй бол
 * тойрно» гэсэн route ЗОРИУД байхгүй — шалгалт `delivery-state.js`-ийн
 * guard-д, эрхээс ХАМААРАЛГҮЙ байрлана.
 */
router.use(authorize(Constants.ROLE_GROUP.STAFF));

// `/:deliveryId`-аас ӨМНӨ байх ёстой, эс тэгвээс ID гэж уншигдана
router.get('/summary', validate(validation.summary), controller.summary);

// §5 — хүргэлт үүсгэхийн ӨМНӨХ дэлгэц: утсаар хүргэх боломжтой ачаа
router.get(
  '/deliverable/:phone',
  validate(validation.deliverableByPhone),
  controller.deliverableByPhone
);

// Ачаа ямар хүргэлтүүдэд орсон — ачааны дэлгэрэнгүй хуудсанд
router.get('/package/:packageId', validate(validation.listForPackage), controller.listForPackage);

// §5 — өдрийн маршрутыг нэг дор гаргах
router.put('/bulk/status', validate(validation.changeStatusBulk), controller.changeStatusBulk);

router
  .route('/')
  .get(validate(validation.list), controller.list)
  .post(validate(validation.create), controller.create);

router
  .route('/:deliveryId')
  .get(validate(validation.getOne), controller.get)
  .put(validate(validation.update), controller.update);

// BR-21 — төлөв өөрчлөх ганц зам
router.put('/:deliveryId/status', validate(validation.changeStatus), controller.changeStatus);

// Устгахгүй, цуцална (CLAUDE.md §5 дүрэм 4). Менежер, Админ.
router.put(
  '/:deliveryId/cancel',
  authorize(Constants.ROLE_GROUP.MANAGEMENT),
  validate(validation.cancel),
  controller.cancel
);

module.exports = router;
