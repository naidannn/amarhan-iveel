'use strict';

const crypto = require('crypto');
const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const { expect } = chai;

const { app } = require('../../src/services/express');
const config = require('../../src/config');
const { createUserWithToken } = require('../factories/user.factory');
const AuditLog = require('../../src/models/audit-log.model');
const { ROLES, ERROR_CODE, AUDIT_ACTION } = require('../../src/config/constants');

chai.use(chaiHttp);

const UPLOADS = '/api/v1/uploads';
const NOTIFICATIONS = '/api/v1/notifications';
const PUBLIC = '/api/v1/public';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

const IMAGE_URL = 'https://res.cloudinary.com/demo/image/upload/v1/iveel/popups/abc.png';

/**
 * Зурагтай зарлал / вэбийн popup — Мэдэгдэл модуль (BR-36). Зураг Cloudinary-д
 * (сервер дээр хадгалахгүй), popup нь зочинд `GET /public/content`-ийн `home_popup`.
 */
describe('Мэдэгдлийн зураг ба popup', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('POST /uploads/notification-image', () => {
    it('Cloudinary тохируулаагүй бол 503 + IMAGE_HOST_DISABLED', async () => {
      sandbox.replace(config, 'cloudinary', { folder: 'iveel/popups', enabled: false });
      const admin = await createUserWithToken({ role: ROLES.ADMIN });

      const res = await chai
        .request(app)
        .post(`${UPLOADS}/notification-image`)
        .set('Authorization', `Bearer ${admin.token}`)
        .attach('image', TINY_PNG, 'popup.png');

      expect(res.status).to.equal(503);
      expect(res.body.code).to.equal(ERROR_CODE.IMAGE_HOST_DISABLED);
    });

    it('гарын үсэгтэй хүсэлтээр Cloudinary руу илгээж, бүтэн URL буцаана', async () => {
      sandbox.replace(config, 'cloudinary', {
        cloudName: 'demo',
        apiKey: 'key123',
        apiSecret: 'secret456',
        folder: 'iveel/popups',
        enabled: true,
      });
      const fetchStub = sandbox.stub(global, 'fetch').resolves(
        new Response(
          JSON.stringify({
            secure_url: IMAGE_URL,
            public_id: 'iveel/popups/abc',
            width: 1,
            height: 1,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
      const admin = await createUserWithToken({ role: ROLES.ADMIN });

      const res = await chai
        .request(app)
        .post(`${UPLOADS}/notification-image`)
        .set('Authorization', `Bearer ${admin.token}`)
        .attach('image', TINY_PNG, 'popup.png');

      expect(res.status, JSON.stringify(res.body)).to.equal(201);
      expect(res.body.data.url).to.equal(IMAGE_URL);

      const [url, init] = fetchStub.firstCall.args;
      expect(url).to.equal('https://api.cloudinary.com/v1_1/demo/image/upload');
      const form = init.body;
      expect(form.get('api_key')).to.equal('key123');
      expect(form.has('api_secret')).to.equal(false);
      const expected = crypto
        .createHash('sha1')
        .update(`folder=iveel/popups&timestamp=${form.get('timestamp')}secret456`)
        .digest('hex');
      expect(form.get('signature')).to.equal(expected);
    });

    it('Cloudinary алдаа буцаавал 502', async () => {
      sandbox.replace(config, 'cloudinary', {
        cloudName: 'demo',
        apiKey: 'k',
        apiSecret: 's',
        folder: 'iveel/popups',
        enabled: true,
      });
      sandbox
        .stub(global, 'fetch')
        .resolves(
          new Response(JSON.stringify({ error: { message: 'Invalid Signature' } }), { status: 401 })
        );
      const admin = await createUserWithToken({ role: ROLES.ADMIN });

      const res = await chai
        .request(app)
        .post(`${UPLOADS}/notification-image`)
        .set('Authorization', `Bearer ${admin.token}`)
        .attach('image', TINY_PNG, 'popup.png');

      expect(res.status).to.equal(502);
    });

    it('Ажилтан upload хийж чадахгүй (Админ/Менежер л)', async () => {
      const staff = await createUserWithToken({ role: ROLES.STAFF });

      const res = await chai
        .request(app)
        .post(`${UPLOADS}/notification-image`)
        .set('Authorization', `Bearer ${staff.token}`)
        .attach('image', TINY_PNG, 'popup.png');

      expect(res.status).to.equal(403);
    });
  });

  describe('Зурагтай зарлал → popup', () => {
    async function send(payload, role = ROLES.ADMIN) {
      const user = await createUserWithToken({ role });
      const res = await chai
        .request(app)
        .post(NOTIFICATIONS)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ title: 'Ачаа буулаа', body: '10/30 хүртэлх ачаа', ...payload });
      return { res, token: user.token };
    }

    async function publicPopup() {
      const res = await chai.request(app).get(`${PUBLIC}/content`);
      return res.body.data.home_popup;
    }

    it('зарлал байхгүй бол popup null', async () => {
      expect(await publicPopup()).to.equal(null);
    });

    it('showAsPopup зарлал вэбийн popup болж, зочны жагсаалтад зурагтай гарна', async () => {
      const { res } = await send({
        imageUrl: IMAGE_URL,
        linkUrl: 'https://iweeltcargo.com/track',
        linkText: 'Ачаа шалгах',
        showAsPopup: true,
      });
      expect(res.status, JSON.stringify(res.body)).to.equal(201);

      expect(await publicPopup()).to.deep.equal({
        id: res.body.data.id,
        imageUrl: IMAGE_URL,
        title: 'Ачаа буулаа',
        body: '10/30 хүртэлх ачаа',
        linkUrl: 'https://iweeltcargo.com/track',
        linkText: 'Ачаа шалгах',
      });

      const list = await chai.request(app).get(`${PUBLIC}/notifications`);
      expect(list.body.data[0].imageUrl).to.equal(IMAGE_URL);
      expect(list.body.data[0]).to.not.have.property('createdBy');
      expect(list.body.data[0]).to.not.have.property('showAsPopup');
    });

    it('popup сонгоогүй зарлал popup болохгүй', async () => {
      await send({ imageUrl: IMAGE_URL, showAsPopup: false });
      expect(await publicPopup()).to.equal(null);
    });

    it('хэд хэдэн идэвхтэй бол хамгийн сүүлийнх нь гарна', async () => {
      await send({ imageUrl: IMAGE_URL, showAsPopup: true, title: 'Хуучин' });
      await send({ imageUrl: `${IMAGE_URL}?v=2`, showAsPopup: true, title: 'Шинэ' });
      expect((await publicPopup()).title).to.equal('Шинэ');
    });

    it('Менежер ч зурагтай popup зарлал илгээнэ (BR-36)', async () => {
      const { res } = await send({ imageUrl: IMAGE_URL, showAsPopup: true }, ROLES.MANAGER);
      expect(res.status).to.equal(201);
    });

    it('popup-аар харуулахад зураг заавал', async () => {
      const { res } = await send({ showAsPopup: true });
      expect(res.status).to.equal(400);
    });

    it('javascript: холбоос, http зургийн URL татгалзана', async () => {
      expect(
        (await send({ imageUrl: IMAGE_URL, linkUrl: 'javascript:alert(1)' })).res.status
      ).to.equal(400);
      expect((await send({ imageUrl: 'http://example.com/a.png' })).res.status).to.equal(400);
    });

    it('зогсоосон зарлал popup, зочны жагсаалтаас алга болж, audit бичигдэнэ', async () => {
      const { res, token } = await send({ imageUrl: IMAGE_URL, showAsPopup: true });
      const id = res.body.data.id;

      const stop = await chai
        .request(app)
        .post(`${NOTIFICATIONS}/${id}/expire`)
        .set('Authorization', `Bearer ${token}`);
      expect(stop.status, JSON.stringify(stop.body)).to.equal(200);

      expect(await publicPopup()).to.equal(null);
      const list = await chai.request(app).get(`${PUBLIC}/notifications`);
      expect(list.body.data.map(n => n.id)).to.not.include(id);
      expect(await AuditLog.countDocuments({ action: AUDIT_ACTION.NOTIFICATION_EXPIRE })).to.equal(
        1
      );
    });

    it('Ажилтан зарлал зогсоож чадахгүй', async () => {
      const { res } = await send({ imageUrl: IMAGE_URL, showAsPopup: true });
      const staff = await createUserWithToken({ role: ROLES.STAFF });

      const stop = await chai
        .request(app)
        .post(`${NOTIFICATIONS}/${res.body.data.id}/expire`)
        .set('Authorization', `Bearer ${staff.token}`);
      expect(stop.status).to.equal(403);
    });
  });
});
