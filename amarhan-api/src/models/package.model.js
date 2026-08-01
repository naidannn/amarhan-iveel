'use strict';

const mongoose = require('mongoose');
const {
  PACKAGE_STATUS,
  PACKAGE_STATUS_LIST,
  PAYMENT_STATUS,
  PAYMENT_STATUS_LIST,
  PRICE_SOURCE,
  REGISTRATION_SOURCE,
  REGISTRATION_SOURCE_LIST,
} = require('../config/constants');
const { TRACKING_PATTERN, normalizeTrackingNumber } = require('../domain/tracking-number');
const Schema = mongoose.Schema;

/**
 * Ачаа — introduction.md §1, docs/data-model.md §7
 *
 * СИСТЕМИЙН ГОЛ КОЛЛЕКЦ. 1M+ мөр болно гэж тооцоолсон тул талбар бүрийг
 * хайлтын шаардлагаас (§9.3) ухаж тавьсан. Хайлтад ашиглагдах утгыг
 * ХУУЛБАРЛАСАН (denormalized): `customerPhone`, `locationCode`, `branchCode`.
 * Populate-аар хайх нь 1M мөрөнд < 1 сек шаардлагыг биелүүлэхгүй.
 *
 * Бүх мөнгөн дүн БҮХЭЛ ТОО, нэгж ₮ (CLAUDE.md §5 дүрэм 2).
 */
