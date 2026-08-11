// scripts/manualInvokeBillingJobs.js
//
// Manual-trigger utility for the newly-wired cron jobs (jobs/renewalLifecycleJobs.js).
// Per the cron-wiring brief's Step 4: "wired correctly" is not "confirmed to run" —
// this calls runRenewalJob()/runRetryJob() directly, once each, against disposable
// subscriptions using the REAL chargeMandateFn (utils/razorpayChargeMandate.js)
// against the live test-mode Razorpay account, and prints the actual output.
//
// WRITES disposable documents and deletes them after — do NOT point this at a
// production database. Kept as a documented manual-trigger utility (not deleted
// after use), per the brief's own Step 5 choice, since this project's established
// pattern is to keep verification scripts rather than leave a stray untracked file.
//
// Run with: CONFIRM_TEST_DB=yes MONGO_URI=<disposable db> node scripts/manualInvokeBillingJobs.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Subscription = require('../models/Subscription');
const CommercialTransaction = require('../models/CommercialTransaction');
const BillingInvoice = require('../models/BillingInvoice');
const BillingCycle = require('../models/BillingCycle');
const { runRenewalJob, runRetryJob } = require('../jobs/billingOrchestration');
const { chargeMandateFn } = require('../utils/razorpayChargeMandate');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents, and makes REAL charges against the configured Razorpay account. Set CONFIRM_TEST_DB=yes and point MONGO_URI at a disposable/test database first.');
  process.exit(1);
}

// The same live, chargeable test-mode token used throughout this session's
// real Razorpay verification (max_amount 76700 paise / ₹767).
const REAL_TEST_MANDATE_TOKEN_ID = 'token_TBnT7mU4PdTbV2';
const REAL_TEST_RAZORPAY_CUSTOMER_ID = 'cust_T8EOR3KdzSWvZT';

const created = { Subscription: [], CommercialTransaction: [], BillingInvoice: [], BillingCycle: [] };
async function trackedCreate(Model, key, doc) {
  const doc_ = await Model.create(doc);
  created[key].push(doc_._id);
  return doc_;
}
async function cleanup() {
  await BillingCycle.deleteMany({ _id: { $in: created.BillingCycle } });
  await BillingInvoice.deleteMany({ _id: { $in: created.BillingInvoice } });
  await CommercialTransaction.deleteMany({ _id: { $in: created.CommercialTransaction } });
  await Subscription.deleteMany({ _id: { $in: created.Subscription } });
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected\n');

  try {
    // ---- runRenewalJob(): one CAW subscription, due now, real charge ----
    const organization1 = new mongoose.Types.ObjectId();
    const now = new Date();
    await trackedCreate(Subscription, 'Subscription', {
      organization: organization1,
      planName: 'starter',
      appStatus: 'active',
      billingCycle: 'monthly',
      pricePerUser: 100, // small, well under the token's 76700-paise max_amount
      userCount: 1,
      totalAmount: 100,
      mandateTokenId: REAL_TEST_MANDATE_TOKEN_ID,
      razorpayCustomerId: REAL_TEST_RAZORPAY_CUSTOMER_ID,
      currentPeriodStart: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: now,
      nextBillingDate: now,
      activeAddons: [],
    });

    console.log('=== runRenewalJob() — manual invocation, real chargeMandateFn ===');
    const renewalResults = await runRenewalJob({ chargeMandateFn });
    console.log(JSON.stringify(renewalResults, null, 2));

    // ---- runRetryJob(): one past_due CAW subscription with a PRICED
    // RENEWAL transaction pending, real charge ----
    const organization2 = new mongoose.Types.ObjectId();
    const pastDueSub = await trackedCreate(Subscription, 'Subscription', {
      organization: organization2,
      planName: 'starter',
      appStatus: 'past_due',
      billingCycle: 'monthly',
      pricePerUser: 100,
      userCount: 1,
      totalAmount: 100,
      mandateTokenId: REAL_TEST_MANDATE_TOKEN_ID,
      razorpayCustomerId: REAL_TEST_RAZORPAY_CUSTOMER_ID,
      currentPeriodStart: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: now,
      nextBillingDate: now,
      activeAddons: [],
      appStatusHistory: [{ from: 'active', to: 'past_due', reason: 'manual invocation fixture', at: new Date(now.getTime() - 25 * 60 * 60 * 1000) }],
    });
    const billingInvoice = await trackedCreate(BillingInvoice, 'BillingInvoice', {
      organization: organization2, subscription: pastDueSub._id, reason: 'RENEWAL',
      lineItems: [], subtotal: 100, discount: 0, taxable: 100, gst: 18, total: 118,
      status: 'PENDING_PAYMENT',
    });
    await trackedCreate(CommercialTransaction, 'CommercialTransaction', {
      organization: organization2, subscription: pastDueSub._id, type: 'RENEWAL', status: 'PRICED',
      target: { billingInvoice: billingInvoice._id, total: 118, newPeriodStart: now, newPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), appliedScheduledChangeIds: [] },
      latestInvoice: billingInvoice._id,
    });

    console.log('\n=== runRetryJob() — manual invocation, real chargeMandateFn ===');
    const retryResults = await runRetryJob({ chargeMandateFn });
    console.log(JSON.stringify(retryResults, null, 2));

    // runRenewalJob()/runRetryJob() create CommercialTransaction/BillingInvoice/
    // BillingCycle documents INTERNALLY (inside renewSubscription()) — those were
    // never passed through trackedCreate() above, so sweep for them by
    // subscription reference before cleanup, or they leak. (Found by actually
    // checking the database after a run, not assumed safe.)
    const allSubIds = created.Subscription;
    const [cts, bis, bcs] = await Promise.all([
      CommercialTransaction.find({ subscription: { $in: allSubIds } }, '_id'),
      BillingInvoice.find({ subscription: { $in: allSubIds } }, '_id'),
      BillingCycle.find({ subscription: { $in: allSubIds } }, '_id'),
    ]);
    created.CommercialTransaction.push(...cts.map((d) => d._id));
    created.BillingInvoice.push(...bis.map((d) => d._id));
    created.BillingCycle.push(...bcs.map((d) => d._id));
  } finally {
    await cleanup();
    console.log('\n✅ Cleanup complete — all disposable documents removed.');
    await mongoose.disconnect();
  }
}

main().catch(async (err) => {
  console.error('❌ Script error:', err);
  await cleanup().catch(() => {});
  process.exit(1);
});
