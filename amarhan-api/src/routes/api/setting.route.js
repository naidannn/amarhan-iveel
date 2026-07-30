'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../../controllers/setting.controller');
const authorize = require('../../middlewares/authorization');
const validate = require('../../middlewares/validate');
const validation = require('../../validations/setting.validation');
const Constants = require('../../config/constants');

/**
 * Системийн тохиргоо ба статик агуулга — §9.1, roadmap 5.10
 *
 * Уншихыг ажилтанд нээв: тарифын override хязгаар, устгах цонх зэргийг UI-д
 * харуулах шаардлагатай. ЗАСАХ нь зөвхөн Админ — эдгээр нь бизнесийн
 * шийдвэрийн тоо (§6) бөгөөд өөрчлөлт бүр audit-д бичигдэнэ (BR-38).
 */
router.get('/', authorize(Constants.ROLE_GROUP.STAFF), controller.list);

router.put(
  '/:key',
  authorize(Constants.ROLE_GROUP.ADMIN),
  validate(validation.update),
  controller.update
);

module.exports = router;