const packageSchema = new Schema(
  {
    /**
     * Тээвэрлэгчийн дугаар — ачааг өвөрмөц таних гол түлхүүр (§1.3).
     * Давхардлын дүрмийг доорх partial unique index хэрэгжүүлнэ.
     */
    trackingNumber: {
      type: String,
      required: [true, 'Ачааны дугаар шаардлагатай'],
      // Нормчлолыг setter-т тавьж байгаа шалтгаан: ямар замаар (service, seed
      // скрипт, migration) хадгалагдсан ч дугаар ИЖИЛ хэлбэрт орох ёстой —
      // эс тэгвээс давхардлын unique index-ийг чимээгүй тойрч гарна (BR-05).
      set: value => (value == null ? value : normalizeTrackingNumber(value)),
      match: [
        TRACKING_PATTERN,
        'Ачааны дугаар 3–64 тэмдэгт байх ба зөвхөн латин үсэг, тоо, зураас агуулна',
      ],
      maxlength: 64,
    },

    // ── Харилцагч (BR-26) ──────────────────────────────────────────────────
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    // Хайлтад зориулж хуулбарласан нормчлогдсон 8 оронтой дугаар (BR-27)
    customerPhone: {
      type: String,
      required: true,
      match: [/^\d{8}$/, 'Утасны дугаар 8 оронтой байх ёстой'],
    },

    // ── Салбар (BR-22a) ───────────────────────────────────────────────────
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    branchCode: {
      type: String,
      required: true,
      uppercase: true,
    },

    // ── Хэмжигдэхүүн (§1.1) ───────────────────────────────────────────────
    /**
     * Ачааны төрөл нь ТАРИФЫГ хайхад хэрэглэгддэг. Ажилтан үнийг гараар
     * заасан үед (BR-01a) тариф хэрэглэгдэхгүй тул төрөл ч шаардлагагүй —
     * ийм үед `null`. Зохиомол төрөл сонгуулах нь тайланг гажуудуулна.
     */
    cargoTypeId: {
      type: Schema.Types.ObjectId,
      ref: 'CargoType',
      default: null,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Тоо хэмжээ 1-ээс багагүй байна'],
      validate: { validator: Number.isInteger, message: 'Тоо хэмжээ бүхэл тоо байх ёстой' },
    },
    // 2 орны нарийвчлал. null = зөвхөн эзлэхүүнээр тооцогдсон ачаа
    weightKg: {
      type: Number,
      default: null,
      min: 0,
    },
    // 4 орны нарийвчлал (BR-03)
    volumeM3: {
      type: Number,
      default: null,
      min: 0,
    },
    // Оруулбал `volumeM3` автоматаар бодогдоно (BR-03)
    dimensions: {
      type: {
        lengthCm: { type: Number, min: 0 },
        widthCm: { type: Number, min: 0 },
        heightCm: { type: Number, min: 0 },
        _id: false,
      },
      default: null,
    },

    // ── Үнэ (§1.2) ────────────────────────────────────────────────────────
    /**
     * BR-02 — бүртгэх үеийн тарифын УТГА ачаанд хуулагдана.
     * Тариф хожим өөрчлөгдөхөд ЭНЭ ачааны үнэ тайлбарлагдах чадвартай хэвээр байна.
     *
     * `null` байх ЦОРЫН ГАНЦ тохиолдол: ажилтан үнийг гараар заасан
     * (`priceSource: 'manual'`, BR-01a). Тэр үед тариф ОГТ хэрэглэгдээгүй тул
     * хуулах утга байхгүй — хоосон snapshot хадгалбал "тарифаар бодогдсон"
     * гэсэн хуурамч дүр төрх үүсэх ба ачааг засахад буруу тарифаар дахин
     * бодогдоно.
     */
    pricingSnapshot: {
      type: {
        weightBrackets: {
          type: [{ maxGrams: Number, price: Number, _id: false }],
          default: [],
        },
        pricePerKgAbove: Number,
        pricePerM3: Number,
        minimumCharge: Number,
        tariffVersionId: { type: Schema.Types.ObjectId, ref: 'TariffVersion' },
        _id: false,
      },
      default: null,
    },
    // Систем бодсон дүн — override хийсэн ч ХЭВЭЭР үлдэнэ (audit-д хэрэгтэй)
    computedPrice: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: 'Үнэ бүхэл тоо (₮) байх ёстой' },
    },
    priceSource: {
      type: String,
      enum: Object.values(PRICE_SOURCE),
      required: true,
    },
    // Бодит төлөх дүн (override-ийн дараа)
    finalPrice: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: 'Үнэ бүхэл тоо (₮) байх ёстой' },
    },
    priceOverridden: {
      type: Boolean,
      default: false,
    },
    // BR-04 — override үед ЗААВАЛ
    priceOverrideReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    // ── Төлбөр (§1.8) ─────────────────────────────────────────────────────
    /**
     * КЭШЛЭГДСЭН утгууд. ЗӨВХӨН `payment.service.js` транзакц дотор шинэчилнэ
     * (Phase 3). Өдөр бүр `payments.allocations`-аас дахин тооцож зөрүү шалгах
     * cron ажиллана — docs/data-model.md §7.
     */
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // `finalPrice − paidAmount`. Илүү төлөгдвөл сөрөг болно (BR-15)
    balance: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUS_LIST,
      default: PAYMENT_STATUS.UNPAID,
    },

    // ── Төлөв (§1.5) ──────────────────────────────────────────────────────
    status: {
      type: String,
      enum: PACKAGE_STATUS_LIST,
      default: PACKAGE_STATUS.REGISTERED,
    },
    /**
     * Шилжилт бүр ЭНД болон audit-д бичигдэнэ (BR-08).
     *
     * Хоёуланд бичих нь давхардал биш: `statusHistory` нь ачааны дэлгэрэнгүй
     * хуудсанд нэг уншилтаар харуулахад, audit нь бүх объектын нэгдсэн, засах
     * боломжгүй түүхэнд зориулагдсан.
     */
    statusHistory: [
      {
        from: { type: String, default: null },
        to: { type: String, required: true },
        at: { type: Date, default: Date.now },
        by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        byName: { type: String, default: null },
        reason: { type: String, default: null },
        _id: false,
      },
    ],

    // ── Байршил (§8) ──────────────────────────────────────────────────────
    locationId: {
      type: Schema.Types.ObjectId,
      ref: 'WarehouseLocation',
      default: null,
    },
    // Хайлтад зориулж хуулбарласан (`UB-02-B-15`)
    locationCode: {
      type: String,
      uppercase: true,
      default: null,
    },

    // ── Бусад ─────────────────────────────────────────────────────────────
    arrivedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },
    registeredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    /**
     * BR-46 — бичлэгийг ХЭН эхлүүлсэн. `registeredBy` нь ЭНЭ асуултад
     * хариулж чадахгүй: харилцагчийн бүртгэсэн ачаанд ч, seed/системийн
     * бичлэгт ч `null` байдаг тул хоёрыг ялгах боломжгүй.
     *
     * Ажилтан урьдчилсан бичлэгийг шингээхэд (adopt) энэ утга ӨӨРЧЛӨГДӨХГҮЙ —
     * "ачаа хаанаас эхэлсэн" гэдэг түүхэн баримт, дараагийн үйлдлээр
     * дарагдах ёсгүй. Ажилтан бүртгэсэн эсэхийг `registeredBy` заана.
     */
    registrationSource: {
      type: String,
      enum: REGISTRATION_SOURCE_LIST,
      default: REGISTRATION_SOURCE.STAFF,
    },
    /**
     * BR-46 — ХАРИЛЦАГЧИЙН бичсэн тайлбар ("улаан цүнх, Taobao").
     *
     * `note`-оос ЗААВАЛ тусдаа талбар: `note` бол ажилтны ДОТООД тэмдэглэл,
     * харилцагчид харагдахгүй (`customer-portal.service.js`-ийн цагаан
     * жагсаалт). Нэг талбарт нийлүүлбэл ажилтны дотоод тэмдэглэл харилцагчид
     * задарна, эсвэл харилцагчийн бичсэн зүйл ажилтанд хүрэхгүй.
     */
    customerNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    /**
     * BR-06 — Менежер/Админ шалтгаантайгаар зөвшөөрсөн давхардал.
     */
    isDuplicateApproved: {
      type: Boolean,
      default: false,
    },

    /**
     * ДАВХАРДЛЫГ ХОРИГЛОХ ТҮЛХҮҮР — доорх unique index үүн дээр тавигдана.
     *
     * Утга нь: тухайн дугаарыг ЭЗЭМШИЖ байвал `trackingNumber`, эс бөгөөс `null`.
     *   • ердийн ачаа            → trackingNumber (давхардлыг хориглоно)
     *   • зөвшөөрөгдсөн давхардал → null (BR-06)
     *   • хүчингүй болсон ачаа    → null (BR-05 — дугаарыг чөлөөлнө)
     *
     * ЯАГААД ТУСДАА ТАЛБАР: `partialFilterExpression` нь `$ne`-г дэмждэггүй тул
     * "хүчингүй биш ачаа дээр л unique" гэсэн дүрмийг индексээр илэрхийлэх
     * боломжгүй. Индексийг `{ isDuplicateApproved: false }`-оор тавибал хүчингүй
     * болсон ачаа дугаараа үүрд хааж, ажилтан алдаагаа засаад дахин бүртгэж
     * чадахгүй болно. Тиймээс "эзэмшил"-ийг тодорхой талбараар илэрхийлэв.
     */
    activeTrackingNumber: {
      type: String,
      default: null,
    },

    // §1.6 — хүчингүй болгосон бол (BR-11)
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
  },
  { timestamps: true }
);

