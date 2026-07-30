'use strict';

const { PRICE_SOURCE } = require('../config/constants');

/**
 * Ачааны үнэ тооцоолол — introduction.md §1.2, BR-01…BR-04
 *
 * БИЗНЕС ЛОГИК. Хөнгөн боловч эзлэхүүн ихтэй ачааг (гутлын хайрцаг) жингээр
 * тооцвол компанид алдагдалтай; хүнд боловч жижиг ачааг (төмөр эд анги)
 * эзлэхүүнээр тооцвол мөн адил. Тиймээс хоёуланг бодож ӨНДӨР дүнг сонгоно.
 *
 *   Эцсийн үнэ = MAX( жингээр , эзлэхүүнээр , доод хэмжээ )
 *
 * ЖИНГЭЭР бодох нь ХОЁР хэсэгтэй (бодит тарифын бүтэц):
 *   1. Жингийн ШАТЛАЛ (bracket) — жижиг илгээмжид ТОГТМОЛ үнэ.
 *      Жишээ: 1–100гр = 800₮ · 101–500гр = 1,500₮ · 501гр–1кг = 2,000₮
 *   2. Шатлалаас ДЭЭШ — 1 кг тутамд тогтоосон үнэ (кг руу дээш дугуйруулна).
 *      Жишээ: гутал/нугалахгүй ачаа = 2,500₮/кг
 *
 * Шатлалгүй (`weightBrackets: []`) тариф нь эхнээсээ кг-аар тооцогдоно.
 *
 * Бүх мөнгөн дүн БҮХЭЛ ТОО, нэгж ₮ (docs/data-model.md §0). Float ашиглахгүй —
 * санхүүгийн тооцоонд дугуйруулалтын алдаа хуримтлагдахыг хүлээн зөвшөөрөхгүй.
 *
 * DB-ээс хамааралгүй цэвэр функц — 100% branch coverage шаардлагатай
 * (docs/testing.md §1).
 */

const GRAMS_PER_KG = 1000;

/**
 * @typedef {object} WeightBracket
 * @property {number} maxGrams — энэ жин хүртэл (оруулаад)
 * @property {number} price    — тогтмол үнэ (₮)
 */

/**
 * @typedef {object} Tariff
 * @property {WeightBracket[]} [weightBrackets] — жингийн шатлал, өсөх дарааллаар
 * @property {number} pricePerKgAbove — шатлалаас дээш 1 кг тутмын үнэ (₮)
 * @property {number} pricePerM3      — ₮/м³
 * @property {number} [minimumCharge] — доод хэмжээний төлбөр (₮), default 0
 */

/**
 * @typedef {object} PriceResult
 * @property {number} byWeight  — жингээр бодсон дүн (₮)
 * @property {number} byVolume  — эзлэхүүнээр бодсон дүн (₮)
 * @property {number} computed  — доод хэмжээ хэрэглэхийн ӨМНӨХ дүн
 * @property {number} final     — эцсийн төлөх дүн (₮)
 * @property {'weight'|'volume'|'minimum'} source — аль хэмжигдэхүүн шийдсэн
 * @property {object|null} appliedBracket — аль шатлал хэрэглэгдсэн (байвал)
 * @property {number} chargeableKg — кг-аар тооцсон хэсэгт хэрэглэсэн жин
 */

/**
 * Ачааны үнийг тооцоолно.
 *
 * @param {object} params
 * @param {number|null} [params.weightKg]  — жин (кг). Байхгүй бол 0-оор тооцно
 * @param {number|null} [params.volumeM3]  — эзлэхүүн (м³). Байхгүй бол 0-оор тооцно
 * @param {Tariff} params.tariff
 * @returns {PriceResult}
 * @throws {Error} жин ба эзлэхүүн хоёулаа байхгүй, эсвэл тариф буруу бол
 */
