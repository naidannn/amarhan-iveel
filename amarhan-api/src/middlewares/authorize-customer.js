'use strict';

const passport = require('passport');
const httpStatus = require('http-status');
const APIError = require('../utils/APIError');

/**
 * Харилцагчийн танилт — introduction.md §3, архитектур §6.
 *
 * Ажилтны `authorize()`-оос ТУСДАА байх ёстой:
 *   · өөр коллекц (`customers` vs `users`)
 *   · өөр token audience (`customer` vs `staff`)
 *   · рол БАЙХГҮЙ — харилцагч бүр ижил эрхтэй, ялгаа нь зөвхөн ХЭНИЙ өгөгдөл
 *     вэ гэдэгт (хамрах хүрээг service давхарга `customerId`-аар барина)
 *
 * Танигдсан харилцагчийг `req.customer`-т тавина. `req.user`-т ТАВИХГҮЙ —
 * ажилтныг хүлээж бичигдсэн код (audit-ийн `actor`, салбарын хамрах хүрээ)
 * харилцагчийг ажилтан гэж андуурч болзошгүй.
 */
const authorizeCustomer = () => (req, res, next) =>
  passport.authenticate('jwt-customer', { session: false }, (err, customer) => {
    if (err) return next(err);
    if (!customer) {
      return next(new APIError('Нэвтэрч орно уу', httpStatus.UNAUTHORIZED));
    }

    req.customer = customer;
    return next();
  })(req, res, next);

module.exports = authorizeCustomer;
