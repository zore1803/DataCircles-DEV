# Billing Findings Register — master backlog

> **Consolidated from every investigation in this audit so far** (Trial,
> Subscription Acquisition, Upgrade, Downgrade). This is the single source of truth for
> implementation issues. Architecture Reviews **reference** these BUG IDs
> rather than restating findings; each finding points **back** to the review
> section that discusses its architectural significance (the `Arch review:`
> field) — bidirectional linkage. `KNOWN_BILLING_GAPS.md` entries are
> cross-linked, not duplicated. No fixes proposed here.
>
> **Per finding:** Capability · Severity · Status (Verified / Partially
> Verified / Assumed / Unknown) · Arch review (back-link) · Evidence
> (file:line) · Observed-in · Impact.
>
> **Severity scale:** Critical (money/entitlement wrong) · High (customer-visible
> incorrect state, no direct money loss) · Medium (inconsistency/UX) · Low (cosmetic/dead code).
>
> **ID numbering:** deliberate gaps left between capabilities (006–009, 019–020,
> 032–039 reserved) so new findings slot in without renumbering. **28 findings
> exist** (Trial 5, Acquisition 9, Upgrade 10, Cross-capability 1, Downgrade
> 3); highest ID is 042 but IDs are non-contiguous by design. FEATURE-008/009
> are tracked separately, not counted in the BUG- total.

---

## Trial

