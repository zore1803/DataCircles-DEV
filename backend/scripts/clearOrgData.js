// Clears all org-scoped data for one organization, keeping the User and
// Organization documents themselves intact (org becomes empty, like a fresh
// signup, without deleting the account).
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose = require("mongoose");

const ORG_ID = process.argv[2];
if (!ORG_ID) {
  console.error("Usage: node clearOrgData.js <organizationId>");
  process.exit(1);
}

const MODEL_FILES = [
  "EInvoice", "SalesReturn", "deliveryChallan", "quotation", "StockMovement",
  "PurchaseOrder", "PurchaseReturn", "Purchase", "ProformaInvoice", "Invoice",
  "Item", "Journal", "JournalEntry", "Meeting", "Task", "Invited", "Note",
  "CallLog", "Company", "WalletTransaction", "SubscriptionPayment",
  "Subscription", "ScheduledChange", "CommercialTransaction",
  "CouponRedemption", "BillingEvent", "BillingInvoice", "ItemFields",
  "GoogleIntegration", "Deal", "Contact", "Payment", "Vendor", "VendorNote",
  "Notification", "DocumentFooterTemplate", "DocumentTemplateSettings",
  "FormDefinition", "dealSettings.model", "VendorFields", "UserAuditLog",
  "StorageUsage", "SubmissionEvent", "ReferralCode", "Referral",
  "NotificationSettings", "MeetingType", "KanbanName", "KanbanBoard",
  "FormSubmission", "EmailTemplate", "EmailLog", "DuplicateReview",
  "DealFields", "ContactFolder", "ContactFields", "CompanyFields",
  "CompanyFolder", "FormVersion",
];

async function main() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

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
      const res = await Model.deleteMany({ organization: ORG_ID });
      report.push([Model.modelName, res.deletedCount]);
    } catch (e) {
      console.warn(`Skip ${Model.modelName}: ${e.message}`);
    }
  }

  console.log(`Cleared org ${ORG_ID}:`);
  for (const [name, count] of report) {
    console.log(`  ${name}: ${count}`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
