# Flow — Coupons

> ⚠ **NOT YET AUDITED in depth** (coupons work; out of scope until the coupon
> audit). Scaffold from surface knowledge. See `state-machines/Coupon.md`.

## Best current understanding

```
Super Admin creates coupon (global / plan-specific / add-on-specific, recurring)
        ▼
User enters/apply coupon at checkout → validated FRESH (no reservation) via discount engine
        ▼
Discount shown in the plans-page pricing (recurring discount attached to subscription)
        ▼
First payment settles → maybeRecordCouponRedemption() records the redemption
        ▼
Coupon applies EVERY billing cycle (recurring), unlike one-time referral rewards
```

## Confirmed facts

- Coupons are **recurring**; referral rewards are **one-time**. Different lifecycles — do not merge the models.
- Redemption is recorded at settlement (same layer as referral qualification).
- Super Admin management lives in `CouponManagement.jsx` (untouched, works) under the "Promotions & Rewards → Coupons" tab.
- Coupon + referral reward currently **always stack** (`stacksWithCoupons` is unenforced — see PROJECT_STATE.md §11d).

## Open questions for the audit

- Full redemption model + limits enforcement (`maxRedemptions`, per-org).
- Coupons on add-on purchases (currently NOT applied — known gap).
- Duration types beyond `lifetime`/`until_cancelled` (shown-but-disabled).
- Coupon + upgrade/downgrade interactions.
