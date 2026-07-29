'use strict';

/**
 * Тестийн глобал тохиргоо (Mocha root hook plugin).
 *
 * Санах ойд ажиллах MongoDB-г REPLICA SET горимд эхлүүлнэ — транзакц шаардлагатай
 * (docs/testing.md §4). Бодит хөгжүүлэлтийн DB рүү тест хэзээ ч холбогдохгүй.
 *
 * `--require`-ээр ачаалагдсан файл `before()`-ыг шууд дуудаж чадахгүй тул
 * Mocha-ийн `mochaHooks` экспортын хэлбэрийг ашиглав.
 */

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '4001';
process.env.APP_SECRET = process.env.APP_SECRET || 'test-secret-do-not-use-in-production';

// src/config нь import хийгдэх үедээ MONGOURI шаарддаг бөгөөд тест файлууд
// beforeAll ажиллахаас ӨМНӨ ачаалагддаг. Тиймээс энд түр утга тавина —
// бодит холболтыг beforeAll доторх санах ойн MongoDB рүү хийнэ.
process.env.MONGOURI = process.env.MONGOURI || 'mongodb://127.0.0.1:27017/iveel-test-placeholder';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

chai.use(chaiAsPromised);

let replSet;

exports.mochaHooks = {
  async beforeAll() {
    // Анх ажиллуулахад mongod binary татагдана — удаж болно.
    this.timeout(180000);

    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });

    const uri = replSet.getUri();
    process.env.MONGOURI = uri;
    process.env.MONGOTESTURI = uri;

    await mongoose.connect(uri);
  },

  /**
   * Тест бүрийн дараа бүх коллекцыг цэвэрлэнэ — тестүүд хоорондоо нөлөөлөхгүй.
   * Индексийг устгахгүй (dropDatabase биш) — index-ээс хамаарсан зан төлөв
   * (жишээ: давхардлыг хориглох unique index) тест бүрт хүчинтэй хэвээр байна.
   */
  async afterEach() {
    const { collections } = mongoose.connection;
    await Promise.all(Object.values(collections).map(c => c.deleteMany({})));
  },

  async afterAll() {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  },
};
