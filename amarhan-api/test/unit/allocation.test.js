'use strict';

const { expect } = require('chai');
const {
  allocateProportionally,
  validateManualAllocations,
  assertSumMatches,
  AllocationError,
} = require('../../src/domain/allocation');

/**
 * Төлбөрийн хуваарилалт — introduction.md §2.3, BR-16/BR-17
 *
 * docs/testing.md §1: 100% branch coverage шаардлагатай. Хуваарилалтын
 * нийлбэр ₮1 зөрвөл ачааны үлдэгдэл буруу болж, төлөгдөөгүй ачаа хүргэлтэнд
 * гарна — тиймээс ХАМГИЙН ЧУХАЛ ТОГТМОЛЫГ (Σ = amount) бүх замд шалгана.
 */
describe('BR-17 — Пропорциональ хуваарилалт (§2.3)', () => {
  const pkg = (id, balance) => ({ packageId: id, balance });

  describe('Тогтмол: Σ allocations === amount', () => {
    it('тэнцүү үлдэгдэлтэй хоёр ачаанд тэгш хуваана', () => {
      const result = allocateProportionally(10000, [pkg('a', 5000), pkg('b', 5000)]);

      expect(result).to.deep.equal([
        { packageId: 'a', amount: 5000 },
        { packageId: 'b', amount: 5000 },
      ]);
    });

    it('үлдэгдлийн харьцаагаар хуваарилна', () => {
      // Үлдэгдэл 3,000 : 1,000 = 3 : 1. 2,000₮ төлөхөд → 1,500 ба 500
      const result = allocateProportionally(2000, [pkg('a', 3000), pkg('b', 1000)]);

      expect(result[0].amount).to.equal(1500);
      expect(result[1].amount).to.equal(500);
    });

    it('ХУВААГДАХГҮЙ дүнг дугуйруулж, үлдэгдлийг СҮҮЛИЙН ачаанд нэмнэ', () => {
      // 100₮ / 3 тэнцүү ачаа = 33.33… → floor = 33, 33, 33 = 99, үлдэгдэл 1
      const result = allocateProportionally(100, [pkg('a', 1000), pkg('b', 1000), pkg('c', 1000)]);

      expect(result.map(r => r.amount)).to.deep.equal([33, 33, 34]);
      expect(result.reduce((s, r) => s + r.amount, 0)).to.equal(100);
    });

    it('7 ачаанд хуваахад ч нийлбэр ЯГ таарна', () => {
      const targets = Array.from({ length: 7 }, (_, i) => pkg(`p${i}`, 1000));
      const result = allocateProportionally(1000, targets);

      expect(result.reduce((s, r) => s + r.amount, 0)).to.equal(1000);
    });

    it('20 ачаа, санамсаргүй үлдэгдэл — нийлбэр үргэлж таарна (§2.3 шалгуур)', () => {
      const targets = Array.from({ length: 20 }, (_, i) => pkg(`p${i}`, 1000 + i * 137));
      const totalBalance = targets.reduce((s, t) => s + t.balance, 0);

      // Бүх боломжит дүн дээр тогтмолыг шалгана
      for (const amount of [1, 7, 999, 12345, totalBalance - 1, totalBalance]) {
        const result = allocateProportionally(amount, targets);
        expect(
          result.reduce((s, r) => s + r.amount, 0),
          `дүн ${amount}`
        ).to.equal(amount);
      }
    });

    it('ТОМ дүн — `Number.MAX_SAFE_INTEGER` хэтрэхэд ч яг таарна', () => {
      // amount × balance = 1e9 × 1e9 = 1e18 > MAX_SAFE_INTEGER (≈9.007e15).
      // BigInt-гүй бол энэ тест унана.
      const targets = [pkg('a', 1_000_000_000), pkg('b', 999_999_999)];
      const result = allocateProportionally(1_000_000_000, targets);

      expect(result.reduce((s, r) => s + r.amount, 0)).to.equal(1_000_000_000);
    });
  });

  describe('Хэсэгчилсэн төлбөр (BR-13)', () => {
    it('нийт үлдэгдлээс бага дүнг хуваарилна', () => {
      const result = allocateProportionally(5000, [pkg('a', 6000), pkg('b', 4000)]);

      expect(result[0].amount).to.equal(3000);
      expect(result[1].amount).to.equal(2000);
    });

    it('1₮ ч хуваарилагдана — сүүлийн ачаанд оногдоно', () => {
      const result = allocateProportionally(1, [pkg('a', 1000), pkg('b', 1000)]);

      // floor(1×1000/2000) = 0 хоёуланд, үлдэгдэл 1 нь сүүлийнхэд
      expect(result).to.deep.equal([{ packageId: 'b', amount: 1 }]);
    });
  });

  describe('Дүн 0 бүхий хуваарилалт хадгалагдахгүй', () => {
    it('0 ногдсон ачааг хасна', () => {
      // 1₮-ийг 3 ачаанд: floor нь бүгдэд 0, үлдэгдэл сүүлийнхэд
      const result = allocateProportionally(1, [pkg('a', 100), pkg('b', 100), pkg('c', 100)]);

      expect(result).to.have.lengthOf(1);
      expect(result[0].packageId).to.equal('c');
      expect(result[0].amount).to.equal(1);
    });

    it('үлдэгдэл 0 бүхий ачаа хуваарилалтад орохгүй', () => {
      const result = allocateProportionally(1000, [pkg('a', 1000), pkg('b', 0)]);

      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.equal({ packageId: 'a', amount: 1000 });
    });
  });

  describe('BR-15 — илүү төлөлт хориотой', () => {
    it('нийт үлдэгдлээс их дүнг хүлээж авахгүй', () => {
      expect(() => allocateProportionally(10001, [pkg('a', 10000)])).to.throw(
        AllocationError,
        /нийт үлдэгдлээс/
      );
    });

    it('яг нийт үлдэгдэлтэй тэнцэх дүнг зөвшөөрнө', () => {
      const result = allocateProportionally(10000, [pkg('a', 10000)]);
      expect(result[0].amount).to.equal(10000);
    });
  });

  describe('Буруу оролт', () => {
    it('бутархай дүнг хүлээж авахгүй (мөнгө = бүхэл тоо ₮)', () => {
      expect(() => allocateProportionally(100.5, [pkg('a', 1000)])).to.throw(
        AllocationError,
        /бүхэл тоо/
      );
    });

    it('сөрөг дүнг хүлээж авахгүй', () => {
      expect(() => allocateProportionally(-100, [pkg('a', 1000)])).to.throw(
        AllocationError,
        /сөрөг/
      );
    });

    it('ачаа заагаагүй бол алдаа', () => {
      expect(() => allocateProportionally(100, [])).to.throw(AllocationError, /заагаагүй/);
      expect(() => allocateProportionally(100, null)).to.throw(AllocationError, /заагаагүй/);
    });

    it('бүх ачаа төлөгдсөн бол алдаа', () => {
      expect(() => allocateProportionally(100, [pkg('a', 0), pkg('b', 0)])).to.throw(
        AllocationError,
        /бүрэн төлөгдсөн/
      );
    });

    it('бутархай үлдэгдэлтэй ачааг хүлээж авахгүй', () => {
      expect(() => allocateProportionally(100, [pkg('a', 100.5)])).to.throw(
        AllocationError,
        /бүхэл тоо/
      );
    });

    it('сөрөг үлдэгдэлтэй ачаанд хуваарилахгүй', () => {
      expect(() => allocateProportionally(100, [pkg('a', -500)])).to.throw(
        AllocationError,
        /сөрөг/
      );
    });
  });
});

