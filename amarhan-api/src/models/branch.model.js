'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Салбар / агуулах байршил — introduction.md §8
 *
 * Салбарын код нь байршлын кодын эхний хэсэг болно (`ER`-02-B-15).
 * Ирээдүйд шинэ агуулах нэмэгдэхэд зөвхөн шинэ салбар нэмнэ — бүтэц өөрчлөгдөхгүй.
 */
const branchSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      // 2 латин үсэг — байршлын кодын форматтай нийцнэ (BR-22)
      match: [/^[A-Z]{2}$/, 'Салбарын код 2 латин үсэг байх ёстой'],
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    country: {
      type: String,
      trim: true,
      maxlength: 50,
      default: null,
    },
    // Харилцагчийн вэбэд харагдана — онлайн дэлгүүрээс захиалахад хэрэгтэй (§3)
    address: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 50,
      default: null,
    },
    receiverName: {
      type: String,
      trim: true,
      maxlength: 100,
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

branchSchema.set('toJSON', {
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

branchSchema.plugin(require('mongoose-paginate-v2'));

module.exports = mongoose.model('Branch', branchSchema);
