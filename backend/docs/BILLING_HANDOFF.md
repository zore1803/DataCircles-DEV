# DataCircles Billing System — Engineering Handoff

> **Paste-into-a-new-chat handoff.** This is a *continuation*, not a fresh
> project. We are **NOT building features** — we are in a **production-hardening
> / architecture-audit** phase. Think like a Staff/Principal engineer: verify
> behavior from code, prefer evidence over theory, never guess. When something
> looks wrong, trace it and prove it before concluding.

---

## 0. How to read this repo's docs (read these first, don't re-derive)

The architecture is already documented. Start here before touching code:

- `backend/docs/ARCHITECTURE.md` — timeless invariants + system-flow diagram + state machine. **The rules.**
- `backend/docs/PROJECT_STATE.md` — implementation status, every fix with reasoning. **§11 is the entire referral system**, including:
  - §11a — the settlement-race bug + fix (`runFirstPaymentSettlement`)
  - §11b — deferred `confirmFirstPayment` consolidation
  - §11c — Super Admin referral UI + checkout discount surfacing (built)
  - §11d — `ReferralProgram` fields stored-but-unenforced (backlog)
  - "Future Enhancement (Blocked by Razorpay)" — first-invoice referral discount
- `backend/docs/REFERRAL_SYSTEM_DESIGN.md` — referral-specific design (29 sections).
- `backend/docs/PRICING_MODIFIER_ARCHITECTURE.md` — the generic coupon+reward → Modifier abstraction.
- `backend/docs/KNOWN_BILLING_GAPS.md` — Gap A (downgrade reconciliation), UPI AutoPay `subscriptions.update` constraint.

This handoff summarizes and cross-links; the docs above are the source of truth.

---

## 1. Stack

- **Backend:** Node.js, Express, MongoDB (Mongoose), Razorpay, SendGrid.
- **Frontend:** React + Vite.
- **Auth:** Auth0 + phone/OTP + a separate Super Admin token (`localStorage.superAdminToken`).
- **Payments:** Razorpay **Subscriptions** (recurring plan) + Razorpay **Orders** (one-time: upgrades, add-ons).

---

## 2. The one architectural idea that governs everything

