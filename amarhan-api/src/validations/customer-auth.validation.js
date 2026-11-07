'use strict';

const Joi = require('joi');
const { PHONE_VERIFICATION_PURPOSE } = require('../config/constants');

/**
 * Утсыг ЭНД хатуу форматад оруулахгүй — нормчлолыг `domain/phone.js` хийнэ
 * (BR-27). Joi зөвхөн ерөнхий хэлбэрийг шалгана.
 */
const phoneInput = Joi.string().trim().min(8).max(20);

// docs/security-and-permissions.md §4 — доод тал нь 8 тэмдэгт
const password = Joi.string().min(8).max(128);

// `phone-verification.service.js#generateToken` — 24 байт base64url
const verificationToken = Joi.string().trim().max(100);

module.exports = {
  register: {
    body: Joi.object({
      phone: phoneInput.required(),
      password: password.required(),
      name: Joi.string().trim().max(100).allow(null, '').optional(),
      email: Joi.string().email().allow(null, '').optional(),
      // Verify.MN тохируулсан орчинд ЗААВАЛ — service шалгана (roadmap 5.2)
      verificationToken: verificationToken.optional(),
    }),
  },

  login: {
    body: Joi.object({
      // Утас ЭСВЭЛ имэйл — сервер аль болохыг өөрөө ялгана
      identifier: Joi.string().trim().min(3).max(120).required(),
      password: Joi.string().required(),
    }),
  },

  googleComplete: {
    body: Joi.object({
      pendingToken: Joi.string().required(),
      phone: phoneInput.required(),
      name: Joi.string().trim().max(100).allow(null, '').optional(),
      verificationToken: verificationToken.optional(),
    }),
  },

  /**
   * `phone` ЗОРИУД БАЙХГҮЙ — харилцагч утсаа өөрөө сольж чадахгүй.
   * Шалтгаан: `customer-auth.service.js`-ийн толгойн тайлбар (OTP байхгүй
   * үед утас солих нь бусдын ачааг харах зам болно).
   */
  updateProfile: {
    body: Joi.object({
      name: Joi.string().trim().max(100).allow(null, '').optional(),
      email: Joi.string().email().allow(null, '').optional(),
    }).min(1),
  },

  updateAddresses: {
    body: Joi.object({
      addresses: Joi.array()
        .max(10)
        .items(
          Joi.object({
            label: Joi.string().trim().max(50).allow('').optional(),
            address: Joi.string().trim().max(500).required(),
            note: Joi.string().trim().max(200).allow('').optional(),
          })
        )
        .required(),
    }),
  },

  changePassword: {
    body: Joi.object({
      // Google-ээр бүртгүүлсэн хүнд нууц үг байхгүй — эхний удаа тавихад
      // `currentPassword` шаардлагагүй (service шалгана)
      currentPassword: Joi.string().allow('').optional(),
      newPassword: password.required(),
    }),
  },

  forgotPassword: {
    body: Joi.object({
      email: Joi.string().email().required(),
    }),
  },

  resetPassword: {
    body: Joi.object({
      token: Joi.string().required(),
      newPassword: password.required(),
    }),
  },

  /**
   * Roadmap 5.2 — нэвтрээгүй хэрэглэгчийн баталгаажуулалт. `verify_phone`
   * ЭНД зөвшөөрөгдөхгүй — тэр нь нэвтэрсэн харилцагчийн `/me/phone-verification`.
   */
  startPhoneVerification: {
    body: Joi.object({
      phone: phoneInput.required(),
      purpose: Joi.string()
        .valid(PHONE_VERIFICATION_PURPOSE.REGISTER, PHONE_VERIFICATION_PURPOSE.RESET_PASSWORD)
        .required(),
    }),
  },

  // Токен URL-д БИШ body-д — access log, referrer-т үлдэхгүй
  checkPhoneVerification: {
    body: Joi.object({
      token: verificationToken.required(),
    }),
  },

  resetPasswordWithPhone: {
    body: Joi.object({
      phone: phoneInput.required(),
      verificationToken: verificationToken.required(),
      newPassword: password.required(),
    }),
  },
};
