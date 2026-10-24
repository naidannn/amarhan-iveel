'use strict';

const mongoose = require('mongoose');
const { LOYALTY_TX_TYPE_LIST, LOYALTY_TIER_LIST } = require('../config/constants');
const Schema = mongoose.Schema;

/**
 * Урамшууллын кредитийн ledger — introduction.md §4, docs/data-model.md §11.
 *
 * ЭНЭ КОЛЛЕКЦ НЬ КРЕДИТИЙН ЭХ СУРВАЛЖ. `customers.loyaltyPoints` нь үүнээс
 * ГАРАЛТАЙ кэш (`payments` ↔ `packages.paidAmount`-ийн ижил зарчим, BR-14) —
 * зөрвөл ЭНД байгаа нь зөв, `loyaltyService.recomputeBalance` кэшийг засна.
 *
 * APPEND-ONLY: бичлэгийг засахгүй, устгахгүй. Буруу олголтыг эсрэг тэмдэгтэй
 * ШИНЭ бичлэгээр (`earn_reversal`, `redeem_refund`, `adjust`) засна — тэгснээр
 * харилцагч "яагаад кредит минь өөрчлөгдсөн бэ" гэдгийг түүхээсээ харна.
 * (Ганц үл хамаарах: дунд замдаа бүтэлгүйтсэн `redeem`-ийн нөхөн арилгалт —
 * `loyalty.service.js#cancelDebit`, тэр бичлэг хэзээ ч бодит хөдөлгөөн
 * байгаагүй.)
 *
 * `amount` — тэмдэгтэй бүхэл тоо: олголт +, зарцуулалт/буцаалт −.
 */
const loyaltyTransactionSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },

    type: { type: String, enum: LOYALTY_TX_TYPE_LIST, required: true },

    amount: {
      type: Number,
      required: true,
      validate: {
        validator: v => Number.isInteger(v) && v !== 0,
        message: 'Кредитийн дүн 0 биш бүхэл тоо байх ёстой',
      },
    },

    // Бичлэгийн дараах кэшийн үлдэгдэл — "4 500 (+350)" харагдацад. Кэш
    // шинэчлэгдсэний дараа залгагдана тул маш богино хугацаанд `null` байж болно.
    balanceAfter: { type: Number, default: null },

    // ── earn / earn_reversal: аль ачаанаас ──────────────────────────────
    packageId: { type: Schema.Types.ObjectId, ref: 'Package', default: null },
    // Ачааны дугаар — харилцагчийн түүхэнд populate хийлгүй харуулахад
    label: { type: String, default: null, maxlength: 200 },
    // Ачаа тус бүрийн бичлэгийн дугаар — зэрэг ажилласан хоёр reconcile
    // давхар олгохоос `{ packageId, seq }` unique индекс хамгаална.
    seq: { type: Number, default: null },
    // Олголтын агшины snapshot (BR-31) — босго/хувь хожим өөрчлөгдсөн ч
    // өмнөх олголт ӨӨРЧЛӨГДӨХГҮЙ (roadmap Phase 7 шалгуур).
    tier: { type: String, enum: [...LOYALTY_TIER_LIST, null], default: null },
    rateBps: { type: Number, default: null },
    // Кредит бодогдсон суурь — бодит мөнгөөр төлсөн дүн (₮)
    baseAmount: { type: Number, default: null },

    // ── redeem / redeem_refund: аль төлбөрөөр ───────────────────────────
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },

    // ── adjust (BR-33) ───────────────────────────────────────────────────
    reason: { type: String, trim: true, maxlength: 500, default: null },

    // Хэн хийсэн — `null` = систем/харилцагч өөрөө
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Харилцагчийн түүх (хуудаслалт) ба "хамгийн сүүлийн гүйлгээ"
loyaltyTransactionSchema.index({ customerId: 1, createdAt: -1 });
// Тайлан: тодорхой хугацааны олголт/зарцуулалт
loyaltyTransactionSchema.index({ type: 1, createdAt: -1 });

/**
 * Reconcile-ийн давхар олголтоос хамгаална (loyalty-readiness §3.2).
 * `partialFilterExpression` — ачаагүй бичлэгүүд (redeem/adjust) хамаарахгүй.
 */
loyaltyTransactionSchema.index(
  { packageId: 1, seq: 1 },
  { unique: true, partialFilterExpression: { packageId: { $type: 'objectId' } } }
);

/**
 * Нэг төлбөрт НЭГ л `redeem`, НЭГ л `redeem_refund` — хүчингүй болгох
 * хүсэлт давтагдсан ч кредит хоёр удаа буцаагдахгүй.
 */
loyaltyTransactionSchema.index(
  { paymentId: 1, type: 1 },
  { unique: true, partialFilterExpression: { paymentId: { $type: 'objectId' } } }
);

loyaltyTransactionSchema.set('toJSON', {
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

loyaltyTransactionSchema.plugin(require('mongoose-paginate-v2'));

module.exports = mongoose.model('LoyaltyTransaction', loyaltyTransactionSchema);
