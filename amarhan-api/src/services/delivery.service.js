'use strict';

const httpStatus = require('http-status');
const deliveryRepository = require('../repositories/delivery.repository');
const packageRepository = require('../repositories/package.repository');
const paymentRepository = require('../repositories/payment.repository');
const counterRepository = require('../repositories/counter.repository');
const userRepository = require('../repositories/user.repository');
const branchResolver = require('./branch-resolver.service');
const customerService = require('./customer.service');
const packageService = require('./package.service');
const paymentService = require('./payment.service');
const auditService = require('./audit.service');
const APIError = require('../utils/APIError');
const { withTransaction } = require('../utils/transaction');
const deliveryState = require('../domain/delivery-state');
const packageState = require('../domain/package-state');
const { normalizePhone, maskPhone } = require('../domain/phone');
const { buildFullSettlement } = require('../domain/allocation');
const {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  DELIVERY_STATUS,
  DELIVERY_FEE_AMOUNT,
  ERROR_CODE,
  PAYMENT_METHOD,
  ROLES,
} = require('../config/constants');

/**
 * Хүргэлтийн модуль — introduction.md §5, BR-19…BR-21
 *
 * ГОЛ ХАРИУЦЛАГА: §5.2-ын хаалт. Төлбөр дутуу ачаа хүргэлтэнд ГАРАХГҮЙ,
 * override БАЙХГҮЙ — Админ ч тойрч чадахгүй. Тиймээс энэ файлд `force`,
 * `skipPaymentCheck` гэсэн параметр ЗОРИУД байхгүй: сонголт байхгүй бол
 * тойрч гарах зам ч байхгүй.
 *
 * ХАМГААЛАЛТ ХОЁР ДАВХАРГА:
 *   1. Хүргэлтийн түвшинд — `delivery-state.assertTransition({ unpaidTotal })`
 *      багц доторх БҮХ ачааны үлдэгдлийг нийлүүлж шалгана (BR-20).
 *   2. Ачаа тус бүрийн түвшинд — `packageService.changeStatus` дотор
 *      `package-state.assertTransition` дахин шалгана (BR-19).
 * Хоёулаа ижил транзакц дотор, ачааг ДАХИН уншиж хийгдэнэ: ажилтан
 * жагсаалт үзэж байх зуур төлбөр хүчингүй болсон байж болно.
 *
 * ТӨЛӨВ ӨӨРЧЛӨХ ГАНЦ ЗАМ — `changeStatus()`. Кодын өөр хаана ч
 * `delivery.status = ...` шууд оноохыг хориглоно.
 */
class DeliveryService {
  // ── Уншилт (§5) ─────────────────────────────────────────────────────────

