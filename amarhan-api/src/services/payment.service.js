'use strict';

const httpStatus = require('http-status');
const paymentRepository = require('../repositories/payment.repository');
const invoiceRepository = require('../repositories/invoice.repository');
const packageRepository = require('../repositories/package.repository');
const branchResolver = require('./branch-resolver.service');
const customerService = require('./customer.service');
const invoiceService = require('./invoice.service');
const packageService = require('./package.service');
const auditService = require('./audit.service');
const APIError = require('../utils/APIError');
const { withTransaction } = require('../utils/transaction');
const {
  allocateProportionally,
  validateManualAllocations,
  AllocationError,
} = require('../domain/allocation');
const packageState = require('../domain/package-state');
const {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  ERROR_CODE,
  INVOICE_STATUS,
  PACKAGE_STATUS,
  PAYMENT_RECORD_STATUS,
  ROLES,
} = require('../config/constants');

/**
 * Төлбөрийн модуль — introduction.md §1.8, §2
 *
 * ЭНЭ ФАЙЛ НЬ МӨНГӨНИЙ ГАНЦ ХАЯЛГА. `packages.paidAmount`, `balance`,
 * `paymentStatus`, `invoices.paidAmount` — эдгээрийг ӨӨР ХААНА Ч бичихийг
 * хориглоно (BR-14). Хоёр газраас бичигдвэл зөрүү үүсч, аль нь зөв болохыг
 * дараа нь тодорхойлох боломжгүй.
 *
 * Дөрвөн зарчим:
 *   1. Бүх бичилт НЭГ транзакцад: төлбөр + ачааны үлдэгдэл + нэхэмжлэх + audit.
 *      Аль нэг нь бүтэлгүйтвэл БҮГД буцна (BR-41). Төлбөр хадгалагдаад ачааны
 *      үлдэгдэл шинэчлэгдэхгүй байх нөхцөл байж БОЛОХГҮЙ.
 *   2. Үлдэгдлийг ХАСАХ бус ЭХ СУРВАЛЖААС ДАХИН БОДНО (`recalculatePackage`).
 *      `balance -= amount` гэсэн хасалт нь урьд нь орсон ямар ч зөрүүг үүрд
 *      үлдээдэг; дахин бодолт нь өөрөө өөрийгөө засна.
 *   3. `Σ allocations === amount` тогтмолыг домэйн (`allocation.js`) шалгаж,
 *      model-ийн `pre('validate')` ДАХИН шалгана (BR-17).
 *   4. `paid` төлөвт зөвхөн ЭНДЭЭС, `{ system: true }`-ээр шилжинэ (BR-09).
 */
class PaymentService {
  // ── Уншилт (§2.2) ───────────────────────────────────────────────────────

