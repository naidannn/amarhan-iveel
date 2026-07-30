'use strict';

const mongoose = require('mongoose');
const { CODE_PATTERN } = require('../domain/location-code');
const Schema = mongoose.Schema;

/**
 * Агуулахын байршил — introduction.md §8
 *
 * Салбар → Өрөө → Тавиур → Мөр → Нүд шатлалын НАВЧ (нүд) бүрт нэг бичлэг.
 * Жишээ код: `UB-02-B-15`
 */
const warehouseLocationSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      match: [CODE_PATTERN, 'Байршлын кодын формат буруу (жишээ: UB-02-B-15)'],
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    // Кодын бүрдэл хэсгүүд — шүүлт, эрэмбэлэлтэд ашиглагдана
    branchCode: { type: String, required: true, uppercase: true },
    room: { type: String, required: true },
    shelf: { type: String, required: true, uppercase: true },
    row: { type: Number, required: true, min: 1, max: 9 },
    cell: { type: Number, required: true, min: 1, max: 9 },

    // Багтаамжийн хязгаар — Админ тохируулна (§8).
    // null = хязгааргүй.
    capacityCount: { type: Number, default: null, min: 0 },
    capacityM3: { type: Number, default: null, min: 0 },

    /**
     * Одоогийн ачаалал — КЭШЛЭГДСЭН утга.
     * Ачаа орох/гарах бүрт транзакц дотор $inc хийнэ (Phase 2).
     * Өдөр бүр packages-аас дахин тооцож зөрүү шалгах cron ажиллана.
     */
    currentCount: { type: Number, default: 0, min: 0 },
    currentM3: { type: Number, default: 0, min: 0 },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// §9.3 — байршлаар хайх, хоосон нүд олох query-нүүд индекслэгдсэн байна
warehouseLocationSchema.index({ branchId: 1, room: 1, shelf: 1, row: 1, cell: 1 });
warehouseLocationSchema.index({ branchId: 1, isActive: 1, currentCount: 1 });

/**
 * Нүд дүүрсэн эсэх. Дүүрсэн ч бүртгэхийг ХОРИГЛОХГҮЙ — зөвхөн сануулга
 * харуулна (BR-24). Ажилтны шийдвэрийг систем дарж болохгүй.
 */
warehouseLocationSchema.virtual('isFull').get(function () {
  if (this.capacityCount != null && this.currentCount >= this.capacityCount) return true;
  if (this.capacityM3 != null && this.currentM3 >= this.capacityM3) return true;
  return false;
});

warehouseLocationSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

warehouseLocationSchema.plugin(require('mongoose-paginate-v2'));

module.exports = mongoose.model('WarehouseLocation', warehouseLocationSchema);
