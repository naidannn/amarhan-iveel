'use strict';

const BaseRepository = require('./base.repository');
const Payment = require('../models/payment.model');
const { PAYMENT_RECORD_STATUS } = require('../config/constants');

class PaymentRepository extends BaseRepository {
  constructor() {
    super(Payment);
  }

  async createWithSession(data, { session } = {}) {
    const [doc] = await this.model.create([data], session ? { session } : {});
    return doc;
  }

  async updateByIdWithSession(id, update, { session } = {}) {
    return this.model.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
      ...(session ? { session } : {}),
    });
  }

  /**
   * §2.2 — төлбөрийн жагсаалт. §9.3-ийн дагуу server талд, индекслэгдсэн,
   * хуудаслагдсан.
   */
  async search(query = {}, options = {}) {
    const {
      page = 1,
      limit = 50,
      customerId,
      phone,
      packageId,
      invoiceId,
      method,
      status,
      branchId,
      receivedBy,
      from,
      to,
      sort = '-createdAt',
    } = options;

    const filter = { ...query };

    if (customerId) filter.customerId = customerId;
    if (phone) {
      filter.customerPhone = { $regex: `^${escapeRegex(String(phone).replace(/\D/g, ''))}` };
    }
    // Ачаанд орсон төлбөрүүд — `allocations.packageId` индексээр
    if (packageId) filter['allocations.packageId'] = packageId;
    if (invoiceId) filter.invoiceId = invoiceId;
    if (branchId) filter.branchId = branchId;
    if (receivedBy) filter.receivedBy = receivedBy;

    if (Array.isArray(method) && method.length > 0) {
      filter.method = { $in: method };
    } else if (method) {
      filter.method = method;
    }

    if (Array.isArray(status) && status.length > 0) {
      filter.status = { $in: status };
    } else if (status) {
      filter.status = status;
    }

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = from;
      if (to) filter.createdAt.$lte = to;
    }

    return this.model.paginate(filter, {
      page,
      limit,
      sort: parseSort(sort),
      populate: [
        { path: 'receivedBy', select: 'firstname lastname' },
        { path: 'customerId', select: 'phone name' },
        { path: 'allocations.packageId', select: 'trackingNumber finalPrice' },
      ],
    });
  }

  /**
   * Тухайн ачаанд орсон БҮХ төлбөр (хүчингүй болсныг ч оруулна — ачааны
   * дэлгэрэнгүй хуудсанд "хүчингүй болгосон" гэж харуулах шаардлагатай).
   */
  async listForPackage(packageId) {
    return this.model
      .find({ 'allocations.packageId': packageId })
      .sort({ createdAt: -1 })
      .populate('receivedBy', 'firstname lastname');
  }

  async listForInvoice(invoiceId, { session } = {}) {
    const q = this.model.find({ invoiceId }).sort({ createdAt: 1 });
    return session ? q.session(session) : q;
  }

  /**
   * BR-14 — ачааны `paidAmount`-ыг ЭХ СУРВАЛЖААС эргэн тооцоолох.
   *
   * Хэрэглээ: (1) төлбөр хүчингүй болгоход дүнг ХАСАХ бус ДАХИН бодох —
   * хасалт нь урьд нь орсон зөрүүг үүрд үлдээдэг; (2) өдөр бүрийн зөрүү
   * шалгах cron (docs/data-model.md §7).
   *
   * ЗӨВХӨН `completed` тооцогдоно (BR-14) — `pending` онлайн төлбөр батлагдаагүй,
   * `voided` нь хүчингүй.
   */
  async sumCompletedForPackage(packageId, { session } = {}) {
    const pipeline = [
      {
        $match: {
          'allocations.packageId': packageId,
          status: PAYMENT_RECORD_STATUS.COMPLETED,
        },
      },
      { $unwind: '$allocations' },
      { $match: { 'allocations.packageId': packageId } },
      { $group: { _id: null, total: { $sum: '$allocations.amount' } } },
    ];

    const result = await this.model
      .aggregate(pipeline)
      .session(session ?? null)
      .exec();

    return result[0]?.total ?? 0;
  }

  async sumCompletedForInvoice(invoiceId, { session } = {}) {
    const pipeline = [
      { $match: { invoiceId, status: PAYMENT_RECORD_STATUS.COMPLETED } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ];

    const result = await this.model
      .aggregate(pipeline)
      .session(session ?? null)
      .exec();

    return result[0]?.total ?? 0;
  }

  /**
   * §2.2 — жагсаалтын дээд талын нийлбэрүүд (өдрийн касс тулгах).
   */
  async summary({ branchId, from, to } = {}) {
    const match = { status: PAYMENT_RECORD_STATUS.COMPLETED };
    if (branchId) match.branchId = branchId;
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = from;
      if (to) match.createdAt.$lte = to;
    }

    const rows = await this.model.aggregate([
      { $match: match },
      { $group: { _id: '$method', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    const byMethod = {};
    let total = 0;
    let count = 0;
    for (const row of rows) {
      byMethod[row._id] = { total: row.total, count: row.count };
      total += row.total;
      count += row.count;
    }

    return { total, count, byMethod };
  }
}

function parseSort(sort) {
  // Индексгүй талбараар эрэмбэлбэл санах ойн эрэмбэлэлт болж унана (§9.3)
  const allowed = ['createdAt', 'amount', 'method', 'status'];
  const desc = String(sort).startsWith('-');
  const field = String(sort).replace(/^-/, '');
  if (!allowed.includes(field)) return { createdAt: -1 };
  return { [field]: desc ? -1 : 1 };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = new PaymentRepository();
