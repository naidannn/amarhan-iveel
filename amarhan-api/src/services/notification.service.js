'use strict';

const httpStatus = require('http-status');
const notificationRepository = require('../repositories/notification.repository');
const notificationReadRepository = require('../repositories/notification-read.repository');
const auditService = require('./audit.service');
const APIError = require('../utils/APIError');
const logger = require('../utils/logger');
const { AUDIT_ACTION, AUDIT_ENTITY, NOTIFICATION_AUDIENCE, PACKAGE_STATUS, ROLES } = require('../config/constants');

/** "12,000" — алдааны мессежид ашигладаг мянгатын тусгаарлалттай ижил хэлбэр. */
function formatAmount(value) {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Мэдэгдэл — introduction.md §7 (Phase 6)
 *
 * Хоёр урсгал:
 *   1. ХУВИЙН — `notifyPackageEvent()`, ачааны эвентээс систем автоматаар
 *      үүсгэнэ (BR-35). ХЭЗЭЭ Ч throw хийхгүй — дуудагч (package.service.js)
 *      талын транзакцыг блоклохгүй байх ёстой.
 *   2. НИЙТИЙН — `sendBroadcast()`, Админ/Менежер бүх харилцагчид зарлал
 *      илгээнэ (BR-36).
 */
class NotificationService {
  isManagement(actor) {
    return actor?.role === ROLES.ADMIN || actor?.role === ROLES.MANAGER;
  }

  // ── Ажилтнаас: нийтийн зарлал ───────────────────────────────────────────

  async sendBroadcast({ title, body, expiresAt }, actor, req) {
    if (!this.isManagement(actor)) {
      throw new APIError(
        'Мэдэгдэл илгээх эрх зөвхөн Админ, Менежерт байна',
        httpStatus.FORBIDDEN
      );
    }

    const doc = await notificationRepository.create({
      title,
      body,
      audience: NOTIFICATION_AUDIENCE.ALL,
      expiresAt: expiresAt ?? null,
      createdBy: actor._id,
    });

    await auditService.record({
      actor,
      action: AUDIT_ACTION.NOTIFICATION_SEND,
      entity: AUDIT_ENTITY.NOTIFICATION,
      entityId: doc._id,
      entityLabel: doc.title,
      after: { title: doc.title, body: doc.body, expiresAt: doc.expiresAt },
      req,
    });

    return doc;
  }

  async listSent(query, actor) {
    if (!this.isManagement(actor)) {
      throw new APIError('Мэдэгдлийн жагсаалт харах эрх зөвхөн Админ, Менежерт байна', httpStatus.FORBIDDEN);
    }

    const result = await notificationRepository.listSent(query);
    return {
      data: result.docs,
      pagination: {
        page: result.page,
        pages: result.totalPages,
        total: result.totalDocs,
        limit: result.limit,
      },
    };
  }

  /**
   * §7, roadmap 6.3 — нэвтрээгүй зочинд харагдах идэвхтэй нийтийн зарлал.
   *
   * ⚠ `public.service.js`-ийн зарчмын дагуу цагаан жагсаалттай хариу: зөвхөн
   * зарлалын агуулга (`title`/`body`/огноо) — `createdBy`, дотоод ID гэх мэт
   * зүйл гарахгүй (docs/business-rules.md §15, `/v1/public/*` дүрэм).
   */
  async listPublic({ page = 1, limit = 20 } = {}) {
    const result = await notificationRepository.findActiveBroadcasts({ page, limit });
    return {
      data: result.docs.map(d => ({
        id: d._id,
        title: d.title,
        body: d.body,
        createdAt: d.createdAt,
      })),
      pagination: {
        page: result.page,
        pages: result.totalPages,
        total: result.totalDocs,
        limit: result.limit,
      },
    };
  }

  // ── Автомат хувийн мэдэгдэл (BR-35) ─────────────────────────────────────

  /**
   * @param {object} pkg — шинэчлэгдсэн/үүссэн ачааны бичлэг
   * @param {string} event — 'created' | PACKAGE_STATUS-ийн утга
   * @returns {Promise<object|null>} үүссэн мэдэгдэл, эсвэл `null` (харилцагчгүй/
   *   танигдаагүй эвент/алдаа)
   */
  async notifyPackageEvent(pkg, event) {
    try {
      if (!pkg?.customerId) return null; // BR-45 update — утас/харилцагч заавал биш

      const copy = this.packageEventCopy(pkg, event);
      if (!copy) return null;

      return await notificationRepository.create({
        title: copy.title,
        body: copy.body,
        audience: NOTIFICATION_AUDIENCE.CUSTOMER,
        customerId: pkg.customerId,
        entity: 'package',
        entityId: pkg._id,
        entityLabel: pkg.trackingNumber,
      });
    } catch (err) {
      // BR-35 — мэдэгдэл илгээх нь ачааны төлөв өөрчлөх урсгалыг блоклохгүй
      logger.error('Ачааны мэдэгдэл үүсгэхэд алдаа гарлаа', {
        event,
        packageId: pkg?._id,
        message: err.message,
      });
      return null;
    }
  }

  packageEventCopy(pkg, event) {
    switch (event) {
      case 'created':
        return pkg.status === PACKAGE_STATUS.IN_ERLIAN
          ? {
              title: 'Ачаа Эрээнд бүртгэгдлээ',
              body: `${pkg.trackingNumber} дугаартай ачаа таны нэр дээр Эрээнд бүртгэгдлээ.`,
            }
          : {
              title: 'Ачаа бүртгэгдлээ',
              body: `${pkg.trackingNumber} дугаартай ачаа таны нэр дээр бүртгэгдлээ.`,
            };
      case PACKAGE_STATUS.REGISTERED:
        return {
          title: 'Ачаа Монголд ирлээ',
          body: `Таны ${pkg.trackingNumber} дугаартай ачаа Монголд ирлээ.`,
        };
      case PACKAGE_STATUS.AWAITING_PAYMENT:
        return {
          title: 'Төлбөр төлөх шаардлагатай',
          body: `${pkg.trackingNumber}: төлбөр төлөх шаардлагатай (${formatAmount(pkg.balance)}₮).`,
        };
      case PACKAGE_STATUS.OUT_FOR_DELIVERY:
        return {
          title: 'Ачаа хүргэлтэнд гарлаа',
          body: `Таны ${pkg.trackingNumber} дугаартай ачаа хүргэлтэнд гарлаа.`,
        };
      default:
        return null;
    }
  }

  // ── Харилцагчийн вэб ─────────────────────────────────────────────────────

  async listForCustomer(customerId, { page = 1, limit = 20 } = {}) {
    const result = await notificationRepository.findMergedForCustomer(customerId, { page, limit });

    const broadcastIds = result.docs
      .filter(d => d.audience === NOTIFICATION_AUDIENCE.ALL)
      .map(d => d._id);
    const readIds = broadcastIds.length
      ? new Set(
          (await notificationReadRepository.readNotificationIds(customerId, broadcastIds)).map(String)
        )
      : new Set();

    return {
      data: result.docs.map(d => ({
        id: d._id,
        title: d.title,
        body: d.body,
        entity: d.entity,
        entityId: d.entityId,
        entityLabel: d.entityLabel,
        audience: d.audience,
        read: d.audience === NOTIFICATION_AUDIENCE.CUSTOMER ? Boolean(d.readAt) : readIds.has(String(d._id)),
        createdAt: d.createdAt,
      })),
      pagination: {
        page: result.page,
        pages: result.totalPages,
        total: result.totalDocs,
        limit: result.limit,
      },
    };
  }

  async unreadCount(customerId) {
    const personalUnread = await notificationRepository.countUnreadPersonal(customerId);
    const activeBroadcastIds = await notificationRepository.findActiveBroadcastIds();
    const readCount = activeBroadcastIds.length
      ? await notificationReadRepository.countReadAmong(customerId, activeBroadcastIds)
      : 0;

    return { count: personalUnread + Math.max(activeBroadcastIds.length - readCount, 0) };
  }

  /**
   * §7, дүрэм 14 — эрхгүй/олдоогүй бичлэгт 404 (403 БИШ).
   */
  async markRead(customerId, notificationId) {
    const doc = await notificationRepository.findById(notificationId);
    if (!doc) {
      throw new APIError('Мэдэгдэл олдсонгүй', httpStatus.NOT_FOUND);
    }

    if (doc.audience === NOTIFICATION_AUDIENCE.CUSTOMER) {
      if (String(doc.customerId) !== String(customerId)) {
        throw new APIError('Мэдэгдэл олдсонгүй', httpStatus.NOT_FOUND);
      }
      if (!doc.readAt) {
        await notificationRepository.updateById(doc._id, { readAt: new Date() });
      }
    } else {
      await notificationReadRepository.upsertRead(doc._id, customerId);
    }

    return { success: true };
  }

  async markAllRead(customerId) {
    await notificationRepository.markAllPersonalRead(customerId);

    const activeBroadcastIds = await notificationRepository.findActiveBroadcastIds();
    await Promise.all(activeBroadcastIds.map(id => notificationReadRepository.upsertRead(id, customerId)));

    return { success: true };
  }
}

module.exports = new NotificationService();
