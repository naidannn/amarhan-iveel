'use strict';

const path = require('path');
const fs = require('fs');
const chai = require('chai');
const chaiHttp = require('chai-http');
const { expect } = chai;

const { app } = require('../../src/services/express');
const { createUserWithToken } = require('../factories/user.factory');
const { ROLES } = require('../../src/config/constants');

chai.use(chaiHttp);

const UPLOADS = '/api/v1/uploads';
const GUIDES_DIR = path.join(__dirname, '../../uploads/guides');

// 1x1 PNG (gif89a-style tiny binary фикстур шаардлагагүй)
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

/**
 * Зурган файл upload — хаяг холбох зааврын thumbnail/блок (roadmap 5.10 өргөтгөл).
 * `middlewares/upload.js` файлыг ЖИНХЭНЭ ДИСК рүү бичдэг тул тест бүрийн дараа
 * үүсгэсэн файлаа устгана — `uploads/` repogoos gitignore-логдсон ч тестийн
 * явцад хуримтлагдахаас сэргийлнэ.
 */
describe('Зураг upload (POST /uploads/images)', () => {
  const createdFiles = [];

  afterEach(() => {
    for (const file of createdFiles.splice(0)) {
      fs.rmSync(path.join(GUIDES_DIR, file), { force: true });
    }
  });

  function trackFromUrl(url) {
    createdFiles.push(path.basename(url));
  }

  it('Админ зураг upload хийж, харьцангуй зам буцаана', async () => {
    const admin = await createUserWithToken({ role: ROLES.ADMIN });

    const res = await chai
      .request(app)
      .post(`${UPLOADS}/images`)
      .set('Authorization', `Bearer ${admin.token}`)
      .attach('image', TINY_PNG, 'thumb.png');

    expect(res.status, JSON.stringify(res.body)).to.equal(201);
    expect(res.body.data.url).to.match(/^\/uploads\/guides\/.+\.png$/);
    trackFromUrl(res.body.data.url);
    expect(fs.existsSync(path.join(GUIDES_DIR, path.basename(res.body.data.url)))).to.equal(true);
  });

  it('зурган БИШ файл татгалзана', async () => {
    const admin = await createUserWithToken({ role: ROLES.ADMIN });

    const res = await chai
      .request(app)
      .post(`${UPLOADS}/images`)
      .set('Authorization', `Bearer ${admin.token}`)
      .attach('image', Buffer.from('text файл'), 'notes.txt');

    expect(res.status).to.equal(400);
  });

  it('Ажилтан upload хийж чадахгүй (§9.1, зөвхөн Админ)', async () => {
    const staff = await createUserWithToken({ role: ROLES.STAFF });

    const res = await chai
      .request(app)
      .post(`${UPLOADS}/images`)
      .set('Authorization', `Bearer ${staff.token}`)
      .attach('image', TINY_PNG, 'thumb.png');

    expect(res.status).to.equal(403);
  });

  it('нэвтрэхгүйгээр upload хийж чадахгүй', async () => {
    const res = await chai.request(app).post(`${UPLOADS}/images`).attach('image', TINY_PNG, 'thumb.png');

    expect(res.status).to.equal(401);
  });
});
