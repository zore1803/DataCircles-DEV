# Flow — Renewal

> ⚠ **NOT YET AUDITED.** Scaffold only. Verify against `handleSubscriptionCharged`.

## Best current understanding

```
Razorpay auto-charges at cycle end → webhook subscription.charged → handleSubscriptionCharged
        ▼
if this is a RENEWAL (a charge on an already-confirmed subscription, first record):
        BillingEvent RENEWAL
        ▼
update currentPeriodStart/End, nextBillingDate; appStatus stays/returns active
```

## Confirmed facts

- `handleSubscriptionCharged` distinguishes first-charge (covered by SUBSCRIPTION_CREATED) from a true renewal, and only emits `RENEWAL` for the latter (`isFirstRecord && isPaymentConfirmed`).
- It also calls `runFirstPaymentSettlement` (idempotent no-op on renewals — no pending referral/coupon left to settle).

## Open questions for the audit

- Does a scheduled downgrade take effect here? (see Gap A — it doesn't reconcile.)
- Coupon recurring discount: is it re-applied/kept each renewal correctly?
- Failed renewal → `past_due` → recovery path (`handleSubscriptionCharged` recovery vs `handleSubscriptionHalted`).
