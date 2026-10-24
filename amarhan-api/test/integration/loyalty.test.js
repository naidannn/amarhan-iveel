'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const { expect } = chai;

const { app } = require('../../src/services/express');
const Customer = require('../../src/models/customer.model');
const Payment = require('../../src/models/payment.model');
const Package = require('../../src/models/package.model');
const AuditLog = require('../../src/models/audit-log.model');
const Notification = require('../../src/models/notification.model');
const LoyaltyTransaction = require('../../src/models/loyalty-transaction.model');
const loyaltyService = require('../../src/services/loyalty.service');
const { createUserWithToken } = require('../factories/user.factory');
const {
  createBranch,
  createCargoTypeWithTariff,
  createLocation,
} = require('../factories/domain.factory');
const {
  ROLES,
  AUDIT_ACTION,
  SETTING_DEFAULTS,
  SETTING_KEY,
} = require('../../src/config/constants');

chai.use(chaiHttp);

const CUSTOMER = '/api/v1/customer';
const PACKAGES = '/api/v1/packages';
const PAYMENTS = '/api/v1/payments';
const SETTINGS = '/api/v1/settings';
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Урамшуулал — introduction.md §4, BR-30…BR-33a, BR-48.
 *
 * Кредит = мөнгө (1 = 1₮). Гол эрсдэл нь давхар олголт (давхардсан webhook,
 * зэрэг хүсэлт), буцаагүй олголт (төлбөр хүчингүй болсон) ба кредитийн
 * төлбөр орлогод тооцогдох — тестийн дийлэнх нь эдгээрт зориулагдав.
 */
