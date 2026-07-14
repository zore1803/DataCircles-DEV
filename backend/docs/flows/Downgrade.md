# Flow — Downgrade

> ⚠ **NOT YET AUDITED — and has a KNOWN GAP.** See KNOWN_BILLING_GAPS.md "Gap A".

## Best current understanding

```
User picks lower plan → downgrade SCHEDULED for cycle end (not immediate)
        ▼
subscription.pendingUpdate / pendingPlanChange (downgrade variant) set
        ▼
BillingEvent DOWNGRADE_SCHEDULED
        ▼
At renewal (subscription.charged): the new (lower) plan takes effect
```

## ⚠ KNOWN GAP (Gap A — do NOT "fix" without reading KNOWN_BILLING_GAPS.md)

A scheduled downgrade's `subscription.pendingUpdate` is **never reconciled** at
renewal. Razorpay charges the correct new amount (its plan was switched at
schedule time), but our DB's `planName` / `pricePerUser` / `totalAmount` /
`activeAddons` keep showing the PRE-downgrade plan forever, and `pendingUpdate`
never clears. Deliberately not fixed — on hold pending Razorpay Charge-at-Will
(support ticket referenced in the gap doc).

## Open questions for the audit

- Add-on carry-forward / drop on downgrade.
- Interaction with an in-flight reward reservation (should a downgrade release it?).
- `SCHEDULE_CANCELLED` — can a user cancel a scheduled downgrade before it applies?
