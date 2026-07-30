'use strict';

const httpStatus = require('http-status');
const packageRepository = require('../repositories/package.repository');
const paymentRepository = require('../repositories/payment.repository');
const deliveryRepository = require('../repositories/delivery.repository');
const invoiceRepository = require('../repositories/invoice.repository');
const APIError = require('../utils/APIError');
const { PACKAGE_STATUS, PAYMENT_STATUS, PAYMENT_RECORD_STATUS } = require('../config/constants');

/**
 * Харилцагчийн вэбийн өгөгдөл — introduction.md §3
 *
 * ⚠ ЭНЭ ФАЙЛЫН ЦОРЫН ГАНЦ ХАМГААЛАЛТ: хүсэлт бүр `customerId`-аар
 * ХЯЗГААРЛАГДАНА. Ажилтны service-үүд салбараар (`branchId`) хүрээлдэгтэй
 * ижил зарчим, гэхдээ хамаагүй хатуу — харилцагч ГАНЦ бичлэгийн эзэн.
 *
 * Тиймээс энд хоёр дүрэм баримтална:
 *   1. Клиентээс ирсэн `customerId` / `phone` / `branchId`-г ХЭЗЭЭ Ч авахгүй.
 *      Шүүлтийн параметрийг гараар цуглуулна — `{ ...req.query }` гэж
 *      дамжуулбал хожим repository-д шинэ шүүлт нэмэгдэхэд хамрах хүрээ
 *      чимээгүй нээгдэнэ.
 *   2. Нэг бичлэг уншихад ч эзэмшлийг шалгана — өөр хүний ачааны ID мэдсэн ч
 *      `404` авна (олдоогүй/эрхгүйг ялгахгүй: ялгавал ID тааварлах боломж
 *      үүснэ).
 */
class CustomerPortalService {
  /**
   * Нүүр самбарын тоонууд.
   *
   * `countDocuments` дөрвөн удаа дуудаж байгаа нь §9.3-ын хувьд аюулгүй:
   * шүүлт бүр `{ customerId, ... }`-аар эхэлдэг тул нэг харилцагчийн
   * хэдэн арван бичлэгээр л хязгаарлагдана, бүтэн коллекц сканддаггүй.
   */
  async summary(customerId) {
    const [total, awaitingPayment, readyForPickup, inDelivery, unpaidAgg] = await Promise.all([
      packageRepository.count({ customerId, status: { $ne: PACKAGE_STATUS.CANCELLED } }),
      packageRepository.count({
        customerId,
        paymentStatus: { $in: [PAYMENT_STATUS.UNPAID, PAYMENT_STATUS.PARTIAL] },
        status: { $nin: [PACKAGE_STATUS.CANCELLED, PACKAGE_STATUS.DELIVERED] },
      }),
      packageRepository.count({ customerId, status: PACKAGE_STATUS.PAID }),
      packageRepository.count({ customerId, status: PACKAGE_STATUS.OUT_FOR_DELIVERY }),
      this.totalBalance(customerId),
    ]);

    return {
      packages: { total, awaitingPayment, readyForPickup, inDelivery },
      balance: unpaidAgg,
    };
  }

  /**
   * Нийт төлөх үлдэгдэл.
   *
   * BR-14 — `balance` нь `payments.allocations`-аас гаралтай кэш. Энд түүнийг
   * НЭМЖ л байгаа тул кэш зөв гэж үзнэ; зөрүү илрүүлэх нь өдөр тутмын
   * cron-ий ажил (docs/data-model.md §7), харилцагчийн дэлгэцийнх биш.
   */
  async totalBalance(customerId) {
    const [row] = await packageRepository.model.aggregate([
      {
        $match: {
          customerId,
          status: { $ne: PACKAGE_STATUS.CANCELLED },
          balance: { $gt: 0 },
        },
      },
      { $group: { _id: null, total: { $sum: '$balance' } } },
    ]);
    return row?.total ?? 0;
  }

  async listPackages(customerId, { page, limit, status, trackingNumber, paymentStatus }) {
    const result = await packageRepository.search(
      { customerId },
      { page, limit, status, trackingNumber, paymentStatus, sort: '-createdAt' }
    );
    return this.paginated(result, pkg => this.toPublicPackage(pkg));
  }

