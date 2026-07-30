'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const { expect } = chai;

const { app } = require('../../src/services/express');
const Package = require('../../src/models/package.model');
const Payment = require('../../src/models/payment.model');
const Invoice = require('../../src/models/invoice.model');
const AuditLog = require('../../src/models/audit-log.model');
const { createUserWithToken } = require('../factories/user.factory');
const {
  createBranch,
  createCargoTypeWithTariff,
  createLocation,
} = require('../factories/domain.factory');
const {
  ROLES,
  PACKAGE_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHOD,
  PAYMENT_RECORD_STATUS,
  INVOICE_STATUS,
  AUDIT_ACTION,
  AUDIT_ENTITY,
  ERROR_CODE,
} = require('../../src/config/constants');

chai.use(chaiHttp);

const BASE = '/api/v1/payments';
const PACKAGES = '/api/v1/packages';

describe('Төлбөрийн модуль (§1.8, §2)', () => {
  let branch;
  let location;
  let staff;
  let manager;

  beforeEach(async () => {
    branch = await createBranch({ code: 'UB', name: 'Улаанбаатар агуулах' });
    // Тариф seed хийж байгаа шалтгаан: ачааны төрөл/тариф байхгүй үед бусад
    // урсгал унах эсэхийг ЭНД шалгахгүй — тестүүд үнийг ГААРАР заадаг (BR-01a)
    // тул дүн тодорхой, тарифын шатлалаас хамаарахгүй.
    await createCargoTypeWithTariff({ code: 'standard' });
    location = await createLocation(branch, { capacityCount: 100 });

    staff = await createUserWithToken({ role: ROLES.STAFF, branchId: branch._id });
    manager = await createUserWithToken({ role: ROLES.MANAGER, branchId: branch._id });
  });

  // ── Хэрэгслүүд ──────────────────────────────────────────────────────────

  /**
   * Ачаа бүртгэнэ. Үнийг ГАРААР заана (BR-01a) — тестийн дүнг тодорхой болгоно,
   * тарифын шатлалаас хамаарахгүй.
   */
  async function register({ price, phone = '99112233', actor = staff } = {}) {
    const res = await chai
      .request(app)
      .post(PACKAGES)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        trackingNumber: `TRK${Math.floor(Math.random() * 1e12)}`,
        phone,
        finalPrice: price,
        locationCode: location.code,
      });
    expect(res.status, JSON.stringify(res.body)).to.equal(201);
    return res.body.data.package;
  }

  function pay(actor, payload) {
    return chai.request(app).post(BASE).set('Authorization', `Bearer ${actor.token}`).send(payload);
  }

  function createInvoice(actor, packageIds) {
    return chai
      .request(app)
      .post(`${BASE}/invoices`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ packageIds });
  }

  async function reload(id) {
    return Package.findById(id);
  }

  // ── BR-13/BR-14 — нэг ачаанд төлбөр ─────────────────────────────────────

  describe('BR-14 — Үлдэгдлийн томьёо', () => {
    it('бүрэн төлөхөд үлдэгдэл 0, төлөв автоматаар `paid` болно (BR-09)', async () => {
      const pkg = await register({ price: 10000 });

      const res = await pay(staff, {
        amount: 10000,
        method: PAYMENT_METHOD.CASH,
        packageIds: [pkg.id],
      });

      expect(res.status, JSON.stringify(res.body)).to.equal(201);

      const reloaded = await reload(pkg.id);
      expect(reloaded.paidAmount).to.equal(10000);
      expect(reloaded.balance).to.equal(0);
      expect(reloaded.paymentStatus).to.equal(PAYMENT_STATUS.PAID);
      // BR-09 — систем өөрөө шилжүүлнэ
      expect(reloaded.status).to.equal(PACKAGE_STATUS.PAID);
    });

    it('хэсэгчилсэн төлбөрт `partial`, төлөв ХӨДӨЛӨХГҮЙ', async () => {
      const pkg = await register({ price: 10000 });

      await pay(staff, { amount: 4000, method: PAYMENT_METHOD.CASH, packageIds: [pkg.id] });

      const reloaded = await reload(pkg.id);
      expect(reloaded.paidAmount).to.equal(4000);
      expect(reloaded.balance).to.equal(6000);
      expect(reloaded.paymentStatus).to.equal(PAYMENT_STATUS.PARTIAL);
      expect(reloaded.status).to.equal(PACKAGE_STATUS.REGISTERED);
    });

    it('BR-13 — хуваасан төлбөр: данс + бэлэн', async () => {
      const pkg = await register({ price: 10000 });

      await pay(staff, { amount: 5000, method: PAYMENT_METHOD.BANK, packageIds: [pkg.id] });
      await pay(staff, { amount: 5000, method: PAYMENT_METHOD.CASH, packageIds: [pkg.id] });

      const reloaded = await reload(pkg.id);
      expect(reloaded.balance).to.equal(0);
      expect(reloaded.status).to.equal(PACKAGE_STATUS.PAID);

      // Хэлбэр тус бүр ТУСДАА бичлэг (BR-13)
      const payments = await Payment.find({ 'allocations.packageId': pkg.id });
      expect(payments).to.have.lengthOf(2);
      expect(payments.map(p => p.method).sort()).to.deep.equal(['bank', 'cash']);
    });

    it('BR-15 — илүү төлөлтийг хориглоно', async () => {
      const pkg = await register({ price: 10000 });

      const res = await pay(staff, {
        amount: 10001,
        method: PAYMENT_METHOD.CASH,
        packageIds: [pkg.id],
      });

      expect(res.status).to.equal(422);
      expect(res.body.code).to.equal(ERROR_CODE.OVERPAYMENT);

      const reloaded = await reload(pkg.id);
      expect(reloaded.paidAmount).to.equal(0);
    });

    it('бүрэн төлөгдсөн ачаанд дахин төлбөр авахгүй', async () => {
      const pkg = await register({ price: 10000 });
      await pay(staff, { amount: 10000, method: PAYMENT_METHOD.CASH, packageIds: [pkg.id] });

      const res = await pay(staff, {
        amount: 1000,
        method: PAYMENT_METHOD.CASH,
        packageIds: [pkg.id],
      });

      expect(res.status).to.equal(422);
    });

    it('хүчингүй ачаанд төлбөр авахгүй', async () => {
      const pkg = await register({ price: 10000 });
      await chai
        .request(app)
        .put(`${PACKAGES}/${pkg.id}/cancel`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ reason: 'Тест хүчингүй' });

      const res = await pay(staff, {
        amount: 10000,
        method: PAYMENT_METHOD.CASH,
        packageIds: [pkg.id],
      });

      expect(res.status).to.equal(422);
      expect(res.body.message).to.include('хүчингүй');
    });
  });

  // ── §2.3 — нэгтгэсэн нэхэмжлэх ─────────────────────────────────────────

  describe('BR-16 — Нэгтгэсэн нэхэмжлэх (§2.3)', () => {
    it('олон ачааг нэг нэхэмжлэх болгоно, дүн нь ҮЛДЭГДЛИЙН нийлбэр', async () => {
      const a = await register({ price: 10000 });
      const b = await register({ price: 5000 });
      // `a`-д хэсэгчилсэн төлбөр орсон — нэхэмжлэх ҮЛДЭГДЛЭЭР бодогдох ёстой
      await pay(staff, { amount: 4000, method: PAYMENT_METHOD.CASH, packageIds: [a.id] });

      const res = await createInvoice(staff, [a.id, b.id]);

      expect(res.status, JSON.stringify(res.body)).to.equal(201);
      // 6,000 (a-ийн үлдэгдэл) + 5,000 = 11,000. `finalPrice`-ээр бол 15,000 байх байсан
      expect(res.body.data.totalAmount).to.equal(11000);
      expect(res.body.data.invoiceNumber).to.match(/^INV-\d{4}-\d{6}$/);
      expect(res.body.data.status).to.equal(INVOICE_STATUS.OPEN);
    });

    it('өөр өөр харилцагчийн ачааг холихыг хориглоно', async () => {
      const a = await register({ price: 10000, phone: '99112233' });
      const b = await register({ price: 5000, phone: '99887766' });

      const res = await createInvoice(staff, [a.id, b.id]);

      expect(res.status).to.equal(422);
      expect(res.body.code).to.equal(ERROR_CODE.MIXED_CUSTOMERS);
    });

    it('ачаа хоёр НЭЭЛТТЭЙ нэхэмжлэхэд орохгүй (BR-16a)', async () => {
      const pkg = await register({ price: 10000 });
      await createInvoice(staff, [pkg.id]);

      const res = await createInvoice(staff, [pkg.id]);

      expect(res.status).to.equal(409);
      expect(res.body.message).to.include('нээлттэй нэхэмжлэх');
    });

    it('нэхэмжлэхийн дугаар давхардахгүй, дараалан өснө', async () => {
      const a = await register({ price: 1000 });
      const b = await register({ price: 1000 });

      const first = await createInvoice(staff, [a.id]);
      const second = await createInvoice(staff, [b.id]);

      expect(first.body.data.invoiceNumber).to.not.equal(second.body.data.invoiceNumber);

      const seqOf = n => Number(n.split('-')[2]);
      expect(seqOf(second.body.data.invoiceNumber)).to.equal(
        seqOf(first.body.data.invoiceNumber) + 1
      );
    });

    it('бүрэн төлөгдсөн ачаанаас нэхэмжлэх үүсгэхгүй', async () => {
      const pkg = await register({ price: 10000 });
      await pay(staff, { amount: 10000, method: PAYMENT_METHOD.CASH, packageIds: [pkg.id] });

      const res = await createInvoice(staff, [pkg.id]);

      expect(res.status).to.equal(422);
      expect(res.body.message).to.include('бүрэн төлөгдсөн');
    });

    it('audit-д `invoice.create` бичигдэнэ', async () => {
      const pkg = await register({ price: 10000 });
      const res = await createInvoice(staff, [pkg.id]);

      const log = await AuditLog.findOne({
        action: AUDIT_ACTION.INVOICE_CREATE,
        entity: AUDIT_ENTITY.INVOICE,
        entityId: res.body.data.id,
      });

      expect(log).to.exist;
      expect(log.after).to.equal(10000);
    });
  });

  // ── §2.3 алхам 4 — пропорциональ хуваарилалт ───────────────────────────

  describe('BR-17 — Нэхэмжлэхээр төлөхөд ПРОПОРЦИОНАЛЬ хуваарилагдана', () => {
    it('20 ачааг нэг нэхэмжлэхээр бүрэн төлөхөд БҮГД `balance = 0` (§2.3 шалгуур)', async () => {
      const packages = [];
      for (let i = 0; i < 20; i += 1) {
        // Санамсаргүй биш боловч тэгш ХУВААГДАХГҮЙ дүнгүүд — дугуйруулалт шалгах
        packages.push(await register({ price: 1000 + i * 137 }));
      }

      const invoiceRes = await createInvoice(
        staff,
        packages.map(p => p.id)
      );
      expect(invoiceRes.status, JSON.stringify(invoiceRes.body)).to.equal(201);

      const total = invoiceRes.body.data.totalAmount;

      const payRes = await pay(staff, {
        amount: total,
        method: PAYMENT_METHOD.BANK,
        invoiceId: invoiceRes.body.data.id,
      });
      expect(payRes.status, JSON.stringify(payRes.body)).to.equal(201);

      for (const p of packages) {
        const reloaded = await reload(p.id);
        expect(reloaded.balance, `${reloaded.trackingNumber} үлдэгдэл`).to.equal(0);
        expect(reloaded.paymentStatus).to.equal(PAYMENT_STATUS.PAID);
        expect(reloaded.status).to.equal(PACKAGE_STATUS.PAID);
      }

      const invoice = await Invoice.findById(invoiceRes.body.data.id);
      expect(invoice.paidAmount).to.equal(total);
      expect(invoice.status).to.equal(INVOICE_STATUS.PAID);
    });

    it('хуваарилалтын нийлбэр төлсөн дүнтэй ЯГ тэнцэнэ (₮1 ч зөрөхгүй)', async () => {
      const packages = [];
      for (let i = 0; i < 7; i += 1) {
        packages.push(await register({ price: 3333 }));
      }

      const invoiceRes = await createInvoice(
        staff,
        packages.map(p => p.id)
      );
      const total = invoiceRes.body.data.totalAmount;

      // Хуваагдахгүй хэсэгчилсэн дүн
      const partial = 10000;
      const payRes = await pay(staff, {
        amount: partial,
        method: PAYMENT_METHOD.CASH,
        invoiceId: invoiceRes.body.data.id,
      });

      const payment = await Payment.findById(payRes.body.data.payment.id);
      const sum = payment.allocations.reduce((s, a) => s + a.amount, 0);

      expect(sum).to.equal(partial);
      expect(total).to.equal(7 * 3333);
    });

    it('хуваан төлөхөд ҮЛДСЭН дүн зөв хуваарилагдана (BR-13 + BR-17)', async () => {
      const a = await register({ price: 6000 });
      const b = await register({ price: 4000 });

      const invoiceRes = await createInvoice(staff, [a.id, b.id]);
      const invoiceId = invoiceRes.body.data.id;

      // 1-р хэсэг: 5,000 (60/40 → 3,000 / 2,000)
      await pay(staff, { amount: 5000, method: PAYMENT_METHOD.BANK, invoiceId });
      // 2-р хэсэг: үлдсэн 5,000
      await pay(staff, { amount: 5000, method: PAYMENT_METHOD.CASH, invoiceId });

      const reloadedA = await reload(a.id);
      const reloadedB = await reload(b.id);

      expect(reloadedA.balance).to.equal(0);
      expect(reloadedB.balance).to.equal(0);

      const invoice = await Invoice.findById(invoiceId);
      expect(invoice.paidAmount).to.equal(10000);
      expect(invoice.status).to.equal(INVOICE_STATUS.PAID);
    });

    it('хүчингүй нэхэмжлэхэд төлбөр бүртгэхгүй', async () => {
      const pkg = await register({ price: 10000 });
      const invoiceRes = await createInvoice(staff, [pkg.id]);

      await chai
        .request(app)
        .put(`${BASE}/invoices/${invoiceRes.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ reason: 'Буруу ачаа сонгосон' });

      const res = await pay(staff, {
        amount: 10000,
        method: PAYMENT_METHOD.CASH,
        invoiceId: invoiceRes.body.data.id,
      });

      expect(res.status).to.equal(422);
      expect(res.body.message).to.include('Хүчингүй нэхэмжлэх');
    });
  });

  // ── Ажилтан гараар хуваарилах ──────────────────────────────────────────

  describe('Ажилтан ачаа тус бүрийн дүнг ГАРААР заана', () => {
    it('нэг ачааг бүтнээр төлж, нөгөөг үлдээнэ', async () => {
      const a = await register({ price: 6000 });
      const b = await register({ price: 4000 });

      const res = await pay(staff, {
        amount: 6000,
        method: PAYMENT_METHOD.CASH,
        allocations: [{ packageId: a.id, amount: 6000 }],
      });

      expect(res.status, JSON.stringify(res.body)).to.equal(201);

      expect((await reload(a.id)).balance).to.equal(0);
      expect((await reload(b.id)).balance).to.equal(4000);
    });

    it('нийлбэр таарахгүй бол хүлээж авахгүй (BR-17)', async () => {
      const a = await register({ price: 6000 });
      const b = await register({ price: 4000 });

      const res = await pay(staff, {
        amount: 10000,
        method: PAYMENT_METHOD.CASH,
        allocations: [
          { packageId: a.id, amount: 6000 },
          { packageId: b.id, amount: 3000 },
        ],
      });

      expect(res.status).to.equal(422);
      expect(res.body.code).to.equal(ERROR_CODE.ALLOCATION_MISMATCH);
    });

    it('ачааны үлдэгдлээс их дүн ногдуулахгүй', async () => {
      const a = await register({ price: 6000 });

      const res = await pay(staff, {
        amount: 7000,
        method: PAYMENT_METHOD.CASH,
        allocations: [{ packageId: a.id, amount: 7000 }],
      });

      expect(res.status).to.equal(422);
    });
  });

  // ── BR-18 — хүчингүй болгох ────────────────────────────────────────────

  describe('BR-18 — Төлбөрийг хүчингүй болгоно, УСТГАХГҮЙ', () => {
    it('хүчингүй болгоход үлдэгдэл эх сурвалжаас дахин бодогдоно', async () => {
      const pkg = await register({ price: 10000 });
      const payRes = await pay(staff, {
        amount: 10000,
        method: PAYMENT_METHOD.CASH,
        packageIds: [pkg.id],
      });

      const res = await chai
        .request(app)
        .put(`${BASE}/${payRes.body.data.payment.id}/void`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ reason: 'Ажилтан буруу дүн бүртгэсэн' });

      expect(res.status, JSON.stringify(res.body)).to.equal(200);

      const reloaded = await reload(pkg.id);
      expect(reloaded.paidAmount).to.equal(0);
      expect(reloaded.balance).to.equal(10000);
      expect(reloaded.paymentStatus).to.equal(PAYMENT_STATUS.UNPAID);
      // Төлөв ЗАЛРУУЛАГДАНА — эс тэгвээс төлөөгүй ачаа "төлөгдсөн" гэж харагдана
      expect(reloaded.status).to.equal(PACKAGE_STATUS.AWAITING_PAYMENT);

      // Бичлэг УСТААГҮЙ
      const payment = await Payment.findById(payRes.body.data.payment.id);
      expect(payment).to.exist;
      expect(payment.status).to.equal(PAYMENT_RECORD_STATUS.VOIDED);
      expect(payment.voidReason).to.equal('Ажилтан буруу дүн бүртгэсэн');
    });

    it('хуваасан төлбөрийн НЭГИЙГ хүчингүй болгоход нөгөө нь хэвээр', async () => {
      const pkg = await register({ price: 10000 });
      const first = await pay(staff, {
        amount: 6000,
        method: PAYMENT_METHOD.BANK,
        packageIds: [pkg.id],
      });
      await pay(staff, { amount: 4000, method: PAYMENT_METHOD.CASH, packageIds: [pkg.id] });

      await chai
        .request(app)
        .put(`${BASE}/${first.body.data.payment.id}/void`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ reason: 'Дансаар ороогүй байсан' });

      const reloaded = await reload(pkg.id);
      expect(reloaded.paidAmount).to.equal(4000);
      expect(reloaded.balance).to.equal(6000);
      expect(reloaded.paymentStatus).to.equal(PAYMENT_STATUS.PARTIAL);
    });

    it('шалтгаангүй хүчингүй болгохгүй', async () => {
      const pkg = await register({ price: 10000 });
      const payRes = await pay(staff, {
        amount: 10000,
        method: PAYMENT_METHOD.CASH,
        packageIds: [pkg.id],
      });

      const res = await chai
        .request(app)
        .put(`${BASE}/${payRes.body.data.payment.id}/void`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({});

      expect(res.status).to.equal(400);
    });

    it('хоёр дахин хүчингүй болгохгүй', async () => {
      const pkg = await register({ price: 10000 });
      const payRes = await pay(staff, {
        amount: 10000,
        method: PAYMENT_METHOD.CASH,
        packageIds: [pkg.id],
      });
      const url = `${BASE}/${payRes.body.data.payment.id}/void`;

      await chai
        .request(app)
        .put(url)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ reason: 'Анхны залруулга' });

      const res = await chai
        .request(app)
        .put(url)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ reason: 'Дахин оролдлого' });

      expect(res.status).to.equal(422);
      expect(res.body.code).to.equal(ERROR_CODE.PAYMENT_ALREADY_VOIDED);
    });

    it('Ажилтан хүчингүй болгож ЧАДАХГҮЙ (кассын дутагдал нуухаас сэргийлнэ)', async () => {
      const pkg = await register({ price: 10000 });
      const payRes = await pay(staff, {
        amount: 10000,
        method: PAYMENT_METHOD.CASH,
        packageIds: [pkg.id],
      });

      const res = await chai
        .request(app)
        .put(`${BASE}/${payRes.body.data.payment.id}/void`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ reason: 'Ажилтны оролдлого' });

      expect(res.status).to.equal(403);
    });

    it('төлбөр орсон нэхэмжлэхийг хүчингүй болгохгүй', async () => {
      const pkg = await register({ price: 10000 });
      const invoiceRes = await createInvoice(staff, [pkg.id]);
      await pay(staff, {
        amount: 5000,
        method: PAYMENT_METHOD.CASH,
        invoiceId: invoiceRes.body.data.id,
      });

      const res = await chai
        .request(app)
        .put(`${BASE}/invoices/${invoiceRes.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ reason: 'Буруу нэхэмжлэх' });

      expect(res.status).to.equal(422);
      expect(res.body.message).to.include('Төлбөр орсон');
    });
  });

  // ── BR-19, §5.2 — төлбөргүй ачааг гаргахгүй ────────────────────────────

  describe('BR-19 — Төлбөр дутуу ачааг хүлээлгэн өгөхгүй (§5.2)', () => {
    it('хэсэгчилсэн төлбөртэй ачааг `picked_up` болгохгүй', async () => {
      const pkg = await register({ price: 10000 });
      await pay(staff, { amount: 5000, method: PAYMENT_METHOD.CASH, packageIds: [pkg.id] });

      const res = await chai
        .request(app)
        .put(`${PACKAGES}/${pkg.id}/status`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ status: PACKAGE_STATUS.PICKED_UP });

      expect(res.status).to.equal(409);
    });

    it('бүрэн төлсний дараа `picked_up` болно', async () => {
      const pkg = await register({ price: 10000 });
      await pay(staff, { amount: 10000, method: PAYMENT_METHOD.CASH, packageIds: [pkg.id] });

      const res = await chai
        .request(app)
        .put(`${PACKAGES}/${pkg.id}/status`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ status: PACKAGE_STATUS.PICKED_UP });

      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect(res.body.data.status).to.equal(PACKAGE_STATUS.PICKED_UP);
    });

    it('BR-09 — `paid` төлөвийг ГАРААР оноох боломжгүй', async () => {
      const pkg = await register({ price: 10000 });

      const res = await chai
        .request(app)
        .put(`${PACKAGES}/${pkg.id}/status`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ status: PACKAGE_STATUS.PAID });

      expect(res.status).to.equal(409);
      expect(res.body.message).to.include('гараар оноох боломжгүй');
    });

    it('BR-18 — `paid → awaiting_payment` руу ГАРААР буцаах боломжгүй', async () => {
      const pkg = await register({ price: 10000 });
      await pay(staff, { amount: 10000, method: PAYMENT_METHOD.CASH, packageIds: [pkg.id] });

      const res = await chai
        .request(app)
        .put(`${PACKAGES}/${pkg.id}/status`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ status: PACKAGE_STATUS.AWAITING_PAYMENT });

      expect(res.status).to.equal(409);
      expect(res.body.message).to.include('гараар буцаах боломжгүй');
    });

    it('ачааны дэлгэрэнгүйд СИСТЕМИЙН шилжилт товч болж гарахгүй', async () => {
      const pkg = await register({ price: 10000 });

      const res = await chai
        .request(app)
        .get(`${PACKAGES}/${pkg.id}`)
        .set('Authorization', `Bearer ${staff.token}`);

      // `registered` → notified, awaiting_payment (paid ба cancelled ОРОХГҮЙ)
      expect(res.body.data.allowedTransitions).to.not.include(PACKAGE_STATUS.PAID);
      expect(res.body.data.allowedTransitions).to.not.include(PACKAGE_STATUS.CANCELLED);
      expect(res.body.data.allowedTransitions).to.include(PACKAGE_STATUS.NOTIFIED);
    });
  });

  // ── §2.2 — жагсаалт ба audit ───────────────────────────────────────────

  describe('§2.2 — Төлбөрийн жагсаалт', () => {
    it('хуудаслагдсан, шүүлттэй жагсаалт буцаана', async () => {
      const pkg = await register({ price: 10000 });
      await pay(staff, { amount: 3000, method: PAYMENT_METHOD.CASH, packageIds: [pkg.id] });
      await pay(staff, { amount: 3000, method: PAYMENT_METHOD.BANK, packageIds: [pkg.id] });

      const res = await chai
        .request(app)
        .get(`${BASE}?method=cash`)
        .set('Authorization', `Bearer ${staff.token}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.lengthOf(1);
      expect(res.body.data[0].method).to.equal(PAYMENT_METHOD.CASH);
      expect(res.body.pagination.total).to.equal(1);
    });

    it('ачаагаар шүүж түүхийг харна', async () => {
      const a = await register({ price: 10000 });
      const b = await register({ price: 10000 });
      await pay(staff, { amount: 1000, method: PAYMENT_METHOD.CASH, packageIds: [a.id] });
      await pay(staff, { amount: 2000, method: PAYMENT_METHOD.CASH, packageIds: [b.id] });

      const res = await chai
        .request(app)
        .get(`${BASE}?packageId=${a.id}`)
        .set('Authorization', `Bearer ${staff.token}`);

      expect(res.body.data).to.have.lengthOf(1);
      expect(res.body.data[0].amount).to.equal(1000);
    });

    it('нийлбэрийг хэлбэр тус бүрээр гаргана (өдрийн касс)', async () => {
      const pkg = await register({ price: 10000 });
      await pay(staff, { amount: 3000, method: PAYMENT_METHOD.CASH, packageIds: [pkg.id] });
      await pay(staff, { amount: 4000, method: PAYMENT_METHOD.BANK, packageIds: [pkg.id] });

      const res = await chai
        .request(app)
        .get(`${BASE}/summary`)
        .set('Authorization', `Bearer ${staff.token}`);

      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect(res.body.data.total).to.equal(7000);
      expect(res.body.data.byMethod.cash.total).to.equal(3000);
      expect(res.body.data.byMethod.bank.total).to.equal(4000);
    });

    it('хүчингүй болсон төлбөр нийлбэрт ОРОХГҮЙ', async () => {
      const pkg = await register({ price: 10000 });
      const payRes = await pay(staff, {
        amount: 5000,
        method: PAYMENT_METHOD.CASH,
        packageIds: [pkg.id],
      });

      await chai
        .request(app)
        .put(`${BASE}/${payRes.body.data.payment.id}/void`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ reason: 'Залруулга' });

      const res = await chai
        .request(app)
        .get(`${BASE}/summary`)
        .set('Authorization', `Bearer ${staff.token}`);

      expect(res.body.data.total).to.equal(0);
    });

    it('ачааны дэлгэрэнгүйд төлбөрийн түүх багтана', async () => {
      const pkg = await register({ price: 10000 });
      await pay(staff, { amount: 4000, method: PAYMENT_METHOD.CASH, packageIds: [pkg.id] });

      const res = await chai
        .request(app)
        .get(`${PACKAGES}/${pkg.id}`)
        .set('Authorization', `Bearer ${staff.token}`);

      expect(res.body.data.payments).to.have.lengthOf(1);
      expect(res.body.data.payments[0].amount).to.equal(4000);
    });
  });

  describe('BR-41 — Төлбөрийн бүх үйлдэл audit-д', () => {
    it('төлбөр бүртгэхэд `payment.create` бичигдэнэ', async () => {
      const pkg = await register({ price: 10000 });
      const payRes = await pay(staff, {
        amount: 4000,
        method: PAYMENT_METHOD.CASH,
        packageIds: [pkg.id],
      });

      const log = await AuditLog.findOne({
        action: AUDIT_ACTION.PAYMENT_CREATE,
        entityId: payRes.body.data.payment.id,
      });

      expect(log).to.exist;
      expect(log.after).to.equal(4000);
      expect(log.actorName).to.be.a('string');
    });

    it('хүчингүй болгоход `payment.void` шалтгаантай бичигдэнэ', async () => {
      const pkg = await register({ price: 10000 });
      const payRes = await pay(staff, {
        amount: 4000,
        method: PAYMENT_METHOD.CASH,
        packageIds: [pkg.id],
      });

      await chai
        .request(app)
        .put(`${BASE}/${payRes.body.data.payment.id}/void`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ reason: 'Дансаар ороогүй' });

      const log = await AuditLog.findOne({
        action: AUDIT_ACTION.PAYMENT_VOID,
        entityId: payRes.body.data.payment.id,
      });

      expect(log).to.exist;
      expect(log.reason).to.equal('Дансаар ороогүй');
    });

    it('автомат `paid` шилжилт мөн audit-д бичигдэнэ (BR-09)', async () => {
      const pkg = await register({ price: 10000 });
      await pay(staff, { amount: 10000, method: PAYMENT_METHOD.CASH, packageIds: [pkg.id] });

      const log = await AuditLog.findOne({
        action: AUDIT_ACTION.PACKAGE_STATUS_CHANGE,
        entityId: pkg.id,
        after: PACKAGE_STATUS.PAID,
      });

      expect(log).to.exist;
      expect(log.reason).to.include('Төлбөр бүрэн');
    });
  });

  // ── §2.3 — нэхэмжлэх үүсгэхийн өмнөх дэлгэц ────────────────────────────

  describe('§2.3 — Утсаар төлбөр хүлээгдэж буй ачаа', () => {
    it('төлбөртэй ачааг нийт үлдэгдэлтэй хамт буцаана', async () => {
      await register({ price: 10000, phone: '99112233' });
      await register({ price: 5000, phone: '99112233' });
      const paid = await register({ price: 3000, phone: '99112233' });
      await pay(staff, { amount: 3000, method: PAYMENT_METHOD.CASH, packageIds: [paid.id] });

      const res = await chai
        .request(app)
        .get(`${BASE}/invoices/payable/99112233`)
        .set('Authorization', `Bearer ${staff.token}`);

      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      // Бүрэн төлөгдсөн ачаа ОРОХГҮЙ
      expect(res.body.data.packages).to.have.lengthOf(2);
      expect(res.body.data.totalBalance).to.equal(15000);
    });
  });

  // ── Транзакцын бүрэн бүтэн байдал ──────────────────────────────────────

  describe('BR-41 — Транзакц: бүх бичилт эсвэл юу ч биш', () => {
    it('хуваарилалт бүтэлгүйтвэл ТӨЛБӨР ч хадгалагдахгүй', async () => {
      const a = await register({ price: 6000 });
      const b = await register({ price: 4000 });

      const before = await Payment.countDocuments();

      const res = await pay(staff, {
        amount: 10000,
        method: PAYMENT_METHOD.CASH,
        allocations: [
          { packageId: a.id, amount: 6000 },
          { packageId: b.id, amount: 1000 },
        ],
      });

      expect(res.status).to.equal(422);
      expect(await Payment.countDocuments()).to.equal(before);
      expect((await reload(a.id)).paidAmount).to.equal(0);
    });

    /**
     * §2.3 дуусгах шалгуур — ЗЭРЭГ орсон хоёр төлбөр.
     *
     * Аюул: хоёр транзакц зэрэг `paidAmount`-ыг эх сурвалжаас уншиж, бие
     * биенийхээ хараахан commit болоогүй төлбөрийг ХАРАХГҮЙ. Тэгвэл хоёулаа
     * "5,000 орсон" гэж бичиж, 5,000₮ АЛГА БОЛНО (lost update).
     *
     * Хамгаалалт: хоёулаа ИЖИЛ ачааны бичлэгт бичдэг тул MongoDB WriteConflict
     * гаргаж, `withTransaction` нэгийг дахин оролдоно — дахин оролдлогод нөгөө
     * нь аль хэдийн commit болсон байх тул нийлбэр зөв гарна.
     */
    it('ЗЭРЭГ орсон хоёр төлбөр — үлдэгдэл буруу болохгүй', async () => {
      const pkg = await register({ price: 10000 });

      const results = await Promise.all([
        pay(staff, { amount: 4000, method: PAYMENT_METHOD.CASH, packageIds: [pkg.id] }),
        pay(staff, { amount: 6000, method: PAYMENT_METHOD.BANK, packageIds: [pkg.id] }),
      ]);

      // Хоёулаа амжилттай байх ёстой — хоёулаа үлдэгдэлд багтана
      for (const res of results) {
        expect(res.status, JSON.stringify(res.body)).to.equal(201);
      }

      const reloaded = await reload(pkg.id);
      expect(reloaded.paidAmount, 'нийлбэр ЯГ 10,000 байх ёстой').to.equal(10000);
      expect(reloaded.balance).to.equal(0);
      expect(reloaded.status).to.equal(PACKAGE_STATUS.PAID);

      // Эх сурвалж ба кэш зөрөхгүй
      const payments = await Payment.find({
        'allocations.packageId': pkg.id,
        status: PAYMENT_RECORD_STATUS.COMPLETED,
      });
      const fromSource = payments.reduce(
        (sum, p) =>
          sum +
          p.allocations
            .filter(a => String(a.packageId) === String(pkg.id))
            .reduce((s, a) => s + a.amount, 0),
        0
      );
      expect(fromSource).to.equal(reloaded.paidAmount);
    });

    /**
     * Илүү төлөлтийн ЗЭРЭГ оролдлого. Хоёулаа тус тусад нь хүчинтэй боловч
     * хамтдаа үлдэгдлээс хэтэрнэ — нэг нь ЗААВАЛ бүтэлгүйтэх ёстой.
     */
    it('ЗЭРЭГ орсон хоёр төлбөр хамтдаа хэтрэвэл НЭГ нь бүтэлгүйтнэ', async () => {
      const pkg = await register({ price: 10000 });

      const results = await Promise.all([
        pay(staff, { amount: 8000, method: PAYMENT_METHOD.CASH, packageIds: [pkg.id] }),
        pay(staff, { amount: 8000, method: PAYMENT_METHOD.BANK, packageIds: [pkg.id] }),
      ]);

      const statuses = results.map(r => r.status).sort();
      expect(statuses).to.deep.equal([201, 422]);

      const reloaded = await reload(pkg.id);
      expect(reloaded.paidAmount).to.equal(8000);
      // Хэзээ ч сөрөг үлдэгдэл гарахгүй
      expect(reloaded.balance).to.equal(2000);
    });

    it('model-ийн `pre(validate)` тогтмолыг ДАХИН шалгана (хамгаалалтын 2 давхарга)', async () => {
      const pkg = await register({ price: 10000 });

      // Домэйныг ТОЙРЧ шууд model-оор бичих оролдлого
      let error = null;
      try {
        await Payment.create({
          amount: 10000,
          method: PAYMENT_METHOD.CASH,
          customerId: pkg.customerId,
          customerPhone: '99112233',
          branchId: branch._id,
          // Нийлбэр 9,000 ≠ 10,000
          allocations: [{ packageId: pkg.id, amount: 9000 }],
        });
      } catch (err) {
        error = err;
      }

      expect(error, 'model нь тогтмолыг шалгах ёстой').to.exist;
      expect(error.message).to.include('таарахгүй');
    });
  });
});
