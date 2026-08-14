// scripts/auditFixtureOrgs.js
//
// READ-ONLY audit: counts how much leftover fixture/test data exists in the
// real dev database — the likely cause of "can't see all the orgs" (the
// Super Admin org search caps at 50 results, sorted alphabetically; if 50+
// fixture orgs sort before the real ones, real orgs never appear).
//
// Makes NO writes. Safe to run against the real dev database.
//
// Run with: node scripts/auditFixtureOrgs.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to: ${mongoose.connection.name}\n`);

  const total = await Organization.countDocuments({});
  console.log(`Total organizations in DB: ${total}`);

  // Fixture scripts across this whole project consistently name orgs with
  // "Fixture", "Verify", "Test", or "Repro" somewhere in the name (confirmed
  // pattern from every script this session and earlier ones wrote).
  const fixturePattern = /fixture|verify|repro|\btest\b/i;
  const allOrgs = await Organization.find({}).select('name code createdAt').sort({ createdAt: 1 }).lean();
  const fixtureLike = allOrgs.filter((o) => fixturePattern.test(o.name || '') || fixturePattern.test(o.code || ''));
  const real = allOrgs.filter((o) => !fixturePattern.test(o.name || '') && !fixturePattern.test(o.code || ''));

  console.log(`\nLikely fixture/test orgs: ${fixtureLike.length}`);
  console.log(`Likely real orgs: ${real.length}`);

  console.log('\n=== Likely REAL organizations (name, code, createdAt) ===');
  real.forEach((o) => console.log(`  ${o.name} | ${o.code} | ${o.createdAt?.toISOString().slice(0, 10)}`));

  console.log(`\n=== Sample of fixture-like orgs (first 15 of ${fixtureLike.length}) ===`);
  fixtureLike.slice(0, 15).forEach((o) => console.log(`  ${o.name} | ${o.code} | ${o.createdAt?.toISOString().slice(0, 10)}`));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
