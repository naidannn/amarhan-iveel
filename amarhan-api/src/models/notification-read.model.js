'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * НИЙТИЙН зарлалын харилцагч тус бүрийн уншсан төлөв — introduction.md §7.
 *
 * ЯАГААД ТУСДАА КОЛЛЕКЦ: `notifications` (`audience: 'all'`) бичлэг бүрийг
 * олон харилцагч ХУВААЛЦДАГ тул уншсан төлвийг тэр бичлэг дээр шууд
 * бичиж болохгүй (нэг харилцагч уншихад бусдад ч уншсан харагдана).
 * Хувийн (`audience: 'customer'`) мэдэгдэлд ганц хүлээн авагч тул
 * `notification.model.js`-ийн `readAt` шууд хангалттай — энд ОРОХГҮЙ.
 */
const notificationReadSchema = new Schema(
  {
    notificationId: {
      type: Schema.Types.ObjectId,
      ref: 'Notification',
      required: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: { createdAt: false, updatedAt: false } }
);

// Нэг харилцагч нэг зарлалыг ганцхан удаа "уншсан" болно (upsert)
notificationReadSchema.index({ notificationId: 1, customerId: 1 }, { unique: true });
notificationReadSchema.index({ customerId: 1, notificationId: 1 });

module.exports = mongoose.model('NotificationRead', notificationReadSchema);
