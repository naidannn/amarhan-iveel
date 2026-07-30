'use strict';

const mongoose = require('mongoose');
const { INVOICE_STATUS, INVOICE_STATUS_LIST } = require('../config/constants');
const Schema = mongoose.Schema;

/**
 * Нэгтгэсэн нэхэмжлэх — introduction.md §2.3, docs/data-model.md §8
 *
 * ЮУ БИШ: нэхэмжлэх нь тооцооны эх сурвалж БИШ. Ачааны `balance` нь үргэлж
 * `payments.allocations`-аас гарна (BR-14). Нэхэмжлэх нь зөвхөн "ажилтан
 * эдгээр ачааг нэг дор төлүүлэхээр сонгов" гэсэн БҮЛЭГЛЭЛ бөгөөд баримт
 * хэвлэхэд (§2.3 алхам 5) хэрэгтэй.
 *
 * Ингэж тодорхойлсны ач холбогдол: нэхэмжлэхгүйгээр (нэг ачаанд шууд) төлбөр
 * авах зам ижил кодоор ажиллана, мөн нэхэмжлэх хүчингүй болоход төлөгдсөн
 * төлбөр АЛГА БОЛОХГҮЙ.
 *
 * Бүх мөнгөн дүн БҮХЭЛ ТОО, нэгж ₮ (CLAUDE.md §5 дүрэм 2).
 */
const invoiceSchema = new Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    // BR-16 — нэг нэхэмжлэхэд ЗӨВХӨН нэг харилцагчийн ачаа
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    // Хайлт, баримт хэвлэхэд зориулж хуулбарласан (BR-27 нормчлогдсон)
    customerPhone: {
      type: String,
      required: true,
      match: [/^\d{8}$/, 'Утасны дугаар 8 оронтой байх ёстой'],
    },

    /**
     * Багтсан ачаанууд. `trackingNumber` ба `amount`-ыг ХУУЛБАРЛАСАН:
     *   • дугаар — баримт хэвлэхэд нэг уншилтаар гаргах (§2.3 алхам 5)
     *   • дүн    — нэхэмжлэх үүсэх ҮЕИЙН үлдэгдэл. Ачааны үнэ хожим
     *              override-оор өөрчлөгдвөл (BR-04) хэвлэсэн баримт дээрх
     *              дүн юу байсныг тайлбарлах шаардлагатай.
     */
    items: [
      {
        packageId: { type: Schema.Types.ObjectId, ref: 'Package', required: true },
        trackingNumber: { type: String, required: true },
        amount: {
          type: Number,
          required: true,
          min: 0,
          validate: { validator: Number.isInteger, message: 'Дүн бүхэл тоо (₮) байх ёстой' },
        },
        _id: false,
      },
    ],

    // `Σ items.amount` — үүсэх үед бодогдож хөшөөлөгдөнө
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: 'Дүн бүхэл тоо (₮) байх ёстой' },
    },

    /**
     * Энэ нэхэмжлэхэд ХОЛБОГДСОН `completed` төлбөрүүдийн нийлбэр.
     * ЗӨВХӨН `payment.service.js` транзакц дотор шинэчилнэ.
     */
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: INVOICE_STATUS_LIST,
      default: INVOICE_STATUS.OPEN,
    },

    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },

    // `null` = харилцагч өөрөө вэбээс үүсгэсэн (§3, Phase 5)
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, trim: true, maxlength: 500, default: null },
  },
  { timestamps: true }
);

invoiceSchema.index({ customerId: 1, createdAt: -1 });
invoiceSchema.index({ status: 1, createdAt: -1 });
invoiceSchema.index({ createdAt: -1 });
// Ачаа хэдэн нэхэмжлэхэд орсныг шалгахад (BR-16a)
invoiceSchema.index({ 'items.packageId': 1 });

invoiceSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

invoiceSchema.plugin(require('mongoose-paginate-v2'));

module.exports = mongoose.model('Invoice', invoiceSchema);
