'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const jwt = require('jsonwebtoken');
const sinon = require('sinon');
const { expect } = chai;

const { app } = require('../../src/services/express');
const config = require('../../src/config');
const Customer = require('../../src/models/customer.model');
const PhoneVerification = require('../../src/models/phone-verification.model');
const AuditLog = require('../../src/models/audit-log.model');
const verifyService = require('../../src/services/verify.service');
const { createUserWithToken } = require('../factories/user.factory');
const { ROLES, AUDIT_ACTION, ERROR_CODE } = require('../../src/config/constants');

chai.use(chaiHttp);

const CUSTOMER = '/api/v1/customer';
const PHONE = '99112233';
const PASSWORD = 'customer-pass-1';

/**
 * Утас баталгаажуулалт — roadmap 5.2 (Verify.MN, MO загвар).
 *
 * Verify.MN-ийг stub хийнэ: `createSession` санамсаргүй sessionId буцааж,
 * `getSession` нь `providerStatus`-ыг (тест бүр өөрчилнө) буцаана. Гол
 * эрсдэл нь ТУСГААРЛАЛТ — нэг утсаар/зорилгоор баталгаажуулсан сессийг
 * өөр утас, өөр зорилго, өөр харилцагчид ашиглах боломжгүй байх.
 */
describe('Утас баталгаажуулалт (roadmap 5.2)', () => {
  let providerStatus;
  let sessionCounter;

  beforeEach(() => {
    providerStatus = 'PENDING';
    sessionCounter = 0;
    config.verify.apiKey = 'vrf_test';

    sinon.stub(verifyService, 'createSession').callsFake(async ({ phone, text }) => {
      sessionCounter += 1;
      return {
        sessionId: `sess-${sessionCounter}`,
        shortcode: '144773',
        text,
        smsUri: `sms:144773?body=${text}`,
        displayInstruction: `${phone} дугаараасаа 144773 руу ${text} илгээнэ үү`,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      };
    });
    sinon.stub(verifyService, 'getSession').callsFake(async () => ({
      status: providerStatus,
      verifiedAt: providerStatus === 'VERIFIED' ? new Date() : null,
    }));
  });

  afterEach(() => {
    sinon.restore();
    config.verify.apiKey = '';
  });

  // ── Хэрэгслүүд ──────────────────────────────────────────────────────────

  async function start(phone = PHONE, purpose = 'register') {
    return chai.request(app).post(`${CUSTOMER}/auth/phone-verifications`).send({ phone, purpose });
  }

  /** Сесс эхлүүлж, Verify.MN баталгаажуулсан мэт болгон токен буцаана */
  async function verifiedToken(phone = PHONE, purpose = 'register') {
    const res = await start(phone, purpose);
    expect(res.status, JSON.stringify(res.body)).to.equal(201);
    providerStatus = 'VERIFIED';
    return res.body.data.verification.token;
  }

  /** Баталгаажуулалт асаахаас ӨМНӨ үүссэн (хуучин) бүртгэл */
  async function legacyAccount({ phone = PHONE, email } = {}) {
    config.verify.apiKey = '';
    const res = await chai
      .request(app)
      .post(`${CUSTOMER}/auth/register`)
      .send({ phone, password: PASSWORD, ...(email ? { email } : {}) });
    config.verify.apiKey = 'vrf_test';
    expect(res.status, JSON.stringify(res.body)).to.equal(201);
    expect(res.body.data.customer.phoneVerified).to.equal(false);
    return res.body.data;
  }

  // ── Бүртгэл ─────────────────────────────────────────────────────────────

  it('Verify.MN тохируулсан үед баталгаажуулалтгүй бүртгэл хориотой', async () => {
    const res = await chai
      .request(app)
      .post(`${CUSTOMER}/auth/register`)
      .send({ phone: PHONE, password: PASSWORD });

    expect(res.status).to.equal(400);
    expect(res.body.code).to.equal(ERROR_CODE.PHONE_VERIFICATION_REQUIRED);
    expect(await Customer.countDocuments({ hasAccount: true })).to.equal(0);
  });

  it('pending → verified → бүртгэл: phoneVerified true, сесс зарцуулагдана', async () => {
    const started = await start();
    expect(started.status).to.equal(201);
    const { verification } = started.body.data;
    expect(verification.token).to.be.a('string');
    expect(verification.text).to.match(/^\d{6}$/);
    expect(verification.shortcode).to.equal('144773');
    // Сессийн `_id` ил гарахгүй
    expect(verification).to.not.have.property('id');
    expect(verification).to.not.have.property('_id');

    const pending = await chai
      .request(app)
      .post(`${CUSTOMER}/auth/phone-verifications/check`)
      .send({ token: verification.token });
    expect(pending.body.data.verification.status).to.equal('pending');

    providerStatus = 'VERIFIED';
    const verified = await chai
      .request(app)
      .post(`${CUSTOMER}/auth/phone-verifications/check`)
      .send({ token: verification.token });
    expect(verified.body.data.verification.status).to.equal('verified');

    const res = await chai
      .request(app)
      .post(`${CUSTOMER}/auth/register`)
      .send({ phone: PHONE, password: PASSWORD, verificationToken: verification.token });
    expect(res.status, JSON.stringify(res.body)).to.equal(201);
    expect(res.body.data.customer.phoneVerified).to.equal(true);
    expect(res.body.data.customer.phoneVerificationRequired).to.equal(false);

    const record = await PhoneVerification.findOne({ phone: PHONE });
    expect(record.status).to.equal('consumed');

    const customer = await Customer.findOne({ phone: PHONE });
    expect(customer.phoneVerifiedAt).to.be.instanceOf(Date);
  });

  it('Verify.MN баталгаажуулаагүй (pending) бол бүртгэл хориотой', async () => {
    const res0 = await start();
    const res = await chai.request(app).post(`${CUSTOMER}/auth/register`).send({
      phone: PHONE,
      password: PASSWORD,
      verificationToken: res0.body.data.verification.token,
    });
    expect(res.status).to.equal(400);
    expect(res.body.code).to.equal(ERROR_CODE.PHONE_VERIFICATION_REQUIRED);
  });

  it('нэг утсаар баталгаажуулсан сессийг ӨӨР дугаараар бүртгүүлэхэд ашиглах боломжгүй', async () => {
    const token = await verifiedToken('88112233');

    const res = await chai
      .request(app)
      .post(`${CUSTOMER}/auth/register`)
      .send({ phone: PHONE, password: PASSWORD, verificationToken: token });
    expect(res.status).to.equal(400);
    expect(await Customer.countDocuments({ hasAccount: true })).to.equal(0);
  });

  it('бүртгэлийн сессийг нууц үг сэргээхэд ашиглах боломжгүй (зорилгод уягдсан)', async () => {
    await legacyAccount();
    // Бүртгэлтэй дугаарт `register` эхлүүлэх боломжгүй тул сессийг шууд үүсгэнэ
    const record = await PhoneVerification.create({
      phone: PHONE,
      purpose: 'register',
      tokenHash: require('../../src/utils/reset-token').hash('register-token'),
      providerSessionId: 'sess-x',
      text: '123456',
      status: 'verified',
      verifiedAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
    });
    expect(record).to.exist;

    const res = await chai.request(app).post(`${CUSTOMER}/auth/reset-password/phone`).send({
      phone: PHONE,
      verificationToken: 'register-token',
      newPassword: 'brand-new-pass',
    });
    expect(res.status).to.equal(400);
    expect(res.body.code).to.equal(ERROR_CODE.PHONE_VERIFICATION_REQUIRED);
  });

  it('бүртгэлтэй дугаарт бүртгэлийн баталгаажуулалт эхлэхгүй (SMS дэмий төлөгдөхгүй)', async () => {
    await legacyAccount();
    const res = await start(PHONE, 'register');
    expect(res.status).to.equal(409);
    expect(res.body.code).to.equal(ERROR_CODE.PHONE_TAKEN);
    expect(verifyService.createSession.called).to.equal(false);
  });

  // ── Давтамж ─────────────────────────────────────────────────────────────

  it('идэвхтэй сессийг дахин ашиглана, токен нь шинэчлэгдэнэ', async () => {
    const first = await start();
    const second = await start();

    expect(second.status).to.equal(201);
    expect(verifyService.createSession.calledOnce).to.equal(true);
    expect(second.body.data.verification.text).to.equal(first.body.data.verification.text);

    // Хуучин токен хүчингүй
    const old = await chai
      .request(app)
      .post(`${CUSTOMER}/auth/phone-verifications/check`)
      .send({ token: first.body.data.verification.token });
    expect(old.status).to.equal(404);
  });

  it('хугацаа дууссан сессийн дараа 1 минутын дотор шинэ сесс эхлэхгүй', async () => {
    const first = await start();
    providerStatus = 'EXPIRED';
    await chai
      .request(app)
      .post(`${CUSTOMER}/auth/phone-verifications/check`)
      .send({ token: first.body.data.verification.token });

    const res = await start();
    expect(res.status).to.equal(429);
    expect(res.body.code).to.equal(ERROR_CODE.PHONE_VERIFICATION_LIMIT);
  });

  it('тохируулаагүй орчинд эхлүүлэхэд 503', async () => {
    config.verify.apiKey = '';
    const res = await start();
    expect(res.status).to.equal(503);
    expect(res.body.code).to.equal(ERROR_CODE.PHONE_VERIFICATION_DISABLED);
  });

  // ── Хуучин бүртгэл: НЭГ УДАА баталгаажуулах (BR-28) ─────────────────────

  it('баталгаажаагүй бүртгэл порталын өгөгдөл рүү хандахгүй, профайл нээлттэй', async () => {
    const { token } = await legacyAccount();

    const me = await chai
      .request(app)
      .get(`${CUSTOMER}/auth/me`)
      .set('Authorization', `Bearer ${token}`);
    expect(me.status).to.equal(200);
    expect(me.body.data.customer.phoneVerificationRequired).to.equal(true);

    const packages = await chai
      .request(app)
      .get(`${CUSTOMER}/packages`)
      .set('Authorization', `Bearer ${token}`);
    expect(packages.status).to.equal(403);
    expect(packages.body.code).to.equal(ERROR_CODE.PHONE_NOT_VERIFIED);
  });

  it('нэвтэрсэн харилцагч нэг удаа баталгаажуулмагц портал нээгдэнэ', async () => {
    const { token } = await legacyAccount();
    const auth = { Authorization: `Bearer ${token}` };

    const started = await chai.request(app).post(`${CUSTOMER}/me/phone-verification`).set(auth);
    expect(started.status, JSON.stringify(started.body)).to.equal(201);
    // Утас токены харилцагчийнх
    expect(verifyService.createSession.firstCall.args[0].phone).to.equal(PHONE);

    const vToken = started.body.data.verification.token;
    const pending = await chai
      .request(app)
      .post(`${CUSTOMER}/me/phone-verification/check`)
      .set(auth)
      .send({ token: vToken });
    expect(pending.body.data.customer.phoneVerified).to.equal(false);

    providerStatus = 'VERIFIED';
    const done = await chai
      .request(app)
      .post(`${CUSTOMER}/me/phone-verification/check`)
      .set(auth)
      .send({ token: vToken });
    expect(done.status).to.equal(200);
    expect(done.body.data.customer.phoneVerified).to.equal(true);

    const packages = await chai.request(app).get(`${CUSTOMER}/packages`).set(auth);
    expect(packages.status).to.equal(200);

    const audit = await AuditLog.findOne({ action: AUDIT_ACTION.CUSTOMER_PHONE_VERIFY });
    expect(audit).to.exist;

    // Дахин баталгаажуулах шаардлагагүй
    const again = await chai.request(app).post(`${CUSTOMER}/me/phone-verification`).set(auth);
    expect(again.status).to.equal(409);
  });

  it('өөр харилцагчийн баталгаажуулалтын токеноор шалгах боломжгүй (404)', async () => {
    const a = await legacyAccount({ phone: PHONE });
    const b = await legacyAccount({ phone: '88112233' });

    const started = await chai
      .request(app)
      .post(`${CUSTOMER}/me/phone-verification`)
      .set('Authorization', `Bearer ${a.token}`);
    providerStatus = 'VERIFIED';

    const res = await chai
      .request(app)
      .post(`${CUSTOMER}/me/phone-verification/check`)
      .set('Authorization', `Bearer ${b.token}`)
      .send({ token: started.body.data.verification.token });
    expect(res.status).to.equal(404);
    expect((await Customer.findOne({ phone: '88112233' })).phoneVerified).to.equal(false);

    // Нэвтрээгүй polling-оор ч хүрэхгүй
    const anon = await chai
      .request(app)
      .post(`${CUSTOMER}/auth/phone-verifications/check`)
      .send({ token: started.body.data.verification.token });
    expect(anon.status).to.equal(404);
  });

  // ── Нууц үг мартсан — утсаар ────────────────────────────────────────────

  it('бүртгэлгүй дугаарт нууц үг сэргээх баталгаажуулалт эхлэхгүй', async () => {
    const res = await start(PHONE, 'reset_password');
    expect(res.status).to.equal(404);
    expect(res.body.code).to.equal(ERROR_CODE.ACCOUNT_NOT_FOUND);
    expect(verifyService.createSession.called).to.equal(false);
  });

  it('утсаар нууц үг сэргээнэ: шинэ нууц үг, баталгаажсан, хуучин токен хүчингүй', async () => {
    const legacy = await legacyAccount({ email: 'other@person.mn' });
    const oldToken = jwt.sign(
      { sub: legacy.customer.id, iat: Math.floor(Date.now() / 1000) - 10 },
      config.secret,
      { audience: config.jwt.customerAudience, expiresIn: '1h' }
    );

    const vToken = await verifiedToken(PHONE, 'reset_password');
    const res = await chai.request(app).post(`${CUSTOMER}/auth/reset-password/phone`).send({
      phone: PHONE,
      verificationToken: vToken,
      newPassword: 'brand-new-pass',
    });
    expect(res.status, JSON.stringify(res.body)).to.equal(200);
    expect(res.body.data.token).to.be.a('string');
    expect(res.body.data.customer.phoneVerified).to.equal(true);
    // Утас эзэмшлийг нотлоогүй хүний имэйл салгагдана
    expect(res.body.data.customer.email).to.equal(null);

    const login = await chai
      .request(app)
      .post(`${CUSTOMER}/auth/login`)
      .send({ identifier: PHONE, password: 'brand-new-pass' });
    expect(login.status).to.equal(200);

    const stale = await chai
      .request(app)
      .get(`${CUSTOMER}/auth/me`)
      .set('Authorization', `Bearer ${oldToken}`);
    expect(stale.status).to.equal(401);

    const fresh = await chai
      .request(app)
      .get(`${CUSTOMER}/auth/me`)
      .set('Authorization', `Bearer ${res.body.data.token}`);
    expect(fresh.status).to.equal(200);

    // Нэг баталгаажуулалтаар хоёр дахь удаа солих боломжгүй
    const replay = await chai.request(app).post(`${CUSTOMER}/auth/reset-password/phone`).send({
      phone: PHONE,
      verificationToken: vToken,
      newPassword: 'another-pass-1',
    });
    expect(replay.status).to.equal(400);
  });

  // ── Ажилтан утас солих ──────────────────────────────────────────────────

  it('ажилтан утсыг сольбол баталгаажуулалт буцна', async () => {
    const vToken = await verifiedToken();
    await chai
      .request(app)
      .post(`${CUSTOMER}/auth/register`)
      .send({ phone: PHONE, password: PASSWORD, verificationToken: vToken });
    const customer = await Customer.findOne({ phone: PHONE });
    expect(customer.phoneVerified).to.equal(true);

    const staff = await createUserWithToken({ role: ROLES.ADMIN });
    const res = await chai
      .request(app)
      .put(`/api/v1/customers/${customer._id}`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ phone: '88112233' });
    expect(res.status, JSON.stringify(res.body)).to.equal(200);

    const updated = await Customer.findById(customer._id);
    expect(updated.phone).to.equal('88112233');
    expect(updated.phoneVerified).to.equal(false);
  });
});
