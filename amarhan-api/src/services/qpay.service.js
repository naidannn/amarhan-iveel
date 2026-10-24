'use strict';

const httpStatus = require('http-status');
const config = require('../config');
const logger = require('../utils/logger');
const APIError = require('../utils/APIError');

// QPay хариу өгөхгүй бол хүсэлт (мөн webhook) хязгааргүй өлгөөтэй үлдэхээс сэргийлнэ
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * QPay REST адаптер — roadmap 5.6/5.7. `email.service.js`-ийн ижил
 * singleton загвар, `config.qpay.enabled`-ээр хаагдана.
 *
 * Токеныг instance дотор кэшилнэ (`/auth/token` бүрд дуудахгүй) — дуусахад
 * 60 секундын өмнө дахин нэвтэрнэ (refresh-token урсгал АШИГЛАХГҮЙ, энгийн
 * хэвээр).
 *
 * `createInvoice` алдаа гарвал ШИДНЭ (`email.service.js`-ийн чимээгүй `null`-
 * аас ЗОРИУДААР ЗӨРЖ) — дуудагч тал (`delivery.service.js`) алдааг
 * харилцагчид харуулах ёстой. `checkInvoice` ч мөн ШИДНЭ — webhook `500`
 * буцааж QPay дахин илгээх ёстой (чимээгүй `paid: false` нь төлөгдсөн
 * нэхэмжлэхийг үүрд `pending` үлдээдэг байсан).
 */
class QPayService {
  constructor() {
    this.accessToken = null;
    this.tokenExpiresAt = 0;
  }

  async getToken() {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    const basic = Buffer.from(`${config.qpay.username}:${config.qpay.password}`).toString(
      'base64'
    );

    const res = await fetch(`${config.qpay.baseURL}/auth/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      logger.error('QPay нэвтрэлт амжилтгүй', { status: res.status });
      throw new APIError('QPay үйлчилгээтэй холбогдож чадсангүй', httpStatus.BAD_GATEWAY);
    }

    const data = await res.json();
    this.accessToken = data.access_token;

    /**
     * QPay-ийн production /auth/token заримдаа `expires_in`-д OAuth-ийн
     * стандарт ёсоор ХАРЬЦАНГУЙ секунд БИШ, шууд epoch секундээр илэрхийлсэн
     * ABSOLUTE дуусах цаг буцаадаг (2026-08-23-нд production дээр батлагдсан
     * — `expires_in: 1787511999` нь яг тэр өдрийн бодит цаг байсан). Үүнийг
     * харьцангуй гэж үзвэл кэш бараг мөнхөд "хүчинтэй" болж, токен бодитоор
     * дууссаны дараа ч дахин ашиглагдаж `401 NO_CREDENTIALS`-д хүргэдэг байсан.
     * Одоогийн Unix цагаас том утга ирвэл absolute гэж үзнэ.
     */
    const expiresIn = data.expires_in ?? 3600;
    this.tokenExpiresAt =
      expiresIn > Date.now() / 1000 ? expiresIn * 1000 : Date.now() + expiresIn * 1000;
    return this.accessToken;
  }

  async request(path, body) {
    const token = await this.getToken();
    const res = await fetch(`${config.qpay.baseURL}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      logger.error('QPay хүсэлт амжилтгүй', { path, status: res.status, data });
      throw new APIError('QPay үйлчилгээтэй холбогдож чадсангүй', httpStatus.BAD_GATEWAY);
    }

    return data;
  }

  /**
   * Нэхэмжлэх үүсгэнэ (QR зураг + апп-руу шилжих deeplink-үүд).
   * `callbackURL`-д дуудагч тал өөрийн Payment бичлэгийн ID-г query
   * параметраар суулгаж дамжуулна (`delivery.service.js`) — webhook ирэхэд
   * QPay-ийн буцаах payload-ын хэлбэрээс үл хамааран ямар бичлэгийг шалгахыг
   * ялгаатай, найдвартай мэднэ.
   */
  async createInvoice({ invoiceNo, amount, description, callbackURL }) {
    if (!config.qpay.enabled) {
      throw new APIError('QPay тохируулаагүй байна', httpStatus.SERVICE_UNAVAILABLE);
    }

    const data = await this.request('/invoice', {
      invoice_code: config.qpay.invoiceCode,
      sender_invoice_no: invoiceNo,
      invoice_receiver_code: 'totalmarketingagency',
      invoice_description: description,
      amount: parseInt(amount, 10),
      allow_exceed: false,
      callback_url: callbackURL,
    });

    return {
      invoiceId: data.invoice_id,
      qrText: data.qr_text,
      qrImage: data.qr_image,
      urls: (data.urls ?? []).map(u => ({
        name: u.name,
        description: u.description,
        logo: u.logo,
        link: u.link,
      })),
    };
  }

  /**
   * Нэхэмжлэхийн бодит төлбөрийн байдлыг ӨӨРИЙН эрхээр дахин баталгаажуулна
   * (архитектур §4.4 — webhook-ийн payload-д ИТГЭХГҮЙ, зөвхөн энэ дуудлагаар
   * баталгаажсан үр дүнд л мөнгө бичигдэнэ).
   */
  async checkInvoice(invoiceId) {
    /**
     * Алдааг ЭНД залгихгүй: сүлжээ/QPay түр унасан үед `paid: false` буцаавал
     * callback `200` хариулж, QPay дахин илгээхгүй — бодит төлөгдсөн нэхэмжлэх
     * үүрд `pending` үлдэнэ. Алдаа дээш шидэгдвэл controller `500` буцааж,
     * QPay дахин оролдоно.
     */
    const data = await this.request('/payment/check', {
      object_type: 'INVOICE',
      object_id: invoiceId,
      offset: { page_number: 1, page_limit: 100 },
    });

    // Зөвхөн `PAID` мөр л мөнгө — `NEW`/`FAILED`/`REFUNDED` мөрийг тоолохгүй
    const paidRows = (data?.rows ?? []).filter(r => r.payment_status === 'PAID');
    const paidAmount = paidRows.reduce((sum, r) => sum + Number(r.payment_amount ?? 0), 0);

    return {
      paid: paidRows.length > 0,
      paidAmount,
      providerPaymentId: paidRows[0]?.payment_id ?? null,
    };
  }
}

module.exports = new QPayService();
