'use strict';

const httpStatus = require('http-status');
const config = require('../config');
const APIError = require('../utils/APIError');
const { ERROR_CODE } = require('../config/constants');

/**
 * BR-28 — утас нь баталгаажаагүй харилцагч ачаа, төлбөр, хүргэлт, кредит
 * зэрэг өгөгдөл рүү хандахгүй (roadmap 5.2).
 *
 * Яагаад: утас бол ачааг холбох ГОЛ ТҮЛХҮҮР (BR-26). Баталгаажуулалт
 * нэвтрэхээс ӨМНӨ бүртгэгдсэн хуучин бүртгэлүүд өөрийн бус дугаараар
 * үүссэн байж болно — НЭГ УДАА баталгаажуулах хүртэл өгөгдөл хаалттай.
 *
 * `authorizeCustomer()`-ын ДАРАА л хэрэглэнэ. `config.verify.enabled` false
 * орчинд (Verify.MN тохируулаагүй) хаалт унтарна — баталгаажуулах зам
 * байхгүй үед бүх хэрэглэгчийг түгжихгүй.
 */
const requireVerifiedPhone = () => (req, res, next) => {
  if (!config.verify.enabled || req.customer?.phoneVerified) return next();

  return next(
    new APIError('Утасны дугаараа баталгаажуулна уу', httpStatus.FORBIDDEN, {
      code: ERROR_CODE.PHONE_NOT_VERIFIED,
    })
  );
};

module.exports = requireVerifiedPhone;