**Transport events ≠ business events.** Razorpay tells you "money arrived"
through *five different transport events*; the *business event* ("first
payment succeeded") must be handled in exactly one place.

```
Transport (how Razorpay notifies)          Business event        Settlement
  payment.captured        ─┐
  subscription.authenticated─┤
  subscription.activated  ─┼──►  "first payment confirmed"  ──►  runFirstPaymentSettlement()
  subscription.charged    ─┤                                       ├─ maybeRecordCouponRedemption()
  verifyPayment (client)  ─┘                                       └─ maybeQualifyReferral()
```

This separation is **load-bearing** and must be preserved. Attaching business
side-effects to individual transport handlers is exactly the bug we fixed (see §5).

**Other invariants (from ARCHITECTURE.md — do not violate):**
- One `Organization` → one `Subscription`. Pricing = base plan + active add-ons + coupon + referral reward → `totalAmount` → Razorpay amount.
- **Settlement owns state.** Only payment-confirmation paths mutate canonical `Subscription`/`Reward` state; *initiation* only records intent.
- **Pricing engine is pure.** `buildPricingSnapshot`/`applyModifiers` (`utils/pricingEngine.js`) do arithmetic only — no DB I/O. Modifier lookup (DB) lives in `utils/modifierResolver.js`.
- **`Reward` is immutable** once created (only `revokedAt` may be set). Availability is *derived* by scanning `RewardUsage`, never a cached flag.
- **No duplicate writers** of a concept.

---

## 3. Key files map (real names — use these, not guesses)

**Backend models:** `Referral`, `Reward`, `RewardUsage`, `ReferralCode`,
`ReferralProgram`, `BillingEvent`, `Subscription` (all in `backend/models/`).
- `RewardUsage` has the concurrency guard: partial unique index
  `{ reward: 1 }` with `partialFilterExpression: { status: 'reserved' }`.

**Backend utils:**
- `utils/referralUtils.js` — `recordReferralIntent`, `validateReferralCode`, `issueReferralCode`, `buildReferralOverview`, `getOrCreateReferralProgram`, `orgAlreadyHasReferrer`, `generateUniqueReferralCode`.
- `utils/referralRewards.js` — reservation lifecycle: `getNextAvailableReward`, `reserveNextAvailableReward`, `consumeReservation`, `releaseReservation`, `releaseExpiredReservations`, `DEFAULT_RESERVATION_TTL_MS` (30 min).
- `utils/modifierResolver.js` — `resolveModifiers`, `rewardToModifier`, `couponToModifier`, `resolveReferralModifier`, `PRIORITY` (coupon 10, referral 20).
- `utils/pricingEngine.js` — `buildPricingSnapshot`, `applyModifiers` (caps via `value.maxAmount` at lines ~26–27), `computeGST`, `GST_RATE`.

**Backend controllers:**
- `controllers/subscriptionController.js` — the billing core. Contains `runFirstPaymentSettlement`, `maybeQualifyReferral`, `maybeRecordCouponRedemption`, the 5 payment-confirmation handlers, `initiateAddonPurchase`, the upgrade (`pendingPlanChange`) branch, `getOrgReferralCode`, `getMyReferralOverview`, `applyReferralCode`, `sendReferralEmail`.
- `controllers/referralAdminController.js` — Super Admin: `getReferralProgram`, `updateReferralProgram`, `getOrganizationReferralOverview`, `grantManualReward`, `revokeReward`.
- `controllers/authController.js` — `completeRegistration` (records referral intent for link-based codes), `generateInviteEmailHTML`, `generateReferralEmailHTML`.

**Frontend:**
- `main.jsx` — captures `?ref=CODE` into localStorage **before React mounts** (must be here; a component `useEffect` runs too late).
- `pages/Login.jsx` — sends `referralCode` in the create-org registration payload.
- `components/Navbar.jsx` — logout preserves `referralCode` across `localStorage.clear()`.
- `components/settings/SubscriptionPlans.jsx` — plan/upgrade/add-on checkout; carries `referralDiscountApplied` into checkout data.
- `components/subscription/CheckoutSummaryModal.jsx` — **upgrade** flow renders the referral discount breakdown + "🎉 you saved ₹X" banner.
- `components/settings/Referrals.jsx` — org-facing referral dashboard.
- `pages/PromotionsAndRewards.jsx` — Super Admin tabbed "Promotions & Rewards" (Coupons | Referral Program).
- `pages/ReferralProgramAdmin.jsx` + `services/referralAdminApi.js` — Super Admin referral tab.
- `pages/CouponManagement.jsx` + `services/couponApi.js` — coupons (works; do not touch its logic).

---

## 4. Referral lifecycle (as actually implemented)

```
Registration (link code captured in main.jsx) OR manual "Apply" on checkout
        │  recordReferralIntent()   ── the ONLY writer of Referral(pending)
        ▼
Referral: pending
        ▼
Referred org's FIRST payment confirmed  ──►  runFirstPaymentSettlement()  ──►  maybeQualifyReferral()
        ▼
Referral: qualified   +   TWO Rewards created (referrer AND referee)
        ▼
Reward: available
        │  reserveNextAvailableReward()  (at upgrade/add-on checkout initiation)
        ▼
RewardUsage: reserved  (30-min TTL; discount applied to the Razorpay Order amount)
        │
   ┌────┴─────────────────────────┐
   ▼ payment confirmed            ▼ 30 min pass / abandoned / superseded
consumeReservation()          releaseReservation() / releaseExpiredReservations()
   ▼                              ▼
RewardUsage: consumed         RewardUsage: released → Reward available again
```

**Two trigger points for `Referral(pending)`, both via the same `recordReferralIntent`:**
1. Link-based code → captured in `main.jsx`, sent at registration (`completeRegistration`).
2. Manually-typed code → `applyReferralCode` endpoint, applied immediately (not gated behind Subscribe/Start Trial).

Neither is gated by trial/payment status — pending visibility must never depend on payment decisions.

---

## 5. The big fix already made: settlement-race (DONE)

**Symptom:** a referred org paid (subscription active, `isPaymentConfirmed=true`)
but its referral stayed `pending` forever, no reward.

**Root cause (proven from DB, not guessed):** `maybeQualifyReferral` /
`maybeRecordCouponRedemption` were wired into only 3 of the 5 confirmation
paths. `handleSubscriptionActivated` and `handleSubscriptionCharged` flipped
`isPaymentConfirmed=true` **without** settling. For **UPI AutoPay**,
`subscription.charged` is the confirming event → it confirmed without
qualifying, and the later `verifyPayment` early-returned on
`if (isPaymentConfirmed) return;` → qualification never ran. Proven via the
org's `appStatusHistory` reason string `"subscription charged successfully"`
(written only by `handleSubscriptionCharged`).

**Fix:** one idempotent `runFirstPaymentSettlement(subscription)` wrapping both
settlement side-effects, called from **all 5 handlers** (both their confirming
path AND their "already confirmed" early-return) — 8 call sites. Idempotent, so
racing paths settle exactly once. Also repairs coupon redemption on the same
previously-missed paths.

**Deferred (§11b):** a fuller `confirmFirstPayment()` that also owns the
`isPaymentConfirmed`/status/date writes — needs a per-handler side-effect
inventory first (each handler does slightly different transport work).

---

## 6. Reward redemption — where it works and where it doesn't

- **Works (backend + reserve/apply/consume):** plan **upgrade** and **add-on purchase** (both one-time Razorpay Orders). Reserve-first → `applyModifiers` reduces the Order amount → discounted charge → `consumeReservation` on settlement.
- **UI surfacing:** the **upgrade** modal shows the discount breakdown + banner. The **add-on** modal does NOT (its discount is computed at confirm-time inside `initiateAddonPurchase`, after the summary renders — would need a preview endpoint wiring up the currently-unused `resolveModifiers`).
- **New-subscription checkout: intentionally NOT redeeming.** A Razorpay Subscription has one fixed recurring amount; you can't discount only the first invoice without Charge-at-Will (unconfirmed by Razorpay). This is the "Future Enhancement (Blocked by Razorpay)" in PROJECT_STATE.md — a deferred capability, not a bug.

**Same-flow reservation recycle (DONE):** re-opening an upgrade/add-on checkout
now releases that org's *own* prior orphaned reservation for the *same flow*
before reserving again (safe: the overwritten pending change's order can't
settle). Never crosses flows (upgrade vs add-on) → no double-spend.

---

## 7. `ReferralProgram` config — enforced vs stored-only

**Enforced (these work):** `enabled`, `rewardType`, `rewardValue`,
`maxRewardAmount` (caps discount in `pricingEngine`), `expiryDurationDays`,
`maxPendingReferrals`, `maxTotalReferrals`.

**Stored but NOT enforced (no code reads them — backlog §11d):**
`stacksWithCoupons` (coupon + referral currently always stack),
`honoredDuringTrial`, `minimumActiveDays`, and the model-only
`appliesTo` / `eligiblePlans` / `eligibleBillingCycles` / `minimumQualifyingPlan`.
The Super Admin UI greys these with a "not enforced yet" note.

---

## 8. ⚠️ Verified-LIVE vs code-traced-ONLY (critical honesty)

No live payment/DB integration test suite exists. Distinguish carefully:

**Proven against live DB state:**
- Registration → `Referral(pending)`; qualification → rewards (org "neww" qualified, both rewards issued after a backfill).
- Reward **reserve + discount**: an org held a reward → upgrade reserved it → Order charged the discounted amount (`referralRewardUsageId` set, `proratedDiffCharged` post-discount).
- Upgrade discount **surfacing** in the modal (real screenshot: ₹399 − ₹80 = ₹319 + GST = ₹376).

**NOT yet observed at runtime (verify these):**
- `consumeReservation` firing on a **completed** payment. No upgrade/add-on payment has ever completed while a reward was reserved (Razorpay **test-gateway timeouts** blocked every attempt). Wiring traced (`consumeReservation` at subscriptionController ~1658 upgrade-confirm / ~1887 — line numbers drift, grep the symbol). **This is the #1 thing to confirm end-to-end.**
- The settlement-race fix under a real UPI `subscription.charged` (only `node -c`'d).
- Same-flow reservation recycle (only `node -c`'d).

**Environment note:** `backend/.env` has live-ish Razorpay **test** keys
(`rzp_test`) and a MongoDB Atlas URI. Test-mode **UPI cannot complete**; use
the card `4111 1111 1111 1111` and click "Success" on the test 3DS page.

---

## 9. Known gaps / backlog (all deliberately deferred)

- Reward on **new-subscription** first invoice (Razorpay recurring limit) — Future Enhancement.
- Add-on checkout **discount preview** (wire `resolveModifiers` into a preview endpoint).
- `confirmFirstPayment()` consolidation (§11b).
- Enforce the unenforced `ReferralProgram` fields (§11d).
- Downgrade reconciliation (KNOWN_BILLING_GAPS Gap A) — `subscription.pendingUpdate` never reconciled; on hold for Razorpay Charge-at-Will.
- Scheduled cleanup job for expired reservations (housekeeping only — `releaseExpiredReservations` already runs inline on each reserve, so not correctness-critical).
- Super Admin **Overview** page: platform-wide coupon + referral analytics (deliberately NOT a tab on Promotions & Rewards).
- No automated concurrent-write / edge-case test suite yet.

---

## 10. The audit roadmap (do ONE subsystem at a time; approval before code)

Per subsystem: understand → document current behavior → identify gaps /
duplication / missing states / missing BillingEvents / UI inconsistencies →
propose → **wait for approval** → implement → verify → next. No speculative
rewrites, no new abstractions, no feature creep.

Suggested order: **Referral** (most context) → Coupons → Settlement/webhooks →
Add-ons/Seats → Upgrades/Downgrades/Proration → Trials → Billing Events audit →
Super Admin → Frontend state/UX → DB (indexes/integrity) → Performance →
Production readiness (security, race conditions, observability, recovery).

Deliverables the audit should produce (Phases from the brief):
1. Business-flow docs (happy/failure/retry/edge for every flow).
2. Explicit **state machines** (Subscription, Referral, Reward, RewardUsage, Coupon, CouponRedemption, PlanChange, AddonPurchase, Trial, Organization) with legal transitions.
3. **Event matrix** (event → who fires → side-effects → idempotent? retry? email? analytics? webhook?).
4. Endpoint / service / util inventory (purpose, business event, duplicates, merge candidates).
5. Duplicated-logic sweep (the `runFirstPaymentSettlement` consolidation is the template).
6. Edge-case matrix (target 200+ scenarios incl. duplicate/out-of-order webhooks, concurrency, retries).
7. Super Admin capability audit per entity (CRUD/disable/search/filter/analytics/audit/export).
8. Production-readiness review (high/med/low risk, security, race conditions, data integrity, observability, tests, docs).

---

## 11. Working rules for the next session

- Do **not** add features. Audit, document, refactor, verify, harden.
- Do **not** touch `CouponManagement` / coupon logic — it works and is out of scope unless the audit reaches coupons.
- Trace and **prove with code/DB**, don't summarize claims. Quote line references.
- Always state **verified-live vs code-traced-only** (see §8). Never claim "works" for something only `node -c`'d.
- No `localStorage.clear()` / destructive changes without preserving transient state (see the `referralCode` precedent in Navbar).
- One narrowly-scoped review at a time; finish a domain before the next.
```
