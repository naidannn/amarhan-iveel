'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../../controllers/tariff.controller');
const authorize = require('../../middlewares/authorization');
const validate = require('../../middlewares/validate');
const validation = require('../../validations/tariff.validation');
const Constants = require('../../config/constants');

// Ажилтан ачаа бүртгэхдээ төрөл сонгож, үнэ харах шаардлагатай
router.use(authorize(Constants.ROLE_GROUP.STAFF));

// §1.2 — ачаа бүртгэхийн өмнө үнийг урьдчилан харах
router.post('/quote', validate(validation.quote), controller.quote);

router.get('/active', controller.listActiveTariffs);

router
  .route('/cargo-types')
  .get(validate(validation.listCargoTypes), controller.listCargoTypes)
  // §9.1 — тарифын үнэ тохируулах ЗӨВХӨН Админ (санхүүд шууд нөлөөлнө)
  .post(
    authorize(Constants.ROLE_GROUP.ADMIN),
    validate(validation.createCargoType),
    controller.createCargoType
  );

router
  .route('/cargo-types/:cargoTypeId')
  .get(validate(validation.getCargoType), controller.getCargoType)
  .put(
    authorize(Constants.ROLE_GROUP.ADMIN),
    validate(validation.updateCargoType),
    controller.updateCargoType
  );

router
  .route('/cargo-types/:cargoTypeId/tariff')
  .get(validate(validation.getCargoType), controller.listTariffHistory)
  .post(
    authorize(Constants.ROLE_GROUP.ADMIN),
    validate(validation.changeTariff),
    controller.changeTariff
  );

module.exports = router;
