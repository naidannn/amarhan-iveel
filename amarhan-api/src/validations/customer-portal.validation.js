'use strict';

const Joi = require('joi');
const {
  PACKAGE_STATUS_LIST,
  PAYMENT_STATUS_LIST,
  INVOICE_STATUS_LIST,
  DELIVERY_STATUS_LIST,
} = require('../config/constants');

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/);

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
};
