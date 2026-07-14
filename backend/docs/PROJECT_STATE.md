# Billing System — Project State

*Read this to resume work on billing — it replaces re-reading prior chat
history. If you're new to the project rather than resuming, read
`ARCHITECTURE.md` first instead — it explains why the system is shaped the
way it is; this file is implementation status only: what's built, what's
frozen, what's next. Last updated after the referral system implementation
pass (§11) — the first feature built after the freeze in §1, by explicit
decision, not a reversal of that freeze for anything else.*

---

## 1. Architecture, as it exists today

**One `Subscription` document per organization.** Plan, add-ons, billing
dates, coupon, seats — everything hangs off this one doc. `status` is raw
Razorpay vocabulary; `appStatus` (`trial|active|past_due|cancelled|expired|suspended`)
is the field all access-control logic should read.

**Two Razorpay primitives are used, for different reasons:**
- **Subscriptions** (fixed-price recurring Plans, cached in `RazorpayPriceCache`)
  — drives the actual recurring bill.
- **Orders** — one-time, UPI-compatible charges for anything prorated
  mid-cycle (upgrades, add-on purchases).

**⚠️ This split is under threat.** Razorpay support (ticket **#19691335**)
told us their Subscriptions product assumes a **fixed recurring amount** —
"if the amount needs to change, create a new plan and a new subscription."
They recommend **Charge at Will** (merchant-initiated variable-amount
recurring debits) for businesses like this one. We are waiting on Razorpay's
technical documentation before deciding whether to migrate. **Until that
decision lands, do not add reconciliation logic to the renewal webhook path**
(`handleSubscriptionCharged` in `backend/controllers/subscriptionController.js`)
— it may be redesigned entirely if the migration happens.

**Confirmed directly (not just support guidance):** a live
`subscriptions.update()` call returned `"subscriptions cannot be updated
when payment mode is upi"` — full detail in `KNOWN_BILLING_GAPS.md`. This
narrows the constraint to **UPI AutoPay subscriptions specifically**; it's
unconfirmed whether card-based subscriptions hit the same wall. If they
don't, the eventual fix might be payment-mode-conditional rather than a
full Charge-at-Will migration — worth checking before assuming the
constraint is total. Either way, nothing changes about what's frozen today:
every `subscriptions.update()` call in the codebase already treats this
failure as expected and recoverable (best-effort, syncs at next renewal via
`needsRazorpaySync`) — that pattern was already correct before this
confirmation, just now has a verified reason instead of an inferred one.

---

## 2. What's finished and working

| Flow | State |
|---|---|
| New subscription (incl. trial→paid conversion) | ✅ Full trace confirmed, both entry points wired |
| Upgrade | ✅ Order-based, UPI-compatible, reconciles correctly on webhook |
| Downgrade — **scheduling** | ✅ `pendingUpdate` written correctly, Razorpay plan switched |
| Downgrade — **applying** | ❌ **Broken, paused.** See §4. |
| Add-on purchase | ✅ Order + proration + webhook, mirrors upgrade |
| Add-on removal — scheduling | ✅ |
| Add-on removal — applying | ✅ (`applyScheduledAddonRemovals`, runs inside the same paused webhook function but this part *is* correctly wired) |
| Seats (invite-time purchase) | ✅ Migrated onto the generic add-on engine (Order + proration + webhook settlement) — see §4.B |
| Cancellation | ✅ Two-phase (schedule via org action, finalize via cron), cleanest flow in the system |
| Coupons — new subscription | ✅ Product-level rules, line-item discounting, immutable snapshot on `Subscription.appliedCoupon` |
| Coupons — upgrade/downgrade/add-on purchase | ❌ Not wired yet (by design, not a bug — needs a semantics decision, see §5) |
| GST | ❌ **Correction — previously documented wrong.** No backend `pricingSnapshot.js` exists (only the frontend has one). GST is hardcoded as `0.18`/`1.18` independently in 4 backend call sites — see §9 |
| Payment status reconciliation | ✅ Fixed this pass — `SubscriptionPayment.status` now reconciles to `captured` regardless of whether the webhook or client `verifyPayment` confirms first; the race where no payment row was ever created is also closed |
| BillingEvent timeline | ✅ 11 of 13 event types emit correctly (see §3) |
| Billing Center UI | ✅ Sidebar (state) + unified right-column card (Timeline/Payments/Invoices/Billing Info), collapsible history, git-log-style compact timeline |

---

## 3. BillingEvent — the audit trail

`backend/models/BillingEvent.js` — immutable, append-only. Each event freezes
its own `beforeSnapshot`/`afterSnapshot` (plan, add-ons, coupon, total) at
write time, plus a `summary` (title/subtitle/amountChange/detail) computed
**once**, in `backend/utils/billingEvents.js` (`buildEventSummary`). The
Timeline UI renders `summary` directly — it never infers "what changed" from
raw snapshots itself.

**Emitting correctly:** `SUBSCRIPTION_CREATED` (both entry points),
`TRIAL_STARTED`, `TRIAL_ENDED`, `DOWNGRADE_SCHEDULED`,
`BILLING_CYCLE_CHANGE_SCHEDULED`, `PLAN_UPGRADE`, `ADDON_ADDED`,
`ADDON_REMOVAL_SCHEDULED`, `RENEWAL`, `PAYMENT_FAILED`,
`SUBSCRIPTION_CANCELLED` (both phases).

**Not emitting:** `PLAN_DOWNGRADE`, `ADDON_REMOVED` — both would need to live
inside `handleSubscriptionCharged`, which is frozen (§1, §4).

**Fixed a display bug this pass:** `prettyPlan()` only capitalized the first
letter, so add-on keys rendered as "Extra_seat" instead of "Extra Seat".
Added `prettyKey()` (proper snake_case → Title Case) for anything that's an
add-on/product key, not a plan name. Already-emitted events keep their frozen
(wrong) text — by design, snapshots are immutable — only new events are
correct.

---

## 4. Known gaps — intentionally NOT fixed, documented not patched

Full detail in `backend/docs/KNOWN_BILLING_GAPS.md`. Summary:

**A. Scheduled downgrade is never reconciled into the database.**
`pendingUpdate` is set at schedule time; the only code that ever reads it
(`handleSubscriptionCancelled`) only fires on Razorpay's `subscription.cancelled`
webhook — which a downgrade never triggers. `handleSubscriptionCharged` (the
function that *does* fire on renewal) never checks `pendingUpdate`. Razorpay
charges the correct new amount; the database keeps showing the old plan
forever, and feature-gating stays wrong. **Paused pending the Charge at Will
decision** — the exact fix is written out in `KNOWN_BILLING_GAPS.md`, ready to
implement once the architecture question is settled.

**B. Seats — MIGRATED (first canonical-architecture refactor, done).**
Previously a third, legacy implementation: `adjustSeats → adjustAddonQuantity`
mutated `activeAddons` synchronously (`schedule_change_at: 'now'`, no
proration, no Order, no `SubscriptionPayment`, no `BillingEvent`) — a second,
uncoordinated writer alongside the generic add-on engine.

Tracing the actual live call path (not just the routes) turned up that the
*real* seat-purchase entry point wasn't `/subscription/addons/seats` at all —
that endpoint was never called by the frontend. The live path was
`authController.inviteUser`'s "no free seat" branch, which auto-charged the
saved card via `addExtraSeat`. The frontend already had checkout-popup code
expecting a `402` + `paymentDetails` response and a confirm step — the
backend had just never been wired to it.

**Fixed:** `inviteUser` now creates a Razorpay Order for one `extra_seat`
unit (via `calculateAddonProration`, mirroring `initiateAddonPurchase`) and
returns `402` with `paymentDetails`. The `Invited` doc is created immediately
with `pendingPayment: true` + `pendingSeatOrderId` (intent, not settlement).
Settlement is the existing `handlePaymentCaptured` add-on-purchase branch —
extended to also finalize the matching pending invite (flip
`pendingPayment`, send the email) when `pending.addonKey === 'extra_seat'`.
Registration (`/auth/login-or-register` invite-by-email path) now rejects
joining on a `pendingPayment: true` invite instead of assuming any invite
row means seats were already validated. `POST /subscription/addons/seats`
(`adjustSeats`) now returns `410`; `adjustAddonQuantity`/`addExtraSeat`/
`removeExtraSeat` deleted from `addonManagement.js` — nothing calls them.
`activeAddons` now has one fewer independent writer — see §5b for the
current count.

Not yet done: no expiry/cleanup for an org that opens a seat-purchase Order
and never completes payment — `pendingAddonAddition.orderId` and the
matching `Invited.pendingPayment` row both stay stuck, blocking further
invites, until someone pays or an admin revokes the invite manually. This is
the same pre-existing gap the generic add-on-purchase flow already has
(§4 doesn't call this out separately because it was already implied) — not
introduced by this migration, but now shared by seats too.

**C. No subscription invoice model exists.** The `Invoice` model is the CRM's
unrelated customer-invoicing feature (HSN codes, GSTIN, signatures). The
Billing Center's "Invoices" section is payment records + client-side
on-demand PDF generation (`jsPDF`), not real stored/numbered invoices.

**D. No revenue aggregation exists anywhere** (org-level or platform-level).

**E. Coupons don't apply to upgrade/downgrade/add-on-purchase checkout.**
Only new-subscription and trial-conversion apply a coupon. Extending this
needs one business decision first (§5).

**F. `BillingEvent` snapshots don't capture `pendingAddonRemovals`**, so a
scheduled-removal event's before/after look identical even though the
schedule itself is a real state change (cosmetic, not incorrect).

---

## 5. Open decisions (need a human call, not more code)

1. **Charge at Will migration** — waiting on Razorpay's technical docs
   (ticket #19691335). This gates all renewal-webhook work.
2. **Coupon-on-upgrade semantics** — when a paid subscriber with an existing
   coupon upgrades/downgrades and enters a *new* coupon, should the new
   discount apply to the recurring amount going forward (re-baked into the
   Razorpay plan, consistent with how coupons work at signup), or only to the
   one-time prorated charge? Leaning toward "recurring + one-time" for
   consistency, not yet confirmed.
3. ~~Seat migration timing~~ — resolved: done independently of Charge at
   Will (§4.B), since it doesn't touch the renewal-reconciliation code path.

---

## 5b. State machine — current implementation mapping

`ARCHITECTURE.md` §3 defines the 14-row state machine in role terms
("settlement owner (role)", no function names). This table is the concrete
mapping: which function plays each role *today*, and whether that mapping
currently satisfies invariant #2 (exactly one owner). This table is
implementation status — expect it to change as flows get refactored;
`ARCHITECTURE.md`'s table should not need to change alongside it.

| Row | Settlement owner (role) | Actual function today | Status |
|---|---|---|---|
| 1 | Trial-start handler | `startFreeTrial` | ✅ |
| 2 | Payment-confirmation handler | 3 racing confirmers: `verifyPayment`, `handleSubscriptionAuthenticated`, `handlePaymentCaptured` | ⚠ works, but 3-way race is fragile — see below |
| 3 | Payment-confirmation handler | same 3 as row 2 | ⚠ same caveat |
| 4 | Upgrade-initiation handler | `updateSubscription` (Order-based branch) | ✅ *(a second, legacy UPI branch at `subscriptionController.js:713-778` bypasses this entirely — ✕ duplicate implementation)* |
| 5 | Upgrade-settlement handler | `handlePaymentCaptured` plan-upgrade branch | ✅ |
| 6 | Downgrade-initiation handler | `updateSubscription` (writes `pendingUpdate`) | ✅ |
| 7 | Renewal-settlement handler | `handleSubscriptionCharged` — **does not read `pendingUpdate` at all** | ✕ **broken.** Razorpay charges the new plan correctly; Mongo never updates. **Frozen pending Charge-at-Will** (Known Gap A, `KNOWN_BILLING_GAPS.md`). A second function, `handleSubscriptionCancelled`, *does* act on `pendingUpdate` — but by creating a brand-new `Subscription` doc, inconsistent with row 7's intended owner. |
| 8 | Add-on-initiation handler | `initiateAddonPurchase` | ✅ |
| 9 | Add-on-purchase-settlement handler | `handlePaymentCaptured` add-on-purchase branch | ✅ — also now the settlement point for invite-time seat purchases (§4.B) |
| 10 | Add-on-removal-initiation handler | `scheduleAddonRemoval` | ✅ |
| 11 | Renewal-settlement handler | `applyScheduledAddonRemovals`, called from `handleSubscriptionCharged` | ✅ mutation is correct, but emits no event (should be "Add-on removed" — gap, §4.F) |
| 12 | Cancellation-initiation handler | `cancelSubscription` | ✅ |
| 13 | Cancellation-finalization handler | **two owners racing:** `handleSubscriptionCancelled` (webhook) and `subscriptionLifecycleJobs` Job 3 (cron) | ✕ whichever wins silently prevents the other's event from firing |
| 14 | Renewal-settlement handler (failure path) | `handleSubscriptionCharged` failure branch | ✅ |

**Duplicate-writer audit** (invariant #7) — `activeAddons` had 5 independent
writers before the seat migration; now 4: add-on-purchase settlement,
add-on-removal settlement, plan-upgrade settlement (rebuilds wholesale from
a stale `pendingPlanChange` snapshot — can still clobber a concurrent add-on
purchase), and `updateSubscription`'s unconfirmed branch. `totalAmount`/
`pricePerUser`/`planName` are independently recomputed in 5 places — exactly
what `ARCHITECTURE.md` §4's Pricing Snapshot would fix. `pendingAddonRemovals`
has 3 writers (scheduling itself, the downgrade branch, the upgrade-confirm
branch), no shared helper.

**Correction to a previous pass's claim:** this doc used to say GST was
"already centralized in `utils/pricingSnapshot.js`" on the backend. **That
file does not exist on the backend** — only `frontend/src/utils/pricingSnapshot.js`
does. Verified by direct search: the backend hardcodes `0.18`/`1.18`
independently in 4 places, with no shared constant anywhere. Full detail and
the pricing engine design grounded in this reality: §9.

**Dead code:** `handlePaymentCaptured`'s `pendingUpgrade` branch
(`subscriptionController.js:1279-1389`) references a schema field nothing
currently writes — current upgrades use `pendingPlanChange`. Confirm via
`git blame` before deleting.

**First refactor target (done, see §4.B below):** seats migrated onto the
generic add-on engine — the highest-value, lowest-risk first move, since it
was provider-independent, isolated, and didn't touch renewal settlement.

**Next likely target once Charge-at-Will resolves:** row 13's cancellation
race — pick one owner (webhook or cron), demote the other to a watchdog. It
doesn't depend on the Charge-at-Will answer either, but is being sequenced
after it purely to keep one thing in flight at a time.

---

## 6. Recommended next steps (in order)

The direction agreed across sessions, in case a new conversation needs to
re-derive it:

1. ✅ **Stop building features.** No referrals, no new invoice pipeline, no
   further UI work, until billing is a "predictable machine." Still in force.
2. ✅ **Canonical architecture pass** (diagrams, no code) — done, see §5b.
3. ✅ **Seat migration** — done, see §4.B.
4. ✅ **Billing state machine + pricing engine design** — done, both in
   `ARCHITECTURE.md`.
5. ✅ **Frontend audit + cleanup** — stale-closure bug fixed, shared
   `waitForSettlement()` helper, seat-status/plan-catalog fetches
   consolidated, one of two frontend GST duplicates removed. See §7.
6. ✅ **Pricing engine implementation** — done, see §9. All 5 backend
   call sites that hand-rolled `basePrice + addonsTotal − discount` now call
   `buildPricingSnapshot`; 3 of 4 hardcoded GST copies collapsed into
   `computeGST()`.
7. **⏸ Waiting on Razorpay's Charge-at-Will guidance** (ticket #19691335)
   for anything that touches `handleSubscriptionCharged` / the renewal
   settlement seam — that means downgrade reconciliation (row 7) and
   renewal reconciliation stay frozen until then, since the correct fix may
   change entirely if the migration happens.
8. **Not gated by Charge-at-Will, not started yet:** the cancellation-
   finalizer race (row 13, two owners) — self-contained "pick one owner"
   fix, same shape as the seat migration. Likely next candidate whenever
   code work resumes. Also not gated: the frontend's remaining rule #2/#4
   items (§7 — `BillingHistory.jsx`'s API bypass needs a decision;
   `planPriority` needs a backend `PlanConfig.tier` field before it can be
   removed; frontend GST could now consume a backend-provided snapshot
   instead of computing it locally, per §9's "Consumers" note).
   Coupons-on-upgrade, invoices, and referrals stay out of scope regardless
   — those are new features, not stabilization, and §1 still applies.
9. ✅ **Referral system — backend implemented**, see §11. Explicit
   exception to §1's freeze, by direct instruction, scoped to referrals
   only — the freeze still applies to invoices, Timeline UI polish, and
   everything else in this list.
10. **Still not started:** real invoices, Timeline UI polish beyond what
    referrals needed. §1 still applies to these.

---

## 7. Frontend billing UI — current status against `ARCHITECTURE.md` §8

Scope: `SubscriptionContext.jsx`, `BillingCenter.jsx` + siblings
(`BillingSidebar`, `BillingTimeline`, `BillingHistory`), `SubscriptionPlans.jsx`,
`UserManagement.jsx`'s invite/seat-purchase flow, `subscriptionApi.js`,
`useRazorpay.js`. Not yet audited: `CheckoutSummaryModal.jsx`, `PlanCard.jsx`
(referenced by `SubscriptionPlans.jsx` but not opened this pass).

**🔴 Fixed — real bug, not just an architecture smell.** Both of
`SubscriptionPlans.jsx`'s polling loops (plan create/update, and add-on
purchase) used to read `subscription` from the closure captured when the
poll started, never observing their own `fetchSubscription()` updates — so
the "payment confirmed" branch was effectively unreachable and every
successful payment ran the full timeout before falling through to "taking
longer than expected." Root-caused to state (not intervals) needing to be
the thing distrusted: fixed by adding a shared
`frontend/src/utils/waitForSettlement.js` helper whose `fetchLatest`
contract returns the freshly-fetched value directly rather than reading
component/context state, making the bug structurally impossible to
reintroduce. `SubscriptionContext.fetchSubscription` now returns the fetched
data (previously void) so callers have a live value to check. All three
checkout flows (plan create/update, add-on purchase, seat purchase) now call
this one helper instead of three separate hand-rolled polling loops — rule
#1's "3 flows, 3 implementations" finding is resolved. The plan create/update
flow still calls `subscriptionAPI.verifyPayment(...)` first (a client
confirm call) before falling back to the shared poll — left in place rather
than removed, since it also records coupon redemption client-side
(`maybeRecordCouponRedemption`, see backend §3) and removing it is a
separate decision, not a polling fix.

**Rule #2 (one resource, one fetch path) — 2 of 3 violations fixed:**
- **Fixed:** seat status now lives in `SubscriptionContext`
  (`seatStatus`/`fetchSeatStatus`, auto-fetched when
  `subscription.isPaymentConfirmed` flips true). `BillingSidebar.jsx` and
  `UserManagement.jsx` both consume it from context instead of each
  independently hitting the endpoint with two different call conventions.
  `UserManagement.jsx` also calls `fetchSeatStatus()` right after a seat
  purchase settles, so the seat count updates without a manual refresh.
- **Fixed:** `SubscriptionPlans.jsx`'s second, independent plan-catalog fetch
  (`apiPlans`) removed — confirmed it was calling the exact same
  `subscriptionAPI.getPlans()` `SubscriptionContext.fetchPlans()` already
  calls, same shape, no actual reason for a second copy (the "differently
  shaped" comment didn't hold up). Now reads `plans` from context directly.
- **Not fixed, needs a decision first:** `BillingHistory.jsx` still bypasses
  both `subscriptionApi.js` and the shared `api.js` axios instance, hitting
  a super-admin org-scoped payments endpoint with a hand-rolled `axios` call
  and manual `localStorage` token read. Still unconfirmed whether this is
  genuinely different data from `getPaymentHistory` (super-admin view vs.
  the calling org's own payments) or a true duplicate — don't touch until
  that's confirmed, since collapsing two genuinely-different endpoints into
  one would be a real regression, not a cleanup.

**Rule #3 (client pricing math must be visibly provisional) — not touched
this pass.** Still true as previously audited: `SubscriptionPlans.jsx`'s
pre-checkout estimates and its backend-confirmed post-initiation numbers
render identically, with no visual distinction between "preview" and
"settled." Left as a follow-up — it's a UI-polish fix, not a correctness or
duplication one, lower priority than the items above.

**Rule #4 (no duplicated business constants) — 1 of 2 violations fixed, and
worse than previously counted:**
- **Fixed:** `BillingHistory.jsx` no longer hardcodes `payment.amount / 1.18`
  inline — it now imports and uses `GST_RATE` from
  `frontend/src/utils/pricingSnapshot.js`, the same constant
  `BillingSidebar.jsx` already used.
- **Newly found, not fixed:** `CheckoutSummaryModal.jsx` — explicitly listed
  as "not yet audited" in the original frontend pass — hardcodes `* 0.18`
  **six separate times** (lines 41, 432, 467, 469, 500, 506), none importing
  `GST_RATE`. So the frontend actually has **7 independent GST copies**
  before this pass (2 fixed down to 1, plus these 6 newly found), not the 2
  originally counted. `PlanCard.jsx` is still unaudited and may have more —
  flagging it as the next place to check before treating this list as
  complete.
- **Not fixed, needs a backend schema change first:** the hardcoded
  `planPriority = { starter: 1, growth: 2, business: 3 }` map in
  `SubscriptionPlans.jsx` (used to classify a plan change as
  upgrade-vs-downgrade) can't be removed by a frontend-only fix — checked
  `backend/models/PlanConfig.js` and confirmed **the backend has no tier/
  ordering field on plans at all**, so there's nothing yet for the frontend
  to read instead. The real fix is adding an explicit ordering field (e.g.
  `tier: Number`) to `PlanConfig`, backfilling it for existing plans, and
  exposing it through `getPlans()` — a backend schema change + data
  migration, not a frontend refactor, and riskier to do blind without
  verifying it against the live plan data first. Left as-is; still a real
  drift risk if a plan tier is ever added or reordered without updating this
  map by hand.

**Other frontend-only findings (unchanged, not covered by the four rules
directly):**
- `isAdmin` gating (`SubscriptionPlans.jsx`) reads role off `localStorage`
  — a client-side-only UI gate; presumably backed by real server-side
  enforcement elsewhere, not verified this pass.
- `couponAppliesAtCheckout` is a frontend-invented policy that happens to
  match the backend's real limitation (§4.E) today; would silently go stale
  if that backend gap is fixed for one flow without the frontend being
  updated to match.

**Finding taxonomy, updated:** the stale-closure poll bug (fixed) was a
live correctness bug, not architecture; the three duplicate poll
implementations (fixed) and the duplicate plan-catalog/seat-status fetches
(fixed) were ✕ duplicate implementations; the `BillingHistory.jsx` API
bypass and the `planPriority` map remain ✕ duplicate implementations,
explicitly not fixed pending a decision (former) or a backend change
(latter) — not ⚠ deferred-by-architecture-decision in the Charge-at-Will
sense, just sequenced after this pass.

---

## 8. Where things live (for a fresh read)

- `backend/models/Subscription.js` — the one source of truth per org
- `backend/models/BillingEvent.js`, `backend/utils/billingEvents.js` — audit trail
- `backend/models/Coupon.js`, `backend/models/CouponRedemption.js`,
  `backend/utils/discountEngine.js` — coupon/discount engine (generic,
  product-rule-based, reusable for future referrals/credits)
- `backend/utils/addonManagement.js` — add-on catalog logic + `getSeatStatus`
  (seats are now just the `extra_seat` add-on, no separate write path)
- `backend/controllers/subscriptionController.js` — everything else (large; the
  webhook handlers are at the bottom, `handleSubscriptionCharged` is the frozen one)
- `backend/jobs/subscriptionLifecycleJobs.js` — cron jobs (trial expiry, cancellation finalization) — NOT frozen, these are independent of the Razorpay renewal-webhook question
- `frontend/src/components/settings/BillingCenter.jsx` and siblings
  (`BillingSidebar`, `BillingTimeline`, `BillingHistory`) — the Billing Center UI
- `frontend/src/contexts/SubscriptionContext.jsx` — the one shared subscription
  store; `frontend/src/components/settings/SubscriptionPlans.jsx` — plan
  change / add-on purchase checkout; `frontend/src/pages/UserManagement.jsx` —
  invite + seat-purchase checkout; `frontend/src/services/subscriptionApi.js` —
  API client (not always used — see §7's rule #2 bypasses)
- `backend/docs/KNOWN_BILLING_GAPS.md` — full detail on Gap A (downgrade reconciliation)
- `backend/docs/PRICING_MODIFIER_ARCHITECTURE.md` — the generic modifier/
  resolver abstraction coupons and (once built) referral rewards both
  implement; not yet built
- `backend/docs/REFERRAL_SYSTEM_DESIGN.md` — full architecture-first design
  for the (not yet built, still frozen per §1) referral system, as the
  first consumer of the above
- `backend/docs/ARCHITECTURE.md` — the timeless rules: invariants, the
  system-flow diagram, the state machine in role terms, the pricing-engine
  design, the frontend rules (§8), the finding taxonomy, and the target
  layering. Read this *before* this file if you're new — it explains why,
  this file explains what/when. The concrete role→function mapping and
  current violations audit (backend §5b, frontend §7) live here, not there.

---

## 9. Pricing engine — ✅ implemented

Originally a design-only section; now built. `backend/utils/pricingEngine.js`
exports `GST_RATE`, `computeGST(amount)`, and
`buildPricingSnapshot({ plan, billingCycle, activeAddons, couponDiscount, basePriceOverride })` —
a pure function (no I/O, no payment-provider calls), matching the design
below exactly. Verified with a standalone arithmetic test (base 3000 +
2×200 addons − 500 coupon = 2900 totalAmount, 522 GST, 3422 grandTotal — all
correct) since the full checkout flow needs live Razorpay credentials to
exercise end-to-end, which weren't available to test against directly.

**Corrected a false claim from an earlier pass of this doc** while grounding
this design: GST was documented as "already centralized in
`utils/pricingSnapshot.js`" on the backend. That file does not exist on the
backend — only `frontend/src/utils/pricingSnapshot.js` does. Verified
directly: the backend hardcoded `0.18`/`1.18` independently in 4 places
(`subscriptionController.js:639`, `subscriptionController.js:2628`,
`authController.js:439`, `addonManagement.js:16,24`), no shared constant —
now down to 1, all three proration sites call `computeGST()` (the 4th, the
Razorpay-Plan-creation GST-inclusion in `findOrCreateRazorpayPlan`, was left
untouched — see "What was deliberately left alone" below).

### What the current arithmetic actually looks like

Traced across every call site (`createSubscription` at
`subscriptionController.js:380-462`, `updateSubscription`'s unconfirmed
branch at `:825-865`, the plan-upgrade proration at `:593-660`, add-on
purchase at `:2600-2649` and `authController.js`'s seat-purchase branch,
`applyScheduledAddonRemovals` in `addonManagement.js`): every one of them
independently reconstructs the same shape —

```
basePrice        = plan.monthlyPrice | plan.yearlyPrice
addonsTotal       = Σ (addon.quantity × addon.pricePerUnit)
preDiscountTotal  = basePrice + addonsTotal
totalAmount       = preDiscountTotal − couponDiscount   (via discountEngine.priceLineItems — already generic/pure)
```

`totalAmount` (this post-discount, **pre-GST** figure) is what's actually
stored as the canonical recurring amount on `Subscription`. GST is applied
**only** at two provider-adapter boundaries, each with its own hardcoded
rate: creating/finding a Razorpay recurring Plan
(`findOrCreateRazorpayPlan`, multiplies by `1.18`) and creating a one-time
Order for a prorated mid-cycle charge (`+ Math.round(x * 0.18)`, 3
independent copies). So the "5 independent recompute sites" finding is less
about wildly different formulas and more about **the same formula retyped
5 times**, plus **4 independent GST constants** layered on top wherever a
provider-facing amount is needed.

Two *different* proration formulas already exist and are correctly
distinct, not duplicated: `calculatePlanUpgradeProration` (prorates only
the *base price delta* between old and new plan) and
`calculateAddonProration` (prorates the *full* add-on charge for the
remaining cycle). These aren't a bug — an upgrade only owes the incremental
difference, an add-on purchase owes its full price for the remaining time.
The design below treats proration as a small family of pure functions
*consuming* a Pricing Snapshot, not part of computing the snapshot itself.

### Input

```
{
  plan: { planId, monthlyPrice, yearlyPrice },
  billingCycle: 'monthly' | 'yearly',
  activeAddons: [ { addonKey, quantity, pricePerUnit } ],
  couponDiscount: { lineItems, totalDiscount } | null,
}
```

Deliberately **not** a raw coupon *code* or `organizationId`. Coupon
*eligibility* (`discountEngine.evaluateOrderEligibility`) hits the database
(usage-limit counts) — that's I/O, and invariant #4 in `ARCHITECTURE.md`
says the pricing engine must be pure. The split is already half-built
correctly in `discountEngine.js`: `priceLineItems` (pure — just arithmetic
over already-fetched rules) is what the pricing engine should call
internally; `evaluateOrderEligibility`/`validateAndPriceCoupon` (impure —
DB reads) stay a **caller-side pre-step**, same as today. The engine
receives the already-priced line-item discount, not a coupon to go look up.

### Output — the Pricing Snapshot

```
{
  basePrice,
  addonBreakdown: [ { addonKey, quantity, pricePerUnit, lineTotal } ],
  addonsTotal,
  subtotal,          // basePrice + addonsTotal, pre-discount
  discount,          // from couponDiscount, 0 if none
  totalAmount,        // subtotal − discount — this IS today's canonical `Subscription.totalAmount`, unchanged in meaning
  gst,                // computeGST(totalAmount) — one function, one constant
  grandTotal,         // totalAmount + gst — what Razorpay should actually charge/recur
  generatedAt,
}
```

`totalAmount` keeps its exact current meaning (pre-GST, post-discount,
stored on `Subscription`) so this is additive, not a breaking rename of an
existing field everything already reads.

### What disappeared (5 call sites → 1 function call each) — ✅ done

- `createSubscription` — now builds `activeAddons`/coupon inputs and calls
  `buildPricingSnapshot`, uses `.totalAmount`/`.subtotal`.
- `updateSubscription`'s unconfirmed branch — same refactor, identical pattern.
- `handlePaymentCaptured`'s add-on-purchase branch's `newTotal` — now
  `buildPricingSnapshot({ plan, billingCycle, activeAddons }).totalAmount`.
- `applyScheduledAddonRemovals`'s `newTotal` — indirectly fixed:
  `calculateTotalPrice()` (the function it called) now delegates to
  `buildPricingSnapshot` internally instead of re-deriving the formula, so
  every caller of `calculateTotalPrice` got the fix without changing its
  call site.
- The live plan-upgrade settlement branch's `newRecurringTotal` (the
  `pendingPlanChange` handler, not the dead `pendingUpgrade` one — see
  below) — now calls `buildPricingSnapshot` with a `basePriceOverride`
  (see next paragraph for why).

**One real subtlety surfaced while doing this refactor, not anticipated in
the design:** the upgrade-settlement branch bills `compatibleAddons +
newAddonPurchases` but its final `activeAddons` field also includes
`incompatibleAddons` (kept for access until they're removed at cycle end,
not re-billed). The engine's `activeAddons` input had to be the *billed*
subset only, not the full entitlement list — the caller decides what's
billed, matching the doc comment now on `buildPricingSnapshot`'s
`activeAddons` param. Also added an optional `basePriceOverride` param: this
branch's base price was already computed and verified against the actual
charged amount at scheduling time (`pending.newBasePrice`), so re-deriving
it from `PlanConfig` would risk a silent mismatch — the override lets the
engine use the already-verified number instead.

**Caught and deliberately did not touch:** `handlePaymentCaptured`'s
*other*, dead `pendingUpgrade` branch (`:1305-1389` after this pass's edits)
computes a near-identical `combinedTotal` — but per §5b this branch is
orphaned (nothing writes `pendingUpgrade` anymore; live upgrades use
`pendingPlanChange`). Refactoring dead code for consistency would be pure
risk with no runtime benefit — left as-is, still flagged for deletion via
`git blame`.

**GST dedup, 4 → 1 backend copies, done for 3 of 4:** the three proration
GST additions now call `computeGST()` instead of hardcoding `0.18`
(`subscriptionController.js:647` and `:2628`, `authController.js:439`).
**Deliberately left alone:** `findOrCreateRazorpayPlan`'s inline
`amountRupees * 1.18` — replacing it with `amountRupees + computeGST(amountRupees)`
would introduce a rounding discrepancy for non-round rupee amounts (e.g.
₹999: `999 × 1.18 = 1178.82` → rounds to 117882 paise directly, vs.
`999 + round(999 × 0.18) = 999 + 180 = 1179` → 117900 paise — an 18 paise
difference). Since this value is the cache key for `RazorpayPriceCache`
and the actual amount Razorpay bills, changing its rounding behavior is a
real financial-drift risk, not a safe refactor — left as its own hardcoded
copy on purpose.

### What stays outside the engine (provider adapter, not pricing)

- `findOrCreateRazorpayPlan` — takes a snapshot's `grandTotal`, creates/caches
  a Razorpay Plan. Knows Razorpay's API shape; the engine never should.
- `razorpay.orders.create` calls — take a proration function's output amount,
  wrap it in Razorpay's Order request shape.
- `calculatePlanUpgradeProration`/`calculateAddonProration` — stay separate
  pure functions (per above), consuming snapshot fields as input, not merged
  into the snapshot function itself.
- Coupon eligibility/redemption-limit checks (I/O) — stay exactly where they
  are in `discountEngine.js`, called by the same call sites as today, before
  they build the engine's input.

### Consumers

Backend: all 5 call sites above, now done. Frontend: `BillingSidebar.jsx`'s GST
gross-up display and `BillingHistory.jsx`'s base/GST split *could* eventually
consume a snapshot returned by the backend (e.g. embedded in
`getCurrentSubscription`'s response) instead of computing GST client-side at
all — that's the real fix for the frontend's remaining rule #4 violation
(`GST_RATE` still duplicated once more, backend vs. frontend), but depends
on this engine existing first and the API response being extended to carry
a snapshot. Not designed further here — sequenced after the backend engine.

### Not designed here — deliberately out of scope

- The `planPriority`/tier-ordering problem (frontend §7) is unrelated to
  pricing math and shouldn't be solved by extending this engine — it needs
  its own `PlanConfig.tier` field.
- No decision made yet on *whether* building this now is worth it before
  Charge-at-Will resolves — `findOrCreateRazorpayPlan`'s GST-inclusive
  Plan-creation call is exactly the kind of code Charge-at-Will might
  replace wholesale. The pricing arithmetic itself (base/addons/discount/GST)
  is provider-independent and safe to build regardless; only the adapter
  functions that consume a snapshot to create Razorpay Plans/Orders would
  need rework if the migration happens — which is the entire point of
  keeping them separate.

---

## 10. Add-on display name inconsistency — root-caused, not fixed

Reported from a real screenshot: the Billing Sidebar's "Recurring" row and
the "After" snapshot both showed **"Seat"**, while an earlier Timeline entry
for the same org showed **"Extra Seat Added"** for what a user would
consider the same purchase.

**Root cause, traced:** these come from two different code paths that don't
agree.

1. The Timeline title comes from `billingEvents.js`'s `prettyKey()`, applied
   to `event.metadata.addonKey` **at the time the event was emitted** and
   frozen forever (by design — event snapshots are immutable). The org
   bought the add-on while on the **Starter** plan, where its catalog key is
   `extra_seat` → `prettyKey('extra_seat')` = "Extra Seat".
2. The Sidebar's "Recurring" row calls the same style of function
   (`prettyKey(a.addonKey)`) but on the **current** `activeAddons` array —
   and by the time of the screenshot, the org had upgraded to **Growth**.
   `classifyAddonsForPlanChange` (`addonManagement.js:67-135`) — the
   function that decides which add-ons carry forward across a plan change —
   **remaps** an incompatible add-on to the target plan's equivalent by key
   when one exists with the same `effectType`/`targetKey` (the exact case
   documented in its own comment: `extra_seat` on Starter → `seat` on
   Growth, both `targetKey: "seats"`). Growth's own catalog entry for the
   same concept is literally keyed `seat`, not `extra_seat`.
   `prettyKey('seat')` = "Seat".

**Both labels are technically correct outputs of the same function** — they
just derive a display name by mechanically title-casing whatever the
catalog key happens to be, rather than reading the catalog's actual
`displayName` field. Two plans naming conceptually-the-same add-on with two
different keys (`extra_seat` vs `seat`) makes this fragile: the display
name silently changes across an upgrade even though nothing about what the
customer owns has changed.

**Second, separate observation, not fully confirmed:** the screenshot shows
"Seat, Seat" (two entries), which would mean the org's `activeAddons` array
has *two* separate entries both keyed `seat`, rather than one entry with
quantity 2. `classifyAddonsForPlanChange`'s `compatible.push(...)` /
`equivalent` remap path (`:94-123`) does not check whether the target key
already has an entry in the compatible list before pushing — unlike
`handlePaymentCaptured`'s add-on-purchase settlement branch, which does
merge into an existing same-key entry
(`activeAddons.findIndex(...) ; if (existingIdx >= 0) merge`). If an org
already had a Growth-native `seat` add-on and then a Starter-era
`extra_seat` remapped into `seat` during the same or a later upgrade, this
path could produce two adjacent array entries for the same `addonKey`
instead of one merged entry. **Not verified against real data this pass** —
flagged as a hypothesis worth checking against an actual affected org's
`activeAddons` array before treating it as confirmed.

**Not fixed this pass** — two separate, real fixes, not one:
1. **Display-name fix:** stop deriving a label from the key at render/event
   time; look up `PlanAddon.displayName` for the current key instead
   (already fetched elsewhere via `getAvailableAddonsForOrg`/
   `getAddonsForPlan`) — or, following the same "compute once, freeze it"
   pattern `BillingEvent` already uses for its `summary`, store the
   resolved `displayName` directly on each `activeAddons` entry at the
   moment it's written (purchase, remap, etc.), so nothing downstream ever
   needs to reverse-engineer a label from a key again.
2. **Possible merge-on-remap fix:** if the two-entries hypothesis above is
   confirmed, `classifyAddonsForPlanChange`'s compatible-list construction
   needs to merge quantities into an existing same-key entry instead of
   always pushing a new one — mirroring the merge logic
   `handlePaymentCaptured` already has for regular purchases.

Neither touches Razorpay, settlement, or the frozen renewal path — both are
safe, independent cleanup whenever frontend/data work resumes.

---

## 11. Referral system — backend implemented (frontend/UI not started)

Built per `REFERRAL_SYSTEM_DESIGN.md` and `PRICING_MODIFIER_ARCHITECTURE.md`,
by explicit instruction — an intentional, scoped exception to §1's feature
freeze, not a reversal of it for anything else.

**Built:**
- 5 models: `ReferralProgram`, `ReferralCode`, `Referral`, `Reward`
  (immutable — write-once except `revokedAt`), `RewardUsage` (append-only).
- `utils/referralUtils.js` — code generation, validation (self-referral
  guard, program-enabled check, max-pending/max-total limits),
  `getNextAvailableReward` (derives availability by scanning `RewardUsage`,
  never a cached status — invariant #6).
- `utils/modifierResolver.js` — the Modifier Resolver
  (`PRICING_MODIFIER_ARCHITECTURE.md` §2): resolves an already-priced
  coupon result + an available referral reward into an ordered,
  UNRESOLVED-to-rupees `Modifier[]`.
- `utils/pricingEngine.js` extended, additively: `buildPricingSnapshot`
  now accepts an optional `modifiers[]` alongside the existing
  `couponDiscount` param (both funnel into one internal pipeline — verified
  by regression test that existing `couponDiscount`-only callers produce
  identical output to before). New standalone `applyModifiers(amount,
  modifiers)` for discounting a bare one-time amount (e.g. a proration)
  without needing a full plan+add-ons snapshot.
- Referral intent recorded at signup (`authController.js`'s new-org branch)
  — creates a `pending` `Referral`, emits `REFERRAL_RECORDED`. Self-referral
  and program-eligibility checked before creation; never blocks signup on
  failure (logged and swallowed).
- Reward creation wired into settlement: `maybeQualifyReferral(subscription)`
  in `subscriptionController.js`, called from all 3 racing payment-
  confirmation paths (mirrors the existing `maybeRecordCouponRedemption`
  idempotency pattern exactly — same 3 call sites, same guard-by-current-
  state approach). Emits `REFERRAL_REWARD_EARNED`.
  **Amended by explicit decision** (this doc's original design, and the
  earlier build, only rewarded the referrer): qualification now creates
  **two** rewards — one for the referrer (`role: 'referrer'` in the
  event's `metadata`) and one for the referred organization itself
  (`role: 'referee'`), both using the same `ReferralProgram` config/value
  (simpler option chosen over separately configurable amounts per side).
  No schema change was needed — both are ordinary `Reward` documents;
  which side a reward belongs to is derivable from comparing
  `Reward.organization` to `Referral.referrerOrganization`/
  `referredOrganization`. The referee's reward can't apply to the signup
  payment that produced it (blocked by the same fixed-recurring-plan
  constraint as new-subscription signup generally, see below) but is
  usable on the referee's own next add-on purchase or upgrade — the same
  mechanism, just a different `organization` on the `Reward`.
- Reward reservation/consumption wired into `initiateAddonPurchase` (the
  add-on-purchase Order flow) end-to-end, with the **concurrency-safe
  reservation lifecycle** (below): reserves an available reward BEFORE
  creating the order, discounts the prorated amount before GST, stores the
  usage id on `pendingAddonAddition`. `handlePaymentCaptured`'s
  add-on-purchase branch consumes it on success.

**Reservation lifecycle (concurrency fix — its own cohesive change,
`utils/referralRewards.js`).** A concurrency audit found a real TOCTOU race:
the old code did `getNextAvailableReward` (read) then `RewardUsage.create`
(unconditional write), so two simultaneous checkouts could both reserve the
same reward → double-spend. Fixed as one lifecycle module, not four patches:
  - **Atomic reservation**: a partial unique index on `RewardUsage`
    `{ reward }` where `status:'reserved'` (`models/RewardUsage.js`) is the
    hard guard — at most one reserved usage per reward. `reserveNextAvailableReward`
    catches the duplicate-key error and retries the next reward, so
    concurrent checkouts either get distinct rewards or one proceeds without.
  - **Reserve-BEFORE-order**: the controller reserves before creating the
    Razorpay order (not after). Reserving after would let a concurrent
    consume in between produce a discounted charge with no reward spent (a
    free discount) — reserving first makes the reward the precondition for
    the discount. Order-creation failure releases the reservation.
  - **Atomic consumption**: `consumeReservation` is a conditional
    `findOneAndUpdate({ _id, status:'reserved' })` — a duplicate Razorpay
    webhook finds it no longer reserved and is a no-op, so no double-consume
    and no double-emitted event.
  - **Explicit release**: `releaseReservation` / `releaseExpiredReservations`
    move expired/abandoned reservations `reserved → released` and emit
    `REFERRAL_REWARD_RELEASED`. Called in the reservation path itself (so the
    system never depends on a cron running on time); the same function is
    ready for a future scheduled cleanup job. This replaced the old
    lazy-ignore approach — required, because the unique index would otherwise
    jam on a stale `reserved` row forever.
  - The reservation state machine now lives entirely in
    `utils/referralRewards.js` (moved `getNextAvailableReward` there);
    `modifierResolver.rewardToModifier` is the single place a reward becomes
    a pricing modifier, shared by the committing path and previews.
- All 7 new `BillingEvent` types added to the schema enum, with Timeline
  summary cases in `billingEvents.js`.
- Super Admin backend routes (`referralAdminController.js`, mounted under
  `/super-admin/referrals/*`): get/update `ReferralProgram` config (never
  retroactive — existing `Reward`s are immutable regardless of config
  changes), org referral/reward overview with derived status per reward,
  manual reward grant (`source: 'MANUAL'`), reward revocation (sets
  `revokedAt`, never deletes).
- One org-facing endpoint: `GET /subscription/referrals/code` — returns
  (issuing lazily if needed) the calling org's referral code.

**Upgrade checkout — now wired.** The `pendingPlanChange` upgrade-proration
branch (Order-based, same shape as add-on purchase) now uses the identical
reserve-first → discount → order-create → consume-on-settlement pattern:
reserves before creating the Order (release-on-order-failure), stores
`referralRewardUsageId` on `pendingPlanChange`, `handlePaymentCaptured`'s
upgrade-settlement branch consumes it via the same atomic `consumeReservation`.

**New-subscription signup — confirmed NOT wireable without Charge-at-Will,
correcting an earlier claim in this doc.** The earlier version of this
section called signup wiring "mechanical repetition" of the add-on-purchase
pattern. That was wrong. Traced the actual code: `createSubscription` and
`updateSubscription`'s unconfirmed branch both bake `totalAmount` into a
**fixed-price recurring Razorpay Plan** (`findOrCreateRazorpayPlan` →
`razorpay.subscriptions.create`) — there is no one-time Order to discount,
unlike add-on purchase and upgrade. Applying a referral reward here would
either permanently discount the recurring plan (violates "one reward = one
cycle") or require reverting the plan to full price after cycle 1, which is
the same unbuilt mechanism `Coupon.js`'s own comment already flags as
missing for its `fixed_cycles` duration, and the same Razorpay UPI
recurring-amount constraint as Gap A. **Decision: frozen alongside Gap A,
not implemented**, by explicit instruction rather than silently built wrong
or silently skipped. Rewardable checkouts today are exactly the two
one-time-Order flows: add-on purchase and upgrade.

**Coupon + referral stacking — engine-verified, not integration-tested,
and currently unreachable in production.** `buildPricingSnapshot`/
`applyModifiers` correctly apply coupon before referral on the same
snapshot (unit-tested). But no real call site exercises both together
today: the only checkout where coupons apply is new-subscription signup
(§4.E — a **pre-existing, separate** gap, not introduced by referral work),
and referral rewards only apply on add-on purchase/upgrade, where coupons
don't apply at all (same §4.E gap). So the stacking logic is correct and
ready, but dormant until §4.E is separately addressed — not a referral
defect.

**Downgrade — confirmed not wireable, same root cause as Gap A, by
explicit instruction.** Traced the downgrade branch
(`subscriptionController.js:1097-1148`): it's **schedule-at-cycle-end
only** — no `razorpay.orders.create`, no charge collected today, nothing
to apply a discount to. Its only future effect (at the next renewal, via
`pendingUpdate`) is itself blocked by the already-frozen Gap A
(`handleSubscriptionCharged` never reconciles `pendingUpdate`). So
downgrade can't get referral handling without either inventing a charge
that doesn't exist or unfreezing Gap A — neither is in scope. **Decision:
frozen alongside Gap A, not implemented.** Confirmed downgrade also has
zero incidental interaction with the reservation system (no
`reserveNextAvailableReward`/`resolveModifiers` calls in that branch) — it
neither consumes nor blocks a reward, it's simply inert.

**Reward scoping to the referrer, confirmed correct by construction.**
Every reservation call site uses `req.user.organization` (whichever org is
currently checking out) to look up available rewards, and `Reward.organization`
is always set to `referral.referrerOrganization` at creation time
(`maybeQualifyReferral`). So a reward only ever surfaces for — and can only
be consumed by — the **referrer's own** future checkouts, never the
referred org's, with no special-casing required: an org that happens to be
both a referrer and someone else's referred org simply has its own
`organization`-scoped rewards apply to its own purchases, same as anyone
else.

**Rewardable checkouts, final state:** add-on purchase ✅, upgrade ✅. New
subscription signup and downgrade: both confirmed blocked by the same
class of provider/architecture constraint (Gap A / Charge-at-Will), not
gaps in the referral implementation. Renewal was already known-blocked.
This is the complete set of one-time-Order checkouts in the current
billing model — there are no other rewardable flows left to wire.

**Fixed this pass:**
- ✅ Reward expiry at grant time — turned out to already be correct as a
  side effect of the two-reward (referrer + referee) refactor; verified,
  not re-fixed.
- ✅ `revokeReward` now releases any live `reserved` `RewardUsage` tied to
  the reward being revoked (`referralAdminController.js`), using the same
  atomic `releaseReservation`. If the reservation was already consumed
  before the revoke request landed, that consumption stands — revoking
  only prevents *future* use, it doesn't unwind a settled payment.
- ✅ Org-facing "my referrals" endpoint:
  `GET /subscription/referrals/overview` — code(s), referrals sent,
  whether this org was itself referred, every reward it holds (as either
  referrer or referee) with a derived status, summary counts. Shares its
  query logic with the Super Admin per-org overview via a new
  `buildReferralOverview(organizationId)` in `utils/referralUtils.js`
  (extracted so the two endpoints don't duplicate the same query — the
  admin controller was refactored to call it too).

**Org-facing frontend — built this pass.** `frontend/src/components/settings/Referrals.jsx`,
wired as a new Settings tab (`/settings/referrals`) plus a link from
`BillingCenter`. Shows: the org's code + copy/share-link buttons, whether
this org was itself referred (and by whom), summary stats (sent/pending/
qualified/available), the org's own reward list with derived status, and
every referral it's sent with status. Purely a display layer over
`GET /subscription/referrals/overview` — the component does no discount/
eligibility/status computation itself (matches `ARCHITECTURE.md` §8 rule
#3 and design doc §19's frontend-API-boundary rule). Still missing: a
Super Admin frontend for the admin routes (config, manual grant/revoke,
org overview) — backend-only, no UI, same as before.

**Real bug found in live testing, fixed: the referral link did nothing.**
The dashboard above was verified live (not just syntax-checked) — code
display, copy buttons, and empty states all render correctly against real
data. But opening a shared link (`?ref=CODE`) had no effect: nothing on
the frontend read `?ref=` from the URL, and `PrivateRoute.jsx` redirects
any unauthenticated visitor via `<Navigate to="/login" />`, which drops
query strings entirely — so the code was lost before any page could even
read it, regardless of what that page did with it.

**Two architecture corrections happened while fixing this — both worth
understanding, because the second one reversed part of the first.**

*First correction:* the very first fix recorded referral intent (created
the `Referral`) at organization-creation time, with the code entered on
the signup form. That was flagged as wrong: an org can be created and
never buy anything, and this polluted the referral system with intents
that never became part of a real transaction. So intent-recording moved to
checkout submission (`createSubscription`/`updateSubscription`), and the
input field moved to the plan-selection screen next to the coupon field.

*Second correction (this pass) — the first correction over-corrected.*
Live testing surfaced that a second signup, using the same referral code,
never showed up as `Pending` on the referrer's dashboard even immediately
after registering and even after starting a trial. Tracing the exact call
path confirmed why: **gating `Referral` creation behind checkout
submission means it's also gated behind whatever the customer decides to
do at checkout** — and a customer who starts a trial, or closes the tab,
never triggers it. That's the real regression: the *intended* product
rule is that `Pending` should be visible the moment an org is known to be
referred, entirely independent of whether they ever start a trial or pay
— trial/payment status must never gate that visibility. Tying creation to
"checkout submitted" silently violated that rule, even though the reasoning
behind the first correction (don't create a `Referral` for an org that
never engages with billing at all) was sound on its own.

**The resolution keeps both correct ideas instead of picking one:**
recording intent shouldn't happen at bare organization creation with no
regard for whether a code was ever supplied — but it also must not be
gated behind a purchase decision. So there are now exactly two creation
triggers, both firing as soon as a code is *known and validated*, neither
waiting for Subscribe/Start Trial:

1. **Link-based codes** — captured into `localStorage` by `App.jsx` on
   first page load (still necessary: `PrivateRoute.jsx` drops query
   strings on its redirect). `completeRegistration` now reads it back from
   the request body and calls `recordReferralIntent` **at
   registration** — restoring the original, correct timing for this case,
   since a link-based code is already known before the org even exists.
2. **Manually-typed codes** — entered on the checkout page (which the org
   only reaches *after* registering, so this case genuinely cannot be
   "at registration"). `SubscriptionPlans.jsx`'s referral field now has
   its own **Apply** button, mirroring the coupon field exactly: clicking
   it calls the new `POST /subscription/referrals/apply` immediately,
   which calls the same `recordReferralIntent`. Not folded into
   Subscribe/Start Trial at all anymore — applying and purchasing are two
   separate actions, and only applying creates the `Referral`.

`recordReferralIntent` (`utils/referralUtils.js` — renamed from
`recordReferralIntentAtCheckout`, which stopped being an accurate name the
moment it was also called from registration) is the single
shared function behind both triggers — validates the code (self-referral
guard, program-enabled, not already-referred) and creates the `Referral`
in `pending` status. `createSubscription`/`updateSubscription` no longer
touch referral codes at all; that responsibility moved out of them
entirely, not just its timing. `maybeQualifyReferral` (settlement) needed
**no changes** through either correction — it looks up a `pending`
`Referral` by `referredOrganization` regardless of which of the two
triggers created it.

**Third bug, found in live testing and fixed — the `?ref` capture was
unreliable, so no Pending referral was ever created from a link.** The
capture lived in an `App.jsx` `useEffect`. But React fires child effects
before parent effects, so for an unauthenticated visitor (the real
referral scenario) `PrivateRoute`'s `<Navigate to="/login">` ran first and
stripped the query string before `App`'s capture effect read it — plus
Auth0's `redirect_uri` is `window.location.origin` (no query), losing it
across the login round-trip too. Net: `localStorage` never got set,
registration sent no `referralCode`, no `Referral` was created. **Fixed by
moving capture to `main.jsx`**, in a synchronous IIFE that runs before
`createRoot().render()` — before any router, redirect, or Auth0 hop, at the
only point guaranteed to still see the original URL. Also fixed the
checkout page (a task-#18 regression that removed the code display): it now
reflects **real backend state** — on load it fetches the referral overview
and, if the org already has a referrer (recorded at registration from the
link), shows "Referral applied — referred by X"; the manual entry+Apply box
only shows for orgs with no referrer yet (the verbal/no-link fallback).
Reading actual `Referral` state is more robust than the old localStorage
prefill, which broke because localStorage is cleared right after
registration.

**Still needs a genuine end-to-end test** (not yet run — no live DB in the
dev environment used for these edits): open the link in a **separate
browser / incognito with a genuinely new account**, register a new org via
"Create New," and confirm the referrer's dashboard jumps to `Pending: 2`
immediately (before any trial or payment), and the new org's plans page
shows "Referral applied." Testing in the same logged-in browser that owns
the code will either do nothing (already authenticated → no registration)
or hit the self-referral guard — both expected, neither a real test.

**Fourth bug, found by audit after the capture fix — logout wiped the
captured code.** `Navbar.jsx`'s `handleLogout` calls `localStorage.clear()`
(preserving only `pinned_companies`). A user logged into an old account
who clicks a referral link (main.jsx captures it) and then logs out to
register a fresh org lost the code to that `clear()` before registration
could send it — the likely reason a same-browser manual test kept showing
no new `Pending` even after the capture was moved to `main.jsx`. Fixed by
preserving `referralCode` across the clear, exactly like `pinned_companies`
already was. (A genuine new referred user — never logged in — never hits
this, but the fix also makes the logged-in-then-register path work.)

**Execution path proven by reading (not yet run live):** the single backend
org-creation point is `authController.js:955`; the referral block
(`:1004-1014`) sits directly after it with no intervening `return`, reads
`req.body.referralCode`, and calls `recordReferralIntent` →
`Referral.create()` (`referralUtils.js:127`) for any valid new-org link
flow. Confirmed there is exactly ONE `new Organization(...)` in the whole
backend, so the "three POSTs to complete-registration but only one sends
referralCode" observation is a non-issue — the other two send no `orgName`
and cannot create an org (they return `requiresSetup`); only the
org-creating POST carries the code. What remains genuinely unverified is
purely runtime: that `req.body.referralCode` actually arrives populated
(depends on localStorage surviving to `handleSetupSubmission`, now
hardened at both capture and logout). The definitive check is the browser
Network tab on the `complete-registration` request during a real incognito
signup — confirm the payload contains `referralCode`.

**Not built yet, in order of likely next priority:**
1. Super Admin frontend for the routes built earlier this session (config,
   manual grant/revoke, org overview) — backend-only today.
2. Fraud checks (design doc §18) — only the structural self-referral guard
   (same organization id) is implemented. GST/PAN/payment-method/IP/
   fingerprint/velocity checks are documented, not built.
3. Notifications (design doc §21) — none sent.
4. Invoice line-item display (design doc §20) — `modifierBreakdown` exists
   in the Pricing Snapshot, but nothing in the Billing Center UI renders it
   yet (UI work, frozen per §1 generally — this is the one place where the
   backend is ready but the frontend freeze still applies).
5. Analytics/reward-liability queries (design doc §23) — none built; the
   data model supports them without changes whenever they're wanted.
6. Super Admin: no *global* enable/disable (only per-organization); no
   platform-wide analytics/liability endpoint.

**Hardening backlog (deliberately deferred — not correctness bugs, don't
block feature completion):**
- A scheduled cleanup job calling `releaseExpiredReservations()` globally —
  purely for orgs that reserve and never check out again; the reservation
  path already self-heals for any org that transacts again.
- Real integration test hammering `reserveNextAvailableReward` from
  parallel connections to confirm the E11000 retry path fires as traced
  (the concurrency walkthrough is a reasoned trace, not an executed test —
  no live replica set available in this environment).
- `initiateAddonPurchase`'s GST is computed by calling `computeGST` directly
  rather than through `buildPricingSnapshot` — same primitives, just
  assembled by hand; a future change to the engine's modifier order would
  need manual mirroring here.
- `buildPricingSnapshot`'s coupon-normalization would double-count a coupon
  if a caller ever passed both `couponDiscount` AND a `modifiers` array
  that already contained a coupon-type modifier. No current call site does
  this. Dormant, not a bug today.

**Testing performed:** syntax-checked and module-load-tested every touched/
new file (21 total across both passes); regression-tested
`buildPricingSnapshot` against its pre-change output (identical);
unit-tested `applyModifiers` and `rewardToModifier`. **Not tested:**
anything requiring a live database or Razorpay credentials (unavailable in
this environment) — no end-to-end path, and no actual concurrent-write
test, has been run against a real database. Treat all of this as
code-reviewed and logic-verified, not integration-tested.

---

### 11a. Settlement-race bug — referral qualification skipped on some payment paths (FIXED)

**Symptom (found live):** organization `neww` registered via a referral
link (`Referral: pending` correctly created), then paid for a Starter
subscription. The subscription went `active` / `isPaymentConfirmed: true`,
but its `Referral` stayed `pending` forever — no `qualified`, no `Reward`.
An earlier referral had qualified fine, so it looked intermittent.

**Root cause (proven from the DB, not guessed):** "first payment
succeeded" is one *business* event, but Razorpay delivers it through five
different *transport* events, each with its own handler in
`subscriptionController.js`: `handlePaymentCaptured` (payment.captured),
`handleSubscriptionAuthenticated` (subscription.authenticated),
`handleSubscriptionActivated` (subscription.activated),
`handleSubscriptionCharged` (subscription.charged), and the client
`verifyPayment`. Six code sites set `isPaymentConfirmed = true`, but the
settlement side effects (`maybeQualifyReferral` + `maybeRecordCouponRedemption`)
were wired into only **three** paths. `handleSubscriptionActivated` and
`handleSubscriptionCharged` confirmed payment but never settled. Every
handler also early-returns on `if (isPaymentConfirmed) return;`, so
whichever transport event arrives *first* wins and the others bail.

For **UPI AutoPay**, `subscription.charged` is typically the confirming
event — so it flipped `isPaymentConfirmed` without qualifying, and the
later `verifyPayment` (which *would* have qualified) saw the flag already
true and returned early. Proven via `neww`'s `subscription.appStatusHistory`,
whose sole entry reads `"subscription charged successfully"` — a reason
string written *only* by `handleSubscriptionCharged`.

**Fix (business-layer consolidation, low-risk):** added one idempotent
`runFirstPaymentSettlement(subscription)` that calls
`maybeRecordCouponRedemption` + `maybeQualifyReferral` (each already gated
on `pending` / unredeemed state, with per-callee try/catch so one failure
doesn't block the other). Wired it into **all five handlers** — both their
confirming path and their "already confirmed" early-return branch (8 call
sites) — so any transport path that observes a confirmed payment guarantees
settlement ran exactly once. This is a settlement-pipeline fix: it repairs
coupon redemption on the same previously-missed paths too, not just
referrals. Confined to `subscriptionController.js`; no change to referral
registration, pricing engine, or coupon-validation logic. `neww` was
backfilled through the same idempotent path (now `qualified`, both rewards
issued), then the one-off script removed.

**Not verified live:** `node -c` passes and the fix was checked against real
DB state, but no *new* UPI payment has exercised it end-to-end yet — a fresh
referral→pay test is the true confirmation.

### 11b. 🔖 Backlog (scheduled refactor, NOT a bug) — unify payment confirmation

The 11a fix unified the *settlement* half (business layer). The
*confirmation* half is still duplicated: each of the five handlers sets
`isPaymentConfirmed`/`status`/`paymentStatus`/dates itself. The cleaner end
state is a single `confirmFirstPayment(subscription, metadata)` that owns
those writes **and** calls `runFirstPaymentSettlement`, leaving the five
handlers as thin transport-specific delegators. Deliberately deferred: each
handler does slightly different transport work (`handleSubscriptionCharged`
also emits the `RENEWAL` BillingEvent + updates billing dates;
`handleSubscriptionActivated` updates period dates only; `verifyPayment`
does signature verification + the client response), so merging them safely
needs a per-handler side-effect inventory first. Do that inventory before
attempting the merge — do not fold it into an unrelated change.

### 11c. Super Admin referral UI + checkout discount surfacing (BUILT)

**Super Admin "Promotions & Rewards".** The former "Coupon Management"
screen (`/super-admin/coupons`) is now a tabbed page **Coupons | Referral
Program** (`frontend/src/pages/PromotionsAndRewards.jsx`). UI-level
unification ONLY — Coupon and Reward/RewardUsage stay separate backend
engines (no data-model merge, reservation lifecycle untouched); they still
converge only at `modifierResolver`. The Coupons tab renders the existing
`CouponManagement` unchanged. The new Referral Program tab
(`ReferralProgramAdmin.jsx` + `services/referralAdminApi.js`) is org-scoped
(every referral-admin endpoint is per-org): select an org → view/edit its
`ReferralProgram`, see referrals + rewards (with status pills), grant a
manual reward, revoke a reward. **No backend was added** — it rides the 5
endpoints that already existed. No Analytics tab (platform-wide coupon +
referral stats will live on the Super Admin Overview page later).

**Checkout discount now surfaced (upgrade flow).** The plan-upgrade
`CheckoutSummaryModal` now renders the referral discount breakdown +
"🎉 you saved ₹X" banner from the backend's `referralDiscountApplied`
(previously returned but discarded in `SubscriptionPlans.jsx`).
Presentation-only; the amount was always already discounted. NOT done for
the add-on flow (its discount is computed at confirm-time inside
`initiateAddonPurchase`, after the summary renders — would need a preview
endpoint wiring up the unused `resolveModifiers`).

**Reward lifecycle proven live (partial).** Reserve + discount confirmed
end-to-end from real DB state (org held a reward → upgrade reserved it →
order charged the discounted amount). `consumeReservation` still NOT
observed firing because no upgrade/add-on payment has been *completed* while
a reward was reserved (Razorpay test-gateway timeouts blocked it). Wiring
traced (`consumeReservation` at subscriptionController lines ~1658/1887) but
not runtime-verified — flag for a real completed-payment test.

### 11d. 🔖 Backlog — ReferralProgram fields stored but NOT enforced

These `ReferralProgram` fields persist (and are now editable in the Super
Admin UI, shown greyed with a "not enforced yet" note) but **no backend
code reads them**. Enforcing each is a small, self-contained billing-logic
change — deliberately deferred, do not bundle into unrelated work:

- **stacksWithCoupons** — enforce in `modifierResolver.resolveModifiers`:
  drop the referral modifier when a coupon modifier is present and the flag
  is false. Today coupon + referral ALWAYS stack.
- **honoredDuringTrial** — check in `maybeQualifyReferral` (or qualification
  timing) so a reward isn't earned/applied while the referred org is on a
  trial when the flag is false.
- **minimumActiveDays** — gate qualification on the referred org's age
  (anti-fraud: block signup→pay→refund reward farming).
- **appliesTo / eligiblePlans / eligibleBillingCycles / minimumQualifyingPlan**
  — model-only, not even in the UI; unenforced. Scope + wire when needed.

Enforced fields (for contrast, these DO work): `enabled`, `rewardType`,
`rewardValue`, `maxRewardAmount` (caps discount in `pricingEngine`),
`expiryDurationDays`, `maxPendingReferrals`, `maxTotalReferrals`.

---

**🔖 Future Enhancement (Blocked by Razorpay) — not a redesign, a deferred
product capability:**

> Support an immediate first-invoice referral discount (`₹1000 → ₹800`,
> visible at checkout, before payment) while keeping the recurring
> subscription amount unchanged (`₹1000/month` from the second invoice
> on).

This is the **original product vision** — a referral code should feel
immediately rewarding to the person entering it, not just to the person
who shared it. It's blocked today by the same Razorpay constraint as Gap A
(`KNOWN_BILLING_GAPS.md`): Subscriptions assume one fixed recurring
amount for the life of the subscription, with no supported way to make the
first invoice differ from every invoice after it, short of Charge-at-Will
or an equivalent capability Razorpay hasn't confirmed yet.

**What's shipped today (`REFERRAL_SYSTEM_DESIGN.md`'s "target vision vs.
implementation constraint" note) is the honest, temporary substitute**: the
code is validated at the same checkout screen, but the UI tells the
referred customer plainly they won't see a discount on this invoice — the
referrer earns a reward toward a future purchase instead. **The full
vision above is what to build the moment Razorpay's answer allows it** —
and when that day comes, this is enabling an already-built feature, not
designing a new one:

- `Referral`, `Reward`, `RewardUsage` models — unchanged.
- Settlement, qualification (`maybeQualifyReferral`) — unchanged.
- Modifier Resolver, Pricing Engine — unchanged; a referral reward is
  already a `Modifier` the engine can apply to any amount it's given.
- **The only thing that changes:** the adapter code that tells Razorpay
  (or whatever provider) what to charge on the *first* invoice specifically,
  separately from the recurring amount — that's a provider-orchestration
  change, not a domain-model one.

Don't let this note quietly disappear once Charge-at-Will resolves — check
it explicitly as part of that work, since it's easy to fix Gap A and
forget this was riding on the same capability.
