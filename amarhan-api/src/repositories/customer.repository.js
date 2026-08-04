'use strict';

const BaseRepository = require('./base.repository');
const Customer = require('../models/customer.model');
const Package = require('../models/package.model');

class CustomerRepository extends BaseRepository {
  constructor() {
    super(Customer);
  }

  /**
   * @param {string} phone — НОРМЧЛОГДСОН 8 оронтой дугаар
   */
  async findByPhone(phone) {
    return this.model.findOne({ phone });
  }

  async findByEmail(email) {
    return this.model.findOne({ email: String(email).toLowerCase() });
  }

  async findByGoogleId(googleId) {
    return this.model.findOne({ googleId });
  }

  /**
   * BR-29 — ачаа бүртгэхэд харилцагч байхгүй бол автоматаар үүсгэнэ.
   *
   * Atomic upsert ашиглаж байгаа шалтгаан: ажилтнууд зэрэг ачаа бүртгэхэд
   * "олоод байхгүй бол үүсгэх" гэсэн хоёр алхам нь давхардсан бичлэг үүсгэх
   * эрсдэлтэй. `findOneAndUpdate` + `upsert` нь DB түвшинд атомик.
   */
  async findOrCreateByPhone(phone, defaults = {}, { session } = {}) {
    const result = await this.model.findOneAndUpdate(
      { phone },
      {
        $setOnInsert: {
          phone,
          hasAccount: false,
          phoneVerified: false,
          ...defaults,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        // Mongoose 8-д `rawResult` нь `includeResultMetadata` болж өөрчлөгдсөн.
        // Үүнгүйгээр бичлэг ШИНЭ үү, БАЙСАН уу гэдгийг ялгах боломжгүй.
        includeResultMetadata: true,
        ...(session ? { session } : {}),
      }
    );

    return {
      customer: result.value,
      created: !result.lastErrorObject?.updatedExisting,
    };
  }

  /**
   * §9.3 — хайлт бүрэн server талд, индекслэгдсэн талбараар.
   */
  async search(query = {}, options = {}) {
    const { page = 1, limit = 50, search, phone, loyaltyTier, status, hasAccount } = options;
    const filter = { ...query };

    // Утсаар хайх нь хамгийн түгээмэл — unique index ашиглагдана
    if (phone) {
      filter.phone = { $regex: `^${escapeRegex(phone)}` };
    }

    if (search) {
      const escaped = escapeRegex(search);
      filter.$or = [
        { phone: { $regex: `^${escaped}` } },
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
      ];
    }

    if (loyaltyTier) filter.loyaltyTier = loyaltyTier;
    if (status) filter.status = status;
    if (hasAccount !== undefined) filter.hasAccount = hasAccount;

    return this.paginate(filter, { page, limit, sort: { createdAt: -1 } });
  }

  async updateByIdWithSession(id, data, { session } = {}) {
    return this.model.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
      ...(session ? { session } : {}),
    });
  }

  /**
   * Ачаа нь төлбөр, нэхэмжлэх, хүргэлтийн эх сурвалж болдог. Тиймээс ачаатай
   * харилцагчийг устгавал тэдгээрийн `customerId` лавлагаа тасарна.
   */
  async hasPackages(customerId, { session } = {}) {
    const query = Package.exists({ customerId });
    if (session) query.session(session);
    return Boolean(await query);
  }

  async deleteByIdWithSession(id, { session } = {}) {
    return this.model.findByIdAndDelete(id, session ? { session } : {});
  }
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = new CustomerRepository();
