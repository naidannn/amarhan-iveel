'use strict';

const reportRepository = require('../repositories/report.repository');
const branchResolver = require('./branch-resolver.service');
const { ROLES } = require('../config/constants');

const CACHE_TTL_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONGOLIA_TIME_ZONE = 'Asia/Ulaanbaatar';
const REPORT_PERIODS = { '7d': 7, '30d': 30, '12m': 365 };
const reportCache = new Map();

/**
 * Тайлан нь үндсэн бүртгэл/төлбөрийн урсгалаас тусдаа, уншилтын сервис.
 *
 * Хугацааны гурван хязгаараас өөр сонголтгүй тул үнэтэй query-г client-ээс
 * тэлэх боломжгүй. Ижил салбар, ижил өдөр, ижил хугацааны хүсэлтийг 5 минут
 * process-local cache-д нэгтгэнэ; ингэснээр олон админ нээсэн ч ачаалал
 * давхардахгүй. Өгөгдөл шинэчлэгдэх хугацаа хамгийн ихдээ 5 минут байна.
 */
class ReportService {
  async summary(actor, period) {
    const branchId = await this.resolveBranchId(actor);
    const range = buildRange(period);
    const key = `${branchId ?? 'all'}:${period}:${range.todayKey}`;
    const cached = reportCache.get(key);

    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const series = buildSeries(range);
    const data = await reportRepository.summary({
      branchId,
      range,
      series,
    });
    // Aggregate нь зөвхөн утгатай өдрүүдийг буцаадаг. График тасрахгүй байхын
    // тулд хоосон өдөр/сар/жилийг service талд 0-оор нөхнө.
    data.cargo.daily = fillSeries(series.dailyKeys, data.cargo.daily);
    data.cargo.monthly = fillSeries(series.monthlyKeys, data.cargo.monthly);
    data.revenue.daily = fillSeries(series.dailyKeys, data.revenue.daily);
    data.revenue.monthly = fillSeries(series.monthlyKeys, data.revenue.monthly);
    data.revenue.yearly = fillSeries(series.yearlyKeys, data.revenue.yearly);
    data.efficiency.packageRevenue.daily = fillSeries(
      series.dailyKeys,
      data.efficiency.packageRevenue.daily
    );
    data.efficiency.expenses.daily = fillSeries(series.dailyKeys, data.efficiency.expenses.daily);
    // BR-47a — өдрийн цэвэр үр дүн = өдрийн "олох ёстой орлого" − өдрийн зарлага.
    data.efficiency.profit = {
      total: data.efficiency.packageRevenue.total - data.efficiency.expenses.total,
      daily: series.dailyKeys.reduce((result, key) => {
        result[key] = data.efficiency.packageRevenue.daily[key] - data.efficiency.expenses.daily[key];
        return result;
      }, {}),
    };
    const result = {
      ...data,
      period,
      generatedAt: new Date(),
      cacheTtlSeconds: CACHE_TTL_MS / 1000,
    };

    if (reportCache.size > 100) {
      for (const [cacheKey, entry] of reportCache) {
        if (entry.expiresAt <= Date.now()) reportCache.delete(cacheKey);
      }
    }
    reportCache.set(key, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  }

  async resolveBranchId(actor) {
    if (!actor || actor.role === ROLES.ADMIN) return null;
    if (actor.branchId) return actor.branchId;
    const branch = await branchResolver.resolveBranch();
    return branch._id;
  }
}

function buildRange(period) {
  const days = REPORT_PERIODS[period];
  const todayKey = dateKey(new Date());
  const todayStart = new Date(`${todayKey}T00:00:00.000+08:00`);
  const periodEnd = new Date(todayStart.getTime() + DAY_MS);
  const periodStart = new Date(periodEnd.getTime() - days * DAY_MS);

  return {
    todayKey,
    todayStart,
    periodStart,
    periodEnd,
    previousStart: new Date(periodStart.getTime() - days * DAY_MS),
  };
}

function buildSeries(range) {
  const dailyStart = new Date(
    range.periodEnd.getTime() - Math.min(30, daysBetween(range)) * DAY_MS
  );
  const currentMonth = range.todayKey.slice(0, 7);
  const monthlyStart = monthStart(currentMonth, 11);
  const yearlyStart = new Date(
    `${Number(range.todayKey.slice(0, 4)) - 3}-01-01T00:00:00.000+08:00`
  );

  return {
    dailyStart,
    monthlyStart,
    yearlyStart,
    weeklyStart: new Date(range.periodEnd.getTime() - 14 * DAY_MS),
    threeDaysAgo: new Date(range.todayStart.getTime() - 3 * DAY_MS),
    sevenDaysAgo: new Date(range.todayStart.getTime() - 7 * DAY_MS),
    dailyKeys: dateKeys(dailyStart, range.periodEnd),
    monthlyKeys: monthKeys(monthlyStart, 12),
    yearlyKeys: yearKeys(yearlyStart, 4),
  };
}

function daysBetween(range) {
  return Math.round((range.periodEnd.getTime() - range.periodStart.getTime()) / DAY_MS);
}

function monthStart(currentMonth, monthsBack) {
  const [year, month] = currentMonth.split('-').map(Number);
  const shiftedMonth = month - 1 - monthsBack;
  const targetYear = year + Math.floor(shiftedMonth / 12);
  const targetMonth = (((shiftedMonth % 12) + 12) % 12) + 1;
  return new Date(`${targetYear}-${String(targetMonth).padStart(2, '0')}-01T00:00:00.000+08:00`);
}

function dateKeys(start, end) {
  const count = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  return Array.from({ length: count }, (_, index) =>
    dateKey(new Date(start.getTime() + index * DAY_MS))
  );
}

function monthKeys(start, count) {
  const first = dateKey(start).slice(0, 7);
  return Array.from({ length: count }, (_, index) => {
    const [year, month] = first.split('-').map(Number);
    const offset = month - 1 + index;
    return `${year + Math.floor(offset / 12)}-${String((offset % 12) + 1).padStart(2, '0')}`;
  });
}

function yearKeys(start, count) {
  const firstYear = Number(dateKey(start).slice(0, 4));
  return Array.from({ length: count }, (_, index) => String(firstYear + index));
}

function fillSeries(keys, values) {
  return keys.reduce((result, key) => {
    result[key] = values[key] ?? 0;
    return result;
  }, {});
}

function dateKey(value) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MONGOLIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const get = type => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

module.exports = new ReportService();
