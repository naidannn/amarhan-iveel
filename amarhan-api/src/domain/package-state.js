'use strict';

const { PACKAGE_STATUS, PAYMENT_STATUS } = require('../config/constants');

/**
 * Ачааны төлөвийн машин — introduction.md §1.5, BR-07…BR-09, BR-19
 *
 * ЯАГААД ТУСДАА ДОМЭЙН ФАЙЛ: төлөвийн шилжилт бол системийн хамгийн эмзэг дүрэм.
 * Ачаа `awaiting_payment`-аас шууд `delivered` болж чадвал төлбөр авалгүй ачаа
 * гарна. Тиймээс дүрмийг DB-ээс, HTTP-ээс, эрхээс ЦЭВЭР салгаж, ганц газарт
 * тодорхойлж, 100% тестээр хучна (docs/testing.md §1).
 *
 * Кодын өөр хаана ч `pkg.status = ...` шууд оноохыг хориглоно (BR-08) —
 * зөвхөн `packageService.changeStatus()` дамжина.
 */

const S = PACKAGE_STATUS;

/**
 * Зөвшөөрөгдсөн шилжилтүүд (BR-07).
 *
 * Хоосон массив = ТӨГСГӨЛИЙН төлөв, хаашаа ч шилжихгүй.
 *
 *   registered → in_transit → arrived → notified → awaiting_payment → paid
 *                                                                      ↓
 *                                             out_for_delivery / picked_up
 *                                                                      ↓
 *                                                                 delivered
 *
 *   out_for_delivery → returned → (out_for_delivery | picked_up)
 *   registered…awaiting_payment → cancelled
 */
const TRANSITIONS = Object.freeze({
  [S.REGISTERED]: [S.IN_TRANSIT, S.CANCELLED],
  [S.IN_TRANSIT]: [S.ARRIVED, S.CANCELLED],
  [S.ARRIVED]: [S.NOTIFIED, S.CANCELLED],
  [S.NOTIFIED]: [S.AWAITING_PAYMENT, S.CANCELLED],
  [S.AWAITING_PAYMENT]: [S.PAID, S.CANCELLED],
  [S.PAID]: [S.OUT_FOR_DELIVERY, S.PICKED_UP],
  [S.OUT_FOR_DELIVERY]: [S.DELIVERED, S.RETURNED],
  [S.PICKED_UP]: [S.DELIVERED],
  [S.RETURNED]: [S.OUT_FOR_DELIVERY, S.PICKED_UP],
  [S.DELIVERED]: [],
  [S.CANCELLED]: [],
});

/**
 * Хэрэглэгчид харагдах монгол нэр (§1.5).
 *
 * Backend-д байгаа шалтгаан: алдааны мессеж монгол хэлээр байх ёстой
 * ("Эрээнд бүртгэгдсэн"-ээс "Амжилттай хүлээлгэн өгсөн" рүү шилжих боломжгүй).
 * Frontend өөрийн хуулбартай — design token дотор (`packageStatus`).
 */
const STATUS_LABEL = Object.freeze({
  [S.REGISTERED]: 'Эрээнд бүртгэгдсэн',
  [S.IN_TRANSIT]: 'Монгол руу илгээгдсэн',
  [S.ARRIVED]: 'Монголд ирсэн',
  [S.NOTIFIED]: 'Хэрэглэгчид мэдэгдсэн',
  [S.AWAITING_PAYMENT]: 'Төлбөр хүлээгдэж буй',
  [S.PAID]: 'Төлбөр төлөгдсөн',
  [S.OUT_FOR_DELIVERY]: 'Хүргэлтэнд гарсан',
  [S.PICKED_UP]: 'Салбараас авсан',
  [S.DELIVERED]: 'Амжилттай хүлээлгэн өгсөн',
  [S.RETURNED]: 'Буцаагдсан',
  [S.CANCELLED]: 'Хүчингүй',
});

/**
 * ЗӨВХӨН систем оноодог төлөвүүд — гараар оноох боломжгүй (BR-09).
 *
 * `paid` нь `balance === 0` болмогц төлбөрийн транзакц дотор автоматаар
 * оногдоно. Ажилтан гараар "төлөгдсөн" гэж тэмдэглэж чадвал бүртгэгдээгүй
 * мөнгө үүсч, санхүүгийн тэнцэл эвдэрнэ.
 */
const SYSTEM_ONLY = Object.freeze([S.PAID]);

/**
 * Төлбөр бүрэн төлөгдсөн байхыг шаардах төлөвүүд — BR-19, §5.2.
 */
const REQUIRES_FULL_PAYMENT = Object.freeze([S.OUT_FOR_DELIVERY, S.PICKED_UP]);

/**
 * Ачаа агуулахын нүдийг ФИЗИКЭЭР эзэлж байгаа төлөвүүд — §8, BR-24/BR-25.
 *
 * `warehouse_locations.currentCount / currentM3` нь ЗӨВХӨН эдгээр төлөвт байгаа
 * ачааг тоолно. Илгээгдсэн (`in_transit`), гарсан (`out_for_delivery`,
 * `picked_up`), өгөгдсөн (`delivered`), хүчингүй (`cancelled`) ачаа нүдийг
 * эзлэхээ болино — эс тэгвээс тавиур хэзээ ч чөлөөлөгдөхгүй, багтаамжийн
 * сануулга (BR-24) утгаа алдана.
 *
 * `returned` нь буцаж агуулахад ирсэн гэсэн үг тул ДАХИН эзэлнэ.
 */
