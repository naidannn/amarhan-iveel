'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Дараалсан дугаар үүсгэх тоолуур — нэхэмжлэхийн дугаарт (§2.3).
 *
 * ЯАГААД `countDocuments() + 1` БОЛОХГҮЙ: хоёр ажилтан яг зэрэг нэхэмжлэх
 * үүсгэхэд хоёулаа ижил тоо уншиж, ИЖИЛ дугаар авна. Unique index нь нэгийг
 * хаяна — ажилтны ажил алдагдана. Мөн нэхэмжлэх хүчингүй болоход тоо буурч,
 * дугаар ДАХИН хэрэглэгдэх болно (санхүүгийн баримтад хориотой).
 *
 * `findOneAndUpdate` + `$inc` нь MongoDB-д атомик тул зэрэг дуудлага ч
 * ялгаатай тоо авна. Дугаар нь ЦООРХОЙТОЙ байж болно (транзакц буцсан үед) —
 * энэ нь хэвийн: баримтын дугаар давхардахгүй байх нь цоорхойгүй байхаас
 * илүү чухал.
 */
const counterSchema = new Schema(
  {
    // `invoice`, `receipt` г.м.
    key: {
      type: String,
      required: true,
      unique: true,
    },
    seq: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Counter', counterSchema);
