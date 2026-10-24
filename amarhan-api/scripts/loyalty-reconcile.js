'use strict';

/**
 * Урамшууллын кредитийг эх сурвалжаас нөхөж тэнцүүлнэ (§4, BR-30).
 *
 * Хэзээ ажиллуулах:
 *   - `Кредитийн reconcile амжилтгүй` ERROR лог гарсан бол (төлбөр бичигдсэн
 *     ч кредит олгогдоогүй үлдсэн);
 *   - урамшуулал асаахаас ӨМНӨ төлөгдсөн ачаанд кредит олгох шийдвэр гарвал
 *     (`--backfill`);
 *   - шөнийн cron (идемпотент — зөрүүгүй бол юу ч бичихгүй).
 *
 * Хоёр алхам:
 *   1. Кредиттэй холбоотой ачаа бүрийг `reconcilePackage`-ээр тэнцүүлнэ.
 *      Анхдагчаар ЗӨВХӨН ledger-т бичлэгтэй ачаа (буцаалт/нөхөлт); `--backfill`
 *      бол бүх `paymentStatus: paid` ачаа — өмнөх түүхэнд ч кредит олгоно.
 *   2. Харилцагч бүрийн `loyaltyPoints` кэшийг ledger-ээс дахин бодно.
 *
 * Хэрэглээ:
 *   node scripts/loyalty-reconcile.js
 *   node scripts/loyalty-reconcile.js --backfill
 */

require('dotenv').config();

process.env.PORT = process.env.PORT || '4000';
process.env.APP_SECRET = process.env.APP_SECRET || 'loyalty-script';

const mongoose = require('mongoose');
const config = require('../src/config');
const Package = require('../src/models/package.model');
const LoyaltyTransaction = require('../src/models/loyalty-transaction.model');
const loyaltyService = require('../src/services/loyalty.service');
const { PAYMENT_STATUS } = require('../src/config/constants');

const backfill = process.argv.includes('--backfill');

async function run() {
  await mongoose.connect(config.mongo.uri, config.mongoOptions);
  console.log('MongoDB-д холбогдлоо');

  const ledgerPackageIds = await LoyaltyTransaction.distinct('packageId', {
    packageId: { $type: 'objectId' },
  });
  const ids = new Set(ledgerPackageIds.map(String));

  if (backfill) {
    const cursor = Package.find({ paymentStatus: PAYMENT_STATUS.PAID, customerId: { $ne: null } })
      .select('_id')
      .cursor();
    for await (const pkg of cursor) ids.add(String(pkg._id));
  }

  let written = 0;
  for (const id of ids) {
    const rows = await loyaltyService.reconcilePackage(id);
    written += rows.length;
  }
  console.log(`Ачаа: ${ids.size} шалгав, ${written} ledger мөр бичигдэв`);

  const customerIds = await LoyaltyTransaction.distinct('customerId');
  for (const customerId of customerIds) {
    await loyaltyService.recomputeBalance(customerId);
  }
  console.log(`Харилцагч: ${customerIds.length} кэш дахин бодогдов`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
