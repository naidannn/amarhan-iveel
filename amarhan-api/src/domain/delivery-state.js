'use strict';

const { DELIVERY_STATUS, PACKAGE_STATUS } = require('../config/constants');

/**
 * Хүргэлтийн төлөвийн машин — introduction.md §5.1, BR-19…BR-21
 *
 * ЯАГААД ТУСДАА ДОМЭЙН ФАЙЛ (`package-state.js`-ийн ижил шалтгаан): хүргэлт
 * гаргах шийдвэр нь МӨНГӨТЭЙ шууд холбоотой. `created → dispatched` шилжилт
 * төлбөрийн хаалтыг (§5.2) тойрч гарвал компани төлбөргүй ачаа гаргана —
 * буцаах боломж нь тээвэр, цаг, харилцагчийн итгэл.
 *
 * Тиймээс дүрмийг DB-ээс, HTTP-ээс, эрхээс ЦЭВЭР салгаж, ганц газарт
 * тодорхойлж, 100% тестээр хучна (docs/testing.md §1).
 *
 * Кодын өөр хаана ч `delivery.status = ...` шууд оноохыг хориглоно —
 * зөвхөн `deliveryService.changeStatus()` дамжина.
 */

const D = DELIVERY_STATUS;

/**
 * Зөвшөөрөгдсөн шилжилтүүд (BR-21).
 *
 * Хоосон массив = ТӨГСГӨЛИЙН төлөв.
 *
 *   created → dispatched → delivered
 *      ↓            ↘ returned → dispatched
 *   cancelled
 *
 * ЯАГААД `returned → dispatched` БАЙДАГ: хаяг олдоогүй, харилцагч утсаа
 * авахгүй байсан ачаа маргааш дахин гарна. Шинэ хүргэлт үүсгэхийг шаардвал
 * ижил ачааны түүх хоёр баримтад тарж, "хэдэн удаа оролдсон" гэдгийг
 * хэмжих боломжгүй болно.
 *
 * ЯАГААД `returned`-ААС `cancelled` РҮҮ ЗАМ БАЙХГҮЙ: `returned` нь ажлын
 * бодит үр дүн (ачаа агуулахад буцаж ирсэн) — түүнийг "болоогүй" гэж
 * дарах нь түүхийг гажуудуулна. Харилцагч салбараас авахаар шийдвэл ачааг
 * `returned → picked_up` болгоно (BR-07), хүргэлт `returned` хэвээр үлдэнэ.
 * Ачаа тэр үед идэвхтэй хүргэлтэд тооцогдохоо больсон тул юу ч түгжихгүй.
 */
const TRANSITIONS = Object.freeze({
  [D.CREATED]: [D.DISPATCHED, D.CANCELLED],
  [D.DISPATCHED]: [D.DELIVERED, D.RETURNED],
  [D.RETURNED]: [D.DISPATCHED],
  [D.DELIVERED]: [],
  [D.CANCELLED]: [],
});

/**
 * Хэрэглэгчид харагдах монгол нэр (§5.1).
 * Frontend өөрийн хуулбартай — `design-tokens.js` (`deliveryStatus`).
 */
const STATUS_LABEL = Object.freeze({
  [D.CREATED]: 'Хүргэлт үүссэн',
  [D.DISPATCHED]: 'Хүргэлтэнд гарсан',
  [D.DELIVERED]: 'Амжилттай хүргэгдсэн',
  [D.RETURNED]: 'Буцаагдсан',
  [D.CANCELLED]: 'Цуцлагдсан',
});

/**
 * Хүргэлт "идэвхтэй" төлөвүүд — BR-20a.
 *
 * Ачаа НЭГЭЭС ИЛҮҮ идэвхтэй хүргэлтэд орохыг хориглоно: хоёр жолооч нэг
 * ачааг хайж явах, эсвэл нэг нь гаргачихсан байхад нөгөө нь "алга болсон"
 * гэж бүртгэх нөхцөл үүснэ.
 *
 * `returned` нь идэвхтэй БИШ — ачаа агуулахад буцаж ирсэн тул шинэ
 * хүргэлтэд орох боломжтой байх ёстой.
 */
const ACTIVE_STATUSES = Object.freeze([D.CREATED, D.DISPATCHED]);

/**
 * Хүргэлтийн төлөв бүр АЧААНЫ аль төлөвийг чирч дагуулах вэ (§1.5 ↔ §5.1).
 *
 * Хоёр төлөвийн машиныг ХОЛБОХ цорын ганц газар. Хүргэлт гарахад ачаа
 * бүр `out_for_delivery` болно, хүргэгдэхэд `delivered`, буцахад `returned`.
 *
 * `created` ба `cancelled` нь `null`: хүргэлт үүсгэх нь ачааг агуулахаас
 * хөдөлгөхгүй — жолооч гартаа аваагүй байхад ачаа `out_for_delivery` болвол
 * агуулахын нүд буруу чөлөөлөгдөнө (BR-09a).
 */
const PACKAGE_EFFECT = Object.freeze({
  [D.CREATED]: null,
  [D.DISPATCHED]: PACKAGE_STATUS.OUT_FOR_DELIVERY,
  [D.DELIVERED]: PACKAGE_STATUS.DELIVERED,
  [D.RETURNED]: PACKAGE_STATUS.RETURNED,
  [D.CANCELLED]: null,
});

