# Upgrade Capability — Functional Documentation (Pass 1)

> **This is implementation documentation, not an architecture review.** No
> fixes proposed, no bugs newly investigated, no architecture commentary.
> Every statement tagged **Verified** (code + evidence cited) / **Partially
> Verified** (some evidence, not end-to-end) / **Assumed** (inferred, not
> checked) / **Unknown** (genuinely unchecked). Architecture Review — Upgrade
> is a separate, later document (Pass 3), same methodology as Acquisition.
> Raw QA evidence this is built from: `audit/UserObservations.md`. Findings
> requiring judgment (bugs, smells) are NOT repeated here — see
> `KNOWN_BILLING_GAPS.md` once Pass 3 routes them there.

## Purpose

Let a paying organization move to a higher-tier plan mid-cycle, charging only
the prorated difference now (a one-time Razorpay Order), with the new plan's
entitlements active immediately and the recurring amount updating from the
next renewal. **Verified.**

## Business Scope

**In scope:** any tier increase (Starter→Growth, Starter→Business,
Growth→Business) on the **same billing cycle**, for an organization with
`isPaymentConfirmed: true`. **Verified** — the branch is only entered when
`subscription.isPaymentConfirmed` is true (`subscriptionController.js:702`)
and `isTierUpgrade` (target plan priority > current, same cycle,
`:707-710`).

**Out of scope (separate capabilities, confirmed by code branching, not
inferred):**
- Downgrades — different branch entirely (`_isDowngrade` check, line ~895), scheduled for cycle-end, not this one-time-Order mechanism. **Verified.**
- Billing-cycle changes (monthly↔yearly) without a tier change — explicitly excluded from the upgrade branch (`isBillingCycleChangeUpg` guard, line 708). **Verified.**
- A brand-new subscription's first payment — Subscription Acquisition, a different controller path entirely. **Verified.**

## Entry Conditions

- `PUT /subscription/update`, `requireAuth` + `adminMiddleware` (org admin only). **Verified**, `routes/subscription.js:37`.
- Frontend: `SubscriptionPlans.jsx` (the "Manage Subscription" page), clicking "Upgrade" on a higher-tier `PlanCard`. **Verified.**
- Preconditions checked in order: subscription exists (else 404) → **not** `cancelAtPeriodEnd` (else 400, "reactivate before making changes") → `isPaymentConfirmed` true → target plan exists and `isActive` (else 404) → `isTierUpgrade` true on same cycle. **Verified**, `subscriptionController.js:671-710`.

## Exit Conditions

