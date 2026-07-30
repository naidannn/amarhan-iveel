'use strict';

const httpStatus = require('http-status');
const packageRepository = require('../repositories/package.repository');
const settingService = require('./setting.service');
const APIError = require('../utils/APIError');
const { maskPhone } = require('../domain/phone');
const { PUBLIC_CONTENT_KEYS, SETTING_DEFAULTS } = require('../config/constants');

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
