// One-off destructive cleanup script.
// Keeps only User accounts yash.mishra@datacircles.in and rohit.zore@datacircles.in
// (and their organizations' data). Deletes everything else across all
// organization-scoped collections, plus deletes other User/Organization docs.
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose = require("mongoose");

const DRY_RUN = process.argv.includes("--dry-run");

const KEEP_EMAILS = ["yash.mishra@datacircles.in", "rohit.zore@datacircles.in"];

const MODEL_FILES = [
  "EInvoice", "SalesReturn", "deliveryChallan", "quotation", "StockMovement",
  "PurchaseOrder", "PurchaseReturn", "Purchase", "ProformaInvoice", "Invoice",
  "Item", "Journal", "JournalEntry", "DocumentSettings", "Meeting",
  "SystemSettings", "Task", "Invited", "Note", "Branding", "CallLog",
  "Company", "WalletTransaction", "Wallet", "SubscriptionPayment",
  "Subscription", "ScheduledChange", "CommercialTransaction",
  "CouponRedemption", "BillingEvent", "BillingInvoice", "ItemFields",
  "BankDetails", "GoogleIntegration", "Deal", "Contact", "Payment", "Vendor",
  "VendorNote", "Notification", "DocumentFooterTemplate",
  "DocumentTemplateSettings", "FormDefinition", "dealSettings.model",
  "VendorFields", "UserAuditLog", "StorageUsage", "SubmissionEvent",
  "Reward", "ReferralProgram", "ReferralCode", "Referral",
  "RazorpayPriceCache", "NotificationSettings", "MeetingType", "KanbanName",
  "KanbanBoard", "Industry", "FormSubmission", "EmailTemplate", "EmailLog",
  "DuplicateReview", "DealFields", "Coupon", "ContactFolder", "ContactFields",
  "CompanyFields", "CompanyFolder", "FormVersion", "FormSubmission",
];

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("No MONGO_URI/MONGODB_URI in env");
  await mongoose.connect(uri);

  const User = require("../models/User");
  const Organization = require("../models/Organization");

  const keepUsers = await User.find({ email: { $in: KEEP_EMAILS } }).lean();
  if (keepUsers.length !== KEEP_EMAILS.length) {
    const found = keepUsers.map((u) => u.email);
    console.error("Could not find all keep-users. Found:", found);
    throw new Error("Aborting: expected both keep-user accounts to exist.");
  }
  const keepOrgIds = keepUsers.map((u) => u.organization);
  console.log("Keeping users:", keepUsers.map((u) => `${u.email} (org ${u.organization})`));

  const report = [];

  for (const name of MODEL_FILES) {
    let Model;
    try {
      Model = require(`../models/${name}`);
    } catch (e) {
      console.warn(`Skip ${name}: cannot load model (${e.message})`);
      continue;
    }
    try {
      const filter = { organization: { $nin: keepOrgIds } };
      const count = await Model.countDocuments(filter);
      if (!DRY_RUN) {
        const res = await Model.deleteMany(filter);
        report.push([Model.modelName, res.deletedCount]);
      } else {
        report.push([Model.modelName, count]);
      }
    } catch (e) {
      console.warn(`Skip ${Model.modelName}: ${e.message}`);
    }
  }

  const userFilter = { email: { $nin: KEEP_EMAILS } };
  const userCount = await User.countDocuments(userFilter);
  const orgFilter = { _id: { $nin: keepOrgIds } };
  const orgCount = await Organization.countDocuments(orgFilter);
  if (!DRY_RUN) {
    const userRes = await User.deleteMany(userFilter);
    report.push(["User", userRes.deletedCount]);
    const orgRes = await Organization.deleteMany(orgFilter);
    report.push(["Organization", orgRes.deletedCount]);
  } else {
    report.push(["User", userCount]);
    report.push(["Organization", orgCount]);
  }

  console.log("\nDeleted counts:");
  for (const [name, count] of report) {
    console.log(`  ${name}: ${count}`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
