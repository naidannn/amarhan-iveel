'use strict';

/**
 * Хуучин системийн ачааны өгөгдлийг импортлох — roadmap Phase 9 / M5.
 *
 * Хоёр эх сурвалж:
 *   --completed <path>  JSON массив, олгогдож дууссан (түүхэн) ачаа
 *                        (талбарууд: ilg_id, barcode, ognoo, utas, price,
 *                        hemjee, olgoson, olgson_dte, hursongson, note, ...)
 *   --ub <path>          XLSX, одоо Улаанбаатарын агуулахад байгаа (олгогдоогүй)
 *                        ачаа ("data" sheet, ижил үндсэн талбарууд + taviur/tavnme/tailbar)
 *
 * ДАХИН АЖИЛЛУУЛАХАД АЮУЛГҮЙ (идемпотент): бичлэг бүрийг `legacySourceId`
 * (`completed:<ilg_id>` / `ub:<ilg_id>`) -ээр тэмдэглэж, аль хэдийн орсныг
 * алгасна. Тиймээс энэ скриптийг dev дээр sample/бүтэн ажиллуулаад, ижил
 * файл (эсвэл шинэчилсэн экспорт)-аар production дээр ДАХИН ажиллуулж болно.
 *
 * Хэрэглээ:
 *   npm run import:legacy -- --dry-run --limit 200
 *   npm run import:legacy -- --limit 200            # 200-ыг бодитоор бичнэ
 *   npm run import:legacy                            # бүгдийг бичнэ
 *   npm run import:legacy -- --skip-ub                # зөвхөн completed.json
 *   npm run import:legacy -- --branch UB
 *
 * ШИЙДВЭРҮҮД (2026-08-02, эзэмшигчтэй тохирсон):
 *   - Мөнгө: бүрэн төлөгдсөн (completed.json) ачаа бүрт ЖИНХЭНЭ `Payment`
 *     бичлэг үүсгэнэ (BR-14/дүрэм 10 — `packages.paidAmount` cache нь
 *     үргэлж `payments`-ээс гарна). Гэхдээ Audit Log-д ЭДГЭЭР төлбөрийг
 *     БИЧИХГҮЙ (эзэмшигчийн шийдвэр — 60k түүхэн бичлэгээр audit дүүргэхгүй).
 *   - Харилцагч: хүчинтэй (8 орон, 5–9-ээр эхэлсэн) утастай бичлэгт л
 *     `customerService.findOrCreateByPhone` дуудаж холбоно (энгийн урсгалтай
 *     адил, CUSTOMER_CREATE audit бичигдэнэ — тоо цөөн ~900). Хүчингүй/
 *     тодорхойгүй утастай ачаа `customerId: null`-ээр орно (BR-45 зарчим:
 *     ачаа харилцагчгүй байж болно) — Payment ч үүсэхгүй тул `note`-д
 *     тэмдэглэгдэнэ.
 *   - Жин/эзлэхүүн: эх сурвалжид бүтэцтэй утга байхгүй (`note`-д чөлөөт
 *     бичвэрээр л заримдаа орсон) тул `weightKg`/`volumeM3` = `null`,
 *     `priceSource: 'manual'`, `pricingSnapshot: null` (дүрэм 12 — хуурамч
 *     snapshot хадгалахгүй). Анхны `note`-ийг хадгална.
 *   - Байршил: `taviur`/`tavnme` хуучин тавиурын дугаар нь шинэ байршлын
 *     кодтой (`UB-02-B-15`) ЯГ ТААРАХГҮЙ тул `locationId` оноохгүй (хуурамч
 *     эзэмшил үүсгэхгүй) — тавиурын нэрийг `note`-д хадгална.
 *
 * Утга:
 *   --completed <path>  (өгөгдмөл: ../../data/completed.json)
 *   --ub <path>          (өгөгдмөл: ../../data/ub.xlsx)
 *   --branch <код>       (өгөгдмөл: цорын ганц идэвхтэй салбар)
 *   --limit <n>           эх сурвалж БҮРЭЭС хамгийн ихдээ N бичлэг боловсруулна (sample-д)
 *   --batch-size <n>      (өгөгдмөл 1000)
 *   --skip-completed
 *   --skip-ub
 *   --dry-run             DB-д юу ч бичихгүй, зөвхөн тайлан хэвлэнэ
 */

