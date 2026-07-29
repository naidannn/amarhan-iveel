'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const app = require('../src/index');

chai.use(chaiHttp);
const expect = chai.expect;

describe('Contact Request API', () => {
  describe('POST /api/v1/contact-requests', () => {
    it('should create a new contact request', (done) => {
      const contactRequestData = {
        name: 'Test User',
        phone: '99999999',
        business: 'restaurant',
        message: 'Test message for contact request'
      };

      chai.request(app)
        .post('/api/v1/contact-requests')
        .send(contactRequestData)
        .end((err, res) => {
          expect(err).to.be.null;
          expect(res).to.have.status(201);
          expect(res.body).to.have.property('success', true);
          expect(res.body).to.have.property('data');
          expect(res.body.data).to.have.property('name', contactRequestData.name);
          expect(res.body.data).to.have.property('phone', contactRequestData.phone);
          expect(res.body.data).to.have.property('business', contactRequestData.business);
          expect(res.body.data).to.have.property('message', contactRequestData.message);
          expect(res.body.data).to.have.property('status', 'new');
          done();
        });
    });

    it('should return validation error for missing required fields', (done) => {
      const invalidData = {
        name: '',
        phone: '',
        message: ''
      };

      chai.request(app)
        .post('/api/v1/contact-requests')
        .send(invalidData)
        .end((err, res) => {
          expect(res).to.have.status(400);
          done();
        });
    });
  });

  describe('GET /api/v1/contact-requests', () => {
    it('should require authentication', (done) => {
      chai.request(app)
        .get('/api/v1/contact-requests')
        .end((err, res) => {
          expect(res).to.have.status(401);
          done();
        });
    });
  });
});
