'use strict';

const { expect } = require('chai');
const state = require('../../src/domain/package-state');
const {
  PACKAGE_STATUS,
  PAYMENT_STATUS,
  PACKAGE_STATUS_LIST,
} = require('../../src/config/constants');

const S = PACKAGE_STATUS;
const paid = { paymentStatus: PAYMENT_STATUS.PAID };

describe('Ачааны төлөвийн машин (§1.5, BR-07…BR-09, BR-19)', () => {
  describe('Бүрэн бүтэн байдал', () => {
    it('enum-ийн төлөв бүр шилжилтийн хүснэгтэд байна', () => {
      for (const status of PACKAGE_STATUS_LIST) {
        expect(state.isKnownStatus(status), status).to.be.true;
      }
    });

    it('шилжилтийн хүснэгтэд танигдахгүй төлөв байхгүй', () => {
      for (const [from, targets] of Object.entries(state.TRANSITIONS)) {
        expect(PACKAGE_STATUS_LIST, from).to.include(from);
        for (const to of targets) {
          expect(PACKAGE_STATUS_LIST, `${from} → ${to}`).to.include(to);
        }
      }
    });

    it('төлөв бүрт монгол нэр байна', () => {
      for (const status of PACKAGE_STATUS_LIST) {
        expect(state.STATUS_LABEL[status], status).to.be.a('string').and.not.empty;
      }
    });

    it('төлөв өөр рүү өөрөө шилжихгүй', () => {
      for (const [from, targets] of Object.entries(state.TRANSITIONS)) {
        expect(targets, from).to.not.include(from);
      }
    });
  });

  describe('BR-07 — зөвшөөрөгдсөн шилжилт', () => {
    const happyPath = [
      [S.REGISTERED, S.NOTIFIED],
      [S.NOTIFIED, S.AWAITING_PAYMENT],
      [S.AWAITING_PAYMENT, S.PAID],
      [S.PAID, S.OUT_FOR_DELIVERY],
      [S.PAID, S.PICKED_UP],
      [S.OUT_FOR_DELIVERY, S.DELIVERED],
      [S.PICKED_UP, S.DELIVERED],
      [S.OUT_FOR_DELIVERY, S.RETURNED],
      [S.RETURNED, S.OUT_FOR_DELIVERY],
      [S.RETURNED, S.PICKED_UP],
    ];

    happyPath.forEach(([from, to]) => {
      it(`${from} → ${to} зөвшөөрөгдөнө`, () => {
        expect(state.canTransition(from, to)).to.be.true;
      });
    });

    it('registered → delivered ҮСРЭХ боломжгүй (төлбөр тойрох нүх)', () => {
      expect(state.canTransition(S.REGISTERED, S.DELIVERED)).to.be.false;
      expect(() => state.assertTransition(S.REGISTERED, S.DELIVERED, paid)).to.throw(
        /шилжих боломжгүй/
      );
    });

    it('арагшаа шилжихгүй (awaiting_payment → notified)', () => {
      expect(state.canTransition(S.AWAITING_PAYMENT, S.NOTIFIED)).to.be.false;
    });

    it(
      'хуучин, татгалзсан замын төлөв (in_transit/arrived) БАЙХГҮЙ хэвээр — ' +
        'бодит бүртгэл (жин/үнэ/байршил) нь Монголд ирсний дараа хийгддэг (§1.1, BR-45)',
      () => {
        expect(state.isKnownStatus('in_transit')).to.be.false;
        expect(state.isKnownStatus('arrived')).to.be.false;
      }
    );

    it('алдааны мессеж зөвшөөрөгдөх төлөвүүдийг МОНГОЛООР санал болгоно', () => {
      // `registered → delivered` нь ХҮСНЭГТЭД ч байхгүй — тиймээс зөвшөөрөгдөх
      // хувилбаруудыг санал болгоно. (`registered → paid` нь хүснэгтэд БАЙГАА,
      // зөвхөн системийн зам тул өөр мессеж гарна — доор тусад нь шалгав.)
      try {
        state.assertTransition(S.REGISTERED, S.DELIVERED);
        throw new Error('алдаа гарах ёстой байсан');
      } catch (err) {
        expect(err.message).to.include('Бүртгэгдсэн');
        expect(err.message).to.include('Хэрэглэгчид мэдэгдсэн');
      }
    });
  });

  describe('Төгсгөлийн төлөв', () => {
    it('delivered ба cancelled нь төгсгөлийн төлөв', () => {
      expect(state.isTerminal(S.DELIVERED)).to.be.true;
      expect(state.isTerminal(S.CANCELLED)).to.be.true;
    });

    it('бусад төлөв төгсгөлийн биш', () => {
      const terminal = [S.DELIVERED, S.CANCELLED];
      for (const status of PACKAGE_STATUS_LIST.filter(s => !terminal.includes(s))) {
        expect(state.isTerminal(status), status).to.be.false;
      }
    });

    it('төгсгөлийн төлөвөөс шилжих оролдлого тодорхой алдаа өгнө', () => {
      expect(() => state.assertTransition(S.DELIVERED, S.RETURNED, paid)).to.throw(
        /төгсгөлийн төлөв/
      );
      expect(() => state.assertTransition(S.CANCELLED, S.REGISTERED)).to.throw(/төгсгөлийн төлөв/);
    });
  });

  describe('BR-07 — хүчингүй болгох', () => {
    const cancellable = [S.IN_ERLIAN, S.REGISTERED, S.NOTIFIED, S.AWAITING_PAYMENT];

    cancellable.forEach(status => {
      it(`${status} төлөвөөс хүчингүй болгоно`, () => {
        expect(state.isCancellable(status)).to.be.true;
      });
    });

    it('төлбөр төлөгдсөн ачааг хүчингүй болгохгүй', () => {
      expect(state.isCancellable(S.PAID)).to.be.false;
      expect(state.isCancellable(S.OUT_FOR_DELIVERY)).to.be.false;
      expect(state.isCancellable(S.DELIVERED)).to.be.false;
    });
  });

  describe('BR-09 — paid зөвхөн систем оноодог', () => {
    it('гараар paid болгох боломжгүй', () => {
      expect(() => state.assertTransition(S.AWAITING_PAYMENT, S.PAID)).to.throw(
        /гараар оноох боломжгүй/
      );
    });

    it('систем (төлбөрийн транзакц) paid болгоно', () => {
      expect(() =>
        state.assertTransition(S.AWAITING_PAYMENT, S.PAID, { system: true })
      ).to.not.throw();
    });
  });

  describe('BR-19 — төлбөргүйгээр хүргэлтэнд гаргахгүй', () => {
    [S.OUT_FOR_DELIVERY, S.PICKED_UP].forEach(to => {
      it(`төлбөр дутуу үед ${to} рүү шилжихгүй`, () => {
        expect(() =>
          state.assertTransition(S.PAID, to, { paymentStatus: PAYMENT_STATUS.PARTIAL })
        ).to.throw(/Төлбөр бүрэн төлөгдөөгүй/);
      });

      it(`төлбөр бүрэн үед ${to} рүү шилжинэ`, () => {
        expect(() => state.assertTransition(S.PAID, to, paid)).to.not.throw();
      });
    });

    it('paymentStatus огт заагаагүй бол ХОРИГЛОНО (аюулгүй тал)', () => {
      expect(() => state.assertTransition(S.PAID, S.OUT_FOR_DELIVERY)).to.throw(
        /Төлбөр бүрэн төлөгдөөгүй/
      );
    });
  });

  describe('Оролтын шалгалт', () => {
    it('танигдахгүй одоогийн төлөв', () => {
      expect(() => state.assertTransition('зохиомол', S.NOTIFIED)).to.throw(
        /Танигдахгүй одоогийн төлөв/
      );
    });

    it('танигдахгүй шинэ төлөв', () => {
      expect(() => state.assertTransition(S.REGISTERED, 'зохиомол')).to.throw(
        /Танигдахгүй шинэ төлөв/
      );
    });

    it('ижил төлөв рүү шилжүүлэх', () => {
      expect(() => state.assertTransition(S.NOTIFIED, S.NOTIFIED)).to.throw(/аль хэдийн/);
    });

    it('allowedTransitions хуулбар буцаана — гаднаас хүснэгтийг эвдэж болохгүй', () => {
      const list = state.allowedTransitions(S.REGISTERED);
      list.push('зохиомол');
      expect(state.allowedTransitions(S.REGISTERED)).to.not.include('зохиомол');
    });

    it('танигдахгүй төлөвт allowedTransitions хоосон', () => {
      expect(state.allowedTransitions('зохиомол')).to.deep.equal([]);
    });
  });

  describe('BR-24/BR-25 — байршил эзлэх төлөвүүд', () => {
    it('агуулахад байгаа ачаа нүдийг эзэлнэ', () => {
      [S.REGISTERED, S.NOTIFIED, S.AWAITING_PAYMENT, S.PAID, S.RETURNED].forEach(
        s => expect(state.occupiesLocation(s), s).to.be.true
      );
    });

    it('гарсан, өгөгдсөн, хүчингүй ачаа нүдийг чөлөөлнө', () => {
      [S.OUT_FOR_DELIVERY, S.PICKED_UP, S.DELIVERED, S.CANCELLED].forEach(
        s => expect(state.occupiesLocation(s), s).to.be.false
      );
    });

    it('in_erlian ачаа физикээр Монголд байхгүй тул нүд эзэлдэггүй (BR-45)', () => {
      expect(state.occupiesLocation(S.IN_ERLIAN)).to.be.false;
    });
  });

  describe('BR-45 — "Эрээнд байгаа" урьдчилсан бүртгэл', () => {
    it('in_erlian → registered, in_erlian → cancelled зөвшөөрөгдөнө', () => {
      expect(state.canTransition(S.IN_ERLIAN, S.REGISTERED)).to.be.true;
      expect(state.canTransition(S.IN_ERLIAN, S.CANCELLED)).to.be.true;
    });

    it('in_erlian-аас бусад руу шилжихгүй', () => {
      const others = PACKAGE_STATUS_LIST.filter(s => ![S.REGISTERED, S.CANCELLED].includes(s));
      others.forEach(to => {
        expect(state.canTransition(S.IN_ERLIAN, to), to).to.be.false;
      });
    });

    it('in_erlian → registered-ыг viaArrival ФЛАГГҮЙГЭЭР энгийн changeStatus-аар хийж болохгүй', () => {
      expect(() => state.assertTransition(S.IN_ERLIAN, S.REGISTERED)).to.throw(/Ирц бүртгэх/);
    });

    it('in_erlian → registered viaArrival: true үед зөвшөөрөгдөнө', () => {
      expect(() =>
        state.assertTransition(S.IN_ERLIAN, S.REGISTERED, { viaArrival: true })
      ).to.not.throw();
    });

    it('manualTransitions(in_erlian)-д registered ОРОХГҮЙ (нэмэлт мэдээлэл шаарддаг тул)', () => {
      expect(state.manualTransitions(S.IN_ERLIAN)).to.not.include(S.REGISTERED);
    });

    it('manualTransitions(in_erlian)-д cancelled ч ОРОХГҮЙ (тусдаа урсгал, BR-11)', () => {
      expect(state.manualTransitions(S.IN_ERLIAN)).to.not.include(S.CANCELLED);
    });

    it('manualTransitions(in_erlian) хоосон — цорын ганц боломж тусгай маягтуудаар', () => {
      expect(state.manualTransitions(S.IN_ERLIAN)).to.deep.equal([]);
    });
  });

  describe('BR-14/BR-15 — төлбөрийн төлөв дүнгээс', () => {
    it('төлбөр байхгүй → unpaid', () => {
      expect(state.resolvePaymentStatus(2000, 0)).to.equal(PAYMENT_STATUS.UNPAID);
    });

    it('хэсэгчилсэн → partial', () => {
      expect(state.resolvePaymentStatus(2000, 500)).to.equal(PAYMENT_STATUS.PARTIAL);
    });

    it('бүрэн → paid', () => {
      expect(state.resolvePaymentStatus(2000, 2000)).to.equal(PAYMENT_STATUS.PAID);
    });

    it('илүү төлөлт ч paid (BR-15)', () => {
      expect(state.resolvePaymentStatus(2000, 2500)).to.equal(PAYMENT_STATUS.PAID);
    });

    it('үнэ 0 ачаа төлбөр 0 бол unpaid хэвээр (мөнгө хөдлөөгүй)', () => {
      expect(state.resolvePaymentStatus(0, 0)).to.equal(PAYMENT_STATUS.UNPAID);
    });
  });
});
