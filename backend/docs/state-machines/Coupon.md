# State Machine — Coupon + Coupon Redemption

> ⚠ **NOT YET AUDITED in depth.** Coupons work and are intentionally
> out-of-scope until the audit reaches them. This is a scaffold from surface
> knowledge — verify against `models/Coupon.js`, `controllers/couponController.js`,
> and the discount engine before trusting.

## Important difference from Rewards

Coupons have **NO reservation concept**. They are validated *fresh* at checkout
time and redemption is recorded at settlement. Do not bolt reservation
semantics onto coupons (and do not merge Coupon with Reward — see
PROJECT_STATE.md / BILLING_HANDOFF.md; the concurrency-safe reservation
lifecycle is Reward-only by design).

## Coupon (definition) — intended states

```
active · scheduled · expired · disabled   (derived from isActive + validity dates)
```
(See `statusOf()` in `frontend/src/pages/CouponManagement.jsx` for the display derivation.)

## Coupon redemption — ⚠ verify

Redemption is recorded once a first payment settles, via
`maybeRecordCouponRedemption()` → discount engine `recordRedemption()`. Coupons
are **recurring** (apply every cycle), unlike one-time referral rewards.

Open questions for the audit:
- Exact redemption record model + states (is there a "reserved" analogue? believed NOT).
- How `maxRedemptions` / `maxRedemptionsPerOrganization` are enforced and whether an abandoned checkout can consume a redemption (design intent: it should NOT).
- Duration types: only `lifetime` / `until_cancelled` are enforced; others are shown-but-disabled in the UI.

## BillingEvents

`COUPON_APPLIED`, `COUPON_CHANGED`, `COUPON_REMOVED`.
