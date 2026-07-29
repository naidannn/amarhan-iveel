'use strict';

/**
 * Migration runner.
 *
 * `scripts/migrations/` доторх дугаарласан файлуудыг дарааллаар нь ажиллуулж,
 * гүйцэтгэсэн бүрийг `migrations` коллекцод тэмдэглэнэ. Нэг migration хоёр удаа
 * ажиллахгүй.
 *
 * Хэрэглээ:
 *   npm run migrate            # хүлээгдэж буй бүх migration-ыг ажиллуулна
 *   npm run migrate -- --dry   # юу ажиллахыг харуулна, өөрчлөлт хийхгүй
 */

require('dotenv').config();

process.env.PORT = process.env.PORT || '4000';
process.env.APP_SECRET = process.env.APP_SECRET || 'migration-script';

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const config = require('../src/config');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const isDryRun = process.argv.includes('--dry');

const migrationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    appliedAt: { type: Date, default: Date.now },
  },
  { collection: 'migrations' }
);
const Migration = mongoose.model('Migration', migrationSchema);

async function run() {
  try {
    await mongoose.connect(config.mongo.uri);
    console.log('MongoDB-д холбогдлоо');

    if (!fs.existsSync(MIGRATIONS_DIR)) {
      console.log('migrations хавтас алга — хийх зүйлгүй');
      await mongoose.connection.close();
      process.exit(0);
    }

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.js'))
      .sort();

    const applied = new Set((await Migration.find({}, 'name')).map(m => m.name));
    const pending = files.filter(f => !applied.has(f));

    if (pending.length === 0) {
      console.log('Хүлээгдэж буй migration алга — бүгд ажилласан байна');
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log(`\nХүлээгдэж буй ${pending.length} migration:`);
    pending.forEach(f => console.log(`  - ${f}`));

    if (isDryRun) {
      console.log('\n--dry горим: өөрчлөлт хийгээгүй');
      await mongoose.connection.close();
      process.exit(0);
    }

    for (const file of pending) {
      const migration = require(path.join(MIGRATIONS_DIR, file));
      console.log(`\n▶ ${file}`);
      await migration.up(mongoose.connection);
      await Migration.create({ name: file });
      console.log(`✓ ${file} дууслаа`);
    }

    console.log(`\nНийт ${pending.length} migration амжилттай.`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('\nMigration амжилтгүй:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

run();
