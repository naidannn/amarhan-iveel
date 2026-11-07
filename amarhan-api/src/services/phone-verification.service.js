'use strict';

const crypto = require('crypto');
const httpStatus = require('http-status');
const phoneVerificationRepository = require('../repositories/phone-verification.repository');
const verifyService = require('./verify.service');
const config = require('../config');
const APIError = require('../utils/APIError');
const resetToken = require('../utils/reset-token');
const { SESSION_STATUS } = require('./verify.service');
const { PHONE_VERIFICATION_STATUS, ERROR_CODE } = require('../config/constants');

// docs/security-and-permissions.md — OTP-ийн давтамжийн хязгаар (1 утсанд)
const RESEND_COOLDOWN_MS = 60 * 1000;
const DAILY_LIMIT = 10;
// Баталгаажуулсны дараа бүртгэл/сэргээлтээ дуусгах хугацаа. Хэт урт бол
// хаягдсан баталгаажуулалт удаан хүчинтэй үлдэнэ; хэт богино бол нууц үг
// бодож суусан хэрэглэгч SMS-ээ (150₮) дахин илгээх болно.
const CONSUME_WINDOW_MS = 30 * 60 * 1000;
// Verify.MN `expiresAt` буцаагаагүй тохиолдолд (баримт бичигт 5 минут)
const DEFAULT_TTL_MS = 5 * 60 * 1000;

const PROVIDER_TO_STATUS = {
  [SESSION_STATUS.VERIFIED]: PHONE_VERIFICATION_STATUS.VERIFIED,
  [SESSION_STATUS.EXPIRED]: PHONE_VERIFICATION_STATUS.EXPIRED,
};

/**
 * Утас баталгаажуулалт — roadmap 5.2 (Verify.MN, MO загвар).
 *
 * Урсгал:
 *   1. `start`   — Verify.MN сесс үүсгэж, харилцагчид "144773 руу XXXXXX
 *                  илгээнэ үү" заавар + санамсаргүй `token` буцаана.
 *   2. `check`   — frontend 3 секунд тутам асууна; `pending` үед Verify.MN-ээс
 *                  (эх сурвалж) шалгаж `verified`/`expired` болгоно.
 *   3. `consume` — бүртгэл / нууц үг сэргээх / нэг удаагийн баталгаажуулалт
 *                  дуусах мөчид НЭГ УДАА зарцуулна (атомик).
 *
 * Энэ сервис харилцагчийн бичлэгт ХҮРЭХГҮЙ — `phoneVerified`-ыг зөвхөн
 * `customer-auth.service.js` бичнэ (баталгаажуулалт зарцуулагдсаны ДАРАА).
 */
class PhoneVerificationService {
  async start({ phone, purpose, customerId = null }) {
    if (!config.verify.enabled) {
      throw new APIError(
        'Утас баталгаажуулалт тохируулагдаагүй байна',
        httpStatus.SERVICE_UNAVAILABLE,
        {
          code: ERROR_CODE.PHONE_VERIFICATION_DISABLED,
        }
      );
    }

    const { token, hash } = this.generateToken();

    // Давхар товшилт, хуудас сэргээх үед ШИНЭ SMS-ийн шаардлага үүсгэхгүй —
    // идэвхтэй сессийг дахин ашиглаж, токеныг нь л шинэчилнэ (хуучин таб
    // дахь токен хүчингүй болно).
    const active = await phoneVerificationRepository.findActivePending({
      phone,
      purpose,
      customerId,
    });
    if (active) {
      active.tokenHash = hash;
      await active.save();
      return this.toPublic(active, token);
    }

    await this.assertWithinLimits({ phone, purpose });

    const text = this.generateCode();
    const session = await verifyService.createSession({ phone, text });

    const record = await phoneVerificationRepository.create({
      phone,
      purpose,
      customerId,
      tokenHash: hash,
      providerSessionId: session.sessionId,
      text: session.text || text,
      shortcode: session.shortcode,
      smsUri: session.smsUri,
      displayInstruction: session.displayInstruction,
      expiresAt: session.expiresAt || new Date(Date.now() + DEFAULT_TTL_MS),
    });

    return this.toPublic(record, token);
  }

  /**
   * Polling — токеноор л хандана (сессийн `_id` ил гарахгүй).
   *
   * `customerId` нь сессийн эзэнтэй ЯГ таарах ёстой: нэвтрээгүй урсгалын
   * (`null`) токеноор нэвтэрсэн харилцагчийн endpoint-ийг, эсвэл өөр
   * харилцагчийн сессийг асуух боломжгүй — `404` (дүрэм 14).
   */
  async check(token, { customerId = null } = {}) {
    const record = await this.findByTokenOrThrow(token);
    if (String(record.customerId ?? '') !== String(customerId ?? '')) {
      throw new APIError('Баталгаажуулалт олдсонгүй', httpStatus.NOT_FOUND);
    }
    const refreshed = await this.refresh(record);
    return this.toPublic(refreshed);
  }

