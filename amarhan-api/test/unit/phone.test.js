'use strict';

const { expect } = require('chai');
const { normalizePhone, isValidPhone, formatPhone, maskPhone } = require('../../src/domain/phone');

/**
 * Утас бол ачааг харилцагчтай холбох гол түлхүүр (§3, BR-26).
 * Нормчлол буруу бол нэг хүн олон харилцагч болж, ачаа нь тарж унана.
 */
describe('BR-27 — Утасны дугаар нормчлол (§3)', () => {
  describe('Ижил дугаарын өөр бичлэгүүд нэг үр дүн өгнө', () => {
    const variants = [
      '99112233',
      '9911 2233',
      '9911-2233',
      '+976 9911 2233',
      '+97699112233',
      '97699112233',
      '00976 9911 2233',
      '(9911) 2233',
      ' 99112233 ',
      '9911.2233',
    ];

    variants.forEach(input => {
      it(`"${input}" → "99112233"`, () => {
        expect(normalizePhone(input)).to.equal('99112233');
      });
    });

    it('бүх хувилбар яг нэг утга буцаана', () => {
      const results = new Set(variants.map(normalizePhone));
      expect(results.size).to.equal(1);
    });
  });

  it('тоон оролтыг хүлээж авна', () => {
    expect(normalizePhone(99112233)).to.equal('99112233');
  });

  it('5–9-өөр эхэлсэн бүх дугаарыг хүлээж авна', () => {
    ['50112233', '70112233', '80112233', '90112233', '99112233'].forEach(p => {
      expect(normalizePhone(p)).to.equal(p);
    });
  });

  describe('Буруу дугаар', () => {
    it('хоосон бол алдаа', () => {
      expect(() => normalizePhone('')).to.throw(/хоосон/);
      expect(() => normalizePhone(null)).to.throw(/хоосон/);
      expect(() => normalizePhone(undefined)).to.throw(/хоосон/);
    });

    it('цифргүй бол алдаа', () => {
      expect(() => normalizePhone('утас')).to.throw(/цифр алга/);
    });

    it('8 оронгүй бол алдаа', () => {
      expect(() => normalizePhone('9911223')).to.throw(/8 оронтой/);
      expect(() => normalizePhone('991122334')).to.throw(/8 оронтой/);
    });

    it('эхний орон 5-аас бага бол алдаа', () => {
      expect(() => normalizePhone('19112233')).to.throw(/эхний орон/);
      expect(() => normalizePhone('49112233')).to.throw(/эхний орон/);
    });

    it('улсын кодтой боловч урт нь буруу бол алдаа', () => {
      expect(() => normalizePhone('976991122')).to.throw(/8 оронтой/);
    });
  });

  describe('isValidPhone', () => {
    it('зөв дугаарт true', () => {
      expect(isValidPhone('+976 9911 2233')).to.equal(true);
    });

    it('буруу дугаарт false (алдаа шидэхгүй)', () => {
      expect(isValidPhone('123')).to.equal(false);
      expect(isValidPhone(null)).to.equal(false);
    });
  });

  describe('Харуулах формат', () => {
    it('formatPhone нь 9911-2233 хэлбэрт оруулна', () => {
      expect(formatPhone('+97699112233')).to.equal('9911-2233');
    });
  });

  describe('Логт маскалах (docs/security-and-permissions.md §8)', () => {
    it('сүүлийн 4 оронг нуна', () => {
      expect(maskPhone('99112233')).to.equal('9911****');
    });

    it('буруу дугаарт ч нууц задлахгүй', () => {
      expect(maskPhone('буруу')).to.equal('********');
    });
  });
});
