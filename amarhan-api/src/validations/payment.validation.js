'use strict';

const Joi = require('joi');
const {
  PAYMENT_METHOD_LIST,
  PAYMENT_RECORD_STATUS_LIST,
  INVOICE_STATUS_LIST,
} = require('../config/constants');

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/);

// Мөнгө = бүхэл тоо ₮ (CLAUDE.md §5 дүрэм 2). Төлбөр 0₮ байх нь утгагүй.
const money = Joi.number().integer().min(1).max(1_000_000_000);

const reason = Joi.string().trim().min(3).max(500);

const phone = Joi.string().trim().min(8).max(20);

module.exports = {
  // ── Төлбөр ────────────────────────────────────────────────────────────
  list: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      // §9.3 — хязгааргүй limit нь бүх мөрийг татах нүх болно
      limit: Joi.number().integer().min(1).max(200).default(50),
      customerId: objectId.optional(),
      phone: Joi.string().trim().max(20).optional(),
      packageId: objectId.optional(),
      invoiceId: objectId.optional(),
      receivedBy: objectId.optional(),
      branchId: objectId.optional(),
      method: Joi.alternatives()
        .try(
          Joi.string().valid(...PAYMENT_METHOD_LIST),
          Joi.array().items(Joi.string().valid(...PAYMENT_METHOD_LIST))
        )
        .optional(),
      status: Joi.alternatives()
        .try(
          Joi.string().valid(...PAYMENT_RECORD_STATUS_LIST),
          Joi.array().items(Joi.string().valid(...PAYMENT_RECORD_STATUS_LIST))
        )
        .optional(),
      from: Joi.date().optional(),
      to: Joi.date().optional(),
      sort: Joi.string()
        .valid('createdAt', '-createdAt', 'amount', '-amount', 'method', '-method')
        .default('-createdAt'),
    }),
  },

  summary: {
    query: Joi.object({
      branchId: objectId.optional(),
      from: Joi.date().optional(),
      to: Joi.date().optional(),
    }),
  },

  getOne: {
    params: Joi.object({ paymentId: objectId.required() }),
  },

  listForPackage: {
    params: Joi.object({ packageId: objectId.required() }),
  },

  create: {
    body: Joi.object({
      amount: money.required(),
      method: Joi.string()
        .valid(...PAYMENT_METHOD_LIST)
        .required(),

      /**
       * ГУРВАН оролтын хэлбэр — ядаж нэг нь заавал (доорх `.or()`):
       *   `invoiceId`   — нэхэмжлэхийн ачаанууд дунд пропорциональ (§2.3)
       *   `packageIds`  — нэхэмжлэхгүйгээр шууд, мөн пропорциональ
       *   `allocations` — ажилтан ачаа тус бүрийн дүнг ГАРААР заасан
       *
       * Дүнгийн нарийн шалгалтыг `domain/allocation.js` хийнэ — тэр нь
       * `Σ allocations === amount` тогтмолыг хариуцна (BR-17). Joi-д
       * хуулбарлавал хоёр газар зөрнө.
       */
      invoiceId: objectId.optional(),
      packageIds: Joi.array().items(objectId.required()).min(1).max(200).optional(),
      allocations: Joi.array()
        .items(
          Joi.object({
            packageId: objectId.required(),
            amount: money.required(),
          })
        )
        .min(1)
        .max(200)
        .optional(),

      // Заавал биш нэмэлт хамгаалалт: ачаа энэ утасны харилцагчид харьяалагдах
      // эсэхийг service шалгана
      phone: phone.optional(),
      note: Joi.string().trim().max(500).allow('', null).optional(),
    })
      .or('invoiceId', 'packageIds', 'allocations')
      .messages({
        'object.missing': 'Нэхэмжлэх, ачаа эсвэл хуваарилалтын ядаж нэгийг заана уу',
      }),
  },

  void: {
    params: Joi.object({ paymentId: objectId.required() }),
    // BR-18 — шалтгаан ЗААВАЛ
    body: Joi.object({ reason: reason.required() }),
  },

  // ── Нэхэмжлэх (§2.3) ──────────────────────────────────────────────────
  listInvoices: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(200).default(50),
      customerId: objectId.optional(),
      phone: Joi.string().trim().max(20).optional(),
      invoiceNumber: Joi.string().trim().max(32).optional(),
      branchId: objectId.optional(),
      status: Joi.alternatives()
        .try(
          Joi.string().valid(...INVOICE_STATUS_LIST),
          Joi.array().items(Joi.string().valid(...INVOICE_STATUS_LIST))
        )
        .optional(),
      from: Joi.date().optional(),
      to: Joi.date().optional(),
      sort: Joi.string()
        .valid(
          'createdAt',
          '-createdAt',
          'totalAmount',
          '-totalAmount',
          'invoiceNumber',
          '-invoiceNumber'
        )
        .default('-createdAt'),
    }),
  },

  getInvoice: {
    params: Joi.object({ invoiceId: objectId.required() }),
  },

  createInvoice: {
    body: Joi.object({
      // §1.9 — 20–40 ачаа нэг дор. 200-аар хязгаарлав (package.validation-той нийцүүлэв)
      packageIds: Joi.array().items(objectId.required()).min(1).max(200).required(),
      branchId: objectId.optional(),
    }),
  },

  cancelInvoice: {
    params: Joi.object({ invoiceId: objectId.required() }),
    body: Joi.object({ reason: reason.required() }),
  },

  payableByPhone: {
    params: Joi.object({ phone: phone.required() }),
  },
};
