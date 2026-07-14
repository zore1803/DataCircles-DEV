# Flow — Add-on Purchase

> ✅ **AUDITED** (reward/discount + Order path via `initiateAddonPurchase`).
> Add-on *removal* and recurring re-pricing: verify during the add-on audit.

## Happy path (add N of an add-on, e.g. seats)

```
User selects add-on + quantity → initiateAddonPurchase
        ▼
compute prorationAmount for the remaining cycle
        ▼
same-flow recycle: release prior pendingAddonAddition reservation (if any)
        ▼
reserveNextAvailableReward() → applyModifiers → discountedProrationAmount
        ▼
create Razorpay ORDER for (discountedProrationAmount + GST)
        ▼
store subscription.pendingAddonAddition { addonKey, quantity, orderId, referralRewardUsageId, ... }
        ▼
response includes referralDiscountApplied  (⚠ NOT surfaced in the add-on UI — see below)
        ▼
User pays Order → settlement: apply add-on, consumeReservation(), clear pendingAddonAddition
        ▼
BillingEvent ADDON_ADDED
```

## Key facts

- One-time **Order** for the prorated cost now; the add-on's recurring cost joins the subscription from next renewal.
- Reward reduces the Order amount (one-time).
- The recurring amount updates at renewal (add-on becomes part of `activeAddons` / `totalAmount`).

## UI gap (known)

The add-on checkout summary is computed **before** `initiateAddonPurchase`
runs (client/preview), and `initiateAddonPurchase` reserves + discounts only at
confirm-time. So the summary does NOT show the referral discount even though the
Order is charged the discounted amount and the response returns
`referralDiscountApplied`. Surfacing it pre-payment needs a **preview endpoint**
that calls the (currently unused) `resolveModifiers`. Deferred.

## Removal (separate flow) — ⚠ NOT YET AUDITED

Add-on removal is scheduled for cycle end (`scheduleAddonRemoval*`,
`ADDON_REMOVAL_SCHEDULED` / `ADDON_REMOVED` events). Document during the add-on
audit: does removal interact with proration/refunds? What happens to a removal
scheduled then re-added?

## Failure / edge

- Only one add-on purchase at a time (enforced).
- Order creation fails → release reservation.
- Coupons do NOT apply to add-on purchases yet (known gap).
