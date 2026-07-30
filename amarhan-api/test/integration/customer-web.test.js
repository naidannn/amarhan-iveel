'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const jwt = require('jsonwebtoken');
const { expect } = chai;

const { app } = require('../../src/services/express');
const config = require('../../src/config');
const Customer = require('../../src/models/customer.model');
const AuditLog = require('../../src/models/audit-log.model');
const customerAuthService = require('../../src/services/customer-auth.service');
const { createUserWithToken } = require('../factories/user.factory');
const { createBranch, createCargoTypeWithTariff, createLocation } = require('../factories/domain.factory');
const { ROLES, AUDIT_ACTION, SETTING_KEY } = require('../../src/config/constants');

chai.use(chaiHttp);

const CUSTOMER = '/api/v1/customer';
const PUBLIC = '/api/v1/public';
const PACKAGES = '/api/v1/packages';
const SETTINGS = '/api/v1/settings';

/**
 * Харилцагчийн вэб — introduction.md §3 (Phase 5)
 *
 * Гол эрсдэл нь ФУНКЦ БИШ, ТУСГААРЛАЛТ: харилцагч бусдын өгөгдөл, эсвэл
 * ажилтны endpoint рүү хүрэхгүй байх. Тестийн дийлэнх нь түүнд зориулагдав.
 */
