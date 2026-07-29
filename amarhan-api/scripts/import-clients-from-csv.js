'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mongoose = require('mongoose');
require('dotenv').config();

const Client = require('../src/models/client.model');
const User = require('../src/models/user.model');
const Service = require('../src/models/service.model');

const CSV_PATH = path.resolve(process.cwd(), '../clients.csv');

function parseAmount(value) {
  if (!value) return undefined;
  const normalized = String(value).replace(/[,\s]/g, '');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : undefined;
}

function parseDate(value) {
  if (!value) return undefined;
  // Accept formats like 2025/01/10 or 2025-01-10
  const replaced = String(value).trim().replace(/\./g, '-').replace(/\//g, '-');
  const d = new Date(replaced);
  return isNaN(d.getTime()) ? undefined : d;
}

function normalizePhone(value) {
  if (!value) return undefined;
  return String(value).replace(/[^0-9+]/g, '');
}

async function ensureManager() {
  // Prefer existing manager
  let manager = await User.findOne({ role: { $in: ['manager', 'senior_manager', 'admin'] } });
  if (manager) return manager;

  // Fallback: create a default manager
  manager = new User({
    email: 'manager@gks.mn',
    password: 'manager123',
    firstname: 'Менежер',
    lastname: 'Импорт',
    role: 'manager',
  });
  await manager.save();
  return manager;
}

async function ensureService() {
  let service = await Service.findOne({ status: 'active' });
  if (service) return service;
  service = new Service({
    name: 'Imported Default Service',
    nameInMongolian: 'Импортын үйлчилгээ',
    description: 'Auto-created for CSV import',
    serviceType: 'language_preparation',
    status: 'active',
  });
  await service.save();
  return service;
}

async function run() {
  const mongoUri = process.env.MONGOURI || 'mongodb://localhost:27017/monkor';
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });

  const manager = await ensureManager();
  const service = await ensureService();

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found at ${CSV_PATH}`);
    process.exit(1);
  }

  const fileStream = fs.createReadStream(CSV_PATH);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let lineIndex = 0;
  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for await (const line of rl) {
    lineIndex += 1;
    // Skip header and empty lines
    if (lineIndex === 1) continue;
    if (!line || !line.trim()) continue;

    // Split CSV line, handling simple quoted commas
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cells.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current);

    // Expected columns per clients.csv header
    // #,Lastname,Firstname,Phone number,phone number optional,Сургууль,Голч дүн,Contract date,notes,profession,contract_payment ,email 
    const [
      idx,
      lastName,
      firstName,
      phone,
      additionalPhone,
      school,
      gradePoint,
      contractDate,
      notes,
      profession,
      contractPayment,
      email,
    ] = cells.map(v => (v || '').trim().replace(/^"|"$/g, ''));

    // Skip if row has no name and no phone
    if (!firstName && !lastName && !phone) { skipped += 1; continue; }

    const clientData = {
      firstName: firstName || 'N/A',
      lastName: lastName || 'N/A',
      phone: normalizePhone(phone) || '00000000',
      additionalPhone: normalizePhone(additionalPhone),
      email: email && /@/.test(email) ? email.toLowerCase() : 'a@a.com',
      // CSV doesn't include birth date; set to adult age to avoid guardian requirement
      birthDate: new Date('1990-01-01'),
      graduatedSchool: school || undefined,
      gradePoint: parseFloat(String(gradePoint).replace(',', '.')) || undefined,
      notes: notes ? [{ content: `${notes}${profession ? ` | ${profession}` : ''}`, addedBy: manager._id, addedAt: new Date() }] : [],
      assignedManager: manager._id,
      // Respect contract date from CSV if provided
      contractDate: parseDate(contractDate) || undefined,
      conversionDetails: {
        service: service._id,
        notes: 'Imported from CSV',
        convertedBy: manager._id,
      },
      selectedSchools: [],
    };

    try {
      const client = new Client(clientData);
      // Override auto-generated initial payment amount if contractPayment present
      const amount = parseAmount(contractPayment);
      if (amount) {
        await client.validate();
        await client.constructor.init();
        // Save first to trigger pre-save invoice creation, then adjust
        await client.save();
        if (client.payments && client.payments.length > 0) {
          client.payments[0].amount = amount;
          await client.save();
        }
      } else {
        await client.save();
      }
      inserted += 1;
    } catch (err) {
      console.error(`Failed at line ${lineIndex}:`, err.message);
      failed += 1;
    }
  }

  console.log(`Import finished. Inserted: ${inserted}, Skipped: ${skipped}, Failed: ${failed}`);
  await mongoose.disconnect();
}

run().catch(async (e) => {
  console.error('Fatal error:', e);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});


