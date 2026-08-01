'use strict';

const httpStatus = require('http-status');
const invoiceRepository = require('../repositories/invoice.repository');
const packageRepository = require('../repositories/package.repository');
const counterRepository = require('../repositories/counter.repository');
const branchResolver = require('./branch-resolver.service');
const customerService = require('./customer.service');
const auditService = require('./audit.service');
const APIError = require('../utils/APIError');
const { withTransaction } = require('../utils/transaction');
const {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  ERROR_CODE,
  INVOICE_STATUS,
  PACKAGE_STATUS,
  ROLES,
} = require('../config/constants');

/**
 * Нэгтгэсэн нэхэмжлэх — introduction.md §2.3, BR-16
 *
 * ХЭРЭГЦЭЭ: хэрэглэгч нэг удаад 20–40 ачаа авдаг (§1.9). Ачаа болгонд тусад нь
 * төлбөр авах нь цаг үрсэн, алдаатай тооцоо гаргах эрсдэлтэй.
 *
 * ЮУ БИШ: нэхэмжлэх нь ТООЦООНЫ эх сурвалж БИШ. Ачааны `balance` нь үргэлж
 * `payments.allocations`-аас гарна (BR-14). Нэхэмжлэх нь зөвхөн бүлэглэл —
 * тиймээс нэхэмжлэх хүчингүй болоход төлөгдсөн төлбөр алга болохгүй.
 */
class InvoiceService {
  // ── Уншилт ──────────────────────────────────────────────────────────────

