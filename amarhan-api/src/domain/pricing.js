'use strict';

const { PRICE_SOURCE } = require('../config/constants');

/**
 * Ачааны үнэ тооцоолол — introduction.md §1.2, BR-01…BR-04
 *
 * БИЗНЕС ЛОГИК. Хөнгөн боловч эзлэхүүн ихтэй ачааг (гутлын хайрцаг) жингээр
 * тооцвол компанид алдагдалтай; хүнд боловч жижиг ачааг (төмөр эд анги)
 * эзлэхүүнээр тооцвол мөн адил. Тиймээс хоёуланг бодож ӨНДӨР дүнг сонгоно.
 *
 * Эцсийн үнэ = MAX( жин × ₮/kg , эзлэхүүн × ₮/m³ , доод хэмжээ )
 *
 * Бүх мөнгөн дүн БҮХЭЛ ТОО, нэгж ₮ (docs/data-model.md §0). Float ашиглахгүй —
 * санхүүгийн тооцоонд дугуйруулалтын алдаа хуримтлагдахыг хүлээн зөвшөөрөхгүй.
 *
 * DB-ээс хамааралгүй цэвэр функц — 100% branch coverage шаардлагатай
 * (docs/testing.md §1).
 */

/**
 * @typedef {object} Tariff
 * @property {number} pricePerKg     — ₮/кг
 * @property {number} pricePerM3     — ₮/м³
 * @property {number} minimumCharge  — доод хэмжээний төлбөр (₮)
 */

/**
 * @typedef {object} PriceResult
 * @property {number} byWeight  — жингээр бодсон дүн (₮)
 * @property {number} byVolume  — эзлэхүүнээр бодсон дүн (₮)
 * @property {number} computed  — доод хэмжээ хэрэглэхийн ӨМНӨХ дүн
 * @property {number} final     — эцсийн төлөх дүн (₮)
 * @property {'weight'|'volume'|'minimum'} source — аль хэмжигдэхүүн шийдсэн
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

  // §1.1 — ачааны төрлөөс хамаарч жин эсвэл эзлэхүүний ЯДАЖ НЭГ нь заавал
  if (weight === 0 && volume === 0) {
    throw new Error('Жин эсвэл эзлэхүүний ядаж нэгийг оруулах шаардлагатай');
  }

  const byWeight = Math.round(weight * tariff.pricePerKg);
  const byVolume = Math.round(volume * tariff.pricePerM3);

  const computed = Math.max(byWeight, byVolume);
  const final = Math.max(computed, tariff.minimumCharge);

  return {
    byWeight,
    byVolume,
    computed,
    final,
    source: resolveSource({ byWeight, byVolume, computed, tariff }),
  };
}

/**
 * Аль хэмжигдэхүүн эцсийн үнийг тодорхойлсныг буцаана.
 *
 * Доод хэмжээ давамгайлсан бол `minimum` — энэ нь тайланд "хэдэн ачаа доод
 * хэмжээгээр тооцогдсон" гэдгийг харахад хэрэгтэй.
 */
function resolveSource({ byWeight, byVolume, computed, tariff }) {
  if (computed < tariff.minimumCharge) {
    return PRICE_SOURCE.MINIMUM;
  }
  // Тэнцүү үед жинг сонгоно — тогтвортой, урьдчилан таамаглах боломжтой байх ёстой
  return byWeight >= byVolume ? PRICE_SOURCE.WEIGHT : PRICE_SOURCE.VOLUME;
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

function assertValidTariff(tariff) {
  if (!tariff) {
    throw new Error('Тариф заагаагүй байна');
  }
  const fields = ['pricePerKg', 'pricePerM3', 'minimumCharge'];
  for (const field of fields) {
    const value = tariff[field];
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Тарифын "${field}" сөрөг бус тоо байх ёстой: "${value}"`);
    }
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
  calculatePrice,
  calculateVolumeM3,
  isWithinOverrideLimit,
};
