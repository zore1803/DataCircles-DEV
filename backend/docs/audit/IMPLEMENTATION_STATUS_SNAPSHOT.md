# Implementation Status Snapshot — What Is Actually Built

> **Status:** synthesis of `IMPLEMENTATION_PLAN_V1.md` (the phased plan + progress log) cross-checked
> against the real code. No code changed. Purpose: a single "what exists today" view so frontend
> convergence + remaining backend work target reality, not the plan's aspirations or its stale notes.
> Companion to `INTENDED_BEHAVIOR_REFERENCE.md` (should-be) and
> `COMMERCIAL_ACTIONS_INTERCONNECTION_MAP.md` (how it wires).

---

## ⚠️ Doc-vs-code staleness found while reading (flag first)

`IMPLEMENTATION_PLAN_V1.md`'s **Phase 7 note (line ~2392)** says: *"Phase 3 item 6
(CommercialTransaction creation) and Phase 4 (ScheduledChange) haven't been implemented — confirmed
via grep: zero controller writes to either model anywhere in the codebase."* **This is stale.** The
code I traced directly now DOES write both:
- `CommercialTransaction`: written for upgrade (`subscriptionController.js` upgrade branch),
  downgrade (`{DOWNGRADE}`), add-on purchase (`addonPurchaseLifecycle.js`), and renewal
  (`renewalEngine.js`).
- `ScheduledChange`: written for downgrade/billing-cycle (`{PLAN_CHANGE|BILLING_CYCLE_CHANGE}`) and
  add-on removal (`{REMOVE_ADDON}`), and read by `renewalEngine.js:409`.

So the plan's later phases (3 item 6, 4A) landed *after* that Phase 7 note was written, and the note
was never updated. **When in doubt, the code is ground truth; the plan's per-phase "not started"
notes can lag the actual build.** Treat the status table below (verified against code) as current.

---

## Built and verified (the encouraging half)

| Piece | State | Evidence |
|---|---|---|
| CAW acquisition (Registration Link) | ✅ built, live-verified | `createSubscription`; real `inv_…` links created this session |
| Webhook plumbing + signature verify | ✅ built, live | `handleWebhook`, `handleCAWPaymentCaptured/Failed`, `handleCAWTokenEvent` |
| Mandate reconciliation + activation | ✅ built, live | `reconcileMandate` (AND-gate, idempotent) |
| First-period init + trial cleanup | ✅ built this session | `reconcileMandate` (Phase 1 fixes), backfill applied |
| Invoice Engine (`calculateInvoice`) | ✅ canonical pricing authority | Stage 5 built; all 3 one-time-charge callers migrated onto it (5a); Category A/C consolidated (5c) |
| `BillingInvoice` persistence | ✅ signup + trial-conversion | Phase 2a + Phase 4D-5 |
| `CommercialTransaction` | ✅ upgrade/downgrade/add-on/renewal | despite stale Phase 7 note |
| `ScheduledChange` | ✅ downgrade/cycle/add-on-removal, read by Renewal Engine | Phase 4A |
| **Renewal Engine** | ✅ built, fixture + **real live charge** verified | `renewalEngine.js` (R1–R13, R13.5 repair-forward); `RENEWED` output logged |
| **Retry Engine** | ✅ built, fixture + real live charge | `retryEngine.js` (`[24h,72h,120h]`); `RETRY_SUCCEEDED` logged |
| Cron orchestration | ✅ wired, hourly, in-process lock | `billingOrchestration.js` + `renewalLifecycleJobs.js`, mounted in `server.js` |
| Coupon engine | ✅ built | `discountEngine.js` (validation pipeline, line-item, redemption-on-paid) |
| Referral reserve/consume/release | ✅ built | `referralRewards.js`, `modifierResolver.rewardToModifier` |
| Frontend: Registration Link redirect | ✅ built this session | `SubscriptionPlans.jsx` `registrationLink` branch |
| Frontend: Billing Profile modal | ✅ built this session | `BillingProfileModal.jsx` + gate |

## NOT built / open (the remaining work)

| Piece | State | Where it bites |
|---|---|---|
| **Upgrade/add-on = mandate charge** | ❌ still interactive checkout (`paymentDetails→openRazorpay`) | Spec (CAW §Upgrade/Add-on) decided mandate-charge; code diverges. Map §3 |
| **Downgrade Eligibility Validation** (Ch.12 usage checklist) | ❌ not built anywhere | Big missing capability: usage-vs-limit block + itemized checklist. Needs product-module usage reporting |
| **`appStatus: 'retrying'` enum value** | ❌ missing from enum + `setAppStatus` validStatuses | R2 ownership boundary can't be represented; Retry Engine can't set the state the spec assigns it |
| Modifier ordering (5b) | ❌ not implemented | coupon-before-referral is enforced by `PRIORITY` but the formal 5b consolidation is open |
| Coupons on upgrade/add-on invoices | ❌ acquisition only | Frontend `couponAppliesAtCheckout` is business logic in React compensating for it |
| Recurring coupon at renewal | ⚠️ unverified | Does `renewalEngine.js` feed `appliedCoupon` into `calculateInvoice`? Must check |
| Legacy dual-write retirement | ⚠️ `pendingUpdate`/`pendingAddonRemovals` still written alongside `ScheduledChange` | Ownership Law 5; Phase 8 |
| `handlePaymentCaptured` legacy/CAW split (Phase 7) | ❌ not started | blocks Phase 8 legacy removal |
| Legacy field removal (Phase 8) | ❌ only `legacyCreateSubscription_DEPRECATED` removed | `razorpaySubscriptionId`, `razorpayPlanId`, `pendingUpgrade`, `status` still present |
| Reward consumption end-to-end | ⚠️ never observed firing on a real completed payment | Part 4 gap — verify now that live captures work |
| RewardUsage `releaseReason`, `Referral pending→expired`, RewardUsage daily cleanup job | ⚠️ Phase 1 items, status unverified in code | Ch.13 deltas |
| Mandate monitoring reconciliation job | ❌ not built | §2.5 — webhook-only today, no sweep fallback |
| Frontend canonical state derivation | ❌ per-component legacy-field reads | `FRONTEND_CONVERGENCE_PLAN.md` Journey 1 |
| Retry Engine needs interactive `retryPayment` replacement | ❌ `retryPayment` still legacy `subscriptions.create()` | Phase 4D-2 matrix, call site of 4 |

