'use strict';

/**
 * Утасны дугаар нормчлол — introduction.md §3, BR-26/BR-27
 *
 * Утас бол ачааг харилцагчтай холбох ГОЛ ТҮЛХҮҮР. Ажилтан утас бичихэд тухайн
 * харилцагчийн бүх ачаа гарч ирэх ёстой. Тиймээс хадгалахын өмнө үргэлж нэг
 * хэлбэрт оруулна — эс тэгвээс "99112233" ба "+976 9911-2233" хоёр өөр
 * харилцагч болж, ачаа тарж унана.
 *
 * Норм хэлбэр: 8 оронтой мөр, улсын кодгүй (`"99112233"`).
 */

const MN_COUNTRY_CODE = '976';
const MN_PHONE_LENGTH = 8;

// Монголын гар утас/суурин утасны эхний орон
const VALID_FIRST_DIGITS = /^[5-9]/;

/**
 * Утасны дугаарыг нормчлоно.
 *
 * Арилгах зүйлс: зай, зураас, хаалт, цэг, `+`, улсын код (`976`, `+976`, `00976`).
 *
 * @param {string|number} input
 * @returns {string} 8 оронтой дугаар
 * @throws {Error} нормчилж чадахгүй бол
 */
function normalizePhone(input) {
  if (input == null || input === '') {
    throw new Error('Утасны дугаар хоосон байна');
  }

  // Цифрээс бусад бүх тэмдэгтийг хасна
  let digits = String(input).replace(/\D/g, '');

  if (digits.length === 0) {
    throw new Error(`Утасны дугаарт цифр алга: "${input}"`);
  }

  // Улсын кодыг арилгах: 00976XXXXXXXX → 976XXXXXXXX → XXXXXXXX
  if (digits.startsWith('00' + MN_COUNTRY_CODE)) {
    digits = digits.slice(2 + MN_COUNTRY_CODE.length);
  } else if (
    digits.startsWith(MN_COUNTRY_CODE) &&
    digits.length === MN_COUNTRY_CODE.length + MN_PHONE_LENGTH
  ) {
    digits = digits.slice(MN_COUNTRY_CODE.length);
  }

  if (digits.length !== MN_PHONE_LENGTH) {
    throw new Error(
      `Утасны дугаар ${MN_PHONE_LENGTH} оронтой байх ёстой: "${input}" → "${digits}"`
    );
  }

  if (!VALID_FIRST_DIGITS.test(digits)) {
    throw new Error(`Утасны дугаарын эхний орон 5–9 байх ёстой: "${input}"`);
  }

  return digits;
}

/**
 * Нормчилж чадах эсэхийг шалгана (алдаа шидэхгүй).
 * @param {string|number} input
 * @returns {boolean}
 */
function isValidPhone(input) {
  try {
    normalizePhone(input);
    return true;
  } catch {
    return false;
  }
}

/**
 * Харуулахад зориулж форматлана: `9911-2233`
 * @param {string} phone — нормчлогдсон дугаар
 * @returns {string}
 */
function formatPhone(phone) {
  const normalized = normalizePhone(phone);
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

/**
 * Логт бичихэд зориулж маскална: `9911****`
 * Харилцагчийн бүтэн дугаарыг лог руу бичихийг хориглоно
 * (docs/security-and-permissions.md §8).
 * @param {string} phone
 * @returns {string}
 */
function maskPhone(phone) {
  try {
    const normalized = normalizePhone(phone);
    return `${normalized.slice(0, 4)}****`;
  } catch {
    return '********';
  }
}

module.exports = {
  MN_COUNTRY_CODE,
  MN_PHONE_LENGTH,
  normalizePhone,
  isValidPhone,
  formatPhone,
  maskPhone,
};
