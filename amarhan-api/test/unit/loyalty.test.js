'use strict';

const { expect } = require('chai');
const {
  BPS_DENOMINATOR,
  LoyaltyError,
  normalizeTiers,
  resolveTier,
  nextTierGap,
  computeEarn,
  maxRedeemable,
  assertRedeemable,
} = require('../../src/domain/loyalty');
const { SETTING_DEFAULTS, SETTING_KEY } = require('../../src/config/constants');

/**
 * Урамшууллын цөм дүрэм — introduction.md §4, BR-30…BR-33a, BR-48.
 *
 * docs/testing.md §1: домэйн функц 100% хучигдана. Кредит = мөнгө (1 = 1₮) —
 * дугуйруулалтын 1₮-ийн алдаа мянган харилцагчид үржигдэнэ.
 */
describe('Урамшуулал — домэйн дүрэм (§4)', () => {
  const TIERS = SETTING_DEFAULTS[SETTING_KEY.LOYALTY_PROGRAM].tiers;

  describe('normalizeTiers', () => {
    it('босгоор өсөхөөр эрэмбэлнэ', () => {
      const shuffled = [TIERS[2], TIERS[0], TIERS[3], TIERS[1]];
      expect(normalizeTiers(shuffled).map(t => t.code)).to.deep.equal([
        'bronze',
        'silver',
        'gold',
        'platinum',
      ]);
    });

    it('анхны тохиргоо эзэмшигчийн тоотой таарна', () => {
      expect(TIERS.map(t => [t.code, t.minSpent, t.rateBps])).to.deep.equal([
        ['bronze', 0, 100],
        ['silver', 150000, 300],
        ['gold', 500000, 350],
        ['platinum', 1500000, 500],
      ]);
    });

    it('хоосон/массив биш бол алдаа', () => {
      expect(() => normalizeTiers([])).to.throw(LoyaltyError);
      expect(() => normalizeTiers(null)).to.throw(LoyaltyError);
    });

    it('доод түвшин 0₮-өөс эхлэхгүй бол алдаа', () => {
      expect(() => normalizeTiers([{ code: 'a', name: 'A', minSpent: 10, rateBps: 100 }])).to.throw(
        /0₮/
      );
    });

    it('кодгүй түвшин алдаа', () => {
      expect(() => normalizeTiers([{ name: 'A', minSpent: 0, rateBps: 100 }])).to.throw(/код/);
    });

    it('бутархай босго алдаа', () => {
      expect(() =>
        normalizeTiers([
          { code: 'a', minSpent: 0, rateBps: 100 },
          { code: 'b', minSpent: 10.5, rateBps: 100 },
        ])
      ).to.throw(/босго/);
    });

    it('хувь 0–100%-иас гадуур эсвэл бутархай бол алдаа', () => {
      expect(() => normalizeTiers([{ code: 'a', minSpent: 0, rateBps: 10001 }])).to.throw(/хувь/);
      expect(() => normalizeTiers([{ code: 'a', minSpent: 0, rateBps: -1 }])).to.throw(/хувь/);
      expect(() => normalizeTiers([{ code: 'a', minSpent: 0, rateBps: 1.5 }])).to.throw(/хувь/);
    });

    it('давхардсан босго алдаа', () => {
      expect(() =>
        normalizeTiers([
          { code: 'a', minSpent: 0, rateBps: 100 },
          { code: 'b', minSpent: 0, rateBps: 200 },
        ])
      ).to.throw(/давхцахгүй/);
    });

    it('давхардсан код алдаа', () => {
      expect(() =>
        normalizeTiers([
          { code: 'a', minSpent: 0, rateBps: 100 },
          { code: 'a', minSpent: 10, rateBps: 200 },
        ])
      ).to.throw(/код давхардсан/);
    });
  });

  describe('resolveTier — BR-32 (12 сарын зарцуулалт)', () => {
    const cases = [
      [0, 'bronze'],
      [149999, 'bronze'],
      [150000, 'silver'],
      [499999, 'silver'],
      [500000, 'gold'],
      [1499999, 'gold'],
      [1500000, 'platinum'],
      [99000000, 'platinum'],
    ];
    for (const [spent, code] of cases) {
      it(`${spent}₮ → ${code}`, () => {
        expect(resolveTier(spent, TIERS).tier.code).to.equal(code);
      });
    }

    it('гараар тавьсан түвшин доод хязгаар болно (BR-33)', () => {
      expect(resolveTier(0, TIERS, 'gold').tier.code).to.equal('gold');
    });

    it('зарцуулалт гараар тавьснаас өндөр бол зарцуулалтаар', () => {
      expect(resolveTier(2000000, TIERS, 'silver').tier.code).to.equal('platinum');
    });

    it('танигдахгүй гар түвшинг үл тооно', () => {
      expect(resolveTier(0, TIERS, 'diamond').tier.code).to.equal('bronze');
    });

    it('сөрөг/бутархай зарцуулалт алдаа', () => {
      expect(() => resolveTier(-1, TIERS)).to.throw(LoyaltyError);
      expect(() => resolveTier(1.5, TIERS)).to.throw(LoyaltyError);
    });
  });

  describe('nextTierGap — дараагийн шат хүртэл', () => {
    it('Хүрэл 75 000₮ → Мөнгө хүртэл 75 000₮, 50%', () => {
      const gap = nextTierGap(75000, TIERS, 'bronze');
      expect(gap.next.code).to.equal('silver');
      expect(gap.remaining).to.equal(75000);
      expect(gap.progressBps).to.equal(5000);
    });

    it('прогресс ОДООГИЙН шатнаас тоологдоно (Алт → Платинум)', () => {
      // 500k → 1.5M зам: 1M-д хүрсэн бол 50%, 0₮-өөс тоолсон 66% БИШ
      const gap = nextTierGap(1000000, TIERS, 'gold');
      expect(gap.next.code).to.equal('platinum');
      expect(gap.remaining).to.equal(500000);
      expect(gap.progressBps).to.equal(5000);
    });

    it('хамгийн дээд түвшинд next = null, 100%', () => {
      const gap = nextTierGap(2000000, TIERS, 'platinum');
      expect(gap).to.deep.equal({ next: null, remaining: 0, progressBps: BPS_DENOMINATOR });
    });

    it('гараар ахисан (зарцуулалт босгоос доогуур) үед прогресс 0', () => {
      const gap = nextTierGap(10000, TIERS, 'gold');
      expect(gap.next.code).to.equal('platinum');
      expect(gap.remaining).to.equal(1490000);
      expect(gap.progressBps).to.equal(0);
    });

    it('танигдахгүй код → доод түвшнээс', () => {
      const gap = nextTierGap(0, TIERS, 'unknown');
      expect(gap.next.code).to.equal('bronze');
    });

    it('бутархай зарцуулалт алдаа', () => {
      expect(() => nextTierGap(0.5, TIERS, 'bronze')).to.throw(LoyaltyError);
    });
  });

  describe('computeEarn — BR-31', () => {
    it('1% — 35 000₮ → 350 кредит', () => {
      expect(computeEarn(35000, 100)).to.equal(350);
    });

    it('3.5% — floor (компанийн талд дугуйруулна)', () => {
      // 12 345 × 3.5% = 432.075 → 432
      expect(computeEarn(12345, 350)).to.equal(432);
    });

    it('float алдаагүй: 0.29 × 100 төрлийн хэргээ яг бодно', () => {
      // 29 × 10000 / 10000 — float-оор 28.999… гарч болох тохиолдол
      expect(computeEarn(29, 10000)).to.equal(29);
    });

    it('их дүн (1e9₮) яг таг', () => {
      expect(computeEarn(1000000000, 500)).to.equal(50000000);
    });

    it('0₮ → 0', () => {
      expect(computeEarn(0, 500)).to.equal(0);
    });

    it('буруу оролт алдаа', () => {
      expect(() => computeEarn(-1, 100)).to.throw(LoyaltyError);
      expect(() => computeEarn(100, 1.5)).to.throw(LoyaltyError);
      expect(() => computeEarn(100, -1)).to.throw(LoyaltyError);
    });
  });

  describe('maxRedeemable / assertRedeemable — BR-48', () => {
    it('кредит бага бол кредитээр хязгаарлагдана', () => {
      expect(maxRedeemable({ credits: 4500, payable: 30000, maxRedeemPercent: 100 })).to.equal(
        4500
      );
    });

    it('ачааны дүн бага бол 100% хүртэл', () => {
      expect(maxRedeemable({ credits: 50000, payable: 30000, maxRedeemPercent: 100 })).to.equal(
        30000
      );
    });

    it('хувийн хязгаар (50%) floor-оор', () => {
      expect(maxRedeemable({ credits: 50000, payable: 30001, maxRedeemPercent: 50 })).to.equal(
        15000
      );
    });

    it('сөрөг кредит → 0', () => {
      expect(maxRedeemable({ credits: -200, payable: 30000, maxRedeemPercent: 100 })).to.equal(0);
    });

    it('буруу оролт алдаа', () => {
      expect(() => maxRedeemable({ credits: 1.5, payable: 1, maxRedeemPercent: 100 })).to.throw(
        LoyaltyError
      );
      expect(() => maxRedeemable({ credits: 1, payable: -1, maxRedeemPercent: 100 })).to.throw(
        LoyaltyError
      );
      expect(() => maxRedeemable({ credits: 1, payable: 1, maxRedeemPercent: 101 })).to.throw(
        LoyaltyError
      );
      expect(() => maxRedeemable({ credits: 1, payable: 1, maxRedeemPercent: 1.5 })).to.throw(
        LoyaltyError
      );
    });

    it('хүчинтэй хүсэлт шидэхгүй', () => {
      expect(() =>
        assertRedeemable(30000, { credits: 30000, payable: 30000, maxRedeemPercent: 100 })
      ).to.not.throw();
    });

    it('0 эсвэл бутархай дүн алдаа', () => {
      expect(() =>
        assertRedeemable(0, { credits: 100, payable: 100, maxRedeemPercent: 100 })
      ).to.throw(LoyaltyError);
      expect(() =>
        assertRedeemable(1.5, { credits: 100, payable: 100, maxRedeemPercent: 100 })
      ).to.throw(LoyaltyError);
    });

    it('кредитээс их бол INSUFFICIENT_CREDIT', () => {
      try {
        assertRedeemable(501, { credits: 500, payable: 10000, maxRedeemPercent: 100 });
        expect.fail('шидэх ёстой');
      } catch (err) {
        expect(err.code).to.equal('INSUFFICIENT_CREDIT');
      }
    });

    it('сөрөг кредиттэй үед мессеж 0-ийг харуулна', () => {
      expect(() =>
        assertRedeemable(1, { credits: -10, payable: 10000, maxRedeemPercent: 100 })
      ).to.throw(/боломжит: 0/);
    });

    it('ачааны дүнгээс их бол CREDIT_LIMIT_EXCEEDED', () => {
      try {
        assertRedeemable(10001, { credits: 50000, payable: 10000, maxRedeemPercent: 100 });
        expect.fail('шидэх ёстой');
      } catch (err) {
        expect(err.code).to.equal('CREDIT_LIMIT_EXCEEDED');
      }
    });
  });
});
