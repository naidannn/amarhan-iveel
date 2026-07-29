'use strict';

const express = require('express');
const router = express.Router();
const authRouter = require('./auth.route');
const userRouter = require('./user.route');

// Health check
router.get('/status', (req, res) => {
  res.json({ success: true, data: { status: 'OK' } });
});

// Version 1 API routes
router.use('/v1/auth', authRouter);
router.use('/v1/users', userRouter);

module.exports = router;
