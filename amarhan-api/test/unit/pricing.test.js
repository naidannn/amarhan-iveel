'use strict';

const { expect } = require('chai');
const {
  calculatePrice,
  calculateVolumeM3,
  isWithinOverrideLimit,
} = require('../../src/domain/pricing');

/**
 * Мөнгөний тооцоолол — алдаа нь шууд алдагдал болно.
 * docs/testing.md §1: энэ файл 100% branch coverage шаардлагатай.
 */
describe('BR-01 — Ачааны үнэ тооцоолол (§1.2)', () => {
  // 5,000₮/кг · 40,000₮/м³ · доод хэмжээ 5,000₮
  const tariff = { pricePerKg: 5000, pricePerM3: 40000, minimumCharge: 5000 };

  describe('Жин ба эзлэхүүнээс өндрийг сонгоно', () => {
    it('жингээр бодсон дүн их бол түүнийг сонгоно', () => {
      // 10кг × 5000 = 50,000  |  0.1м³ × 40000 = 4,000
      const r = calculatePrice({ weightKg: 10, volumeM3: 0.1, tariff });
      expect(r.byWeight).to.equal(50000);
      expect(r.byVolume).to.equal(4000);
      expect(r.final).to.equal(50000);
      expect(r.source).to.equal('weight');
    });

    it('эзлэхүүнээр бодсон дүн их бол түүнийг сонгоно', () => {
      // 2кг × 5000 = 10,000  |  0.5м³ × 40000 = 20,000
      const r = calculatePrice({ weightKg: 2, volumeM3: 0.5, tariff });
      expect(r.byWeight).to.equal(10000);
      expect(r.byVolume).to.equal(20000);
      expect(r.final).to.equal(20000);
      expect(r.source).to.equal('volume');
    });

    it('хоёулаа тэнцүү бол жинг сонгоно (тогтвортой байдлын үүднээс)', () => {
      // 4кг × 5000 = 20,000  |  0.5м³ × 40000 = 20,000
      const r = calculatePrice({ weightKg: 4, volumeM3: 0.5, tariff });
      expect(r.final).to.equal(20000);
      expect(r.source).to.equal('weight');
    });
  });

  describe('Зөвхөн нэг хэмжигдэхүүн өгсөн үед', () => {
    it('зөвхөн жин өгвөл жингээр бодно', () => {
      const r = calculatePrice({ weightKg: 10, volumeM3: null, tariff });
      expect(r.byVolume).to.equal(0);
      expect(r.final).to.equal(50000);
      expect(r.source).to.equal('weight');
    });

    it('зөвхөн эзлэхүүн өгвөл эзлэхүүнээр бодно', () => {
      const r = calculatePrice({ weightKg: null, volumeM3: 2, tariff });
      expect(r.byWeight).to.equal(0);
      expect(r.final).to.equal(80000);
      expect(r.source).to.equal('volume');
    });

    it('хоосон мөрийг байхгүйтэй адилтгана', () => {
      const r = calculatePrice({ weightKg: '', volumeM3: 2, tariff });
      expect(r.final).to.equal(80000);
    });

    it('хоёулаа байхгүй бол алдаа өгнө (§1.1)', () => {
      expect(() => calculatePrice({ weightKg: null, volumeM3: null, tariff })).to.throw(
        /ядаж нэгийг/
      );
    });

    it('хоёулаа тэг бол алдаа өгнө', () => {
      expect(() => calculatePrice({ weightKg: 0, volumeM3: 0, tariff })).to.throw(/ядаж нэгийг/);
    });
  });

  describe('Доод хэмжээний төлбөр', () => {
    it('бодсон дүн доод хэмжээнээс бага бол доод хэмжээг ашиглана', () => {
      // 0.2кг × 5000 = 1,000  |  0.01м³ × 40000 = 400  → доод хэмжээ 5,000
      const r = calculatePrice({ weightKg: 0.2, volumeM3: 0.01, tariff });
      expect(r.computed).to.equal(1000);
      expect(r.final).to.equal(5000);
      expect(r.source).to.equal('minimum');
    });

    it('бодсон дүн доод хэмжээтэй яг тэнцүү бол minimum биш гэж үзнэ', () => {
      // 1кг × 5000 = 5,000 = доод хэмжээ
      const r = calculatePrice({ weightKg: 1, volumeM3: null, tariff });
      expect(r.final).to.equal(5000);
      expect(r.source).to.equal('weight');
    });

    it('доод хэмжээ 0 бол хэзээ ч minimum болохгүй', () => {
      const zeroMin = { pricePerKg: 5000, pricePerM3: 40000, minimumCharge: 0 };
      const r = calculatePrice({ weightKg: 0.001, volumeM3: null, tariff: zeroMin });
      expect(r.source).to.equal('weight');
    });
  });

  describe('Дугуйруулалт ба бүхэл тоо', () => {
    it('үр дүн үргэлж бүхэл тоо байна', () => {
      const r = calculatePrice({ weightKg: 1.234, volumeM3: 0.0567, tariff });
      expect(r.byWeight % 1).to.equal(0);
      expect(r.byVolume % 1).to.equal(0);
      expect(r.final % 1).to.equal(0);
    });

    it('2 орны нарийвчлалтай жинг зөв бодно', () => {
      // 1.55кг × 5000 = 7,750
      const r = calculatePrice({ weightKg: 1.55, volumeM3: null, tariff });
      expect(r.final).to.equal(7750);
    });

    it('float алдаа гарахгүй (0.1 + 0.2 асуудал)', () => {
      // 0.3кг × 10000 = 3,000 яг таарах ёстой
      const t = { pricePerKg: 10000, pricePerM3: 1, minimumCharge: 0 };
      const r = calculatePrice({ weightKg: 0.1 + 0.2, volumeM3: null, tariff: t });
      expect(r.final).to.equal(3000);
    });
  });

  describe('Буруу оролт', () => {
    it('тариф байхгүй бол алдаа', () => {
      expect(() => calculatePrice({ weightKg: 1, tariff: null })).to.throw(/Тариф заагаагүй/);
    });

    it('тарифын талбар сөрөг бол алдаа', () => {
      const bad = { pricePerKg: -1, pricePerM3: 40000, minimumCharge: 5000 };
      expect(() => calculatePrice({ weightKg: 1, tariff: bad })).to.throw(/pricePerKg/);
    });

    it('тарифын талбар дутуу бол алдаа', () => {
      const bad = { pricePerKg: 5000, pricePerM3: 40000 };
      expect(() => calculatePrice({ weightKg: 1, tariff: bad })).to.throw(/minimumCharge/);
    });

    it('сөрөг жин бол алдаа', () => {
      expect(() => calculatePrice({ weightKg: -5, tariff })).to.throw(/Жин/);
    });

    it('тоо биш жин бол алдаа', () => {
      expect(() => calculatePrice({ weightKg: 'хүнд', tariff })).to.throw(/Жин/);
    });

    it('сөрөг эзлэхүүн бол алдаа', () => {
      expect(() => calculatePrice({ weightKg: 1, volumeM3: -1, tariff })).to.throw(/Эзлэхүүн/);
    });
  });
});

