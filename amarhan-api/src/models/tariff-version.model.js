'use strict';

const mongoose = require('mongoose');
const { assertValidBrackets } = require('../domain/pricing');
const Schema = mongoose.Schema;

/**
 * Тарифын хувилбар — introduction.md §1.2, BR-02
 *
 * ХУВИЛБАРЖУУЛСАН ШАЛТГААН: тариф өөрчлөгдөхөд ӨМНӨХ ачааны үнэ өөрчлөгдөх ёсгүй.
 * Тиймээс тариф засах бүрт хуучин мөрийг ХЭЗЭЭ Ч дарж бичихгүй — шинэ хувилбар
 * үүсгэж, хуучныг `effectiveTo`-гоор хаана.
 *
 * Ачаа бүртгэгдэхдээ мөн тухайн үеийн утгыг өөр дээрээ хуулж хадгална
 * (`pricingSnapshot`, Phase 2) — тариф устсан ч түүх гажихгүй.
 *
 * Бүх мөнгөн дүн БҮХЭЛ ТОО, нэгж ₮.
 */
const tariffVersionSchema = new Schema(
  {
    cargoTypeId: {
      type: Schema.Types.ObjectId,
      ref: 'CargoType',
      required: true,
    },

    /**
     * Жингийн шатлал — жижиг илгээмжид ТОГТМОЛ үнэ.
     * Жишээ: [{maxGrams: 100, price: 800}, {maxGrams: 500, price: 1500}]
     * Хоосон бол ачаа эхнээсээ кг-аар тооцогдоно.
     * maxGrams өсөх дарааллаар байх ёстой (pre-validate hook шалгана).
     */
    weightBrackets: {
      type: [
        {
          maxGrams: { type: Number, required: true, min: 1 },
          price: {
            type: Number,
            required: true,
            min: 0,
            validate: { validator: Number.isInteger, message: 'Шатлалын үнэ бүхэл тоо байх ёстой' },
          },
          _id: false,
        },
      ],
      default: [],
    },

    /** Шатлалаас дээш 1 кг тутмын үнэ (кг руу дээш дугуйруулна) */
    pricePerKgAbove: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: '₮/кг бүхэл тоо байх ёстой',
      },
    },
    pricePerM3: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: '₮/м³ бүхэл тоо байх ёстой',
      },
    },
    /**
     * Доод хэмжээний төлбөр. Шатлалтай тарифд ихэвчлэн 0 — хамгийн бага
     * шатлал өөрөө доод хэмжээний үүргийг гүйцэтгэдэг.
     */
    minimumCharge: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Доод хэмжээ бүхэл тоо байх ёстой',
      },
    },

    effectiveFrom: {
      type: Date,
      required: true,
      default: Date.now,
    },
    // null = одоо идэвхтэй хувилбар
    effectiveTo: {
      type: Date,
      default: null,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
  },
  { timestamps: true }
);

tariffVersionSchema.index({ cargoTypeId: 1, effectiveFrom: -1 });
// Ачааны төрөл бүрт идэвхтэй хувилбар зөвхөн НЭГ байна
tariffVersionSchema.index(
  { cargoTypeId: 1 },
  { unique: true, partialFilterExpression: { effectiveTo: null } }
);

/**
 * Шатлалын дараалал/давхцлыг ХАДГАЛАХААС ӨМНӨ шалгана.
 * Буруу дараалалтай шатлал үнийг чимээгүй буруу бодуулна.
 */
tariffVersionSchema.pre('validate', function (next) {
  try {
    assertValidBrackets(this.weightBrackets ?? []);
    return next();
  } catch (err) {
    return next(err);
  }
});

/**
 * `calculatePrice()`-д дамжуулах цэвэр объект.
 * Домэйн функц Mongoose баримтаас хамаарах ёсгүй.
 */
tariffVersionSchema.methods.toTariff = function () {
  return {
    weightBrackets: (this.weightBrackets ?? []).map(b => ({
      maxGrams: b.maxGrams,
      price: b.price,
    })),
    pricePerKgAbove: this.pricePerKgAbove,
    pricePerM3: this.pricePerM3,
    minimumCharge: this.minimumCharge,
  };
};

tariffVersionSchema.set('toJSON', {
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

tariffVersionSchema.plugin(require('mongoose-paginate-v2'));

module.exports = mongoose.model('TariffVersion', tariffVersionSchema);
