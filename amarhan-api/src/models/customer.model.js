'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { LOYALTY_TIER } = require('../config/constants');
const Schema = mongoose.Schema;

/**
 * Харилцагч — introduction.md §3
 *
 * Ажилтнаас (users) ТУСДАА коллекцод байрлана (docs/architecture.md шийдвэр №3):
 * ачаа бүртгэхэд харилцагч утсаар нь АВТОМАТААР, нууц үггүй үүсдэг. Ийм бичлэг
 * ажилтны хүснэгтэд холилдвол эрхийн эрсдэл үүснэ.
 *
 * `phone` бол системийн гол түлхүүр (BR-26): ажилтан утас бичихэд тухайн
 * харилцагчийн бүх ачаа гарч ирнэ.
 */
const customerSchema = new Schema(
  {
    // Нормчлогдсон 8 оронтой дугаар (BR-27). Хадгалахын өмнө үргэлж нормчилно.
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^\d{8}$/, 'Утасны дугаар 8 оронтой байх ёстой'],
    },
    // OTP-оор баталгаажсан эсэх. Баталгаажаагүй бол вэбээс ачаа харагдахгүй (BR-28).
    phoneVerified: {
      type: Boolean,
      default: false,
    },

    name: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    // Зөвхөн өөрөө бүртгүүлсэн харилцагчид байна
    password: {
      type: String,
      minlength: 8,
      maxlength: 128,
      default: null,
      select: false,
    },
    googleId: {
      type: String,
      default: null,
    },
    /**
     * Вэбэд нэвтрэх эрхтэй эсэх.
     * false = ачаа бүртгэхэд автоматаар үүссэн, өөрөө хараахан бүртгүүлээгүй (BR-29).
     */
    hasAccount: {
      type: Boolean,
      default: false,
    },

    addresses: [
      {
        label: { type: String, trim: true, maxlength: 50 },
        address: { type: String, trim: true, maxlength: 500 },
        note: { type: String, trim: true, maxlength: 200 },
        _id: false,
      },
    ],

    // §4 — урамшуулал. Оноо ЗӨВХӨН төлбөр бүрэн төлөгдсөний дараа нэмэгдэнэ (BR-30).
    loyaltyTier: {
      type: String,
      enum: Object.values(LOYALTY_TIER),
      default: LOYALTY_TIER.BRONZE,
    },
    loyaltyPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    lifetimeSpent: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: ['active', 'blocked'],
      default: 'active',
    },

    // Ажилтны тэмдэглэл (харилцагчид харагдахгүй)
    note: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    // Нууц үг сэргээх — raw токены sha256 хэш ХАДГАЛАГДАНА, raw утга ХЭЗЭЭ Ч биш
    resetPasswordTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
      select: false,
    },
  },
  { timestamps: true }
);

/**
 * §9.3 — хайлтын талбар бүр индекслэгдсэн байна.
 *
 * `sparse` БИШ, `partialFilterExpression` ашиглаж байгаа шалтгаан: sparse нь
 * зөвхөн талбар ОГТ БАЙХГҮЙ бичлэгийг алгасдаг. Манай схемд `email`/`googleId`
 * нь `default: null` тул бичлэг бүрт утга (null) байдаг — sparse ажиллахгүй,
 * хоёр дахь имэйлгүй харилцагч дээр давхардлын алдаа өгнө.
 */
customerSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
);
customerSchema.index(
  { googleId: 1 },
  { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } }
);
customerSchema.index({ name: 'text' });
customerSchema.index({ createdAt: -1 });
customerSchema.index({ loyaltyTier: 1 });

customerSchema.pre('save', async function save(next) {
  try {
    if (!this.isModified('password') || !this.password) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (error) {
    return next(error);
  }
});

customerSchema.methods.passwordMatches = function (password) {
  if (!this.password) return false;
  return bcrypt.compareSync(password, this.password);
};

customerSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.password;
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

customerSchema.plugin(require('mongoose-paginate-v2'));

module.exports = mongoose.model('Customer', customerSchema);
