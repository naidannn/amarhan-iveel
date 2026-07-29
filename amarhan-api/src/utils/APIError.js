'use strict';

const httpStatus = require('http-status');

/**
 * @param {string} message — хэрэглэгчид харагдах МОНГОЛ мессеж
 * @param {number} [status]
 * @param {object} [extra]
 * @param {string} [extra.code]    — frontend програмчлан шалгах код (`ERROR_CODE`)
 * @param {object} [extra.details] — нэмэлт өгөгдөл (жишээ: давхардсан ачааны мэдээлэл)
 *
 * `code` байгаа шалтгаан: frontend алдааны ТЕКСТЭД хамаарвал мессеж засах бүрт UI
 * эвдэрнэ. Тогтвортой код нь ялгах найдвартай зам (BR-05 → `DUPLICATE_TRACKING_NUMBER`).
 */
class APIError extends Error {
  constructor(message, status = httpStatus.INTERNAL_SERVER_ERROR, { code, details } = {}) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    if (code) this.code = code;
    if (details) this.details = details;
  }
}

module.exports = APIError;
