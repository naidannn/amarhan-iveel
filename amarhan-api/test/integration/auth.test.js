'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const jwt = require('jsonwebtoken');
const { expect } = chai;

const { app } = require('../../src/services/express');
const config = require('../../src/config');
const { createUser, createUserWithToken } = require('../factories/user.factory');
const { ROLES } = require('../../src/config/constants');

chai.use(chaiHttp);

/**
 * Phase 0-д таглагдсан аюулгүй байдлын нүхнүүд эргэж нээгдэхээс сэргийлнэ.
 */
describe('Танилт ба эрх (§9.1)', () => {
  describe('Нээлттэй бүртгэл хаагдсан', () => {
    it('POST /auth/register байхгүй — эрх өөрөө өсгөх боломжгүй', async () => {
      const res = await chai.request(app).post('/api/v1/auth/register').send({
        email: 'attacker@example.com',
        password: 'password123',
        firstname: 'Ат',
        lastname: 'Такер',
        role: 'admin',
      });

      expect(res.status).to.equal(404);
    });
  });

  describe('Нэвтрэх', () => {
    it('зөв мэдээллээр нэвтэрч токен авна', async () => {
      await createUser({ email: 'staff@iveel.mn', password: 'password123' });

      const res = await chai
        .request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'staff@iveel.mn', password: 'password123' });

      expect(res.status).to.equal(200);
      expect(res.body.data.token).to.be.a('string');
      expect(res.body.data.user).to.not.have.property('password');
    });

    it('буруу нууц үгээр нэвтрэхгүй', async () => {
      await createUser({ email: 'staff@iveel.mn', password: 'password123' });

      const res = await chai
        .request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'staff@iveel.mn', password: 'буруу-нууц-үг' });

      expect(res.status).to.equal(401);
    });

    it('идэвхгүй болсон ажилтан нэвтрэхгүй', async () => {
      await createUser({
        email: 'fired@iveel.mn',
        password: 'password123',
        status: 'deactive',
      });

      const res = await chai
        .request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'fired@iveel.mn', password: 'password123' });

      expect(res.status).to.equal(403);
    });

    it('токенд хугацаа ба aud заагдсан байна', async () => {
      const { token } = await createUserWithToken();
      const decoded = jwt.decode(token);

      expect(decoded.exp, 'токен хугацаагүй байж болохгүй').to.be.a('number');
      expect(decoded.aud).to.equal('staff');
      expect(decoded.role).to.exist;
    });
  });

  describe('Токеноор хандах', () => {
    it('хүчинтэй токеноор /auth/me ажиллана', async () => {
      const { token, user } = await createUserWithToken();

      const res = await chai
        .request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).to.equal(200);
      expect(res.body.data.user.email).to.equal(user.email);
    });

    it('токенгүй бол 401', async () => {
      const res = await chai.request(app).get('/api/v1/auth/me');
      expect(res.status).to.equal(401);
    });

    it('харилцагчийн aud-тай токен ажилтны endpoint рүү орохгүй', async () => {
      const user = await createUser();
      const customerToken = jwt.sign({ sub: user.id }, config.secret, {
        audience: 'customer',
        expiresIn: '1h',
      });

      const res = await chai
        .request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).to.equal(401);
    });

    it('хугацаа дууссан токен ажиллахгүй', async () => {
      const user = await createUser();
      const expired = jwt.sign({ sub: user.id }, config.secret, {
        audience: 'staff',
        expiresIn: '-1s',
      });

      const res = await chai
        .request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expired}`);

      expect(res.status).to.equal(401);
    });

    it('токен үүссэний дараа идэвхгүй болсон ажилтан хаагдана', async () => {
      const { token, user } = await createUserWithToken();

      user.status = 'deactive';
      await user.save({ validateBeforeSave: false });

      const res = await chai
        .request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).to.equal(401);
    });
  });

  describe('Хэрэглэгч удирдах эрх (§9.1)', () => {
    it('Ажилтан бусад ажилтныг жагсааж чадахгүй', async () => {
      const { token } = await createUserWithToken({ role: ROLES.STAFF });

      const res = await chai
        .request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).to.equal(403);
    });

    it('Менежер ажилтны эрхийг удирдаж чадахгүй', async () => {
      const { token } = await createUserWithToken({ role: ROLES.MANAGER });

      const res = await chai
        .request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).to.equal(403);
    });

    it('Админ ажилтныг жагсаана', async () => {
      const { token } = await createUserWithToken({ role: ROLES.ADMIN });

      const res = await chai
        .request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).to.equal(200);
    });
  });
});
