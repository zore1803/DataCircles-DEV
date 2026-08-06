const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

// Models
const Invoice = require('../models/Invoice');
const ProformaInvoice = require('../models/ProformaInvoice');
const Quotation = require('../models/quotation');
const DeliveryChallan = require('../models/deliveryChallan');
const Deal = require('../models/Deal');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Item = require('../models/Item');

// Load env variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('Error: MONGO_URI is missing in .env file');
  process.exit(1);
}

const generateDummyItems = (items) => {
  // If we have real items in the DB, use one of them, else use a purely dummy subdoc
  const dummyItems = [];
  const numItems = Math.floor(Math.random() * 3) + 1; // 1 to 3 items
  
  for (let i = 0; i < numItems; i++) {
    const rate = Math.floor(Math.random() * 5000) + 500;
    const quantity = Math.floor(Math.random() * 5) + 1;
    
    const itemData = {
      name: `Consulting Service ${Math.floor(Math.random() * 100)}`,
      description: 'Professional services rendered',
      rate: rate,
      quantity: quantity,
      hsn: '9983',
      discountType: 'amount',
      discount: 0,
    };

    if (items && items.length > 0) {
      const realItem = items[Math.floor(Math.random() * items.length)];
      itemData.itemId = realItem._id;
      itemData.name = realItem.name;
    }

    dummyItems.push(itemData);
  }
  return dummyItems;
};

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');

    // Fetch existing dependencies
    const deals = await Deal.find().limit(10);
    const users = await User.find().limit(5);
    const organizations = await Organization.find().limit(5);
    const items = await Item.find().limit(10);

    if (deals.length === 0 || users.length === 0 || organizations.length === 0) {
      console.error('ERROR: You must have at least 1 Deal, 1 User, and 1 Organization in the database to run this seed.');
      process.exit(1);
    }

    const orgId = organizations[0]._id;
    const userId = users[0]._id;

    console.log('Starting seed process. Generating 50 records for each document type...');

    const statuses = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Void'];
    
    // 1. Seed Invoices
    const invoicesToInsert = [];
    for (let i = 1; i <= 50; i++) {
      const randomDeal = deals[Math.floor(Math.random() * deals.length)];
      const amount = Math.floor(Math.random() * 100000) + 1000;
      
      invoicesToInsert.push({
        deal: randomDeal._id,
        invoiceNumber: `INV-2026-${i.toString().padStart(4, '0')}`,
        date: new Date(Date.now() - Math.floor(Math.random() * 10000000000)),
        dueDate: new Date(Date.now() + Math.floor(Math.random() * 10000000000)),
        amount: amount,
        user: userId,
        organization: orgId,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        discount: { type: 'fixed', value: 0 },
        style: '',
        transactionType: 'intra',
        gstRate: 18,
        items: generateDummyItems(items)
      });
    }
    await Invoice.insertMany(invoicesToInsert);
    console.log(`✅ Inserted 50 Invoices`);

    // 2. Seed Proforma Invoices
    const performasToInsert = [];
    for (let i = 1; i <= 50; i++) {
      const randomDeal = deals[Math.floor(Math.random() * deals.length)];
      const amount = Math.floor(Math.random() * 100000) + 1000;
      
      performasToInsert.push({
        deal: randomDeal._id,
        performaInvoiceNumber: `PRO-2026-${i.toString().padStart(4, '0')}`,
        date: new Date(Date.now() - Math.floor(Math.random() * 10000000000)),
        dueDate: new Date(Date.now() + Math.floor(Math.random() * 10000000000)),
        amount: amount,
        user: userId,
        organization: orgId,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        discount: { type: 'fixed', value: 0 },
        style: 'Modern',
        items: generateDummyItems(items)
      });
    }
    await ProformaInvoice.insertMany(performasToInsert);
    console.log(`✅ Inserted 50 Proforma Invoices`);

    // 3. Seed Quotations
    const quotationsToInsert = [];
    for (let i = 1; i <= 50; i++) {
      const randomDeal = deals[Math.floor(Math.random() * deals.length)];
      const amount = Math.floor(Math.random() * 100000) + 1000;
      
      quotationsToInsert.push({
        deal: randomDeal._id,
        quotationNumber: `QTN-2026-${i.toString().padStart(4, '0')}`,
        date: new Date(Date.now() - Math.floor(Math.random() * 10000000000)),
        dueDate: new Date(Date.now() + Math.floor(Math.random() * 10000000000)),
        amount: amount,
        user: userId,
        organization: orgId,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        discount: { type: 'fixed', value: 0 },
        style: 'Minimal',
        items: generateDummyItems(items)
      });
    }
    await Quotation.insertMany(quotationsToInsert);
    console.log(`✅ Inserted 50 Quotations`);

    // 4. Seed Delivery Challans
    const challanStatuses = ['Draft', 'Sent', 'Delivered', 'Cancelled'];
    const challansToInsert = [];
    for (let i = 1; i <= 50; i++) {
      const randomDeal = deals[Math.floor(Math.random() * deals.length)];
      const amount = Math.floor(Math.random() * 100000) + 1000;
      
      challansToInsert.push({
        deal: randomDeal._id,
        deliveryChallanNumber: `DC-2026-${i.toString().padStart(4, '0')}`,
        date: new Date(Date.now() - Math.floor(Math.random() * 10000000000)),
        amount: amount,
        user: userId,
        organization: orgId,
        status: challanStatuses[Math.floor(Math.random() * challanStatuses.length)],
        discount: { type: 'fixed', value: 0 },
        style: 'Elegant',
        items: generateDummyItems(items)
      });
    }
    await DeliveryChallan.insertMany(challansToInsert);
    console.log(`✅ Inserted 50 Delivery Challans`);

    console.log('🎉 Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
};

seedDatabase();
