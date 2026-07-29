'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Ачааны төрөл — introduction.md §1.2
 *
 * Энгийн / Хэврэг / Том оврын. Төрөл бүр өөрийн тарифтай (`tariff_versions`).
 * Шинэ төрөл нэмэх боломжтой — кодод хатуу бичээгүй.
 */
const cargoTypeSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9_]+$/, 'Код зөвхөн жижиг үсэг, тоо, доогуур зураас агуулна'],
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

cargoTypeSchema.set('toJSON', {
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

cargoTypeSchema.plugin(require('mongoose-paginate-v2'));

module.exports = mongoose.model('CargoType', cargoTypeSchema);
