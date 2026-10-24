'use strict';

/**
 * Урамшууллын (loyalty) цөм дүрэм — introduction.md §4, BR-30…BR-33a, BR-48.
 *
 * DB-ээс хамааралгүй ЦЭВЭР функцууд. Бүх дүн БҮХЭЛ ТОО (CLAUDE.md §5 дүрэм 2):
 * 1 кредит = 1₮, хувь нь `rateBps` (1/10000) — `0.035 × 100000` төрлийн float
 * үржвэр `floor()`-д 1₮-ийн алдаа гаргадаг (loyalty-readiness §3.3).
 *
 * Түвшин бол СҮҮЛИЙН `windowDays` хоногийн БОДИТ МӨНГӨН зарцуулалтаас
 * тодорхойлогдоно (эзэмшигчийн 2026-10-24-ний шийдвэр, BR-32 шинэчлэгдсэн) —
 * идэвхгүй болбол буурч болно. Админы гараар тавьсан түвшин нь ДООД ХЯЗГААР.
 */

class LoyaltyError extends Error {
  constructor(message, code = null) {
    super(message);
    this.name = 'LoyaltyError';
    this.code = code;
  }
}

const BPS_DENOMINATOR = 10000;

/**
 * Тохиргооны түвшнүүдийг босгоор өсөхөөр эрэмбэлж шалгана.
 *
 * Шалгалт энд байгаа шалтгаан: тохиргоо `Mixed` төрлөөр DB-д хадгалагддаг тул
 * эвдэрсэн утга (давхардсан босго, 0-ээс эхлээгүй) ирвэл `resolveTier`
 * чимээгүй буруу түвшин өгнө — тэр нь мөнгөн хөнгөлөлтийн алдаа.
 *
 * @param {Array<{code:string,name:string,minSpent:number,rateBps:number}>} tiers
 */
function normalizeTiers(tiers) {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    throw new LoyaltyError('Урамшууллын түвшин тохируулагдаагүй байна');
  }

  const sorted = [...tiers].sort((a, b) => a.minSpent - b.minSpent);

  if (sorted[0].minSpent !== 0) {
    throw new LoyaltyError('Хамгийн доод түвшний босго 0₮ байх ёстой');
  }

  for (let i = 0; i < sorted.length; i += 1) {
    const t = sorted[i];
    if (!t.code || typeof t.code !== 'string') {
      throw new LoyaltyError('Түвшний код заавал байна');
    }
    if (!Number.isInteger(t.minSpent) || t.minSpent < 0) {
      throw new LoyaltyError(`"${t.code}" түвшний босго бүхэл тоо (₮) байх ёстой`);
    }
    if (!Number.isInteger(t.rateBps) || t.rateBps < 0 || t.rateBps > BPS_DENOMINATOR) {
      throw new LoyaltyError(`"${t.code}" түвшний хувь 0–100% хооронд байх ёстой`);
    }
    if (i > 0 && t.minSpent <= sorted[i - 1].minSpent) {
      throw new LoyaltyError('Түвшний босгууд давхцахгүй, өсөх дарааллаар байх ёстой');
    }
  }

  if (new Set(sorted.map(t => t.code)).size !== sorted.length) {
    throw new LoyaltyError('Түвшний код давхардсан байна');
  }

  return sorted;
}

/**
 * Зарцуулалтаар түвшин тодорхойлно. `floorCode` (Админы гараар тавьсан
 * түвшин, BR-33) байвал түүнээс ДООШ буулгахгүй.
 *
 * @returns {{ tier: object, index: number }}
 */
function resolveTier(spent, tiers, floorCode = null) {
  assertMoney(spent, 'Зарцуулалт');
  const sorted = normalizeTiers(tiers);

  let index = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    if (spent >= sorted[i].minSpent) index = i;
  }

  if (floorCode) {
    const floorIndex = sorted.findIndex(t => t.code === floorCode);
    if (floorIndex > index) index = floorIndex;
  }

  return { tier: sorted[index], index };
}

