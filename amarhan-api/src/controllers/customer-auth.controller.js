'use strict';

const passport = require('passport');
const httpStatus = require('http-status');
const config = require('../config');
const customerAuthService = require('../services/customer-auth.service');
const APIError = require('../utils/APIError');
const { success, created } = require('../utils/response');

exports.register = async (req, res, next) => {
  try {
    const result = await customerAuthService.register(req.body, req);
    return created(res, result);
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const result = await customerAuthService.login(req.body);
    return success(res, result);
  } catch (error) {
    next(error);
  }
};

exports.me = async (req, res, next) => {
  try {
    const customer = await customerAuthService.getMe(req.customer._id);
    return success(res, { customer });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const customer = await customerAuthService.updateProfile(req.customer._id, req.body, req);
    return success(res, { customer });
  } catch (error) {
    next(error);
  }
};

exports.updateAddresses = async (req, res, next) => {
  try {
    const customer = await customerAuthService.replaceAddresses(
      req.customer._id,
      req.body.addresses
    );
    return success(res, { customer });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    await customerAuthService.changePassword(req.customer._id, req.body);
    return success(res, { message: 'Нууц үг амжилттай солигдлоо' });
  } catch (error) {
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    await customerAuthService.selfForgotPassword(req.body.email, req);
    return success(res, {
      message: 'Хэрэв энэ имэйл бүртгэлтэй бол сэргээх холбоос илгээгдлээ',
    });
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    await customerAuthService.selfResetPassword(req.body, req);
    return success(res, { message: 'Нууц үг амжилттай солигдлоо' });
  } catch (error) {
    next(error);
  }
};

/**
 * Токеныг сервер талд хадгалдаггүй (JWT) тул гарах нь клиент талын үйлдэл.
 * Endpoint нь клиент нэг л замаар гардаг байхын тулд үлдэнэ.
 */
exports.logout = async (req, res) => success(res, { message: 'Системээс гарлаа' });

// ── Google OAuth (§3) ───────────────────────────────────────────────────

exports.googleStart = (req, res, next) => {
  if (!config.google.enabled) {
    return next(
      new APIError('Google-ээр нэвтрэх тохируулагдаагүй байна', httpStatus.SERVICE_UNAVAILABLE)
    );
  }
  return passport.authenticate('google-customer', {
    scope: ['profile', 'email'],
    session: false,
  })(req, res, next);
};

/**
 * Google-ийн буцах цэг.
 *
 * Хариуг JSON-оор БУЦААХГҮЙ — энэ хаягийг браузер шууд нээж байгаа тул
 * frontend рүү redirect хийнэ. Токен URL-ийн fragment (`#`)-д яваад ч
 * серверийн лог руу ордоггүй боловч Nuxt-ийн `useRoute().hash`-ээс
 * уншигдана.
 *
 * Хоёр төгсгөл:
 *   бүртгэлтэй  → `#token=...`         (шууд нэвтэрнэ)
 *   бүртгэлгүй  → `#pending=...`       (утсаа өгөх хуудас руу)
 */
exports.googleCallback = (req, res, next) => {
  if (!config.google.enabled) {
    return next(
      new APIError('Google-ээр нэвтрэх тохируулагдаагүй байна', httpStatus.SERVICE_UNAVAILABLE)
    );
  }

  return passport.authenticate('google-customer', { session: false }, (err, customer, info) => {
    const base = `${config.server.frontendURL}/auth/google`;

    if (err) return next(err);

    // `findOrCreateByGoogle` бүртгэлгүй үед `null` буцаадаг — тэр нь алдаа
    // БИШ, бүртгэлээ дуусгах шаардлагатай гэсэн үг.
    if (!customer) {
      const profile = info?.profile;
      if (!profile) {
        return res.redirect(`${base}#error=google_failed`);
      }
      const pending = customerAuthService.generatePendingToken({
        googleId: profile.id,
        email: profile.emails?.[0]?.value ?? null,
        name: profile.displayName ?? null,
      });
      return res.redirect(`${base}#pending=${encodeURIComponent(pending)}`);
    }

    if (customer.status !== 'active') {
      return res.redirect(`${base}#error=blocked`);
    }

    const token = customerAuthService.generateToken(customer);
    return res.redirect(`${base}#token=${encodeURIComponent(token)}`);
  })(req, res, next);
};

exports.googleComplete = async (req, res, next) => {
  try {
    const result = await customerAuthService.completeGoogleRegistration(req.body, req);
    return created(res, result);
  } catch (error) {
    next(error);
  }
};
