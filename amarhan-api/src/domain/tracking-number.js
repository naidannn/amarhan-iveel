'use strict';

/**
 * Ачааны дугаарын нормчлол — introduction.md §1.3
 *
 * ЯАГААД ТУСДАА ДОМЭЙН ФАЙЛ: tracking number бол ачааг өвөрмөц таних гол
 * түлхүүр. Хадгалах үед ба хайх үед ЯГ ИЖИЛ дүрмээр нормчлогдох ёстой —
 * эс тэгвээс "abc 123" ба "ABC123" хоёр өөр ачаа болж, давхардлын хамгаалалт
 * (BR-05) чимээгүй ажиллахаа болино.
 *
 * Тээвэрлэгчид дугаарыг зай, зураас, доод/дээд үсэг холилдуулж бичдэг.
 */

/** Зөвшөөрөгдөх тэмдэгт: латин үсэг, тоо, зураас, доогуур зураас */
const TRACKING_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,63}$/;

/**
 * Зай, tab-ыг арилгаж, том үсэг болгоно.
 *
 * Зураасыг АРИЛГАХГҮЙ: тээвэрлэгчийн дугаарт зураас нь ихэвчлэн утга агуулдаг
 * (`SF-1234` ≠ `SF1234` байх магадлалтай) тул өөрсдөө шийдэхээс зайлсхийв.
 */
function normalizeTrackingNumber(value) {
  if (value == null) {
    throw new Error('Ачааны дугаар шаардлагатай');
  }
  const normalized = String(value).replace(/\s+/g, '').toUpperCase();
  if (!normalized) {
    throw new Error('Ачааны дугаар хоосон байж болохгүй');
  }
  return normalized;
}

function isValidTrackingNumber(value) {
  try {
    return TRACKING_PATTERN.test(normalizeTrackingNumber(value));
  } catch {
    return false;
  }
}

/**
 * Нормчилж, форматыг шалгана. Буруу бол алдаа өгнө.
 */
function assertTrackingNumber(value) {
  const normalized = normalizeTrackingNumber(value);
  if (!TRACKING_PATTERN.test(normalized)) {
    throw new Error('Ачааны дугаар 3–64 тэмдэгт байх ба зөвхөн латин үсэг, тоо, зураас агуулна');
  }
  return normalized;
}

module.exports = {
  TRACKING_PATTERN,
  normalizeTrackingNumber,
  isValidTrackingNumber,
  assertTrackingNumber,
};
