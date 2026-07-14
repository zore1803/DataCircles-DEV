# Flow — New Subscription

> ⚠ **NOT YET FULLY AUDITED.** Best-effort from code reading. Verify the
> Razorpay Subscription creation + webhook sequence during the settlement audit.

## Happy path (best current understanding)

```
User picks plan + cycle (+ optional coupon, + referral code already captured/applied)
        ▼
createSubscription → creates a Razorpay SUBSCRIPTION for totalAmount (recurring)
        ▼
Razorpay redirects/authorizes → transport events fire (see flows/Settlement.md)
        ▼
first payment confirmed → runFirstPaymentSettlement:
        ├─ maybeRecordCouponRedemption()  (coupon applies recurring)
        └─ maybeQualifyReferral()         (if this org was itself referred)
        ▼
Subscription active; BillingEvent SUBSCRIPTION_CREATED
```

## Confirmed facts

- The recurring amount = base plan + add-ons − coupon (referral reward is NOT applied to a new subscription — Razorpay recurring limitation).
- Referral rewards are earned here (if the org was referred) but not *spent* here.
- Coupon is recurring (every cycle).

## Open questions for the audit

- Exact webhook sequence for UPI AutoPay vs card (which event confirms first — drives settlement; see the §11a bug).
- Trial-first vs pay-first paths: does a new subscription always start as `trial`?
- `verifyPayment` vs webhook race — both now settle idempotently, but confirm no double `SUBSCRIPTION_CREATED`.
- GST computation on the recurring amount vs the first charge.
