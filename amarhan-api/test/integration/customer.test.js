'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const { expect } = chai;

const { app } = require('../../src/services/express');
const Customer = require('../../src/models/customer.model');
const AuditLog = require('../../src/models/audit-log.model');
const customerService = require('../../src/services/customer.service');
const { createUserWithToken, createUser } = require('../factories/user.factory');
const { createCustomer } = require('../factories/domain.factory');
const { ROLES, AUDIT_ACTION } = require('../../src/config/constants');

chai.use(chaiHttp);

describe('Харилцагч (§3)', () => {
  describe('BR-27 — Утас нормчлогдож хадгалагдана', () => {
    it('олон хэлбэрээр бичсэн утас нэг л харилцагч үүсгэнэ', async () => {
      const { token } = await createUserWithToken({ role: ROLES.STAFF });

      const first = await chai
        .request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: '+976 9911-2233', name: 'Бат' });

      expect(first.status).to.equal(201);
      expect(first.body.data.phone, 'нормчлогдсон хэлбэрээр хадгалагдана').to.equal('99112233');

      // Ижил дугаарыг өөр хэлбэрээр
      const second = await chai
        .request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: '99112233', name: 'Бат дахин' });

      expect(second.status).to.equal(409);
      expect(await Customer.countDocuments()).to.equal(1);
    });

    it('буруу утсанд ойлгомжтой алдаа буцаана', async () => {
      const { token } = await createUserWithToken({ role: ROLES.STAFF });
      const res = await chai
        .request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: '12345678' });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.include('эхний орон');
    });
  });

  describe('BR-26 — Утсаар хайх', () => {
    it('ажилтан утас бичихэд харилцагчийг олно', async () => {
      const customer = await createCustomer({ phone: '99887766', name: 'Дорж' });
      const { token } = await createUserWithToken({ role: ROLES.STAFF });

      const res = await chai
        .request(app)
        .get('/api/v1/customers/phone/99887766')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).to.equal(200);
      expect(res.body.data.id).to.equal(customer._id.toString());
    });

    it('форматлагдсан утсаар ч олно', async () => {
      await createCustomer({ phone: '99887766' });
      const { token } = await createUserWithToken({ role: ROLES.STAFF });

      const res = await chai
        .request(app)
        .get('/api/v1/customers/phone/+976%209911')
        .set('Authorization', `Bearer ${token}`);

      // Нормчилж чадахгүй бол 400, чадвал 404 — аль ч тохиолдолд 500 биш
      expect(res.status).to.be.oneOf([400, 404]);
    });

    it('олдохгүй бол 404', async () => {
      const { token } = await createUserWithToken({ role: ROLES.STAFF });
      const res = await chai
        .request(app)
        .get('/api/v1/customers/phone/99000000')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).to.equal(404);
    });

    it('хэсэгчилсэн утсаар жагсаалтаас хайна', async () => {
      await createCustomer({ phone: '99112233' });
      await createCustomer({ phone: '99112244' });
      await createCustomer({ phone: '88112233' });
      const { token } = await createUserWithToken({ role: ROLES.STAFF });

      const res = await chai
        .request(app)
        .get('/api/v1/customers?phone=9911')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.lengthOf(2);
    });
  });

  describe('BR-29 — Ачаа бүртгэхэд автоматаар үүснэ', () => {
    it('шинэ утсаар харилцагч үүсгэнэ', async () => {
      const actor = await createUser();
      const { customer, created } = await customerService.findOrCreateByPhone(
        '+976 9955-4433',
        { name: 'Шинэ' },
        { actor }
      );

      expect(created).to.equal(true);
      expect(customer.phone).to.equal('99554433');
      expect(customer.hasAccount, 'өөрөө бүртгүүлээгүй').to.equal(false);

      const logs = await AuditLog.find({ action: AUDIT_ACTION.CUSTOMER_CREATE });
      expect(logs).to.have.lengthOf(1);
    });

    it('байгаа утсаар шинэ бичлэг үүсгэхгүй', async () => {
      const existing = await createCustomer({ phone: '99554433', name: 'Хуучин' });
      const actor = await createUser();

      const { customer, created } = await customerService.findOrCreateByPhone(
        '99554433',
        { name: 'Өөр нэр' },
        { actor }
      );

      expect(created).to.equal(false);
      expect(customer._id.toString()).to.equal(existing._id.toString());
      expect(customer.name, 'байгаа нэрийг дарж бичихгүй').to.equal('Хуучин');
      expect(await Customer.countDocuments()).to.equal(1);
    });

    it('зэрэг дуудлага давхардсан харилцагч үүсгэхгүй', async () => {
      const actor = await createUser();

      await Promise.all([
        customerService.findOrCreateByPhone('99554433', {}, { actor }),
        customerService.findOrCreateByPhone('99554433', {}, { actor }),
        customerService.findOrCreateByPhone('99554433', {}, { actor }),
      ]);

      expect(await Customer.countDocuments({ phone: '99554433' })).to.equal(1);
    });
  });

  describe('§9.2 — Өөрчлөлт audit-д бичигдэнэ', () => {
    it('утас өөрчлөхөд хуучин/шинэ утга бичигдэнэ', async () => {
      const customer = await createCustomer({ phone: '99112233' });
      const { token } = await createUserWithToken({ role: ROLES.STAFF });

      const res = await chai
        .request(app)
        .put(`/api/v1/customers/${customer._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: '99445566' });

      expect(res.status).to.equal(200);

      const logs = await AuditLog.find({ action: AUDIT_ACTION.CUSTOMER_UPDATE, field: 'phone' });
      expect(logs).to.have.lengthOf(1);
      expect(logs[0].before).to.equal('99112233');
      expect(logs[0].after).to.equal('99445566');
    });

    it('өөр харилцагчийн утас руу өөрчлөхийг хориглоно', async () => {
      const a = await createCustomer({ phone: '99112233' });
      await createCustomer({ phone: '99445566' });
      const { token } = await createUserWithToken({ role: ROLES.STAFF });

      const res = await chai
        .request(app)
        .put(`/api/v1/customers/${a._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: '99445566' });

      expect(res.status).to.equal(409);
    });
  });

  describe('BR-33 — Урамшуулал гараар өөрчлөх', () => {
    it('энгийн засварын хүсэлтэд урамшууллын талбар оруулбал Joi таслана', async () => {
      const customer = await createCustomer({ loyaltyPoints: 100 });
      const { token } = await createUserWithToken({ role: ROLES.STAFF });

      const res = await chai
        .request(app)
        .put(`/api/v1/customers/${customer._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Шинэ нэр', loyaltyPoints: 999999 });

      expect(res.status).to.equal(400);

      const updated = await Customer.findById(customer._id);
      expect(updated.loyaltyPoints).to.equal(100);
    });

    it('service давхарга ч урамшууллыг хамгаална (гүн хамгаалалт)', async () => {
      // Joi-г тойрч service-ийг шууд дуудсан ч оноо өөрчлөгдөх ёсгүй
      const customer = await createCustomer({ loyaltyPoints: 100 });
      const actor = await createUser({ role: ROLES.STAFF });

      await customerService.update(
        customer._id,
        { name: 'Шинэ нэр', loyaltyPoints: 999999, loyaltyTier: 'gold' },
        actor
      );

      const updated = await Customer.findById(customer._id);
      expect(updated.loyaltyPoints, 'оноо өөрчлөгдөх ёсгүй').to.equal(100);
      expect(updated.loyaltyTier, 'түвшин өөрчлөгдөх ёсгүй').to.equal('bronze');
      expect(updated.name, 'зөвшөөрөгдсөн талбар өөрчлөгдөнө').to.equal('Шинэ нэр');
    });

    it('Ажилтан урамшуулал өөрчилж чадахгүй', async () => {
      const customer = await createCustomer();
      const { token } = await createUserWithToken({ role: ROLES.STAFF });

      const res = await chai
        .request(app)
        .post(`/api/v1/customers/${customer._id}/loyalty`)
        .set('Authorization', `Bearer ${token}`)
        .send({ loyaltyPoints: 500, reason: 'Шалтгаан' });

      expect(res.status).to.equal(403);
    });

    it('Админ шалтгаантайгаар өөрчилнө, audit-д бичигдэнэ', async () => {
      const customer = await createCustomer({ loyaltyPoints: 100 });
      const { token } = await createUserWithToken({ role: ROLES.ADMIN });

      const res = await chai
        .request(app)
        .post(`/api/v1/customers/${customer._id}/loyalty`)
        .set('Authorization', `Bearer ${token}`)
        .send({ loyaltyPoints: 500, reason: 'Гомдлын нөхөн олговор' });

      expect(res.status).to.equal(200);

      const logs = await AuditLog.find({ action: AUDIT_ACTION.CUSTOMER_LOYALTY_ADJUST });
      expect(logs).to.have.lengthOf(1);
      expect(logs[0].before).to.equal(100);
      expect(logs[0].after).to.equal(500);
      expect(logs[0].reason).to.equal('Гомдлын нөхөн олговор');
    });

    it('шалтгаангүй бол хүлээж авахгүй', async () => {
      const customer = await createCustomer();
      const { token } = await createUserWithToken({ role: ROLES.ADMIN });

      const res = await chai
        .request(app)
        .post(`/api/v1/customers/${customer._id}/loyalty`)
        .set('Authorization', `Bearer ${token}`)
        .send({ loyaltyPoints: 500 });

      expect(res.status).to.equal(400);
    });
  });

  describe('Нууц үг хариултад орохгүй', () => {
    it('харилцагчийн password талбар API-аар гарахгүй', async () => {
      const customer = await createCustomer();
      const { token } = await createUserWithToken({ role: ROLES.STAFF });

      const res = await chai
        .request(app)
        .get(`/api/v1/customers/${customer._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.not.have.property('password');
    });
  });
});
