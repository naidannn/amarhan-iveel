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

  // `unknown(true)`: утас/хаяг/ажиллах цагаас бусад талбар (жишээ:
  // messenger, wechat) чөлөөтэй нэмэгдэж болно — тогтмол жагсаалтаар
  // хязгаарлахгүй, зөвхөн эдгээр 3 нь заавал.
  [SETTING_KEY.CONTENT_CONTACT]: Joi.object({
    phone: Joi.string().trim().max(50).required(),
    address: Joi.string().trim().max(1000).required(),
    workingHours: Joi.string().trim().max(500).required(),
    email: Joi.string().trim().max(200).allow('').default(''),
    facebook: Joi.string().trim().max(300).allow('').default(''),
    website: Joi.string().trim().max(300).allow('').default(''),
    googleMapsUrl: Joi.string().trim().max(500).allow('').default(''),
  }).unknown(true),

  [SETTING_KEY.CONTENT_FAQ]: Joi.array()
    .max(50)
    .items(
      Joi.object({
        question: Joi.string().trim().max(300).required(),
        answer: Joi.string().trim().max(3000).required(),
      })
    ),

  [SETTING_KEY.CONTENT_HOME_NOTICE]: Joi.string().trim().max(1000).allow('', null),

  // Туслах үйлчилгээ — Юань шилжүүлэг. Зөвхөн ХАРУУЛАХ мэдээлэл.
  [SETTING_KEY.CONTENT_YUAN_TRANSFER]: Joi.object({
    rate: Joi.number().min(0).allow(null).default(null),
    bankAccount: Joi.string().trim().max(100).allow('').default(''),
    accountHolder: Joi.string().trim().max(200).allow('').default(''),
    transferNote: Joi.string().trim().max(100).allow('').default(''),
    facebookUrl: Joi.string().trim().max(300).allow('').default(''),
    instructions: Joi.string().trim().max(2000).allow('').default(''),
  }),

  // Туслах үйлчилгээ — Линк захиалга. Систем дотор захиалгын урсгал байхгүй,
  // зөвхөн Facebook хуудас руу чиглүүлэх мэдээлэл.
  [SETTING_KEY.CONTENT_LINK_ORDER]: Joi.object({
    facebookUrl: Joi.string().trim().max(300).allow('').default(''),
    instructions: Joi.string().trim().max(2000).allow('').default(''),
  }),

  // Хятадын онлайн дэлгүүр тус бүрт хаяг холбох зааварчилгаа. `id`-г frontend
  // үүсгэдэг (upload хийсэн зургийг аль зааварт харьяалуулахыг мэдэхийн тулд).
  [SETTING_KEY.CONTENT_ADDRESS_GUIDES]: Joi.array()
    .max(30)
    .items(
      Joi.object({
        id: Joi.string().trim().max(50).required(),
        platform: Joi.string().trim().max(100).required(),
        thumbnailUrl: Joi.string().trim().max(500).allow('').default(''),
        blocks: Joi.array()
          .max(20)
          .items(
            Joi.object({
              imageUrl: Joi.string().trim().max(500).allow('').default(''),
              text: Joi.string().trim().max(2000).allow('').default(''),
            })
          )
          .default([]),
      })
    ),

  // Дотоод — ажилтан төлбөр авахдаа ("Данс" хэлбэр) харилцагчид өгөх дансны мэдээлэл.
  [SETTING_KEY.PAYMENT_BANK_ACCOUNT]: Joi.object({
    bankName: Joi.string().trim().max(200).allow('').default(''),
    accountNumber: Joi.string().trim().max(100).allow('').default(''),
    accountHolder: Joi.string().trim().max(200).allow('').default(''),
    note: Joi.string().trim().max(500).allow('').default(''),
  }),
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
