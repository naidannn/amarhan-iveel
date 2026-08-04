'use strict';

const httpStatus = require('http-status');
const customerRepository = require('../repositories/customer.repository');
const auditService = require('./audit.service');
const APIError = require('../utils/APIError');
const { withTransaction } = require('../utils/transaction');
const { normalizePhone } = require('../domain/phone');
const { AUDIT_ACTION, AUDIT_ENTITY, ROLES } = require('../config/constants');

/**
 * Харилцагч — introduction.md §3
 *
 * Утас бол ачааг харилцагчтай холбох гол түлхүүр (BR-26). Оролт бүрийг
 * нормчилно (BR-27) — эс тэгвээс нэг хүн олон бичлэг болж ачаа нь тарна.
 */
class CustomerService {
  async list(options) {
    const normalized = { ...options };

    // Хайлтын утсыг ч нормчилно — ажилтан "+976 9911..." гэж бичсэн ч олдоно
    if (normalized.phone) {
      try {
        normalized.phone = normalizePhone(normalized.phone);
      } catch {
        // Бүрэн бус дугаараар хайж болно (жишээ: "9911") — цифрийг нь үлдээнэ
        normalized.phone = String(normalized.phone).replace(/\D/g, '');
      }
    }

    const result = await customerRepository.search({}, normalized);
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

  async getById(id) {
    const customer = await customerRepository.findById(id);
    if (!customer) {
      throw new APIError('Харилцагч олдсонгүй', httpStatus.NOT_FOUND);
    }
    return customer;
  }

  /**
   * BR-26 — ажилтан утас бичихэд харилцагчийг олно.
   */
  async getByPhone(phone) {
    const normalized = this.normalizeOrThrow(phone);
    const customer = await customerRepository.findByPhone(normalized);
    if (!customer) {
      throw new APIError('Энэ утсаар харилцагч олдсонгүй', httpStatus.NOT_FOUND);
    }
    return customer;
  }

  /**
   * BR-29 — ачаа бүртгэхэд харилцагч байхгүй бол автоматаар үүсгэнэ.
   *
   * Phase 2-т `packageService.create()` энэ методыг ижил транзакцад дуудна —
   * ачаа үүсэхгүй бол харилцагч ч үүсэхгүй байх ёстой.
   */
  async findOrCreateByPhone(phone, { name } = {}, { actor, session, req } = {}) {
    const normalized = this.normalizeOrThrow(phone);

    const { customer, created } = await customerRepository.findOrCreateByPhone(
      normalized,
      name ? { name } : {},
      { session }
    );

    if (created) {
      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.CUSTOMER_CREATE,
          entity: AUDIT_ENTITY.CUSTOMER,
          entityId: customer._id,
          entityLabel: normalized,
          after: { phone: normalized, name: name ?? null, source: 'auto' },
          req,
        },
        { session }
      );
    }

