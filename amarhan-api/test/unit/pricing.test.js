'use strict';

const { expect } = require('chai');
const {
  calculatePrice,
  calculateVolumeM3,
  isWithinOverrideLimit,
  assertValidBrackets,
} = require('../../src/domain/pricing');

/**
 * Мөнгөний тооцоолол — алдаа нь шууд алдагдал болно.
 * docs/testing.md §1: энэ файл 100% branch coverage шаардлагатай.
 *
 * Тоон утгууд нь Ивээл Каргогийн БОДИТ тариф:
 *   1–100гр = 800₮ · 101–500гр = 1,500₮ · 501гр–1кг = 2,000₮
 *   Гутал/нугалахгүй = 2,500₮/кг · 1м³ = 400,000₮
 */
describe('BR-01 — Ачааны үнэ тооцоолол (§1.2)', () => {
  // Энгийн ачаа — жингийн шатлалтай
  const standard = {
    weightBrackets: [
      { maxGrams: 100, price: 800 },
      { maxGrams: 500, price: 1500 },
      { maxGrams: 1000, price: 2000 },
    ],
    pricePerKgAbove: 2000,
    pricePerM3: 400000,
    minimumCharge: 0,
  };

  // Гутал / нугалахгүй ачаа — шатлалгүй, эхнээсээ кг тутмаар
  const bulky = {
    weightBrackets: [],
    pricePerKgAbove: 2500,
    pricePerM3: 400000,
    minimumCharge: 0,
  };

  describe('Жингийн шатлал — тогтмол үнэ', () => {
    const cases = [
      { grams: 1, expected: 800, label: '1гр' },
      { grams: 50, expected: 800, label: '50гр' },
      { grams: 100, expected: 800, label: 'яг 100гр (хилийн утга)' },
      { grams: 101, expected: 1500, label: '101гр (дараагийн шатлал)' },
      { grams: 300, expected: 1500, label: '300гр' },
      { grams: 500, expected: 1500, label: 'яг 500гр (хилийн утга)' },
      { grams: 501, expected: 2000, label: '501гр' },
      { grams: 750, expected: 2000, label: '750гр' },
      { grams: 1000, expected: 2000, label: 'яг 1кг (хилийн утга)' },
    ];

    cases.forEach(({ grams, expected, label }) => {
      it(`${label} → ${expected.toLocaleString()}₮`, () => {
        const r = calculatePrice({ weightKg: grams / 1000, tariff: standard });
        expect(r.byWeight).to.equal(expected);
        expect(r.final).to.equal(expected);
        expect(r.appliedBracket, 'шатлал хэрэглэгдсэн байх ёстой').to.not.be.null;
      });
    });

    it('шатлалын хилийн утга дээр хөвөгч таслалын алдаа гарахгүй', () => {
      // 0.5 кг = 500 гр яг таарах ёстой, 500.0000001 болж болохгүй
      const r = calculatePrice({ weightKg: 0.5, tariff: standard });
      expect(r.byWeight).to.equal(1500);
    });
  });

  describe('Шатлалаас дээш — кг тутмын үнэ', () => {
    it('1кг-аас хүнд бол кг тутмаар тооцно', () => {
      const r = calculatePrice({ weightKg: 2, tariff: standard });
      expect(r.byWeight).to.equal(4000); // 2кг × 2,000₮
      expect(r.appliedBracket, 'шатлал хэрэглэгдэхгүй').to.be.null;
      expect(r.chargeableKg).to.equal(2);
    });

    it('бутархай кг-ыг ДЭЭШ дугуйруулна (карго салбарын практик)', () => {
      // 1.2кг → 2кг-аар тооцно
      const r = calculatePrice({ weightKg: 1.2, tariff: standard });
      expect(r.chargeableKg).to.equal(2);
      expect(r.byWeight).to.equal(4000);
    });

    it('1.01кг ч 2кг-аар тооцогдоно', () => {
      const r = calculatePrice({ weightKg: 1.01, tariff: standard });
      expect(r.byWeight).to.equal(4000);
    });
  });

  describe('Шатлалгүй тариф (гутал / нугалахгүй ачаа)', () => {
    it('жижиг ачааг ч 1кг-аар тооцно', () => {
      const r = calculatePrice({ weightKg: 0.3, tariff: bulky });
      expect(r.chargeableKg).to.equal(1);
      expect(r.byWeight).to.equal(2500);
    });

    it('3кг гутал = 7,500₮', () => {
      const r = calculatePrice({ weightKg: 3, tariff: bulky });
      expect(r.byWeight).to.equal(7500);
    });

    it('2.4кг → 3кг-аар тооцогдоно', () => {
      const r = calculatePrice({ weightKg: 2.4, tariff: bulky });
      expect(r.chargeableKg).to.equal(3);
      expect(r.byWeight).to.equal(7500);
    });
  });

  describe('Эзлэхүүнтэй харьцуулах — өндрийг сонгоно', () => {
    it('хөнгөн боловч эзлэхүүн ихтэй ачааг эзлэхүүнээр тооцно', () => {
      // 200гр гутлын хайрцаг (шатлал 1,500₮) боловч 0.05м³ = 20,000₮
      const r = calculatePrice({ weightKg: 0.2, volumeM3: 0.05, tariff: standard });
      expect(r.byWeight).to.equal(1500);
      expect(r.byVolume).to.equal(20000);
      expect(r.final).to.equal(20000);
      expect(r.source).to.equal('volume');
    });

    it('хүнд боловч жижиг ачааг жингээр тооцно', () => {
      // 5кг төмөр эд анги = 10,000₮, эзлэхүүн 0.01м³ = 4,000₮
      const r = calculatePrice({ weightKg: 5, volumeM3: 0.01, tariff: standard });
      expect(r.byWeight).to.equal(10000);
      expect(r.byVolume).to.equal(4000);
      expect(r.final).to.equal(10000);
      expect(r.source).to.equal('weight');
    });

    it('1м³ = 400,000₮', () => {
      const r = calculatePrice({ volumeM3: 1, tariff: standard });
      expect(r.byVolume).to.equal(400000);
      expect(r.final).to.equal(400000);
    });

    it('тэнцүү үед жинг сонгоно (тогтвортой байдлын үүднээс)', () => {
      // 2кг = 4,000₮  |  0.01м³ = 4,000₮
      const r = calculatePrice({ weightKg: 2, volumeM3: 0.01, tariff: standard });
      expect(r.final).to.equal(4000);
      expect(r.source).to.equal('weight');
    });
  });

  describe('Зөвхөн нэг хэмжигдэхүүн өгсөн үед', () => {
    it('зөвхөн жин өгвөл жингээр бодно', () => {
      const r = calculatePrice({ weightKg: 0.05, volumeM3: null, tariff: standard });
      expect(r.byVolume).to.equal(0);
      expect(r.final).to.equal(800);
    });

    it('зөвхөн эзлэхүүн өгвөл эзлэхүүнээр бодно', () => {
      const r = calculatePrice({ weightKg: null, volumeM3: 0.5, tariff: standard });
      expect(r.byWeight).to.equal(0);
      expect(r.final).to.equal(200000);
      expect(r.source).to.equal('volume');
    });

    it('хоосон мөрийг байхгүйтэй адилтгана', () => {
      const r = calculatePrice({ weightKg: '', volumeM3: 0.5, tariff: standard });
      expect(r.final).to.equal(200000);
    });

    it('хоёулаа байхгүй бол алдаа өгнө (§1.1)', () => {
      expect(() => calculatePrice({ weightKg: null, volumeM3: null, tariff: standard })).to.throw(
        /ядаж нэгийг/
      );
    });

    it('хоёулаа тэг бол алдаа өгнө', () => {
      expect(() => calculatePrice({ weightKg: 0, volumeM3: 0, tariff: standard })).to.throw(
        /ядаж нэгийг/
      );
    });
  });

  describe('Доод хэмжээний төлбөр', () => {
    const withMinimum = { ...standard, minimumCharge: 5000 };

    it('бодсон дүн доод хэмжээнээс бага бол доод хэмжээг ашиглана', () => {
      const r = calculatePrice({ weightKg: 0.05, tariff: withMinimum });
      expect(r.computed).to.equal(800);
      expect(r.final).to.equal(5000);
      expect(r.source).to.equal('minimum');
    });

    it('доод хэмжээтэй яг тэнцүү бол minimum биш гэж үзнэ', () => {
      // 2.5кг → 3кг × 2,000 = 6,000 > 5,000
      const r = calculatePrice({ weightKg: 2.5, tariff: withMinimum });
      expect(r.final).to.equal(6000);
      expect(r.source).to.equal('weight');
    });

    it('доод хэмжээ заагаагүй бол 0 гэж үзнэ', () => {
      const noMin = { ...standard };
      delete noMin.minimumCharge;
      const r = calculatePrice({ weightKg: 0.05, tariff: noMin });
      expect(r.final).to.equal(800);
      expect(r.source).to.equal('weight');
    });
  });

  describe('Дугуйруулалт ба бүхэл тоо', () => {
    it('үр дүн үргэлж бүхэл тоо байна', () => {
      const r = calculatePrice({ weightKg: 1.234, volumeM3: 0.0567, tariff: standard });
      expect(r.byWeight % 1).to.equal(0);
      expect(r.byVolume % 1).to.equal(0);
      expect(r.final % 1).to.equal(0);
    });

    it('эзлэхүүний бутархай үржвэрийг зөв дугуйруулна', () => {
      // 0.0567м³ × 400,000 = 22,680
      const r = calculatePrice({ volumeM3: 0.0567, tariff: standard });
      expect(r.byVolume).to.equal(22680);
    });

    it('float алдаа гарахгүй (0.1 + 0.2 асуудал)', () => {
      // 0.30000000000000004 кг = 300гр → 1,500₮ шатлал
      const r = calculatePrice({ weightKg: 0.1 + 0.2, tariff: standard });
      expect(r.byWeight).to.equal(1500);
    });
  });

  describe('Буруу оролт', () => {
    it('тариф байхгүй бол алдаа', () => {
      expect(() => calculatePrice({ weightKg: 1, tariff: null })).to.throw(/Тариф заагаагүй/);
    });

    it('pricePerKgAbove сөрөг бол алдаа', () => {
      expect(() =>
        calculatePrice({ weightKg: 1, tariff: { ...standard, pricePerKgAbove: -1 } })
      ).to.throw(/pricePerKgAbove/);
    });

    it('pricePerM3 дутуу бол алдаа', () => {
      const bad = { ...standard };
      delete bad.pricePerM3;
      expect(() => calculatePrice({ weightKg: 1, tariff: bad })).to.throw(/pricePerM3/);
    });

    it('minimumCharge сөрөг бол алдаа', () => {
      expect(() =>
        calculatePrice({ weightKg: 1, tariff: { ...standard, minimumCharge: -5 } })
      ).to.throw(/minimumCharge/);
    });

    it('сөрөг жин бол алдаа', () => {
      expect(() => calculatePrice({ weightKg: -5, tariff: standard })).to.throw(/Жин/);
    });

    it('тоо биш жин бол алдаа', () => {
      expect(() => calculatePrice({ weightKg: 'хүнд', tariff: standard })).to.throw(/Жин/);
    });

    it('сөрөг эзлэхүүн бол алдаа', () => {
      expect(() => calculatePrice({ weightKg: 1, volumeM3: -1, tariff: standard })).to.throw(
        /Эзлэхүүн/
      );
    });
  });
});

