# Frontend Convergence Plan — CAW Billing Migration

> **Status:** Journey 1 (canonical UI-state derivation) implemented and verified — see "Journey 1 —
> DONE" below. This is the persisted operating
> artifact for Phase 2 (frontend). It exists so the frontend work is *implementation parity*,
> not re-derivation of business rules. The business model is already frozen — see
> `BILLING_DOMAIN_SPECIFICATION.md` (V1.1, FEATURE-FROZEN), `BILLING_SYSTEM_EXPLAINED.md`
> (plain-language companion), `CAW_BILLING_DESIGN.md` (tactical companion). This document adds
> **no** business rules; it only maps the frozen model onto what each screen must render.

## Prime directive (from the operating manual)

The backend is the source of truth. The frontend must stop interpreting billing independently.
Every visible screen must become a pure representation of backend state. If a component cannot
determine what to display from canonical backend state, that is a backend gap to report — **never**
a place to invent frontend logic.

## Canonical fields (the only things the frontend may branch on)

Per `BILLING_DOMAIN_SPECIFICATION.md` Ch.20 (Ownership Matrix) + Ch.22 (Constitution) and the real
Mongoose models:

| Concept | Canonical field / source | Owner |
|---|---|---|
| Product-access lifecycle | `subscription.appStatus` (`trial\|active\|past_due\|cancelled\|expired\|suspended`) | Subscription |
| Mandate lifecycle | `subscription.mandateStatus` (`none\|pending\|confirmed\|paused\|cancelled\|rejected`) | Mandate webhooks |
| First-payment gate | `subscription.isPaymentConfirmed` + `subscription.paymentStatus` | Subscription |
| Renewal date | `subscription.nextBillingDate` / `currentPeriodStart` / `currentPeriodEnd` | BillingCycle Engine (init'd by `reconcileMandate`) |
| Plan / entitlements | `subscription.planName`, `subscription.activeAddons[]` | Billing Component |
| Future intent | `ScheduledChange` records (never a `pending*` flag) | Scheduled Change |
| Timeline | `BillingEvent` (via `GET /subscription/billing-timeline`) | BillingEvent |
| Payment history | `SubscriptionPayment` (via `GET /subscription/payments`) | Payment |

### Legacy fields — NEVER branch on these (they are frozen/meaningless under CAW)

- `subscription.status` — the raw Razorpay-Subscriptions vocabulary field. **Permanently stuck at
  `"created"`** for every CAW subscription (no Razorpay Subscription object exists to advance it).
  This is the direct cause of the "Billing page says CREATED" bug.
- `razorpaySubscriptionId`, `razorpayPlanId`, `current_start`/`current_end`/`charge_at` — all
  Razorpay-Subscriptions artifacts, absent under CAW.

## Endpoint → screen data sources (verified against real controller code)

- `GET /subscription/current` → `getCurrentSubscription` returns `{ hasSubscription, subscription:
  {...toObject, isActive, pendingPayment}, trialEligible }`. `isActive`/`pendingPayment` are
  server-derived from `isPaymentConfirmed` — prefer these over re-deriving client-side.
- `GET /subscription/billing-timeline` → `getBillingTimeline` returns `BillingEvent[]` (Timeline).
- `GET /subscription/payments` → `getPaymentHistory` returns `SubscriptionPayment[]` (Payment History
  + Invoices tab). **Now populated for CAW** as of Phase 1 (handleCAWPaymentCaptured writes it).

## The one canonical derivation (build this, everything consumes it)

`deriveSubscriptionUIState(subscriptionResponse)` → one closed enum. No component may re-derive; all
branch only on its output. Mapping (from the frozen state machines, Ch.2/15/16):

| UI state | Condition (canonical fields only) |
|---|---|
| `TRIAL` | `appStatus === 'trial'` && `isPaymentConfirmed === false` |
| `PENDING_MANDATE` | `appStatus === 'trial'` (or not active) && `mandateStatus === 'pending'` && `registrationLinkId` present |
| `ACTIVE` | `appStatus === 'active'` |
| `PAST_DUE` | `appStatus === 'past_due'` |
| `SUSPENDED` | `appStatus === 'suspended'` |
| `CANCELLED` | `appStatus === 'cancelled'` |
| `EXPIRED` | `appStatus === 'expired'` |
| `SCHEDULED_CHANGE` (overlay, not exclusive) | any pending `ScheduledChange` exists — an annotation on ACTIVE, not a replacement state |

Note: `PENDING_MANDATE` vs `TRIAL` is the distinction that fixes the "Free Trial Active + Complete
Payment shown simultaneously" contradiction — both currently derive from raw flags independently.

## Journey 1 — DONE (canonical derivation built, legacy-field reads fixed)

**Built:** `deriveSubscriptionUIState()` + `SUBSCRIPTION_UI_STATES` enum
(`frontend/src/utils/subscriptionHelpers.js`) — implements exactly the table above
(`NONE|TRIAL|PENDING_MANDATE|PENDING_PAYMENT|ACTIVE|PAST_DUE|SUSPENDED|CANCELLED|EXPIRED`), with
`PENDING_MANDATE` checked before `isTrialActive` specifically to fix the "Free Trial Active + Complete
Payment" contradiction (trial cleanup only runs at mandate confirmation, so `isTrialActive` alone
can't distinguish an in-flight conversion from a genuine untouched trial).

**Converged onto it:**
- `components/settings/BillingSidebar.jsx` — status badge now keyed by derived state, not
  `subscription.status` (was permanently "CREATED" under CAW).
- `components/subscription/PlanCard.jsx` — `isPendingPayment()`/`getActionType()` now branch on
  derived state; `shouldHidePlan()` fixed from `subscription.status === 'active'` to the derived
  `ACTIVE` state.
- `components/subscription/PaymentStatusAlert.jsx` — hides during genuine `TRIAL` only (not
  `PENDING_MANDATE`); adds a distinct, no-retry-button message for `PENDING_MANDATE` (its retry button
  would otherwise call the still-legacy `retryPayment` endpoint — Phase 4D-2 matrix item 4, wrong
  mechanism for a Registration Link mid-conversion).
- `components/subscription/CurrentSubscriptionInfo.jsx` — trial banner gated on derived `TRIAL`, not
  raw `isTrialActive`.
- `pages/Billing.jsx` (Super Admin tenant list — **corrected mislabel**: earlier drafts of this plan
  called this `components/settings/BillingCenter.jsx`, which is a much smaller, unrelated file; the
  actual CSV-export legacy-status bug is in `pages/Billing.jsx:382-389,487-494`) — CSV export now
  reads `sub.appStatus`, matching the on-screen badge at `:848` which was already correct (the
  same-file inconsistency that was the clearest proof of independent derivation).
- `pages/BillingDetail.jsx` — `StatusBadge` now receives `sub.appStatus` instead of `sub.status`;
  added missing `past_due`/`suspended` entries to its status-config map (previously only had the
  legacy Razorpay-Subscriptions vocabulary — `created/authenticated/paused/halted/completed` — which
  has no overlap with those two `appStatus` values).

**Deliberately not touched this pass:** `BillingDetail.jsx`'s admin action-gating logic
(`hasLivePaidSubscription`/`canAdjustTrial`/`canCancelSubscription`, lines ~1109-1135) — this is
Super Admin tooling that already explicitly documents its own reasoning for checking
`isTrialActive`/`appStatus` combinations directly (mirroring the real user's Plans-page logic), not
the class of independently-derived, contradiction-producing UI state this journey targets. Revisit
only if it's later found to disagree with `deriveSubscriptionUIState`.

**Verified:** clean dev-server reload, zero console/build errors introduced (only the pre-existing,
unrelated Auth0 "missing refresh token" errors from no test login in this environment — same
limitation noted in every prior session). **Not verified:** an authenticated click-through proving the
trial+pending-mandate contradiction is visually gone — same no-test-login constraint as before,
flagged as the next verification step once a live session is available.

**Design-review correction (deriveSubscriptionUIState):** the `PENDING_MANDATE` check originally read
`mandateStatus === 'pending' && registrationLinkId`. Verified against both write sites
(`createSubscription`, `updateSubscription`'s trial-conversion) that these two fields are always set
together, never independently — the `registrationLinkId` check was a redundant, self-invented compound
condition, not something the backend actually requires distinguishing. Simplified to the single
canonical field. General principle for this helper going forward: it must stay a **projection**
(`field === value` reads), never recreate multi-field business rules the backend doesn't itself
express that way.

## Journey 3 — DONE (ScheduledChange frontend consumption, replacing legacy pendingUpdate reads)

**API shape, reviewed and corrected before implementation:** first attempt embedded `scheduledChanges`
into `getCurrentSubscription`'s response. **Reverted** after checking this controller's own established
convention — `getBillingTimeline`→`/billing-events`, `getPaymentHistory`→`/payments` are both separate
endpoints from `/current` despite being equally "part of current billing state," and
`IMPLEMENTATION_PLAN_V1.md`'s own route table labels `GET /current → Subscription read`, not an
aggregate. "Avoids a round-trip" is a performance argument, not an architectural one. Corrected to a
sibling endpoint: `exports.getScheduledChanges` → `GET /subscription/scheduled-changes` →
`subscriptionAPI.getScheduledChanges()`.

**Field-completeness trace, before any frontend migration.** `pendingUpdate` carries 4 fields
`ScheduledChange.payload` doesn't (`userCount`/`totalAmount`/`carriedAddons`/`removedAddons`). Traced
each against `renewalEngine.js`'s real execution code (`applyScheduledChange`/
`buildEffectiveSubscription`) and a frontend grep, rather than assuming they need copying:
- `userCount` — vestigial (hardcoded `1` everywhere; seats are the `extra_seat` add-on). Not added.
- `totalAmount` — a convenience calculation, not contractual; the Renewal Engine re-prices fresh via
  `calculateInvoice` at execution. Persisting it risks `BUG-022`-class drift. Not added — stays derived.
- `carriedAddons` — fully derivable: current `activeAddons` minus whatever a sibling `REMOVE_ADDON`
  targets. This is exactly what `buildEffectiveSubscription` already does at execution time. Not added
  as a field — computed at request time instead (see below).
- `removedAddons` — fully redundant with the separate `ScheduledChange{REMOVE_ADDON}` records already
  written alongside. Not added.

**Conclusion: `ScheduledChange`'s schema needed nothing added.** Confirmed by reading the execution
code directly: it already executes every change type without ever consulting `pendingUpdate`. The
apparent gap was cached display projections the legacy model stored redundantly, not missing execution
state.

**Implemented: `getScheduledChanges` now also returns `keptAddons`/`removedAddons`**, computed each
request from `Subscription.activeAddons` cross-referenced against sibling `REMOVE_ADDON` payloads —
mirroring, not inventing, `renewalEngine.js`'s own logic. Deliberate hybrid response shape (documented
inline at the endpoint): raw `scheduledChanges` records for generic "what's pending, of what type, when"
(covers non-addon types too — `PLAN_CHANGE`/`BILLING_CYCLE_CHANGE`/`CANCELLATION`), plus the derived
add-on view specifically because "which add-ons survive" is backend knowledge the frontend should never
reconstruct.

**Quantity-aware fix, caught during regression testing (real bug, not a false alarm):** the first
derivation only checked `addonKey` membership, which would have wrongly treated ANY scheduled removal
as a full removal. Quantity add-ons support **partial** scheduled removal (e.g. remove 1 of 3 seats —
confirmed live in `addonManagement.js`'s incremental `payload.quantity` merge). Fixed to match
`renewalEngine.js`'s exact math: subtract scheduled removal quantity from current quantity; only fully
remove if residual `<= 0`; otherwise the addon stays in `keptAddons` at the reduced quantity and appears
in `removedAddons` with the partial amount.

**Fixture-verified**, permanent regression suite (`scripts/verifyScheduledChangeDerivedView.js`, 4
cases, all passing): single full removal; multiple simultaneous removals composing correctly (the
edge case explicitly flagged during review — `CRM/WhatsApp/Email` active, `REMOVE WhatsApp` +
`REMOVE Email` scheduled → `keptAddons: [CRM]`, `removedAddons: [WhatsApp, Email]`, not a
false-aggregate); no pending changes (everything kept); and the partial-quantity case (3 seats, remove
1 → kept quantity 2, removed quantity 1, addon NOT excluded entirely).

**Frontend consumption — converged, legacy reads removed:**
- `SubscriptionContext.jsx` — added `scheduledChanges`/`keptAddons`/`removedAddons` state +
  `fetchScheduledChanges()`, following the exact same pattern as the existing `seatStatus`/
  `fetchSeatStatus()`. Refreshed automatically inside `fetchSubscription()` itself (not scattered across
  every mutation's own call site) whenever `isPaymentConfirmed`, so `updateSubscription`/
  `cancelSubscription`/`scheduleAddonRemoval` — all of which already call `fetchSubscription()` — pick up
  scheduling changes for free.
- `BillingSidebar.jsx` — "Changing soon" card now finds the pending `PLAN_CHANGE`/`BILLING_CYCLE_CHANGE`
  record from `scheduledChanges` instead of reading `subscription.pendingUpdate`.
- `CurrentSubscriptionInfo.jsx` — the "Scheduled Change" card fully converged: gating, plan name, price,
  effective date, and the add-on kept/removed lists all read from context (`scheduledChanges`/
  `keptAddons`/`removedAddons`) instead of `subscription.pendingUpdate`/`pendingAddonRemovals`. Also
  fixed a same-file legacy read in the *current* (non-scheduled) add-ons list, which was checking
  `subscription.pendingAddonRemovals` to show a "removing" badge — now reads the canonical
  `removedAddons` instead.
- **A latent correctness note, found while converging, not introduced by it:** the old code's own
  comment claimed `carriedAddons` was "a FROZEN future state... must NOT silently absorb add-ons
  purchased afterward." That claim never actually matched execution reality — `buildEffectiveSubscription`
  always computes from *live* `activeAddons` at renewal time, never a frozen snapshot. The new
  backend-derived view is not a new assumption; it's the first time the display has actually agreed
  with what execution does.

**Verified:** clean dev-server reload on a fresh tab (the console errors seen on the actively-edited tab
were stale HMR-buffer noise from Vite hot-swapping several interdependent files live — a fresh tab
showed zero errors of any kind, including none of the usual Auth0 warnings, confirming they weren't
real). **Not verified:** an authenticated click-through of an actual scheduled downgrade — same
no-test-login constraint as every prior session.

## Journey 3 follow-up — scheduled-change price preview showed CURRENT price, not FUTURE price

**Reported symptom:** an `extra_seat` add-on (`REMOVE_ADDON`, effective 23 Aug) correctly appeared in
the Timeline, but both the Timeline's "After" value and the Billing page's recurring total still showed
₹350 (current, seat included) instead of ₹250 (post-removal). Traced as two distinct backend bugs —
not conflated, since they need different fixes.

**Bug 1 — `ADDON_REMOVAL_SCHEDULED`'s `afterSnapshot` was never a future-state computation.**
`scheduleAddonRemovalEndpoint` (`subscriptionController.js`) called `emitBillingEvent` with
`after: result.subscription` and **no `amounts` at all** — the only scheduling event type missing it;
`DOWNGRADE_SCHEDULED`/`BILLING_CYCLE_CHANGE_SCHEDULED` already correctly build a distinct `after` object
and pass `amounts.recurringAfter`. Root cause: `scheduleAddonRemovalUtil` only ever mutates
`pendingAddonRemovals`/`ScheduledChange`, never `activeAddons`/`totalAmount` — so `result.subscription`
was always an unmutated copy of the current state, mislabeled "after." **This exact defect was already
recorded in `BillingFindings.md:183` — independently re-confirmed against current code rather than
cited secondhand**, per this project's standing discipline (a pre-existing finding is a lead to verify,
not evidence to trust as still-accurate).

**Bug 2 — no field existed anywhere for "what the recurring total becomes."** Not mislabeled, just
missing — `BillingSidebar.jsx`'s big price header always showed the current total (correctly), and
"Next Renewal" was only ever a date, never an amount.

**The fix, reusing one canonical computation for both (no new pricing logic):**
- Exported `buildEffectiveSubscription`/`applyScheduledChange` from `renewalEngine.js` — the exact same
  function the Renewal Engine itself uses to compute what a subscription becomes once its pending
  `ScheduledChange` records execute. Its own `now` parameter is the caller's lever: renewal passes an
  actual current time ("what's due today"); preview passes a far-future horizon (400 days —
  comfortably beyond any realistic `effectiveAt`) to ask "what will this become once everything
  currently scheduled has executed."
- **Circular-require risk caught before it shipped:** `renewalEngine.js` already requires
  `subscriptionController.js` (for `setAppStatus`). A top-of-file require in the other direction would
  create a two-way cycle whose resolution depends on which module loads first (e.g. a cron job
  requiring `renewalEngine.js` before any route requires the controller) — could silently resolve
  `buildEffectiveSubscription` as `undefined`. Used a function-scoped `require()` instead, matching this
  file's own existing precedent (`getBillingTimeline`'s inline `BillingEvent` require,
  `getOrgReferralCode`'s inline `ReferralCode` require) — not a new pattern.
- **`getScheduledChanges` consolidated onto this** — its own hand-rolled `keptAddons`/`removedAddons`
  derivation (built earlier this same journey) was replaced with `buildEffectiveSubscription`'s real
  output, removing a second, independent implementation of the same logic. Added
  `effectiveRecurringTotal`, priced via `calculateInvoice({subscription: effective, resolvedModifiers})`
  — same call shape, same recurring-coupon modifier reconstruction (R7) `renewSubscription()` itself
  uses. **`null`, not a duplicate of the current total, when nothing is scheduled or a `CANCELLATION` is
  pending** (decided deliberately, not defaulted — a cancelled subscription has no future recurring
  amount to preview).
- **`scheduleAddonRemovalEndpoint`'s emission fixed** to build a real future-state `after` snapshot and
  pass `amounts: {recurringBefore, recurringAfter}`, using the same `buildEffectiveSubscription` +
  `calculateInvoice` pair.
- **`billingEvents.js`'s `ADDON_REMOVAL_SCHEDULED` summary case fixed** — it unconditionally set
  `amountChange: undefined` regardless of `amounts`, the one outlier among scheduling event types
  (`DOWNGRADE_SCHEDULED` already reads `amounts.recurringAfter` this same way). Brought in line, not
  given new behavior.

**Fixture-verified, permanent regression suite** (`scripts/verifyScheduledChangeDerivedView.js`, now 7
cases): the exact reported scenario (Starter ₹250 + Extra Seat ₹100 = ₹350 current,
`REMOVE_ADDON(extra_seat)` scheduled → `effectiveRecurringTotal: 250`, not 350); null when nothing
scheduled; null when a cancellation is pending; plus the 4 pre-existing add-on-composition cases,
re-run and still passing (no regression from consolidating onto `buildEffectiveSubscription`).
**Additionally verified end-to-end** against the real `scheduleAddonRemovalEndpoint` handler (not a
unit test of the derivation alone): drove a real ₹350→₹250 removal through it, confirmed the persisted
`BillingEvent` shows `amounts: {recurringBefore: 350, recurringAfter: 250}`,
`afterSnapshot.totalAmount: 250`, `afterSnapshot.activeAddons: []`, and `summary.amountChange: "Becomes
₹250/mo"`.

**Frontend:** `SubscriptionContext.jsx` gained `effectiveRecurringTotal` state (same `fetchScheduledChanges`
pattern as `keptAddons`/`removedAddons`). `BillingSidebar.jsx` shows a "Becomes ₹X/mo after scheduled
changes" line whenever `effectiveRecurringTotal` is non-null — deliberately **not** gated on the
existing `pendingPlanOrCycleChange` check (`PLAN_CHANGE`/`BILLING_CYCLE_CHANGE` only), since a
`REMOVE_ADDON`-only schedule — exactly the reported scenario — has nothing to show in that card but
still changes what the customer will pay.

**Verified:** backend syntax-checked, full regression suite (7 cases) passing, end-to-end fixture against
the real endpoint passing, frontend clean on a fresh tab with zero errors. **Not verified:** an
authenticated click-through — same no-test-login constraint as every prior session.

## Final-sweep findings (added after full codebase pass — these change the plan)

**✅ DONE — `ScheduledChange` read API, as its own sibling endpoint.** First implemented by embedding
`scheduledChanges` into `getCurrentSubscription`'s response — **reverted** after review: this
controller's own established convention is one endpoint per domain concept
(`getBillingTimeline`→`/billing-events` for BillingEvent, `getPaymentHistory`→`/payments` for
SubscriptionPayment), each independently fetched by whichever component needs it, never merged into
`/current` despite all being "part of current billing state." `IMPLEMENTATION_PLAN_V1.md`'s own route
table also labels `GET /current → Subscription read`, not an aggregate. Folding `ScheduledChange` in
would have been an unjustified, inconsistent API-contract change — "avoids a round-trip" is a
performance argument, not an architectural one.

**Corrected implementation:** `exports.getScheduledChanges` (`subscriptionController.js`, next to
`getBillingTimeline`) → `GET /subscription/scheduled-changes` → `subscriptionAPI.getScheduledChanges()`
— exact same shape as its two siblings. `getCurrentSubscription` is unchanged, confirmed by fixture:
response keys are back to `['hasSubscription', 'subscription']`, no `scheduledChanges` present.
Fixture-verified the new endpoint separately: real `PLAN_CHANGE` ScheduledChange created, real handler
called, correct `type`/`payload`/`effectiveAt` returned.

This was previously a hard blocker — `ScheduledChange` had zero read call sites anywhere in the
codebase before this — and is now unblocked for Journey 3 (upgrade/downgrade/add-ons UI consumption,
not yet built — the frontend does not call this endpoint yet).

**Field-completeness trace, before any frontend migration (per explicit request — verify behavior, not
just field names).** `pendingUpdate` carries 4 fields `ScheduledChange.payload` doesn't:
`userCount`/`totalAmount`/`carriedAddons`/`removedAddons`. Traced each against what actually consumes
it — `renewalEngine.js`'s real `applyScheduledChange`/`buildEffectiveSubscription` (the execution side)
and a frontend grep (the display side) — rather than assuming they need copying:

| Field | Read by frontend? | Applied by Renewal Engine? | Conclusion |
|---|---|---|---|
| `userCount` | No | No | **Vestigial.** Hardcoded `1` everywhere — seats are the `extra_seat` add-on, not this field. A fossil of a pre-add-on seat model. |
| `totalAmount` | No | No — engine re-prices fresh via `calculateInvoice` at execution | **A convenience calculation, not contractual.** Persisting it would risk exactly the `BUG-022` drift class (a stored total silently disagreeing with what's actually charged). Must stay derived, never stored. |
| `carriedAddons` | Yes (`CurrentSubscriptionInfo.jsx:221-224`) | No — the engine never applies a carry-forward action; it starts from current `activeAddons` and only removes what a sibling `REMOVE_ADDON` targets | **Fully derivable**, not a real snapshot: `activeAddons` minus whatever has a pending `REMOVE_ADDON` is exactly "carried forward." |
| `removedAddons` | Yes (same lines) | Yes, but via the **separate** `ScheduledChange{REMOVE_ADDON}` records already written alongside — already its own complete, canonical record | **Fully redundant** with existing `REMOVE_ADDON` documents. |

**Conclusion: `ScheduledChange`'s schema needed nothing added.** It was already sufficient for the
Renewal Engine to execute every change type without ever consulting `pendingUpdate` — confirmed by
reading the execution code directly, not assumed. The apparent "gap" was cached display projections
the legacy model stored redundantly, not missing execution state. Ownership, restated precisely: money
→ `calculateInvoice()` only; current add-ons → `Subscription.activeAddons` only; future removals →
`ScheduledChange{REMOVE_ADDON}` only. No second place stores any of these.

**✅ Implemented: derived-at-request-time carry-forward view, not a persisted field.**
`getScheduledChanges` now also returns `keptAddons`/`removedAddons`, computed each request from
`Subscription.activeAddons` minus/intersected with sibling `REMOVE_ADDON` `ScheduledChange` payloads —
mirroring, not inventing, the exact logic `renewalEngine.js` already uses at execution time. Nothing
new is persisted; if add-on logic ever changes, there remains exactly one place to update it.
Fixture-verified: a subscription with `[crm_records, whatsapp]` and a pending `REMOVE_ADDON{whatsapp}`
correctly split into `keptAddons: [crm_records]` / `removedAddons: [whatsapp]`.

The legacy `pendingUpdate`/`pendingAddonRemovals` fields remain on `getCurrentSubscription`'s response
unchanged, for backward compatibility with code not yet converged onto `scheduledChanges` — do not
remove them until every consumer has migrated.

**Root cause of "Complete Payment" during trial (KNOWN_BILLING_GAPS, confirmed).** `startFreeTrial`
never sets `paymentStatus`, so a trial sits at the schema default `'pending_payment'`; `PlanCard`'s
`isPendingPayment()` (`planName+cycle match && !isPaymentConfirmed && paymentStatus==='pending_payment'`)
is therefore true for a trial — the same label fires for a genuinely-abandoned checkout. `deriveSubscriptionUIState`
resolves this structurally: a `trial` appStatus → `TRIAL`, never `PENDING_MANDATE`/pending-payment,
regardless of the coincidental `paymentStatus` default. (Optionally also give trials a distinct
`paymentStatus` backend-side — but the derived-state fix removes the frontend symptom without it.)

**`hasValidPendingUpdate` (`utils/subscriptionHelpers.js`) is the ONLY existing derivation helper —
and it reads the legacy `pendingUpdate`.** This is the natural home to evolve into
`deriveSubscriptionUIState`, but it must switch its source from `pendingUpdate` to the (to-be-exposed)
`ScheduledChange` records once the API above exists. Its defensive "stale partial pendingUpdate"
guard exists precisely because legacy `pendingUpdate` can be written half-formed — a problem
`ScheduledChange` (append-only, validated) doesn't have.

**Legacy-field reads are pervasive (full list now):** `BillingSidebar.jsx:46,60`, `BillingCenter.jsx:382,489`
(CSV export), `BillingDetail.jsx:1288` all read `subscription.status`; `CurrentSubscriptionInfo.jsx:44`,
`BillingDetail.jsx:1116,1122`, `PlanCard.jsx:40-45` derive from raw `isTrialActive`/`isPaymentConfirmed`/
`paymentStatus`. All must consume `deriveSubscriptionUIState`. (`BillingDetail`/`BillingCenter` also read
`appStatus` correctly *elsewhere* — same-file inconsistency, the clearest evidence of independent derivation.)

**Timeline vocabulary is correct and complete** — `BillingEvent.eventType` enum covers every commercial
action (SUBSCRIPTION_CREATED, PLAN_UPGRADE, DOWNGRADE_SCHEDULED, ADDON_*, COUPON_*, RENEWAL,
REFERRAL_REWARD_*, etc.); `BillingTimeline.jsx` reads `event.eventType`/`event.occurredAt` — ✅ correct
source, just verify every enum value has an icon/label mapping (some REFERRAL_* / CREDIT_APPLIED may
be unmapped). The earlier "3× Subscribed to Starter" was 3 *real* SUBSCRIPTION_CREATED events from
repeated acquisition attempts — now prevented by the Phase 1 re-entry guard, not a timeline bug.

**Doc-staleness noted:** KNOWN_BILLING_GAPS says "trial→paid emits no BillingEvent" — now **stale**,
the Phase 4D-5 trial-conversion branch emits `SUBSCRIPTION_CREATED`. Also flags a dead, dangerous
`middlewares/subscriptionCheck.js` that reads `status` (not `appStatus`) — unused, should be removed
so nobody wires it in. Neither blocks convergence; both recorded so they aren't rediscovered.

## Component audit (what each reads today → what it must read)

| Component | Reads today | Verdict | Fix |
|---|---|---|---|
| `components/settings/BillingSidebar.jsx:46,60` | `subscription.status` for the status badge | ❌ legacy field → shows "CREATED" | read `appStatus` via derived UI state |
| `components/settings/BillingCenter.jsx:848` | `sub.appStatus` (badge) | ✅ correct | keep |
| `components/settings/BillingCenter.jsx:382-385, 487-490` | `sub.status` (CSV export) | ❌ legacy field, same file as the correct one above | read `appStatus` |
| `components/subscription/PlanCard.jsx:40-45` | `isPendingPayment()` derives from `paymentStatus`/`isPaymentConfirmed` independently | ⚠️ independent derivation | consume derived UI state |
| `components/subscription/PaymentStatusAlert.jsx` | `isTrialActive`, `isPaymentConfirmed`, `paymentStatus` independently | ⚠️ independent derivation | consume derived UI state |
| `components/settings/SubscriptionPlans.jsx` | `subscription?.subscription?.isPaymentConfirmed` (gate, fixed Phase 1) + scattered checks | ⚠️ partially converged | consume derived UI state |
| `components/settings/BillingTimeline.jsx` | `BillingEvent` | ✅ correct source | verify event-type labels match `BillingEvent.eventType` vocabulary |
| `components/settings/BillingHistory.jsx` | `SubscriptionPayment` (`payment.status`, `payment.amount`) | ✅ correct source; now populated for CAW | verify no empty-state assumptions |

## Implementation order — by commercial journey, not by screen

Per the manual: do NOT fix one screen at a time. Pick a journey, make every screen agree for it,
then move on. Recommended order:

1. **Trial → Acquire Mandate → Activation** (the journey with live bugs today). Screens that must
   agree: Manage Subscription (plan cards/buttons), Billing (status + next renewal), Timeline,
   Payment History. Deliverable: `deriveSubscriptionUIState` + `BillingSidebar`/`BillingCenter`
   legacy-field fixes + `PlanCard`/`PaymentStatusAlert` converted to consume it.
2. **Active → Renewal** (needs the Phase 1 `nextBillingDate` init, now in place).
3. **Upgrade / Downgrade / Add-ons** (Scheduled Change display — read `ScheduledChange`, never a
   `pending*` flag, per Ownership Law 5).
4. **Cancellation.**

## Backend gaps found during this audit (report-don't-compensate)

None new beyond Phase 1's already-fixed items. The `status`-stuck-at-`created` behavior is **not** a
backend gap — it is correct per the frozen model (`status` is a dead legacy field; `appStatus` is the
canonical one). The fix is entirely frontend: stop reading `status`. If any journey below surfaces a
field the backend genuinely doesn't provide, it gets raised as a V1.1 Change Proposal
(`BILLING_DOMAIN_SPECIFICATION.md` §Change Process), not worked around in React.
