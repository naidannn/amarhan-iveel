const mongoose = require('mongoose');
const User = require('../src/models/user.model');
require('dotenv').config();

const demoUsers = [
  {
    email: 'kh.naidan@gmail.com',
    password: 'Naida123456',
    firstName: 'Админ',
    lastName: 'Хэрэглэгч',
    role: 'admin'
  },
  {
    email: 'manager@gks.mn',
    password: 'manager123',
    firstName: 'Менежер',
    lastName: 'Хэрэглэгч',
    role: 'manager'
  },
  {
    email: 'senior@gks.mn',
    password: 'senior123',
    firstName: 'Ахлах',
    lastName: 'Менежер',
    role: 'senior_manager'
  }
];

async function createDemoUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGOURI || 'mongodb://localhost:27017/monkor');
    console.log('Connected to MongoDB');

    // Clear existing demo users
    await User.deleteMany({ email: { $in: demoUsers.map(u => u.email) } });
    console.log('Cleared existing demo users');

    // Create new demo users
    for (const userData of demoUsers) {
      const user = new User(userData);
      await user.save();
      console.log(`Created user: ${userData.email}`);
    }

    console.log('Demo users created successfully!');
    console.log('\nDemo credentials:');
    console.log('Admin: admin@gks.mn / REDACTED_PASSWORD');
    console.log('Manager: manager@gks.mn / manager123');
    console.log('Senior Manager: senior@gks.mn / senior123');

  } catch (error) {
    console.error('Error creating demo users:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createDemoUsers();
