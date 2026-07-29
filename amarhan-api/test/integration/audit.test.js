'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const { expect } = chai;

const { app } = require('../../src/services/express');
const AuditLog = require('../../src/models/audit-log.model');
const auditService = require('../../src/services/audit.service');
const { createUserWithToken, createUser } = require('../factories/user.factory');
const { createBranch } = require('../factories/domain.factory');
const { ROLES, AUDIT_ACTION, AUDIT_ENTITY } = require('../../src/config/constants');

chai.use(chaiHttp);

describe('Audit Log (§9.2)', () => {
  describe('BR-39 — Append-only', () => {
    let logId;

    beforeEach(async () => {
      const actor = await createUser();
      const log = await auditService.record({
        actor,
        action: AUDIT_ACTION.BRANCH_CREATE,
        entity: AUDIT_ENTITY.BRANCH,
        entityLabel: 'ER',
        after: { code: 'ER' },
      });
      logId = log._id;
    });

    it('updateOne хийх боломжгүй', async () => {
      await expect(
        AuditLog.updateOne({ _id: logId }, { $set: { reason: 'засварласан' } })
      ).to.be.rejectedWith(/append-only/);
    });

    it('findOneAndUpdate хийх боломжгүй', async () => {
      await expect(
        AuditLog.findOneAndUpdate({ _id: logId }, { $set: { after: 'хуурамч' } })
      ).to.be.rejectedWith(/append-only/);
    });

    it('deleteOne хийх боломжгүй', async () => {
      await expect(AuditLog.deleteOne({ _id: logId })).to.be.rejectedWith(/append-only/);
    });

    it('deleteMany хийх боломжгүй', async () => {
      await expect(AuditLog.deleteMany({})).to.be.rejectedWith(/append-only/);
    });

    it('хадгалагдсан бичлэгийг дахин save() хийх боломжгүй', async () => {
      const log = await AuditLog.findById(logId);
      log.reason = 'засварласан';
      await expect(log.save()).to.be.rejectedWith(/append-only/);
    });

    it('шинэ бичлэг үүсгэхийг зөвшөөрнө', async () => {
      const actor = await createUser();
      const log = await auditService.record({
        actor,
        action: AUDIT_ACTION.BRANCH_UPDATE,
        entity: AUDIT_ENTITY.BRANCH,
      });
      expect(log._id).to.exist;
    });
  });

  describe('Бичлэгийн агуулга', () => {
    it('ажилтны нэрийг хуулж хадгална (ажилтан устсан ч түүх үлдэнэ)', async () => {
      const actor = await createUser({ firstname: 'Бат', lastname: 'Дорж' });
      const log = await auditService.record({
        actor,
        action: AUDIT_ACTION.BRANCH_CREATE,
        entity: AUDIT_ENTITY.BRANCH,
      });

      expect(log.actorName).to.equal('Бат Дорж');
      expect(log.actorId.toString()).to.equal(actor._id.toString());
      expect(log.actorRole).to.equal(actor.role);
    });

    it('actor байхгүй бол "Систем" гэж бичнэ', async () => {
      const log = await auditService.record({
        actor: null,
        action: AUDIT_ACTION.BRANCH_CREATE,
        entity: AUDIT_ENTITY.BRANCH,
      });
      expect(log.actorName).to.equal('Систем');
    });

    it('action эсвэл entity дутуу бол алдаа өгнө', async () => {
      const actor = await createUser();
      await expect(auditService.record({ actor, entity: 'branch' })).to.be.rejectedWith(
        /action ба entity/
      );
    });

    it('танигдахгүй action-ыг хүлээж авахгүй', async () => {
      const actor = await createUser();
      await expect(
        auditService.record({ actor, action: 'зохиомол.үйлдэл', entity: AUDIT_ENTITY.BRANCH })
      ).to.be.rejected;
    });
  });

  describe('recordChanges — талбар тус бүрт бичлэг', () => {
    it('өөрчлөгдсөн талбар бүрт тусдаа бичлэг үүснэ', async () => {
      const actor = await createUser();
      await auditService.recordChanges(
        { actor, action: AUDIT_ACTION.BRANCH_UPDATE, entity: AUDIT_ENTITY.BRANCH },
        {
          name: { before: 'Хуучин', after: 'Шинэ' },
          phone: { before: null, after: '99112233' },
        }
      );

      const logs = await AuditLog.find({});
      expect(logs).to.have.lengthOf(2);
      expect(logs.map(l => l.field).sort()).to.deep.equal(['name', 'phone']);
    });

    it('өөрчлөгдөөгүй талбарт бичлэг үүсгэхгүй', async () => {
      const actor = await createUser();
      await auditService.recordChanges(
        { actor, action: AUDIT_ACTION.BRANCH_UPDATE, entity: AUDIT_ENTITY.BRANCH },
        { name: { before: 'Ижил', after: 'Ижил' } }
      );

      expect(await AuditLog.countDocuments()).to.equal(0);
    });
  });

  describe('GET /api/v1/audit-logs — эрх (§9.1)', () => {
    it('Ажилтан audit log харах эрхгүй', async () => {
      const { token } = await createUserWithToken({ role: ROLES.STAFF });
      const res = await chai
        .request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).to.equal(403);
    });

    it('Админ бүх салбарын audit log харна', async () => {
      const { token } = await createUserWithToken({ role: ROLES.ADMIN });
      const res = await chai
        .request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).to.equal(200);
    });

    it('Менежер зөвхөн ӨӨРИЙН салбарын бичлэгийг харна', async () => {
      const branchA = await createBranch();
      const branchB = await createBranch();

      const actor = await createUser({ role: ROLES.ADMIN });
      await auditService.record({
        actor,
        action: AUDIT_ACTION.BRANCH_CREATE,
        entity: AUDIT_ENTITY.BRANCH,
        entityLabel: 'A-салбарын бичлэг',
        branchId: branchA._id,
      });
      await auditService.record({
        actor,
        action: AUDIT_ACTION.BRANCH_CREATE,
        entity: AUDIT_ENTITY.BRANCH,
        entityLabel: 'B-салбарын бичлэг',
        branchId: branchB._id,
      });

      const { token } = await createUserWithToken({
        role: ROLES.MANAGER,
        branchId: branchA._id,
      });

      const res = await chai
        .request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.lengthOf(1);
      expect(res.body.data[0].entityLabel).to.equal('A-салбарын бичлэг');
    });

    it('салбаргүй Менежер audit log харахгүй', async () => {
      const { token } = await createUserWithToken({ role: ROLES.MANAGER, branchId: null });
      const res = await chai
        .request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).to.equal(403);
    });

    it('audit log үүсгэх/устгах endpoint байхгүй', async () => {
      const { token } = await createUserWithToken({ role: ROLES.ADMIN });

      const post = await chai
        .request(app)
        .post('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'зохиомол' });
      expect(post.status).to.equal(404);

      const del = await chai
        .request(app)
        .delete('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${token}`);
      expect(del.status).to.equal(404);
    });
  });
});