function calculatePrice({ weightKg, volumeM3, tariff }) {
  assertValidTariff(tariff);

  const weight = toNonNegativeNumber(weightKg, 'Жин');
  const volume = toNonNegativeNumber(volumeM3, 'Эзлэхүүн');

  // Жин ба эзлэхүүн хоёулаа байхгүй бол ТООЦООЛОХ юм байхгүй. Ийм ачааны
  // үнийг ажилтан гараар заана (`manualPrice()`) — үүнийг ЭНД шийдэхгүй,
  // дуудагч тал шийднэ (docs/business-rules.md BR-01a).
  if (weight === 0 && volume === 0) {
    throw new Error('Жин эсвэл эзлэхүүний ядаж нэгийг оруулах шаардлагатай');
  }

  const weightResult = priceByWeight(weight, tariff);
  const byVolume = Math.round(volume * tariff.pricePerM3);

  const computed = Math.max(weightResult.price, byVolume);
  const minimumCharge = tariff.minimumCharge ?? 0;
  const final = Math.max(computed, minimumCharge);

  return {
    byWeight: weightResult.price,
    byVolume,
    computed,
    final,
    source: resolveSource({
      byWeight: weightResult.price,
      byVolume,
      computed,
      minimumCharge,
    }),
    appliedBracket: weightResult.bracket,
    chargeableKg: weightResult.chargeableKg,
  };
}

/**
 * Жингээр үнэ бодох — шатлал эсвэл кг тутмын үнэ.
 *
 * Шатлалыг өсөх дарааллаар шалгаж, ачааны жин багтах ЭХНИЙ шатлалыг авна.
 * Аль ч шатлалд багтахгүй (хамгийн их шатлалаас хүнд) бол кг тутмын үнэ.
 */
function priceByWeight(weightKg, tariff) {
  if (weightKg === 0) {
    return { price: 0, bracket: null, chargeableKg: 0 };
  }

  const grams = weightKg * GRAMS_PER_KG;
  const brackets = tariff.weightBrackets ?? [];

  for (const bracket of brackets) {
    // Хөвөгч таслалын алдаанаас сэргийлж бага зэрэг тэвчээр өгнө
    // (0.5кг → 500.0000001гр болж 500гр-ийн шатлалаас гарахаас сэргийлнэ)
    if (grams <= bracket.maxGrams + 1e-6) {
      return { price: bracket.price, bracket, chargeableKg: 0 };
    }
  }

  // Шатлалаас дээш — кг тутмын үнэ. Эхлэлийн цэг нь хамгийн их шатлалын дээд
  // хязгаар; шатлалгүй тарифд 0-ээс эхэлнэ.
  //
  // Дээш дугуйруулна: карго салбарын нийтлэг практик — 1.2кг = 2кг-аар тооцно.
  const chargeableKg = Math.max(1, Math.ceil(weightKg));

  return {
    price: Math.round(chargeableKg * tariff.pricePerKgAbove),
    bracket: null,
    chargeableKg,
  };
}

/**
 * Аль хэмжигдэхүүн эцсийн үнийг тодорхойлсныг буцаана.
 *
 * Доод хэмжээ давамгайлсан бол `minimum` — энэ нь тайланд "хэдэн ачаа доод
 * хэмжээгээр тооцогдсон" гэдгийг харахад хэрэгтэй.
 */
function resolveSource({ byWeight, byVolume, computed, minimumCharge }) {
  if (computed < minimumCharge) {
    return PRICE_SOURCE.MINIMUM;
  }
  // Тэнцүү үед жинг сонгоно — тогтвортой, урьдчилан таамаглах боломжтой байх ёстой
  return byWeight >= byVolume ? PRICE_SOURCE.WEIGHT : PRICE_SOURCE.VOLUME;
}

/**
 * Ажилтан үнийн дүнг ШУУД заасан тохиолдол — BR-01a.
 *
 * ЯАГААД ЭНЭ ЗАМ БАЙНА: бодит ажил дээр жин үргэлж мэдэгддэггүй (жинлүүр
 * ажиллахгүй, ачаа хэт том, эсвэл харилцагчтай тохирсон тогтмол үнэ). Ийм
 * үед ажилтныг зохиомол жин бичихийг шаардвал өгөгдөл БУРУУ болно — тайлан,
 * тарифын шинжилгээ бүхэн гажина. Тиймээс "жин мэдэгдэхгүй" гэдгийг
 * тодорхой (`weightKg: null`, `priceSource: 'manual'`) илэрхийлэх нь зөв.
 *
 * `computed` нь `final`-тай тэнцүү: харьцуулах бодсон дүн БАЙХГҮЙ учир
 * override-ийн хазайлт тооцох суурь ч байхгүй (BR-04 үйлчлэхгүй).
 *
 * @param {number} price — ажилтны заасан дүн (₮, бүхэл тоо)
 * @returns {PriceResult}
 */
function manualPrice(price) {
  if (!Number.isInteger(price) || price < 0) {
    throw new Error(`Үнэ сөрөг бус бүхэл тоо (₮) байх ёстой: "${price}"`);
  }

  return {
    byWeight: 0,
    byVolume: 0,
    computed: price,
    final: price,
    source: PRICE_SOURCE.MANUAL,
    appliedBracket: null,
    chargeableKg: 0,
  };
}

