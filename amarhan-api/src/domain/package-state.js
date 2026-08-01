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
 *   expected → in_erlian → registered → notified → awaiting_payment → paid
 *         └──────────────────↗                                          ↓
 *                                out_for_delivery / picked_up
 *                                                            ↓
 *                                                       delivered
 *
 *   out_for_delivery → returned → (out_for_delivery | picked_up)
 *   expected…awaiting_payment → cancelled
 *
 * ЯАГААД `expected` ХОЁР ЗАМТАЙ: ачаа Эрээнд ирснийг мэдэгдвэл `in_erlian`
 * (дугаар+утас), харин Эрээнд бүртгэлгүй өнгөрч шууд Монголд ирвэл
 * `registered` (жин/үнэ/байршилтай). Хоёулаа ЯГ ТЭР бичлэг дээр хийгдэнэ —
 * харилцагчийн хянаж байсан бичлэг тасрах ёсгүй (BR-46).
 *
 * ЯАГААД `registered`-ЭЭС (БУС `in_erlian`-аас) бодит бүртгэл ЭХЭЛДЭГ: ачааг
 * Монголд ирсний ДАРАА бүртгэдэг тул `registered` өөрөө "ирсэн" гэдгийг
 * илэрхийлнэ (BR-45). `in_erlian` бол 2026-07-31 шийдвэрээр нэмэгдсэн
 * УРЬДЧИЛСАН тэмдэглэл — ачааны дугаар + утсаар л мэдэгдэж байгаа үед,
 * ачаа Монголд ирэхээс ӨМНӨ бичигддэг (`roadmap.md` §2.19). Энэ нь хуучин
 * татгалзсан "Эрээнд бүртгэгдсэн / Монгол руу илгээгдсэн / Монголд ирсэн"
 * гэсэн гурван шатны замын төлөв ОГТ БИШ — `in_erlian` дангаараа ганцхан
 * шат бөгөөд `MANUAL_EDGES_REQUIRING_DATA`-ийн ачаар зөвхөн тусгай "ирц
 * гүйцээх" замаар (`completeArrival`, жин/үнэ/байршил хамт) `registered`
 * рүү шилждэг — энгийн `changeStatus`-аар ХЭЗЭЭ Ч биш.
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
  [S.EXPECTED]: [S.IN_ERLIAN, S.REGISTERED, S.CANCELLED],
  [S.IN_ERLIAN]: [S.REGISTERED, S.CANCELLED],
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
  [S.EXPECTED]: 'Хүлээгдэж буй',
  [S.IN_ERLIAN]: 'Эрээнд байгаа',
  [S.REGISTERED]: 'Улаанбаатарт ирсэн',
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
 * ЗӨВХӨН нэмэлт мэдээлэлтэй (жин/үнэ/байршил) "ирц гүйцээх" замаар хийгдэх
 * шилжилтүүд — BR-45, BR-46. `SYSTEM_ONLY_EDGES`-ээс ялгаатай: энэ бол СИСТЕМ
 * БИШ, ажилтан өөрөө гараар хийдэг шилжилт, гэхдээ энгийн `changeStatus`
 * (зөвхөн `status` талбар өөрчилдөг) дамжуулж болохгүй — учир нь
 * `expected` / `in_erlian` ачаанд жин/үнэ/байршил байхгүй, тэдгээрийг зэрэг
 * өгөхгүйгээр `registered` болговол §1.1-ийн цөм баталгааг зөрчинө
 * (байршилгүй, үнэгүй "бүртгэгдсэн" ачаа үүснэ). Иймд `assertTransition`-д
 * `viaArrival: true` контекст ЗААВАЛ дамжуулах ёстой — үүнийг зөвхөн
 * `completeArrival()` (package.service.js) хийнэ.
 */
const MANUAL_EDGES_REQUIRING_DATA = Object.freeze([
  `${S.IN_ERLIAN}→${S.REGISTERED}`,
  `${S.EXPECTED}→${S.REGISTERED}`,
]);

/**
 * УРЬДЧИЛСАН (ачаа хараахан агуулахад ирээгүй) төлөвүүд — BR-45, BR-46.
 *
 * Нийтлэг шинж: жин, эзлэхүүн, үнэ, байршил, төлбөр ОГТ БАЙХГҮЙ. Тиймээс
 * эдгээр бичлэг дээр ажилтан "дахин бүртгэх" нь давхардал БИШ, харин ЯГ ТЭР
 * бичлэгийг гүйцээх (шингээх) үйлдэл болно (`packageService.adoptExisting`).
 *
 * Ганц жагсаалт байгаа шалтгаан: "энэ ачаа бодитоор бүртгэгдсэн үү" гэсэн
 * асуултыг давхардлын шалгалт, ирц бүртгэх маягт, тайлан гурав тус тусдаа
 * жагсаалтаар хариулбал хожим нэг нь мартагдаж, урьдчилсан бичлэг дээр
 * давхар ачаа үүснэ.
 */
const PRE_ARRIVAL = Object.freeze([S.EXPECTED, S.IN_ERLIAN]);

function isPreArrival(status) {
  return PRE_ARRIVAL.includes(status);
}

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
 *
 * `in_erlian → registered` ба `expected → registered` мөн ОРОХГҮЙ (BR-45,
 * BR-46) — эдгээр шилжилт жин/үнэ/байршил зэрэг нэмэлт мэдээлэл шаарддаг тул
 * энгийн "Төлөв өөрчлөх" товчоор биш, тусдаа "Ирц бүртгэх" маягтаар
 * (`completeArrival`) хийгдэнэ. Харин `expected → in_erlian` нь нэмэлт
 * мэдээлэл шаардахгүй (дугаар+утас аль хэдийн бий) тул ЭНГИЙН товчоор хийгдэнэ.
 */
function manualTransitions(from) {
  return allowedTransitions(from).filter(
    to =>
      !SYSTEM_ONLY.includes(to) &&
      !SYSTEM_ONLY_EDGES.includes(`${from}→${to}`) &&
      !MANUAL_EDGES_REQUIRING_DATA.includes(`${from}→${to}`) &&
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
 * @param {boolean} [ctx.viaArrival]   — "ирц гүйцээх" замаар хийгдэж байгаа эсэх (BR-45)
 * @throws {StatusTransitionError}
 */
function assertTransition(from, to, { paymentStatus, system = false, viaArrival = false } = {}) {
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

  // BR-45 — `in_erlian → registered` зөвхөн жин/үнэ/байршилтай хамт, "ирц
  // гүйцээх" замаар (`completeArrival`) хийгдэнэ
  if (MANUAL_EDGES_REQUIRING_DATA.includes(`${from}→${to}`) && !viaArrival) {
    throw new StatusTransitionError(
      `"${label(from)}" төлөвөөс "${label(to)}" рүү шилжихэд жин/үнэ/байршил ` +
        'мэдээлэл зайлшгүй шаардлагатай — "Ирц бүртгэх" цонхыг ашиглана уу'
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
  MANUAL_EDGES_REQUIRING_DATA,
  PRE_ARRIVAL,
  isPreArrival,
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
