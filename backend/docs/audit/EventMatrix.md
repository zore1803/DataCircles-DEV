# Audit — Event Matrix

> **Living document.** Goal: every important business action produces exactly
> one `BillingEvent`, and every side-effect is intentional + idempotent. Fill
> during the audit. Columns: Event · Fired by · Idempotent? · BillingEvent · Email? · Analytics?

## Confirmed BillingEvent types (from models/BillingEvent.js enum)

```
SUBSCRIPTION_CREATED, TRIAL_STARTED, TRIAL_ENDED, PLAN_UPGRADE, PLAN_DOWNGRADE,
DOWNGRADE_SCHEDULED, BILLING_CYCLE_CHANGE_SCHEDULED, SCHEDULE_CANCELLED,
ADDON_ADDED, ADDON_REMOVAL_SCHEDULED, ADDON_REMOVED, COUPON_APPLIED,
COUPON_CHANGED, COUPON_REMOVED, PAYMENT_SUCCESS, PAYMENT_FAILED, RENEWAL,
SUBSCRIPTION_CANCELLED, REFUND, CREDIT_APPLIED, ADMIN_ADJUSTMENT,
REFERRAL_RECORDED, REFERRAL_REWARD_EARNED, REFERRAL_REWARD_RESERVED,
REFERRAL_REWARD_RELEASED, REFERRAL_REWARD_CONSUMED, REFERRAL_REWARD_REVOKED,
REFERRAL_REWARD_EXPIRED, REFERRAL_DISABLED
```
`status` ∈ {completed, scheduled, failed, cancelled}.

## Seeded rows (verify/complete during audit)

| Business event | Fired by | Idempotent? | BillingEvent | Email | Analytics |
|---|---|---|---|---|---|
| First payment confirmed | runFirstPaymentSettlement (5 paths) | yes (state-guarded) | (via sub-effects) | ? | ? |
| Referral recorded | recordReferralIntent | yes (unique index) | REFERRAL_RECORDED | no | ? |
| Referral qualified | maybeQualifyReferral | yes | REFERRAL_REWARD_EARNED ×2 | ? | ? |
| Reward reserved | reserveNextAvailableReward | yes (partial unique idx) | REFERRAL_REWARD_RESERVED | no | ? |
| Reward consumed | consumeReservation | yes (atomic cond.) | REFERRAL_REWARD_CONSUMED | no | ? |
| Reward released | releaseReservation / expiry | yes | REFERRAL_REWARD_RELEASED | no | ? |
| Coupon redeemed | maybeRecordCouponRedemption | yes (redeemed flag) | ⚠ which event? verify | ? | ? |
| Plan upgrade applied | upgrade settlement | ? | PLAN_UPGRADE | ? | ? |
| Add-on added | add-on settlement | ? | ADDON_ADDED | ? | ? |
| Payment failed | handlePaymentFailed | ? | PAYMENT_FAILED | ? | ? |
| Renewal | handleSubscriptionCharged | guarded (isFirstRecord) | RENEWAL | ? | ? |

## Audit questions

- Is there a single `FIRST_PAYMENT_CONFIRMED` event, or only PAYMENT_SUCCESS? (enum has PAYMENT_SUCCESS, not FIRST_PAYMENT_CONFIRMED — confirm what's emitted where.)
- Any event emitted from MORE than one path (duplication risk)?
- Any important action with NO event (gap)?
- Which events should trigger emails/analytics but currently don't?
