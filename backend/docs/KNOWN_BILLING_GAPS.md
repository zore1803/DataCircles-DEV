# Known Billing Gaps — deliberately not fixed yet

## Scheduled downgrade is never reconciled into the database (found during BillingEvent tracing)

**Status: on hold pending Razorpay's Charge at Will response (support ticket #19691335).**

### The bug

When a downgrade is scheduled, `subscription.pendingUpdate` is set and Razorpay's
subscription plan is switched via:

```js
razorpay.subscriptions.update(subscription.razorpaySubscriptionId, {
  plan_id: downgradePlanId,
  schedule_change_at: 'cycle_end',
});
```

This is **not a cancellation** — it's a plan switch that takes effect at the
next billing cycle. Razorpay charges the new (lower) amount correctly on
renewal.

But `handleSubscriptionCharged()` — the function that runs on every
`subscription.charged` webhook (the renewal event) — only updates
`currentPeriodStart/End`, `nextBillingDate`, and calls
`applyScheduledAddonRemovals()`. It never reads `pendingUpdate`, so:

- `subscription.planName`, `pricePerUser`, `totalAmount`, `activeAddons`
  keep showing the **old** (pre-downgrade) plan forever.
- Feature-limit gating (`restrictByPlan`, keyed on `planName`) stays wrong —
  the org keeps access to the plan they downgraded away from.
- The "Scheduled Change" UI never resolves to "Current Plan" because
  `pendingUpdate` is never cleared.
- Razorpay's actual charge and the database silently diverge.

The only code that ever reads `pendingUpdate` is inside
`handleSubscriptionCancelled()`, which fires on Razorpay's
`subscription.cancelled` webhook — an event a downgrade never triggers. That
block is effectively dead for this purpose.

### Why it's on hold, not fixed

Razorpay support (ticket #19691335) has stated their Subscriptions product
assumes a **fixed recurring amount** — "If the subscription amount needs to
change, you will have to create a new plan and a new subscription." They're
recommending **Charge at Will** (merchant-initiated variable-amount recurring
debits) for businesses like this one where the recurring amount changes
(upgrades, seats, add-ons, coupons).

**Confirmed directly, not just from support guidance:** a live
`razorpay.subscriptions.update()` call returned the API error
`"subscriptions cannot be updated when payment mode is upi"`. This narrows
the constraint precisely — it's specific to **UPI AutoPay subscriptions**,
not a blanket rule against updating any Razorpay Subscription's recurring
amount. This is exactly why the codebase's existing "best-effort, swallow
the error" pattern around every `subscriptions.update(..., schedule_change_at: ...)`
call (upgrade confirmation, add-on purchase confirmation, add-on removal
application) exists — those calls already expect and tolerate this failure
for UPI subscribers, syncing at the next renewal via `needsRazorpaySync`
instead. **Open question, not yet investigated:** whether a card-based
(non-UPI) subscription's recurring amount update actually succeeds today —
if so, the correctness gap this document describes may be **UPI-specific**,
not universal, which would change the shape of the eventual fix (e.g.
conditional handling by payment mode, rather than a blanket wait for
Charge at Will). Worth checking against a real card-mode subscription
before assuming the constraint is total.

If we migrate to Charge at Will, the entire renewal reconciliation model
changes: there would be no Razorpay "plan" to switch, no
`subscriptions.update()`, no `schedule_change_at` — the backend would compute
the amount every cycle and simply request a debit. Writing the
`pendingUpdate` reconciliation into `handleSubscriptionCharged` now risks
being thrown away (or worse, subtly wrong under a different execution model)
the moment that migration decision is made.

**Decision: wait for Razorpay's Charge at Will documentation before touching
`handleSubscriptionCharged` or any Razorpay plan-synchronization code.**

### The exact fix, when we're ready

Inside `handleSubscriptionCharged`, before/alongside the existing
`applyScheduledAddonRemovals()` call:

```js
if (subscription.pendingUpdate) {
  const pending = subscription.pendingUpdate;
  // apply pending.planName / pricePerUser / billingCycle / totalAmount
  // apply pending.carriedAddons as the new activeAddons
  // pending.removedAddons already merge into pendingAddonRemovals at schedule time
  // clear subscription.pendingUpdate
  // emit BillingEvent PLAN_DOWNGRADE (before/after snapshot, recurringBefore/After)
}
```

This must be the single place a scheduled plan change gets reconciled — do
not duplicate it into `handleSubscriptionCancelled` or elsewhere.

Per review recommendation: before shipping this fix, write an integration
test / reproducible manual scenario that schedules a downgrade, simulates the
renewal webhook, and asserts `planName`, `pricePerUser`, `billingCycle`,
`totalAmount`, carried add-ons, `pendingUpdate` (cleared), feature gating,
and the emitted `BillingEvent` all transition exactly once.

## Also found: trial → paid conversion emits no BillingEvent

`createSubscription` detects an existing Subscription doc (every org starts
on a trial) and forwards to `updateSubscription`'s `!isPaymentConfirmed`
branch — this is the code path that actually runs for the most common
"new subscriber" moment, and it doesn't call `emitBillingEvent` yet (only the
direct `createSubscription` branch for a brand-new org does).