### BUG-001 — "Complete Payment" label shown during an active trial
**Severity:** Medium · **Status:** Verified · **Arch review:** `flows/Trial.md` §14 (Trial's architectural framing captured inline; no separate review doc)
**Evidence:** `PlanCard.jsx` `isPendingPayment()` — `planName matches && billingCycle matches && !isPaymentConfirmed && paymentStatus==='pending_payment'`. `startFreeTrial` never sets `paymentStatus`, so it sits at the Mongoose default (`models/Subscription.js:218-222`, default `'pending_payment'`), coincidentally satisfying this check.
**Impact:** The Growth card during trial shows the identical label a genuinely-abandoned real payment would show — misleading, not a designed "convert now" CTA.
**Also in:** `KNOWN_BILLING_GAPS.md`.

### BUG-002 — Trial can create a second `Subscription` document for an organization
**Severity:** Critical (data-integrity) · **Status:** Verified (code), not reproduced live · **Arch review:** `flows/Trial.md` §14
**Evidence:** `startFreeTrial`'s only guard is `existingSubscription?.trialUsed` (`subscriptionController.js:406`). No unique index on `Subscription.organization`. `trialUsed` defaults `false`, only ever set inside `startFreeTrial` itself.
**Impact:** An org with a prior cancelled/paid subscription that never went through trial could get a second Subscription doc inserted, violating "one org owns one subscription." Every `findOne({organization})` call downstream would then return an arbitrary one of two documents.
**Also in:** `KNOWN_BILLING_GAPS.md`.

### BUG-003 — Dead access-control middleware (`middlewares/subscriptionCheck.js`)
**Severity:** Low (currently inert, risk if ever wired in) · **Status:** Verified · **Arch review:** `flows/Trial.md` §14
**Evidence:** Grepped every route file — zero references to `checkSubscriptionLimits`. It independently checks `subscription.status`, not `appStatus` (the field the real gate, `subscriptionGate`, actually reads).
**Impact:** None today (unused). Risk: a future engineer wires it in by mistake, producing different/wrong trial-expiry behavior.
**Also in:** `KNOWN_BILLING_GAPS.md`.

### BUG-004 — No reachable "Start Trial" CTA when an org has zero subscription
**Severity:** Medium (product/UX) · **Status:** Verified · **Arch review:** `flows/Trial.md` §14
**Evidence:** `Header.jsx` ~line 1229: `label = trialLeftLabel || subscriptionLabel; if (!label) return null;` — both are empty with no subscription at all, so the entire promo banner (including any CTA) renders nothing.
**Impact:** A user with no subscription who lands on any page other than pricing sees only error toasts, no path forward. User's own regression claim ("used to be there") is **Unverified** — no git history available to confirm.
**Also in:** `KNOWN_BILLING_GAPS.md`.

### BUG-005 — Access-control inconsistency: Products & Services vs. Companies/Deals/Contacts
**Severity:** Medium · **Status:** Verified · **Arch review:** `flows/Trial.md` §14
**Evidence:** `routes/itemRoutes.js` chains only `subscriptionGate` (which explicitly allows all GETs through with no subscription, `middlewares/subscriptionGate.js:58-60`). `routes/CompanyRoutes.js`/Deal/Contact routes additionally chain `restrictByPlan(...)`, which has no read-exception and 403s GETs with no subscription (`middlewares/restrictByPlan.js:132-137`, exact string on line 134).
**Impact:** With no subscription, Products & Services' list loads fine while Companies/Deals/Contacts show "No subscription found" — same user state, different behavior, no evident product reason.
**Also in:** `KNOWN_BILLING_GAPS.md`.

---

## Subscription Acquisition

### BUG-010 — Timeline records initiation as completion
**Severity:** High (audit-trail correctness) · **Status:** Verified · **Arch review:** Pending — Acquisition architecture review not yet written to disk (routing plan produced, write deferred)
**Evidence:** `createSubscription` (`subscriptionController.js:601-624`) inserts the `Subscription` doc with `status:'created'`, `isPaymentConfirmed:false`, then immediately emits `SUBSCRIPTION_CREATED` → rendered by `buildEventSummary()` (`utils/billingEvents.js:54-60`) as `"Subscribed to ${planName}"`, an unconditional, completion-worded title with no paid/unpaid branch. Code comment at the emission site (line 622-623) confirms this is a known internal tradeoff.
**Impact:** Customer-facing Timeline shows "Subscribed to Starter" before any payment occurred.

### BUG-011 — RENEWAL BillingEvent fires on the literal first payment
**Severity:** Critical (billing-history correctness) · **Status:** Verified this session · **Arch review:** Pending — Acquisition review
**Evidence:** `handleSubscriptionAuthenticated` (`:2017-2038`) sets `isPaymentConfirmed=true` on Razorpay's `subscription.authenticated` webhook — typically the FIRST event for a new subscription's first payment. `handleSubscriptionCharged` (`:2116-2163`) then processes `subscription.charged` for that SAME first charge, checks `isFirstRecord && subscription.isPaymentConfirmed` — finds it already `true` — and wrongly emits `RENEWAL`. Same bug class as the fixed §11a settlement race, in event *labeling*.
**Impact:** Reproduced in walkthrough — "Renewal · Growth · ₹531 paid" appeared as the very first payment.
**⚠ Contradicts existing docs:** `flows/Renewal.md:18` and `audit/EventMatrix.md:35` currently claim this guard works — both need correcting.

### BUG-012 — Duplicate `SUBSCRIPTION_CREATED` events
**Severity:** Medium · **Status:** Verified · **Arch review:** Pending — Acquisition review
**Evidence:** Two emission sites: `createSubscription` (`:624`) and `updateSubscription`'s pending-plan-switch branch (`:1101`). Both fire on every attempt.
**Impact:** Re-selecting a plan while unpaid produces a second permanent "Subscribed to X" timeline entry for the same never-completed attempt.

### BUG-013 — Payment cancellation performs zero backend cleanup
**Severity:** Medium · **Status:** Verified · **Arch review:** Pending — Acquisition review
**Evidence:** `ondismiss` handler (`SubscriptionPlans.jsx:570-571`) is a frontend-only toast; no API call. `PAYMENT_CANCELLED` does not exist in the `BillingEvent` enum.
**Impact:** The Subscription doc created at initiation (BUG-010) persists forever in `status:'created'` with no cleanup path and no cancellation event.

### BUG-014 — Coupon field selection not persisted across navigation
**Severity:** Low (UX, arguably intentional) · **Status:** Verified · **Arch review:** Pending — Acquisition review
**Evidence:** `appliedCoupon` in `SubscriptionPlans.jsx` is plain `useState(null)` — no localStorage, no URL param. Resets on remount. The "Payment Pending" banner persists because it's re-derived from the database on mount.
**Impact:** Navigating away and back clears the coupon field even though pending-payment state survives — asymmetric persistence. Noted as possibly-intentional, not asserted as a defect.

### BUG-015 — Add-on quantity stepper displays 1 while price calculation treats it as 0
**Severity:** Medium · **Status:** Verified · **Arch review:** Pending — Acquisition review
**Evidence:** `PlanCard.jsx:429` — display quantity `selectedAddons?.[addon.key] ?? 1`. `PlanCard.jsx:159,174` — price/total uses `selectedAddons?.[a.key] || 0`. Same state, two different fallback semantics.
**Impact:** Stepper visually starts at "1"; first "+" jumps real state from `undefined` to `2`; price only changes at that point — matches the walkthrough exactly.

### BUG-016 — Card-expansion layout: all pricing cards resize together
**Severity:** Low (cosmetic) · **Status:** Unknown — observed only, never traced · **Arch review:** n/a (untraced)

### BUG-017 — `PAYMENT_SUCCESS` / `COUPON_APPLIED` emission sites unconfirmed
**Severity:** Unknown · **Status:** Unknown · **Arch review:** n/a (untraced)
**Evidence:** `PAYMENT_SUCCESS` exists in the enum but no emission site was found in `subscriptionController.js` this pass (searched, not exhaustive). `COUPON_APPLIED` independent emission unchecked.

### BUG-018 — Abandoned Razorpay-side Subscription cleanup unknown
**Severity:** Unknown · **Status:** Unknown · **Arch review:** n/a (untraced)
**Evidence:** Not traced whether an abandoned local Subscription doc's paired Razorpay Subscription object is ever cancelled on Razorpay's platform.

---

## Upgrade

### BUG-021 — Coupon snapshot stale after upgrade (display)
**Severity:** High · **Status:** Verified · **Arch review:** `ArchitectureReview-Upgrade.md` §5 ("Coupon continues to discount...Failed"), §12 ("Coupon is not modeled as a first-class...entity")
**Evidence:** `PlanCard.jsx:192-196` — the current-plan card intentionally renders from `currentSubscription.appliedCoupon`'s stored snapshot fields (`baseSubtotal`, `discountAmount`, `recurringSubtotal`), written once at coupon-application time, never recalculated. Upgrade settlement (BUG-022) never touches `appliedCoupon`.
**Impact:** The "Business" card displayed "₹250 → ₹235 · Coupon WELCOME20 · save ₹15" — Starter-era pricing under a Business label after two upgrades.

### BUG-022 — Coupon dropped from recalculated `totalAmount` during upgrade settlement
**Severity:** Critical (potential real recurring-billing error) · **Status:** Verified · **Arch review:** `ArchitectureReview-Upgrade.md` §7 (recurring-billing invariant, Failed), §12 ("Coupon is not modeled as a first-class...entity")
**Evidence:** `subscriptionController.js:1793-1799` — `buildPricingSnapshot({plan, billingCycle, activeAddons, basePriceOverride})`, no `couponDiscount`/`modifiers` argument despite `pricingEngine.js:77` accepting both. The resulting `newRecurringTotal` feeds `findOrCreateRazorpayPlan()`, the actual recurring plan amount.
**Impact:** Coupon still *displays* active (BUG-021) but the recalculated recurring amount may not include its discount — potential real over-charge. **Not yet confirmed** whether the customer is actually overcharged next cycle.

### BUG-023 — Three independent pricing-derivation sources can disagree
**Severity:** High (architectural) · **Status:** Verified · **Arch review:** `ArchitectureReview-Upgrade.md` §7 (single-authoritative-state invariant, Failed), §12 ("Pricing has no single authoritative representation")
**Evidence:** (1) `PlanCard` current-plan card reads frozen coupon snapshot (BUG-021); (2) `BillingSidebar.jsx:44-45` computes `recurringTotal = subscription.totalAmount + GST` from raw, possibly-coupon-blind `totalAmount` (BUG-022); (3) `BillingSidebar.jsx:92-97` shows a "save ₹15" badge from the same stale snapshot — two non-reconciling numbers on **one component**.
**Impact:** Root architectural cause behind the compounding coupon/pricing-display findings — not a fourth bug, the reason the others produce visibly "impossible" states.

### BUG-024 — Add-on removal quantity hardcoded to 1 in the UI
**Severity:** Medium · **Status:** Verified · **Arch review:** `ArchitectureReview-Upgrade.md` §9 (Add-ons interaction, shared write access noted)
**Evidence:** `SubscriptionPlans.jsx:625-628` — `scheduleAddonRemoval({addonKey, quantity: 1})`, hardcoded. Backend (`addonManagement.js:245-265`) fully supports and validates arbitrary quantity.
**Impact:** No way to remove more than 1 unit per request; explains the two consecutive duplicate "Extra Seat removal scheduled" timeline entries.

### BUG-025 — No BillingEvent emitted when a scheduled add-on removal actually completes
**Severity:** High (audit-trail correctness) · **Status:** Verified · **Arch review:** `ArchitectureReview-Upgrade.md` §7 (audit-trail invariant, Failed), §12 ("audit trail records intentions...more reliably than completions")
**Evidence:** `applyScheduledAddonRemovals()` called from `handleSubscriptionCharged` (`subscriptionController.js:2209-2217`) inside try/catch with only a `console.log` — no `emitBillingEvent` anywhere in the function (`addonManagement.js:299-339`).
**Impact:** "ADDON_REMOVAL_SCHEDULED" is the only Timeline entry in the lifecycle; the customer never sees confirmation the removal happened.

### BUG-026 — Renewal-time removal recalculation likely also drops the coupon
**Severity:** High (same class as BUG-022, not independently confirmed) · **Status:** Partially Verified · **Arch review:** `ArchitectureReview-Upgrade.md` §12 ("Coupon is not modeled as a first-class...entity"), §14 (Open Questions re: Renewal's own review)
**Evidence:** `applyScheduledAddonRemovals` recalculates `totalAmount` via `calculateTotalPrice(plan, billingCycle, activeAddons)` (`addonManagement.js:325`) — same coupon-blind pattern as BUG-022.
**Impact:** If confirmed, every renewal that applies a scheduled removal re-drops the coupon, independent of any upgrade.

### BUG-027 — Carry-forward of compatible add-ons happens automatically, no user confirmation
**Severity:** Medium (product decision, not necessarily a bug) · **Status:** Verified (behavior), judgment deferred · **Arch review:** `ArchitectureReview-Upgrade.md` §5 (explicitly deferred as a product decision, not marked Failed)
**Evidence:** `classifyAddonsForPlanChange` result applied unconditionally at preview and settlement — no confirmation step, no opt-out beyond a "Carrying forward" info line.
**Impact:** User flagged wanting a choice; recorded as observed behavior, judgment is an architecture-review call.

### BUG-028 — `pendingPlanChange` has no expiry or cleanup mechanism
**Severity:** Medium · **Status:** Verified · **Arch review:** `ArchitectureReview-Upgrade.md` §7 (long-lived-pending-states invariant, Failed), §12 ("mixes immediate and deferred state transitions")
**Evidence:** Full read of initiation/settlement code — no TTL field on `pendingPlanChange`, no cron reference (unlike reward reservations, which expire after 30 min).
**Impact:** An abandoned upgrade checkout leaves `pendingPlanChange` on the doc indefinitely; only overwritten by a subsequent upgrade attempt.

### BUG-029 — Billing page did not show "add-ons removed at cycle end" messaging that checkout correctly showed
**Severity:** Medium · **Status:** Partially Verified (observed inconsistency, root cause not isolated) · **Arch review:** `ArchitectureReview-Upgrade.md` §12 ("Pricing has no single authoritative representation" — same class of surface disagreement)
**Evidence:** Checkout summary correctly explained the incompatible-add-on removal (Observed). The Billing page immediately after did not surface it in the walkthrough; a later re-test's Manage Subscription page *did* ("Seat ×2 removing 10 Aug"). Inconsistent across screens/attempts; not isolated to one component's derivation.

### BUG-030 — Unexplained referral reward events during an upgrade-only walkthrough
**Severity:** Unknown (alarming if real, likely explainable) · **Status:** Assumed, not confirmed · **Arch review:** Pending — needs DB check before it reaches any review
**Evidence:** `maybeQualifyReferral`'s only condition is an existing `Referral.findOne({referredOrganization, status:'pending'})` — it does not check whether a code was entered this session. The test org was very likely reused from earlier referral-flow testing in this same conversation, which fully explains a pre-existing pending referral qualifying on this org's first payment.
**Impact:** Not resolved — needs one direct DB check (`Referral.findOne` for that org) before Verified. **Do not treat as a live incident until confirmed.**

---

## Downgrade

> Phase 1 (15 scenarios enumerated from code) and Phase 2 (extensive live
> walkthrough) complete. Phase 3 investigation reached the highest-priority
> question — "which pending state is authoritative at renewal" — and
> answered it, which reframed most surface-level symptoms into one root
> cause (BUG-040) rather than a dozen independent bugs. The multi-add-on-type
> matrix (Seat+Storage+Automation together) was **not** tested — flagged
> below as an open coverage gap, not a finding. The coupon-lifecycle
> observations made during this walkthrough are **deliberately NOT
> registered here** — see the note at the end of this section.

### BUG-040 — No canonical "effective next-renewal state" (root cause / architectural)
**Severity:** Critical (architectural) · **Status:** Verified · **Arch review:** Pending — Downgrade Architecture Review (Pass 3) not yet written
**Evidence:** Traced the real renewal-application code directly. `applyScheduledAddonRemovals()` (`addonManagement.js:299-339`), called from `handleSubscriptionCharged` (`subscriptionController.js:2211`, the actual renewal webhook handler), DOES apply `pendingAddonRemovals` at renewal. But `pendingUpdate` (the scheduled-downgrade object) is read by **no code in the renewal path at all** — its only reader anywhere in the codebase is inside `handleSubscriptionCancelled` (`:2232`, reconciliation-at-cancellation code), which a downgrade never triggers (this is the pre-existing Gap A in `KNOWN_BILLING_GAPS.md`). Meanwhile, at least three UI/data surfaces each independently compute "future subscription state" from different, overlapping subsets of `activeAddons` + `pendingAddonRemovals` + `pendingUpdate`: the checkout preview (frontend, live recompute), the "Scheduled Change" card (`pendingUpdate.carriedAddons`, a backend snapshot frozen once at schedule time, `:1204-1208`), and Timeline snapshots (`snapshotOf()` in `billingEvents.js`, which doesn't serialize `pendingAddonRemovals` at all).
**Impact:** Reproduced live, repeatedly: the exact same underlying subscription state displayed as 3 seats carried forward (checkout), 0 seats (Scheduled Change card), and 2 seats (Timeline) — not because any one view is "wrong," but because none of them defer to a shared, authoritative computation. **Critically, this also means most of the visual disagreement is lower real-world severity than it first appeared** — `pendingUpdate.carriedAddons` is a write-only field, never consumed by the actual renewal logic, so the disagreement is a display/data-integrity problem today, not (yet) a real billing-correctness one. This finding is the direct trigger for the `calculateInvoice()` chokepoint design proposed in `RAZORPAY_MIGRATION.md` §2.

### BUG-041 — All-or-nothing carry-forward filter (partial removal not subtracted)
**Severity:** Medium (downgraded from initial impression — the affected field is write-only per BUG-040) · **Status:** Verified · **Arch review:** Pending
**Evidence:** Both `SubscriptionPlans.jsx:411-414` (frontend checkout preview) and `subscriptionController.js:1154-1158` (backend, computed at downgrade-schedule time) use `removal.quantity >= a.quantity` as a binary keep-all/drop-all filter, never a subtraction. Reproduced live: Seat×3, 2 scheduled for removal → filter evaluates `2 >= 3` → false → **all 3** carried forward (correct answer: 1). Same flawed logic duplicated in two files, not one.
**Impact:** The stored/displayed carry-forward quantity is wrong whenever a *partial* removal is scheduled before a downgrade. Because the specific field it corrupts (`pendingUpdate.carriedAddons`) is never read by real renewal logic (BUG-040), this is a data-quality/display bug rather than a billing-correctness one today — but would become one immediately if BUG-040's root cause is fixed by wiring `pendingUpdate` into renewal without also fixing this filter.

### BUG-042 — Timeline cannot represent a scheduled add-on removal's effect
**Severity:** Low (reframed from "obvious bug" — may be partially by-design for a not-yet-applied event) · **Status:** Verified (mechanism); Partially Verified (whether the identical Before/After is intentional or an oversight is an architecture-review judgment, not resolved here)
**Evidence:** `ADDON_REMOVAL_SCHEDULED` is emitted with `before: subscription, after: result.subscription` (`subscriptionController.js:~3096-3101`). `scheduleAddonRemoval()` only ever mutates `pendingAddonRemovals` — never `activeAddons` — and `snapshotOf()` (`billingEvents.js`) does not serialize `pendingAddonRemovals` into the snapshot shape at all. So `before.activeAddons` and `after.activeAddons` are always identical for this event type, by construction.
**Impact:** Every scheduled-removal Timeline entry shows no visible change, even though a real state change (scheduling) did occur. The scheduling *action* is correctly logged; its *effect* cannot be shown because the snapshot schema has no field for it.

### FEATURE-008 — No user choice on add-on carry-forward during downgrade/upgrade
**Status:** Confirmed behavior, explicitly classified as a product decision, not a bug
**Evidence:** `classifyAddonsForPlanChange`'s result is applied unconditionally, both at preview and settlement, in both Upgrade and Downgrade — no confirmation step, no opt-out beyond an informational "Carrying forward" line in the checkout summary.
**Note:** repeatedly raised during this walkthrough as something that should ask the user (carry all / carry selected / remove all) rather than silently deciding. Recorded here for traceability; not a defect against any stated contract.

### FEATURE-009 — No way to cancel/undo a scheduled downgrade
**Status:** Confirmed absent, feature gap
**Evidence:** `SCHEDULE_CANCELLED` exists in the `BillingEvent` type enum but grepping the entire codebase found **no code path that ever emits it** — no endpoint, no controller function, undoes a scheduled `pendingUpdate` once set. Confirmed live: once a downgrade is scheduled, every plan card becomes disabled/"Scheduled" until it takes effect, with no visible or backend path to cancel it early.
**Note:** the "everything freezes correctly after scheduling" behavior itself was confirmed working as intended during the walkthrough — this finding is specifically about the *absence* of an undo path, not the freeze behavior being wrong.

**Deliberately NOT registered under Downgrade — routed elsewhere:**
- **Coupon-lifecycle inconsistencies** observed repeatedly during this walkthrough (coupon disappearing from Manage Subscription post-purchase, coupon badge showing on a plan that has no discount rule for it, coupon amount not reflected consistently across Billing/Timeline/checkout) are the **same class of finding as BUG-021/022/023** from the Upgrade capability, now confirmed to also occur during Downgrade and plain add-on purchase flows. Per the standing decision to treat Coupon Lifecycle as its own standalone investigation (not re-derived per-capability), these observations are logged here as a pointer only — the actual findings belong in that investigation once it runs, cross-referencing BUG-021/022/023 rather than duplicating them with new IDs.
- **Multi-add-on-type matrix** (Seat + Storage + Automation together, compatible+incompatible mixed) — never tested this session. This is a coverage gap, not a finding — flagged in `flows/Downgrade.md` as the one remaining test before the capability can be marked complete.

---

## Cross-capability (not scoped to one Pass-1 document)

### BUG-031 — Cancellation eligibility contradicts intended product behavior
**Severity:** High (business-rule mismatch — reclassified from an initial "bug" framing; see note below) · **Status:** Verified as a code/stated-intent contradiction · **Scope:** Confirmed to affect **both** Upgrade (`updateSubscription`, gates the shared upgrade/downgrade entry point before the branch split) and Add-on Purchase (`initiateAddonPurchase`, its own independent copy of the same check, own error string) · **Arch review:** `ArchitectureReview-Upgrade.md` §3, §5, §12 (Upgrade's share of this); Add-on Purchase's own review (not yet written) will need to reference this too, not re-derive it
**Expected business behavior (explicitly stated by the product owner, not inferred):** because this system issues no refunds, an organization with a subscription scheduled to cancel at period end is still a paying customer with active entitlement through that period, and should remain eligible to purchase add-ons or upgrade its plan (prorated against the remaining period) until the cancellation actually takes effect — not merely until it is scheduled.
**Observed implementation:** both `updateSubscription` (`subscriptionController.js:679-683`) and `initiateAddonPurchase` (`:2931-2933`) independently reject the request the instant `cancelAtPeriodEnd` is `true` — a binary "has cancellation been scheduled" check, not a temporal "has the period actually ended" check. Each enforces this with its own separate, near-identical guard — two copies of the same rule, not a shared one.
**Impact:** A customer who schedules cancellation and changes their mind before the effective date cannot purchase an add-on or upgrade without first reactivating — contrary to the stated intended lifecycle, in which they remain a normal paying customer until the period actually ends.
**Classification note:** this was initially framed as a straightforward defect. On review, the distinction matters: if no formal product requirement had been recorded, this would only be a *behavioral inconsistency* worth a product decision, not a confirmed bug — "contrary to my expectation" and "contrary to the intended spec" are different claims. Here, however, the product owner explicitly confirmed the specific scenario (buying/upgrading a plan *after* scheduling cancellation, during the still-paid-for window) as the intended rule before this finding was recorded, which is what elevates it from "worth deciding" to "implementation contradicts a stated requirement." Recorded as cross-capability because the same contradiction is independently coded twice, not once.

---

## Cross-referenced, NOT re-listed here (already in `KNOWN_BILLING_GAPS.md` from prior sessions)
- Downgrade never reconciled at renewal (Gap A) — resurfaced conceptually by BUG-025/026's pattern but is a pre-existing, separately-documented issue.
- Settlement race on first-payment confirmation (§11a) — **already fixed** this session, unlike BUG-011 which is a *different*, still-open bug in the same code family.
- Reward consumption never observed live end-to-end (Razorpay test-gateway timeouts).
- `ReferralProgram` fields stored but unenforced (`stacksWithCoupons`, `honoredDuringTrial`, `minimumActiveDays`).

## Index by severity (for triage) — 28 findings total

**Critical (4):** BUG-002, BUG-011, BUG-022, BUG-040
**High (6):** BUG-010, BUG-021, BUG-023, BUG-025, BUG-026, BUG-031
**Medium (12):** BUG-001, BUG-004, BUG-005, BUG-012, BUG-013, BUG-015, BUG-024, BUG-027, BUG-028, BUG-029, BUG-041
**Low (4):** BUG-003, BUG-014, BUG-016, BUG-042
**Unknown, needs investigation before triage (3):** BUG-017, BUG-018, BUG-030

**Feature gaps, tracked separately (2):** FEATURE-008 (no carry-forward choice), FEATURE-009 (no undo-scheduled-downgrade)

## Index by capability — 28 findings total
**Trial (5):** BUG-001–005 · **Acquisition (9):** BUG-010–018 · **Upgrade (10):** BUG-021–030 · **Cross-capability (1):** BUG-031 (Upgrade + Add-on Purchase) · **Downgrade (3):** BUG-040–042
Reserved gaps for future findings: 006–009 (Trial), 019–020 (Acquisition), 032–039 (available for Downgrade/coupon-lifecycle findings before 040 block).
