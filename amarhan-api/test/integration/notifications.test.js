'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const { expect } = chai;

const { app } = require('../../src/services/express');
const Notification = require('../../src/models/notification.model');
const customerAuthService = require('../../src/services/customer-auth.service');
const { createUserWithToken } = require('../factories/user.factory');
const { createBranch, createLocation, createCustomer } = require('../factories/domain.factory');
const { ROLES, PACKAGE_STATUS } = require('../../src/config/constants');

chai.use(chaiHttp);

const NOTIFICATIONS = '/api/v1/notifications';
const CUSTOMER = '/api/v1/customer';
const PUBLIC = '/api/v1/public';

function asCustomer(token) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * §7 (Phase 6) — Мэдэгдэл: хувийн (BR-35, автомат) + нийтийн (BR-36, ажилтнаас).
 */
describe('Мэдэгдэл (§7)', () => {
  let branch;
  let location;

  beforeEach(async () => {
    branch = await createBranch({ code: 'UB' });
    location = await createLocation(branch, { capacityCount: 100 });
  });

  /** Ажилтнаар ачаа бүртгэнэ (гараар заасан үнэ, BR-01a). */
  async function registerPackage(staffToken, { phone, status } = {}) {
    const res = await chai
      .request(app)
      .post('/api/v1/packages')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        trackingNumber: `TRK${Math.floor(Math.random() * 1e12)}`,
        ...(status === PACKAGE_STATUS.IN_ERLIAN
          ? { status: PACKAGE_STATUS.IN_ERLIAN }
          : { finalPrice: 30000, locationCode: location.code }),
        ...(phone ? { phone } : {}),
      });
    expect(res.status, JSON.stringify(res.body)).to.equal(201);
    return res.body.data.package;
  }

  describe('BR-36 — нийтийн зарлал илгээх эрх', () => {
    it('Ажилтан (staff) илгээх эрхгүй', async () => {
      const { token } = await createUserWithToken({ role: ROLES.STAFF });
      const res = await chai
        .request(app)
        .post(NOTIFICATIONS)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Тест', body: 'Тест агуулга' });
      expect(res.status).to.equal(403);
    });

    it('Менежер илгээнэ, бүх бүртгэлтэй харилцагчид харагдана', async () => {
      const { token } = await createUserWithToken({ role: ROLES.MANAGER });
      const res = await chai
        .request(app)
        .post(NOTIFICATIONS)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Наадмын амралт', body: '7-р сарын 11-15 амарна' });
      expect(res.status, JSON.stringify(res.body)).to.equal(201);
      expect(res.body.data.audience).to.equal('all');

      // BR-29 — `hasAccount: true` шаардлагатай, эс тэгвээс `jwt-customer`
      // стратеги татгалзана (зөвхөн ачаа бүртгэхэд автоматаар үүссэн, өөрөө
      // бүртгүүлээгүй бичлэгийг зөвшөөрдөггүй).
      const customer = await createCustomer({ hasAccount: true });
      const customerToken = customerAuthService.generateToken(customer);
      const list = await chai
        .request(app)
        .get(`${CUSTOMER}/notifications`)
        .set(asCustomer(customerToken));

      expect(list.status).to.equal(200);
      expect(list.body.data).to.have.lengthOf(1);
      expect(list.body.data[0].title).to.equal('Наадмын амралт');
      expect(list.body.data[0].read).to.equal(false);
    });

    it('Админ жагсаалтыг харна', async () => {
      const { token: managerToken } = await createUserWithToken({ role: ROLES.MANAGER });
      await chai
        .request(app)
        .post(NOTIFICATIONS)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ title: 'Зарлал', body: 'Агуулга' });

      const { token: adminToken } = await createUserWithToken({ role: ROLES.ADMIN });
      const res = await chai
        .request(app)
        .get(NOTIFICATIONS)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.lengthOf(1);
    });
  });

  describe('Roadmap 6.3 — нэвтрээгүй зочны мэдэгдлийн хуудас', () => {
    it('танилтгүйгээр идэвхтэй нийтийн зарлалыг харна, цагаан жагсаалттай', async () => {
      const { token: managerToken } = await createUserWithToken({ role: ROLES.MANAGER });
      await chai
        .request(app)
        .post(NOTIFICATIONS)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ title: 'Зочинд харагдах зарлал', body: 'Агуулга' });

      const res = await chai.request(app).get(`${PUBLIC}/notifications`);

      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect(res.body.data).to.have.lengthOf(1);
      expect(res.body.data[0].title).to.equal('Зочинд харагдах зарлал');
      // §15 — дотоод талбар (createdBy, audience гэх мэт) цагаан жагсаалтад ороогүй тул гарахгүй
      expect(res.body.data[0]).to.not.have.any.keys('createdBy', 'audience', 'expiresAt');
    });

    it('хугацаа дууссан зарлал зочинд харагдахгүй', async () => {
      await Notification.create({
        title: 'Хугацаа дууссан',
        body: 'Агуулга',
        audience: 'all',
        expiresAt: new Date(Date.now() - 1000),
        createdBy: null,
      });

      const res = await chai.request(app).get(`${PUBLIC}/notifications`);
      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.lengthOf(0);
    });

    it('хувийн (customer) мэдэгдэл зочинд ХЭЗЭЭ Ч харагдахгүй', async () => {
      const { token: staffToken } = await createUserWithToken({ role: ROLES.STAFF, branchId: branch._id });
      await registerPackage(staffToken, { phone: '99110005' });

      const res = await chai.request(app).get(`${PUBLIC}/notifications`);
      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.lengthOf(0);
    });
  });

  describe('Дүрэм 14 — харилцагчийн хамрах хүрээ', () => {
    it('өөр харилцагчийн хувийн мэдэгдлийг уншсан гэж тэмдэглэхэд 404', async () => {
      const { token: staffToken } = await createUserWithToken({ role: ROLES.STAFF, branchId: branch._id });
      const pkg = await registerPackage(staffToken, { phone: '99110001' });

      const notification = await Notification.findOne({ entityId: pkg.id ?? pkg._id });
      expect(notification).to.exist;

      const otherCustomer = await createCustomer({ hasAccount: true });
      const otherToken = customerAuthService.generateToken(otherCustomer);

      const res = await chai
        .request(app)
        .put(`${CUSTOMER}/notifications/${notification._id}/read`)
        .set(asCustomer(otherToken));
      expect(res.status).to.equal(404);
    });
  });

  describe('BR-35 — автомат хувийн мэдэгдэл', () => {
    it('ачаа шинээр бүртгэгдэхэд ("created") мэдэгдэл үүснэ', async () => {
      const { token: staffToken } = await createUserWithToken({ role: ROLES.STAFF, branchId: branch._id });
      const pkg = await registerPackage(staffToken, { phone: '99110002' });

      const notifications = await Notification.find({ entityId: pkg.id ?? pkg._id });
      expect(notifications).to.have.lengthOf(1);
      expect(notifications[0].title).to.equal('Ачаа бүртгэгдлээ');
      expect(notifications[0].audience).to.equal('customer');
    });

    it('ачаа "awaiting_payment" болоход мэдэгдэл нэмэгдэнэ', async () => {
      const { token: staffToken } = await createUserWithToken({ role: ROLES.STAFF, branchId: branch._id });
      const pkg = await registerPackage(staffToken, { phone: '99110003' });

      const res = await chai
        .request(app)
        .put(`/api/v1/packages/${pkg.id ?? pkg._id}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: PACKAGE_STATUS.AWAITING_PAYMENT });
      expect(res.status, JSON.stringify(res.body)).to.equal(200);

      const notifications = await Notification.find({ entityId: pkg.id ?? pkg._id }).sort({
        createdAt: 1,
      });
      expect(notifications).to.have.lengthOf(2);
      expect(notifications[1].title).to.equal('Төлбөр төлөх шаардлагатай');
      expect(notifications[1].body).to.include('30,000₮');
    });

    it('утасгүй (харилцагчгүй) ачаанд мэдэгдэл ҮҮСГЭХГҮЙ, алдаа ч гаргахгүй', async () => {
      const { token: staffToken } = await createUserWithToken({ role: ROLES.STAFF, branchId: branch._id });
      const pkg = await registerPackage(staffToken, {});

      const notifications = await Notification.find({ entityId: pkg.id ?? pkg._id });
      expect(notifications).to.have.lengthOf(0);
    });

    it('мэдэгдэл үүсгэхэд алдаа гарсан ч ачааны төлөв шилжилт амжилттай хэвээр байна (BR-35)', async () => {
      const { token: staffToken } = await createUserWithToken({ role: ROLES.STAFF, branchId: branch._id });
      const pkg = await registerPackage(staffToken, { phone: '99110004' });

      // `notifyPackageEvent`-ийн ДОТООД try/catch-ыг ХАМТ шалгахын тулд
      // өөрийг нь БИШ, `notificationRepository.create`-ийг л алдаатай болгоно.
      const notificationRepository = require('../../src/repositories/notification.repository');
      const original = notificationRepository.create;
      notificationRepository.create = async () => {
        throw new Error('санамсаргүй алдаа');
      };

      try {
        const res = await chai
          .request(app)
          .put(`/api/v1/packages/${pkg.id ?? pkg._id}/status`)
          .set('Authorization', `Bearer ${staffToken}`)
          .send({ status: PACKAGE_STATUS.AWAITING_PAYMENT });
        expect(res.status, JSON.stringify(res.body)).to.equal(200);
      } finally {
        notificationRepository.create = original;
      }
    });
  });
});
