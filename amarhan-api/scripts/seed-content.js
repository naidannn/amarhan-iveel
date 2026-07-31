'use strict';

/**
 * Phase 5 — нээлттэй хуудсанд (§3, /track) харагдах агуулгыг seed-лэнэ:
 * холбоо барих мэдээлэл, Эрээн дэх хүлээн авах хаяг.
 *
 * ИДЕМПОТЕНТ: `Setting` бичлэг аль хэдийн байвал дарж бичихгүй — Админ
 * вэбээс (roadmap 5.10) хийсэн засварыг устгахгүй.
 *
 * Хэрэглээ:
 *   npm run seed:content
 */

require('dotenv').config();

process.env.PORT = process.env.PORT || '4000';
process.env.APP_SECRET = process.env.APP_SECRET || 'seed-script';

const mongoose = require('mongoose');
const config = require('../src/config');
const Setting = require('../src/models/setting.model');
const { SETTING_KEY } = require('../src/config/constants');

const SETTINGS = [
  {
    key: SETTING_KEY.CONTENT_CONTACT,
    description: 'Холбоо барих мэдээлэл — нээлттэй хуудсанд харагдана (§3)',
    value: {
      phone: '90201407',
      email: '',
      address:
        'Толгойтын эцсээс нефт уруудах зам дагуу "Шинэ толгойт" хороололын үйлчилгээний төвд байрлаж байна.',
      workingHours:
        'Даваа - Баасан 10:00-20:00\nБямба 12:00 - 18:00\nҮдийн цай 13:00 - 14:00\nНям гарагт амрана.',
      facebook: 'https://www.facebook.com/Iweeltcargo',
      website: 'www.iweeltcargo.com',
      googleMapsUrl: 'https://maps.app.goo.gl/Doty7kDq2HBLNh8XA',
    },
  },
  {
    key: SETTING_KEY.CONTENT_ERENHOT_ADDRESS,
    description: 'Эрээн дэх хүлээн авах хаяг — зөвхөн ХАРУУЛАХ текст (§3, §1.1)',
    // ⚠ Харилцагч тус бүр "Таны нэр" / "таны утас" хэсгийг өөрийн нэр, утсаар
    // солиод Хятадын дэлгүүрт яг ийм байдлаар хуулж бичнэ — эзэмшигчийн өгсөн
    // жишээг үг үсгээр нь хадгалав.
    value: {
      receiverName: 'Таны нэр',
      phone: '15248363307',
      addressCn: '内蒙古自治区锡林郭勒盟二连浩特市 内蒙古锡林郭勒盟二连浩特市肯特小区3号楼',
      addressMn: '',
      note: 'Хаягийн ард өөрийн нэр, утасны дугаараа бичээд адагт нь IWEELTCARGO гэж заавал бичнэ үү.',
    },
  },
];

async function seed() {
  await mongoose.connect(config.mongo.uri);
  console.log('MongoDB-д холбогдлоо\n');

  console.log('── Нээлттэй агуулга ──');
  for (const { key, description, value } of SETTINGS) {
    const existing = await Setting.findOne({ key });
    if (existing) {
      console.log(`  ${key} — аль хэдийн байна, алгаслаа (Админ вэбээс засварласан байж болно)`);
      continue;
    }

    await Setting.create({ key, value, description });
    console.log(`  ${key} — үүслээ`);
  }

  console.log('');
  await mongoose.connection.close();
}

seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Seed амжилтгүй:', err.message);
    process.exit(1);
  });
