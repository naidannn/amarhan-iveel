'use strict';

const Package = require('../models/package.model');
const Payment = require('../models/payment.model');
const Delivery = require('../models/delivery.model');
const {
  DELIVERY_STATUS,
  PACKAGE_STATUS,
  PAYMENT_RECORD_STATUS,
  PAYMENT_STATUS,
} = require('../config/constants');

const ACTIVE_PACKAGE_STATUSES = Object.values(PACKAGE_STATUS).filter(
  status => status !== PACKAGE_STATUS.CANCELLED
);

const TODAY_DELIVERY_STATUSES = [
  DELIVERY_STATUS.CREATED,
  DELIVERY_STATUS.DISPATCHED,
  DELIVERY_STATUS.DELIVERED,
  // BR-21d — харилцагч өөрөө баталгаажуулсан ч "өнөөдрийн хүргэлт" гэдэг утгаараа адилхан
  DELIVERY_STATUS.RECEIVED,
];

/**
 * Хяналтын самбарын зөвхөн уншилтын query-ууд.
 *
 * Dashboard-д жагсаалт татаж client талд тоолохгүй. Том коллекц дээр
 * шаардлагатай хэдхэн талбарыг MongoDB өөрөө aggregate хийж, өдөр тутмын
 * графикийн 30 мөрөөс ихгүй үр дүн буцаана.
 */
class DashboardRepository {
  async summary({ branchId, periodStart, periodEnd, todayStart, todayEnd }) {
    const packageScope = {
      ...(branchId ? { branchId } : {}),
      status: { $in: ACTIVE_PACKAGE_STATUSES },
    };
    const paymentScope = {
      ...(branchId ? { branchId } : {}),
      status: PAYMENT_RECORD_STATUS.COMPLETED,
    };
    const deliveryScope = {
      ...(branchId ? { branchId } : {}),
      status: { $in: TODAY_DELIVERY_STATUSES },
      scheduledDate: { $gte: todayStart, $lt: todayEnd },
    };

    const [packageTotals, packageStatuses, paymentTotals, dailyRevenue, dailyPackages, deliveries] =
      await Promise.all([
        Package.aggregate([
          { $match: packageScope },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              awaitingPayment: {
                $sum: { $cond: [{ $gt: ['$balance', 0] }, 1, 0] },
              },
              outstandingAmount: {
                $sum: { $cond: [{ $gt: ['$balance', 0] }, '$balance', 0] },
              },
              paid: {
                $sum: { $cond: [{ $eq: ['$paymentStatus', PAYMENT_STATUS.PAID] }, 1, 0] },
              },
            },
          },
        ]),
        Package.aggregate([
          { $match: packageScope },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Payment.aggregate([
          { $match: paymentScope },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        Payment.aggregate([
          { $match: { ...paymentScope, createdAt: { $gte: periodStart, $lt: periodEnd } } },
          {
            $group: {
              _id: {
                $dateToString: {
                  date: '$createdAt',
                  format: '%Y-%m-%d',
                  timezone: 'Asia/Ulaanbaatar',
                },
              },
              value: { $sum: '$amount' },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        Package.aggregate([
          {
            $match: {
              ...(branchId ? { branchId } : {}),
              status: { $nin: [PACKAGE_STATUS.IN_ERLIAN, PACKAGE_STATUS.CANCELLED] },
              arrivedAt: { $gte: periodStart, $lt: periodEnd },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  date: '$arrivedAt',
                  format: '%Y-%m-%d',
                  timezone: 'Asia/Ulaanbaatar',
                },
              },
              value: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        Delivery.aggregate([
          { $match: deliveryScope },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              // Хэн баталгаажуулснаас үл хамааран (ажилтан `delivered`, харилцагч
              // өөрөө `received`) энэ dashboard тоонд "хүргэгдсэн" гэж адилхан орно
              delivered: {
                $sum: {
                  $cond: [
                    { $in: ['$status', [DELIVERY_STATUS.DELIVERED, DELIVERY_STATUS.RECEIVED]] },
                    1,
                    0,
                  ],
                },
              },
              pending: {
                $sum: {
                  $cond: [
                    { $in: ['$status', [DELIVERY_STATUS.CREATED, DELIVERY_STATUS.DISPATCHED]] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]),
      ]);

    return {
      packages: packageTotals[0] ?? {
        total: 0,
        awaitingPayment: 0,
        outstandingAmount: 0,
        paid: 0,
      },
      packageStatuses: toCountMap(packageStatuses),
      revenue: paymentTotals[0] ?? { total: 0, count: 0 },
      dailyRevenue: toValueMap(dailyRevenue),
      dailyPackages: toValueMap(dailyPackages),
      deliveries: deliveries[0] ?? { total: 0, delivered: 0, pending: 0 },
    };
  }
}

function toCountMap(rows) {
  return rows.reduce((result, row) => {
    result[row._id] = row.count;
    return result;
  }, {});
}

function toValueMap(rows) {
  return rows.reduce((result, row) => {
    result[row._id] = row.value;
    return result;
  }, {});
}

module.exports = new DashboardRepository();
