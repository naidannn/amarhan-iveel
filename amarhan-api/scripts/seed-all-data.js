'use strict';

const mongoose = require('mongoose');
const config = require('../src/config');
require('dotenv').config();

// Import all models
const User = require('../src/models/user.model');
const Employee = require('../src/models/hr/employee.model');
const Contract = require('../src/models/hr/contract.model');
const Payroll = require('../src/models/hr/payroll.model');
const Attendance = require('../src/models/hr/attendance.model');
const Leave = require('../src/models/hr/leave.model');
const InventoryCategory = require('../src/models/inventory/category.model');
const Supplier = require('../src/models/inventory/supplier.model');
const InventoryWarehouse = require('../src/models/inventory/warehouse.model');
const InventoryItem = require('../src/models/inventory/item.model');
const InventoryStock = require('../src/models/inventory/stock.model');
const Lead = require('../src/models/crm/lead.model');
const Customer = require('../src/models/crm/customer.model');
const Deal = require('../src/models/crm/deal.model');
const Activity = require('../src/models/crm/activity.model');
const Payment = require('../src/models/crm/payment.model');
const Project = require('../src/models/project.model');
const Task = require('../src/models/task.model');
const Invoice = require('../src/models/finance/invoice.model');
const Income = require('../src/models/finance/income.model');
const Expense = require('../src/models/finance/expense.model');

// Helper function to get random element from array
const randomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

