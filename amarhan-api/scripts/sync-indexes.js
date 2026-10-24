'use strict';

/**
 * Схемд тодорхойлсон индексүүдийг DB-д үүсгэнэ.
 *
 * Апп эхлэхэд `autoIndex` (default асаалттай, `MONGO_AUTO_INDEX=false`-аар
 * унтарна) мөн адил үүсгэдэг. Өгөгдөл томрох үед апп эхлэх бүрд индекс
 * барихгүйн тулд `autoIndex`-ийг унтрааж, энэ скриптийг deploy-ийн үед
 * ажиллуулна.
 *
 * Байгаа индексийг ХЭЗЭЭ Ч устгахгүй (`syncIndexes` биш `createIndexes`):
 * схемээс хасагдсан индексийг зөвхөн ТАЙЛАГНАНА — хэрэггүй гэдгийг
 * `$indexStats`-аар шалгасны дараа гараар устгана.
 *
 * Хэрэглээ:
 *   npm run db:indexes            # дутуу индексийг үүсгэнэ
 *   npm run db:indexes -- --dry   # юу үүсэх/илүүдэхийг л харуулна
 */

require('dotenv').config();

process.env.PORT = process.env.PORT || '4000';
process.env.APP_SECRET = process.env.APP_SECRET || 'index-script';

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const config = require('../src/config');

const MODELS_DIR = path.join(__dirname, '../src/models');
const isDryRun = process.argv.includes('--dry');

async function run() {
  await mongoose.connect(config.mongo.uri, { ...config.mongoOptions, autoIndex: false });
  console.log('MongoDB-д холбогдлоо');

  for (const file of fs.readdirSync(MODELS_DIR).filter(f => f.endsWith('.model.js'))) {
    require(path.join(MODELS_DIR, file));
  }

  for (const name of mongoose.modelNames()) {
    const model = mongoose.model(name);
    const { toCreate, toDrop } = await model.diffIndexes();

    if (toCreate.length === 0 && toDrop.length === 0) continue;

    console.log(`\n${name} (${model.collection.collectionName})`);
    for (const spec of toCreate) console.log(`  + ${JSON.stringify(spec)}`);
    for (const indexName of toDrop) console.log(`  ? схемд байхгүй (устгаагүй): ${indexName}`);

    if (!isDryRun && toCreate.length > 0) {
      await model.createIndexes();
      console.log('  ✓ үүсгэлээ');
    }
  }

  console.log(isDryRun ? '\nDry run — өөрчлөлт хийгээгүй' : '\nДууслаа');
}

run()
  .catch(err => {
    console.error('Индекс үүсгэхэд алдаа гарлаа:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close());
