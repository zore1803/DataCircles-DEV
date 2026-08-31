require('dotenv').config();
const mongoose = require('mongoose');

require('../models/Deal');
require('../models/Company');
require('../models/Contact');
require('../models/Vendor');
const Invoice = require('../models/Invoice');
const Purchase = require('../models/Purchase');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const brokenInvoiceNumbers = ['INV-AM-HIST-5', 'INV-SEED-2', 'INV-SEED-10000', 'INV-SEED-3'];
  const brokenPurchaseNumbers = ['PUR-00083', 'PUR-00084'];

  const invDel = await Invoice.deleteMany({ invoiceNumber: { $in: brokenInvoiceNumbers } });
  const purDel = await Purchase.deleteMany({ purchaseNumber: { $in: brokenPurchaseNumbers } });

  console.log('✅ Deleted invoices:', invDel.deletedCount);
  console.log('✅ Deleted purchases:', purDel.deletedCount);
  console.log('Done. Timeline will now show only valid, properly-linked records.');
  process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
