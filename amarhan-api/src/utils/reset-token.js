'use strict';

const crypto = require('crypto');

// Нууц үг сэргээх холбоос хүчинтэй байх хугацаа
const TTL_MS = 60 * 60 * 1000; // 1 цаг

/**
 * Нууц үг сэргээх токен — ажилтан, харилцагч хоёулаа адил хэрэглэнэ.
 *
 * Түрий (raw) токен ЗӨВХӨН имэйлээр илгээгдэнэ, DB-д ХЭЗЭЭ Ч хадгалагдахгүй
 * — зөвхөн sha256 хэш нь хадгалагдана. Ингэснээр DB алдагдсан ч (жишээ:
 * backup алдагдах) хэшээс раw токен сэргээх боломжгүй.
 */
function generate() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hash(token), expires: new Date(Date.now() + TTL_MS) };
}

function hash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

module.exports = { generate, hash, TTL_MS };