- **Success:** `Subscription.planName`/`pricePerUser`/`totalAmount`/`activeAddons` updated, `pendingPlanChange` cleared (or retained with `needsRazorpaySync` — see Razorpay Integration below), a `PLAN_UPGRADE` BillingEvent recorded. **Verified** (settlement trace, `subscriptionController.js:1754-1900+`).
- **Abandoned:** Razorpay checkout dismissed — `ondismiss` fires a frontend-only toast, no backend call. The `pendingPlanChange` object remains on the subscription document with no automatic expiry. **Verified**, `SubscriptionPlans.jsx:570-571` (same mechanism confirmed during Acquisition's investigation, re-observed here in the "Order Summary... Back" screenshots where the org stayed on the old plan after not paying).
- **Superseded:** user opens a second upgrade before paying the first — the second call overwrites `pendingPlanChange` after first releasing any reward reservation held by the prior attempt (same-flow recycle). **Verified**, `subscriptionController.js:771-773`.

## Business Contract

| Line | Status | Evidence |
|---|---|---|
| A paying organization on a lower tier may upgrade to a higher tier, same cycle | **Verified** | `subscriptionController.js:702-710` |
| Upgrade charges only the prorated difference now, not the full new-plan price | **Verified** | `calculatePlanUpgradeProration`, applied at `:757` |
| The new plan's entitlements (feature access, limits) activate at payment capture, not at next renewal | **Verified** | `planName`/`pricePerUser` set at settlement, before Razorpay's own recurring-plan sync (`:1782-1783`, "ENTITLEMENTS CHANGE NOW" comment) |
| An abandoned upgrade checkout leaves the current plan fully intact | **Verified** | `pendingPlanChange` is written at initiation; `planName` etc. are only mutated at settlement, never at initiation |
| Compatible add-ons carry forward automatically, without a separate confirmation step | **Verified** | `classifyAddonsForPlanChange`, applied unconditionally at both initiation (preview) and settlement (apply) |
| Add-ons incompatible with the target plan are not billed again this cycle, but access continues until cycle end | **Verified** | Incompatible add-ons excluded from `newRecurringTotal`'s billing (`:1789-1791` comment) but kept in `activeAddons` until `pendingAddonRemovals` removes them (`:1843-1861`) |
| A referral reward, if available, is applied as a one-time discount on the upgrade's prorated charge | **Verified** | Reserve→apply→consume mechanism, cross-referenced to `flows/Rewards.md` |
| A recurring coupon discount continues to reduce the subscription's recurring amount after an upgrade | **Not verified — evidence points the other way.** Recorded here as a contract line only because it is the evident intended behavior; whether it currently holds is an architecture-review question, not asserted here as fact either way. | See Coupon Lifecycle below |
| Add-ons already scheduled for removal (from a prior, separate removal request) survive an upgrade and keep their scheduled effective date | **Verified** | `subscriptionController.js:1828-1841`, explicit re-add loop with a comment confirming this intent |
| On UPI-mandate subscriptions, the recurring Razorpay plan amount may not update immediately, even though local entitlements have | **Verified** | `try { razorpay.subscriptions.update(...) } catch` fallback, `:1864-1879`, cross-referenced to `KNOWN_BILLING_GAPS.md`'s existing UPI-update-constraint entry |

## State Machine

```
Active (paid, current plan)
   │  PUT /subscription/update, isTierUpgrade branch entered
   ▼
Upgrade Initiated
   │  classifyAddonsForPlanChange → compatible/incompatible split
   │  same-flow reward-reservation recycle (release any prior pendingPlanChange's reservation)
   │  reserveNextAvailableReward() (if any reward available)
   │  calculatePlanUpgradeProration → applyModifiers (reward discount, if reserved)
   │  razorpay.orders.create() for the discounted prorated amount + GST
   ▼
Pending Plan Change   (subscription.pendingPlanChange set; planName/totalAmount/activeAddons UNCHANGED)
   │
   ├── checkout dismissed ──────► remains in Pending Plan Change, no expiry (see Recovery Model)
   │
   ├── a second upgrade initiated ──► same-flow recycle releases this reservation,
   │                                   pendingPlanChange OVERWRITTEN with the new attempt
   │
   └── Order paid ─────────────────► handlePaymentCaptured, matches pendingPlanChange.orderId
          ▼
   Settlement
      - planName/pricePerUser flip immediately
      - activeAddons rebuilt: compatible carried (possibly remapped), incompatible kept until cycle end,
        pending-removal add-ons re-added if present
      - incompatible add-ons pushed into pendingAddonRemovals (effectiveAt = currentPeriodEnd)
      - totalAmount recalculated (see Subscription.totalAmount Lifecycle)
      - consumeReservation() if a reward backed this upgrade
      - razorpay.subscriptions.update() attempted (recurring plan sync)
      - emitBillingEvent(PLAN_UPGRADE)
          ▼
   ┌──────────┴──────────┐
   ▼ sync succeeded         ▼ sync failed (UPI)
Active                    Active, pendingPlanChange retained with
(pendingPlanChange         needsRazorpaySync — reconciled lazily on
 cleared)                  the next subscription.charged webhook
```
**Verified**, assembled from the settlement trace across this and the prior investigation turn (`subscriptionController.js:668-900`, `:1754-1900+`, `:2219-2230+`).

## Ownership

- `Subscription.pendingPlanChange` — owned exclusively by the upgrade initiation/settlement pair; no other flow writes it, except the same-flow recycle reading its `referralRewardUsageId` to release a stale reservation. **Verified.**
- `Subscription.pendingAddonRemovals` — shared with the standalone add-on-removal capability; upgrade settlement both reads it (to re-add already-scheduled removals) and writes to it (to schedule newly-incompatible add-ons). **Verified**, both directions cited above.
- `Subscription.activeAddons` — fully rewritten (not merged) at upgrade settlement from `compatibleAddons + incompatibleAddons + newAddonPurchases + restored pending-removal entries`. **Verified**, `:1804-1841`.
- `Subscription.appliedCoupon` — **not owned by this capability at all**. Upgrade settlement neither reads nor writes it; it passes through unchanged. **Verified** (absence confirmed — no `appliedCoupon` reference anywhere in the settlement block traced).

## Interactions

| With | Verified behavior |
|---|---|
| **Coupons** | Coupon continues to display as applied (object untouched) after an upgrade. Whether it continues to reduce the actual recurring `totalAmount` is **Unknown as a contract fact** — the settlement code path that recalculates `totalAmount` does not reference the coupon at all. This is stated here as a factual code-path observation, not a bug judgment. |
| **Referrals / Rewards** | A reward, if available, is reserved before the Order is created and consumed on settlement — same mechanism as `flows/Rewards.md`. **Verified** for reserve+apply (live discount observed on the Order amount); **Partially Verified** for consume (traced, not freshly re-confirmed this session against a completed upgrade payment). |
| **Add-ons (active)** | Compatible add-ons carry forward automatically; incompatible ones are excluded from billing but retained for access until cycle end, then scheduled for removal. **Verified.** |
| **Add-ons (pending removal)** | A removal already scheduled before the upgrade survives the upgrade with its original `effectiveAt` intact. **Verified.** |
| **Trial** | Not applicable — the upgrade branch requires `isPaymentConfirmed: true`, which a trial subscription structurally cannot have (trials have `isPaymentConfirmed: false` by construction, per `flows/Trial.md`). **Verified by exclusion**, not directly exercised. |
| **Timeline / BillingEvent** | `PLAN_UPGRADE` recorded at settlement with a full before/after snapshot. **Verified.** |
| **Razorpay** | One-time Order for the prorated charge; a best-effort attempt to also update the recurring Subscription plan (`schedule_change_at:'cycle_end'`), which fails silently on UPI mandates and is deferred to the next renewal webhook. **Verified.** |

## Recovery Model

- An abandoned upgrade Order leaves `pendingPlanChange` in place indefinitely — there is no observed expiry or cleanup mechanism for it (distinct from the reward reservation inside it, which does expire independently after 30 minutes and gets released). **Verified** the reservation expires; **Verified** `pendingPlanChange` itself has no parallel expiry (absence confirmed by reading the full settlement/initiation code — no TTL field, no cron reference to `pendingPlanChange` cleanup).
- Re-attempting the upgrade is the only observed recovery path — it overwrites the stale `pendingPlanChange` and recycles its reward reservation. **Verified**, matches your walkthrough exactly (multiple upgrade attempts before a successful payment).
- A UPI recurring-sync failure recovers lazily: `needsRazorpaySync` is checked and reconciled on the **next** `subscription.charged` webhook. **Verified**, `subscriptionController.js:2224+` (cross-referenced to `KNOWN_BILLING_GAPS.md`'s existing entry on the underlying UPI constraint).

## Failure Model

- Razorpay Order creation fails → the reward reservation (if one was taken) is released immediately, rather than waiting for its TTL. **Verified**, `:800-805`.
- Amount-mismatch guard at settlement: if the captured payment amount differs from the expected prorated amount by more than ₹1 (rounding tolerance), settlement aborts with a logged error and does **not** apply the upgrade. **Verified**, `:1769-1776`.
- Plan-not-found at settlement (target plan deactivated between initiation and payment) → settlement aborts, logged. **Verified**, `:1778-1779`. Whether the customer is notified or simply left in `Pending Plan Change` forever in this case is **Unknown** — not traced.

## External Integrations

- **Razorpay Orders API** — one-time charge for the prorated amount. **Verified.**
- **Razorpay Subscriptions API** — best-effort recurring-plan update, `schedule_change_at:'cycle_end'`. **Verified**, succeeds on card, fails on UPI (confirmed error string in `KNOWN_BILLING_GAPS.md`).
- **Email** — not traced this pass. **Unknown** whether an upgrade triggers any customer notification beyond Razorpay's own payment receipt.

## Business flows exercised (from `audit/UserObservations.md`, cross-referenced)

1. **Starter → Growth, no add-ons.** Prorated charge, recurring update, timeline, payment history, invoices, billing page, manage-subscription — all **Observed** working as described in the walkthrough's first scenario.
2. **Starter + Extra Seat → Growth.** Compatible add-on carried forward (renamed Extra Seat → Seat, a remap — `remappedFrom` field exists in `classifyAddonsForPlanChange`'s output per earlier trace), prorated charge included the carried add-on's differential. **Observed.**
3. **Growth + Seat → Business** (Business plan does not offer Seats). Checkout correctly explained "seats — removed at cycle end, access continues until renewal." **Observed** at checkout time. Post-payment cross-screen consistency of this "scheduled for removal" state is **Partially Verified** — confirmed correct on the Manage Subscription page in later re-tests this session, but was **Observed missing** on the Billing page in the walkthrough (a specific screen-derivation question, not re-chased here per the frozen-investigation instruction).
4. **Pending upgrade abandoned, then resumed.** "Complete Payment" reappeared correctly, `pendingPlanChange` persisted, resuming completed the upgrade. **Observed.**
5. **Reward reserved and applied during an upgrade.** Discount visible on the Order amount, correct arithmetic. **Observed** for reserve+apply; consumption **Partially Verified** (see Interactions table).
6. **Starter → 2 seats added → 1 seat removal scheduled → Growth upgrade → Business upgrade**, tracing whether the scheduled removal (from the *original* Starter subscription) survives two subsequent upgrades. **Observed**: the scheduled removal persisted and was still shown as pending after both upgrades, matching the "restore pending-removal add-ons" code path cited above.
7. **Coupon interaction across the same sequence.** Coupon badge/label persisted visually across all three plans. Whether the underlying recurring charge reflected it is **Unknown as a verified fact** in this document — see Interactions and Coupon Lifecycle.

## Coupon Lifecycle (as it intersects Upgrade — cross-referenced from the dedicated investigation)

```
Coupon applied at subscription creation → stored once on Subscription.appliedCoupon (full snapshot)
        ↓
Upgrade settlement → totalAmount recalculated from buildPricingSnapshot(plan, billingCycle, activeAddons, basePriceOverride)
        — this call does not pass a coupon or modifiers argument
        ↓
Subscription.appliedCoupon itself: unread, unwritten, unchanged by this settlement path
```
**Verified as a code-path fact.** Whether this represents intended behavior or a defect is explicitly deferred to the Architecture Review — this document states only what the code does, not whether it's correct.

## Referral / Reward Lifecycle (as it intersects Upgrade)

Reserve → discount-apply → consume, identical mechanism to the standalone add-on-purchase flow (`flows/Rewards.md`), reused here for the upgrade's prorated Order. **Verified** for reserve/apply. Whether a reward can be **earned** as a side effect of completing an upgrade (as opposed to a first-ever payment) was not directly tested this pass — the unexplained reward-event sequence observed during walkthrough testing is recorded as an open item in the Upgrade investigation notes, not resolved here.

## Explicitly Unknown (not investigated this pass, not asserted)

- Invoice generation timing/content for upgrades.
- Payment History record shape for upgrade-type payments beyond what's visible in the Timeline UI.
- Email/SMS notification behavior specific to upgrades.
- Whether a coupon is re-evaluated on ordinary (no-plan-change) renewals.
- Customer communication (if any) when settlement aborts due to a plan-not-found or amount-mismatch failure.
