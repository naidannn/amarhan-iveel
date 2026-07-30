'use strict';

const Joi = require('joi');
const { SETTING_KEY } = require('../config/constants');

/**
 * Тохиргооны утгын хэлбэр — түлхүүр тус бүрээр.
 *
 * ЯАГААД `Joi.any()` БИШ: `settings.value` нь Mongoose-д `Mixed` тул схемийн
 * хамгаалалт огт байхгүй. Хэлбэрийг энд тогтоохгүй бол админ санамсаргүй
 * бичсэн утга (жишээ: `faq`-д массивын оронд мөр) хэрэглэгчийн вэбийг
 * ажиллах үед унагаана — алдаа нь бичих ҮЕД БИШ, харуулах үед илэрнэ.
 */
const VALUE_SCHEMAS = {
  [SETTING_KEY.PRICING_OVERRIDE_LIMIT_PERCENT]: Joi.number().min(0).max(100),
  [SETTING_KEY.PACKAGE_DELETE_WINDOW_HOURS]: Joi.number().integer().min(0).max(720),
  [SETTING_KEY.WAREHOUSE_SUGGEST_ENABLED]: Joi.boolean(),

  // §3 — Эрээний хүлээн авах хаяг. Зөвхөн ХАРУУЛАХ текст.
  [SETTING_KEY.CONTENT_ERENHOT_ADDRESS]: Joi.object({
    receiverName: Joi.string().trim().max(200).allow('').default(''),
    phone: Joi.string().trim().max(50).allow('').default(''),
    addressCn: Joi.string().trim().max(1000).allow('').default(''),
    addressMn: Joi.string().trim().max(1000).allow('').default(''),
    note: Joi.string().trim().max(2000).allow('').default(''),
  }),

  [SETTING_KEY.CONTENT_CONTACT]: Joi.object({
    phone: Joi.string().trim().max(50).allow('').default(''),
    email: Joi.string().trim().max(200).allow('').default(''),
    address: Joi.string().trim().max(1000).allow('').default(''),
    workingHours: Joi.string().trim().max(500).allow('').default(''),
    facebook: Joi.string().trim().max(300).allow('').default(''),
  }),

  [SETTING_KEY.CONTENT_FAQ]: Joi.array()
    .max(50)
    .items(
      Joi.object({
        question: Joi.string().trim().max(300).required(),
        answer: Joi.string().trim().max(3000).required(),
      })
    ),

  [SETTING_KEY.CONTENT_HOME_NOTICE]: Joi.string().trim().max(1000).allow('', null),
};

module.exports = {
  update: {
    params: Joi.object({
      // Танигдахгүй түлхүүр үүсгэхийг хориглоно — эс тэгвээс `settings`
      // коллекц хог түлхүүрээр дүүрч, аль нь хэрэглэгддэгийг мэдэхгүй болно
      key: Joi.string()
        .valid(...Object.values(SETTING_KEY))
        .required(),
    }),
    body: Joi.object({
      value: Joi.any().required(),
    }),
  },

  VALUE_SCHEMAS,
};
