'use strict';

const express = require('express');
const router = express.Router();
const userController = require('../../controllers/user.controller');
const authorize = require('../../middlewares/authorization');
const validate = require('../../middlewares/validate');
const userValidation = require('../../validations/user.validation');
const Constants = require('../../config/constants');

// Ажилтны эрхийг зөвхөн Админ удирдана (§9.1).
router.use(authorize(Constants.ROLE_GROUP.ADMIN));

router
  .route('/')
  .get(validate(userValidation.listUsers), userController.list)
  .post(validate(userValidation.createUser), userController.create);

router
  .route('/:userId')
  .get(validate(userValidation.getUser), userController.get)
  .put(validate(userValidation.updateUser), userController.update)
  .delete(validate(userValidation.deleteUser), userController.remove);

module.exports = router;
