'use strict';

const mongoose = require('mongoose');
const Service = require('../src/models/service.model');
const School = require('../src/models/school.model');
const config = require('../src/config');

// Connect to MongoDB using the same configuration as the application
mongoose.connect(config.mongo.uri || 'mongodb://localhost:27017/gks-database', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function checkDatabaseData() {
  try {
    console.log('Checking database data...');
    
    // Check services
    const serviceCount = await Service.countDocuments();
    console.log(`Services in database: ${serviceCount}`);
    
    if (serviceCount > 0) {
      const services = await Service.find({}).select('name serviceType');
      console.log('Services found:');
      services.forEach(service => {
        console.log(`- ${service.name} (${service.serviceType})`);
      });
    }
    
    // Check schools
    const schoolCount = await School.countDocuments();
    console.log(`\nSchools in database: ${schoolCount}`);
    
    if (schoolCount > 0) {
      const schools = await School.find({}).select('name nameInKorean schoolType isPartner');
      console.log('Schools found:');
      schools.forEach(school => {
        console.log(`- ${school.name} (${school.nameInKorean}) - ${school.schoolType} - Partner: ${school.isPartner ? 'Yes' : 'No'}`);
      });
    }
    
    if (serviceCount === 0 && schoolCount === 0) {
      console.log('\n❌ No data found in database! The seed scripts may not be saving data properly.');
    } else {
      console.log('\n✅ Data found in database!');
    }
    
  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from database');
  }
}

checkDatabaseData();
