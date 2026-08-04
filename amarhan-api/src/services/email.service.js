'use strict';

const { Resend } = require('resend');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Resend-ээр имэйл илгээх цорын ганц цэг.
 *
 * `RESEND_API_KEY` тохируулаагүй орчинд (локал dev, тест) илгээхгүй, зөвхөн
 * лог бичээд өнгөрнө — `config.google.enabled`-тэй адил "тохируулаагүй бол
 * чимээгүй унтарна" зарчим (§6 — Google/QPay эрх байхгүй үед алдаа
 * шидэхгүй, боломжийг л хаана).
 */
class EmailService {
  constructor() {
    this.client = config.email.enabled ? new Resend(config.email.apiKey) : null;
  }

  async send({ to, subject, html }) {
    if (!this.client) {
      logger.warn('Имэйл илгээгээгүй — RESEND_API_KEY тохируулаагүй', { to, subject });
      return null;
    }

    const { data, error } = await this.client.emails.send({
      from: config.email.from,
      to,
      subject,
      html,
    });

    if (error) {
      logger.error('Имэйл илгээхэд алдаа гарлаа', { to, subject, error: error.message });
      return null;
    }

    return data;
  }
}

module.exports = new EmailService();
