'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const { expect } = chai;

const { app } = require('../../src/services/express');
const Package = require('../../src/models/package.model');
const Delivery = require('../../src/models/delivery.model');
const AuditLog = require('../../src/models/audit-log.model');
const WarehouseLocation = require('../../src/models/warehouse-location.model');
const { createUserWithToken } = require('../factories/user.factory');
const {
  createBranch,
  createCargoTypeWithTariff,
  createLocation,
} = require('../factories/domain.factory');
const {
  ROLES,
  PACKAGE_STATUS,
  PAYMENT_METHOD,
  DELIVERY_STATUS,
  AUDIT_ACTION,
  AUDIT_ENTITY,
  ERROR_CODE,
} = require('../../src/config/constants');

chai.use(chaiHttp);

const BASE = '/api/v1/deliveries';
const PACKAGES = '/api/v1/packages';
const PAYMENTS = '/api/v1/payments';

describe('Хүргэлтийн модуль (§5)', () => {
  let branch;
  let location;
  let staff;
  let manager;
  let admin;

  beforeEach(async () => {
    branch = await createBranch({ code: 'UB', name: 'Улаанбаатар агуулах' });
    await createCargoTypeWithTariff({ code: 'standard' });
    location = await createLocation(branch, { capacityCount: 100 });

    staff = await createUserWithToken({ role: ROLES.STAFF, branchId: branch._id });
    manager = await createUserWithToken({ role: ROLES.MANAGER, branchId: branch._id });
    admin = await createUserWithToken({ role: ROLES.ADMIN, branchId: branch._id });
  });

  // ── Хэрэгслүүд ──────────────────────────────────────────────────────────

  /** Ачаа бүртгэнэ. Үнийг ГАРААР заана (BR-01a) — дүн тодорхой болно */
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

  function payFull(actor, pkg) {
    return chai
      .request(app)
      .post(PAYMENTS)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ amount: pkg.finalPrice, method: PAYMENT_METHOD.CASH, packageIds: [pkg.id] });
  }

  function createDelivery(actor, payload) {
    return chai.request(app).post(BASE).set('Authorization', `Bearer ${actor.token}`).send(payload);
  }

  function setStatus(actor, id, status, reason) {
    return chai
      .request(app)
      .put(`${BASE}/${id}/status`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ status, reason });
  }

  /** Ачаа бүртгэж, бүрэн төлүүлж, хүргэлт үүсгэнэ */
  async function paidDelivery({ price = 10000, count = 1, phone = '99112233' } = {}) {
    const packages = [];
    for (let i = 0; i < count; i += 1) {
      const pkg = await register({ price, phone });
      await payFull(staff, pkg);
      packages.push(pkg);
    }

    const res = await createDelivery(staff, {
      packageIds: packages.map(p => p.id),
      address: 'ХУД, 3-р хороо, 12-р байр, 34 тоот',
      phone: '99887766',
    });
    expect(res.status, JSON.stringify(res.body)).to.equal(201);

    return { delivery: res.body.data, packages };
  }

  const reload = id => Package.findById(id);

  // ── 4.1 / 4.2 — үүсгэх ба төлөв ─────────────────────────────────────────

  describe('Хүргэлт үүсгэх (§5.1)', () => {
    it('ачаа сонгож хүргэлт үүснэ, дугаар `DLV-YYMM-NNNNNN` хэлбэртэй', async () => {
      const pkg = await register({ price: 10000 });

      const res = await createDelivery(staff, {
        packageIds: [pkg.id],
        address: 'ХУД, 3-р хороо',
        phone: '99887766',
        note: 'Оройн 6-аас хойш',
      });

      expect(res.status, JSON.stringify(res.body)).to.equal(201);
      expect(res.body.data.deliveryNumber).to.match(/^DLV-\d{4}-\d{6}$/);
      expect(res.body.data.status).to.equal(DELIVERY_STATUS.CREATED);
      expect(res.body.data.packageIds).to.have.lengthOf(1);
      expect(res.body.data.phone).to.equal('99887766');
    });

    it('ТӨЛБӨРГҮЙ ачаагаар ч хүргэлт үүснэ — хаалт нь гаргах үед (§5.2)', async () => {
      const pkg = await register({ price: 10000 });

      const res = await createDelivery(staff, {
        packageIds: [pkg.id],
        address: 'ХУД, 3-р хороо',
      });

      expect(res.status, JSON.stringify(res.body)).to.equal(201);
      // Ачаа ХӨДӨЛӨӨГҮЙ байх ёстой (BR-09a — агуулахын нүд эзэлсээр)
      const reloaded = await reload(pkg.id);
      expect(reloaded.status).to.equal(PACKAGE_STATUS.REGISTERED);
    });

    it('хүлээн авагчийн утас заагаагүй бол харилцагчийнхыг авна', async () => {
      const pkg = await register({ price: 10000, phone: '99112233' });

      const res = await createDelivery(staff, {
        packageIds: [pkg.id],
        address: 'ХУД, 3-р хороо',
      });

      expect(res.body.data.phone).to.equal('99112233');
    });

    it('өөр өөр харилцагчийн ачааг холихыг хориглоно', async () => {
      const a = await register({ price: 10000, phone: '99112233' });
      const b = await register({ price: 5000, phone: '99887766' });

      const res = await createDelivery(staff, {
        packageIds: [a.id, b.id],
        address: 'ХУД',
      });

      expect(res.status).to.equal(422);
      expect(res.body.code).to.equal(ERROR_CODE.MIXED_CUSTOMERS);
    });

    it('BR-20a — ачаа хоёр ИДЭВХТЭЙ хүргэлтэд орохгүй', async () => {
      const pkg = await register({ price: 10000 });
      await createDelivery(staff, { packageIds: [pkg.id], address: 'ХУД' });

      const res = await createDelivery(staff, { packageIds: [pkg.id], address: 'БЗД' });

      expect(res.status).to.equal(409);
      expect(res.body.code).to.equal(ERROR_CODE.PACKAGE_IN_ACTIVE_DELIVERY);
    });

    it('ЦУЦЛАГДСАН хүргэлтийн ачаа дахин багцлагдана', async () => {
      const pkg = await register({ price: 10000 });
      const first = await createDelivery(staff, { packageIds: [pkg.id], address: 'ХУД' });

      await chai
        .request(app)
        .put(`${BASE}/${first.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ reason: 'Хаяг буруу байсан' });

      const res = await createDelivery(staff, { packageIds: [pkg.id], address: 'БЗД' });
      expect(res.status, JSON.stringify(res.body)).to.equal(201);
    });

    it('хүчингүй ачааг хүргэлтэнд оруулахгүй', async () => {
      const pkg = await register({ price: 10000 });
      await chai
        .request(app)
        .put(`${PACKAGES}/${pkg.id}/cancel`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ reason: 'Тест хүчингүй' });

      const res = await createDelivery(staff, { packageIds: [pkg.id], address: 'ХУД' });

      expect(res.status).to.equal(422);
      expect(res.body.message).to.include('хүргэлтэнд оруулах боломжгүй');
    });

    it('аль хэдийн хүргэгдсэн ачааг дахин хүргэлтэнд оруулахгүй', async () => {
      const { delivery, packages } = await paidDelivery();
      await setStatus(staff, delivery.id, DELIVERY_STATUS.DISPATCHED);
      await setStatus(staff, delivery.id, DELIVERY_STATUS.DELIVERED);

      const res = await createDelivery(staff, {
        packageIds: [packages[0].id],
        address: 'ХУД',
      });

      expect(res.status).to.equal(422);
    });

    it('хоосон хаягтай хүргэлт үүсэхгүй', async () => {
      const pkg = await register({ price: 10000 });
      const res = await createDelivery(staff, { packageIds: [pkg.id], address: '' });
      expect(res.status).to.equal(400);
    });

    it('дугаар давхардахгүй, дараалан өснө', async () => {
      const a = await register({ price: 1000, phone: '99112233' });
      const b = await register({ price: 1000, phone: '99887766' });

      const first = await createDelivery(staff, { packageIds: [a.id], address: 'ХУД' });
      const second = await createDelivery(staff, { packageIds: [b.id], address: 'БЗД' });

      const seqOf = n => Number(n.split('-')[2]);
      expect(seqOf(second.body.data.deliveryNumber)).to.equal(
        seqOf(first.body.data.deliveryNumber) + 1
      );
    });

    it('жолоочийг системийн ажилтнаас сонгоход нэр ХУУЛБАРЛАГДАНА', async () => {
      const pkg = await register({ price: 10000 });
      const driver = await createUserWithToken({ role: ROLES.STAFF, branchId: branch._id });

      const res = await createDelivery(staff, {
        packageIds: [pkg.id],
        address: 'ХУД',
        driverId: driver.user._id.toString(),
      });

      expect(res.status, JSON.stringify(res.body)).to.equal(201);
      expect(res.body.data.driverId).to.equal(driver.user._id.toString());
      expect(res.body.data.driverName).to.be.a('string').and.not.empty;
    });

    it('гэрээт жолоочийг нэр, утсаар бичнэ (системд бүртгэлгүй)', async () => {
      const pkg = await register({ price: 10000 });

      const res = await createDelivery(staff, {
        packageIds: [pkg.id],
        address: 'ХУД',
        driverName: 'Батбаяр',
        driverPhone: '99001122',
      });

      expect(res.status, JSON.stringify(res.body)).to.equal(201);
      expect(res.body.data.driverId).to.be.null;
      expect(res.body.data.driverName).to.equal('Батбаяр');
    });

    it('audit-д `delivery.create` бичигдэнэ', async () => {
      const pkg = await register({ price: 10000 });
      const res = await createDelivery(staff, { packageIds: [pkg.id], address: 'ХУД' });

      const log = await AuditLog.findOne({
        action: AUDIT_ACTION.DELIVERY_CREATE,
        entity: AUDIT_ENTITY.DELIVERY,
        entityId: res.body.data.id,
      });

      expect(log).to.exist;
      expect(log.after).to.equal(DELIVERY_STATUS.CREATED);
    });
  });

  // ── 4.3 — §5.2 ТӨЛБӨРИЙН ХААЛТ (Phase 4-ийн гол шалгуур) ────────────────

  describe('§5.2 / BR-19, BR-20 — Төлбөргүйгээр хүргэлтэнд ГАРАХГҮЙ', () => {
    it('төлбөр дутуу ачааг хүргэлтэнд гаргахгүй, дүнг мессежид заана', async () => {
      const pkg = await register({ price: 10000 });
      const created = await createDelivery(staff, { packageIds: [pkg.id], address: 'ХУД' });

      const res = await setStatus(staff, created.body.data.id, DELIVERY_STATUS.DISPATCHED);

      expect(res.status).to.equal(422);
      expect(res.body.code).to.equal(ERROR_CODE.UNPAID_PACKAGES);
      expect(res.body.message).to.include('Төлбөр дутуу байна: 10,000₮');

      // Хүргэлт ба ачаа хоёул ХӨДӨЛӨӨГҮЙ байх ёстой
      const delivery = await Delivery.findById(created.body.data.id);
      expect(delivery.status).to.equal(DELIVERY_STATUS.CREATED);
      expect(delivery.dispatchedAt).to.be.null;
      expect((await reload(pkg.id)).status).to.equal(PACKAGE_STATUS.REGISTERED);
    });

    it('ХЭСЭГЧИЛСЭН төлбөртэй ч гаргахгүй', async () => {
      const pkg = await register({ price: 10000 });
      await chai
        .request(app)
        .post(PAYMENTS)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ amount: 6000, method: PAYMENT_METHOD.CASH, packageIds: [pkg.id] });

      const created = await createDelivery(staff, { packageIds: [pkg.id], address: 'ХУД' });
      const res = await setStatus(staff, created.body.data.id, DELIVERY_STATUS.DISPATCHED);

      expect(res.status).to.equal(422);
      expect(res.body.message).to.include('4,000₮');
    });

    it('БАГЦ доторх нэг ч ачаа дутуу бол БҮХЭЛДЭЭ блоклогдоно (BR-20)', async () => {
      const paid = await register({ price: 10000 });
      await payFull(staff, paid);
      const unpaid = await register({ price: 3000 });

      const created = await createDelivery(staff, {
        packageIds: [paid.id, unpaid.id],
        address: 'ХУД',
      });

      const res = await setStatus(staff, created.body.data.id, DELIVERY_STATUS.DISPATCHED);

      expect(res.status).to.equal(422);
      expect(res.body.code).to.equal(ERROR_CODE.UNPAID_PACKAGES);
      expect(res.body.details.unpaidTotal).to.equal(3000);
      expect(res.body.details.packages).to.have.lengthOf(1);

      // Төлсөн ачаа ч ХӨДӨЛӨӨГҮЙ — багц бүхэлдээ буцсан
      expect((await reload(paid.id)).status).to.equal(PACKAGE_STATUS.PAID);
    });

    it('OVERRIDE БАЙХГҮЙ — АДМИН ч тойрч чадахгүй (§5.2)', async () => {
      const pkg = await register({ price: 10000 });
      const created = await createDelivery(staff, { packageIds: [pkg.id], address: 'ХУД' });

      const res = await setStatus(admin, created.body.data.id, DELIVERY_STATUS.DISPATCHED);

      expect(res.status).to.equal(422);
      expect(res.body.code).to.equal(ERROR_CODE.UNPAID_PACKAGES);
    });

    it('төлбөр орсны ДАРАА гарна', async () => {
      const pkg = await register({ price: 10000 });
      const created = await createDelivery(staff, { packageIds: [pkg.id], address: 'ХУД' });

      const blocked = await setStatus(staff, created.body.data.id, DELIVERY_STATUS.DISPATCHED);
      expect(blocked.status).to.equal(422);

      await payFull(staff, pkg);

      const res = await setStatus(staff, created.body.data.id, DELIVERY_STATUS.DISPATCHED);
      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect(res.body.data.status).to.equal(DELIVERY_STATUS.DISPATCHED);
    });

    it('гаргасны дараа төлбөр ХҮЧИНГҮЙ болбол ДАХИН гаргах боломжгүй', async () => {
      const { delivery, packages } = await paidDelivery();
      await setStatus(staff, delivery.id, DELIVERY_STATUS.DISPATCHED);
      await setStatus(staff, delivery.id, DELIVERY_STATUS.RETURNED);

      // Буцсаны дараа төлбөрийг хүчингүй болгоно (BR-18)
      const payments = await chai
        .request(app)
        .get(`${PAYMENTS}/package/${packages[0].id}`)
        .set('Authorization', `Bearer ${staff.token}`);

      await chai
        .request(app)
        .put(`${PAYMENTS}/${payments.body.data[0].id}/void`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ reason: 'Дансаар ороогүй' });

      const res = await setStatus(staff, delivery.id, DELIVERY_STATUS.DISPATCHED);
      expect(res.status).to.equal(422);
      expect(res.body.code).to.equal(ERROR_CODE.UNPAID_PACKAGES);
    });

    it('ачааны түвшний хамгаалалт (BR-19) — API-аар шууд дуудсан ч болохгүй', async () => {
      const pkg = await register({ price: 10000 });

      const res = await chai
        .request(app)
        .put(`${PACKAGES}/${pkg.id}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: PACKAGE_STATUS.OUT_FOR_DELIVERY });

      expect(res.status).to.equal(409);
    });
  });

  // ── 4.2 — төлөвийн урсгал ба ачаа чирэх ─────────────────────────────────

  describe('BR-21 — Хүргэлтийн төлөв ба ачааны төлөв', () => {
    it('гарахад бүх ачаа `out_for_delivery` болно', async () => {
      const { delivery, packages } = await paidDelivery({ count: 3 });

      const res = await setStatus(staff, delivery.id, DELIVERY_STATUS.DISPATCHED);
      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect(res.body.data.dispatchedAt).to.not.be.null;

      for (const pkg of packages) {
        expect((await reload(pkg.id)).status).to.equal(PACKAGE_STATUS.OUT_FOR_DELIVERY);
      }
    });

    it('хүргэгдэхэд бүх ачаа `delivered` болно', async () => {
      const { delivery, packages } = await paidDelivery({ count: 2 });
      await setStatus(staff, delivery.id, DELIVERY_STATUS.DISPATCHED);

      const res = await setStatus(staff, delivery.id, DELIVERY_STATUS.DELIVERED);
      expect(res.status).to.equal(200);
      expect(res.body.data.deliveredAt).to.not.be.null;

      for (const pkg of packages) {
        expect((await reload(pkg.id)).status).to.equal(PACKAGE_STATUS.DELIVERED);
      }
    });

    it('буцахад ачаа `returned` болж агуулахын нүдийг ДАХИН эзэлнэ (BR-09a)', async () => {
      const { delivery, packages } = await paidDelivery();

      const before = await WarehouseLocation.findById(location._id);
      expect(before.currentCount).to.equal(1);

      await setStatus(staff, delivery.id, DELIVERY_STATUS.DISPATCHED);
      expect((await WarehouseLocation.findById(location._id)).currentCount).to.equal(0);

      await setStatus(staff, delivery.id, DELIVERY_STATUS.RETURNED, 'Хаяг олдсонгүй');

      expect((await reload(packages[0].id)).status).to.equal(PACKAGE_STATUS.RETURNED);
      expect((await WarehouseLocation.findById(location._id)).currentCount).to.equal(1);
    });

    it('буцсан хүргэлтийг ДАХИН гаргана', async () => {
      const { delivery, packages } = await paidDelivery();
      await setStatus(staff, delivery.id, DELIVERY_STATUS.DISPATCHED);
      await setStatus(staff, delivery.id, DELIVERY_STATUS.RETURNED);

      const res = await setStatus(staff, delivery.id, DELIVERY_STATUS.DISPATCHED);
      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect((await reload(packages[0].id)).status).to.equal(PACKAGE_STATUS.OUT_FOR_DELIVERY);
    });

    it('зөвшөөрөгдөөгүй шилжилт 409 буцаана', async () => {
      const { delivery } = await paidDelivery();

      const res = await setStatus(staff, delivery.id, DELIVERY_STATUS.DELIVERED);
      expect(res.status).to.equal(409);
      expect(res.body.code).to.equal(ERROR_CODE.INVALID_DELIVERY_TRANSITION);
    });

    it('хүргэгдсэн хүргэлт нь ТӨГСГӨЛИЙН — цааш шилжихгүй', async () => {
      const { delivery } = await paidDelivery();
      await setStatus(staff, delivery.id, DELIVERY_STATUS.DISPATCHED);
      await setStatus(staff, delivery.id, DELIVERY_STATUS.DELIVERED);

      const res = await setStatus(staff, delivery.id, DELIVERY_STATUS.RETURNED);
      expect(res.status).to.equal(409);
    });

    it('төлөв бүр `statusHistory` ба audit-д бичигдэнэ', async () => {
      const { delivery } = await paidDelivery();
      await setStatus(staff, delivery.id, DELIVERY_STATUS.DISPATCHED, 'Маршрут 1');

      const reloaded = await Delivery.findById(delivery.id);
      expect(reloaded.statusHistory).to.have.lengthOf(2);
      expect(reloaded.statusHistory[1].from).to.equal(DELIVERY_STATUS.CREATED);
      expect(reloaded.statusHistory[1].to).to.equal(DELIVERY_STATUS.DISPATCHED);
      expect(reloaded.statusHistory[1].reason).to.equal('Маршрут 1');

      const log = await AuditLog.findOne({
        action: AUDIT_ACTION.DELIVERY_STATUS_CHANGE,
        entityId: delivery.id,
      });
      expect(log).to.exist;
      expect(log.after).to.equal(DELIVERY_STATUS.DISPATCHED);
    });

    it('олон хүргэлтийг нэг дор гаргана, амжилтгүйг тусад нь заана', async () => {
      const ok = await paidDelivery({ phone: '99112233' });

      const unpaidPkg = await register({ price: 5000, phone: '99887766' });
      const blocked = await createDelivery(staff, {
        packageIds: [unpaidPkg.id],
        address: 'БЗД',
      });

      const res = await chai
        .request(app)
        .put(`${BASE}/bulk/status`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ ids: [ok.delivery.id, blocked.body.data.id], status: DELIVERY_STATUS.DISPATCHED });

      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect(res.body.data.succeeded).to.have.lengthOf(1);
      expect(res.body.data.failed).to.have.lengthOf(1);
      expect(res.body.data.failed[0].code).to.equal(ERROR_CODE.UNPAID_PACKAGES);
    });
  });

  // ── Цуцлах ─────────────────────────────────────────────────────────────

  describe('Цуцлах — устгахгүй (CLAUDE.md §5 дүрэм 4)', () => {
    it('Менежер шалтгаантай цуцална, ачаа ХӨДӨЛӨХГҮЙ', async () => {
      const pkg = await register({ price: 10000 });
      const created = await createDelivery(staff, { packageIds: [pkg.id], address: 'ХУД' });

      const res = await chai
        .request(app)
        .put(`${BASE}/${created.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ reason: 'Харилцагч өөрөө ирэхээрболов' });

      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect(res.body.data.status).to.equal(DELIVERY_STATUS.CANCELLED);
      expect(res.body.data.cancelReason).to.include('Харилцагч');
      expect((await reload(pkg.id)).status).to.equal(PACKAGE_STATUS.REGISTERED);

      // Бичлэг УСТААГҮЙ
      expect(await Delivery.findById(created.body.data.id)).to.exist;
    });

    it('Ажилтан цуцалж ЧАДАХГҮЙ', async () => {
      const pkg = await register({ price: 10000 });
      const created = await createDelivery(staff, { packageIds: [pkg.id], address: 'ХУД' });

      const res = await chai
        .request(app)
        .put(`${BASE}/${created.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ reason: 'Буруу байсан' });

      expect(res.status).to.equal(403);
    });

    it('шалтгаангүй цуцлахгүй', async () => {
      const pkg = await register({ price: 10000 });
      const created = await createDelivery(staff, { packageIds: [pkg.id], address: 'ХУД' });

      const res = await chai
        .request(app)
        .put(`${BASE}/${created.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ reason: '' });

      expect(res.status).to.equal(400);
    });

    it('ГАРСАН хүргэлтийг цуцлахгүй — `returned` нь зөв зам', async () => {
      const { delivery } = await paidDelivery();
      await setStatus(staff, delivery.id, DELIVERY_STATUS.DISPATCHED);

      const res = await chai
        .request(app)
        .put(`${BASE}/${delivery.id}/cancel`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ reason: 'Санаандгүй гаргасан' });

      expect(res.status).to.equal(409);
    });
  });

  // ── Засах ──────────────────────────────────────────────────────────────

  describe('Засах — зөвхөн `created` төлөвт', () => {
    it('хаяг, жолооч, огноог засна, audit-д бичигдэнэ', async () => {
      const pkg = await register({ price: 10000 });
      const created = await createDelivery(staff, { packageIds: [pkg.id], address: 'ХУД' });

      const res = await chai
        .request(app)
        .put(`${BASE}/${created.body.data.id}`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ address: 'БЗД, 5-р хороо', driverName: 'Дорж', fee: 5000 });

      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect(res.body.data.address).to.equal('БЗД, 5-р хороо');
      expect(res.body.data.driverName).to.equal('Дорж');
      expect(res.body.data.fee).to.equal(5000);

      const log = await AuditLog.findOne({
        action: AUDIT_ACTION.DELIVERY_UPDATE,
        entityId: created.body.data.id,
        field: 'address',
      });
      expect(log).to.exist;
    });

    it('ГАРСАН хүргэлтийн хаягийг засахгүй', async () => {
      const { delivery } = await paidDelivery();
      await setStatus(staff, delivery.id, DELIVERY_STATUS.DISPATCHED);

      const res = await chai
        .request(app)
        .put(`${BASE}/${delivery.id}`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ address: 'Өөр хаяг' });

      expect(res.status).to.equal(422);
    });

    it('хүргэлтийн төлбөр (`fee`) ачааны үлдэгдэлд НӨЛӨӨЛӨХГҮЙ (Q3)', async () => {
      const { delivery, packages } = await paidDelivery();

      await chai
        .request(app)
        .put(`${BASE}/${delivery.id}`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ fee: 8000 });

      const pkg = await reload(packages[0].id);
      expect(pkg.balance).to.equal(0);
      expect(pkg.paidAmount).to.equal(10000);

      // fee нь хаалтад ч оролцохгүй — хүргэлт хэвийн гарна
      const res = await setStatus(staff, delivery.id, DELIVERY_STATUS.DISPATCHED);
      expect(res.status, JSON.stringify(res.body)).to.equal(200);
    });
  });

  // ── 4.5 — жагсаалт, өдрийн маршрут ──────────────────────────────────────

  describe('Жагсаалт ба өдрийн маршрут (§5, §9.3)', () => {
    it('жагсаалт хуудаслагдсан, төлөвөөр шүүгдэнэ', async () => {
      await paidDelivery({ phone: '99112233' });
      const b = await register({ price: 1000, phone: '99887766' });
      await createDelivery(staff, { packageIds: [b.id], address: 'БЗД' });

      const res = await chai
        .request(app)
        .get(`${BASE}?status=${DELIVERY_STATUS.CREATED}&limit=10`)
        .set('Authorization', `Bearer ${staff.token}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.lengthOf(2);
      expect(res.body.pagination.limit).to.equal(10);
    });

    it('өдрийн маршрутыг товлосон огноогоор шүүнэ', async () => {
      const pkg = await register({ price: 1000 });
      const today = new Date();
      await createDelivery(staff, {
        packageIds: [pkg.id],
        address: 'ХУД',
        scheduledDate: today.toISOString(),
      });

      const from = new Date(today);
      from.setHours(0, 0, 0, 0);
      const to = new Date(today);
      to.setHours(23, 59, 59, 999);

      const res = await chai
        .request(app)
        .get(`${BASE}?scheduledFrom=${from.toISOString()}&scheduledTo=${to.toISOString()}`)
        .set('Authorization', `Bearer ${staff.token}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.lengthOf(1);
    });

    it('нэгтгэл төлөв тус бүрийн тоог буцаана', async () => {
      const a = await paidDelivery({ phone: '99112233' });
      await setStatus(staff, a.delivery.id, DELIVERY_STATUS.DISPATCHED);
      const b = await register({ price: 1000, phone: '99887766' });
      await createDelivery(staff, { packageIds: [b.id], address: 'БЗД' });

      const res = await chai
        .request(app)
        .get(`${BASE}/summary`)
        .set('Authorization', `Bearer ${staff.token}`);

      expect(res.status).to.equal(200);
      expect(res.body.data.total).to.equal(2);
      expect(res.body.data.byStatus[DELIVERY_STATUS.DISPATCHED].count).to.equal(1);
      expect(res.body.data.byStatus[DELIVERY_STATUS.CREATED].count).to.equal(1);
    });

    it('утсаар хүргэх боломжтой ачааг харуулна, идэвхтэй хүргэлтэд орсныг ХАСНА', async () => {
      const a = await register({ price: 1000, phone: '99112233' });
      const b = await register({ price: 2000, phone: '99112233' });
      await createDelivery(staff, { packageIds: [a.id], address: 'ХУД' });

      const res = await chai
        .request(app)
        .get(`${BASE}/deliverable/99112233`)
        .set('Authorization', `Bearer ${staff.token}`);

      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect(res.body.data.packages).to.have.lengthOf(1);
      expect(res.body.data.packages[0].id).to.equal(b.id);
      expect(res.body.data.totalBalance).to.equal(2000);
      expect(res.body.data.inActiveDelivery).to.have.lengthOf(1);
    });

    it('дэлгэрэнгүйд төлбөр дутуу ачаа ба нийт дүн харагдана (§5.2 UI)', async () => {
      const paid = await register({ price: 10000 });
      await payFull(staff, paid);
      const unpaid = await register({ price: 3000 });
      const created = await createDelivery(staff, {
        packageIds: [paid.id, unpaid.id],
        address: 'ХУД',
      });

      const res = await chai
        .request(app)
        .get(`${BASE}/${created.body.data.id}`)
        .set('Authorization', `Bearer ${staff.token}`);

      expect(res.status).to.equal(200);
      expect(res.body.data.unpaidTotal).to.equal(3000);
      expect(res.body.data.unpaidPackages).to.have.lengthOf(1);
      expect(res.body.data.allowedTransitions).to.deep.equal([DELIVERY_STATUS.DISPATCHED]);
    });

    it('ачааны дэлгэрэнгүйд хүргэлтийн түүх харагдана', async () => {
      const { delivery, packages } = await paidDelivery();

      const res = await chai
        .request(app)
        .get(`${PACKAGES}/${packages[0].id}`)
        .set('Authorization', `Bearer ${staff.token}`);

      expect(res.status).to.equal(200);
      expect(res.body.data.deliveries).to.have.lengthOf(1);
      expect(res.body.data.deliveries[0].deliveryNumber).to.equal(delivery.deliveryNumber);
    });
  });

  // ── Эрх ────────────────────────────────────────────────────────────────

  describe('§9.1 — эрх', () => {
    it('нэвтрээгүй хүсэлт 401', async () => {
      const res = await chai.request(app).get(BASE);
      expect(res.status).to.equal(401);
    });

    it('Ажилтан хүргэлт үүсгэж, төлөв солино', async () => {
      const { delivery } = await paidDelivery();
      const res = await setStatus(staff, delivery.id, DELIVERY_STATUS.DISPATCHED);
      expect(res.status).to.equal(200);
    });
  });
});
