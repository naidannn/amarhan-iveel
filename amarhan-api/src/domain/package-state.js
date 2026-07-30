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
 *   registered → notified → awaiting_payment → paid
 *                                               ↓
 *                       out_for_delivery / picked_up
 *                                               ↓
 *                                          delivered
 *
 *   out_for_delivery → returned → (out_for_delivery | picked_up)
 *   registered…awaiting_payment → cancelled
 *
 * ЯАГААД `registered`-ЭЭС ЭХЭЛДЭГ: ачааг Монголд ирсний ДАРАА бүртгэдэг тул
 * бүртгэл өөрөө "ирсэн" гэдгийг илэрхийлнэ. Эрээний тал, замын хөдөлгөөнийг
 * систем хянадаггүй — тэр үед ачаа системд ОГТ байхгүй.
 *
 * ТӨЛБӨРИЙН БОГИНО ЗАМ (Phase 3). `registered → paid` ба `notified → paid`
 * нэмэгдсэн шалтгаан: хэрэглэгч ачаагаа авахаар ирээд ТУХАЙН МӨЧИД төлдөг —
 * ажилтан түүнээс өмнө "мэдэгдсэн", "төлбөр хүлээгдэж буй" гэж дараалан
 * дарах шаардлагагүй. Эдгээр нь зөвхөн СИСТЕМИЙН шилжилт (`paid` нь
 * `SYSTEM_ONLY`) тул ажилтан гараар үсрэх боломжгүй — цорын ганц зам нь
 * бодит төлбөр бүртгэгдэх.
 *
 * Эс тэгвээс нүх үүснэ: бүртгэмэгц бүрэн төлсөн ачаа `registered` төлөвт
 * үлдэж, `paid`-д хүрэх ямар ч зам байхгүй болно (гараар оноох нь BR-09-оор
 * хоригтой) — улмаас `picked_up` руу шилжиж чадахгүй, ачаа гацна.
 */
const TRANSITIONS = Object.freeze({
  [S.REGISTERED]: [S.NOTIFIED, S.AWAITING_PAYMENT, S.PAID, S.CANCELLED],
  [S.NOTIFIED]: [S.AWAITING_PAYMENT, S.PAID, S.CANCELLED],
  [S.AWAITING_PAYMENT]: [S.PAID, S.CANCELLED],
  // `awaiting_payment` руу буцах нь төлбөр ХҮЧИНГҮЙ болсон үеийн залруулга
  // (BR-18) — доорх `SYSTEM_ONLY_EDGES` гараар хийхийг хориглоно.
  [S.PAID]: [S.OUT_FOR_DELIVERY, S.PICKED_UP, S.AWAITING_PAYMENT],
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
 * ("Бүртгэгдсэн"-ээс "Амжилттай хүлээлгэн өгсөн" рүү шилжих боломжгүй).
 * Frontend өөрийн хуулбартай — design token дотор (`packageStatus`).
 */
const STATUS_LABEL = Object.freeze({
  [S.REGISTERED]: 'Бүртгэгдсэн',
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
 * ЗӨВХӨН систем хийж болох ТОДОРХОЙ шилжилтүүд — `"<from>→<to>"`.
 *
 * `SYSTEM_ONLY`-ээс ялгаатай: тэр нь ЦЭГ (төлөв) хориглодог бол энэ нь ЗАМ
 * (шилжилт) хориглоно. `awaiting_payment` нь өөрөө хоригтой төлөв БИШ (ажилтан
 * ачааг төлбөр хүлээх төлөвт оруулах нь хэвийн), гэхдээ `paid`-ААС түүн рүү
 * буцах нь зөвхөн төлбөр хүчингүй болсны залруулга байх ёстой (BR-18).
 *
 * Эс тэгвээс ажилтан төлөгдсөн ачааг гараар "төлбөр хүлээгдэж буй" болгож,
 * төлбөрийн бүртгэлтэй зөрчилдсөн төлөв үүсгэж чадна.
 */
const SYSTEM_ONLY_EDGES = Object.freeze([`${S.PAID}→${S.AWAITING_PAYMENT}`]);

/**
 * Төлбөр бүрэн төлөгдсөн байхыг шаардах төлөвүүд — BR-19, §5.2.
 */
const REQUIRES_FULL_PAYMENT = Object.freeze([S.OUT_FOR_DELIVERY, S.PICKED_UP]);

/**
 * Ачаа агуулахын нүдийг ФИЗИКЭЭР эзэлж байгаа төлөвүүд — §8, BR-24/BR-25.
 *
 * `warehouse_locations.currentCount / currentM3` нь ЗӨВХӨН эдгээр төлөвт байгаа
 * ачааг тоолно. Гарсан (`out_for_delivery`, `picked_up`), өгөгдсөн
 * (`delivered`), хүчингүй (`cancelled`) ачаа нүдийг эзлэхээ болино — эс тэгвээс
 * тавиур хэзээ ч чөлөөлөгдөхгүй, багтаамжийн сануулга (BR-24) утгаа алдана.
 *
 * `returned` нь буцаж агуулахад ирсэн гэсэн үг тул ДАХИН эзэлнэ.
 */
const OCCUPIES_LOCATION = Object.freeze([
  S.REGISTERED,
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
 * Шилжилт ТАБЛИЦАД байгаа эсэх. Нөхцөлт guard-ыг шалгахгүй.
 */
function canTransition(from, to) {
  return allowedTransitions(from).includes(to);
}

/**
 * АЖИЛТАН ГАРААР хийж болох шилжилтүүд — UI-д товч харуулахад ЭНЭ функц.
 *
 * `allowedTransitions()`-ыг шууд UI-д дамжуулж БОЛОХГҮЙ: тэр нь системийн
 * шилжилтүүдийг ч агуулдаг тул "Төлбөр төлөгдсөн" гэсэн товч гарч, дарах бүрт
 * 409 буцаана (BR-09). Ажилтан яагаад ажиллахгүйг ойлгохгүй.
 *
 * `cancelled` мөн ОРОХГҮЙ — хүчингүй болгох нь эрх ба шалтгаан шаарддаг
 * тусдаа урсгал (BR-11), тусдаа товчоор гарна.
 */
function manualTransitions(from) {
  return allowedTransitions(from).filter(
    to =>
      !SYSTEM_ONLY.includes(to) &&
      !SYSTEM_ONLY_EDGES.includes(`${from}→${to}`) &&
      to !== S.CANCELLED
  );
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

  // BR-18 — `paid → awaiting_payment` нь зөвхөн төлбөр хүчингүй болсны залруулга
  if (SYSTEM_ONLY_EDGES.includes(`${from}→${to}`) && !system) {
    throw new StatusTransitionError(
      `"${label(from)}" төлөвөөс "${label(to)}" рүү гараар буцаах боломжгүй — ` +
        'төлбөр хүчингүй болоход систем өөрөө залруулна'
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
  SYSTEM_ONLY_EDGES,
  REQUIRES_FULL_PAYMENT,
  OCCUPIES_LOCATION,
  occupiesLocation,
  StatusTransitionError,
  label,
  isKnownStatus,
  allowedTransitions,
  manualTransitions,
  canTransition,
  isTerminal,
  isCancellable,
  assertTransition,
  resolvePaymentStatus,
};
