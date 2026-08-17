'use strict';

const httpStatus = require('http-status');
const config = require('../config');
const logger = require('../utils/logger');
const APIError = require('../utils/APIError');

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
 * харилцагчид харуулах ёстой. `checkInvoice` нь webhook-оос л дуудагддаг тул
 * алдааг ЗӨӨЛӨН барина — лог бичээд `pending` хэвээр үлдээнэ, дараагийн
 * webhook эсвэл гар аргаар нийцүүлэлт дараа нь дахин оролдоно.
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
    });

    if (!res.ok) {
      logger.error('QPay нэвтрэлт амжилтгүй', { status: res.status });
      throw new APIError('QPay үйлчилгээтэй холбогдож чадсангүй', httpStatus.BAD_GATEWAY);
    }

    const data = await res.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
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
    try {
      const data = await this.request('/payment/check', {
        object_type: 'INVOICE',
        object_id: invoiceId,
        offset: { page_number: 1, page_limit: 100 },
      });

      const rows = data.rows ?? [];
      const paidAmount = rows.reduce((sum, r) => sum + (r.payment_amount ?? 0), 0);

      return {
        paid: rows.length > 0,
        paidAmount,
        providerPaymentId: rows[0]?.payment_id ?? null,
      };
    } catch (error) {
      logger.error('QPay нэхэмжлэх шалгахад алдаа гарлаа', { invoiceId, error: error.message });
      return { paid: false, paidAmount: 0, providerPaymentId: null };
    }
  }
}

module.exports = new QPayService();
