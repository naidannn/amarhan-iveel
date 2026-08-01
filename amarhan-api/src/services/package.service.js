'use strict';

const httpStatus = require('http-status');
const packageRepository = require('../repositories/package.repository');
const warehouseLocationRepository = require('../repositories/warehouse-location.repository');
const branchResolver = require('./branch-resolver.service');
const customerService = require('./customer.service');
const tariffService = require('./tariff.service');
const settingService = require('./setting.service');
const auditService = require('./audit.service');
const notificationService = require('./notification.service');
const APIError = require('../utils/APIError');
const { withTransaction } = require('../utils/transaction');
const {
  calculatePrice,
  manualPrice,
  calculateVolumeM3,
  isWithinOverrideLimit,
} = require('../domain/pricing');
const { assertTrackingNumber } = require('../domain/tracking-number');
const { maskPhone } = require('../domain/phone');
const packageState = require('../domain/package-state');
const {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  ERROR_CODE,
  PACKAGE_STATUS,
  PAYMENT_STATUS,
  PRICE_SOURCE,
  REGISTRATION_SOURCE,
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

    // Дугуй хамаарлаас сэргийлж энд шаардана: `payment.service` нь
    // `package.service`-ийг модулийн дээд хэсэгт хэрэглэдэг.
    const paymentRepository = require('../repositories/payment.repository');
    const payments = await paymentRepository.listForPackage(pkg._id);

    // §5 — ачаа ямар хүргэлтэд орсон. Repository-г шууд дуудаж байгаа
    // шалтгаан: `deliveryService` нь `packageService`-ийг шаарддаг.
    const deliveryRepository = require('../repositories/delivery.repository');
    const deliveries = await deliveryRepository.listForPackage(pkg._id);

    return {
      package: pkg,
      auditLogs,
      // §2.2 — ачаанд орсон төлбөрүүд (хүчингүй болсныг ч харуулна)
      payments,
      // §5.1 — хүргэлтийн түүх (цуцлагдсаныг ч харуулна)
      deliveries,
      /**
       * UI-д ямар товч харуулахыг backend шийднэ — дүрэм ганц газарт байх ёстой.
       *
       * `manualTransitions` (БИШ `allowedTransitions`): системийн шилжилтүүд
       * (`paid`, `paid → awaiting_payment`) орвол дарах бүрт 409 буцаах товч
       * гарна (BR-09, BR-18). Хүчингүй болгох нь тусдаа товч (BR-11).
       */
      allowedTransitions: packageState.manualTransitions(pkg.status),
    };
  }

  /**
   * §1.3 — ажилтан дугаараа бичихэд шалгах. BR-46/BR-45-ийн улмаас дугаар нь
   * УРЬДЧИЛСАН бичлэгтэй (`expected`/`in_erlian`) байж болох тул харилцагчийн
   * утас/нэрийг эндээс шууд харуулж, ажилтныг дахин бичихээс чөлөөлнө
   * (`customerId`-г ЭНД populate хийнэ — `findActiveByTrackingNumber` өөрөө
   * `create()`-ийн давхардал шалгах логикт мөн ашиглагддаг тул тэнд
   * populate хийвэл `String(pkg.customerId)` харьцуулалтууд эвдэрнэ).
   */
  async getByTrackingNumber(trackingNumber) {
    const pkg = await packageRepository.findActiveByTrackingNumber(trackingNumber);
    if (!pkg) {
      throw new APIError(`"${trackingNumber}" дугаартай ачаа олдсонгүй`, httpStatus.NOT_FOUND);
    }
    await pkg.populate('customerId', 'phone name');
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
    const existing = await packageRepository.findActiveByTrackingNumber(trackingNumber);
    const targetStatus =
      data.status === PACKAGE_STATUS.IN_ERLIAN
        ? PACKAGE_STATUS.IN_ERLIAN
        : PACKAGE_STATUS.REGISTERED;

    /**
     * BR-46 — ШИНГЭЭХ. Дугаар нь УРЬДЧИЛСАН бичлэгтэй (харилцагч өөрөө
     * мэдүүлсэн `expected`, эсвэл ажилтны `in_erlian`) бөгөөд одоо бүртгэж
     * буй төлөв рүү шилжих зөвшөөрөгдсөн зам байвал ШИНЭ бичлэг үүсгэхгүй —
     * яг тэр бичлэгийг гүйцээнэ.
     *
     * ЯАГААД ЭНЭ НЬ `resolveDuplicate`-ААС ӨМНӨ: урьдчилсан бичлэг нь бодит
     * ачааны ХУУЛБАР биш, ЯГ ТЭР ачаа. Түүнийг "давхардал" гэж хоригловол
     * ажилтан бүртгэл хийж чадахгүй болно; "давхардлыг зөвшөөрөх"-өөр
     * тойровол нэг ачаа хоёр бичлэгтэй болж, харилцагч аль нь өөрийнх нь
     * ачаа болохыг ойлгохоо болино.
     *
     * `allowDuplicate` заасан үед ЗОРИУДААР шингээхгүй: Менежер тодорхой
     * шалтгаанаар ТУСДАА бичлэг үүсгэхийг хүсэж байна гэсэн үг (BR-06).
     */
    if (
      existing &&
      !data.allowDuplicate &&
      packageState.isPreArrival(existing.status) &&
      packageState.canTransition(existing.status, targetStatus)
    ) {
      return this.adoptExisting(existing, targetStatus, data, actor, req);
    }

    const branch = await branchResolver.resolveBranch(data.branchId);

    // §1.3 — давхардлыг ЭРТ шалгаж, ажилтанд ойлгомжтой мессеж буцаана.
    // Атомик хамгаалалт нь DB индекс (доорх `handleWriteError`).
    const duplicateApproval = await this.resolveDuplicate(trackingNumber, data, actor, existing);

    /**
     * BR-45 — "Эрээнд байгаа": ажилтан зөвхөн ачааны дугаар + утсаар мэднэ,
     * тэр үед жин ч, тариф ч, байршил ч байхгүй. Тиймээс `resolvePricing()`/
     * `resolveLocation()`-ыг ОГТ дуудахгүй (Joi validation аль хэдийн эдгээр
     * талбарыг `forbidden` болгосон тул `data`-д ирэхгүй). Ачаа Монголд ирэхэд
     * `completeArrival()` яг энэ бичлэг дээр үнэ/байршлыг тодорхойлно.
     */
    const isErlian = data.status === PACKAGE_STATUS.IN_ERLIAN;

    const volumeM3 = isErlian ? null : this.resolveVolume(data);
    const pricing = isErlian
      ? {
          cargoTypeId: null,
          snapshot: null,
          computedPrice: 0,
          priceSource: PRICE_SOURCE.PENDING,
          finalPrice: 0,
          overridden: false,
          overrideReason: null,
        }
      : await this.resolvePricing({ ...data, volumeM3 }, actor);
    const location = isErlian ? null : await this.resolveLocation(data, branch);
    const initialStatus = isErlian ? PACKAGE_STATUS.IN_ERLIAN : PACKAGE_STATUS.REGISTERED;

    const created = await withTransaction(async session => {
      // Утас заавал биш (BR-45) — өгөгдөөгүй бол ачаа харилцагчгүйгээр
      // бүртгэгдэнэ, дараа нь `update()`-ээр холбож болно.
      const customer = data.phone
        ? (
            await customerService.findOrCreateByPhone(
              data.phone,
              { name: data.customerName },
              { actor, session, req }
            )
          ).customer
        : null;

      const { finalPrice } = pricing;

      const [pkg] = await packageRepository.model.create(
        [
          {
            trackingNumber,
            // BR-05/BR-06 — дугаарын "эзэмшил". Зөвшөөрөгдсөн давхардал
            // дугаарыг эзэмшихгүй тул unique index-т нөлөөлөхгүй.
            activeTrackingNumber: duplicateApproval ? null : trackingNumber,
            isDuplicateApproved: Boolean(duplicateApproval),

            customerId: customer?._id ?? null,
            customerPhone: customer?.phone ?? null,
            branchId: branch._id,
            branchCode: branch.code,
            cargoTypeId: pricing.cargoTypeId,

            quantity: data.quantity,
            weightKg: data.weightKg ?? null,
            volumeM3,
            dimensions: data.dimensions ?? null,

            pricingSnapshot: pricing.snapshot,
            computedPrice: pricing.computedPrice,
            priceSource: pricing.priceSource,
            finalPrice,
            priceOverridden: pricing.overridden,
            priceOverrideReason: pricing.overrideReason,

            paidAmount: 0,
            balance: finalPrice,
            paymentStatus: PAYMENT_STATUS.UNPAID,

            status: initialStatus,
            statusHistory: [
              {
                from: null,
                to: initialStatus,
                at: new Date(),
                by: actor?._id ?? null,
                byName: auditService.describeActor(actor),
                reason: null,
              },
            ],

            locationId: location?._id ?? null,
            locationCode: location?.code ?? null,

            // `in_erlian` үед энд "Эрээнд бүртгэсэн огноо" гэсэн утгатай түр
            // хадгарна — `completeArrival()` бодит Монголд ирсэн огноогоор
            // ДАРЖ бичнэ (BR-45; давхар талбар зориудаар нэмээгүй).
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

      // BR-04 — override нь мөнгөний шийдвэр тул ЗААВАЛ тусдаа бичлэгтэй.
      // Гараар заасан үнэ (BR-01a) нь override БИШ — бодсон дүн байхгүй тул
      // "хуучин → шинэ" гэсэн харьцуулалт ч байхгүй. Тэрийг
      // `package.create`-ийн `priceSource: 'manual'` илэрхийлнэ.
      if (pricing.overridden) {
        await auditService.record(
          {
            actor,
            action: AUDIT_ACTION.PACKAGE_PRICE_OVERRIDE,
            entity: AUDIT_ENTITY.PACKAGE,
            entityId: pkg._id,
            entityLabel: pkg.trackingNumber,
            branchId: branch._id,
            field: 'finalPrice',
            before: pricing.computedPrice,
            after: pricing.finalPrice,
            reason: pricing.overrideReason,
            req,
          },
          { session }
        );
      }

      return pkg;
    }).catch(err => this.handleWriteError(err, trackingNumber));

    // BR-35 — ачаа шинээр бүртгэгдэхэд харилцагчид мэдэгдэнэ. Транзакцаас
    // ГАДУУР, throw хийхгүй (notification.service.js) тул бүртгэлийн урсгалыг
    // блоклохгүй.
    await notificationService.notifyPackageEvent(created, 'created');

    return {
      package: created,
      // BR-24 — багтаамжийн сануулга. ХОРИГЛОХГҮЙ, зөвхөн мэдэгдэнэ
      warnings: this.buildWarnings(location),
    };
  }

  /**
   * Олноор бүртгэх — админ вэбийн олон мөрт форм (§1.4-ийн хурдны зарчмыг
   * олон ачаанд зэрэг өргөтгөсөн хувилбар). `changeStatusBulk`-тэй ИЖИЛ
   * загвар: мөр бүрийг ТУСДАА `create()`-ээр (тусдаа транзакцаар) бүртгэнэ —
   * 40 мөрийн 39 нь зөв, 1 нь давхардсан дугаартай байхад бүгдийг унагах нь
   * ажилтныг гацуулна. Аль нь бүртгэгдсэн, аль нь алдаатайг мөр дугаараар
   * буцаана — ажилтан зөвхөн алдаатай мөрөө засаад дахин илгээнэ.
   */
  async createBulk(items, actor, req) {
    const succeeded = [];
    const failed = [];

    for (let index = 0; index < items.length; index += 1) {
      try {
        const result = await this.create(items[index], actor, req);
        succeeded.push(result.package);
      } catch (err) {
        failed.push({
          index,
          trackingNumber: items[index].trackingNumber,
          message: err.message,
          code: err.code ?? null,
          details: err.details ?? null,
        });
      }
    }

    return { succeeded, failed, total: items.length };
  }

  /**
   * §1.1, BR-45/BR-46 — УРЬДЧИЛСАН бичлэг (харилцагчийн мэдүүлсэн "Хүлээгдэж
   * буй" эсвэл ажилтны "Эрээнд байгаа") ачаа Монголд ирэхэд ЯГ ТЭР бичлэг
   * дээрээ жин/эзлэхүүн/үнэ/байршил нэмж "Улаанбаатарт ирсэн" болгоно. ШИНЭ
   * бичлэг ҮҮСГЭХГҮЙ — анх бүртгэсэн дугаар/утас, харилцагчийн хянаж байсан
   * бичлэг хадгалагдана.
   */
  async completeArrival(id, data, actor, req) {
    const pkg = await this.getById(id);

    if (!packageState.isPreArrival(pkg.status)) {
      throw new APIError(
        `"${packageState.label(pkg.status)}" төлөвтэй ачаанд ирц бүртгэх боломжгүй`,
        httpStatus.UNPROCESSABLE_ENTITY
      );
    }

    const { package: updated } = await this.applyArrival(pkg, data, actor, req);
    return updated;
  }

  /**
   * BR-46 — УРЬДЧИЛСАН БИЧЛЭГ ДЭЭР БҮРТГЭХ ("шингээх").
   *
   * Ажилтан ачааны дугаарыг бүртгэх маягтад бичихэд систем түүнийг аль хэдийн
   * мэдэж байвал (харилцагч мэдүүлсэн, эсвэл Эрээнд тэмдэглэсэн) шинэ бичлэг
   * үүсгэхийн оронд ЯГ ТЭР бичлэгийг гүйцээнэ — ажилтны хувьд урсгал ижил
   * хэвээр (§1.4), харилцагчийн хувьд өөрийн бүртгэсэн ачаа "хоёрдож"
   * алга болохгүй.
   */
  async adoptExisting(existing, targetStatus, data, actor, req) {
    const result =
      targetStatus === PACKAGE_STATUS.IN_ERLIAN
        ? await this.markInErlian(existing, data, actor, req)
        : await this.applyArrival(existing, data, actor, req);

    return { ...result, adopted: true, adoptedFrom: existing.status };
  }

  /**
   * "Ирц гүйцээх" цөм — `completeArrival()` (тусдаа маягт) ба `create()`-ийн
   * шингээх зам ХОЁУЛАА энд ирнэ.
   *
   * `create()`-тэй ижил дараалал (тариф/байршил шийдвэрлэлт), `changeStatus()`-
   * той ижил статус шилжилт+audit хэв маяг — гэхдээ БҮГД НЭГ транзакцад.
   */
  async applyArrival(pkg, data, actor, req) {
    // Шингээх үед ажилтан салбараа заасан байж болно; заагаагүй бол
    // урьдчилсан бичлэгийн салбар хэвээр (харилцагчийн бүртгэлд анхдагч
    // салбар оноогдсон байдаг).
    const branch = await branchResolver.resolveBranch(data.branchId ?? pkg.branchId);

    const volumeM3 = this.resolveVolume(data);
    const pricing = await this.resolvePricing({ ...data, volumeM3 }, actor);
    // Ирц гүйцээхэд байршил ЗААВАЛ — урьдчилсан бичлэгт байхгүй байсан
    // мэдээлэл энд заавал бөглөгдөнө (BR-45).
    const location = await this.resolveLocation(data, branch, { required: true });

    try {
      packageState.assertTransition(pkg.status, PACKAGE_STATUS.REGISTERED, { viaArrival: true });
    } catch (err) {
      throw new APIError(err.message, httpStatus.CONFLICT, {
        code: ERROR_CODE.INVALID_STATUS_TRANSITION,
        details: { from: pkg.status, to: PACKAGE_STATUS.REGISTERED },
      });
    }

    // Бодит Монголд ирсэн огноо — урьдчилсан үеийн `arrivedAt`
    // (бүртгэсэн огноо) энэ мөчид ДАРЖ бичигдэнэ.
    const arrivedAt = data.arrivedAt ?? new Date();

    const updated = await withTransaction(async session => {
      const link = await this.resolveCustomerLink(pkg, data, { actor, session, req });

      const doc = await packageRepository.updateByIdWithSession(
        pkg._id,
        {
          ...link.patch,
          branchId: branch._id,
          branchCode: branch.code,

          cargoTypeId: pricing.cargoTypeId,
          quantity: data.quantity ?? pkg.quantity,
          weightKg: data.weightKg ?? null,
          volumeM3,
          dimensions: data.dimensions ?? null,

          pricingSnapshot: pricing.snapshot,
          computedPrice: pricing.computedPrice,
          priceSource: pricing.priceSource,
          finalPrice: pricing.finalPrice,
          priceOverridden: pricing.overridden,
          priceOverrideReason: pricing.overrideReason,

          balance: pricing.finalPrice,
          paymentStatus: PAYMENT_STATUS.UNPAID,

          locationId: location._id,
          locationCode: location.code,

          arrivedAt,
          note: data.note !== undefined ? data.note : pkg.note,
          // Бодит бүртгэлийг хийсэн ажилтан. `registrationSource` нь ХЭВЭЭР
          // үлдэнэ — ачаа хаанаас эхэлсэн нь түүхэн баримт (BR-46).
          registeredBy: actor?._id ?? pkg.registeredBy ?? null,

          status: PACKAGE_STATUS.REGISTERED,
          $push: {
            statusHistory: {
              from: pkg.status,
              to: PACKAGE_STATUS.REGISTERED,
              at: new Date(),
              by: actor?._id ?? null,
              byName: auditService.describeActor(actor),
              reason: null,
            },
          },
        },
        { session }
      );

      // Шинээр байршил эзэлж байна — урьдчилсан төлөв нүд эзэлдэггүй байсан
      // тул `syncLocationLoad()` энд ашиглахгүй (тэр зөвхөн `pkg.locationId`
      // аль хэдийн байгаа үед ажилладаг no-op).
      await this.adjustLocationLoad(location._id, doc, +1, { session });

      await this.recordAdoption(pkg, doc, { actor, req, link }, { session });

      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.PACKAGE_STATUS_CHANGE,
          entity: AUDIT_ENTITY.PACKAGE,
          entityId: doc._id,
          entityLabel: doc.trackingNumber,
          branchId: doc.branchId,
          field: 'status',
          before: pkg.status,
          after: PACKAGE_STATUS.REGISTERED,
          reason: null,
          req,
        },
        { session }
      );

      await auditService.recordChanges(
        {
          actor,
          action: AUDIT_ACTION.PACKAGE_UPDATE,
          entity: AUDIT_ENTITY.PACKAGE,
          entityId: doc._id,
          entityLabel: doc.trackingNumber,
          branchId: doc.branchId,
          req,
        },
        {
          weightKg: { before: null, after: doc.weightKg },
          volumeM3: { before: null, after: doc.volumeM3 },
          finalPrice: { before: 0, after: doc.finalPrice },
          locationCode: { before: null, after: doc.locationCode },
        },
        { session }
      );

      return doc;
    });

    // BR-35 — ачаа Монголд ирснийг харилцагчид мэдэгдэнэ (`completeArrival`,
    // `adoptExisting`(→registered), `create()`-ийн шингээх зам ГУРВУУЛаа энд ирнэ)
    await notificationService.notifyPackageEvent(updated, PACKAGE_STATUS.REGISTERED);

    return {
      package: updated,
      warnings: [...this.buildWarnings(location), ...this.buildRelinkWarnings(pkg, updated)],
    };
  }

  /**
   * BR-46 — харилцагчийн мэдүүлсэн ачаа Эрээнд ирснийг ажилтан тэмдэглэнэ
   * (`expected → in_erlian`). Жин/үнэ/байршил ЭНД Ч БАЙХГҮЙ — зөвхөн
   * "ачаа Эрээний агуулахад хүрч ирлээ" гэсэн мэдээлэл нэмэгдэнэ.
   */
  async markInErlian(pkg, data, actor, req) {
    try {
      packageState.assertTransition(pkg.status, PACKAGE_STATUS.IN_ERLIAN, {});
    } catch (err) {
      throw new APIError(err.message, httpStatus.CONFLICT, {
        code: ERROR_CODE.INVALID_STATUS_TRANSITION,
        details: { from: pkg.status, to: PACKAGE_STATUS.IN_ERLIAN },
      });
    }

    const updated = await withTransaction(async session => {
      const link = await this.resolveCustomerLink(pkg, data, { actor, session, req });

      const doc = await packageRepository.updateByIdWithSession(
        pkg._id,
        {
          ...link.patch,
          quantity: data.quantity ?? pkg.quantity,
          note: data.note !== undefined ? data.note : pkg.note,
          registeredBy: actor?._id ?? pkg.registeredBy ?? null,

          status: PACKAGE_STATUS.IN_ERLIAN,
          $push: {
            statusHistory: {
              from: pkg.status,
              to: PACKAGE_STATUS.IN_ERLIAN,
              at: new Date(),
              by: actor?._id ?? null,
              byName: auditService.describeActor(actor),
              reason: null,
            },
          },
        },
        { session }
      );

      await this.recordAdoption(pkg, doc, { actor, req, link }, { session });

      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.PACKAGE_STATUS_CHANGE,
          entity: AUDIT_ENTITY.PACKAGE,
          entityId: doc._id,
          entityLabel: doc.trackingNumber,
          branchId: doc.branchId,
          field: 'status',
          before: pkg.status,
          after: PACKAGE_STATUS.IN_ERLIAN,
          reason: null,
          req,
        },
        { session }
      );

      return doc;
    });

    return { package: updated, warnings: this.buildRelinkWarnings(pkg, updated) };
  }

  // ── Харилцагчийн өөрийн бүртгэл (§3, BR-46) ─────────────────────────────

  /**
   * BR-46 — ХАРИЛЦАГЧ ӨӨРӨӨ вэбээс ачаагаа урьдчилан бүртгэнэ.
   *
   * Мэдэгдэж байгаа цорын ганц зүйл нь ачааны дугаар. Жин, эзлэхүүн, үнэ,
   * байршил ОГТ БАЙХГҮЙ бөгөөд харилцагчаас асуух ч ёсгүй — тэдгээрийг зөвхөн
   * компани хэмжиж тодорхойлно (§1.1). Тиймээс `create()`-ийн үнийн замыг огт
   * дуудахгүй: `finalPrice: 0`, `priceSource: 'pending'`.
   *
   * ⚠ ХАМРАХ ХҮРЭЭ: харилцагчийг ЗӨВХӨН токеноос ирсэн баримтаар тодорхойлно
   * (дүрэм 14) — `data`-д утас, `customerId` авахгүй.
   */
  async selfRegister(customer, data, req) {
    const trackingNumber = this.assertTracking(data.trackingNumber);

    const existing = await packageRepository.findActiveByTrackingNumber(trackingNumber);
    if (existing) {
      /**
       * Өөрийнх нь бичлэг бол тодорхой хэлнэ. Бусдынх бол ЯЛГААГҮЙ ерөнхий
       * мессеж: "энэ дугаар өөр хүнд бүртгэлтэй" гэж хэлэх нь дугаар дараалан
       * туршиж бусдын ачаа байгаа эсэхийг зурах боломж өгнө (§3, дүрэм 15).
       */
      const mine = String(existing.customerId) === String(customer._id);
      throw new APIError(
        mine
          ? 'Та энэ ачааг аль хэдийн бүртгүүлсэн байна'
          : 'Энэ ачааны дугаар бүртгэлтэй байна. Дугаараа шалгана уу',
        httpStatus.CONFLICT,
        { code: ERROR_CODE.DUPLICATE_TRACKING_NUMBER, details: { trackingNumber } }
      );
    }

    const branch = await branchResolver.resolveBranch();

    const created = await withTransaction(async session => {
      const [pkg] = await packageRepository.model.create(
        [
          {
            trackingNumber,
            activeTrackingNumber: trackingNumber,

            customerId: customer._id,
            customerPhone: customer.phone,
            branchId: branch._id,
            branchCode: branch.code,

            cargoTypeId: null,
            quantity: data.quantity ?? 1,
            weightKg: null,
            volumeM3: null,

            pricingSnapshot: null,
            computedPrice: 0,
            priceSource: PRICE_SOURCE.PENDING,
            finalPrice: 0,
            priceOverridden: false,

            paidAmount: 0,
            balance: 0,
            paymentStatus: PAYMENT_STATUS.UNPAID,

            status: PACKAGE_STATUS.EXPECTED,
            statusHistory: [
              {
                from: null,
                to: PACKAGE_STATUS.EXPECTED,
                at: new Date(),
                by: null,
                byName: this.describeCustomer(customer),
                reason: null,
              },
            ],

            locationId: null,
            locationCode: null,

            // Ачаа хараахан ирээгүй. Бодит ирсэн огноо `applyArrival()`-д
            // ДАРЖ бичигдэнэ — энд зөвхөн бүртгэсэн мөч.
            arrivedAt: new Date(),
            note: null,
            customerNote: data.note ?? null,
            registeredBy: null,
            registrationSource: REGISTRATION_SOURCE.CUSTOMER,
          },
        ],
        { session }
      );

      await auditService.record(
        {
          action: AUDIT_ACTION.PACKAGE_SELF_REGISTER,
          entity: AUDIT_ENTITY.PACKAGE,
          entityId: pkg._id,
          entityLabel: pkg.trackingNumber,
          branchId: branch._id,
          actorName: this.describeCustomer(customer),
          after: { trackingNumber: pkg.trackingNumber, quantity: pkg.quantity },
          req,
        },
        { session }
      );

      return pkg;
    }).catch(err => this.handleWriteError(err, trackingNumber));

    return created;
  }

  /**
   * BR-46 — харилцагч ӨӨРИЙН мэдүүлгээ буцаана (буруу дугаар бичсэн).
   *
   * BR-11-ийн "хүчингүй болгох нь Менежер/Админы эрх" дүрэмтэй зөрчилдөхгүй:
   * энд хүчингүй болж буй зүйл нь компанийн бүртгэсэн АЧАА биш, харилцагчийн
   * өөрийнх нь МЭДҮҮЛЭГ — жин ч, үнэ ч, төлбөр ч, агуулахын нүд ч хамаарахгүй.
   * Ажилтан бичлэгт хүрмэгц (`expected`-ээс гармагц) энэ зам хаагдана.
   *
   * Зам байхгүй бол буруу бичсэн дугаар нь тухайн ачааны жинхэнэ бичлэгийг
   * үүрд хааж, ажилтан бүртгэл хийж чадахгүй болно (unique index).
   */
  async selfCancel(customer, packageId, req) {
    const pkg = await packageRepository.findById(packageId);

    // Эзэмшилгүй бичлэгт `403` БИШ `404` (дүрэм 14)
    if (!pkg || String(pkg.customerId) !== String(customer._id)) {
      throw new APIError('Ачаа олдсонгүй', httpStatus.NOT_FOUND);
    }
    if (
      pkg.status !== PACKAGE_STATUS.EXPECTED ||
      pkg.registrationSource !== REGISTRATION_SOURCE.CUSTOMER
    ) {
      throw new APIError(
        'Энэ ачаа бүртгэлд орсон тул цуцлах боломжгүй. Ажилтантай холбогдоно уу',
        httpStatus.UNPROCESSABLE_ENTITY,
        { code: ERROR_CODE.INVALID_STATUS_TRANSITION }
      );
    }

    const reason = 'Харилцагч өөрөө цуцалсан';

    return withTransaction(async session => {
      const updated = await packageRepository.updateByIdWithSession(
        packageId,
        {
          status: PACKAGE_STATUS.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: reason,
          // BR-05 — дугаарыг чөлөөлнө: харилцагч алдаагаа засаад дахин
          // бүртгэнэ, ажилтны бүртгэл ч хаагдахгүй
          activeTrackingNumber: null,
          $push: {
            statusHistory: {
              from: pkg.status,
              to: PACKAGE_STATUS.CANCELLED,
              at: new Date(),
              by: null,
              byName: this.describeCustomer(customer),
              reason,
            },
          },
        },
        { session }
      );

      await auditService.record(
        {
          action: AUDIT_ACTION.PACKAGE_CANCEL,
          entity: AUDIT_ENTITY.PACKAGE,
          entityId: updated._id,
          entityLabel: updated.trackingNumber,
          branchId: updated.branchId,
          actorName: this.describeCustomer(customer),
          field: 'status',
          before: pkg.status,
          after: PACKAGE_STATUS.CANCELLED,
          reason,
          req,
        },
        { session }
      );

      return updated;
    });
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

    /**
     * Жин/эзлэхүүн өөрчлөгдвөл үнэ дахин бодогдоно.
     *
     * `pricingSnapshot` байхгүй бол (гараар үнэ заасан ачаа, BR-01a) дахин
     * бодох тариф БАЙХГҮЙ. Ийм ачаанд жин нэмэхэд өнөөдрийн тарифаар бодох нь
     * BR-02-ыг зөрчинө — тариф хожим өссөн байж болно. Тиймээс жинг зөвхөн
     * МЭДЭЭЛЭЛ болгож хадгалж, үнийг хөндөхгүй. Үнэ засах бол
     * `PUT /:id/price` гэсэн тодорхой, audit-тай зам байна.
     */
    if ((changes.weightKg || changes.volumeM3) && pkg.pricingSnapshot) {
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

    if (Object.keys(patch).length === 0 && data.phone === undefined) {
      throw new APIError('Өөрчлөх зүйл алга', httpStatus.BAD_REQUEST);
    }

    return withTransaction(async session => {
      // Утасгүй бүртгэсэн ачаанд дараа нь харилцагч холбох/солих (BR-45)
      const link = await this.resolveCustomerLink(pkg, data, { actor, session, req });
      Object.assign(patch, link.patch);

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

      if (link.changed) {
        await auditService.record(
          {
            actor,
            action: AUDIT_ACTION.PACKAGE_UPDATE,
            entity: AUDIT_ENTITY.PACKAGE,
            entityId: updated._id,
            entityLabel: updated.trackingNumber,
            branchId: updated.branchId,
            field: 'customerPhone',
            before: link.before,
            after: link.after,
            reason: 'Ажилтан ачаанд харилцагчийн утас холбов/сольсон',
            req,
          },
          { session }
        );
      }

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

    const overrideReason = this.requireReason(reason, 'Үнэ өөрчлөх шалтгаан');

    /**
     * BR-04-ийн ±% хязгаар нь ТАРИФААР бодогдсон ачаанд л үйлчилнэ: хязгаар
     * гэдэг нь "бодсон дүнгээс хэр зөрч болох" гэсэн утга. Гараар үнэ заасан
     * ачаанд (`pricingSnapshot: null`) харьцуулах бодсон дүн байхгүй тул
     * хязгаар тооцох боломжгүй — хуучин гараар заасан дүнг "тариф" гэж үзвэл
     * ажилтан хүссэн үнээ хэд хэдэн удаагийн жижиг өөрчлөлтөөр хүрч чадна.
     *
     * Тэр тохиолдолд хяналт нь: шалтгаан заавал + audit бичлэг.
     */
    if (pkg.pricingSnapshot) {
      await this.resolveOverride(
        { computedPrice: pkg.computedPrice, requested: price, reason: overrideReason },
        actor
      );
    }

    const paymentStatus = packageState.resolvePaymentStatus(price, pkg.paidAmount);

    return withTransaction(async session => {
      const updated = await packageRepository.updateByIdWithSession(
        id,
        {
          finalPrice: price,
          // Тарифаар бодогдсон ачаанд л "override" гэсэн утга бий. Гараар
          // заасан ачааны үнэ өөрчлөгдөх нь шинэ гараар заалт.
          priceOverridden: Boolean(pkg.pricingSnapshot),
          priceOverrideReason: overrideReason,
          // Гараар заасан ачаанд `computedPrice` нь үргэлж эцсийн үнэтэй
          // тэнцүү байх ёстой — эс тэгвээс "хэдээс хэд болов" гэсэн хуурамч
          // харьцуулалт үүснэ.
          ...(pkg.pricingSnapshot ? {} : { computedPrice: price }),
          balance: price - pkg.paidAmount,
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
          after: price,
          reason: overrideReason,
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

    const updated = opts.session ? await run(opts.session) : await withTransaction(run);

    // BR-35 — awaiting_payment/out_for_delivery-д мэдэгдэнэ (`notifyPackageEvent`
    // танигдаагүй `nextStatus`-д чимээгүй `null` буцаадаг тул нэмэлт нөхцөл
    // шаардлагагүй). Хүргэлтээс cascade-аар ирсэн дуудлагыг ч хамарна
    // (`delivery.service.js`-ийн `cascadeToPackages()` энэ метод ЛУУГААР дамждаг).
    await notificationService.notifyPackageEvent(updated, nextStatus);

    return updated;
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
  async resolveDuplicate(trackingNumber, data, actor, prefetched = undefined) {
    // `create()` давхардлыг шингээхийн тулд аль хэдийн уншсан — дахин уншвал
    // хоёр уншилтын хооронд төлөв өөрчлөгдөж, шийдвэр зөрөх боломж үүснэ.
    const existing =
      prefetched !== undefined
        ? prefetched
        : await packageRepository.findActiveByTrackingNumber(trackingNumber);
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
   * BR-46 — урьдчилсан бичлэгийг шингээхэд харилцагчийг ДАХИН тодорхойлно.
   *
   * ЯАГААД АЖИЛТНЫ ОРУУЛСАН УТАС ДАВАМГАЙЛАХ ЁСТОЙ: харилцагч ямар ч
   * дугаарыг өөрийн нэр дээр урьдчилан "мэдүүлж" чадна (баталгаажуулалт
   * байхгүй, OTP хараахан алга — roadmap 5.2). Мэдүүлгийг үнэн гэж авбал
   * хэн ч бусдын ачааны дугаарыг эзэмшиж, ирэхэд нь өөрийн бүртгэлд
   * харагдуулах боломжтой болно. Ажилтны бичсэн утас нь Хятадаас ирсэн
   * жагсаалтаас гардаг тул ЭНЭ Л эх сурвалж эрхийг шийднэ.
   *
   * `data.phone` байхгүй үед (тусдаа "Ирц бүртгэх" маягт) холбоос
   * ХЭВЭЭР үлдэнэ — тэр маягт утас асуудаггүй.
   *
   * @returns {{ patch: object, changed: boolean, before?: string, after?: string }}
   */
  async resolveCustomerLink(pkg, data, { actor, session, req } = {}) {
    if (!data.phone) return { patch: {}, changed: false };

    const { customer } = await customerService.findOrCreateByPhone(
      data.phone,
      { name: data.customerName },
      { actor, session, req }
    );

    if (String(customer._id) === String(pkg.customerId)) return { patch: {}, changed: false };

    return {
      patch: { customerId: customer._id, customerPhone: customer.phone },
      changed: true,
      before: pkg.customerPhone,
      after: customer.phone,
    };
  }

  /**
   * BR-46 — шингээлтийн ул мөр.
   *
   * Төлөвийн өөрчлөлтөөс ТУСДАА бичлэг үүсгэж байгаа шалтгаан: "энэ ачаа
   * харилцагчийн мэдүүлгээс эхэлсэн, ажилтан түүн дээр бүртгэсэн" гэдэг нь
   * маргаан гарахад (ачаа хэнийх вэ) хариулах ёстой асуулт. Төлөвийн
   * `expected → registered` бичлэг үүнийг илэрхийлэхгүй — тэр зөвхөн ачаа
   * ирснийг хэлнэ.
   */
  async recordAdoption(before, after, { actor, req, link }, { session } = {}) {
    if (before.status === PACKAGE_STATUS.EXPECTED) {
      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.PACKAGE_ADOPTED,
          entity: AUDIT_ENTITY.PACKAGE,
          entityId: after._id,
          entityLabel: after.trackingNumber,
          branchId: after.branchId,
          before: {
            status: before.status,
            registrationSource: before.registrationSource,
            customerPhone: before.customerPhone,
          },
          after: { status: after.status, customerPhone: after.customerPhone },
          req,
        },
        { session }
      );
    }

    if (link?.changed) {
      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.PACKAGE_UPDATE,
          entity: AUDIT_ENTITY.PACKAGE,
          entityId: after._id,
          entityLabel: after.trackingNumber,
          branchId: after.branchId,
          field: 'customerPhone',
          before: link.before,
          after: link.after,
          reason: 'Урьдчилсан бүртгэлийн утас ажилтны бүртгэлээр солигдов (BR-46)',
          req,
        },
        { session }
      );
    }
  }

  /**
   * Урьдчилсан бүртгэлийн эзэн солигдсоныг ажилтанд ХАРУУЛНА — чимээгүй
   * өөрчлөгдвөл "хэн нэгний бүртгэсэн ачаа алга болов" гэсэн гомдол
   * тайлагдахгүй болно. Хориглохгүй, зөвхөн мэдэгдэнэ (BR-24-тэй ижил зарчим).
   */
  buildRelinkWarnings(before, after) {
    if (String(before.customerPhone) === String(after.customerPhone)) return [];
    return [
      `Урьдчилан бүртгэсэн харилцагчийн утас ${before.customerPhone} байсныг ` +
        `${after.customerPhone} болгов`,
    ];
  }

  /**
   * Audit-д харилцагчийг тэмдэглэх нэр — `customer-auth.service.js`-тэй ижил
   * хэлбэр (§8: бүтэн утас бичихгүй, маскална).
   */
  describeCustomer(customer) {
    return `Харилцагч ${maskPhone(customer.phone)}`;
  }

  /**
   * §1.2 — АЧААНЫ ҮНИЙГ ТОДОРХОЙЛОХ ГАНЦ ГАЗАР. Хоёр зам:
   *
   *   А. ХЭМЖСЭН (BR-01) — жин эсвэл эзлэхүүн өгсөн. Ачааны төрлийн
   *      тарифаар бодогдож, snapshot хадгалагдана (BR-02). Ажилтан дээрээс
   *      үнэ заасан бол тэр нь OVERRIDE — шалтгаан заавал, ажилтанд ±% хязгаар
   *      үйлчилнэ (BR-04).
   *
   *   Б. ГАРААР ЗААСАН (BR-01a) — жин, эзлэхүүн хоёулаа байхгүй, ажилтан
   *      үнийн дүнг шууд бичсэн. Тариф ОГТ хэрэглэгдэхгүй тул snapshot ч,
   *      харьцуулах бодсон дүн ч байхгүй. Override биш учир шалтгаан
   *      шаардахгүй.
   *
   * ⚠ ХЯЗГААРЫН ТАЛААР: Б замд ажилтны ±% хязгаар (BR-04) үйлчлэх боломжгүй —
   * харьцуулах суурь байхгүй. Тиймээс ажилтан жин бичихгүйгээр дурын үнэ
   * тавьж хязгаарыг тойрч гарах боломжтой. Энэ нь бизнесийн ЗӨВШӨӨРСӨН
   * шийдвэр (жин үргэлж мэдэгддэггүй). Хяналт нь audit-аар хийгдэнэ:
   * `priceSource: 'manual'` бүх бичлэг тайланд тусад нь харагдана.
   *
   * @returns {{ cargoTypeId, snapshot, computedPrice, priceSource, finalPrice,
   *            overridden: boolean, overrideReason: string|null }}
   */
  async resolvePricing(data, actor) {
    const measured = data.weightKg != null || (data.volumeM3 != null && data.volumeM3 > 0);

    // ── Б зам: гараар заасан үнэ ──────────────────────────────────────────
    if (!measured) {
      if (data.finalPrice == null) {
        throw new APIError(
          'Жин, эзлэхүүн эсвэл үнийн дүнгийн ядаж нэгийг оруулах шаардлагатай',
          httpStatus.BAD_REQUEST
        );
      }

      let manual;
      try {
        manual = manualPrice(data.finalPrice);
      } catch (err) {
        throw new APIError(err.message, httpStatus.BAD_REQUEST);
      }

      return {
        cargoTypeId: data.cargoTypeId ?? null,
        snapshot: null,
        computedPrice: manual.computed,
        priceSource: manual.source,
        finalPrice: manual.final,
        overridden: false,
        overrideReason: null,
      };
    }

    // ── А зам: хэмжсэн ачаа — тариф хэрэгтэй ──────────────────────────────
    if (!data.cargoTypeId) {
      throw new APIError(
        'Жин/эзлэхүүнээр үнэ бодохын тулд ачааны төрлийг заана уу',
        httpStatus.BAD_REQUEST
      );
    }

    const cargoType = await tariffService.getCargoType(data.cargoTypeId);
    if (!cargoType.isActive) {
      throw new APIError(
        `"${cargoType.name}" ачааны төрөл идэвхгүй байна`,
        httpStatus.UNPROCESSABLE_ENTITY
      );
    }

    const tariffDoc = await tariffService.getActiveTariff(cargoType._id);
    const priced = this.computePrice({
      weightKg: data.weightKg,
      volumeM3: data.volumeM3,
      tariff: tariffDoc,
    });

    const override = await this.resolveOverride(
      {
        computedPrice: priced.final,
        requested: data.finalPrice,
        reason: data.priceOverrideReason,
      },
      actor
    );

    return {
      cargoTypeId: cargoType._id,
      snapshot: { ...tariffDoc.toTariff(), tariffVersionId: tariffDoc._id },
      computedPrice: priced.final,
      priceSource: priced.source,
      finalPrice: override ? override.price : priced.final,
      overridden: Boolean(override),
      overrideReason: override ? override.reason : null,
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