/**
 * Бүх ачааны төлбөр бүрэн байхыг шаардах төлөвүүд — BR-20, §5.2.
 *
 * ЗӨВХӨН `dispatched`. Хүргэлт ҮҮСГЭХ нь хориотой биш: ажилтан маргаашийн
 * маршрутыг урьдчилан бэлдэж, харилцагч гарахын өмнө төлдөг нь хэвийн урсгал.
 */
const REQUIRES_FULL_PAYMENT = Object.freeze([D.DISPATCHED]);

class DeliveryTransitionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DeliveryTransitionError';
  }
}

function label(status) {
  return STATUS_LABEL[status] ?? status;
}

function isKnownStatus(status) {
  return Object.prototype.hasOwnProperty.call(TRANSITIONS, status);
}

function allowedTransitions(from) {
  return TRANSITIONS[from] ? [...TRANSITIONS[from]] : [];
}

function canTransition(from, to) {
  return allowedTransitions(from).includes(to);
}

/**
 * АЖИЛТАН ГАРААР дарж болох шилжилтүүд — UI-д товч харуулахад ЭНЭ функц.
 *
 * `cancelled` ОРОХГҮЙ: цуцлах нь эрх (Менежер/Админ) ба шалтгаан шаарддаг
 * тусдаа урсгал, тусдаа товчоор гарна (`package-state.manualTransitions`-ийн
 * ижил зарчим).
 */
function manualTransitions(from) {
  return allowedTransitions(from).filter(to => to !== D.CANCELLED);
}

function isTerminal(status) {
  return isKnownStatus(status) && TRANSITIONS[status].length === 0;
}

function isActive(status) {
  return ACTIVE_STATUSES.includes(status);
}

function isCancellable(status) {
  return canTransition(status, D.CANCELLED);
}

/**
 * Хүргэлтийн төлөв ачааг аль төлөв рүү чирэх вэ. `null` = хөдөлгөхгүй.
 */
function packageEffect(status) {
  return PACKAGE_EFFECT[status] ?? null;
}

/**
 * ХАМГИЙН ЧУХАЛ ФУНКЦ. Шилжилт зөвшөөрөгдөх эсэхийг бүрэн шалгана.
 *
 * @param {string} from — одоогийн төлөв
 * @param {string} to   — шинэ төлөв
 * @param {object} [ctx]
 * @param {number} [ctx.unpaidTotal] — багц доторх ачаануудын НИЙТ үлдэгдэл (₮).
 *        `0`-ээс их бол §5.2-ын хаалт ажиллана. OVERRIDE БАЙХГҮЙ — Админ ч
 *        тойрч чадахгүй, тиймээс `system`/`force` гэсэн параметр ЗОРИУД алга.
 * @throws {DeliveryTransitionError}
 */
function assertTransition(from, to, { unpaidTotal = 0 } = {}) {
  if (!isKnownStatus(from)) {
    throw new DeliveryTransitionError(`Танигдахгүй одоогийн төлөв: "${from}"`);
  }
  if (!isKnownStatus(to)) {
    throw new DeliveryTransitionError(`Танигдахгүй шинэ төлөв: "${to}"`);
  }
  if (from === to) {
    throw new DeliveryTransitionError(`Хүргэлт аль хэдийн "${label(to)}" төлөвт байна`);
  }

  if (isTerminal(from)) {
    throw new DeliveryTransitionError(
      `"${label(from)}" нь төгсгөлийн төлөв — өөр төлөв рүү шилжихгүй`
    );
  }

  if (!canTransition(from, to)) {
    const options = allowedTransitions(from).map(label).join(', ');
    throw new DeliveryTransitionError(
      `"${label(from)}" төлөвөөс "${label(to)}" төлөв рүү шилжих боломжгүй. ` +
        `Зөвшөөрөгдөх: ${options}`
    );
  }

  // BR-20/§5.2 — багц доторх НЭГ Ч ачаа дутуу төлөгдсөн бол БҮХЭЛДЭЭ хоригдоно
  if (REQUIRES_FULL_PAYMENT.includes(to) && unpaidTotal > 0) {
    throw new DeliveryTransitionError(`Төлбөр дутуу байна: ${formatAmount(unpaidTotal)}₮`);
  }
}

/**
 * Мессежийн дүнг мянгатаар тусгаарлана ("12,000₮").
 *
 * `toLocaleString`-ыг ЗОРИУД хэрэглэхгүй: Node-ийн ICU байхгүй build-д
 * тусгаарлагч алга болж, тестийн мессеж орчноос хамаарна.
 */
function formatAmount(value) {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

module.exports = {
  TRANSITIONS,
  STATUS_LABEL,
  ACTIVE_STATUSES,
  PACKAGE_EFFECT,
  REQUIRES_FULL_PAYMENT,
  DeliveryTransitionError,
  label,
  isKnownStatus,
  allowedTransitions,
  manualTransitions,
  canTransition,
  isTerminal,
  isActive,
  isCancellable,
  packageEffect,
  assertTransition,
  formatAmount,
};
