# Annual Billing — Verified Scope

This supersedes the informal handoff conversation on annual billing. That conversation
treated several design-doc concepts as "already built, just extend it." They are not.
Everything below was checked directly against the current code (not against docs) on
2026-07-31; file:line citations are given so this doesn't rot the same way the deleted
architecture docs did.

## What actually exists today

| Claim | Status | Evidence |
|---|---|---|
| Billing Anchor (fixed, never resets) | **Not implemented** | `Subscription.js:116-118` has only `currentPeriodStart/End`/`nextBillingDate`; `renewalEngine.js:455` overwrites `nextBillingDate` every renewal — a rolling date, not an anchor. |
| Per-component (per-add-on) anchor/realignment | **Not implemented** | One subscription-level `billingCycle` (`Subscription.js:107-111`); `activeAddons` (`128-135`) has no cycle or anchor field. |
| Per-line-item coupon/referral application | **Partial** | `pricingEngine.js` builds a real `addonBreakdown` for display, but discounts apply against one aggregated `runningTotal`; coupon default is `appliesTo: 'entire_invoice'`. |
| Same add-on as Monthly + Annual simultaneously | **Not implemented, unguarded** | `activeAddons` keys only on `addonKey`, no cycle discriminator — two instances would collide, not coexist. |
| Monthly→Annual (or Annual→Monthly) mid-term proration | **Not implemented** | `prorationMath.js` only covers plan upgrades and add-on purchases. `ScheduledChange.js:23` lists `BILLING_CYCLE_CHANGE` as a valid enum value but its own header comment says the collection is "NOT READ BACK BY ANYTHING YET" — a write-only stub. |
| Mandate capacity ceiling enforced before charging | **Was not implemented** (fixed this session) | `mandateMaxAmount` is real and populated (`Subscription.js:50`, `cawAcquisition.js:71-72`), computed as `firstInvoice × headroom multiplier` (default 2x, not a hardcoded ₹10k/15k). Nothing compared `invoice.total` to it before calling Razorpay — see fix below. |

**Bottom line:** the annual-billing conversation's "already settled, just extend it" framing
is wrong for nearly every item. Billing Anchor, per-component realignment, per-item modifier
application, dual-cycle add-on coexistence, and cycle-change proration are all greenfield
work, not extensions of something already built. Only the *concepts* (not the code) exist,
in `docs/audit/CAW_BILLING_DESIGN.md` and related design docs.

## Phase 1 — Billing Anchor (landed, verified)

Added `Subscription.billingAnchor` (Date, default null), written exactly once by
`runFirstPaymentSettlement` — the single confirmed funnel point every first-payment path
(fresh signup, trial conversion, legacy paths) already calls through, so no per-call-site
duplication was needed.

One real bug surfaced during verification, fixed before landing: plain `immutable: true`
would have silently discarded the *first* real write in production, not just later
overwrites — Mongoose's default immutable behavior blocks a path once `isNew` is false, and
every real subscription is already persisted (non-new) by the time first payment settles.
Fixed with the function form `immutable: function() { return this.billingAnchor != null }`,
which is immutable only once actually set. Verified with a dedicated fixture script
(`scripts/verifyBillingAnchorImmutable.js`, 4/4 passing): null before payment, set once on
settlement, unchanged on a repeated settlement call (racing-path safety), and a direct
overwrite attempt on an already-set value is rejected.

Existing regression suites (`verifyScheduledChangeRenewal.js` 9/9,
`verifyRetryEngine.js` 6/6, `verifyTrialConversionCAW.js`) all still pass — no behavior
change for anything that doesn't touch this new field. `grep billingAnchor` returns only the
schema, the one write site, and this doc — nothing reads it yet, as intended.

Not done in this phase (explicitly deferred): backfilling `billingAnchor` on subscriptions
created before this field existed. Scope that separately if/when Phase 3's proration logic
needs every existing subscription to have one.

## Fixed this session (mandate-ceiling gap, unrelated to annual billing)

`renewalEngine.js` now checks `billingInvoice.total > subscription.mandateMaxAmount` before
calling `chargeMandateFn`, returning the same clean `PAST_DUE` shape the code already uses
for a Razorpay-declined charge (reason `MANDATE_CAPACITY_EXCEEDED`), instead of relying on
Razorpay to reject the request. `retryRenewal()` calls `renewSubscription()` internally, so
this covers the retry path too, no separate guard needed there.

Verified: `scripts/verifyScheduledChangeRenewal.js` (9/9 passing) and `scripts/verifyRetryEngine.js`
(6/6 passing) both still pass with the new guard in place — no regression to existing
renewal/retry/repair-forward idempotency behavior.

## Data model gap blocking everything else

Items 1, 2, and 4 above all trace back to one root cause: `activeAddons` is a flat list of
`{addonKey, quantity, pricePerUnit, addedAt}` and the subscription has one `billingCycle`.
There is no unit of billing that has its own cycle + anchor independent of the subscription.

To make annual billing (and dual-cycle add-ons) possible at all, `activeAddons` entries need,
at minimum:

```
activeAddons: [{
  addonKey: String,
  quantity: Number,
  pricePerUnit: Number,
  billingCycle: { type: String, enum: ['monthly', 'yearly'], required: true },
  addedAt: Date,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,      // this component's own anchor-derived window
}]
```

with the uniqueness assumption changed everywhere from "one entry per `addonKey`" to "one
entry per `(addonKey, billingCycle)`" — every read site (`activeAddons.find/filter` by
`addonKey` alone) needs auditing, not just the schema. This is a real migration (existing
subscriptions' `activeAddons` need a `billingCycle` backfilled from the subscription's own
`billingCycle` at write time) and should be its own scoped, reversible phase — evolutionary,
not a rewrite, consistent with how the CAW migration itself was phased.

Base-plan Billing Anchor is a smaller, separate change: add an immutable `billingAnchor`
(or reuse `currentPeriodStart` from the *first* period only, captured once and never
overwritten) set at first successful payment, read by any future cycle-change/renewal logic
instead of the currently-mutated `nextBillingDate`.

## Recommended order

1. Land the add-on data-model migration (schema + backfill + read-site audit) — nothing else
   is buildable without it.
2. Add the base-plan `billingAnchor` field, written once, read everywhere renewal/cycle-change
   logic currently reads `nextBillingDate` for "when did this start."
3. Only then implement Monthly↔Annual transition logic and its proration formula — building
   it against the current data model would need to be redone once step 1 lands.
4. Per-line-item modifier application (coupon/referral) is a `pricingEngine.js` change,
   independent of 1-3 — can be done in parallel if desired, but has no dependents blocking it.

Do not build a parallel `AnnualSubscription`/`AnnualInvoiceCalculator`/`AnnualAddonEngine` —
extend `Subscription`, `activeAddons`, `calculateInvoice()`/`pricingEngine.js`, and the
existing coupon/referral modifiers in place, per the same principle the CAW migration itself
followed.
