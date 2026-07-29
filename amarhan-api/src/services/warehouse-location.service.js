'use strict';

const httpStatus = require('http-status');
const warehouseLocationRepository = require('../repositories/warehouse-location.repository');
const branchResolver = require('./branch-resolver.service');
const settingService = require('./setting.service');
const auditService = require('./audit.service');
const APIError = require('../utils/APIError');
const { withTransaction } = require('../utils/transaction');
const {
  formatLocationCode,
  parseLocationCode,
  generateShelfCodes,
} = require('../domain/location-code');
const { AUDIT_ACTION, AUDIT_ENTITY, SETTING_KEY } = require('../config/constants');

class WarehouseLocationService {
  async list(options, actor) {
    const scoped = this.applyBranchScope(options, actor);
    const result = await warehouseLocationRepository.search({}, scoped);
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

  async getById(id) {
    const location = await warehouseLocationRepository.findById(id);
    if (!location) {
      throw new APIError('Байршил олдсонгүй', httpStatus.NOT_FOUND);
    }
    return location;
  }

  /**
   * §8 — ажилтан байршлын кодоор шууд хайж олно.
   */
  async getByCode(code) {
    const location = await warehouseLocationRepository.findByCode(code);
    if (!location) {
      throw new APIError(`"${code}" байршил олдсонгүй`, httpStatus.NOT_FOUND);
    }
    return location;
  }

  async create(data, actor, req) {
    // Нэг салбарын горимд `branchId` заавал биш — автоматаар сонгогдоно
    const branch = await branchResolver.resolveBranch(data.branchId);

    const code = this.buildCode(branch.code, data);

    const existing = await warehouseLocationRepository.findByCode(code);
    if (existing) {
      throw new APIError(`"${code}" байршил аль хэдийн бүртгэгдсэн`, httpStatus.CONFLICT);
    }

    const parts = parseLocationCode(code);

    return withTransaction(async session => {
      const [location] = await warehouseLocationRepository.model.create(
        [
          {
            code,
            branchId: branch._id,
            branchCode: branch.code,
            room: parts.room,
            shelf: parts.shelf,
            row: parts.row,
            cell: parts.cell,
            capacityCount: data.capacityCount ?? null,
            capacityM3: data.capacityM3 ?? null,
          },
        ],
        { session }
      );

      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.LOCATION_CREATE,
          entity: AUDIT_ENTITY.LOCATION,
          entityId: location._id,
          entityLabel: location.code,
          branchId: branch._id,
          after: { code: location.code },
          req,
        },
        { session }
      );

      return location;
    });
  }

  /**
   * Тавиурын бүх нүдийг нэг дор үүсгэнэ (§8 — bulk).
   * Аль хэдийн байгаа кодыг алгасана — дахин ажиллуулахад аюулгүй.
   */
  async createShelf({ branchId, room, shelf, rows, cells, capacityCount, capacityM3 }, actor, req) {
    const branch = await branchResolver.resolveBranch(branchId);

    const generated = generateShelfCodes({ branch: branch.code, room, shelf, rows, cells });

    const existingCodes = new Set(
      (
        await warehouseLocationRepository.model
          .find({ code: { $in: generated.map(g => g.code) } })
          .select('code')
      ).map(d => d.code)
    );

    const toCreate = generated
      .filter(g => !existingCodes.has(g.code))
      .map(g => ({
        code: g.code,
        branchId: branch._id,
        branchCode: branch.code,
        room: g.room,
        shelf: g.shelf,
        row: g.row,
        cell: g.cell,
        capacityCount: capacityCount ?? null,
        capacityM3: capacityM3 ?? null,
      }));

    if (toCreate.length === 0) {
      return { created: 0, skipped: generated.length, locations: [] };
    }

    const locations = await withTransaction(async session => {
      const docs = await warehouseLocationRepository.model.create(toCreate, {
        session,
        ordered: true,
      });

      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.LOCATION_CREATE,
          entity: AUDIT_ENTITY.LOCATION,
          entityLabel: `${branch.code}-${String(room).padStart(2, '0')}-${String(shelf).toUpperCase()}`,
          after: { createdCount: docs.length, rows, cells },
          branchId: branch._id,
          req,
        },
        { session }
      );

      return docs;
    });

    return {
      created: locations.length,
      skipped: existingCodes.size,
      locations,
    };
  }

  async update(id, data, actor, req) {
    const location = await this.getById(id);

    // Байршлын кодыг бүрдүүлэгч талбарууд өөрчлөгдвөл код зөрчилдөнө.
    // Шинэ байршил үүсгэж, хуучныг идэвхгүй болгох нь зөв зам.
    const changes = {};
    for (const field of ['capacityCount', 'capacityM3', 'isActive']) {
      if (data[field] !== undefined && String(data[field]) !== String(location[field])) {
        changes[field] = { before: location[field], after: data[field] };
      }
    }

    return withTransaction(async session => {
      const updated = await warehouseLocationRepository.model.findByIdAndUpdate(
        id,
        {
          ...(data.capacityCount !== undefined ? { capacityCount: data.capacityCount } : {}),
          ...(data.capacityM3 !== undefined ? { capacityM3: data.capacityM3 } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        },
        { new: true, runValidators: true, session }
      );

      await auditService.recordChanges(
        {
          actor,
          action: AUDIT_ACTION.LOCATION_UPDATE,
          entity: AUDIT_ENTITY.LOCATION,
          entityId: updated._id,
          entityLabel: updated.code,
          branchId: updated.branchId,
          req,
        },
        changes,
        { session }
      );

      return updated;
    });
  }

  /**
   * BR-23 — ачаа бүртгэхэд хоосон нүд санал болгоно.
   *
   * Санал нь ЗААВАЛ БИШ: ажилтан баталгаажуулах эсвэл гараар өөрчилнө.
   * Тохиргоогоор унтраасан бол `null` буцаана.
   */
  async suggestLocation(branchId, { room, shelf } = {}) {
    const enabled = await settingService.get(SETTING_KEY.WAREHOUSE_SUGGEST_ENABLED);
    if (!enabled) return null;

    const branch = await branchResolver.resolveBranch(branchId);
    return warehouseLocationRepository.findFirstAvailable(branch._id, { room, shelf });
  }

  buildCode(branchCode, { code, room, shelf, row, cell }) {
    // Бүрэн код шууд өгсөн бол задалж шалгаад, нормчлогдсон хэлбэрээр буцаана
    if (code) {
      let parts;
      try {
        parts = parseLocationCode(code);
      } catch (err) {
        throw new APIError(err.message, httpStatus.BAD_REQUEST);
      }

      if (parts.branch !== branchCode) {
        throw new APIError(
          `Байршлын кодын салбар "${parts.branch}" нь заасан салбар "${branchCode}"-тэй таарахгүй`,
          httpStatus.BAD_REQUEST
        );
      }
      return formatLocationCode(parts);
    }

    try {
      return formatLocationCode({ branch: branchCode, room, shelf, row, cell });
    } catch (err) {
      throw new APIError(err.message, httpStatus.BAD_REQUEST);
    }
  }

  /**
   * §9.1 — Менежер зөвхөн өөрийн салбарын байршлыг харна.
   */
  applyBranchScope(options, actor) {
    if (!actor || actor.role === 'admin') return options;
    if (!actor.branchId) return options;
    return { ...options, branchId: actor.branchId };
  }
}

module.exports = new WarehouseLocationService();
