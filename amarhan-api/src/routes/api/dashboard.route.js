'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../../controllers/dashboard.controller');
const authorize = require('../../middlewares/authorization');
const validate = require('../../middlewares/validate');
const validation = require('../../validations/dashboard.validation');
const Constants = require('../../config/constants');

// Dashboard нь ачаа, төлбөр, хүргэлтийн нийлмэл дотоод мэдээлэл тул зөвхөн ажилтан ба дээш.
router.get(
  '/',
  authorize(Constants.ROLE_GROUP.STAFF),
  validate(validation.summary),
  controller.summary
);

module.exports = router;