/**
 * Дараагийн түвшин хүртэлх зай — харилцагчийн "дахиад хэд" хэсэг (§4).
 *
 * `progressBps` нь ОДООГИЙН түвшний босгоос дараагийн босго хүртэлх замын
 * хувь (0–10000): 0₮-өөс биш, одоогийн шатнаас тоолно — тэгэхгүй бол Алт
 * түвшинд хүрсэн хүн Платинум руу "33%" гэж харж, шат ахих бүрт прогресс
 * буцаж унасан мэт харагдана.
 *
 * Гараар тавьсан түвшнээр (floor) ахисан үед зарцуулалт одоогийн босгоос
 * бага байж болно — тэр үед прогресс 0.
 *
 * @returns {{ next: object|null, remaining: number, progressBps: number }}
 */
function nextTierGap(spent, tiers, currentCode) {
  assertMoney(spent, 'Зарцуулалт');
  const sorted = normalizeTiers(tiers);
  const index = sorted.findIndex(t => t.code === currentCode);
  const current = sorted[index] ?? sorted[0];
  const next = sorted[index + 1] ?? null;

  if (!next) {
    return { next: null, remaining: 0, progressBps: BPS_DENOMINATOR };
  }

  const span = next.minSpent - current.minSpent;
  const done = Math.min(Math.max(spent - current.minSpent, 0), span);

  return {
    next,
    remaining: Math.max(next.minSpent - spent, 0),
    progressBps: Math.floor((done * BPS_DENOMINATOR) / span),
  };
}

/**
 * BR-31 — олгох кредит. `floor` — компанийн талд дугуйруулна (1₮-ийн бутархай
 * кредит олгохгүй). `cashPaid × rateBps` нь 1e9 × 1e4 = 1e13 < 2^53 тул
 * Number-ээр яг таг.
 */
function computeEarn(cashPaid, rateBps) {
  assertMoney(cashPaid, 'Төлсөн дүн');
  if (!Number.isInteger(rateBps) || rateBps < 0) {
    throw new LoyaltyError(`Хувь бүхэл тоо (bps) байх ёстой: "${rateBps}"`);
  }
  return Math.floor((cashPaid * rateBps) / BPS_DENOMINATOR);
}

/**
 * BR-48 — кредитээр хааж болох дээд дүн: харилцагчийн үлдэгдэл ба ачааны
 * үлдэгдлийн `maxRedeemPercent` хувийн аль бага нь. Сөрөг кредит (буцаалтын
 * дараа) ашиглагдахгүй.
 */
function maxRedeemable({ credits, payable, maxRedeemPercent }) {
  if (!Number.isInteger(credits)) {
    throw new LoyaltyError(`Кредит бүхэл тоо байх ёстой: "${credits}"`);
  }
  assertMoney(payable, 'Төлөх дүн');
  if (!Number.isInteger(maxRedeemPercent) || maxRedeemPercent < 0 || maxRedeemPercent > 100) {
    throw new LoyaltyError('Кредит ашиглах хязгаар 0–100% байх ёстой');
  }
  const cap = Math.floor((payable * maxRedeemPercent) / 100);
  return Math.max(Math.min(credits, cap), 0);
}

/**
 * BR-48 — кредит ашиглах хүсэлтийг шалгана. Алдааны `code` нь
 * `ERROR_CODE`-той таарна (service HTTP код руу хөрвүүлнэ).
 */
function assertRedeemable(amount, { credits, payable, maxRedeemPercent }) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new LoyaltyError('Ашиглах кредит 1-ээс их бүхэл тоо байх ёстой');
  }
  if (amount > credits) {
    throw new LoyaltyError(
      `Кредит хүрэлцэхгүй байна (боломжит: ${Math.max(credits, 0)})`,
      'INSUFFICIENT_CREDIT'
    );
  }
  const max = maxRedeemable({ credits, payable, maxRedeemPercent });
  if (amount > max) {
    throw new LoyaltyError(
      `Энэ төлбөрт хамгийн ихдээ ${max} кредит ашиглах боломжтой`,
      'CREDIT_LIMIT_EXCEEDED'
    );
  }
}

function assertMoney(value, label) {
  if (!Number.isInteger(value)) {
    throw new LoyaltyError(`${label} бүхэл тоо (₮) байх ёстой: "${value}"`);
  }
  if (value < 0) {
    throw new LoyaltyError(`${label} сөрөг байж болохгүй: "${value}"`);
  }
}

module.exports = {
  BPS_DENOMINATOR,
  LoyaltyError,
  normalizeTiers,
  resolveTier,
  nextTierGap,
  computeEarn,
  maxRedeemable,
  assertRedeemable,
};
