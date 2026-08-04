'use strict';

require('dotenv').config();

// Validate required environment variables
const requiredEnvVars = ['PORT', 'APP_SECRET', 'MONGOURI'];
const missing = requiredEnvVars.filter(key => !process.env[key]);

if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

module.exports = {
  port: process.env.PORT || 4000,
  app: process.env.APP || 'amarhan-api',
  env: process.env.NODE_ENV || 'development',
  secret: process.env.APP_SECRET,
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : ['http://localhost:3000', 'http://localhost:3500'],
  server: {
    frontendURL: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  /**
   * Google OAuth — ЗӨВХӨН ХАРИЛЦАГЧИЙН нэвтрэлт (§3).
   *
   * Ажилтныг Google-ээр нэвтрүүлэхгүй: ажилтны бүртгэлийг зөвхөн Админ
   * үүсгэдэг (§9.1) бөгөөд Google-ээр автоматаар ажилтан үүсгэх нь эрх
   * өөрөө өсгөх нүх болно — Phase 0-д яг ийм шалтгаанаар нээлттэй
   * `POST /auth/register`-ыг хаасан.
   */
  google: {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    get enabled() {
      return Boolean(this.clientID && this.clientSecret && this.callbackURL);
    },
  },
  mongo: {
    uri: process.env.MONGOURI,
    testURI: process.env.MONGOTESTURI,
  },
  /**
   * Resend — нууц үг сэргээх имэйл илгээхэд ашиглана.
   *
   * `RESEND_API_KEY` тохируулаагүй орчинд (жишээ: тест) `enabled` false
   * болж, `email.service.js` илгээхийн оронд зөвхөн лог бичнэ —
   * `google.enabled`-тэй адил "тохируулаагүй бол чимээгүй унтарна" зарчим.
   */
  email: {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM || 'Ивээл Карго <info@amarhan.mn>',
    get enabled() {
      return Boolean(this.apiKey);
    },
  },
  jwt: {
    // Ажилтны токен — ажлын нэг ээлжийн урт
    staffAudience: 'staff',
    staffExpiresIn: process.env.JWT_STAFF_EXPIRES_IN || '8h',
    // Харилцагчийн токен (Phase 5)
    customerAudience: 'customer',
    customerExpiresIn: process.env.JWT_CUSTOMER_EXPIRES_IN || '30d',
    /**
     * Google-ээр нэвтэрсэн ч утсаа хараахан өгөөгүй хүний ТҮР токен.
     *
     * Тусдаа audience байх ёстой: энэ токен ард нь бодит харилцагчийн бичлэг
     * БАЙХГҮЙ тул `customer` audience-тай адилтгавал бүртгэлгүй хүн
     * харилцагчийн endpoint рүү орох зам нээгдэнэ. Хугацаа нь нэг форм
     * бөглөх л хэрэгтэй.
     */
    pendingAudience: 'customer_pending',
    pendingExpiresIn: '15m',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    // 100 байсныг 1,000 болгов: салбарын бүх ажилтан нэг IP-аас ханддаг тул
    // §1.4-ийн бүртгэлийн урсгалыг хааж байсан. Дэлгэрэнгүй тайлбар:
    // src/middlewares/rate-limit.js
    max: parseInt(process.env.RATE_LIMIT_MAX) || 1000,
  },
};
