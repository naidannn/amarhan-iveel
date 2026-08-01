'use strict';

const BaseRepository = require('./base.repository');
const Notification = require('../models/notification.model');
const { NOTIFICATION_AUDIENCE } = require('../config/constants');

class NotificationRepository extends BaseRepository {
  constructor() {
    super(Notification);
  }

  /**
   * Идэвхтэй (хугацаа дуусаагүй) нийтийн зарлал шүүлт — `expiresAt: null`
   * бол хугацаагүй.
   */
  activeBroadcastFilter(now = new Date()) {
    return {
      audience: NOTIFICATION_AUDIENCE.ALL,
      $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }],
    };
  }

  /**
   * §7 — Админ панелийн илгээсэн зарлалын түүх. Хугацаа дууссан ч орно
   * (илгээсэн бүхнийг харах ёстой).
   */
  async listSent({ page = 1, limit = 20 } = {}) {
    return this.paginate(
      { audience: NOTIFICATION_AUDIENCE.ALL },
      { page, limit, sort: { createdAt: -1 } }
    );
  }

  /**
   * Харилцагчийн мэдэгдлийн жагсаалт — ХУВИЙН болон идэвхтэй НИЙТИЙН
   * зарлалыг НЭГ query, нэг хуудаслалтаар буцаана.
   */
  async findMergedForCustomer(customerId, { page = 1, limit = 20 } = {}) {
    return this.paginate(
      {
        $or: [
          { audience: NOTIFICATION_AUDIENCE.CUSTOMER, customerId },
          this.activeBroadcastFilter(),
        ],
      },
      { page, limit, sort: { createdAt: -1 } }
    );
  }

  /**
   * §7, roadmap 6.3 — нэвтрээгүй зочны мэдэгдлийн хуудас. Идэвхтэй нийтийн
   * зарлал бүр аль хэдийн БҮХ харилцагчид зориулагдсан (§1.1-ийн цагаан
   * жагсаалтын зарчмаар үнэ/утас/байршил агуулаагүй энгийн текст) тул
   * зочинд ХАРУУЛАХГҮЙ гэсэн тусдаа флаг шаардлагагүй.
   */
  async findActiveBroadcasts({ page = 1, limit = 20 } = {}) {
    return this.paginate(this.activeBroadcastFilter(), { page, limit, sort: { createdAt: -1 } });
  }

  async countUnreadPersonal(customerId) {
    return this.model.countDocuments({
      customerId,
      audience: NOTIFICATION_AUDIENCE.CUSTOMER,
      readAt: null,
    });
  }

  /** @returns {Promise<import('mongoose').Types.ObjectId[]>} */
  async findActiveBroadcastIds(now = new Date()) {
    const docs = await this.model.find(this.activeBroadcastFilter(now)).select('_id').lean();
    return docs.map(d => d._id);
  }

  async markAllPersonalRead(customerId) {
    return this.model.updateMany(
      { customerId, audience: NOTIFICATION_AUDIENCE.CUSTOMER, readAt: null },
      { readAt: new Date() }
    );
  }
}

module.exports = new NotificationRepository();
