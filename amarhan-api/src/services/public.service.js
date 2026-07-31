'use strict';

const httpStatus = require('http-status');
const packageRepository = require('../repositories/package.repository');
const cargoTypeRepository = require('../repositories/cargo-type.repository');
const tariffVersionRepository = require('../repositories/tariff-version.repository');
const settingService = require('./setting.service');
const APIError = require('../utils/APIError');
const { maskPhone, normalizePhone } = require('../domain/phone');
const { PUBLIC_CONTENT_KEYS, SETTING_DEFAULTS, PACKAGE_STATUS } = require('../config/constants');

/** Нүүр хуудасны "Энгийн, ил тод тариф" хэсэгт харуулах ачааны төрөл */
const PUBLIC_PRICING_CARGO_TYPE_CODE = 'standard';

/**
 * Нэвтрэхгүйгээр хандах өгөгдөл — introduction.md §3
 *
 * ⚠ ЭНЭ ФАЙЛЫН БҮХ ХАРИУ ИНТЕРНЭТЭД НЭЭЛТТЭЙ. Ачааны дугаараа мэдэж байгаа
 * ХЭН Ч дуудна — тиймээс аль ч талбарыг "нэмэхэд гэм алга" гэж үзэж болохгүй.
 */
class PublicService {
  /**
   * §3 — ачаа хайх (`/track/[number]`).
   *
   * Юуг ХАРУУЛАХГҮЙ вэ, яагаад:
   *   · үнэ, төлбөрийн үлдэгдэл — ачааны дугаар мэддэг хэн ч харилцагчийн
   *     санхүүгийн байдлыг уншиж чадах болно
   *   · бүтэн утас — маскална (§8-ын логийн дүрмийн ижил зарчим). Утас нь
   *     "энэ миний ачаа мөн үү" гэдгийг таних хангалттай хэсгээр харагдана
   *   · агуулахын байршлын код, ажилтны нэр, тэмдэглэл — дотоод үйл ажиллагаа
   *
   * Юуг ХАРУУЛАХ вэ: төлөв ба төлөвийн огноо — хайлтын ЦОРЫН ГАНЦ зорилго.
   */
  async track(trackingNumber) {
    const pkg = await packageRepository.findByTrackingNumber(trackingNumber);

    // Хүчингүй болсон ачааг «олдсонгүй» гэж үзнэ: түүний дугаарыг ажилтан
    // дахин бүртгэж болдог (BR-05) тул хоёрдмол утгатай хариу өгөхгүй.
    if (!pkg || pkg.status === 'cancelled') {
      throw new APIError('Энэ дугаартай ачаа олдсонгүй', httpStatus.NOT_FOUND);
    }

    return {
      trackingNumber: pkg.trackingNumber,
      status: pkg.status,
      phoneHint: maskPhone(pkg.customerPhone),
      arrivedAt: pkg.arrivedAt,
      registeredAt: pkg.createdAt,
      history: (pkg.statusHistory ?? []).map(h => ({ to: h.to, at: h.at })),
    };
  }

  /**
   * §3 — утасны дугаараар хайх (нүүр хуудасны хайлтын карт).
   *
   * ⚠ Аюулгүй байдлын зайлшгүй ялгаа `track()`-оос: энд ХЭН Ч мэдэхгүй хүний
   * утсаар түүний БҮХ ачааг харах боломжтой болно. Тиймээс:
   *   · Утас ЯГ БҮТЭН, нормчлогдсон хэлбэрээр таарсан үед л хайна (prefix/regex
   *     ХОРИГЛОНО) — эс тэгвээс дугаарыг цифр цифрээр туршиж, хэн ямар утастай
   *     байгааг илрүүлэх (enumeration) боломж нээгдэнэ.
   *   · `publicLimiter`-т захирагдана (route-д хавсаргасан) — хайлт бүрд
   *     дараалсан оролдлого хязгаарлагдана.
   *   · Хариу нь `track()`-тэй ижил цагаан жагсаалт — үнэ, үлдэгдэл, бүтэн
   *     утас, дотоод талбар БАЙХГҮЙ.
   *   · §9.3 — хуудаслагдсан, индекслэгдсэн (`customerPhone + createdAt`) талбараар.
   */
  async trackByPhone(phone, { page = 1, limit = 20 } = {}) {
    let normalized;
    try {
      normalized = normalizePhone(phone);
    } catch {
      throw new APIError('Утасны дугаар буруу байна', httpStatus.BAD_REQUEST);
    }

    const result = await packageRepository.search(
      { customerPhone: normalized, status: { $ne: PACKAGE_STATUS.CANCELLED } },
      { page, limit, sort: '-createdAt' }
    );

    return {
      data: result.docs.map(pkg => ({
        trackingNumber: pkg.trackingNumber,
        status: pkg.status,
        arrivedAt: pkg.arrivedAt,
        registeredAt: pkg.createdAt,
      })),
      pagination: {
        page: result.page,
        pages: result.totalPages,
        total: result.totalDocs,
        limit: result.limit,
      },
    };
  }

  /**
   * §3, roadmap 5.10 — нүүр хуудасны "Энгийн, ил тод тариф" хэсэг.
   *
   * ⚠ Энэ бол ТУХАЙН ХАРИЛЦАГЧИЙН биш, компанийн НИЙТ нийтэлсэн үнийн
   * жагсаалт (rate card) — аль ч ачаа, хэрэглэгчтэй холбоогүй. Тиймээс
   * `track()`-ийн "үнэ харуулахгүй" хязгаарлалт энд ХАМААРАХГҮЙ: энгийн
   * ачааны идэвхтэй тарифыг шууд буцаана. Тариф идэвхгүй/олдоогүй бол `null`
   * буцаана — frontend "лавлана уу" гэсэн шударга харагдацтай.
   */
  async pricing() {
    const cargoType = await cargoTypeRepository.findByCode(PUBLIC_PRICING_CARGO_TYPE_CODE);
    if (!cargoType) return null;

    const tariff = await tariffVersionRepository.findActive(cargoType._id);
    if (!tariff) return null;

    return {
      pricePerKgAbove: tariff.pricePerKgAbove,
      pricePerM3: tariff.pricePerM3,
      minimumCharge: tariff.minimumCharge,
      weightBrackets: (tariff.weightBrackets ?? []).map(b => ({
        maxGrams: b.maxGrams,
        price: b.price,
      })),
    };
  }

  /**
   * §3, roadmap 5.9/5.10 — админаас засварлагдах статик агуулга.
   *
   * Бүх түлхүүрийг нэг хүсэлтээр буцаана: хуудас бүр 3–4 салангид дуудлага
   * хийхээс сэргийлнэ. Хариу нь бүхэлдээ нээлттэй тул `PUBLIC_CONTENT_KEYS`
   * жагсаалтад БАЙГАА түлхүүр л орно.
   */
  async content() {
    const all = await settingService.getAll();
    const out = {};
    for (const key of PUBLIC_CONTENT_KEYS) {
      // `content.` угтварыг хассан богино нэрээр буцаана: `erenhot_address`
      out[key.replace(/^content\./, '')] = all[key] ?? SETTING_DEFAULTS[key] ?? null;
    }
    return out;
  }
}

module.exports = new PublicService();