async function seedAllData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongo.uri || process.env.MONGOURI || 'mongodb://localhost:27017/amarhan-saas', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✓ Connected to MongoDB');

    // Get or create admin user (company)
    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      adminUser = await User.findOne({ email: 'kh.naidan@gmail.com' });
    }
    if (!adminUser) {
      console.log('⚠ Admin user not found. Please create admin user first.');
      process.exit(1);
    }
    const companyId = adminUser._id;
    console.log(`✓ Using company: ${adminUser.email}`);

    // Get all users for assignments
    const users = await User.find({});
    if (users.length === 0) {
      console.log('⚠ No users found. Please create users first.');
      process.exit(1);
    }
    console.log(`✓ Found ${users.length} users`);

    // ============================================
    // 1. HR MODULE - Хүний нөөц
    // ============================================
    console.log('\n📋 Creating HR data...');

    // Clear existing HR data
    await Employee.deleteMany({});
    await Contract.deleteMany({});
    await Payroll.deleteMany({});
    await Attendance.deleteMany({});
    await Leave.deleteMany({});

    // Create Employees
    const departments = ['Борлуулалт', 'Маркетинг', 'Худалдаа', 'Санхүү', 'Хүний нөөц', 'Технологи'];
    const positions = {
      'Борлуулалт': ['Борлуулалтын менежер', 'Борлуулалтын төлөөлөгч', 'Борлуулалтын ахлах'],
      'Маркетинг': ['Маркетингийн менежер', 'Маркетингийн мэргэжилтэн', 'Контент бүтээгч'],
      'Худалдаа': ['Худалдааны менежер', 'Худалдааны төлөөлөгч'],
      'Санхүү': ['Санхүүгийн менежер', 'Нягтлан бодогч', 'Санхүүгийн шинжилгээч'],
      'Хүний нөөц': ['ХН-ийн менежер', 'ХН-ийн мэргэжилтэн'],
      'Технологи': ['Программист', 'Системийн админ', 'IT дэмжлэг']
    };

    const employeeNames = [
      { first: 'Бат', last: 'Мөнх' },
      { first: 'Сараа', last: 'Ганбат' },
      { first: 'Энхбат', last: 'Очир' },
      { first: 'Цэцэг', last: 'Дорж' },
      { first: 'Болд', last: 'Наран' },
      { first: 'Мөнхбат', last: 'Эрдэнэ' },
      { first: 'Оюун', last: 'Батбаяр' },
      { first: 'Алтанцэцэг', last: 'Жаргал' },
      { first: 'Төмөр', last: 'Баяр' },
      { first: 'Нара', last: 'Мөнхбат' },
      { first: 'Энхтуяа', last: 'Батбаяр' },
      { first: 'Батбаяр', last: 'Ганбат' },
      { first: 'Цогтбаатар', last: 'Очир' },
      { first: 'Мөнхбаяр', last: 'Дорж' },
      { first: 'Баттулга', last: 'Наран' }
    ];

    const employees = [];
    const managers = [];

    // Create managers first
    for (let i = 0; i < 6; i++) {
      const dept = departments[i];
      const name = employeeNames[i];
      const employee = new Employee({
        firstName: name.first,
        lastName: name.last,
        email: `${name.first.toLowerCase()}.${name.last.toLowerCase()}@amarhan.mn`,
        phone: `9911${String(i + 1000).slice(-4)}`,
        position: positions[dept][0],
        department: dept,
        startDate: randomDate(new Date(2020, 0, 1), new Date(2022, 11, 31)),
        contractType: 'permanent',
        registryNumber: `EMP-${String(i + 1000).padStart(4, '0')}`,
        status: 'active',
        baseSalary: randomInt(1500000, 3000000),
        address: 'Улаанбаатар хот',
        city: 'Улаанбаатар',
        country: 'Монгол',
        createdBy: companyId
      });
      await employee.save();
      employees.push(employee);
      managers.push(employee);
      console.log(`  ✓ Created manager: ${employee.firstName} ${employee.lastName} - ${dept}`);
    }

    // Create regular employees
    for (let i = 6; i < employeeNames.length; i++) {
      const dept = randomElement(departments);
      const manager = randomElement(managers.filter(m => m.department === dept || Math.random() > 0.5));
      const name = employeeNames[i];
      const posList = positions[dept] || positions['Борлуулалт'];
      const employee = new Employee({
        firstName: name.first,
        lastName: name.last,
        email: `${name.first.toLowerCase()}.${name.last.toLowerCase()}@amarhan.mn`,
        phone: `9911${String(i + 1000).slice(-4)}`,
        position: randomElement(posList.slice(1)),
        department: dept,
        manager: manager._id,
        startDate: randomDate(new Date(2021, 0, 1), new Date(2023, 11, 31)),
        contractType: randomElement(['permanent', 'fixed-term', 'temporary']),
        registryNumber: `EMP-${String(i + 1000).padStart(4, '0')}`,
        status: 'active',
        baseSalary: randomInt(800000, 2000000),
        address: 'Улаанбаатар хот',
        city: 'Улаанбаатар',
        country: 'Монгол',
        createdBy: companyId
      });
      await employee.save();
      employees.push(employee);
      console.log(`  ✓ Created employee: ${employee.firstName} ${employee.lastName} - ${dept}`);
    }

    // Create Contracts
    for (let i = 0; i < employees.length; i++) {
      const employee = employees[i];
      const contractData = {
        employee: employee._id,
        contractType: employee.contractType,
        startDate: employee.startDate,
        endDate: employee.contractType === 'fixed-term' ? randomDate(employee.startDate, new Date(2025, 11, 31)) : null,
        status: 'active',
        position: employee.position,
        department: employee.department,
        baseSalary: employee.baseSalary,
        terms: `${employee.contractType} гэрээ`,
        contractNumber: `CNT-${String(i + 1).padStart(6, '0')}`, // Add unique contract number
        createdBy: companyId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      // Use collection.insertOne to bypass Mongoose strict mode
      await Contract.collection.insertOne(contractData);
    }
    console.log(`  ✓ Created ${employees.length} contracts`);

    // Create Payrolls (last 6 months)
    const now = new Date();
    for (let monthOffset = 0; monthOffset < 6; monthOffset++) {
      const month = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
      for (const employee of employees) {
        const bonus = Math.random() > 0.7 ? randomInt(100000, 500000) : 0;
        const additions = Math.random() > 0.5 ? randomInt(50000, 200000) : 0;
        const deductions = Math.random() > 0.3 ? randomInt(50000, 150000) : 0;
        const netSalary = employee.baseSalary + additions + bonus - deductions;

        const payroll = new Payroll({
          employee: employee._id,
          month: month,
          baseSalary: employee.baseSalary,
          additions: additions,
          bonus: bonus,
          deductions: deductions,
          netSalary: netSalary,
          status: monthOffset === 0 ? 'paid' : 'approved',
          paymentMethod: 'bank',
          createdBy: companyId
        });
        await payroll.save();
      }
    }
    console.log(`  ✓ Created payrolls for last 6 months`);

    // Create Attendance (last 30 days)
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const date = new Date(now);
      date.setDate(date.getDate() - dayOffset);
      
      for (const employee of employees) {
        if (Math.random() > 0.1) { // 90% attendance
          const checkIn = new Date(date);
          checkIn.setHours(9 + randomInt(0, 1), randomInt(0, 30), 0);
          const checkOut = new Date(date);
          checkOut.setHours(18 + randomInt(0, 1), randomInt(0, 30), 0);
          
          const status = checkIn.getHours() > 9 ? 'late' : 'present';
          const lateBy = checkIn.getHours() > 9 ? (checkIn.getHours() - 9) * 60 + checkIn.getMinutes() : 0;

          const attendance = new Attendance({
            employee: employee._id,
            date: date,
            checkInTime: checkIn,
            checkOutTime: checkOut,
            status: status,
            lateBy: lateBy,
            workingHours: (checkOut - checkIn) / (1000 * 60 * 60),
            createdBy: companyId
          });
          await attendance.save();
        }
      }
    }
    console.log(`  ✓ Created attendance records for last 30 days`);

    // Create Leaves
    for (let i = 0; i < 10; i++) {
      const employee = randomElement(employees);
      const startDate = randomDate(new Date(2024, 0, 1), new Date(2024, 11, 31));
      const numberOfDays = randomInt(1, 5);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + numberOfDays);

      const leave = new Leave({
        employee: employee._id,
        leaveType: randomElement(['annual', 'sick', 'personal']),
        startDate: startDate,
        endDate: endDate,
        numberOfDays: numberOfDays,
        reason: 'Хувийн хэрэгцээ',
        status: randomElement(['pending', 'approved', 'rejected']),
        approvedBy: employee.manager || managers[0]._id,
        createdBy: companyId
      });
      await leave.save();
    }
    console.log(`  ✓ Created 10 leave requests`);

    // ============================================
    // 2. INVENTORY MODULE - Агуулах удирдлага
    // ============================================
    console.log('\n📦 Creating Inventory data...');

    await InventoryCategory.deleteMany({});
    await Supplier.deleteMany({});
    await InventoryWarehouse.deleteMany({});
    await InventoryItem.deleteMany({});
    await InventoryStock.deleteMany({});

    // Create Categories
    const categories = [
      { name: 'Оффис материал', code: 'CAT-001', type: 'PRODUCT' },
      { name: 'Компьютер техник', code: 'CAT-002', type: 'PRODUCT' },
      { name: 'Худалдааны бараа', code: 'CAT-003', type: 'PRODUCT' },
      { name: 'Түүхий эд', code: 'CAT-004', type: 'RAW_MATERIAL' },
      { name: 'Бэлэн бүтээгдэхүүн', code: 'CAT-005', type: 'FINISHED_GOOD' }
    ];

    const createdCategories = [];
    for (const cat of categories) {
      const category = new InventoryCategory({
        ...cat,
        description: `${cat.name} ангилал`,
        company: companyId
      });
      await category.save();
      createdCategories.push(category);
      console.log(`  ✓ Created category: ${cat.name}`);
    }

    // Create Suppliers
    const supplierNames = [
      'Монгол Оффис ХХК',
      'Технологийн Дэлгүүр',
      'Худалдааны Төв',
      'Нийлүүлэлтийн Компани',
      'Бараа Материал ХХК'
    ];

    const suppliers = [];
    for (let i = 0; i < supplierNames.length; i++) {
      const supplier = new Supplier({
        name: supplierNames[i],
        code: `SUP-${String(i + 1).padStart(3, '0')}`,
        email: `supplier${i + 1}@example.mn`,
        phone: `9912${String(i + 1000).slice(-4)}`,
        address: {
          street: `${i + 1}-р хороо`,
          city: 'Улаанбаатар',
          province: 'Улаанбаатар',
          country: 'Монгол'
        },
        contactPerson: {
          name: `Холбоо барих ${i + 1}`,
          email: `contact${i + 1}@example.mn`,
          phone: `9912${String(i + 2000).slice(-4)}`
        },
        paymentTerms: '30 хоног',
        taxId: `TAX-${String(i + 1000).padStart(6, '0')}`,
        rating: randomInt(3, 5),
        isActive: true,
        company: companyId
      });
      await supplier.save();
      suppliers.push(supplier);
      console.log(`  ✓ Created supplier: ${supplier.name}`);
    }

    // Create Warehouses
    const warehouses = [];
    const warehouseNames = ['Төв агуулах', 'Салбар агуулах 1', 'Салбар агуулах 2'];
    for (let i = 0; i < warehouseNames.length; i++) {
      const warehouse = new InventoryWarehouse({
        name: warehouseNames[i],
        code: `WH-${String(i + 1).padStart(3, '0')}`,
        location: {
          address: `${i + 1}-р дүүрэг`,
          city: 'Улаанбаатар',
          province: 'Улаанбаатар'
        },
        capacity: randomInt(1000, 5000),
        manager: {
          name: `Агуулахын менежер ${i + 1}`,
          email: `warehouse${i + 1}@amarhan.mn`,
          phone: `9913${String(i + 1000).slice(-4)}`
        },
        isActive: true,
        company: companyId
      });
      await warehouse.save();
      warehouses.push(warehouse);
      console.log(`  ✓ Created warehouse: ${warehouse.name}`);
    }

    // Create Items
    const itemNames = [
      { name: 'Харандаа', unit: 'pcs', purchasePrice: 500, sellingPrice: 1000 },
      { name: 'Цаас', unit: 'pack', purchasePrice: 5000, sellingPrice: 8000 },
      { name: 'Принтер', unit: 'pcs', purchasePrice: 500000, sellingPrice: 750000 },
      { name: 'Компьютер', unit: 'pcs', purchasePrice: 2000000, sellingPrice: 3000000 },
      { name: 'Харуул', unit: 'pcs', purchasePrice: 15000, sellingPrice: 25000 },
      { name: 'Стол', unit: 'pcs', purchasePrice: 200000, sellingPrice: 350000 },
      { name: 'Сандал', unit: 'pcs', purchasePrice: 100000, sellingPrice: 180000 },
      { name: 'Файл', unit: 'pcs', purchasePrice: 2000, sellingPrice: 4000 },
      { name: 'Хавтас', unit: 'pcs', purchasePrice: 3000, sellingPrice: 6000 },
      { name: 'Хэвлэх материал', unit: 'kg', purchasePrice: 5000, sellingPrice: 8000 }
    ];

    const items = [];
    for (let i = 0; i < itemNames.length; i++) {
      const itemData = itemNames[i];
      const item = new InventoryItem({
        name: itemData.name,
        code: `ITEM-${String(i + 1).padStart(4, '0')}`,
        barcode: `1234567890${String(i).padStart(3, '0')}`,
        category: randomElement(createdCategories)._id,
        description: `${itemData.name} бүтээгдэхүүн`,
        unit: itemData.unit,
        purchasePrice: itemData.purchasePrice,
        sellingPrice: itemData.sellingPrice,
        taxRate: 10,
        reorderPoint: randomInt(10, 50),
        reorderQuantity: randomInt(50, 200),
        supplier: randomElement(suppliers)._id,
        isActive: true,
        company: companyId
      });
      await item.save();
      items.push(item);
      console.log(`  ✓ Created item: ${item.name}`);
    }

    // Create Stocks
    for (const item of items) {
      for (const warehouse of warehouses) {
        const stock = new InventoryStock({
          item: item._id,
          warehouse: warehouse._id,
          quantity: randomInt(50, 500),
          company: companyId
        });
        await stock.save();
      }
    }
    console.log(`  ✓ Created stock records for all items`);

    // ============================================
    // 3. CRM MODULE - CRM / Борлуулалт
    // ============================================
    console.log('\n💼 Creating CRM data...');

    await Lead.deleteMany({});
    await Customer.deleteMany({});
    await Deal.deleteMany({});
    await Activity.deleteMany({});
    await Payment.deleteMany({});

    // Create Leads
    const leadNames = [
      { name: 'Батбаяр Ганбат', company: 'Технологийн Компани' },
      { name: 'Цэцэг Дорж', company: 'Худалдааны Төв' },
      { name: 'Мөнхбат Эрдэнэ', company: 'Бизнес Шийдэл' },
      { name: 'Оюун Батбаяр', company: 'Цахим Систем' },
      { name: 'Алтанцэцэг Жаргал', company: 'Маркетингийн Агентлаг' },
      { name: 'Төмөр Баяр', company: 'Хувийн Бизнес' },
      { name: 'Нара Мөнхбат', company: 'Олон Улсын Худалдаа' },
      { name: 'Энхтуяа Батбаяр', company: 'Технологийн Стартап' }
    ];

    const leads = [];
    for (let i = 0; i < leadNames.length; i++) {
      const leadData = leadNames[i];
      const lead = new Lead({
        name: leadData.name,
        company_name: leadData.company,
        email: `lead${i + 1}@example.mn`,
        phone: `9914${String(i + 1000).slice(-4)}`,
        source: randomElement(['website', 'referral', 'social_media', 'cold_call', 'email_campaign']),
        stage: randomElement(['new', 'contacted', 'meeting', 'proposal', 'negotiation']),
        estimated_value: randomInt(500000, 5000000),
        probability: randomInt(20, 80),
        expected_close_date: randomDate(new Date(), new Date(2025, 11, 31)),
        assigned_to: randomElement(users)._id,
        priority: randomElement(['low', 'medium', 'high']),
        status: 'active',
        notes: `${leadData.company}-тай хийсэн уулзалт`
      });
      await lead.save();
      leads.push(lead);
      console.log(`  ✓ Created lead: ${lead.name}`);
    }

    // Create Customers (some converted from leads)
    const customerNames = [
      { name: 'Болд Наран', company: 'Худалдааны Сүлжээ' },
      { name: 'Энхбат Очир', company: 'Борлуулалтын Компани' },
      { name: 'Сараа Ганбат', company: 'Олон Улсын Бизнес' },
      { name: 'Бат Мөнх', company: 'Технологийн Шийдэл' },
      { name: 'Цогтбаатар Очир', company: 'Цахим Худалдаа' },
      { name: 'Мөнхбаяр Дорж', company: 'Бизнес Консалтинг' },
      { name: 'Баттулга Наран', company: 'Маркетингийн Холбоо' }
    ];

    const customers = [];
    for (let i = 0; i < customerNames.length; i++) {
      const customerData = customerNames[i];
      const convertedLead = i < 3 ? leads[i] : null;
      
      const customer = new Customer({
        name: customerData.name,
        company_name: customerData.company,
        email: `customer${i + 1}@example.mn`,
        phone: `9915${String(i + 1000).slice(-4)}`,
        industry: randomElement(['Технологи', 'Худалдаа', 'Бизнес', 'Маркетинг', 'Боловсрол']),
        address: {
          street: `${i + 1}-р хороо`,
          city: 'Улаанбаатар',
          province: 'Улаанбаатар',
          country: 'Монгол'
        },
        lead_status: randomElement(['New', 'Contacted', 'Proposal', 'Closed']),
        customer_segment: randomElement(['A', 'B', 'C']),
        purchase_frequency: randomElement(['High', 'Medium', 'Low']),
        revenue: randomInt(1000000, 10000000),
        assigned_to: randomElement(users)._id,
        converted_from_lead: convertedLead ? convertedLead._id : null,
        last_contact_date: randomDate(new Date(2024, 0, 1), new Date()),
        status: 'active',
        tags: ['VIP', 'Regular', 'New'][i % 3] === 'VIP' ? ['VIP', 'Priority'] : ['Regular'],
        notes: `${customerData.company}-тай хамтран ажиллаж байна`
      });
      await customer.save();
      customers.push(customer);
      
      // Update lead if converted
      if (convertedLead) {
        convertedLead.converted_to_customer = customer._id;
        convertedLead.converted_at = new Date();
        convertedLead.status = 'converted';
        await convertedLead.save();
      }
      console.log(`  ✓ Created customer: ${customer.name}`);
    }

    // Create Deals
    const deals = [];
    for (let i = 0; i < 12; i++) {
      const customer = randomElement(customers);
      const deal = new Deal({
        title: `${customer.company_name}-тай гэрээ ${i + 1}`,
        customer: customer._id,
        lead: customer.converted_from_lead || null,
        deal_value: randomInt(1000000, 10000000),
        currency: 'MNT',
        stage: randomElement(['proposal', 'negotiation', 'contract_sent', 'contract_signed', 'closed_won']),
        probability: randomInt(30, 90),
        expected_close_date: randomDate(new Date(), new Date(2025, 11, 31)),
        contract_number: `CNT-${String(i + 1).padStart(6, '0')}`,
        contract_start_date: randomDate(new Date(2024, 0, 1), new Date()),
        contract_end_date: randomDate(new Date(2024, 6, 1), new Date(2025, 11, 31)),
        payment_terms: randomElement(['one_time', 'monthly', 'quarterly', 'annually']),
        payment_schedule: generatePaymentSchedule(randomInt(1000000, 10000000), 'monthly'),
        payment_status: randomElement(['pending', 'partial', 'paid']),
        assigned_to: randomElement(users)._id,
        status: 'active',
        notes: `${customer.company_name}-тай хийсэн гэрээний төлөвлөлт`
      });
      await deal.save();
      deals.push(deal);
      
      // Update customer revenue
      customer.total_deals_value += deal.deal_value;
      customer.total_deals_count += 1;
      await customer.save();
      console.log(`  ✓ Created deal: ${deal.title} - ${deal.deal_value.toLocaleString()} MNT`);
    }

    // Create Activities
    for (let i = 0; i < 30; i++) {
      const customer = randomElement(customers);
      const deal = Math.random() > 0.5 ? randomElement(deals.filter(d => d.customer.toString() === customer._id.toString())) : null;
      const lead = Math.random() > 0.3 ? randomElement(leads) : null;

      const activity = new Activity({
        type: randomElement(['call', 'meeting', 'email', 'task', 'note', 'proposal_sent']),
        subject: `${customer.name}-тай хийсэн ${['уулзалт', 'ярилцлага', 'имэйл', 'даалгавар'][i % 4]}`,
        description: `${customer.company_name}-тай хийсэн үйл ажиллагааны тэмдэглэл`,
        customer: customer._id,
        lead: lead ? lead._id : null,
        deal: deal ? deal._id : null,
        assigned_to: randomElement(users)._id,
        due_date: randomDate(new Date(), new Date(2025, 11, 31)),
        status: randomElement(['pending', 'completed', 'in_progress']),
        priority: randomElement(['low', 'medium', 'high']),
        duration: randomInt(15, 120),
        outcome: randomElement(['positive', 'neutral', 'negative']),
        next_action: 'Дараагийн уулзалт товлох',
        next_action_date: randomDate(new Date(), new Date(2025, 2, 31))
      });
      await activity.save();
    }
    console.log(`  ✓ Created 30 activities`);

    // Create Payments
    for (let i = 0; i < 20; i++) {
      const deal = randomElement(deals);
      const customer = await Customer.findById(deal.customer);
      
      const payment = new Payment({
        deal: deal._id,
        customer: customer._id,
        amount: Math.floor(deal.deal_value * randomInt(10, 50) / 100),
        currency: deal.currency,
        payment_method: randomElement(['cash', 'bank_transfer', 'card', 'qpay']),
        payment_date: randomDate(new Date(2024, 0, 1), new Date()),
        due_date: randomDate(new Date(), new Date(2025, 11, 31)),
        status: randomElement(['pending', 'paid', 'overdue']),
        invoice_number: `INV-${String(i + 1).padStart(6, '0')}`,
        receipt_number: `RCP-${String(i + 1).padStart(6, '0')}`,
        transaction_id: `TXN-${Date.now()}-${i}`,
        notes: `${deal.title}-ийн төлбөр`,
        paid_by: customer.name,
        processed_by: randomElement(users)._id
      });
      await payment.save();
    }
    console.log(`  ✓ Created 20 payments`);

    // ============================================
    // 4. PROJECTS & TASKS - Төсөл ба даалгавар
    // ============================================
    console.log('\n📊 Creating Projects & Tasks data...');

    await Project.deleteMany({});
    await Task.deleteMany({});

    // Create Projects
    const projectNames = [
      'CRM системийн хөгжүүлэлт',
      'Веб сайтын шинэчлэл',
      'Маркетингийн кампанит ажил',
      'Борлуулалтын стратеги',
      'Хүний нөөцийн систем',
      'Санхүүгийн тайлангийн систем'
    ];

    const projects = [];
    for (let i = 0; i < projectNames.length; i++) {
      const manager = randomElement(users);
      const teamMembers = users.filter(u => u._id.toString() !== manager._id.toString()).slice(0, randomInt(2, 5));
      
      const project = new Project({
        name: projectNames[i],
        description: `${projectNames[i]} төслийн дэлгэрэнгүй мэдээлэл`,
        goal: `${projectNames[i]} төслийн зорилго`,
        manager: manager._id,
        team_members: teamMembers.map(u => u._id),
        department: randomElement(departments),
        start_date: randomDate(new Date(2024, 0, 1), new Date(2024, 6, 1)),
        end_date: randomDate(new Date(2024, 6, 1), new Date(2025, 11, 31)),
        budget: {
          amount: randomInt(5000000, 50000000),
          currency: 'MNT'
        },
        progress: randomInt(0, 100),
        status: randomElement(['planning', 'active', 'on_hold', 'completed']),
        priority: randomElement(['low', 'medium', 'high', 'urgent']),
        tags: ['urgent', 'important', 'development'][i % 3] === 'urgent' ? ['urgent'] : ['important']
      });
      await project.save();
      projects.push(project);
      console.log(`  ✓ Created project: ${project.name}`);
    }

    // Create Tasks
    const taskTitles = [
      'Дизайн бэлтгэх',
      'Код бичих',
      'Тест хийх',
      'Баримт бичиг бэлтгэх',
      'Уулзалт товлох',
      'Тайлан бэлтгэх',
      'Хэрэглэгчийн шаардлага цуглуулах',
      'Системийн тохиргоо хийх'
    ];

    for (let i = 0; i < 40; i++) {
      const project = randomElement(projects);
      const assignedUser = randomElement(users);
      const teamMembers = users.filter(u => u._id.toString() !== assignedUser._id.toString()).slice(0, randomInt(1, 3));

      const task = new Task({
        title: `${project.name} - ${randomElement(taskTitles)}`,
        description: `${project.name} төслийн даалгавар`,
        project: project._id,
        category: randomElement(['marketing', 'finance', 'sales', 'development', 'hr', 'operations']),
        status: randomElement(['not_started', 'in_progress', 'completed']),
        priority: randomElement(['low', 'medium', 'high', 'urgent']),
        assigned_to: assignedUser._id,
        assigned_team: teamMembers.map(u => u._id),
        department: project.department,
        start_date: randomDate(project.start_date, project.end_date),
        due_date: randomDate(new Date(), project.end_date),
        progress: randomInt(0, 100),
        estimated_hours: randomInt(2, 40),
        actual_hours: randomInt(1, 35),
        tags: ['urgent', 'important'][i % 2] === 'urgent' ? ['urgent'] : []
      });
      await task.save();
      
      // Update project progress
      await project.updateProgress();
    }
    console.log(`  ✓ Created 40 tasks`);

    // ============================================
    // 5. FINANCE MODULE - Санхүү
    // ============================================
    console.log('\n💰 Creating Finance data...');

    await Invoice.deleteMany({});
    await Income.deleteMany({});
    await Expense.deleteMany({});

    // Create Invoices
    const invoices = [];
    const year = new Date().getFullYear();
    const existingInvoiceCount = await Invoice.countDocuments({ company: companyId });
    
    for (let i = 0; i < 15; i++) {
      const customer = randomElement(customers);
      const deal = randomElement(deals.filter(d => d.customer.toString() === customer._id.toString()));
      
      const invoiceItems = [];
      const numItems = randomInt(1, 5);
      for (let j = 0; j < numItems; j++) {
        const item = randomElement(items);
        const quantity = randomInt(1, 10);
        const unitPrice = item.sellingPrice;
        const amount = quantity * unitPrice;
        
        invoiceItems.push({
          description: item.name,
          quantity: quantity,
          unitPrice: unitPrice,
          taxRate: 10,
          amount: amount
        });
      }

      const subtotal = invoiceItems.reduce((sum, item) => sum + item.amount, 0);
      const taxAmount = subtotal * 0.1;
      const total = subtotal + taxAmount;

      // Generate invoice number manually
      const invoiceNumber = `INV-${year}-${String(existingInvoiceCount + i + 1).padStart(6, '0')}`;

      const invoice = new Invoice({
        invoiceNumber: invoiceNumber,
        customer: customer._id,
        issueDate: randomDate(new Date(2024, 0, 1), new Date()),
        dueDate: randomDate(new Date(), new Date(2025, 11, 31)),
        status: randomElement(['DRAFT', 'SENT', 'PAID', 'PARTIAL', 'OVERDUE']),
        items: invoiceItems,
        subtotal: subtotal,
        taxAmount: taxAmount,
        taxRate: 10,
        total: total,
        paidAmount: Math.random() > 0.3 ? total * randomInt(50, 100) / 100 : 0,
        currency: 'MNT',
        notes: `${customer.company_name}-д илгээсэн нэхэмжлэх`,
        terms: '30 хоногийн төлбөр',
        createdBy: randomElement(users)._id,
        company: companyId
      });
      await invoice.save();
      invoices.push(invoice);
      console.log(`  ✓ Created invoice: ${invoice.invoiceNumber} - ${total.toLocaleString()} MNT`);
    }

    // Create Income
    const existingIncomeCount = await Income.countDocuments({ company: companyId });
    
    for (let i = 0; i < 20; i++) {
      const customer = randomElement(customers);
      const invoice = Math.random() > 0.5 ? randomElement(invoices.filter(inv => inv.customer.toString() === customer._id.toString())) : null;

      // Generate income number manually
      const incomeNumber = `INC-${Date.now()}-${String(existingIncomeCount + i + 1).padStart(4, '0')}`;

      const income = new Income({
        incomeNumber: incomeNumber,
        type: randomElement(['SALE', 'SERVICE', 'RENTAL']),
        amount: randomInt(500000, 5000000),
        currency: 'MNT',
        date: randomDate(new Date(2024, 0, 1), new Date()),
        customer: customer._id,
        invoice: invoice ? invoice._id : null,
        description: `${customer.company_name}-аас орсон орлого`,
        category: 'Борлуулалт',
        taxAmount: 0,
        taxRate: 0,
        paymentStatus: randomElement(['PENDING', 'PAID', 'PARTIAL']),
        paymentMethod: randomElement(['CASH', 'BANK_TRANSFER', 'CARD', 'QPAY']),
        createdBy: randomElement(users)._id,
        company: companyId
      });
      await income.save();
      console.log(`  ✓ Created income: ${income.incomeNumber} - ${income.amount.toLocaleString()} MNT`);
    }

    // Create Expenses
    const expenseCategories = ['SUPPLIES', 'SALARY', 'RENT', 'UTILITIES', 'MARKETING', 'TRAVEL', 'MAINTENANCE'];
    const existingExpenseCount = await Expense.countDocuments({ company: companyId });
    
    for (let i = 0; i < 25; i++) {
      const category = randomElement(expenseCategories);
      let vendor = null;
      let description = '';

      if (category === 'SALARY') {
        const employee = randomElement(employees);
        vendor = `${employee.firstName} ${employee.lastName}`;
        description = `${employee.position} - ${employee.department} сарын цалин`;
      } else if (category === 'SUPPLIES') {
        const supplier = randomElement(suppliers);
        vendor = supplier.name;
        description = `${supplier.name}-аас худалдан авсан материал`;
      } else {
        const vendorOptions = ['Оффис түрээс', 'Цахилгаан', 'Утас', 'Интернет', 'Маркетинг'];
        vendor = randomElement(vendorOptions);
        description = `${category} зардал`;
      }

      // Generate expense number manually
      const expenseNumber = `EXP-${Date.now()}-${String(existingExpenseCount + i + 1).padStart(4, '0')}`;

      const expense = new Expense({
        expenseNumber: expenseNumber,
        category: category,
        amount: category === 'SALARY' ? randomInt(800000, 3000000) : randomInt(100000, 2000000),
        currency: 'MNT',
        date: randomDate(new Date(2024, 0, 1), new Date()),
        vendor: vendor,
        description: description,
        paymentMethod: randomElement(['CASH', 'BANK_TRANSFER', 'CARD', 'QPAY']),
        paymentStatus: 'PAID',
        taxAmount: 0,
        taxRate: 0,
        createdBy: randomElement(users)._id,
        company: companyId
      });
      await expense.save();
      console.log(`  ✓ Created expense: ${expense.expenseNumber} - ${expense.amount.toLocaleString()} MNT`);
    }

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n✅ Seed data creation completed!');
    console.log('\n📊 Summary:');
    console.log(`  HR: ${employees.length} employees, ${await Contract.countDocuments()} contracts, ${await Payroll.countDocuments()} payrolls, ${await Attendance.countDocuments()} attendance records, ${await Leave.countDocuments()} leaves`);
    console.log(`  Inventory: ${createdCategories.length} categories, ${suppliers.length} suppliers, ${warehouses.length} warehouses, ${items.length} items, ${await InventoryStock.countDocuments()} stock records`);
    console.log(`  CRM: ${leads.length} leads, ${customers.length} customers, ${deals.length} deals, ${await Activity.countDocuments()} activities, ${await Payment.countDocuments()} payments`);
    console.log(`  Projects: ${projects.length} projects, ${await Task.countDocuments()} tasks`);
    console.log(`  Finance: ${invoices.length} invoices, ${await Income.countDocuments()} income records, ${await Expense.countDocuments()} expenses`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

// Helper function to generate payment schedule
function generatePaymentSchedule(totalAmount, paymentTerms) {
  const schedule = [];
  let numPayments = 1;
  
  if (paymentTerms === 'monthly') {
    numPayments = randomInt(3, 12);
  } else if (paymentTerms === 'quarterly') {
    numPayments = 4;
  } else if (paymentTerms === 'annually') {
    numPayments = 1;
  }

  const paymentAmount = Math.floor(totalAmount / numPayments);
  const remainder = totalAmount - (paymentAmount * numPayments);

  for (let i = 0; i < numPayments; i++) {
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + i);
    const amount = i === numPayments - 1 ? paymentAmount + remainder : paymentAmount;
    
    schedule.push({
      amount: amount,
      due_date: dueDate,
      status: Math.random() > 0.5 ? 'paid' : 'pending',
      paid_at: Math.random() > 0.5 ? dueDate : null
    });
  }

  return schedule;
}

seedAllData();

