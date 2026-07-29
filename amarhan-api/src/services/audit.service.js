'use strict';

const httpStatus = require('http-status');
const auditLogRepository = require('../repositories/audit-log.repository');
const APIError = require('../utils/APIError');
const { ROLES } = require('../config/constants');

/**
 * Audit Log үйлчилгээ — introduction.md §9.2
 *
 * Мөнгө, төлөв, эрх, тохиргоо өөрчлөх бүх үйлдэл ЭНД бүртгэгдэнэ.
 * Дуудлага нь өөрчлөлттэй нэг транзакцад байх ёстой (BR-41) — session дамжуулна.
 */
class AuditService {
  /**
   * @param {object} entry
   * @param {object} entry.actor        — req.user (ажилтан)
   * @param {string} entry.action       — AUDIT_ACTION-ийн утга
   * @param {string} entry.entity       — AUDIT_ENTITY-ийн утга
   * @param {*}      [entry.entityId]
   * @param {string} [entry.entityLabel]
   * @param {string} [entry.field]
   * @param {*}      [entry.before]
   * @param {*}      [entry.after]
   * @param {string} [entry.reason]
   * @param {object} [entry.req]        — ip/userAgent/requestId авахад
   * @param {object} [options]
   * @param {import('mongoose').ClientSession} [options.session]
   */
  async record(entry, { session } = {}) {
    const {
      actor,
      action,
      entity,
      entityId = null,
      entityLabel = null,
      field = null,
      before = null,
      after = null,
      reason = null,
      branchId = null,
      req = null,
    } = entry;

    if (!action || !entity) {
      throw new Error('Audit бичлэгт action ба entity заавал шаардлагатай');
    }

    return auditLogRepository.record(
      {
        actorId: actor?._id ?? null,
        actorName: this.describeActor(actor),
        actorRole: actor?.role ?? null,
        action,
        entity,
        entityId,
        entityLabel,
        field,
        before,
        after,
        reason,
        branchId: branchId ?? actor?.branchId ?? null,
        ip: req?.ip ?? null,
        userAgent: req?.get?.('user-agent') ?? null,
        requestId: req?.id ?? null,
      },
      { session }
    );
  }

  /**
   * Нэг объектын олон талбар зэрэг өөрчлөгдсөн үед талбар тус бүрт бичлэг үүсгэнэ.
   * Ингэснээр "аль талбар хэзээ өөрчлөгдсөн" гэсэн асуултад шууд хариулна.
   */
  async recordChanges(entry, changes, { session } = {}) {
    const fields = Object.keys(changes).filter(
      f => !this.isEqual(changes[f].before, changes[f].after)
    );

    if (fields.length === 0) return [];

    const records = [];
    for (const field of fields) {
      records.push(
        await this.record(
          { ...entry, field, before: changes[field].before, after: changes[field].after },
          { session }
        )
      );
    }
    return records;
  }

  /**
   * §9.1 — Админ бүх салбарыг, Менежер зөвхөн өөрийн салбарыг харна.
   * Ажилтан Audit Log харах эрхгүй (route түвшинд хаагдана).
   */
  async list(options, actor) {
    const scoped = { ...options };

    if (actor.role !== ROLES.ADMIN) {
      if (!actor.branchId) {
        throw new APIError(
          'Танд салбар оноогоогүй тул audit log харах боломжгүй',
          httpStatus.FORBIDDEN
        );
      }
      scoped.branchId = actor.branchId;
    }

    const result = await auditLogRepository.search({}, scoped);

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

  async listForEntity(entity, entityId) {
    return auditLogRepository.findByEntity(entity, entityId);
  }

  describeActor(actor) {
    if (!actor) return 'Систем';
    const name = `${actor.firstname ?? ''} ${actor.lastname ?? ''}`.trim();
    return name || actor.email || 'Тодорхойгүй';
  }

  isEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return a == null && b == null;
    return String(a) === String(b);
  }
}

module.exports = new AuditService();
