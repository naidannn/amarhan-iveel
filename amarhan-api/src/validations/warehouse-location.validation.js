'use strict';

const Joi = require('joi');

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/);
const locationCode = Joi.string()
  .uppercase()
  .pattern(/^[A-Za-z]{2}-\d{2}-[A-Za-z]-\d\d$/)
  .messages({ 'string.pattern.base': 'Байршлын кодын формат буруу (жишээ: UB-02-B-15)' });

module.exports = {
  list: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(50),
      // Хэсэгчилсэн код (`UB-02`) ч ажиллана
      code: Joi.string().uppercase().max(12).optional(),
      branchId: objectId.optional(),
      room: Joi.string().max(2).optional(),
      shelf: Joi.string().uppercase().length(1).optional(),
      isActive: Joi.boolean().optional(),
      onlyFree: Joi.boolean().optional(),
    }),
  },

  getOne: {
    params: Joi.object({
      locationId: objectId.required(),
    }),
  },

  getByCode: {
    params: Joi.object({
      code: locationCode.required(),
    }),
  },

  create: {
    body: Joi.object({
      // Нэг салбарын горимд заавал биш — заагаагүй бол автоматаар сонгогдоно
      branchId: objectId.optional(),
      // Бүрэн код эсвэл бүрдэл хэсгүүдийн аль нэгийг өгнө
      code: locationCode.optional(),
      room: Joi.number().integer().min(0).max(99).optional(),
      shelf: Joi.string()
        .uppercase()
        .length(1)
        .pattern(/^[A-Za-z]$/)
        .optional(),
      row: Joi.number().integer().min(1).max(9).optional(),
      cell: Joi.number().integer().min(1).max(9).optional(),
      capacityCount: Joi.number().integer().min(0).allow(null).optional(),
      capacityM3: Joi.number().min(0).allow(null).optional(),
    })
      .or('code', 'room')
      .with('room', ['shelf', 'row', 'cell']),
  },

  createShelf: {
    body: Joi.object({
      branchId: objectId.optional(),
      room: Joi.number().integer().min(0).max(99).required(),
      shelf: Joi.string()
        .uppercase()
        .length(1)
        .pattern(/^[A-Za-z]$/)
        .required(),
      rows: Joi.number().integer().min(1).max(9).required(),
      cells: Joi.number().integer().min(1).max(9).required(),
      capacityCount: Joi.number().integer().min(0).allow(null).optional(),
      capacityM3: Joi.number().min(0).allow(null).optional(),
    }),
  },

  update: {
    params: Joi.object({
      locationId: objectId.required(),
    }),
    body: Joi.object({
      capacityCount: Joi.number().integer().min(0).allow(null).optional(),
      capacityM3: Joi.number().min(0).allow(null).optional(),
      isActive: Joi.boolean().optional(),
    }).min(1),
  },

  suggest: {
    query: Joi.object({
      branchId: objectId.optional(),
      room: Joi.string().max(2).optional(),
      shelf: Joi.string().uppercase().length(1).optional(),
    }),
  },
};
