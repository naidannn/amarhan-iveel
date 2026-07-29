'use strict';

/**
 * Хамгийн эхний Админ хэрэглэгчийг үүсгэнэ.
 *
 * Нээлттэй /auth/register хаагдсан тул (эрх өөрөө өсгөх нүх байсан) системд орох
 * анхны хаалга нь энэ скрипт. Үүний дараа бусад ажилтныг Админ өөрөө
 * POST /api/v1/users-ээр үүсгэнэ (introduction.md §9.1).
 *
 * Хэрэглээ:
 *   ADMIN_EMAIL=admin@iveel.mn ADMIN_PASSWORD='<хүчтэй нууц үг>' npm run seed:admin
 *
 * ADMIN_PASSWORD өгөөгүй бол санамсаргүй нууц үг үүсгэж НЭГ УДАА хэвлэнэ.
 */

require('dotenv').config();

// Seed скрипт нь серверийг эхлүүлэхгүй тул config-ийн заавал шаардлагатай
// хувьсагчийг түр нөхнө.
process.env.PORT = process.env.PORT || '4000';
process.env.APP_SECRET = process.env.APP_SECRET || 'seed-script';

const crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('../src/config');
const User = require('../src/models/user.model');
const { ROLES } = require('../src/config/constants');

const email = process.env.ADMIN_EMAIL || 'admin@iveel.mn';
const isGenerated = !process.env.ADMIN_PASSWORD;
const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');

async function seed() {
  try {
    if (password.length < 8) {
      throw new Error('ADMIN_PASSWORD хамгийн багадаа 8 тэмдэгт байх ёстой');
    }

    await mongoose.connect(config.mongo.uri);
    console.log('MongoDB-д холбогдлоо');

    const existing = await User.findOne({ email });
    if (existing) {
      console.log(`Админ аль хэдийн байна: ${email} (нууц үг өөрчлөгдөөгүй)`);
    } else {
      await User.create({
        email,
        password,
        firstname: 'Админ',
        lastname: 'Хэрэглэгч',
        role: ROLES.ADMIN,
        status: 'active',
      });

      console.log(`\nАдмин үүслээ: ${email}`);
      if (isGenerated) {
        console.log(`Нууц үг: ${password}`);
        console.log('\nЭнэ нууц үг дахин харагдахгүй. Одоо хадгалж, эхний нэвтрэлтийн');
        console.log('дараа /auth/change-password-оор солино уу.\n');
      }
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Seed амжилтгүй:', err.message);
    process.exit(1);
  }
}

seed();
