'use strict';

const httpStatus = require('http-status');
const settingService = require('../services/setting.service');
const { VALUE_SCHEMAS } = require('../validations/setting.validation');
const APIError = require('../utils/APIError');
const { success } = require('../utils/response');

exports.list = async (req, res, next) => {
  try {
    return success(res, await settingService.getAll());
  } catch (error) {
    next(error);
  }
};

/**
 * Тохиргоо/агуулга шинэчлэх — зөвхөн Админ (§9.1).
 * `settingService.set()` өөрчлөлт бүрийг audit-д бичнэ (BR-38).
 */
exports.update = async (req, res, next) => {
  try {
    const doc = await settingService.set(
      req.params.key,
      validateValue(req.params.key, req.body.value),
      req.user,
      { req }
    );
    return success(res, { key: doc.key, value: doc.value });
  } catch (error) {
    next(error);
  }
};

/**
 * Утгын хэлбэр нь ТҮЛХҮҮРЭЭС хамаардаг тул `validate()` middleware-ийн
 * статик схемээр илэрхийлэх боломжгүй — `params.key` ба `body.value` тусад нь
 * шалгагддаг. Тиймээс энд, service дуудахаас өмнө шалгана.
 */
function validateValue(key, value) {
  const schema = VALUE_SCHEMAS[key];
  if (!schema) return value;

  const { value: cleaned, error } = schema.validate(value, { abortEarly: false });
  if (error) {
    throw new APIError(`«${key}»-ийн утга буруу: ${error.message}`, httpStatus.BAD_REQUEST);
  }
  return cleaned;
}