require('dotenv').config();

process.env.PORT = process.env.PORT || '4000';
process.env.APP_SECRET = process.env.APP_SECRET || 'import-legacy-script';

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const XLSX = require('xlsx');

const config = require('../src/config');
const Branch = require('../src/models/branch.model');
const Package = require('../src/models/package.model');
const Payment = require('../src/models/payment.model');
const Customer = require('../src/models/customer.model');
const customerService = require('../src/services/customer.service');
const { normalizeTrackingNumber, isValidTrackingNumber } = require('../src/domain/tracking-number');
const { isValidPhone, normalizePhone } = require('../src/domain/phone');
const {
  PACKAGE_STATUS,
  PRICE_SOURCE,
  PAYMENT_STATUS,
  PAYMENT_METHOD,
  PAYMENT_RECORD_STATUS,
  REGISTRATION_SOURCE,
} = require('../src/config/constants');

// ── argv ──────────────────────────────────────────────────────────────────

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const val = process.argv[idx + 1];
  return val === undefined || val.startsWith('--') ? true : val;
}

const OPTS = {
  completedPath: path.resolve(__dirname, arg('completed', '../../data/completed.json')),
  ubPath: path.resolve(__dirname, arg('ub', '../../data/ub.xlsx')),
  branchCode: arg('branch', null),
  limit: arg('limit') ? Number(arg('limit')) : null,
  batchSize: arg('batch-size') ? Number(arg('batch-size')) : 1000,
  skipCompleted: Boolean(arg('skip-completed', false)),
  skipUb: Boolean(arg('skip-ub', false)),
  dryRun: Boolean(arg('dry-run', false)),
};

// ── тусламж функцууд ─────────────────────────────────────────────────────

/** hemjee талбарт гарсан бохир өгөгдлийг (жишээ: 9807250000000) шүүнэ */
function deriveQuantity(rawHemjee) {
  const n = Math.round(Number(rawHemjee));
  if (Number.isInteger(n) && n >= 1 && n <= 9999) return n;
  return 1;
}

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

class ImportStats {
  constructor(label) {
    this.label = label;
    this.total = 0;
    this.imported = 0;
    this.alreadyImported = 0;
    this.skipped = 0;
    this.skipReasons = {};
    this.paymentsCreated = 0;
    this.noCustomerCount = 0;
  }

  skip(reason) {
    this.skipped += 1;
    this.skipReasons[reason] = (this.skipReasons[reason] || 0) + 1;
  }

  print() {
    console.log(`\n── ${this.label} ──`);
    console.log(`  Нийт мөр:        ${this.total}`);
    console.log(`  Импортлогдсон:    ${this.imported}`);
    console.log(`  Аль хэдийн орсон: ${this.alreadyImported}`);
    console.log(`  Алгассан:         ${this.skipped}`);
    for (const [reason, count] of Object.entries(this.skipReasons)) {
      console.log(`    - ${reason}: ${count}`);
    }
    console.log(`  Үүссэн Payment:   ${this.paymentsCreated}`);
    console.log(`  Харилцагчгүй:     ${this.noCustomerCount}`);
  }
}

/**
 * Утсыг нормчилж харилцагч олно/үүсгэнэ. Хүчингүй/тодорхойгүй утаснуудад
 * (00000000, 3–4 оронтой, 1/2/3/4-өөр эхэлсэн гэх мэт) `null` буцаана —
 * BR-45 зарчмаар ачаа харилцагчгүй үлдэж болно, хуурамч утас зохиохгүй.
 *
 * `--dry-run` үед ЖИНХЭНЭ харилцагч үүсгэхгүй (зөвхөн унших) — тайлан
 * зөвхөн тооцоолол хийнэ, DB-д ямар ч бичилт хийхгүй.
 */
async function resolveCustomer(rawPhone, cache) {
  if (!rawPhone || !isValidPhone(rawPhone)) return null;
  const normalized = normalizePhone(rawPhone);
  if (cache.has(normalized)) return cache.get(normalized);

  let customer;
  if (OPTS.dryRun) {
    customer = await Customer.findOne({ phone: normalized }).lean();
    if (!customer) {
      customer = { _id: new mongoose.Types.ObjectId(), phone: normalized };
    }
  } else {
    ({ customer } = await customerService.findOrCreateByPhone(
      normalized,
      {},
      { actor: null, req: null }
    ));
  }
  cache.set(normalized, customer);
  return customer;
}

