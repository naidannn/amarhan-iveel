'use strict';

const dashboardRepository = require('../repositories/dashboard.repository');
const branchResolver = require('./branch-resolver.service');
const { ROLES } = require('../config/constants');

const CACHE_TTL_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONGOLIA_TIME_ZONE = 'Asia/Ulaanbaatar';
const dashboardCache = new Map();

/**
 * Хяналтын самбарын нэгтгэл.
 *
 * Dashboard нь секунд тутам өөрчлөгдөх дэлгэц биш тул нэг салбарын ижил
 * тооцооллыг 60 секундэд дахин хийхгүй. Энэ нь ачаа бүртгэх/төлбөр авах
 * үндсэн урсгалаас query-н ачааллыг тусгаарлана. Кэш нь process-local:
 * олон instance-тэй үед ч өгөгдлийн зөв байдалд нөлөөлөхгүй, зөвхөн хамгийн
 * ихдээ нэг минутын хоцролттой харагдана.
 */
class DashboardService {
  async summary(actor) {
    const branchId = await this.resolveBranchId(actor);
    const range = buildDateRange();
    const key = `${branchId ?? 'all'}:${range.todayKey}`;
    const cached = dashboardCache.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const data = await dashboardRepository.summary({ branchId, ...range });
    const result = {
      ...data,
      daily: buildDailySeries(range.periodStart, data.dailyRevenue, data.dailyPackages),
      generatedAt: new Date(),
      cacheTtlSeconds: CACHE_TTL_MS / 1000,
    };

    if (dashboardCache.size > 100) {
      for (const [cacheKey, entry] of dashboardCache) {
        if (entry.expiresAt <= Date.now()) dashboardCache.delete(cacheKey);
      }
    }
    dashboardCache.set(key, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });

    return result;
  }

  async resolveBranchId(actor) {
    if (!actor || actor.role === ROLES.ADMIN) return null;
    if (actor.branchId) return actor.branchId;

    const branch = await branchResolver.resolveBranch();
    return branch._id;
  }
}

function buildDateRange() {
  const todayKey = dateKey(new Date());
  // Улаанбаатарын өдрийн эхлэл. Монгол Улс одоогоор UTC+08:00 бөгөөд DST ашигладаггүй.
  const todayStart = new Date(`${todayKey}T00:00:00.000+08:00`);
  const todayEnd = new Date(todayStart.getTime() + DAY_MS);
  const periodStart = new Date(todayStart.getTime() - 29 * DAY_MS);

  return { todayKey, todayStart, todayEnd, periodStart, periodEnd: todayEnd };
}

function buildDailySeries(periodStart, dailyRevenue, dailyPackages) {
  return Array.from({ length: 30 }, (_, index) => {
    const key = dateKey(new Date(periodStart.getTime() + index * DAY_MS));
    return {
      date: key,
      revenue: dailyRevenue[key] ?? 0,
      packages: dailyPackages[key] ?? 0,
    };
  });
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

module.exports = new DashboardService();
