'use strict';

const Package = require('../models/package.model');
const Payment = require('../models/payment.model');
const { PACKAGE_STATUS, PAYMENT_RECORD_STATUS, PAYMENT_STATUS } = require('../config/constants');

const MONGOLIA_TIME_ZONE = 'Asia/Ulaanbaatar';
const DAY_MS = 24 * 60 * 60 * 1000;

const ARRIVED_PACKAGE_SCOPE = {
  status: { $nin: [PACKAGE_STATUS.IN_ERLIAN, PACKAGE_STATUS.CANCELLED] },
};

/**
 * Тайлангийн зөвхөн уншилтын aggregate query-ууд.
 *
 * Жагсаалт татаж browser дээр шүүхгүй. Хугацаагаар хязгаарлагдсан index range
 * scan хийж, график бүрт зөвхөн цөөн тооны нэгтгэсэн мөр буцаана. Service-ийн
 * cache нь энэ repository-г ойр ойрхон ажиллуулахаас хамгаална.
 */
class ReportRepository {
  async summary({ branchId, range, series }) {
    const branchScope = branchId ? { branchId } : {};
    const packageScope = { ...branchScope, ...ARRIVED_PACKAGE_SCOPE };
    const completedPaymentScope = {
      ...branchScope,
      status: PAYMENT_RECORD_STATUS.COMPLETED,
    };

    const [
      cargoSnapshot,
      cargoGrowth,
      cargoDaily,
      cargoMonthly,
      cargoWeekly,
      revenueSummary,
      revenueDaily,
      revenueMonthly,
      revenueYearly,
      refunds,
      discounts,
      paymentAging,
      averagePaymentTime,
    ] = await Promise.all([
      this.cargoSnapshot(branchScope),
      this.cargoGrowth(packageScope, range),
      this.groupPackages(packageScope, series.dailyStart, range.periodEnd, '%Y-%m-%d'),
      this.groupPackages(packageScope, series.monthlyStart, range.periodEnd, '%Y-%m'),
      this.weeklyPackages(packageScope, series.weeklyStart, range.periodEnd, range.todayStart),
      this.revenueSummary(completedPaymentScope, range.periodStart, range.periodEnd),
      this.groupPayments(completedPaymentScope, series.dailyStart, range.periodEnd, '%Y-%m-%d'),
      this.groupPayments(completedPaymentScope, series.monthlyStart, range.periodEnd, '%Y-%m'),
      this.groupPayments(completedPaymentScope, series.yearlyStart, range.periodEnd, '%Y'),
      this.refunds(branchScope, range.periodStart, range.periodEnd),
      this.discounts(packageScope, range.periodStart, range.periodEnd),
      this.paymentAging(branchScope, series.threeDaysAgo, series.sevenDaysAgo),
      this.averagePaymentTime(completedPaymentScope, range.periodStart, range.periodEnd),
    ]);

    return {
      cargo: {
        ...cargoSnapshot,
        arrivals: cargoGrowth.current,
        previousArrivals: cargoGrowth.previous,
        daily: toValueMap(cargoDaily),
        monthly: toValueMap(cargoMonthly),
        weekly: cargoWeekly,
      },
      revenue: {
        ...revenueSummary,
        refunds,
        discounts,
        daily: toValueMap(revenueDaily),
        monthly: toValueMap(revenueMonthly),
        yearly: toValueMap(revenueYearly),
      },
      payments: {
        ...paymentAging,
        averageDays: averagePaymentTime,
      },
    };
  }

  async cargoSnapshot(branchScope) {
    const rows = await Package.aggregate([
      {
        $match: {
          ...branchScope,
          status: { $ne: PACKAGE_STATUS.CANCELLED },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          issued: {
            $sum: {
              $cond: [
                { $in: ['$status', [PACKAGE_STATUS.PICKED_UP, PACKAGE_STATUS.DELIVERED]] },
                1,
                0,
              ],
            },
          },
          remaining: {
            $sum: {
              $cond: [
                { $in: ['$status', [PACKAGE_STATUS.PICKED_UP, PACKAGE_STATUS.DELIVERED]] },
                0,
                1,
              ],
            },
          },
        },
      },
    ]);

    return rows[0] ?? { total: 0, issued: 0, remaining: 0 };
  }

  async cargoGrowth(packageScope, range) {
    const rows = await Package.aggregate([
      {
        $match: {
          ...packageScope,
          arrivedAt: { $gte: range.previousStart, $lt: range.periodEnd },
        },
      },
      {
        $group: {
          _id: null,
          current: {
            $sum: { $cond: [{ $gte: ['$arrivedAt', range.periodStart] }, 1, 0] },
          },
          previous: {
            $sum: { $cond: [{ $lt: ['$arrivedAt', range.periodStart] }, 1, 0] },
          },
        },
      },
    ]);

    return rows[0] ?? { current: 0, previous: 0 };
  }