  /**
   * Баталгаажсан сессийг НЭГ УДАА зарцуулна.
   *
   * `phone`, `purpose`, `customerId` гурвуулаа таарах ёстой — өөрийн утсаар
   * баталгаажуулсан сессийг өөр дугаараар бүртгүүлэх, эсвэл бүртгэлийн
   * сессийг нууц үг сэргээхэд ашиглах боломжгүй.
   */
  async consume({ token, phone, purpose, customerId = null }) {
    const notVerified = new APIError(
      'Утасны дугаар баталгаажаагүй байна. Баталгаажуулалтаа дахин хийнэ үү',
      httpStatus.BAD_REQUEST,
      { code: ERROR_CODE.PHONE_VERIFICATION_REQUIRED }
    );

    if (!token) throw notVerified;

    const record = await phoneVerificationRepository.findByTokenHash(resetToken.hash(token));
    if (!record) throw notVerified;

    // Клиент polling-оо дуусгахаас өмнө илгээсэн байж болно
    const refreshed = await this.refresh(record);

    const consumed = await phoneVerificationRepository.consume({
      id: refreshed._id,
      phone,
      purpose,
      customerId,
      verifiedAfter: new Date(Date.now() - CONSUME_WINDOW_MS),
    });
    if (!consumed) throw notVerified;

    return consumed;
  }

  // ── Туслах ────────────────────────────────────────────────────────────

  async refresh(record) {
    if (record.status !== PHONE_VERIFICATION_STATUS.PENDING) return record;

    const provider = await verifyService.getSession(record.providerSessionId);
    let status = PROVIDER_TO_STATUS[provider.status] ?? null;

    // Verify.MN `PENDING` гэсэн ч манай хугацаа дууссан бол хаана
    if (!status && record.expiresAt <= new Date()) {
      status = PHONE_VERIFICATION_STATUS.EXPIRED;
    }
    if (!status) return record;

    const settled = await phoneVerificationRepository.settlePending(record._id, {
      status,
      verifiedAt:
        status === PHONE_VERIFICATION_STATUS.VERIFIED ? provider.verifiedAt || new Date() : null,
    });
    // Зэрэг ирсэн өөр хүсэлт аль хэдийн шийдсэн — DB-ээс дахин уншина
    return settled ?? (await phoneVerificationRepository.findById(record._id));
  }

  async assertWithinLimits({ phone, purpose }) {
    const latest = await phoneVerificationRepository.findLatest({ phone, purpose });
    if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      throw new APIError(
        'Түр хүлээгээд дахин оролдоно уу (1 минут)',
        httpStatus.TOO_MANY_REQUESTS,
        {
          code: ERROR_CODE.PHONE_VERIFICATION_LIMIT,
        }
      );
    }

    const today = await phoneVerificationRepository.countSince({
      phone,
      since: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    if (today >= DAILY_LIMIT) {
      throw new APIError(
        'Энэ дугаараар өнөөдөр хэт олон удаа оролдлоо. Маргааш дахин оролдоно уу',
        httpStatus.TOO_MANY_REQUESTS,
        { code: ERROR_CODE.PHONE_VERIFICATION_LIMIT }
      );
    }
  }

  async findByTokenOrThrow(token) {
    const record = token
      ? await phoneVerificationRepository.findByTokenHash(resetToken.hash(token))
      : null;
    if (!record) {
      throw new APIError('Баталгаажуулалт олдсонгүй', httpStatus.NOT_FOUND);
    }
    return record;
  }

  /** Verify.MN-ийн зөвлөмж: сесс бүрт санамсаргүй 6 оронтой тоо */
  generateCode() {
    return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  }

  generateToken() {
    const token = crypto.randomBytes(24).toString('base64url');
    return { token, hash: resetToken.hash(token) };
  }

  toPublic(record, token) {
    return {
      ...(token ? { token } : {}),
      status: record.status,
      phone: record.phone,
      shortcode: record.shortcode,
      text: record.text,
      smsUri: record.smsUri,
      displayInstruction: record.displayInstruction,
      expiresAt: record.expiresAt,
      verifiedAt: record.verifiedAt,
    };
  }
}

module.exports = new PhoneVerificationService();
module.exports.CONSUME_WINDOW_MS = CONSUME_WINDOW_MS;
