'use strict';

const mongoose = require('mongoose');
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
    pricePerKg: {
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
    minimumCharge: {
      type: Number,
      required: true,
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
 * `calculatePrice()`-д дамжуулах цэвэр объект.
 * Домэйн функц Mongoose баримтаас хамаарах ёсгүй.
 */
tariffVersionSchema.methods.toTariff = function () {
  return {
    pricePerKg: this.pricePerKg,
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
