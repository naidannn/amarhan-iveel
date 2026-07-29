'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');

// src/index.js биш — тэр нь сервер эхлүүлж, өөрөө DB рүү холбогддог.
// Тестэд зөвхөн Express app хэрэгтэй.
const { app } = require('../src/services/express');

chai.should();
chai.use(chaiHttp);

describe('Application', () => {
  it('эрүүл мэндийн шалгалт 200 буцаана', done => {
    chai
      .request(app)
      .get('/api/status')
      .end((err, res) => {
        res.should.have.status(200);
        res.body.success.should.equal(true);
        done();
      });
  });

  it('байхгүй зам 404 буцаана', done => {
    chai
      .request(app)
      .get('/something/not/exists')
      .end((err, res) => {
        res.should.have.status(404);
        done();
      });
  });
});
