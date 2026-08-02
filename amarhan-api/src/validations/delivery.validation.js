'use strict';

const Joi = require('joi');
const { DELIVERY_STATUS, DELIVERY_STATUS_LIST } = require('../config/constants');

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/);

// Мөнгө = бүхэл тоо ₮ (CLAUDE.md §5 дүрэм 2). Хүргэлт үнэгүй байж болно тул 0.
const money = Joi.number().integer().min(0).max(1_000_000_000);

const reason = Joi.string().trim().min(3).max(500);

const phone = Joi.string().trim().min(8).max(20);

const address = Joi.string().trim().min(3).max(500);

/**
 * Ажилтан гараар оноож болох төлөвүүд. `cancelled` ОРОХГҮЙ — цуцлах нь
 * шалтгаан ба өндөр эрх шаардсан тусдаа endpoint (`PUT /:id/cancel`).
 * `received` ОРОХГҮЙ (BR-21d) — зөвхөн харилцагчийн өөрийн порталаас
 * (`POST /customer/deliveries/:id/receive`) гардаг тусдаа зам.
 */
const MANUAL_STATUS_LIST = DELIVERY_STATUS_LIST.filter(
  s => s !== DELIVERY_STATUS.CANCELLED && s !== DELIVERY_STATUS.RECEIVED
);

module.exports = {
  list: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      // §9.3 — хязгааргүй limit нь бүх мөрийг татах нүх болно
      limit: Joi.number().integer().min(1).max(200).default(50),
      customerId: objectId.optional(),
      phone: Joi.string().trim().max(20).optional(),
      deliveryNumber: Joi.string().trim().max(32).optional(),
      packageId: objectId.optional(),
      driverId: objectId.optional(),
      branchId: objectId.optional(),
      status: Joi.alternatives()
        .try(
          Joi.string().valid(...DELIVERY_STATUS_LIST),
          Joi.array().items(Joi.string().valid(...DELIVERY_STATUS_LIST))
        )
        .optional(),
      // §5 — өдрийн маршрут
      scheduledFrom: Joi.date().optional(),
      scheduledTo: Joi.date().optional(),
      from: Joi.date().optional(),
      to: Joi.date().optional(),
      sort: Joi.string()
        .valid(
          'createdAt',
          '-createdAt',
          'scheduledDate',
          '-scheduledDate',
          'status',
          '-status',
          'deliveryNumber',
          '-deliveryNumber'
        )
        .default('-createdAt'),
    }),
  },

  summary: {
    query: Joi.object({
      branchId: objectId.optional(),
      scheduledFrom: Joi.date().optional(),
      scheduledTo: Joi.date().optional(),
    }),
  },

  getOne: {
    params: Joi.object({ deliveryId: objectId.required() }),
  },

  listForPackage: {
    params: Joi.object({ packageId: objectId.required() }),
  },

  deliverableByPhone: {
    params: Joi.object({ phone: phone.required() }),
  },

  create: {
    body: Joi.object({
      // §1.9 — 20–40 ачаа нэг дор. 200-аар хязгаарлав (бусад модультай нийцүүлэв)
      packageIds: Joi.array().items(objectId.required()).min(1).max(200).required(),
      address: address.required(),
      // Хүлээн авагчийн утас — заагаагүй бол харилцагчийнхыг авна
      phone: phone.optional(),
      note: Joi.string().trim().max(500).allow('', null).optional(),

      /**
       * Жолооч — `driverId` (системийн ажилтан) ЭСВЭЛ `driverName` (гэрээт).
       * Аль нь ч заавал биш: маршрут бэлдэх үед жолооч тодорхойгүй байж болно.
       */
      driverId: objectId.allow(null).optional(),
      driverName: Joi.string().trim().max(120).allow('', null).optional(),
      driverPhone: Joi.string().trim().max(20).allow('', null).optional(),

      scheduledDate: Joi.date().allow(null).optional(),
      // Q3 — зөвхөн мэдээлэл, тооцоонд ОРОХГҮЙ (delivery.model.js)
      fee: money.optional(),
    }),
  },

  update: {
    params: Joi.object({ deliveryId: objectId.required() }),
    body: Joi.object({
      address: address.optional(),
      phone: phone.optional(),
      note: Joi.string().trim().max(500).allow('', null).optional(),
      driverId: objectId.allow(null).optional(),
      driverName: Joi.string().trim().max(120).allow('', null).optional(),
      driverPhone: Joi.string().trim().max(20).allow('', null).optional(),
      scheduledDate: Joi.date().allow(null).optional(),
      fee: money.optional(),
    })
      .min(1)
      .messages({ 'object.min': 'Засах талбар заана уу' }),
  },

  changeStatus: {
    params: Joi.object({ deliveryId: objectId.required() }),
    body: Joi.object({
      status: Joi.string()
        .valid(...MANUAL_STATUS_LIST)
        .required(),
      reason: Joi.string().trim().max(500).allow('', null).optional(),
    }),
  },

  changeStatusBulk: {
    body: Joi.object({
      ids: Joi.array().items(objectId.required()).min(1).max(100).required(),
      status: Joi.string()
        .valid(...MANUAL_STATUS_LIST)
        .required(),
      reason: Joi.string().trim().max(500).allow('', null).optional(),
    }),
  },

  cancel: {
    params: Joi.object({ deliveryId: objectId.required() }),
    // Шалтгаан ЗААВАЛ — audit-д бичигдэнэ
    body: Joi.object({ reason: reason.required() }),
  },
};