  async list(options, actor) {
    const scoped = await this.applyBranchScope(options, actor);
    const result = await paymentRepository.search({}, scoped);
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

  /**
   * §2.2 — жагсаалтын дээрх нийлбэрүүд (өдрийн касс тулгах).
   * Хэлбэр тус бүрээр ялгаж байгаа шалтгаан: бэлэн мөнгийг кассны бодит
   * үлдэгдэлтэй тулгах шаардлагатай, дансны гүйлгээтэй хамт бодох нь утгагүй.
   */
  async summary(options, actor) {
    const scoped = await this.applyBranchScope(options, actor);
    return paymentRepository.summary(scoped);
  }

  async getById(id) {
    const payment = await paymentRepository.findById(id);
    if (!payment) {
      throw new APIError('Төлбөр олдсонгүй', httpStatus.NOT_FOUND);
    }
    return payment;
  }

  async listForPackage(packageId) {
    await packageService.getById(packageId);
    return paymentRepository.listForPackage(packageId);
  }

  // ── Төлбөр бүртгэх (§1.8, BR-13…BR-17) ─────────────────────────────────

  /**
   * Төлбөр бүртгэнэ. ГУРВАН оролтын хэлбэр:
   *
   *   1. `{ invoiceId, amount, method }`
   *      Нэхэмжлэхийн ачаанууд дунд ПРОПОРЦИОНАЛЬ хуваарилна (§2.3, BR-17).
   *      Хэсэгчилсэн дүн ч болно — хуваасан төлбөрийн үлдсэн хэсгийг дараа
   *      дахин дуудна (BR-13).
   *
   *   2. `{ packageIds, amount, method }`
   *      Нэхэмжлэхгүйгээр шууд. Ижил пропорциональ логик.
   *
   *   3. `{ allocations: [{ packageId, amount }], amount, method }`
   *      Ажилтан ачаа тус бүрийн дүнг ГАРААР заасан. "Энэ ачааг бүтнээр
   *      төлье, нөгөөг дараа" гэсэн бодит хэрэгцээ.
   *
   * Гурвуулаа ижил тогтмолд (BR-17) хүрнэ — ялгаа нь дүнг ХЭН хуваарилсан.
   */
  async create(data, actor, req) {
    const { amount, method, invoiceId, packageIds, allocations, note, phone } = data;

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new APIError('Төлбөрийн дүн 1₮-өөс их бүхэл тоо байх ёстой', httpStatus.BAD_REQUEST);
    }

    return withTransaction(async session => {
      const context = await this.resolveTargets(
        { invoiceId, packageIds, allocations, phone },
        { session }
      );

      const resolved = this.buildAllocations(amount, context, allocations);

      // BR-15 — зэрэг ирсэн хоёр төлбөр хамтдаа үлдэгдлээс хэтрэхээс сэргийлнэ.
      // `buildAllocations`-ийн шалгалт `context.packages`-ийн УНШСАН (боломжит
      // хуучин) `balance`-аар хийгддэг тул зэрэг хүсэлт хоёулаа мөн шалгалтыг
      // давж болно. Энэ атомик нөөцлөлт нь бодит DB утгаар ДАХИН шалгана.
      await this.reserveAllocations(resolved, { session });

      const branch = await branchResolver.resolveBranch(
        context.branchId ?? actor?.branchId ?? null
      );

      const payment = await paymentRepository.createWithSession(
        {
          amount,
          method,
          invoiceId: context.invoice?._id ?? null,
          customerId: context.customerId,
          customerPhone: context.customerPhone,
          allocations: resolved,
          status: PAYMENT_RECORD_STATUS.COMPLETED,
          branchId: branch._id,
          receivedBy: actor?._id ?? null,
          receivedByName: actor ? auditService.describeActor(actor) : null,
          note: note ?? null,
        },
        { session }
      );

      // Хуваарилалт ногдсон ачаа БҮРИЙГ эх сурвалжаас дахин бодно
      const touched = [];
      for (const allocation of resolved) {
        touched.push(await this.recalculatePackage(allocation.packageId, { actor, req, session }));
      }

      if (context.invoice) {
        await this.recalculateInvoice(context.invoice._id, { session });
      }

      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.PAYMENT_CREATE,
          entity: AUDIT_ENTITY.PAYMENT,
          entityId: payment._id,
          entityLabel: context.invoice?.invoiceNumber ?? context.customerPhone,
          branchId: branch._id,
          field: 'amount',
          before: null,
          after: amount,
          reason: `${method} · ${resolved.length} ачаа`,
          req,
        },
        { session }
      );

      return { payment, packages: touched };
    });
  }

  // ── Хүчингүй болгох (BR-18) ─────────────────────────────────────────────

  /**
   * Буруу бүртгэсэн төлбөрийг хүчингүй болгоно. УСТГАХГҮЙ.
   *
   * Ачааны үлдэгдэл эх сурвалжаас дахин бодогдоно — тиймээс хүчингүй болсон
   * төлбөрийн дүн автоматаар хасагдана. Ачаа `paid` төлөвт байсан бол
   * `awaiting_payment` руу залруулагдана: эс тэгвээс төлөгдөөгүй ачаа
   * "төлөгдсөн" гэж харагдсаар байх ба §5.2-ын хамгаалалт утгаа алдана.
   */
  async void(id, { reason }, actor, req) {
    const payment = await this.getById(id);

    if (payment.status === PAYMENT_RECORD_STATUS.VOIDED) {
      throw new APIError('Төлбөр аль хэдийн хүчингүй болсон', httpStatus.UNPROCESSABLE_ENTITY, {
        code: ERROR_CODE.PAYMENT_ALREADY_VOIDED,
      });
    }

    const voidReason = String(reason ?? '').trim();
    if (voidReason.length < 3) {
      throw new APIError('Хүчингүй болгох шалтгааныг бичнэ үү', httpStatus.BAD_REQUEST);
    }

    return withTransaction(async session => {
      const updated = await paymentRepository.updateByIdWithSession(
        id,
        {
          status: PAYMENT_RECORD_STATUS.VOIDED,
          voidedAt: new Date(),
          voidedBy: actor?._id ?? null,
          voidReason,
        },
        { session }
      );

      const touched = [];
      for (const allocation of payment.allocations) {
        touched.push(await this.recalculatePackage(allocation.packageId, { actor, req, session }));
      }

      if (payment.invoiceId) {
        await this.recalculateInvoice(payment.invoiceId, { session });
      }

      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.PAYMENT_VOID,
          entity: AUDIT_ENTITY.PAYMENT,
          entityId: updated._id,
          entityLabel: payment.customerPhone,
          branchId: payment.branchId,
          field: 'status',
          before: payment.status,
          after: PAYMENT_RECORD_STATUS.VOIDED,
          reason: voidReason,
          req,
        },
        { session }
      );

      return { payment: updated, packages: touched };
    });
  }

  // ── Дотоод: тооцоолол ───────────────────────────────────────────────────

  /**
   * BR-14 — ачааны `paidAmount`/`balance`/`paymentStatus`-ыг ЭХ СУРВАЛЖААС
   * дахин бодож бичнэ, шаардлагатай бол төлөвийг залруулна.
   *
   * ЯАГААД ХАСАЛТ БИШ ДАХИН БОДОЛТ: `paidAmount += amount` нь хямд боловч
   * ямар нэг шалтгаанаар (гар аргаар засах, буцаагдсан транзакц, migration)
   * үүссэн зөрүүг үүрд үлдээнэ. Дахин бодолт нь ижил үнээр өөрийгөө засна.
   */
  async recalculatePackage(packageId, { actor, req, session }) {
    const pkg = await packageRepository.model.findById(packageId).session(session);
    if (!pkg) {
      throw new APIError(`Ачаа олдсонгүй: ${packageId}`, httpStatus.NOT_FOUND);
    }

    const paidAmount = await paymentRepository.sumCompletedForPackage(pkg._id, { session });
    const balance = pkg.finalPrice - paidAmount;
    const paymentStatus = packageState.resolvePaymentStatus(pkg.finalPrice, paidAmount);

    const updated = await packageRepository.updateByIdWithSession(
      packageId,
      { paidAmount, balance, paymentStatus },
      { session }
    );

    return this.syncPaidStatus(updated, { actor, req, session });
  }

  /**
   * BR-09 — төлбөрөөс ГАРАЛТАЙ төлөвийн шилжилт. Хоёр тал:
   *
   *   balance ≤ 0 → `paid`             (бүрэн төлөгдсөн)
   *   balance > 0 → `awaiting_payment` (төлбөр хүчингүй болсон, залруулга)
   *
   * `changeStatus`-ыг ижил session-оор дуудаж байгаа шалтгаан: төлөвийн
   * шилжилт `statusHistory` ба audit-д бичигдэх ёстой (BR-08) — тэр логикийг
   * хуулбарлавал хоёр газар зөрнө. Гадаад транзакц дамжуулах боломжийг
   * `packageService.changeStatus(..., { session })` зориуд гаргасан.
   */
  async syncPaidStatus(pkg, { actor, req, session }) {
    const fullyPaid = pkg.balance <= 0;

    if (fullyPaid && pkg.status !== PACKAGE_STATUS.PAID) {
      // Хүргэгдсэн/авагдсан/хүчингүй ачааг буцааж `paid` болгохгүй — тэдгээр
      // нь төлбөрөөс хойшхи төлөв, буцах нь түүхийг гажуудуулна.
      if (!packageState.canTransition(pkg.status, PACKAGE_STATUS.PAID)) {
        return pkg;
      }
      return packageService.changeStatus(
        pkg._id,
        PACKAGE_STATUS.PAID,
        { reason: 'Төлбөр бүрэн бүртгэгдсэн' },
        actor,
        req,
        { session, system: true }
      );
    }

    if (!fullyPaid && pkg.status === PACKAGE_STATUS.PAID) {
      return packageService.changeStatus(
        pkg._id,
        PACKAGE_STATUS.AWAITING_PAYMENT,
        { reason: 'Төлбөр хүчингүй болсон' },
        actor,
        req,
        { session, system: true }
      );
    }

    return pkg;
  }

  /**
   * Нэхэмжлэхийн `paidAmount`/`status`-ыг эх сурвалжаас дахин бодно.
   *
   * Хүчингүй болсон нэхэмжлэхийг `paid` болгохгүй — цуцлагдсан баримт дээр
   * төлбөр орсон бол тэр нь залруулах шаардлагатай онцгой тохиолдол, чимээгүй
   * "төлөгдсөн" гэж тэмдэглэх нь түүнийг нуух болно.
   */
  async recalculateInvoice(invoiceId, { session }) {
    const invoice = await invoiceRepository.findByIdWithSession(invoiceId, { session });
    if (!invoice) return null;

    const paidAmount = await paymentRepository.sumCompletedForInvoice(invoice._id, { session });

    const patch = { paidAmount };
    if (invoice.status !== INVOICE_STATUS.CANCELLED) {
      patch.status = paidAmount >= invoice.totalAmount ? INVOICE_STATUS.PAID : INVOICE_STATUS.OPEN;
    }

    return invoiceRepository.updateByIdWithSession(invoiceId, patch, { session });
  }

  // ── Дотоод: оролт тайлах ────────────────────────────────────────────────

  /**
   * Оролтын гурван хэлбэрийг НЭГ дүрсэлбэрт хөрвүүлнэ.
   *
   * Бүх ачааг транзакц дотор ДАХИН уншиж байгаа шалтгаан: ажилтан жагсаалт
   * үзэж байх зуур өөр ажилтан төлбөр авсан байж болно. Гадуур уншсан
   * үлдэгдлээр хуваарилбал илүү төлөлт үүснэ.
   */
  async resolveTargets({ invoiceId, packageIds, allocations, phone }, { session }) {
    if (invoiceId) {
      const invoice = await invoiceRepository.findByIdWithSession(invoiceId, { session });
      if (!invoice) {
        throw new APIError('Нэхэмжлэх олдсонгүй', httpStatus.NOT_FOUND);
      }
      if (invoice.status === INVOICE_STATUS.CANCELLED) {
        throw new APIError(
          'Хүчингүй нэхэмжлэхэд төлбөр бүртгэх боломжгүй',
          httpStatus.UNPROCESSABLE_ENTITY
        );
      }

      const packages = await invoiceService.loadPayablePackages(
        invoice.items.map(item => item.packageId),
        { session }
      );

      return {
        invoice,
        packages,
        customerId: invoice.customerId,
        customerPhone: invoice.customerPhone,
        branchId: invoice.branchId,
      };
    }

    const ids = allocations?.length ? allocations.map(a => a.packageId) : (packageIds ?? []);

    if (ids.length === 0) {
      throw new APIError(
        'Нэхэмжлэх, ачаа эсвэл хуваарилалтын ядаж нэгийг заана уу',
        httpStatus.BAD_REQUEST
      );
    }

    const packages = await invoiceService.loadPayablePackages([...new Set(ids.map(String))], {
      session,
    });

    // BR-16 — өөр өөр харилцагчийн ачааг нэг төлбөрт холихыг хориглоно
    const customerIds = new Set(packages.map(p => String(p.customerId)));
    if (customerIds.size > 1) {
      throw new APIError(
        'Нэг төлбөрт зөвхөн НЭГ харилцагчийн ачаа багтана',
        httpStatus.UNPROCESSABLE_ENTITY,
        { code: ERROR_CODE.MIXED_CUSTOMERS }
      );
    }

    // Утас заасан бол ачаа түүнд ХАРЬЯАЛАГДАХ эсэхийг шалгана: ажилтан буруу
    // ачааг сонгосон үед мөнгө өөр хүний ачаанд ногдохоос сэргийлнэ.
    if (phone) {
      const customer = await customerService.getByPhone(phone);
      if (String(customer._id) !== String(packages[0].customerId)) {
        throw new APIError(
          'Сонгосон ачаа заасан утасны харилцагчид харьяалагдахгүй',
          httpStatus.UNPROCESSABLE_ENTITY
        );
      }
    }

    return {
      invoice: null,
      packages,
      customerId: packages[0].customerId,
      customerPhone: packages[0].customerPhone,
      branchId: packages[0].branchId,
    };
  }

  /**
   * Хуваарилалтыг бодож тогтмолыг шалгана (BR-17).
   * Домэйний алдааг HTTP кодтой болгож хөрвүүлнэ.
   */
  buildAllocations(amount, context, manual) {
    try {
      if (manual?.length) {
        const balanceByPackageId = new Map(context.packages.map(p => [String(p._id), p.balance]));
        return validateManualAllocations(amount, manual, balanceByPackageId);
      }

      return allocateProportionally(
        amount,
        context.packages.map(p => ({ packageId: p._id, balance: p.balance }))
      );
    } catch (error) {
      if (error instanceof AllocationError) {
        // Илүү төлөлт нь frontend-д тусад нь боловсруулагддаг (BR-15)
        const code = /их байна/.test(error.message)
          ? ERROR_CODE.OVERPAYMENT
          : ERROR_CODE.ALLOCATION_MISMATCH;
        throw new APIError(error.message, httpStatus.UNPROCESSABLE_ENTITY, { code });
      }
      throw error;
    }
  }

  /**
   * BR-15 — зэрэг хоёр төлбөр хамтдаа үлдэгдлээс хэтрэхийг ХОРИГЛОНО.
   *
   * `withTransaction` дараалсан бичилт болсон тул (§9 шийдвэр #2) зэрэг ирсэн
   * хоёр хүсэлт ижил `balance`-ыг УНШИЖ, хоёулаа зөв гэж дүгнэх боломжтой.
   * Үүнээс сэргийлэхэд MongoDB-ийн **нэг баримт бичгийн атомик** `findOneAndUpdate`
   * ашиглана — энэ нь replica set/транзакц шаардахгүй, standalone дээр ч
   * найдвартай (баримт бичиг тус бүрийн бичилт үргэлж атомик). Аль нэг ачаан
   * дээр нөөцлөлт бүтэлгүйтвэл өмнөх нөөцлөлтүүдийг буцааж, БҮГДИЙГ хориглоно
   * (`create()` all-or-nothing зарчим хадгалагдана).
   *
   * `balance`-д хийсэн энэ өөрчлөлт ТҮР зуурын — `recalculatePackage` дараа нь
   * эх сурвалжаас (payments.allocations) дахин бодож бичихэд дарагдана (BR-14).
   */
  async reserveAllocations(resolved, { session }) {
    const reserved = [];
    for (const { packageId, amount } of resolved) {
      const pkg = await packageRepository.reserveBalance(packageId, amount, { session });
      if (!pkg) {
        for (const done of reserved) {
          await packageRepository.releaseBalance(done.packageId, done.amount, { session });
        }
        throw new APIError(
          'Үлдэгдлээс илүү дүн бүртгэх боломжгүй — өөр төлбөр зэрэг бүртгэгдсэн байж магадгүй',
          httpStatus.UNPROCESSABLE_ENTITY,
          { code: ERROR_CODE.OVERPAYMENT }
        );
      }
      reserved.push({ packageId, amount });
    }
  }

  async applyBranchScope(options, actor) {
    if (!actor || actor.role === ROLES.ADMIN) return options;
    if (actor.branchId) return { ...options, branchId: actor.branchId };

    const branch = await branchResolver.resolveBranch();
    return { ...options, branchId: branch._id };
  }
}

module.exports = new PaymentService();
