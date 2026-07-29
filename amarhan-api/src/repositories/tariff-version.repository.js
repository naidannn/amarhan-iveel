'use strict';

const BaseRepository = require('./base.repository');
const TariffVersion = require('../models/tariff-version.model');

class TariffVersionRepository extends BaseRepository {
  constructor() {
    super(TariffVersion);
  }

  /**
   * Ачааны төрлийн ОДООГИЙН идэвхтэй тарифыг буцаана.
   * Идэвхтэй хувилбар нь `effectiveTo: null` гэдгээр тодорхойлогдоно.
   */
  async findActive(cargoTypeId) {
    return this.model.findOne({ cargoTypeId, effectiveTo: null });
  }

  /**
   * Тухайн ОГНОО-нд хүчинтэй байсан тарифыг буцаана.
   * Түүхэн тооцоо шалгахад хэрэгтэй (BR-02).
   */
  async findEffectiveAt(cargoTypeId, date) {
    return this.model
      .findOne({
        cargoTypeId,
        effectiveFrom: { $lte: date },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gt: date } }],
      })
      .sort({ effectiveFrom: -1 });
  }

  async listHistory(cargoTypeId) {
    return this.model.find({ cargoTypeId }).sort({ effectiveFrom: -1 });
  }

  /**
   * Идэвхтэй хувилбарыг хаана (шинэ хувилбар үүсгэхийн өмнө).
   * Транзакцын session-ийг дэмжинэ — хуучныг хаах ба шинийг үүсгэх нь атомик байх ёстой.
   */
  async closeActive(cargoTypeId, effectiveTo, { session } = {}) {
    return this.model.updateMany(
      { cargoTypeId, effectiveTo: null },
      { $set: { effectiveTo } },
      session ? { session } : {}
    );
  }

  async createVersion(data, { session } = {}) {
    const [doc] = await this.model.create([data], session ? { session } : {});
    return doc;
  }

  /**
   * Бүх идэвхтэй тарифыг ачааны төрлийн мэдээлэлтэй нь хамт.
   */
  async listActiveWithTypes() {
    return this.model.find({ effectiveTo: null }).populate('cargoTypeId');
  }
}

module.exports = new TariffVersionRepository();
