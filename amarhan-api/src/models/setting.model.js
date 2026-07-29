'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Системийн тохиргоо — key-value.
 *
 * Бизнесийн шийдвэрээс хамаарах тоон утгууд (override-ийн хязгаар, устгах цонх,
 * тарифын босго) кодод ХАТУУ БИЧИГДЭХГҮЙ. Ингэснээр өөрчлөхөд deploy шаардахгүй,
 * өөрчлөлт бүр audit-д бичигдэнэ.
 *
 * Түлхүүрүүд: config/constants.js → SETTING_KEY
 */
const settingSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

settingSchema.set('toJSON', {
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Setting', settingSchema);
