// Diagnostic only — makes no changes. Prints, for every organization whose
// name matches "google" or "cottson" (case-insensitive):
//   - the org's real _id
//   - every User in that org (role + email) and that user's own
//     `organization` field (to catch a user whose org pointer is wrong)
//   - every BankDetails document whose `organization` field resolves to
//     that org, with its real stored organization id spelled out
//
// This settles whether a bank record is genuinely mis-stamped with the
// wrong org id, or whether the *user* accessing it has a bad org pointer.
//
// Usage: node scripts/diagBankOrgMismatch.js

const mongoose = require("mongoose");
require("dotenv").config();

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Organization = require("../models/Organization");
  const User = require("../models/User");
  const BankDetails = require("../models/BankDetails");

  const orgs = await Organization.find({
    name: { $regex: /google|cottson/i },
  }).select("_id name");

  if (orgs.length === 0) {
    console.log("No organizations matching 'google' or 'cottson' found.");
    await mongoose.disconnect();
    return;
  }

  for (const org of orgs) {
    console.log(`\n=== Organization: "${org.name}" (_id: ${org._id}) ===`);

    const users = await User.find({ organization: org._id }).select(
      "name email role organization"
    );
    console.log(`  Users (${users.length}):`);
    for (const u of users) {
      console.log(
        `    - ${u.name} <${u.email || "no email"}> role=${u.role} organization=${u.organization}`
      );
    }

    const banks = await BankDetails.find({ organization: org._id }).select(
      "bank accountHolder accountNumber organization user createdAt"
    );
    console.log(`  BankDetails docs whose organization field = this org (${banks.length}):`);
    for (const b of banks) {
      const last4 = (b.accountNumber || "").slice(-4);
      console.log(
        `    - ${b.bank} (...${last4}) accountHolder="${b.accountHolder}" stored organization=${b.organization} createdAt=${b.createdAt}`
      );
    }
  }

  // Also: every BankDetails doc anywhere with bank "HDFC Bank" ending in 7890,
  // regardless of which org it's stamped with — to find the exact document(s)
  // behind the screenshot directly.
  console.log(`\n=== All "HDFC Bank" docs ending in 7890 (any org) ===`);
  const suspects = await BankDetails.find({
    bank: "HDFC Bank",
    accountNumber: { $regex: /7890$/ },
  }).select("bank accountHolder accountNumber organization user createdAt");
  const orgNameCache = {};
  for (const b of suspects) {
    const orgId = b.organization?.toString();
    if (orgId && !(orgId in orgNameCache)) {
      const o = await Organization.findById(orgId).select("name");
      orgNameCache[orgId] = o?.name || "(org not found)";
    }
    console.log(
      `  - ...${(b.accountNumber || "").slice(-4)} accountHolder="${b.accountHolder}" organization=${orgId} (${orgNameCache[orgId] || "?"}) createdAt=${b.createdAt}`
    );
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
