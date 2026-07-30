'use strict';

const BaseRepository = require('./base.repository');
const Invoice = require('../models/invoice.model');
const { INVOICE_STATUS } = require('../config/constants');

class InvoiceRepository extends BaseRepository {
  constructor() {
    super(Invoice);
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

  async findByIdWithSession(id, { session } = {}) {
    const q = this.model.findById(id);
    return session ? q.session(session) : q;
  }

  async findByIdWithRefs(id) {
    return this.model
      .findById(id)
      .populate('customerId', 'phone name loyaltyTier')
      .populate('items.packageId', 'trackingNumber status finalPrice paidAmount balance')
      .populate('createdBy', 'firstname lastname')
      .populate('branchId', 'code name');
  }

  /**
   * BR-16a — ачаа НЭГЭЭС ИЛҮҮ нээлттэй нэхэмжлэхэд орохыг хориглоно.
   *
   * Яагаад: хоёр нээлттэй нэхэмжлэх ижил ачааг агуулбал хоёулаа бүтнээр
   * төлөгдөх үед ачаа хоёр дахин төлөгдөж, илүү төлөлт үүснэ (BR-15).
   * Хуваарилалтын шалгалт барих боловч ажилтан яагаад гэдгийг ойлгохгүй —
   * тиймээс нэхэмжлэх ҮҮСГЭХ үед тодорхой мессежээр хорино.
   */
  async findOpenContainingPackages(packageIds, { session } = {}) {
    const q = this.model
      .find({
        status: INVOICE_STATUS.OPEN,
        'items.packageId': { $in: packageIds },
      })
      .select('invoiceNumber items.packageId');
    return session ? q.session(session) : q;
  }

  async search(query = {}, options = {}) {
    const {
      page = 1,
      limit = 50,
      customerId,
      phone,
      status,
      branchId,
      invoiceNumber,
      from,
      to,
      sort = '-createdAt',
    } = options;

    const filter = { ...query };

    if (customerId) filter.customerId = customerId;
    if (phone) {
      filter.customerPhone = { $regex: `^${escapeRegex(String(phone).replace(/\D/g, ''))}` };
    }
    if (invoiceNumber) {
      filter.invoiceNumber = {
        $regex: `^${escapeRegex(String(invoiceNumber).toUpperCase())}`,
      };
    }
    if (branchId) filter.branchId = branchId;

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
        { path: 'customerId', select: 'phone name' },
        { path: 'createdBy', select: 'firstname lastname' },
      ],
    });
  }
}

function parseSort(sort) {
  const allowed = ['createdAt', 'totalAmount', 'invoiceNumber', 'status'];
  const desc = String(sort).startsWith('-');
  const field = String(sort).replace(/^-/, '');
  if (!allowed.includes(field)) return { createdAt: -1 };
  return { [field]: desc ? -1 : 1 };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = new InvoiceRepository();
