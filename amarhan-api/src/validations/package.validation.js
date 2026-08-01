'use strict';

const Joi = require('joi');
const { PACKAGE_STATUS_LIST, PAYMENT_STATUS_LIST, PACKAGE_STATUS } = require('../config/constants');
const { TRACKING_PATTERN, normalizeTrackingNumber } = require('../domain/tracking-number');

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/);

/**
 * Ачааны дугаар. Нормчлолыг ДОМЭЙН функцээр хийж байгаа шалтгаан: Joi-д
 * дүрмийг дахин бичвэл хоёр газар зөрөх аюултай. Ажилтан "sf 1234 abc" гэж
 * бичсэн ч "SF1234ABC" болж, форматын шалгалт нормчлогдсон утга дээр явна.
 */
const trackingNumber = Joi.string()
  .trim()
  .custom((value, helpers) => {
    try {
      return normalizeTrackingNumber(value);
    } catch {
      return helpers.error('any.invalid');
    }
  })
  .pattern(TRACKING_PATTERN)
  .messages({
    'string.pattern.base':
      'Ачааны дугаар 3–64 тэмдэгт байх ба зөвхөн латин үсэг, тоо, зураас агуулна',
    'any.invalid': 'Ачааны дугаар хоосон байж болохгүй',
  });

// Ажилтан "+976 9911 2233" гэж бичсэн ч ажиллана — нормчлолыг service хийнэ
const phone = Joi.string().trim().min(8).max(20);

const locationCode = Joi.string()
  .uppercase()
  .pattern(/^[A-Za-z]{2}-\d{2}-[A-Za-z]-\d\d$/)
  .messages({ 'string.pattern.base': 'Байршлын кодын формат буруу (жишээ: UB-02-B-15)' });

// 2 орны нарийвчлал (§1.1). Жинлүүр илүү нарийн уншсан ч бид 2 орноор тооцно.
const weightKg = Joi.number().min(0).max(100000).precision(2);
const volumeM3 = Joi.number().min(0).max(10000).precision(4);

const dimensions = Joi.object({
  lengthCm: Joi.number().positive().max(100000).required(),
  widthCm: Joi.number().positive().max(100000).required(),
  heightCm: Joi.number().positive().max(100000).required(),
});

// Мөнгө = бүхэл тоо ₮ (CLAUDE.md §5 дүрэм 2)
const money = Joi.number().integer().min(0).max(1_000_000_000);

const reason = Joi.string().trim().min(3).max(500);

/**
 * Хүчингүй болгохыг `PUT /:id/cancel` гүйцэтгэнэ — эрх ба шалтгаан шаарддаг
 * тусдаа дүрэмтэй (BR-11). Тиймээс төлөв өөрчлөх endpoint-оос хасав.
 */
const assignableStatus = PACKAGE_STATUS_LIST.filter(s => s !== PACKAGE_STATUS.CANCELLED);

/**
 * Ганц ачаа бүртгэх схем — `create` ба олноор бүртгэх `createBulk`-ийн мөр
 * тус бүрт ХОЁУЛАНД адил хэрэглэгдэнэ (доор тайлбарласан).
 */