    return { customer, created };
  }

  async create(data, actor, req) {
    const phone = this.normalizeOrThrow(data.phone);

    const existing = await customerRepository.findByPhone(phone);
    if (existing) {
      throw new APIError('Энэ утсаар харилцагч аль хэдийн бүртгэгдсэн', httpStatus.CONFLICT);
    }

    return withTransaction(async session => {
      const [customer] = await customerRepository.model.create([{ ...data, phone }], { session });

      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.CUSTOMER_CREATE,
          entity: AUDIT_ENTITY.CUSTOMER,
          entityId: customer._id,
          entityLabel: phone,
          after: { phone, name: customer.name },
          req,
        },
        { session }
      );

      return customer;
    });
  }

  /**
   * §9.2 — утас/хаяг өөрчлөгдсөнийг audit-д заавал бүртгэнэ.
   */
  async update(id, data, actor, req) {
    const customer = await this.getById(id);

    const patch = { ...data };

    if (data.phone !== undefined) {
      const phone = this.normalizeOrThrow(data.phone);
      if (phone !== customer.phone) {
        const conflict = await customerRepository.findByPhone(phone);
        if (conflict) {
          throw new APIError('Энэ утас өөр харилцагчид бүртгэгдсэн байна', httpStatus.CONFLICT);
        }
      }
      patch.phone = phone;
    }

    // Урамшууллыг энэ замаар өөрчлөхийг хориглоно — тусдаа, эрх шалгасан
    // үйлдэл байх ёстой (BR-33)
    delete patch.loyaltyPoints;
    delete patch.loyaltyTier;
    delete patch.lifetimeSpent;
    delete patch.password;

    const changes = {};
    for (const field of ['phone', 'name', 'email', 'status', 'note', 'phoneVerified']) {
      if (patch[field] !== undefined && String(patch[field]) !== String(customer[field])) {
        changes[field] = { before: customer[field], after: patch[field] };
      }
    }

    return withTransaction(async session => {
      const updated = await customerRepository.updateByIdWithSession(id, patch, { session });

      await auditService.recordChanges(
        {
          actor,
          action: AUDIT_ACTION.CUSTOMER_UPDATE,
          entity: AUDIT_ENTITY.CUSTOMER,
          entityId: updated._id,
          entityLabel: updated.phone,
          req,
        },
        changes,
        { session }
      );

      return updated;
    });
  }

  /**
   * Харилцагчийг бүрмөсөн устгах нь зөвхөн Админы эрх. Ачаатай бичлэгийг
   * устгавал төлбөр/нэхэмжлэх/хүргэлтийн түүхийн лавлагаа тасрах тул хориглоно.
   */
  async remove(id, actor, req) {
    if (actor?.role !== ROLES.ADMIN) {
      throw new APIError('Харилцагч устгах эрх зөвхөн Админд байна', httpStatus.FORBIDDEN);
    }

    const customer = await this.getById(id);

    return withTransaction(async session => {
      if (await customerRepository.hasPackages(customer._id, { session })) {
        throw new APIError(
          'Ачааны түүхтэй харилцагчийг устгах боломжгүй',
          httpStatus.UNPROCESSABLE_ENTITY
        );
      }

      // Устгасны дараа ч хэн, ямар бичлэг устгасныг audit-д бүрэн хадгална.
      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.CUSTOMER_DELETE,
          entity: AUDIT_ENTITY.CUSTOMER,
          entityId: customer._id,
          entityLabel: customer.phone,
          before: customer.toObject(),
          after: null,
          req,
        },
        { session }
      );

      await customerRepository.deleteByIdWithSession(id, { session });
      return { deleted: true, phone: customer.phone };
    });
  }

  /**
   * BR-33 — урамшууллыг гараар өөрчлөх. Зөвхөн Админ, шалтгаан заавал.
   */
  async adjustLoyalty(id, { loyaltyTier, loyaltyPoints, reason }, actor, req) {
    if (actor.role !== ROLES.ADMIN) {
      throw new APIError('Урамшуулал өөрчлөх эрх зөвхөн Админд байна', httpStatus.FORBIDDEN);
    }
    if (!reason || !reason.trim()) {
      throw new APIError('Шалтгаан заавал бичих шаардлагатай', httpStatus.BAD_REQUEST);
    }

    const customer = await this.getById(id);

    const changes = {};
    if (loyaltyTier !== undefined && loyaltyTier !== customer.loyaltyTier) {
      changes.loyaltyTier = { before: customer.loyaltyTier, after: loyaltyTier };
    }
    if (loyaltyPoints !== undefined && loyaltyPoints !== customer.loyaltyPoints) {
      changes.loyaltyPoints = { before: customer.loyaltyPoints, after: loyaltyPoints };
    }

    if (Object.keys(changes).length === 0) {
      throw new APIError('Өөрчлөх зүйл алга', httpStatus.BAD_REQUEST);
    }

    return withTransaction(async session => {
      const updated = await customerRepository.updateByIdWithSession(
        id,
        {
          ...(loyaltyTier !== undefined ? { loyaltyTier } : {}),
          ...(loyaltyPoints !== undefined ? { loyaltyPoints } : {}),
        },
        { session }
      );

      await auditService.recordChanges(
        {
          actor,
          action: AUDIT_ACTION.CUSTOMER_LOYALTY_ADJUST,
          entity: AUDIT_ENTITY.CUSTOMER,
          entityId: updated._id,
          entityLabel: updated.phone,
          reason: reason.trim(),
          req,
        },
        changes,
        { session }
      );

      return updated;
    });
  }

  normalizeOrThrow(phone) {
    try {
      return normalizePhone(phone);
    } catch (err) {
      throw new APIError(err.message, httpStatus.BAD_REQUEST);
    }
  }
}

module.exports = new CustomerService();
