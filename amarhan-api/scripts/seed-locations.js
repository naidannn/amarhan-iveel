'use strict';

/**
 * Агуулахын байршлыг bulk үүсгэнэ — introduction.md §8 (roadmap 1.4).
 *
 * ИДЕМПОТЕНТ: байгаа кодыг алгасана.
 *
 * Хэрэглээ:
 *   npm run seed:locations -- --branch ER --rooms 3 --shelves 5 --rows 4 --cells 6
 *
 * Утга:
 *   --branch   салбарын код (заавал)
 *   --rooms    өрөөний тоо (1-ээс эхэлж дугаарлана)
 *   --shelves  өрөө бүрийн тавиурын тоо (A, B, C ... хэлбэрээр)
 *   --rows     тавиур бүрийн мөрийн тоо (1–9)
 *   --cells    мөр бүрийн нүдний тоо (1–9)
 *   --capacity нүд бүрийн ачааны дээд тоо (сонголтоор)
 */

require('dotenv').config();

process.env.PORT = process.env.PORT || '4000';
process.env.APP_SECRET = process.env.APP_SECRET || 'seed-script';

const mongoose = require('mongoose');
const config = require('../src/config');
const Branch = require('../src/models/branch.model');
const WarehouseLocation = require('../src/models/warehouse-location.model');
const { generateShelfCodes } = require('../src/domain/location-code');

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || idx === process.argv.length - 1) return fallback;
  return process.argv[idx + 1];
}

const branchCode = arg('branch');
const rooms = Number(arg('rooms', 1));
const shelves = Number(arg('shelves', 1));
const rows = Number(arg('rows', 4));
const cells = Number(arg('cells', 6));
const capacityCount = arg('capacity') ? Number(arg('capacity')) : null;

const SHELF_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

async function seed() {
  if (!branchCode) {
    throw new Error('--branch заавал шаардлагатай. Жишээ: --branch ER');
  }
  if (shelves > SHELF_LETTERS.length) {
    throw new Error(`Тавиурын тоо ${SHELF_LETTERS.length}-аас их байж болохгүй`);
  }

  await mongoose.connect(config.mongo.uri);

  const branch = await Branch.findOne({ code: branchCode.toUpperCase() });
  if (!branch) {
    throw new Error(
      `"${branchCode}" салбар олдсонгүй. Эхлээд npm run seed:reference ажиллуулна уу`
    );
  }

  console.log(`\n${branch.code} — ${branch.name}`);
  console.log(`Өрөө ${rooms} × Тавиур ${shelves} × Мөр ${rows} × Нүд ${cells}`);
  console.log(`Нийт үүсэх нүд: ${rooms * shelves * rows * cells}\n`);

  let created = 0;
  let skipped = 0;

  for (let room = 1; room <= rooms; room += 1) {
    for (let s = 0; s < shelves; s += 1) {
      const shelf = SHELF_LETTERS[s];
      const generated = generateShelfCodes({ branch: branch.code, room, shelf, rows, cells });

      const existing = new Set(
        (
          await WarehouseLocation.find({ code: { $in: generated.map(g => g.code) } }).select('code')
        ).map(d => d.code)
      );

      const toCreate = generated
        .filter(g => !existing.has(g.code))
        .map(g => ({
          code: g.code,
          branchId: branch._id,
          branchCode: branch.code,
          room: g.room,
          shelf: g.shelf,
          row: g.row,
          cell: g.cell,
          capacityCount,
          capacityM3: null,
        }));

      if (toCreate.length > 0) {
        await WarehouseLocation.insertMany(toCreate);
      }

      created += toCreate.length;
      skipped += existing.size;

      console.log(
        `  Өрөө ${String(room).padStart(2, '0')} · Тавиур ${shelf}: ` +
          `${toCreate.length} үүсгэв, ${existing.size} алгаслаа`
      );
    }
  }

  console.log(`\nНийт: ${created} үүсгэв, ${skipped} аль хэдийн байсан.`);

  const total = await WarehouseLocation.countDocuments({ branchId: branch._id });
  console.log(`${branch.code} салбарын нийт байршил: ${total}\n`);

  await mongoose.connection.close();
}

seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Seed амжилтгүй:', err.message);
    process.exit(1);
  });
