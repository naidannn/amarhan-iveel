'use strict';

require('dotenv').config();

// Set required env vars if missing (for seed script)
process.env.PORT = process.env.PORT || '4000';
process.env.APP_SECRET = process.env.APP_SECRET || 'seed-script';

const mongoose = require('mongoose');
const config = require('../src/config');
const User = require('../src/models/user.model');

const ADMIN_USER = {
  email: 'admin@amarhan.mn',
  password: 'REDACTED_PASSWORD',
  firstname: 'Admin',
  lastname: 'User',
  role: 'admin',
  status: 'active',
};

async function seed() {
  try {
    await mongoose.connect(config.mongo.uri);
    console.log('Connected to MongoDB');

    const existing = await User.findOne({ email: ADMIN_USER.email });
    if (existing) {
      console.log(`Admin user already exists: ${ADMIN_USER.email}`);
    } else {
      await User.create(ADMIN_USER);
      console.log(`Admin user created: ${ADMIN_USER.email} / ${ADMIN_USER.password}`);
    }

    await mongoose.connection.close();
    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
