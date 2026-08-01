'use strict';

const mongoose = require('mongoose');
const { NOTIFICATION_AUDIENCE_LIST } = require('../config/constants');
const Schema = mongoose.Schema;

/**
 * Мэдэгдэл — introduction.md §7 (Phase 6)
 *
 * НЭГ коллекц ХОЁР төрлийг хамарна (`audience`-аар ялгана):
 *   · `customer` — тухайн ХАРИЛЦАГЧИД зориулсан хувийн мэдэгдэл. Систем
 *     ачааны эвентээс автоматаар үүсгэнэ (BR-35), ганц хүлээн авагчтай тул
 *     `readAt`-ыг ЭНД ШУУД бичнэ — тусдаа join хэрэггүй.
 *   · `all` — Админ/Менежерийн бүх харилцагчид зориулсан нийтийн зарлал
 *     (BR-36). Олон харилцагч ХУВААЛЦДАГ тул уншсан төлөв тус тусдаа
 *     `NotificationRead` коллекцод хадгалагдана — `readAt` энд ХЭРЭГЛЭГДЭХГҮЙ.
 *
 * Зөвхөн `web` суваг дэмжигдэнэ (SMS — roadmap 6.5, хараахан хэрэгжээгүй).
 */
const notificationSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    audience: {
      type: String,
      required: true,
      enum: NOTIFICATION_AUDIENCE_LIST,
    },
    // Зөвхөн `audience: 'customer'` үед
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
      index: true,
    },

    // Ямар объекттой холбоотой вэ (audit-log.model.js-тэй ижил хэв маяг) —
    // жишээ: `entity: 'package'`, `entityLabel: trackingNumber`. Нийтийн
    // зарлалд гурвуулаа `null`.
    entity: { type: String, default: null },
    entityId: { type: Schema.Types.ObjectId, default: null },
    entityLabel: { type: String, default: null },

    // Зөвхөн хувийн мэдэгдэлд — ганц хүлээн авагч тул шууд талбар хангалттай
    readAt: { type: Date, default: null },

    // Зөвхөн нийтийн зарлалд — `null` бол хугацаагүй
    expiresAt: { type: Date, default: null },

    // Нийтийн зарлал илгээсэн ажилтан. Хувийн (систем үүсгэсэн) мэдэгдэлд `null`.
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Харилцагчийн вэб: хувийн мэдэгдлийн жагсаалт
notificationSchema.index({ customerId: 1, createdAt: -1 });
// Админ панел: нийтийн зарлалын түүх, идэвхтэй эсэхийг шалгах
notificationSchema.index({ audience: 1, createdAt: -1 });
notificationSchema.index({ audience: 1, expiresAt: 1 });

notificationSchema.set('toJSON', {
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

notificationSchema.plugin(require('mongoose-paginate-v2'));

module.exports = mongoose.model('Notification', notificationSchema);
