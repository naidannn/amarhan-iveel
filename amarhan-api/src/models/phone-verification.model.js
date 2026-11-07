'use strict';

const mongoose = require('mongoose');
const {
  PHONE_VERIFICATION_PURPOSE_LIST,
  PHONE_VERIFICATION_STATUS,
} = require('../config/constants');
const Schema = mongoose.Schema;

// Бичлэгийг 7 хоногийн дараа MongoDB өөрөө устгана — зөвхөн давтамжийн
// хязгаар (24 цаг) болон алдаа шинжлэхэд хэрэгтэй, түүхэн өгөгдөл БИШ
const RETENTION_SECONDS = 7 * 24 * 60 * 60;

/**
 * Утас баталгаажуулалтын сесс — roadmap 5.2 (Verify.MN).
 *
 * ЯАГААД манай талд хадгалах вэ: Verify.MN-ийн `GET /sessions/:id` хариунд
 * УТАС БАЙХГҮЙ. Клиентээс ирсэн `sessionId`-д итгэвэл халдагч өөрийн
 * утсаар баталгаажуулсан сессийг бусдын утсаар бүртгүүлэхэд ашиглана.
 * Энд сесс бүр НЭГ утас, НЭГ зорилго (`purpose`)-д уягдана.
 *
 * Клиент `_id`-г БИШ, санамсаргүй `token`-ыг барина (DB-д зөвхөн sha256
 * хэш нь) — ObjectId нь цаг+тоолуураас бүрддэг тул өөрийн сессийн ID-аас
 * хөршийнхийг тааварлах боломжтой.
 */
const phoneVerificationSchema = new Schema(
  {
    // Нормчлогдсон 8 оронтой дугаар (BR-27)
    phone: {
      type: String,
      required: true,
      match: /^\d{8}$/,
    },
    purpose: {
      type: String,
      enum: PHONE_VERIFICATION_PURPOSE_LIST,
      required: true,
    },
    // `verify_phone` үед л — нэвтэрсэн харилцагч (токеноос)
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    providerSessionId: {
      type: String,
      required: true,
    },
    // Харилцагчийн илгээх код — нууц БИШ (дэлгэцэнд харагдана, MO загвар)
    text: {
      type: String,
      required: true,
    },
    shortcode: { type: String, default: null },
    smsUri: { type: String, default: null },
    displayInstruction: { type: String, default: null },
    status: {
      type: String,
      enum: Object.values(PHONE_VERIFICATION_STATUS),
      default: PHONE_VERIFICATION_STATUS.PENDING,
    },
    expiresAt: { type: Date, required: true },
    verifiedAt: { type: Date, default: null },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'phone_verifications' }
);

// Давтамжийн хязгаар, идэвхтэй сесс дахин ашиглах (`phone-verification.service.js`)
phoneVerificationSchema.index({ phone: 1, purpose: 1, createdAt: -1 });
phoneVerificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS });

module.exports = mongoose.model('PhoneVerification', phoneVerificationSchema);
