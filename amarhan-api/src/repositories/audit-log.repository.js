'use strict';

const BaseRepository = require('./base.repository');
const AuditLog = require('../models/audit-log.model');

class AuditLogRepository extends BaseRepository {
  constructor() {
    super(AuditLog);
  }

  /**
   * Audit бичлэг үүсгэнэ. Транзакцын session-ийг дэмжинэ (BR-41).
   *
   * `insertMany` ашиглаж байгаа шалтгаан: `create()`-ийн session дамжуулалт
   * mongoose-ийн хувилбар бүрт өөр ажилладаг тул тодорхой хэлбэрийг сонгов.
   */
  async record(entry, { session } = {}) {
    const [doc] = await this.model.create([entry], session ? { session } : {});
    return doc;
  }

  /**
   * §9.2 — ачаа, ажилтан, огноо, үйлдлээр шүүж хайх.
   */
  async search(query = {}, options = {}) {
    const { page = 1, limit = 50, entity, entityId, actorId, action, from, to, branchId } = options;

    const filter = { ...query };

    if (entity) filter.entity = entity;
    if (entityId) filter.entityId = entityId;
    if (actorId) filter.actorId = actorId;
    if (action) filter.action = action;
    if (branchId) filter.branchId = branchId;

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = from;
      if (to) filter.createdAt.$lte = to;
    }

    return this.paginate(filter, { page, limit, sort: { createdAt: -1 } });
  }

  /**
   * Нэг объектын бүх өөрчлөлтийн түүх (ачааны дэлгэрэнгүй хуудсанд).
   */
  async findByEntity(entity, entityId, limit = 100) {
    return this.model.find({ entity, entityId }).sort({ createdAt: -1 }).limit(limit);
  }
}

module.exports = new AuditLogRepository();
