# Flow — First-Payment Settlement

> ✅ **AUDITED.** This is the central business-event layer. See
> PROJECT_STATE.md §11a (the bug + fix) and BILLING_HANDOFF.md §5.

## The business event

**"First payment confirmed"** for a subscription. Delivered by FIVE transport
paths (Razorpay does not guarantee ordering or that all fire):

| Transport | Handler (subscriptionController.js) |
|---|---|
| webhook `payment.captured` | `handlePaymentCaptured` |
| webhook `subscription.authenticated` | `handleSubscriptionAuthenticated` |
| webhook `subscription.activated` | `handleSubscriptionActivated` |
| webhook `subscription.charged` | `handleSubscriptionCharged` |
| client callback | `verifyPayment` |

## Happy path

```
payment succeeds at Razorpay
        ▼
whichever transport event arrives first
        ▼
handler sets isPaymentConfirmed = true (+ status/dates)
        ▼
runFirstPaymentSettlement(subscription)      ← the ONE business layer
        ├─ maybeRecordCouponRedemption()     (idempotent: no-op if already redeemed)
        └─ maybeQualifyReferral()            (idempotent: no-op if no pending referral)
        ▼
later transport events for the same payment early-return on
`if (isPaymentConfirmed) return;` — BUT they ALSO call runFirstPaymentSettlement
first, so settlement is guaranteed regardless of ordering.
```

`runFirstPaymentSettlement` is wired into **all 8 sites** (each handler's
confirming path + its "already confirmed" early-return).

## Why it's built this way (the bug this prevents)

Originally settlement was wired into only 3 of 5 paths.
`handleSubscriptionCharged` (the confirming event for **UPI AutoPay**) and
`handleSubscriptionActivated` confirmed payment **without** settling → for UPI,
the referral qualified never ran and the reward was never created. Proven from
`appStatusHistory` reason `"subscription charged successfully"`. See §11a.

## Idempotency

Both callees guard on state (`pending` referral / un-`redeemed` coupon), so
calling from multiple racing paths settles **exactly once**. This is what makes
the "call from every path including early-returns" approach safe.

## Failure / retry

- Duplicate webhook → early-return + idempotent settlement = no double effect.
- Payment failed → `handlePaymentFailed` → `appStatus = past_due` + `PAYMENT_FAILED` event. No settlement.

## ⚠ NOT verified at runtime

`consumeReservation` (reward consumption on one-time Orders) fires from the
Order-confirmation path, not this subscription first-payment path — and has
**never been observed completing** (Razorpay test-gateway timeouts). See
`flows/Rewards.md` + BILLING_HANDOFF.md §8. **Top verification priority.**

## Deferred refactor (§11b)

A `confirmFirstPayment()` that also owns the `isPaymentConfirmed`/status/date
writes, making the 5 handlers thin delegators. Needs a per-handler side-effect
inventory first (each does slightly different transport work).
