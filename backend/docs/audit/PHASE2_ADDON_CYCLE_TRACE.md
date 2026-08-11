# Phase 2 Trace — `activeAddons` Dual-Cycle Feasibility

Research-only. No code changed. This answers the question Phase 1's closeout raised:
**can billing-cycle information be added to `activeAddons` without changing the meaning of
existing monthly-only subscriptions?**

## Answer: No — not by schema addition alone

The schema change itself (`billingCycle` on each `activeAddons` entry, defaulted from the
subscription's own `billingCycle` for pre-existing entries) is additive and safe — every
existing single-cycle subscription is untouched by it. What is **not** safe is the claim that
"every existing code path continues to work unmodified": a large number of call sites key
lookups by `addonKey` alone, not `(addonKey, billingCycle)`. The moment any subscription
actually has two entries sharing an `addonKey` (the entire point of dual-cycle support), these
sites either silently corrupt state or route a purchase/removal to the wrong cycle-variant.
This confirms and extends `ANNUAL_BILLING_SCOPE.md`'s "every read site needs auditing" —
here is the audit.

## Two confirmed bug classes, found repeatedly, not once each

**1. `Map`/`Object.fromEntries` keyed by `addonKey` alone — silently collapses on collision.**
Four separate occurrences build `new Map(activeAddons.map(a => [a.addonKey, a.quantity]))` or
equivalent. The second entry with a shared key silently overwrites the first — no error, just
wrong downstream math (seat counts, carry-forward quantities):
- `utils/downgradeValidator.js:99`
- `controllers/subscriptionController.js:1450-1451` (upgrade carry-forward)
- `controllers/subscriptionController.js:2270` (downgrade carry-forward)
- `controllers/subscriptionController.js:5010` (cancel-scheduled-downgrade)
- `controllers/subscriptionController.js:2726` (`Object.fromEntries`, downgrade preview payload)

**2. `.find()`/`.findIndex()` merge-by-addonKey-alone on write paths — misroutes to the wrong
cycle-variant.** These are the sites where an addon *purchase* or *removal* gets applied —
picking the first matching entry regardless of which cycle it actually belongs to:
- `controllers/subscriptionController.js:3312` — **the core addon-purchase commit site**:
  merges a newly-purchased addon into `activeAddons`. Buying an annual `extra_seat` when a
  monthly `extra_seat` already exists would incorrectly increment the monthly entry instead of
  creating a new annual one.
- `controllers/subscriptionController.js:3657-3662,3684,3746` (upgrade), `:2487,2517,2657,2694`
  (downgrade), `:5082,5087,5095,5113` (cancel-scheduled-downgrade), `:4376` (timeline preview),
  `:5276` (scheduled-removal preview)
- `utils/addonManagement.js:215,235,317` — `scheduleAddonRemoval()` and
  `applyScheduledAddonRemovals()`; the latter runs at renewal rollover and would decrement
  whichever cycle-variant's entry it finds first.
- `utils/addonManagement.js:157-171` — `getAvailableAddonsForOrg()`'s `.find()` for
  "quantity owned" would report only the first cycle-variant's quantity to the frontend,
  understating what the org actually owns.
- `utils/renewalEngine.js:595-599` — `REMOVE_ADDON` ScheduledChange replay at renewal, same
  ambiguity as `addonManagement.js:317`.

## Schema gaps beyond `activeAddons` itself

Every addon-shaped sub-schema on `Subscription.js` mirrors the same addonKey-only identity
assumption and would need its own `billingCycle` field before the read sites above can be
fixed to match on `(addonKey, billingCycle)`:
`pendingUpdate.carriedAddons/removedAddons/reducedAddonDeltas` (`:218-243`),
`pendingUpgrade.activeAddons/droppedAddons` (`:254-270`),
`pendingAddonAddition` (`:272-283`),
`pendingPlanChange.compatibleAddons/reducedAddons/incompatibleAddons/newAddonPurchases`
(`:290-326`), `pendingAddonRemovals` (`:334-343`).
None of this is optional — `renewalEngine.js:595` and `addonManagement.js:317` both read these
pending/scheduled records back and match against live `activeAddons` by `addonKey` alone, so a
scheduled removal or carried-forward addon created without a cycle field has nowhere to record
which cycle it targets.

Also: `authController.js:604-628` (`startAddonPurchase`, the seat-purchase entry point) and
`utils/addonPurchaseLifecycle.js` hardcode a single addon with no cycle parameter at all today
— the API surface itself would need a cycle input before a user could even request "buy an
annual seat" as distinct from "buy a monthly seat."

## What's already safe, no change needed

Not everything touching `activeAddons` is at risk — most of the pricing/entitlement math is
already cycle-agnostic by construction and stays correct under dual-cycle:
- `utils/pricingEngine.js:105-116`, `utils/invoiceEngine.js:130-173` — sum into breakdown
  arrays without deduping; two cycle-variants just become two line items, which is the desired
  display behavior.
- `utils/addonManagement.js:36-51,175-204` (`calculateAddonBoost`, `getSeatStatus`) and
  `middlewares/restrictByPlan.js:175-224` — entitlement boosts and unlock checks sum/OR across
  all matching entries regardless of cycle, which is the *correct* semantics (a monthly and an
  annual instance of the same entitlement-granting addon should both count).
- `utils/billingEvents.js:12-33` — audit-log snapshot is an explicit field allowlist; needs a
  one-line addition to include `billingCycle` once it exists, not a logic rewrite.
- `middlewares/subscriptionCheck.js` — no `activeAddons` references at all.

## Invariant trace (completed before 2a)

Answered by existing spec (`INTENDED_BEHAVIOR_REFERENCE.md`'s Billable Item model): cross-cadence
add-ons are explicitly intended (yearly base + monthly add-on is the literal example given;
symmetric, so monthly base + annual add-on is equally intended), each with its own real
recurring cadence via its own anchor — not a purchase-time tag. Entitlement/seat-counting
already sums across cycle-variants correctly by design (confirmed in code, not just spec).
Invoice breakdowns already sum without deduping. One genuinely open gap: independent-removal
proration/refund mechanics for a dual-cycle addon aren't specified anywhere — scope that
before/alongside 2c, don't assume it. Migration default (backfill from parent subscription's
own billingCycle) is independently confirmed correct by both audit docs, since no dual-cycle
entry exists yet to conflict with it.

## Phase 2a — COMPLETE / VERIFIED

**2a.1 (schema):** Added `billingCycle` to `Subscription.activeAddons` and every pending/
scheduled sub-schema (`pendingUpdate.carriedAddons/removedAddons/reducedAddonDeltas`,
`pendingUpgrade.activeAddons/droppedAddons`, `pendingAddonAddition`,
`pendingPlanChange.compatibleAddons/reducedAddons/incompatibleAddons/newAddonPurchases`,
`pendingAddonRemovals`). Not `required` at the schema level — no existing write path sets it
yet, so requiring it would break every current addon-purchase/upgrade/downgrade write.

**2a.2 (backfill):** `scripts/backfillAddonBillingCycle.js` — dry-run mode by default, explicit
`CONFIRM_TEST_DB`/`CONFIRM_PROD_WRITE` gate for real writes. Run against the configured
database: 9 subscriptions scanned, 3 touched, 8 array entries backfilled from each
subscription's own `billingCycle`, 0 `pendingAddonAddition` entries needed it. Re-run
confirmed idempotent (0 touched on second run).

**Verification:**
- Idempotency: confirmed (dry-run after write shows 0 remaining).
- Regression: `verifyScheduledChangeRenewal.js` (9/9), `verifyRetryEngine.js` (6/6),
  `verifyBillingAnchorImmutable.js` (4/4) — 19/19, no change from pre-migration baseline.
- No read-side dual-cycle behavior introduced: grepped `billingCycle` usage in
  `addonManagement.js` and `subscriptionController.js` — all existing matches reference the
  *subscription's* `billingCycle` (pre-existing behavior); nothing reads `addon.billingCycle`
  anywhere yet.
- Pricing/entitlement/seat-count: unchanged — no code path reads the new field, so nothing
  could have changed.

**Explicitly not done, per scope:** no Map/`.find()`/`.findIndex()` collision-site fixes (2b),
no purchase/removal merge-site fixes (2c), no API cycle parameter (2d), no dual-cycle addon
can be created yet. Stopping here.

## Business contract (confirmed by product owner, supersedes the "symmetric" reading below)

The invariant trace's "the model is symmetric" statement was too broad — the *data model* is
symmetric (either side can hold either cycle), but business/API validation is not:

```
BASE PLAN -> ADD-ON CYCLE RULES
Monthly base plan:
    Monthly add-ons: ALLOWED
    Annual add-ons:  PROHIBITED
Annual base plan:
    Monthly add-ons: ALLOWED
    Annual add-ons:  ALLOWED

IDENTITY
An add-on is uniquely identified by (addonKey, billingCycle).
Monthly and annual instances of the same addonKey are independent billable items —
removing one never touches the other.

REMOVAL
Removing an annual add-on:
    - No refund, no proration, no credit
    - No immediate removal
    - Entitlement remains active until the end of its already-paid annual period
      (a scheduled removal at period end, not an immediate cancellation)
    - The annual period runs from the add-on's OWN purchase date (its own Billing
      Anchor, per INTENDED_BEHAVIOR_REFERENCE.md:141-148 — "the date it was
      purchased" — NOT aligned to the base plan's anchor)

SCHEDULED CHANGES
Before scheduled-change execution: activeAddons remains completely unchanged.
At execution: only the targeted (addonKey, billingCycle) instance is touched.

MANDATE
Ceiling is NOT a fixed constant (verified: cawAcquisition.js:22-24 and
subscriptionController.js:62-64 both compute it as
firstInvoiceRupees * MANDATE_HEADROOM_MULTIPLIER, default multiplier 2,
env-overridable via CAW_MANDATE_HEADROOM_MULTIPLIER) — set once at mandate
acquisition, sufficiently high to cover normal recurring charges including annual
renewals. Annual billing does NOT require redesigning this. If a future charge
(e.g. an annual renewal) exceeds the ceiling, the mandate-guard added in this
session (renewalEngine.js's PAST_DUE/MANDATE_CAPACITY_EXCEEDED check) already
routes it to the correct outcome — customer must pay/reauthorize manually. No new
mandate logic needed for annual billing specifically.
```

This contract is what Phase 2c/2d must implement against. It significantly simplifies 2c: no
refund/proration calculation is needed for annual add-on removal, only a scheduled removal of
the exact `(addonKey, billingCycle)` tuple at period end.

## Phase 2b — COMPLETE / VERIFIED (Map-collision sites only)

Added `addonManagement.addonIdentityKey(addon, fallbackCycle)` — a shared helper keying on
`${remappedFrom || addonKey}::${billingCycle || fallbackCycle}`, so lookups now distinguish
`(addonKey, billingCycle)` instead of `addonKey` alone. The `fallbackCycle` argument (the
subscription's own `billingCycle`) is what keeps this an exact no-op for every current
subscription: no write path sets a real per-addon `billingCycle` yet (that's 2c), so both
sides of every comparison resolve to the same fallback-derived key, identical to
pre-migration behavior.

Fixed 4 of the 5 originally identified sites:
- `downgradeValidator.js:99,111`
- `subscriptionController.js:1450-1451,1459` (upgrade carry-forward)
- `subscriptionController.js:2273-2280` (downgrade carry-forward)
- `subscriptionController.js:5024,5039` (downgrade preview endpoint)

**Deliberately NOT changed:** `subscriptionController.js:2741`,
`Object.fromEntries(survivingCompatibleAddons.map(a => [a.addonKey, a.quantity]))`. Unlike the
other four, this builds the actual wire response the frontend parses as
`{[addonKey]: quantity}` — changing its key shape is an API-surface change (Phase 2d), not a
safe internal fix, since it would break the frontend without a corresponding update. Left
as-is with a comment; the underlying data it reads from is already correct.

**Verification:** `verifyScheduledChangeRenewal.js` (9/9), `verifyRetryEngine.js` (6/6),
`verifyBillingAnchorImmutable.js` (4/4) — 19/19, unchanged baseline. Also ran the trace
scripts that directly exercise the touched carry-forward/downgrade code paths:
`traceDowngradeCarryForward.js`, `traceDowngradeEditableCarryForward.js`,
`traceCancelScheduledDowngrade.js`, `traceDowngradeValidator.js` — all
`ALL ASSERTIONS PASSED`. `traceUpgradeSettlement.js`/`traceIncompatibleUpgradeSettlement.js`
hit a pre-existing, unrelated scaffolding gap (`__test_handlePaymentCaptured` not exported)
before reaching their assertions — not caused by this change; the part that did run showed
the upgrade carry-forward computation still producing correct output.

See "Business contract" above (line 128) for the full confirmed rules — base-plan/add-on cycle
asymmetry, no-refund removal, scheduled-change execution boundary, and the mandate ceiling
mechanism — which 2c/2d must implement against.

## Phase 2c — COMPLETE / VERIFIED (backend semantics only, no API exposure)

Implements cycle-aware purchase/removal against the confirmed business contract above.
Deliberately internal-only: functions gained new optional parameters that default to
existing behavior for every current caller — no route/request body exposes a `billingCycle`
choice yet (that's Phase 2d). Verified by calling the internal functions directly with an
explicit `billingCycle`, proving the semantics before any API surface exists for them.

**Schema:** `activeAddons[].periodEnd` (Date, default null) — set only for `billingCycle:
'yearly'` entries, `addedAt + 1 year`. Monthly entries leave it null and keep following the
subscription's own `currentPeriodEnd`, exactly as before.

**Purchase** (`addonPurchaseLifecycle.js`'s `startAddonPurchase`): gained an optional
`billingCycle` param (default: subscription's own cycle). Enforces the asymmetry — rejects
an annual addon request on a monthly base plan; `pricePerUnit` now resolves from the
requested cycle's catalog price, not always the subscription's; `pendingAddonAddition` now
carries `billingCycle` (previously a write-path gap even though the schema field existed
since 2a).

**Purchase commit** (`subscriptionController.js`'s `handlePaymentCaptured` addon-purchase
merge, ~line 3320): rebuilds `activeAddons` preserving `billingCycle`/`periodEnd` (previously
stripped every write), matches/merges via `addonIdentityKey` instead of `addonKey` alone.
New annual entries get their own `periodEnd`; incrementing an existing instance's quantity
never resets it.

**Removal** (`addonManagement.js`'s `scheduleAddonRemoval`): gained an optional `billingCycle`
param (default: subscription's own cycle). No refund/immediate mutation (unchanged principle,
now cycle-correct): `effectiveAt` is the targeted instance's own `periodEnd` for an annual
entry, or the subscription's `currentPeriodEnd` for a monthly one (identical to pre-2c
behavior). `pendingAddonRemovals` and the `ScheduledChange{REMOVE_ADDON}` payload now carry
`billingCycle`; the `ScheduledChange` lookup query falls back to matching records with no
`billingCycle` field (pre-2c data) when the requested cycle equals the subscription's own —
keeps pre-existing PENDING removals working without a backfill.

**Removal execution, two parallel paths, both fixed:**
- `addonManagement.js`'s `applyScheduledAddonRemovals` (Razorpay-Subscriptions cycle-rollover
  path): now filters `pendingAddonRemovals` into due vs. not-yet-due by `effectiveAt`, applying
  only due ones — previously applied everything unconditionally on every rollover, which would
  have executed a distant annual removal early the moment a monthly component renewed. Not-due
  removals stay in `pendingAddonRemovals`, untouched.
- `renewalEngine.js`'s `applyScheduledChange` `REMOVE_ADDON` case (CAW path): matches via
  `addonIdentityKey`. No date-gating needed here — its caller already queries `ScheduledChange`
  for `effectiveAt <= now` before invoking it, so fixing `effectiveAt` upstream (above) already
  makes this path correct.

**Verification:** new dedicated suite `scripts/verifyDualCycleAddons.js`, 10/10 passing —
monthly-base+monthly (baseline), monthly-base rejects annual, annual-base+monthly,
annual-base+annual (own ~365-day periodEnd), annual-base with both cycles coexisting as two
entries, repurchasing an annual instance increments without resetting `periodEnd`, removing
monthly leaves annual untouched (and vice versa), a scheduled removal leaves `activeAddons`
completely unchanged pre-execution, and a monthly-cycle rollover only executes the due monthly
removal while a future-dated annual removal stays pending. Also re-ran the full 19-fixture
baseline (unchanged) and 6 trace scripts directly exercising the touched purchase/removal/
carry-forward code paths (`traceAddonRemovalTimeline.js` — the real HTTP removal endpoint —
`traceDowngradeGateAndFreeze.js`, `traceDowngradeCarryForward.js`,
`traceDowngradeEditableCarryForward.js`, `traceCancelScheduledDowngrade.js`,
`traceDowngradeValidator.js`) — all pass unchanged, confirming the cycle-fallback default
preserves existing monthly-only behavior exactly.

**Explicitly not done, per scope:** no route/controller request body accepts a `billingCycle`
choice; the frontend still cannot request a specific cycle for a purchase or removal; the
`Object.fromEntries` wire-format site flagged in 2b is still untouched. All of that is Phase 2d.

## Phase 2d.1 — COMPLETE / VERIFIED (API contract, no frontend)

Traced the existing API surface first (see notes above this section): `GET
/subscription/current` already returns the full raw `activeAddons` subdocs including
`billingCycle`/`periodEnd` set by 2a/2c — the read side needed nothing. The gap was entirely
on the write side.

**`POST /subscription/addons/purchase`**: accepts optional `billingCycle` in the request body
(defaults to the subscription's own cycle — every pre-2d caller unaffected). Validates the
enum and the base/addon cycle asymmetry with a clean 400 before calling `startAddonPurchase`
(which re-checks the same rule as its own guarantee, not a skippable duplicate). Response now
echoes `billingCycle` so the frontend knows what will actually be purchased once payment
settles, without a second fetch.

**`POST /subscription/addons/remove`**: accepts optional `billingCycle` (same default),
passed through to `scheduleAddonRemovalUtil`'s existing 4th param. Response echoes
`billingCycle`. Also fixed a genuine bug found while touching this handler: the
Timeline-preview snapshot builder (`projectedActiveAddons`) matched `a.addonKey === addonKey`
alone — a 6th collision site missed by the original Phase 2b sweep, since it lived in a
controller route handler rather than the utils files that sweep covered. Now matches via
`addonIdentityKey`.

**`GET /subscription/addons/remove/preview`** (new): read-only, mirrors
`scheduleAddonRemovalEndpoint`'s exact `effectiveAt` computation without writing anything —
lets the frontend show "this removes on \<date\>" before the user commits. Returns
`{addonKey, billingCycle, quantity, remainingQuantity, effectiveAt, displayName}`.

**Verification:** new `scripts/verifyAddonCycleApiSurface.js`, 6/6 passing — purchase
succeeds and echoes cycle, monthly-base+annual-request rejected with a clean 400, invalid
cycle value rejected, omitted cycle defaults correctly (backward compatibility), preview
reports the right `effectiveAt` without mutating `activeAddons`, and a wrong-cycle lookup on
an existing `addonKey` correctly 404s rather than falsely matching the other cycle's entry.
Also re-ran the full 29-fixture baseline (19 core + 10 Phase 2c) and
`traceAddonRemovalTimeline.js` (the pre-existing HTTP-level removal trace) — all pass
unchanged, now additionally showing `billingCycle: 'monthly'` in its response.

**Explicitly not done:** no frontend change. `SubscriptionPlans.jsx` still calls both
endpoints with only `{addonKey, quantity}` and still doesn't read `billingCycle`/`periodEnd`
from `activeAddons` anywhere. That's Phase 2d.2 — building the actual UX (cycle selection,
per-instance display, the billing-calendar timeline) against this now-complete API contract.

## Recommended path

Do not attempt this as one migration. Break Phase 2 into isolated sub-phases, same discipline
as Phase 1:

1. **Phase 2a — schema only.** Add `billingCycle` to `activeAddons` and every pending/scheduled
   sub-schema listed above, defaulted from the subscription's own `billingCycle` for existing
   entries via a backfill. Nothing reads or enforces it yet. Additive, same risk profile as
   Phase 1.
2. **Phase 2b — fix the `Map`-collision sites.** Five call sites, mechanical fix (key by
   `(addonKey, billingCycle)` instead of `addonKey`), independently testable, no behavior
   change for any subscription that doesn't yet have a dual-cycle entry (which is every
   existing subscription at this point, since nothing can create one yet).
3. **Phase 2c — fix the write/merge sites**, starting with the highest-risk one
   (`subscriptionController.js:3312`, the addon-purchase commit) in isolation, verified with a
   dedicated fixture before touching the upgrade/downgrade/renewal merge sites.
4. **Phase 2d — thread the cycle parameter through the API surface**
   (`authController.js:604-628`, `addonPurchaseLifecycle.js`) so a user can actually request a
   specific cycle for a purchase — only meaningful once 2a-2c are done.

Only after 2a-2d land, verified independently, would it be safe to actually let a real
subscription hold two cycle-variants of the same addon — which is itself a prerequisite for
any Monthly↔Annual add-on transition logic (Phase 3 in the original scope doc's ordering).
