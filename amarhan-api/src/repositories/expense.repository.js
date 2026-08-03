'use strict';

const BaseRepository = require('./base.repository');
const Expense = require('../models/expense.model');
const { EXPENSE_STATUS } = require('../config/constants');

class ExpenseRepository extends BaseRepository {
  constructor() {
    super(Expense);
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
   * Зарлагын жагсаалт — server талд, хуудаслагдсан, индекслэгдсэн (§9.3).
   */
  async search(query = {}, options = {}) {
    const { page = 1, limit = 50, branchId, category, status, from, to, sort = '-date' } = options;

    const filter = { ...query };

    if (branchId) filter.branchId = branchId;
    if (category) filter.category = category;
    if (status) filter.status = status;

    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = to;
    }

    return this.model.paginate(filter, {
      page,
      limit,
      sort: parseSort(sort),
      populate: [{ path: 'createdBy', select: 'firstname lastname' }],
    });
  }

  /**
   * Жагсаалтын дээд талын нийлбэр (нийт дүн, тоо, ангилал тус бүрээр) —
   * идэвхтэй (`voided` биш) зарлагаас, хэрэглэгчийн шүүлтийн хүрээнд.
   */
  async summary({ branchId, category, from, to } = {}) {
    const match = { status: EXPENSE_STATUS.ACTIVE };
    if (branchId) match.branchId = branchId;
    if (category) match.category = category;
    if (from || to) {
      match.date = {};
      if (from) match.date.$gte = from;
      if (to) match.date.$lte = to;
    }

    const rows = await this.model.aggregate([
      { $match: match },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    const byCategory = {};
    let total = 0;
    let count = 0;
    for (const row of rows) {
      byCategory[row._id] = { total: row.total, count: row.count };
      total += row.total;
      count += row.count;
    }

    return { total, count, byCategory };
  }
}

function parseSort(sort) {
  // Индексгүй талбараар эрэмбэлбэл санах ойн эрэмбэлэлт болж унана (§9.3)
  const allowed = ['date', 'amount', 'category', 'status', 'createdAt'];
  const desc = String(sort).startsWith('-');
  const field = String(sort).replace(/^-/, '');
  if (!allowed.includes(field)) return { date: -1 };
  return { [field]: desc ? -1 : 1 };
}

module.exports = new ExpenseRepository();
