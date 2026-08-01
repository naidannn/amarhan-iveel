'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../../controllers/notification.controller');
const authorize = require('../../middlewares/authorization');
const validate = require('../../middlewares/validate');
const validation = require('../../validations/notification.validation');
const Constants = require('../../config/constants');

/**
 * §7, BR-36 — Мэдэгдэл илгээх/удирдах эрх зөвхөн Админ, Менежерт байна
 * (Ажилтан ✗). Харилцагчийн уншиж буй эндпойнтууд `customer-web.route.js`-д
 * (`/v1/customer/notifications*`, `aud: 'customer'` танилтаар).
 */
router.use(authorize(Constants.ROLE_GROUP.MANAGEMENT));

router.post('/', validate(validation.send), controller.send);
router.get('/', validate(validation.list), controller.list);

module.exports = router;
