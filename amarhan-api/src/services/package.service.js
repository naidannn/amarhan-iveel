'use strict';

const httpStatus = require('http-status');
const packageRepository = require('../repositories/package.repository');
const warehouseLocationRepository = require('../repositories/warehouse-location.repository');
const branchResolver = require('./branch-resolver.service');
const customerService = require('./customer.service');
const tariffService = require('./tariff.service');
const settingService = require('./setting.service');
const auditService = require('./audit.service');
const APIError = require('../utils/APIError');
const { withTransaction } = require('../utils/transaction');
const { calculatePrice, calculateVolumeM3, isWithinOverrideLimit } = require('../domain/pricing');
const { assertTrackingNumber } = require('../domain/tracking-number');
const packageState = require('../domain/package-state');
const {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  ERROR_CODE,
  PACKAGE_STATUS,
  PAYMENT_STATUS,
  ROLES,
  SETTING_KEY,
} = require('../config/constants');

/**
 * Ачааны модуль — introduction.md §1
 *
 * СИСТЕМИЙН ЗҮРХ. Ачаа бүртгэхээс хүлээлгэн өгөх хүртэлх бүх урсгал энд.
 *
 * Гурван зарчим:
 *   1. Мөнгө эсвэл төлөв өөрчлөх бүр audit-д, ижил ТРАНЗАКЦАД бичигдэнэ (BR-41).
 *      Ачаа хадгалагдаад audit бичигдэхгүй байх нөхцөл байж болохгүй.
 *   2. Төлөв ЗӨВХӨН `changeStatus()`-оор өөрчлөгдөнө (BR-08) — өөр хаана ч
 *      `status = ...` шууд оноохгүй.
 *   3. Үнэ бүртгэх үеийн тарифын SNAPSHOT-оор тайлбарлагдана (BR-02). Ачааг
 *      хожим засахад ч ГУРВАН сарын өмнөх тариф хэрэглэгдэнэ, өнөөдрийнх биш.
 */
class PackageService {
  // ── Уншилт ──────────────────────────────────────────────────────────────

  /**
   * §9.3 — server талын, индекслэгдсэн, хуудаслагдсан хайлт.
   */
  async list(options, actor) {
    const scoped = await this.applyBranchScope(options, actor);
    const result = await packageRepository.search({}, scoped);
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
    const pkg = await packageRepository.findById(id);
    if (!pkg) {
      throw new APIError('Ачаа олдсонгүй', httpStatus.NOT_FOUND);
    }
    return pkg;
  }

  /**
   * §1 — ачааны дэлгэрэнгүй хуудас: холбоос бүрийг нэг уншилтаар.
   */
  async getDetail(id) {
    const pkg = await packageRepository.findByIdWithRefs(id);
    if (!pkg) {
      throw new APIError('Ачаа олдсонгүй', httpStatus.NOT_FOUND);
    }

    const auditLogs = await auditService.listForEntity(AUDIT_ENTITY.PACKAGE, pkg._id);

    return {
      package: pkg,
      auditLogs,
      // UI-д ямар товч харуулахыг backend шийднэ — дүрэм ганц газарт байх ёстой
      allowedTransitions: packageState.allowedTransitions(pkg.status),
    };
  }

  async getByTrackingNumber(trackingNumber) {
    const pkg = await packageRepository.findActiveByTrackingNumber(trackingNumber);
    if (!pkg) {
      throw new APIError(`"${trackingNumber}" дугаартай ачаа олдсонгүй`, httpStatus.NOT_FOUND);
    }
    return pkg;
  }

  /**
   * §1.9 — харилцагчийн бүх ачаа (нэг дор төлбөр авах, хүлээлгэн өгөхөд).
   */
  async listByCustomerPhone(phone, { status } = {}) {
    const customer = await customerService.getByPhone(phone);
    const packages = await packageRepository.listByCustomer(customer._id, { status });

    const totals = packages.reduce(
      (acc, p) => {
        acc.finalPrice += p.finalPrice;
        acc.paidAmount += p.paidAmount;
        acc.balance += p.balance;
        return acc;
      },
      { finalPrice: 0, paidAmount: 0, balance: 0 }
    );

    return { customer, packages, totals };
  }

  // ── Бүртгэх (§1.1–§1.4) ─────────────────────────────────────────────────

