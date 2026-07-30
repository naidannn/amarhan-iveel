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

/**
 * Ивээл Карго одоогоор ГАНЦ салбартай.
 *
 * Салбарын код нь байршлын кодын эхний хэсэг болно (`UB`-02-B-15), мөн
 * `resolveBranch()` идэвхтэй салбар яг нэг байхад автоматаар сонгоно —
 * ажилтан салбар сонгох шаардлагагүй.
 *
 * ЯАГААД ЭРЭЭН БИШ: ачааг Эрээнд систем дээр бүртгэдэггүй — Монголд ирсний
 * ДАРАА агуулахад бүртгэнэ (§1.1). Тиймээс байршлын код Монгол дахь агуулахыг
 * заана. Эрээний хүлээн авах хаяг нь зөвхөн хэрэглэгчид ХАРУУЛАХ текст
 * мэдээлэл (§3) — салбарын бүртгэлтэй хамааралгүй.
 *
 * ⚠ ТОДРУУЛГА ХЭРЭГТЭЙ: `UB` / "Улаанбаатар агуулах" нь түр утга. Бодит
 * агуулахын код, нэр, хаягийг эзэмшигчээс баталгаажуулна. Кодыг өөрчлөхөд
 * БҮХ байршлын код хамт өөрчлөгдөнө — өгөгдөл ороогүй байхад л хямд.
 *
 * Ирээдүйд салбар нэмэхэд: энд мөр нэмээд seed ажиллуулна. Тэр үеэс API
 * `branchId`-г тодорхой заахыг шаардаж эхэлнэ (§8).
 */
const BRANCHES = [
  {
    code: 'UB',
    name: 'Улаанбаатар агуулах',
    country: 'Монгол',
    address: null,
    phone: null,
  },
];

/**
 * Ивээл Каргогийн БОДИТ тариф (2026-07 байдлаар).
 *
 *   1–100 гр ..................... 800₮
 *   101–500 гр ................... 1,500₮
 *   501 гр – 1 кг ................ 2,000₮
 *   Гутал / нугалж жижиглэх боломжгүй ачаа ... 1 кг тутамд 2,500₮
 *   1 м³ ......................... 400,000₮
 *
 * ⚠ ТОДРУУЛГА ХЭРЭГТЭЙ: энгийн ачаа 1 кг-аас хүнд бол ямар үнэтэй вэ гэдэг
 * тодорхойгүй. Түр `pricePerKgAbove: 2000` (1 кг-ийн үнийг үргэлжлүүлэв) гэж
 * тавьсан — бодит утгыг баталгаажуулна уу.
 */
const CARGO_TYPES = [
  {
    code: 'standard',
    name: 'Энгийн ачаа',
    description: 'Жингийн шатлалаар тооцогдох энгийн ачаа',
    weightBrackets: [
      { maxGrams: 100, price: 800 },
      { maxGrams: 500, price: 1500 },
      { maxGrams: 1000, price: 2000 },
    ],
    pricePerKgAbove: 2000, // ⚠ баталгаажуулах шаардлагатай
    pricePerM3: 400000,
    minimumCharge: 0, // хамгийн бага шатлал (800₮) өөрөө доод хэмжээ болно
  },
  {
    code: 'bulky',
    name: 'Гутал / нугалахгүй ачаа',
    description: 'Хайрцагтай гутал болон нугалж жижиглэх боломжгүй ачаа',
    // Шатлалгүй — эхнээсээ кг тутмаар тооцогдоно
    weightBrackets: [],
    pricePerKgAbove: 2500,
    pricePerM3: 400000,
    minimumCharge: 0,
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
  for (const {
    weightBrackets,
    pricePerKgAbove,
    pricePerM3,
    minimumCharge,
    ...typeData
  } of CARGO_TYPES) {
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
      console.log('    тариф аль хэдийн тохируулагдсан — хэвээр үлдээв');
      continue;
    }

    await TariffVersion.create({
      cargoTypeId: cargoType._id,
      weightBrackets,
      pricePerKgAbove,
      pricePerM3,
      minimumCharge,
      effectiveFrom: new Date(),
      note: 'seed-reference-data.js — бодит тариф (2026-07)',
    });

    for (const b of weightBrackets) {
      console.log(`    ≤${b.maxGrams}гр: ${b.price.toLocaleString()}₮`);
    }
    console.log(`    1кг-аас дээш: ${pricePerKgAbove.toLocaleString()}₮/кг`);
    console.log(`    эзлэхүүн: ${pricePerM3.toLocaleString()}₮/м³`);
  }

  console.log('\n⚠ Энгийн ачаа 1кг-аас хүнд үед 2,000₮/кг гэж түр тавьсан — баталгаажуулна уу.');
  console.log('  Байршил үүсгэх: npm run seed:locations -- --branch UB --rooms 3 --shelves 5\n');

  await mongoose.connection.close();
}

seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Seed амжилтгүй:', err.message);
    process.exit(1);
  });