/**
 * §1.3, BR-05/BR-06 — ДАВХАР БҮРТГЭЛИЙН ХАМГААЛАЛТ.
 *
 * Service давхарга мөн шалгадаг ч ГОЛ хамгаалалт нь ЭНЭ индекс: хоёр ажилтан
 * яг зэрэг ижил дугаар бүртгэхэд "олоод байхгүй бол үүсгэх" гэсэн хоёр алхмын
 * хооронд аль нэг нь оръё гэж хүлээж байдаг. Зөвхөн DB атомик шалгаж чадна.
 */
packageSchema.index(
  { activeTrackingNumber: 1 },
  { unique: true, partialFilterExpression: { activeTrackingNumber: { $type: 'string' } } }
);

/**
 * §9.3 — 1M+ мөр, хайлт < 1 сек.
 *
 * Индекс бүр БОДИТ query-д харгалзана:
 *   customerPhone+createdAt — "утас бичихэд бүх ачаа" (BR-26), хамгийн түгээмэл
 *   status+createdAt        — "хүргэлтэнд гарах ачаанууд" дэлгэц
 *   locationCode           — тавиур цэвэрлэх, байршлаар шалгах (§8)
 *   branchId+status+…      — Менежерийн салбарын хамрах хүрээ (BR-37)
 *   paymentStatus+status   — "төлбөр хүлээгдэж буй" дэлгэц, тайлан
 */
packageSchema.index({ trackingNumber: 1, createdAt: -1 });
packageSchema.index({ customerPhone: 1, createdAt: -1 });
packageSchema.index({ customerId: 1, createdAt: -1 });
packageSchema.index({ status: 1, createdAt: -1 });
packageSchema.index({ locationCode: 1 });
packageSchema.index({ branchId: 1, status: 1, createdAt: -1 });
packageSchema.index({ createdAt: -1 });
packageSchema.index({ paymentStatus: 1, status: 1 });
// Dashboard-ын 30 хоногийн «Монголд ирсэн ачаа» график — ирсэн огноогоор range scan.
packageSchema.index({ branchId: 1, arrivedAt: -1 });
packageSchema.index({ arrivedAt: -1 });
// Төлбөрийн насжилт: салбарын төлөөгүй/хэсэгчлэн төлсөн ачааг ирсэн огноогоор ангилна.
packageSchema.index({ branchId: 1, paymentStatus: 1, arrivedAt: -1 });

/**
 * Байршлын ачааллыг эргэн тооцоолох cron-д (docs/data-model.md §7) хэрэгтэй:
 * "тухайн нүдэнд ХЭВЭЭР байгаа ачаа" гэсэн query индексээр хучигдсан байх ёстой.
 */
packageSchema.index({ locationId: 1, status: 1 });

packageSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

packageSchema.plugin(require('mongoose-paginate-v2'));

module.exports = mongoose.model('Package', packageSchema);