// ── эх сурвалж бүрийн normalizer ────────────────────────────────────────

/**
 * completed.json-ий нэг мөрийг Package/Payment draft болгоно.
 * @returns {{ok:true, legacySourceId, trackingNumber, arrivedAt, finishedAt,
 *             finalStatus, price, quantity, phone, note, receivedByName}
 *           | {ok:false, reason}}
 */
function normalizeCompletedRecord(d) {
  if (!isValidTrackingNumber(d.barcode)) {
    return { ok: false, reason: 'буруу форматтай дугаар' };
  }
  const arrivedAt = toDate(d.ognoo);
  if (!arrivedAt) return { ok: false, reason: 'огноо parse хийгдсэнгүй (ognoo)' };
  const finishedAt = toDate(d.olgson_dte) || arrivedAt;

  const price = Math.round(Number(d.price));
  if (!Number.isInteger(price) || price < 0) {
    return { ok: false, reason: 'буруу үнэ' };
  }

  return {
    ok: true,
    legacySourceId: `completed:${d.ilg_id}`,
    trackingNumber: normalizeTrackingNumber(d.barcode),
    arrivedAt,
    finishedAt,
    finalStatus: d.hursongson ? PACKAGE_STATUS.DELIVERED : PACKAGE_STATUS.PICKED_UP,
    price,
    quantity: deriveQuantity(d.hemjee),
    phone: d.utas,
    note: d.note ? String(d.note).trim().slice(0, 1000) : null,
    receivedByName: d.olgsonuser || d.ner || null,
  };
}

/** ub.xlsx-ийн нэг мөрийг normalizer */
function normalizeUbRecord(r) {
  if (!isValidTrackingNumber(r.barcode)) {
    return { ok: false, reason: 'буруу форматтай дугаар' };
  }
  const arrivedAt = toDate(r.ognoo);
  if (!arrivedAt) return { ok: false, reason: 'огноо parse хийгдсэнгүй (ognoo)' };

  const price = Math.round(Number(r.price));
  if (!Number.isInteger(price) || price < 0) {
    return { ok: false, reason: 'буруу үнэ' };
  }

  const shelfNote = [r.tavnme, r.tailbar].filter(Boolean).join(' — ');

  return {
    ok: true,
    legacySourceId: `ub:${r.ilg_id}`,
    trackingNumber: normalizeTrackingNumber(r.barcode),
    arrivedAt,
    finishedAt: null,
    finalStatus: PACKAGE_STATUS.REGISTERED,
    price,
    quantity: deriveQuantity(r.hemjee),
    phone: r.utas,
    note: shelfNote ? `[Хуучин таviur] ${shelfNote}`.slice(0, 1000) : null,
    receivedByName: null,
  };
}

// ── гол урсгал ────────────────────────────────────────────────────────────

