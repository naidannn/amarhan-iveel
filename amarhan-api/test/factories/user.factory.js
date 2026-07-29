'use strict';

const User = require('../../src/models/user.model');
const authService = require('../../src/services/auth.service');
const { ROLES } = require('../../src/config/constants');

let counter = 0;

/**
 * Ажилтны өгөгдлийг үүсгэнэ (DB-д хадгалахгүй).
 */
function makeUser(overrides = {}) {
  counter += 1;
  return {
    email: `staff${counter}@iveel.mn`,
    password: 'test-password-123',
    firstname: 'Тест',
    lastname: `Ажилтан${counter}`,
    role: ROLES.STAFF,
    status: 'active',
    ...overrides,
  };
}

/**
 * Ажилтныг DB-д үүсгэнэ.
 */
async function createUser(overrides = {}) {
  return User.create(makeUser(overrides));
}

/**
 * Ажилтныг үүсгээд түүний хүчинтэй токеныг буцаана.
 */
async function createUserWithToken(overrides = {}) {
  const user = await createUser(overrides);
  return { user, token: authService.generateToken(user) };
}

module.exports = { makeUser, createUser, createUserWithToken };
