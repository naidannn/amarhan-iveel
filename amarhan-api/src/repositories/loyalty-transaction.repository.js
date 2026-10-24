'use strict';

const BaseRepository = require('./base.repository');
const LoyaltyTransaction = require('../models/loyalty-transaction.model');
const Customer = require('../models/customer.model');
const { LOYALTY_TX_TYPE } = require('../config/constants');

/**
 * Кредитийн ledger + `customers.loyaltyPoints` кэшийн атомик бичилт.
 *
 * Кэшийг энд (customer.repository-д БИШ) бичиж байгаа шалтгаан: үлдэгдэл бол
 * ledger-ээс гаралтай утга — хоёр газраас `$inc` хийгдвэл аль нь зөв болохыг
 * тодорхойлох боломжгүй (BR-14-ийн ижил зарчим).
 */
class LoyaltyTransactionRepository extends BaseRepository {
  constructor() {
    super(LoyaltyTransaction);
  }

  async createEntry(data) {
    return this.model.create(data);
  }

  async setBalanceAfter(id, balanceAfter) {
    return this.model.updateOne({ _id: id }, { $set: { balanceAfter } });
  }

  /** Бүтэлгүйтсэн `redeem`-ийн нөхөн арилгалт — `loyalty.service.js#cancelDebit` */
  async removeById(id) {
    return this.model.deleteOne({ _id: id });
  }

  /** Тухайн ачаанд хамаарах олголт/буцаалт (reconcile) — `{packageId, seq}` индекс */
  async listEarnForPackage(packageId) {
    return this.model
      .find({
        packageId,
        type: { $in: [LOYALTY_TX_TYPE.EARN, LOYALTY_TX_TYPE.EARN_REVERSAL] },
      })
      .sort({ seq: 1 });
  }

  /** Ачааны бүх бичлэгийн хамгийн их `seq` (дараагийн дугаарыг олоход) */
  async maxSeqForPackage(packageId) {
    const last = await this.model
      .findOne({ packageId, seq: { $ne: null } })
      .sort({ seq: -1 })
      .select('seq');
    return last?.seq ?? 0;
  }

  async findByPayment(paymentId, type) {
    return this.model.findOne({ paymentId, type });
  }

  async latestForCustomer(customerId) {
    return this.model.findOne({ customerId }).sort({ createdAt: -1, _id: -1 });
  }

  async listForCustomer(customerId, { page = 1, limit = 20, type } = {}) {
    const filter = { customerId };
    if (type) filter.type = type;
    return this.model.paginate(filter, { page, limit, sort: { createdAt: -1, _id: -1 } });
  }

  /** Ledger-ийн нийлбэр — кэш засах (`recomputeBalance`) ба олгосон/зарцуулсан нийт */
  async totalsForCustomer(customerId) {
    const rows = await this.model.aggregate([
      { $match: { customerId } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);
    const byType = Object.fromEntries(rows.map(r => [r._id, r.total]));
    const balance = rows.reduce((sum, r) => sum + r.total, 0);
    return { balance, byType };
  }

  /** Хөтөлбөрийн нийт дүн — Админы самбар (эргэлтэд буй кредит = компанийн өр) */
  async programTotals({ from } = {}) {
    const match = from ? { createdAt: { $gte: from } } : {};
    const [byType, outstanding] = await Promise.all([
      this.model.aggregate([
        { $match: match },
        { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Customer.aggregate([
        { $match: { loyaltyPoints: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$loyaltyPoints' }, count: { $sum: 1 } } },
      ]),
    ]);
    return {
      byType: Object.fromEntries(byType.map(r => [r._id, { total: r.total, count: r.count }])),
      outstanding: outstanding[0]?.total ?? 0,
      holders: outstanding[0]?.count ?? 0,
    };
  }

  // ── `customers.loyaltyPoints` кэш (атомик, standalone-д найдвартай) ───

  /** Нэмэх/хасах (олголт, буцаалт, засвар) — нөхцөлгүй */
  async incrementBalance(customerId, delta) {
    return Customer.findByIdAndUpdate(
      customerId,
      { $inc: { loyaltyPoints: delta } },
      { new: true, projection: { loyaltyPoints: 1 } }
    );
  }

  /**
   * BR-48 — зарцуулалт. `loyaltyPoints >= amount` нөхцөл нь зэрэг ирсэн хоёр
   * хүсэлт нэг кредитийг хоёр удаа зарцуулахаас сэргийлнэ (нэг баримт бичгийн
   * атомик `findOneAndUpdate` — `package.repository#reserveBalance`-ийн ижил).
   * Хүрэлцэхгүй бол `null`.
   */
  async debitBalance(customerId, amount) {
    return Customer.findOneAndUpdate(
      { _id: customerId, loyaltyPoints: { $gte: amount } },
      { $inc: { loyaltyPoints: -amount } },
      { new: true, projection: { loyaltyPoints: 1 } }
    );
  }

  async setBalance(customerId, balance) {
    return Customer.findByIdAndUpdate(
      customerId,
      { $set: { loyaltyPoints: balance } },
      { new: true, projection: { loyaltyPoints: 1 } }
    );
  }

  async setTier(customerId, tier) {
    return Customer.updateOne({ _id: customerId }, { $set: { loyaltyTier: tier } });
  }
}

module.exports = new LoyaltyTransactionRepository();