Lower priority than the downgrade bug — not paused for the same
architecture-risk reason, just not done yet. Safe to wire independently of
the Charge at Will decision, since it's pure observation of an already-live
code path.

---

## Trial capability audit (found while auditing `flows/Trial.md`)

Source: `audit/UserObservations.md` "Session 1" walkthrough + code trace. Each
finding below separates the **business issue** (what the user experiences)
from the **technical cause** (what the code does), per the audit's own rule
that these must not be collapsed into one.

### Growth plan card shows "Complete Payment" during an active trial

**Business issue:** the user is not completing a stalled payment — they are
converting a trial to a paid plan. The label implies they already tried to
pay and it didn't finish, which is misleading and was independently flagged
during the walkthrough as confusing (a clearer label like "Upgrade to Paid" /
"Convert to Subscription" was suggested).

**Technical cause:** `PlanCard.jsx`'s `isPendingPayment()` checks
`planName matches && billingCycle matches && !isPaymentConfirmed &&
paymentStatus === 'pending_payment'`. A trial subscription satisfies all four
purely because `startFreeTrial` (`subscriptionController.js:400-464`) never
explicitly sets `paymentStatus`, so it sits at the Mongoose schema default
(`models/Subscription.js:218-222`, default `'pending_payment'`). The exact
same label/logic path fires for someone who abandoned a real Razorpay
checkout mid-payment — two unrelated real-world states sharing one boolean.

**Fix direction (not yet implemented):** either give trial subscriptions a
distinct `paymentStatus`, or add an explicit `isTrialActive` branch in
`getActionType()`/`isPendingPayment()` so the label is chosen by the actual
state, not inferred from a coincidental default.

### Access-control inconsistency across CRM modules

**Business issue:** with no subscription, different pages behave differently
for no product reason. Companies/Deals/Contacts each independently show
"No subscription found. Please subscribe to continue." (once per module —
observed 3 identical toasts stacked) plus "Failed to fetch..." errors, while
the Products & Services page's list loads fine with the identical
no-subscription state. Inconsistent, confusing, and noisy (see
`UserObservations.md`: *"there are just way too many"*).

**Technical cause:** `routes/CompanyRoutes.js` (and Deal/Contact routes) chain
`subscriptionGate` **then** `restrictByPlan('companies', 'read'|'write')`.
`restrictByPlan` has no read-exception — it 403s GETs too when there's no
Subscription document at all (`middlewares/restrictByPlan.js:132-137`, the
exact string is on line 134). `routes/itemRoutes.js` (Products & Services)
only chains `subscriptionGate`, which explicitly lets all GET requests
through regardless of subscription state (`middlewares/subscriptionGate.js:58-60`).
**Confirmed by grepping both route files — this is a real, code-level
inconsistency in which modules apply plan/subscription gating to reads.**