  async list(options, actor) {
    const scoped = await this.applyBranchScope(options, actor);
    const result = await invoiceRepository.search({}, scoped);
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
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) {
      throw new APIError('Нэхэмжлэх олдсонгүй', httpStatus.NOT_FOUND);
    }
    return invoice;
  }

  /**
   * §2.3 алхам 5 — баримт хэвлэхэд шаардлагатай бүх зүйлийг нэг уншилтаар.
   *
   * `payments`-ыг ХАМТ буцаана: ажилтан "хэдэн төгрөг ямар хэлбэрээр орсон"
   * гэдгийг харахгүйгээр хуваасан төлбөрийг үргэлжлүүлж чадахгүй.
   */
  async getDetail(id) {
    const invoice = await invoiceRepository.findByIdWithRefs(id);
    if (!invoice) {
      throw new APIError('Нэхэмжлэх олдсонгүй', httpStatus.NOT_FOUND);
    }

    // Дугуй хамаарлаас (circular dependency) сэргийлж энд дуудна —
    // `payment.service` нь `invoice.service`-ийг модулийн дээд хэсэгт шаарддаг.
    const paymentRepository = require('../repositories/payment.repository');
    const payments = await paymentRepository.listForInvoice(invoice._id);
    const auditLogs = await auditService.listForEntity(AUDIT_ENTITY.INVOICE, invoice._id);

    return {
      invoice,
      payments,
      auditLogs,
      balance: invoice.totalAmount - invoice.paidAmount,
    };
  }

  // ── Үүсгэх (§2.3, BR-16) ────────────────────────────────────────────────

  /**
   * Сонгосон ачаануудаас нэг нэхэмжлэх үүсгэнэ.
   *
   * Дараалал ЧУХАЛ: шалгалт бүрийг транзакц дотор, ачааг ДАХИН уншиж хийнэ —
   * ажилтан жагсаалт үзэж байх зуур өөр ажилтан төлбөр авсан байж болно.
   */
  async create({ packageIds, branchId }, actor, req) {
    if (!Array.isArray(packageIds) || packageIds.length === 0) {
      throw new APIError('Ачаа сонгоно уу', httpStatus.BAD_REQUEST);
    }

    const unique = [...new Set(packageIds.map(String))];
    if (unique.length !== packageIds.length) {
      throw new APIError('Нэг ачаа хоёр удаа сонгогдсон байна', httpStatus.BAD_REQUEST);
    }

    const branch = await branchResolver.resolveBranch(branchId ?? actor?.branchId ?? null);

    return withTransaction(async session => {
      const packages = await this.loadPayablePackages(unique, { session });

      // BR-16 — нэг нэхэмжлэхэд ЗӨВХӨН нэг харилцагчийн ачаа.
      // Холихыг зөвшөөрвөл пропорциональ хуваарилалт нэг хүний мөнгийг
      // өөр хүний ачаанд ногдуулна.
      const customerIds = new Set(packages.map(p => String(p.customerId)));
      if (customerIds.size > 1) {
        throw new APIError(
          'Нэг нэхэмжлэхэд зөвхөн НЭГ харилцагчийн ачаа багтана',
          httpStatus.UNPROCESSABLE_ENTITY,
          { code: ERROR_CODE.MIXED_CUSTOMERS }
        );
      }

      // Утас/харилцагч холбогдоогүй ачаанд нэхэмжлэх үүсгэх боломжгүй (BR-45) —
      // эхлээд ачааны мэдээллийг засаж утас холбоно уу
      if (!packages[0].customerId) {
        throw new APIError(
          'Энэ ачаанд харилцагчийн утас холбогдоогүй тул нэхэмжлэх үүсгэх боломжгүй. Эхлээд ачааны мэдээллийг засаж утас холбоно уу',
          httpStatus.UNPROCESSABLE_ENTITY,
          { code: ERROR_CODE.PHONE_REQUIRED }
        );
      }

      // BR-16a — ачаа нэгээс илүү НЭЭЛТТЭЙ нэхэмжлэхэд орохыг хориглоно
      const openInvoices = await invoiceRepository.findOpenContainingPackages(
        packages.map(p => p._id),
        { session }
      );
      if (openInvoices.length > 0) {
        const numbers = openInvoices.map(i => i.invoiceNumber).join(', ');
        throw new APIError(
          `Сонгосон ачааны нэг нь аль хэдийн нээлттэй нэхэмжлэхэд байна (${numbers})`,
          httpStatus.CONFLICT
        );
      }

      /**
       * Нэхэмжлэхийн дүн нь ҮЛДЭГДЛИЙН нийлбэр, `finalPrice`-ийн БИШ.
       *
       * Шалтгаан: ачааны хэсэг нь өмнө нь төлөгдсөн байж болно. `finalPrice`-ээр
       * нэхэмжлэвэл хэрэглэгчээс аль хэдийн төлсөн мөнгийг ДАХИН нэхэмжилнэ.
       */
      const items = packages.map(p => ({
        packageId: p._id,
        trackingNumber: p.trackingNumber,
        amount: p.balance,
      }));

      const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

      if (totalAmount <= 0) {
        throw new APIError(
          'Сонгосон ачаанууд бүрэн төлөгдсөн байна',
          httpStatus.UNPROCESSABLE_ENTITY
        );
      }

      const invoiceNumber = await this.nextInvoiceNumber({ session });

      const invoice = await invoiceRepository.createWithSession(
        {
          invoiceNumber,
          customerId: packages[0].customerId,
          customerPhone: packages[0].customerPhone,
          items,
          totalAmount,
          paidAmount: 0,
          status: INVOICE_STATUS.OPEN,
          branchId: branch._id,
          createdBy: actor?._id ?? null,
        },
        { session }
      );

      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.INVOICE_CREATE,
          entity: AUDIT_ENTITY.INVOICE,
          entityId: invoice._id,
          entityLabel: invoice.invoiceNumber,
          branchId: branch._id,
          field: 'totalAmount',
          before: null,
          after: totalAmount,
          reason: `${items.length} ачаа: ${items.map(i => i.trackingNumber).join(', ')}`,
          req,
        },
        { session }
      );

      return invoice;
    });
  }

  // ── Хүчингүй болгох ─────────────────────────────────────────────────────

  /**
   * Нэхэмжлэхийг хүчингүй болгоно (ачаа буруу сонгосон г.м.).
   *
   * ТӨЛБӨР ОРСОН нэхэмжлэхийг хүчингүй болгохыг ХОРИГЛОНО: төлбөр нь ачаанд
   * хуваарилагдсан байна, нэхэмжлэхийг цуцлах нь тэр мөнгийг буцаахгүй.
   * Тэр тохиолдолд эхлээд төлбөрийг `voided` болгоно (BR-18).
   */
  async cancel(id, { reason }, actor, req) {
    const invoice = await this.getById(id);

    if (invoice.status === INVOICE_STATUS.CANCELLED) {
      throw new APIError('Нэхэмжлэх аль хэдийн хүчингүй болсон', httpStatus.UNPROCESSABLE_ENTITY);
    }
    if (invoice.paidAmount > 0) {
      throw new APIError(
        'Төлбөр орсон нэхэмжлэхийг хүчингүй болгох боломжгүй — эхлээд төлбөрийг хүчингүй болгоно уу',
        httpStatus.UNPROCESSABLE_ENTITY
      );
    }

    const cancelReason = String(reason ?? '').trim();
    if (cancelReason.length < 3) {
      throw new APIError('Хүчингүй болгох шалтгааныг бичнэ үү', httpStatus.BAD_REQUEST);
    }

    return withTransaction(async session => {
      const updated = await invoiceRepository.updateByIdWithSession(
        id,
        {
          status: INVOICE_STATUS.CANCELLED,
          cancelledAt: new Date(),
          cancelReason,
        },
        { session }
      );

      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.INVOICE_CANCEL,
          entity: AUDIT_ENTITY.INVOICE,
          entityId: updated._id,
          entityLabel: updated.invoiceNumber,
          branchId: updated.branchId,
          field: 'status',
          before: invoice.status,
          after: INVOICE_STATUS.CANCELLED,
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
   * Төлбөр авах боломжтой ачааг уншиж шалгана.
   *
   * `session` дотор уншиж байгаа шалтгаан: транзакц дотор уншсан утга л
   * тогтвортой. Гадуур уншсан `balance` нь бичих хооронд өөрчлөгдөж болно.
   */
  async loadPayablePackages(packageIds, { session } = {}) {
    const packages = [];

    for (const packageId of packageIds) {
      const query = packageRepository.model.findById(packageId);
      const pkg = await (session ? query.session(session) : query);

      if (!pkg) {
        throw new APIError(`Ачаа олдсонгүй: ${packageId}`, httpStatus.NOT_FOUND);
      }
      // Хүчингүй ачаанд төлбөр авах нь бүртгэгдээгүй мөнгө үүсгэнэ
      if (pkg.status === PACKAGE_STATUS.CANCELLED) {
        throw new APIError(
          `"${pkg.trackingNumber}" ачаа хүчингүй болсон — төлбөр авах боломжгүй`,
          httpStatus.UNPROCESSABLE_ENTITY
        );
      }

      packages.push(pkg);
    }

    // Сонгосон дарааллыг БИШ, ачааны дугаарын дарааллыг барина: BR-17-ийн
    // дугуйруулалтын үлдэгдэл "сүүлийн ачаанд" нэмэгддэг тул дараалал
    // тодорхой, дахин үйлдэхэд ижил байх ёстой (тестлэх боломжтой).
    packages.sort((a, b) => a.trackingNumber.localeCompare(b.trackingNumber));

    return packages;
  }

  /**
   * Дугаар: `INV-{YYMM}-{дараалал}`, жишээ `INV-2607-000123`.
   *
   * Он/сар оруулж байгаа шалтгаан: санхүүгийн баримтыг хугацаагаар эрэмбэлэх,
   * шүүхэд хүний уншихад ойлгомжтой байх. Дараалал нь ТАСРАЛТГҮЙ өсдөг
   * (сар шинэчлэгдэхэд 1-ээс эхлэхгүй) — ингэснээр `counters`-т нэг л түлхүүр
   * хэрэгтэй, мөн дугаар давхардах боломж бүрэн үгүй.
   */
  async nextInvoiceNumber({ session } = {}) {
    const seq = await counterRepository.next('invoice', { session });
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `INV-${yy}${mm}-${String(seq).padStart(6, '0')}`;
  }

  /**
   * BR-37 — Менежер зөвхөн өөрийн салбарын нэхэмжлэхийг харна.
   */
  async applyBranchScope(options, actor) {
    if (!actor || actor.role === ROLES.ADMIN) return options;
    if (actor.branchId) return { ...options, branchId: actor.branchId };

    const branch = await branchResolver.resolveBranch();
    return { ...options, branchId: branch._id };
  }

  /**
   * §2.3 — ажилтан харилцагчийн утсаар "төлбөр хүлээгдэж буй" ачааг харна.
   * Нэхэмжлэх үүсгэхийн ӨМНӨХ дэлгэц.
   */
  async payableByPhone(phone) {
    const customer = await customerService.getByPhone(phone);
    const packages = await packageRepository.listByCustomer(customer._id);

    const payable = packages.filter(p => p.status !== PACKAGE_STATUS.CANCELLED && p.balance > 0);

    return {
      customer,
      packages: payable,
      totalBalance: payable.reduce((sum, p) => sum + p.balance, 0),
    };
  }
}

module.exports = new InvoiceService();
