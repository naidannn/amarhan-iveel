'use strict';

const express = require('express');
const router = express.Router();
const authController = require('../../controllers/auth.controller');
const validate = require('../../middlewares/validate');
const authValidation = require('../../validations/auth.validation');
const authorize = require('../../middlewares/authorization');
const { authLimiter } = require('../../middlewares/rate-limit');

// Public routes (with auth rate limiting)
router.post('/register', authLimiter, validate(authValidation.register), authController.register);
router.post('/login', authLimiter, validate(authValidation.login), authController.login);

// Protected routes
router.get('/me', authorize(), authController.me);
router.post('/logout', authorize(), authController.logout);
router.post('/change-password', authorize(), validate(authValidation.changePassword), authController.changePassword);

module.exports = router;
