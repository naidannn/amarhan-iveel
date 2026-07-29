'use strict';

const BaseRepository = require('./base.repository');
const Package = require('../models/package.model');
const { normalizeTrackingNumber } = require('../domain/tracking-number');
const { OCCUPIES_LOCATION } = require('../domain/package-state');
const { PACKAGE_STATUS } = require('../config/constants');

class PackageRepository extends BaseRepository {
  constructor() {
    super(Package);
  }

  async findByTrackingNumber(trackingNumber) {
    return this.model.findOne({ trackingNumber: normalizeTrackingNumber(trackingNumber) });
  }

  /**
   * BR-05 — давхардлыг шалгахад ХҮЧИНГҮЙ ачааг тооцохгүй.
   *
   * Шалтгаан: ажилтан алдаж бүртгээд хүчингүй болгосон дугаарыг дахин бүртгэх
   * нь бодит, зөв хэрэгцээ. Түүнийг хориглох нь дугаарыг үүрд хаана.
   *
   * `registeredBy`-г populate хийж байгаа шалтгаан: §1.3-ийн алдааны мессежид
   * "[огноо]-нд [ажилтан]-аар бүртгэгдсэн" гэж харуулах шаардлагатай.
   */
  async findActiveByTrackingNumber(trackingNumber) {
    return this.model
      .findOne({
        trackingNumber: normalizeTrackingNumber(trackingNumber),
        status: { $ne: PACKAGE_STATUS.CANCELLED },
      })
      .populate('registeredBy', 'firstname lastname email');
  }

  /**
   * §9.3 — хайлт БҮРЭН server талд, индекслэгдсэн талбараар, хуудаслалттай.
   *
   * ЯАГААД regex-ийг зөвхөн ЭХНЭЭС нь тулгадаг (`^`): `{ $regex: 'ABC' }` гэсэн
   * дундаас хайх хэлбэр индекс ашиглахгүй, 1M мөрөнд бүтэн скан хийнэ.
   * Ажилтан ачааны дугаарыг эхнээс бичдэг тул prefix хайлт хангалттай.
   */
  async search(query = {}, options = {}) {
    const {
      page = 1,
      limit = 50,
      trackingNumber,
      phone,
      customerId,
      status,
      paymentStatus,
      cargoTypeId,
      branchId,
      locationCode,
      priceOverridden,
      from,
      to,
      sort = '-createdAt',
    } = options;

    const filter = { ...query };

    if (trackingNumber) {
      filter.trackingNumber = {
        $regex: `^${escapeRegex(normalizeTrackingNumber(trackingNumber))}`,
      };
    }
    if (phone) {
      filter.customerPhone = { $regex: `^${escapeRegex(String(phone).replace(/\D/g, ''))}` };
    }
    if (customerId) filter.customerId = customerId;
    if (locationCode) {
      filter.locationCode = { $regex: `^${escapeRegex(String(locationCode).toUpperCase())}` };
    }
    if (cargoTypeId) filter.cargoTypeId = cargoTypeId;
    if (branchId) filter.branchId = branchId;
    if (priceOverridden !== undefined) filter.priceOverridden = priceOverridden;

    // Олон төлөвөөр зэрэг шүүх ("хүргэхэд бэлэн" дэлгэц = paid + returned)
    if (Array.isArray(status) && status.length > 0) {
      filter.status = { $in: status };
    } else if (status) {
      filter.status = status;
    }

    if (Array.isArray(paymentStatus) && paymentStatus.length > 0) {
      filter.paymentStatus = { $in: paymentStatus };
    } else if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
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
        { path: 'cargoTypeId', select: 'code name' },
        { path: 'registeredBy', select: 'firstname lastname' },
      ],
    });
  }

  /**
   * §1.9 — нэг харилцагчийн бүх ачааг нэг дор авах (20–40 хүртэл байдаг).
   */
  async listByCustomer(customerId, { status } = {}) {
    const filter = { customerId };
    if (status) filter.status = Array.isArray(status) ? { $in: status } : status;
    return this.model.find(filter).sort({ createdAt: -1 });
  }

  async findByIdWithRefs(id) {
    return this.model
      .findById(id)
      .populate('customerId', 'phone name loyaltyTier')
      .populate('cargoTypeId', 'code name')
      .populate('locationId', 'code capacityCount currentCount')
      .populate('branchId', 'code name')
      .populate('registeredBy', 'firstname lastname email')
      .populate('statusHistory.by', 'firstname lastname');
  }

  async updateByIdWithSession(id, update, { session } = {}) {
    return this.model.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
      ...(session ? { session } : {}),
    });
  }

  async deleteByIdWithSession(id, { session } = {}) {
    return this.model.findByIdAndDelete(id, session ? { session } : {});
  }

  /**
   * Байршлын ачааллыг эргэн тооцоолох cron-д (docs/data-model.md §7).
   *
   * `OCCUPIES_LOCATION`-ыг домэйнээс авч байгаа шалтгаан: `currentCount`-ыг
   * нэмэгдүүлэх/хорогдуулах логик ба эргэн тооцоолох логик ХОЁУЛАА ижил
   * тодорхойлолт хэрэглэх ёстой. Хоёр газарт бичвэл cron мөнхийн зөрүү
   * "олж" байх болно.
   */
  async countActiveAtLocation(locationId) {
    return this.model.countDocuments({
      locationId,
      status: { $in: [...OCCUPIES_LOCATION] },
    });
  }
}

function parseSort(sort) {
  // Хортой/танигдахгүй талбараар эрэмбэлэхийг зөвшөөрөхгүй — индексгүй
  // талбараар эрэмбэлбэл 1M мөрөнд санах ойн эрэмбэлэлт болж унана.
  const allowed = ['createdAt', 'arrivedAt', 'trackingNumber', 'finalPrice', 'status'];
  const desc = String(sort).startsWith('-');
  const field = String(sort).replace(/^-/, '');
  if (!allowed.includes(field)) return { createdAt: -1 };
  return { [field]: desc ? -1 : 1 };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = new PackageRepository();