describe('BR-17 — Ажилтны ГАРААР заасан хуваарилалт', () => {
  const balances = new Map([
    ['a', 5000],
    ['b', 3000],
  ]);

  it('нийлбэр таарсан хуваарилалтыг зөвшөөрнө', () => {
    const result = validateManualAllocations(
      8000,
      [
        { packageId: 'a', amount: 5000 },
        { packageId: 'b', amount: 3000 },
      ],
      balances
    );

    expect(result).to.have.lengthOf(2);
    expect(result.reduce((s, r) => s + r.amount, 0)).to.equal(8000);
  });

  it('НЭГ ачааг бүтнээр төлж, нөгөөг үлдээж болно (бодит хэрэгцээ)', () => {
    const result = validateManualAllocations(5000, [{ packageId: 'a', amount: 5000 }], balances);

    expect(result).to.deep.equal([{ packageId: 'a', amount: 5000 }]);
  });

  it('нийлбэр таарахгүй бол алдаа — тогтмол зөрчигдөхгүй', () => {
    expect(() =>
      validateManualAllocations(8000, [{ packageId: 'a', amount: 5000 }], balances)
    ).to.throw(AllocationError, /таарахгүй/);
  });

  it('ачааны үлдэгдлээс их дүн ногдуулахгүй (BR-15)', () => {
    expect(() =>
      validateManualAllocations(6000, [{ packageId: 'a', amount: 6000 }], balances)
    ).to.throw(AllocationError, /үлдэгдлээс/);
  });

  it('нэг ачаа хоёр удаа орвол алдаа', () => {
    expect(() =>
      validateManualAllocations(
        4000,
        [
          { packageId: 'a', amount: 2000 },
          { packageId: 'a', amount: 2000 },
        ],
        balances
      )
    ).to.throw(AllocationError, /хоёр удаа/);
  });

  it('жагсаалтад байхгүй ачаа заавал алдаа', () => {
    expect(() =>
      validateManualAllocations(1000, [{ packageId: 'zzz', amount: 1000 }], balances)
    ).to.throw(AllocationError, /байхгүй ачаа/);
  });

  it('дүн 0 бүхий хуваарилалтыг хүлээж авахгүй', () => {
    expect(() =>
      validateManualAllocations(
        5000,
        [
          { packageId: 'a', amount: 5000 },
          { packageId: 'b', amount: 0 },
        ],
        balances
      )
    ).to.throw(AllocationError, /0 байж болохгүй/);
  });

  it('хоосон хуваарилалтыг хүлээж авахгүй', () => {
    expect(() => validateManualAllocations(1000, [], balances)).to.throw(
      AllocationError,
      /заагаагүй/
    );
  });

  it('бутархай дүнг хүлээж авахгүй', () => {
    expect(() =>
      validateManualAllocations(1000, [{ packageId: 'a', amount: 1000.5 }], balances)
    ).to.throw(AllocationError, /бүхэл тоо/);
  });
});

describe('assertSumMatches — тогтмолын шалгуур', () => {
  it('таарсан нийлбэрт алдаа өгөхгүй', () => {
    expect(() => assertSumMatches([{ amount: 600 }, { amount: 400 }], 1000)).to.not.throw();
  });

  it('таараагүй нийлбэрт алдаа өгнө', () => {
    expect(() => assertSumMatches([{ amount: 600 }, { amount: 399 }], 1000)).to.throw(
      AllocationError,
      /таарахгүй/
    );
  });
});
