'use strict';

const crypto = require('crypto');
const httpStatus = require('http-status');
const config = require('../config');
const logger = require('../utils/logger');
const APIError = require('../utils/APIError');
const { ERROR_CODE } = require('../config/constants');

const UPLOAD_TIMEOUT_MS = 20000;

/**
 * Cloudinary руу зураг байршуулах цорын ганц цэг (нүүрний popup зарлал).
 *
 * SDK-гүй, шууд REST — нэг signed upload л хэрэгтэй тул `cloudinary` пакетын
 * хамаарал нэмэх шаардлагагүй. Гарын үсэг нь `sha1(эрэмбэлсэн параметр + secret)`
 * (Cloudinary "Signed upload" баримт). Secret хэзээ ч клиент рүү гарахгүй —
 * зураг backend-ээр дамжиж (санах ойд), диск рүү бичигдэхгүйгээр CDN рүү очно.
 */
class ImageHostService {
  get enabled() {
    return config.cloudinary.enabled;
  }

  sign(params) {
    const payload = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return crypto
      .createHash('sha1')
      .update(payload + config.cloudinary.apiSecret)
      .digest('hex');
  }

  /**
   * @param {Buffer} buffer
   * @param {string} mimetype
   * @returns {Promise<{ url: string, publicId: string, width: number, height: number }>}
   */
  async upload(buffer, mimetype) {
    if (!this.enabled) {
      throw new APIError(
        'Зургийн CDN (Cloudinary) тохируулаагүй байна — зургийн URL-ыг гараар оруулна уу',
        httpStatus.SERVICE_UNAVAILABLE,
        { code: ERROR_CODE.IMAGE_HOST_DISABLED }
      );
    }

    const { cloudName, apiKey, folder } = config.cloudinary;
    const params = { folder, timestamp: Math.floor(Date.now() / 1000) };

    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mimetype }));
    form.append('api_key', apiKey);
    form.append('folder', params.folder);
    form.append('timestamp', String(params.timestamp));
    form.append('signature', this.sign(params));

    let res;
    let body;
    try {
      res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      });
      body = await res.json().catch(() => null);
    } catch (err) {
      logger.error('Cloudinary руу холбогдож чадсангүй', { error: err.message });
      throw new APIError('Зургийн CDN руу холбогдож чадсангүй', httpStatus.BAD_GATEWAY);
    }

    if (!res.ok || !body?.secure_url) {
      logger.error('Cloudinary upload амжилтгүй', {
        status: res.status,
        error: body?.error?.message,
      });
      throw new APIError('Зургийг CDN руу байршуулж чадсангүй', httpStatus.BAD_GATEWAY);
    }

    return {
      url: body.secure_url,
      publicId: body.public_id,
      width: body.width,
      height: body.height,
    };
  }
}

module.exports = new ImageHostService();
