'use strict';

const Branch = require('../../src/models/branch.model');
const CargoType = require('../../src/models/cargo-type.model');
const TariffVersion = require('../../src/models/tariff-version.model');
const Customer = require('../../src/models/customer.model');
const WarehouseLocation = require('../../src/models/warehouse-location.model');

let counter = 0;
const BRANCH_CODES = ['ER', 'UB', 'DZ', 'KH', 'AR', 'BY', 'CH', 'GO'];

function nextCounter() {
  counter += 1;
  return counter;
}

async function createBranch(overrides = {}) {
  const n = nextCounter();
  return Branch.create({
    code: BRANCH_CODES[(n - 1) % BRANCH_CODES.length],
    name: `Тест салбар ${n}`,
    country: 'Монгол',
    ...overrides,
  });
}

async function createCargoTypeWithTariff(overrides = {}, tariffOverrides = {}) {
  const n = nextCounter();
  const cargoType = await CargoType.create({
    code: `type_${n}`,
    name: `Тест төрөл ${n}`,
    ...overrides,
  });

  const tariff = await TariffVersion.create({
    cargoTypeId: cargoType._id,
    pricePerKg: 5000,
    pricePerM3: 40000,
    minimumCharge: 5000,
    effectiveFrom: new Date(),
    ...tariffOverrides,
  });

  return { cargoType, tariff };
}

async function createCustomer(overrides = {}) {
  const n = nextCounter();
  // 8 оронтой, 9-өөр эхэлсэн давхцахгүй дугаар
  const phone = `9${String(1000000 + n).slice(0, 7)}`;
  return Customer.create({
    phone,
    name: `Тест харилцагч ${n}`,
    ...overrides,
  });
}

async function createLocation(branch, overrides = {}) {
  const n = nextCounter();
  const row = ((n - 1) % 9) + 1;
  const cell = ((n - 1) % 9) + 1;
  const code = `${branch.code}-01-A-${row}${cell}`;

  return WarehouseLocation.create({
    code,
    branchId: branch._id,
    branchCode: branch.code,
    room: '01',
    shelf: 'A',
    row,
    cell,
    ...overrides,
  });
}

module.exports = {
  createBranch,
  createCargoTypeWithTariff,
  createCustomer,
  createLocation,
};
