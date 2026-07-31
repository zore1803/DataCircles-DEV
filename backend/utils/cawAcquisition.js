// utils/cawAcquisition.js
//
// Shared Charge-at-Will mandate-acquisition logic (Registration Link
// creation), extracted so every call site that needs to acquire a new CAW
// mandate — currently `createSubscription`'s fresh-signup path and
// `updateSubscription`'s trial-conversion path, eventually the UPI
// cancel-and-recreate branch's CAW replacement too — shares one
// implementation instead of each re-deriving the Razorpay request shape.
//
// `createSubscription` (subscriptionController.js) is NOT refactored onto
// this — it is intentionally left untouched (out of scope for the
// trial-conversion migration) — but its Registration Link logic is what this
// was extracted from, and it is the reference implementation to keep this in
// sync with if Razorpay's request shape ever changes.
const razorpay = require('../config/razorpay');

// Mandate ceiling headroom policy — CONFIGURABLE business policy (see
// CAW_BILLING_DESIGN.md §9 Billing Policy), not architecture. Same env var
// and default as subscriptionController.js's own copy — kept as a separate
// constant here (not re-exported from the controller) so this module has no
// dependency on the controller, only the other way around.
const MANDATE_HEADROOM_MULTIPLIER = Number(process.env.CAW_MANDATE_HEADROOM_MULTIPLIER) || 2;
function computeMandateMaxAmountRupees(firstInvoiceRupees) {
  return firstInvoiceRupees * MANDATE_HEADROOM_MULTIPLIER;
}

// Fix (found via live QA): the stored phone is always a bare 10-digit
// string (authController.js's updateProfile validates only /^\d{10}$/,
// never storing a country code) — but this app is India-only today (per
// its own signup validation), and Razorpay's hosted Registration Link page
// was observed re-prompting the customer for a mobile number it had
// already been given, consistent with receiving a contact value with no
// country code to recognize. Prefixing +91 here, at the Razorpay-request
// boundary only, avoids touching the stored format (still bare 10 digits
// everywhere else — DB uniqueness checks, OTP flows, etc. are unaffected).
function formatContactForRazorpay(phone) {
  if (!phone) return phone;
  return phone.startsWith('+') ? phone : `+91${phone}`;
}

// Razorpay requires `contact` for recurring Registration Links (confirmed
// live during CAW validation: "The contact field is required for recurring
// links"). Throws rather than returning a value so every call site fails the
// same explicit way `createSubscription` already does.
function assertPhoneForRecurring(user) {
  if (!user.phone) {
    const err = new Error(
      'A contact phone number is required to set up recurring billing. Please add one to your profile before subscribing.'
    );
    err.isBillingProfileIncomplete = true;
    throw err;
  }
}

// Creates a Razorpay Registration Link for a customer/plan/cycle. Mirrors
// createSubscription's registrationLinkParams construction exactly (same
// field choices, same reasoning for what's omitted — see that function's own
// comments for why `method`/`expire_at` are left out by default).
async function createRegistrationLinkForOrg({
  user,
  planId,
  billingCycle,
  firstInvoiceRupees,
  receiptPrefix = 'caw',
  mandateMethod,
  expirySeconds = process.env.CAW_REGISTRATION_LINK_EXPIRY_SECONDS,
}) {
  assertPhoneForRecurring(user);

  const amountPaise = Math.round(firstInvoiceRupees * 100);
  const mandateMaxAmountRupees = computeMandateMaxAmountRupees(firstInvoiceRupees);
  const mandateMaxAmountPaise = Math.round(mandateMaxAmountRupees * 100);

  const registrationLinkParams = {
    customer: {
      name: user.name,
      email: user.email,
      contact: formatContactForRazorpay(user.phone),
    },
    type: 'link',
    amount: amountPaise,
    currency: 'INR',
    description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan - ${billingCycle}`,
    subscription_registration: {
      max_amount: mandateMaxAmountPaise,
      ...(mandateMethod ? { method: mandateMethod } : {}),
    },
    // Razorpay caps `receipt` at 40 chars — same constraint as
    // createSubscription's identical receipt construction.
    receipt: `${receiptPrefix}-${user.organization.toString().slice(-12)}-${Date.now().toString(36)}`,
    email_notify: true,
    sms_notify: false,
    notes: {
      organization_id: user.organization.toString(),
      plan_name: planId,
      billing_cycle: billingCycle,
    },
  };
  if (expirySeconds) {
    registrationLinkParams.expire_by = Math.floor(Date.now() / 1000) + Number(expirySeconds);
  }

  const registrationLink = await razorpay.subscriptions.createRegistrationLink(registrationLinkParams);
  return { registrationLink, mandateMaxAmountRupees };
}

module.exports = {
  assertPhoneForRecurring,
  createRegistrationLinkForOrg,
  computeMandateMaxAmountRupees,
  formatContactForRazorpay,
};
