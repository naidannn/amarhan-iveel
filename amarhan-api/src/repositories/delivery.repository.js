'use strict';

const BaseRepository = require('./base.repository');
const Delivery = require('../models/delivery.model');
const { ACTIVE_STATUSES } = require('../domain/delivery-state');

class DeliveryRepository extends BaseRepository {
  constructor() {
    super(Delivery);
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
      .populate('packageIds', 'trackingNumber status finalPrice paidAmount balance locationCode')
      .populate('driverId', 'firstname lastname phone')
      .populate('createdBy', 'firstname lastname')
      .populate('branchId', 'code name');
  }

  /**
   * BR-20a — ачаа НЭГЭЭС ИЛҮҮ идэвхтэй хүргэлтэд орохыг хориглоно.
   *
   * Яагаад: хоёр жолооч нэг ачааг хайж явах, эсвэл нэг нь гаргачихсан байхад
   * нөгөө нь "алга болсон" гэж бүртгэх нөхцөл үүснэ. `returned` хүргэлт
   * идэвхтэйд ОРОХГҮЙ — ачаа агуулахад буцаж ирсэн тул дахин багцлагдана.
   */
  async findActiveContainingPackages(packageIds, { session } = {}) {
    const q = this.model
      .find({
        status: { $in: ACTIVE_STATUSES },
        packageIds: { $in: packageIds },
      })
      .select('deliveryNumber status packageIds');
    return session ? q.session(session) : q;
  }

  /** Ачааны дэлгэрэнгүй хуудсанд — тухайн ачаа ямар хүргэлтүүдэд орсон */
  async listForPackage(packageId) {
    return this.model
      .find({ packageIds: packageId })
      .sort({ createdAt: -1 })
      .select('deliveryNumber status address scheduledDate dispatchedAt deliveredAt createdAt');
  }

  /**
   * §5, §9.3 — server талын, индекслэгдсэн, хуудаслагдсан хайлт.
   */
  async search(query = {}, options = {}) {
    const {
      page = 1,
      limit = 50,
      customerId,
      phone,
      deliveryNumber,
      status,
      branchId,
      driverId,
      packageId,
      scheduledFrom,
      scheduledTo,
      from,
      to,
      sort = '-createdAt',
    } = options;

    const filter = { ...query };

    if (customerId) filter.customerId = customerId;
    if (phone) {
      // Хүлээн авагчийн утсаар ч, харилцагчийн утсаар ч олдох ёстой —
      // ажилтан аль дугаараар хайхаа мэдэхгүй
      const digits = escapeRegex(String(phone).replace(/\D/g, ''));
      filter.$or = [
        { customerPhone: { $regex: `^${digits}` } },
        { phone: { $regex: `^${digits}` } },
      ];
    }
    if (deliveryNumber) {
      filter.deliveryNumber = { $regex: `^${escapeRegex(String(deliveryNumber).toUpperCase())}` };
    }
    if (branchId) filter.branchId = branchId;
    if (driverId) filter.driverId = driverId;
    if (packageId) filter.packageIds = packageId;

    if (Array.isArray(status) && status.length > 0) {
      filter.status = { $in: status };
    } else if (status) {
      filter.status = status;
    }

    // §5 — өдрийн маршрут: төлөвлөсөн огноогоор
    if (scheduledFrom || scheduledTo) {
      filter.scheduledDate = {};
      if (scheduledFrom) filter.scheduledDate.$gte = scheduledFrom;
      if (scheduledTo) filter.scheduledDate.$lte = scheduledTo;
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
        { path: 'driverId', select: 'firstname lastname' },
        { path: 'packageIds', select: 'trackingNumber balance status' },
      ],
    });
  }

  /**
   * §5 — өдрийн маршрутын нэгтгэл (төлөв тус бүрийн тоо, ачааны тоо).
   *
   * Жагсаалтыг client талд тоолохгүй байгаа шалтгаан: хуудаслалттай үед
   * зөвхөн ЭХНИЙ хуудсыг тоолж, буруу тоо харуулна (§9.3).
   */
  async summary({ branchId, scheduledFrom, scheduledTo } = {}) {
    const match = {};
    if (branchId) match.branchId = branchId;
    if (scheduledFrom || scheduledTo) {
      match.scheduledDate = {};
      if (scheduledFrom) match.scheduledDate.$gte = scheduledFrom;
      if (scheduledTo) match.scheduledDate.$lte = scheduledTo;
    }

    const rows = await this.model.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          packageCount: { $sum: { $size: '$packageIds' } },
        },
      },
    ]);

    const byStatus = {};
    let total = 0;
    let packageCount = 0;
    for (const row of rows) {
      byStatus[row._id] = { count: row.count, packageCount: row.packageCount };
      total += row.count;
      packageCount += row.packageCount;
    }

    return { total, packageCount, byStatus };
  }
}

function parseSort(sort) {
  // Индексгүй талбараар эрэмбэлбэл санах ойн эрэмбэлэлт болж унана (§9.3)
  const allowed = ['createdAt', 'scheduledDate', 'status', 'deliveryNumber'];
  const desc = String(sort).startsWith('-');
  const field = String(sort).replace(/^-/, '');
  if (!allowed.includes(field)) return { createdAt: -1 };
  return { [field]: desc ? -1 : 1 };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = new DeliveryRepository();
