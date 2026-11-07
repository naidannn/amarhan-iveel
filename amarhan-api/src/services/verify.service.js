'use strict';

const httpStatus = require('http-status');
const config = require('../config');
const logger = require('../utils/logger');
const APIError = require('../utils/APIError');
const { maskPhone } = require('../domain/phone');

// Verify.MN хариу өгөхгүй бол харилцагчийн хүсэлт өлгөөтэй үлдэхээс сэргийлнэ
const REQUEST_TIMEOUT_MS = 10_000;

// Verify.MN-ийн `sessionStatus` → манай `PHONE_VERIFICATION_STATUS`
const SESSION_STATUS = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  EXPIRED: 'EXPIRED',
};

/**
 * Verify.MN REST адаптер — roadmap 5.2. `qpay.service.js`-ийн ижил singleton
 * загвар, `config.verify.enabled`-ээр хаагдана.
 *
 * MO (mobile-originated) загвар: `createSession` нь SMS ИЛГЭЭХГҮЙ — харилцагч
 * өөрийн утаснаас 144773 руу `text`-ийг илгээнэ. Тиймээс `text` нь нууц БИШ
 * (дэлгэц дээр харагдана); хамгаалалт нь SMS-ийн ИЛГЭЭГЧ дугаарт оршино.
 *
 * Callback АШИГЛАХГҮЙ: Verify.MN-ийн session callback нь гарын үсэггүй, бие
 * хоосон мэдэгдэл бөгөөд баримт бичигт нь ч `GET /sessions/:id`-г эх
 * сурвалж гэж заасан. Frontend 3 секунд тутам манай сервероор дамжуулан
 * `getSession`-ыг асууна — нэмэлт нээлттэй webhook route шаардлагагүй.
 *
 * Алдааг ШИДНЭ (`qpay.service.js`-ийн адил) — баталгаажуулалт амжилтгүй
 * болсныг харилцагчид харуулах ёстой. API түлхүүрийг ХЭЗЭЭ Ч логлохгүй.
 */
class VerifyService {
  async createSession({ phone, text }) {
    this.assertEnabled();

    const res = await this.fetch('/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.verify.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone, text }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      logger.error('Verify.MN сесс үүсгэж чадсангүй', {
        status: res.status,
        phone: maskPhone(phone),
        message: body?.message,
      });
      throw new APIError(
        'Баталгаажуулалт эхлүүлж чадсангүй. Хэсэг хугацааны дараа дахин оролдоно уу',
        httpStatus.BAD_GATEWAY
      );
    }

    const data = await res.json();
    return {
      sessionId: data.sessionId,
      shortcode: data.shortcode,
      text: data.text,
      smsUri: data.smsUri,
      displayInstruction: data.displayInstruction ?? null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    };
  }

  /**
   * @returns {Promise<{ status: 'PENDING'|'VERIFIED'|'EXPIRED', verifiedAt: Date|null }>}
   */
  async getSession(sessionId) {
    this.assertEnabled();

    const res = await this.fetch(`/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.verify.apiKey}` },
    });

    // Verify.MN сессийг устгасан — манай талд хугацаа дууссантай ижил
    if (res.status === httpStatus.NOT_FOUND) {
      return { status: SESSION_STATUS.EXPIRED, verifiedAt: null };
    }

    if (!res.ok) {
      logger.error('Verify.MN сессийн төлөв авч чадсангүй', { status: res.status });
      throw new APIError(
        'Баталгаажуулалтын төлөв шалгаж чадсангүй. Дахин оролдоно уу',
        httpStatus.BAD_GATEWAY
      );
    }

    const data = await res.json();
    return {
      status: data.sessionStatus,
      verifiedAt: data.verifiedAt ? new Date(data.verifiedAt) : null,
    };
  }

  async fetch(path, init) {
    try {
      return await fetch(`${config.verify.baseURL}${path}`, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      logger.error('Verify.MN-тэй холбогдож чадсангүй', { path, error: err.message });
      throw new APIError(
        'Баталгаажуулалтын үйлчилгээтэй холбогдож чадсангүй',
        httpStatus.BAD_GATEWAY
      );
    }
  }

  assertEnabled() {
    if (!config.verify.enabled) {
      throw new APIError(
        'Утас баталгаажуулалт тохируулагдаагүй байна',
        httpStatus.SERVICE_UNAVAILABLE
      );
    }
  }
}

module.exports = new VerifyService();
module.exports.SESSION_STATUS = SESSION_STATUS;
