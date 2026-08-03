'use strict';

const Joi = require('joi');
const { EXPENSE_CATEGORY, EXPENSE_CATEGORY_LIST, EXPENSE_STATUS_LIST } = require('../config/constants');

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/);

// Мөнгө = бүхэл тоо ₮ (CLAUDE.md §5 дүрэм 2). Зарлага 0₮ байх нь утгагүй.
const money = Joi.number().integer().min(1).max(1_000_000_000);

const reason = Joi.string().trim().min(3).max(500);

module.exports = {
  list: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      // §9.3 — хязгааргүй limit нь бүх мөрийг татах нүх болно
      limit: Joi.number().integer().min(1).max(200).default(50),
      branchId: objectId.optional(),
      category: Joi.string()
        .valid(...EXPENSE_CATEGORY_LIST)
        .optional(),
      status: Joi.string()
        .valid(...EXPENSE_STATUS_LIST)
        .optional(),
      from: Joi.date().optional(),
      to: Joi.date().optional(),
      sort: Joi.string()
        .valid('date', '-date', 'amount', '-amount', 'createdAt', '-createdAt')
        .default('-date'),
    }),
  },

  summary: {
    query: Joi.object({
      branchId: objectId.optional(),
      category: Joi.string()
        .valid(...EXPENSE_CATEGORY_LIST)
        .optional(),
      from: Joi.date().optional(),
      to: Joi.date().optional(),
    }),
  },

  getOne: {
    params: Joi.object({ expenseId: objectId.required() }),
  },

  create: {
    body: Joi.object({
      amount: money.required(),
      category: Joi.string()
        .valid(...EXPENSE_CATEGORY_LIST)
        .required(),
      // BR-47 — "Бусад" ангилалд нэр заавал, бусад ангилалд бичих боломжгүй
      categoryLabel: Joi.string()
        .trim()
        .min(1)
        .max(100)
        .when('category', {
          is: EXPENSE_CATEGORY.OTHER,
          then: Joi.required(),
          otherwise: Joi.forbidden(),
        }),
      description: Joi.string().trim().min(3).max(500).required(),
      date: Joi.date().max('now').optional(),
      branchId: objectId.optional(),
    }),
  },

  void: {
    params: Joi.object({ expenseId: objectId.required() }),
    // BR-47 — шалтгаан ЗААВАЛ
    body: Joi.object({ reason: reason.required() }),
  },
};