  groupPackages(packageScope, start, end, format) {
    return Package.aggregate([
      { $match: { ...packageScope, arrivedAt: { $gte: start, $lt: end } } },
      { $group: { _id: dateGroup('$arrivedAt', format), value: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
  }

  async weeklyPackages(packageScope, start, end, currentStart) {
    const rows = await Package.aggregate([
      { $match: { ...packageScope, arrivedAt: { $gte: start, $lt: end } } },
      {
        $project: {
          day: dateGroup('$arrivedAt', '%u'),
          period: { $cond: [{ $gte: ['$arrivedAt', currentStart] }, 'current', 'previous'] },
        },
      },
      { $group: { _id: { day: '$day', period: '$period' }, value: { $sum: 1 } } },
    ]);

    return rows.reduce(
      (result, row) => {
        result[row._id.period][Number(row._id.day)] = row.value;
        return result;
      },
      { current: {}, previous: {} }
    );
  }

  async revenueSummary(paymentScope, start, end) {
    const rows = await Payment.aggregate([
      { $match: { ...paymentScope, createdAt: { $gte: start, $lt: end } } },
      {
        $facet: {
          total: [{ $group: { _id: null, value: { $sum: '$amount' }, count: { $sum: 1 } } }],
          methods: [{ $group: { _id: '$method', value: { $sum: '$amount' }, count: { $sum: 1 } } }],
          packages: [
            { $unwind: '$allocations' },
            { $group: { _id: '$allocations.packageId', value: { $sum: '$allocations.amount' } } },
            { $group: { _id: null, total: { $sum: '$value' }, count: { $sum: 1 } } },
          ],
        },
      },
    ]);

    const data = rows[0] ?? { total: [], methods: [], packages: [] };
    const total = data.total[0] ?? { value: 0, count: 0 };
    const packages = data.packages[0] ?? { total: 0, count: 0 };

    return {
      total: total.value,
      count: total.count,
      averagePerPackage: packages.count ? Math.round(packages.total / packages.count) : 0,
      methods: toMethodMap(data.methods),
    };
  }

  groupPayments(paymentScope, start, end, format) {
    return Payment.aggregate([
      { $match: { ...paymentScope, createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: dateGroup('$createdAt', format), value: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]);
  }

  async refunds(branchScope, start, end) {
    const rows = await Payment.aggregate([
      {
        $match: {
          ...branchScope,
          status: PAYMENT_RECORD_STATUS.VOIDED,
          voidedAt: { $gte: start, $lt: end },
        },
      },
      { $group: { _id: null, value: { $sum: '$amount' } } },
    ]);
    return rows[0]?.value ?? 0;
  }

  async discounts(packageScope, start, end) {
    const rows = await Package.aggregate([
      {
        $match: {
          ...packageScope,
          arrivedAt: { $gte: start, $lt: end },
          $expr: { $lt: ['$finalPrice', '$computedPrice'] },
        },
      },
      { $group: { _id: null, value: { $sum: { $subtract: ['$computedPrice', '$finalPrice'] } } } },
    ]);
    return rows[0]?.value ?? 0;
  }

  async paymentAging(branchScope, threeDaysAgo, sevenDaysAgo) {
    const rows = await Package.aggregate([
      {
        $match: {
          ...branchScope,
          paymentStatus: { $in: [PAYMENT_STATUS.UNPAID, PAYMENT_STATUS.PARTIAL] },
          status: { $nin: [PACKAGE_STATUS.IN_ERLIAN, PACKAGE_STATUS.CANCELLED] },
        },
      },
      {
        $project: {
          balance: 1,
          bucket: {
            $switch: {
              branches: [
                { case: { $gte: ['$arrivedAt', threeDaysAgo] }, then: '0-3' },
                { case: { $gte: ['$arrivedAt', sevenDaysAgo] }, then: '4-7' },
              ],
              default: '7+',
            },
          },
        },
      },
      { $group: { _id: '$bucket', value: { $sum: '$balance' }, count: { $sum: 1 } } },
    ]);

    const buckets = toMethodMap(rows);
    const pending = Object.values(buckets).reduce((total, bucket) => total + bucket.value, 0);
    const pendingCount = Object.values(buckets).reduce((total, bucket) => total + bucket.count, 0);

    return {
      pending,
      pendingCount,
      overdue: buckets['7+']?.value ?? 0,
      overdueCount: buckets['7+']?.count ?? 0,
      aging: buckets,
    };
  }

  async averagePaymentTime(paymentScope, start, end) {
    const rows = await Payment.aggregate([
      { $match: { ...paymentScope, createdAt: { $gte: start, $lt: end } } },
      { $unwind: '$allocations' },
      { $group: { _id: '$allocations.packageId', paidAt: { $max: '$createdAt' } } },
      {
        $lookup: {
          from: 'packages',
          localField: '_id',
          foreignField: '_id',
          as: 'package',
        },
      },
      { $unwind: '$package' },
      { $match: { 'package.paymentStatus': PAYMENT_STATUS.PAID } },
      {
        $project: {
          days: {
            $max: [0, { $divide: [{ $subtract: ['$paidAt', '$package.arrivedAt'] }, DAY_MS] }],
          },
        },
      },
      { $group: { _id: null, value: { $avg: '$days' } } },
    ]);

    return Math.round(rows[0]?.value ?? 0);
  }
}

function dateGroup(field, format) {
  return { $dateToString: { date: field, format, timezone: MONGOLIA_TIME_ZONE } };
}

function toValueMap(rows) {
  return rows.reduce((result, row) => {
    result[row._id] = row.value;
    return result;
  }, {});
}

function toMethodMap(rows) {
  return rows.reduce((result, row) => {
    result[row._id] = { value: row.value, count: row.count };
    return result;
  }, {});
}

module.exports = new ReportRepository();
