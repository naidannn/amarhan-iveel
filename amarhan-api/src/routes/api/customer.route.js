'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../../controllers/customer.controller');
const authorize = require('../../middlewares/authorization');
const validate = require('../../middlewares/validate');
const validation = require('../../validations/customer.validation');
const Constants = require('../../config/constants');

// Ажилтан ачаа бүртгэхдээ харилцагчийг утсаар хайх шаардлагатай (BR-26)
router.use(authorize(Constants.ROLE_GROUP.STAFF));

router.get('/phone/:phone', validate(validation.getByPhone), controller.getByPhone);

router
  .route('/')
  .get(validate(validation.list), controller.list)
  .post(validate(validation.create), controller.create);

router
  .route('/:customerId')
  .get(validate(validation.getOne), controller.get)
  .put(validate(validation.update), controller.update)
  // Харилцагчийн бүрмөсөн устгах эрх зөвхөн Админд байна.
  .delete(authorize(Constants.ROLE_GROUP.ADMIN), validate(validation.getOne), controller.remove);

// §9.2 — харилцагчийн өөрчлөлтийн түүх. Ажилтан audit харахгүй (§9.1)
router.get(
  '/:customerId/history',
  authorize(Constants.ROLE_GROUP.MANAGEMENT),
  validate(validation.history),
  controller.history
);

// BR-33 — урамшуулал гараар өөрчлөх зөвхөн Админ (service дотор дахин шалгана)
router.post(
  '/:customerId/loyalty',
  authorize(Constants.ROLE_GROUP.ADMIN),
  validate(validation.adjustLoyalty),
  controller.adjustLoyalty
);

module.exports = router;