describe('Урамшуулал — кредит, түвшин (§4)', () => {
  let location;
  let staff;
  let manager;
  let admin;

  beforeEach(async () => {
    const branch = await createBranch({ code: 'UB', name: 'Улаанбаатар агуулах' });
    await createCargoTypeWithTariff({ code: 'standard' });
    location = await createLocation(branch, { capacityCount: 100 });
    staff = await createUserWithToken({ role: ROLES.STAFF, branchId: branch._id });
    manager = await createUserWithToken({ role: ROLES.MANAGER, branchId: branch._id });
    admin = await createUserWithToken({ role: ROLES.ADMIN });
  });

  // ── Хэрэгслүүд ──────────────────────────────────────────────────────────

  const auth = token => ({ Authorization: `Bearer ${token}` });

  async function registerPackage({ phone = '99112233', price = 35000 } = {}) {
    const res = await chai
      .request(app)
      .post(PACKAGES)
      .set(auth(staff.token))
      .send({
        trackingNumber: `TRK${Math.floor(Math.random() * 1e12)}`,
        phone,
        finalPrice: price,
        locationCode: location.code,
      });
    expect(res.status, JSON.stringify(res.body)).to.equal(201);
    return res.body.data.package;
  }

  async function pay(packageId, amount, method = 'cash') {
    const res = await chai
      .request(app)
      .post(PAYMENTS)
      .set(auth(staff.token))
      .send({ packageIds: [packageId], amount, method });
    expect(res.status, JSON.stringify(res.body)).to.equal(201);
    return res.body.data.payment;
  }

  async function signUp(phone = '99112233') {
    const res = await chai
      .request(app)
      .post(`${CUSTOMER}/auth/register`)
      .send({ phone, password: 'customer-pass-1' });
    expect(res.status, JSON.stringify(res.body)).to.equal(201);
    return res.body.data.token;
  }

  async function points(phone = '99112233') {
    return (await Customer.findOne({ phone })).loyaltyPoints;
  }

  /** Админ кредит олгоно (BR-33 — `adjust` ledger бичлэг) */
  async function grantCredits(phone, loyaltyPoints) {
    const customer = await Customer.findOne({ phone });
    const res = await chai
      .request(app)
      .post(`/api/v1/customers/${customer._id}/loyalty`)
      .set(auth(admin.token))
      .send({ loyaltyPoints, reason: 'Тестийн кредит' });
    expect(res.status, JSON.stringify(res.body)).to.equal(200);
  }

  function selfPay(token, body) {
    return chai.request(app).post(`${CUSTOMER}/packages/pay`).set(auth(token)).send(body);
  }

  // ── Олголт (BR-30, BR-31) ──────────────────────────────────────────────

  describe('Олголт', () => {
    it('BR-30 — хэсэгчилсэн төлбөрт кредит олгохгүй, бүрэн төлөгдмөгц Хүрэл 1%', async () => {
      const pkg = await registerPackage({ price: 35000 });

      await pay(pkg.id, 20000);
      expect(await points()).to.equal(0);
      expect(await LoyaltyTransaction.countDocuments()).to.equal(0);

      await pay(pkg.id, 15000, 'bank');
      expect(await points()).to.equal(350);

      const [entry] = await LoyaltyTransaction.find();
      expect(entry.type).to.equal('earn');
      expect(entry.amount).to.equal(350);
      expect(entry.tier).to.equal('bronze');
      expect(entry.rateBps).to.equal(100);
      expect(entry.baseAmount).to.equal(35000);
      expect(entry.balanceAfter).to.equal(350);
      expect(entry.label).to.equal(pkg.trackingNumber);
    });

    it('кредит олгогдоход харилцагчид мэдэгдэл үүснэ', async () => {
      const pkg = await registerPackage({ price: 35000 });
      await pay(pkg.id, 35000);

      const notes = await Notification.find({ entity: 'loyalty' });
      expect(notes.map(n => n.title)).to.include('+350 кредит нэмэгдлээ');
    });

    it('төлбөр хүчингүй болбол олгосон кредит буцаагдана (earn_reversal)', async () => {
      const pkg = await registerPackage({ price: 35000 });
      const payment = await pay(pkg.id, 35000);
      expect(await points()).to.equal(350);

      const res = await chai
        .request(app)
        .put(`${PAYMENTS}/${payment._id}/void`)
        .set(auth(manager.token))
        .send({ reason: 'Буруу бүртгэсэн' });
      expect(res.status, JSON.stringify(res.body)).to.equal(200);

      expect(await points()).to.equal(0);
      const types = (await LoyaltyTransaction.find().sort({ seq: 1 })).map(e => [e.type, e.amount]);
      expect(types).to.deep.equal([
        ['earn', 350],
        ['earn_reversal', -350],
      ]);
    });

    it('reconcile идемпотент — зэрэг/давтан дуудсан ч давхар олгохгүй', async () => {
      const pkg = await registerPackage({ price: 35000 });
      await pay(pkg.id, 35000);

      await Promise.all([
        loyaltyService.reconcilePackage(pkg.id),
        loyaltyService.reconcilePackage(pkg.id),
        loyaltyService.reconcilePackage(pkg.id),
      ]);

      expect(await points()).to.equal(350);
      expect(await LoyaltyTransaction.countDocuments({ type: 'earn' })).to.equal(1);
    });

    it('утасгүй ачаа кредит авахгүй; хожим харилцагч холбогдоход нөхөж олгоно', async () => {
      const res = await chai
        .request(app)
        .post(PACKAGES)
        .set(auth(staff.token))
        .send({
          trackingNumber: `TRK${Math.floor(Math.random() * 1e12)}`,
          finalPrice: 35000,
          locationCode: location.code,
        });
      expect(res.status, JSON.stringify(res.body)).to.equal(201);
      const pkg = res.body.data.package;

      // Утасгүй ачаанд төлбөр бүртгэх боломжгүй (BR-45) — эхлээд холбоно
      await chai
        .request(app)
        .put(`${PACKAGES}/${pkg._id ?? pkg.id}`)
        .set(auth(staff.token))
        .send({ phone: '99112233' });
      await pay(pkg._id ?? pkg.id, 35000);

      expect(await points()).to.equal(350);
    });

    it('төлсөн ачааг өөр харилцагч руу шилжүүлбэл кредит шинэ эзэнд шилжинэ', async () => {
      const pkg = await registerPackage({ phone: '99112233', price: 35000 });
      await pay(pkg.id, 35000);
      expect(await points('99112233')).to.equal(350);

      const res = await chai
        .request(app)
        .put(`${PACKAGES}/${pkg.id}`)
        .set(auth(staff.token))
        .send({ phone: '88112233' });
      expect(res.status, JSON.stringify(res.body)).to.equal(200);

      expect(await points('99112233')).to.equal(0);
      expect(await points('88112233')).to.equal(350);
    });
  });

  // ── Түвшин (BR-32) ──────────────────────────────────────────────────────

  describe('Түвшин — сүүлийн 12 сар', () => {
    it('150 000₮ хүрмэгц Мөнгө (3%) — ахисан тухай мэдэгдэнэ', async () => {
      const pkg = await registerPackage({ price: 150000 });
      await pay(pkg.id, 150000);

      const customer = await Customer.findOne({ phone: '99112233' });
      expect(customer.loyaltyTier).to.equal('silver');
      expect(customer.loyaltyPoints).to.equal(4500);

      const titles = (await Notification.find({ entity: 'loyalty' })).map(n => n.title);
      expect(titles.some(t => t.includes('Мөнгө'))).to.be.true;
    });

    it('12 сараас өмнөх төлбөр түвшинд тооцогдохгүй (буурч болно)', async () => {
      const pkg = await registerPackage({ price: 200000 });
      await pay(pkg.id, 200000);
      expect((await Customer.findOne({ phone: '99112233' })).loyaltyTier).to.equal('silver');

      // `createdAt` immutable — драйвераар шууд хуучруулна
      await Payment.collection.updateMany(
        {},
        { $set: { createdAt: new Date(Date.now() - 400 * DAY_MS) } }
      );

      const token = await signUp('99112233');
      const res = await chai.request(app).get(`${CUSTOMER}/loyalty`).set(auth(token));
      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect(res.body.data.spent).to.equal(0);
      expect(res.body.data.tier.code).to.equal('bronze');
      // Олгосон кредит хэвээр — хугацаа дуусахгүй (эзэмшигчийн шийдвэр)
      expect(res.body.data.credits).to.equal(6000);
    });

    it('Админы гараар тавьсан түвшин доод хязгаар болно, олголтод хэрэглэгдэнэ', async () => {
      await registerPackage({ price: 10000 }); // харилцагч үүснэ
      const customer = await Customer.findOne({ phone: '99112233' });

      const res = await chai
        .request(app)
        .post(`/api/v1/customers/${customer._id}/loyalty`)
        .set(auth(admin.token))
        .send({ loyaltyTier: 'platinum', reason: 'VIP харилцагч' });
      expect(res.status, JSON.stringify(res.body)).to.equal(200);

      const pkg = await registerPackage({ price: 20000 });
      await pay(pkg.id, 20000);

      // 5% — 20 000 × 5% = 1 000
      expect(await points()).to.equal(1000);
      const audit = await AuditLog.findOne({ action: AUDIT_ACTION.CUSTOMER_LOYALTY_ADJUST });
      expect(audit.field).to.equal('loyaltyTierManual');
      expect(audit.after).to.equal('platinum');
    });

    it('босго өөрчлөгдсөн ч өмнөх олголт хөдлөхгүй (snapshot)', async () => {
      const pkg = await registerPackage({ price: 35000 });
      await pay(pkg.id, 35000);
      expect(await points()).to.equal(350);

      const program = structuredClone(SETTING_DEFAULTS[SETTING_KEY.LOYALTY_PROGRAM]);
      program.tiers[0].rateBps = 1000; // Хүрэл 10%
      const res = await chai
        .request(app)
        .put(`${SETTINGS}/${SETTING_KEY.LOYALTY_PROGRAM}`)
        .set(auth(admin.token))
        .send({ value: program });
      expect(res.status, JSON.stringify(res.body)).to.equal(200);

      await loyaltyService.reconcilePackage(pkg.id);
      expect(await points()).to.equal(350);
    });
  });

  // ── Зарцуулалт (BR-48) ─────────────────────────────────────────────────

  describe('Харилцагч кредитээр төлөх', () => {
    it('кредит 100% хүртэл хэрэглэгдэнэ — Данс/QPay төлбөр үүсэхгүй, кредитээс кредит олгохгүй', async () => {
      const pkg = await registerPackage({ price: 30000 });
      const token = await signUp();
      await grantCredits('99112233', 50000);

      const res = await selfPay(token, { packageIds: [pkg.id], creditAmount: 30000 });
      expect(res.status, JSON.stringify(res.body)).to.equal(201);
      expect(res.body.data.id).to.equal(null);
      expect(res.body.data.credit).to.deep.equal({ amount: 30000, creditsLeft: 20000 });

      const updated = await Package.findById(pkg.id);
      expect(updated.balance).to.equal(0);
      expect(updated.paymentStatus).to.equal('paid');

      // Бүтнээр кредитээр — бодит мөнгө 0 тул шинэ олголт 0
      expect(await points()).to.equal(20000);
      expect(await LoyaltyTransaction.countDocuments({ type: 'earn' })).to.equal(0);

      const payment = await Payment.findOne({ method: 'credit' });
      expect(payment.amount).to.equal(30000);
      expect(payment.status).to.equal('completed');
    });

    it('кредит + үлдсэнийг Данс: зөвхөн бодит мөнгөнөөс кредит олгоно', async () => {
      const pkg = await registerPackage({ price: 30000 });
      const token = await signUp();
      await grantCredits('99112233', 10000);

      const res = await selfPay(token, {
        packageIds: [pkg.id],
        creditAmount: 10000,
        method: 'bank',
      });
      expect(res.status, JSON.stringify(res.body)).to.equal(201);
      expect(res.body.data.amount).to.equal(20000);
      expect(res.body.data.status).to.equal('pending');
      expect(res.body.data.credit.amount).to.equal(10000);
      expect((await Package.findById(pkg.id)).balance).to.equal(20000);

      const confirm = await chai
        .request(app)
        .put(`${PAYMENTS}/${res.body.data.id}/confirm`)
        .set(auth(staff.token));
      expect(confirm.status, JSON.stringify(confirm.body)).to.equal(200);

      // 20 000₮ (бодит) × 1% = 200; кредитийн 10 000-аас олголт байхгүй
      expect(await points()).to.equal(200);
    });

    it('кредитээс их бол INSUFFICIENT_CREDIT, ачааны дүнгээс их бол CREDIT_LIMIT_EXCEEDED', async () => {
      const pkg = await registerPackage({ price: 30000 });
      const token = await signUp();
      await grantCredits('99112233', 5000);

      const tooMuch = await selfPay(token, { packageIds: [pkg.id], creditAmount: 6000 });
      expect(tooMuch.status).to.equal(422);
      expect(tooMuch.body.code).to.equal('INSUFFICIENT_CREDIT');

      await grantCredits('99112233', 50000);
      const overPackage = await selfPay(token, { packageIds: [pkg.id], creditAmount: 30001 });
      expect(overPackage.status).to.equal(422);
      expect(overPackage.body.code).to.equal('CREDIT_LIMIT_EXCEEDED');

      expect(await points()).to.equal(50000);
      expect((await Package.findById(pkg.id)).balance).to.equal(30000);
      expect(await Payment.countDocuments({ method: 'credit' })).to.equal(0);
    });

    it('`maxRedeemPercent` тохиргоог хүндэтгэнэ', async () => {
      const program = structuredClone(SETTING_DEFAULTS[SETTING_KEY.LOYALTY_PROGRAM]);
      program.maxRedeemPercent = 50;
      await chai
        .request(app)
        .put(`${SETTINGS}/${SETTING_KEY.LOYALTY_PROGRAM}`)
        .set(auth(admin.token))
        .send({ value: program });

      const pkg = await registerPackage({ price: 30000 });
      const token = await signUp();
      await grantCredits('99112233', 50000);

      const res = await selfPay(token, { packageIds: [pkg.id], creditAmount: 15001 });
      expect(res.status).to.equal(422);
      expect(res.body.code).to.equal('CREDIT_LIMIT_EXCEEDED');

      const ok = await selfPay(token, { packageIds: [pkg.id], creditAmount: 15000 });
      expect(ok.status, JSON.stringify(ok.body)).to.equal(201);
    });

    it('зэрэг хоёр хүсэлт нэг кредитийг хоёр удаа зарцуулахгүй', async () => {
      const a = await registerPackage({ price: 10000 });
      const b = await registerPackage({ price: 10000 });
      const token = await signUp();
      await grantCredits('99112233', 10000);

      const results = await Promise.all([
        selfPay(token, { packageIds: [a.id], creditAmount: 10000 }),
        selfPay(token, { packageIds: [b.id], creditAmount: 10000 }),
      ]);

      expect(results.map(r => r.status).sort()).to.deep.equal([201, 422]);
      expect(await points()).to.equal(0);
      expect(await Payment.countDocuments({ method: 'credit' })).to.equal(1);
    });

    it('хөтөлбөр идэвхгүй үед кредит ашиглахгүй', async () => {
      const program = structuredClone(SETTING_DEFAULTS[SETTING_KEY.LOYALTY_PROGRAM]);
      program.enabled = false;
      await chai
        .request(app)
        .put(`${SETTINGS}/${SETTING_KEY.LOYALTY_PROGRAM}`)
        .set(auth(admin.token))
        .send({ value: program });

      const pkg = await registerPackage({ price: 30000 });
      const token = await signUp();
      await grantCredits('99112233', 5000);

      const res = await selfPay(token, { packageIds: [pkg.id], creditAmount: 1000 });
      expect(res.status).to.equal(422);
      expect(res.body.code).to.equal('LOYALTY_DISABLED');
    });

    it('хүргэлт захиалахдаа кредит ачаанд, хураамж Данс/QPay-ээр', async () => {
      const pkg = await registerPackage({ price: 20000 });
      const token = await signUp();
      await grantCredits('99112233', 20000);

      const res = await chai
        .request(app)
        .post(`${CUSTOMER}/deliveries`)
        .set(auth(token))
        .send({ packageIds: [pkg.id], address: 'ХУД, 3-р хороо', creditAmount: 20000 });
      expect(res.status, JSON.stringify(res.body)).to.equal(201);
      expect(res.body.data.credit.amount).to.equal(20000);
      // Ачаа кредитээр бүтэн хаагдсан — зөвхөн 7000₮ хураамж үлдэнэ
      expect(res.body.data.payment.amount).to.equal(7000);
      expect(await points()).to.equal(0);
    });
  });

  describe('Ажилтан кредитээр төлөх', () => {
    it('харилцагчийн хүсэлтээр кредит хэрэглэнэ; хүчингүй болгоход кредит буцна', async () => {
      const pkg = await registerPackage({ price: 30000 });
      await registerPackage({ price: 1 }); // харилцагч үүссэн байхад
      await grantCredits('99112233', 5000);

      const res = await chai
        .request(app)
        .post(`${PAYMENTS}/credit`)
        .set(auth(staff.token))
        .send({ packageIds: [pkg.id], amount: 5000 });
      expect(res.status, JSON.stringify(res.body)).to.equal(201);
      expect(res.body.data.payment.method).to.equal('credit');
      expect(res.body.data.creditsLeft).to.equal(0);
      expect(await points()).to.equal(0);
      expect(await AuditLog.countDocuments({ action: AUDIT_ACTION.LOYALTY_REDEEM })).to.equal(1);

      const voided = await chai
        .request(app)
        .put(`${PAYMENTS}/${res.body.data.payment._id}/void`)
        .set(auth(manager.token))
        .send({ reason: 'Харилцагч бэлнээр төлөхөөр болов' });
      expect(voided.status, JSON.stringify(voided.body)).to.equal(200);

      expect(await points()).to.equal(5000);
      expect((await Package.findById(pkg.id)).balance).to.equal(30000);
      expect(await LoyaltyTransaction.countDocuments({ type: 'redeem_refund' })).to.equal(1);
    });

    it('энгийн төлбөрийн замаар `credit` хэлбэр бүртгэх боломжгүй', async () => {
      const pkg = await registerPackage({ price: 30000 });
      const res = await chai
        .request(app)
        .post(PAYMENTS)
        .set(auth(staff.token))
        .send({ packageIds: [pkg.id], amount: 1000, method: 'credit' });
      expect(res.status).to.equal(400);
    });

    it('кредитийн төлбөр кассын нийлбэрт орохгүй, тусад нь харагдана', async () => {
      const pkg = await registerPackage({ price: 30000 });
      await pay(pkg.id, 10000, 'cash');
      await grantCredits('99112233', 5000);
      await chai
        .request(app)
        .post(`${PAYMENTS}/credit`)
        .set(auth(staff.token))
        .send({ packageIds: [pkg.id], amount: 5000 });

      const res = await chai.request(app).get(`${PAYMENTS}/summary`).set(auth(admin.token));
      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect(res.body.data.total).to.equal(10000);
      expect(res.body.data.byMethod.credit.total).to.equal(5000);
    });

    it('ажилтан харилцагчийн кредит, түүхийг харна', async () => {
      const pkg = await registerPackage({ price: 35000 });
      await pay(pkg.id, 35000);
      const customer = await Customer.findOne({ phone: '99112233' });

      const res = await chai
        .request(app)
        .get(`/api/v1/customers/${customer._id}/loyalty`)
        .set(auth(staff.token));
      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect(res.body.data.credits).to.equal(350);
      expect(res.body.data.tier.code).to.equal('bronze');
      expect(res.body.data.history.data).to.have.lengthOf(1);
    });
  });

  // ── Харилцагчийн харагдац (дүрэм 14) ───────────────────────────────────

  describe('Харилцагчийн урамшууллын хуудас', () => {
    it('түвшин, дараагийн шат, сүүлийн гүйлгээ (+delta) нэг хүсэлтээр', async () => {
      const pkg = await registerPackage({ price: 35000 });
      await pay(pkg.id, 35000);
      const token = await signUp();

      const res = await chai.request(app).get(`${CUSTOMER}/loyalty`).set(auth(token));
      expect(res.status, JSON.stringify(res.body)).to.equal(200);

      const d = res.body.data;
      expect(d.credits).to.equal(350);
      expect(d.tier.code).to.equal('bronze');
      expect(d.nextTier.code).to.equal('silver');
      expect(d.spent).to.equal(35000);
      expect(d.remainingToNext).to.equal(115000);
      expect(d.averagePackageValue).to.equal(35000);
      expect(d.tiers).to.have.lengthOf(4);
      expect(d.lastTransaction).to.include({ type: 'earn', amount: 350, balanceAfter: 350 });
      expect(d.totals).to.deep.equal({ earned: 350, redeemed: 0 });
    });

    it('түүх цагаан жагсаалттай — дотоод талбар гарахгүй', async () => {
      await registerPackage({ price: 1 });
      await grantCredits('99112233', 1000);
      const token = await signUp();

      const res = await chai.request(app).get(`${CUSTOMER}/loyalty/transactions`).set(auth(token));
      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      const [row] = res.body.data;
      expect(row.type).to.equal('adjust');
      expect(row.amount).to.equal(1000);
      expect(row).to.not.have.any.keys('reason', 'actorName', 'actorId', 'paymentId', 'customerId');
    });

    it('header-ийн жижиг тэмдэг: үлдэгдэл + хамгийн сүүлийн өөрчлөлт', async () => {
      const pkg = await registerPackage({ price: 35000 });
      await pay(pkg.id, 35000);
      const token = await signUp();

      const res = await chai.request(app).get(`${CUSTOMER}/loyalty/balance`).set(auth(token));
      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect(res.body.data.credits).to.equal(350);
      expect(res.body.data.lastTransaction.amount).to.equal(350);
    });

    it('өөр харилцагчийн кредит харагдахгүй', async () => {
      const pkg = await registerPackage({ phone: '88112233', price: 35000 });
      await pay(pkg.id, 35000);
      const token = await signUp('99112233');

      const res = await chai.request(app).get(`${CUSTOMER}/loyalty`).set(auth(token));
      expect(res.body.data.credits).to.equal(0);
      expect(res.body.data.lastTransaction).to.equal(null);
    });
  });

  // ── Тохиргоо ба самбар ─────────────────────────────────────────────────

  describe('Тохиргоо', () => {
    it('давхардсан/буурсан босго хүлээж авахгүй', async () => {
      const program = structuredClone(SETTING_DEFAULTS[SETTING_KEY.LOYALTY_PROGRAM]);
      program.tiers[1].minSpent = 0;

      const res = await chai
        .request(app)
        .put(`${SETTINGS}/${SETTING_KEY.LOYALTY_PROGRAM}`)
        .set(auth(admin.token))
        .send({ value: program });
      expect(res.status).to.equal(400);
    });

    it('хөтөлбөрийн самбарыг Менежер харна, Ажилтан харахгүй', async () => {
      const pkg = await registerPackage({ price: 35000 });
      await pay(pkg.id, 35000);

      const ok = await chai.request(app).get('/api/v1/loyalty/stats').set(auth(manager.token));
      expect(ok.status, JSON.stringify(ok.body)).to.equal(200);
      expect(ok.body.data.outstanding).to.equal(350);
      expect(ok.body.data.allTime.earned).to.equal(350);

      const denied = await chai.request(app).get('/api/v1/loyalty/stats').set(auth(staff.token));
      expect(denied.status).to.equal(403);
    });
  });
});
