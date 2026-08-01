'use strict';

const { expect } = require('chai');
const state = require('../../src/domain/delivery-state');
const {
  DELIVERY_STATUS,
  DELIVERY_STATUS_LIST,
  PACKAGE_STATUS,
} = require('../../src/config/constants');

const D = DELIVERY_STATUS;

describe('Хүргэлтийн төлөвийн машин (§5.1, BR-19…BR-21)', () => {
  describe('Бүрэн бүтэн байдал', () => {
    it('enum-ийн төлөв бүр шилжилтийн хүснэгтэд байна', () => {
      for (const status of DELIVERY_STATUS_LIST) {
        expect(state.isKnownStatus(status), status).to.be.true;
      }
    });

    it('шилжилтийн хүснэгтэд танигдахгүй төлөв байхгүй', () => {
      for (const [from, targets] of Object.entries(state.TRANSITIONS)) {
        expect(DELIVERY_STATUS_LIST, from).to.include(from);
        for (const to of targets) {
          expect(DELIVERY_STATUS_LIST, `${from} → ${to}`).to.include(to);
        }
      }
    });

    it('төлөв бүрт монгол нэр байна', () => {
      for (const status of DELIVERY_STATUS_LIST) {
        expect(state.STATUS_LABEL[status], status).to.be.a('string').and.not.empty;
      }
    });

    it('төлөв бүрт ачааны нөлөө тодорхойлогдсон байна', () => {
      for (const status of DELIVERY_STATUS_LIST) {
        expect(state.PACKAGE_EFFECT, status).to.have.property(status);
      }
    });

    it('төлөв өөр рүү өөрөө шилжихгүй', () => {
      for (const [from, targets] of Object.entries(state.TRANSITIONS)) {
        expect(targets, from).to.not.include(from);
      }
    });

    it('танигдахгүй төлөв `isKnownStatus`-д false', () => {
      expect(state.isKnownStatus('in_transit')).to.be.false;
      expect(state.isKnownStatus('')).to.be.false;
      expect(state.isKnownStatus(undefined)).to.be.false;
    });
  });

  describe('BR-21 — зөвшөөрөгдсөн шилжилт', () => {
    it('created → dispatched → delivered', () => {
      expect(state.canTransition(D.CREATED, D.DISPATCHED)).to.be.true;
      expect(state.canTransition(D.DISPATCHED, D.DELIVERED)).to.be.true;
    });

    it('dispatched → returned → dispatched (дахин оролдох)', () => {
      expect(state.canTransition(D.DISPATCHED, D.RETURNED)).to.be.true;
      expect(state.canTransition(D.RETURNED, D.DISPATCHED)).to.be.true;
    });

    it('created → cancelled', () => {
      expect(state.canTransition(D.CREATED, D.CANCELLED)).to.be.true;
    });

    it('`delivered` ба `cancelled` нь ТӨГСГӨЛИЙН төлөв', () => {
      expect(state.isTerminal(D.DELIVERED)).to.be.true;
      expect(state.isTerminal(D.CANCELLED)).to.be.true;
      expect(state.isTerminal(D.CREATED)).to.be.false;
      expect(state.isTerminal(D.DISPATCHED)).to.be.false;
      expect(state.isTerminal(D.RETURNED)).to.be.false;
    });

    it('гарсны ДАРАА цуцлах боломжгүй — `returned` нь зөв зам', () => {
      expect(state.canTransition(D.DISPATCHED, D.CANCELLED)).to.be.false;
      expect(state.canTransition(D.RETURNED, D.CANCELLED)).to.be.false;
      expect(state.isCancellable(D.CREATED)).to.be.true;
      expect(state.isCancellable(D.DISPATCHED)).to.be.false;
    });

    it('created-аас шууд delivered болохгүй — жолооч гарах ёстой', () => {
      expect(state.canTransition(D.CREATED, D.DELIVERED)).to.be.false;
    });

    it('төгсгөлийн төлөвөөс хаашаа ч шилжихгүй', () => {
      expect(state.allowedTransitions(D.DELIVERED)).to.deep.equal([]);
      expect(state.allowedTransitions(D.CANCELLED)).to.deep.equal([]);
    });
  });

  describe('BR-20a — идэвхтэй төлөв', () => {
    it('`created`, `dispatched` нь идэвхтэй', () => {
      expect(state.isActive(D.CREATED)).to.be.true;
      expect(state.isActive(D.DISPATCHED)).to.be.true;
    });

    it('`returned` идэвхтэй БИШ — ачаа дахин багцлагдана', () => {
      expect(state.isActive(D.RETURNED)).to.be.false;
    });

    it('`delivered`, `cancelled` идэвхтэй биш', () => {
      expect(state.isActive(D.DELIVERED)).to.be.false;
      expect(state.isActive(D.CANCELLED)).to.be.false;
    });
  });

  describe('Ачааны төлөв чирэх (§1.5 ↔ §5.1)', () => {
    it('dispatched → ачаа `out_for_delivery`', () => {
      expect(state.packageEffect(D.DISPATCHED)).to.equal(PACKAGE_STATUS.OUT_FOR_DELIVERY);
    });

    it('delivered → ачаа `delivered`', () => {
      expect(state.packageEffect(D.DELIVERED)).to.equal(PACKAGE_STATUS.DELIVERED);
    });

    it('returned → ачаа `returned`', () => {
      expect(state.packageEffect(D.RETURNED)).to.equal(PACKAGE_STATUS.RETURNED);
    });

    it('created ба cancelled ачааг ХӨДӨЛГӨХГҮЙ (BR-09a)', () => {
      expect(state.packageEffect(D.CREATED)).to.be.null;
      expect(state.packageEffect(D.CANCELLED)).to.be.null;
    });
  });

  describe('BR-20 / §5.2 — төлбөрийн хаалт', () => {
    it('төлбөр бүрэн бол хүргэлтэнд гарна', () => {
      expect(() =>
        state.assertTransition(D.CREATED, D.DISPATCHED, { unpaidTotal: 0 })
      ).to.not.throw();
    });

    it('үлдэгдэл 1₮ ч байсан гаргахгүй', () => {
      expect(() => state.assertTransition(D.CREATED, D.DISPATCHED, { unpaidTotal: 1 })).to.throw(
        state.DeliveryTransitionError,
        'Төлбөр дутуу байна: 1₮'
      );
    });

    it('алдааны мессежид дүн мянгатаар тусгаарлагдана (§5.2)', () => {
      expect(() =>
        state.assertTransition(D.CREATED, D.DISPATCHED, { unpaidTotal: 12000 })
      ).to.throw('Төлбөр дутуу байна: 12,000₮');
    });

    it('OVERRIDE БАЙХГҮЙ — нэмэлт контекст өгсөн ч хаалт ажиллана', () => {
      // `system`, `force`, `admin` гэсэн параметр ЗОРИУД байхгүй. Санамсаргүй
      // дамжуулсан талбар хаалтыг сулруулж БОЛОХГҮЙ.
      expect(() =>
        state.assertTransition(D.CREATED, D.DISPATCHED, {
          unpaidTotal: 5000,
          system: true,
          force: true,
          role: 'admin',
        })
      ).to.throw('Төлбөр дутуу байна');
    });

    it('буцаагдсаныг ДАХИН гаргахад ч хаалт ажиллана', () => {
      // Гарсны дараа төлбөр хүчингүй болсон бол дахин гаргах ёсгүй
      expect(() =>
        state.assertTransition(D.RETURNED, D.DISPATCHED, { unpaidTotal: 3000 })
      ).to.throw('Төлбөр дутуу байна');
    });

    it('хаалт ЗӨВХӨН `dispatched`-д — хүргэгдсэн/буцаагдсаныг зогсоохгүй', () => {
      expect(() =>
        state.assertTransition(D.DISPATCHED, D.DELIVERED, { unpaidTotal: 9999 })
      ).to.not.throw();
      expect(() =>
        state.assertTransition(D.DISPATCHED, D.RETURNED, { unpaidTotal: 9999 })
      ).to.not.throw();
    });

    it('хүргэлт ҮҮСГЭХ нь төлбөр шаардахгүй (§5.2 хаалт зөвхөн гаргахад)', () => {
      // `created` руу шилжих зам байхгүй — үүсгэх нь шилжилт биш.
      // Гэхдээ цуцлах нь төлбөрөөс хамаарахгүй байх ёстой.
      expect(() =>
        state.assertTransition(D.CREATED, D.CANCELLED, { unpaidTotal: 50000 })
      ).to.not.throw();
    });

    it('unpaidTotal өгөөгүй бол 0 гэж үзнэ', () => {
      expect(() => state.assertTransition(D.CREATED, D.DISPATCHED)).to.not.throw();
    });
  });

  describe('Roadmap 5.8 — харилцагчийн хүргэлтийн хураамжийн хаалт', () => {
    it('хураамж бүрэн төлөгдсөн бол хаалтад нөлөөлөхгүй', () => {
      expect(() =>
        state.assertTransition(D.CREATED, D.DISPATCHED, { unpaidTotal: 0, unpaidFee: 0 })
      ).to.not.throw();
    });

    it('хураамж дутуу бол тусдаа мессежээр хориглоно', () => {
      expect(() =>
        state.assertTransition(D.CREATED, D.DISPATCHED, { unpaidTotal: 0, unpaidFee: 7000 })
      ).to.throw(state.DeliveryTransitionError, 'Хүргэлтийн хураамж төлөгдөөгүй: 7,000₮');
    });

    it('ачааны үлдэгдэл ба хураамжийн алдааг ХОЛИХГҮЙ — ачааны шалгалт эхэлж ажиллана', () => {
      expect(() =>
        state.assertTransition(D.CREATED, D.DISPATCHED, { unpaidTotal: 5000, unpaidFee: 7000 })
      ).to.throw('Төлбөр дутуу байна: 5,000₮');
    });

    it('unpaidFee өгөөгүй бол 0 гэж үзнэ (ажилтны хуучин хүргэлтэд нөлөөгүй)', () => {
      expect(() =>
        state.assertTransition(D.CREATED, D.DISPATCHED, { unpaidTotal: 0 })
      ).to.not.throw();
    });

    it('OVERRIDE БАЙХГҮЙ — хураамжийн хаалтад ч тойрох параметр байхгүй', () => {
      expect(() =>
        state.assertTransition(D.CREATED, D.DISPATCHED, {
          unpaidFee: 7000,
          system: true,
          force: true,
        })
      ).to.throw('Хүргэлтийн хураамж төлөгдөөгүй');
    });

    it('хаалт ЗӨВХӨН `dispatched`-д — хүргэгдсэн/буцаагдсаныг зогсоохгүй', () => {
      expect(() =>
        state.assertTransition(D.DISPATCHED, D.DELIVERED, { unpaidFee: 7000 })
      ).to.not.throw();
      expect(() =>
        state.assertTransition(D.DISPATCHED, D.RETURNED, { unpaidFee: 7000 })
      ).to.not.throw();
    });
  });

  describe('assertTransition — суурь шалгалт', () => {
    it('танигдахгүй одоогийн төлөв', () => {
      expect(() => state.assertTransition('shipped', D.DISPATCHED)).to.throw(
        'Танигдахгүй одоогийн төлөв'
      );
    });

    it('танигдахгүй шинэ төлөв', () => {
      expect(() => state.assertTransition(D.CREATED, 'shipped')).to.throw('Танигдахгүй шинэ төлөв');
    });

    it('ижил төлөв рүү шилжихгүй', () => {
      expect(() => state.assertTransition(D.CREATED, D.CREATED)).to.throw('аль хэдийн');
    });

    it('төгсгөлийн төлөвөөс шилжихгүй', () => {
      expect(() => state.assertTransition(D.DELIVERED, D.RETURNED)).to.throw('төгсгөлийн төлөв');
    });

    it('зөвшөөрөгдөөгүй шилжилтэд боломжит хувилбарыг заана', () => {
      expect(() => state.assertTransition(D.CREATED, D.DELIVERED)).to.throw(
        'Зөвшөөрөгдөх: Хүргэлтэнд гарсан, Цуцлагдсан'
      );
    });
  });

  describe('manualTransitions — UI-д ямар товч харагдах', () => {
    it('`cancelled` ОРОХГҮЙ — тусдаа урсгал', () => {
      expect(state.manualTransitions(D.CREATED)).to.deep.equal([D.DISPATCHED]);
    });

    it('гарсан хүргэлтэд хоёр сонголт', () => {
      expect(state.manualTransitions(D.DISPATCHED)).to.have.members([D.DELIVERED, D.RETURNED]);
    });

    it('төгсгөлийн төлөвт товч байхгүй', () => {
      expect(state.manualTransitions(D.DELIVERED)).to.deep.equal([]);
      expect(state.manualTransitions(D.CANCELLED)).to.deep.equal([]);
    });
  });

  describe('formatAmount — ICU-гүй орчинд ч ажиллана', () => {
    it('мянгатаар таслана', () => {
      expect(state.formatAmount(1)).to.equal('1');
      expect(state.formatAmount(999)).to.equal('999');
      expect(state.formatAmount(1000)).to.equal('1,000');
      expect(state.formatAmount(12000)).to.equal('12,000');
      expect(state.formatAmount(1234567)).to.equal('1,234,567');
    });
  });

  describe('Хувиршгүй байдал', () => {
    it('гадны код шилжилтийн хүснэгтийг өөрчилж чадахгүй', () => {
      expect(Object.isFrozen(state.TRANSITIONS)).to.be.true;
      expect(Object.isFrozen(state.PACKAGE_EFFECT)).to.be.true;
      expect(Object.isFrozen(state.ACTIVE_STATUSES)).to.be.true;
    });

    it('`allowedTransitions` хуулбар буцаана — гадуур засвал хүснэгт эвдэрнэ', () => {
      const list = state.allowedTransitions(D.CREATED);
      list.push(D.DELIVERED);
      expect(state.allowedTransitions(D.CREATED)).to.not.include(D.DELIVERED);
    });
  });
});