**Fix direction (not yet decided):** either every module needs
`restrictByPlan` for consistency, or a deliberate decision that browsing
(GET) should always be allowed and only writes gated — in which case
`restrictByPlan`'s read-blocking-on-no-subscription behavior is the actual
bug, not `itemRoutes.js`'s omission. This needs an architecture decision
before a fix, not just adding the missing middleware call.

### No way to start a trial except by navigating to the pricing page

**Business issue:** a user with no subscription who lands on any other page
(Companies, Deals, etc.) sees only error toasts — no visible path to start a
trial or subscribe from where they are. The walkthrough explicitly expected a
"Start Trial" CTA reachable from anywhere, and stated it "was there... now
its not there anymore" (a suspected regression — **not confirmable from code
alone**, no git history available in this environment).

**Technical cause:** `frontend/src/components/Header.jsx`'s promo banner
(the one that later shows "Trial ends in 7 days · Upgrade Now") is built from
`label = trialLeftLabel || subscriptionLabel; if (!label) return null;`
(~line 1229). Both `trialLeftLabel` and `subscriptionLabel` are empty when
there is no subscription at all (not trial, not paid) — so the **entire**
banner, including any CTA, renders nothing in that state. It only appears
once a trial or subscription already exists (or is ending). Confirmed by
reading the component; the "used to be there" claim itself is unverified.

**Fix direction (not yet decided):** render a "Start Free Trial" CTA in this
same header slot specifically when there is no subscription at all, distinct
from the trial-countdown/upgrade CTA shown once one exists.

### Trial can create a SECOND `Subscription` document for an organization

**Status: confirmed by code trace, NOT yet reproduced against a live org.**

`startFreeTrial`'s only precondition is `existingSubscription?.trialUsed`
(`subscriptionController.js:406`). There is no unique index on
`Subscription.organization` (confirmed absent — grepped `models/Subscription.js`).
`trialUsed` defaults to `false` and its only setter in the entire codebase is
inside `startFreeTrial` itself (`models/Subscription.js:59`,
`subscriptionController.js:429`).

**Concrete reproduction path:** an organization with a prior **paid**
subscription that was later cancelled, and which never actually started a
trial (so `trialUsed` stayed `false` on that document), calls
`POST /subscription/trial` again. The `trialUsed` guard passes (it's false).
`startFreeTrial` does `new Subscription({...})` — an INSERT, not an update —
creating a second document for the same organization.

**Why this matters:** violates the system invariant "every Organization owns
at most one Subscription" (`BillingArchitecture.md`). Every controller in the
codebase does `Subscription.findOne({organization})`, which would then return
an arbitrary one of the two documents (whichever Mongo's natural order
surfaces first) — meaning behavior would become non-deterministic per-query,
not just wrong once.

**Fix direction (not yet implemented):** either add a unique index on
`Subscription.organization` (forces an explicit decision about what happens
to the old document — archive? reuse?), or change `startFreeTrial`'s
precondition to `if (existingSubscription)` (any existing subscription blocks
a new trial, not just a used one) and route cancelled/lapsed orgs through a
dedicated "reactivate" path instead of trial creation.

### Duplicate access-control implementation (`middlewares/subscriptionCheck.js`)

**Status:** confirmed unused — zero references across every route file
(`grep`-checked).

**Risk:** a future engineer wires it in (its name/shape looks like the "real"
one) instead of the actually-used `restrictByPlan`/`subscriptionGate` pair.
It contains its own, independently-written trial-expiry check.

**Effect if wired in accidentally:** different, incorrect expiry behavior —
it checks `subscription.status`, not `appStatus`, which is the field
`subscriptionGate` (the real gate) actually reads. A trial expired by this
middleware's logic would not match what the rest of the system considers
expired.

**Recommendation:** remove after confirming zero production references
(already confirmed zero *code* references this pass — a production log/APM
check would close this out completely before deletion).
