'use strict';

const mongoose = require('mongoose');
const { AUDIT_ACTION_LIST } = require('../config/constants');
const Schema = mongoose.Schema;

/**
 * Audit Log — introduction.md §9.2
 *
 * Зорилго: хэн, хэзээ, ямар өөрчлөлт хийснийг бүрэн хянах; маргаан гарахад нотолгоо болох.
 *
 * ДҮРЭМ: append-only. Засах, устгах боломжгүй (BR-39). Хадгалах хугацаа доод тал нь
 * 3 жил тул TTL index ЗОРИУДААР тавиагүй — санамсаргүй устгалаас сэргийлнэ.
 */
const auditLogSchema = new Schema(
  {
    // Хэн
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    // Ажилтны бичлэг устсан ч түүхэнд нэр үлдэнэ
    actorName: {
      type: String,
      required: true,
    },
    actorRole: {
      type: String,
    },

    // Юу
    action: {
      type: String,
      required: true,
      enum: AUDIT_ACTION_LIST,
    },
    entity: {
      type: String,
      required: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    // Хүн уншихад ойлгомжтой таних тэмдэг (жишээ: TRK-88213)
    entityLabel: {
      type: String,
      default: null,
    },

    // Ямар өөрчлөлт
    field: {
      type: String,
      default: null,
    },
    before: {
      type: Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: Schema.Types.Mixed,
      default: null,
    },
    reason: {
      type: String,
      default: null,
    },

    // Хаанаас
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
    },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    requestId: { type: String, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// §9.2 — ачаа, ажилтан, огнооны хугацаагаар шүүж хайх
auditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ branchId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

/**
 * Append-only хамгаалалт.
 *
 * Mongoose түвшний хамгаалалт нь санамсаргүй алдаанаас хамгаална. Зорилготой
 * халдлагаас хамгаалахын тулд production-д DB хэрэглэгчид энэ коллекцод зөвхөн
 * insert эрх өгөх нь илүү найдвартай (docs/security-and-permissions.md §5).
 */
const blockMutation = function (next) {
  next(new Error('Audit log өөрчлөх боломжгүй (append-only)'));
};

[
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
].forEach(op => auditLogSchema.pre(op, blockMutation));

// Хадгалагдсан бичлэгийг дахин save() хийхийг хориглоно (шинэ бичлэг үүсгэхийг зөвшөөрнө)
auditLogSchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(new Error('Audit log өөрчлөх боломжгүй (append-only)'));
  }
  return next();
});

auditLogSchema.set('toJSON', {
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

auditLogSchema.plugin(require('mongoose-paginate-v2'));

module.exports = mongoose.model('AuditLog', auditLogSchema);
