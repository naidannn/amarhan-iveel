'use strict';

const express = require('express');
const router = express.Router();
const authRouter = require('./auth.route');
const userRouter = require('./user.route');
const branchRouter = require('./branch.route');
const warehouseLocationRouter = require('./warehouse-location.route');
const tariffRouter = require('./tariff.route');
const customerRouter = require('./customer.route');
const auditRouter = require('./audit.route');
const packageRouter = require('./package.route');

// Health check
router.get('/status', (req, res) => {
  res.json({ success: true, data: { status: 'OK' } });
});

// Version 1 API routes
router.use('/v1/auth', authRouter);
router.use('/v1/users', userRouter);

// Phase 1 — домэйны суурь
router.use('/v1/branches', branchRouter);
router.use('/v1/warehouse-locations', warehouseLocationRouter);
router.use('/v1/tariffs', tariffRouter);
router.use('/v1/customers', customerRouter);
router.use('/v1/audit-logs', auditRouter);

// Phase 2 — ачааны модуль (§1)
router.use('/v1/packages', packageRouter);

module.exports = router;