const createPackageSchema = Joi.object({
  /**
   * BR-45 — "Эрээнд байгаа" (эрт бүртгэл) эсвэл "Бүртгэгдсэн" (одоогийн,
   * Монголд ирсэн үеийн бүртгэл). Ажилтан бүртгэх мөчид ЭНЭ ХОЁРЫН аль
   * нэгийг л сонгоно — бусад төлөв рүү шууд бүртгэх боломжгүй хэвээр.
   */
  status: Joi.string()
    .valid(PACKAGE_STATUS.IN_ERLIAN, PACKAGE_STATUS.REGISTERED)
    .default(PACKAGE_STATUS.REGISTERED),

  trackingNumber: trackingNumber.required(),
  phone: phone.required(),
  // Харилцагч шинээр үүсэх бол нэрийг хамт бүртгэнэ (BR-29)
  customerName: Joi.string().trim().max(100).optional(),

  // Жин/эзлэхүүнээр үнэ бодоход ЗААВАЛ, гараар үнэ заасан үед шаардлагагүй
  // (BR-01a). Нарийн шалгалтыг `resolvePricing()` хийнэ.
  cargoTypeId: objectId.optional(),
  quantity: Joi.number().integer().min(1).max(100000).default(1),

  weightKg: weightKg.optional(),
  volumeM3: volumeM3.optional(),
  dimensions: dimensions.optional(),

  // §1.1 — байршлын код ЗААВАЛ. ID эсвэл кодоор өгнө.
  locationId: objectId.optional(),
  locationCode: locationCode.optional(),

  // Нэг салбарын горимд заавал биш (BR-22a)
  branchId: objectId.optional(),

  arrivedAt: Joi.date().max('now').optional(),
  note: Joi.string().trim().max(1000).allow('', null).optional(),

  /**
   * Үнийн дүн. ХОЁР өөр утга агуулна — аль нь болохыг жин/эзлэхүүн
   * оруулсан эсэх шийднэ (`resolvePricing()`):
   *   жин/эзлэхүүнтэй → тарифын дүнг дарж бичих OVERRIDE (шалтгаан заавал)
   *   жин/эзлэхүүнгүй → ГАРААР заасан үнэ (шалтгаан шаардахгүй, BR-01a)
   *
   * Тиймээс `.with('finalPrice', 'priceOverrideReason')` гэж Joi түвшинд
   * хатуу хамааруулж БОЛОХГҮЙ — гараар заах замыг хааж орхино.
   */
  finalPrice: money.optional(),
  priceOverrideReason: reason.optional(),

  // BR-06 — Менежер/Админ давхардлыг зөвшөөрөх
  allowDuplicate: Joi.boolean().default(false),
  duplicateReason: reason.optional(),
})
  /**
   * Үнийг тодорхойлох ядаж нэг зам байх ёстой (BR-01 эсвэл BR-01a).
   *
   * Байршлын `.or('locationId','locationCode')`-ыг ЗОРИУДААР хассан:
   * Joi-ийн хоёр `.or()` нь ИЖИЛ `object.missing` кодтой тул нэг мессеж
   * хоёуланг дарж, "жин оруулна уу" гэсэн алдаа байршил дутуу үед ч
   * гардаг байсан. Байршлыг `resolveLocation()` тодорхой мессежээр шалгана.
   *
   * `in_erlian` үед энэ шаардлага огт ХАМААРАХГҮЙ (доорх `.when()`) — тэр
   * үед ажилтан жин ч, үнэ ч мэдэхгүй, зөвхөн дугаар+утас л бичдэг (BR-45).
   */
  // `ancestor: 0` ЗААВАЛ: `.when()`-ийг схемийн ROOT дээр өөрөө дуудаж
  // байгаа тул `status` sibling-ийг ӨӨРТӨӨ (нэг түвшин дээш БИШ) хайхыг
  // тодорхой зааж өгөх ёстой — эс тэгвээс Joi "exceeds the schema root"
  // алдаа шидэнэ (Joi 17: `.when()` анхдагчаар нэг түвшин дээш хайдаг).
  .when(Joi.ref('status', { ancestor: 0 }), {
    is: PACKAGE_STATUS.IN_ERLIAN,
    then: Joi.object({
      cargoTypeId: Joi.forbidden(),
      weightKg: Joi.forbidden(),
      volumeM3: Joi.forbidden(),
      dimensions: Joi.forbidden(),
      locationId: Joi.forbidden(),
      locationCode: Joi.forbidden(),
      finalPrice: Joi.forbidden(),
      priceOverrideReason: Joi.forbidden(),
    }),
    otherwise: Joi.object().or('weightKg', 'volumeM3', 'dimensions', 'finalPrice').messages({
      'object.missing': 'Жин, эзлэхүүн эсвэл үнийн дүнгийн ядаж нэгийг оруулна уу',
    }),
  });

