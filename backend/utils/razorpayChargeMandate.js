// utils/razorpayChargeMandate.js
//
// Production chargeMandateFn for CAW renewal/retry charging, injected into
// renewSubscription() (utils/renewalEngine.js) and retryRenewal()
// (utils/retryEngine.js).
//
// NOT ported from committed code — no such code exists. The CAW validation
// evidence in docs/audit/CHARGE_AT_WILL_VALIDATION.md is its own explicit
// admission: "Scripts live outside the repo, in the session scratchpad
// directory, and are not committed." What's preserved there is prose
// description + response JSON from throwaway, uncommitted scratch scripts —
// not an implementation to port. This file is newly written directly
// against Razorpay's own recurring-payment API (the installed SDK,
// razorpay@2.9.6, has `payments.createRecurringPayment()`, which POSTs to
// exactly `/payments/create/recurring` — confirmed by reading
// node_modules/razorpay/dist/resources/payments.js).
//
// `recurring: '1'` (string), not `recurring: true` (boolean): the
// validation doc's ONE end-to-end success charging an existing token
// (Finding B, CHARGE_AT_WILL_VALIDATION.md:334-335) used the string form and
// it worked (HTTP 200, correct payment.captured -> order.paid webhook
// sequence). The doc's `recurring: true` boolean reference (line 389) is a
// DIFFERENT field on a DIFFERENT flow — the checkout-widget's own config
// option during new-mandate registration (Acquisition), which is a
// separate, currently-blocked capability, not this charge-an-existing-token
// path. Confirmed live against the real test-mode account (see this file's
// companion manual-invocation run) before being treated as settled.
//
// Owns ONLY the external payment call. No invoice creation, no
// CommercialTransaction/Subscription mutation, no idempotency guard — that
// protection already lives entirely in CommercialTransaction/repair-forward/
// Retry Engine, per the validated finding that Razorpay itself will happily
// execute a duplicate recurring charge if this function is called twice for
// the same intent. If you are called, a charge is attempted — no guard here.
//
// Contract (unchanged, matches what renewSubscription()/retryRenewal()
// already expect):
//   resolve { success: true, paymentId, orderId }  — charge confirmed.
//   resolve { success: false, reason }             — Razorpay definitively,
//     synchronously rejected the charge (e.g. mandate max_amount exceeded,
//     invalid/expired token) — a clean failure, not an unknown outcome.
//   throw                                          — anything ambiguous
//     (network failure, unexpected response shape) — renewSubscription()
//     routes this to RECONCILIATION_NEEDED rather than assuming failure,
//     which is the whole point of that branch existing.

const razorpay = require('../config/razorpay');

// Razorpay's SDK wraps a definitive API-level rejection as a thrown
// { statusCode, error } object (see node_modules/razorpay/dist/api.js's
// normalizeError: `throw { statusCode: err.response.status, error:
// err.response.data.error }`). That line itself reads `err.response.status`
// unconditionally — if there's no HTTP response at all (a real network
// failure: timeout, connection reset, DNS failure), normalizeError throws a
// bare TypeError instead, which does NOT have this shape. That accidental
// SDK behavior is exactly the signal used here to tell "Razorpay definitely
// said no" from "we don't know what happened" without inventing a new
// distinction.
function isDefiniteApiRejection(err) {
  return !!err && typeof err.statusCode === 'number' && !!err.error;
}

/**
 * @param {Object} params
 * @param {Object} params.subscription - Subscription document; must already
 *   carry `mandateTokenId` and `razorpayCustomerId` (both are set by CAW
 *   onboarding, Phase 2/3 — renewSubscription() only calls this after its
 *   own `mandateTokenId` gate, so both are expected present here).
 * @param {Number} params.amount - charge amount in RUPEES (same unit as
 *   BillingInvoice.total / calculateInvoice()'s output — converted to paise
 *   here, matching the `Math.round(rupees * 100)` convention already used
 *   elsewhere in this codebase, e.g. subscriptionController.js).
 */
async function chargeMandateFn({ subscription, amount }) {
  if (!subscription.mandateTokenId || !subscription.razorpayCustomerId) {
    // Not a Razorpay-side outcome at all — a precondition this codebase's
    // own gating should have already guaranteed. Throwing (not resolving
    // success:false) is correct: this is a data-integrity bug, not a
    // legitimate "charge declined" business outcome.
    throw new Error(
      `chargeMandateFn: subscription ${subscription._id} is missing mandateTokenId/razorpayCustomerId — cannot build a recurring-payment request.`
    );
  }

  const amountPaise = Math.round(amount * 100);

  // Razorpay's own Customer record is the authoritative source for
  // email/contact — both mandatory fields on the recurring-payment request
  // per the SDK's own types (RazorpayPaymentBaseRequestBody) — rather than
  // this codebase's own User model, since the customer/token pair was
  // already registered with Razorpay independently of whichever internal
  // user happens to be the org admin today.
  const customer = await razorpay.customers.fetch(subscription.razorpayCustomerId);

  // Razorpay caps `receipt` at 40 chars (confirmed against the real API —
  // an earlier version of this string, `renewal_${_id}_${Date.now()}`, was
  // 46 chars and was rejected with a 400). Kept well under the limit rather
  // than trimmed to exactly fit.
  const receipt = `rnw_${subscription._id.toString().slice(-12)}_${Date.now().toString(36)}`;

  try {
    // payment_capture set explicitly, per the validated flow — never left
    // to a Razorpay default. Order creation is inside this try block too:
    // a rejected Order (e.g. bad receipt, invalid amount) is exactly as
    // classifiable as a rejected recurring-payment call — both are
    // Razorpay-side API responses, not a separate class of error.
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      payment_capture: true,
      receipt,
      notes: { subscriptionId: String(subscription._id), organizationId: String(subscription.organization) },
    });

    const result = await razorpay.payments.createRecurringPayment({
      amount: amountPaise,
      currency: 'INR',
      order_id: order.id,
      customer_id: subscription.razorpayCustomerId,
      token: subscription.mandateTokenId,
      recurring: '1',
      email: customer.email,
      contact: customer.contact,
      description: `Renewal charge for subscription ${subscription._id}`,
      notes: { subscriptionId: String(subscription._id) },
    });

    return {
      success: true,
      paymentId: result.razorpay_payment_id,
      orderId: result.razorpay_order_id || order.id,
    };
  } catch (err) {
    if (isDefiniteApiRejection(err)) {
      return {
        success: false,
        reason: err.error?.description || err.error?.code || 'CHARGE_REJECTED',
      };
    }
    // Ambiguous — network-level failure or unexpected shape. Rethrow so
    // renewSubscription()'s own catch routes this to RECONCILIATION_NEEDED
    // rather than this adapter guessing at an outcome it doesn't know.
    throw err;
  }
}

module.exports = { chargeMandateFn };
