'use strict';

const config = require('../config');
const User = require('../models/user.model');
const Customer = require('../models/customer.model');
const passportJWT = require('passport-jwt');

const ExtractJwt = passportJWT.ExtractJwt;
const JwtStrategy = passportJWT.Strategy;

const jwtOptions = {
  secretOrKey: config.secret,
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  // Харилцагчийн токеноор ажилтны endpoint рүү орох боломжгүй байх ёстой.
  audience: config.jwt.staffAudience,
};

const jwtStrategy = new JwtStrategy(jwtOptions, async (jwtPayload, done) => {
  try {
    const user = await User.findById(jwtPayload.sub);
    if (!user) {
      return done(null, false);
    }

    // Токен хүчинтэй байсан ч бүртгэл идэвхгүй болсон бол хандалт хаагдана.
    // Ажилтныг ажлаас гаргахад токен дуусахыг хүлээхгүйгээр шууд үйлчилнэ.
    if (user.status !== 'active') {
      return done(null, false);
    }

    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
});

/**
 * Харилцагчийн токен — Phase 5 (§3, архитектур §6).
 *
 * ТУСДАА strategy байгаа шалтгаан: `audience` нь JWT-г шалгах үед хатуу
 * тулгагддаг. Нэг strategy-д хоёр audience зөвшөөрвөл ажилтны токеноор
 * харилцагчийн endpoint рүү (эсрэгээр нь ч) орох зам нээгдэнэ. Хоёр
 * коллекц, хоёр audience — хоорондоо солигдох боломжгүй.
 */
const customerJwtOptions = {
  secretOrKey: config.secret,
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  audience: config.jwt.customerAudience,
};

const customerJwtStrategy = new JwtStrategy(customerJwtOptions, async (jwtPayload, done) => {
  try {
    const customer = await Customer.findById(jwtPayload.sub);
    if (!customer) {
      return done(null, false);
    }

    // Хаагдсан харилцагч токентой ч хандахгүй (ажилтны `deactive`-ийн адил).
    if (customer.status !== 'active') {
      return done(null, false);
    }

    // Ачаа бүртгэхэд автоматаар үүссэн, өөрөө бүртгүүлээгүй бичлэгээр
    // нэвтрэх боломжгүй (BR-29) — тэдгээрт нууц үг ч байхгүй.
    if (!customer.hasAccount) {
      return done(null, false);
    }

    return done(null, customer);
  } catch (err) {
    return done(err, null);
  }
});

exports.jwtOptions = jwtOptions;
exports.jwt = jwtStrategy;
exports.customerJwtOptions = customerJwtOptions;
exports.customerJwt = customerJwtStrategy;
