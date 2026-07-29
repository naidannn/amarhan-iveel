'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../../controllers/warehouse-location.controller');
const authorize = require('../../middlewares/authorization');
const validate = require('../../middlewares/validate');
const validation = require('../../validations/warehouse-location.validation');
const Constants = require('../../config/constants');

// Ажилтан ачаа бүртгэхдээ байршил хайх, санал авах шаардлагатай
router.use(authorize(Constants.ROLE_GROUP.STAFF));

// §8 — хоосон нүд санал болгох (BR-23)
router.get('/suggest', validate(validation.suggest), controller.suggest);

// §8 — байршлын кодоор шууд хайх
router.get('/code/:code', validate(validation.getByCode), controller.getByCode);

router
  .route('/')
  .get(validate(validation.list), controller.list)
  // §9.1 — агуулахын бүтэц тохируулах зөвхөн Админ
  .post(authorize(Constants.ROLE_GROUP.ADMIN), validate(validation.create), controller.create);

// Тавиурын бүх нүдийг нэг дор үүсгэх
router.post(
  '/shelf',
  authorize(Constants.ROLE_GROUP.ADMIN),
  validate(validation.createShelf),
  controller.createShelf
);

router
  .route('/:locationId')
  .get(validate(validation.getOne), controller.get)
  .put(authorize(Constants.ROLE_GROUP.ADMIN), validate(validation.update), controller.update);

module.exports = router;
