'use strict';

const passport = require('passport');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Google OAuth — ЗӨВХӨН харилцагчид (§3).
 *
 * ⚠ Өмнөх хувилбар нь Google-ээр нэвтэрсэн хүн бүрт `users` (АЖИЛТАН) бичлэг
 * үүсгэдэг байсан. Ажилтны бүртгэлийг зөвхөн Админ үүсгэх ёстой (§9.1) тул
 * тэр нь Phase 0-д хаагдсан `POST /auth/register`-тэй ижил, эрх өөрөө өсгөх
 * нүх байв. Одоо Google-ээр нэвтэрсэн хүн ЗӨВХӨН `customers` бичлэг үүсгэнэ.
 *
 * Session ашиглахгүй (`session: false`) — танилт бүхэлдээ JWT дээр тогтоно.
 */
if (config.google.enabled) {
  const GoogleStrategy = require('passport-google-oauth20').Strategy;
  const customerAuthService = require('./customer-auth.service');

  passport.use(
    'google-customer',
    new GoogleStrategy(
      {
        clientID: config.google.clientID,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const customer = await customerAuthService.findOrCreateByGoogle({
            googleId: profile.id,
            email: profile.emails?.[0]?.value ?? null,
            name: profile.displayName ?? null,
          });

          // Бүртгэлгүй бол `false` + профайл. Google-ээс утас ирдэггүй тул
          // харилцагчийн бичлэгийг ЭНД үүсгэж БОЛОХГҮЙ (BR-26) — controller
          // түр токен үүсгэж, утас асуух хуудас руу чиглүүлнэ.
          if (!customer) {
            return done(null, false, { profile });
          }

          return done(null, customer);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
} else {
  logger.info('Google OAuth тохируулагдаагүй — харилцагч имэйл/нууц үгээр нэвтэрнэ');
}
