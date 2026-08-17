'use strict';

const httpStatus = require('http-status');
const config = require('../config');
const paymentRepository = require('../repositories/payment.repository');
const invoiceRepository = require('../repositories/invoice.repository');
const packageRepository = require('../repositories/package.repository');
const deliveryRepository = require('../repositories/delivery.repository');
const branchResolver = require('./branch-resolver.service');
const customerService = require('./customer.service');
const invoiceService = require('./invoice.service');
const packageService = require('./package.service');
const auditService = require('./audit.service');
const qpayService = require('./qpay.service');
const APIError = require('../utils/APIError');
const logger = require('../utils/logger');
const { withTransaction } = require('../utils/transaction');
const {
  allocateProportionally,
  validateManualAllocations,
  buildBalanceSettlement,
  AllocationError,
} = require('../domain/allocation');
const packageState = require('../domain/package-state');
const { maskPhone } = require('../domain/phone');
const {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  ERROR_CODE,
  INVOICE_STATUS,
  PACKAGE_STATUS,
  PAYMENT_METHOD,
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
        if (allocation.packageId) {
          touched.push(
            await this.recalculatePackage(allocation.packageId, { actor, req, session })
          );
        } else if (allocation.deliveryId) {
          await this.recalculateDelivery(allocation.deliveryId, { session });
        }
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

  // ── Roadmap 5.8 — харилцагчийн хүргэлтийн захиалга ─────────────────────

  /**
   * Харилцагчийн банкны шилжүүлгээр "төлье" гэсэн МЭДЭГДЛИЙГ `pending`
   * төлбөр болгож бүртгэнэ. Бодит мөнгө ирснийг систем автоматаар шалгаж
   * чадахгүй (QPay интеграцгүй, roadmap 5.6/5.7 ⛔) тул `completed` БИШ —
   * ажилтан `confirmPending()`-ээр баталгаажуулна.
   *
   * Session-г ГАДНААС авдаг цорын ганц метод: `delivery.service.js`-ийн
   * `selfCreate()` хүргэлт үүсгэлттэй НЭГ транзакцад дуудна (мөнгө ЗӨВХӨН
   * энд бичигдэнэ гэдэг дүрэм (CLAUDE.md §5 дүрэм 10) хэвээр — зөвхөн
   * дуудагч транзакцаа удирдана).
   */
  async createPendingSettlement(
    {
      allocations,
      amount,
      method,
      customerId,
      customerPhone,
      branchId,
      actorName,
      provider = null,
      providerInvoiceId = null,
      // Audit-ийн шалтгаанд бичигдэх ТЭМДЭГ (жинхэнэ `action` талбар БИШ,
      // үргэлж `PAYMENT_CREATE`) — дуудагч тал (`delivery.service.js`,
      // `selfPay`) ямар урсгалаас дуудсанаа заана. Өмнө нь `DELIVERY_SELF_CREATE`
      // хатуу бичигдсэн байсан тул бусад дуудагчийн шалтгаан буруу харагдаж
      // байсныг засав.
      trigger = AUDIT_ACTION.DELIVERY_SELF_CREATE,
      req = null,
    },
    { session }
  ) {
    const payment = await paymentRepository.createWithSession(
      {
        amount,
        method,
        invoiceId: null,
        customerId,
        customerPhone,
        allocations,
        status: PAYMENT_RECORD_STATUS.PENDING,
        branchId,
        // `null` = харилцагч өөрөө (онлайн/захиалгын урсгал) — одоо байгаа конвенц
        receivedBy: null,
        receivedByName: null,
        note: null,
        // Roadmap 5.6/5.7 — QPay. `providerInvoiceId` эхлээд `null`-ээр
        // үүсэж, QPay-ийн нэхэмжлэх амжилттай үүссэний ДАРАА л залгагдана
        // (`delivery.service.js`-ийн `selfCreate`) — QPay дуудлага
        // амжилтгүй болоход орфан бичлэг биш, нийцүүлэх боломжтой `pending`
        // мөр үлддэг байхын тулд.
        provider,
        providerInvoiceId,
      },
      { session }
    );

    await auditService.record(
      {
        action: AUDIT_ACTION.PAYMENT_CREATE,
        entity: AUDIT_ENTITY.PAYMENT,
        entityId: payment._id,
        entityLabel: customerPhone,
        branchId,
        actorName,
        field: 'amount',
        before: null,
        after: amount,
        reason: `${method} · хүлээгдэж буй (${trigger})`,
        req,
      },
      { session }
    );

    return payment;
  }

  // ── Харилцагч өөрөө ачааныхаа үлдэгдлийг төлөх ──────────────────────────

  /**
   * Харилцагч ӨӨРӨӨ сонгосон ачааны(нхаа) ҮЛДЭГДЛИЙГ БҮРЭН, хүргэлт
   * захиалахгүйгээр төлнө (пакет дэлгэрэнгүй хуудаснаас нэгээр нь, эсвэл
   * жагсаалт/хяналтын самбараас олноор). `deliveryService.selfCreate`-ийн
   * ижил хэв маяг:
   *   1. ЭЗЭМШЛИЙГ шалгана — бусдын ачаа ЗААВАЛ `404` (дүрэм 14).
   *   2. Урьдчилсан (`PRE_ARRIVAL`) болон хүчингүй ачаанд төлбөр авахгүй —
   *      нэг нь үнэ хараахан тодорхойгүй, нөгөө нь идэвхгүй бичлэг.
   *   3. Данс сонговол ажилтан баталгаажуулмагц (`confirmPending`), QPay
   *      сонговол webhook ирмэгц (`confirmByProvider`) үлдэгдэл барагдана.
   */
  async selfPay(customer, data, req) {
    const { packageIds, method } = data;
    const paymentMethod = method === PAYMENT_METHOD.QPAY ? PAYMENT_METHOD.QPAY : PAYMENT_METHOD.BANK;

    if (!Array.isArray(packageIds) || packageIds.length === 0) {
      throw new APIError('Ачаа сонгоно уу', httpStatus.BAD_REQUEST);
    }

    const unique = [...new Set(packageIds.map(String))];
    if (unique.length !== packageIds.length) {
      throw new APIError('Нэг ачаа хоёр удаа сонгогдсон байна', httpStatus.BAD_REQUEST);
    }

    return withTransaction(async session => {
      const packages = await packageRepository.model
        .find({ _id: { $in: unique } })
        .session(session);

      if (packages.length !== unique.length) {
        throw new APIError('Ачаа олдсонгүй', httpStatus.NOT_FOUND);
      }

      for (const pkg of packages) {
        if (String(pkg.customerId) !== String(customer._id)) {
          throw new APIError('Ачаа олдсонгүй', httpStatus.NOT_FOUND);
        }
        if (packageState.isPreArrival(pkg.status) || pkg.status === PACKAGE_STATUS.CANCELLED) {
          throw new APIError(
            'Энэ ачаанд одоогоор төлбөр төлөх боломжгүй',
            httpStatus.UNPROCESSABLE_ENTITY
          );
        }
      }

      const branch = await branchResolver.resolveBranch(packages[0].branchId);
      const actorName = this.describeCustomer(customer);

      let allocations;
      let amount;
      try {
        ({ allocations, amount } = buildBalanceSettlement(
          packages.map(p => ({ packageId: p._id, balance: p.balance }))
        ));
      } catch (error) {
        if (error instanceof AllocationError) {
          throw new APIError(error.message, httpStatus.UNPROCESSABLE_ENTITY);
        }
        throw error;
      }

      let payment = await this.createPendingSettlement(
        {
          allocations,
          amount,
          method: paymentMethod,
          customerId: customer._id,
          customerPhone: customer.phone,
          branchId: branch._id,
          actorName,
          // `providerInvoiceId` эхлээд `null` — QPay нэхэмжлэх амжилттай
          // үүссэний ДАРАА л доор залгагдана (орфан бичлэгээс сэргийлнэ).
          provider: paymentMethod === PAYMENT_METHOD.QPAY ? 'qpay' : null,
          trigger: AUDIT_ACTION.PAYMENT_SELF_PAY,
          req,
        },
        { session }
      );

      let qpay = null;
      if (paymentMethod === PAYMENT_METHOD.QPAY) {
        const invoice = await qpayService.createInvoice({
          invoiceNo: String(payment._id),
          amount,
          description: `Ивээл Карго төлбөр (${packages.length} ачаа)`,
          callbackURL: `${config.qpay.callbackURL}?paymentId=${payment._id}`,
        });

        payment = await paymentRepository.updateByIdWithSession(
          payment._id,
          { providerInvoiceId: invoice.invoiceId },
          { session }
        );

        qpay = { qrImage: invoice.qrImage, qrText: invoice.qrText, urls: invoice.urls };
      }

      return { payment, qpay, packages };
    });
  }

  /** `delivery.service.js`/`package.service.js`-ийн `describeCustomer`-ийн ижил зарчим */
  describeCustomer(customer) {
    return `Харилцагч ${maskPhone(customer.phone)}`;
  }

  /**
   * Ажилтан харилцагчийн банкны шилжүүлгийг бодитоор хүлээж авсны дараа
   * `pending` төлбөрийг `completed` болгоно. Дараа нь холбогдох ачаа/хүргэлт
   * БҮГД эх сурвалжаас дахин бодогдоно — `create()`-тэй ижил зарчим (BR-14).
   *
   * Татгалзах (буруу/хэзээ ч ирээгүй мэдэгдэл) нь ЭНД биш — одоо байгаа
   * `void()` endpoint аль хэдийн ямар ч урьдын төлөвөөс ажилладаг тул дахин
   * ашиглагдана.
   */
  async confirmPending(id, actor, req) {
    const payment = await this.getById(id);

    if (payment.status !== PAYMENT_RECORD_STATUS.PENDING) {
      throw new APIError(
        'Зөвхөн хүлээгдэж буй төлбөрийг баталгаажуулна',
        httpStatus.UNPROCESSABLE_ENTITY,
        { code: ERROR_CODE.PAYMENT_NOT_PENDING }
      );
    }

    return withTransaction(async session => {
      const updated = await paymentRepository.updateByIdWithSession(
        id,
        { status: PAYMENT_RECORD_STATUS.COMPLETED },
        { session }
      );

      const touchedPackages = [];
      let touchedDelivery = null;
      for (const allocation of payment.allocations) {
        if (allocation.packageId) {
          touchedPackages.push(
            await this.recalculatePackage(allocation.packageId, { actor, req, session })
          );
        } else if (allocation.deliveryId) {
          touchedDelivery = await this.recalculateDelivery(allocation.deliveryId, { session });
        }
      }

      await auditService.record(
        {
          actor,
          action: AUDIT_ACTION.PAYMENT_CONFIRM,
          entity: AUDIT_ENTITY.PAYMENT,
          entityId: updated._id,
          entityLabel: payment.customerPhone,
          branchId: payment.branchId,
          field: 'status',
          before: PAYMENT_RECORD_STATUS.PENDING,
          after: PAYMENT_RECORD_STATUS.COMPLETED,
          req,
        },
        { session }
      );

      return { payment: updated, packages: touchedPackages, delivery: touchedDelivery };
    });
  }

  /**
   * Roadmap 5.6/5.7 — QPay webhook `pending` төлбөрийг ажилтангүйгээр
   * баталгаажуулна. `confirmPending`-тэй ижил бие даалттай, ГЭХДЭЭ:
   *   1. Staff `id`-гээр биш, `(provider, providerInvoiceId)`-аар олно, БА
   *      `paymentRepository.completeByProviderInvoice`-ийн атомик
   *      `status: PENDING` нөхцөлөөр давхардсан webhook-ийг ЧИМЭЭГҮЙ
   *      боловсруулна (архитектур §4.4).
   *   2. `actor: null, req: null` — `selfConfirmReceived`-ийн батлагдсан
   *      загвар (`packageService.changeStatus` `actor?._id ?? null`-ээр
   *      найдвартай тэвчинэ).
   *
   * `findOneAndUpdate` `null` буцаах ХОЁР шалтгааныг ЯЛГАНА: аль хэдийн
   * боловсруулагдсан (давхардсан webhook — чимээгүй) эсвэл ийм
   * `(provider, providerInvoiceId)`-тай мөр ОГТ байхгүй (QPay мөнгө ирсэн
   * гэж хэлж байгаа ч манай системд бичлэг алга — staff гараар нийцүүлэх
   * ёстой тохиолдол, ERROR төвшинд логдоно).
   */
  async confirmByProvider(provider, providerInvoiceId, { providerPaymentId, reportedAmount }) {
    return withTransaction(async session => {
      const updated = await paymentRepository.completeByProviderInvoice(
        provider,
        providerInvoiceId,
        providerPaymentId,
        { session }
      );

      if (!updated) {
        const existing = await paymentRepository.findByProviderInvoice(provider, providerInvoiceId);
        if (!existing) {
          logger.error('QPay webhook: тохирох pending төлбөр олдсонгүй', {
            provider,
            providerInvoiceId,
            providerPaymentId,
          });
        }
        // мөр байгаа ч `pending` биш — давхардсан webhook, чимээгүй
        return { payment: existing ?? null, packages: [], delivery: null, alreadyProcessed: true };
      }

      const overpaid = reportedAmount != null && reportedAmount > updated.amount;

      const touchedPackages = [];
      let touchedDelivery = null;
      for (const allocation of updated.allocations) {
        if (allocation.packageId) {
          touchedPackages.push(
            await this.recalculatePackage(allocation.packageId, {
              actor: null,
              req: null,
              session,
            })
          );
        } else if (allocation.deliveryId) {
          touchedDelivery = await this.recalculateDelivery(allocation.deliveryId, { session });
        }
      }

      await auditService.record(
        {
          action: AUDIT_ACTION.PAYMENT_CONFIRM,
          entity: AUDIT_ENTITY.PAYMENT,
          entityId: updated._id,
          entityLabel: updated.customerPhone,
          branchId: updated.branchId,
          actorName: 'QPay webhook',
          field: 'status',
          before: PAYMENT_RECORD_STATUS.PENDING,
          after: PAYMENT_RECORD_STATUS.COMPLETED,
          reason: overpaid
            ? `QPay-ээс илүү дүн ирсэн (${reportedAmount}₮ > ${updated.amount}₮), ledger дүнгээр баталгаажуулсан`
            : null,
        },
        { session }
      );

      return {
        payment: updated,
        packages: touchedPackages,
        delivery: touchedDelivery,
        alreadyProcessed: false,
      };
    });
  }

  /**
   * Roadmap 5.6/5.7 — QPay webhook-ийн орох цэг. `qpay.route.js`-ийн
   * `POST /v1/qpay/callback` (танилтгүй) ЭНД дуудна — мөнгө бичих ЭСЭХ шийдвэрийг
   * бүгдийг ЭНД, `payment.service.js` дотор л гаргана (CLAUDE.md §5 дүрэм 10).
   *
   * `paymentId` бол QPay-д ӨӨРСДӨӨ өгсөн callback URL-ийн query параметр
   * (`delivery.service.js`-ийн `selfCreate`) — МАНАЙ Payment баримтын `_id`,
   * QPay-ийн буцаах payload-ын хэлбэрээс ХАМААРАЛГҮЙ найдвартай холбоос.
   * Webhook-ийн payload-д ХЭЗЭЭ Ч итгэхгүй — зөвхөн `qpayService.checkInvoice`-
   * аар өөрийн эрхээр дахин баталгаажуулсан үр дүнд итгэнэ (архитектур §4.4).
   */
  async handleQpayCallback(paymentId) {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      logger.warn('QPay webhook: тохирох Payment олдсонгүй', { paymentId });
      return;
    }

    if (payment.status !== PAYMENT_RECORD_STATUS.PENDING) {
      return; // давхардсан webhook эсвэл аль хэдийн боловсруулагдсан
    }

    if (!payment.providerInvoiceId) {
      // Нэхэмжлэх ID хараахан залгагдаагүй байж болзошгүй маш нарийн цонх
      // (`selfCreate`-ийн createInvoice ↔ providerInvoiceId бичих хооронд) —
      // QPay webhook-ээ дахин илгээх тул дараагийн оролдлогод шийдэгдэнэ.
      logger.warn('QPay webhook: providerInvoiceId хараахан залгагдаагүй', { paymentId });
      return;
    }

    const result = await qpayService.checkInvoice(payment.providerInvoiceId);
    if (!result.paid) {
      return;
    }

    await this.confirmByProvider('qpay', payment.providerInvoiceId, {
      providerPaymentId: result.providerPaymentId,
      reportedAmount: result.paidAmount,
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

  /**
   * Roadmap 5.8 — `deliveries.feePaidAmount`-ыг ЭХ СУРВАЛЖААС дахин бодож
   * бичнэ (`recalculatePackage`-ийн ижил зарчим, BR-14). Хураамжид ХОЛБООТОЙ
   * ямар ч Delivery статус шилжилт ЭНД хийгдэхгүй — тэр `delivery-state.js`-ийн
   * `unpaidFee` хаалтаар `dispatched`-д дуудагдах үед л шалгагдана.
   */
  async recalculateDelivery(deliveryId, { session }) {
    const feePaidAmount = await paymentRepository.sumCompletedForDelivery(deliveryId, { session });
    return deliveryRepository.updateByIdWithSession(deliveryId, { feePaidAmount }, { session });
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

    // Утас/харилцагч холбогдоогүй ачаанд төлбөр бүртгэх боломжгүй (BR-45) —
    // эхлээд ачааны мэдээллийг засаж утас холбоно уу
    if (!packages[0].customerId) {
      throw new APIError(
        'Энэ ачаанд харилцагчийн утас холбогдоогүй тул төлбөр бүртгэх боломжгүй. Эхлээд ачааны мэдээллийг засаж утас холбоно уу',
        httpStatus.UNPROCESSABLE_ENTITY,
        { code: ERROR_CODE.PHONE_REQUIRED }
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
