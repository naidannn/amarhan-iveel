'use strict';

/**
 * Phase 1 — лавлах өгөгдлийг үүсгэнэ: салбар, ачааны төрөл + тариф.
 *
 * ИДЕМПОТЕНТ: дахин ажиллуулахад давхардал үүсгэхгүй, байгаа өгөгдлийг
 * дарж бичихгүй (тариф өөрчлөгдсөн байж болно).
 *
 * ⚠ ТАРИФЫН ТООН УТГА нь ЖИШЭЭ юм — бодит утгыг бизнесээс авч, админ
 * хэсгээс эсвэл ENV-ээр оруулна уу (roadmap.md Q1).
 *
 * Хэрэглээ:
 *   npm run seed:reference
 */

require('dotenv').config();

process.env.PORT = process.env.PORT || '4000';
process.env.APP_SECRET = process.env.APP_SECRET || 'seed-script';

const mongoose = require('mongoose');
const config = require('../src/config');
const Branch = require('../src/models/branch.model');
const CargoType = require('../src/models/cargo-type.model');
const TariffVersion = require('../src/models/tariff-version.model');

const BRANCHES = [
  {
    code: 'ER',
    name: 'Эрээн салбар',
    country: 'Хятад',
    address: null,
    phone: null,
  },
  {
    code: 'UB',
    name: 'Улаанбаатар салбар',
    country: 'Монгол',
    address: null,
    phone: null,
  },
];

// ⚠ Жишээ тариф — бодит утгаар солино уу
const CARGO_TYPES = [
  {
    code: 'standard',
    name: 'Энгийн ачаа',
    description: 'Тусгай нөхцөл шаардахгүй энгийн ачаа',
    pricePerKg: 4000,
    pricePerM3: 350000,
    minimumCharge: 5000,
  },
  {
    code: 'fragile',
    name: 'Хэврэг ачаа',
    description: 'Болгоомжтой харьцах шаардлагатай ачаа',
    pricePerKg: 6000,
    pricePerM3: 450000,
    minimumCharge: 10000,
  },
  {
    code: 'oversized',
    name: 'Том оврын ачаа',
    description: 'Хэмжээ томтой, тусгай тээвэрлэлт шаардах ачаа',
    pricePerKg: 5000,
    pricePerM3: 300000,
    minimumCharge: 20000,
  },
];

async function seed() {
  await mongoose.connect(config.mongo.uri);
  console.log('MongoDB-д холбогдлоо\n');

  console.log('── Салбар ──');
  for (const data of BRANCHES) {
    const existing = await Branch.findOne({ code: data.code });
    if (existing) {
      console.log(`  ${data.code} — аль хэдийн байна, алгаслаа`);
      continue;
    }
    await Branch.create(data);
    console.log(`  ${data.code} — ${data.name} үүслээ`);
  }

  console.log('\n── Ачааны төрөл ба тариф ──');
  for (const { pricePerKg, pricePerM3, minimumCharge, ...typeData } of CARGO_TYPES) {
    let cargoType = await CargoType.findOne({ code: typeData.code });

    if (!cargoType) {
      cargoType = await CargoType.create(typeData);
      console.log(`  ${typeData.code} — ${typeData.name} үүслээ`);
    } else {
      console.log(`  ${typeData.code} — аль хэдийн байна`);
    }

    const activeTariff = await TariffVersion.findOne({
      cargoTypeId: cargoType._id,
      effectiveTo: null,
    });

    if (activeTariff) {
      console.log(
        `    тариф аль хэдийн тохируулагдсан (${activeTariff.pricePerKg}₮/кг) — хэвээр үлдээв`
      );
      continue;
    }

    await TariffVersion.create({
      cargoTypeId: cargoType._id,
      pricePerKg,
      pricePerM3,
      minimumCharge,
      effectiveFrom: new Date(),
      note: 'seed-reference-data.js — ЖИШЭЭ утга, бодит тарифаар солино уу',
    });
    console.log(`    тариф: ${pricePerKg}₮/кг · ${pricePerM3}₮/м³ · доод ${minimumCharge}₮`);
  }

  console.log('\n⚠ Тарифын тоон утга нь ЖИШЭЭ. Бодит үнээр солихоо мартуузай.');
  console.log('  Байршил үүсгэх: npm run seed:locations -- --branch ER --rooms 3 --shelves 5\n');

  await mongoose.connection.close();
}

seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Seed амжилтгүй:', err.message);
    process.exit(1);
  });