  /**
   * Ачаа бүртгэх. §1.4-ийн хурдны шаардлагыг хангахын тулд ЭНЭ нэг дуудлага
   * бүх ажлыг хийнэ — ажилтан харилцагч, үнэ, байршлыг тусад нь бүртгэхгүй.
   */
  async create(data, actor, req) {
    const trackingNumber = this.assertTracking(data.trackingNumber);
    const branch = await branchResolver.resolveBranch(data.branchId);

    // §1.3 — давхардлыг ЭРТ шалгаж, ажилтанд ойлгомжтой мессеж буцаана.
    // Атомик хамгаалалт нь DB индекс (доорх `handleWriteError`).
    const duplicateApproval = await this.resolveDuplicate(trackingNumber, data, actor);

    const cargoType = await tariffService.getCargoType(data.cargoTypeId);
    if (!cargoType.isActive) {
      throw new APIError(
        `"${cargoType.name}" ачааны төрөл идэвхгүй байна`,
        httpStatus.UNPROCESSABLE_ENTITY
      );
    }
    const tariffDoc = await tariffService.getActiveTariff(cargoType._id);

    const volumeM3 = this.resolveVolume(data);
    const priced = this.computePrice({ weightKg: data.weightKg, volumeM3, tariff: tariffDoc });

    // BR-04 — бүртгэх үед шууд override хийж болно (ажилтан жинлүүрийн
    // алдаа, тусгай тохиролцоог тэр дор нь бүртгэх шаардлагатай)
    const override = await this.resolveOverride(
      { computedPrice: priced.final, requested: data.finalPrice, reason: data.priceOverrideReason },
      actor
    );

    const location = await this.resolveLocation(data, branch);

    const created = await withTransaction(async session => {
      const { customer } = await customerService.findOrCreateByPhone(
        data.phone,
        { name: data.customerName },
        { actor, session, req }
      );

      const finalPrice = override ? override.price : priced.final;

      const [pkg] = await packageRepository.model.create(
        [
          {
            trackingNumber,
            // BR-05/BR-06 — дугаарын "эзэмшил". Зөвшөөрөгдсөн давхардал
            // дугаарыг эзэмшихгүй тул unique index-т нөлөөлөхгүй.
            activeTrackingNumber: duplicateApproval ? null : trackingNumber,
            isDuplicateApproved: Boolean(duplicateApproval),

            customerId: customer._id,
            customerPhone: customer.phone,
            branchId: branch._id,
            branchCode: branch.code,
            cargoTypeId: cargoType._id,

            quantity: data.quantity,
            weightKg: data.weightKg ?? null,
            volumeM3,
            dimensions: data.dimensions ?? null,

            pricingSnapshot: {
              ...tariffDoc.toTariff(),
              tariffVersionId: tariffDoc._id,
            },
            computedPrice: priced.final,
            priceSource: priced.source,
            finalPrice,
            priceOverridden: Boolean(override),
            priceOverrideReason: override ? override.reason : null,

            paidAmount: 0,
            balance: finalPrice,
            paymentStatus: PAYMENT_STATUS.UNPAID,

            status: PACKAGE_STATUS.REGISTERED,
            statusHistory: [
              {
                from: null,
                to: PACKAGE_STATUS.REGISTERED,
                at: new Date(),
                by: actor?._id ?? null,
                byName: auditService.describeActor(actor),
                reason: null,
              },
            ],

            locationId: location?._id ?? null,
            locationCode: location?.code ?? null,

            arrivedAt: data.arrivedAt ?? new Date(),
            note: data.note ?? null,
            registeredBy: actor?._id ?? null,
          },
        ],
        { session }
      );

      if (location) {
        await this.adjustLocationLoad(location._id, pkg, +1, { session });
      }

      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.PACKAGE_CREATE,
          entity: AUDIT_ENTITY.PACKAGE,
          entityId: pkg._id,
          entityLabel: pkg.trackingNumber,
          branchId: branch._id,
          after: {
            trackingNumber: pkg.trackingNumber,
            customerPhone: pkg.customerPhone,
            quantity: pkg.quantity,
            weightKg: pkg.weightKg,
            volumeM3: pkg.volumeM3,
            computedPrice: pkg.computedPrice,
            finalPrice: pkg.finalPrice,
            priceSource: pkg.priceSource,
            locationCode: pkg.locationCode,
          },
          req,
        },
        { session }
      );

      // BR-06 — зөвшөөрөгдсөн давхардал тусдаа бичлэгтэй байх ёстой:
      // "хэн, ямар шалтгаанаар давхардуулахыг зөвшөөрсөн" гэдэг шүүх
      // боломжтой асуулт (§9.2)
      if (duplicateApproval) {
        await auditService.record(
          {
            actor,
            action: AUDIT_ACTION.PACKAGE_DUPLICATE_APPROVED,
            entity: AUDIT_ENTITY.PACKAGE,
            entityId: pkg._id,
            entityLabel: pkg.trackingNumber,
            branchId: branch._id,
            reason: duplicateApproval.reason,
            before: { existingPackageId: duplicateApproval.existing._id },
            after: { trackingNumber },
            req,
          },
          { session }
        );
      }

      // BR-04 — override нь мөнгөний шийдвэр тул ЗААВАЛ тусдаа бичлэгтэй
      if (override) {
        await auditService.record(
          {
            actor,
            action: AUDIT_ACTION.PACKAGE_PRICE_OVERRIDE,
            entity: AUDIT_ENTITY.PACKAGE,
            entityId: pkg._id,
            entityLabel: pkg.trackingNumber,
            branchId: branch._id,
            field: 'finalPrice',
            before: priced.final,
            after: override.price,
            reason: override.reason,
            req,
          },
          { session }
        );
      }

      return pkg;
    }).catch(err => this.handleWriteError(err, trackingNumber));

    return {
      package: created,
      // BR-24 — багтаамжийн сануулга. ХОРИГЛОХГҮЙ, зөвхөн мэдэгдэнэ
      warnings: this.buildWarnings(location),
    };
  }

  /**
   * Ачааны мэдээллийг засах (§1.1 — ажилтны бичсэн жин/тоо буруу байж болно).
   *
   * Жин/эзлэхүүн өөрчлөгдвөл үнэ ДАХИН бодогдоно — гэхдээ БҮРТГЭХ ҮЕИЙН
   * тарифаар (BR-02), өнөөдрийн тарифаар БИШ. Эс тэгвээс тариф өссөн өдөр
   * хуучин ачааг засахад үнэ чимээгүй өсөх байсан.
   */
  async update(id, data, actor, req) {
    const pkg = await this.getById(id);

    if (pkg.status === PACKAGE_STATUS.CANCELLED) {
      throw new APIError('Хүчингүй ачааг засах боломжгүй', httpStatus.UNPROCESSABLE_ENTITY);
    }
    // Төлбөр бүртгэгдсэн ачааны үнэ өөрчлөгдвөл нэхэмжлэх, хуваарилалт
    // зөрнө. Ийм тохиолдолд Менежер зориудаар override хийх ёстой.
    if (pkg.paidAmount > 0 && this.touchesPricing(data)) {
      throw new APIError(
        'Төлбөр бүртгэгдсэн ачааны жин/эзлэхүүнийг засах боломжгүй — үнэ засах бол override хийнэ',
        httpStatus.UNPROCESSABLE_ENTITY
      );
    }

    const next = {
      quantity: data.quantity ?? pkg.quantity,
      weightKg: data.weightKg !== undefined ? data.weightKg : pkg.weightKg,
      dimensions: data.dimensions !== undefined ? data.dimensions : pkg.dimensions,
      volumeM3: pkg.volumeM3,
      note: data.note !== undefined ? data.note : pkg.note,
      arrivedAt: data.arrivedAt ?? pkg.arrivedAt,
    };

    if (data.dimensions !== undefined || data.volumeM3 !== undefined) {
      next.volumeM3 = this.resolveVolume({
        volumeM3: data.volumeM3,
        dimensions: data.dimensions ?? pkg.dimensions,
      });
    }

    const changes = {};
    const patch = {};

    for (const field of ['quantity', 'weightKg', 'volumeM3', 'note', 'arrivedAt']) {
      if (String(next[field]) !== String(pkg[field])) {
        changes[field] = { before: pkg[field], after: next[field] };
        patch[field] = next[field];
      }
    }
    if (data.dimensions !== undefined) patch.dimensions = data.dimensions;

    // Жин/эзлэхүүн өөрчлөгдвөл үнэ дахин бодогдоно
    if (changes.weightKg || changes.volumeM3) {
      const priced = this.computePrice({
        weightKg: next.weightKg,
        volumeM3: next.volumeM3,
        tariff: pkg.pricingSnapshot,
      });

      patch.computedPrice = priced.final;
      patch.priceSource = priced.source;
      changes.computedPrice = { before: pkg.computedPrice, after: priced.final };

      // Override хүчинтэй хэвээр: ажилтан зориудаар тавьсан дүнг систем
      // дарж бичих ёсгүй. Override-гүй ачааны үнэ шинэчлэгдэнэ.
      if (!pkg.priceOverridden) {
        patch.finalPrice = priced.final;
        patch.balance = priced.final - pkg.paidAmount;
        patch.paymentStatus = packageState.resolvePaymentStatus(priced.final, pkg.paidAmount);
        changes.finalPrice = { before: pkg.finalPrice, after: priced.final };
      }
    }

    if (Object.keys(patch).length === 0) {
      throw new APIError('Өөрчлөх зүйл алга', httpStatus.BAD_REQUEST);
    }

    return withTransaction(async session => {
      const updated = await packageRepository.updateByIdWithSession(id, patch, { session });

      await auditService.recordChanges(
        {
          actor,
          action: AUDIT_ACTION.PACKAGE_UPDATE,
          entity: AUDIT_ENTITY.PACKAGE,
          entityId: updated._id,
          entityLabel: updated.trackingNumber,
          branchId: updated.branchId,
          req,
        },
        changes,
        { session }
      );

      return updated;
    });
  }

  // ── Үнэ override (§1.2, BR-04) ──────────────────────────────────────────

  async overridePrice(id, { price, reason }, actor, req) {
    const pkg = await this.getById(id);

    if (pkg.status === PACKAGE_STATUS.CANCELLED) {
      throw new APIError('Хүчингүй ачааны үнэ өөрчлөх боломжгүй', httpStatus.UNPROCESSABLE_ENTITY);
    }
    if (price === pkg.finalPrice) {
      throw new APIError('Үнэ өөрчлөгдөөгүй байна', httpStatus.BAD_REQUEST);
    }

    const override = await this.resolveOverride(
      { computedPrice: pkg.computedPrice, requested: price, reason },
      actor
    );

    const paymentStatus = packageState.resolvePaymentStatus(override.price, pkg.paidAmount);

    return withTransaction(async session => {
      const updated = await packageRepository.updateByIdWithSession(
        id,
        {
          finalPrice: override.price,
          priceOverridden: true,
          priceOverrideReason: override.reason,
          balance: override.price - pkg.paidAmount,
          paymentStatus,
        },
        { session }
      );

      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.PACKAGE_PRICE_OVERRIDE,
          entity: AUDIT_ENTITY.PACKAGE,
          entityId: updated._id,
          entityLabel: updated.trackingNumber,
          branchId: updated.branchId,
          field: 'finalPrice',
          before: pkg.finalPrice,
          after: override.price,
          reason: override.reason,
          req,
        },
        { session }
      );

      return updated;
    });
  }

  // ── Төлөв (§1.5, BR-07/BR-08) ──────────────────────────────────────────

  /**
   * ТӨЛӨВ ӨӨРЧЛӨХ ГАНЦ ЗАМ (BR-08).
   *
   * @param {object} [opts]
   * @param {import('mongoose').ClientSession} [opts.session] — гадаад транзакц
   *        (Phase 3-ийн төлбөр `paid` төлөвт шилжүүлэхэд ижил транзакц хэрэглэнэ)
   * @param {boolean} [opts.system] — систем өөрөө хийж байгаа шилжилт (BR-09)
   */
  async changeStatus(id, nextStatus, { reason } = {}, actor, req, opts = {}) {
    // Хүчингүй болгох нь эрх ба шалтгаан шаарддаг тусдаа дүрэмтэй (BR-11)
    if (nextStatus === PACKAGE_STATUS.CANCELLED) {
      return this.cancel(id, { reason }, actor, req);
    }

    const pkg = await this.getById(id);

    try {
      packageState.assertTransition(pkg.status, nextStatus, {
        paymentStatus: pkg.paymentStatus,
        system: opts.system === true,
      });
    } catch (err) {
      throw new APIError(err.message, httpStatus.CONFLICT, {
        code: ERROR_CODE.INVALID_STATUS_TRANSITION,
        details: { from: pkg.status, to: nextStatus },
      });
    }

    const run = async session => {
      const updated = await packageRepository.updateByIdWithSession(
        id,
        {
          status: nextStatus,
          $push: {
            statusHistory: {
              from: pkg.status,
              to: nextStatus,
              at: new Date(),
              by: actor?._id ?? null,
              byName: auditService.describeActor(actor),
              reason: reason ?? null,
            },
          },
        },
        { session }
      );

      // §8 — ачаа агуулахаас гарах/буцаж ирэхэд нүдний ачаалал өөрчлөгдөнө
      await this.syncLocationLoad(pkg, nextStatus, { session });

      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.PACKAGE_STATUS_CHANGE,
          entity: AUDIT_ENTITY.PACKAGE,
          entityId: updated._id,
          entityLabel: updated.trackingNumber,
          branchId: updated.branchId,
          field: 'status',
          before: pkg.status,
          after: nextStatus,
          reason: reason ?? null,
          req,
        },
        { session }
      );

      return updated;
    };

    return opts.session ? run(opts.session) : withTransaction(run);
  }

  /**
   * §1.9 — олон ачааны төлөвийг нэг дор өөрчлөх (20–40 ачаа нэг дор өгдөг).
   *
   * Ачаа тус бүрийг ТУСДАА транзакцаар хийж байгаа шалтгаан: 40 ачааны 39
   * зөв, 1 нь буруу төлөвт байхад бүгдийг унагах нь ажилтныг гацуулна.
   * Аль нь болсон, аль нь болоогүйг тодорхой буцаана.
   */
  async changeStatusBulk(ids, nextStatus, { reason } = {}, actor, req) {
    const succeeded = [];
    const failed = [];

    for (const id of ids) {
      try {
        const updated = await this.changeStatus(id, nextStatus, { reason }, actor, req);
        succeeded.push({ id: updated._id, trackingNumber: updated.trackingNumber });
      } catch (err) {
        failed.push({ id, message: err.message, code: err.code ?? null });
      }
    }

    return { succeeded, failed, total: ids.length };
  }

  // ── Хүчингүй болгох ба устгах (§1.6, BR-10…BR-12) ───────────────────────

  /**
   * BR-11 — Менежер/Админ, шалтгаан заавал. Ачаа УСТАХГҮЙ.
   */
  async cancel(id, { reason }, actor, req) {
    if (!this.isManagement(actor)) {
      throw new APIError(
        'Ачааг хүчингүй болгох эрх зөвхөн Менежер, Админд байна',
        httpStatus.FORBIDDEN
      );
    }
    const cancelReason = this.requireReason(reason, 'Хүчингүй болгох шалтгаан');

    const pkg = await this.getById(id);

    try {
      packageState.assertTransition(pkg.status, PACKAGE_STATUS.CANCELLED, {
        paymentStatus: pkg.paymentStatus,
      });
    } catch (err) {
      throw new APIError(err.message, httpStatus.CONFLICT, {
        code: ERROR_CODE.INVALID_STATUS_TRANSITION,
        details: { from: pkg.status, to: PACKAGE_STATUS.CANCELLED },
      });
    }

    return withTransaction(async session => {
      const updated = await packageRepository.updateByIdWithSession(
        id,
        {
          status: PACKAGE_STATUS.CANCELLED,
          cancelledAt: new Date(),
          cancelReason,
          // BR-05 — дугаарыг чөлөөлнө: ажилтан алдаагаа засаад дахин бүртгэнэ
          activeTrackingNumber: null,
          $push: {
            statusHistory: {
              from: pkg.status,
              to: PACKAGE_STATUS.CANCELLED,
              at: new Date(),
              by: actor?._id ?? null,
              byName: auditService.describeActor(actor),
              reason: cancelReason,
            },
          },
        },
        { session }
      );

      await this.syncLocationLoad(pkg, PACKAGE_STATUS.CANCELLED, { session });

      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.PACKAGE_CANCEL,
          entity: AUDIT_ENTITY.PACKAGE,
          entityId: updated._id,
          entityLabel: updated.trackingNumber,
          branchId: updated.branchId,
          field: 'status',
          before: pkg.status,
          after: PACKAGE_STATUS.CANCELLED,
          reason: cancelReason,
          req,
        },
        { session }
      );

      return updated;
    });
  }

  /**
   * BR-10 — БҮРМӨСӨН УСТГАХ. Гурван нөхцөл бүгд биелэх ёстой:
   *   1. Админ
   *   2. Ямар ч төлбөр бүртгэгдээгүй
   *   3. Бүртгэснээс хойш тохируулсан цонх (default 24ц) хэтрээгүй
   *
   * Устгал нь audit болон санхүүгийн тэнцлийн бүрэн бүтэн байдлыг эвддэг тул
   * зөвхөн бодит хүний алдаа (шинэ, төлбөргүй, богино хугацаа) үед л зөвшөөрнө.
   */
  async remove(id, { reason }, actor, req) {
    if (actor?.role !== ROLES.ADMIN) {
      throw new APIError('Ачаа бүрмөсөн устгах эрх зөвхөн Админд байна', httpStatus.FORBIDDEN);
    }
    const deleteReason = this.requireReason(reason, 'Устгах шалтгаан');

    const pkg = await this.getById(id);

    if (pkg.paidAmount > 0) {
      throw new APIError(
        'Төлбөр бүртгэгдсэн ачааг устгах боломжгүй — "Хүчингүй" болгоно уу',
        httpStatus.UNPROCESSABLE_ENTITY,
        { code: ERROR_CODE.DELETE_NOT_ALLOWED, details: { paidAmount: pkg.paidAmount } }
      );
    }

    const windowHours = await settingService.getNumber(SETTING_KEY.PACKAGE_DELETE_WINDOW_HOURS);
    const ageHours = (Date.now() - new Date(pkg.createdAt).getTime()) / 3_600_000;

    if (ageHours > windowHours) {
      throw new APIError(
        `Бүртгэснээс хойш ${windowHours} цаг хэтэрсэн ачааг устгах боломжгүй — ` +
          '"Хүчингүй" болгоно уу',
        httpStatus.UNPROCESSABLE_ENTITY,
        {
          code: ERROR_CODE.DELETE_NOT_ALLOWED,
          details: { windowHours, ageHours: Math.round(ageHours * 10) / 10 },
        }
      );
    }

    return withTransaction(async session => {
      // BR-12 — устгасан ч audit-д БҮРЭН snapshot үлдэнэ. Устгахаас ӨМНӨ
      // бичиж байгаа шалтгаан: транзакц унавал хоёулаа буцна, харин
      // код уншихад "устгахын өмнө хууль бичив" гэсэн дараалал ойлгомжтой.
      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.PACKAGE_DELETE,
          entity: AUDIT_ENTITY.PACKAGE,
          entityId: pkg._id,
          entityLabel: pkg.trackingNumber,
          branchId: pkg.branchId,
          before: pkg.toObject(),
          after: null,
          reason: deleteReason,
          req,
        },
        { session }
      );

      // Устгагдах ачаа нүдийг эзлэхээ болино
      if (pkg.locationId && packageState.occupiesLocation(pkg.status)) {
        await this.adjustLocationLoad(pkg.locationId, pkg, -1, { session });
      }

      await packageRepository.deleteByIdWithSession(id, { session });

      return { deleted: true, trackingNumber: pkg.trackingNumber };
    });
  }

  // ── Байршил (§8, BR-25) ─────────────────────────────────────────────────

  async moveLocation(id, data, actor, req) {
    const pkg = await this.getById(id);

    if (pkg.status === PACKAGE_STATUS.CANCELLED) {
      throw new APIError(
        'Хүчингүй ачааны байршлыг өөрчлөх боломжгүй',
        httpStatus.UNPROCESSABLE_ENTITY
      );
    }

    const branch = await branchResolver.resolveBranch(pkg.branchId);
    const location = await this.resolveLocation(data, branch, { required: true });

    if (pkg.locationId && String(pkg.locationId) === String(location._id)) {
      throw new APIError('Ачаа аль хэдийн энэ байршилд байна', httpStatus.BAD_REQUEST);
    }

    const updated = await withTransaction(async session => {
      // BR-25 — хуучин нүд буурч, шинэ нүд нэмэгдэнэ, НЭГ транзакцад.
      // Ачаа нүдийг эзлэхгүй төлөвт (илгээгдсэн, гарсан) байвал ачаалал
      // аль хэдийн хорогдсон тул дахин хорогдуулахгүй.
      if (packageState.occupiesLocation(pkg.status)) {
        if (pkg.locationId) {
          await this.adjustLocationLoad(pkg.locationId, pkg, -1, { session });
        }
        await this.adjustLocationLoad(location._id, pkg, +1, { session });
      }

      const doc = await packageRepository.updateByIdWithSession(
        id,
        { locationId: location._id, locationCode: location.code },
        { session }
      );

      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.PACKAGE_LOCATION_MOVE,
          entity: AUDIT_ENTITY.PACKAGE,
          entityId: doc._id,
          entityLabel: doc.trackingNumber,
          branchId: doc.branchId,
          field: 'locationCode',
          before: pkg.locationCode,
          after: location.code,
          reason: data.reason ?? null,
          req,
        },
        { session }
      );

      return doc;
    });

    return { package: updated, warnings: this.buildWarnings(location) };
  }

  // ── Дотоод дүрмүүд ──────────────────────────────────────────────────────

  assertTracking(value) {
    try {
      return assertTrackingNumber(value);
    } catch (err) {
      throw new APIError(err.message, httpStatus.BAD_REQUEST);
    }
  }

  /**
   * §1.3, BR-05/BR-06 — давхардлыг шийднэ.
   *
   * @returns {null|{existing: object, reason: string}} null = давхардал байхгүй
   */
  async resolveDuplicate(trackingNumber, data, actor) {
    const existing = await packageRepository.findActiveByTrackingNumber(trackingNumber);
    if (!existing) return null;

    // BR-05 — ажилтанд ХАТУУ хориглоно. Зөвхөн сануулга байвал ажилтан
    // алгасаж, дараа нь төлбөр/хүргэлтийн будлиан үүсгэнэ.
    if (!data.allowDuplicate) {
      throw new APIError(
        `"${trackingNumber}" дугаар аль хэдийн бүртгэгдсэн байна`,
        httpStatus.CONFLICT,
        {
          code: ERROR_CODE.DUPLICATE_TRACKING_NUMBER,
          details: {
            packageId: existing._id,
            trackingNumber: existing.trackingNumber,
            registeredAt: existing.createdAt,
            registeredBy: existing.registeredBy
              ? `${existing.registeredBy.firstname ?? ''} ${existing.registeredBy.lastname ?? ''}`.trim()
              : null,
            status: existing.status,
            customerPhone: existing.customerPhone,
          },
        }
      );
    }

    // BR-06 — зөвхөн Менежер/Админ, шалтгаантайгаар
    if (!this.isManagement(actor)) {
      throw new APIError(
        'Давхар бүртгэхийг зөвшөөрөх эрх зөвхөн Менежер, Админд байна',
        httpStatus.FORBIDDEN,
        { code: ERROR_CODE.DUPLICATE_TRACKING_NUMBER }
      );
    }

    return {
      existing,
      reason: this.requireReason(data.duplicateReason, 'Давхар бүртгэх шалтгаан'),
    };
  }

  /**
   * BR-03 — хэмжээсээс эзлэхүүн. Шууд `volumeM3` өгсөн бол түүнийг ашиглана.
   */
  resolveVolume({ volumeM3, dimensions }) {
    if (volumeM3 != null) return Number(volumeM3);
    if (!dimensions) return null;

    try {
      return calculateVolumeM3(dimensions);
    } catch (err) {
      throw new APIError(err.message, httpStatus.BAD_REQUEST);
    }
  }

  /**
   * Домэйн функц Mongoose баримтаас хамаарах ёсгүй тул цэвэр объект болгоно.
   * `tariff` нь `TariffVersion` баримт (бүртгэх үед) эсвэл ачааны
   * `pricingSnapshot` дэд баримт (засах үед) байж болно.
   */
  computePrice({ weightKg, volumeM3, tariff }) {
    let plain = tariff;
    if (typeof tariff?.toTariff === 'function') plain = tariff.toTariff();
    else if (typeof tariff?.toObject === 'function') plain = tariff.toObject();

    try {
      return calculatePrice({ weightKg, volumeM3, tariff: plain });
    } catch (err) {
      throw new APIError(err.message, httpStatus.BAD_REQUEST);
    }
  }

  /**
   * BR-04 — override зөвшөөрөгдөх эсэх.
   *
   * @returns {null|{price: number, reason: string}} null = override хийгээгүй
   */
  async resolveOverride({ computedPrice, requested, reason }, actor) {
    if (requested == null) return null;
    if (requested === computedPrice) return null;

    const overrideReason = this.requireReason(reason, 'Үнэ өөрчлөх шалтгаан');

    // Менежер/Админ хязгааргүй (§9.1)
    if (this.isManagement(actor)) {
      return { price: requested, reason: overrideReason };
    }

    const limitPercent = await settingService.getNumber(SETTING_KEY.PRICING_OVERRIDE_LIMIT_PERCENT);

    if (!isWithinOverrideLimit(computedPrice, requested, limitPercent)) {
      throw new APIError(
        `Ажилтан үнийг ±${limitPercent}% хүрээнд л өөрчилнө. ` +
          `Бодогдсон үнэ ${computedPrice}₮ — Менежерээр хийлгэнэ үү`,
        httpStatus.FORBIDDEN,
        {
          code: ERROR_CODE.OVERRIDE_LIMIT_EXCEEDED,
          details: { computedPrice, requested, limitPercent },
        }
      );
    }

    return { price: requested, reason: overrideReason };
  }

  /**
   * Байршлыг ID эсвэл кодоор олно. §1.1-д байршил ЗААВАЛ тул `required`.
   */
  async resolveLocation({ locationId, locationCode }, branch, { required = true } = {}) {
    let location = null;

    if (locationId) {
      location = await warehouseLocationRepository.findById(locationId);
      if (!location) throw new APIError('Байршил олдсонгүй', httpStatus.NOT_FOUND);
    } else if (locationCode) {
      location = await warehouseLocationRepository.findByCode(locationCode);
      if (!location) {
        throw new APIError(`"${locationCode}" байршил олдсонгүй`, httpStatus.NOT_FOUND);
      }
    }

    if (!location) {
      if (required) {
        throw new APIError('Байршлын код шаардлагатай', httpStatus.BAD_REQUEST);
      }
      return null;
    }

    // Өөр салбарын нүдэнд ачаа тавихыг хориглоно — байршлын код салбараас
    // эхэлдэг тул зөрчилдвөл агуулах дотор ачаа "алга болно" (§8)
    if (String(location.branchId) !== String(branch._id)) {
      throw new APIError(
        `"${location.code}" байршил "${branch.code}" салбарт хамаарахгүй`,
        httpStatus.BAD_REQUEST
      );
    }

    return location;
  }

  /**
   * §8 — нүдний ачаалал. Ачаа нэг нүдийг НЭГ ГАЗАР эзэлнэ (`quantity` биш):
   * `capacityCount` нь "нүдэнд багтах ачааны тоо" гэсэн утгатай.
   */
  async adjustLocationLoad(locationId, pkg, direction, { session } = {}) {
    return warehouseLocationRepository.adjustLoad(
      locationId,
      {
        countDelta: direction,
        m3Delta: direction * (pkg.volumeM3 ?? 0),
      },
      { session }
    );
  }

  /**
   * Төлөв шилжихэд нүдний ачааллыг тааруулна.
   *
   * Зөвхөн эзэмшлийн ТӨЛӨВ ӨӨРЧЛӨГДӨХӨД л хөдөлгөнө — эс тэгвээс
   * `arrived → notified` гэх мэт агуулах дотор үлдэх шилжилт бүрт
   * ачаалал буруу хуримтлагдана.
   */
  async syncLocationLoad(pkg, nextStatus, { session } = {}) {
    if (!pkg.locationId) return;

    const was = packageState.occupiesLocation(pkg.status);
    const will = packageState.occupiesLocation(nextStatus);
    if (was === will) return;

    await this.adjustLocationLoad(pkg.locationId, pkg, will ? +1 : -1, { session });
  }

  /**
   * BR-24 — багтаамжийн сануулга. ХОРИГЛОХГҮЙ: ажилтны шийдвэрийг систем
   * дарж болохгүй, зөвхөн мэдээлнэ.
   */
  buildWarnings(location) {
    const warnings = [];
    if (location?.isFull) {
      warnings.push(`"${location.code}" нүд багтаамжаа хэтрүүлсэн байна`);
    }
    return warnings;
  }

  /**
   * §9.1, BR-37 — Менежер зөвхөн өөрийн салбарын ачааг харна.
   * Frontend-ээс ирсэн `branchId`-д ИТГЭХГҮЙ — дарж бичнэ.
   *
   * Салбар оноогоогүй Менежерт BR-22a үйлчилнэ: ганц салбартай үед тэр
   * салбарт хамрагдана, олон салбартай үед `resolveBranch()` алдаа өгч
   * админ салбар оноохыг шаардана — өөр салбарын ачаа чимээгүй харагдахгүй.
   */
  async applyBranchScope(options, actor) {
    if (!actor || actor.role === ROLES.ADMIN) return options;
    if (actor.branchId) return { ...options, branchId: actor.branchId };

    const branch = await branchResolver.resolveBranch();
    return { ...options, branchId: branch._id };
  }

  isManagement(actor) {
    return actor?.role === ROLES.ADMIN || actor?.role === ROLES.MANAGER;
  }

  requireReason(reason, label) {
    const trimmed = String(reason ?? '').trim();
    if (!trimmed) {
      throw new APIError(`${label} заавал бичих шаардлагатай`, httpStatus.BAD_REQUEST);
    }
    return trimmed;
  }

  touchesPricing(data) {
    return (
      data.weightKg !== undefined || data.volumeM3 !== undefined || data.dimensions !== undefined
    );
  }

  /**
   * Хоёр ажилтан ЯГ ЗЭРЭГ ижил дугаар бүртгэхэд service талын шалгалт хоёуланд
   * "давхардал байхгүй" гэж хариулж, DB индекс л барина. Тэр алдааг
   * ажилтанд ойлгомжтой хэлбэрт хөрвүүлнэ.
   */
  handleWriteError(err, trackingNumber) {
    if (err?.code === 11000) {
      throw new APIError(
        `"${trackingNumber}" дугаар аль хэдийн бүртгэгдсэн байна`,
        httpStatus.CONFLICT,
        { code: ERROR_CODE.DUPLICATE_TRACKING_NUMBER, details: { trackingNumber } }
      );
    }
    throw err;
  }
}

module.exports = new PackageService();
