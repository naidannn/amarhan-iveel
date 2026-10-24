'use strict';

const httpStatus = require('http-status');
const loyaltyRepository = require('../repositories/loyalty-transaction.repository');
const paymentRepository = require('../repositories/payment.repository');
const packageRepository = require('../repositories/package.repository');
const customerRepository = require('../repositories/customer.repository');
const settingService = require('./setting.service');
const notificationService = require('./notification.service');
const auditService = require('./audit.service');
const APIError = require('../utils/APIError');
const logger = require('../utils/logger');
const loyalty = require('../domain/loyalty');
const {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  ERROR_CODE,
  LOYALTY_TX_TYPE,
  PACKAGE_STATUS,
  PAYMENT_STATUS,
  SETTING_DEFAULTS,
  SETTING_KEY,
} = require('../config/constants');

const DAY_MS = 24 * 60 * 60 * 1000;
// Зэрэг ажилласан reconcile `{packageId, seq}` unique-д мөргөлдвөл дахин уншиж оролдоно
const RECONCILE_ATTEMPTS = 3;

/**
 * Урамшууллын модуль — introduction.md §4, BR-30…BR-33a, BR-48.
 *
 * КРЕДИТИЙН ЦОРЫН ГАНЦ ХАЯГ. `loyalty_transactions` (эх сурвалж) ба
 * `customers.loyaltyPoints` (кэш)-ийг ЗӨВХӨН энэ файл бичнэ. Кредитээр хийх
 * ТӨЛБӨР нь мөнгө тул `payment.service.js#applyCredit`-д (дүрэм 10) — тэр нь
 * энд байгаа `debit`/`cancelDebit`/`refundRedemption`-ийг дуудна.
 *
 * Гурван зарчим (loyalty-readiness.md §3):
 *   1. Олголт нь нэг удаагийн "эвент" БИШ, идемпотент RECONCILE: ачаанд
 *      ногдох ёстой кредитийг эх сурвалжаас бодож, ledger-ийн нийлбэртэй
 *      харьцуулж ЗӨРҮҮГ л бичнэ. Давхардсан webhook, төлбөр хүчингүй болох,
 *      үнэ өөрчлөгдөх, ачаа өөр харилцагч руу шилжих — бүгд өөрөө засагдана.
 *   2. Кредит БОДИТ МӨНГӨӨР төлсөн хэсгээс л бодогдоно (кредитээс кредит
 *      олгохгүй), ачаа БҮРЭН төлөгдсөний дараа (BR-30).
 *   3. Олголт бүрд түвшин/хувийн snapshot — босго өөрчлөгдсөн ч өмнөх
 *      олголт хөдлөхгүй.
 */
class LoyaltyService {
  // ── Тохиргоо ба түвшин ──────────────────────────────────────────────────

  async getProgram() {
    const defaults = SETTING_DEFAULTS[SETTING_KEY.LOYALTY_PROGRAM];
    const stored = await settingService.get(SETTING_KEY.LOYALTY_PROGRAM);
    const program = { ...defaults, ...(stored ?? {}) };

    try {
      program.tiers = loyalty.normalizeTiers(program.tiers);
    } catch (err) {
      // Validation-оор хамгаалагдсан ч DB-д гараар засагдсан байж болно —
      // урамшуулал унахаас анхны утгаар ажиллах нь дээр (ERROR лог үлдэнэ).
      logger.error('loyalty.program тохиргоо эвдэрсэн, анхны утгыг ашиглана', {
        message: err.message,
      });
      program.tiers = loyalty.normalizeTiers(defaults.tiers);
    }

    return program;
  }

  /**
   * BR-32 — сүүлийн `windowDays` хоногийн зарцуулалт, түвшин, дараагийн
   * шат хүртэлх зай. Түвшинг ҮРГЭЛЖ эх сурвалжаас боддог — 12 сарын цонх
   * өдөр бүр гулсдаг тул кэш нь ямар нэг эвентгүйгээр хуучирна.
   */
  async standing(customer, program = null) {
    const p = program ?? (await this.getProgram());
    const since = new Date(Date.now() - p.windowDays * DAY_MS);
    const spend = await paymentRepository.sumCustomerSpend(customer._id, since);

    const { tier, index } = loyalty.resolveTier(
      spend.total,
      p.tiers,
      customer.loyaltyTierManual ?? null
    );
    const gap = loyalty.nextTierGap(spend.total, p.tiers, tier.code);

    return {
      program: p,
      spent: spend.total,
      packageCount: spend.packages,
      tier,
      tierIndex: index,
      next: gap.next,
      remaining: gap.remaining,
      progressBps: gap.progressBps,
    };
  }