describe('BR-03 — Хэмжээснээс эзлэхүүн бодох', () => {
  it('см-ээс м³ рүү зөв хөрвүүлнэ', () => {
    // 100×100×100 см = 1,000,000 см³ = 1 м³
    expect(calculateVolumeM3({ lengthCm: 100, widthCm: 100, heightCm: 100 })).to.equal(1);
  });

  it('жижиг хайрцгийг 4 орны нарийвчлалаар бодно', () => {
    // 30×20×15 = 9,000 см³ = 0.009 м³
    expect(calculateVolumeM3({ lengthCm: 30, widthCm: 20, heightCm: 15 })).to.equal(0.009);
  });

  it('маш жижиг эзлэхүүнийг 4 оронд дугуйруулна', () => {
    // 10×10×10 = 1,000 см³ = 0.001 м³
    expect(calculateVolumeM3({ lengthCm: 10, widthCm: 10, heightCm: 10 })).to.equal(0.001);
  });

  it('тэг эсвэл сөрөг хэмжээст алдаа өгнө', () => {
    expect(() => calculateVolumeM3({ lengthCm: 0, widthCm: 10, heightCm: 10 })).to.throw(/Урт/);
    expect(() => calculateVolumeM3({ lengthCm: 10, widthCm: -1, heightCm: 10 })).to.throw(/Өргөн/);
    expect(() => calculateVolumeM3({ lengthCm: 10, widthCm: 10, heightCm: null })).to.throw(
      /Өндөр/
    );
  });
});

describe('BR-04 — Override-ийн хязгаар (§1.2, §9.1)', () => {
  it('хязгаарт багтсан хямдралыг зөвшөөрнө', () => {
    // 20% хязгаар: 30,000-аас 24,000 хүртэл
    expect(isWithinOverrideLimit(30000, 25000, 20)).to.equal(true);
  });

  it('хязгаарт багтсан нэмэгдлийг зөвшөөрнө', () => {
    expect(isWithinOverrideLimit(30000, 35000, 20)).to.equal(true);
  });

  it('яг хязгаар дээрх утгыг зөвшөөрнө', () => {
    expect(isWithinOverrideLimit(30000, 24000, 20)).to.equal(true);
    expect(isWithinOverrideLimit(30000, 36000, 20)).to.equal(true);
  });

  it('хязгаараас давсныг зөвшөөрөхгүй', () => {
    expect(isWithinOverrideLimit(30000, 23999, 20)).to.equal(false);
    expect(isWithinOverrideLimit(30000, 36001, 20)).to.equal(false);
  });

  it('хязгаар 0 бол зөвхөн яг тэнцүү дүнг зөвшөөрнө', () => {
    expect(isWithinOverrideLimit(30000, 30000, 0)).to.equal(true);
    expect(isWithinOverrideLimit(30000, 30001, 0)).to.equal(false);
  });

  it('буруу оролтод false буцаана', () => {
    expect(isWithinOverrideLimit(0, 100, 20)).to.equal(false);
    expect(isWithinOverrideLimit(30000, -1, 20)).to.equal(false);
    expect(isWithinOverrideLimit(30000, 25000, -5)).to.equal(false);
    expect(isWithinOverrideLimit(NaN, 25000, 20)).to.equal(false);
  });
});
