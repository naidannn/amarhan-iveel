'use strict';

const express = require('express');
const router = express.Router();
const branchController = require('../../controllers/branch.controller');
const authorize = require('../../middlewares/authorization');
const validate = require('../../middlewares/validate');
const branchValidation = require('../../validations/branch.validation');
const Constants = require('../../config/constants');

// Салбарын жагсаалтыг бүх ажилтан харна (ачаа бүртгэхэд хэрэгтэй)
router.use(authorize(Constants.ROLE_GROUP.STAFF));

router.get('/active', branchController.listActive);

router
  .route('/')
  .get(validate(branchValidation.list), branchController.list)
  // §9.1 — салбар үүсгэх/засах зөвхөн Админ
  .post(
    authorize(Constants.ROLE_GROUP.ADMIN),
    validate(branchValidation.create),
    branchController.create
  );

router
  .route('/:branchId')
  .get(validate(branchValidation.getOne), branchController.get)
  .put(
    authorize(Constants.ROLE_GROUP.ADMIN),
    validate(branchValidation.update),
    branchController.update
  );

module.exports = router;