const OCCUPIES_LOCATION = Object.freeze([
  S.REGISTERED,
  S.ARRIVED,
  S.NOTIFIED,
  S.AWAITING_PAYMENT,
  S.PAID,
  S.RETURNED,
]);

function occupiesLocation(status) {
  return OCCUPIES_LOCATION.includes(status);
}

class StatusTransitionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StatusTransitionError';
  }
}

function label(status) {
  return STATUS_LABEL[status] ?? status;
}

function isKnownStatus(status) {
  return Object.prototype.hasOwnProperty.call(TRANSITIONS, status);
}

/**
 * Тухайн төлөвөөс шилжих боломжтой төлөвүүд.
 * @returns {string[]}
 */
function allowedTransitions(from) {
  return TRANSITIONS[from] ? [...TRANSITIONS[from]] : [];
}

/**
 * Шилжилт ТАБЛИЦАД байгаа эсэх. Нөхцөлт guard-ыг шалгахгүй —
 * "UI-д ямар товч харуулах" гэсэн асуултад хариулна.
 */
function canTransition(from, to) {
  return allowedTransitions(from).includes(to);
}

function isTerminal(status) {
  return isKnownStatus(status) && TRANSITIONS[status].length === 0;
}

function isCancellable(status) {
  return canTransition(status, S.CANCELLED);
}

/**
 * ХАМГИЙН ЧУХАЛ ФУНКЦ. Шилжилт зөвшөөрөгдөх эсэхийг бүрэн шалгана.
 *
 * @param {string} from — одоогийн төлөв
 * @param {string} to   — шинэ төлөв
 * @param {object} [ctx]
 * @param {string} [ctx.paymentStatus] — `PAYMENT_STATUS`-ийн утга (BR-19 шалгахад)
 * @param {boolean} [ctx.system]       — систем өөрөө хийж байгаа шилжилт (BR-09)
 * @throws {StatusTransitionError}
 */
function assertTransition(from, to, { paymentStatus, system = false } = {}) {
  if (!isKnownStatus(from)) {
    throw new StatusTransitionError(`Танигдахгүй одоогийн төлөв: "${from}"`);
  }
  if (!isKnownStatus(to)) {
    throw new StatusTransitionError(`Танигдахгүй шинэ төлөв: "${to}"`);
  }
  if (from === to) {
    throw new StatusTransitionError(`Ачаа аль хэдийн "${label(to)}" төлөвт байна`);
  }

  if (isTerminal(from)) {
    throw new StatusTransitionError(
      `"${label(from)}" нь төгсгөлийн төлөв — өөр төлөв рүү шилжихгүй`
    );
  }

  if (!canTransition(from, to)) {
    const options = allowedTransitions(from).map(label).join(', ');
    throw new StatusTransitionError(
      `"${label(from)}" төлөвөөс "${label(to)}" төлөв рүү шилжих боломжгүй. ` +
        `Зөвшөөрөгдөх: ${options}`
    );
  }

  // BR-09 — `paid` зөвхөн төлбөрийн транзакцаас оногдоно
  if (SYSTEM_ONLY.includes(to) && !system) {
    throw new StatusTransitionError(
      `"${label(to)}" төлөвийг гараар оноох боломжгүй — төлбөр бүрэн ` +
        'бүртгэгдэхэд систем өөрөө шилжүүлнэ'
    );
  }

  // BR-19 — төлбөргүй ачааг хүргэлтэнд гаргах / салбараас өгөхийг хориглоно
  if (REQUIRES_FULL_PAYMENT.includes(to) && paymentStatus !== PAYMENT_STATUS.PAID) {
    throw new StatusTransitionError(
      `Төлбөр бүрэн төлөгдөөгүй ачааг "${label(to)}" төлөвт шилжүүлэх боломжгүй`
    );
  }
}

/**
 * Ачааны `paymentStatus`-ыг дүнгээс гаргана — BR-14.
 *
 * Цэвэр функц болгож байгаа шалтгаан: Phase 3-ийн төлбөрийн транзакц ба
 * зөрүү шалгах cron хоёул ИЖИЛ логик хэрэглэх ёстой.
 *
 * @param {number} finalPrice — төлөх ёстой дүн (₮)
 * @param {number} paidAmount — төлөгдсөн дүн (₮)
 */
function resolvePaymentStatus(finalPrice, paidAmount) {
  if (paidAmount <= 0) return PAYMENT_STATUS.UNPAID;
  // Илүү төлөлт ч "төлөгдсөн" (BR-15) — үлдэгдэл сөрөг болно
  if (paidAmount >= finalPrice) return PAYMENT_STATUS.PAID;
  return PAYMENT_STATUS.PARTIAL;
}

module.exports = {
  TRANSITIONS,
  STATUS_LABEL,
  SYSTEM_ONLY,
  REQUIRES_FULL_PAYMENT,
  OCCUPIES_LOCATION,
  occupiesLocation,
  StatusTransitionError,
  label,
  isKnownStatus,
  allowedTransitions,
  canTransition,
  isTerminal,
  isCancellable,
  assertTransition,
  resolvePaymentStatus,
};
