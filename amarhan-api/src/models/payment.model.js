'use strict';

const mongoose = require('mongoose');
const {
  PAYMENT_METHOD_LIST,
  PAYMENT_RECORD_STATUS,
  PAYMENT_RECORD_STATUS_LIST,
} = require('../config/constants');
const Schema = mongoose.Schema;

/**
 * Төлбөр — introduction.md §1.8, §2, docs/data-model.md §9
 *
 * НЭГ БИЧЛЭГ = НЭГ УДААГИЙН МӨНГӨНИЙ ХӨДӨЛГӨӨН. Хуваасан төлбөр (50% данс +
 * 50% бэлэн) нь ХОЁР бичлэг болно (BR-13) — нэг бичлэгт хоёр хэлбэр
 * багтуулбал өдрийн касс тулгахад аль дүн бэлнээр орсныг ялгах боломжгүй.
 *
 * ЭНЭ КОЛЛЕКЦ НЬ МӨНГӨНИЙ ЭХ СУРВАЛЖ. `packages.paidAmount` / `balance` нь
 * үүнээс ГАРАЛТАЙ кэш (BR-14) — зөрвөл ЭНД байгаа нь зөв. Тиймээс бичлэгийг
 * ХЭЗЭЭ Ч устгахгүй, зөвхөн `voided` болгоно (BR-18).
 *
 * Бүх мөнгөн дүн БҮХЭЛ ТОО, нэгж ₮ (CLAUDE.md §5 дүрэм 2).
 */
const paymentSchema = new Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: [1, 'Төлбөрийн дүн 1₮-өөс багагүй байна'],
      validate: { validator: Number.isInteger, message: 'Дүн бүхэл тоо (₮) байх ёстой' },
    },

    method: {
      type: String,
      enum: PAYMENT_METHOD_LIST,
      required: true,
    },

    // Нэгтгэсэн нэхэмжлэхээр төлсөн бол (§2.3). `null` = ачаанд шууд төлсөн
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
    },

    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    customerPhone: {
      type: String,
      required: true,
      match: [/^\d{8}$/, 'Утасны дугаар 8 оронтой байх ёстой'],
    },

    /**
     * ТОГТМОЛ (BR-17): `Σ allocations.amount === amount` — ҮРГЭЛЖ яг таарна.
     * Хуваарилалтыг `src/domain/allocation.js` бодож, тогтмолыг шалгана.
     * Доорх `pre('validate')` нь DB руу орох замд ДАХИН шалгана — service-ийн
     * шинэ зам нэмэгдэхэд тогтмолыг тойрч гарах боломжгүй байх ёстой.
     */
    allocations: [
      {
        packageId: { type: Schema.Types.ObjectId, ref: 'Package', required: true },
        amount: {
          type: Number,
          required: true,
          min: [1, 'Хуваарилалтын дүн 1₮-өөс багагүй байна'],
          validate: { validator: Number.isInteger, message: 'Дүн бүхэл тоо (₮) байх ёстой' },
        },
        _id: false,
      },
    ],

    status: {
      type: String,
      enum: PAYMENT_RECORD_STATUS_LIST,
      default: PAYMENT_RECORD_STATUS.COMPLETED,
    },

    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },

    // `null` = онлайн төлбөр (харилцагч өөрөө, §2.1)
    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Кассын баримт тулгахад ажилтан устсан ч нэр түүхэнд үлдэнэ
    receivedByName: {
      type: String,
      default: null,
    },

    // ── Гадаад үйлчилгээ (QPay, Phase 5) ──────────────────────────────────
    provider: { type: String, default: null },
    providerInvoiceId: { type: String, default: null },
    providerPaymentId: { type: String, default: null },

    note: { type: String, trim: true, maxlength: 500, default: null },

    // BR-18 — устгахгүй, хүчингүй болгоно
    voidedAt: { type: Date, default: null },
    voidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    voidReason: { type: String, trim: true, maxlength: 500, default: null },
  },
  { timestamps: true }
);

/**
 * BR-17 — тогтмолыг DB руу орох ЗАМД шалгана.
 *
 * Service давхарга домэйн функцээр шалгасан ч энэ hook нь ХАМГААЛАЛТЫН ХОЁР
 * ДАХЬ ДАВХАРГА: seed скрипт, migration, эсвэл хожим нэмэгдэх шинэ зам
 * домэйн функцийг тойрч гарвал мөнгө чимээгүй "үүснэ/устана".
 */
paymentSchema.pre('validate', function validateAllocations(next) {
  if (!Array.isArray(this.allocations) || this.allocations.length === 0) {
    return next(new Error('Төлбөрт ядаж нэг ачааны хуваарилалт байх шаардлагатай'));
  }

  const sum = this.allocations.reduce((acc, a) => acc + (a?.amount ?? 0), 0);
  if (sum !== this.amount) {
    return next(
      new Error(
        `Хуваарилалтын нийлбэр (${sum}₮) төлбөрийн дүнтэй (${this.amount}₮) таарахгүй байна`
      )
    );
  }

  const ids = this.allocations.map(a => String(a.packageId));
  if (new Set(ids).size !== ids.length) {
    return next(new Error('Нэг ачаа хуваарилалтад хоёр удаа орсон байна'));
  }

  return next();
});

/**
 * §2.2 — төлбөрийн жагсаалт ба ачааны төлбөрийн түүх.
 *
 * `allocations.packageId` — "энэ ачаанд ямар төлбөрүүд орсон" (ачааны
 * дэлгэрэнгүй хуудас, мөн `paidAmount`-ыг эргэн тооцоолох cron).
 */
paymentSchema.index({ 'allocations.packageId': 1 });
paymentSchema.index({ customerId: 1, createdAt: -1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ method: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ invoiceId: 1 });
paymentSchema.index({ branchId: 1, createdAt: -1 });
// Dashboard-ын completed төлбөрийн 30 хоногийн орлогын график.
paymentSchema.index({ branchId: 1, status: 1, createdAt: -1 });

/**
 * ИДЕМПОТЕНТ ВЕБХҮҮК (архитектур §4.4). QPay нэг төлбөрийн мэдэгдлийг хэд ч
 * удаа давтан илгээж болно — давхардсан бичлэг үүсвэл хэрэглэгчийн ачаа
 * хоёр дахин төлөгдсөн болно.
 *
 * `partialFilterExpression` нь `providerPaymentId` МӨР байгаа бичлэгт л
 * үйлчилнэ: гар аргаар бүртгэсэн төлбөрүүд бүгд `null` тул тэдгээрийн хооронд
 * unique зөрчил гарахгүй.
 */
paymentSchema.index(
  { provider: 1, providerPaymentId: 1 },
  { unique: true, partialFilterExpression: { providerPaymentId: { $type: 'string' } } }
);

paymentSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

paymentSchema.plugin(require('mongoose-paginate-v2'));

module.exports = mongoose.model('Payment', paymentSchema);
