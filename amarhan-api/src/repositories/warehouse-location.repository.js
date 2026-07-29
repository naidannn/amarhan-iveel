'use strict';

const BaseRepository = require('./base.repository');
const WarehouseLocation = require('../models/warehouse-location.model');

class WarehouseLocationRepository extends BaseRepository {
  constructor() {
    super(WarehouseLocation);
  }

  async findByCode(code) {
    return this.model.findOne({ code: String(code).toUpperCase() });
  }

  /**
   * §8 — байршлаар хайх. Хэсэгчилсэн код (`ER-02`) ч ажиллана.
   * `code` индекслэгдсэн бөгөөд эхнээс нь тулгах тул index ашиглагдана.
   */
  async search(query = {}, options = {}) {
    const { page = 1, limit = 50, code, branchId, room, shelf, isActive, onlyFree } = options;
    const filter = { ...query };

    if (code) {
      filter.code = { $regex: `^${escapeRegex(String(code).toUpperCase())}` };
    }
    if (branchId) filter.branchId = branchId;
    if (room) filter.room = String(room).padStart(2, '0');
    if (shelf) filter.shelf = String(shelf).toUpperCase();
    if (isActive !== undefined) filter.isActive = isActive;

    // Багтаамж дүүрээгүй нүд (capacityCount null = хязгааргүй)
    if (onlyFree) {
      filter.$or = [
        { capacityCount: null },
        { $expr: { $lt: ['$currentCount', '$capacityCount'] } },
      ];
    }

    return this.paginate(filter, {
      page,
      limit,
      sort: { code: 1 },
    });
  }

  /**
   * BR-23 — хоосон нүд санал болгоно.
   *
   * Эрэмбэ нь кодоор — ажилтан агуулах дотор дараалан явахад тохиромжтой.
   * Багтаамж дүүрсэн нүдийг алгасана.
   */
  async findFirstAvailable(branchId, { room, shelf } = {}) {
    const filter = {
      branchId,
      isActive: true,
      $or: [{ capacityCount: null }, { $expr: { $lt: ['$currentCount', '$capacityCount'] } }],
    };
    if (room) filter.room = String(room).padStart(2, '0');
    if (shelf) filter.shelf = String(shelf).toUpperCase();

    return this.model.findOne(filter).sort({ code: 1 });
  }

  /**
   * Bulk үүсгэлт (seed скрипт). Давхардсан кодыг алгасана.
   */
  async bulkCreate(locations) {
    return this.model.insertMany(locations, { ordered: false }).catch(err => {
      // insertMany-ийн давхардлын алдаа — амжилттай орсныг буцаана
      if (err.code === 11000 || err.writeErrors) {
        return err.insertedDocs ?? [];
      }
      throw err;
    });
  }

  /**
   * Ачаа орох/гарахад ачааллыг өөрчилнө. Транзакцын session-ийг дэмжинэ (Phase 2).
   */
  async adjustLoad(locationId, { countDelta = 0, m3Delta = 0 }, { session } = {}) {
    return this.model.findByIdAndUpdate(
      locationId,
      { $inc: { currentCount: countDelta, currentM3: m3Delta } },
      { new: true, ...(session ? { session } : {}) }
    );
  }

  async countByBranch(branchId) {
    return this.model.countDocuments({ branchId });
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = new WarehouseLocationRepository();
