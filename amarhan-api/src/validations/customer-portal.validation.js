'use strict';

const Joi = require('joi');
const {
  PACKAGE_STATUS_LIST,
  PAYMENT_STATUS_LIST,
  INVOICE_STATUS_LIST,
  DELIVERY_STATUS_LIST,
} = require('../config/constants');
const { TRACKING_PATTERN, normalizeTrackingNumber } = require('../domain/tracking-number');

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/);

/**
 * Ачааны дугаар — `package.validation.js`-тэй ЯГ ижил домэйн функцээр
 * нормчилно (§1.3). Дүрмийг хуулбарлаагүй, зөвхөн ижил функцийг дуудсан тул
 * харилцагчийн бичсэн "sf 1234 abc" ба ажилтны бичсэн нь ИЖИЛ утга болно —
 * эс тэгвээс шингээлт (BR-46) хоёр өөр дугаар гэж үзэж ажиллахгүй.
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
    'any.invalid': 'Ачааны дугаараа оруулна уу',
  });

/**
 * Хуудаслалт — §9.3. `limit` дээд тал нь 100.
 *
 * ⚠ `customerId`, `phone`, `branchId` зэрэг ХАМРАХ ХҮРЭЭ тодорхойлох
 * параметр эдгээр схемд БАЙХГҮЙ бөгөөд байх ч ёсгүй. Хамрах хүрээ нь
 * токеноос гарна (`req.customer._id`) — Joi `.unknown(false)` (default)
 * тул илүү параметр ирвэл хүсэлт 400 болж унана.
 */
const pagination = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
};

module.exports = {
  listPackages: {
    query: Joi.object({
      ...pagination,
      status: Joi.alternatives()
        .try(
          Joi.string().valid(...PACKAGE_STATUS_LIST),
          Joi.array().items(Joi.string().valid(...PACKAGE_STATUS_LIST))
        )
        .optional(),
      paymentStatus: Joi.string()
        .valid(...PAYMENT_STATUS_LIST)
        .optional(),
      trackingNumber: Joi.string().trim().max(64).optional(),
    }),
  },

  getPackage: {
    params: Joi.object({
      packageId: objectId.required(),
    }),
  },

  /**
   * BR-46 — өөрөө ачаа бүртгүүлэх.
   *
   * ⚠ ЭНД ЗӨВХӨН ХАРИЛЦАГЧИЙН МЭДЭХ ЗҮЙЛ БАЙНА. `weightKg`, `finalPrice`,
   * `locationCode`, `phone`, `customerId`, `status` зэрэг талбар байх ЁСГҮЙ:
   *   • жин/үнэ/байршлыг зөвхөн компани хэмжиж тодорхойлно (§1.1) — харилцагч
   *     бичвэл тэр дүн бүртгэлд орох эрсдэлтэй;
   *   • утас/`customerId` нь хамрах хүрээ тодорхойлдог тул ҮРГЭЛЖ токеноос
   *     гарна (дүрэм 14);
   *   • `status`-ыг заавал систем `expected` болгоно (BR-08).
   * Joi анхдагчаар `.unknown(false)` тул илүү талбар ирвэл 400 болж унана.
   */
  registerPackage: {
    body: Joi.object({
      trackingNumber: trackingNumber.required(),
      quantity: Joi.number().integer().min(1).max(1000).default(1),
      // Харилцагчийн өөрийн тэмдэглэл ("улаан цүнх, Taobao") — ачааг таних,
      // ажилтантай ярихад л хэрэглэгдэнэ, үнэд нөлөөлөхгүй.
      note: Joi.string().trim().max(500).allow('', null).optional(),
    }),
  },

  cancelPackage: {
    params: Joi.object({
      packageId: objectId.required(),
    }),
  },

  listPayments: {
    query: Joi.object({ ...pagination }),
  },

  listInvoices: {
    query: Joi.object({
      ...pagination,
      status: Joi.string()
        .valid(...INVOICE_STATUS_LIST)
        .optional(),
    }),
  },

  listDeliveries: {
    query: Joi.object({
      ...pagination,
      status: Joi.string()
        .valid(...DELIVERY_STATUS_LIST)
        .optional(),
    }),
  },

  /**
   * Roadmap 5.8 — харилцагч өөрөө хүргэлт захиалах.
   *
   * ⚠ `customerId`, `fee`, `method`, `branchId`, `driverId` зэрэг талбар
   * БАЙХГҮЙ (дүрэм 14): хамрах хүрээ токеноос гарна, хураамж
   * `DELIVERY_FEE_AMOUNT`-аар тогтмол, төлбөрийн хэлбэр одоохондоо зөвхөн
   * Данс (QPay ⛔ тул сонголт өгөхгүй, backend дангаараа шийднэ).
   */
  createDelivery: {
    body: Joi.object({
      packageIds: Joi.array().items(objectId).min(1).max(50).required(),
      address: Joi.string().trim().min(3).max(500).required(),
      phone: Joi.string()
        .trim()
        .pattern(/^\d{8}$/)
        .optional(),
      note: Joi.string().trim().max(500).allow('', null).optional(),
    }),
  },

  /** BR-21d — «Хүргэлтээ авлаа» товч */
  confirmDeliveryReceived: {
    params: Joi.object({
      deliveryId: objectId.required(),
    }),
  },
};
