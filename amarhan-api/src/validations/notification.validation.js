'use strict';

const Joi = require('joi');

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/);

const pagination = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
};

module.exports = {
  /** §7, BR-36 — Админ/Менежер бүх харилцагчид нийтийн зарлал илгээнэ */
  send: {
    body: Joi.object({
      title: Joi.string().trim().min(1).max(200).required(),
      body: Joi.string().trim().min(1).max(2000).required(),
      expiresAt: Joi.date().greater('now').allow(null).optional(),
    }),
  },

  list: {
    query: Joi.object({ ...pagination }),
  },

  customerList: {
    query: Joi.object({ ...pagination }),
  },

  /** §7, roadmap 6.3 — нэвтрээгүй зочны мэдэгдлийн хуудас */
  listPublic: {
    query: Joi.object({ ...pagination }),
  },

  markRead: {
    params: Joi.object({
      id: objectId.required(),
    }),
  },
};