async function processSource({ label, records, isCompleted, branch, existingIds, stats, cache }) {
  const limited = OPTS.limit ? records.slice(0, OPTS.limit) : records;
  stats.total = limited.length;

  for (let i = 0; i < limited.length; i += OPTS.batchSize) {
    const chunk = limited.slice(i, i + OPTS.batchSize);
    const packageDocs = [];
    const paymentDrafts = []; // { packageId, amount, customer, note, createdAt, receivedByName }

    for (const raw of chunk) {
      const norm = isCompleted ? normalizeCompletedRecord(raw) : normalizeUbRecord(raw);
      if (!norm.ok) {
        stats.skip(norm.reason);
        continue;
      }
      if (existingIds.has(norm.legacySourceId)) {
        stats.alreadyImported += 1;
        continue;
      }

      const customer = await resolveCustomer(norm.phone, cache);
      const hasCustomer = Boolean(customer);
      if (!hasCustomer) stats.noCustomerCount += 1;

      let paidAmount = 0;
      let paymentStatus = PAYMENT_STATUS.UNPAID;
      let willCreatePayment = false;

      if (isCompleted) {
        if (norm.price === 0) {
          paymentStatus = PAYMENT_STATUS.PAID; // төлөх зүйлгүй тул трилиал "төлөгдсөн"
        } else if (hasCustomer) {
          paidAmount = norm.price;
          paymentStatus = PAYMENT_STATUS.PAID;
          willCreatePayment = true;
        }
        // харилцагчгүй бол paidAmount=0/balance=price хэвээр (§дэлгэрэнгүйг тайланд)
      }
      // ub.xlsx: олгогдоогүй тул үргэлж unpaid, Payment үүсгэхгүй

      const _id = new mongoose.Types.ObjectId();
      const balance = norm.price - paidAmount;

      const noteParts = [norm.note];
      if (norm.phone && !hasCustomer && !(isCompleted && norm.price === 0)) {
        noteParts.push(`[Хуучин утас холбогдоогүй: ${norm.phone}]`);
      }
      const note = noteParts.filter(Boolean).join(' ').slice(0, 1000) || null;

      packageDocs.push({
        _id,
        trackingNumber: norm.trackingNumber,
        customerId: hasCustomer ? customer._id : null,
        customerPhone: hasCustomer ? customer.phone : null,
        branchId: branch._id,
        branchCode: branch.code,
        cargoTypeId: null,
        quantity: norm.quantity,
        weightKg: null,
        volumeM3: null,
        dimensions: null,
        pricingSnapshot: null,
        computedPrice: norm.price,
        priceSource: PRICE_SOURCE.MANUAL,
        finalPrice: norm.price,
        priceOverridden: false,
        priceOverrideReason: null,
        paidAmount,
        balance,
        paymentStatus,
        status: norm.finalStatus,
        statusHistory: [
          {
            from: null,
            to: PACKAGE_STATUS.REGISTERED,
            at: norm.arrivedAt,
            by: null,
            byName: 'Хуучин систем',
            reason: 'Хуучин системээс шилжүүлсэн',
          },
          ...(norm.finalStatus !== PACKAGE_STATUS.REGISTERED
            ? [
                {
                  from: PACKAGE_STATUS.REGISTERED,
                  to: norm.finalStatus,
                  at: norm.finishedAt || norm.arrivedAt,
                  by: null,
                  byName: norm.receivedByName || 'Хуучин систем',
                  reason: null,
                },
              ]
            : []),
        ],
        locationId: null,
        locationCode: null,
        arrivedAt: norm.arrivedAt,
        note,
        registeredBy: null,
        registrationSource: REGISTRATION_SOURCE.STAFF,
        customerNote: null,
        isDuplicateApproved: false,
        activeTrackingNumber: isCompleted ? null : norm.trackingNumber,
        cancelledAt: null,
        cancelReason: null,
        legacySourceId: norm.legacySourceId,
        createdAt: norm.arrivedAt,
        updatedAt: norm.finishedAt || norm.arrivedAt,
      });

      if (willCreatePayment) {
        paymentDrafts.push({
          packageId: _id,
          amount: norm.price,
          customer,
          note: `Хуучин систем import (${norm.legacySourceId})`,
          createdAt: norm.finishedAt || norm.arrivedAt,
          receivedByName: norm.receivedByName,
        });
      }
    }

    if (packageDocs.length === 0) continue;

    if (OPTS.dryRun) {
      stats.imported += packageDocs.length;
      stats.paymentsCreated += paymentDrafts.length;
      continue;
    }

    const insertedIds = await bulkInsert(Package, packageDocs, `${label} — ачаа`);
    stats.imported += insertedIds.size;

    const paymentDocs = paymentDrafts
      .filter(p => insertedIds.has(p.packageId.toString()))
      .map(p => ({
        _id: new mongoose.Types.ObjectId(),
        amount: p.amount,
        method: PAYMENT_METHOD.CASH, // эх сурвалж хэлбэрийг мэдэгддэггүй — бэлнээр төлөгдсөн гэж үзсэн
        invoiceId: null,
        customerId: p.customer._id,
        customerPhone: p.customer.phone,
        allocations: [{ packageId: p.packageId, amount: p.amount }],
        status: PAYMENT_RECORD_STATUS.COMPLETED,
        branchId: branch._id,
        receivedBy: null,
        receivedByName: p.receivedByName,
        provider: null,
        providerInvoiceId: null,
        providerPaymentId: null,
        note: p.note,
        createdAt: p.createdAt,
        updatedAt: p.createdAt,
      }));

    if (paymentDocs.length > 0) {
      const insertedPayments = await bulkInsert(Payment, paymentDocs, `${label} — төлбөр`);
      stats.paymentsCreated += insertedPayments.size;
    }

    console.log(`  ... ${label}: ${stats.imported}/${stats.total} бичигдлээ`);
  }
}

