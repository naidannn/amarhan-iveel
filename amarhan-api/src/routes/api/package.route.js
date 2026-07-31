'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../../controllers/package.controller');
const authorize = require('../../middlewares/authorization');
const validate = require('../../middlewares/validate');
const validation = require('../../validations/package.validation');
const Constants = require('../../config/constants');

/**
 * Ачааны модуль — introduction.md §1
 *
 * §9.1 эрхийн матриц (BR-36). UI-д товч нуух нь ХАМГААЛАЛТ БИШ —
 * дүрэм бүр route түвшинд `authorize(...)`-оор шалгагдана.
 *
 *   Бүртгэх / засах / төлөв өөрчлөх / байршил шилжүүлэх → Ажилтан ба дээш
 *   Хүчингүй болгох                                     → Менежер, Админ
 *   Бүрмөсөн устгах                                     → зөвхөн Админ
 *
 * Үнэ override-ийн эрх нь ХЯЗГААРААС хамаардаг тул route-оор бүдүүн
 * ширхэглэлээр (Ажилтан ба дээш), нарийн дүрмээр (±%) service давхаргад
 * шалгагдана — BR-04.
 */
router.use(authorize(Constants.ROLE_GROUP.STAFF));

// §1.9 — олон ачааны төлөвийг нэг дор өөрчлөх.
// `/:packageId`-аас ӨМНӨ байрлах ёстой, эс тэгвээс "bulk-status" нь ID гэж
// уншигдана.
router.put('/bulk-status', validate(validation.changeStatusBulk), controller.changeStatusBulk);

// §1.3 — ажилтан дугаараа бичихэд аль хэдийн бүртгэгдсэн ачааг шалгах
router.get(
  '/tracking/:trackingNumber',
  validate(validation.getByTracking),
  controller.getByTracking
);

// §1.9 — харилцагчийн бүх ачаа (нэг дор төлбөр авах, хүлээлгэн өгөх)
router.get('/by-phone/:phone', validate(validation.listByPhone), controller.listByPhone);

router
  .route('/')
  .get(validate(validation.list), controller.list)
  .post(validate(validation.create), controller.create);

router
  .route('/:packageId')
  .get(validate(validation.getOne), controller.get)
  .put(validate(validation.update), controller.update)
  // BR-10 — бүрмөсөн устгах: зөвхөн Админ. Нэмэлт нөхцөл (төлбөргүй, 24ц)
  // service давхаргад шалгагдана.
  .delete(authorize(Constants.ROLE_GROUP.ADMIN), validate(validation.remove), controller.remove);

// §1.2 — үнэ override (BR-04)
router.put('/:packageId/price', validate(validation.overridePrice), controller.overridePrice);

// BR-45 — "Эрээнд байгаа" ачаа Монголд ирэхэд ирц гүйцээх (жин/үнэ/байршил)
router.put('/:packageId/arrive', validate(validation.arrive), controller.arrive);

// §1.5 — төлөв өөрчлөх (BR-07, BR-08)
router.put('/:packageId/status', validate(validation.changeStatus), controller.changeStatus);

// §1.6 — хүчингүй болгох (BR-11): Менежер, Админ
router.put(
  '/:packageId/cancel',
  authorize(Constants.ROLE_GROUP.MANAGEMENT),
  validate(validation.cancel),
  controller.cancel
);

// §8 — байршил шилжүүлэх (BR-25)
router.put('/:packageId/location', validate(validation.moveLocation), controller.moveLocation);

module.exports = router;
