'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const { expect } = chai;

const { app } = require('../../src/services/express');
const Package = require('../../src/models/package.model');
const AuditLog = require('../../src/models/audit-log.model');
const Customer = require('../../src/models/customer.model');
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
  PAYMENT_STATUS,
  PRICE_SOURCE,
  AUDIT_ACTION,
  AUDIT_ENTITY,
  ERROR_CODE,
} = require('../../src/config/constants');

chai.use(chaiHttp);

const BASE = '/api/v1/packages';

describe('Ачааны модуль (§1)', () => {
  let branch;
  let cargoType;
  let tariff;
  let location;
  let staff;
  let manager;
  let admin;

  beforeEach(async () => {
    branch = await createBranch({ code: 'ER', name: 'Эрээн агуулах' });
    ({ cargoType, tariff } = await createCargoTypeWithTariff({ code: 'standard' }));
    location = await createLocation(branch, { capacityCount: 10 });

    staff = await createUserWithToken({ role: ROLES.STAFF, branchId: branch._id });
    manager = await createUserWithToken({ role: ROLES.MANAGER, branchId: branch._id });
    admin = await createUserWithToken({ role: ROLES.ADMIN });
  });

  /** Ачаа бүртгэх хүсэлтийн суурь бие */
  function body(overrides = {}) {
    return {
      trackingNumber: `TRK${Math.floor(Math.random() * 1e9)}`,
      phone: '99112233',
      cargoTypeId: String(cargoType._id),
      quantity: 1,
      weightKg: 0.4,
      locationCode: location.code,
      ...overrides,
    };
  }

  function post(actor, payload) {
    return chai.request(app).post(BASE).set('Authorization', `Bearer ${actor.token}`).send(payload);
  }

  async function register(actor = staff, overrides = {}) {
    const res = await post(actor, body(overrides));
    expect(res.status, JSON.stringify(res.body)).to.equal(201);
    return res.body.data.package;
  }

  // ────────────────────────────────────────────────────────────────────────
  describe('POST / — бүртгэх (§1.1, §1.2)', () => {
    it('BR-01 — жингийн шатлалаар үнэ автоматаар бодогдоно', async () => {
      const pkg = await register(staff, { weightKg: 0.4 });

      // 400гр → 101–500гр шатлал = 1,500₮
      expect(pkg.computedPrice).to.equal(1500);
      expect(pkg.finalPrice).to.equal(1500);
      expect(pkg.priceSource).to.equal(PRICE_SOURCE.WEIGHT);
      expect(pkg.priceOverridden).to.be.false;
    });

    it('BR-01 — эзлэхүүн давамгайлбал түүнээр бодогдоно', async () => {
      // 50×50×50см = 0.125м³ × 400,000₮ = 50,000₮ > жингийн 800₮
      const pkg = await register(staff, {
        weightKg: 0.05,
        dimensions: { lengthCm: 50, widthCm: 50, heightCm: 50 },
      });

      expect(pkg.volumeM3).to.equal(0.125);
      expect(pkg.finalPrice).to.equal(50000);
      expect(pkg.priceSource).to.equal(PRICE_SOURCE.VOLUME);
    });

    it('BR-03 — хэмжээснээс эзлэхүүн автоматаар бодогдоно', async () => {
      const pkg = await register(staff, {
        dimensions: { lengthCm: 100, widthCm: 100, heightCm: 100 },
      });
      expect(pkg.volumeM3).to.equal(1);
    });

    it('BR-02 — бүртгэх үеийн тарифын snapshot ачаанд хуулагдана', async () => {
      const pkg = await register();

      expect(pkg.pricingSnapshot.pricePerM3).to.equal(400000);
      expect(pkg.pricingSnapshot.pricePerKgAbove).to.equal(2000);
      expect(pkg.pricingSnapshot.weightBrackets).to.have.lengthOf(3);
      expect(String(pkg.pricingSnapshot.tariffVersionId)).to.equal(String(tariff._id));
    });

    it('BR-29 — харилцагч утсаар автоматаар үүснэ', async () => {
      await register(staff, { phone: '+976 9955 4433', customerName: 'Дорж' });

      const customer = await Customer.findOne({ phone: '99554433' });
      expect(customer).to.exist;
      expect(customer.name).to.equal('Дорж');
      expect(customer.hasAccount).to.be.false;
    });

    it('BR-27 — утас нормчлогдож хадгалагдана', async () => {
      const pkg = await register(staff, { phone: '976-9911-2233' });
      expect(pkg.customerPhone).to.equal('99112233');
    });

    it('нэг харилцагчийн хоёр дахь ачаа ижил бичлэгт холбогдоно', async () => {
      const a = await register(staff, { phone: '99112233' });
      const b = await register(staff, { phone: '99112233' });

      expect(String(a.customerId)).to.equal(String(b.customerId));
      expect(await Customer.countDocuments({ phone: '99112233' })).to.equal(1);
    });

    it('ачааны дугаар нормчлогдоно (зай арилж, том үсэг болно)', async () => {
      const pkg = await register(staff, { trackingNumber: 'sf 1234 abc' });
      expect(pkg.trackingNumber).to.equal('SF1234ABC');
    });

    it('§8 — байршлын нүдний ачаалал нэмэгдэнэ', async () => {
      await register();

      const updated = await WarehouseLocation.findById(location._id);
      expect(updated.currentCount).to.equal(1);
    });

    it('BR-22a — нэг салбарын горимд branchId заах шаардлагагүй', async () => {
      const pkg = await register();
      expect(String(pkg.branchId)).to.equal(String(branch._id));
      expect(pkg.branchCode).to.equal('ER');
    });

    it('төлөв registered, төлбөр unpaid, түүх бичигдсэн байна', async () => {
      const pkg = await register();

      expect(pkg.status).to.equal(PACKAGE_STATUS.REGISTERED);
      expect(pkg.paymentStatus).to.equal(PAYMENT_STATUS.UNPAID);
      expect(pkg.balance).to.equal(pkg.finalPrice);
      expect(pkg.statusHistory).to.have.lengthOf(1);
      expect(pkg.statusHistory[0].to).to.equal(PACKAGE_STATUS.REGISTERED);
      expect(pkg.statusHistory[0].from).to.be.null;
    });

    it('§9.2 — бүртгэл audit-д бичигдэнэ', async () => {
      const pkg = await register();

      const log = await AuditLog.findOne({
        action: AUDIT_ACTION.PACKAGE_CREATE,
        entityId: pkg.id,
      });
      expect(log).to.exist;
      expect(log.entityLabel).to.equal(pkg.trackingNumber);
      expect(log.after.finalPrice).to.equal(pkg.finalPrice);
    });

    it('BR-01 — жин ба эзлэхүүн хоёулаа байхгүй бол хүлээж авахгүй', async () => {
      const payload = body();
      delete payload.weightKg;

      const res = await post(staff, payload);
      expect(res.status).to.equal(400);
    });

    it('§1.1 — байршил заагаагүй бол хүлээж авахгүй', async () => {
      const payload = body();
      delete payload.locationCode;

      const res = await post(staff, payload);
      expect(res.status).to.equal(400);
    });

    it('өөр салбарын байршилд ачаа тавихыг хориглоно', async () => {
      const other = await createBranch({ code: 'UB' });
      const otherLocation = await createLocation(other);

      const res = await post(
        staff,
        body({ locationCode: otherLocation.code, branchId: String(branch._id) })
      );
      expect(res.status).to.equal(400);
      expect(res.body.message).to.include('хамаарахгүй');
    });

    it('байхгүй байршлын код 404 буцаана', async () => {
      const res = await post(staff, body({ locationCode: 'ER-09-Z-99' }));
      expect(res.status).to.equal(404);
    });

    it('идэвхгүй ачааны төрлөөр бүртгэхгүй', async () => {
      const { cargoType: disabled } = await createCargoTypeWithTariff({ isActive: false });
      const res = await post(staff, body({ cargoTypeId: String(disabled._id) }));
      expect(res.status).to.equal(422);
    });

    it('BR-24 — багтаамж хэтэрсэн нүдэнд бүртгэхийг ХОРИГЛОХГҮЙ, сануулна', async () => {
      const full = await createLocation(branch, { capacityCount: 1, currentCount: 1 });

      const res = await post(staff, body({ locationCode: full.code }));
      expect(res.status).to.equal(201);
      expect(res.body.data.warnings).to.have.lengthOf(1);
      expect(res.body.data.warnings[0]).to.include('багтаамж');
    });

    it('нэвтрээгүй хүн ачаа бүртгэхгүй', async () => {
      const res = await chai.request(app).post(BASE).send(body());
      expect(res.status).to.equal(401);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  describe('§1.3 — Давхар бүртгэлийн хамгаалалт', () => {
    it('BR-05 — ажилтан давхардуулж ЧАДАХГҮЙ', async () => {
      const first = await register(staff, { trackingNumber: 'DUP001' });

      const res = await post(staff, body({ trackingNumber: 'DUP001' }));

      expect(res.status).to.equal(409);
      expect(res.body.code).to.equal(ERROR_CODE.DUPLICATE_TRACKING_NUMBER);
      // §1.3 — "[огноо]-нд [ажилтан]-аар бүртгэгдсэн" гэж харуулах өгөгдөл
      expect(String(res.body.details.packageId)).to.equal(String(first.id));
      expect(res.body.details.registeredAt).to.exist;
      expect(res.body.details.registeredBy).to.include('Ажилтан');
      expect(await Package.countDocuments({ trackingNumber: 'DUP001' })).to.equal(1);
    });

    it('ажилтан allowDuplicate тавьсан ч зөвшөөрөгдөхгүй (BR-06)', async () => {
      await register(staff, { trackingNumber: 'DUP002' });

      const res = await post(
        staff,
        body({ trackingNumber: 'DUP002', allowDuplicate: true, duplicateReason: 'би л мэднэ' })
      );
      expect(res.status).to.equal(403);
    });

    it('BR-06 — Менежер шалтгаантайгаар давхардуулж болно', async () => {
      await register(staff, { trackingNumber: 'DUP003' });

      const res = await post(
        manager,
        body({
          trackingNumber: 'DUP003',
          allowDuplicate: true,
          duplicateReason: 'Тээвэрлэгч дугаарыг дахин ашигласан',
        })
      );

      expect(res.status).to.equal(201);
      expect(res.body.data.package.isDuplicateApproved).to.be.true;
      expect(await Package.countDocuments({ trackingNumber: 'DUP003' })).to.equal(2);

      const log = await AuditLog.findOne({ action: AUDIT_ACTION.PACKAGE_DUPLICATE_APPROVED });
      expect(log).to.exist;
      expect(log.reason).to.include('дахин ашигласан');
    });

    it('Менежер шалтгаангүй давхардуулж чадахгүй', async () => {
      await register(staff, { trackingNumber: 'DUP004' });

      const res = await post(manager, body({ trackingNumber: 'DUP004', allowDuplicate: true }));
      expect(res.status).to.equal(400);
      expect(res.body.message).to.include('шалтгаан');
    });

    it('BR-05 — ХҮЧИНГҮЙ болсон дугаарыг дахин бүртгэж болно', async () => {
      const first = await register(staff, { trackingNumber: 'DUP005' });

      await chai
        .request(app)
        .put(`${BASE}/${first.id}/cancel`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ reason: 'Ажилтны бүртгэлийн алдаа' });

      const res = await post(staff, body({ trackingNumber: 'DUP005' }));
      expect(res.status, JSON.stringify(res.body)).to.equal(201);
    });

    it('давхардлыг шалгахад ТОМ/ЖИЖИГ үсэг, зай нөлөөлөхгүй', async () => {
      await register(staff, { trackingNumber: 'ABC123' });

      const res = await post(staff, body({ trackingNumber: 'abc 123' }));
      expect(res.status).to.equal(409);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  describe('§1.2 — Үнэ override (BR-04)', () => {
    it('ажилтан ±20% хүрээнд бүртгэх үедээ override хийнэ', async () => {
      // Бодогдох үнэ 1,500₮ → 20% = ±300₮
      const pkg = await register(staff, {
        weightKg: 0.4,
        finalPrice: 1700,
        priceOverrideReason: 'Жинлүүрийн зөрүү',
      });

      expect(pkg.computedPrice).to.equal(1500);
      expect(pkg.finalPrice).to.equal(1700);
      expect(pkg.priceOverridden).to.be.true;
      expect(pkg.balance).to.equal(1700);
    });

    it('ажилтан хязгаараас давсан override хийж ЧАДАХГҮЙ', async () => {
      const res = await post(
        staff,
        body({ weightKg: 0.4, finalPrice: 5000, priceOverrideReason: 'хямдрал' })
      );

      expect(res.status).to.equal(403);
      expect(res.body.code).to.equal(ERROR_CODE.OVERRIDE_LIMIT_EXCEEDED);
      expect(res.body.details.limitPercent).to.equal(20);
    });

    it('Менежер хязгааргүй override хийнэ', async () => {
      const pkg = await register(manager, {
        weightKg: 0.4,
        finalPrice: 500,
        priceOverrideReason: 'Тогтмол харилцагчийн хөнгөлөлт',
      });
      expect(pkg.finalPrice).to.equal(500);
    });

    it('шалтгаангүй override хүлээж авахгүй', async () => {
      const res = await post(staff, body({ finalPrice: 1600 }));
      expect(res.status).to.equal(400);
    });

    it('PUT /:id/price — дараа нь override хийнэ, audit-д хоёр дүн бичигдэнэ', async () => {
      const pkg = await register(staff, { weightKg: 0.4 });

      const res = await chai
        .request(app)
        .put(`${BASE}/${pkg.id}/price`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ price: 3000, reason: 'Гэрээт үнэ' });

      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect(res.body.data.finalPrice).to.equal(3000);
      expect(res.body.data.computedPrice).to.equal(1500);
      expect(res.body.data.balance).to.equal(3000);

      const log = await AuditLog.findOne({ action: AUDIT_ACTION.PACKAGE_PRICE_OVERRIDE });
      expect(log.before).to.equal(1500);
      expect(log.after).to.equal(3000);
      expect(log.reason).to.equal('Гэрээт үнэ');
    });

    it('ижил үнээр override хийхийг зөвшөөрөхгүй', async () => {
      const pkg = await register(staff, { weightKg: 0.4 });

      const res = await chai
        .request(app)
        .put(`${BASE}/${pkg.id}/price`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ price: 1500, reason: 'юу ч биш' });

      expect(res.status).to.equal(400);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  describe('§1.5 — Төлөв өөрчлөх (BR-07, BR-08)', () => {
    function changeStatus(actor, id, payload) {
      return chai
        .request(app)
        .put(`${BASE}/${id}/status`)
        .set('Authorization', `Bearer ${actor.token}`)
        .send(payload);
    }

    it('зөвшөөрөгдсөн шилжилт ажиллаж, түүх бичигдэнэ', async () => {
      const pkg = await register();

      const res = await changeStatus(staff, pkg.id, {
        status: PACKAGE_STATUS.IN_TRANSIT,
        reason: 'Машинд ачив',
      });

      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect(res.body.data.status).to.equal(PACKAGE_STATUS.IN_TRANSIT);
      expect(res.body.data.statusHistory).to.have.lengthOf(2);
      expect(res.body.data.statusHistory[1].from).to.equal(PACKAGE_STATUS.REGISTERED);
      expect(res.body.data.statusHistory[1].reason).to.equal('Машинд ачив');
    });

    it('BR-07 — registered → delivered ҮСРЭХ боломжгүй', async () => {
      const pkg = await register();

      const res = await changeStatus(staff, pkg.id, { status: PACKAGE_STATUS.DELIVERED });

      expect(res.status).to.equal(409);
      expect(res.body.code).to.equal(ERROR_CODE.INVALID_STATUS_TRANSITION);
      expect(await Package.findById(pkg.id)).to.have.property('status', PACKAGE_STATUS.REGISTERED);
    });

    it('BR-09 — paid төлөвийг гараар оноож болохгүй', async () => {
      const pkg = await register();
      await Package.collection.updateOne(
        { _id: new Package.base.Types.ObjectId(pkg.id) },
        { $set: { status: PACKAGE_STATUS.AWAITING_PAYMENT } }
      );

      const res = await changeStatus(manager, pkg.id, { status: PACKAGE_STATUS.PAID });
      expect(res.status).to.equal(409);
      expect(res.body.message).to.include('гараар');
    });

    it('BR-19 — төлбөргүй ачааг хүргэлтэнд гаргахгүй', async () => {
      const pkg = await register();
      await Package.collection.updateOne(
        { _id: new Package.base.Types.ObjectId(pkg.id) },
        { $set: { status: PACKAGE_STATUS.PAID, paymentStatus: PAYMENT_STATUS.PARTIAL } }
      );

      const res = await changeStatus(staff, pkg.id, { status: PACKAGE_STATUS.OUT_FOR_DELIVERY });
      expect(res.status).to.equal(409);
      expect(res.body.message).to.include('Төлбөр бүрэн төлөгдөөгүй');
    });

    it('§8 — илгээгдэхэд агуулахын нүд чөлөөлөгдөнө', async () => {
      const pkg = await register();
      expect((await WarehouseLocation.findById(location._id)).currentCount).to.equal(1);

      await changeStatus(staff, pkg.id, { status: PACKAGE_STATUS.IN_TRANSIT });

      expect((await WarehouseLocation.findById(location._id)).currentCount).to.equal(0);
    });

    it('агуулах дотор үлдэх шилжилт нүдний ачааллыг хөдөлгөхгүй', async () => {
      const pkg = await register();
      await Package.collection.updateOne(
        { _id: new Package.base.Types.ObjectId(pkg.id) },
        { $set: { status: PACKAGE_STATUS.ARRIVED } }
      );

      await changeStatus(staff, pkg.id, { status: PACKAGE_STATUS.NOTIFIED });

      expect((await WarehouseLocation.findById(location._id)).currentCount).to.equal(1);
    });

    it('§9.2 — шилжилт audit-д бичигдэнэ', async () => {
      const pkg = await register();
      await changeStatus(staff, pkg.id, { status: PACKAGE_STATUS.IN_TRANSIT });

      const log = await AuditLog.findOne({ action: AUDIT_ACTION.PACKAGE_STATUS_CHANGE });
      expect(log.before).to.equal(PACKAGE_STATUS.REGISTERED);
      expect(log.after).to.equal(PACKAGE_STATUS.IN_TRANSIT);
    });

    it('төлөв өөрчлөх endpoint-оор cancelled оноож болохгүй (тусдаа дүрэмтэй)', async () => {
      const pkg = await register();
      const res = await changeStatus(staff, pkg.id, { status: PACKAGE_STATUS.CANCELLED });
      expect(res.status).to.equal(400);
    });

    it('§1.9 — олон ачааг нэг дор шилжүүлнэ, бүтэлгүйтсэнийг тодорхой хэлнэ', async () => {
      const a = await register();
      const b = await register();
      const c = await register();

      // c-г аль хэдийн илгээчихвэл дахин илгээх боломжгүй болно
      await changeStatus(staff, c.id, { status: PACKAGE_STATUS.IN_TRANSIT });

      const res = await chai
        .request(app)
        .put(`${BASE}/bulk-status`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({
          packageIds: [a.id, b.id, c.id],
          status: PACKAGE_STATUS.IN_TRANSIT,
        });

      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect(res.body.data.succeeded).to.have.lengthOf(2);
      expect(res.body.data.failed).to.have.lengthOf(1);
      expect(String(res.body.data.failed[0].id)).to.equal(String(c.id));
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  describe('§1.6 — Хүчингүй болгох ба устгах (BR-10…BR-12)', () => {
    function cancel(actor, id, payload) {
      return chai
        .request(app)
        .put(`${BASE}/${id}/cancel`)
        .set('Authorization', `Bearer ${actor.token}`)
        .send(payload);
    }

    function remove(actor, id, payload) {
      return chai
        .request(app)
        .delete(`${BASE}/${id}`)
        .set('Authorization', `Bearer ${actor.token}`)
        .send(payload);
    }

    it('BR-11 — Ажилтан хүчингүй болгож ЧАДАХГҮЙ', async () => {
      const pkg = await register();
      const res = await cancel(staff, pkg.id, { reason: 'алдаа' });
      expect(res.status).to.equal(403);
    });

    it('BR-11 — Менежер шалтгаантайгаар хүчингүй болгоно', async () => {
      const pkg = await register();

      const res = await cancel(manager, pkg.id, { reason: 'Харилцагч татгалзсан' });

      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect(res.body.data.status).to.equal(PACKAGE_STATUS.CANCELLED);
      expect(res.body.data.cancelReason).to.equal('Харилцагч татгалзсан');
      expect(res.body.data.cancelledAt).to.exist;
      // Ачаа УСТААГҮЙ
      expect(await Package.findById(pkg.id)).to.exist;
    });

    it('шалтгаангүй хүчингүй болгохгүй', async () => {
      const pkg = await register();
      const res = await cancel(manager, pkg.id, {});
      expect(res.status).to.equal(400);
    });

    it('BR-11 — байршлын ачаалал буурна', async () => {
      const pkg = await register();
      await cancel(manager, pkg.id, { reason: 'алдаатай бүртгэл' });

      expect((await WarehouseLocation.findById(location._id)).currentCount).to.equal(0);
    });

    it('§9.2 — хүчингүй болгосон нь audit-д бичигдэнэ', async () => {
      const pkg = await register();
      await cancel(manager, pkg.id, { reason: 'Буруу дугаар' });

      const log = await AuditLog.findOne({ action: AUDIT_ACTION.PACKAGE_CANCEL });
      expect(log.reason).to.equal('Буруу дугаар');
      expect(log.after).to.equal(PACKAGE_STATUS.CANCELLED);
    });

    it('BR-10 — Админ шинэ, төлбөргүй ачааг бүрмөсөн устгана', async () => {
      const pkg = await register();

      const res = await remove(admin, pkg.id, { reason: 'Хоёр удаа бүртгэсэн' });

      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect(await Package.findById(pkg.id)).to.be.null;
    });

    it('BR-12 — устгасан ч audit-д бүрэн snapshot үлдэнэ', async () => {
      const pkg = await register();
      await remove(admin, pkg.id, { reason: 'Ажилтны алдаа' });

      const log = await AuditLog.findOne({ action: AUDIT_ACTION.PACKAGE_DELETE });
      expect(log).to.exist;
      expect(log.entityLabel).to.equal(pkg.trackingNumber);
      expect(log.before.finalPrice).to.equal(pkg.finalPrice);
      expect(log.before.customerPhone).to.equal(pkg.customerPhone);
      expect(log.reason).to.equal('Ажилтны алдаа');
    });

    it('BR-10 — Менежер устгаж ЧАДАХГҮЙ', async () => {
      const pkg = await register();
      const res = await remove(manager, pkg.id, { reason: 'алдаа' });
      expect(res.status).to.equal(403);
      expect(await Package.findById(pkg.id)).to.exist;
    });

    it('BR-10 — төлбөртэй ачааг устгах оролдлого API түвшинд амжилтгүй', async () => {
      const pkg = await register();
      await Package.collection.updateOne(
        { _id: new Package.base.Types.ObjectId(pkg.id) },
        { $set: { paidAmount: 1000, balance: 500, paymentStatus: PAYMENT_STATUS.PARTIAL } }
      );

      const res = await remove(admin, pkg.id, { reason: 'алдаа' });

      expect(res.status).to.equal(422);
      expect(res.body.code).to.equal(ERROR_CODE.DELETE_NOT_ALLOWED);
      expect(res.body.message).to.include('Хүчингүй');
      expect(await Package.findById(pkg.id)).to.exist;
    });

    it('BR-10 — 24 цаг хэтэрсэн ачааг устгахгүй', async () => {
      const pkg = await register();
      const twoDaysAgo = new Date(Date.now() - 48 * 3_600_000);
      await Package.collection.updateOne(
        { _id: new Package.base.Types.ObjectId(pkg.id) },
        { $set: { createdAt: twoDaysAgo } }
      );

      const res = await remove(admin, pkg.id, { reason: 'хожуу анзаарсан' });

      expect(res.status).to.equal(422);
      expect(res.body.details.windowHours).to.equal(24);
      expect(await Package.findById(pkg.id)).to.exist;
    });

    it('хүчингүй болсон ачааг дахин хүчингүй болгохгүй', async () => {
      const pkg = await register();
      await cancel(manager, pkg.id, { reason: 'нэг' });

      const res = await cancel(manager, pkg.id, { reason: 'хоёр' });
      expect(res.status).to.equal(409);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  describe('§8 — Байршил шилжүүлэх (BR-25)', () => {
    it('хуучин нүд буурч, шинэ нүд нэмэгдэнэ', async () => {
      const target = await createLocation(branch);
      const pkg = await register();

      const res = await chai
        .request(app)
        .put(`${BASE}/${pkg.id}/location`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ locationCode: target.code, reason: 'Тавиур цэвэрлэв' });

      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect(res.body.data.package.locationCode).to.equal(target.code);
      expect((await WarehouseLocation.findById(location._id)).currentCount).to.equal(0);
      expect((await WarehouseLocation.findById(target._id)).currentCount).to.equal(1);
    });

    it('шилжилт audit-д бичигдэнэ', async () => {
      const target = await createLocation(branch);
      const pkg = await register();

      await chai
        .request(app)
        .put(`${BASE}/${pkg.id}/location`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ locationCode: target.code });

      const log = await AuditLog.findOne({ action: AUDIT_ACTION.PACKAGE_LOCATION_MOVE });
      expect(log.before).to.equal(location.code);
      expect(log.after).to.equal(target.code);
    });

    it('ижил байршилд шилжүүлэхийг зөвшөөрөхгүй', async () => {
      const pkg = await register();

      const res = await chai
        .request(app)
        .put(`${BASE}/${pkg.id}/location`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ locationCode: location.code });

      expect(res.status).to.equal(400);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  describe('§9.3 — Хайлт ба жагсаалт', () => {
    function list(actor, query = '') {
      return chai.request(app).get(`${BASE}${query}`).set('Authorization', `Bearer ${actor.token}`);
    }

    it('ачааны дугаараар эхнээс хайна', async () => {
      await register(staff, { trackingNumber: 'SF10001' });
      await register(staff, { trackingNumber: 'YT20002' });

      const res = await list(staff, '?trackingNumber=SF');
      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.lengthOf(1);
      expect(res.body.data[0].trackingNumber).to.equal('SF10001');
    });

    it('BR-26 — утсаар хайхад тухайн харилцагчийн бүх ачаа гарна', async () => {
      await register(staff, { phone: '99112233' });
      await register(staff, { phone: '99112233' });
      await register(staff, { phone: '88445566' });

      const res = await list(staff, '?phone=99112233');
      expect(res.body.data).to.have.lengthOf(2);
    });

    it('төлөвөөр шүүнэ', async () => {
      const a = await register();
      await register();

      await chai
        .request(app)
        .put(`${BASE}/${a.id}/status`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ status: PACKAGE_STATUS.IN_TRANSIT });

      const res = await list(staff, `?status=${PACKAGE_STATUS.IN_TRANSIT}`);
      expect(res.body.data).to.have.lengthOf(1);
    });

    it('байршлын кодоор шүүнэ', async () => {
      await register();
      const res = await list(staff, `?locationCode=${location.code}`);
      expect(res.body.data).to.have.lengthOf(1);
    });

    it('хуудаслалт ажиллана', async () => {
      await register();
      await register();
      await register();

      const res = await list(staff, '?limit=2&page=1');
      expect(res.body.data).to.have.lengthOf(2);
      expect(res.body.pagination.total).to.equal(3);
      expect(res.body.pagination.pages).to.equal(2);
    });

    it('limit-ийн хязгаарыг хэтрүүлэхгүй (1M мөр татах нүх)', async () => {
      const res = await list(staff, '?limit=100000');
      expect(res.status).to.equal(400);
    });

    it('индексгүй талбараар эрэмбэлэхийг зөвшөөрөхгүй', async () => {
      const res = await list(staff, '?sort=note');
      expect(res.status).to.equal(400);
    });

    it('BR-37 — Менежер зөвхөн ӨӨРИЙН салбарын ачааг харна', async () => {
      await register();

      const otherBranch = await createBranch({ code: 'UB' });
      const otherManager = await createUserWithToken({
        role: ROLES.MANAGER,
        branchId: otherBranch._id,
      });

      const res = await list(otherManager);
      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.lengthOf(0);
    });

    it('BR-37 — Менежер frontend-ээс өөр branchId дамжуулж тойрч чадахгүй', async () => {
      await register();

      const otherBranch = await createBranch({ code: 'UB' });
      const otherManager = await createUserWithToken({
        role: ROLES.MANAGER,
        branchId: otherBranch._id,
      });

      const res = await list(otherManager, `?branchId=${branch._id}`);
      expect(res.body.data).to.have.lengthOf(0);
    });

    it('Админ бүх салбарын ачааг харна', async () => {
      await register();
      const res = await list(admin);
      expect(res.body.data).to.have.lengthOf(1);
    });

    it('§1.9 — харилцагчийн бүх ачаа ба нийт дүн', async () => {
      await register(staff, { phone: '99112233', weightKg: 0.4 });
      await register(staff, { phone: '99112233', weightKg: 0.4 });

      const res = await chai
        .request(app)
        .get(`${BASE}/by-phone/99112233`)
        .set('Authorization', `Bearer ${staff.token}`);

      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect(res.body.data.packages).to.have.lengthOf(2);
      expect(res.body.data.totals.finalPrice).to.equal(3000);
      expect(res.body.data.totals.balance).to.equal(3000);
    });

    it('§1.3 — дугаараар шууд хайж оршин буй ачааг олно', async () => {
      await register(staff, { trackingNumber: 'FIND001' });

      const res = await chai
        .request(app)
        .get(`${BASE}/tracking/FIND001`)
        .set('Authorization', `Bearer ${staff.token}`);

      expect(res.status).to.equal(200);
      expect(res.body.data.trackingNumber).to.equal('FIND001');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  describe('GET /:id — дэлгэрэнгүй (§1)', () => {
    it('түүх, audit, зөвшөөрөгдөх шилжилтийг хамт буцаана', async () => {
      const pkg = await register();

      const res = await chai
        .request(app)
        .get(`${BASE}/${pkg.id}`)
        .set('Authorization', `Bearer ${staff.token}`);

      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect(res.body.data.package.trackingNumber).to.equal(pkg.trackingNumber);
      expect(res.body.data.package.customerId.phone).to.equal('99112233');
      expect(res.body.data.package.cargoTypeId.code).to.equal('standard');
      expect(res.body.data.auditLogs).to.be.an('array').with.length.greaterThan(0);
      expect(res.body.data.allowedTransitions).to.include(PACKAGE_STATUS.IN_TRANSIT);
    });

    it('байхгүй ачаанд 404', async () => {
      const res = await chai
        .request(app)
        .get(`${BASE}/64b7f1e2c9d4a51234567890`)
        .set('Authorization', `Bearer ${staff.token}`);
      expect(res.status).to.equal(404);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  describe('PUT /:id — засах', () => {
    it('жин засахад үнэ ДАХИН бодогдоно', async () => {
      const pkg = await register(staff, { weightKg: 0.4 });

      const res = await chai
        .request(app)
        .put(`${BASE}/${pkg.id}`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ weightKg: 0.05 });

      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      // 50гр → 1–100гр шатлал = 800₮
      expect(res.body.data.computedPrice).to.equal(800);
      expect(res.body.data.finalPrice).to.equal(800);
      expect(res.body.data.balance).to.equal(800);
    });

    it('BR-02 — засахад БҮРТГЭХ ҮЕИЙН тариф хэрэглэгдэнэ, өнөөдрийнх биш', async () => {
      const pkg = await register(staff, { weightKg: 0.4 });

      // Тарифыг 10 дахин өсгөнө
      await chai
        .request(app)
        .put(`/api/v1/tariffs/cargo-types/${cargoType._id}/tariff`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          weightBrackets: [
            { maxGrams: 100, price: 8000 },
            { maxGrams: 500, price: 15000 },
          ],
          pricePerKgAbove: 20000,
          pricePerM3: 4000000,
          minimumCharge: 0,
        });

      const res = await chai
        .request(app)
        .put(`${BASE}/${pkg.id}`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ weightKg: 0.05 });

      // Хуучин шатлалын 800₮, шинэ тарифын 8,000₮ БИШ
      expect(res.body.data.computedPrice).to.equal(800);
    });

    it('override хийсэн үнийг систем дарж бичихгүй', async () => {
      const pkg = await register(manager, {
        weightKg: 0.4,
        finalPrice: 9000,
        priceOverrideReason: 'Гэрээт үнэ',
      });

      const res = await chai
        .request(app)
        .put(`${BASE}/${pkg.id}`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ weightKg: 0.05 });

      expect(res.body.data.computedPrice).to.equal(800);
      expect(res.body.data.finalPrice).to.equal(9000);
    });

    it('төлбөр бүртгэгдсэн ачааны жинг засахгүй', async () => {
      const pkg = await register();
      await Package.collection.updateOne(
        { _id: new Package.base.Types.ObjectId(pkg.id) },
        { $set: { paidAmount: 1000 } }
      );

      const res = await chai
        .request(app)
        .put(`${BASE}/${pkg.id}`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ weightKg: 2 });

      expect(res.status).to.equal(422);
    });

    it('хүчингүй ачааг засахгүй', async () => {
      const pkg = await register();
      await chai
        .request(app)
        .put(`${BASE}/${pkg.id}/cancel`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ reason: 'алдаа' });

      const res = await chai
        .request(app)
        .put(`${BASE}/${pkg.id}`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ note: 'нэмэлт' });

      expect(res.status).to.equal(422);
    });

    it('засалт audit-д талбар тус бүрээр бичигдэнэ', async () => {
      const pkg = await register(staff, { quantity: 1 });

      await chai
        .request(app)
        .put(`${BASE}/${pkg.id}`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ quantity: 3, note: 'Хоёр хайрцаг' });

      const logs = await AuditLog.find({ action: AUDIT_ACTION.PACKAGE_UPDATE });
      expect(logs.map(l => l.field).sort()).to.deep.equal(['note', 'quantity']);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  describe('§9.1 — Эрхийн матриц (BR-36)', () => {
    it('audit бичлэг ачаа рүү холбогдсон байна (дэлгэрэнгүй хуудсанд харагдана)', async () => {
      const pkg = await register();
      const logs = await AuditLog.find({
        entity: AUDIT_ENTITY.PACKAGE,
        entityId: pkg.id,
      });
      expect(logs).to.have.length.greaterThan(0);
      expect(String(logs[0].branchId)).to.equal(String(branch._id));
    });

    it('ачаа бүртгэсэн ажилтан тэмдэглэгдэнэ', async () => {
      const pkg = await register();
      expect(String(pkg.registeredBy)).to.equal(String(staff.user._id));
    });
  });
});