/** ordered:false insertMany — хэсэгчилсэн алдааг тайлагнаад амжилттай орсныг буцаана */
async function bulkInsert(Model, docs, label) {
  try {
    await Model.insertMany(docs, { ordered: false });
    return new Set(docs.map(d => d._id.toString()));
  } catch (err) {
    const writeErrors = err.writeErrors || [];
    const failedIndexes = new Set(writeErrors.map(e => e.index));
    console.warn(`  ⚠ ${label}: ${writeErrors.length || docs.length} бичлэг бичигдсэнгүй`);
    if (writeErrors.length === 0) {
      console.warn(`    - ${err.message}`);
    }
    writeErrors.slice(0, 5).forEach(e => {
      console.warn(`    - [${e.index}] ${e.errmsg || e.err?.errmsg}`);
    });
    // writeErrors хоосон = MongoDB хүрэхээс өмнөх бүхэл бүтэн алдаа (жишээ:
    // validation) — тухайн үед БҮГД бичигдээгүй гэж үзнэ.
    if (writeErrors.length === 0) return new Set();
    return new Set(docs.filter((_, idx) => !failedIndexes.has(idx)).map(d => d._id.toString()));
  }
}

async function loadCompleted() {
  if (!fs.existsSync(OPTS.completedPath)) {
    throw new Error(`completed.json олдсонгүй: ${OPTS.completedPath}`);
  }
  return JSON.parse(fs.readFileSync(OPTS.completedPath, 'utf-8'));
}

function loadUb() {
  if (!fs.existsSync(OPTS.ubPath)) {
    throw new Error(`ub.xlsx олдсонгүй: ${OPTS.ubPath}`);
  }
  const wb = XLSX.readFile(OPTS.ubPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: null });
}

async function main() {
  console.log('Хуучин системийн ачааны өгөгдөл импортлож эхэллээ');
  console.log(OPTS.dryRun ? '(--dry-run — DB-д бичихгүй)' : '');
  if (OPTS.limit) console.log(`Эх сурвалж бүрээс дээд тал нь ${OPTS.limit} бичлэг`);

  await mongoose.connect(config.mongo.uri);
  console.log('MongoDB-д холбогдлоо');

  const branch = OPTS.branchCode
    ? await Branch.findOne({ code: OPTS.branchCode.toUpperCase() })
    : await (async () => {
        const active = await Branch.find({ isActive: true });
        if (active.length === 1) return active[0];
        if (active.length === 0) return null;
        throw new Error('Салбар олон байна — --branch <код> заана уу');
      })();

  if (!branch) {
    throw new Error('Салбар олдсонгүй — эхлээд npm run seed:reference ажиллуулна уу');
  }
  console.log(`Салбар: ${branch.code} — ${branch.name}`);

  const existingIds = new Set(
    (
      await Package.find({ legacySourceId: { $ne: null } })
        .select('legacySourceId')
        .lean()
    ).map(d => d.legacySourceId)
  );
  console.log(`Аль хэдийн импортлогдсон бичлэг: ${existingIds.size}`);

  const phoneCache = new Map();

  if (!OPTS.skipCompleted) {
    const stats = new ImportStats('completed.json (дууссан ачаа)');
    const records = await loadCompleted();
    await processSource({
      label: 'completed',
      records,
      isCompleted: true,
      branch,
      existingIds,
      stats,
      cache: phoneCache,
    });
    stats.print();
  }

  if (!OPTS.skipUb) {
    const stats = new ImportStats('ub.xlsx (агуулахад байгаа ачаа)');
    const records = loadUb();
    await processSource({
      label: 'ub',
      records,
      isCompleted: false,
      branch,
      existingIds,
      stats,
      cache: phoneCache,
    });
    stats.print();
  }

  console.log(`\nҮүссэн/олдсон харилцагч: ${phoneCache.size}`);
  console.log(OPTS.dryRun ? '\n--dry-run дууслаа — өөрчлөлт хийгдээгүй' : '\nИмпорт дууслаа');

  await mongoose.connection.close();
  process.exit(0);
}

main().catch(err => {
  console.error('\nИмпорт амжилтгүй боллоо:', err.message);
  console.error(err.stack);
  process.exit(1);
});
