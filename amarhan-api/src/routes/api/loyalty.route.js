'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../../controllers/loyalty.controller');
const authorize = require('../../middlewares/authorization');
const Constants = require('../../config/constants');

/**
 * Урамшууллын хөтөлбөрийн самбар — §4, §6.
 *
 * Эргэлтэд буй кредит бол компанийн ӨР (харилцагч хүссэн үедээ ачааны
 * төлбөрт хэрэглэнэ) — санхүүгийн мэдээлэл тул Менежер/Админ л харна.
 * Хөтөлбөрийн тохиргоог засах нь `PUT /v1/settings/loyalty.program` (Админ).
 */
router.get('/stats', authorize(Constants.ROLE_GROUP.MANAGEMENT), controller.stats);

module.exports = router;
