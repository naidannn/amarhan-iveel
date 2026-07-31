'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const { expect } = chai;

const { app } = require('../../src/services/express');
const { createUserWithToken } = require('../factories/user.factory');
const { createBranch, createCargoTypeWithTariff, createLocation } = require('../factories/domain.factory');
const { PAYMENT_METHOD, ROLES } = require('../../src/config/constants');

chai.use(chaiHttp);

const PACKAGES = '/api/v1/packages';
const PAYMENTS = '/api/v1/payments';
const DELIVERIES = '/api/v1/deliveries';
const DASHBOARD = '/api/v1/dashboard';

describe('Хяналтын самбар', () => {
  let branch;
  let location;
  let staff;

  beforeEach(async () => {
    branch = await createBranch({ code: 'UB', name: 'Улаанбаатар агуулах' });
    await createCargoTypeWithTariff({ code: 'standard' });
    location = await createLocation(branch, { capacityCount: 100 });
    staff = await createUserWithToken({ role: ROLES.STAFF, branchId: branch._id });
  });

  async function register(price) {
    const res = await chai
      .request(app)
      .post(PACKAGES)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        trackingNumber: `DSH${Math.floor(Math.random() * 1e12)}`,
        phone: '99112233',
        finalPrice: price,
        locationCode: location.code,
      });

    expect(res.status, JSON.stringify(res.body)).to.equal(201);
    return res.body.data.package;
  }

  async function pay(pkg) {
    const res = await chai
      .request(app)
      .post(PAYMENTS)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ amount: pkg.finalPrice, method: PAYMENT_METHOD.CASH, packageIds: [pkg.id] });

    expect(res.status, JSON.stringify(res.body)).to.equal(201);
  }

  async function createDelivery(pkg) {
    const res = await chai
      .request(app)
      .post(DELIVERIES)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ packageIds: [pkg.id], address: 'Улаанбаатар, Баянзүрх дүүрэг', scheduledDate: new Date() });

    expect(res.status, JSON.stringify(res.body)).to.equal(201);
    return res.body.data;
  }

  it('KPI, 30 хоногийн график, өнөөдрийн хүргэлтийг нэг хүсэлтээр зөв нэгтгэнэ', async () => {
    await register(10000);
    const deliveredPackage = await register(20000);
    const pendingPackage = await register(30000);
    await pay(deliveredPackage);
    await pay(pendingPackage);

    const delivered = await createDelivery(deliveredPackage);
    await createDelivery(pendingPackage);

    for (const status of ['dispatched', 'delivered']) {
      const res = await chai
        .request(app)
        .put(`${DELIVERIES}/${delivered.id}/status`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ status });
      expect(res.status, JSON.stringify(res.body)).to.equal(200);
    }

    const res = await chai.request(app).get(DASHBOARD).set('Authorization', `Bearer ${staff.token}`);

    expect(res.status, JSON.stringify(res.body)).to.equal(200);
    expect(res.body.data.packages).to.include({
      total: 3,
      awaitingPayment: 1,
      outstandingAmount: 10000,
      paid: 2,
    });
    expect(res.body.data.revenue).to.include({ total: 50000, count: 2 });
    expect(res.body.data.deliveries).to.include({ total: 2, delivered: 1, pending: 1 });
    expect(res.body.data.daily).to.have.lengthOf(30);
    expect(res.body.data.daily.reduce((sum, day) => sum + day.revenue, 0)).to.equal(50000);
    expect(res.body.data.daily.reduce((sum, day) => sum + day.packages, 0)).to.equal(3);
    expect(res.body.data.packageStatuses.delivered).to.equal(1);
    expect(res.body.data.packageStatuses.paid).to.equal(1);
    expect(res.body.data.packageStatuses.registered).to.equal(1);
  });
});