module.exports = {
  list: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      // §9.3 — хязгааргүй limit нь 1M мөрийг татах нүх болно
      limit: Joi.number().integer().min(1).max(200).default(50),
      trackingNumber: Joi.string().trim().uppercase().max(64).optional(),
      phone: Joi.string().trim().max(20).optional(),
      customerId: objectId.optional(),
      // Нэг болон олон төлөвөөр шүүх (`status=paid&status=returned`)
      status: Joi.alternatives()
        .try(
          Joi.string().valid(...PACKAGE_STATUS_LIST),
          Joi.array().items(Joi.string().valid(...PACKAGE_STATUS_LIST))
        )
        .optional(),
      paymentStatus: Joi.alternatives()
        .try(
          Joi.string().valid(...PAYMENT_STATUS_LIST),
          Joi.array().items(Joi.string().valid(...PAYMENT_STATUS_LIST))
        )
        .optional(),
      cargoTypeId: objectId.optional(),
      branchId: objectId.optional(),
      locationCode: Joi.string().trim().uppercase().max(12).optional(),
      priceOverridden: Joi.boolean().optional(),
      from: Joi.date().optional(),
      to: Joi.date().optional(),
      sort: Joi.string()
        .valid(
          'createdAt',
          '-createdAt',
          'arrivedAt',
          '-arrivedAt',
          'trackingNumber',
          '-trackingNumber',
          'finalPrice',
          '-finalPrice',
          'status',
          '-status'
        )
        .default('-createdAt'),
    }),
  },

  getOne: {
    params: Joi.object({ packageId: objectId.required() }),
  },

  getByTracking: {
    params: Joi.object({ trackingNumber: trackingNumber.required() }),
  },

  listByPhone: {
    params: Joi.object({ phone: phone.required() }),
    query: Joi.object({
      status: Joi.alternatives()
        .try(
          Joi.string().valid(...PACKAGE_STATUS_LIST),
          Joi.array().items(Joi.string().valid(...PACKAGE_STATUS_LIST))
        )
        .optional(),
    }),
  },

  create: {
    body: createPackageSchema,
  },

  /**
   * Олноор бүртгэх — админ вэбийн олон мөрт форм (Excel/CSV импорт БИШ,
   * `create`-тэй яг ижил бичлэг тус бүрийг илгээнэ). Мөр тус бүр `create`-ийн
   * схемтэй яг ижил шалгагдана — зөвхөн массив болгож ороосон.
   *
   * Тоог 100-аар хязгаарласан шалтгаан: `changeStatusBulk`-ийн адил, нэг HTTP
   * хүсэлт хэт урт ажиллахаас сэргийлнэ. Ачаа бүрийг ТУСДАА зарлана
   * (`package.service.js#createBulk`) — 1 мөрийн алдаа бусдыг унагахгүй.
   */
  createBulk: {
    body: Joi.object({
      packages: Joi.array().items(createPackageSchema).min(1).max(100).required(),
    }),
  },

  /**
   * §1.1, BR-45 — "Эрээнд байгаа" ачаа Монголд ирэхэд ЯГ ТЭР бичлэг дээрээ
   * жин/эзлэхүүн/үнэ/байршил нэмж "Бүртгэгдсэн" болгоно. `create`-ийн
   * жин/үнэ шаардлагатай ижил (`resolveLocation`-ий байршлын шаардлагыг
   * `create`-тэй адил зорилгоор энд ч Joi түвшинд БИШ, service давхаргад
   * тодорхой мессежээр шалгана).
   */
  arrive: {
    params: Joi.object({ packageId: objectId.required() }),
    body: Joi.object({
      cargoTypeId: objectId.optional(),
      quantity: Joi.number().integer().min(1).max(100000).optional(),

      weightKg: weightKg.optional(),
      volumeM3: volumeM3.optional(),
      dimensions: dimensions.optional(),

      locationId: objectId.optional(),
      locationCode: locationCode.optional(),

      arrivedAt: Joi.date().max('now').optional(),
      note: Joi.string().trim().max(1000).allow('', null).optional(),

      finalPrice: money.optional(),
      priceOverrideReason: reason.optional(),
    })
      .or('weightKg', 'volumeM3', 'dimensions', 'finalPrice')
      .messages({
        'object.missing': 'Жин, эзлэхүүн эсвэл үнийн дүнгийн ядаж нэгийг оруулна уу',
      }),
  },

  update: {
    params: Joi.object({ packageId: objectId.required() }),
    body: Joi.object({
      quantity: Joi.number().integer().min(1).max(100000).optional(),
      weightKg: weightKg.allow(null).optional(),
      volumeM3: volumeM3.allow(null).optional(),
      dimensions: dimensions.allow(null).optional(),
      arrivedAt: Joi.date().max('now').optional(),
      note: Joi.string().trim().max(1000).allow('', null).optional(),
    }).min(1),
  },

  overridePrice: {
    params: Joi.object({ packageId: objectId.required() }),
    body: Joi.object({
      price: money.required(),
      // BR-04 — шалтгаан ЗААВАЛ, хоосон байж болохгүй
      reason: reason.required(),
    }),
  },

  changeStatus: {
    params: Joi.object({ packageId: objectId.required() }),
    body: Joi.object({
      status: Joi.string()
        .valid(...assignableStatus)
        .required(),
      reason: reason.optional(),
    }),
  },

  changeStatusBulk: {
    body: Joi.object({
      // §1.9 — 20–40 ачаа нэг дор. 200-аар хязгаарлав: түүнээс дээш бол
      // нэг HTTP хүсэлт хэт урт ажиллаж, ажилтан хүлээнэ.
      packageIds: Joi.array().items(objectId.required()).min(1).max(200).required(),
      status: Joi.string()
        .valid(...assignableStatus)
        .required(),
      reason: reason.optional(),
    }),
  },

  cancel: {
    params: Joi.object({ packageId: objectId.required() }),
    body: Joi.object({ reason: reason.required() }),
  },

  remove: {
    params: Joi.object({ packageId: objectId.required() }),
    body: Joi.object({ reason: reason.required() }),
  },

  moveLocation: {
    params: Joi.object({ packageId: objectId.required() }),
    body: Joi.object({
      locationId: objectId.optional(),
      locationCode: locationCode.optional(),
      reason: reason.optional(),
    }).or('locationId', 'locationCode'),
  },
};
