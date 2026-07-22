# Billing Implementation Plan — v1

> **What this is.** The first implementation artifact built against the frozen
> `BILLING_DOMAIN_SPECIFICATION.md` (Version 1.0). Everything here is grounded in a direct audit of
> the actual codebase as it exists today — no invented schema, no assumed architecture. Where the
> code doesn't match the spec, that gap is named explicitly, not glossed over.
>
> **Scope.** Three things: (1) a schema mapping from every domain object in the frozen spec to what
> actually exists today, (2) service/API boundaries the business logic should be reorganized into,
> and (3) a phased migration plan connecting the two. This document does not re-decide any business
> rule — every reference below points back to the chapter of the domain spec that already settled it.

---

## Part 1 — Database / Schema Mapping

### 1.1 Subscription (`backend/models/Subscription.js`, 289 lines)

**Already correct, keep as-is:**
- `organization`, `planName`, `billingCycle`, `pricePerUser`, `userCount`, `totalAmount`, period
  dates, `activeAddons[]` — match the domain model directly.
- `appStatus` (`trial|active|past_due|cancelled|expired|suspended`) — this is exactly the access-state
  axis Chapter 20 describes; the in-file comment already correctly identifies it as the field all
  access-control logic should read.
- The CAW mandate fields (`razorpayCustomerId`, `mandateTokenId`, `mandateStatus`,
  `mandateMaxAmount`, `mandateExpiresAt`, `registrationLinkId`) — these already match the Mandate
  object (Chapter 20, Payment Objects) closely; no schema change needed.
- `appliedCoupon` — already stores a full snapshot (`baseSubtotal`, `recurringSubtotal`,
  `rulesApplied[]`), consistent with Law 3/8's snapshot principle. Keep.

**Already correctly marked for removal, unchanged from the existing plan:**
- `razorpaySubscriptionId`, `razorpayPlanId` — `@deprecated`, Phase 8 removal, per
  `CAW_BILLING_DESIGN.md` §0. No change to this plan.

**⭐ A real database invariant, missing today, confirmed by a legacy finding (`BUG-002`):** the
pre-CAW findings register confirmed `startFreeTrial`'s only precondition is `trialUsed`, there is no
unique index on `Subscription.organization` at all, and every controller does
`Subscription.findOne({organization})` as if exactly one document could ever exist — an organization
with a prior cancelled subscription that never used its trial can get a second `Subscription`
document inserted, and which one `findOne` returns becomes non-deterministic. **The fix is not a
hard unique index on `organization`** — Chapter 12 of the domain spec already decided an Organization
may own *many* Subscription records over its lifetime, with at most one current/active.

**A real ambiguity surfaced while deriving the filter, and it's now resolved and recorded in the
spec itself (Chapter 12), not improvised here:** a first pass at "which `appStatus` values are
non-terminal" reads Chapter 2's state machine and concludes `{trial, active, past_due, suspended}` —
`suspended` is not terminal there, only `cancelled` is. But Chapter 12 separately states "once a
subscription becomes `CANCELLED` or `SUSPENDED`, a trial may be started again" — which only makes
sense if a suspended subscription does **not** block a new one, i.e. behaves like terminal for this
specific purpose. Including `suspended` in the index would make that trial-restart policy a hard
database-constraint violation the moment it was exercised.

**Resolution (now in Chapter 12, superseding its own prior sentence):** rather than encode an answer
to this in the index and leave the contradiction sitting in the spec, the spec now states the actual
rule explicitly — a suspended subscription is **automatically transitioned to `CANCELLED` first**,
as its own real, auditable transition (own `appStatusHistory` entry, own `BillingEvent`), the moment
a new trial/Subscription is created for that organization. By the time the new Subscription document
exists, no `SUSPENDED` Subscription remains for that org — so the index never actually needs to
include `suspended` at all. **Ownership:** this precondition transition belongs to the
**Registration Engine** (Chapter 20 Ownership Matrix), run immediately before inserting the new
Subscription — no other engine may write `SUSPENDED → CANCELLED` outside of this precondition or the
normal Chapter 4.2 cancellation flow.

| `appStatus` | Terminal (frees the org for a new Subscription)? | Why |
|---|---|---|
| `trial` | No | occupies the "current" slot |
| `active` | No | occupies the "current" slot |
| `past_due` | No | still the same subscription, mid-retry (Chapter 2/R2) |
| `suspended` | **Yes, by policy** | not terminal in the general state-machine sense, but Chapter 12's resolution guarantees it never coexists with a newly-created Subscription — the Registration Engine cancels it first |
| `cancelled` | Yes | explicit terminal state, Chapter 2's `any state → cancelled` |
| `expired` | Yes | explicit terminal state (trial exhausted without conversion) |

