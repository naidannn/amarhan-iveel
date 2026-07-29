'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../../controllers/audit.controller');
const authorize = require('../../middlewares/authorization');
const validate = require('../../middlewares/validate');
const validation = require('../../validations/audit.validation');
const Constants = require('../../config/constants');

/**
 * §9.1 — Audit Log харах эрх:
 *   Админ   ✓ (бүх салбар)
 *   Менежер ✓ (зөвхөн өөрийн салбар — service дотор шүүгдэнэ)
 *   Ажилтан ✗
 *
 * Audit Log нь append-only тул үүсгэх/засах/устгах endpoint БАЙХГҮЙ.
 * Бичлэг зөвхөн бусад service-ээс дотооддоо үүснэ.
 */
router.use(authorize(Constants.ROLE_GROUP.MANAGEMENT));

router.get('/', validate(validation.list), controller.list);

module.exports = router;