/**
 * Хэмжээсээс эзлэхүүн бодно — BR-03.
 *
 * @param {object} dimensions — см-ээр
 * @param {number} dimensions.lengthCm
 * @param {number} dimensions.widthCm
 * @param {number} dimensions.heightCm
 * @returns {number} м³, 4 орны нарийвчлалтай
 */
function calculateVolumeM3({ lengthCm, widthCm, heightCm }) {
  const l = toPositiveNumber(lengthCm, 'Урт');
  const w = toPositiveNumber(widthCm, 'Өргөн');
  const h = toPositiveNumber(heightCm, 'Өндөр');

  const cm3 = l * w * h;
  return Number((cm3 / 1_000_000).toFixed(4));
}

/**
 * Ажилтны override зөвшөөрөгдөх хязгаарт багтаж байгаа эсэх — BR-04.
 *
 * Ажилтан зөвхөн тодорхой хувийн хүрээнд үнэ өөрчилнө; хязгаараас давсныг
 * зөвхөн Менежер/Админ хийнэ (§9.1).
 *
 * @param {number} computedPrice — системийн бодсон дүн
 * @param {number} overridePrice — ажилтны оруулах дүн
 * @param {number} limitPercent  — зөвшөөрөгдөх хазайлт (%)
 * @returns {boolean}
 */
function isWithinOverrideLimit(computedPrice, overridePrice, limitPercent) {
  if (!Number.isFinite(computedPrice) || computedPrice <= 0) return false;
  if (!Number.isFinite(overridePrice) || overridePrice < 0) return false;
  if (!Number.isFinite(limitPercent) || limitPercent < 0) return false;

  const allowed = (computedPrice * limitPercent) / 100;
  return Math.abs(overridePrice - computedPrice) <= allowed;
}

/**
 * Шатлалын жагсаалт зөв эсэхийг шалгана.
 * Дараалал ба давхцалыг эрт барихгүй бол үнэ чимээгүй буруу бодогдоно.
 */
function assertValidBrackets(brackets) {
  if (!Array.isArray(brackets)) {
    throw new Error('Жингийн шатлал массив байх ёстой');
  }

  let previousMax = 0;
  for (const [index, bracket] of brackets.entries()) {
    if (!bracket || typeof bracket !== 'object') {
      throw new Error(`Шатлал #${index + 1} буруу бүтэцтэй`);
    }
    if (!Number.isFinite(bracket.maxGrams) || bracket.maxGrams <= 0) {
      throw new Error(`Шатлал #${index + 1}: maxGrams эерэг тоо байх ёстой`);
    }
    if (!Number.isInteger(bracket.price) || bracket.price < 0) {
      throw new Error(`Шатлал #${index + 1}: price сөрөг бус бүхэл тоо байх ёстой`);
    }
    if (bracket.maxGrams <= previousMax) {
      throw new Error(
        `Шатлал #${index + 1}: maxGrams (${bracket.maxGrams}) өмнөхөөс (${previousMax}) их байх ёстой`
      );
    }
    previousMax = bracket.maxGrams;
  }
}

function assertValidTariff(tariff) {
  if (!tariff) {
    throw new Error('Тариф заагаагүй байна');
  }

  for (const field of ['pricePerKgAbove', 'pricePerM3']) {
    const value = tariff[field];
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Тарифын "${field}" сөрөг бус тоо байх ёстой: "${value}"`);
    }
  }

  if (tariff.minimumCharge != null) {
    if (!Number.isFinite(tariff.minimumCharge) || tariff.minimumCharge < 0) {
      throw new Error(
        `Тарифын "minimumCharge" сөрөг бус тоо байх ёстой: "${tariff.minimumCharge}"`
      );
    }
  }

  if (tariff.weightBrackets != null) {
    assertValidBrackets(tariff.weightBrackets);
  }
}

function toNonNegativeNumber(value, label) {
  if (value == null || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${label} сөрөг бус тоо байх ёстой: "${value}"`);
  }
  return n;
}

function toPositiveNumber(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${label} эерэг тоо байх ёстой: "${value}"`);
  }
  return n;
}

module.exports = {
  GRAMS_PER_KG,
  calculatePrice,
  manualPrice,
  calculateVolumeM3,
  isWithinOverrideLimit,
  assertValidBrackets,
};
