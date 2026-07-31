'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const { expect } = chai;

const { app } = require('../../src/services/express');
const { createUserWithToken } = require('../factories/user.factory');
const {
  createBranch,
  createCargoTypeWithTariff,
  createLocation,
} = require('../factories/domain.factory');
const { PAYMENT_METHOD, ROLES } = require('../../src/config/constants');

chai.use(chaiHttp);

const PACKAGES = '/api/v1/packages';
const PAYMENTS = '/api/v1/payments';
const REPORTS = '/api/v1/reports';

describe('Тайлан', () => {
  let branch;
  let location;
  let manager;

  beforeEach(async () => {
    branch = await createBranch({ code: 'UB', name: 'Улаанбаатар агуулах' });
    await createCargoTypeWithTariff({ code: 'standard' });
    location = await createLocation(branch, { capacityCount: 100 });
    manager = await createUserWithToken({ role: ROLES.MANAGER, branchId: branch._id });
  });

  async function register(price) {
    const response = await chai
      .request(app)
      .post(PACKAGES)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        trackingNumber: `RPT${Math.floor(Math.random() * 1e12)}`,
        phone: '99112233',
        finalPrice: price,
        locationCode: location.code,
      });

    expect(response.status, JSON.stringify(response.body)).to.equal(201);
    return response.body.data.package;
  }

  it('ачаа, орлого, төлбөрийн насжилтыг нэг хүсэлтэд салбарын хүрээнд нэгтгэнэ', async () => {
    const unpaid = await register(10000);
    const paid = await register(20000);

    const payment = await chai
      .request(app)
      .post(PAYMENTS)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ amount: paid.finalPrice, method: PAYMENT_METHOD.CASH, packageIds: [paid.id] });
    expect(payment.status, JSON.stringify(payment.body)).to.equal(201);

    const report = await chai
      .request(app)
      .get(`${REPORTS}?period=30d`)
      .set('Authorization', `Bearer ${manager.token}`);

    expect(report.status, JSON.stringify(report.body)).to.equal(200);
    expect(report.body.data.cargo).to.include({ total: 2, arrivals: 2, issued: 0, remaining: 2 });
    expect(report.body.data.revenue).to.include({
      total: 20000,
      count: 1,
      averagePerPackage: 20000,
    });
    expect(report.body.data.revenue.methods.cash).to.deep.equal({ value: 20000, count: 1 });
    expect(report.body.data.payments).to.include({
      pending: unpaid.balance,
      pendingCount: 1,
      overdue: 0,
    });
    expect(report.body.data.payments.aging['0-3']).to.deep.equal({
      value: unpaid.balance,
      count: 1,
    });
  });

  it('ажилтан тайлангийн endpoint-д хандах эрхгүй', async () => {
    const staff = await createUserWithToken({ role: ROLES.STAFF, branchId: branch._id });
    const response = await chai
      .request(app)
      .get(REPORTS)
      .set('Authorization', `Bearer ${staff.token}`);

    expect(response.status).to.equal(403);
  });
});
