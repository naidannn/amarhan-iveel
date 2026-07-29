'use strict';

const config = require('../config');
const User = require('../models/user.model');
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

exports.jwtOptions = jwtOptions;
exports.jwt = jwtStrategy;
