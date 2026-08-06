// scripts/clearLegacyDocumentStyles.js
// ONE-TIME migration. Run AFTER deploying the updated models.
//
// Documents used to default `style` to 'Classic', so nearly every saved
// invoice/quotation/challan carries that value whether or not anyone chose it.
// With the template setting now driving anything left blank, those rows would
// stay stuck on Classic forever. This clears them so they follow the
// organization's template again; documents on Modern/Minimal/Elegant were an
// explicit choice and are left alone.
//
// Run with:  node scripts/clearLegacyDocumentStyles.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Invoice = require('../models/Invoice');
const ProformaInvoice = require('../models/ProformaInvoice');
const Quotation = require('../models/quotation');
const DeliveryChallan = require('../models/deliveryChallan');

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');

    const models = [
      ['Invoice', Invoice],
      ['ProformaInvoice', ProformaInvoice],
      ['Quotation', Quotation],
      ['DeliveryChallan', DeliveryChallan],
    ];

    for (const [label, Model] of models) {
      const { modifiedCount } = await Model.updateMany(
        { style: 'Classic' },
        { $set: { style: '' } }
      );
      console.log(`   ${label}: cleared ${modifiedCount}`);
    }

    console.log('✅ Done');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