  async list(options, actor) {
    const scoped = await this.applyBranchScope(options, actor);
    const result = await deliveryRepository.search({}, scoped);
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

  /** §5 — өдрийн маршрутын нэгтгэл (төлөв тус бүрийн тоо) */
  async summary(options, actor) {
    const scoped = await this.applyBranchScope(options, actor);
    return deliveryRepository.summary(scoped);
  }

  async getById(id) {
    const delivery = await deliveryRepository.findById(id);
    if (!delivery) {
      throw new APIError('Хүргэлт олдсонгүй', httpStatus.NOT_FOUND);
    }
    return delivery;
  }

  /**
   * §5.1 — хүргэлтийн дэлгэрэнгүй: багц, төлбөрийн байдал, түүх, audit.
   *
   * `unpaidTotal`-ыг ХАМТ буцаана: UI "Төлбөр дутуу байна: XXX₮" гэж
   * харуулах ба «Хүргэлтэнд гаргах» товчийг идэвхгүй болгоход шаардагдана
   * (§5.2). Тэр тоог client талд ачаанаас нэмж бодуулбал backend-тэй
   * зөрөх эрсдэлтэй — дүрэм ганц газарт байх ёстой.
   */
  async getDetail(id) {
    const delivery = await deliveryRepository.findByIdWithRefs(id);
    if (!delivery) {
      throw new APIError('Хүргэлт олдсонгүй', httpStatus.NOT_FOUND);
    }

    const auditLogs = await auditService.listForEntity(AUDIT_ENTITY.DELIVERY, delivery._id);

    const unpaid = (delivery.packageIds ?? [])
      .filter(pkg => pkg && pkg.balance > 0)
      .map(pkg => ({
        id: pkg._id,
        trackingNumber: pkg.trackingNumber,
        balance: pkg.balance,
      }));

    // Roadmap 5.8 — харилцагч өөрөө захиалсан хүргэлтийн хураамжийн
    // pending/completed/voided төлбөрүүд. Ажилтны хуучин хүргэлтэд (fee зөвхөн
    // мэдээлэл) энэ жагсаалт үргэлж хоосон — холбогдох төлбөр байхгүй тул.
    const feePayments = await paymentRepository.listForDelivery(delivery._id);

    return {
      delivery,
      auditLogs,
      unpaidPackages: unpaid,
      unpaidTotal: unpaid.reduce((sum, p) => sum + p.balance, 0),
      // Ажилтны гар бичилтийн `fee`-д ХЭЗЭЭ Ч гарахгүй (`changeStatus`-ийн ижил
      // `createdBy == null` хамгаалалт) — эс тэгвээс UI бодит хаалттай ЗӨРНӨ.
      unpaidFee:
        delivery.createdBy == null
          ? Math.max((delivery.fee ?? 0) - (delivery.feePaidAmount ?? 0), 0)
          : 0,
      feePayments,
      /**
       * UI-д ямар товч харуулахыг backend шийднэ — дүрэм ганц газарт байна.
       * `manualTransitions` (БИШ `allowedTransitions`): цуцлах нь эрх ба
       * шалтгаан шаардсан тусдаа товч.
       */
      allowedTransitions: deliveryState.manualTransitions(delivery.status),
    };
  }

  async listForPackage(packageId) {
    await packageService.getById(packageId);
    return deliveryRepository.listForPackage(packageId);
  }

  /**
   * §5 — хүргэлт үүсгэхийн ӨМНӨХ дэлгэц: утсаар хүргэх боломжтой ачаа.
   *
   * Идэвхтэй хүргэлтэд аль хэдийн орсон ачааг ХАСНА (BR-20a) — ажилтан
   * сонгочихоод "энэ ачаа өөр хүргэлтэд байна" гэсэн алдаа авах нь цаг үрнэ.
   */
  async deliverableByPhone(phone) {
    const customer = await customerService.getByPhone(phone);
    const packages = await packageRepository.listByCustomer(customer._id);

    const eligible = packages.filter(p => this.isDeliverableStatus(p.status));

    const active = await deliveryRepository.findActiveContainingPackages(eligible.map(p => p._id));
    const taken = new Set(active.flatMap(d => d.packageIds.map(String)));

    const available = eligible.filter(p => !taken.has(String(p._id)));

    return {
      customer,
      packages: available,
      totalBalance: available.reduce((sum, p) => sum + p.balance, 0),
      // Ажилтанд яагаад зарим ачаа алга болсныг тайлбарлах
      inActiveDelivery: active.map(d => ({
        id: d._id,
        deliveryNumber: d.deliveryNumber,
        status: d.status,
      })),
    };
  }

  /**
   * Roadmap 5.8 — харилцагчийн ӨӨРИЙН вэб дэлгэц: захиалж болох ачаа.
   *
   * `deliverableByPhone`-ийн ижил логик, ГЭХДЭЭ утсаар БИШ, `customer._id`-аар
   * шууд ачаална — токеноос ирсэн эзэмшилд шууд хязгаарлагдана (CLAUDE.md §5
   * дүрэм 14), утас/өөр харилцагчийн ID дамжуулах зам ОГТ байхгүй.
   */
  async deliverableForCustomer(customer) {
    const packages = await packageRepository.listByCustomer(customer._id);

    const eligible = packages.filter(p => this.isDeliverableStatus(p.status));

    const active = await deliveryRepository.findActiveContainingPackages(eligible.map(p => p._id));
    const taken = new Set(active.flatMap(d => d.packageIds.map(String)));

    return eligible.filter(p => !taken.has(String(p._id)));
  }

  /**
   * Roadmap 5.8 — харилцагч өөрөө хүргэлт захиална.
   *
   * `create()`-ээс ХОЁР чухал ялгаатай:
   *   1. ЭЗЭМШЛИЙГ шалгана (`create()` нь ажилтны эрхэд итгэдэг) — бусдын
   *      ачаа заавал `404` (дүрэм 14).
   *   2. Сонгосон ачааны ҮЛДЭГДЭЛ + `DELIVERY_FEE_AMOUNT`-ыг НЭГ `pending`
   *      төлбөр болгож ЯГ ТЭР транзакцад үүсгэнэ (`buildFullSettlement`) —
   *      ажилтан баталгаажуулмагц (`payment.service.js` `confirmPending`)
   *      ачааны үлдэгдэл БА хүргэлтийн хураамж хамт барагдана.
   */
  async selfCreate(customer, data, req) {
    const { packageIds, address, phone, note } = data;

    if (!Array.isArray(packageIds) || packageIds.length === 0) {
      throw new APIError('Ачаа сонгоно уу', httpStatus.BAD_REQUEST);
    }

    const unique = [...new Set(packageIds.map(String))];
    if (unique.length !== packageIds.length) {
      throw new APIError('Нэг ачаа хоёр удаа сонгогдсон байна', httpStatus.BAD_REQUEST);
    }

    return withTransaction(async session => {
      // Эзэмшлийг ЗААВАЛ `loadDeliverablePackages`-ээс ӨМНӨ шалгана: тэр нь
      // "ямар төлөвт байна" гэдгийг мессежинд ил бичдэг тул бусдын ID-аар
      // дуудвал ЭЗЭМШЛИЙН шалгалт хийгдэхээс өмнө оршин байдал, төлөв алдагдаж
      // болзошгүй (дүрэм 14 — эрхгүй бичлэгт 403 БИШ ялгаагүй 404).
      const owned = await this.reloadPackages(unique, { session });
      for (const pkg of owned) {
        if (String(pkg.customerId) !== String(customer._id)) {
          throw new APIError('Ачаа олдсонгүй', httpStatus.NOT_FOUND);
        }
      }

      const packages = await this.loadDeliverablePackages(unique, { session });

      await this.assertNotInActiveDelivery(
        packages.map(p => p._id),
        { session }
      );

      const branch = await branchResolver.resolveBranch(packages[0].branchId);
      const deliveryNumber = await this.nextDeliveryNumber({ session });
      const actorName = this.describeCustomer(customer);

      const delivery = await deliveryRepository.createWithSession(
        {
          deliveryNumber,
          customerId: customer._id,
          customerPhone: customer.phone,
          packageIds: packages.map(p => p._id),
          address: String(address).trim(),
          phone: phone ? normalizePhone(phone) : customer.phone,
          note: note ?? null,
          status: DELIVERY_STATUS.CREATED,
          driverId: null,
          driverName: null,
          driverPhone: null,
          scheduledDate: null,
          fee: DELIVERY_FEE_AMOUNT,
          feePaidAmount: 0,
          branchId: branch._id,
          createdBy: null,
          statusHistory: [
            {
              from: null,
              to: DELIVERY_STATUS.CREATED,
              at: new Date(),
              by: null,
              byName: actorName,
              reason: null,
            },
          ],
        },
        { session }
      );

      const { allocations, amount } = buildFullSettlement(
        packages.map(p => ({ packageId: p._id, balance: p.balance })),
        delivery._id,
        DELIVERY_FEE_AMOUNT
      );

      const payment = await paymentService.createPendingSettlement(
        {
          allocations,
          amount,
          // QPay merchant эрх сонгогдоогүй тул одоохондоо ЗӨВХӨН Данс (roadmap 5.6/5.7 ⛔)
          method: PAYMENT_METHOD.BANK,
          customerId: customer._id,
          customerPhone: customer.phone,
          branchId: branch._id,
          actorName,
        },
        { session }
      );

      await auditService.record(
        {
          action: AUDIT_ACTION.DELIVERY_SELF_CREATE,
          entity: AUDIT_ENTITY.DELIVERY,
          entityId: delivery._id,
          entityLabel: delivery.deliveryNumber,
          branchId: branch._id,
          actorName,
          field: 'status',
          before: null,
          after: DELIVERY_STATUS.CREATED,
          reason: `${packages.length} ачаа: ${packages.map(p => p.trackingNumber).join(', ')}`,
          req,
        },
        { session }
      );

      return { delivery, payment };
    });
  }

  // ── Үүсгэх (§5.1) ───────────────────────────────────────────────────────

  /**
   * Хүргэлт үүсгэнэ. ТӨЛБӨР ШААРДАХГҮЙ — §5.2-ын хаалт нь `dispatched`
   * шилжилтэд байрлана. Ажилтан маргаашийн маршрутыг урьдчилан бэлдэж,
   * харилцагч гарахын өмнө төлдөг нь хэвийн урсгал.
   */
  async create(data, actor, req) {
    const { packageIds, address, phone, note, scheduledDate, fee } = data;

    if (!Array.isArray(packageIds) || packageIds.length === 0) {
      throw new APIError('Ачаа сонгоно уу', httpStatus.BAD_REQUEST);
    }

    const unique = [...new Set(packageIds.map(String))];
    if (unique.length !== packageIds.length) {
      throw new APIError('Нэг ачаа хоёр удаа сонгогдсон байна', httpStatus.BAD_REQUEST);
    }

    const driver = await this.resolveDriver(data);

    return withTransaction(async session => {
      const packages = await this.loadDeliverablePackages(unique, { session });

      // Нэг хүргэлт = НЭГ харилцагч, НЭГ хаяг. Холивол `returned` болоход
      // хэний ачаа буцсаныг ялгах боломжгүй.
      const customerIds = new Set(packages.map(p => String(p.customerId)));
      if (customerIds.size > 1) {
        throw new APIError(
          'Нэг хүргэлтэд зөвхөн НЭГ харилцагчийн ачаа багтана',
          httpStatus.UNPROCESSABLE_ENTITY,
          { code: ERROR_CODE.MIXED_CUSTOMERS }
        );
      }

      // Утас/харилцагч холбогдоогүй ачаанд хүргэлт үүсгэх боломжгүй (BR-45) —
      // эхлээд ачааны мэдээллийг засаж утас холбоно уу
      if (!packages[0].customerId) {
        throw new APIError(
          'Энэ ачаанд харилцагчийн утас холбогдоогүй тул хүргэлт үүсгэх боломжгүй. Эхлээд ачааны мэдээллийг засаж утас холбоно уу',
          httpStatus.UNPROCESSABLE_ENTITY,
          { code: ERROR_CODE.PHONE_REQUIRED }
        );
      }

      await this.assertNotInActiveDelivery(
        packages.map(p => p._id),
        { session }
      );

      const branch = await branchResolver.resolveBranch(
        packages[0].branchId ?? actor?.branchId ?? null
      );

      const deliveryNumber = await this.nextDeliveryNumber({ session });

      const delivery = await deliveryRepository.createWithSession(
        {
          deliveryNumber,
          customerId: packages[0].customerId,
          customerPhone: packages[0].customerPhone,
          packageIds: packages.map(p => p._id),
          address: String(address).trim(),
          // Хүлээн авагчийн утас заагаагүй бол харилцагчийнхыг авна
          phone: phone ? normalizePhone(phone) : packages[0].customerPhone,
          note: note ?? null,
          status: DELIVERY_STATUS.CREATED,
          driverId: driver.driverId,
          driverName: driver.driverName,
          driverPhone: driver.driverPhone,
          scheduledDate: scheduledDate ?? null,
          fee: fee ?? 0,
          branchId: branch._id,
          createdBy: actor?._id ?? null,
          statusHistory: [
            {
              from: null,
              to: DELIVERY_STATUS.CREATED,
              at: new Date(),
              by: actor?._id ?? null,
              byName: auditService.describeActor(actor),
              reason: null,
            },
          ],
        },
        { session }
      );

      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.DELIVERY_CREATE,
          entity: AUDIT_ENTITY.DELIVERY,
          entityId: delivery._id,
          entityLabel: delivery.deliveryNumber,
          branchId: branch._id,
          field: 'status',
          before: null,
          after: DELIVERY_STATUS.CREATED,
          reason: `${packages.length} ачаа: ${packages.map(p => p.trackingNumber).join(', ')}`,
          req,
        },
        { session }
      );

      return delivery;
    });
  }

  // ── Засах (§5.1) ────────────────────────────────────────────────────────

  /**
   * Хаяг, утас, жолооч, огноо, тэмдэглэлийг засна.
   *
   * ЗӨВХӨН `created` төлөвт: жолооч гарсны дараа хаяг өөрчлөгдвөл маршрутын
   * хуудас дээрх хаяг ба системийнх зөрж, "хаана хүргэсэн" гэдэг нь
   * баримтжихгүй болно. Гарсны дараа өөрчлөх шаардлага гарвал буцааж
   * (`returned`) дахин гаргана.
   *
   * АЧААНЫ БАГЦЫГ ЭНД ЗАСАХГҮЙ — багц өөрчлөгдвөл өөр хүргэлт болно.
   * Ачаа нэмэх/хасах шаардлагатай бол цуцалж, шинээр үүсгэнэ.
   */
  async update(id, data, actor, req) {
    const delivery = await this.getById(id);

    if (delivery.status !== DELIVERY_STATUS.CREATED) {
      throw new APIError(
        `"${deliveryState.label(delivery.status)}" төлөвт байгаа хүргэлтийг засах боломжгүй`,
        httpStatus.UNPROCESSABLE_ENTITY
      );
    }

    const patch = {};
    if (data.address !== undefined) patch.address = String(data.address).trim();
    if (data.phone !== undefined) patch.phone = normalizePhone(data.phone);
    if (data.note !== undefined) patch.note = data.note || null;
    if (data.scheduledDate !== undefined) patch.scheduledDate = data.scheduledDate ?? null;
    if (data.fee !== undefined) patch.fee = data.fee ?? 0;

    if (data.driverId !== undefined || data.driverName !== undefined) {
      const driver = await this.resolveDriver(data);
      patch.driverId = driver.driverId;
      patch.driverName = driver.driverName;
      patch.driverPhone = driver.driverPhone;
    }

    if (Object.keys(patch).length === 0) {
      return delivery;
    }

    return withTransaction(async session => {
      const updated = await deliveryRepository.updateByIdWithSession(id, patch, { session });

      const changes = {};
      for (const field of Object.keys(patch)) {
        changes[field] = { before: delivery[field] ?? null, after: patch[field] ?? null };
      }

      await auditService.recordChanges(
        {
          actor,
          action: AUDIT_ACTION.DELIVERY_UPDATE,
          entity: AUDIT_ENTITY.DELIVERY,
          entityId: updated._id,
          entityLabel: updated.deliveryNumber,
          branchId: updated.branchId,
          req,
        },
        changes,
        { session }
      );

      return updated;
    });
  }

  // ── Төлөв (§5.1, BR-20, BR-21) ──────────────────────────────────────────

  /**
   * ТӨЛӨВ ӨӨРЧЛӨХ ГАНЦ ЗАМ.
   *
   * Хүргэлтийн төлөв ачааны төлөвийг ЧИРНЭ (`delivery-state.PACKAGE_EFFECT`):
   * гарахад бүх ачаа `out_for_delivery`, хүргэгдэхэд `delivered`, буцахад
   * `returned`. Хоёуланг НЭГ транзакцад хийж байгаа шалтгаан: хүргэлт
   * "гарсан" гэж бичигдээд ачаа агуулахад үлдвэл §5.2-ын хамгаалалт
   * утгаа алдаж, дараагийн ажилтан тэр ачааг дахин гаргана.
   */
  async changeStatus(id, nextStatus, { reason } = {}, actor, req) {
    // Цуцлах нь эрх ба шалтгаан шаарддаг тусдаа дүрэмтэй
    if (nextStatus === DELIVERY_STATUS.CANCELLED) {
      return this.cancel(id, { reason }, actor, req);
    }

    return withTransaction(async session => {
      const delivery = await deliveryRepository.findByIdWithSession(id, { session });
      if (!delivery) {
        throw new APIError('Хүргэлт олдсонгүй', httpStatus.NOT_FOUND);
      }

      /**
       * Ачааг ТРАНЗАКЦ ДОТОР дахин уншиж үлдэгдлийг бодно (BR-20).
       *
       * Гадуур уншсан үлдэгдлээр шалгавал: ажилтан дэлгэц нээснээс хойш
       * төлбөр хүчингүй болсон байж болно — тэр ачаа "төлөгдсөн" гэж
       * харагдсаар хүргэлтэнд гарна.
       */
      const packages = await this.reloadPackages(delivery.packageIds, { session });
      const unpaid = packages.filter(p => p.balance > 0);
      const unpaidTotal = unpaid.reduce((sum, p) => sum + p.balance, 0);
      // Roadmap 5.8 — зөвхөн харилцагчийн ӨӨРИЙН захиалсан хүргэлтэд (`createdBy: null`)
      // хамаарна. Ажилтны гар бичилтийн `fee` энд ХЭЗЭЭ Ч тооцогдохгүй (BR-21b).
      const unpaidFee =
        delivery.createdBy == null
          ? Math.max((delivery.fee ?? 0) - (delivery.feePaidAmount ?? 0), 0)
          : 0;

      try {
        deliveryState.assertTransition(delivery.status, nextStatus, { unpaidTotal, unpaidFee });
      } catch (err) {
        // §5.2 — төлбөрийн хаалт нь 422 (бизнес дүрэм), шилжилтийн алдаа 409
        const isPackageBlock =
          unpaidTotal > 0 && deliveryState.canTransition(delivery.status, nextStatus);
        const isFeeBlock =
          !isPackageBlock &&
          unpaidFee > 0 &&
          deliveryState.canTransition(delivery.status, nextStatus);
        const isPaymentBlock = isPackageBlock || isFeeBlock;

        throw new APIError(
          err.message,
          isPaymentBlock ? httpStatus.UNPROCESSABLE_ENTITY : httpStatus.CONFLICT,
          {
            code: isFeeBlock
              ? ERROR_CODE.UNPAID_DELIVERY_FEE
              : isPackageBlock
                ? ERROR_CODE.UNPAID_PACKAGES
                : ERROR_CODE.INVALID_DELIVERY_TRANSITION,
            details: isPackageBlock
              ? {
                  unpaidTotal,
                  packages: unpaid.map(p => ({
                    id: p._id,
                    trackingNumber: p.trackingNumber,
                    balance: p.balance,
                  })),
                }
              : isFeeBlock
                ? { unpaidFee }
                : { from: delivery.status, to: nextStatus },
          }
        );
      }

      const patch = {
        status: nextStatus,
        $push: {
          statusHistory: {
            from: delivery.status,
            to: nextStatus,
            at: new Date(),
            by: actor?._id ?? null,
            byName: auditService.describeActor(actor),
            reason: reason ?? null,
          },
        },
      };

      if (nextStatus === DELIVERY_STATUS.DISPATCHED) patch.dispatchedAt = new Date();
      if (nextStatus === DELIVERY_STATUS.DELIVERED) patch.deliveredAt = new Date();

      const updated = await deliveryRepository.updateByIdWithSession(id, patch, { session });

      await this.cascadeToPackages(packages, nextStatus, { reason, actor, req, session });

      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.DELIVERY_STATUS_CHANGE,
          entity: AUDIT_ENTITY.DELIVERY,
          entityId: updated._id,
          entityLabel: updated.deliveryNumber,
          branchId: updated.branchId,
          field: 'status',
          before: delivery.status,
          after: nextStatus,
          reason: reason ?? null,
          req,
        },
        { session }
      );

      return updated;
    });
  }

  /**
   * §1.9 — олон хүргэлтийг нэг дор гаргах (өдрийн маршрут).
   *
   * Хүргэлт тус бүрийг ТУСДАА транзакцаар хийж байгаа шалтгаан: 10 маршрутын
   * 9 нь бэлэн, 1 нь төлбөр дутуу байхад бүгдийг унагах нь жолоочийг гацуулна
   * (`packageService.changeStatusBulk`-ийн ижил зарчим).
   */
  async changeStatusBulk(ids, nextStatus, { reason } = {}, actor, req) {
    const succeeded = [];
    const failed = [];

    for (const id of ids) {
      try {
        const updated = await this.changeStatus(id, nextStatus, { reason }, actor, req);
        succeeded.push({ id: updated._id, deliveryNumber: updated.deliveryNumber });
      } catch (err) {
        failed.push({ id, message: err.message, code: err.code ?? null });
      }
    }

    return { succeeded, failed, total: ids.length };
  }

  // ── Цуцлах ──────────────────────────────────────────────────────────────

  /**
   * Буруу үүсгэсэн хүргэлтийг цуцална. УСТГАХГҮЙ (CLAUDE.md §5 дүрэм 4).
   *
   * ЗӨВХӨН `created` төлөвөөс: жолооч гарсны дараа "болоогүй" гэж бичих нь
   * бодит хөдөлгөөнийг нуух болно — тэр тохиолдолд `returned` зөв төлөв.
   *
   * Ачааны төлөв ХӨДЛӨХГҮЙ: хүргэлт үүсэхэд ачаа хөдөлдөггүй тул буцаах
   * зүйл ч байхгүй. Ачаа зүгээр л дахин багцлагдах боломжтой болно (BR-20a).
   */
  async cancel(id, { reason }, actor, req) {
    if (!this.isManagement(actor)) {
      throw new APIError(
        'Хүргэлтийг цуцлах эрх зөвхөн Менежер, Админд байна',
        httpStatus.FORBIDDEN
      );
    }

    const cancelReason = String(reason ?? '').trim();
    if (cancelReason.length < 3) {
      throw new APIError('Цуцлах шалтгааныг бичнэ үү', httpStatus.BAD_REQUEST);
    }

    const delivery = await this.getById(id);

    try {
      deliveryState.assertTransition(delivery.status, DELIVERY_STATUS.CANCELLED);
    } catch (err) {
      throw new APIError(err.message, httpStatus.CONFLICT, {
        code: ERROR_CODE.INVALID_DELIVERY_TRANSITION,
        details: { from: delivery.status, to: DELIVERY_STATUS.CANCELLED },
      });
    }

    return withTransaction(async session => {
      const updated = await deliveryRepository.updateByIdWithSession(
        id,
        {
          status: DELIVERY_STATUS.CANCELLED,
          cancelledAt: new Date(),
          cancelReason,
          $push: {
            statusHistory: {
              from: delivery.status,
              to: DELIVERY_STATUS.CANCELLED,
              at: new Date(),
              by: actor?._id ?? null,
              byName: auditService.describeActor(actor),
              reason: cancelReason,
            },
          },
        },
        { session }
      );

      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.DELIVERY_CANCEL,
          entity: AUDIT_ENTITY.DELIVERY,
          entityId: updated._id,
          entityLabel: updated.deliveryNumber,
          branchId: updated.branchId,
          field: 'status',
          before: delivery.status,
          after: DELIVERY_STATUS.CANCELLED,
          reason: cancelReason,
          req,
        },
        { session }
      );

      return updated;
    });
  }

  // ── Дотоод ──────────────────────────────────────────────────────────────

  /**
   * Хүргэлтийн төлөвийг АЧААНУУДАД дамжуулна.
   *
   * Шилжиж чадахгүй ачааг АЛГАСНА (унагахгүй): жишээ нь ажилтан нэг ачааг
   * тусад нь `delivered` болгосон бол `delivered → delivered` шилжилт
   * байхгүй. Тэр нь алдаа биш — үр дүн аль хэдийн зөв. Харин `dispatched`
   * үед алгасах ачаа БАЙХГҮЙ: төлбөрийн хаалт дээр нь ажилласан тул
   * бүгд `paid` төлөвт байна.
   */
  async cascadeToPackages(packages, deliveryStatus, { reason, actor, req, session }) {
    const nextPackageStatus = deliveryState.packageEffect(deliveryStatus);
    if (!nextPackageStatus) return [];

    const touched = [];
    for (const pkg of packages) {
      if (!packageState.canTransition(pkg.status, nextPackageStatus)) continue;

      touched.push(
        await packageService.changeStatus(
          pkg._id,
          nextPackageStatus,
          { reason: reason ?? `Хүргэлт: ${deliveryState.label(deliveryStatus)}` },
          actor,
          req,
          { session }
        )
      );
    }

    return touched;
  }

  /**
   * Хүргэлтэд орох боломжтой ачааг уншиж шалгана.
   *
   * `session` дотор уншиж байгаа шалтгаан: транзакц дотор уншсан утга л
   * тогтвортой (`invoiceService.loadPayablePackages`-ийн ижил зарчим).
   */
  async loadDeliverablePackages(packageIds, { session } = {}) {
    const packages = [];

    for (const packageId of packageIds) {
      const query = packageRepository.model.findById(packageId);
      const pkg = await (session ? query.session(session) : query);

      if (!pkg) {
        throw new APIError(`Ачаа олдсонгүй: ${packageId}`, httpStatus.NOT_FOUND);
      }
      if (!this.isDeliverableStatus(pkg.status)) {
        throw new APIError(
          `"${pkg.trackingNumber}" ачаа "${packageState.label(pkg.status)}" төлөвт байна — ` +
            'хүргэлтэнд оруулах боломжгүй',
          httpStatus.UNPROCESSABLE_ENTITY
        );
      }

      packages.push(pkg);
    }

    // Дараалал тогтвортой байх ёстой — маршрутын хуудас, тест дахин
    // үйлдэхэд ижил гарна
    packages.sort((a, b) => a.trackingNumber.localeCompare(b.trackingNumber));

    return packages;
  }

  /**
   * Хүргэлтэд ОРОХ боломжтой ачааны төлөвүүд.
   *
   * Агуулахад БАЙГАА ачаа л хүргэлтэнд орно (BR-09a `OCCUPIES_LOCATION`-ийн
   * ижил жагсаалт). `out_for_delivery` нь аль хэдийн гарсан, `picked_up`,
   * `delivered` нь харилцагчид очсон, `cancelled` нь хүчингүй.
   *
   * Төлбөрийн төлөвийг ЭНД шалгахгүй — хүргэлт үүсгэх нь төлбөр шаардахгүй
   * (§5.2-ын хаалт нь `dispatched` дээр).
   */
  isDeliverableStatus(status) {
    return packageState.OCCUPIES_LOCATION.includes(status);
  }

  async reloadPackages(packageIds, { session }) {
    const packages = [];
    for (const packageId of packageIds) {
      const pkg = await packageRepository.model.findById(packageId).session(session);
      if (!pkg) {
        throw new APIError(`Ачаа олдсонгүй: ${packageId}`, httpStatus.NOT_FOUND);
      }
      packages.push(pkg);
    }
    return packages;
  }

  /** BR-20a — ачаа нэгээс илүү идэвхтэй хүргэлтэд орохыг хориглоно */
  async assertNotInActiveDelivery(packageIds, { session } = {}) {
    const active = await deliveryRepository.findActiveContainingPackages(packageIds, { session });
    if (active.length === 0) return;

    const numbers = active.map(d => d.deliveryNumber).join(', ');
    throw new APIError(
      `Сонгосон ачааны нэг нь аль хэдийн идэвхтэй хүргэлтэд байна (${numbers})`,
      httpStatus.CONFLICT,
      { code: ERROR_CODE.PACKAGE_IN_ACTIVE_DELIVERY }
    );
  }

  /**
   * Жолоочийг тайлна. Хоёр хэлбэр:
   *   `driverId`   — системд бүртгэлтэй ажилтан. Нэрийг ХУУЛБАРЛАНА.
   *   `driverName` — гэрээт/гадны жолооч, зөвхөн нэр ба утас.
   *
   * Хоёуланг зөвшөөрч байгаа шалтгаан: жолооч бүрд системийн эрх нээх
   * шаардлагагүй бөгөөд шаардвал ажилтан хүргэлт үүсгэж чадахгүй гацна.
   */
  async resolveDriver({ driverId, driverName, driverPhone }) {
    if (driverId) {
      const user = await userRepository.findById(driverId);
      if (!user) {
        throw new APIError('Жолооч (ажилтан) олдсонгүй', httpStatus.NOT_FOUND);
      }
      return {
        driverId: user._id,
        driverName: auditService.describeActor(user),
        driverPhone: driverPhone ? String(driverPhone).trim() : (user.phone ?? null),
      };
    }

    return {
      driverId: null,
      driverName: driverName ? String(driverName).trim() : null,
      driverPhone: driverPhone ? String(driverPhone).trim() : null,
    };
  }

  /**
   * Дугаар: `DLV-{YYMM}-{дараалал}`, жишээ `DLV-2607-000123`.
   *
   * `invoiceService.nextInvoiceNumber`-ийн ижил зарчим: дараалал ТАСРАЛТГҮЙ
   * өсдөг (сар шинэчлэгдэхэд 1-ээс эхлэхгүй) тул `counters`-т нэг түлхүүр
   * хангалттай, дугаар давхардах боломж бүрэн үгүй.
   */
  async nextDeliveryNumber({ session } = {}) {
    const seq = await counterRepository.next('delivery', { session });
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `DLV-${yy}${mm}-${String(seq).padStart(6, '0')}`;
  }

  /**
   * BR-37 — Менежер зөвхөн өөрийн салбарын хүргэлтийг харна.
   * Frontend-ээс ирсэн `branchId`-д ИТГЭХГҮЙ — дарж бичнэ.
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

  /** `package.service.js`-ийн `describeCustomer`-ийн ижил зарчим (audit-д ажилтны нэрний оронд) */
  describeCustomer(customer) {
    return `Харилцагч ${maskPhone(customer.phone)}`;
  }
}

module.exports = new DeliveryService();
