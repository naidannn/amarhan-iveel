'use strict';

const httpStatus = require('http-status');
const cargoTypeRepository = require('../repositories/cargo-type.repository');
const tariffVersionRepository = require('../repositories/tariff-version.repository');
const auditService = require('./audit.service');
const APIError = require('../utils/APIError');
const { withTransaction } = require('../utils/transaction');
const { calculatePrice, calculateVolumeM3 } = require('../domain/pricing');
const { AUDIT_ACTION, AUDIT_ENTITY } = require('../config/constants');

/**
 * Ачааны төрөл ба тариф — introduction.md §1.2
 *
 * Тариф өөрчлөх нь санхүүд ШУУД нөлөөлдөг тул зөвхөн Админ (§9.1),
 * өөрчлөлт бүр audit-д (BR-38), хуучин хувилбар хэзээ ч устахгүй (BR-02).
 */
class TariffService {
  // ── Ачааны төрөл ────────────────────────────────────────────────────────

  async listCargoTypes(options) {
    const result = await cargoTypeRepository.search({}, options);
    return {
      data: result.docs,
      pagination: {
        page: result.page,
        pages: result.totalPages,
        total: result.totalDocs,
        limit: result.limit,
      },
    };
  }

  async getCargoType(id) {
    const cargoType = await cargoTypeRepository.findById(id);
    if (!cargoType) {
      throw new APIError('Ачааны төрөл олдсонгүй', httpStatus.NOT_FOUND);
    }
    return cargoType;
  }