## Legacy `subscriptions.create()` remaining (Phase 4D-2 matrix, verified this session)

3 call sites still on the disabled legacy Subscriptions API (trial-conversion already migrated):
`:1108` UPI cancel-and-recreate, `:3128` `handleSubscriptionCancelled`, `:3524` `retryPayment`. All
throw 401 on this CAW-only account if hit. **Correction:** this is a legacy-Subscriptions-API problem
specific to these 3 call sites, not a CAW/UPI limitation — CAW's own UPI mandate acquisition
(Registration Link) is not broken; it's test-mode-restricted on this account per Razorpay support,
confirmed working live. Once `:1108`'s UPI cancel-and-recreate branch is migrated to CAW-native UPI
routing (the same Registration Link mechanism, not the disabled Subscriptions API), it should work
fine per that same support confirmation.

## Billing Cycle Change (Monthly ↔ Yearly) — design settled, implementation not started

See `INTENDED_BEHAVIOR_REFERENCE.md` for the full trace. **Correction to an earlier read:** this is
not an open design question — the spec's final status (V1.0 freeze) lists it as **Done**. The settled
model is **Billable Item** (per-component, immutable Billing Anchor, never resets) + **Commercial
Event** grouping for same-day-due bundling — NOT the Billing Bucket model (superseded) and NOT the
original flat-`billingCycle` formula (superseded). What's missing is purely implementation:
`Subscription.billingCycle` is still a flat field, no `BillableItem`/per-anchor model exists in the
schema, and `updateSubscription`'s cycle-change branch was never rebuilt against this model. Real,
non-trivial schema/engine work (touches Subscription, add-ons, Renewal Engine) — but no open business
question blocks starting it.

## How the pieces actually connect (the runtime spine, confirmed in code)

```
Acquisition:  createSubscription / updateSubscription(trial-conv)
                → calculateInvoice → BillingInvoice(pending) → Registration Link
                → [webhook] token.confirmed + payment.captured → reconcileMandate
                → appStatus active + period init + SubscriptionPayment written

Upgrade/Add-on: updateSubscription(upgrade) / initiateAddonPurchase
                → calculateInvoice(adjustmentContext) [Stage 5 proration]
                → CommercialTransaction{UPGRADE|ADDON_PURCHASE} + referral reserve
                → Razorpay Order → openRazorpay (❌ should be Charge Mandate)
                → [webhook] payment.captured → commit + reward consume

Downgrade/Remove: updateSubscription(downgrade) / scheduleAddonRemoval
                → ScheduledChange{PLAN_CHANGE|REMOVE_ADDON} (+ legacy pendingUpdate dual-write)
                → CommercialTransaction{DOWNGRADE} COMMITTED→COMPLETED (no payment)

Renewal (cron hourly): runRenewalJob → find nextBillingDate<=now, mandateTokenId!=null
                → renewSubscription: buildEffectiveSubscription (reads ScheduledChange)
                → calculateInvoice → BillingInvoice → Charge Mandate → advance period
                → CommercialTransaction{RENEWAL}

Retry (cron hourly): runRetryJob → find past_due
                → retryRenewal: self-gates on CommercialTransaction{RENEWAL,PRICED}
                → [24h,72h,120h] cadence → success=active / exhausted=suspended
```

**Coupons** ride the modifier pipeline into `calculateInvoice` at acquisition (recurring, stored
`appliedCoupon`). **Referrals** ride the same pipeline at upgrade/add-on (one-time, reserved→consumed).
Same engine, opposite lifecycle moments — this is the core interconnection.

---

## Net: what to build next, in dependency order

1. **Frontend canonical state** (Journey 1) — lowest-risk, unblocks all UI. No backend dependency.
2. **`appStatus: 'retrying'` enum** — tiny, unblocks Retry Engine correctness + UI retry state.
3. **Upgrade/Add-on → mandate charge** (+ carries coupons-on-upgrades) — biggest backend item; a
   frozen-spec decision the code doesn't honor. Deletes shared interactive-checkout frontend path.
4. **Downgrade Eligibility Validation** — large, mostly-unbuilt, spans billing + product modules.
5. **Legacy retirement** (Phase 7 split → Phase 8 removal; dual-write cleanup) — last, once nothing reads legacy.
6. **Verify** recurring-coupon-at-renewal + reward-consumption-live + Ch.13 Phase-1 deltas.

Every backend/spec item goes through the V1.1 Change Process where it changes decided behavior, and is
reported — never worked around in React (operating-manual discipline).
