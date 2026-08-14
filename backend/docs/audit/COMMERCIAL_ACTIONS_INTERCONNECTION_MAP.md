# Commercial Actions Interconnection Map — Upgrade / Downgrade / Add-ons / Coupons / Referrals

> **Status:** analysis complete, no code changed. Companion to `FRONTEND_CONVERGENCE_PLAN.md`.
> Purpose: these five actions are *not* independent — they share one pricing engine, one modifier
> pipeline, one checkout surface, and overlapping state. Fixing any one in isolation is redundant
> and risks contradiction. This maps how they actually work today (backend + frontend), how the
> frozen spec says they should work, and the single set of interconnected changes required.
> Authorities: `BILLING_DOMAIN_SPECIFICATION.md` (V1.1 frozen), `CAW_BILLING_DESIGN.md` (tactical).

---

## 0. The shared spine (why these can't be fixed independently)

Every one of the five actions flows through the **same three shared mechanisms**:

1. **`calculateInvoice()`** (`utils/invoiceEngine.js` / `pricingEngine.js`) — the *only* pricing
   authority. Base subscription, proration, coupon discount, referral discount, GST all resolve
   here. One engine, many callers.
2. **The modifier pipeline** (`utils/modifierResolver.js` → `calculateInvoice`'s `resolvedModifiers`)
   — coupons and referrals are both just *modifiers* fed into the same engine. `PRIORITY = {coupon:
   10, referral: 20}` fixes their ordering. They are the same mechanism applied at different moments.
3. **The checkout surface** (`SubscriptionPlans.jsx` → `CheckoutSummaryModal` → `openRazorpay`) —
   trial-conversion, upgrade, and add-on purchase all historically returned `paymentDetails` and
   opened the same interactive Razorpay checkout modal.

Because they share this spine, a change to the modifier pipeline (e.g. making coupons apply to
upgrades) or to the checkout surface (e.g. mandate-charging instead of interactive checkout) touches
**all** of them at once. That is why this is one map, not five tickets.

---

## 1. Per-action implementation today (backend) vs frozen spec

### Upgrade (same-cycle tier upgrade)
- **Code:** `subscriptionController.js:840-1088`. Order-based proration via `calculateInvoice`
  (`type:'plan_upgrade'`), `CommercialTransaction{type:UPGRADE}` VOID-then-create,
  referral reward reserved (`reserveNextAvailableReward` → `rewardToModifier`), coupon **not**
  applied. Stores `pendingPlanChange`. Returns `paymentDetails` → **interactive checkout**.
  Committed on `verifyPayment`/webhook.
- **Frozen spec:** `CAW_BILLING_DESIGN.md:214-221` — "Create Order (prorationAmount); **Charge
  Mandate**" → commit on `payment.captured`. **The spec decided mandate-charge, not interactive
  checkout.**
- **Gap:** ❌ still interactive checkout (legacy pattern), not a mandate charge. Same class of gap
  as the trial-conversion finding — see §3.

### Downgrade (tier down / same-tier cycle change, non-UPI)
- **Code:** `subscriptionController.js:1390-1660`. No charge. Writes `pendingUpdate` (legacy,
  authoritative) **and** `ScheduledChange{PLAN_CHANGE|BILLING_CYCLE_CHANGE}` (additive, per Phase 4A)
  **and** `CommercialTransaction{DOWNGRADE}` (CREATED→PRICED→COMMITTED→COMPLETED, no AWAITING_PAYMENT).
  `razorpay.subscriptions.update(schedule_change_at:cycle_end)` for legacy subs (no-op/UPI-skip).
  Returns `scheduled:true`.
- **Frozen spec:** `CAW_BILLING_DESIGN.md:223+` — "never charge; schedule only." Future intent lives
  in `ScheduledChange` (Ownership Law 5). ✅ mechanism correct.
- **Gap:** ⚠️ **triple-write** (`pendingUpdate` + `ScheduledChange` + Razorpay update). Per
  Ownership Law 5 the canonical future-intent store is `ScheduledChange` alone; `pendingUpdate` is a
  legacy `pending*` field the spec says shouldn't exist. Renewal Engine reads `ScheduledChange`
  (`renewalEngine.js:409`), so `pendingUpdate` is legacy dead-weight for CAW subs. Also
  `razorpay.subscriptions.update` is a dead legacy call for CAW (no Razorpay Subscription object).

### Add-on purchase (mid-cycle add)
- **Code:** `utils/addonPurchaseLifecycle.js` (`startAddonPurchase`). Order-based proration,
  `CommercialTransaction{ADDON_PURCHASE}`, referral reward reserved, `pendingAddonAddition` stored.
  Returns `paymentDetails` → **interactive checkout**. Guard: one pending add-on at a time.
- **Frozen spec:** same as Upgrade — "Charge Mandate."
- **Gap:** ❌ interactive checkout, not mandate charge. Same class as Upgrade.

### Add-on removal / quantity decrease
- **Code:** `scheduleAddonRemovalEndpoint` → `ScheduledChange{REMOVE_ADDON}` (+ legacy
  `pendingAddonRemovals[]`). No charge. Effective at cycle end.
- **Frozen spec:** Ch.16 — components never store `PENDING_REMOVAL`; a live `ScheduledChange` is the
  only representation. ✅ mechanism correct.
- **Gap:** ⚠️ same dual-write pattern as downgrade (`pendingAddonRemovals[]` legacy + `ScheduledChange`).

### Coupons
- **Code:** `utils/discountEngine.js`. Line-item, per-product rules (`{productType, productKey,
  discountType, discountValue}`). `validateAndPriceCoupon` at checkout; `recordRedemption` on
  payment success. Stored as recurring `subscription.appliedCoupon`.
- **Wired ONLY at:** new-subscription / trial-conversion (`couponAppliesAtCheckout =
  !subscription?.subscription || !isPaidSub` — `SubscriptionPlans.jsx:183`). **Explicitly NOT applied
  to upgrades or add-on purchases** (those paths never pass `couponCode`).
- **Frozen spec:** Coupon is a Policy Object (Ch.17), re-resolved live every charge
  (`CAW_BILLING_DESIGN.md` coupon note). A recurring coupon should discount **every** renewal.
- **Gap:** ⚠️ coupon is stored as a recurring discount but only ever *applied* at acquisition; whether
  it re-applies at renewal depends on the Renewal Engine reading `appliedCoupon` as a modifier — needs
  verification that `renewalEngine.js` feeds `appliedCoupon` into `calculateInvoice`.

### Referrals / Rewards
- **Code:** `utils/referralRewards.js` (reserve/consume/release), `modifierResolver.rewardToModifier`.
  Reward atomically **reserved** at upgrade/add-on checkout, applied as a `referral` modifier through
  `calculateInvoice`, **consumed** on payment success, **released** on abandonment. Manual
  `applyReferralCode` creates a `Referral{pending}`.
- **Wired at:** upgrade + add-on purchase (one-time proration discounts). **NOT** at base
  subscription creation (referral intent deliberately not recorded there — `createSubscription`
  comment).
- **Frozen spec:** Reward belongs to Organization, `Reserved→Consumed/Released` (Ch.20). ✅ mechanism
  correct and matches the spec well.
- **Interconnection:** coupons discount the **recurring base** (acquisition); referrals discount
  **one-time upgrade/add-on** charges. Both ride the identical `calculateInvoice` modifier pipeline,
  coupon-before-referral by `PRIORITY`, but they fire at opposite moments in the lifecycle.

---

## 2. The frontend surface (how each is shown today)

| Action | Entry (frontend) | Handler | Reads / Shows |
|---|---|---|---|
| Upgrade | `PlanCard` "Upgrade" button | `handlePlanSelection` → tier-upgrade branch → `updateSubscription` | `resp.paymentDetails` → `openRazorpay`; proration in `CheckoutSummaryModal` |
| Downgrade | `PlanCard` "Downgrade" | `handlePlanSelection` → `plan_downgrade` modal → `updateSubscription` | `scheduled:true` message; scheduled target shown via `isScheduledTarget` |
| Add-on add | plan card add-on selector → `handleConfirmCheckout` `addon_change` | `initiateAddonPurchase` | `paymentDetails` → `openRazorpay` |
| Add-on remove | add-on × button | `scheduleAddonRemoval` | effective-date message |
| Coupon | "Have a coupon code?" Apply | `validateCoupon`/`previewCoupon` | per-plan/add-on discounted prices; `appliedCoupon` badge |
| Referral | "Have a referral code?" Apply | `applyReferralCode` (immediate) | `getReferralOverview` → `referralApplied` badge |

**Frontend independent-derivation bugs found (same class as `FRONTEND_CONVERGENCE_PLAN.md`):**
- `CurrentSubscriptionInfo.jsx:44` branches on raw `subscription?.isTrialActive`.
- `PlanCard.jsx:40-45` `isPendingPayment()` derives from `paymentStatus`/`isPaymentConfirmed` itself.
- Coupon gating (`couponAppliesAtCheckout`) is a frontend-derived rule, not a backend-provided flag —
  the frontend independently decides coupons don't apply to paid subs. This is business logic living
  in React (violates the prime directive), and it exists *because* the backend upgrade/add-on paths
  don't accept a coupon. Fixing the backend to accept coupons on upgrades would make this frontend
  rule wrong — an interconnection that must move together.

---

## 3. The single biggest interconnected gap: upgrade + add-on still use interactive checkout

Trial-conversion was migrated (Phase 4D-5) from interactive checkout → Registration Link. But
**upgrade and add-on purchase still return `paymentDetails` and open the interactive Razorpay
checkout modal** — the exact legacy pattern the spec replaced. Per `CAW_BILLING_DESIGN.md:214-221`,
both should instead **charge the confirmed mandate** (`razorpayChargeMandate.js`, already built and
used by the Renewal Engine) and commit on `payment.captured`. This is the same finding as the
trial-conversion 401, one layer over: legacy interactive payment where CAW mandate-charge is
specified.

**Why this is interconnected, not three separate fixes:**
- The mandate-charge path (`razorpayChargeMandate.js`) already exists and is proven (Renewal Engine).
- Upgrade, add-on, and seat-increase all share the `paymentDetails → openRazorpay` frontend surface.
- Migrating them means: backend charges mandate → returns success (not `paymentDetails`) → frontend
  shows a result, no checkout modal. That deletes an entire frontend interaction path shared across
  three actions at once.
- It also unblocks coupons-on-upgrades and referrals-on-anything, because once the charge is a
  mandate charge priced by `calculateInvoice`, the modifier pipeline is already right there.

---

## 4. The coordinated change set (what must move together)

Ordered so no intermediate state contradicts:

1. **Frontend canonical state first** (`FRONTEND_CONVERGENCE_PLAN.md` Journey 1) — `deriveSubscriptionUIState`,
   kill legacy-field reads. Prerequisite: every action's button/label must read canonical state.
2. **Downgrade / add-on-removal: retire the legacy `pendingUpdate`/`pendingAddonRemovals` dual-write**
   once confirmed the Renewal Engine + UI read `ScheduledChange` exclusively (Ownership Law 5).
   Backend-only; report before removing.
3. **Upgrade + Add-on purchase: migrate interactive-checkout → mandate charge** (§3). Biggest item;
   backend charges mandate via `razorpayChargeMandate`, commits on webhook; frontend drops
   `openRazorpay` for these two. This is a `CAW_BILLING_DESIGN`-decided behavior, so it's
   implementation of a frozen decision, not a new business rule.
4. **Coupons-on-upgrades/add-ons + the `couponAppliesAtCheckout` frontend rule** move together with
   #3 — once upgrade/add-on price through the same modifier pipeline, the frontend's "coupons don't
   apply to paid subs" rule is removed and the backend accepts `couponCode` on those paths.
5. **Verify recurring coupon re-application at renewal** — confirm `renewalEngine.js` feeds
   `subscription.appliedCoupon` into `calculateInvoice` so a recurring coupon actually recurs. Report
   if it doesn't (would be a V1.1 Change Proposal, not a silent fix).

**Report-don't-compensate items (backend gaps, not frontend workarounds):** #3 (mandate charge), #5
(recurring coupon), and the downgrade triple-write are backend/spec-alignment items. None should be
papered over in React. Per the operating manual, each is raised explicitly; the frontend only ever
renders canonical state.
