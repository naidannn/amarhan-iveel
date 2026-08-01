'use strict';

const BaseRepository = require('./base.repository');
const NotificationRead = require('../models/notification-read.model');

class NotificationReadRepository extends BaseRepository {
  constructor() {
    super(NotificationRead);
  }

  /** Идэмпотент — давхар дуудахад алдаа өгөхгүй. */
  async upsertRead(notificationId, customerId) {
    return this.model.findOneAndUpdate(
      { notificationId, customerId },
      { $setOnInsert: { notificationId, customerId, readAt: new Date() } },
      { upsert: true, new: true }
    );
  }

  /**
   * Тухайн харилцагчийн уншсан нийтийн зарлалын ID-нуудаас `notificationIds`
   * жагсаалтад байгааг нь буцаана (жагсаалтын хуудсыг мержихэд ашиглана).
   */
  async readNotificationIds(customerId, notificationIds) {
    if (!notificationIds.length) return [];
    return this.model.distinct('notificationId', {
      customerId,
      notificationId: { $in: notificationIds },
    });
  }

  async countReadAmong(customerId, notificationIds) {
    if (!notificationIds.length) return 0;
    return this.model.countDocuments({
      customerId,
      notificationId: { $in: notificationIds },
    });
  }
}

module.exports = new NotificationReadRepository();
