'use strict';

const { expect } = require('chai');
const {
  formatLocationCode,
  parseLocationCode,
  isValidLocationCode,
  generateShelfCodes,
} = require('../../src/domain/location-code');

describe('BR-22 — Агуулахын байршлын код (§8)', () => {
  describe('Код угсрах', () => {
    it('шаардлагын жишээг яг үүсгэнэ: UB-02-B-15', () => {
      const code = formatLocationCode({ branch: 'UB', room: 2, shelf: 'B', row: 1, cell: 5 });
      expect(code).to.equal('UB-02-B-15');
    });

    it('өрөөний дугаарыг 2 орон болгож гүйцээнэ', () => {
      expect(formatLocationCode({ branch: 'UB', room: 7, shelf: 'A', row: 3, cell: 2 })).to.equal(
        'UB-07-A-32'
      );
    });

    it('жижиг үсгийг том болгоно', () => {
      expect(formatLocationCode({ branch: 'ub', room: 2, shelf: 'b', row: 1, cell: 5 })).to.equal(
        'UB-02-B-15'
      );
    });

    it('өрөөг мөр хэлбэрээр өгсөн ч ажиллана', () => {
      expect(
        formatLocationCode({ branch: 'UB', room: '02', shelf: 'B', row: 1, cell: 5 })
      ).to.equal('UB-02-B-15');
    });

    it('салбарын код 2 үсэг биш бол алдаа', () => {
      expect(() =>
        formatLocationCode({ branch: 'E', room: 2, shelf: 'B', row: 1, cell: 5 })
      ).to.throw(/Салбарын код/);
      expect(() =>
        formatLocationCode({ branch: 'ERE', room: 2, shelf: 'B', row: 1, cell: 5 })
      ).to.throw(/Салбарын код/);
      expect(() =>
        formatLocationCode({ branch: 'E1', room: 2, shelf: 'B', row: 1, cell: 5 })
      ).to.throw(/Салбарын код/);
    });

    it('өрөө 99-аас их бол алдаа', () => {
      expect(() =>
        formatLocationCode({ branch: 'UB', room: 100, shelf: 'B', row: 1, cell: 5 })
      ).to.throw(/Өрөөний дугаар/);
    });

    it('тавиур 1 үсэг биш бол алдаа', () => {
      expect(() =>
        formatLocationCode({ branch: 'UB', room: 2, shelf: 'BB', row: 1, cell: 5 })
      ).to.throw(/Тавиурын код/);
    });

    it('мөр 1–9-ээс гадуур бол алдаа', () => {
      expect(() =>
        formatLocationCode({ branch: 'UB', room: 2, shelf: 'B', row: 0, cell: 5 })
      ).to.throw(/Мөрийн дугаар/);
      expect(() =>
        formatLocationCode({ branch: 'UB', room: 2, shelf: 'B', row: 10, cell: 5 })
      ).to.throw(/Мөрийн дугаар/);
    });

    it('нүд 1–9-ээс гадуур бол алдаа', () => {
      expect(() =>
        formatLocationCode({ branch: 'UB', room: 2, shelf: 'B', row: 1, cell: 0 })
      ).to.throw(/Нүдний дугаар/);
    });
  });

  describe('Код задлах', () => {
    it('бүрдэл хэсгүүдэд зөв задална', () => {
      const parts = parseLocationCode('UB-02-B-15');
      expect(parts).to.deep.equal({
        branch: 'UB',
        room: '02',
        roomNumber: 2,
        shelf: 'B',
        row: 1,
        cell: 5,
      });
    });

    it('жижиг үсэг, зайг тэвчинэ', () => {
      expect(parseLocationCode('  ub-02-b-15  ').branch).to.equal('UB');
    });

    it('буруу форматад алдаа өгнө', () => {
      const invalid = ['UB-2-B-15', 'UB-02-BB-15', 'UB-02-B-1', 'UB02B15', '', null, 'UB-02-B-155'];
      invalid.forEach(code => {
        expect(() => parseLocationCode(code), `"${code}"`).to.throw(/формат буруу/);
      });
    });
  });

  describe('Угсрах ⇄ задлах эргэлт', () => {
    it('угсарсан кодыг задлахад анхны утга гарна', () => {
      const input = { branch: 'UB', room: 12, shelf: 'C', row: 4, cell: 7 };
      const parsed = parseLocationCode(formatLocationCode(input));
      expect(parsed.branch).to.equal(input.branch);
      expect(parsed.roomNumber).to.equal(input.room);
      expect(parsed.shelf).to.equal(input.shelf);
      expect(parsed.row).to.equal(input.row);
      expect(parsed.cell).to.equal(input.cell);
    });
  });

  describe('Хүчинтэй эсэхийг шалгах', () => {
    it('зөв кодод true', () => {
      expect(isValidLocationCode('UB-02-B-15')).to.equal(true);
    });

    it('буруу кодод false (алдаа шидэхгүй)', () => {
      expect(isValidLocationCode('буруу')).to.equal(false);
      expect(isValidLocationCode(null)).to.equal(false);
    });
  });

  describe('Тавиурын бүх нүдийг үүсгэх (bulk seed)', () => {
    it('мөр × нүдний тоогоор код үүсгэнэ', () => {
      const codes = generateShelfCodes({ branch: 'UB', room: 2, shelf: 'B', rows: 3, cells: 4 });
      expect(codes).to.have.lengthOf(12);
      expect(codes[0].code).to.equal('UB-02-B-11');
      expect(codes[11].code).to.equal('UB-02-B-34');
    });

    it('үүсгэсэн код бүр давхардахгүй', () => {
      const codes = generateShelfCodes({ branch: 'UB', room: 1, shelf: 'A', rows: 9, cells: 9 });
      const unique = new Set(codes.map(c => c.code));
      expect(codes).to.have.lengthOf(81);
      expect(unique.size).to.equal(81);
    });

    it('бүрдэл хэсгүүдийг хамт буцаана', () => {
      const [first] = generateShelfCodes({ branch: 'ub', room: 2, shelf: 'b', rows: 1, cells: 1 });
      expect(first).to.deep.equal({
        code: 'UB-02-B-11',
        branch: 'UB',
        room: '02',
        shelf: 'B',
        row: 1,
        cell: 1,
      });
    });

    it('хязгаараас давсан мөр/нүдэнд алдаа', () => {
      expect(() =>
        generateShelfCodes({ branch: 'UB', room: 2, shelf: 'B', rows: 10, cells: 4 })
      ).to.throw(/Мөрийн тоо/);
      expect(() =>
        generateShelfCodes({ branch: 'UB', room: 2, shelf: 'B', rows: 3, cells: 0 })
      ).to.throw(/Нүдний тоо/);
    });
  });
});
