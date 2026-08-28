// One-off cleanup: removes the placeholder BankDetails record that used to
// be auto-created for every organization at signup (see authController.js
// fix removing this seeding). Only targets records matching that exact
// dummy signature — never touches anything else.
//
// Usage:
//   node scripts/removeDummyBankAccounts.js          # dry run, lists matches
//   node scripts/removeDummyBankAccounts.js --delete # actually deletes them

const mongoose = require("mongoose");
require("dotenv").config();

async function main() {
  const shouldDelete = process.argv.includes("--delete");

  await mongoose.connect(process.env.MONGO_URI);
  const Organization = require("../models/Organization");
  const BankDetails = require("../models/BankDetails");

  const query = {
    bank: "HDFC Bank",
    accountHolder: "Organization Pvt Ltd",
    accountNumber: "1234567890",
    ifscCode: "HDFC0001234",
  };

  const matches = await BankDetails.find(query).select("organization createdAt");

  if (matches.length === 0) {
    console.log("No dummy bank accounts found. Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  const orgIds = matches.map((m) => m.organization);
  const orgs = await Organization.find({ _id: { $in: orgIds } }).select("name");
  const orgNameById = Object.fromEntries(orgs.map((o) => [o._id.toString(), o.name]));

  console.log(`Found ${matches.length} dummy bank account(s):\n`);
  for (const m of matches) {
    console.log(
      `  - org: ${orgNameById[m.organization?.toString()] || "(unknown)"} (${m.organization}), created: ${m.createdAt}`
    );
  }

  if (!shouldDelete) {
    console.log("\nDry run only — re-run with --delete to actually remove these.");
  } else {
    const result = await BankDetails.deleteMany(query);
    console.log(`\nDeleted ${result.deletedCount} dummy bank account(s).`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