  async getPackage(customerId, packageId) {
    const pkg = await packageRepository.findByIdWithRefs(packageId);
    this.assertOwned(pkg, customerId);

    const [payments, deliveries] = await Promise.all([
      paymentRepository.model
        .find({
          'allocations.packageId': pkg._id,
          status: PAYMENT_RECORD_STATUS.COMPLETED,
        })
        .select('amount method createdAt allocations')
        .sort({ createdAt: -1 }),
      deliveryRepository.listForPackage(pkg._id),
    ]);

    return {
      ...this.toPublicPackage(pkg),
      // Ачааны дэлгэрэнгүйд төлөв хэзээ өөрчлөгдсөнийг харуулна. Ажилтны
      // НЭР харилцагчид харагдах шаардлагагүй тул хасна.
      statusHistory: (pkg.statusHistory ?? []).map(h => ({
        from: h.from,
        to: h.to,
        at: h.at,
      })),
      payments: payments.map(p => ({
        id: p._id,
        method: p.method,
        createdAt: p.createdAt,
        // Нэг төлбөр олон ачаанд хуваарилагдсан байж болно — ЭНЭ ачаанд
        // ногдсон хэсгийг л харуулна, эс тэгвээс дүн буруу харагдана.
        amount: (p.allocations ?? [])
          .filter(a => String(a.packageId) === String(pkg._id))
          .reduce((sum, a) => sum + a.amount, 0),
      })),
      deliveries,
    };
  }

  async listPayments(customerId, { page, limit }) {
    const result = await paymentRepository.search(
      { customerId },
      {
        page,
        limit,
        // Хүчингүй болсон болон батлагдаагүй төлбөрийг харилцагчид харуулахгүй
        // — тэдгээр нь мөнгө шилжсэн гэсэн үг БИШ (BR-14, BR-18).
        status: PAYMENT_RECORD_STATUS.COMPLETED,
        sort: '-createdAt',
      }
    );
    return this.paginated(result, p => ({
      id: p._id,
      amount: p.amount,
      method: p.method,
      itemCount: (p.allocations ?? []).length,
      createdAt: p.createdAt,
    }));
  }

  async listInvoices(customerId, { page, limit, status }) {
    const result = await invoiceRepository.search({ customerId }, { page, limit, status });
    return this.paginated(result, inv => ({
      id: inv._id,
      invoiceNumber: inv.invoiceNumber,
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount,
      status: inv.status,
      itemCount: (inv.items ?? []).length,
      createdAt: inv.createdAt,
    }));
  }

  async listDeliveries(customerId, { page, limit, status }) {
    const result = await deliveryRepository.search({ customerId }, { page, limit, status });
    return this.paginated(result, d => ({
      id: d._id,
      deliveryNumber: d.deliveryNumber,
      status: d.status,
      address: d.address,
      phone: d.phone,
      packageCount: (d.packageIds ?? []).length,
      scheduledDate: d.scheduledDate,
      dispatchedAt: d.dispatchedAt,
      deliveredAt: d.deliveredAt,
      fee: d.fee,
      createdAt: d.createdAt,
    }));
  }

  // ── Туслах ────────────────────────────────────────────────────────────

  /**
   * Эзэмшлийн шалгалт. Олдоогүй ба эрхгүйг ЯЛГААГҮЙ `404` буцаана —
   * `403` буцаавал "энэ ID бодитоор оршдог" гэдгийг баталж, дараалсан
   * хүсэлтээр бусдын бичлэгийн оршин байдлыг зурах боломж үүснэ.
   */
  assertOwned(doc, customerId) {
    const owner = doc?.customerId?._id ?? doc?.customerId;
    if (!doc || String(owner) !== String(customerId)) {
      throw new APIError('Ачаа олдсонгүй', httpStatus.NOT_FOUND);
    }
  }

  /**
   * Харилцагчид харагдах ачааны талбарууд.
   *
   * ЦАГААН ЖАГСААЛТ — `note` (ажилтны дотоод тэмдэглэл), `locationCode`
   * (агуулахын байршил), `registeredBy`, `pricingSnapshot`, `priceOverridden`
   * зэрэг нь ДОТООД мэдээлэл бөгөөд харилцагчид хамаагүй. Хожим шинэ талбар
   * нэмэгдэхэд энэ жагсаалт түүнийг чимээгүй нийтлэхгүй.
   */
  toPublicPackage(pkg) {
    return {
      id: pkg._id,
      trackingNumber: pkg.trackingNumber,
      status: pkg.status,
      quantity: pkg.quantity,
      weightKg: pkg.weightKg,
      volumeM3: pkg.volumeM3,
      cargoType: pkg.cargoTypeId?.name ?? null,
      finalPrice: pkg.finalPrice,
      paidAmount: pkg.paidAmount,
      balance: pkg.balance,
      paymentStatus: pkg.paymentStatus,
      arrivedAt: pkg.arrivedAt,
      createdAt: pkg.createdAt,
    };
  }

  paginated(result, map) {
    return {
      data: result.docs.map(map),
      pagination: {
        page: result.page,
        pages: result.totalPages,
        total: result.totalDocs,
        limit: result.limit,
      },
    };
  }
}

module.exports = new CustomerPortalService();
