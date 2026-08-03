'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const { expect } = chai;

const { app } = require('../../src/services/express');
const { createUserWithToken } = require('../factories/user.factory');
const { createBranch, createCargoTypeWithTariff, createLocation } = require('../factories/domain.factory');
const AuditLog = require('../../src/models/audit-log.model');
const { ROLES, AUDIT_ACTION } = require('../../src/config/constants');

chai.use(chaiHttp);

const EXPENSES = '/api/v1/expenses';
const PACKAGES = '/api/v1/packages';
const REPORTS = '/api/v1/reports';

describe('Зарлага (BR-47)', () => {
  let branch;
  let manager;
  let admin;
  let staff;

  beforeEach(async () => {
    branch = await createBranch({ code: 'UB', name: 'Улаанбаатар агуулах' });
    manager = await createUserWithToken({ role: ROLES.MANAGER, branchId: branch._id });
    admin = await createUserWithToken({ role: ROLES.ADMIN });
    staff = await createUserWithToken({ role: ROLES.STAFF, branchId: branch._id });
  });

  it('Менежер зарлага бүртгэнэ, audit-д expense.create бичигдэнэ', async () => {
    const response = await chai
      .request(app)
      .post(EXPENSES)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ amount: 50000, category: 'rent', description: 'Оффисын түрээс 8-р сар' });

    expect(response.status, JSON.stringify(response.body)).to.equal(201);
    expect(response.body.data).to.include({ amount: 50000, category: 'rent', status: 'active' });

    const logs = await AuditLog.find({
      action: AUDIT_ACTION.EXPENSE_CREATE,
      entityId: response.body.data.id,
    });
    expect(logs).to.have.lengthOf(1);
    expect(logs[0].after).to.equal(50000);
  });

  it('"Бусад" ангилалд categoryLabel заагаагүй бол 400', async () => {
    const response = await chai
      .request(app)
      .post(EXPENSES)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ amount: 10000, category: 'other', description: 'Тодорхойгүй зардал' });

    expect(response.status).to.equal(400);
  });

  it('"Бусад" ангилалд categoryLabel-тай бол амжилттай бүртгэгдэнэ', async () => {
    const response = await chai
      .request(app)
      .post(EXPENSES)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        amount: 15000,
        category: 'other',
        categoryLabel: 'Даатгал',
        description: 'Автомашины даатгал',
      });

    expect(response.status, JSON.stringify(response.body)).to.equal(201);
    expect(response.body.data.categoryLabel).to.equal('Даатгал');
  });

  it('Ажилтан зарлага бүртгэх, харах, хүчингүй болгох эрхгүй', async () => {
    const createRes = await chai
      .request(app)
      .post(EXPENSES)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ amount: 10000, category: 'fuel', description: 'Шатахуун' });
    expect(createRes.status).to.equal(403);

    const listRes = await chai.request(app).get(EXPENSES).set('Authorization', `Bearer ${staff.token}`);
    expect(listRes.status).to.equal(403);
  });

  it('Менежер/Админ хүчингүй болгоход expense.void audit бичигдэж, дахин хүчингүй болгох боломжгүй', async () => {
    const createRes = await chai
      .request(app)
      .post(EXPENSES)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ amount: 20000, category: 'salary', description: 'Аваргын цалин' });
    const expenseId = createRes.body.data.id;

    const voidRes = await chai
      .request(app)
      .put(`${EXPENSES}/${expenseId}/void`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ reason: 'Буруу дүн бичсэн' });

    expect(voidRes.status, JSON.stringify(voidRes.body)).to.equal(200);
    expect(voidRes.body.data.status).to.equal('voided');

    const logs = await AuditLog.find({ action: AUDIT_ACTION.EXPENSE_VOID, entityId: expenseId });
    expect(logs).to.have.lengthOf(1);
    expect(logs[0].reason).to.equal('Буруу дүн бичсэн');

    const secondVoid = await chai
      .request(app)
      .put(`${EXPENSES}/${expenseId}/void`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ reason: 'Дахин оролдох' });
    expect(secondVoid.status).to.equal(422);
    expect(secondVoid.body.code).to.equal('EXPENSE_ALREADY_VOIDED');
  });

  it('Менежер зөвхөн өөрийн салбарын зарлагыг жагсаалтад харна', async () => {
    const otherBranch = await createBranch({ code: 'ER', name: 'Бусад салбар' });
    const otherManager = await createUserWithToken({ role: ROLES.MANAGER, branchId: otherBranch._id });

    await chai
      .request(app)
      .post(EXPENSES)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ amount: 30000, category: 'office', description: 'Бичиг хэрэг' });
    await chai
      .request(app)
      .post(EXPENSES)
      .set('Authorization', `Bearer ${otherManager.token}`)
      .send({ amount: 40000, category: 'office', description: 'Өөр салбарын зардал' });

    const listRes = await chai.request(app).get(EXPENSES).set('Authorization', `Bearer ${manager.token}`);
    expect(listRes.body.data).to.have.lengthOf(1);
    expect(listRes.body.data[0].amount).to.equal(30000);
  });

  describe('Тайлангийн үр ашгийн хэсэг (BR-47a)', () => {
    it('төлбөргүй ачааны үнэ ч "олох ёстой орлого"-нд орж, зарлагатай харьцуулагдана', async () => {
      await createCargoTypeWithTariff({ code: 'standard' });
      const location = await createLocation(branch, { capacityCount: 100 });

      const pkgRes = await chai
        .request(app)
        .post(PACKAGES)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({
          trackingNumber: `EXP${Math.floor(Math.random() * 1e12)}`,
          finalPrice: 25000,
          locationCode: location.code,
        });
      expect(pkgRes.status, JSON.stringify(pkgRes.body)).to.equal(201);

      const expenseRes = await chai
        .request(app)
        .post(EXPENSES)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ amount: 9000, category: 'fuel', description: 'Шатахуун' });
      expect(expenseRes.status, JSON.stringify(expenseRes.body)).to.equal(201);

      const report = await chai
        .request(app)
        .get(`${REPORTS}?period=30d`)
        .set('Authorization', `Bearer ${manager.token}`);

      expect(report.status, JSON.stringify(report.body)).to.equal(200);
      const { efficiency } = report.body.data;
      expect(efficiency.packageRevenue.total).to.equal(25000);
      expect(efficiency.expenses.total).to.equal(9000);
      expect(efficiency.profit.total).to.equal(16000);
    });
  });
});
