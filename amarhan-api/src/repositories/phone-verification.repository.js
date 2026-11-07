'use strict';

const BaseRepository = require('./base.repository');
const PhoneVerification = require('../models/phone-verification.model');
const { PHONE_VERIFICATION_STATUS } = require('../config/constants');

class PhoneVerificationRepository extends BaseRepository {
  constructor() {
    super(PhoneVerification);
  }

  async findByTokenHash(tokenHash) {
    return this.model.findOne({ tokenHash });
  }

  /** Хугацаа нь дуусаагүй, хүлээгдэж буй хамгийн сүүлийн сесс */
  async findActivePending({ phone, purpose, customerId = null }) {
    return this.model
      .findOne({
        phone,
        purpose,
        customerId,
        status: PHONE_VERIFICATION_STATUS.PENDING,
        expiresAt: { $gt: new Date() },
      })
      .sort({ createdAt: -1 });
  }

  async findLatest({ phone, purpose }) {
    return this.model.findOne({ phone, purpose }).sort({ createdAt: -1 });
  }

  async countSince({ phone, since }) {
    return this.model.countDocuments({ phone, createdAt: { $gte: since } });
  }

  /**
   * `pending` → `verified`/`expired`. Зөвхөн `pending` бичлэгт л үйлчилнэ —
   * зэрэг ирсэн хоёр polling `consumed`-ыг буцааж `verified` болгохгүй.
   */
  async settlePending(id, { status, verifiedAt = null }) {
    return this.model.findOneAndUpdate(
      { _id: id, status: PHONE_VERIFICATION_STATUS.PENDING },
      { $set: { status, verifiedAt } },
      { new: true }
    );
  }

  /**
   * `verified` → `consumed` АТОМИК. Нэг баталгаажуулалтаар хоёр бүртгэл
   * (эсвэл хоёр удаа нууц үг солих) хийхээс сэргийлнэ — зэрэг ирсэн хоёр
   * хүсэлтээс зөвхөн нэг нь бичлэгийг авна (`payment.service.js`-ийн
   * `reserveAllocations`-ийн ижил "нэг баримт бичгийн атомик" зарчим).
   */
  async consume({ id, phone, purpose, customerId = null, verifiedAfter }) {
    return this.model.findOneAndUpdate(
      {
        _id: id,
        phone,
        purpose,
        customerId,
        status: PHONE_VERIFICATION_STATUS.VERIFIED,
        verifiedAt: { $gte: verifiedAfter },
      },
      { $set: { status: PHONE_VERIFICATION_STATUS.CONSUMED, consumedAt: new Date() } },
      { new: true }
    );
  }
}

module.exports = new PhoneVerificationRepository();
