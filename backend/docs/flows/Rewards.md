# Flow — Reward Reservation → Redemption

> ✅ **AUDITED** (reserve + apply). ⚠ **consume NOT runtime-verified.**
> See `state-machines/Reward.md` and BILLING_HANDOFF.md §6/§8.

## Where rewards can be redeemed

- ✅ Plan **upgrade** (one-time Order) — reserve → apply → consume.
- ✅ **Add-on purchase** (one-time Order) — reserve → apply → consume.
- ❌ **New subscription** — intentionally excluded (Razorpay Subscription = one
  fixed recurring amount; can't discount only the first invoice). Deferred:
  "Future Enhancement (Blocked by Razorpay)".

## Happy path (upgrade or add-on)

```
User opens upgrade/add-on checkout → initiate endpoint runs:
  1. (same-flow recycle) release this org's prior orphaned reservation for THIS flow
  2. reserveNextAvailableReward()  → RewardUsage: reserved   (+ REFERRAL_REWARD_RESERVED)
  3. applyModifiers(prorationAmount, [rewardToModifier(reward)]) → discounted amount
     (maxRewardAmount caps the rupee discount)
  4. create Razorpay Order for the DISCOUNTED amount
  5. store referralRewardUsageId on pendingPlanChange / pendingAddonAddition
        ▼
User pays the Order → payment confirmed
        ▼
consumeReservation(referralRewardUsageId) → RewardUsage: consumed  (+ REFERRAL_REWARD_CONSUMED)
        ▼
Reward no longer available (derived) → dashboard "available" count drops
```

## Reserve-FIRST is deliberate

Reserving before creating the Order guarantees the discount is only ever applied
to an Order backed by a reward we actually hold. Creating the Order first and
reserving after could charge a discounted amount with no reward consumed (a free
discount) if a concurrent checkout took the reward.

## Failure / abandonment

- Order creation fails → `releaseReservation` immediately (don't wait for TTL).
- User abandons → reservation expires after 30 min → `releaseExpiredReservations` (runs inline on next reserve) → reward available again.
- Re-open same checkout → same-flow recycle releases the prior reservation first (no lockout, no double-spend — never crosses upgrade↔add-on).

## UI surfacing

- **Upgrade** modal shows the breakdown + "🎉 you saved ₹X" banner (from backend `referralDiscountApplied`).
- **Add-on** modal does NOT (discount computed at confirm-time, after summary renders — needs a preview endpoint wiring up the unused `resolveModifiers`).

## ⚠ Critical open verification

`consumeReservation` has **never been observed firing on a completed payment**
(every test payment timed out at the Razorpay test gateway). The wiring is
traced but not runtime-proven. **Confirm end-to-end: pay a real upgrade/add-on
while a reward is reserved, then verify RewardUsage flips reserved → consumed and
"available" drops by 1.**
