'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const { expect } = chai;

const { app } = require('../../src/services/express');
const TariffVersion = require('../../src/models/tariff-version.model');
const AuditLog = require('../../src/models/audit-log.model');
const { createUserWithToken } = require('../factories/user.factory');
const { createCargoTypeWithTariff } = require('../factories/domain.factory');
const { ROLES, AUDIT_ACTION } = require('../../src/config/constants');

chai.use(chaiHttp);

describe('Ачааны төрөл ба тариф (§1.2)', () => {
  describe('Эрх — тариф тохируулах ЗӨВХӨН Админ (§9.1)', () => {
    const payload = {
      code: 'test_type',
      name: 'Тест төрөл',
      pricePerKg: 5000,
      pricePerM3: 40000,
      minimumCharge: 5000,
    };

    it('Ажилтан ачааны төрөл үүсгэж чадахгүй', async () => {
      const { token } = await createUserWithToken({ role: ROLES.STAFF });
      const res = await chai
        .request(app)
        .post('/api/v1/tariffs/cargo-types')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);
      expect(res.status).to.equal(403);
    });

    it('Менежер ч тариф тохируулж чадахгүй', async () => {
      const { token } = await createUserWithToken({ role: ROLES.MANAGER });
      const res = await chai
        .request(app)
        .post('/api/v1/tariffs/cargo-types')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);
      expect(res.status).to.equal(403);
    });

    it('Админ үүсгэж чадна', async () => {
      const { token } = await createUserWithToken({ role: ROLES.ADMIN });
      const res = await chai
        .request(app)
        .post('/api/v1/tariffs/cargo-types')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);
      expect(res.status).to.equal(201);
      expect(res.body.data.cargoType.code).to.equal('test_type');
      expect(res.body.data.tariff.pricePerKg).to.equal(5000);
    });

    it('Ажилтан төрлийн жагсаалтыг харна (ачаа бүртгэхэд хэрэгтэй)', async () => {
      await createCargoTypeWithTariff();
      const { token } = await createUserWithToken({ role: ROLES.STAFF });
      const res = await chai
        .request(app)
        .get('/api/v1/tariffs/cargo-types')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).to.equal(200);
    });
  });

  describe('BR-02 — Тариф хувилбаржина, хуучин нь устахгүй', () => {
    it('тариф өөрчлөхөд хуучин хувилбар хаагдаж, шинэ нь үүснэ', async () => {
      const { cargoType, tariff: original } = await createCargoTypeWithTariff();
      const { token } = await createUserWithToken({ role: ROLES.ADMIN });

      const res = await chai
        .request(app)
        .post(`/api/v1/tariffs/cargo-types/${cargoType._id}/tariff`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          pricePerKg: 7000,
          pricePerM3: 50000,
          minimumCharge: 8000,
          note: 'Түлшний үнэ өссөн',
        });

      expect(res.status).to.equal(201);

      const versions = await TariffVersion.find({ cargoTypeId: cargoType._id }).sort({
        effectiveFrom: 1,
      });

      // Хуучин хувилбар УСТААГҮЙ, зөвхөн хаагдсан
      expect(versions).to.have.lengthOf(2);

      const old = versions.find(v => v._id.toString() === original._id.toString());
      expect(old, 'хуучин хувилбар байх ёстой').to.exist;
      expect(old.effectiveTo, 'хуучин хувилбар хаагдсан байх ёстой').to.not.be.null;
      expect(old.pricePerKg, 'хуучин үнэ өөрчлөгдөөгүй байх ёстой').to.equal(5000);

      const active = versions.find(v => v.effectiveTo === null);
      expect(active.pricePerKg).to.equal(7000);
    });

    it('ачааны төрөлд идэвхтэй тариф зөвхөн НЭГ байна', async () => {
      const { cargoType } = await createCargoTypeWithTariff();
      const { token } = await createUserWithToken({ role: ROLES.ADMIN });

      for (const price of [6000, 7000, 8000]) {
        await chai
          .request(app)
          .post(`/api/v1/tariffs/cargo-types/${cargoType._id}/tariff`)
          .set('Authorization', `Bearer ${token}`)
          .send({ pricePerKg: price, pricePerM3: 40000, minimumCharge: 5000 });
      }

      const active = await TariffVersion.find({ cargoTypeId: cargoType._id, effectiveTo: null });
      expect(active).to.have.lengthOf(1);
      expect(active[0].pricePerKg).to.equal(8000);

      const all = await TariffVersion.find({ cargoTypeId: cargoType._id });
      expect(all, 'бүх хувилбар хадгалагдсан байх ёстой').to.have.lengthOf(4);
    });

    it('өөрчлөлтгүй тарифыг хүлээж авахгүй', async () => {
      const { cargoType } = await createCargoTypeWithTariff();
      const { token } = await createUserWithToken({ role: ROLES.ADMIN });

      const res = await chai
        .request(app)
        .post(`/api/v1/tariffs/cargo-types/${cargoType._id}/tariff`)
        .set('Authorization', `Bearer ${token}`)
        .send({ pricePerKg: 5000, pricePerM3: 40000, minimumCharge: 5000 });

      expect(res.status).to.equal(400);
    });

    it('тарифын түүхийг буцаана', async () => {
      const { cargoType } = await createCargoTypeWithTariff();
      const { token } = await createUserWithToken({ role: ROLES.ADMIN });

      await chai
        .request(app)
        .post(`/api/v1/tariffs/cargo-types/${cargoType._id}/tariff`)
        .set('Authorization', `Bearer ${token}`)
        .send({ pricePerKg: 9000, pricePerM3: 40000, minimumCharge: 5000 });

      const res = await chai
        .request(app)
        .get(`/api/v1/tariffs/cargo-types/${cargoType._id}/tariff`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.lengthOf(2);
    });
  });

  describe('BR-38 — Тарифын өөрчлөлт audit-д бичигдэнэ', () => {
    it('өөрчлөгдсөн талбар бүр audit-д хуучин/шинэ утгатай орно', async () => {
      const { cargoType } = await createCargoTypeWithTariff();
      const { token } = await createUserWithToken({ role: ROLES.ADMIN });

      await chai
        .request(app)
        .post(`/api/v1/tariffs/cargo-types/${cargoType._id}/tariff`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          pricePerKg: 7000,
          pricePerM3: 40000,
          minimumCharge: 5000,
          note: 'Түлшний үнэ өссөн',
        });

      const logs = await AuditLog.find({ action: AUDIT_ACTION.TARIFF_CHANGE });

      // Зөвхөн pricePerKg өөрчлөгдсөн
      expect(logs).to.have.lengthOf(1);
      expect(logs[0].field).to.equal('pricePerKg');
      expect(logs[0].before).to.equal(5000);
      expect(logs[0].after).to.equal(7000);
      expect(logs[0].reason).to.equal('Түлшний үнэ өссөн');
    });
  });

  describe('POST /tariffs/quote — үнэ урьдчилан харах (§1.2)', () => {
    it('жин ба эзлэхүүнээс өндрийг сонгож буцаана', async () => {
      const { cargoType } = await createCargoTypeWithTariff();
      const { token } = await createUserWithToken({ role: ROLES.STAFF });

      const res = await chai
        .request(app)
        .post('/api/v1/tariffs/quote')
        .set('Authorization', `Bearer ${token}`)
        .send({ cargoTypeId: cargoType._id, weightKg: 2, volumeM3: 0.5 });

      expect(res.status).to.equal(200);
      expect(res.body.data.byWeight).to.equal(10000);
      expect(res.body.data.byVolume).to.equal(20000);
      expect(res.body.data.final).to.equal(20000);
      expect(res.body.data.source).to.equal('volume');
    });

    it('хэмжээснээс эзлэхүүнийг автоматаар бодно (BR-03)', async () => {
      const { cargoType } = await createCargoTypeWithTariff();
      const { token } = await createUserWithToken({ role: ROLES.STAFF });

      const res = await chai
        .request(app)
        .post('/api/v1/tariffs/quote')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cargoTypeId: cargoType._id,
          weightKg: 1,
          dimensions: { lengthCm: 100, widthCm: 100, heightCm: 100 },
        });

      expect(res.status).to.equal(200);
      expect(res.body.data.volumeM3).to.equal(1);
      expect(res.body.data.byVolume).to.equal(40000);
      expect(res.body.data.final).to.equal(40000);
    });

    it('жин, эзлэхүүн, хэмжээс гурвуулаа байхгүй бол 400', async () => {
      const { cargoType } = await createCargoTypeWithTariff();
      const { token } = await createUserWithToken({ role: ROLES.STAFF });

      const res = await chai
        .request(app)
        .post('/api/v1/tariffs/quote')
        .set('Authorization', `Bearer ${token}`)
        .send({ cargoTypeId: cargoType._id });

      expect(res.status).to.equal(400);
    });

    it('тарифгүй ачааны төрөлд ойлгомжтой алдаа буцаана', async () => {
      const CargoType = require('../../src/models/cargo-type.model');
      const orphan = await CargoType.create({ code: 'no_tariff', name: 'Тарифгүй' });
      const { token } = await createUserWithToken({ role: ROLES.STAFF });

      const res = await chai
        .request(app)
        .post('/api/v1/tariffs/quote')
        .set('Authorization', `Bearer ${token}`)
        .send({ cargoTypeId: orphan._id, weightKg: 1 });

      expect(res.status).to.equal(422);
      expect(res.body.message).to.include('тариф');
    });
  });

  describe('Мөнгө бүхэл тоо байх (docs/data-model.md §0)', () => {
    it('бутархай үнийг хүлээж авахгүй', async () => {
      const { token } = await createUserWithToken({ role: ROLES.ADMIN });
      const res = await chai
        .request(app)
        .post('/api/v1/tariffs/cargo-types')
        .set('Authorization', `Bearer ${token}`)
        .send({
          code: 'fractional',
          name: 'Бутархай',
          pricePerKg: 5000.5,
          pricePerM3: 40000,
          minimumCharge: 5000,
        });
      expect(res.status).to.equal(400);
    });
  });
});
