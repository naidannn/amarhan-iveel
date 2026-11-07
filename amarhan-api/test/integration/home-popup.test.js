'use strict';

const crypto = require('crypto');
const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const { expect } = chai;

const { app } = require('../../src/services/express');
const config = require('../../src/config');
const { createUserWithToken } = require('../factories/user.factory');
const { ROLES, SETTING_KEY, ERROR_CODE } = require('../../src/config/constants');

chai.use(chaiHttp);

const UPLOADS = '/api/v1/uploads';
const SETTINGS = '/api/v1/settings';
const PUBLIC = '/api/v1/public';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

const IMAGE_URL = 'https://res.cloudinary.com/demo/image/upload/v1/iveel/popups/abc.png';

/**
 * Нүүрний popup зарлал — зураг Cloudinary-д (сервер дээр хадгалахгүй),
 * тохиргоо `content.home_popup`, зочинд `GET /public/content`-оор.
 */
describe('Нүүрний popup зарлал', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('POST /uploads/popup-image', () => {
    it('Cloudinary тохируулаагүй бол 503 + IMAGE_HOST_DISABLED', async () => {
      sandbox.replace(config, 'cloudinary', { folder: 'iveel/popups', enabled: false });
      const admin = await createUserWithToken({ role: ROLES.ADMIN });

      const res = await chai
        .request(app)
        .post(`${UPLOADS}/popup-image`)
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
      const fetchStub = sandbox
        .stub(global, 'fetch')
        .resolves(
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
        .post(`${UPLOADS}/popup-image`)
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
        .post(`${UPLOADS}/popup-image`)
        .set('Authorization', `Bearer ${admin.token}`)
        .attach('image', TINY_PNG, 'popup.png');

      expect(res.status).to.equal(502);
    });

    it('Ажилтан upload хийж чадахгүй (зөвхөн Админ)', async () => {
      const staff = await createUserWithToken({ role: ROLES.STAFF });

      const res = await chai
        .request(app)
        .post(`${UPLOADS}/popup-image`)
        .set('Authorization', `Bearer ${staff.token}`)
        .attach('image', TINY_PNG, 'popup.png');

      expect(res.status).to.equal(403);
    });
  });

  describe('content.home_popup тохиргоо', () => {
    async function savePopup(value) {
      const admin = await createUserWithToken({ role: ROLES.ADMIN });
      return chai
        .request(app)
        .put(`${SETTINGS}/${SETTING_KEY.CONTENT_HOME_POPUP}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ value });
    }

    async function publicPopup() {
      const res = await chai.request(app).get(`${PUBLIC}/content`);
      return res.body.data.home_popup;
    }

    it('анхдагчаар popup байхгүй (null)', async () => {
      expect(await publicPopup()).to.equal(null);
    });

    it('идэвхтэй popup зочинд харагдана', async () => {
      const res = await savePopup({
        enabled: true,
        imageUrl: IMAGE_URL,
        title: 'Ачаа буулаа',
        body: '10/30 хүртэлх ачаа',
        linkUrl: 'https://iweeltcargo.com/track',
        linkText: 'Ачаа шалгах',
      });
      expect(res.status, JSON.stringify(res.body)).to.equal(200);

      expect(await publicPopup()).to.deep.equal({
        imageUrl: IMAGE_URL,
        title: 'Ачаа буулаа',
        body: '10/30 хүртэлх ачаа',
        linkUrl: 'https://iweeltcargo.com/track',
        linkText: 'Ачаа шалгах',
      });
    });

    it('унтраасан popup зочинд ГАРАХГҮЙ', async () => {
      await savePopup({ enabled: false, imageUrl: IMAGE_URL });
      expect(await publicPopup()).to.equal(null);
    });

    it('хугацаа дууссан popup зочинд ГАРАХГҮЙ', async () => {
      await savePopup({ enabled: true, imageUrl: IMAGE_URL, endsAt: '2020-01-01T00:00:00Z' });
      expect(await publicPopup()).to.equal(null);
    });

    it('зураггүй popup татгалзана (зураг заавал)', async () => {
      const res = await savePopup({ enabled: true, title: 'Зөвхөн текст' });
      expect(res.status).to.equal(400);
    });

    it('javascript: холбоос татгалзана', async () => {
      const res = await savePopup({ imageUrl: IMAGE_URL, linkUrl: 'javascript:alert(1)' });
      expect(res.status).to.equal(400);
    });

    it('http (https биш) зургийн URL татгалзана', async () => {
      const res = await savePopup({ imageUrl: 'http://example.com/a.png' });
      expect(res.status).to.equal(400);
    });
  });
});
