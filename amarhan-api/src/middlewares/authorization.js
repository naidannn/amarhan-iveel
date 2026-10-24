'use strict';

const User = require('../models/user.model');
const passport = require('passport');
const APIError = require('../utils/APIError');
const httpStatus = require('http-status');

const handleJWT = (req, res, next, roles) => async (err, user, info) => {
  const error = err || info;
  const apiError = new APIError(error ? error.message : 'Unauthorized', httpStatus.UNAUTHORIZED);

  try {
    if (error || !user) throw error;
    await new Promise((resolve, reject) => {
      req.logIn(user, { session: false }, err => {
        if (err) reject(err);
        else resolve();
      });
    });
  } catch (e) {
    return next(apiError);
  }

  if (!roles.includes(user.role)) {
    return next(new APIError('Forbidden', httpStatus.FORBIDDEN));
  }

  req.user = user;
  return next();
};

const authorize =
  (roles = User.roles) =>
  (req, res, next) => {
    // Токеныг ЗӨВХӨН `Authorization` header-ээс авна. `?token=` нь morgan-ийн
    // access log, браузерын түүх, Referer-д бүтэн JWT-г үлдээдэг байсан.
    return passport.authenticate('jwt', { session: false }, handleJWT(req, res, next, roles))(
      req,
      res,
      next
    );
  };

module.exports = authorize;
