'use strict';

const Joi = require('joi');
const { AUDIT_ACTION_LIST, AUDIT_ENTITY } = require('../config/constants');

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/);

module.exports = {
  list: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(50),
      entity: Joi.string()
        .valid(...Object.values(AUDIT_ENTITY))
        .optional(),
      entityId: objectId.optional(),
      actorId: objectId.optional(),
      action: Joi.string()
        .valid(...AUDIT_ACTION_LIST)
        .optional(),
      from: Joi.date().iso().optional(),
      to: Joi.date().iso().min(Joi.ref('from')).optional(),
    }),
  },
};
