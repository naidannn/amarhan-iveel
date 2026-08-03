'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../../controllers/expense.controller');
const authorize = require('../../middlewares/authorization');
const validate = require('../../middlewares/validate');
const validation = require('../../validations/expense.validation');
const Constants = require('../../config/constants');

// BR-47 — зарлага бүхэлдээ Менежер/Админ л хандана. Ажилтан огт хандахгүй.
router.use(authorize(Constants.ROLE_GROUP.MANAGEMENT));

router.get('/summary', validate(validation.summary), controller.summary);

router.route('/').get(validate(validation.list), controller.list).post(validate(validation.create), controller.create);

router.get('/:expenseId', validate(validation.getOne), controller.get);

router.put('/:expenseId/void', validate(validation.void), controller.void);

module.exports = router;
