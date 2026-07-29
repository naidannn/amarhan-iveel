'use strict';

const Joi = require('joi');

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/);
// Мөнгө үргэлж бүхэл тоо ₮ (docs/data-model.md §0)
const money = Joi.number().integer().min(0);

/**
 * Жингийн шатлал — жижиг илгээмжид тогтмол үнэ.
 * Дараалал/давхцлыг domain/pricing.js-ийн assertValidBrackets нарийн шалгана.
 */
const weightBrackets = Joi.array()
  .items(
    Joi.object({
      maxGrams: Joi.number().integer().min(1).required(),
      price: money.required(),
    })
  )
  .default([]);

const tariffFields = {
  weightBrackets: weightBrackets.optional(),
  pricePerKgAbove: money.required(),
  pricePerM3: money.required(),
  minimumCharge: money.default(0),
};

module.exports = {
  listCargoTypes: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(50),
      search: Joi.string().allow('').optional(),
      isActive: Joi.boolean().optional(),
    }),
  },

  getCargoType: {
    params: Joi.object({
      cargoTypeId: objectId.required(),
    }),
  },

  createCargoType: {
    body: Joi.object({
      code: Joi.string()
        .lowercase()
        .max(50)
        .pattern(/^[a-z0-9_]+$/)
        .required()
        .messages({
          'string.pattern.base': 'Код зөвхөн жижиг үсэг, тоо, доогуур зураас агуулна',
        }),
      name: Joi.string().trim().max(100).required(),
      description: Joi.string().trim().max(500).allow(null, '').optional(),
      isActive: Joi.boolean().default(true),
      // Анхны тариф — ачааны төрөлтэй хамт заавал үүснэ
      ...tariffFields,
    }),
  },

  updateCargoType: {
    params: Joi.object({
      cargoTypeId: objectId.required(),
    }),
    body: Joi.object({
      name: Joi.string().trim().max(100).optional(),
      description: Joi.string().trim().max(500).allow(null, '').optional(),
      isActive: Joi.boolean().optional(),
    }).min(1),
  },

  changeTariff: {
    params: Joi.object({
      cargoTypeId: objectId.required(),
    }),
    body: Joi.object({
      ...tariffFields,
      note: Joi.string().trim().max(500).allow(null, '').optional(),
    }),
  },

  quote: {
    body: Joi.object({
      cargoTypeId: objectId.required(),
      weightKg: Joi.number().min(0).precision(2).allow(null).optional(),
      volumeM3: Joi.number().min(0).precision(4).allow(null).optional(),
      dimensions: Joi.object({
        lengthCm: Joi.number().positive().required(),
        widthCm: Joi.number().positive().required(),
        heightCm: Joi.number().positive().required(),
      }).optional(),
    })
      // §1.1 — жин, эзлэхүүн, хэмжээсийн ядаж нэг нь заавал
      .or('weightKg', 'volumeM3', 'dimensions'),
  },
};
