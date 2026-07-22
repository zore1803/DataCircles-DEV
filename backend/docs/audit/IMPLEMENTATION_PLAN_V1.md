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
   - **Upgrade and seat-purchase were not wired yet as of this pass** — only `initiateAddonPurchase` was
     done here, deliberately one call site at a time. (Superseded twice since: `authController.js`'s
     seat-purchase endpoint was unified onto the same `startAddonPurchase()` helper as part of the
     add-on-purchase-lifecycle consolidation — see the follow-up verification note under item 5c above —
     so it already writes `CommercialTransaction` via that shared path, not a separate wiring pass.
     Upgrade is now wired too — see the new ✅ entry immediately below.)
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

   **✅ Upgrade — wired, second call site, same pattern as add-on purchase, done in isolation.**

   **Step 1 — traced fresh, not assumed to mirror add-on purchase.** Read `updateSubscription`'s
   tier-upgrade branch (`subscriptionController.js`, request side — pricing via `calculateInvoice()`
   with `adjustmentContext.type: 'plan_upgrade'`, Razorpay order creation, `pendingPlanChange` write)
   and `handlePaymentCaptured`'s `pendingPlanChange`-branch (webhook side — amount verification,
   plan/add-on commit, `pendingPlanChange` clear). Confirmed upgrade already has its own same-flow
   recycle mechanism (release the prior `pendingPlanChange.referralRewardUsageId` reservation before a
   new upgrade checkout overwrites it) — the `CommercialTransaction` VOID-then-create step was added
   at the same point, reusing this existing recycle moment rather than inventing a new one.

   **Step 2 — transition points, mapped to the actual code, not the add-on template blindly:**
   - **Request time, right after `calculateInvoice()` prices the upgrade adjustment**: VOID any prior
     non-terminal `UPGRADE` transaction for this subscription, then create a new one directly at
     `PRICED` (`target: { newPlanName, newBasePrice, oldTotal, newTotal }`).
   - **After the Razorpay order succeeds**: `PRICED → AWAITING_PAYMENT`, `attemptCount: 1`, `orderId`
     merged into `target` — identical correlation-key pattern to add-on purchase.
   - **Settlement, right after the existing amount-verification check passes**
     (`handlePaymentCaptured`'s upgrade branch): looked up by `organization`/`subscription`/
     `type: 'UPGRADE'`/`target.orderId`/`status: 'AWAITING_PAYMENT'` → `COMMITTED`.
   - **Settlement, right after `upgradeSubscription.save()`**: `COMMITTED → COMPLETED`.
   - No `VOID`/recycle mechanism was invented beyond what already existed — the pre-existing referral-
     reservation recycle logic was the only same-flow-replacement pattern found for upgrade, and the
     `CommercialTransaction` VOID step piggybacks on that same code path, not a new one.

   **Step 3 — additive/non-fatal at every write**, matching the add-on-purchase precedent exactly
   (try/catch around every `CommercialTransaction` read/write, logged with `organization` +
   `subscription` context, never the bare id alone — the same gap that had to be fixed after the fact
   for add-on purchase was not reintroduced here).

   **Step 4 — no numeric equivalence test was run; this is a "pricing unchanged" determination, not a
   check that ran and passed, and should not be read as the latter.** Upgrade's request-side pricing
   has gone through `calculateInvoice()`'s Stage 5 since item 5a/5c; this pass's edit reads
   `proratedDiff`/`discountedProratedDiff`/`proratedDiffWithGST` from the exact same `upgradeInvoice`
   object at the exact same lines as before — zero pricing variables touched, confirmed by inspection
   of the diff itself, not inferred from "pricing wasn't the goal of this task." No fixture was run, no
   proration factor printed, no before/after numbers compared, unlike the 5a/5c/add-on-purchase
   equivalence work. `node --check` clean on `subscriptionController.js` after the change.

   **Step 5 — whole-backend grep, not scoped to the two touched files.** Searched all of `backend/`
   for `CommercialTransaction.create(`, `CommercialTransaction.updateMany(`, `new CommercialTransaction(`,
   and `type: 'UPGRADE'`. Exactly one creation site exists (`subscriptionController.js`'s
   `updateSubscription`, this change) and exactly one settlement lookup site
   (`subscriptionController.js`'s `handlePaymentCaptured`, this change) — no other file references
   `type: 'UPGRADE'` for a `CommercialTransaction`. **No unintended duplicate implementation found.**

   **Scope, precisely.** `FAILED` remains unreachable for upgrade for the same reason it does for
   add-on purchase (no webhook handler covers a failed order-based payment for this correlation key —
   the underlying product gap tracked above, not reintroduced here). `BillingInvoice` is still not
   linked (`latestInvoice` unset) — same, separately-scoped gap as add-on purchase.

   **✅ Downgrade and Cancellation — wired, final two flows of the CommercialTransaction rollout,
   both no-payment/scheduled-or-immediate-intent flows, done together per the combined final-rollout
   scoping (both touch the same `updateSubscription`/`cancelSubscription` request flows and the same
   documentation section, so tracing them separately would have meant rereading the same controller
   twice for no benefit).**

   **Structural difference from add-on purchase/upgrade, confirmed by tracing the code first, not
   assumed from Chapter 3.2/18 alone:** neither flow calls `calculateInvoice()` or creates a Razorpay
   Order. Downgrade schedules a plan/price change via `subscription.pendingUpdate` (applied at
   `currentPeriodEnd` by the renewal-side reconciliation, untouched here) and updates the Razorpay
   *recurring* subscription's plan (`schedule_change_at: 'cycle_end'`) — no one-time charge exists at
   all today, only arithmetic (`newPricePerUser + newAddonsTotal`), not an invoice computation.
   Cancellation sets `cancelAtPeriodEnd`/ends a trial — no amount is computed anywhere in this flow.
   **Confirms the brief's expectation exactly: `CREATED → PRICED → COMMITTED → COMPLETED`, `AWAITING_PAYMENT`
   never entered, for both flows.**

   **Downgrade — a real scoping discovery, reported rather than papered over.** The code branch that
   handles downgrade (`isBillingCycleChange || !isUpgrade` in `updateSubscription`) is shared with two
   other cases: a same-tier billing-cycle-only change, and a tier upgrade combined with a billing-cycle
   change (both land here because the earlier immediate-upgrade intercept only fires for a same-cycle
   tier upgrade). Writing `CommercialTransaction{type:'DOWNGRADE'}` unconditionally for this whole branch
   would have mistyped those two other cases. **Resolution:** introduced `isGenuineDowngrade =
   newPlanPriority < currentPlanPriority` and gated the `DOWNGRADE` transaction on that exact condition;
   the billing-cycle-only and upgrade+cycle-change cases are left unwired, matching the existing,
   already-tracked table entry ("Billing Cycle Change — 🔍 Not yet investigated") — not a new gap
   introduced here, an existing one correctly not expanded into.

   **Downgrade transition points:**
   - **`PRICED`**: right after the target plan/price/effective-date are known and `pendingUpdate` is
     about to be constructed, gated on `isGenuineDowngrade`.
   - **`COMMITTED`**: right after `subscription.save()` persists `pendingUpdate`.
   - **`COMPLETED`**: immediately after, same request — no separate future event to wait on; per
     Chapter 18, "completed" means the customer's decision was recorded and accepted, not that the
     downgrade has taken effect (that's a later renewal-time event, out of scope here).
   - **`VOID`**: no existing recycle/release step exists for a re-submitted `pendingUpdate` to piggyback
     on (unlike upgrade's referral-reservation recycle) — `subscription.pendingUpdate` is simply
     overwritten today with no side effect to release. The VOID-then-create step was added purely for
     `CommercialTransaction` consistency with the other flows, not because a recycle mechanism already
     existed. Stated plainly rather than implied to be a reuse of an existing pattern.

   **Cancellation transition points:** both the trial-cancellation branch and the paid-Razorpay-cancel
   branch (`cancelSubscription`) create the transaction once, before either branch, then move it
   `COMMITTED → COMPLETED` immediately after that branch's own persistence step
   (`subscription.save()` for trial; `subscription.save()` after `razorpay.subscriptions.cancel()` for
   paid) — same reasoning as downgrade's COMMITTED/COMPLETED pairing.

   **Cancellation's state shape, checked against Chapter 4.2 directly, not carried over from downgrade
   by pattern-matching.** The spec's own cancellation state path is `requested → scheduled →
   effective_at_renewal → completed` (`BILLING_DOMAIN_SPECIFICATION.md` line 1514), stated explicitly as
   "the same shape as the general Change state machine..., not a special case grafted on." This
   independently confirms the no-payment/scheduled family this `CommercialTransaction` wiring assumes —
   it was not simply assumed to mirror downgrade's already-checked shape.

   **On `VOID`/reactivate — a precise distinction, not a generic "nothing found" note.** This is not "the
   reactivate feature hasn't been built yet." Chapter 4.2 (line 1508) **explicitly decides**:
   "there is no 'uncancel,' no resume... resubscribing after cancellation is a brand-new subscription" —
   adopted spec (Change Proposal V1.1-001), not an unbuilt gap. So there is no `VOID`/recycle mechanism
   for cancellation to piggyback on, and there deliberately never will be one at the Subscription level —
   this is a settled design decision, not a missing feature to flag for later work. (This is unrelated to
   Chapter 9 P16 — "cancel a *scheduled downgrade*" — which is about un-scheduling a *different* pending
   commercial change, not un-cancelling the subscription itself; no claim is made here about that case,
   since it isn't part of this session's scope.)

   **Step 4 (equivalence), stated the same precise way as upgrade's corrected entry — not "verified,"
   exactly what was and wasn't checked:** no numeric equivalence test was run for either flow, because
   neither flow computes a chargeable amount today — confirmed by reading both code paths in full, not
   inferred from the spec's "no payment" description alone (downgrade's `newTotalAmount` is plain
   arithmetic feeding the *recurring* Razorpay plan sync, not a one-time charge; cancellation computes no
   amount at all). `node --check` clean on `subscriptionController.js` after both changes.

   **Step 5 (whole-backend duplicate grep), scope stated exactly, line numbers pinned down rather than
   "confirmed one each."** Searched all of `backend/` for `CommercialTransaction.create(`,
   `CommercialTransaction.updateMany(`, `new CommercialTransaction(`, `type: 'DOWNGRADE'`, and
   `type: 'CANCELLATION'`. `DOWNGRADE`: `updateMany` at `subscriptionController.js:1439`, `create` at
   line 1448 — one site. `CANCELLATION`: `updateMany` at `subscriptionController.js:1622`, `create` at
   line 1631 — one site. No other file references either type for a `CommercialTransaction`.

   **Sanity check on `isGenuineDowngrade` — a same-plan billing-cycle change (monthly → yearly on the
   same tier) does not create a `DOWNGRADE` transaction, confirmed by re-reading the code, not inferred
   from the variable's name.** `isGenuineDowngrade = newPlanPriority < currentPlanPriority`, where both
   priorities are looked up only by `planId` (`{starter:1, growth:2, business:3}`) — billing cycle plays
   no part in the comparison. For a same-plan cycle change, the requested `planId` equals
   `subscription.planName`, so `newPlanPriority === currentPlanPriority` and `isGenuineDowngrade` is
   `false`; no `CommercialTransaction` is written for that case, matching the already-stated scoping
   (billing-cycle-only changes deliberately left unwired). **No
   unintended duplicate implementation found.**

   **CommercialTransaction rollout status, complete as of this pass:** `ADDON_PURCHASE`, `UPGRADE`,
   `DOWNGRADE`, and `CANCELLATION` all now write `CommercialTransaction` at their respective request-time
   decision point through to completion. Remaining, explicitly out of scope for this rollout (tracked
   separately, not silently dropped): `BILLING_CYCLE_CHANGE` (the shared-branch ambiguity above) and
   `NEW_PURCHASE`/`START_TRIAL`/`CORRECTION` (never in scope for this rollout to begin with — Category A
   flows, per the 5c reframing). `BillingInvoice` linkage (`latestInvoice`) remains unset across all four
   wired types. No `AWAITING_PAYMENT`-capable `FAILED` recovery path exists for any of the payment-gated
   flows (`ADDON_PURCHASE`/`UPGRADE`) — same tracked product gap, not expanded here. This rollout is
   correctly the boundary for "every existing commercial action creates a CommercialTransaction" — the
   only remaining CommercialTransaction-shaped work is what Phase 4 (`ScheduledChange`) and the Renewal
   Engine will themselves need to read/write, not additional rollout to existing controllers.

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

### Phase 4 tracing session — `pendingUpdate` full trace (oracle for `ScheduledChange`, no implementation this pass)

**Scope of this subsection: tracing only, per the session brief. No `ScheduledChange` code was written.
`CommercialTransaction` code was not touched.** This is the "know the old behavior precisely before
building the new thing that must match it" discipline already used for every prior equivalence test in
this project (5a/5c, add-on-purchase/upgrade/downgrade/cancellation).

**Step 0 — is `BILLING_CYCLE_CHANGE` `pendingUpdate`-based or immediate/payment-gated? Answer: it's
neither consistently — it depends on `paymentMode`, a real branching dimension not previously named as
such.** Read `updateSubscription` directly rather than inferring from the domain spec:
- **Non-UPI (mandate/card) subscriptions:** a same-tier billing-cycle-only change falls into the
  `isBillingCycleChange || !isUpgrade` branch (`subscriptionController.js:1388` onward, the same branch
  downgrade uses) and writes `subscription.pendingUpdate` — no Razorpay order, no charge now.
- **UPI subscriptions:** the same request is intercepted *earlier* by the "UPI cancel-and-recreate"
  branch (`subscriptionController.js:1093`, guarded by `paymentMode === 'upi' && subscription.isPaymentConfirmed
  && !_isDowngrade` — `_isDowngrade` excludes only genuine downgrades, not billing-cycle-change or
  upgrade+cycle-change combos). This branch cancels the existing Razorpay subscription immediately,
  creates a **brand-new** Razorpay subscription and a **brand-new local state** on the *same* `Subscription`
  document, and explicitly sets `subscription.pendingUpdate = null` (line 1132) — it never reads or
  writes `pendingUpdate` for its own purposes at all. This is a second, independent scheduling-bypass
  mechanism that was not visible from the domain spec's abstract description alone.

**This is exactly the kind of hidden second mechanism the whole-backend search (`pendingUpdate`,
`pendingAddon*`, `pendingPlan*`, `effectiveAt`, `scheduled`) was run to catch before assuming
`pendingUpdate` is the only scheduling primitive — and it found one.** Classified below rather than
merged into the `pendingUpdate` trace: the UPI branch is **not** a `ScheduledChange` candidate at all,
since nothing is scheduled — it takes effect immediately, unconditionally, regardless of whether the
requested change was a downgrade, an upgrade, or a pure cycle change. It is `Category A` in 5c's own
sense (fresh state, no scheduling), just triggered from inside the "scheduled changes" code path by
payment-mode branching rather than by the upgrade-interception check earlier in the function.

**Answer to Step 0, stated plainly:** for non-UPI subscriptions, `BILLING_CYCLE_CHANGE` uses
`pendingUpdate` (naturally covered by the same `ScheduledChange` migration as downgrade). For UPI
subscriptions, it is immediate and bypasses `pendingUpdate` entirely (independently still open, unrelated
to `ScheduledChange` — not wired into anything this session, per the hard constraint).

**Step 1 — every `pendingUpdate` write/read/clear site, whole `backend/` directory, file:line:**

| Action | Site | Fields touched | Trigger |
|---|---|---|---|
| Write | `subscriptionController.js:1403` (inside the `isBillingCycleChange \|\| !isUpgrade` branch) | `planName`, `pricePerUser`, `userCount` (hardcoded `1`), `totalAmount`, `billingCycle`, `scheduledAt` (= `currentPeriodEnd`), `carriedAddons[]`, `removedAddons[]` | A downgrade **or** a non-UPI same-tier billing-cycle-change request reaches `updateSubscription` |
| Clear (null) | `subscriptionController.js:1132` | entire field set to `null` | The UPI cancel-and-recreate branch fires (Step 0) — clears defensively even though nothing upstream could have set it in the same request |
| Clear (null) | `subscriptionController.js:1296` | entire field set to `null` | The "not payment confirmed" branch (Category A, first-ever paid conversion) — same defensive clear, unrelated to any actual pending downgrade |
| Read | `subscriptionController.js:2860` (`handleSubscriptionCancelled`) | reads `planName`, `billingCycle`, `userCount`, `scheduledAt` to build a **brand-new** `Subscription` document via `razorpay.subscriptions.create()` | Fires only inside the legacy, non-CAW `subscription.cancelled` webhook handler — a cancel-and-recreate model predating Charge-at-Will |
| **Never cleared after that read** | — | `subscription.pendingUpdate` is not set to `null`/`undefined` anywhere inside `handleSubscriptionCancelled` | Confirmed by reading the full function body (`subscriptionController.js:2835-2915`) — the read at line 2860 has no matching clear |
| **Never read by renewal** | — | — | `handleSubscriptionCharged` (the actual renewal/charge webhook handler, `subscriptionController.js:2794` area) never references `pendingUpdate` at all — confirmed by grep, zero hits in that function. `backend/jobs/subscriptionLifecycleJobs.js` (the only cron file that exists) also has zero references. |

**This is not a new discovery — it's a previously-documented, still-live gap (BUG-040 / the "downgrade
never reconciled at renewal" finding), confirmed still true today by re-reading the code directly rather
than trusting the existing docs' claim without checking.** `backend/docs/KNOWN_BILLING_GAPS.md` and this
file's own §2.4 already named this: a scheduled downgrade's `pendingUpdate` is written but nothing in the
real renewal path ever reads it, so the DB's `planName`/`totalAmount` silently keep showing the
pre-downgrade plan forever (Razorpay itself did get the correct lower recurring amount via the
`schedule_change_at: 'cycle_end'` call at write time — the *vendor* side is correct, only the *local DB
state* never reconciles). `subscriptionController.js:2796-2804` carries an explicit in-code note that this
is deliberately not fixed, pending a Razorpay support ticket response, since fixing it might require
redesigning the reconciliation model — i.e., this may be intentionally left for `ScheduledChange`/the
Renewal Engine to make moot, rather than patched in the legacy path. **Not fixed here, per the hard
constraint — documented precisely and left alone.**

**Contrast — `pendingAddonRemovals` (a related but structurally different field) is fully wired,
confirming the read/clear gap above is specific to `pendingUpdate`, not a general "nothing reads
pending-anything" problem:** `utils/addonManagement.js`'s `applyScheduledAddonRemovals()` reads
`subscription.pendingAddonRemovals`, applies each due removal, and clears the array
(`subscription.pendingAddonRemovals = []`, `addonManagement.js:314`) — and this function **is** called
from the real renewal path (`subscriptionController.js:2814`, inside `handleSubscriptionCharged`). So the
"nothing reads pending-x at renewal" gap is real for `pendingUpdate` specifically, not a repo-wide
absence of renewal-time reconciliation.

**Step 2 — single-slot vs. multiple-slot, checked directly against the schema, not assumed:**
`subscription.pendingUpdate` is a **single embedded object** (`models/Subscription.js:150-176`) — a
second downgrade/cycle-change request before the first takes effect would overwrite it entirely (no
merge, no coexistence; confirmed no VOID/merge logic exists at the write site, matching the earlier
`CommercialTransaction` downgrade wiring's own finding that no recycle mechanism exists here). By
contrast, `pendingAddonRemovals` is already an **array** (`models/Subscription.js:251-260`) — genuinely
supports multiple independent scheduled removals coexisting, which is exactly Chapter 16's
`ScheduledChange` model (many independent documents, not one slot). **This confirms the single-slot
limitation is real, and it is specific to the plan/cycle-change mechanism (`pendingUpdate`) — not true of
every "pending" field on `Subscription`.** A subscription today cannot have a pending downgrade AND an
independently-tracked pending billing-cycle-change coexisting as two separate records the way Chapter 16
requires — only one `pendingUpdate` slot exists, and the current code already conflates both into that
one write (Step 0/Step 1's write site handles both downgrade and cycle-change through the identical
object shape). This is very likely the single biggest structural gap `ScheduledChange` must close for
this mechanism specifically.

**Dependency graph — one per commercial event that currently participates in `pendingUpdate`, plus the
two mechanisms that deliberately do not:**

```
Downgrade (non-UPI)
    │
    ▼
updateSubscription() — isGenuineDowngrade branch
    │
    ▼
pendingUpdate written (subscriptionController.js:1403)
    │
    ▼
Renewal processing — NONE EXISTS for this field
    │                (handleSubscriptionCharged never reads it — confirmed gap, BUG-040)
    ▼
pendingUpdate never cleared by any renewal path
    (only cleared defensively by unrelated branches — lines 1132, 1296 — never by the
    branch that's supposed to consume it)
```

```
Billing Cycle Change (non-UPI, same tier)
    │
    ▼
updateSubscription() — same isBillingCycleChange || !isUpgrade branch as downgrade
    │
    ▼
pendingUpdate written (identical object shape/site as downgrade — no separate field)
    │
    ▼
Renewal processing — NONE EXISTS (same gap as downgrade, same write site)
    │
    ▼
pendingUpdate never cleared by any renewal path
```

```
Billing Cycle Change (UPI) / Upgrade+CycleChange (UPI)
    │
    ▼
updateSubscription() — UPI cancel-and-recreate branch (line 1093)
    │
    ▼
Immediate: Razorpay subscription cancelled + a brand-new one created,
brand-new local state written directly (no scheduling at all)
    │
    ▼
pendingUpdate explicitly nulled (line 1132) — was never the mechanism in play
    │
    ▼
No ScheduledChange candidate here — independently open, unrelated, not touched this session
```

```
Add-on Removal (any payment mode)
    │
    ▼
scheduleAddonRemovalEndpoint / downgrade's incompatible-addon handling
    │
    ▼
pendingAddonRemovals[] entry appended (array, not pendingUpdate)
    │
    ▼
Renewal processing — applyScheduledAddonRemovals(), called from
handleSubscriptionCharged (subscriptionController.js:2814) — WIRED, WORKING
    │
    ▼
pendingAddonRemovals[] cleared to [] (addonManagement.js:314)
```

```
Subscription Cancellation (legacy cancel-and-recreate webhook path only)
    │
    ▼
handleSubscriptionCancelled() — reads pendingUpdate if present (line 2860)
    │
    ▼
Builds an entirely new Subscription document (old pre-CAW cancel-and-recreate model)
    │
    ▼
pendingUpdate on the OLD subscription document is never cleared
    (dead-end read — this path is itself legacy, unrelated to the
    CommercialTransaction{type:'CANCELLATION'} flow wired this rollout,
    which operates on cancelAtPeriodEnd, not pendingUpdate, at all)
```

**Net effect for the next implementation session:** `ScheduledChange` for downgrade and non-UPI
billing-cycle-change can be modeled as a direct 1:1 replacement of `pendingUpdate`'s write site (same
trigger, same fields, minus the single-slot limitation) — but the **read/clear side has no working
oracle to match against, because none exists today.** The Renewal Engine (Phase 5) will be the *first*
real consumer of this data, not a migration of existing reconciliation logic — this is "net-new
construction wearing existing-migration clothes" for the read/clear half specifically, exactly the same
category of finding as §2.4's "Renewal Engine does not exist" conclusion, just rediscovered from the
`pendingUpdate` angle instead of the cron-jobs angle. The UPI cancel-and-recreate path and the legacy
cancel-and-recreate webhook path are both explicitly out of `ScheduledChange`'s scope — named here so a
future session doesn't try to fold them in by assuming every "pending"-adjacent code path belongs to the
same migration.

### Phase 4 design session — `ScheduledChange` design boundaries (design-only, no implementation)

**Scope: design-only, per the session brief. No model file created, no controller touched, no
`CommercialTransaction` code touched.** This is a design session with *targeted* tracing — bounded to
answering specific "?" cells, not another open-ended backend search.

**Step 0 — completed table.** Payment-mode dependence checked directly by grepping every function this
session's candidates run through (`updateSubscription`, `cancelSubscription`,
`scheduleAddonRemovalEndpoint`/`scheduleAddonRemoval`, `startAddonPurchase`) for `paymentMode`/`upi`
references — confirmed the only two `paymentMode` branch points in the entire backend are both inside
`updateSubscription` (`subscriptionController.js:829`, `:1093`).

| Commercial Action | Deferred? | Immediate? | Payment-Mode Dependent? | Evidence | `ScheduledChange` candidate? |
|---|---|---|---|---|---|
| Upgrade (same-cycle tier upgrade) | No | Yes (Order-based) | **No** — intercepted at `updateSubscription:851` before `paymentMode` is even read at that point in control flow; fires identically for UPI and non-UPI | `subscriptionController.js:851` | No |
| Upgrade + billing-cycle-change (non-UPI) | **Yes** | No | Yes | Falls through the early intercept (`isBillingCycleChangeUpg` true), then reaches `:1093`'s UPI guard (false for non-UPI), then lands in the `:1388` `pendingUpdate` branch — same object/site as downgrade | **Yes** |
| Upgrade + billing-cycle-change (UPI) | No | Yes (cancel-and-recreate) | Yes | `:1093` (`paymentMode==='upi' && !_isDowngrade`, true for this combo since it's not a downgrade) | No — permanent bypass, see Step 0a |
| Billing-cycle-change only (non-UPI) | Yes | No | Yes | Same `:1388` `pendingUpdate` branch as above | **Yes** |
| Billing-cycle-change only (UPI) | No | Yes (cancel-and-recreate) | Yes | `:1093` | No — permanent bypass, see Step 0a |
| Downgrade (any billing-cycle combo) | Yes | No | **No** — `!_isDowngrade` in the `:1093` guard explicitly excludes every genuine downgrade from the UPI branch, so it always reaches `pendingUpdate` regardless of payment mode | `:1093` guard, `:1388`/`:1403` | Yes — already `CommercialTransaction`-wired (`isGenuineDowngrade`) |
| Cancellation | Yes | No | **No** — `cancelSubscription` (`:1537-1586`) has zero `paymentMode`/UPI branching, confirmed by grep across the whole function | `cancelSubscription:1537-1586` | Yes — already `CommercialTransaction`-wired |
| Add-on removal | Yes | No | **No** — `scheduleAddonRemovalEndpoint`/`scheduleAddonRemoval` have zero payment-mode branching, confirmed by grep | `subscriptionController.js:3583`, `addonManagement.js:209` | **Yes** |
| Add-on purchase | No | Yes | No — `addonPurchaseLifecycle.js` has zero paymentMode branching, confirmed by grep | `addonPurchaseLifecycle.js` | No |

**A genuinely new fork, beyond what the session's own draft table anticipated — stated explicitly rather
than silently absorbed into the existing "billing cycle change" framing.** The UPI bypass is not scoped
to "billing cycle change" as a category; it fires for *any* non-downgrade request that changes the
billing cycle, including a tier upgrade combined with a cycle change. That means **`Upgrade` itself is
payment-mode-bifurcated**, not uniformly immediate/payment-gated the way the original draft table
assumed — only the same-cycle case is. Split into three rows above (not two) for exactly this reason:
forcing "Upgrade" into one row would have repeated the `isGenuineDowngrade`-class mistake of one branch
silently covering two different real behaviors.

**Step 0a — the UPI-bypass rows: fully out of `ScheduledChange`'s scope, no `BYPASSED_IMMEDIATE` marker.**
Reasoning, more specific than "it's immediate": this path is neither deferred nor payment-gated-immediate
(the shape upgrade/add-on-purchase have, which await a webhook before completing) — it has **no payment
step and no pending window at all**. `updateSubscription`'s UPI branch (`:1093-1154`) mutates the
subscription document synchronously, in the same request/response cycle, with nothing ever placed in a
pending state to represent. `ScheduledChange`'s entire model (Chapter 16) is "future work not yet
applied"; this path never produces future work for anything to find or apply. Adding a
`BYPASSED_IMMEDIATE` status would mean writing a `ScheduledChange` document whose entire lifecycle is
"already done before it exists" — a contradiction of what the field means everywhere else in the model.
If audit visibility into this bypass is wanted later, that belongs to `BillingEvent`/`CommercialTransaction`
(a fact-of-record concern), not a reason to grow `ScheduledChange`'s schema.

**Step 1 — targeted search, bounded to the table's "?" cells, not an open-ended audit.** Confirmed via
grep that `paymentMode` (and the underlying `razorpaySubscription?.payment_method`/`mandate?.type` reads)
appears nowhere in `cancelSubscription`, `scheduleAddonRemovalEndpoint`, `addonManagement.js`, or
`addonPurchaseLifecycle.js` — only inside `updateSubscription`. This closed every "?" cell in the table
above; no further search was performed beyond this, per the session's own scoping.

**Step 2 — `ScheduledChange`'s responsibility, one paragraph.** `ScheduledChange` is responsible for
representing future commercial intent for the four action-shapes that are genuinely deferred and
payment-mode-uniform-or-explicitly-scoped-per-mode: downgrade, cancellation, add-on removal, and
non-UPI billing-cycle-change (bare or combined with an upgrade). It is *not* responsible for: anything
immediate/payment-gated (upgrade same-cycle, add-on purchase — those are `CommercialTransaction`'s
domain, already built), the UPI cancel-and-recreate bypass (Step 0a — permanently out of scope, no
representation of any kind), retry logic (Retry Engine, Phase 6), or UI state (derived from `Subscription`
and `ScheduledChange` reads, not stored redundantly). One subscription may have multiple independent
`ScheduledChange` records open at once (the single-slot limitation the tracing session found in
`pendingUpdate` is exactly what this model exists to remove) — precedence between them (e.g., a
cancellation superseding a pending downgrade) is Renewal Engine/Change Engine logic, not something
`ScheduledChange`'s own schema needs to encode beyond `status`.

**Step 3 — schema, adjusted from Chapter 16's scaffold with deltas justified, not silently adopted
unmodified:**

```js
ScheduledChange
  organization         ObjectId, ref Organization
  subscription          ObjectId, ref Subscription
  commercialTransaction  ObjectId, ref CommercialTransaction, nullable
  type                   enum: PLAN_CHANGE | BILLING_CYCLE_CHANGE | REMOVE_ADDON | REDUCE_QUANTITY | CANCELLATION
  status                 enum: PENDING | EXECUTED | CANCELLED   (default PENDING)
  reason                 String  // e.g. "Customer Request", "Superseded", "Subscription Cancelled"
  effectiveAt             Date
  payload                 Mixed   // type-specific: target plan, addon key, quantity delta
  createdAt / updatedAt   (timestamps)
```

**No field added for payment mode.** The instinct to add one (so the Renewal Engine could know whether to
query `ScheduledChange` for a given subscription at all) was considered and rejected: payment mode is a
property of the *subscription* (`razorpaySubscriptionId` present vs. `mandateTokenId` present), not of the
*change*, and Step 0a already established the UPI bypass never creates a `ScheduledChange` record in the
first place — so there is never a `ScheduledChange` document belonging to a subscription that "shouldn't"
be queried. The Renewal Engine's query (`effectiveAt <= today`, per §2.4) is correct as originally
specified; no schema change is needed to accommodate the UPI finding. This scaffold is adopted unmodified.

**Edge case checked directly, not left as an unstated assumption: what if a subscription's payment method
changes between a downgrade being scheduled and its effective date arriving?** Confirmed by re-reading
the downgrade write site: this doesn't matter, and not because payment mode is assumed stable — because
**downgrade's execution has no payment-mode-sensitive step at all.** It never creates a charge or a
Razorpay order, at scheduling time or (per this project's own tracing finding) at renewal today. The only
place `razorpaySubscriptionId` is read in the downgrade branch (`:1464`) is to *opportunistically* sync
Razorpay's own recurring-plan object as a best-effort side effect — not a gate on whether the downgrade
itself applies. So even if the customer's payment method changes mid-flight, there is no downgrade-specific
logic that would need to behave differently. The Renewal Engine will read the subscription's *live*
payment state at execution time for its own charging mechanics (a Renewal Engine concern), not because
`ScheduledChange` needed to capture a snapshot of it. Framed more durably than "payment mode": what
`ScheduledChange` actually needs to know is "I am due" — how a due change gets executed (which Razorpay
mechanism, which mandate type, potentially a different provider entirely someday) is the Renewal Engine's
decision to make at execution time, not something baked into the record describing what's due.

**Step 4 note:** this table, the Step 0a decision, the one-paragraph ownership statement, and the
adopted-unmodified schema are the complete design-session output. No model file was created, no migration
code written, no controller touched, `CommercialTransaction` untouched — per the session's hard
constraints. Implementation (the model file itself, then migrating `pendingUpdate`'s write sites) is the
next session's work, not this one's.

### Phase 4 implementation session — `ScheduledChange` model + additive write-alongside

**Scope: additive writes only, per the session brief. Nothing reads `ScheduledChange` back.
`pendingUpdate`/`pendingAddonRemovals` are unmodified and remain fully authoritative. The UPI bypass
path, `CommercialTransaction` code, and the Renewal Engine were not touched.**

**Model:** `backend/models/ScheduledChange.js` already existed from the Phase 1 schema-only pass and
matches the design session's finalized scaffold exactly, field-for-field — confirmed by direct
comparison, not assumed. Only the header comment was updated (was "inert until Phase 4," now states
this collection is write-only as of this session, not yet read by anything).

**Sites wired (three, not four — see the two findings below for why a fourth and fifth exist and
weren't touched):**

| Commercial action | Site | `type` | `payload` |
|---|---|---|---|
| Downgrade / non-UPI billing-cycle-change (bare or upgrade-combined) | `subscriptionController.js:1436` (right after the `pendingUpdate` object literal at `:1404`, inside the `isBillingCycleChange \|\| !isUpgrade` branch) | `PLAN_CHANGE` if `isGenuineDowngrade`, else `BILLING_CYCLE_CHANGE` | `planId`, `pricePerUser`, `billingCycle`, `isBillingCycleChange`, `isGenuineDowngrade` |
| Cancellation (paid path only) | `subscriptionController.js:1745` (`cancelSubscription`, right after `subscription.cancelAtPeriodEnd = true; await subscription.save();`) | `CANCELLATION` | `cancelAtPeriodEnd` |
| Add-on removal | `addonManagement.js:257` (`scheduleAddonRemoval`, right after `pendingAddonRemovals` is saved) | `REMOVE_ADDON` | `addonKey`, `quantity` |

**A distinction the design table didn't split out, caught before writing code, not after: trial
cancellation is immediate, not deferred.** `cancelSubscription`'s trial branch sets `trialEnd = new
Date()` and flips `appStatus` to cancelled in the same request — no future window exists for it to
represent, the same reasoning as the UPI bypass (Step 0a). Only the paid-subscription branch
(`cancelAtPeriodEnd = true`, effective at `currentPeriodEnd`) is genuinely deferred. `ScheduledChange` is
written only for the paid path — writing one for trial cancellation would have represented something
already-completed as if it were still pending.

**Invariant, checked per site, with the mechanism differing by how the underlying legacy write itself
behaves — not applied uniformly by assumption:**
- **Downgrade/billing-cycle-change and cancellation:** `pendingUpdate` is a plain overwrite (no merge) —
  confirmed by re-reading the write site, not assumed. So a repeated request must not accumulate multiple
  `PENDING` `ScheduledChange` records; each write first runs `updateMany({status:'PENDING', ...}, {$set:
  {status:'CANCELLED'}})` before creating the new one. Cancellation's cancel-prior step is broader (any
  type, not just `CANCELLATION`), reflecting Chapter 9's cancellation-precedence rule (cancellation
  supersedes a pending downgrade/cycle-change) as bookkeeping only — no reader acts on this yet.
- **Add-on removal:** `pendingAddonRemovals` *merges* quantity on a repeat request for the same add-on
  (confirmed at `addonManagement.js:236` — `pendingRemovals[existingPendingIdx].quantity += quantity`),
  a materially different semantics from the other two sites. Mirroring cancel-then-create here would have
  been wrong — it would create a second `PENDING` record instead of reflecting the merge. Implemented
  instead: find the existing `PENDING` `REMOVE_ADDON` record for that `addonKey` and increment its
  `payload.quantity`; only create a new record if none exists.

**Structural backstop (partial unique index) — considered, not added, reasoned explicitly:** Chapter
16/§3.2 Rule 1 ("one Scheduled Change per target") is a real business rule, and the `CommercialTransaction`
precedent (BUG-002-class fix) argues for enforcing "at most one non-terminal record per
subscription+type+target" at the database level, not just in application logic. **Not added this
session**, because today's underlying legacy fields make the violation impossible to trigger in the first
place: `pendingUpdate` is a single embedded object (physically cannot hold two pending plan/cycle changes
at once — the second write always replaces the first, in the same document, atomically via
`subscription.save()`), and `pendingAddonRemovals`'s merge behavior means a repeat request updates the
existing record's quantity rather than ever needing two records to coexist. A race condition analogous to
`CommercialTransaction`'s (two concurrent requests both passing a VOID-then-create sequence) is a real
future risk once `ScheduledChange`'s writes are no longer shadowing an atomically-overwritten legacy field
— i.e., **once the read side migrates and `pendingUpdate` is retired, this index becomes necessary, not
optional.** Tracked here explicitly so it isn't forgotten when that migration happens, rather than
silently assumed to still be unnecessary at that point.

**Step 4 — equivalence, run and printed, not assumed:** for all three sites, the new `ScheduledChange
.effectiveAt` and the legacy `scheduledAt`/`effectiveAt` field read the identical `subscription
.currentPeriodEnd` value in the same synchronous code path (no intervening computation, no async gap
between the two reads). Verified with a fixture period genuinely spanning today (`currentPeriodStart` =
10 days before `new Date()`, `currentPeriodEnd` = 20 days after) rather than a hardcoded past date —
all three comparisons printed `Match: true`. This is a narrower equivalence claim than the pricing
equivalence tests elsewhere in this project (there is no computation to diverge here, only two reads of
one field), stated as such rather than dressed up as more than it is.

**Step 5 — whole-backend grep, and it found two real gaps, not zero, reported rather than fixed inline
per the hard constraint:**

Searched all of `backend/` for `pendingUpdate`, `pendingAddonRemovals`, `ScheduledChange.create(`, and
`new ScheduledChange(`. Result: **no duplicate `ScheduledChange` creation sites** (three total, matching
the three sites wired above, plus zero anywhere `ScheduledChange` is read back — confirmed, nothing
queries this collection). But two `pendingAddonRemovals` write sites exist that Step 2's table did not
name and this session did **not** wire, found by the broader grep rather than the narrower per-site trace:

1. **`subscriptionController.js:1584`** — inside the downgrade branch itself (`updateSubscription`,
   guarded by `!isBillingCycleChange && !isUpgrade`), scheduling add-ons that are incompatible with the
   new (downgraded) plan for removal at `currentPeriodEnd`.
2. **`subscriptionController.js:2503-2516`** — inside `handlePaymentCaptured`'s upgrade-settlement branch,
   scheduling add-ons incompatible with the new (upgraded) plan for removal at `currentPeriodEnd`, once
   the upgrade payment is confirmed.

Both are genuine, live `pendingAddonRemovals` writes for a real commercial event (downgrade/upgrade
triggering an incompatible-add-on drop) that structurally belong in `ScheduledChange`'s `REMOVE_ADDON`
scope, the same as the standalone add-on-removal endpoint already wired.

**✅ Follow-up (same milestone) — both sites wired, after tracing their exact shape first rather than
reusing `scheduleAddonRemoval`'s pattern by assumption.** Re-reading both blocks found they share the
same shape *as each other* but differ from the already-wired endpoint: `scheduleAddonRemoval` **merges**
(increments quantity on a repeat request for the same add-on), while both `:1584` and `:2503-2516` are
**skip-if-exists** (`if (!pendingRemovals.find(...)) { push }`, no quantity merge at all) — confirmed by
re-reading each block, not assumed identical just because all three are "add-on removal." Wired to match:
for each incompatible add-on, look up an existing `PENDING` `REMOVE_ADDON` `ScheduledChange` for that
`addonKey`; create one only if none exists; leave an existing one untouched otherwise (matching the local
array's own skip behavior exactly). This same "check before create" query, run identically at all three
sites (the endpoint, the downgrade branch, the upgrade-settlement branch), also prevents a genuine
cross-site double-schedule — e.g. a customer's direct removal request and an upgrade's own incompatible-
add-on scheduling landing on the same `addonKey` cannot produce two `PENDING` records, since whichever
write happens second finds the first already there and skips.

**Re-ran Step 5's whole-backend grep after wiring both.** Searched all of `backend/` again for
`pendingUpdate`, `pendingAddonRemovals`, `ScheduledChange.create(`, `new ScheduledChange(`. Result: every
`pendingUpdate` write site (one) and every `pendingAddonRemovals` write site (three: the standalone
endpoint, the downgrade branch, the upgrade-settlement branch) now has an adjacent `ScheduledChange.create`
call — five `ScheduledChange.create` sites total, matching five real scheduling events. No duplicate
creation sites, no `ScheduledChange` reader introduced anywhere. **Every scheduled mutation in the backend
now dual-writes `ScheduledChange`** — this closes the additive rollout completely, not partially.

**Nothing reads `ScheduledChange` back.** No controller behavior changed for any customer — every
existing `pendingUpdate`/`pendingAddonRemovals` write is untouched, and every new `ScheduledChange` write
is non-fatal (try/catch, logged with `organization`+`subscription` context) and invisible to every
existing code path. `pendingUpdate` and `pendingAddonRemovals` remain the sole authoritative runtime
sources. `ScheduledChange`'s structural-backstop question (partial unique index) remains as reasoned
above — not needed today, necessary once the read side migrates.

### Phase 4B — Renewal Engine design (design-only, no implementation)

**Scope: design-only, per the session brief. No module written, no cron job created, no code run
against a real subscription. `CommercialTransaction`, `ScheduledChange` write sites, and the Invoice
Engine were not touched.** Chapter 3.5 read in full for this session (the granular R1-R13 walkthrough,
not the coarser R1-R7 sketch kept below it for continuity) — not summarized from earlier conversation.

**Step 2 — R1-R13 data-availability table, each row checked against the actual schema, not assumed:**

| Step | Needs | Where it lives | Available today? |
|---|---|---|---|
| R1 — due? | `renewalDate <= now` | **`Subscription.nextBillingDate`** (field exists — no separate `renewalDate` field; `nextBillingDate` is the field actually populated at signup/upgrade/downgrade write sites) | ✅ |
| R2 — renewable? | `appStatus` in `{active, past_due}`, not `{trial, retrying, suspended, cancelled}` | `Subscription.appStatus` | **❌ Partial gap** — `Subscription.appStatus` enum is `['trial', 'active', 'past_due', 'cancelled', 'expired', 'suspended']` (`models/Subscription.js:74-76`) — **`retrying` does not exist in the enum.** R2's own ownership boundary ("Retry Engine owns `retrying`, full stop") cannot be enforced today because the state itself isn't representable yet. |
| R3 — Effective Subscription | `ScheduledChange` where `effectiveAt <= today AND status = 'PENDING'`, applied in-memory only | `ScheduledChange` collection (Phase 4A, just completed) | ✅ — query is directly possible against the schema as built (`organization`/`subscription`/`status`/`effectiveAt` are all indexed-queryable fields); confirmed no code executes this query yet (Phase 4A's own invariant) |
| R4 — resolution (position A vs B) | N/A — a design conclusion, not a data need | — | ✅ Already settled in the spec itself (Position B, materialize final state in one shot) — nothing to check |
| R5 — component assembly | Current `Subscription.activeAddons` + R3's computed changes | `Subscription.activeAddons` | ✅ |
| R6 — recurring charge subtotal | Plan price + add-on prices | `PlanConfig`, `PlanAddon` | ✅ |
| R7 — Coupon Engine | `Subscription.appliedCoupon`, coupon duration/cycles-remaining logic | `Subscription.appliedCoupon`, `couponController.js`/`discountEngine.js` | ✅ — already used elsewhere (signup, upgrade migrations) |
| R8 — Referral Engine | Active `RewardUsage` for this org, `rewardToModifier()` | `utils/referralRewards.js`, `utils/modifierResolver.js` | ✅ — already used identically in the add-on-purchase/upgrade flows |
| R9 — GST | — | `calculateInvoice()`'s own Stage 9 | ✅ |
| R10 — Invoice | `calculateInvoice()` output persisted as `BillingInvoice{reason:'RENEWAL'}` | `models/BillingInvoice.js` | **✅ model exists, schema already has `reason:'RENEWAL'` in its enum** (`models/BillingInvoice.js:33`) — but **only written for signup today** (`subscriptionController.js:307`, Phase 2). No renewal call site exists yet, confirmed by grep — this is new wiring, not a migration. |
| R11 — can we charge? (mandate check) | `mandateStatus`, `mandateTokenId`, `mandateMaxAmount`, `mandateExpiresAt` | `Subscription` (all four fields exist) | ✅ — and `reconcileMandate()` (Phase 3B, proven live) is the existing pattern to reuse, not redesign, per R11's own explicit non-goal |
| R12 — payment result | Charge-at-Will order/charge against the mandate token | `config/razorpay.js`, existing CAW charge pattern (`razorpay.orders.create` + token charge, already used in add-on/upgrade flows) | ✅ — mechanism already proven, just never called from a renewal context |
| R13 — commit | One atomic transaction: Effective Subscription → real Subscription, advance `BillingCycle`, persist invoice or mark paid, persist payment, consume reward, increment coupon redemption, emit `BillingEvent`s, mark `ScheduledChange` → `EXECUTED` | `models/BillingCycle.js` (exists), `SubscriptionPayment`, `RewardUsage`, `CouponRedemption`, `BillingEvent`, `ScheduledChange` | **❌ Real gap — `BillingCycle` is never written anywhere in the codebase today**, confirmed by grep (`BillingCycle.create(`/`new BillingCycle(`: zero hits). It's schema-only, exactly like `ScheduledChange` was before Phase 4A. R13 also implies `CommercialTransaction{type:'RENEWAL'}`, but **`RENEWAL` is not in `CommercialTransaction`'s `type` enum** (`models/CommercialTransaction.js:21-22`: `NEW_PURCHASE, UPGRADE, DOWNGRADE, ADDON_PURCHASE, ADDON_REMOVAL, BILLING_CYCLE_CHANGE, CANCELLATION, START_TRIAL, CORRECTION` — no `RENEWAL`). |
| R13.5 — partial-commit failure | Idempotent re-run, each step checks "did I already happen?" | Pattern proven in `reconcileMandate` (Phase 3B) | ✅ pattern exists and is reusable, but has never been applied to a renewal-shaped multi-step commit — this is new application of a proven pattern, not new invention |

**Three real gaps found, named plainly, not built this session:**
1. `Subscription.appStatus` enum is missing `retrying` — R2's Retry Engine ownership boundary has
   nowhere to live yet.
2. `CommercialTransaction.type` enum is missing `RENEWAL` — R13's commit step has no transaction type to
   write.
3. `BillingCycle` is completely unwritten (schema-only, same state `ScheduledChange` was in before
   Phase 4A) — R13's "advance Billing Cycle" step has no existing call site to extend.

None of these were fixed this session, per the hard constraint — they're the first concrete input to
whatever session builds R13's commit step.

**Step 3 — function signature sketch, no implementation:**

```js
// utils/renewalEngine.js (sketch only — not created this session)
//
// Renewal Engine — one atomic Commercial Renewal Transaction per subscription,
// per Chapter 3.5's framing: input a due subscription, output either a
// completed renewal or a past_due failure. Never touches a `retrying`
// subscription (R2 — Retry Engine's exclusive ownership boundary, once the
// enum gap above is closed).
//
// async function renewSubscription(subscriptionId) -> RenewalResult
//
// RenewalResult =
//   | { outcome: 'RENEWED', invoice: BillingInvoiceId, billingCycle: BillingCycleId }
//   | { outcome: 'PAST_DUE', reason: 'MANDATE_REQUIRED' | 'CHARGE_FAILED' }
//   | { outcome: 'RECONCILIATION_NEEDED', reason: 'AMBIGUOUS_CHARGE_RESULT' }  // R7's "Unknown" branch
//   | { outcome: 'SKIPPED', reason: 'NOT_DUE' | 'NOT_RENEWABLE' }              // R1/R2 short-circuits
//
// Internally: R1/R2 checks -> R3 build Effective Subscription (in-memory only)
// -> R4-R9 price via calculateInvoice() -> R10 persist BillingInvoice(PENDING_PAYMENT)
// -> R11/R12 charge via existing CAW mandate-charge pattern -> on success only,
// R13 commit (Subscription fields, BillingCycle, payment record, reward/coupon
// consumption, BillingEvents, ScheduledChange -> EXECUTED) as one sequence,
// each step idempotent-checked per R13.5.
```

**Step 4 — explicit non-scope for this design (and for whatever session builds the first slice):**
- **Retry logic is a separate engine (Phase 6), not built here.** A failed charge only sets
  `appStatus: past_due` and stops; nothing about the 3-attempt/24h-72h-120h cadence is this engine's job.
- **No cron/scheduler wiring.** This design describes a function callable for one subscription; "find
  all due subscriptions and call it" is scheduler plumbing, deliberately separate.
- **Legacy (non-CAW, Razorpay-Subscription-driven) renewal is completely untouched.** Those subscriptions
  keep renewing exactly as they do today, via Razorpay's own recurring-subscription webhooks
  (`handleSubscriptionCharged`) — this design is **CAW-only** (`mandateTokenId` present, no
  `razorpaySubscriptionId`-driven recurring object). No shared code path between the two is assumed or
  required.
- **The three schema gaps above are not closed here.** Adding `retrying` to `appStatus`, adding
  `RENEWAL` to `CommercialTransaction.type`, and writing the first `BillingCycle` document are all
  scoped to whichever session builds R13's actual commit step, not this design pass.

**Step 5 — smallest possible first implementation slice, identified but not built:**
One subscription, due today (`nextBillingDate <= now`), **zero** `ScheduledChange` records pending (so
R3's Effective Subscription equals the current Subscription unchanged — no downgrade/removal/quantity-
change logic exercised at all), valid mandate, successful charge. This defers to later sessions: applying
any `ScheduledChange` (R3's actual "apply due changes" logic), payment failure/`past_due` handling, and
`RECONCILIATION_NEEDED`/ambiguous-charge handling. Even this narrowest slice still requires closing gap 2
and gap 3 above (`CommercialTransaction{type:'RENEWAL'}`, first `BillingCycle` write) to complete R13 — so
the very first implementation session's actual scope is: **the two schema enum/model gaps, plus the
happy-path-only R1-R13 sequence for a subscription with nothing scheduled.** `ScheduledChange` application
(the reason this migration exists) is explicitly the *second* implementation slice, not the first.

### Phase 4B Slice 1 — Renewal Happy Path v1 (implementation, no cron, CAW-only)

**✅ RESOLVED by Phase 4B Slice 2, below — kept here for history, not current status.**
`renewSubscription()` was **not yet idempotent** as of Slice 1: a failure after the mandate charge
succeeded would have caused a retry to call `chargeMandateFn` again. **Slice 2 (see the subsection after
this one) closes every failure window this slice's own fixture scenarios can inject** — see that
subsection for the repair-forward design, completion markers, and verification. One narrow residual
window remains and is stated precisely there, not overclaimed as fully closed.

**Scope: exactly what the slice brief specified — one subscription, zero `PENDING` `ScheduledChange`
records, valid mandate, successful charge. Nothing else.** Not wired into any cron, scheduler, or
webhook — `renewSubscription()` is callable, not running. Legacy (non-CAW) renewal untouched.
`retrying` deliberately **not** added to `Subscription.appStatus` this session — nothing in this
slice's scope would ever set it (that only matters once payment-failure/retry handling exists),
so adding an unused enum value now would be exactly the premature-schema-growth this project has
avoided elsewhere (`resolveModifiers()`, the generic Credit Engine question).

**Step 1 — `RENEWAL` added to `CommercialTransaction.type`'s enum** (`models/CommercialTransaction.js:22`).
Confirmed by grep that the enum's value list is never pattern-matched against elsewhere in the codebase
(no validation logic lists the types independently of the schema) — a one-line, self-contained change.

**Step 2 — first `BillingCycle` write, schema needed no field additions, confirmed by reading
`models/BillingCycle.js` before writing anything:** `subscription`/`periodStart`/`periodEnd`/`invoice`/
`status` are exactly what this slice has available and needs. Reused `BillingInvoice`'s signup-rollout
write pattern (`subscriptionController.js:~307`) as the template for shape/logging, but **not** its
non-fatal try/catch: for a renewal, a failed invoice/cycle write is fatal to the operation (R13 needs a
real invoice document to reference), unlike Phase 2's signup concession which was shadowing an
already-authoritative legacy write. Stated explicitly in `utils/renewalEngine.js`'s own header comment
so this isn't silently copied as "the same pattern" into a context where it means something different.

**Step 3 — `utils/renewalEngine.js` created, happy path only.** `renewSubscription(subscription, {
chargeMandateFn })`: R3 (trivial — Effective Subscription equals current Subscription, since the
precondition is zero pending changes) → R7 (simplified: `appliedCoupon` reused as a flat fixed-amount
modifier if present; full duration/cycles-remaining revalidation is real R7 engine work, deferred, stated
explicitly in the file header, not silently skipped) → no R8 modifier constructed at all this slice
(referral rewards in this codebase are one-time reservations consumed at purchase time, not a recurring
per-cycle modifier — R8's full scope deferred) → R4-R9 priced via `calculateInvoice()` (real function,
no adjustmentContext, same shape as `createSubscription`'s own call) → R10 `BillingInvoice` persisted
`PENDING_PAYMENT` → `CommercialTransaction{type:'RENEWAL', status:'PRICED'}` → R11/R12 charge via an
**injected** `chargeMandateFn` (real Razorpay wiring deferred to whichever session builds it — injected
specifically so this slice's own tests never touch real Razorpay) → on success, R13 commit: transaction
→ `COMMITTED`, invoice → `PAID`, first-ever `BillingCycle` document written, transaction → `COMPLETED`.
No `ScheduledChange.updateMany` call exists in this file — nothing to mark `EXECUTED` under this slice's
own precondition (zero pending records); left for the next slice, not silently omitted.

**Step 4 — the other three outcomes stubbed as explicit throws, not partially-implemented return
values**, so it's unambiguous what's real vs. deferred: `SKIPPED` (R1/R2 gating — this function doesn't
re-check due/renewable/appStatus itself, the caller must; no dispatcher exists yet to be that caller),
`RECONCILIATION_NEEDED` (R7's ambiguous-charge-result branch), `PAST_DUE` (R12's real failure branch).
Each throws a named error identifying exactly which unbuilt branch was hit, rather than returning a
structured-but-fake result.

**Step 5 — verified with a real fixture, not against production.** Ran `renewSubscription()` against a
**fake** organization/subscription (`mongoose.Types.ObjectId()`, not the real production subscription),
with `currentPeriodEnd` = 3 days from `new Date()` (not a hardcoded past date), a real `activeAddons`
array (extra_seat ×2 @ ₹80), and a mocked `chargeMandateFn` returning `{success:true}` — `calculateInvoice()`
itself was the real function, not mocked, per the brief. All six checks passed: `outcome === 'RENEWED'`,
`BillingInvoice.reason === 'RENEWAL'`, `BillingInvoice.status === 'PAID'`, `BillingCycle` written with
`periodStart` exactly matching the fixture's `currentPeriodEnd`, `CommercialTransaction.status ===
'COMPLETED'`. Test documents deleted immediately after the assertions ran, confirmed by the script's own
cleanup step — no trace left in the database. The test script itself was a temporary file, deleted after
the run, not committed.

**Step 6 — whole-backend grep confirms this is genuinely the first and only writer for both**
`BillingCycle.create(`/`new BillingCycle(` and `CommercialTransaction{type:'RENEWAL'}` — both resolve to
exactly one site, inside `utils/renewalEngine.js` itself. No existing writer found, nothing to reconcile.

**⚠ Two real gaps found on review, before committing — fixed, not shipped silently.** The first pass of
this slice wrote `BillingInvoice`, `CommercialTransaction`, and `BillingCycle`, but missed two things
R13 and the model schemas actually require:
1. **The `Subscription` document itself never advanced.** `computeNextPeriodEnd()` was used to derive
   `BillingCycle.periodEnd`, but `currentPeriodStart`/`currentPeriodEnd`/`nextBillingDate` were never
   written back onto the `Subscription`, and `subscription.save()` was never called. R13's own text is
   explicit that this is the *first* thing commit does ("Effective Subscription becomes the real
   Subscription... advance Billing Cycle") — this was a real omission in the first pass, not an
   intentionally-deferred item. **Fixed:** the same `newPeriodStart`/`newPeriodEnd` pair now written to
   both `Subscription` and `BillingCycle` from one computation, not two independently-derived values that
   could drift apart.
2. **`BillingInvoice.commercialTransaction` was never set**, despite existing on the schema since Phase 1
   and both ids being available at the point the invoice could have been linked. **Fixed:** linked
   immediately after `CommercialTransaction` is created, in its own non-fatal try/catch.
   (`BillingCycle` itself has no `commercialTransaction` field — checked against the original §1.6
   scaffold, which only ever specified `invoice`, not a second direct ref — so this is correct as built,
   not a third gap. The transaction remains reachable via `BillingCycle.invoice.commercialTransaction`.)

**Re-verified after both fixes**, this time with a real `Subscription` Mongoose document (not a plain
object — `subscription.save()` requires an actual document) created via `Subscription.create()` with a
fake `organization`, fixture `currentPeriodEnd` = 3 days from `new Date()`. All ten checks passed this
time, four more than the first pass: `outcome==='RENEWED'`, invoice `reason`/`status`, invoice→transaction
link, `BillingCycle` written with the correct `periodStart`, transaction `COMPLETED`, **and** the
subscription's `currentPeriodStart` now equals the old `currentPeriodEnd`, its new `currentPeriodEnd` is
genuinely later, and `nextBillingDate` matches the new `currentPeriodEnd`. Test document (including the
real `Subscription`) deleted immediately after assertions ran; temp script deleted, not committed.

**🚩 Real, open gap — verified directly, not implemented, per explicit instruction: R13's commit sequence
has no transaction and no idempotency guard.** Traced the exact code after the mandate charge succeeds
(money has genuinely moved at that point): `commercialTransaction` → `COMMITTED` is best-effort
(try/catch, logs and continues on failure), but **`billingInvoice.save()`, `subscription.save()`, and
`BillingCycle.create()` are not wrapped in any try/catch or Mongo transaction.** An uncaught throw from
any of the three propagates straight out of `renewSubscription()`. Three concrete failure windows,
traced precisely:
- Charge succeeds → `billingInvoice.save()` throws: `BillingInvoice` stays `PENDING_PAYMENT` forever,
  nothing distinguishes "charged but uncommitted" from "never attempted."
- `billingInvoice.save()` succeeds → `subscription.save()` throws: invoice `PAID`, transaction
  `COMMITTED`, but the `Subscription`'s own period never advances and `BillingCycle` never gets created —
  exactly the R13.5 scenario the spec names.
- `subscription.save()` succeeds → `BillingCycle.create()` throws: commercially consistent, but the
  audit-trail document is silently missing.

**The more serious finding: there is no idempotency check anywhere in this function** — nothing asks "has
this subscription already been renewed for this period?" before running. In the first two failure windows
above, a naive retry of `renewSubscription()` would call `chargeMandateFn` again — a genuine **double-charge
risk**, not just a bookkeeping gap. R13.5's own answer (idempotent repair-forward, each step checking "did
I already happen?", the same pattern already proven live in `reconcileMandate`) is **not implemented in
this file.** This is not a considered, documented deferral ("reconciliation is responsible for recovery") —
it is a real gap this slice did not address, and it should be named as such rather than assumed covered.
**Not fixed here, per explicit instruction to verify only** — this is the concrete scope of whatever
session builds R13.5's idempotent-commit/reconciliation logic, and should be treated as a precondition for
this engine ever running against real subscriptions, not an optional hardening pass.

**Confirmed: no cron/scheduler exists calling this function.** `renewSubscription()` is not imported by
`backend/jobs/subscriptionLifecycleJobs.js` or anywhere else — it is callable, not running, exactly per
the hard constraint.

### Phase 4B Slice 2 — R13.5 idempotent repair-forward (closes the P0 blocker above)

**Scope: exactly the P0 blocker, nothing else.** Modified only `backend/utils/renewalEngine.js`. No
Retry Engine, no cron, no `ScheduledChange` reading/processing, no `appStatus.retrying`, no
`CommercialTransaction`/`ScheduledChange` rollout changes, no Mongo transactions, no distributed locks,
no second renewal engine.

**First rule followed: traced `reconcileMandate` (`subscriptionController.js:1880`) before writing
anything.** Its idempotency is not a flag-based mechanism — it checks derived state
(`paymentStatus`/`mandateStatus` combination) and calls already-idempotent helpers unconditionally, safe
to re-run any number of times. Copied that philosophy, not invented a new one.

**Step 1 — exact prior commit sequence, in order, unmodified in relative sequence:**
1. `BillingInvoice.create({status:'PENDING_PAYMENT'})` (pre-charge)
2. `CommercialTransaction.create({status:'PRICED'})` (pre-charge)
3. `billingInvoice.commercialTransaction` link + save (pre-charge)
4. **charge** (`chargeMandateFn`) — the external, non-reversible step
5. `commercialTransaction.status → 'COMMITTED'`; save
6. `billingInvoice.status → 'PAID'`, `paidAt`, razorpay ids; save
7. `subscription.currentPeriodStart/currentPeriodEnd/nextBillingDate`; save
8. `BillingCycle.create(...)`
9. `commercialTransaction.status → 'COMPLETED'`; save

**Step 2 — completion markers, all using existing persisted state, no schema change:**

| Step | Marker |
|---|---|
| Invoice+transaction pre-created | `CommercialTransaction.findOne({subscription, type:'RENEWAL', status:{$in:['PRICED','COMMITTED']}})` — unique per the existing partial index (`{subscription:1,type:1}`, non-terminal statuses) |
| Charge already succeeded | `commercialTransaction.status === 'COMMITTED'` |
| Invoice marked paid | `billingInvoice.status === 'PAID'` |
| Subscription already advanced for **this** renewal | `subscription.currentPeriodStart.getTime() === commercialTransaction.target.newPeriodStart.getTime()` |
| BillingCycle already written | `BillingCycle.findOne({subscription, invoice: billingInvoice._id})` |
| Transaction completed | `commercialTransaction.status === 'COMPLETED'` |

**One genuine question surfaced here, resolved without a schema change, stated explicitly rather than
silently decided:** knowing "the subscription was already advanced for *this specific* renewal" (not
just "some" renewal) can't be derived from `Subscription`'s own live `currentPeriodStart`/`currentPeriodEnd`
alone, because those fields get overwritten in place — a resumed run has no way to know what the *target*
period was without recomputing it (risking pricing/date drift across attempts). Resolved by storing
`newPeriodStart`/`newPeriodEnd` inside `CommercialTransaction.target` at creation time, before charging —
`target` is already `Mixed` and already used by every other `CommercialTransaction` call site to carry
flow-specific data (e.g. add-on purchase stores `addonKey`/`quantity` there). This is not a new Mongoose
schema field, just choosing what goes into the existing schema-less blob, the same way every other site
already does. No other step required this.

**Step 3/4 — repair-forward built directly in `renewSubscription()`, no wrapper, no second engine.**
At entry, look up an existing non-terminal `RENEWAL` transaction for the subscription; if found, reuse its
invoice and target period instead of recomputing pricing or creating a duplicate. Every subsequent step is
now gated on its own completion marker (`if (marker not yet true) { do the write }`), matching the design
table above exactly. **The charge itself is gated on `commercialTransaction.status !== 'COMMITTED'`** — a
resumed run whose transaction is already `COMMITTED` never calls `chargeMandateFn` again. Charge success is
recorded in its own immediate, atomic write (`status → COMMITTED` + `paymentId`/`orderId` into `target`) —
the durable fact every future retry checks, deliberately separated from the (later, more failure-prone)
invoice-paid write.

**Residual gap, stated precisely rather than overclaimed as fully closed:** if the charge succeeds and
*that exact recording write* (`commercialTransaction.save()` marking `COMMITTED`) itself throws before
committing, there is still no durable record of the charge for a retry to find — no application-level
check can close that specific instant without an independent confirmation channel (Razorpay's own webhook,
R7's reconciliation branch), which real charging + reconciliation would provide and this slice's injected
`chargeMandateFn` does not model. This is the same class of gap `reconcileMandate` itself relies on
Razorpay's webhook redelivery to close, not something application-level repair-forward alone can solve.
Every other failure window is closed.

**Step 5 — verified with four fixture scenarios, real values printed, not "looks correct":**
Fixture dates relative to `new Date()` throughout (`currentPeriodEnd` = 3 days ahead), a temporary
`_injectFailureAfter` test-only parameter (undefined in all real call sites) throwing immediately after a
named checkpoint's write succeeds.

| Scenario | Injected failure | Charge called | Invoice status | Subscription advanced | BillingCycle written | Transaction status | Returned outcome |
|---|---|---|---|---|---|---|---|
| A — fresh, single run | none | **1** | `PAID` | `true` | `true` | `COMPLETED` | `RENEWED` |
| B — after charge recorded | after `CHARGE_COMMITTED` | **1** | `PAID` | `true` | `true` | `COMPLETED` | `RENEWED` (2nd run) |
| C — after invoice paid | after `INVOICE_PAID` | **1** | `PAID` | `true` | `true` | `COMPLETED` | `RENEWED` (2nd run) |
| D — after subscription advanced | after `SUBSCRIPTION_ADVANCED` | **1** | `PAID` | `true` | `true` | `COMPLETED` | `RENEWED` (2nd run) |

All four: charge called exactly once, first run's injected error surfaced (`First run threw:
TEST-INJECTED FAILURE after <checkpoint>`), second run correctly resumed from the first incomplete step
and returned `RENEWED`. (Scenario A's harness was corrected mid-session — it initially ran twice
unconditionally, which for a *successful* single run correctly starts a **second, new** period's renewal
rather than "resuming" anything, since the first run already completed; fixed to a single run, matching
the scenario's actual intent, not a resume test.) Test documents (including the real `Subscription`
document, required since `subscription.save()` is exercised) deleted immediately after each scenario;
temp script deleted, not committed.

**Step 6 — whole-backend grep confirms exactly one entry point.** Searched all of `backend/` for
`renewSubscription`: two real hits (the function definition and its own stub-error message referencing
itself by name) plus the `module.exports` line — no duplicate implementation, no second call site, no
cron/job import.

**Step 7 — explicit answer, not vague wording: double-charge risk is closed for every scenario this
slice's fixtures can inject (failure after charge-recording, after invoice-paid, after subscription-
advance).** It is **not fully closed** for the exact sub-instant between the mandate charge returning and
the very next write committing — that residual window requires real charging plus R7's webhook-based
reconciliation to close, which is out of scope for this slice and explicitly deferred, not silently
assumed away.

### Phase 5 — 🟥 Build the Renewal Engine and its scheduler (net-new, highest-priority build)
9. Implement the R1–R13 renewal sequence (§3.5) as its own module: find due subscriptions → check
   mandate validity → build the Effective Subscription from all due `ScheduledChange` records → price
   via the Invoice Engine → charge → commit atomically on success, `past_due` on failure.
   **✅ Slice 1 (Renewal Happy Path v1) done. ✅ Slice 2 (R13.5 idempotent repair-forward) done — see
   both Phase 4B subsections above. Residual gap: the exact instant between charge-success and its
   recording write is only closeable via real reconciliation (R7), out of scope until then. Not called
   from anywhere.**
10. Add the Renewal Scheduler cron job to `backend/jobs/` (a fourth job alongside the existing three),
    matching the "dumb dispatcher, no business logic" principle already used by the existing trial
    jobs. **Now unblocked on the idempotency front** (Slice 2 landed) — still not started, since this
    item is scoped to cron wiring itself, not the engine underneath it.

9.5. **✅ Done — R13.5 idempotent repair-forward.** See "Phase 4B Slice 2" above for the full trace,
     completion markers, and four-scenario verification. Each step in R13's commit sequence now checks
     "did I already happen?" before acting; a re-run of `renewSubscription()` after a partial failure
     resumes instead of re-charging. One residual, explicitly-stated gap remains (the exact instant
     between charge success and its recording write), closeable only via real charging + R7
     reconciliation — tracked, not silently assumed closed.

### Phase 4C — Retry Engine design (tracing + design only, no implementation)

**Scope: design-only, per the session brief. No Retry Engine created, no cron, no schedule, no
`Subscription.appStatus` change, no retry counters/timestamps, no `retrying` enum value, no
`ScheduledChange`/`CommercialTransaction`/`BillingCycle` touched, no `renewalEngine.js` modification.**

**Step 0 — specification, read in full, not paraphrased.** Retry is not one contiguous chapter — it's
woven through Chapter 3.5's own footnote, Chapter 7's Scheduler Matrix, Chapter 9's interaction-matrix
(section G, `RT1`-`RT10`), and `CAW_BILLING_DESIGN.md` §9's policy block. Extracted verbatim:

- **Ownership** (Chapter 3.5, line 840): *"The Retry Engine (Chapter 3.5's sibling, per Chapter 7's
  Scheduler Matrix) owns exactly the `past_due → active` (on retry success) and `past_due → suspended`
  (retries exhausted, grace period elapsed) transitions."* Chapter 3.5's own R2 table (line 611): *"Retry
  Engine owns `retrying`, full stop"* — Renewal Engine never touches a `retrying` subscription.
- **Schedule/limits** (`CAW_BILLING_DESIGN.md` §9, lines 338-344, `[POLICY — default, configurable]`):
  `maxAttempts = 3`, `retryIntervals = [24h, 72h, 120h]` ("spread over days, not back-to-back"). *"Retries
  re-run `calculateInvoice()` → new Order → charge."* Grace period (same section, lines 346-350,
  `[POLICY — default, configurable]`): `gracePeriod = 7 days`, "from first failure to hard-suspension."
- **Terminal failure**: retries exhausted + grace period elapsed → `suspended` (Chapter 3.5 line 841,
  Chapter 9 RT2). Chapter 9 line 1911: *"Can `ACTIVE` become `SUSPENDED` directly? No. It must always
  pass through `PAST_DUE` first."*
- **Interaction with Renewal Engine**: Chapter 7's Scheduler Job 1 (Renewal) and Job 2 (Retry) are
  explicitly separate jobs (line 2152-2161) — Renewal Scheduler finds subscriptions due today and calls
  the Renewal Engine; Retry Scheduler *"finds every subscription in `PAST_DUE` whose next retry time has
  arrived; calls the Retry Engine."* Two different triggers, two different schedulers, matching Chapter
  3.5's own R2 boundary (Renewal Engine never touches `retrying`/`past_due`-being-retried subscriptions).
- **Interaction with reconciliation**: Chapter 9 RT8 — *"Retry scheduler itself down for days, then
  recovers"* → *"every overdue subscription is simply picked up on the next tick"* (no special recovery
  logic needed beyond the scheduler resuming). RT5 — *"mandate revoked between charge submission and
  webhook confirmation"* → *"the already-processed payment is honored regardless; only the next renewal
  is affected"* (a reconciliation-shaped concern, not something the Retry Engine itself resolves).
- **Interaction with Subscription state**: RT3 (line 3454) — a customer paying manually mid-retry-window,
  ahead of the next scheduled attempt, restores access *immediately*, not on the next scheduled retry.
  RT4 — a retry and a customer upgrade racing "must resolve atomically," per Law 11 (not further
  specified in this pass). RT6 — retry cadence colliding with a scheduled downgrade's effective date:
  *"nothing commits until the renewal actually succeeds"* (matches R13's own no-commit-before-payment
  principle). RT7 — no refunds under any circumstance, even for an unrelated prior period, while
  `past_due`. RT10 — a same-tick race between a successful retry and grace-period elapsing: *"a
  successful payment always wins"*.

**A genuine tension between two spec documents, found and named, not silently resolved either way:**
Chapter 3.5 (line 837) states the access-state chain as `trial → active → past_due → suspended →
cancelled/expired` — no `retrying` value in that specific sentence. But the *same chapter*, 200 lines
earlier (R2's table, line 611), explicitly names `retrying` as a distinct `appStatus` value the Retry
Engine exclusively owns, and Chapter 1's own opening state-machine sketch (line 46) also lists
`past_due → retrying → suspended` as four distinct states. **This is not resolved here** — whether
`retrying` is a real, persisted fourth `appStatus` value distinct from `past_due`, or whether "retrying"
is just informal shorthand for "a `past_due` subscription currently inside its retry window" (i.e., no
new stored value at all, only `past_due` plus a derived read over `appStatusHistory`/attempt data) is an
open question the implementation session must answer explicitly, not assume from either sentence alone.

**Step 1 — whole-backend trace, every relevant hit, purpose stated, nothing modified:**

| Hit | Purpose |
|---|---|
| `models/Subscription.js:274` (`lastPaymentAttempt`) | Single last-attempt record (`razorpayPaymentId`, `amount`, `attemptedAt`, `status`) — **not a counter**, gets overwritten each attempt |
| `models/Subscription.js` `appStatus` enum (`trial/active/past_due/cancelled/expired/suspended`) | No `retrying` value exists in the schema |
| `subscriptionController.js:495` (`setAppStatus`) | Its own hardcoded `validStatuses` array *also* excludes `retrying` — a second, independent confirmation of the same gap (adding `retrying` to the Mongoose enum alone would not be sufficient; this function's own validation list would still reject it) |
| `subscriptionController.js:511-518` (`setAppStatus`, inside) | Appends every transition to `appStatusHistory` (`from`, `to`, `reason`, `at`) — **already existing, already-persisted data** that can answer "when did this subscription enter `past_due`" without any new field, by reading the most recent `{to:'past_due'}` entry's `at` |
| `subscriptionController.js:3336` (`exports.retryPayment`) + `routes/subscription.js:50` (`POST /:id/retry-payment`) | The **only** existing retry-shaped code in the backend — see the real finding below; it is not what it was assumed to be |
| `jobs/subscriptionLifecycleJobs.js` | Confirmed exactly 3 cron jobs (trial-ending reminders, trial expiry, scheduled-cancellation finalization) — zero retry-related cron, zero renewal cron, matching §2.4's already-tracked finding |
| `middlewares/subscriptionGate.js:5` (`FULL_ACCESS_STATUSES = ["trial","active","past_due"]`) | Confirms `past_due` retains full product access today (the grace-period model), consistent with the spec |
| `retryCount`, `maxAttempts`, `retryIntervals`, `gracePeriod` (as code, not spec text) | **Zero hits anywhere in `backend/`** — none of these are implemented; they exist only as policy values in the spec documents |

**A real, previously undocumented finding: `retryPayment`/`POST /:id/retry-payment` is not the "manual
early-retry option" this plan's own Phase 6 item 11 assumed it was.** Read the function in full
(`subscriptionController.js:3336-3450`): it guards with `if (subscription.isPaymentConfirmed) { return 400
"already confirmed" }` — meaning it is scoped to retrying a subscription's **first-ever, never-yet-confirmed**
payment (legacy pre-CAW cancel-and-recreate signup flow: creates a brand-new Razorpay Subscription object),
not a **renewal** that already succeeded once and later went `past_due`. A subscription that is `past_due`
after a prior successful renewal already has `isPaymentConfirmed === true` — this endpoint would reject it
outright with "Subscription payment is already confirmed." **This endpoint cannot serve as the manual
early-retry path RT3 describes for a `past_due` renewal.** Item 11's parenthetical ("the manual endpoint
can remain as a customer/Support-initiated early-retry option") is therefore based on an incorrect
assumption about what this endpoint does — flagged here for correction, not silently carried forward into
the Retry Engine's design.

**Step 2 — Retry Engine inputs, existing vs. missing, nothing invented beyond what's needed:**

| Input | Source | Owner | Existing? |
|---|---|---|---|
| Which subscriptions are `past_due` and due for a retry now | `Subscription.appStatus`, plus *some* notion of "next retry time" | Retry Engine (per Chapter 7 Job 2) | **Partially** — `appStatus==='past_due'` exists; "next retry time arrived" cannot be computed today (see Step 6 gap) |
| When did this subscription first go `past_due` | `Subscription.appStatusHistory` | Subscription Engine (writes), Retry Engine (reads) | **Existing** — derivable from the most recent `{to:'past_due'}` entry, no new field needed |
| How many retry attempts have occurred so far | — | Retry Engine | **Missing** — no counter exists anywhere (see Step 6) |
| Mandate validity | `Subscription.mandateStatus`/`mandateTokenId`/`mandateMaxAmount`/`mandateExpiresAt` | Mandate subsystem (already fully specified, `CAW_BILLING_DESIGN.md`) | **Existing** |
| The invoice/amount to re-charge | The `BillingInvoice` created by the renewal attempt that first failed | Invoice Engine / Renewal Engine | **Existing as a model, but no failed-renewal invoice exists yet to test against** — `renewSubscription()`'s `PAST_DUE` branch is still an explicit stub (`pastDueNotImplemented()`), so there is no real failed invoice a retry could reference yet |
| The renewal function itself, to actually charge again | `utils/renewalEngine.js`'s `renewSubscription()` | Renewal Engine | **Existing**, but see Step 7 — whether the Retry Engine may call it as-is is the key open question |
| Grace period elapsed check | `gracePeriod` policy value (7 days) + the `appStatusHistory` timestamp above | Retry Engine | **The value is a policy constant, not yet configured/stored anywhere** — matches `CAW_BILLING_DESIGN.md`'s own `[POLICY — default, configurable]` framing; today it exists only as spec text |

**No additional inputs invented** beyond what R1-R13/RT1-RT10 and the CAW policy block already name.

**Step 3 — ownership table. Ambiguity stated explicitly, not resolved here:**

| Responsibility | Owner |
|---|---|
| Decide whether a retry should fire now (schedule/cadence check) | Retry Engine (Chapter 7 Job 2) |
| Actually charge the mandate for a retry attempt | **Ambiguous, not resolved by the spec text read this session.** `CAW_BILLING_DESIGN.md` §9 says retries *"re-run `calculateInvoice()` → new Order → charge"* — which sounds like the Retry Engine re-invokes the same pricing/charging shape `renewSubscription()` already implements, but no sentence in either document explicitly says "the Retry Engine calls the Renewal Engine to do this" vs. "the Retry Engine has its own charge step." Given Chapter 3.5's own R2 boundary ("Renewal Engine never touches a `retrying`/being-retried subscription"), the more consistent reading is that the Retry Engine performs its own charge attempt using the *same underlying charge mechanism*, not by calling `renewSubscription()` itself (see Step 7). **Flagged as ambiguous, not decided by this session.** |
| Apply due `ScheduledChange` records | Renewal Engine (§3.5 R3/R13, Chapter 7 Job 4's "should not exist" reasoning) — **not** the Retry Engine's job per the spec's own reasoning: a `ScheduledChange` only ever executes as part of a *successful* renewal, and a retry is attempting to complete that same renewal, so if/when a retry succeeds, applying scheduled changes is still logically part of "the renewal completing," not a separate Retry Engine responsibility |
| Update `BillingInvoice`/`CommercialTransaction`/`BillingCycle` on retry success | **Ambiguous, tied directly to the previous row's ambiguity.** If the Retry Engine reuses `renewSubscription()`'s own commit logic, these are already owned by the Renewal Engine (as built in Slice 1/2). If the Retry Engine has a separate charge path, it would need its own (currently unbuilt) equivalent of R13's commit sequence — a real design fork, not resolved here |
| Exhaust retries / transition to `suspended` | Retry Engine (Chapter 3.5 line 841, Chapter 9 RT2) |
| Restore to `active` on a successful retry | Retry Engine (Chapter 3.5 line 841, RT1) — or immediately, out-of-band, if the customer pays manually before the next scheduled attempt (RT3) |
| Track attempt count / cadence timing | Retry Engine — **but no field exists today to store this** (Step 6) |

**Step 4 — Renewal Engine outcome → retry decision, using this slice's actual four outcomes (not a
theoretical list):**

```
RENEWED
  ↓
Retry? NO — already successful, nothing to retry.
```
```
PAST_DUE   (R12's real failure branch — currently a stub in renewSubscription(), throws
            'not implemented in this slice' rather than returning this outcome for real)
  ↓
Retry? YES — this is precisely the outcome the Retry Engine exists to act on
  (Chapter 3.5 line 841: past_due → active on success, → suspended on exhaustion).
  Not yet actionable today: renewSubscription() cannot currently produce a real
  PAST_DUE outcome to retry against — it throws instead of returning one.
```
```
RECONCILIATION_NEEDED   (R7's ambiguous-charge-result branch — also currently a stub)
  ↓
Retry? NO, not directly — per RT5/RT8's own reasoning, an ambiguous result must be
  resolved by reconciliation (confirm what actually happened with the vendor) before
  any retry decision is safe; blindly retrying an ambiguous charge risks a double-charge,
  the exact failure mode this whole design phase exists to prevent.
```
```
SKIPPED   (R1/R2 gating — not due, or not renewable)
  ↓
Retry? NO — R2's own table (Chapter 3.5) already excludes retrying/suspended/cancelled
  subscriptions from renewal eligibility; a SKIPPED outcome is not a failure to retry
  against, it's "this subscription was never eligible for this pass."
```
No additional Renewal Engine outcomes exist in the specification beyond these four.

**Step 5 — retry timeline, extracted verbatim, nothing invented:**

```
past_due (first failure)
    │
    ▼
Attempt 1 — 24h after first failure
    │
    ├─ succeeds → active (RT1)
    │
    ▼ fails
Attempt 2 — 72h after first failure  (not "72h after attempt 1" — CAW_BILLING_DESIGN.md's own
    │                                  phrasing is "intervals spread over days, not back-to-back";
    │                                  read as offsets from first failure, not cumulative deltas —
    │                                  this reading is not explicitly disambiguated in either
    │                                  document and should be confirmed, not assumed, before
    │                                  implementation)
    ├─ succeeds → active (RT1)
    │
    ▼ fails
Attempt 3 — 120h after first failure
    ├─ succeeds → active (RT1)
    │
    ▼ fails
Grace period elapses — 7 days from first failure (gracePeriod policy value)
    │
    ▼
suspended (RT2)
```
maxAttempts = 3, retryIntervals = [24h, 72h, 120h], gracePeriod = 7 days — all `[POLICY — default,
configurable]` per `CAW_BILLING_DESIGN.md` §9, not hardcoded architecture. **Stop conditions, all found in
the spec, not invented**: a successful charge at any attempt (RT1); a manual customer payment ahead of the
next scheduled attempt (RT3, immediate restoration); grace period elapsing with all attempts exhausted
(RT2, → suspended). **One value genuinely unspecified**: whether the 120h/3rd attempt and the 7-day grace
period are meant to align (120h ≈ 5 days, leaving a ~2-day gap before the 7-day grace period elapses) or
whether a 4th "final chance" check happens at exactly day 7 — neither document states this explicitly;
flagged as unspecified rather than assumed.

**Step 6 — database impact. Every document the Retry Engine would need to mutate, and the real schema
gaps, not implemented:**

| Document | Fields read | Fields written | Gap? |
|---|---|---|---|
| `Subscription` | `appStatus`, `appStatusHistory`, `mandateTokenId`/`mandateStatus` | `appStatus` (`past_due→active` or `past_due→suspended`), `appStatusHistory` (via existing `setAppStatus`) | **No schema gap for these** — `setAppStatus` already exists and already appends to `appStatusHistory`; only `retrying` (if it's decided to be a real stored value, per Step 0's open question) would need an enum addition (to both the Mongoose schema **and** `setAppStatus`'s own hardcoded list) |
| Retry attempt count | — | — | **Real gap.** No field exists anywhere to store "this is retry attempt N for this failure cycle." `lastPaymentAttempt` is a single overwritten record, not a counter, and doesn't distinguish "attempt 1 of the current cycle" from "attempt 1 of a cycle three months ago." **Not implemented this session, per the hard constraint** — flagged as the single largest concrete schema gap for whoever builds this next |
| `BillingInvoice` (the one the retry is trying to collect) | `status` | `status` (`PENDING_PAYMENT`→`PAID`, or stays pending) | No gap in the model itself, but **no failed-renewal `BillingInvoice` exists yet to retry against** — `renewSubscription()`'s `PAST_DUE` branch throws instead of persisting a real failed invoice, so there is nothing for a Retry Engine to find and re-attempt today |
| `CommercialTransaction{type:'RENEWAL'}` | `status`, `target`, `attemptCount` | `status` (stays `PRICED`/`COMMITTED` until retry succeeds, or a new terminal outcome), `attemptCount` (**field already exists on the schema**, per Phase 1 — not yet incremented by anything for renewal retries) | `attemptCount` already exists on the model (used for other transaction types) — reusable, not a new field |
| `BillingCycle` | — | `status`, written once the retry succeeds | No gap |

**Step 7 — the most important question: can the Retry Engine safely call `renewSubscription()` again?
Answer, based on today's code, not speculation: partially yes, with one precondition not yet true.**
`renewSubscription()`'s R13.5 repair-forward (Slice 2) makes it safe to call multiple times **once a
`CommercialTransaction{type:'RENEWAL'}` already exists in a non-terminal state** — a second call correctly
resumes and does not re-charge (this is exactly what Slice 2 verified). So *if* a first renewal attempt
had failed after creating its `BillingInvoice`/`CommercialTransaction` but before the mandate charge
succeeded, a Retry Engine calling `renewSubscription()` again would be safe — it would find the existing
non-terminal transaction and attempt the charge again, correctly, without duplicating the invoice.
**However, this is not yet actually exercisable**, because `renewSubscription()`'s failure path
(`pastDueNotImplemented()`) *throws* rather than returning a `PAST_DUE` result — meaning today, a failed
charge attempt still creates the `BillingInvoice`/`CommercialTransaction` (both writes happen *before* the
charge, per Slice 2's own trace), but the function then throws instead of leaving the subscription in a
clean, well-defined `past_due` state a Retry Engine could act on. **What's missing, precisely**: R12's real
failure branch needs to actually run (mark `appStatus→past_due`, leave the `CommercialTransaction`/
`BillingInvoice` in their current non-terminal state, return a structured `PAST_DUE` result) rather than
throw a "not implemented" error. Once that lands, calling `renewSubscription()` again from a Retry Engine
is safe by the same reasoning Slice 2 already proved — **no new idempotency work would be needed**, only
completing R12's failure branch to return instead of throw.

**Step 8 — whole-backend duplicate check, nothing found beyond what Step 1 already reported.** Searched
for `setTimeout`, `retryCount`, cron-based retry logic, "reconcile loops": no hits beyond the single
`retryPayment` endpoint already covered in Step 1 (confirmed not a renewal-retry mechanism) and
`reconcileMandate` (already traced in Slice 2, a mandate-activation reconciliation helper, not a payment
retry mechanism). No second, hidden retry implementation exists anywhere in the codebase.

**Implementation order, following directly from the findings above, not a fresh guess:**
1. Complete R12's real failure branch in `renewSubscription()` (return `PAST_DUE` instead of throwing) —
   a small, `renewalEngine.js`-scoped change, prerequisite for everything below, per Step 7.
2. Resolve Step 0's open question (is `retrying` a real stored `appStatus` value, or a derived read over
   `past_due` + attempt data) — a design decision, not an implementation task, before any schema change.
3. Add the retry-attempt-count field (Step 6's real gap) — the only genuinely new schema element this
   whole session identified as necessary.
4. Resolve Step 3's ownership ambiguity (does the Retry Engine call `renewSubscription()` directly, or
   maintain its own charge path) before writing the Retry Engine module itself.
5. Only then: build the Retry Engine module + its scheduler (Chapter 7 Job 2), per the timeline in Step 5.
6. Correct `IMPLEMENTATION_PLAN_V1.md`'s Phase 6 item 11 — the manual `retry-payment` endpoint cannot
   serve as the described early-retry path (Step 1's finding); either fix that endpoint's own scope or
   build a new, correctly-scoped manual-retry path for RT3.

### Phase 4B Slice 3 — Complete Renewal Engine outcomes (implementation item 1 from the list above)

**Scope: exactly item 1 above, nothing else.** Modified only `backend/utils/renewalEngine.js`. Retry
Engine, cron, `retrying` appStatus, retry-attempt-count field, and `ScheduledChange` reading are all
untouched — this closes the one prerequisite the Phase 4C design session identified (Step 7): a Retry
Engine cannot safely react to a `PAST_DUE` outcome that doesn't exist yet.

**What changed:** all four outcomes (`RENEWED`/`PAST_DUE`/`RECONCILIATION_NEEDED`/`SKIPPED`) are now
structured returns for expected business cases — never a thrown error. `SKIPPED` and
`RECONCILIATION_NEEDED` changed shape only (throw → return); no new business logic was added to either.
`PAST_DUE` is now fully real: a clean charge failure (`chargeMandateFn` resolves `{success:false}`, not a
thrown error) calls `setAppStatus(subscription, 'past_due', ...)` (the existing helper, reused via
`subscriptionController.js`'s own export — the same way `subscriptionLifecycleJobs.js` already imports
it, no circular dependency introduced) and returns a structured result, **leaving
`BillingInvoice`/`CommercialTransaction` in their current non-terminal state** (`PENDING_PAYMENT`/`PRICED`)
— deliberately not marked `FAILED`/`VOID`, per R12's own text ("zero commercial state touched") and per
Step 7's finding: a future Retry Engine calling `renewSubscription()` again must find this same
non-terminal transaction and resume via the already-verified Slice 2 repair-forward logic, not discover a
dead end requiring new recovery code.

**Deliberate scope boundary, verified by fixture, not assumed:** a successful *resumed* charge (simulating
a future Retry Engine calling `renewSubscription()` again after a `PAST_DUE` result) does **not** flip
`appStatus` back to `active`. Confirmed directly: Chapter 3.5 (line 841) and RT1 both assign "`past_due →
active` on retry success" to the **Retry Engine**, not the Renewal Engine — so `renewSubscription()`
correctly leaves `appStatus` untouched on a resumed success, and whoever builds the Retry Engine owns
writing that transition. Not an oversight; a verified boundary.

**Verified with real fixtures, structured output printed, not "looks correct":**
- `SKIPPED` (no `mandateTokenId`): returns `{outcome:'SKIPPED', reason:'NOT_RENEWABLE'}`, no throw.
- `RECONCILIATION_NEEDED` (`chargeMandateFn` throws): returns `{outcome:'RECONCILIATION_NEEDED',
  reason:'AMBIGUOUS_CHARGE_RESULT', error: <message>}`, no throw, `appStatus` confirmed untouched.
- `PAST_DUE` → simulated retry: first call (`chargeMandateFn` resolves `{success:false}`) returns
  `PAST_DUE`, `appStatus` becomes `past_due` (logged via `setAppStatus`'s own console output:
  `active -> past_due`), transaction stays `PRICED`, invoice stays `PENDING_PAYMENT` — confirmed by direct
  lookup, not inferred. A second call on the same (freshly reloaded) subscription, with a
  `chargeMandateFn` that now succeeds, resumes correctly: charge called exactly once on each of the two
  calls (not re-charged on the second), returns `RENEWED`, and `appStatus` remains `past_due` afterward
  (the scope boundary above, confirmed not just asserted). Test documents deleted immediately after;
  temp script deleted, not committed.

**Whole-backend grep confirms still exactly one entry point** (`renewSubscription`'s own definition,
`module.exports`, and its own internal comments) — no cron, no scheduler, no second call site introduced.

### Phase 6 — 🟥 Build the Retry Engine and its scheduler
11. Implement the 3-attempt/24h-72h-120h retry cadence (§9) as its own module and scheduler job.
    **✅ Slice 1 done — single-subscription `retryRenewal()`, no cron. See the Phase 4C Slice 1
    subsection below.** ~~replacing the manually-triggered `POST /:id/retry-payment` as the *automatic*
    path (the manual endpoint can remain as a customer/Support-initiated early-retry option, per Chapter
    19's RT3)~~ — **this parenthetical is wrong, per the Phase 4C design session's Step 1 finding**:
    `retry-payment` rejects any subscription with `isPaymentConfirmed:true`, so it cannot serve a
    `past_due` renewal retry at all. Struck through rather than silently deleted — a real correction to
    this plan's own prior text, not an update that erases the mistake.
12. Add the Mandate Monitoring reconciliation job (§2.5) and the `RewardUsage` cleanup job (§2.6) in
    the same pass, since all three are small, independent, additive scheduler jobs.

### Phase 4C Slice 1 — Retry Engine, single subscription, no cron

**Scope: exactly what the slice brief specified.** Created only `backend/utils/retryEngine.js`.
`renewalEngine.js` was not modified. No cron, no scheduler, no iteration over subscriptions,
`ScheduledChange` untouched, `CommercialTransaction` schema untouched (only its existing `attemptCount`
field is written, same as `addonPurchaseLifecycle.js`/`updateSubscription` already do for other
transaction types), `retry-payment` not repurposed.

**Step 0 — the open design question, resolved, one answer, not deferred again.** Re-read every
`retrying`/`past_due` occurrence in Chapter 3.5: line 46 (Chapter 1's early sketch) and line 611 (R2's
table, "Retry Engine owns `retrying`, full stop") both use `retrying` as if it were a real state; line
837-841 (the same Chapter 3.5, ~200 lines later) states the access chain as `trial → active → past_due →
suspended → cancelled/expired` with no `retrying` value, describing retry success/exhaustion as direct
`past_due→active`/`past_due→suspended` transitions. **Contradiction identified, resolved by consistency
with the rest of the specification, not by picking arbitrarily**: Chapter 9's entire RT interaction-matrix
section (a later, independent audit pass) never references `retrying` as a value in any cell — RT1 says
"Returns to active," RT2 says "Suspended," both implicitly from `past_due`. The real codebase independently
confirms the same reading: `Subscription.appStatus`'s Mongoose enum, `setAppStatus`'s own hardcoded
validation list, and `middlewares/subscriptionGate.js`'s access-control list all have no `retrying` value
anywhere. **Decision: Option B.** `retrying` is documentation shorthand for "a `past_due` subscription
currently inside its retry window," not a persisted `appStatus` value. `appStatus` stays `past_due`
throughout; retry progress lives on `CommercialTransaction.attemptCount` (Step 4). Distinct, already-answered
question, not conflated with the above: Chapter 3.5 line 841 explicitly assigns `past_due→active` (on
retry success) to the **Retry Engine** — implemented in this slice. `past_due→suspended` is a **separate**
scheduler job (Chapter 7 Job 3, "Suspension" — distinct from Job 2, "Retry") — not implemented or touched
by this file; exhausting retries here does not suspend anything.

**Step 1 — `retryRenewal({subscription, chargeMandateFn})`**, `backend/utils/retryEngine.js`. One
subscription, one call, no iteration.

**Step 2 — eligibility, only spec-supported rules, one real gap identified and reported rather than
invented around:** (1) `appStatus === 'past_due'`, else `NOT_ELIGIBLE`; (2) a non-terminal
(`status:'PRICED'`) `CommercialTransaction{type:'RENEWAL'}` must exist to resume — matches exactly the
state Slice 3 leaves behind on a clean charge failure; (3) `attemptCount < 3` (`maxAttempts`, §9), else
`RETRIES_EXHAUSTED`; (4) the retry window (`retryIntervals=[24h,72h,120h]` from the most recent
`{to:'past_due'}` entry in `appStatusHistory` — existing, already-persisted data, no new field), else
`NOT_YET_DUE`. **If `appStatusHistory` has no `past_due` entry at all** (a state that shouldn't occur given
Slice 3 always writes one via `setAppStatus`, but checked rather than assumed impossible): returns
`NOT_ELIGIBLE` with an explicit `MISSING_PAST_DUE_TIMESTAMP` reason instead of guessing a fallback window.

**Step 3 — `renewSubscription()` called exactly once**, no duplicated pricing/invoice/`BillingCycle`/
repair-forward/`ScheduledChange` logic. Confirmed by reading `retryEngine.js`'s own source: the only
Renewal-Engine-owned work this file performs is interpreting the returned outcome.

**Step 4 — bookkeeping: `CommercialTransaction.attemptCount` incremented immediately before calling
`renewSubscription()`**, reusing the field exactly the way `addonPurchaseLifecycle.js`/`updateSubscription`
already use it for other transaction types (`attemptCount = 1` at first order-creation) — no new counter,
no schema change.

**Step 5 — outcomes:**
- `RENEWED` → `RETRY_SUCCEEDED`: `setAppStatus(subscription, 'active', 'Retry succeeded')`, saved. This is
  this engine's own write, per Chapter 3.5 line 841 — confirmed in Slice 3 that `renewSubscription()`
  deliberately does not do this itself.
- `PAST_DUE` → returned as `{outcome:'PAST_DUE', attemptsMade, retriesRemaining, nextRetryAt}` — the "next
  retry information" the brief asked for, nothing scheduled.
- `RECONCILIATION_NEEDED`/`SKIPPED` → forwarded unchanged, no further action, no retry.

**Step 6 — verified with six fixture scenarios, real values, real `appStatusHistory`/`CommercialTransaction`
state produced by an actual prior `renewSubscription()` failure call (not hand-crafted), fixture dates
relative to `new Date()` throughout, `past_due` timestamps back-dated only as an explicit fixture
manipulation to avoid a real 24h wait, never a hardcoded past calendar date:**

| Scenario | Result | Charge calls | Verified |
|---|---|---|---|
| Retry succeeds on first retry | `RETRY_SUCCEEDED`, `attemptsMade:1` | 1 | `appStatus→active`, `attemptCount:1`, transaction `COMPLETED` |
| Retry fails again | `PAST_DUE`, `retriesRemaining:2` | 1 | `appStatus` stays `past_due`, `attemptCount:1`, transaction stays `PRICED` |
| Retry limit reached (`attemptCount` pre-set to 3) | `RETRIES_EXHAUSTED` | **0** | `renewSubscription()` never called at all |
| `chargeMandateFn` throws | `RECONCILIATION_NEEDED` | 1 | forwarded unchanged |
| Not `past_due` at all | `NOT_ELIGIBLE`, `NOT_PAST_DUE` | 0 | — |
| Retry window not yet elapsed | `NOT_YET_DUE` | 0 | — |

No duplicate invoices, `BillingCycle`s, or `CommercialTransaction`s produced in any scenario (single
`RENEWAL` transaction per subscription throughout, confirmed via direct lookup in each scenario). Test
documents deleted immediately after each scenario; temp script deleted, not committed.

**Step 7 — whole-backend grep**: `retryRenewal` — exactly one definition, no duplicate. `attemptCount` —
used identically by `addonPurchaseLifecycle.js`, `updateSubscription`, and now `retryEngine.js`; no
divergent second convention. `retry-payment` — confirmed still routed to
`subscriptionController.retryPayment` (`routes/subscription.js:50`), **untouched, not repurposed**. Its
scope is documented above (Phase 6 item 11's struck-through parenthetical) as a legacy signup-recovery
endpoint that cannot serve a `past_due` renewal retry, per Step 1's original finding — restated here as a
confirmed fact, not re-derived.

**Confirmed: no cron, no scheduler, no automatic retries.** `retryRenewal` is not imported by
`backend/jobs/subscriptionLifecycleJobs.js` or anywhere else — callable only.

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