  /**
   * Ачааны төрөл ба түүний анхны тарифыг НЭГ транзакцад үүсгэнэ.
   * Тарифгүй төрөл байвал ачаа бүртгэхэд үнэ бодогдохгүй тул хамт үүсгэх нь зөв.
   */
  async createCargoType(data, actor, req) {
    const existing = await cargoTypeRepository.findByCode(data.code);
    if (existing) {
      throw new APIError(`"${data.code}" кодтой ачааны төрөл байна`, httpStatus.CONFLICT);
    }

    const { weightBrackets, pricePerKgAbove, pricePerM3, minimumCharge, ...typeData } = data;

    return withTransaction(async session => {
      const [cargoType] = await cargoTypeRepository.model.create([typeData], { session });

      const tariff = await tariffVersionRepository.createVersion(
        {
          cargoTypeId: cargoType._id,
          weightBrackets: weightBrackets ?? [],
          pricePerKgAbove,
          pricePerM3,
          minimumCharge: minimumCharge ?? 0,
          effectiveFrom: new Date(),
          createdBy: actor?._id ?? null,
        },
        { session }
      );

      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.CARGO_TYPE_CREATE,
          entity: AUDIT_ENTITY.CARGO_TYPE,
          entityId: cargoType._id,
          entityLabel: cargoType.code,
          after: { name: cargoType.name, pricePerKgAbove, pricePerM3, minimumCharge },
          req,
        },
        { session }
      );

      return { cargoType, tariff };
    });
  }

  async updateCargoType(id, data, actor, req) {
    const cargoType = await this.getCargoType(id);

    const changes = {};
    for (const field of ['name', 'description', 'isActive']) {
      if (data[field] !== undefined && String(data[field]) !== String(cargoType[field])) {
        changes[field] = { before: cargoType[field], after: data[field] };
      }
    }

    return withTransaction(async session => {
      const updated = await cargoTypeRepository.model.findByIdAndUpdate(
        id,
        { name: data.name, description: data.description, isActive: data.isActive },
        { new: true, runValidators: true, omitUndefined: true, session }
      );

      await auditService.recordChanges(
        {
          actor,
          action: AUDIT_ACTION.CARGO_TYPE_UPDATE,
          entity: AUDIT_ENTITY.CARGO_TYPE,
          entityId: updated._id,
          entityLabel: updated.code,
          req,
        },
        changes,
        { session }
      );

      return updated;
    });
  }

  // ── Тариф ───────────────────────────────────────────────────────────────

  async getActiveTariff(cargoTypeId) {
    const tariff = await tariffVersionRepository.findActive(cargoTypeId);
    if (!tariff) {
      throw new APIError(
        'Энэ ачааны төрөлд идэвхтэй тариф тохируулаагүй байна',
        httpStatus.UNPROCESSABLE_ENTITY
      );
    }
    return tariff;
  }

  async listActiveTariffs() {
    return tariffVersionRepository.listActiveWithTypes();
  }

  async listTariffHistory(cargoTypeId) {
    await this.getCargoType(cargoTypeId);
    return tariffVersionRepository.listHistory(cargoTypeId);
  }

  /**
   * BR-02 — тариф өөрчлөх.
   *
   * Хуучин хувилбарыг ДАРЖ БИЧИХГҮЙ: `effectiveTo`-гоор хааж, шинэ хувилбар
   * үүсгэнэ. Ингэснээр өмнө бүртгэгдсэн ачааны үнэ хэвээр тайлбарлагдана.
   */
  async changeTariff(cargoTypeId, payload, actor, req) {
    const { weightBrackets = [], pricePerKgAbove, pricePerM3, minimumCharge = 0, note } = payload;

    const cargoType = await this.getCargoType(cargoTypeId);
    const current = await tariffVersionRepository.findActive(cargoTypeId);

    const bracketsKey = list => JSON.stringify((list ?? []).map(b => [b.maxGrams, b.price]));

    const unchanged =
      current &&
      current.pricePerKgAbove === pricePerKgAbove &&
      current.pricePerM3 === pricePerM3 &&
      current.minimumCharge === minimumCharge &&
      bracketsKey(current.weightBrackets) === bracketsKey(weightBrackets);

    if (unchanged) {
      throw new APIError('Тариф өөрчлөгдөөгүй байна', httpStatus.BAD_REQUEST);
    }

    const now = new Date();

    return withTransaction(async session => {
      if (current) {
        await tariffVersionRepository.closeActive(cargoTypeId, now, { session });
      }

      const created = await tariffVersionRepository.createVersion(
        {
          cargoTypeId,
          weightBrackets,
          pricePerKgAbove,
          pricePerM3,
          minimumCharge,
          effectiveFrom: now,
          createdBy: actor?._id ?? null,
          note: note ?? null,
        },
        { session }
      );

      await auditService.recordChanges(
        {
          actor,
          action: AUDIT_ACTION.TARIFF_CHANGE,
          entity: AUDIT_ENTITY.TARIFF,
          entityId: created._id,
          entityLabel: cargoType.code,
          reason: note ?? null,
          req,
        },
        {
          pricePerKgAbove: { before: current?.pricePerKgAbove ?? null, after: pricePerKgAbove },
          pricePerM3: { before: current?.pricePerM3 ?? null, after: pricePerM3 },
          minimumCharge: { before: current?.minimumCharge ?? null, after: minimumCharge },
          weightBrackets: {
            before: current ? bracketsKey(current.weightBrackets) : null,
            after: bracketsKey(weightBrackets),
          },
        },
        { session }
      );

      return created;
    });
  }

  /**
   * Ачаа бүртгэхийн ӨМНӨ ажилтанд үнийг урьдчилан харуулна (§1.2).
   * Энэ нь зөвхөн тооцоолол — юу ч хадгалахгүй.
   */
  async quote({ cargoTypeId, weightKg, volumeM3, dimensions }) {
    const tariffDoc = await this.getActiveTariff(cargoTypeId);

    let volume = volumeM3;
    if (volume == null && dimensions) {
      volume = calculateVolumeM3(dimensions);
    }

    try {
      const result = calculatePrice({
        weightKg,
        volumeM3: volume,
        tariff: tariffDoc.toTariff(),
      });

      return {
        ...result,
        volumeM3: volume ?? null,
        tariff: tariffDoc.toTariff(),
        tariffVersionId: tariffDoc._id,
      };
    } catch (err) {
      throw new APIError(err.message, httpStatus.BAD_REQUEST);
    }
  }
}

module.exports = new TariffService();
