'use strict';

const mongoose = require('mongoose');
const { DELIVERY_STATUS, DELIVERY_STATUS_LIST } = require('../config/constants');
const Schema = mongoose.Schema;

/**
 * Хүргэлт — introduction.md §5, docs/data-model.md §10
 *
 * НЭГ БИЧЛЭГ = НЭГ ХАРИЛЦАГЧИД НЭГ ХАЯГ РУУ ЯВАХ БАГЦ. Олон харилцагчийн
 * ачааг нэг бичлэгт холихгүй: хаяг, утас, хүлээн авагч нэг байх ёстой,
 * мөн `returned` болоход хэний ачаа буцсаныг ялгах боломжгүй болно.
 *
 * ТООЦООНЫ ЭХ СУРВАЛЖ БИШ. Ачааны `balance` нь үргэлж `payments.allocations`-аас
 * гарна (BR-14). Хүргэлт нь зөвхөн ХӨДӨЛГӨӨНИЙ баримт — §5.2-ын хаалт нь
 * ачааны үлдэгдлийг УНШИЖ шалгадаг, өөрөө мөнгө бичдэггүй.
 *
 * Бүх мөнгөн дүн БҮХЭЛ ТОО, нэгж ₮ (CLAUDE.md §5 дүрэм 2).
 */
const deliverySchema = new Schema(
  {
    deliveryNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    // Хайлт, маршрутын хуудас хэвлэхэд хуулбарласан (BR-27 нормчлогдсон)
    customerPhone: {
      type: String,
      required: true,
      match: [/^\d{8}$/, 'Утасны дугаар 8 оронтой байх ёстой'],
    },

    packageIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Package',
        required: true,
      },
    ],

    // ── Хүргэх хаяг ─────────────────────────────────────────────────────────
    address: {
      type: String,
      required: [true, 'Хүргэх хаягийг бичнэ үү'],
      trim: true,
      maxlength: 500,
    },
    /**
     * Хүлээн авагчийн утас. `customerPhone`-оос ЯЛГААТАЙ байж болно —
     * харилцагч ачаагаа гэр бүлийн гишүүн, ажлын хаягаар авахуулах нь элбэг.
     */
    phone: {
      type: String,
      required: true,
      match: [/^\d{8}$/, 'Утасны дугаар 8 оронтой байх ёстой'],
    },
    note: { type: String, trim: true, maxlength: 500, default: null },

    status: {
      type: String,
      enum: DELIVERY_STATUS_LIST,
      default: DELIVERY_STATUS.CREATED,
    },

    /**
     * Жолооч. Системд бүртгэлтэй ажилтан бол `driverId`, гэрээт/гадны жолооч
     * бол зөвхөн нэр, утас. Хоёуланг зөвшөөрч байгаа шалтгаан: жолооч бүрд
     * системийн эрх нээх шаардлагагүй бөгөөд шаардвал ажилтан гацна.
     *
     * `driverName` нь ХУУЛБАР — ажилтан устсан ч маршрутын түүхэнд нэр үлдэнэ
     * (`payments.receivedByName`-ийн ижил зарчим).
     */
    driverId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    driverName: { type: String, trim: true, maxlength: 120, default: null },
    driverPhone: { type: String, trim: true, maxlength: 20, default: null },

    scheduledDate: { type: Date, default: null },
    dispatchedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },

    /**
     * Хүргэлтийн төлбөр — нээлттэй асуулт Q3 (docs/business-rules.md).
     *
     * ЗӨВХӨН МЭДЭЭЛЭЛ. Ачааны `balance`/`paidAmount`-д НӨЛӨӨЛӨХГҮЙ бөгөөд
     * §5.2-ын хаалтад ОРОХГҮЙ — эс тэгвээс мөнгө хоёр газраас бичигдэж
     * BR-14 зөрчигдөнө. Тарифжуулах шийдвэр гарвал Phase 8-д тооцоолол нэмнэ.
     */
    fee: {
      type: Number,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger, message: 'Дүн бүхэл тоо (₮) байх ёстой' },
    },

    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },

    // `null` = харилцагч өөрөө вэбээс захиалсан (§5, Phase 5)
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    /**
     * Төлөвийн түүх — `packages.statusHistory`-ийн ижил бүтэц.
     * Audit Log-д мөн бичигдэнэ, гэхдээ энэ нь баримтын ДЭЛГЭРЭНГҮЙ хуудсанд
     * нэг уншилтаар харагдах хэрэгцээг хангана.
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

    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, trim: true, maxlength: 500, default: null },
  },
  { timestamps: true }
);

/**
 * Хоосон эсвэл давхардсан багц DB руу орох ЗАМД хаагдана.
 *
 * Service давхарга шалгасан ч энэ hook нь ХОЁР ДАХЬ ДАВХАРГА: seed скрипт,
 * migration, эсвэл хожим нэмэгдэх шинэ зам шалгалтыг тойрч гарвал ачаагүй
 * хүргэлт, эсвэл нэг ачааг хоёр удаа тоолсон багц үүснэ.
 */
deliverySchema.pre('validate', function validatePackages(next) {
  if (!Array.isArray(this.packageIds) || this.packageIds.length === 0) {
    return next(new Error('Хүргэлтэд ядаж нэг ачаа байх шаардлагатай'));
  }

  const ids = this.packageIds.map(String);
  if (new Set(ids).size !== ids.length) {
    return next(new Error('Нэг ачаа хүргэлтэд хоёр удаа орсон байна'));
  }

  return next();
});

// §5 — өдрийн маршрут: "өнөөдөр гарах ёстой хүргэлтүүд"
deliverySchema.index({ status: 1, scheduledDate: 1 });
deliverySchema.index({ customerId: 1, createdAt: -1 });
// BR-20a — "энэ ачаа идэвхтэй хүргэлтэд байна уу"
deliverySchema.index({ packageIds: 1 });
deliverySchema.index({ branchId: 1, createdAt: -1 });
deliverySchema.index({ createdAt: -1 });
deliverySchema.index({ driverId: 1, scheduledDate: -1 });

deliverySchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

deliverySchema.plugin(require('mongoose-paginate-v2'));

module.exports = mongoose.model('Delivery', deliverySchema);
