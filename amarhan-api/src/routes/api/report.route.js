'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../../controllers/report.controller');
const authorize = require('../../middlewares/authorization');
const validate = require('../../middlewares/validate');
const validation = require('../../validations/report.validation');
const Constants = require('../../config/constants');

// §9.1 — Админ бүх салбар, менежер зөвхөн service-ийн шийдсэн өөрийн салбарын тайланг харна.
router.get(
  '/',
  authorize(Constants.ROLE_GROUP.MANAGEMENT),
  validate(validation.summary),
  controller.summary
);

module.exports = router;
