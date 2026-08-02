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
const paymentRouter = require('./payment.route');
const deliveryRouter = require('./delivery.route');
const settingRouter = require('./setting.route');
const customerWebRouter = require('./customer-web.route');
const publicRouter = require('./public.route');
const dashboardRouter = require('./dashboard.route');
const reportRouter = require('./report.route');
const notificationRouter = require('./notification.route');
const uploadRouter = require('./upload.route');

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

// Хяналтын самбар — нэг хүсэлтээр KPI, төлөв, график, өнөөдрийн хүргэлт.
router.use('/v1/dashboard', dashboardRouter);

// Тайлан — кэштэй aggregate endpoint. Менежерийн салбарын хамрах хүрээг service шийднэ.
router.use('/v1/reports', reportRouter);

// Phase 3 — төлбөрийн модуль (§1.8, §2). Нэхэмжлэх нь `/payments/invoices`-д
// байрлана: тэр нь бие даасан объект БИШ, төлбөр авах урсгалын хэсэг (§2.3).
router.use('/v1/payments', paymentRouter);

// Phase 4 — хүргэлтийн модуль (§5). Төлбөрөөс ХАМААРНА: §5.2-ын хаалт нь
// ачааны үлдэгдлийг уншиж шалгадаг.
router.use('/v1/deliveries', deliveryRouter);

// Phase 5 — тохиргоо ба статик агуулга. Унших: ажилтан, засах: Админ (§9.1).
router.use('/v1/settings', settingRouter);

// Статик агуулгын зураг (жишээ: хаяг холбох зааврын thumbnail) upload — зөвхөн Админ.
router.use('/v1/uploads', uploadRouter);

// Phase 6 — Мэдэгдэл (§7). Илгээх/удирдах эрх зөвхөн Админ, Менежерт (BR-36).
// Харилцагчийн уншиж буй хэсэг `/v1/customer/notifications*`-д (доор).
router.use('/v1/notifications', notificationRouter);

/**
 * Phase 5 — ХАРИЛЦАГЧИЙН вэб (§3).
 *
 * `/v1/customer` (ганц тоо) нь ХАРИЛЦАГЧ ӨӨРӨӨ ханддаг, `aud: 'customer'`
 * токенээр хамгаалагдсан хэсэг. `/v1/customers` (олон тоо) нь АЖИЛТАН
 * харилцагчийг удирддаг, `aud: 'staff'` хэсэг — хоёулаа зориуд ӨӨР
 * танилтын гинжтэй. Нэрийн ялгаа нь бага тул route нэмэхдээ алийг нь
 * өргөтгөж байгаагаа шалгана.
 */
router.use('/v1/customer', customerWebRouter);

// Phase 5 — нэвтрэхгүйгээр: ачаа хайх, статик агуулга (§3).
router.use('/v1/public', publicRouter);

module.exports = router;
