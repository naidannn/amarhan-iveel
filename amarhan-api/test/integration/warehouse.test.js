'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const { expect } = chai;

const { app } = require('../../src/services/express');
const WarehouseLocation = require('../../src/models/warehouse-location.model');
const { createUserWithToken } = require('../factories/user.factory');
const { createBranch, createLocation } = require('../factories/domain.factory');
const { ROLES } = require('../../src/config/constants');

chai.use(chaiHttp);

describe('Салбар ба агуулах (§8)', () => {
  describe('Салбар — эрх (§9.1)', () => {
    it('Ажилтан салбар үүсгэж чадахгүй', async () => {
      const { token } = await createUserWithToken({ role: ROLES.STAFF });
      const res = await chai
        .request(app)
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'ER', name: 'Эрээн' });
      expect(res.status).to.equal(403);
    });

    it('Менежер ч салбар үүсгэж чадахгүй', async () => {
      const { token } = await createUserWithToken({ role: ROLES.MANAGER });
      const res = await chai
        .request(app)
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'ER', name: 'Эрээн' });
      expect(res.status).to.equal(403);
    });

    it('Админ үүсгэнэ', async () => {
      const { token } = await createUserWithToken({ role: ROLES.ADMIN });
      const res = await chai
        .request(app)
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'ER', name: 'Эрээн салбар', country: 'Хятад' });
      expect(res.status).to.equal(201);
      expect(res.body.data.code).to.equal('ER');
    });

    it('Ажилтан салбарын жагсаалтыг харна (ачаа бүртгэхэд хэрэгтэй)', async () => {
      await createBranch();
      const { token } = await createUserWithToken({ role: ROLES.STAFF });
      const res = await chai
        .request(app)
        .get('/api/v1/branches')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).to.equal(200);
    });

    it('давхардсан кодыг хүлээж авахгүй', async () => {
      await createBranch({ code: 'ER' });
      const { token } = await createUserWithToken({ role: ROLES.ADMIN });
      const res = await chai
        .request(app)
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'ER', name: 'Давхардсан' });
      expect(res.status).to.equal(409);
    });

    it('салбарын кодыг өөрчлөхийг хориглоно (байршлын код түүнээс хамаарна)', async () => {
      const branch = await createBranch({ code: 'ER' });
      const { token } = await createUserWithToken({ role: ROLES.ADMIN });

      // Joi код талбарыг хүлээж авахгүй — 400 эсвэл өөрчлөгдөхгүй
      const res = await chai
        .request(app)
        .put(`/api/v1/branches/${branch._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'XX', name: 'Шинэ нэр' });

      expect(res.status).to.be.oneOf([200, 400]);
      const reloaded = await (await import('mongoose')).default
        .model('Branch')
        .findById(branch._id);
      expect(reloaded.code).to.equal('ER');
    });
  });

  describe('BR-22 — Байршлын код', () => {
    it('бүрдэл хэсгээс байршил үүсгэнэ', async () => {
      const branch = await createBranch({ code: 'ER' });
      const { token } = await createUserWithToken({ role: ROLES.ADMIN });

      const res = await chai
        .request(app)
        .post('/api/v1/warehouse-locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ branchId: branch._id, room: 2, shelf: 'B', row: 1, cell: 5 });

      expect(res.status).to.equal(201);
      expect(res.body.data.code).to.equal('ER-02-B-15');
    });

    it('бүрэн кодоор байршил үүсгэнэ', async () => {
      const branch = await createBranch({ code: 'ER' });
      const { token } = await createUserWithToken({ role: ROLES.ADMIN });

      const res = await chai
        .request(app)
        .post('/api/v1/warehouse-locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ branchId: branch._id, code: 'ER-03-C-27' });

      expect(res.status).to.equal(201);
      expect(res.body.data.room).to.equal('03');
      expect(res.body.data.shelf).to.equal('C');
      expect(res.body.data.row).to.equal(2);
      expect(res.body.data.cell).to.equal(7);
    });

    it('өөр салбарын кодыг хүлээж авахгүй', async () => {
      const branch = await createBranch({ code: 'ER' });
      const { token } = await createUserWithToken({ role: ROLES.ADMIN });

      const res = await chai
        .request(app)
        .post('/api/v1/warehouse-locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ branchId: branch._id, code: 'UB-03-C-27' });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.include('таарахгүй');
    });

    it('форматгүй кодыг хүлээж авахгүй', async () => {
      const branch = await createBranch({ code: 'ER' });
      const { token } = await createUserWithToken({ role: ROLES.ADMIN });

      const res = await chai
        .request(app)
        .post('/api/v1/warehouse-locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ branchId: branch._id, code: 'ER-2-B-1' });

      expect(res.status).to.equal(400);
    });

    it('давхардсан байршлыг хүлээж авахгүй', async () => {
      const branch = await createBranch({ code: 'ER' });
      const { token } = await createUserWithToken({ role: ROLES.ADMIN });
      const payload = { branchId: branch._id, room: 2, shelf: 'B', row: 1, cell: 5 };

      await chai
        .request(app)
        .post('/api/v1/warehouse-locations')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      const res = await chai
        .request(app)
        .post('/api/v1/warehouse-locations')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(res.status).to.equal(409);
    });
  });

  describe('Тавиурын бүх нүдийг нэг дор үүсгэх', () => {
    it('мөр × нүдний тоогоор үүсгэнэ', async () => {
      const branch = await createBranch({ code: 'ER' });
      const { token } = await createUserWithToken({ role: ROLES.ADMIN });

      const res = await chai
        .request(app)
        .post('/api/v1/warehouse-locations/shelf')
        .set('Authorization', `Bearer ${token}`)
        .send({ branchId: branch._id, room: 1, shelf: 'A', rows: 3, cells: 4 });

      expect(res.status).to.equal(201);
      expect(res.body.data.created).to.equal(12);
      expect(await WarehouseLocation.countDocuments()).to.equal(12);
    });

    it('дахин ажиллуулахад давхардал үүсгэхгүй (идемпотент)', async () => {
      const branch = await createBranch({ code: 'ER' });
      const { token } = await createUserWithToken({ role: ROLES.ADMIN });
      const payload = { branchId: branch._id, room: 1, shelf: 'A', rows: 3, cells: 4 };

      await chai
        .request(app)
        .post('/api/v1/warehouse-locations/shelf')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      const res = await chai
        .request(app)
        .post('/api/v1/warehouse-locations/shelf')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(res.body.data.created).to.equal(0);
      expect(res.body.data.skipped).to.equal(12);
      expect(await WarehouseLocation.countDocuments()).to.equal(12);
    });
  });

  describe('§8 — Байршлаар хайх', () => {
    it('бүрэн кодоор олно', async () => {
      const branch = await createBranch({ code: 'ER' });
      await createLocation(branch);
      const location = await WarehouseLocation.findOne({});
      const { token } = await createUserWithToken({ role: ROLES.STAFF });

      const res = await chai
        .request(app)
        .get(`/api/v1/warehouse-locations/code/${location.code}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).to.equal(200);
      expect(res.body.data.code).to.equal(location.code);
    });

    it('хэсэгчилсэн кодоор жагсаана', async () => {
      const branch = await createBranch({ code: 'ER' });
      const { token } = await createUserWithToken({ role: ROLES.ADMIN });

      await chai
        .request(app)
        .post('/api/v1/warehouse-locations/shelf')
        .set('Authorization', `Bearer ${token}`)
        .send({ branchId: branch._id, room: 2, shelf: 'B', rows: 2, cells: 2 });

      const res = await chai
        .request(app)
        .get('/api/v1/warehouse-locations?code=ER-02')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.lengthOf(4);
    });
  });

  describe('BR-23/BR-24 — Хоосон нүд санал болгох ба багтаамж', () => {
    it('багтаамж дүүрээгүй эхний нүдийг санал болгоно', async () => {
      const branch = await createBranch({ code: 'ER' });
      const { token } = await createUserWithToken({ role: ROLES.ADMIN });

      await chai
        .request(app)
        .post('/api/v1/warehouse-locations/shelf')
        .set('Authorization', `Bearer ${token}`)
        .send({ branchId: branch._id, room: 1, shelf: 'A', rows: 2, cells: 2, capacityCount: 1 });

      // Эхний нүдийг дүүргэнэ
      const first = await WarehouseLocation.findOne({}).sort({ code: 1 });
      first.currentCount = 1;
      await first.save();

      const res = await chai
        .request(app)
        .get(`/api/v1/warehouse-locations/suggest?branchId=${branch._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).to.equal(200);
      expect(res.body.data.code, 'дүүрсэн нүдийг санал болгох ёсгүй').to.not.equal(first.code);
    });

    it('багтаамжгүй (хязгааргүй) нүдийг үргэлж санал болгоно', async () => {
      const branch = await createBranch({ code: 'ER' });
      await createLocation(branch, { capacityCount: null, currentCount: 999 });
      const { token } = await createUserWithToken({ role: ROLES.STAFF });

      const res = await chai
        .request(app)
        .get(`/api/v1/warehouse-locations/suggest?branchId=${branch._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.not.be.null;
    });

    it('isFull нь багтаамж дүүрснийг заана (BR-24 — сануулга, хориг биш)', async () => {
      const branch = await createBranch({ code: 'ER' });
      const location = await createLocation(branch, { capacityCount: 2, currentCount: 2 });
      expect(location.isFull).to.equal(true);
    });
  });
});