describe('Харилцагчийн вэб (§3)', () => {
  let branch;
  let location;
  let staff;

  beforeEach(async () => {
    branch = await createBranch({ code: 'UB', name: 'Улаанбаатар агуулах' });
    await createCargoTypeWithTariff({ code: 'standard' });
    location = await createLocation(branch, { capacityCount: 100 });
    staff = await createUserWithToken({ role: ROLES.STAFF, branchId: branch._id });
  });

  // ── Хэрэгслүүд ──────────────────────────────────────────────────────────

  /** Ажилтнаар ачаа бүртгэнэ. Үнийг гараар заана (BR-01a) */
  async function registerPackage({ phone = '99112233', price = 30000 } = {}) {
    const res = await chai
      .request(app)
      .post(PACKAGES)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        trackingNumber: `TRK${Math.floor(Math.random() * 1e12)}`,
        phone,
        finalPrice: price,
        locationCode: location.code,
      });
    expect(res.status, JSON.stringify(res.body)).to.equal(201);
    // `create` нь `{ package, warnings }` буцаана (BR-24-ийн багтаамжийн сануулга)
    return res.body.data.package;
  }

  /** Харилцагчийг бүртгүүлж токен авна */
  async function signUp({ phone = '99112233', password = 'customer-pass-1', name } = {}) {
    const res = await chai
      .request(app)
      .post(`${CUSTOMER}/auth/register`)
      .send({ phone, password, ...(name ? { name } : {}) });
    expect(res.status, JSON.stringify(res.body)).to.equal(201);
    return res.body.data;
  }

  function asCustomer(token) {
    return { Authorization: `Bearer ${token}` };
  }

  // ── Бүртгүүлэх / нэвтрэх (5.1) ──────────────────────────────────────────

  describe('Бүртгүүлэх', () => {
    it('утас + нууц үгээр бүртгүүлж токен авна', async () => {
      const { token, customer } = await signUp({ phone: '99112233', name: 'Болд' });

      expect(token).to.be.a('string');
      expect(customer.phone).to.equal('99112233');
      expect(customer.name).to.equal('Болд');
      expect(customer).to.not.have.property('password');
    });

    it('токенд `aud: customer` заагдсан байна', async () => {
      const { token } = await signUp();
      const decoded = jwt.decode(token);

      expect(decoded.aud).to.equal('customer');
      expect(decoded.exp, 'токен хугацаагүй байж болохгүй').to.be.a('number');
    });

    it('BR-29 — өмнө нь ачаагаар үүссэн бичлэг рүү холбогдоно, ШИНЭ бичлэг үүсэхгүй', async () => {
      await registerPackage({ phone: '99112233' });
      expect(await Customer.countDocuments({ phone: '99112233' })).to.equal(1);

      await signUp({ phone: '99112233' });

      expect(await Customer.countDocuments({ phone: '99112233' })).to.equal(1);
      const customer = await Customer.findOne({ phone: '99112233' });
      expect(customer.hasAccount).to.be.true;
    });

    it('§3 — бүртгүүлмэгц ӨМНӨ бүртгэгдсэн бүх ачаа харагдана', async () => {
      await registerPackage({ phone: '99112233' });
      await registerPackage({ phone: '99112233' });
      await registerPackage({ phone: '88001122' }); // өөр хүний ачаа

      const { token } = await signUp({ phone: '99112233' });

      const res = await chai.request(app).get(`${CUSTOMER}/packages`).set(asCustomer(token));

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.lengthOf(2);
      expect(res.body.pagination.total).to.equal(2);
    });

    it('нэг утсаар хоёр дахь удаа бүртгүүлэхгүй', async () => {
      await signUp({ phone: '99112233' });

      const res = await chai
        .request(app)
        .post(`${CUSTOMER}/auth/register`)
        .send({ phone: '99112233', password: 'another-pass-1' });

      expect(res.status).to.equal(409);
      expect(res.body.code).to.equal('PHONE_TAKEN');
    });

    it('нормчлогдоогүй утсаар бүртгүүлэхэд ижил бичлэг рүү очно (BR-27)', async () => {
      await registerPackage({ phone: '99112233' });
      await signUp({ phone: '+976 9911-2233' });

      expect(await Customer.countDocuments({ phone: '99112233' })).to.equal(1);
    });

    it('богино нууц үг хүлээж авахгүй (доод тал нь 8)', async () => {
      const res = await chai
        .request(app)
        .post(`${CUSTOMER}/auth/register`)
        .send({ phone: '99112233', password: 'short' });

      expect(res.status).to.equal(400);
    });

    it('OTP хэрэгжээгүй тул `phoneVerified` ХУДЛАА `true` болохгүй', async () => {
      const { customer } = await signUp();
      expect(customer.phoneVerified, 'баталгаажаагүйг баталгаажсан гэж бичихгүй').to.be.false;
    });

    it('бүртгэл audit-д тэмдэглэгдэнэ', async () => {
      await signUp({ phone: '99112233' });

      const log = await AuditLog.findOne({ action: AUDIT_ACTION.CUSTOMER_REGISTER });
      expect(log).to.exist;
      // §8 — бүтэн утас биш, масклагдсан хэлбэрээр
      expect(log.actorName).to.contain('****');
      expect(log.actorName).to.not.contain('99112233');
    });
  });

  describe('Нэвтрэх', () => {
    it('утсаар нэвтэрнэ', async () => {
      await signUp({ phone: '99112233', password: 'customer-pass-1' });

      const res = await chai
        .request(app)
        .post(`${CUSTOMER}/auth/login`)
        .send({ identifier: '99112233', password: 'customer-pass-1' });

      expect(res.status).to.equal(200);
      expect(res.body.data.token).to.be.a('string');
    });

    it('имэйлээр нэвтэрнэ', async () => {
      await chai
        .request(app)
        .post(`${CUSTOMER}/auth/register`)
        .send({ phone: '99112233', password: 'customer-pass-1', email: 'bold@example.mn' });

      const res = await chai
        .request(app)
        .post(`${CUSTOMER}/auth/login`)
        .send({ identifier: 'bold@example.mn', password: 'customer-pass-1' });

      expect(res.status).to.equal(200);
    });

    it('буруу нууц үгээр нэвтрэхгүй', async () => {
      await signUp({ phone: '99112233', password: 'customer-pass-1' });

      const res = await chai
        .request(app)
        .post(`${CUSTOMER}/auth/login`)
        .send({ identifier: '99112233', password: 'буруу-нууц-үг' });

      expect(res.status).to.equal(401);
    });

    it('BR-29 — ачаагаар автоматаар үүссэн, бүртгэлгүй хүн нэвтрэхгүй', async () => {
      await registerPackage({ phone: '99112233' });

      const res = await chai
        .request(app)
        .post(`${CUSTOMER}/auth/login`)
        .send({ identifier: '99112233', password: 'ямар нэг нууц үг' });

      expect(res.status).to.equal(401);
    });

    it('хаагдсан харилцагч нэвтрэхгүй', async () => {
      await signUp({ phone: '99112233', password: 'customer-pass-1' });
      await Customer.updateOne({ phone: '99112233' }, { status: 'blocked' });

      const res = await chai
        .request(app)
        .post(`${CUSTOMER}/auth/login`)
        .send({ identifier: '99112233', password: 'customer-pass-1' });

      expect(res.status).to.equal(403);
    });

    it('токен үүссэний дараа хаагдсан харилцагч хандахгүй', async () => {
      const { token } = await signUp({ phone: '99112233' });
      await Customer.updateOne({ phone: '99112233' }, { status: 'blocked' });

      const res = await chai.request(app).get(`${CUSTOMER}/auth/me`).set(asCustomer(token));

      expect(res.status).to.equal(401);
    });
  });

  // ── Токены тусгаарлалт (5.3) ────────────────────────────────────────────

  describe('Ажилтан ↔ харилцагчийн тусгаарлалт (§9.1)', () => {
    it('ажилтны токеноор харилцагчийн endpoint рүү орохгүй', async () => {
      const res = await chai
        .request(app)
        .get(`${CUSTOMER}/packages`)
        .set('Authorization', `Bearer ${staff.token}`);

      expect(res.status).to.equal(401);
    });

    it('харилцагчийн токеноор ажилтны endpoint рүү орохгүй', async () => {
      const { token } = await signUp();

      const res = await chai.request(app).get(PACKAGES).set(asCustomer(token));

      expect(res.status).to.equal(401);
    });

    it('харилцагчийн токеноор тохиргоо засахгүй', async () => {
      const { token } = await signUp();

      const res = await chai
        .request(app)
        .put(`${SETTINGS}/${SETTING_KEY.CONTENT_ERENHOT_ADDRESS}`)
        .set(asCustomer(token))
        .send({ value: { receiverName: 'Халдагч' } });

      expect(res.status).to.equal(401);
    });

    it('`aud` солиод гарын үсэг зурсан токен ажиллахгүй', async () => {
      const { customer } = await signUp();
      const forged = jwt.sign({ sub: customer.id }, config.secret, {
        audience: 'staff',
        expiresIn: '1h',
      });

      const res = await chai
        .request(app)
        .get(`${CUSTOMER}/packages`)
        .set('Authorization', `Bearer ${forged}`);

      expect(res.status).to.equal(401);
    });

    it('токенгүй бол 401', async () => {
      const res = await chai.request(app).get(`${CUSTOMER}/packages`);
      expect(res.status).to.equal(401);
    });
  });

  // ── Хамрах хүрээ (5.4) ──────────────────────────────────────────────────

  describe('Өөрийн өгөгдлийн хүрээ', () => {
    it('өөр харилцагчийн ачааны ID мэдсэн ч 404 авна', async () => {
      const foreign = await registerPackage({ phone: '88001122' });
      const { token } = await signUp({ phone: '99112233' });

      const res = await chai
        .request(app)
        .get(`${CUSTOMER}/packages/${foreign.id ?? foreign._id}`)
        .set(asCustomer(token));

      expect(res.status, 'эрхгүйг 403 биш 404-өөр буцаана').to.equal(404);
    });

    it('query-гээр өөр `customerId` дамжуулж хүрээг өргөтгөх боломжгүй', async () => {
      await registerPackage({ phone: '88001122' });
      const other = await Customer.findOne({ phone: '88001122' });
      const { token } = await signUp({ phone: '99112233' });

      const res = await chai
        .request(app)
        .get(`${CUSTOMER}/packages`)
        .query({ customerId: other._id.toString() })
        .set(asCustomer(token));

      // Танигдахгүй параметрийг Joi таслана — чимээгүй үл тоомсорловол
      // хожим repository-д шүүлт нэмэгдэхэд хүрээ нээгдэнэ
      expect(res.status).to.equal(400);
    });

    it('ачааны дэлгэрэнгүйд дотоод мэдээлэл орохгүй', async () => {
      const pkg = await registerPackage({ phone: '99112233' });
      const { token } = await signUp({ phone: '99112233' });

      const res = await chai
        .request(app)
        .get(`${CUSTOMER}/packages/${pkg.id ?? pkg._id}`)
        .set(asCustomer(token));

      expect(res.status).to.equal(200);
      expect(res.body.data).to.not.have.property('note');
      expect(res.body.data).to.not.have.property('locationCode');
      expect(res.body.data).to.not.have.property('registeredBy');
      expect(res.body.data).to.not.have.property('pricingSnapshot');
      expect(res.body.data.trackingNumber).to.equal(pkg.trackingNumber);
    });

    it('нүүр самбарын тоо зөвхөн өөрийн ачааг тооцно', async () => {
      await registerPackage({ phone: '99112233', price: 30000 });
      await registerPackage({ phone: '99112233', price: 20000 });
      await registerPackage({ phone: '88001122', price: 90000 });

      const { token } = await signUp({ phone: '99112233' });

      const res = await chai.request(app).get(`${CUSTOMER}/summary`).set(asCustomer(token));

      expect(res.status).to.equal(200);
      expect(res.body.data.packages.total).to.equal(2);
      expect(res.body.data.balance, 'өөр хүний 90,000₮ орохгүй').to.equal(50000);
    });
  });

  // ── Профайл ─────────────────────────────────────────────────────────────

  describe('Профайл', () => {
    it('нэр, имэйлээ засна', async () => {
      const { token } = await signUp();

      const res = await chai
        .request(app)
        .put(`${CUSTOMER}/me`)
        .set(asCustomer(token))
        .send({ name: 'Шинэ нэр', email: 'new@example.mn' });

      expect(res.status).to.equal(200);
      expect(res.body.data.customer.name).to.equal('Шинэ нэр');
      expect(res.body.data.customer.email).to.equal('new@example.mn');
    });

    it('УТСАА ӨӨРӨӨ СОЛИХ БОЛОМЖГҮЙ — бусдын ачааг харах зам хаагдсан', async () => {
      const { token } = await signUp({ phone: '99112233' });

      const res = await chai
        .request(app)
        .put(`${CUSTOMER}/me`)
        .set(asCustomer(token))
        .send({ phone: '88001122' });

      expect(res.status).to.equal(400);
      const customer = await Customer.findOne({ phone: '99112233' });
      expect(customer, 'утас өөрчлөгдөөгүй байх ёстой').to.exist;
    });

    it('урамшууллын оноог өөрөө өсгөх боломжгүй', async () => {
      const { token } = await signUp();

      const res = await chai
        .request(app)
        .put(`${CUSTOMER}/me`)
        .set(asCustomer(token))
        .send({ loyaltyPoints: 999999 });

      expect(res.status).to.equal(400);
    });

    it('хүргэлтийн хаягаа хадгална', async () => {
      const { token } = await signUp();

      const res = await chai
        .request(app)
        .put(`${CUSTOMER}/me/addresses`)
        .set(asCustomer(token))
        .send({ addresses: [{ label: 'Гэр', address: 'СБД, 1-р хороо' }] });

      expect(res.status).to.equal(200);
      expect(res.body.data.customer.addresses).to.have.lengthOf(1);
    });

    it('нууц үгээ солино', async () => {
      const { token } = await signUp({ phone: '99112233', password: 'customer-pass-1' });

      const changed = await chai
        .request(app)
        .post(`${CUSTOMER}/auth/change-password`)
        .set(asCustomer(token))
        .send({ currentPassword: 'customer-pass-1', newPassword: 'customer-pass-2' });

      expect(changed.status).to.equal(200);

      const login = await chai
        .request(app)
        .post(`${CUSTOMER}/auth/login`)
        .send({ identifier: '99112233', password: 'customer-pass-2' });

      expect(login.status).to.equal(200);
    });
  });

  // ── Google (5.1) ────────────────────────────────────────────────────────

  describe('Google-ээр бүртгүүлэх', () => {
    it('утас өгөх хүртэл харилцагчийн бичлэг ҮҮСЭХГҮЙ (BR-26)', async () => {
      const customer = await customerAuthService.findOrCreateByGoogle({
        googleId: 'google-123',
        email: 'bold@gmail.com',
        name: 'Болд',
      });

      expect(customer, 'утасгүй бол бүртгэл үүсгэхгүй').to.be.null;
      expect(await Customer.countDocuments({})).to.equal(0);
    });

    it('утсаа өгмөгц бүртгэл дуусаж, өмнөх ачаа нь харагдана', async () => {
      await registerPackage({ phone: '99112233' });

      const pending = customerAuthService.generatePendingToken({
        googleId: 'google-123',
        email: 'bold@gmail.com',
        name: 'Болд',
      });

      const res = await chai
        .request(app)
        .post(`${CUSTOMER}/auth/google/complete`)
        .send({ pendingToken: pending, phone: '99112233' });

      expect(res.status, JSON.stringify(res.body)).to.equal(201);
      expect(res.body.data.customer.hasGoogle).to.be.true;

      const list = await chai
        .request(app)
        .get(`${CUSTOMER}/packages`)
        .set(asCustomer(res.body.data.token));

      expect(list.body.data).to.have.lengthOf(1);
    });

    it('түр токен нь ХАРИЛЦАГЧИЙН токен болж ажиллахгүй', async () => {
      const pending = customerAuthService.generatePendingToken({
        googleId: 'google-123',
        email: null,
        name: null,
      });

      const res = await chai.request(app).get(`${CUSTOMER}/packages`).set(asCustomer(pending));

      expect(res.status).to.equal(401);
    });

    it('хуурамч түр токеноор бүртгэл дуусахгүй', async () => {
      const forged = jwt.sign({ googleId: 'attacker' }, 'өөр-нууц-түлхүүр', {
        audience: 'customer_pending',
        expiresIn: '15m',
      });

      const res = await chai
        .request(app)
        .post(`${CUSTOMER}/auth/google/complete`)
        .send({ pendingToken: forged, phone: '99112233' });

      expect(res.status).to.equal(401);
    });
  });

  // ── Нээлттэй ачаа хайх (5.5) ────────────────────────────────────────────

  describe('Ачаа хайх — нэвтрэхгүйгээр (§3)', () => {
    it('дугаараар хайхад төлөв харагдана', async () => {
      const pkg = await registerPackage({ phone: '99112233' });

      const res = await chai.request(app).get(`${PUBLIC}/track/${pkg.trackingNumber}`);

      expect(res.status).to.equal(200);
      expect(res.body.data.trackingNumber).to.equal(pkg.trackingNumber);
      expect(res.body.data.status).to.equal('registered');
    });

    it('ҮНЭ, ҮЛДЭГДЭЛ, ДОТООД мэдээлэл ХАРАГДАХГҮЙ', async () => {
      const pkg = await registerPackage({ phone: '99112233', price: 45000 });

      const res = await chai.request(app).get(`${PUBLIC}/track/${pkg.trackingNumber}`);

      const body = res.body.data;
      expect(body).to.not.have.property('finalPrice');
      expect(body).to.not.have.property('balance');
      expect(body).to.not.have.property('paidAmount');
      expect(body).to.not.have.property('locationCode');
      expect(body).to.not.have.property('customerId');
      expect(JSON.stringify(body)).to.not.contain('45000');
    });

    it('утас МАСКЛАГДАНА (§8)', async () => {
      const pkg = await registerPackage({ phone: '99112233' });

      const res = await chai.request(app).get(`${PUBLIC}/track/${pkg.trackingNumber}`);

      expect(res.body.data.phoneHint).to.equal('9911****');
      expect(JSON.stringify(res.body)).to.not.contain('99112233');
    });

    it('нормчлогдоогүй дугаараар ч олдоно (§1.3)', async () => {
      const pkg = await registerPackage({ phone: '99112233' });

      const res = await chai
        .request(app)
        .get(`${PUBLIC}/track/${encodeURIComponent(pkg.trackingNumber.toLowerCase())}`);

      expect(res.status).to.equal(200);
    });

    it('байхгүй дугаарт 404', async () => {
      const res = await chai.request(app).get(`${PUBLIC}/track/BAIHGUI123`);
      expect(res.status).to.equal(404);
    });
  });

  // ── Статик агуулга (5.9, 5.10) ──────────────────────────────────────────

  describe('Статик агуулга (§3)', () => {
    it('нэвтрэхгүйгээр Эрээний хаяг уншигдана', async () => {
      const res = await chai.request(app).get(`${PUBLIC}/content`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.property('erenhot_address');
      expect(res.body.data).to.have.property('contact');
      expect(res.body.data).to.have.property('faq');
    });

    it('Админ хаягийг засварлахад нээлттэй хуудсанд шууд тусна', async () => {
      const admin = await createUserWithToken({ role: ROLES.ADMIN, branchId: branch._id });

      const update = await chai
        .request(app)
        .put(`${SETTINGS}/${SETTING_KEY.CONTENT_ERENHOT_ADDRESS}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          value: {
            receiverName: 'Ивээл карго / 001',
            phone: '+86 111 2222',
            addressCn: '内蒙古二连浩特市',
            addressMn: 'Эрээн хот',
            note: '',
          },
        });

      expect(update.status, JSON.stringify(update.body)).to.equal(200);

      const res = await chai.request(app).get(`${PUBLIC}/content`);
      expect(res.body.data.erenhot_address.receiverName).to.equal('Ивээл карго / 001');
    });

    it('Ажилтан агуулга засахгүй (§9.1)', async () => {
      const res = await chai
        .request(app)
        .put(`${SETTINGS}/${SETTING_KEY.CONTENT_ERENHOT_ADDRESS}`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ value: { receiverName: 'Ажилтан' } });

      expect(res.status).to.equal(403);
    });

    it('буруу хэлбэртэй утга хадгалагдахгүй', async () => {
      const admin = await createUserWithToken({ role: ROLES.ADMIN, branchId: branch._id });

      const res = await chai
        .request(app)
        .put(`${SETTINGS}/${SETTING_KEY.CONTENT_FAQ}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ value: 'массив байх ёстой' });

      expect(res.status).to.equal(400);
    });

    it('танигдахгүй түлхүүр үүсгэхгүй', async () => {
      const admin = await createUserWithToken({ role: ROLES.ADMIN, branchId: branch._id });

      const res = await chai
        .request(app)
        .put(`${SETTINGS}/content.hakerskiy`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ value: 'ямар нэг зүйл' });

      expect(res.status).to.equal(400);
    });

    it('дотоод тохиргоо нээлттэй хуудсанд ГАРАХГҮЙ', async () => {
      const res = await chai.request(app).get(`${PUBLIC}/content`);

      expect(res.body.data).to.not.have.property('pricing.override_limit_percent');
      expect(JSON.stringify(res.body)).to.not.contain('override_limit_percent');
    });
  });
});