describe('Жингийн шатлалын бүтэц', () => {
  it('зөв шатлалыг хүлээж авна', () => {
    expect(() =>
      assertValidBrackets([
        { maxGrams: 100, price: 800 },
        { maxGrams: 500, price: 1500 },
      ])
    ).to.not.throw();
  });

  it('хоосон жагсаалтыг зөвшөөрнө (шатлалгүй тариф)', () => {
    expect(() => assertValidBrackets([])).to.not.throw();
  });

  it('буурах дараалалтай шатлалыг хориглоно', () => {
    expect(() =>
      assertValidBrackets([
        { maxGrams: 500, price: 1500 },
        { maxGrams: 100, price: 800 },
      ])
    ).to.throw(/их байх ёстой/);
  });

  it('давхардсан хязгаарыг хориглоно', () => {
    expect(() =>
      assertValidBrackets([
        { maxGrams: 100, price: 800 },
        { maxGrams: 100, price: 900 },
      ])
    ).to.throw(/их байх ёстой/);
  });

  it('бутархай үнийг хориглоно', () => {
    expect(() => assertValidBrackets([{ maxGrams: 100, price: 800.5 }])).to.throw(/бүхэл тоо/);
  });

  it('сөрөг эсвэл тэг maxGrams-ыг хориглоно', () => {
    expect(() => assertValidBrackets([{ maxGrams: 0, price: 800 }])).to.throw(/maxGrams/);
  });

  it('массив биш бол алдаа', () => {
    expect(() => assertValidBrackets('шатлал')).to.throw(/массив/);
  });
});

describe('BR-03 — Хэмжээснээс эзлэхүүн бодох', () => {
  it('см-ээс м³ рүү зөв хөрвүүлнэ', () => {
    expect(calculateVolumeM3({ lengthCm: 100, widthCm: 100, heightCm: 100 })).to.equal(1);
  });

  it('жижиг хайрцгийг 4 орны нарийвчлалаар бодно', () => {
    expect(calculateVolumeM3({ lengthCm: 30, widthCm: 20, heightCm: 15 })).to.equal(0.009);
  });

  it('маш жижиг эзлэхүүнийг 4 оронд дугуйруулна', () => {
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