  /**
   * Түвшний кэшийг (`customers.loyaltyTier`) шинэчилнэ. Ахисан бол
   * харилцагчид мэдэгдэнэ — "дараагийн шат" нь урамшууллын гол хөшүүрэг.
   */
  async refreshTier(customer, program = null) {
    const s = await this.standing(customer, program);

    if (customer.loyaltyTier !== s.tier.code) {
      const prevIndex = s.program.tiers.findIndex(t => t.code === customer.loyaltyTier);
      await loyaltyRepository.setTier(customer._id, s.tier.code);
      customer.loyaltyTier = s.tier.code;

      if (prevIndex >= 0 && s.tierIndex > prevIndex) {
        await notificationService.notifyLoyaltyEvent(customer._id, {
          title: `Баяр хүргэе! Та ${s.tier.name} түвшинд хүрлээ`,
          body: `Одооноос ачааны төлбөр бүрийн ${formatRate(s.tier.rateBps)}-ийг кредитээр буцаан авна.`,
          entityLabel: s.tier.code,
        });
      }
    }

    return s;
  }

  // ── Олголт (BR-30, BR-31) — идемпотент reconcile ───────────────────────

  /**
   * Ачаанд ногдох кредитийг эх сурвалжаас бодож, ledger-ийг тэнцүүлнэ.
   * `payment.service.js#recalculatePackage` (мөнгөний БҮХ зам), мөн ачааны
   * харилцагч солигдох/цуцлагдах үед дуудагдана. Хэдэн ч удаа дуудсан ижил
   * үр дүн — зөрүүгүй бол юу ч бичихгүй.
   *
   * @returns {Promise<object[]>} бичигдсэн ledger мөрүүд
   */
  async reconcilePackage(packageId) {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.reconcileOnce(packageId);
      } catch (err) {
        if (err?.code === 11000 && attempt < RECONCILE_ATTEMPTS) continue;
        throw err;
      }
    }
  }

  async reconcileOnce(packageId) {
    const program = await this.getProgram();
    // Идэвхгүй үед ШИНЭ олголт/буцаалт хийхгүй — өмнө олгосон кредит хэвээр
    if (!program.enabled) return [];

    const pkg = await packageRepository.model
      .findById(packageId)
      .select('customerId status paymentStatus trackingNumber');
    if (!pkg) return [];

    const entries = await loyaltyRepository.listEarnForPackage(pkg._id);

    // Харилцагч тус бүрт энэ ачаанаас өнөөг хүртэл олгосон цэвэр дүн. Ачаа
    // А → Б харилцагч руу шилжсэн бол А-гийнхыг 0 болгож, Б-д олгоно
    // (loyalty-readiness §4).
    const earnedBy = new Map();
    for (const e of entries) {
      const key = String(e.customerId);
      earnedBy.set(key, (earnedBy.get(key) ?? 0) + e.amount);
    }

    const ownerKey = pkg.customerId ? String(pkg.customerId) : null;
    const targets = new Map([...earnedBy.keys()].map(key => [key, 0]));
    let snapshot = null;

    // BR-30 — `paymentStatus` дээр тулгуурлана, `paid` ТӨЛӨВ дээр БИШ:
    // `delivered` ачааны төлөв төлбөрөөр өөрчлөгддөггүй (loyalty-readiness §2).
    const eligible =
      ownerKey &&
      pkg.paymentStatus === PAYMENT_STATUS.PAID &&
      pkg.status !== PACKAGE_STATUS.CANCELLED;

    if (eligible) {
      const prior = [...entries]
        .reverse()
        .find(e => String(e.customerId) === ownerKey && e.rateBps != null);

      let rateBps;
      let tierCode;
      if (prior) {
        // Snapshot — анх олгосон хувиар үргэлжлүүлнэ (BR-31)
        rateBps = prior.rateBps;
        tierCode = prior.tier;
      } else {
        const customer = await customerRepository.findById(pkg.customerId);
        if (!customer) return [];
        const s = await this.refreshTier(customer, program);
        rateBps = s.tier.rateBps;
        tierCode = s.tier.code;
      }

      const baseAmount = await paymentRepository.sumCashCompletedForPackage(pkg._id);
      targets.set(ownerKey, loyalty.computeEarn(baseAmount, rateBps));
      snapshot = { rateBps, tier: tierCode, baseAmount };
    }

    let seq = await loyaltyRepository.maxSeqForPackage(pkg._id);
    const written = [];

    for (const [customerId, target] of targets) {
      const delta = target - (earnedBy.get(customerId) ?? 0);
      if (delta === 0) continue;

      seq += 1;
      const entry = await this.appendEntry({
        customerId,
        type: delta > 0 ? LOYALTY_TX_TYPE.EARN : LOYALTY_TX_TYPE.EARN_REVERSAL,
        amount: delta,
        packageId: pkg._id,
        label: pkg.trackingNumber,
        seq,
        ...(customerId === ownerKey && snapshot ? snapshot : {}),
      });
      written.push(entry);

      if (delta > 0) {
        await notificationService.notifyLoyaltyEvent(customerId, {
          title: `+${formatAmount(delta)} кредит нэмэгдлээ`,
          body: `${pkg.trackingNumber} ачааны төлбөрөөс ${formatAmount(delta)} кредит олгогдлоо. Нийт үлдэгдэл: ${formatAmount(entry.balanceAfter ?? 0)} кредит.`,
          entityLabel: pkg.trackingNumber,
        });
      }
    }

    return written;
  }

  /**
   * Ledger-т бичээд кэшийг атомикоор шинэчилнэ. Дараалал чухал: ledger
   * ЭХЛЭЭД — `seq` давхардвал (зэрэг reconcile) кэш хөндөгдөөгүй байхад
   * алдаа шидэгдэнэ. Хоёрын хооронд тасарвал кэш дутуу үлдэх ба
   * `recomputeBalance` (скрипт) ledger-ээс засна — эсрэг дараалал бол ledger-т
   * ул мөргүй кредит үүсгэх эрсдэлтэй.
   */
  async appendEntry(data) {
    const entry = await loyaltyRepository.createEntry(data);
    const customer = await loyaltyRepository.incrementBalance(data.customerId, data.amount);
    const balanceAfter = customer?.loyaltyPoints ?? null;
    await loyaltyRepository.setBalanceAfter(entry._id, balanceAfter);
    entry.balanceAfter = balanceAfter;
    return entry;
  }

  // ── Зарцуулалт (BR-48) — `payment.service.js#applyCredit`-ээс л дуудагдана ─

  /**
   * Кредитийг атомикоор хасаж `redeem` бичлэг үүсгэнэ. Кэш дээрх нөхцөлт
   * `$inc` нь зэрэг хоёр хүсэлтээс хамгаална (`debitBalance`).
   */
  async debit({ customerId, amount, paymentId, label, actor = null, actorName = null }) {
    const customer = await loyaltyRepository.debitBalance(customerId, amount);
    if (!customer) {
      throw new APIError(
        'Кредит хүрэлцэхгүй байна — өөр төлбөр зэрэг хийгдсэн байж магадгүй',
        httpStatus.UNPROCESSABLE_ENTITY,
        { code: ERROR_CODE.INSUFFICIENT_CREDIT }
      );
    }

    try {
      return await loyaltyRepository.createEntry({
        customerId,
        type: LOYALTY_TX_TYPE.REDEEM,
        amount: -amount,
        paymentId,
        label,
        balanceAfter: customer.loyaltyPoints,
        actorId: actor?._id ?? null,
        actorName: actor ? auditService.describeActor(actor) : actorName,
      });
    } catch (err) {
      await loyaltyRepository.incrementBalance(customerId, amount);
      throw err;
    }
  }

  /**
   * `debit` амжилттай болсны ДАРАА төлбөр бүртгэгдэж чадаагүй үеийн нөхөн
   * арилгалт (rollback байхгүй — архитектур §9 #2). Тэр `redeem` бичлэг
   * бодит хөдөлгөөн болж амжаагүй тул устгана (харилцагчийн түүхэнд
   * "−500, +500" гэсэн ойлгомжгүй мөр үлдээхгүй).
   */
  async cancelDebit(entry) {
    await loyaltyRepository.removeById(entry._id);
    await loyaltyRepository.incrementBalance(entry.customerId, -entry.amount);
  }

  /**
   * Кредитийн төлбөр хүчингүй болсон (BR-18) → кредит буцна. `{paymentId,
   * type}` unique тул давтан дуудсан ч НЭГ л удаа буцаана.
   */
  async refundRedemption(payment, actor = null) {
    const existing = await loyaltyRepository.findByPayment(
      payment._id,
      LOYALTY_TX_TYPE.REDEEM_REFUND
    );
    if (existing) return existing;

    const redeem = await loyaltyRepository.findByPayment(payment._id, LOYALTY_TX_TYPE.REDEEM);
    const amount = redeem ? -redeem.amount : payment.amount;

    try {
      return await this.appendEntry({
        customerId: payment.customerId,
        type: LOYALTY_TX_TYPE.REDEEM_REFUND,
        amount,
        paymentId: payment._id,
        label: redeem?.label ?? null,
        actorId: actor?._id ?? null,
        actorName: actor ? auditService.describeActor(actor) : null,
      });
    } catch (err) {
      if (err?.code === 11000) {
        return loyaltyRepository.findByPayment(payment._id, LOYALTY_TX_TYPE.REDEEM_REFUND);
      }
      throw err;
    }
  }

  // ── Гараар засвар (BR-33) — `customer.service.js#adjustLoyalty` ─────────

  /** Үлдэгдлийг `targetBalance` болгох зөрүүг `adjust` бичлэгээр бичнэ */
  async adjustBalance(customer, targetBalance, reason, actor) {
    const delta = targetBalance - (customer.loyaltyPoints ?? 0);
    if (delta === 0) return null;
    return this.appendEntry({
      customerId: customer._id,
      type: LOYALTY_TX_TYPE.ADJUST,
      amount: delta,
      reason,
      actorId: actor?._id ?? null,
      actorName: auditService.describeActor(actor),
    });
  }

  async setManualTier(customer, tier) {
    await customerRepository.updateByIdWithSession(customer._id, { loyaltyTierManual: tier });
    customer.loyaltyTierManual = tier;
    return this.refreshTier(customer);
  }

  /**
   * Кэшийг ledger-ээс дахин бодно (BR-14-ийн зарчим). `scripts/loyalty-
   * reconcile.js` дуудна — тасарсан бичилтийн дараах засвар.
   */
  async recomputeBalance(customerId) {
    const { balance } = await loyaltyRepository.totalsForCustomer(customerId);
    await loyaltyRepository.setBalance(customerId, balance);
    return balance;
  }

  // ── Харилцагчийн харагдац (§4, дүрэм 14 — цагаан жагсаалт) ─────────────

  /** Урамшууллын хуудасны бүх өгөгдөл — нэг хүсэлтээр */
  async getForCustomer(customer) {
    const program = await this.getProgram();
    const fresh = (await customerRepository.findById(customer._id)) ?? customer;
    const s = await this.refreshTier(fresh, program);

    const [last, totals] = await Promise.all([
      loyaltyRepository.latestForCustomer(fresh._id),
      loyaltyRepository.totalsForCustomer(fresh._id),
    ]);

    const t = totals.byType;
    return {
      enabled: program.enabled,
      credits: fresh.loyaltyPoints ?? 0,
      lastTransaction: last ? this.toPublicTransaction(last) : null,
      tier: publicTier(s.tier),
      nextTier: s.next ? publicTier(s.next) : null,
      manualTier: Boolean(fresh.loyaltyTierManual),
      spent: s.spent,
      remainingToNext: s.remaining,
      progressBps: s.progressBps,
      // "Дахиад ≈ N ачаа" — харилцагчийн өөрийн дундаж ачааны дүнгээр
      averagePackageValue: s.packageCount ? Math.round(s.spent / s.packageCount) : null,
      windowDays: program.windowDays,
      maxRedeemPercent: program.maxRedeemPercent,
      tiers: program.tiers.map(publicTier),
      totals: {
        earned: (t[LOYALTY_TX_TYPE.EARN] ?? 0) + (t[LOYALTY_TX_TYPE.EARN_REVERSAL] ?? 0),
        redeemed: -((t[LOYALTY_TX_TYPE.REDEEM] ?? 0) + (t[LOYALTY_TX_TYPE.REDEEM_REFUND] ?? 0)),
      },
    };
  }

  /**
   * Header/самбарын жижиг "4 500 · +350" тэмдэг. Хуудас солигдох бүрт
   * дуудагддаг тул зарцуулалтын aggregate ХИЙХГҮЙ — түвшинг кэшээс уншина.
   */
  async getBalance(customer) {
    const program = await this.getProgram();
    const [fresh, last] = await Promise.all([
      customerRepository.findById(customer._id),
      loyaltyRepository.latestForCustomer(customer._id),
    ]);
    const tier = program.tiers.find(t => t.code === fresh?.loyaltyTier) ?? program.tiers[0];

    return {
      enabled: program.enabled,
      credits: fresh?.loyaltyPoints ?? 0,
      tier: publicTier(tier),
      lastTransaction: last ? this.toPublicTransaction(last) : null,
      maxRedeemPercent: program.maxRedeemPercent,
    };
  }

  async listForCustomer(customerId, { page, limit }) {
    const result = await loyaltyRepository.listForCustomer(customerId, { page, limit });
    return {
      data: result.docs.map(e => this.toPublicTransaction(e)),
      pagination: {
        page: result.page,
        pages: result.totalPages,
        total: result.totalDocs,
        limit: result.limit,
      },
    };
  }

  /**
   * Харилцагчид харагдах ledger мөр. `reason` (Админы дотоод тайлбар),
   * `actorName`, `paymentId`, `rateBps`-ийн түүхий утга ГАРАХГҮЙ — хувийг
   * харуулах шаардлагатай бол `tier`-ээр.
   */
  toPublicTransaction(e) {
    return {
      id: e._id,
      type: e.type,
      amount: e.amount,
      balanceAfter: e.balanceAfter,
      label: e.type === LOYALTY_TX_TYPE.ADJUST ? null : e.label,
      tier: e.tier,
      baseAmount: e.type === LOYALTY_TX_TYPE.EARN ? e.baseAmount : null,
      createdAt: e.createdAt,
    };
  }

  // ── Ажилтны харагдац ────────────────────────────────────────────────────

  /** Харилцагчийн карт / төлбөр авах модал — ажилтан кредитийг харна */
  async getForStaff(customerId, { page = 1, limit = 20 } = {}) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw new APIError('Харилцагч олдсонгүй', httpStatus.NOT_FOUND);
    }
    const program = await this.getProgram();
    const [s, history] = await Promise.all([
      this.standing(customer, program),
      loyaltyRepository.listForCustomer(customer._id, { page, limit }),
    ]);

    return {
      enabled: program.enabled,
      credits: customer.loyaltyPoints ?? 0,
      tier: publicTier(s.tier),
      nextTier: s.next ? publicTier(s.next) : null,
      manualTier: customer.loyaltyTierManual,
      spent: s.spent,
      remainingToNext: s.remaining,
      maxRedeemPercent: program.maxRedeemPercent,
      history: {
        data: history.docs.map(e => ({
          ...this.toPublicTransaction(e),
          reason: e.reason,
          actorName: e.actorName,
          paymentId: e.paymentId,
        })),
        pagination: {
          page: history.page,
          pages: history.totalPages,
          total: history.totalDocs,
          limit: history.limit,
        },
      },
    };
  }

  /** Админы хөтөлбөрийн самбар: эргэлтэд буй кредит, энэ сарын олголт/зарцуулалт */
  async programStats() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [program, all, month] = await Promise.all([
      this.getProgram(),
      loyaltyRepository.programTotals(),
      loyaltyRepository.programTotals({ from: monthStart }),
    ]);

    const summarize = totals => ({
      earned:
        (totals.byType[LOYALTY_TX_TYPE.EARN]?.total ?? 0) +
        (totals.byType[LOYALTY_TX_TYPE.EARN_REVERSAL]?.total ?? 0),
      redeemed: -(
        (totals.byType[LOYALTY_TX_TYPE.REDEEM]?.total ?? 0) +
        (totals.byType[LOYALTY_TX_TYPE.REDEEM_REFUND]?.total ?? 0)
      ),
      redemptions: totals.byType[LOYALTY_TX_TYPE.REDEEM]?.count ?? 0,
    });

    return {
      program,
      outstanding: all.outstanding,
      holders: all.holders,
      allTime: summarize(all),
      thisMonth: summarize(month),
    };
  }

  /** BR-33 — audit-д бичих туслах (customer.service-ээс) */
  async recordAdjustAudit({ customer, changes, reason, actor, req }) {
    await auditService.recordChanges(
      {
        actor,
        action: AUDIT_ACTION.CUSTOMER_LOYALTY_ADJUST,
        entity: AUDIT_ENTITY.CUSTOMER,
        entityId: customer._id,
        entityLabel: customer.phone,
        reason,
        req,
      },
      changes
    );
  }
}

function publicTier(t) {
  return { code: t.code, name: t.name, minSpent: t.minSpent, rateBps: t.rateBps };
}

function formatRate(rateBps) {
  return `${(rateBps / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

function formatAmount(value) {
  return Number(value).toLocaleString('en-US');
}

module.exports = new LoyaltyService();
