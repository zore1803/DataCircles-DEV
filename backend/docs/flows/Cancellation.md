# Flow — Cancellation

> ⚠ **NOT YET AUDITED.** Scaffold only.

## Best current understanding

```
User cancels → cancelAtPeriodEnd = true (stays active until period ends)
        ▼
At period end → appStatus = cancelled   (+ SUBSCRIPTION_CANCELLED)
```
Immediate vs end-of-period cancellation, and Razorpay subscription cancel call,
must be verified.

## Open questions for the audit

- Immediate cancel vs cancel-at-period-end: both supported? which is default?
- Does cancellation revoke/release any live reward reservation?
- Access after cancellation (until period end vs immediate).
- Re-subscribe after cancel → new Subscription contract (not a back-transition).
- Refund handling (`REFUND` event exists — when is it emitted?).
