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
    it('шаардлагын жишээг яг үүсгэнэ: ER-02-B-15', () => {
      const code = formatLocationCode({ branch: 'ER', room: 2, shelf: 'B', row: 1, cell: 5 });
      expect(code).to.equal('ER-02-B-15');
    });

    it('өрөөний дугаарыг 2 орон болгож гүйцээнэ', () => {
      expect(formatLocationCode({ branch: 'UB', room: 7, shelf: 'A', row: 3, cell: 2 })).to.equal(
        'UB-07-A-32'
      );
    });

    it('жижиг үсгийг том болгоно', () => {
      expect(formatLocationCode({ branch: 'er', room: 2, shelf: 'b', row: 1, cell: 5 })).to.equal(
        'ER-02-B-15'
      );
    });

    it('өрөөг мөр хэлбэрээр өгсөн ч ажиллана', () => {
      expect(
        formatLocationCode({ branch: 'ER', room: '02', shelf: 'B', row: 1, cell: 5 })
      ).to.equal('ER-02-B-15');
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
        formatLocationCode({ branch: 'ER', room: 100, shelf: 'B', row: 1, cell: 5 })
      ).to.throw(/Өрөөний дугаар/);
    });

    it('тавиур 1 үсэг биш бол алдаа', () => {
      expect(() =>
        formatLocationCode({ branch: 'ER', room: 2, shelf: 'BB', row: 1, cell: 5 })
      ).to.throw(/Тавиурын код/);
    });

    it('мөр 1–9-ээс гадуур бол алдаа', () => {
      expect(() =>
        formatLocationCode({ branch: 'ER', room: 2, shelf: 'B', row: 0, cell: 5 })
      ).to.throw(/Мөрийн дугаар/);
      expect(() =>
        formatLocationCode({ branch: 'ER', room: 2, shelf: 'B', row: 10, cell: 5 })
      ).to.throw(/Мөрийн дугаар/);
    });

    it('нүд 1–9-ээс гадуур бол алдаа', () => {
      expect(() =>
        formatLocationCode({ branch: 'ER', room: 2, shelf: 'B', row: 1, cell: 0 })
      ).to.throw(/Нүдний дугаар/);
    });
  });

  describe('Код задлах', () => {
    it('бүрдэл хэсгүүдэд зөв задална', () => {
      const parts = parseLocationCode('ER-02-B-15');
      expect(parts).to.deep.equal({
        branch: 'ER',
        room: '02',
        roomNumber: 2,
        shelf: 'B',
        row: 1,
        cell: 5,
      });
    });

    it('жижиг үсэг, зайг тэвчинэ', () => {
      expect(parseLocationCode('  er-02-b-15  ').branch).to.equal('ER');
    });

    it('буруу форматад алдаа өгнө', () => {
      const invalid = ['ER-2-B-15', 'ER-02-BB-15', 'ER-02-B-1', 'ER02B15', '', null, 'ER-02-B-155'];
      invalid.forEach(code => {
        expect(() => parseLocationCode(code), `"${code}"`).to.throw(/формат буруу/);
      });
    });
  });

  describe('Угсрах ⇄ задлах эргэлт', () => {
    it('угсарсан кодыг задлахад анхны утга гарна', () => {
      const input = { branch: 'ER', room: 12, shelf: 'C', row: 4, cell: 7 };
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
      expect(isValidLocationCode('ER-02-B-15')).to.equal(true);
    });

    it('буруу кодод false (алдаа шидэхгүй)', () => {
      expect(isValidLocationCode('буруу')).to.equal(false);
      expect(isValidLocationCode(null)).to.equal(false);
    });
  });

  describe('Тавиурын бүх нүдийг үүсгэх (bulk seed)', () => {
    it('мөр × нүдний тоогоор код үүсгэнэ', () => {
      const codes = generateShelfCodes({ branch: 'ER', room: 2, shelf: 'B', rows: 3, cells: 4 });
      expect(codes).to.have.lengthOf(12);
      expect(codes[0].code).to.equal('ER-02-B-11');
      expect(codes[11].code).to.equal('ER-02-B-34');
    });

    it('үүсгэсэн код бүр давхардахгүй', () => {
      const codes = generateShelfCodes({ branch: 'ER', room: 1, shelf: 'A', rows: 9, cells: 9 });
      const unique = new Set(codes.map(c => c.code));
      expect(codes).to.have.lengthOf(81);
      expect(unique.size).to.equal(81);
    });

    it('бүрдэл хэсгүүдийг хамт буцаана', () => {
      const [first] = generateShelfCodes({ branch: 'er', room: 2, shelf: 'b', rows: 1, cells: 1 });
      expect(first).to.deep.equal({
        code: 'ER-02-B-11',
        branch: 'ER',
        room: '02',
        shelf: 'B',
        row: 1,
        cell: 1,
      });
    });

    it('хязгаараас давсан мөр/нүдэнд алдаа', () => {
      expect(() =>
        generateShelfCodes({ branch: 'ER', room: 2, shelf: 'B', rows: 10, cells: 4 })
      ).to.throw(/Мөрийн тоо/);
      expect(() =>
        generateShelfCodes({ branch: 'ER', room: 2, shelf: 'B', rows: 3, cells: 0 })
      ).to.throw(/Нүдний тоо/);
    });
  });
});
