# Phase 3 — Monthly→Annual Base-Plan Transition: Proration Contract

Specification only. No code changed.

## Correction notice

The first version of this document was **wrong** and has been rewritten. It assumed "the new
annual period starts fresh today, full price owed minus a credit for unused monthly value" —
this is almost word-for-word the model `BILLING_DOMAIN_SPECIFICATION.md:1165-1168` explicitly
marks **❌ SUPERSEDED**:

> "the original Annual↔Monthly conversion formula in §4.1 ('new period starts fresh
> immediately, unused old-cycle value shown as a credit, e.g. Monthly ₹450/20-unused-days →
> Annual ₹5400 − ₹300 credit') is wrong under the corrected model. It assumed switching cadence
> always starts a brand-new period. It does not."

The error came from generalizing Phase 2c's add-on model (where a *new* add-on purchase
genuinely is a brand-new instance with its own fresh anchor) to the base plan, without
checking whether the base plan follows the same rule. It doesn't — `INTENDED_BEHAVIOR_
REFERENCE.md:141-144` is explicit that "the base plan's anchor is the subscription's
first-ever payment. The anchor never resets on upgrade/downgrade/**cadence change**/
late-payment recovery." A Monthly→Annual switch is a cadence change on an *existing*
BillableItem, not the creation of a new one — the add-on precedent doesn't transfer.

## The actual settled model: entitlement window, not a fresh contract

Quoting `BILLING_DOMAIN_SPECIFICATION.md:1170-1184` directly:

> "The customer is purchasing **12 months of service**, not 'the next 12 calendar months from
> today.' Switching to yearly mid-subscription **consumes months already elapsed within the
> current window** rather than resetting the clock:
> ```
> Customer starts monthly Jan 17 → uses the product for 3 months → switches to yearly on Apr 17
>   → 3 of the annual window's 12 months are already consumed
>   → Invoice = Annual Price − (3/12 months' worth) = pay for the remaining 9 months
>   → The yearly window still ends Jan 17 next year — NOT Apr 17 next year
> ```
> A larger example (17 months elapsed): `17 − 12 = 5` months already consumed into a second
> window → invoice = Annual Price − 5 months' worth → pay for the remaining 7 months of that
> (second) window. The window's end date is always a multiple of 12 months from the original
> anchor, never reset by the upgrade event itself."

So: the annual window's boundaries are computed from `subscription.billingAnchor` (Phase 1),
not from today. The customer pays only for the *unconsumed portion* of that window — not the
full annual price.

**What the spec itself still leaves open**, quoted directly (`BILLING_DOMAIN_SPECIFICATION.md:
1248-1251`): "Exact proration formula for 'months already consumed within a 12-month window'
(the 3-month and 17-month examples above establish the *concept*... but not the precise
day-level rounding rule)." That's the actual gap this document needs to close — not the
higher-level model, which is already settled.

## The corrected formula

```
windowStart         = anchor + 12k months, where k = floor(monthsElapsed(anchor, now) / 12)
windowEnd           = windowStart + 12 months
totalWindowMs        = windowEnd − windowStart
remainingWindowMs    = windowEnd − now
newAnnualValue       = annualBasePrice × (remainingWindowMs / totalWindowMs)

totalMonthlyMs       = subscription.currentPeriodEnd − subscription.currentPeriodStart
remainingMonthlyMs   = max(0, subscription.currentPeriodEnd − now)
unusedMonthlyValue   = monthlyBasePrice × (remainingMonthlyMs / totalMonthlyMs)

amountPayableToday   = max(1, round(newAnnualValue − unusedMonthlyValue))
```

Both terms are still necessary, not redundant:
- `newAnnualValue` (the window fraction) answers "how much of the 12-month entitlement is left,
  given how many cycles have already elapsed since the anchor's most recent 12-month boundary."
- `unusedMonthlyValue` answers a different question: if the switch happens **mid-way through an
  already-paid monthly invoice** (not exactly on a monthly boundary), the customer already paid
  for the rest of that specific month. Without this credit, those remaining days would be
  charged twice — once via the monthly invoice already paid, once via the annual price
  implicitly covering the same days as part of its window fraction.

**Worked example, matching the spec's own numbers**: anchor = Jan 17, now = Apr 17 (switching
exactly on a monthly boundary, so no partial month is outstanding), annual price ₹4,800.
`windowStart` = Jan 17, `windowEnd` = next Jan 17, `remainingWindowMs/totalWindowMs` = 9/12.
`newAnnualValue` = ₹4,800 × 9/12 = ₹3,600. `unusedMonthlyValue` = 0 (switch lands exactly on
the boundary). `amountPayableToday` = ₹3,600 — exactly "pay for the remaining 9 months," as
the spec states.

After the transition, the base plan's `currentPeriodEnd` (or whatever field ends up owning
this once the schema question below is resolved) must be set to `windowEnd` — **anchor-relative**,
never "today + 12 months." This is what makes the window's end date "always a multiple of 12
months from the original anchor."

## Resolved technical questions

| Question | Answer | Why |
|---|---|---|
| How is "months elapsed since anchor" computed — calendar month count or continuous fraction? | **Continuous millisecond fraction**, not a whole-month count | The spec's own examples use whole months for illustration, but this codebase's existing convention (`prorationMath.js`) is always continuous ms-based fractions, never day/month counting — matching that avoids introducing a second, less precise convention, and resolves the spec's own acknowledged gap (day-level rounding) the same way the existing functions already resolve it |
| `windowStart`/`windowEnd` calendar-month arithmetic (e.g. Jan 31 + 12 months) | Needs a calendar-safe "add N months to a Date" helper — **not yet verified against JS `Date.setMonth`'s day-overflow behavior for edge months** | Flagged explicitly rather than assumed correct — this is a real implementation detail (e.g. does an anchor of Jan 31 produce a window boundary of Mar 3 or Feb 28/29 in a month-overflow case?) that needs a dedicated fixture before shipping, not glossed over |
| Leap years crossing a window boundary | No special-casing needed for the *fraction* math (ms subtraction is always exact) — `BILLING_DOMAIN_SPECIFICATION.md:3426` (`BC5`) confirms this is "a date-arithmetic correctness question, not a business-policy question — the business rule (anchor never resets) is unaffected either way" | Matches existing ms-based proration convention |
| Rounding | `Math.round()` once, on the final net amount | Matches `prorationMath.js:27,47`'s existing convention |
| Zero/negative result | Floor at ₹1, not ₹0 — `Math.max(1, ...)` | Matches `calculatePlanUpgradeProration`/`calculateAddonProration`'s existing unconditional ₹1 floor |
| Switching exactly on the anchor's anniversary | `remainingWindowMs` = full window, `newAnnualValue` = full annual price — falls out with no special case | Same reasoning as Phase 2c's `periodEnd` boundary handling |
| GST / modifier order | Reuse `calculateCommercialAdjustments`'s existing pipeline unchanged (`invoiceEngine.js:65-96,158-168`) — the net transition amount folds into `effectiveBase` before modifiers/GST, exactly like `plan_upgrade`/`addon_purchase` today | No second pricing engine — one new `adjustmentContext.type` branch |

## What this does NOT cover

- Annual→Monthly (already SETTLED as scheduled-at-term-end, no proration needed).
- Mandate capacity check on the transition charge — reuse the existing guard
  (`renewalEngine.js`'s `MANDATE_CAPACITY_EXCEEDED` check).
- **The base-plan schema question, now more consequential than the first draft implied**: the
  base plan needs to track its own entitlement-window boundaries (`windowStart`/`windowEnd`,
  anchor-relative) distinct from `Subscription.currentPeriodStart/currentPeriodEnd` (which
  today is a rolling, renewal-overwritten field per `renewalEngine.js:455` — not anchor-relative
  at all). This is a bigger schema change than Phase 2a's `activeAddons` migration, because it
  affects the *base plan's own* renewal/proration reads throughout `renewalEngine.js`, not just
  one array field. Should be its own dedicated trace before any code, following the same
  discipline as Phase 2a→2d.
- Coupon/referral edge cases at the transition — unchanged from the first draft's reasoning:
  the formula above produces one net amount; how a durable coupon discounts it is already
  answered generically by the existing per-item modifier mechanism.

## Step 1 — RESOLVED / VERIFIED: calendar-month arithmetic

Implemented as pure functions in `prorationMath.js`: `addCalendarMonths`, `getEntitlementWindow`,
`calculateMonthlyToAnnualTransition`. Not schema/renewal-integrated yet (see Step 2 below) —
these are pure math only, callable but not yet wired into any purchase flow.

**Confirmed bug, verified directly before deciding the fix** (`node -e`, not assumed): naive
`Date.setMonth(d.getMonth() + n)` overflows on day-of-month edges — `Jan 31 + 1 month` becomes
`Mar 3` (JS rolls the extra days into the next month instead of clamping), and a leap-day
anchor (`Feb 29`) `+ 12 months` becomes `Mar 1` instead of `Feb 28`. Fixed with the standard
clamp-to-last-valid-day approach.

**Second bug, also verified directly**: computing a window boundary by *chaining* smaller
steps (twelve `+1 month` calls) compounds the clamp error — `Jan 31` chained twelve times
lands on `Jan 28` the following year, permanently losing the 31st, while one *direct*
`+12 months` jump from the anchor correctly returns `Jan 31` (no clamping needed, since the
target month also has 31 days). `getEntitlementWindow` always computes `windowStart`/
`windowEnd` as one direct jump from `anchor`, never by advancing a previous boundary forward —
this is the one implementation detail that would silently corrupt long-lived anchors if
gotten wrong.

**Verified against the spec's own worked examples and edge cases** —
`scripts/verifyEntitlementWindowMath.js`, 15/15 passing (pure math, no database, no
`CONFIRM_TEST_DB` gate needed). Independently re-run and confirmed with pasted terminal
output in-session (not just claimed) after this document's own "claimed but not
independently confirmed" gap was flagged — see the session log for the actual
`15 passed, 0 failed` output. Flagging this here explicitly is itself the fix for a real
process gap: this suite predates `PHASE3_ENTITLEMENT_WINDOW_SCHEMA_TRACE.md` (the doc that
started tracking "claimed vs. pasted" gaps as a discipline), so its unconfirmed status was
never written down anywhere — it just silently sat as "probably fine" until asked about
directly. Test coverage:
- 3-month example (`Jan 17` anchor, switch `Apr 17`) → window `Jan 17 → next Jan 17` ✓ (matches spec exactly)
- 17-month example → rolls into the second anchor-relative window, still ending on the anchor day ✓
- switching exactly at the anchor anniversary rolls forward into the new window (boundary-inclusive, matching this codebase's existing boundary convention)
- leap-day anchor clamps correctly and later recovers day 29 in a subsequent leap year
- day-31 anchor stable across a switch landing in the clamped (28-day) month
- full transition formula: clean-boundary case, mid-cycle case (monthly credit actually reduces the charge), and the ₹1 floor under an extreme input

**One deliberate departure from the spec's own illustrative numbers, documented in the
fixture itself**: the spec's "9/12 of annual = ₹3,600" example uses whole-month counting for
illustration. This implementation uses continuous day-level millisecond fractions instead
(matching this codebase's existing `prorationMath.js` convention, not whole-month counting) —
so a real `Apr→Jan` span (9 calendar months of varying real length) computes to a value close
to but not exactly the illustrative 9/12 split. This is the intended resolution of the spec's
own acknowledged "precise day-level rounding rule" gap, not a discrepancy to fix.

## Step 3 — Monthly→Annual transition execution — IMPLEMENTED / VERIFIED

Four decisions stated and confirmed deliberate before any code, per this session's standing
discipline:

1. **Recompute at commit, with boundary-mismatch detection** — not the original stale-window
   design, and not silent recompute-and-trust either. `amount` is locked at initiation (what
   the customer agreed to pay); `windowStart`/`windowEnd` are recomputed fresh at commit via
   `getEntitlementWindow(anchor, nowAtCommit)`. If the recomputed `windowStart` differs from
   the quoted one (a 12-month anchor boundary was crossed between initiation and settlement),
   the transaction is **not** committed — the subscription is left completely unchanged and
   the event is logged loudly for manual reconciliation, reusing this codebase's existing
   `RECONCILIATION_NEEDED` shape rather than inventing a new stored state.
2. **`CommercialTransaction.type: 'BILLING_CYCLE_CHANGE'`** — confirmed by reading both models
   directly: the value already existed in `CommercialTransaction`'s enum but had zero real
   writers before this; `ScheduledChange.type` has the same string but is a wholly independent
   model/field used only for the deferred non-UPI cycle-change path. No conflation risk.
   `target.immediate: true` disambiguates the two concepts for anyone reading history later.
3. **Fail-safe via the existing `RECONCILIATION_NEEDED` pattern**, not a new mechanism.
4. **No self-service/admin clear-path for a stuck `pendingCycleTransition` exists yet** —
   inherited limitation, confirmed to match `pendingAddonAddition`'s own pre-existing gap (no
   cancel endpoint found anywhere in the controller despite its error message implying one).
   Deliberately deferred: building a clear-path becomes the immediate next task **if and when**
   `RECONCILIATION_NEEDED` is ever actually observed in production — not before.

**What was built:** `utils/cycleTransitionLifecycle.js` (`startMonthlyToAnnualTransition`,
mirrors `addonPurchaseLifecycle.js`'s shape — a one-time Razorpay Order, not a CAW mandate
charge), a new `Subscription.pendingCycleTransition` sub-schema, a new
`adjustmentContext.type: 'cycle_transition_monthly_to_annual'` branch in
`calculateCommercialAdjustments()` (reuses the existing GST/discount pipeline unchanged),
`POST /subscription/cycle-transition/monthly-to-annual`, and a new commit branch in the
`payment.captured` webhook handler implementing the four decisions above. A deliberate
supersession rule is also implemented: a successful transition cancels any PENDING base-plan
`ScheduledChange` (`PLAN_CHANGE`/`BILLING_CYCLE_CHANGE`) but never touches add-on-scoped
`ScheduledChange`/`pendingAddonRemovals` records — independent concerns.

**A real bug caught during fixture-writing, not glossed over**: the `BILLING_CYCLE_CHANGE_SCHEDULED`
`BillingEvent` type (the only pre-existing cycle-change event) literally means "scheduled" —
using it for this *immediate*, completed transition would have been a real naming/semantic
bug in the timeline. Added a proper `BILLING_CYCLE_CHANGE_COMPLETED` type instead.

**A misdiagnosis caught and corrected before it became unnecessary code**: initially suspected
the known Mongoose single-nested-subdocument "assign undefined doesn't clear it" quirk (documented
elsewhere in this session's history) applied to clearing `pendingCycleTransition`, and added a
`markModified()` call to fix it. Verified directly against the raw MongoDB document (not just
the reloaded Mongoose object) before committing to that fix — plain `= undefined` already
correctly unsets the field in storage; the `{}` seen on a reloaded Mongoose document is just
normal single-nested-subdocument hydration behavior (always materializes as an object on
read), not a persistence bug. `markModified()` was removed again since it fixed nothing real;
the fixture's assertion was corrected to check `.orderId` instead of equality to `undefined`,
matching how every real guard in this codebase already does it.

**Verified:** new `scripts/verifyMonthlyToAnnualTransition.js`, 6/6 passing — rejects an
already-yearly subscription, rejects a missing `billingAnchor` (fails loudly rather than
guessing a window for a real charge), confirms nothing changes at initiation (only at
commit), rejects a second initiation while one is pending, confirms a clean commit correctly
flips `billingCycle`/period while `billingAnchor` never moves, and **confirms the
boundary-mismatch case leaves the subscription byte-for-byte unchanged** (still monthly, full
access retained) rather than silently committing a mismatched window. Full regression suite
re-run: **71/71 passing, 0 failed** (65 prior + 6 new), plus two independent trace-script
spot-checks (`traceDowngradeCarryForward.js`, `traceAddonRemovalTimeline.js`) confirming the
`calculateCommercialAdjustments()` signature change didn't disturb the existing
upgrade/add-on-removal paths.

**Explicitly not implemented, per this document's own scope**: Annual→Monthly (separately
settled as scheduled-at-term-end), any new mandate-capacity logic (the existing guard applies
unchanged to whatever this flow's `amount` computes), coupon/referral eligibility for this
specific transaction type (deliberately priced at full amount — `resolvedModifiers` is empty
in `startMonthlyToAnnualTransition`, since `ANNUAL_BILLING_SCOPE.md` item 7 is still open), and
frontend/UI for any of this (backend-only, matching the Phase 2d.1 precedent of API-before-UI).

## Step 3b — Cross-tier extension — IMPLEMENTED / VERIFIED

Extends Step 3 to support a target plan tier different from the subscription's current one
(e.g. Business-monthly → Starter-annual), per a later, more explicit decision that superseded
an earlier "no plan change" answer given in a different exchange this session.

**Task 1 — `targetPlanId` threaded through**: `initiateMonthlyToAnnualTransition` now accepts
optional `targetPlanId` in the request body, defaulting to `subscription.planName` (so every
existing same-tier caller is unaffected). `pendingCycleTransition` gained a `targetPlanId`
field. The webhook commit path now sets `subscription.planName = pending.targetPlanId`
alongside `billingCycle`/`pricePerUser` — a same-tier no-op when the target matches the
current plan.

**Task 2 — eligibility gate, DEFAULT CHOICE flagged for review**: a transition to a lower
tier is simultaneously a downgrade. `startMonthlyToAnnualTransition` now calls
`downgradeValidator.validateDowngrade(subscription, plan.planId, [], null)` before creating
any Razorpay order when the target tier's priority (`{starter:1, growth:2, business:3}`, the
same inline map used elsewhere in this codebase) is lower than the current one — reusing the
same gate every other downgrade path in this codebase uses. **This was not separately
confirmed as the intended rule for this specific case** — every other downgrade in this
codebase is scheduled-at-term-end; this one is immediate. Chosen for consistency with
existing behavior, stated explicitly here rather than silently assumed, and open to being
overridden. An upgrade to a higher tier needs no such check, same as any other upgrade.

**Task 3 — ScheduledChange supersession confirmed unaffected**: the existing cancel-pending-
base-plan-change query (`ScheduledChange.updateMany({..., type: {$in:['PLAN_CHANGE',
'BILLING_CYCLE_CHANGE']}, status:'PENDING'}, ...)`) has no plan/tier-specific logic at all —
confirmed by reading it directly, no code change needed.

**SETTLED BUSINESS CONTRACT (this session): base-plan vs. add-on scheduled-change
supersession are independent.** A Monthly→Annual transition supersedes a pending **base-plan**
scheduled change (`PLAN_CHANGE`/`BILLING_CYCLE_CHANGE`) — the new purchase is a deliberate,
immediate base-plan decision that overrides the old one. It must **never** touch a pending
**add-on** scheduled change (`REMOVE_ADDON`) — the customer already paid for that add-on's
current entitlement, which remains active and scheduled for its own term-end, completely
independent of the base plan's cycle. The transition neither cancels nor revives/extends an
add-on's own lifecycle. This was already correctly implemented (the supersession query's
`type` filter never included `REMOVE_ADDON`), but had not been explicitly fixture-verified as
a *behavior* until now — verifying the query's scope by reading it is not the same as proving
a real `REMOVE_ADDON` record survives a real transition.

**Verified**: new `scripts/verifyCycleTransitionAddonPreservation.js`, 3/3 passing — a pending
`PLAN_CHANGE` is confirmed cancelled, a pending `REMOVE_ADDON` (created via the real
`scheduleAddonRemoval()`, not hand-built) is confirmed to remain `PENDING` and the add-on
itself remains untouched on the subscription, and both behaviors confirmed together in a
single combined fixture. Full regression re-run unaffected.

**Verified**: new `scripts/verifyCrossTierMonthlyToAnnual.js`, 5/5 passing — same-tier
regression check, cross-tier upgrade (no eligibility check triggered), cross-tier downgrade
where target limits are satisfied (succeeds), cross-tier downgrade where current usage
exceeds target limits (blocked with `DOWNGRADE_INELIGIBLE`, nothing charged or committed),
and boundary-mismatch detection confirmed to still fire correctly for a cross-tier case, not
just same-tier. Original same-tier suite (`verifyMonthlyToAnnualTransition.js`) re-run
unmodified: still 6/6, byte-for-byte unchanged. Full regression suite: **80/80 passing, 0
failed** (75 prior + 5 new).

## Open item — mandate sizing across a Monthly→Annual transition (confirmed real, not fixed)

Raised after Step 3 shipped: does the annual recurring charge reliably fit within the
customer's existing mandate once they transition from monthly? **Checked directly, not
assumed — the answer is no, not reliably.**

**Confirmed by code (grep, not memory):** `Subscription.mandateMaxAmount` is written at
exactly three sites, all at original CAW mandate acquisition/token confirmation
(`cawAcquisition.js:85`, `subscriptionController.js:2121,2991,3125`) — sized as
`firstInvoiceRupees × MANDATE_HEADROOM_MULTIPLIER` (default 2×) off whatever the **first**
invoice was. No code path, including this session's new `cycleTransitionLifecycle.js`,
resizes or recreates the mandate on a `billingCycle` change. The one-time transition charge
itself is a plain Razorpay Order (like add-on purchases) and isn't gated by mandate capacity
at all — the exposure is entirely in the **future annual renewal**, charged via
`chargeMandateFn` against the original, monthly-sized mandate.

**Concretely:** a customer who started monthly at ₹450 has a mandate ceiling of `450 × 2 =
₹900`. Switching to annual at ₹4,800/year means every future renewal exceeds that ceiling —
correctly caught by this session's `MANDATE_CAPACITY_EXCEEDED` guard (not silently broken),
but requiring manual reauthorization on every annual renewal as the **expected**, not rare,
outcome for most monthly-origin customers who transition. "The mandate is big enough" is
false by default for exactly the customers this feature is for.

**Confirmed by search (Razorpay's actual current docs, not a recalled figure):** UPI Autopay
and card e-mandate have a standard AFA-free (no extra customer approval) ceiling of **₹15,000**
per transaction — a platform-level constraint independent of this app's own `mandateMaxAmount`
field. Above ₹15,000, Razorpay requires the customer to approve via UPI PIN even if the app's
own ceiling would allow it. Netbanking e-mandates default to ₹10,00,000. Specific NPCI
categories (insurance, mutual funds, credit card bills) get a ₹1,00,000 AFA-free ceiling this
product's category doesn't qualify for.
[Razorpay: UPI Autopay vs Card e-Mandates](https://razorpay.com/blog/upi-autopay-vs-card-e-mandates/),
[Razorpay: Master Recurring Payments with UPI 2.0 Autopay](https://razorpay.com/blog/master-recurring-payments-upi-autopay-guide/)

**Status: tracked, not fixed.** Two independent constraints stack here — this app's
self-imposed ceiling (fixable by resizing the mandate on transition, not yet built) and
Razorpay's own platform AFA threshold (₹15,000, not under this app's control at all, only
avoidable by staying under it or accepting the reauthorization UX). Whether/how to resize the
app's own ceiling at cycle-transition time is a real, separate piece of future work — not
scoped or implemented as part of Step 3.

## Step 2 — storage sub-question RESOLVED: derive-on-read, no new stored fields

Full reasoning recorded in `PHASE3_ENTITLEMENT_WINDOW_SCHEMA_TRACE.md`'s "Storage decision"
section. Short version: the hotfix that grew out of this trace (`getAccessEntitlementEnd()`,
used by `subscriptionCheck.js`, the cancellation cron, and the cancellation email) proved
derive-on-read works with zero schema changes for every consumer that actually needed an
entitlement-window answer — which is evidence storage isn't needed, not a gap to fill.
Storing `entitlementWindowStart/End` would add a new rollover-write-timing question with no
existing answer, for a compute-cost problem nobody has demonstrated exists. **Decision: no
new `Subscription` fields for this. The remaining schema work below is scoped down
accordingly** — it's about the base-plan's `currentPeriodStart/End` rolling-vs-entitlement
conflation (already partially fixed for the three known consumers), not about adding a
parallel stored window.

## Step 2 — NOT YET DONE: base-plan schema/renewal trace

Still required before `calculateMonthlyToAnnualTransition` can be wired into any real purchase
flow: trace where `windowStart`/`windowEnd` should actually be persisted and read, and how that
interacts with `renewalEngine.js`'s existing rolling `currentPeriodEnd` (overwritten every
renewal today, per `renewalEngine.js:455` — not anchor-relative at all). This is the bigger,
riskier piece flagged in the previous revision of this document — do not start it in the same
change as Step 1's math, per this session's standing discipline of isolating schema-affecting
work from pure-function work.

## Recommendation

Step 1 is done and verified. Next: the base-plan schema/renewal trace (Step 2) — its own
dedicated research pass, no code, before anything touches `Subscription`/`renewalEngine.js`.