**Resulting partial unique index — `suspended` deliberately excluded, for the policy reason above,
not because it was overlooked:**
```js
Subscription.schema.index(
  { organization: 1 },
  {
    unique: true,
    partialFilterExpression: {
      appStatus: { $in: ['trial', 'active', 'past_due'] },
    },
  }
);
```
This allows unlimited historical Subscriptions per Organization while making two *simultaneously
current* ones a hard database-level impossibility, matching Chapter 12 exactly instead of either
extreme (today's "no constraint at all" or a naive "one Subscription per org, ever"). If Chapter 12's
auto-cancel resolution is ever revisited, this index must move with it.

**⭐ Pre-deploy safety check, actually run, not assumed:** a partial unique index build fails outright
if any existing document already violates it — and BUG-002's own premise is that no constraint on
`organization` existed before this fix, so a prior race could in principle have left duplicate
non-cancelled Subscriptions for the same org. Queried the real database directly (aggregate:
`appStatus $in ['trial','active','past_due']`, grouped by `organization`, filtered `count > 1`):
**zero organizations violate the invariant** (in fact only 1 `Subscription` document exists in the
database at all, at time of this check). The index is safe to build as-is — no data cleanup step is
required before this ships.

**Connection-target sanity check, actually verified, not assumed** — a "zero violations" result is
only meaningful if it queried the right database. Confirmed directly: `mongoose.connection.db`
lists the full real application schema (`organizations`, `companies`, `deals`, `contacts`, `users`,
`subscriptions`, `subscriptionpayments`, `referrals`, etc. — 45+ collections), not an empty or
unrelated database; `Subscription.collection.collectionName` resolves to `subscriptions`, matching
the raw collection queried; and `organizations` count is **3**, `users` count is **2** — a small,
early-stage tenant base fully consistent with a single live Subscription document, not a sign the
query silently hit a wrong or empty target.

**This check is a point-in-time snapshot, not a standing guarantee.** Any Subscription document
created between this check and the actual `createIndex` call (a separate PR, a manual admin action,
a script) could reintroduce a violation before the index exists to enforce it. **The index should be
built soon after this check, not left pending** — if meaningful time passes before Phase 1's index
creation actually runs, rerun this exact duplicate-check immediately beforehand rather than trusting
this result.

**⚠ Implementation note — this precondition is not yet wired into `startFreeTrial` or any other
Subscription-creation path.** Phase 1 only adds the index itself (which will correctly *reject* a
suspended-and-not-yet-cancelled org's new Subscription at the database level, surfacing the gap
loudly instead of silently). Actually transitioning `SUSPENDED → CANCELLED` as part of registration
is Registration Engine work, sequenced with Phase 3+ once that engine exists — tracked here so it
isn't lost, not implemented as a one-off patch into today's controller.

**🟥 The single largest schema gap versus the frozen spec: five overlapping, inline pending-change
mechanisms exist where the spec calls for exactly one `ScheduledChange` collection (Chapter 16).**

| Current field on `Subscription` | What it actually does today | Target per Chapter 16/20 |
|---|---|---|
| `pendingUpdate` | Plan/price/userCount/billingCycle change awaiting a scheduled date, with `carriedAddons`/`removedAddons` snapshots | `ScheduledChange{type: 'PLAN_CHANGE' \| 'BILLING_CYCLE_CHANGE'}` |
| `pendingUpgrade` | Confirmed by direct grep: **written/read only inside the legacy (non-CAW) webhook branch of `handlePaymentCaptured`.** Not written by the live `updateSubscription` endpoint at all. | Nothing — this is Commercial Transaction territory (an immediate, payment-gated action), and specifically the *legacy* implementation of it. Retire alongside Phase 8, not carried forward. |
| `pendingAddonAddition` | An add-on purchase awaiting payment confirmation (`orderId`, `prorationAmount`) | This is an **immediate, payment-requiring action** — per Chapter 18's resolution, this belongs to `CommercialTransaction`, not `ScheduledChange` at all. Conflating "awaiting payment" with "scheduled for later" on the same Subscription document is exactly the two-different-relationships confusion Chapter 12 resolved for Subscription/Organization — the same fix applies here. |
| `pendingPlanChange` | Confirmed live: written/read by `updateSubscription` (the current plan-change endpoint) and the CAW-compatible branch of `handlePaymentCaptured`. Carries `orderId`, `needsRazorpaySync`, `compatibleAddons[]`/`incompatibleAddons[]` (the carry-forward decision, §3.2), `newAddonPurchases[]` | Split in two: the *scheduling* half → `ScheduledChange{type:'PLAN_CHANGE'}`; the *payment-in-progress* half (`orderId`, sync flags) → `CommercialTransaction` |
| `pendingAddonRemovals[]` | Already an array (correctly modeling "many independent removals coexist," §4.3) with `addonKey`, `scheduledAt`, `effectiveAt` | `ScheduledChange{type:'REMOVE_ADDON'}`, one document per array entry today |

**Why this matters enough to be the first thing fixed, not a cosmetic rename:** `pendingUpgrade` and
`pendingPlanChange` are two different mechanisms for what the spec says must be exactly one thing.
Chapter 12/16's entire "one Scheduled Change object, replacing four previously-separate 'pending X'
concepts" resolution only holds if the code actually converges on one collection — right now it's
converged on two, plus three more (`pendingUpdate`, `pendingAddonAddition`, `pendingAddonRemovals`)
that also need folding in.

### 1.2 New collection — `ScheduledChange`

Does not exist today under any name. Per Chapter 16/20:

```js
ScheduledChange
  organization        ObjectId, ref Organization
  subscription         ObjectId, ref Subscription
  type                 enum: PLAN_CHANGE | BILLING_CYCLE_CHANGE | REMOVE_ADDON | REDUCE_QUANTITY | CANCELLATION
  status               enum: PENDING | EXECUTED | CANCELLED   (default PENDING)
  reason               String   // e.g. "Customer Request", "Superseded", "Subscription Cancelled" — Chapter 16
  effectiveAt          Date
  payload              Mixed    // type-specific: target plan, addon key, quantity delta, etc.
  commercialTransaction ObjectId, ref CommercialTransaction, nullable   // which decision produced this
  createdAt / updatedAt (timestamps)
```

### 1.3 New collection — `CommercialTransaction`

Does not exist today under any name — the closest analogue is the inline `pendingUpgrade` /
`pendingPlanChange` / `pendingAddonAddition` sub-documents, which conflate business intent with
payment-execution bookkeeping on the Subscription document itself. Per Chapter 15/18/20:

```js
CommercialTransaction
  organization      ObjectId, ref Organization
  subscription      ObjectId, ref Subscription
  type              enum: NEW_PURCHASE | UPGRADE | DOWNGRADE | ADDON_PURCHASE | ADDON_REMOVAL |
                          BILLING_CYCLE_CHANGE | CANCELLATION | START_TRIAL | CORRECTION
  status            enum: CREATED | PRICED | AWAITING_PAYMENT | FAILED | COMMITTED | COMPLETED | VOID
  reason            String
  createdBy         ObjectId, ref User            // immutable
  createdAt         Date                          // immutable
  target            Mixed                         // immutable — the actual requested change
  attemptCount      Number, default 0              // mutable
  latestInvoice     ObjectId, ref Invoice, nullable
  latestPaymentAttempt ObjectId, ref PaymentAttempt, nullable
  failureReason     String, nullable
  lastAttemptAt     Date, nullable
```

### 1.4 New collection — `Invoice` (a real gap: subscription billing has none today)

**Confirmed by direct code inspection: there is no persisted invoice document for subscription
billing at all.** `utils/pricingEngine.buildPricingSnapshot` and `utils/invoiceEngine.calculateInvoice`
compute a price on demand and the result is used directly (to create a Razorpay Order, etc.) — nothing
is written to a collection as a result. The `Invoice` model that *does* exist
(`backend/models/Invoice.js`) is an unrelated CRM sales-invoicing feature (fields: `deal`,
`invoiceNumber`, `gstRate`, `items[]` — no `subscription` field, no Razorpay fields at all) and must
not be reused or confused with this one.

```js
// New model — do not extend the existing Invoice.js, which is a different feature entirely.
BillingInvoice
  organization        ObjectId, ref Organization
  subscription        ObjectId, ref Subscription
  commercialTransaction ObjectId, ref CommercialTransaction
  reason              enum: NEW_SUBSCRIPTION | RENEWAL | PLAN_UPGRADE | ADDON_PURCHASE |
                            BILLING_CYCLE_CHANGE | RETRY | ADMIN_ADJUSTMENT | CORRECTION
  lineItems[]          { type, key, amount, quantity }   // §3.3/§4.1's full-transparency lines
  subtotal, discount, taxable, gst, total   Number
  status              enum: PENDING_PAYMENT | PAID | FAILED | VOID   (default PENDING_PAYMENT)
  generatedAt          Date
  paidAt                Date, nullable
```
**Naming note:** called `BillingInvoice` here specifically to avoid collision with the existing,
unrelated `Invoice` model — this is a naming decision for implementation, not a re-litigation of the
domain spec's own "Invoice" terminology.

**⭐ Acceptance criterion, added directly because of a real legacy bug (`BUG-022`):** the pre-CAW
findings register confirmed that upgrade settlement calls `buildPricingSnapshot()` without its
`couponDiscount`/`modifiers` arguments — so a coupon still *displays* as active while the recurring
amount recalculated for future billing may silently drop the discount. This is not a "coupon bug" in
isolation; it's a direct violation of Ownership Law 1 (Chapter 20) — the recurring amount and the
discount ended up as two independently-computed truths. **This collection's entire reason for
existing enforces the fix structurally, not as a one-off patch:**
> Every invoice — signup, upgrade, add-on purchase, renewal, retry, manual reactivation — must be
> produced exclusively through `calculateInvoice()`, with the full modifier set (coupon + referral)
> resolved fresh every time. No caller may compute or recompute a total independently.
This makes `BUG-022`'s specific failure structurally impossible once Phase 2 lands, rather than
something that has to be remembered per call site the way it wasn't remembered this time.

**⭐ A second, related acceptance criterion — GST must have exactly one computation site, confirmed
today it does not.** A pre-CAW documentation sweep (`PROJECT_STATE.md`, since removed as
superseded) found GST hardcoded independently in at least ten places: four backend spots
(`subscriptionController.js:639,2628`, `authController.js:439`, `addonManagement.js:16,24`) and six
frontend spots in `CheckoutSummaryModal.jsx` (lines 41, 432, 467, 469, 500, 506) — each computing
`amount * 0.18` on its own rather than reading a single authoritative total. The same sweep found a
concrete case where this actually produces a different number depending on *which* of the two
common rounding orders is used: `999 × 1.18 = 1178.82 → 117882 paise` directly, versus
`999 + round(999 × 0.18) = 1179 → 117900 paise` — an 18-paise discrepancy from nothing but which of
two equally-reasonable formulas a given call site happened to use. **This is the same class of
Ownership Law 1 violation as `BUG-022`, and the same fix applies:** every GST figure — backend or
frontend-displayed — must be read from `BillingInvoice.gst` (the Invoice Engine's own output), never
recomputed independently at any other call site, including the frontend. The frontend's six
independent `*0.18` sites should read the already-computed `gst`/`total` fields returned by the
Invoice Engine's API response, not recompute them client-side.

### 1.5 `SubscriptionPayment.js.js` → target `PaymentAttempt`

**A real, pre-existing filename bug, unrelated to this migration but worth fixing while the file is
touched anyway:** the model file is literally named `SubscriptionPayment.js.js` (doubled extension).
Fields today (`organization`, `subscription`, `razorpayPaymentId`, `razorpayOrderId`,
`razorpaySignature`, `amount`, `currency`, `status`, `method`, `paymentFor`, `metadata`) already map
closely to Chapter 20's Payment Attempt object. **One field needs adding:** `invoice: ObjectId, ref
BillingInvoice` — today a payment only references its Subscription, not the specific Invoice it was
charged against, which is required once `BillingInvoice` exists as its own collection (Object 3,
Chapter 20).

### 1.6 New collection — `BillingCycle`

**Confirmed: no `BillingCycle` collection exists today under any name.** Per Chapter 18/20, this is
a thin object whose own existence is authoritative but whose `status` field is explicitly *not* —
it mirrors `BillingInvoice.status`:

```js
BillingCycle
  subscription     ObjectId, ref Subscription
  periodStart, periodEnd   Date
  invoice          ObjectId, ref BillingInvoice
  status           // derived/mirrored from invoice.status at read time — never written independently
```

### 1.7 Coupon / Referral / Reward objects — small, already-decided deltas only

All of `Coupon.js`, `CouponRedemption.js`, `Referral.js`, `ReferralCode.js`, `ReferralProgram.js`,
`Reward.js`, `RewardUsage.js` already exist and structurally match the domain spec closely (confirmed
in the Chapter 10/13/17 code audits earlier in this project). Only the deltas already decided and not
yet implemented:
- **`RewardUsage`** — add `releaseReason: enum: TIMEOUT | PAYMENT_FAILED | ADMIN_RELEASE |
  REPLACED_BY_NEW_INVOICE` (Chapter 13). Add the standalone daily cleanup job for stale `reserved`
  rows (Chapter 13 — see §2.6 below).
- **`Referral`** — wire up the `pending → expired` transition that Chapter 17 decided should actually
  be implemented (currently declared in the enum, never set by any code path).
- **No other schema changes** — the coupon duration types (`first_payment`/`fixed_cycles`) remaining
  rejected at creation is intentional per Chapter 13/17, not a gap to close now.

### 1.8 Confirmed non-issues (checked, no action needed)

- `BillingEvent.js` already exists and matches the Event Engine's role.
- `RazorpayWebhookEvent.js` already exactly matches Chapter 10/11's description — no change.
- `PlanConfig.js` / `PlanAddon.js` / `RazorpayPriceCache.js` are the existing catalog objects
  (Chapter 20's Configuration Objects) — no schema change identified.

---

## Part 2 — Service Boundaries / API Contracts

### 2.1 The core problem this part addresses

**Confirmed by direct inspection: essentially all business logic lives inside one file,
`backend/controllers/subscriptionController.js` (3,602 lines), with individual functions
(`updateSubscription` at ~665 lines, `handlePaymentCaptured` at ~566 lines) each doing the job of
several of the domain spec's named engines at once.** This is exactly the failure mode Chapter 3.9
warned about ("the legacy Subscriptions code accumulated business logic in the controller — the exact
failure mode this whole specification exists to prevent"). The routes themselves (§2.3 below) are
already reasonably well-factored; the problem is entirely inside the controller.

**`handlePaymentCaptured` in particular mixes two eras in one function:** it contains both the legacy
(non-CAW) branch that reads/writes `pendingUpgrade` and the CAW-compatible branch that reads/writes
`pendingPlanChange`, in the same 566-line function. These need to be physically separated before the
legacy branch can be safely deleted in Phase 8.

### 2.2 Target module boundaries (per Chapter 20's Engine Ownership Matrix)

| Target module | Owns | Extracted from (current location) |
|---|---|---|
| **Registration Service** | New Subscription + Mandate acquisition. Same module as Chapter 20's "Registration Engine" — this plan calls it "Service" purely as this document's own naming convention for the extracted code module; the two terms name the same thing, not two different components. Also owns the `SUSPENDED → CANCELLED` precondition transition (§1.1) once wired. | `createSubscription` (already reasonably self-contained at ~275 lines — lowest-risk extraction) |
| **Change Engine** | `decide(request) → Decision` for every plan/add-on/cycle change (§3.2) | Currently smeared across `updateSubscription` (665 lines), `initiateAddonPurchase` (161 lines), `scheduleAddonRemovalEndpoint`, `adjustAddon` — each independently implementing its own version of decision logic instead of calling one shared engine |
| **Invoice Engine** | Pricing + now, persisting a `BillingInvoice` | `utils/invoiceEngine.js`/`utils/pricingEngine.js` already do the pricing math correctly (proven, unit-tested) — needs a persistence step added, not a math rewrite |
| **Renewal Engine** | 🟥 **Does not exist in any form today** | N/A — net-new, see §2.4 |
| **Retry Engine** | 🟥 **Does not exist in any form today** | N/A — net-new, see §2.4 |
| **Webhook handler layer** | Verify + dispatch only, per event type | `handleWebhook` (103-line dispatcher, already reasonably shaped) + the `handleCAWPaymentCaptured`/`handleCAWPaymentFailed`/`handleCAWTokenEvent` cluster (already well-separated, small functions) — keep these; the problem is specifically `handlePaymentCaptured`'s legacy/CAW mixing, not the CAW-only handlers |
| **Coupon Engine / Referral Engine** | Already reasonably separated (`couponController`, the referral-prefixed exports) | Extend to write `CouponRedemption`/consume `RewardUsage` against a real `BillingInvoice` once one exists, instead of directly against a Subscription snapshot |
| **Reconciliation Engine** | `reconcileMandate` already exists and is proven live (idempotent, tested against a real stuck record) | Extend its scope once `CommercialTransaction`/`BillingInvoice` exist, so a partially-committed transaction can be repaired forward the same way a stuck mandate already is |

### 2.3 Current API surface (unchanged by this plan — routes stay stable)

The existing route table (`backend/routes/subscription.js`) already maps reasonably cleanly onto the
target capabilities and does not need to change shape for this migration — the work is entirely
*behind* these routes:

```
POST /webhook                     → Webhook handler layer (raw body, no JSON parsing)
GET  /plans                       → Catalog read (public)
GET  /current                     → Subscription read
POST /trial                       → Registration Service (trial variant)
POST /create                      → Registration Service (sole CAW implementation, already correct)
PUT  /update                      → Change Engine (plan/cycle changes) — currently does this inline
POST /cancel                      → Change Engine (cancellation)
POST /verify-payment              → Invoice Engine / Commercial Transaction settlement
GET  /payments, /payments/:id     → PaymentAttempt reads
POST /:id/retry-payment           → Retry Engine (currently ad hoc, not engine-owned — see §2.4)
GET  /addons/*, POST /addons/*    → Change Engine (add-on variants)
POST /coupons/preview|validate    → Coupon Engine
GET/POST /referrals/*             → Referral Engine
```

**One existing dead route confirmed:** `POST /addons/seats` → `adjustSeats` already returns HTTP 410
per its own route comment ("Deprecated"). No action needed beyond eventual removal alongside other
Phase 8 cleanup.

### 2.4 🟥 The biggest finding of this whole audit: Renewal and Retry have no implementation at all

**Confirmed: `backend/jobs/` contains exactly one file, `subscriptionLifecycleJobs.js`, running three
`node-cron` jobs — trial-ending reminders, trial expiry, and scheduled-cancellation finalization.
There is no renewal cron and no retry cron anywhere in the codebase.** Every chapter of the domain
spec describing the Renewal Engine (§3.5), the Retry Engine (§3.5/§9), and their scheduler wiring
(Chapter 7, Chapter 11's Phase 2C audit) describes a *specified* system, not one that has been built
yet. This is not a migration task — **it is new construction**, and it is the largest single piece of
work implied by this entire specification. Concretely, none of the following exist today, anywhere:
- A scheduled job that finds subscriptions due for renewal and triggers the Renewal Engine.
- A scheduled job that finds `past_due` subscriptions whose retry time has arrived.
- Any code path implementing the R1–R13 renewal sequence (Effective Subscription computation,
  invoice generation, charge, atomic commit) described in §3.5.
- Any code path implementing the 3-attempt/24h-72h-120h retry cadence (§9) as an actual scheduled
  behavior — `POST /:id/retry-payment` exists as a manually-triggered endpoint, which is a different
  thing from an automatic scheduler-driven retry.

This should be treated as the top-priority build item in the migration plan below, not a low-priority
cleanup — without it, the entire recurring-billing half of this specification has no running
implementation at all, regardless of how correct the CAW acquisition/webhook code already is.

### 2.5 Mandate Monitoring (Chapter 11, Scheduler Job 7) — also not implemented

Mandate state today updates correctly via webhook (`handleCAWTokenEvent`, proven live) — this matches
the spec's "webhook-first" preference. **What's missing is the reconciliation fallback** Chapter 11
calls for: a periodic job to catch a mandate state change that a webhook might have missed. No such
job exists today. Lower priority than §2.4, but a real, named gap.

### 2.6 RewardUsage cleanup job (Chapter 13) — also not implemented

Confirmed in the earlier code audit: `releaseExpiredReservations()` exists but is only ever called
inline, immediately before a new reservation attempt on the *same* reward — there is no independent,
scheduled sweep. Chapter 13 already decided this needs a lightweight daily job. Small, low-risk,
should be bundled into the same jobs-file work as §2.4/§2.5 rather than done separately.

---

## Part 3 — Migration Plan

**Sequencing principle:** additive first, extraction second, net-new engines third, legacy removal
last — at every phase, the system must remain fully deployable, never mid-transition.

**⚠ Revised, evidence-driven — Phase 2 is not fully linear with Phase 3.** Investigating (not
assuming) whether `updateSubscription`/`initiateAddonPurchase` were ready for `BillingInvoice`
persistence found they aren't — both still price commercial events through separate, unconsolidated
engines (`calculatePlanUpgradeProration`, `calculateAddonProration`, `buildPricingSnapshot`) rather
than `calculateInvoice()`. See the Phase 2 Exit Finding below: **Phase 3's Commercial Transaction
introduction — which already targets exactly these two flows (item 6) — must also consolidate their
pricing onto `calculateInvoice()` as a prerequisite, not an incidental side effect.** The phase
numbers below are kept for continuity with earlier planning, but Phase 2's remaining items (relabeled
Phase 2b) now execute as part of/after Phase 3, not as an independent Phase 2 continuation.

**⭐ Governing write-boundary invariant (applies to the whole migration, not just Phase 1):** at any
point in time, exactly one phase boundary determines which code is allowed to touch each new model.
This is not a Phase-1 footnote — it is the discipline that makes every later phase safe to ship
independently:

| Phase | `ScheduledChange` / `CommercialTransaction` / `BillingInvoice` / `BillingCycle` | Old fields (`pendingUpdate`, `pendingPlanChange`, etc.) |
|---|---|---|
| **1** | Exist in the schema. **No controller, job, or business logic may read or write them for any reason** — not to populate one field, not "just to test." They are inert until Phase 2. | Sole source of truth, fully authoritative, untouched |
| **2** | `BillingInvoice` starts being written by the Invoice Engine, additively, alongside the existing computation — old behavior remains authoritative; the new write is observational | Still fully authoritative |
| **3** | `CommercialTransaction` starts being written for *newly initiated* actions only | Old, in-flight pending changes are left alone until they resolve naturally — no forced backfill |
| **4** | `ScheduledChange` starts being written for *newly scheduled* changes only | Same rule — existing in-flight legacy scheduled changes are not migrated mid-flight |
| **4+/8** | New models become the sole source of truth once nothing legacy depends on them | Removed (Phase 8) only after nothing reads them |

The reason this has to be explicit rather than assumed: half-migrating a single commercial action
across both the old inline sub-documents and a new collection at the same time is exactly the
"two engines own the same fact" failure Chapter 20's Ownership Laws exist to prevent. **Phase 1's
job is schema only — proving the shape is right without yet risking any live commercial data.**

### Phase 1 — Additive schema only (no behavior change)
1. Create `ScheduledChange`, `CommercialTransaction`, `BillingInvoice`, `BillingCycle` collections.
   Nothing reads or writes them yet — this phase only makes them exist.
2. Add `releaseReason` to `RewardUsage`; wire up `Referral`'s `pending → expired` transition.
3. Fix the `SubscriptionPayment.js.js` filename, add its `invoice` ref field (nullable, unused until
   Phase 3).
4. Add the partial unique index on `Subscription.organization` (§1.1) — a database constraint, not a
   behavior change; it rejects a state (two simultaneously current Subscriptions) that should already
   be impossible.

### Phase 2 — Invoice Engine starts persisting (additive, low risk)
4. ✅ **Done.** Wired `utils/invoiceEngine.calculateInvoice()`'s result to also write a
   `BillingInvoice` document for the `createSubscription` (new purchase) path — the smallest, most
   self-contained caller, and (per the investigation below) the *only* call site that currently
   qualifies. No other behavior changes; the computed amount charged to Razorpay stays identical.
   Wrapped in a try/catch explicitly marked as a Phase 2 migration concession (removed once
   `BillingInvoice` becomes authoritative, Phase 4/5) — a persistence failure logs
   organization/subscription context and never blocks signup.

**⭐ Phase 2 Exit Finding — not a postponed task, an architectural precondition discovered by testing
the invariant against real code:** the original plan assumed `updateSubscription` (upgrade) and
`initiateAddonPurchase` (add-on) would extend the same `BillingInvoice` persistence as
`createSubscription`, on the theory that all three eventually call `calculateInvoice()`. Investigating
each one instead of mechanically wiring it found that assumption false — **the system currently has
three independent pricing engines, not one:**

| Path | Charge actually computed via | `calculateInvoice()` involved? | Finding |
|---|---|---|---|
| Signup (`createSubscription`) | `calculateInvoice()` directly | Yes | ✅ Qualifies — already wired |
| Upgrade — request (`updateSubscription`) | `calculatePlanUpgradeProration()` + `computeGST()` | No | ❌ The one-time prorated amount actually charged is never priced through the Invoice Engine |
| Upgrade — settlement (`handlePaymentCaptured`) | Reuses the request-time amount (verified against Razorpay); separately calls `calculateInvoice()` **only** to price the new recurring baseline | Yes, but for a *different number* | ❌ A `BillingInvoice{reason: PLAN_UPGRADE}` built from this would show the customer's new monthly/yearly rate as "the invoice," not what they were actually charged today — a fresh, self-inflicted version of BUG-022's exact failure mode (two independently-computed truths), introduced by Phase 2 itself rather than inherited from legacy code |
| Add-on purchase — request (`initiateAddonPurchase`) | `calculateAddonProration()` + `computeGST()` | No | ❌ Same shape as the upgrade request |
| Add-on purchase — settlement (`handlePaymentCaptured`) | `buildPricingSnapshot()` directly | **No** | ❌ Strictly behind the upgrade path — never migrated onto the Invoice Engine at all, at either end of the flow |

**Consequence:** upgrade and add-on-purchase flows cannot produce an authoritative `BillingInvoice`
without violating Ownership Law 1 (one commercial event, one canonical computation, one persisted
record) — wiring them today would mean choosing between silently persisting a misleading number or
weakening the invariant Phase 2 exists to enforce. Neither is acceptable, so wiring is intentionally
withheld, not merely unfinished.

**Current pricing topology — living checklist, update each row as Phase 3 lands, not a one-time
snapshot:**

| Commercial Action | Pricing Engine | Canonical (`calculateInvoice()`)? | `BillingInvoice` Eligible? |
|---|---|---|---|
| New Subscription (signup) | `calculateInvoice()` | ✅ | ✅ Wired (Phase 2a) |
| Plan Upgrade | `calculatePlanUpgradeProration()` + `computeGST()` (request); `calculateInvoice()` for the recurring baseline only (settlement) | ❌ | Deferred — Phase 3 item 5a |
| Add-on Purchase | `calculateAddonProration()` + `computeGST()` (request); `buildPricingSnapshot()` (settlement) | ❌ | Deferred — Phase 3 item 5a |
| Billing Cycle Change | Unknown | 🔍 Not yet investigated | Unknown — check against the same invariant before Phase 3 item 6 touches it, don't assume it's clean either way |
| Renewal | n/a yet — Renewal Engine doesn't exist (Phase 5) | — | Not applicable until Phase 5 |

**This changes the dependency graph, not just the checklist — recorded here so it isn't rediscovered
as a surprise. Correction while writing this: the natural home for this consolidation is Phase 3, not
Phase 4 — Phase 4 is the `ScheduledChange`/downgrade-scheduling phase, unrelated to upgrade/add-on
pricing (those are immediate, payment-gated actions, not scheduled ones, per Chapter 18). Phase 3's
own item 6 already targets exactly "upgrade, add-on purchase, billing-cycle change" — it just didn't
previously say the pricing consolidation explicitly:**
```
Phase 2a  — Signup BillingInvoice        ✅ done
        ↓
Phase 3,
item 5a   — (new) Consolidate calculatePlanUpgradeProration(), calculateAddonProration(),
            and the add-on settlement's buildPricingSnapshot() call onto
            calculateInvoice() as the single pricing authority for these flows —
            a precondition for item 6 below, not separate from it
        ↓
Phase 2b/
item 6    — CommercialTransaction + BillingInvoice creation for upgrade/add-on/
            billing-cycle actions (already Phase 3's existing item 6) — now
            explicitly depends on 5a having landed first
```
Phase 3 is therefore not simply "later work" independent of Phase 2 — its own item 6 already implied
this consolidation without stating it, and this finding makes that prerequisite explicit rather than
letting Phase 3 rediscover it mid-implementation. The remaining Phase 2 items below
(`updateSubscription`, `initiateAddonPurchase`) are relabeled Phase 2b and fold into Phase 3's item 6
once 5a lands, rather than executing as an independent Phase 2 continuation.

**`persistBillingInvoice()` helper — deferred for the same reason, not built speculatively.** The
earlier plan to introduce it "before the third call site" assumed a second and third qualifying
caller would exist by now; they don't yet — `createSubscription` remains the only call site where a
`calculateInvoice()` output genuinely represents the event being recorded. Introduce the helper once
Phase 3's item 5a produces a second qualifying caller (i.e., at the start of Phase 2b/item 6), not on
a fixed count of controllers touched.

### Phase 3 — Introduce Commercial Transaction as the payment-tracking layer

**⭐ Design-session framing for item 5a, corrected against the actual frozen spec rather than
workshopped from scratch:** the question is *not* "what domain artifacts exist" — Chapter 3.3
already answers that, and it was verified directly against the spec text, not assumed. §3.3 specifies
one 10-stage Invoice Engine pipeline per Commercial Event, and **Stage 5, "Commercial Adjustments
(proration, unused old-plan/old-cycle value)," is explicitly a stage inside that one pipeline**, not a
separate calculation — the worked example (§3.3) shows `Unused Starter Plan Credit (15 days) −₹125`
computed in the same pass as the plan/add-on lines, before Coupon (Stage 6) and Referral (Stage 7).
There is no "recurring pricing calculation" as its own domain artifact either: per R13 (§3.5), the
post-change recurring total is just the sum of whatever components are active after a change commits
— addition, not a second algorithm.

**So what Phase 2's investigation actually found isn't evidence of two legitimate domain concepts
needing separate engines — it's evidence that Stage 5 was never built into `calculateInvoice()`.**
Signup never needs proration, so `calculateInvoice()` today has no Stage 5 at all; the two flows that
do need it (`updateSubscription`'s upgrade path, `initiateAddonPurchase`) reach for a separate,
bolted-on utility (`calculatePlanUpgradeProration()`/`calculateAddonProration()`) instead of extending
the canonical engine. That's a gap in an already-specified pipeline, not an open domain question.

**The actual, narrower question for the item 5a design session:** does extending `calculateInvoice()`
to accept proration inputs (old component, days remaining/elapsed, new component) and implement Stage
5 unify the two paths cleanly onto the one pipeline the spec already describes — or does mid-cycle
proration need a genuinely different calling shape (different required inputs, different callers,
different timing relative to payment) that would make bolting it onto the same function a forced fit
rather than a real consolidation? **This is the one open decision — not "invent the artifacts,"
which the spec already settled — and it should be answered explicitly, in its own short design pass,
before item 5a's implementation starts, not assumed either way.**

**✅ Design pass completed — see `PHASE3_DESIGN_NOTE_INVOICE_ENGINE.md`.** Read all four existing
pricing functions in full (not assumed), mapped each to its Chapter 3.3 stage(s), confirmed the
old-state/new-state/time asymmetry is real (Stage 5's inputs genuinely differ in shape from every
other stage's), evaluated three implementation options against concrete criteria, and recorded a
recommendation (Option C — Stage 5 delegated to a dedicated calculator whose *output* becomes a
proper line item `calculateInvoice()` consumes structurally, not a bare number GST is bolted onto
outside the pipeline). **The recommendation is not yet adopted** — it is input to a decision that
still belongs to explicit review, not something implementation should proceed on unconfirmed.

5a. **(New — surfaced by the Phase 2 Exit Finding, §Part 3 top note) Consolidate pricing before item 6
    can execute honestly:** migrate `calculatePlanUpgradeProration()`, `calculateAddonProration()`, and
    the add-on settlement's direct `buildPricingSnapshot()` call onto `calculateInvoice()` as the single
    pricing authority for the upgrade and add-on-purchase flows. Until this lands, item 6's
    `BillingInvoice` creation for these two flows would persist a number that isn't the actual
    commercial event (see §Part 3 top note's table) — this item is a hard precondition for item 6, not
    parallel work. See `PHASE3_DESIGN_NOTE_INVOICE_ENGINE.md` for the verified implementation shape
    (Option C'': `calculateInvoice()` accepts an optional `adjustmentContext`, internally calling a
    dedicated `calculateCommercialAdjustments()` and folding its result into the existing
    `basePriceOverride` seam — verified against real code, not asserted).

    **✅ Engine-level half done, verified; controller migration not yet started.**
    `utils/invoiceEngine.js` now implements Stage 5 exactly per the design note (`calculateInvoice()`'s
    optional `adjustmentContext` → internal `calculateCommercialAdjustments()` → folded into
    `basePriceOverride`). Three things found/fixed only by actually building and testing this, not
    assumed from the design note alone:
    - **A third, previously untracked caller exists:** `authController.js`'s extra-seat purchase
      endpoint also calls `calculateAddonProration()` directly — grep hadn't caught this in any earlier
      pass. Changing that function's return shape (as the design note's original step 1 proposed) would
      have silently broken it. **Resolution:** extracted `calculateAddonProration()`/
      `calculatePlanUpgradeProration()` into a new `utils/prorationMath.js` (pure, zero deps), with
      `addonManagement.js` re-exporting them unchanged — all three existing callers untouched, zero
      signature changes anywhere.
    - **`invoiceEngine.js` would have broken its own "pure, no I/O" contract:** requiring
      `addonManagement.js` directly (to reach the two proration functions) pulls in
      `config/razorpay.js`, which throws at module-load time without Razorpay env vars configured —
      caught by an equivalence test run without `dotenv` loaded. Fixed by the same `prorationMath.js`
      extraction above.
    - **A real sign-convention bug, caught by the equivalence test, not shipped:** the first
      implementation subtracted the adjustment amount from `basePriceOverride`, treating it as a
      §3.3-style "credit against a separately-itemized full price." But
      `calculatePlanUpgradeProration()`/`calculateAddonProration()` actually return a **positive net
      charge already owed** (the customer paying more for a better plan), not a credit — subtracting it
      produced a negative invoice total in the first test run. Fixed: the amount is now **added** to
      `basePriceOverride`, and the display line is shown positive, not negated.
    - **Verified equivalent to today's live computation** for both upgrade and add-on scenarios, with
      and without a modifier applied (confirms Stage 5 precedes Stage 6/7 in the actual arithmetic, not
      just the display) — exact rupee-for-rupee match against `calculatePlanUpgradeProration()` +
      `computeGST()` and `calculateAddonProration()` + `computeGST()`/`applyModifiers()`, including four
      boundary-prone fixtures (odd/prime prices, near-`.5` proration factors, a 33% modifier) — see
      `PHASE3_DESIGN_NOTE_INVOICE_ENGINE.md` §7.6/§7.7 for what this equivalence actually does and
      doesn't prove.
    - **⚠ Scope limit, stated precisely rather than implied:** this equivalence is against *today's own
      code re-run as its own oracle* — not against real historical transaction data (none exists; the
      production DB has exactly one `Subscription` document). It proves the new path matches the old
      one; it does not independently prove the old one was correct, which is a different claim this
      round of testing cannot make. The sign-convention bug itself was also traced back to this note's
      own §5/§7.2 written recommendation, not just introduced in code — corrected there with the same
      supersede-in-place treatment as every other correction in that document.
    - **The third caller (`authController.js`'s seat-purchase endpoint) was not migrated and not
      equivalence-tested** — it doesn't call `calculateInvoice()`, so there was nothing to test it
      against. It is confirmed *unchanged* because it was *untouched* by the `prorationMath.js`
      extraction (verified: the re-exported function resolves identically, real call, `dotenv`
      loaded) — not because it underwent the same scrutiny as the two migrated-math paths. Precise,
      not implied.

    **Not yet done:** no controller has been touched. `updateSubscription`, `initiateAddonPurchase`,
    and now `authController.js`'s seat-purchase endpoint (three call sites, not the two originally
    scoped) still compute charges the old way. Migrating them is the remaining half of item 5a —
    higher-stakes since it touches live Razorpay charge amounts — and should be its own explicit step,
    not assumed to follow automatically from the engine work above.

    **✅ `updateSubscription` (upgrade path) — migrated, first of three controllers, done in isolation.**
    Recorded as a template for the remaining two, not just a changelog entry:

    | | |
    |---|---|
    | **What changed** | The three-line computation chain (`calculatePlanUpgradeProration()` → `applyModifiers()` → `computeGST()`) was replaced by one `calculateInvoice({ adjustmentContext: {type:'plan_upgrade', ...}, resolvedModifiers })` call. `proratedDiff`/`discountedProratedDiff`/`proratedDiffWithGST` now read from `invoice.adjustment`/`invoice.taxable`/`invoice.total` respectively — same variable names downstream, same meanings, different source. |
    | **What stayed intentionally untouched** | Reservation lifecycle (release-prior/reserve-new, confirmed independent — `reserveNextAvailableReward()` takes only an org/subscription ID, no computed amount, and reserves *before* any pricing math runs), Razorpay order creation, `pendingPlanChange` shape, response body shape, `handlePaymentCaptured`'s settlement-side amount verification and separate recurring-baseline computation. |
    | **What surprised us** | The sign-convention bug (§ design note §7.6) — caught by the engine-level equivalence test *before* this controller migration started, which is exactly why it didn't surface here. At the controller level, nothing unexpected turned up — the migration was mechanical once the engine was verified. |
    | **Did it follow the design note exactly, or need a correction here** | Followed exactly — `oldTotal`/`newTotal` (full totals including add-ons, not just base prices) are passed positionally into `adjustmentContext.oldBasePrice`/`newBasePrice`, which was already anticipated (`calculateCommercialAdjustments()` only forwards them, never interprets meaning) — no new design correction needed at the controller layer. |
    | **Verification performed** | Controller-level equivalence (not just engine-level): 3 normal cases + 3 edge cases (identical old/new totals, last-moment-before-period-end, already-ended period), comparing `proratedDiff`/`discountedProratedDiff`/`proratedDiffWithGST` *and* the actual Razorpay paise amount — all exact matches. `typeof` check confirmed `invoice.total`/`.taxable`/`.adjustment` are plain `number`s (not wrapped/differently-precision), so `* 100` coercion for Razorpay behaves identically. Dead import (`calculatePlanUpgradeProration`) removed — one fewer live production dependency on the pre-migration pricing path. |
    | **Edge-case finding, not a regression** | There is no actual "zero-proration" code path — `calculatePlanUpgradeProration()` has its own pre-existing `Math.max(1, ...)` floor (always charges ≥ ₹1) and an already-ended-period fallback (charges the full undiscounted diff). Both are existing business rules inside the one shared function both old and new paths call identically — equivalence here is structural, not merely tested-and-passed. |
    | **Precision on claims** | "Behaviorally identical" is the accurate claim — proven via equivalent replacement values plus unchanged downstream code — not "provably identical" in some stronger absolute sense. |

    **Not yet done:** `initiateAddonPurchase` and `authController.js`'s seat-purchase endpoint remain
    on the old computation chain. Per the sequencing established here, each gets its own isolated
    migration and its own version of the table above — not bundled into one commit, and not assumed to
    follow the exact same shape without first tracing its current flow the same way (it uses
    `calculateAddonProration()`, a structurally similar but not identical function, and was not the one
    proven by the boundary-fixture testing above).

    **⭐ Conclusion of the first migration — the strategy itself is now validated, not just this one
    controller.** Phase 3 item 5a began as a hypothesis: *can controllers be migrated one at a time onto
    the canonical Invoice Engine without changing commercial behavior?* After the engine work and this
    first controller migration, that is no longer an assumption — it has evidence behind it:
    - Engine-level equivalence verified (including boundary-fixture rounding cases).
    - Controller-level equivalence verified independently (not inferred from engine equivalence alone).
    - Settlement/webhook semantics traced and confirmed preserved, with the two `calculateInvoice()`
      calls in `handlePaymentCaptured` shown to answer genuinely different questions, not silently
      duplicate one.
    - One legacy production dependency (`calculatePlanUpgradeProration()`) removed from the upgrade
      request flow, with zero behavior change.
    - No hidden coupling found outside the computation block itself (reservation lifecycle confirmed
      independent of the pricing variables, not merely assumed to be).

    **This justifies applying the same six-step process to the remaining call sites**
    (`initiateAddonPurchase`, then `authController.js`'s seat-purchase endpoint) **as a proven pattern,
    not a fresh experiment each time:** (1) trace the existing flow precisely, (2) define the intended
    flow with only the computation source changing, (3) migrate only the computation, (4) verify
    controller-level behavioral equivalence, (5) trace settlement/webhook behavior for duplicate or
    conflicting computation, (6) record the migration and stop before touching the next controller.
    **The pattern being proven does not mean the next migration can skip steps** — `initiateAddonPurchase`
    uses `calculateAddonProration()`, a structurally similar but distinct function not covered by this
    round's boundary-fixture testing, and must be traced fresh rather than assumed to mirror this one;
    "looks similar" has repeatedly been where this project's subtle bugs actually hid.

    **✅ `initiateAddonPurchase` — migrated, second of three controllers, done in isolation.**

    | | |
    |---|---|
    | **What changed** | `calculateAddonProration()` → `applyModifiers()` → `computeGST()` replaced by one `calculateInvoice({ adjustmentContext: {type:'addon_purchase', quantity, pricePerUnit, ...}, resolvedModifiers })` call. `prorationAmount`/`discountedProrationAmount`/`referralDiscountAmount`/`prorationAmountWithGST` now read from `invoice.adjustment`/`.taxable`/`.discount`/`.total` — one more mapped field (`.discount`) than the upgrade migration needed, since this controller's response body separately reports the discount amount. |
    | **What stayed intentionally untouched** | Reservation lifecycle (confirmed independent again — same `reserveNextAvailableReward()` call, no amount parameter), Razorpay order creation, `pendingAddonAddition` shape, response body shape, and `handlePaymentCaptured`'s addon-settlement branch (line ~2118 amount verification reads the stored value, doesn't recompute; line ~2156's separate recurring-baseline computation via `buildPricingSnapshot()` directly — further behind than the upgrade settlement path, which already used `calculateInvoice()` for its baseline — untouched, out of scope for this item). |
    | **What surprised us** | Nothing new at the controller level — the sign-convention and purity issues were already fixed at the engine layer before this migration started, exactly the benefit the six-step process is meant to produce. |
    | **Did it follow the design note/updateSubscription's pattern exactly** | Yes, with one addition: this controller's response separately reports `referralDiscountApplied`, so `invoice.discount` needed mapping too (not required for the upgrade migration, whose response never surfaces the discount amount alone). No design correction needed — `invoice.discount` already existed on `calculateInvoice()`'s return shape from Phase 2. |
    | **Verification performed** | Controller-level equivalence: 4 normal cases (no modifier, 20% referral modifier, different quantity/price, single unit) + 2 edge cases (last-moment-before-period-end, already-ended period) — all fields (`prorationAmount`, `discountedProrationAmount`, `referralDiscountAmount`, `prorationAmountWithGST`) and the Razorpay paise amount matched exactly. Edge cases confirmed the same structural floor as the upgrade migration: `calculateAddonProration()` has its own pre-existing `Math.max(1, ...)` minimum-charge rule, shared identically by both old and new paths. |
    | **Cleanup** | Dead import (`calculateAddonProration`) removed from `subscriptionController.js` — confirmed no other call site in this file still needs it (its remaining live caller is `authController.js`'s seat-purchase endpoint, migrated separately). |
    | **No-reward branch, explicitly checked, not left implied** | When `reserveNextAvailableReward()` returns `null`, `resolvedModifiers` stays `[]`, and `calculateInvoice()`'s `invoice.discount` resolves to a plain `0` (verified: `typeof invoice.discount === 'number'`) — so `referralDiscountAmount = addonInvoice.discount \|\| 0` correctly stays `0`, not `undefined`/`NaN`. Confirmed with a real call, not inferred from the shape alone. |

    **Lesson generalized from this migration, worth carrying into future ones:** migrations should be
    driven by *which semantic outputs a controller actually consumes*, not by assuming every controller
    needs the same subset of `calculateInvoice()`'s return fields. `updateSubscription` only needed
    `.adjustment`/`.taxable`/`.total`; this controller additionally needed `.discount`, since its
    response body separately reports the discount amount. The right first question for any future
    migration is "which commercial facts does this controller expose in its response/persisted state,"
    then map those from the canonical invoice — not "does this look like the last migration."

    **⚠ Tracked, not fixed here — a real asymmetry now stands out more clearly because of this
    migration:** `handlePaymentCaptured`'s upgrade-settlement branch already prices its recurring
    baseline via `calculateInvoice()` (Phase 4/5, pre-existing); its add-on-settlement branch
    (line ~2156) still uses `buildPricingSnapshot()` directly. Not a bug today — both compute the same
    correct arithmetic — but it's technical debt that shouldn't quietly become permanent. **Filed as a
    concrete future item, not left as an implicit observation:** migrate the add-on settlement's
    recurring-baseline computation onto `calculateInvoice()` too, for consistency with the upgrade
    settlement path — scoped separately from item 5a/5b, since it's a settlement-side cleanup, not a
    request-side proration migration.

    **✅ `authController.js`'s `inviteUser` (no-free-seat branch) — migrated, third and last of three
    call sites, done in isolation.** Forensic trace performed before migrating, per explicit request —
    the question answered was "same commercial event or coincidental helper reuse," not "does it call
    the same function":

    | | |
    |---|---|
    | **Entry point** | `POST /auth/invite` (`routes/auth.js:59`) → `authController.exports.inviteUser`. Not a dedicated "seat purchase" endpoint — this is the invite-a-teammate flow; seat purchase is a side effect when no free seat exists. |
    | **Business trigger** | Admin invites a teammate. If a free seat exists, invite proceeds immediately, no payment. If not, the org must buy exactly 1 unit of the `extra_seat` add-on before the invite can complete. |
    | **Commercial event — traced, not assumed** | Confirmed the **same** commercial event as `initiateAddonPurchase` (extra_seat add-on purchase), not a distinct one sharing a helper by coincidence: same `pendingAddonAddition` field/shape, same `handlePaymentCaptured` settlement branch (verified — one extra `if (pending.addonKey === 'extra_seat')` step layered on top to finalize the matching `Invited` record and send the invite email, not a separate settlement path), and the code's own comment explicitly states the intent ("route through the same intent → settlement pattern as every other add-on purchase"). Only difference: `quantity` fixed to `1`, `addonKey` fixed to `'extra_seat'` — controller-layer specifics, not a different Invoice Engine shape. |
    | **One real, checked difference — preserved, not "improved"** | This flow has **no referral-reservation logic at all** — no `reserveNextAvailableReward()`/`rewardToModifier()` calls exist here, unlike `initiateAddonPurchase`. Migration keeps `resolvedModifiers: []` unconditionally, matching current behavior exactly rather than silently adding referral-discount support as a scope-expanding side effect of the migration. |
    | **What changed** | `calculateAddonProration(1, pricePerUnit, ...)` + `computeGST()` replaced by one `calculateInvoice({ adjustmentContext: {type:'addon_purchase', quantity:1, pricePerUnit, ...}, resolvedModifiers: [] })` call. `prorationAmount`/`prorationAmountWithGST` now read from `invoice.adjustment`/`.total`. |
    | **What stayed untouched** | Free-seat shortcut (no payment path), `Invited` record creation, `pendingAddonAddition` shape, Razorpay order creation, settlement (including the invite-finalization step), invite email. |
    | **Verification performed** | Controller-level equivalence: 4 price points — all matched exactly, including Razorpay paise amount. **Additionally verified the three no-modifier invariants requested** (this being the first controller that *permanently* exercises the no-modifiers path, not just one case among several): `invoice.discount === 0`, `invoice.taxable === invoice.adjustment`, `invoice.total === invoice.adjustment + computeGST(invoice.adjustment)` — all true across all four price points. Same 2 edge cases as the prior two migrations (last-moment, already-ended period) — matched, same structural `Math.max(1,...)` floor. |
    | **Cleanup** | Dead imports (`calculateAddonProration`, `computeGST`) removed from `authController.js` — confirmed no other call site in this file needed them. |

    **Item 5a is now genuinely complete, not "mostly complete."** All three production call sites found
    during the engine work (`updateSubscription`, `initiateAddonPurchase`, `authController.js`'s
    seat-purchase branch) now price their one-time charge through `calculateInvoice()`'s Stage 5. No
    controller in the codebase still calls `calculatePlanUpgradeProration()`/`calculateAddonProration()`
    directly — both remain in `utils/prorationMath.js` as internal implementation detail of
    `calculateCommercialAdjustments()` only.

    **⚠ Correction to this section itself, found while starting 5c — a real misattribution, not a
    nitpick.** The original audit attributed a `buildPricingSnapshot()` call at line ~889 to
    `startFreeTrial`, using "nearest preceding `exports.foo = async` match" to identify function
    boundaries — a search that misses plain `async function name(...)` declarations. Re-traced properly
    (`grep` for every `^exports\.\|^async function\|^function` boundary, not just the `exports.` form):
    **line 889 is actually inside `legacyCreateSubscription_DEPRECATED`** (starts line 804) — a function
    explicitly marked `@deprecated LEGACY`, unexported, unrouted, kept only "for reference until Phase 8
    deletes it... do not wire this to any route." `startFreeTrial` itself (lines 733-797) has **no
    pricing call at all** — a trial is hardcoded `pricePerUser: 0, totalAmount: 0`, no `buildPricingSnapshot()`
    call exists in that function. **This is Phase 8 dead-code territory, not Category A consolidation
    work.** The second attribution — `updateSubscription`'s not-yet-payment-confirmed branch, line ~1371 —
    was re-checked the same way and is correctly attributed (falls inside `exports.updateSubscription`,
    1005-1683, confirmed by boundary trace).

    **⭐ Precise claim, corrected against a post-migration audit — do not overstate this as "everything
    now goes through `calculateInvoice()`."** The audit found one *genuine* additional direct caller
    outside item 5a's scope: `updateSubscription`'s not-yet-payment-confirmed branch (line ~1371) — it
    prices a *fresh* commercial state (no old-vs-new comparison, no period math, structurally the same
    shape as `createSubscription`'s own `calculateInvoice()` call) and was never claimed to be in 5a's
    scope, but it means the accurate claim is narrower than it might sound: **"everything that performs
    Stage 5 commercial adjustments now goes through `calculateInvoice()`,"** not "everything prices
    through `calculateInvoice()`."

    **The codebase's pricing call sites now fall into three genuinely different categories — worth
    naming as categories, not as a flat list of remaining `buildPricingSnapshot()` callers:**

    | Category | Examples | Current state |
    |---|---|---|
    | **A — Fresh pricing** (no prior state to compare against) | `createSubscription`, `updateSubscription`'s pre-payment-confirmed branch | `createSubscription` → `calculateInvoice()` (no `adjustmentContext`); the other → `buildPricingSnapshot()` directly, not yet migrated |
    | **B — Commercial adjustments** (old state + new state + time) | Upgrade, add-on purchase, seat purchase | ✅ All three → `calculateInvoice()` **with** `adjustmentContext` — this is item 5a, and it is complete |
    | **C — Settlement reconciliation** (payment captured, recompute the new recurring baseline) | `handlePaymentCaptured`'s upgrade branch vs. its add-on branch | Mixed — upgrade settlement already uses `calculateInvoice()` (Phase 4/5, pre-existing); add-on settlement still uses `buildPricingSnapshot()` directly (tracked above) |
    | **Dead — not a category, Phase 8's problem** | `legacyCreateSubscription_DEPRECATED`'s `buildPricingSnapshot()` call | Unexported, unrouted, do-not-touch until Phase 8 deletes the whole function |

    **This reframing supersedes the flat "three remaining `buildPricingSnapshot()` callers" list — they
    are not the same kind of debt.** Category A's callers were never in 5a's scope at all (5a was
    specifically Stage 5/commercial adjustments, i.e. Category B). Category C's asymmetry was already
    tracked. Recording this now so a fresh session doesn't conflate "5a isn't fully done" with "Category
    A/C consolidation isn't done" — they are different, separately-scoped pieces of work.

    Remaining Phase 3 work is genuinely different in kind from item 5a, not a continuation of it:
    **5b** (modifier ordering, still not implemented — see below), and **5c** (canonical pricing
    consolidation — see new item below), plus **Phase 7** (legacy `pendingUpgrade` branch removal —
    unrelated, later work).

5c. **✅ IMPLEMENTED AND VERIFIED (both real items).**
    - **Category A** — `updateSubscription`'s pre-payment-confirmed branch migrated onto
      `calculateInvoice()` **without** `adjustmentContext` (same shape as `createSubscription`'s
      existing call, same coupon-only modifier construction). Kept the local variable named `snapshot`
      deliberately — `calculateInvoice()`'s return also has a `.subtotal` field, so the branch's other
      two `snapshot.subtotal` reads (an `appliedCoupon.baseSubtotal` and a `BillingEvent.amounts.base`)
      needed no further changes. `totalAmount` now reads `snapshot.taxable` (same meaning as the old
      `snapshot.totalAmount`). **Verified**: old `buildPricingSnapshot()` vs. new `calculateInvoice()`
      matched exactly, no-coupon and with-a-₹150-coupon cases both checked.
      (`startFreeTrial` was correctly removed from this item's scope — see the correction above;
      it has no pricing call to migrate.)
    - **Category C** — the add-on settlement's recurring-baseline computation
      (`handlePaymentCaptured`, line ~2162) migrated onto `calculateInvoice()` (no `adjustmentContext`,
      no modifiers — this call never had coupon/referral involved), matching the upgrade settlement
      branch that already did this, closing the asymmetry named in the earlier audit. **Verified**:
      matched exactly against the old `buildPricingSnapshot()` result for both `monthly` and `yearly`
      billing cycles, with multiple add-ons.
    - `node --check` clean on `controllers/subscriptionController.js` after both migrations.
    - **Not touched, correctly**: `legacyCreateSubscription_DEPRECATED`'s `buildPricingSnapshot()` call
      (line 889) — unexported, unrouted, explicitly Phase 8's job, not 5c's.

    **⚠ Correction — "5c complete" was declared prematurely once already; a fourth live path was found
    afterward by a whole-backend grep, not a per-file one.** The two migrations above only covered the
    call sites already known from the earlier per-controller audit. A follow-up exit-criteria check
    (grep `buildPricingSnapshot(` across the *entire* backend, not just `subscriptionController.js`)
    found a **fourth live caller**: `utils/addonManagement.js`'s `calculateTotalPrice()` (a thin wrapper
    around `buildPricingSnapshot()`), invoked from `applyScheduledAddonRemovals()` — itself called from
    `subscriptionController.js:2760` inside the renewal-charge handler, a genuinely live production path
    (independently corroborated by `BillingFindings.md:135`, which had already flagged this exact
    function as "same coupon-blind pattern as BUG-022"). This was missed by the earlier per-file audits
    because the call is *indirect* (through `calculateTotalPrice()`), not a direct
    `buildPricingSnapshot()` call visible in a single-file grep.

    **Fixed the same session it was found, same pattern as the other Category C migration:**
    `applyScheduledAddonRemovals()` now calls `calculateInvoice()` directly (no coupon/modifiers — this
    path never had them); `calculateTotalPrice()` itself is left in place, marked `@deprecated`, now
    genuinely dead (confirmed zero remaining callers, internal or external, via grep) — Phase 7 cleanup,
    not removed here. **Verified**: matched exactly against the old `calculateTotalPrice()` result for
    both `monthly` and `yearly` billing cycles. `node --check` clean.

    **Re-ran the whole-backend `buildPricingSnapshot(`/`calculateTotalPrice(` grep afterward — now
    genuinely clean.** Remaining hits are only: the two functions' own definitions

    **Implemented: `authController.js` invite seat-purchase now follows the same request-side
    lifecycle as `initiateAddonPurchase()` for the extra-seat branch.** This changed real
    customer-facing behavior, not just code structure: a customer with a pending cancellation can
    no longer start a seat purchase through the invite flow, and a seat purchase initiated from an
    invite now reserves a referral reward the same way the standard add-on flow does, with the
    same recycle/cleanup behavior if a prior reservation exists. The flow also now writes the same
    `CommercialTransaction` lifecycle states (`PRICED` → `AWAITING_PAYMENT`) as the add-on path,
    using the same orderId correlation pattern. The verified scope here is request-side behavior and
    transaction-state persistence only; a shared helper extraction is still optional and was not
    required to make the behavior correct.

    **✅ Follow-up verification session — request-side add-on purchase lifecycle consolidated into
    `utils/addonPurchaseLifecycle.js`, checked two ways, both with concrete evidence, not assertion:**

    1. **Proration/GST equivalence, re-run against a genuine mid-cycle fixture** — the previous
       comparison had accidentally used period dates already in the past (`Jan 2025`), which risked
       silently exercising `calculateAddonProration()`'s already-ended-period fallback (`Math.max(1,...)`
       minimum charge) instead of real proration. Re-ran with `currentPeriodStart` = 10 days before
       `new Date()` and `currentPeriodEnd` = 20 days after (today genuinely mid-cycle, 30-day period),
       quantity 3 @ ₹500/unit, a 20% coupon modifier. **Confirmed the proration factor itself was
       genuinely fractional (0.6667 — remaining/total), not 0 or 1**, before trusting the comparison.
       Legacy path (`calculateAddonProration()` → `applyModifiers()` → `computeGST()`) and shared
       `calculateInvoice()` were run against identical inputs and produced identical values at every
       stage: prorated ₹1000 → post-discount ₹800 → ₹944 incl. GST. Executed as real Node code against
       the actual (pure, DB-free) functions — not mocked, not inferred from reading source alone.
    2. **Whole-backend grep, not a per-file one** — searched all of `backend/` (not just
       `subscriptionController.js`/`authController.js`) for `CommercialTransaction.create(`,
       `CommercialTransaction.updateMany(`, `new CommercialTransaction(`, `reserveNextAvailableReward(`,
       `releaseReservation(`, `razorpay.orders.create(`, and `pendingAddonAddition`. Every
       `CommercialTransaction` create/updateMany call and every `pendingAddonAddition` construction for
       the request-side add-on purchase flow resolves to exactly one implementation:
       `startAddonPurchase()` in `utils/addonPurchaseLifecycle.js`. `subscriptionController.js`'s
       `initiateAddonPurchase` and `authController.js`'s invite/seat-purchase branch are confirmed
       callers only — neither maintains parallel lifecycle logic. Other hits were traced and are
       genuinely different flows, not duplicates: the plan-upgrade block (`reserveNextAvailableReward`/
       `releaseReservation`, `pendingPlanChange`, no `CommercialTransaction` involvement) and
       `handlePaymentCaptured`'s addon-settlement branch (reads/updates an existing `CommercialTransaction`
       by `orderId` — a later lifecycle phase, not a second creation path). **No unintended duplicate
       implementation found.**

    **Precision on scope:** this confirms `startAddonPurchase()` is the sole request-side creator of
    `CommercialTransaction`/`pendingAddonAddition` today, and that the Stage-5 pricing math it calls
    through matches the legacy computation for the fixture tested. It does not re-verify the boundary-
    rounding edge cases already covered by the earlier 5a/5c equivalence work, and does not extend
    coverage to Category C settlement reconciliation, which remains as tracked above.
    (`pricingEngine.js`, `addonManagement.js`'s now-dead `calculateTotalPrice`),
    `calculateInvoice()`'s own canonical internal call (`invoiceEngine.js:158`), and the confirmed-dead
    `legacyCreateSubscription_DEPRECATED` call. **This is the actual, checked answer to "does Phase 3
    genuinely eliminate all live manual pricing computation" — not inferred from the two call sites
    already known about, which is exactly the mistake the first "5c complete" declaration made.**

    Original scope description, superseded by the above, kept for the record rather than deleted (its
    "migrate the two Category A callers" and "harmonize the add-on settlement" bullets are now done,
    per the ✅ status above):
    - Remove the now-dead re-export of `calculateAddonProration`/`calculatePlanUpgradeProration` from
      `utils/addonManagement.js` — confirmed zero remaining consumers via grep (every controller that
      used to import them from there now imports `calculateInvoice` instead).
    - Correct `utils/invoiceEngine.js`'s own header comment, which still describes
      `updateSubscription`/`initiateAddonPurchase` migration as "separate, not-yet-done work" — false
      as of item 5a's completion, and exactly the kind of stale-comment-next-to-superseded-reality this
      project has otherwise been careful to avoid.
    - Verify the Category A/C cleanup path directly: `calculateInvoice()` with no `adjustmentContext`
      was compared against `buildPricingSnapshot()` for the same inputs and matched exactly on
      `subtotal`, `discount`, `taxable`, `gst`, `total`, and the relevant line/discount shape
      (including seat add-ons and coupon-discount cases). That confirms this remaining cleanup is
      genuinely low-priority and not a fourth latent gap.

      **Scope of this equivalence check, stated precisely — "MATCH" should not be over-read as
      "proven identical under all inputs":** three cases were run — plain (base price + billing cycle
      only), seats (add-ons included), and coupon (a coupon-shaped discount applied). This is narrower
      than the earlier upgrade-migration equivalence work in two specific ways, named rather than left
      implicit:
      - **No boundary-rounding fixtures** (the `.495`/`.505`/`.999`-style cases that mattered for the
        proration equivalence check) were run here. Given the stakes are lower — this is a Category A/C
        cleanup item, not a live payment-charging migration — this wasn't treated as blocking, but it
        means the rounding behavior specifically is unverified at the edges, not confirmed safe.
      - **No case combining multiple add-on types plus a coupon together** was run, only single-axis
        cases (seats alone, coupon alone).
      - **Referral modifiers were not exercised at all in this check** — but this was confirmed to be
        immaterial, not merely untested: the real call site in question (`subscriptionController.js` —
        `updateSubscription`'s pre-payment-confirmed branch, line ~1371 — the only genuine Category A
        migration target; the `startFreeTrial` attribution here was corrected above) was read directly,
        and it never constructs or passes a `modifiers` argument to `buildPricingSnapshot()` under any
        code path — it carries its own explicit comment stating *"referral intent is NOT recorded
        here"* (registration/`applyReferralCode` are the only two referral-creation points). So the
        absence of referral coverage in this check is a non-issue for this specific caller, not an open
        gap — confirmed by reading the call site, not inferred from the check's own scope.

5b. **✅ IMPLEMENTED AND VERIFIED.** (Originally: independent defect, real not hypothetical) Coupon/
    Referral ordering is not enforced by the engine. Traced directly: `buildPricingSnapshot()`
    (`utils/pricingEngine.js`) applies its `modifiers[]` array in plain array order — no internal
    `type`-keyed sort (re-checked after 5a's controller migrations landed: still true, line 106's loop
    and line 70-71's comment — "this function trusts the order it's given" — are unchanged). The one
    function that *does* enforce Coupon-before-Referral ordering (`utils/modifierResolver.js`'s
    `resolveModifiers()`, sorted by `priority`) is still never called anywhere in the codebase —
    confirmed by grep, not assumed.

    **Correction to this item's own earlier prediction, re-checked rather than left standing:** this
    section previously said the gap "will stop being latent the moment 5a's own migration combines both
    [coupon and referral] on the upgrade/add-on paths." **That did not happen.** Both migrated call
    sites (`updateSubscription`'s upgrade path, `initiateAddonPurchase`) were checked directly
    (`subscriptionController.js` — `resolvedModifiers.push(rewardToModifier(...))`, only ever a
    referral modifier, never combined with a coupon in the same array) — the gap remains latent, not
    live, even after 5a's migrations. The fix (§7.4/§7.7 below) is still real, still recommended, and
    still not implemented — just not yet forced by a live combination.

    **This is a second instance of the same C-vs-C'' fork (§Part 3 top note / design note §6), given
    the same explicit treatment rather than a one-line aside — resolved by tracing actual object shapes,
    not by analogy alone.** Checked whether `resolveModifiers()`'s `priority` field matches what real
    callers produce: `updateSubscription`/`initiateAddonPurchase`'s referral modifiers go through
    `rewardToModifier()` and carry `priority: 20`; `createSubscription`'s coupon modifier is built ad
    hoc inline (`subscriptionController.js:140`) and carries **no `priority` field at all**. So a naive
    `modifiers.sort((a,b) => a.priority - b.priority)` inside `buildPricingSnapshot()` would evaluate
    `undefined - 20 = NaN` the first time both are combined — not a safe fix as originally stated.

    **Fix:** `buildPricingSnapshot()` derives priority internally from each modifier's `type` (its own
    `{coupon, referral}` → stage-number lookup), never trusting a caller-supplied `.priority` field —
    the more complete version of "engine orchestrates, callers don't," since it removes the engine's
    dependency on callers correctly attaching metadata, not just on callers calling things in the right
    order. Every ad hoc inline modifier (like `createSubscription`'s coupon literal) then sorts correctly
    with zero call-site changes. See `PHASE3_DESIGN_NOTE_INVOICE_ENGINE.md` §7.4 for the full trace and
    the rejected naive fix.

    **Implementation, done exactly per the recommended fix above, no deviation:** `utils/pricingEngine.js`
    now derives a `MODIFIER_STAGE = { coupon: 6, referral: 7 }` map (named after Chapter 3.3's own stage
    numbers) internally, and both `applyModifiers()` and `buildPricingSnapshot()`'s modifier loop sort
    via `sortModifiersByStage()` before applying — never trusting the caller's array order or a
    `.priority` field. `resolveModifiers()` (`modifierResolver.js`) was deliberately left untouched —
    still dead code, still harmless, not in this item's scope to wire up or remove.

    **`resolveModifiers()`'s status, recorded explicitly rather than left implicit:** before this fix,
    it was "the module built to provide this ordering guarantee, unwired." Now that ordering is enforced
    *inside* `buildPricingSnapshot()`/`applyModifiers()` directly via `MODIFIER_STAGE`, it is a **second,
    now-superseded implementation of the same guarantee** — not merely unused, but made permanently
    redundant by this fix. **Confirmed dead, safe to remove — filed as a 5c/Phase 7 cleanup item, same
    treatment as the `addonManagement.js` dead re-export**, so a future reader doesn't find it, assume
    it's load-bearing because it looks purpose-built, and either wire it in (reintroducing a second
    ordering mechanism alongside the engine's own) or re-investigate something already settled here.

    **Verified, not assumed — both code paths, checked independently, not by inference from one fix
    applied to two files:**
    - `buildPricingSnapshot()`: combined a coupon modifier with **no `.priority` field** (built exactly
      like `createSubscription`'s ad hoc literal) and a referral modifier **with** `priority: 20` (built
      via `rewardToModifier()`) in both array orders. Result: **order-independent**, both orders produce
      identical `totalAmount` and identical `modifierBreakdown`, matching the spec-mandated
      Coupon-then-Referral math exactly (`1000 → -100 (coupon) → 900 → -20% (referral) → 720`)
      regardless of which order the array was constructed in. This is exactly the case the earlier naive
      `.priority`-sort fix would have broken (`undefined - 20 = NaN`).
    - `applyModifiers()`: **confirmed to be its own standalone loop, not a thin wrapper around
      `buildPricingSnapshot()`** — checked directly rather than assumed identical from sharing the same
      edit. Ran the identical coupon/referral, both-orders test against it independently: same
      order-independence, same correct `720` result either way.
    - Re-ran regression checks against the already-migrated controllers (`updateSubscription`,
      `initiateAddonPurchase`) using fixed, reproducible dates (not `Date.now()`-relative fixtures,
      which produced a false-alarm mismatch on the first attempt here — traced and confirmed to be a
      stale hardcoded comparison value from a different real moment in time, not a regression) — old
      formula vs. new `calculateInvoice()` path matched exactly across five fixtures, including two with
      a 33%/20% referral modifier combined with proration math. Both migrated controllers only ever pass
      a single-element `resolvedModifiers` array, so this change is a no-op for them (sorting a
      1-element array), confirmed rather than assumed from that reasoning alone.
    - `node --check` clean on `utils/pricingEngine.js`.

6. New commercial actions (upgrade, add-on purchase, billing-cycle change) create a
   `CommercialTransaction` first, then a `BillingInvoice` referencing it — replacing the inline
   `pendingUpgrade`/`pendingPlanChange`/`pendingAddonAddition` sub-documents on `Subscription` for
   *newly initiated* actions only. Existing in-flight legacy pending changes are left untouched until
   they naturally resolve (no forced migration of live data mid-flight). **Depends on item 5a above**
   for the upgrade/add-on-purchase cases specifically; billing-cycle change was not investigated in
   this pass and should be checked against the same invariant before assuming it's clean.

   **✅ Started — `ADDON_PURCHASE` only, one call site, additive-only, per the same discipline used
   for Phase 2's `BillingInvoice` rollout.** Deliberately scoped to a single commercial action first
   (add-on purchase — already fully understood from the 5a/5c work, no scheduling complexity, always
   immediate) rather than all three at once, matching this session's established one-thing-at-a-time
   pattern. Traced Chapter 15's actual state machine before writing anything (not from memory):
   `CREATED → PRICED → AWAITING_PAYMENT ⇄ FAILED → COMMITTED → COMPLETED`, VOID exits any pre-COMMITTED
   state, business-intent fields immutable / payment-bookkeeping fields mutable.

   **Wired into `initiateAddonPurchase` (request) and `handlePaymentCaptured`'s addon-settlement branch
   (webhook), four write points, all additive/non-fatal, matching `BillingInvoice`'s established
   try/catch-and-log pattern — nothing reads `CommercialTransaction` back yet:**
   - **Request time, right after pricing**: SAME-FLOW RECYCLE first — any of this org/subscription's
     prior non-terminal `ADDON_PURCHASE` transactions are set to `VOID` (Chapter 15's "customer changes
     target before paying → void and replace," mapped onto the exact reservation-release/
     `pendingAddonAddition`-overwrite logic that already existed for this reason). Then a new
     transaction is created directly at `PRICED` (Chapter 15: "never lingers in `CREATED`" — a request
     that fails validation never reaches this line, so a single write already at `PRICED` is a faithful
     implementation, not a shortcut).
   - **After the Razorpay order succeeds**: `PRICED → AWAITING_PAYMENT`, `attemptCount: 1`. The order id
     is stored inside `target` (Mixed) purely as a correlation key for settlement — settlement's actual
     logic remains entirely driven by `pendingAddonAddition`, unchanged.
   - **Settlement, right after the existing amount-verification check passes**: `AWAITING_PAYMENT →
     COMMITTED` — Chapter 15/Invariant: payment confirmation is the commit point, and the amount check
     already passing is exactly that moment.
   - **Settlement, right after `addonSubscription.save()` succeeds**: `COMMITTED → COMPLETED`.

   **⭐ "Verified" scoped precisely — a narrower claim than the equivalence tests used elsewhere in this
   plan, and stated as such rather than left to imply more.** What was actually checked: all five real
   transitions (`PRICED`, `AWAITING_PAYMENT` with the `target.orderId` merge pattern actually used in
   the code, `COMMITTED`, `COMPLETED`, `VOID`) validated cleanly against the real Mongoose schema via
   `validateSync()` — confirming the documents this code constructs are **well-formed** (correct field
   names, correct enum values). `node --check` clean on `subscriptionController.js`. **This is not the
   same claim as 5a/5b/5c's "old computation equals new computation"** — there is no old path to diff
   against for genuinely new state, so schema validation is a necessary but not sufficient check; it
   says nothing about whether each transition actually fires at the correct real-world moment. That
   narrower, harder question was addressed by two follow-up traces, below.

   **Follow-up trace 1 — is "at most one non-terminal transaction" a real DB constraint, or just an
   assumption about the code's own sequencing? Checked, not assumed: it was the latter, a real gap,
   now fixed.** The original `CommercialTransaction` schema (Phase 1) had zero indexes beyond the
   default `_id`. The request-time VOID-then-create sequence in `initiateAddonPurchase` enforced "one
   non-terminal transaction per subscription+type" purely as sequential application logic — no
   atomicity between the `updateMany` (void prior) and the `create()` (new one). Under a genuine race
   (two concurrent requests), both could pass the VOID step and both create a document — the exact
   same class of gap as BUG-002 (no unique index on `Subscription.organization`, "no `findOne`
   guaranteed exactly one document"). **Fixed the same way BUG-002 was**: added a partial unique index
   (`{ subscription: 1, type: 1 }`, scoped to non-terminal statuses) to `models/CommercialTransaction.js`
   — confirmed registered correctly via `schema.indexes()`. The existing try/catch around the `create()`
   call already handles the resulting duplicate-key error gracefully (non-fatal, logged, transaction
   stays `null` for that request) — no additional code change needed beyond the index itself.

   **Follow-up trace 2 — does the settlement webhook's correlation actually break under concurrent
   transactions of different types (e.g., an add-on purchase and a seat purchase in flight
   simultaneously), or does Razorpay's own order-ID uniqueness already prevent the ambiguity? Checked
   by reading the actual query, not assumed either way — it's already safe.** Settlement's
   `CommercialTransaction.findOne()` (the only other query against this model) filters by
   `organization`, `subscription`, `type`, **and `target.orderId`** — since each purchase creates its
   own distinct Razorpay order, this lookup is disambiguated by `orderId` regardless of how many
   `AWAITING_PAYMENT` transactions exist for the org at once. The theoretical risk the review raised
   doesn't materialize here; it would only be real for a query that searched for "the" pending
   transaction without an `orderId` filter, and no such query exists in the code as written.

   **Logging consistency, checked and fixed — a real, found gap, not a clean pass.** All four write
   points are non-fatal (wrapped in try/catch, confirmed by re-reading each one), but three of the four
   log lines were missing organization/subscription context (only `transaction._id` or `order.id`) —
   the same class of gap `BillingInvoice`'s Phase 2 write was specifically corrected for earlier in this
   project. Fixed: all four now log `organization`/`subscription` consistently, matching the established
   pattern rather than reintroducing the gap it was meant to close.

   **Explicitly not done in this pass, named rather than silently deferred:**
   - **`FAILED` is unreachable** — traced whether any existing webhook handler covers a failed
     order-based add-on-purchase payment and found none: `handleCAWPaymentFailed` only handles the
     CAW registration-link/mandate flow (matched by `registrationLinkId`), a completely different
     correlation key. **This is a symptom of a real underlying product gap, not just a
     `CommercialTransaction` limitation — recorded as its own item, separate from this one, per the
     review's own distinction:** a customer whose add-on purchase payment fails today has no recovery
     path at all — `pendingAddonAddition` is simply left in place with no expiry, cleanup, or retry
     mechanism visible anywhere in this trace, independent of `CommercialTransaction`'s existence.
     Building that recovery path (and the webhook handler `FAILED` would need) is a real, separate
     future item — not fixed here, since it's a product gap the `CommercialTransaction` wiring merely
     exposed rather than caused.
   - **Upgrade and seat-purchase are not wired yet** — only `initiateAddonPurchase` was done this pass,
     deliberately one call site at a time. `updateSubscription`'s upgrade path and `authController.js`'s
     seat-purchase endpoint still don't write `CommercialTransaction` at all.
   - **`BillingInvoice` is not yet linked from `CommercialTransaction`** — `latestInvoice` stays unset;
     the add-on purchase flow doesn't currently persist a `BillingInvoice` at all (that's its own
     separate, not-yet-scoped item, distinct from this one).
   - **`ScheduledChange` (Phase 4) is untouched** — deliberately deferred to its own pass, per the
     explicit scoping agreed before starting this work: downgrade/cancellation/removal scheduling is a
     materially different problem (Rule 1 supersession, cancellation precedence, Chapter 12's Downgrade
     Eligibility Validation) and deserves its own trace, not a bundled extension of this one.
   - **This additive-only phase is temporary, not the design goal** — same as `BillingInvoice`'s Phase 2
     rollout, once something starts reading `CommercialTransaction` back (Phase 4's `ScheduledChange`
     work, or eventually the Renewal Engine), the "nothing depends on it yet" framing expires. Noted
     explicitly so it isn't mistaken for a permanent architecture the way `BillingInvoice`'s migration-
     concession comment had to warn against for its own try/catch.

7. `PaymentAttempt` (renamed from `SubscriptionPayment`) now populates its `invoice` field.

### Phase 4 — Introduce Scheduled Change as the future-intent layer
8. Downgrade/add-on-removal/billing-cycle-change scheduling starts writing `ScheduledChange`
   documents instead of `pendingUpdate`/`pendingPlanChange`'s scheduling half/`pendingAddonRemovals`.
   The Downgrade Eligibility Validation (Chapter 12) is implemented as part of this phase, run both
   at scheduling time and again at whatever eventually executes it (Phase 5).

**✅ Legacy finding resolved by this phase, not patched into the old model — `BUG-040` /
`KNOWN_BILLING_GAPS.md`'s "scheduled downgrade never reconciled at renewal."** The pre-CAW findings
register traced this precisely: `handleSubscriptionCharged` calls `applyScheduledAddonRemovals()` on
every renewal but never reads `pendingUpdate` at all, so a scheduled downgrade silently never takes
effect. `KNOWN_BILLING_GAPS.md` deliberately deferred fixing this pending Razorpay's Charge-at-Will
response — **that blocker is now resolved** (`CHARGE_AT_WILL_VALIDATION.md`), but the correct
response is not to wire `pendingUpdate` into `handleSubscriptionCharged` as that document sketches.
**Status: resolved by architectural replacement, not by patching the legacy code path.** Once Phase
4/5 land, there is no `pendingUpdate` left to forget to check — the Renewal Engine's only query is
"every `ScheduledChange` with `effectiveDate <= today`," which cannot silently omit a change type the
way four separate ad hoc pending-fields could.

### Phase 5 — 🟥 Build the Renewal Engine and its scheduler (net-new, highest-priority build)
9. Implement the R1–R13 renewal sequence (§3.5) as its own module: find due subscriptions → check
   mandate validity → build the Effective Subscription from all due `ScheduledChange` records → price
   via the Invoice Engine → charge → commit atomically on success, `past_due` on failure.
10. Add the Renewal Scheduler cron job to `backend/jobs/` (a fourth job alongside the existing three),
    matching the "dumb dispatcher, no business logic" principle already used by the existing trial
    jobs.

### Phase 6 — 🟥 Build the Retry Engine and its scheduler (net-new)
11. Implement the 3-attempt/24h-72h-120h retry cadence (§9) as its own module and scheduler job,
    replacing the manually-triggered `POST /:id/retry-payment` as the *automatic* path (the manual
    endpoint can remain as a customer/Support-initiated early-retry option, per Chapter 19's RT3).
12. Add the Mandate Monitoring reconciliation job (§2.5) and the `RewardUsage` cleanup job (§2.6) in
    the same pass, since all three are small, independent, additive scheduler jobs.

### Phase 7 — Split and shrink `handlePaymentCaptured`
13. Physically separate the legacy (`pendingUpgrade`-reading) branch from the CAW
    (`pendingPlanChange`-reading) branch into two distinct functions, now that Phases 3–4 have moved
    the CAW branch's real logic into `CommercialTransaction`/`ScheduledChange` handling instead.
    **⚠ Not started — dependency unmet.** Phase 3 item 6 (`CommercialTransaction` creation) and Phase 4
    (`ScheduledChange`) haven't been implemented (confirmed via grep: zero controller writes to either
    model anywhere in the codebase) — this item's own stated precondition doesn't hold yet. Asked the
    user which of three things "Phase 7" meant before touching `handlePaymentCaptured`; the item 13
    split itself remains genuinely not done.

**✅ Dead-code cleanup — done, verified, ahead of the Phase 8 item below (item 14 partially overtaken
by this).** Rather than wait for the full Phase 8 sequencing, three items already confirmed dead this
session (zero callers, verified by grep before removal) were removed now, since no further
investigation was needed and each was independently confirmed safe:
- **`legacyCreateSubscription_DEPRECATED`** removed entirely from `subscriptionController.js` (was
  unexported, unrouted, zero callers). The now-dead `computeGST`/`buildPricingSnapshot`/
  `applyModifiers` import in that file (only that function used them) removed alongside it.
  `routes/subscription.js`'s comment describing it as "kept... removed in Phase 8" corrected to state
  it's already removed.
- **`resolveModifiers()`, `couponToModifier()`, `resolveReferralModifier()`** removed from
  `utils/modifierResolver.js` — `resolveModifiers()` was never called anywhere (confirmed by the
  earlier 5b investigation); the other two had no callers besides `resolveModifiers()` itself.
  `rewardToModifier()` and `PRIORITY` — genuinely live (used by `updateSubscription`'s upgrade path and
  `initiateAddonPurchase`) — kept unchanged. Now-unused `getNextAvailableReward` import removed too.
- **`calculateTotalPrice()`** removed from `utils/addonManagement.js` (its only caller,
  `applyScheduledAddonRemovals()`, was migrated onto `calculateInvoice()` directly in Phase 3 item 5c).
  Now-unused `buildPricingSnapshot` import and its `module.exports` entry removed alongside it.
- **Verified, not assumed**: `node --check` clean on every touched file; re-ran a live regression
  check confirming `rewardToModifier()`/`PRIORITY` still work correctly and produce the same
  `calculateInvoice()` result as before the cleanup.
- **Not touched, correctly**: item 13's `handlePaymentCaptured` split (real Phase 7 work, dependency
  unmet — see above) and everything else in Phase 8's original list (`razorpaySubscriptionId`,
  `razorpayPlanId`, `pendingUpgrade` field removal) — those still depend on Phase 3 item 6/Phase 4
  landing first, same as item 13.

### Phase 8 — Legacy removal (already planned, now actually unblocked)
14. Remove `razorpaySubscriptionId`, `razorpayPlanId`, `pendingUpgrade`, the legacy branch split out
    in Phase 7, and `legacyCreateSubscription_DEPRECATED` — exactly the removal already flagged
    throughout `CAW_BILLING_DESIGN.md` and this document, now safe because nothing added in Phases
    1–7 depends on the legacy path. **`legacyCreateSubscription_DEPRECATED` already removed, above —
    ahead of schedule, since it needed no further investigation.** The remaining items
    (`razorpaySubscriptionId`, `razorpayPlanId`, `pendingUpgrade` field removal, the
    `handlePaymentCaptured` branch split) still depend on Phase 3 item 6/Phase 4 landing first.

### Ongoing, not phase-gated (can happen alongside any phase above)
- Fix the coupon plan-change recalculation bug (Chapter 10/13's known gap).
- Finish the referral-to-recurring-bill connection (Chapter 19's RF item).

---

## Part 4 — One Real, Unresolved Verification Gap Found During Documentation Cleanup

**Reward consumption (`consumeReservation`, the `reserved → consumed` transition on `RewardUsage`)
has reportedly never actually been observed firing on a genuinely completed payment, in any test, at
any point across the pre-CAW audit era** — every attempt was blocked by Razorpay test-gateway
timeouts before a real completed payment could exercise it. This is distinct from the mechanism being
*wrong* — Chapter 10's earlier code audit already confirmed the reservation lifecycle is correctly
implemented and guarded (the partial unique index, the atomic conditional update) — it is that this
specific, real code path has apparently never actually run end-to-end and been watched succeed.
**This should be the first thing verified once Phase 3 (Commercial Transaction) is in place and a
real add-on purchase or renewal can be driven through to a genuine capture** — not assumed correct
by inspection alone, the same discipline already applied to `reconcileMandate` (which *was* proven
live, repeatedly, earlier in this project).

---

## Two findings from the same cleanup pass, explicitly out of billing's scope — flagged, not filed here

Two real issues surfaced while sweeping the older documentation for anything worth preserving. Both
are real and worth acting on, but neither belongs in a billing specification:
1. **A Super Admin authentication bug**: the request interceptor (`services/api.js`) reportedly lets
   a phone-login `token` in `localStorage` take priority over `superAdminToken`, meaning a Super
   Admin session can be silently shadowed by an ordinary user token. This is an authentication
   concern, not a billing one — worth its own fix, separately from this plan.
2. **A potential secret-leak**: something reportedly prints the SendGrid API key to logs on module
   load. This should be verified and fixed immediately regardless of anything else in this document
   — logging a live API key is a security issue on its own timeline, not something to queue behind a
   billing migration.

---

## Summary of what this audit actually found

**Encouraging:** the CAW acquisition flow, webhook plumbing, mandate reconciliation, and pricing math
are all already built, proven, and match the frozen spec closely — this is real, working code, not
just design. The route layer is already reasonably well-shaped.

**The two things that matter most going forward:** (1) the pending-change data model has genuinely
drifted into five overlapping mechanisms where the spec calls for two clean collections
(`ScheduledChange` + `CommercialTransaction`), and (2) **the Renewal and Retry Engines — arguably the
two most important pieces of a subscription billing system — do not exist in any form yet.** Phases 5
and 6 above are not cleanup; they are the actual remaining core of the build.
