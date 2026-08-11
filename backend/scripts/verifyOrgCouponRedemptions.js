// scripts/verifyOrgCouponRedemptions.js
//
// Fixture-based verification for the new Super Admin per-organization coupon
// redemption endpoint (couponController.getOrganizationRedemptions) — the
// coupon-side counterpart to referralAdminController.getOrganizationReferralOverview.
//
// WRITES disposable documents and deletes them after — do NOT point this at
// a production database.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyOrgCouponRedemptions.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const Coupon = require('../models/Coupon');
const CouponRedemption = require('../models/CouponRedemption');
const { getOrganizationRedemptions } = require('../controllers/couponController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], Coupon: [], CouponRedemption: [] };
  try {
    await fn(registry);
    passed++;
    console.log(`  ok - ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL - ${name}`);
    console.error(err);
  } finally {
    await cleanup(registry);
  }
}

async function cleanup(registry) {
  await CouponRedemption.deleteMany({ _id: { $in: registry.CouponRedemption } });
  await Coupon.deleteMany({ _id: { $in: registry.Coupon } });
  await Organization.deleteMany({ _id: { $in: registry.Organization } });
}

async function trackedCreate(Model, key, registry, doc) {
  const created = await Model.create(doc);
  registry[key].push(created._id);
  return created;
}

function mockReqRes(params) {
  let statusCode = 200;
  let jsonBody = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { jsonBody = body; return this; },
  };
  return { req: { params }, res, getResult: () => ({ statusCode, jsonBody }) };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('Super Admin: per-organization coupon redemption history\n');

  await test('returns real redemptions for the given org, sorted newest-first, isolated from other orgs', async (registry) => {
    const orgA = await trackedCreate(Organization, 'Organization', registry, { name: 'RedemptionsOrgA', code: `redA-${Date.now()}` });
    const orgB = await trackedCreate(Organization, 'Organization', registry, { name: 'RedemptionsOrgB', code: `redB-${Date.now()}` });
    const coupon = await trackedCreate(Coupon, 'Coupon', registry, {
      code: `ORGRED-${Date.now()}`, name: 'Org Redemptions Fixture', scope: { type: 'global' },
      rules: [{ productType: 'plan', productKey: 'growth', discountType: 'fixed', discountValue: 50 }],
      duration: { type: 'lifetime' },
    });

    const older = await trackedCreate(CouponRedemption, 'CouponRedemption', registry, {
      coupon: coupon._id, couponCode: coupon.code, organization: orgA._id,
      baseAmount: 450, discountAmount: 50, finalAmount: 400, redeemedAt: new Date(Date.now() - 60000),
    });
    const newer = await trackedCreate(CouponRedemption, 'CouponRedemption', registry, {
      coupon: coupon._id, couponCode: coupon.code, organization: orgA._id,
      baseAmount: 450, discountAmount: 50, finalAmount: 400, redeemedAt: new Date(),
    });
    // A redemption for a DIFFERENT org — must never appear in orgA's results.
    await trackedCreate(CouponRedemption, 'CouponRedemption', registry, {
      coupon: coupon._id, couponCode: coupon.code, organization: orgB._id,
      baseAmount: 450, discountAmount: 50, finalAmount: 400, redeemedAt: new Date(),
    });

    const { req, res, getResult } = mockReqRes({ organizationId: orgA._id.toString() });
    await getOrganizationRedemptions(req, res);
    const { statusCode, jsonBody } = getResult();
    assert.equal(statusCode, 200, `Expected 200, got ${statusCode}: ${JSON.stringify(jsonBody)}`);
    assert.equal(jsonBody.redemptions.length, 2, 'Expected exactly the 2 redemptions belonging to orgA, not orgB\'s');
    assert.equal(String(jsonBody.redemptions[0]._id), String(newer._id), 'Expected newest-first ordering');
    assert.equal(String(jsonBody.redemptions[1]._id), String(older._id));
    assert.equal(jsonBody.redemptions[0].coupon.code, coupon.code, 'Expected the coupon to be populated with its code');
  });

  await test('org with no redemptions: empty array, not an error', async (registry) => {
    const org = await trackedCreate(Organization, 'Organization', registry, { name: 'NoRedemptionsOrg', code: `noredemp-${Date.now()}` });
    const { req, res, getResult } = mockReqRes({ organizationId: org._id.toString() });
    await getOrganizationRedemptions(req, res);
    const { statusCode, jsonBody } = getResult();
    assert.equal(statusCode, 200);
    assert.deepEqual(jsonBody.redemptions, []);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
