'use strict';

const mongoose = require('mongoose');
const { EXPENSE_CATEGORY, EXPENSE_CATEGORY_LIST, EXPENSE_STATUS, EXPENSE_STATUS_LIST } = require('../config/constants');
const Schema = mongoose.Schema;

/**
 * Зарлага — байгууллагын ерөнхий зардлын бүртгэл (BR-47).
 *
 * НЭГ БИЧЛЭГ = НЭГ УДААГИЙН ЗАРЛАГА. Буруу бүртгэсэн зарлагыг ХЭЗЭЭ Ч
 * устгахгүй, зөвхөн `voided` болгоно (BR-47, CLAUDE.md §5 дүрэм 4,
 * `payments`-ийн BR-18-тай ижил зарчим).
 *
 * Бүх мөнгөн дүн БҮХЭЛ ТОО, нэгж ₮ (CLAUDE.md §5 дүрэм 2).
 */
const expenseSchema = new Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: [1, 'Зарлагын дүн 1₮-өөс багагүй байна'],
      validate: { validator: Number.isInteger, message: 'Дүн бүхэл тоо (₮) байх ёстой' },
    },

    category: {
      type: String,
      enum: EXPENSE_CATEGORY_LIST,
      required: true,
    },

    // Зөвхөн category:'other' үед ашиглагдана — доорх pre('validate') шалгана.
    categoryLabel: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    description: {
      type: String,
      trim: true,
      minlength: 3,
      maxlength: 500,
      required: true,
    },

    // Зарлага гарсан өдөр — тайлангийн бүлэглэлт эндээс (BR-47a). `createdAt`-аас
    // ялгаатай байж болно (ажилтан хожимдож бүртгэсэн ч зөв өдөрт тооцогдоно).
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },

    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },

    status: {
      type: String,
      enum: EXPENSE_STATUS_LIST,
      default: EXPENSE_STATUS.ACTIVE,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Ажилтан устсан ч түүхэнд нэр үлдэнэ (payment.receivedByName-тэй ижил зарчим)
    createdByName: {
      type: String,
      default: null,
    },

    // BR-47 — устгахгүй, хүчингүй болгоно (payment.model.js-ийн void гурвалтай ижил)
    voidedAt: { type: Date, default: null },
    voidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    voidReason: { type: String, trim: true, maxlength: 500, default: null },
  },
  { timestamps: true }
);

/**
 * BR-47 — "Бусад" ангилалд нэр заавал. Хяналт ЭНД, DB руу орох замд —
 * service-ийн шинэ зам нэмэгдэхэд тойрч гарах боломжгүй байх ёстой.
 */
expenseSchema.pre('validate', function requireCategoryLabelForOther(next) {
  if (this.category === EXPENSE_CATEGORY.OTHER && !this.categoryLabel) {
    return next(new Error('"Бусад" ангилалд нэр заавал бичнэ үү'));
  }
  if (this.category !== EXPENSE_CATEGORY.OTHER) {
    this.categoryLabel = null;
  }
  return next();
});

expenseSchema.index({ date: -1, branchId: 1 });
expenseSchema.index({ status: 1, date: -1 });
expenseSchema.index({ category: 1, date: -1 });
expenseSchema.index({ branchId: 1, createdAt: -1 });

expenseSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

expenseSchema.plugin(require('mongoose-paginate-v2'));

module.exports = mongoose.model('Expense', expenseSchema);
