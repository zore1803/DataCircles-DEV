// Removes the demo/sample data seeded by scripts/seedSampleData.js for
// specific organizations (the fixed set of companies/vendors/items etc.
// created on trial signup).
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose = require("mongoose");

const Company = require("../models/Company");
const Vendor = require("../models/Vendor");
const Contact = require("../models/Contact");
const Deal = require("../models/Deal");
const Invoice = require("../models/Invoice");
const Task = require("../models/Task");
const Meeting = require("../models/Meeting");
const Item = require("../models/Item");
const PurchaseOrder = require("../models/PurchaseOrder");
const Purchase = require("../models/Purchase");

const ORG_IDS = ["6a7d571670074e77b27d569e", "6a5703d82dd9d4270cc7ee59"];

const SAMPLE_COMPANY_NAMES = [
  "Tech Innovations Ltd", "Green Energy Corp", "HealthCare Solutions",
  "Finance Experts Inc", "EduTech Academy", "Auto Manufacturers",
  "Retail Giants", "Food Services Co", "Travel Adventures", "Media Entertainment",
];
const SAMPLE_VENDOR_NAMES = [
  "Tech Supplies Inc", "Energy Parts Ltd", "MediCare Distributors",
  "Finance Solutions", "Edu Supplies Co", "Auto Parts Ltd",
  "Retail Suppliers", "Food Distributors", "Travel Gear Co", "Media Supplies",
];
const SAMPLE_ITEM_NAMES = [
  "Laptop", "Cloud Hosting", "Smartphone", "Consulting", "Desk Chair",
  "Monitor", "Maintenance Contract", "Printer", "Tablet", "Software License",
];

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(uri);

  for (const orgId of ORG_IDS) {
    const companies = await Company.find({ organization: orgId, name: { $in: SAMPLE_COMPANY_NAMES } }).select("_id").lean();
    const vendors = await Vendor.find({ organization: orgId, name: { $in: SAMPLE_VENDOR_NAMES } }).select("_id").lean();
    const companyIds = companies.map((c) => c._id);
    const vendorIds = vendors.map((v) => v._id);

    const contactRes = await Contact.deleteMany({ organization: orgId, company: { $in: companyIds } });
    const dealRes = await Deal.deleteMany({ organization: orgId, company: { $in: companyIds } });
    const invoiceRes = await Invoice.deleteMany({ organization: orgId, invoiceNumber: /^INV-\d+$/ });
    const taskRes = await Task.deleteMany({ organization: orgId, relatedTo: { $in: companyIds }, relationModel: "Company" });
    const meetingRes = await Meeting.deleteMany({ organization: orgId, vendor: { $in: vendorIds } });
    const poRes = await PurchaseOrder.deleteMany({ organization: orgId, poNumber: /^PO-2025-00\d+$/ });
    const purchaseRes = await Purchase.deleteMany({ organization: orgId, purchaseNumber: /^PUR-2025-00\d+$/ });
    const itemRes = await Item.deleteMany({ organization: orgId, name: { $in: SAMPLE_ITEM_NAMES } });
    const companyRes = await Company.deleteMany({ _id: { $in: companyIds } });
    const vendorRes = await Vendor.deleteMany({ _id: { $in: vendorIds } });

    console.log(`Org ${orgId}:`);
    console.log({
      companies: companyRes.deletedCount,
      vendors: vendorRes.deletedCount,
      contacts: contactRes.deletedCount,
      deals: dealRes.deletedCount,
      invoices: invoiceRes.deletedCount,
      tasks: taskRes.deletedCount,
      meetings: meetingRes.deletedCount,
      purchaseOrders: poRes.deletedCount,
      purchases: purchaseRes.deletedCount,
      items: itemRes.deletedCount,
    });
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
