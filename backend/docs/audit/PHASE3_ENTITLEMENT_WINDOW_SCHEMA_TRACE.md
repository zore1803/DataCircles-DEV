# TRACE: currentPeriodStart/currentPeriodEnd Conflation Audit (Rolling Billing Cycle vs. Entitlement Window)

**Session context:** Phase 3 (`backend/utils/prorationMath.js`) just added pure functions —
`addCalendarMonths`, `getEntitlementWindow(anchor, now)`, `calculateMonthlyToAnnualTransition(...)` —
implementing the anchor-relative "entitlement window" model from
`backend/docs/audit/BILLING_DOMAIN_SPECIFICATION.md`. These are not wired into any real purchase
flow yet, and there is no schema field to store a computed window. Before building the real
Monthly→Annual transition, this document traces every current read of
`Subscription.currentPeriodStart`/`currentPeriodEnd` to establish how much of the codebase already
conflates "current invoice/billing cycle" (rolling, overwritten every renewal —
`renewalEngine.js:474-476`) with "when does the customer's paid-for entitlement expire" (anchor-relative,
would span 12 months for an annual base plan). Read-only research; no code was written or modified,
`Subscription.js` and `renewalEngine.js` were not touched, and no fixture scripts were created.

Method: grepped `currentPeriodStart|currentPeriodEnd` across the entire `backend/` tree (all
controllers, utils, jobs, middlewares, models, scripts, docs), then read every non-doc,
non-verification-script hit in context. `backend/scripts/verify*.js` and `backend/scripts/trace*.js`
files are pre-existing test/verification harnesses from earlier phases (not created for this task)
and are noted only where relevant — they don't affect production behavior.

---

## 1. Classification table — every production read/write site

Legend: **(a)** = genuinely wants the rolling invoice/billing cycle, correct as-is, unaffected by an
annual entitlement window existing as a separate concept. **(b)** = actually wants or implicitly
assumes "when does the customer's paid access expire" — latent bug once an annual base plan exists.
**(w)** = write site (included for completeness/provenance, not itself a "wants X" question).

| # | File:Line | Snippet / role | Class | Notes |
|---|---|---|---|---|
| 1 | `controllers/authController.js:351` | Returns `currentPeriodEnd` in `getCurrentUser`-style response, alongside `isTrialActive`/`trialEnd`/`isPaymentConfirmed` | **(b)** | Consumed by the frontend as "when do I lose access." Only breaks once a subscription has an annual `billingCycle` and this field stops meaning entitlement expiry — not triggerable today with monthly-only subscriptions. |
| 2 | `controllers/subscriptionController.js:1283-1284` | `currentPeriodStart: trialStart, currentPeriodEnd: trialEnd` at trial creation | (w)/(a) | Trial periods are a single bounded window; not affected by the annual base-plan question. |
| 3 | `controllers/subscriptionController.js:1624-1625, 1652-1653` | Scheduled-change/upgrade preview payload sent to the client | **(b)**-leaning | Same shape/consumer pattern as #1 — flagged conservatively; only breaks once annual `billingCycle` subscriptions exist. |
| 4 | `controllers/subscriptionController.js:1869-1870` | Legacy Razorpay-managed-subscription webhook sync | (w)/(a) | Genuinely "what does Razorpay say the current invoice cycle is" — correct rolling semantics. |
| 5 | `controllers/subscriptionController.js:2134-2135` | `= undefined` on cancellation/reset | (w)/(a) | Clearing rolling cycle fields; correct regardless of entitlement model. |
| 6 | `controllers/subscriptionController.js:2396` | `scheduledAt: new Date(subscription.currentPeriodEnd)` for a plan/cycle change | **(a)** | "At the next invoice boundary" — deliberately deferring a change to end of the CURRENT paid cycle, the rolling-cycle concept by design. |
| 7 | `controllers/subscriptionController.js:2457-2909` (10 sites) | `effectiveAt: subscription.currentPeriodEnd` for downgrades, cycle changes, cancellations | **(a)**, same reasoning as #6 | "Defer until the customer has gotten what they already paid for." |
| 8 | `controllers/subscriptionController.js:3721-3806` (6 sites) | Same pattern for upgrade-path scheduled changes | **(a)**, same as #7 | |
| 9 | `controllers/subscriptionController.js:3029-3039` | CAW first-activation: `currentPeriodEnd = addBillingCycle(activatedAt, billingCycle)` | (w)/(a) | Correctly cadence-aware — an annual plan's first `currentPeriodEnd` is 12 months out by construction. This is the ONE place rolling and entitlement coincide, and only at first activation — they diverge the instant a Monthly→Annual transition occurs mid-cycle. |
| 10 | `controllers/subscriptionController.js:4039-4042, 4154-4157, 4279-4282, 4609-4612` | Razorpay webhook/verification handlers | (w)/(a) | Legacy rolling invoice cycle sync, genuinely correct. |
| 11 | `controllers/subscriptionController.js:4459, 4464` | `getRenewalPreview`: `nextRenewalDate: subscription.currentPeriodEnd` | **(a)** | Explicitly named "next renewal date" — the rolling-cycle question. |
| 12 | `controllers/subscriptionController.js:4649-4650` | Payment-verification response, grouped with `nextBillingDate` | **(a)**-leaning | Lower risk than #1/#3 — explicitly bundled with `nextBillingDate`. |
| 13 | `controllers/subscriptionController.js:5419` | `existingAddon.periodEnd \|\| subscription.currentPeriodEnd` — add-on removal effective date | **(a)** | Already anchor-aware for annual add-ons, rolling-fallback for monthly ones — the pattern the base plan should eventually mirror. |
| 14 | `controllers/superAdminController.js:1443` | Admin trial-extension | (w)/(a) | Trial-specific, not annual-cycle related. |
| 15 | `controllers/superAdminController.js:1529` | Admin "end trial now" | (w)/(a) | Trial-specific. |
| 16 | `controllers/superAdminController.js:1620, 1630` | Cancellation email: "access until {currentPeriodEnd}" | **(b)** | Direct textual entitlement claim from the rolling field. Correct today (monthly-only); breaks for an annual-plan cancellation once rolling diverges from entitlement. |
| 17 | `utils/adminActionEmails.js:105, 124` | Same template #16 calls into | **(b)** | Same defect, one occurrence (not double-counted). |
| 18 | `jobs/subscriptionLifecycleJobs.js:149-179` (cron, `* * * * *`) | `currentPeriodEnd: {$lt: now}` finalizes scheduled cancellations | **(b)** | **The** entitlement-expiry enforcement job, riding the rolling field. Correct for monthly-only; breaks for an annual subscription whose `currentPeriodEnd` isn't re-pointed at the entitlement window boundary after a transition. |
| 19 | `models/Subscription.js:137-138` | Schema definition, no comment distinguishing the two concepts | (w)/schema | The field's dual-purpose use isn't documented at its source of truth. |
| 20 | `models/Subscription.js:167` (comment) | "following the subscription's own currentPeriodEnd exactly as before" | comment only | Confirms design intent already treats this as the rolling reference point for add-on scheduling. |
| 21 | `middlewares/subscriptionCheck.js:25, 79-80` | `now > currentPeriodEnd` → `status: 'expired'`, 403 `SUBSCRIPTION_ENDED` | **(b)** | **Highest-severity finding.** A second, independent entitlement gate (distinct from `subscriptionGate.js`) that hard-blocks access based on the rolling field. Correct today only because rolling == entitlement for monthly-only plans. Would flip a still-entitled annual customer to `expired` the moment the rolling period closes, even though they're still inside their paid year. This is a hard access-block, not a display bug, wired into `checkSubscriptionLimits(featureType)`, a real mounted middleware. |
| 22 | `middlewares/subscriptionGate.js:43-51` | Selects only `appStatus status isPaymentConfirmed` — deliberately excludes `currentPeriodEnd` | **safe** | The primary/newer gate, reasons purely off `appStatus`. |
| 23 | `middlewares/restrictByPlan.js` (whole file) | Selects only `planName appStatus activeAddons` | **safe** | No reference to `currentPeriodStart/End` at all. |
| 24 | `utils/renewalEngine.js:265` | `newPeriodStart = subscription.currentPeriodEnd` | **(a)** | "Next cycle starts where this one ends" — pure rolling arithmetic. |
| 25 | `utils/renewalEngine.js:474-476` | The confirmed authoritative write site — overwrites rolling fields every renewal | (w)/(a) | Correct rolling semantics; should remain untouched by entitlement-window work. |
| 26 | `utils/renewalEngine.js:557-565` | `addBillingCycle`/`computeNextPeriodEnd` — already cadence-branching (monthly +1mo, else +1yr) | **(a)** | Not where the entitlement-window gap lives. |
| 27 | `utils/renewalEngine.js:585-593` | `applyScheduledChange`, case `BILLING_CYCLE_CHANGE` | (a) for what it does; **gap** for what it doesn't | Flips `billingCycle`/`pricePerUser` on the in-memory projection but does not itself touch `currentPeriodStart/End` — those are advanced separately at Step 6. Exact commit-order (does the new `billingCycle` persist before `computeNextPeriodEnd` reads it) not conclusively pinned down this pass — flagged as a follow-up verification, not asserted as a bug. This is the closest existing seam to where entitlement-window math will need to be inserted. |
| 28 | `utils/invoiceEngine.js:59-60, 66, 69-77, 83, 86` | `calculateCommercialAdjustments` — pure proration input, explicit guard on missing period | **(a)** | Squarely "proration within one cycle," the correct intended use. |
| 29 | `utils/addonManagement.js:260-263` | Same as #13 | **(a)** | |
| 30 | `utils/addonPurchaseLifecycle.js:133-134` | Add-on proration input | **(a)** | Same reasoning as #28. |
| 31 | `utils/prorationMath.js:18-39` | `calculateAddonProration`, `calculatePlanUpgradeProration` | **(a)** | Pure functions, correctly scoped. |
| 32 | `utils/prorationMath.js:130-142` | `calculateMonthlyToAnnualTransition(...)` | **correct-by-design** | Already scrupulously keeps `anchor`/`getEntitlementWindow()` (annual side) and `currentPeriodStart/End` (monthly-credit side) as separate, non-conflated inputs — the template the rest of the codebase should follow once wired in. |
| 33 | `models/PlanAddon.js`, `CommercialTransaction.js`, `BillingInvoice.js`, `BillingEvent.js` | No reads found | n/a | Confirmed via grep — receive pre-computed values only. |

### Non-production files also matched (excluded from the table, noted for completeness)
- `backend/scripts/backfillCAWPeriodAndTrial.js`, `backfillMissingBillingPeriod.js` — one-time migration scripts, rolling semantics, not entitlement-related.
- `backend/scripts/manualInvokeBillingJobs.js`, `verify*.js`, `trace*.js`, `checkScheduledChangeDuplicates.js` — pre-existing fixture harnesses, not part of runtime conflation risk.
- `backend/swagger.yaml`, `backend/docs/audit/*.md` — documentation, already the record of this migration's design decisions.

---

## 2. Middleware and cron/scheduled-job entitlement checks

- **`restrictByPlan.js`** — clean, no field reference at all.
- **`subscriptionCheck.js:79-80`** — confirmed latent bug (hard access-block using the rolling field for an entitlement decision), the most direct finding in this trace.
- **`subscriptionGate.js`** — clean, reasons entirely off `appStatus`.
- **Cron/scheduled jobs** (searched `node-cron`/`node-schedule`/`cron.schedule`/`setInterval` across `backend/`):
  - `jobs/subscriptionLifecycleJobs.js` — Job 3 (`* * * * *`) directly queries `currentPeriodEnd: {$lt: now}` to finalize `cancelAtPeriodEnd` cancellations. Confirmed latent bug, same shape as #21.
  - `jobs/renewalLifecycleJobs.js`, `jobs/billingOrchestration.js`, `jobs/referralLifecycleJobs.js` — reference cron scheduling but don't read `currentPeriodStart/End` directly; they call into `renewalEngine.js`, which does (items #24-27).
  - `utils/reminderJob.js` — matched the cron-keyword grep but is unrelated to billing (task/meeting reminders).

---

## 3. ScheduledChange / BILLING_CYCLE_CHANGE — write sites, read sites, and a correction to prior research

**The earlier-session finding that `BILLING_CYCLE_CHANGE` is "NOT READ BACK BY ANYTHING YET" is now STALE.** The model file's own header comment (`models/ScheduledChange.js:10-15`) still says this, describing an earlier phase (Phase 4, write-alongside) — the code has since moved to Phase 5, where `renewalEngine.js` does read it back.

**Write sites** (all in `subscriptionController.js`): `:2447,2455` creates the record for a downgrade/non-UPI cycle-change request; `:2635` emits a related `BillingEvent`; `:2860` cancels prior PENDING records when superseded; `:5168` bulk-cancels pending `PLAN_CHANGE`/`BILLING_CYCLE_CHANGE` on outright cancellation.

**Read sites — confirmed to exist:**
- `renewalEngine.js:636-641` — `buildEffectiveSubscription()` queries PENDING `ScheduledChange` with `effectiveAt <= now`, no type filter, so it matches `BILLING_CYCLE_CHANGE` too.
- `renewalEngine.js:585-593` — `applyScheduledChange()`'s explicit `BILLING_CYCLE_CHANGE` case mutates the in-memory `effective.billingCycle`/`pricePerUser`.
- `renewalEngine.js:185` (`renewSubscription`) — a real **commit-time** read, not just preview.
- `renewalEngine.js:681` (`previewRenewal`, surfaced via `getRenewalPreview`) — the "Next Renewal" preview UI also reads pending `BILLING_CYCLE_CHANGE` records.

**Conclusion:** written at multiple sites, read back and applied/priced by `renewalEngine.js` at both preview and commit time. `ScheduledChange.js`'s header comment is stale documentation, not current behavior — flagged, not fixed here.

One caveat: the `BILLING_CYCLE_CHANGE` branch changes `billingCycle`/`pricePerUser` but not `currentPeriodStart/End` directly — those are advanced separately at Step 6 via `computeNextPeriodEnd`, which reads `billingCycle` at that point. The exact write/read ordering wasn't conclusively pinned down this pass — a follow-up verification, not an asserted bug.

---

## 4. Does anything besides the future Monthly→Annual flow need an "entitlement window" concept today?

**No — not cleanly.** Two distinct claims, not one:

1. **Nothing calls `getEntitlementWindow()`/`calculateMonthlyToAnnualTransition()` outside `prorationMath.js` itself.** Confirmed by grep — zero call sites. In the narrow sense of "is the helper used anywhere yet," it's pure compute-on-demand, unconsulted.
2. **But several existing, live, already-shipped paths already need to distinguish "rolling cycle" from "entitlement expiry" and currently can't**, because they use `currentPeriodEnd` for both: `subscriptionCheck.js`'s hard access-block, the period-end cancellation cron, and the admin-cancellation email text. None of these are wrong *today* (monthly-only world) and none were introduced by Phase 3 — they predate it. But they will silently start giving wrong answers the moment any subscription's `billingCycle` becomes `'annual'` and diverges from a fresh `currentPeriodEnd`, **with no code change required to trigger the bug** — merely an annual subscription existing and passing through a renewal, admin cancellation, or that middleware. This is a materially different, higher-urgency risk than "the not-yet-built purchase flow might get it wrong."

---

## 5. Storage-decision recommendation: stored fields vs. derive-on-read

**What the trace shows:** only one write site would ever need to *decide* a transition amount/window (the not-yet-built purchase flow, already re-derivable on demand via `getEntitlementWindow`). But multiple existing *read* sites (the access gate, cancellation cron, cancellation email) would need entitlement information if fixed to stop relying on `currentPeriodEnd`. `getEntitlementWindow(anchor, now)` is cheap, pure, and needs no external reconciliation (unlike the rolling fields, which get periodically overwritten from Razorpay webhooks for legacy-path subscriptions).

**Tradeoff:**
- **Storing `entitlementWindowStart/End`** makes the several read sites a cheap field read and gives a stable value to snapshot into `CommercialTransaction`/audit records (the codebase already does exactly this for rolling periods — `commercialTransaction.target.newPeriodStart/newPeriodEnd`, stored specifically for resumability). Drift risk is unusually low for a stored-derived-value problem, since `billingAnchor` is immutable — no write path can make the window inconsistent with `getEntitlementWindow(billingAnchor, t)` unless a bug directly miscalculates it at write time.
- **Deriving on-read everywhere** avoids sync-drift entirely and needs no schema/migration — but the conflation-bug fixes (§4) would need code changes at each site regardless, and audit snapshots would still need to persist the computed window into a transaction's `target`/`payload` Mixed field at write time anyway (same pattern already used for rolling periods).

**Recommendation:** not resolvable by this trace alone — it's a scope decision. **If** fixing the §4 conflation bugs (access gate, cancellation cron, cancellation email) is in scope for the Monthly→Annual work: store `entitlementWindowStart/End`, refreshed only at renewal/transition commit (mirroring how `currentPeriodStart/End` itself is only rewritten at renewal-commit). **If** those are deferred as separate follow-up work and only the transition math itself is in scope: derive on-demand via `getEntitlementWindow()` at that single call site — simpler, zero schema change, zero drift risk.

---

## What's already safe — no change needed

- `middlewares/subscriptionGate.js` — the primary access gate, reasons entirely off `appStatus`.
- `middlewares/restrictByPlan.js` — never touches `currentPeriodStart/End`.
- `renewalEngine.js`'s core rolling-cycle machinery (`newPeriodStart`, `addBillingCycle`, `computeNextPeriodEnd`, the Step 6 write) — already correctly cadence-aware and the sole authoritative write site.
- `invoiceEngine.js`, `addonManagement.js`, `addonPurchaseLifecycle.js`, `prorationMath.js`'s existing proration functions — all correctly scoped to "proration within the current cycle."
- `addonManagement.js`'s add-on `effectiveAt` logic — already a working example of the anchor-aware pattern the base plan will eventually need.
- `prorationMath.js`'s `calculateMonthlyToAnnualTransition()` — already keeps the two concepts cleanly separate; the reference implementation.
- `PlanAddon.js`, `CommercialTransaction.js`, `BillingInvoice.js`, `BillingEvent.js` — no direct reads.
- The bulk of `subscriptionController.js`'s `effectiveAt`/`scheduledAt` sites — genuinely rolling-cycle "defer to end of what's already paid for," correct for a subscription that hasn't transitioned mid-cycle.

## Storage decision — RESOLVED: derive-on-read, no new stored fields

Decided after the hotfix landed and proved the pattern out: **do not** add
`entitlementWindowStart/End` to `Subscription`. Keep deriving via `getEntitlementWindow()`
(through the `getAccessEntitlementEnd()` wrapper) at each of the three consumer sites.

Reasoning: the three live consumers identified in this trace (`subscriptionCheck.js`, the
cancellation cron, the cancellation email) were fixed with **zero schema changes**, via a
helper that already branches and falls back correctly. That outcome is itself evidence
storage isn't needed, not a reason to add it retroactively — nothing was blocked by the lack
of a stored field. Storing would introduce a genuinely new problem that derive-on-read
doesn't have: a rollover-write question ("when, and by what code, does
`entitlementWindowEnd` advance across each 12-month boundary") with no existing answer,
adding a second source of truth that could drift from `billingAnchor` if that new write path
is ever wrong — exactly the failure class this session's discipline exists to avoid
introducing without a demonstrated need. No evidence has been produced that
`getEntitlementWindow()`'s computation cost is a real concern (it's the same order of
computation as the other proration math, not a hot-path concern) to justify taking on that
new risk.

## Hotfix landed (separate from the Phase 3 schema decision below)

Fixed the three conflation sites found in §1 (#21, #18, #16-17) via a shared
`getAccessEntitlementEnd(subscription)` helper in `prorationMath.js`: returns
`currentPeriodEnd` byte-for-byte unchanged for monthly, the real anchor-relative
entitlement window end for yearly. Applied to `middlewares/subscriptionCheck.js`,
`jobs/subscriptionLifecycleJobs.js`'s cancellation-finalization cron, and
`superAdminController.js`'s cancellation email text. Verified: `verifyAccessEntitlementEnd.js`
(5/5, pure math) and `verifySubscriptionCheckEntitlementFix.js` (4/4, drives the real
middleware against disposable Subscription docs) — full 59-fixture suite passing, 0 failures.

**Open gap flagged during this hotfix, not yet closed:** `getEntitlementWindow()` always
finds whichever anchor-relative window mathematically contains "now" — it answers "which
window are they in," not "did this window's renewal actually succeed." A failed annual
renewal must be caught by `appStatus`/`past_due` handling (`renewalEngine.js`/`retryEngine.js`),
not by this date check — same as a failed monthly renewal already relies on `currentPeriodEnd`
simply not advancing, not on this particular date comparison. **This is asserted, not yet
verified**: `retryEngine.js` has no hardcoded `billingCycle` branching (a good structural
sign), but the only existing fixture that exercises it (`verifyRetryEngine.js:76`) hardcodes
`billingCycle: 'monthly'` — no fixture has ever driven a yearly subscription through
`past_due`/retry. Before the first real annual customer's renewal payment fails, this needs
its own fixture (a `verifyRetryEngine.js`-style suite with `billingCycle: 'yearly'`) to
confirm the retry/past_due machinery actually behaves correctly for an annual cadence, not
just that nothing in it explicitly assumes monthly.

**Gap CLOSED (Task 2):** added Fixtures G and H to `scripts/verifyRetryEngine.js`, mirroring
E/F exactly with `billingCycle: 'yearly'` overridden — three consecutive failing retries
(same `pastDueSince`-relative `[24h,72h,120h]` offsets as monthly), and a successful retry
confirming `appStatus -> active` and a genuinely ~365-day renewed period (not silently
defaulting to a monthly span). **Result: 8/8 passing, no bug surfaced.** `retryEngine.js` is
now confirmed by an actual end-to-end run, not just by absence of hardcoded `billingCycle`
branches, to be cadence-agnostic. Full suite re-run: 65/65 passing (63 prior + 2 new).

## Direct answers, restated

1. **33 file:line groupings classified** in §1, each tagged (a)/(b)/write/safe with a break condition where applicable.
2. **`restrictByPlan.js` clean; `subscriptionCheck.js:79-80` a confirmed latent bug** (hard access-block on the rolling field). `subscriptionGate.js` also clean. One cron job (`subscriptionLifecycleJobs.js`'s period-end cancellation finalizer) is a confirmed latent bug of the same shape.
3. **`BILLING_CYCLE_CHANGE` IS read back today** — via `renewalEngine.js`'s `buildEffectiveSubscription()`/`applyScheduledChange()`, at both commit time (`renewSubscription`) and preview time (`previewRenewal`/`getRenewalPreview`). The "write-only stub" characterization from earlier session research is stale — accurate for an earlier phase, not current behavior. `ScheduledChange.js`'s header comment should be flagged for update (not done here).
4. **No, not cleanly** — the new helper is genuinely unconsulted, but the underlying entitlement-expiry question is already answered elsewhere today using the wrong field, in live shipped code, independent of and predating Phase 3.
5. **No single obviously-correct answer** — a scope decision. Store if fixing the §4 bugs is in scope; derive on-demand if only the transition math itself is in scope.

---

## 6. Full-sweep verification pass (post-hotfix) — confirming no site was missed, plus add-on-scope (c) bucket

**Scope of this pass:** re-verify every `Subscription.currentPeriodStart`/`currentPeriodEnd` reference across all of `backend/` outside the 3 already-fixed sites (`middlewares/subscriptionCheck.js`'s access gate, `jobs/subscriptionLifecycleJobs.js`'s cancellation cron, `controllers/superAdminController.js`'s cancellation email), classify each into exactly (a)/(b)/(c), and check `renewalEngine.js` + `ScheduledChange` read/write sites for a fourth possibility: inline reimplementation of entitlement-end math that wouldn't show up in a `currentPeriodEnd`/`getAccessEntitlementEnd` grep at all.

**Method:** independent re-grep of `currentPeriodStart|currentPeriodEnd` across the entire `backend/` tree (251 raw hits including docs/scripts), cross-checked line-by-line against §1's existing 33-item table. Result: **no new production site found** — every non-doc, non-script, non-already-fixed hit was already enumerated in §1. This section reclassifies two existing (a)-tagged groups into the new (c) bucket per this pass's stricter add-on/base-plan scope distinction, and confirms the helper's exact identity.

### 6.1 Helper verification (not assumed)

`getAccessEntitlementEnd(subscription)` — confirmed by reading the file directly, not assumed:
- **File:** `backend/utils/prorationMath.js:133-143`
- **Exported:** `backend/utils/prorationMath.js:185` (module.exports)
- **Body (verified verbatim):** branches on `subscription.billingCycle === 'yearly'`; if yearly and `billingAnchor` present, returns `getEntitlementWindow(subscription.billingAnchor, new Date()).windowEnd`; if yearly with no anchor, `console.warn`s and falls through; otherwise (monthly, or yearly-with-no-anchor fallback) returns `subscription.currentPeriodEnd` unchanged.
- **Confirmed call sites (all 3 previously-fixed sites, verified by reading each file):**
  - `middlewares/subscriptionCheck.js:4` (import), `:88` (`const entitlementEnd = getAccessEntitlementEnd(subscription);`)
  - `jobs/subscriptionLifecycleJobs.js:168` (`const entitlementEnd = getAccessEntitlementEnd(s);`, inside the Job 3 cron candidate filter)
  - `controllers/superAdminController.js:1621` (`const entitlementEnd = updatedSubscription ? getAccessEntitlementEnd(updatedSubscription) : null;`)

The believed name was exactly right — no correction needed.

### 6.2 Bucket counts (this pass)

| Bucket | Count | Meaning |
|---|---|---|
| **(a)** | 29 | Genuinely rolling billing/invoice period — correct as-is |
| **(b)** | 3 groupings / **4 physical sites** | Base-plan entitlement conflation — latent bug, same class as the 3 fixed sites |
| **(c)** | 2 | Add-on-scope entitlement — out of scope for `getAccessEntitlementEnd()`, needs its own future pass |
| (w)/write/schema/safe/n-a | 6 groups | Not a "wants X" read; provenance/schema/write sites, or confirmed clean (no reference at all) |

**Count correction (Task 0, flagged by review):** an earlier draft of this table said "(b) 2." That number came from carrying forward only §1's two *original* (b)/(b)-leaning groupings (item #1, `authController.js:351`, and item #3, `subscriptionController.js:1624-1625, 1652-1653`) without accounting for a genuine reclassification made in §6.3 below: §1 item #12 (`subscriptionController.js:4649-4650`) was originally tagged **(a)-leaning**, but this stricter full-sweep pass reclassified it to **(b)** (it's a client-facing period value with no annual-plan distinction, same defect shape as the other three) — and that reclassification was written into §6.3's prose as "b4" without the summary count above being updated to match. This was neither 4 independently-miscounted bugs nor an intentional collapsing of multiple return paths into one logical site — it was a reclassification that didn't propagate back to its own summary line. Corrected count: **3 groupings, 4 physical sites** — `authController.js:351` (1), `subscriptionController.js:1624-1625` (1), `subscriptionController.js:1652-1653` (1), `subscriptionController.js:4649-4650` (1, reclassified from (a)-leaning).

(Counts are of §1's *groupings*, several of which span multiple file:line occurrences — e.g. group 7 alone is 10 physical sites. All physical line numbers are listed below for the (b) and (c) buckets as required.)

### 6.3 Bucket (b) — full file:line list (base-plan entitlement conflation, NOT already fixed)

| # | File:Line | Snippet | Notes |
|---|---|---|---|
| b1 | `controllers/authController.js:351` | `currentPeriodEnd: subscription?.currentPeriodEnd \|\| null` returned in a `getCurrentUser`-style response | Frontend consumes this as "when do I lose access." Not triggerable today (monthly-only), becomes wrong the instant any subscription is `billingCycle: 'yearly'`. Same defect class as the 3 already-fixed sites — **not yet hotfixed**. |
| b2 | `controllers/subscriptionController.js:1624-1625` | Scheduled-change preview payload: `currentPeriodStart`/`currentPeriodEnd` sent to client | Same consumer pattern as b1 (client-facing "what's my period/access" display). Flagged conservatively — could be read by the frontend as an entitlement boundary. |
| b3 | `controllers/subscriptionController.js:1652-1653` | Same shape, second occurrence (upgrade preview payload) | Same as b2. |
| b4 | `controllers/subscriptionController.js:4649-4650` | Payment-verification response: `currentPeriodStart`/`currentPeriodEnd` | Bundled with `nextBillingDate` in the same response — lower-confidence than b1-b3, but still a client-facing period value with no distinction for annual plans. |

No new (b) sites beyond what §1 already flagged (items #1, #3, #12) — this section makes their file:line list explicit and confirms none were incidentally fixed alongside the 3 in-scope hotfix sites (they were not).

**Not fixed here, per this task's stopping condition.** These 4 physical sites are the concrete follow-up hotfix list for whoever picks up "finish the base-plan entitlement conflation cleanup."

### 6.3.1 Task 1 hotfix — landed, with a real correction to this list found during implementation

Before fixing b2/b3 (`subscriptionController.js:1624-1625, 1652-1653`), re-read them directly —
they are **NOT client-facing response payloads**. Both are `currentPeriodStart`/`currentPeriodEnd`
passed as inputs to `calculateCommercialAdjustments()`'s `adjustmentContext` (plan-upgrade proration
math). That is genuinely bucket **(a)** — proration-within-the-current-cycle, exactly the intended
use of the rolling field — not bucket (b). This was a real misclassification in this trace
(inherited into §6.3's list without re-verification), not a fix that got skipped. **b2 and b3 were
NOT touched** — touching them would have broken correct proration math to "fix" a bug that wasn't
there.

Only **b1** (`authController.js:351`) and **b4** (`subscriptionController.js:4649-4650`, the
`verifyPayment` response) were genuine client-facing entitlement claims. Both fixed with
`getAccessEntitlementEnd()`, same pattern as the 3 earlier sites.

**Verified:** `scripts/verifyBucketBEntitlementHotfix.js`, 4/4 passing (monthly unchanged /
yearly-corrected, for both b1 and b4). Full regression re-run: 59 baseline + 4 new = **63/63
passing, 0 failed.**

**Corrected bucket (b) count, final:** 2 groupings / **2 physical sites** (`authController.js:351`,
`subscriptionController.js:4649-4650`), both now fixed. The earlier "3 groupings / 4 physical
sites" count (from the Task 0 correction) itself needs one more correction: item #3
(`subscriptionController.js:1624-1625, 1652-1653`) should never have been counted as (b) at all —
it's (a). Net effect: bucket (b) is now fully resolved, 0 remaining unfixed sites.

### 6.4 Bucket (c) — full file:line list (add-on-scope entitlement, out of scope for both this trace and `getAccessEntitlementEnd()`)

Confirmed via `Subscription.js:149-169`'s `activeAddons` subdocument schema: each add-on instance carries its own `periodEnd` (Phase 2c), populated only for `billingCycle: 'yearly'` addon instances — that instance's own purchase-date-anchored 1-year window (`addedAt` + 1 year), **independent of the base subscription's `billingAnchor`**. Structurally different anchor from the base-plan entitlement window — `getAccessEntitlementEnd()` does not apply here and shouldn't be assumed to.

| # | File:Line | Snippet | Notes |
|---|---|---|---|
| c1 | `utils/addonManagement.js:263` | `existingAddon.periodEnd \|\| subscription.currentPeriodEnd` — add-on removal effective date | Already correctly prefers the add-on's own `periodEnd` when present; only falls back to the rolling field for a monthly add-on (which, per the schema's own contract, never had an independent anchor). Not a base-plan conflation — an add-on-scope question, flagged for a separate future pass. |
| c2 | `controllers/subscriptionController.js:5419` | Same pattern, inside `previewAddonRemoval` — explicitly the read-only preview twin of c1 | Same scope note as c1; the two should stay in sync if c1 is ever revisited. |

These 2 sites were tagged `(a)` in §1 (items #13/#29) under the original two-bucket legend. Under this pass's finer (a)/(b)/(c) split they're more precisely **(c)** — not wrong, just reasoning about add-on-instance entitlement rather than the rolling cycle or the base-plan window. No correctness judgment made — this is a list for a future pass, not a fix.

### 6.5 Fourth-possibility check: inline reimplementation of entitlement math

Read in full: `renewalEngine.js`'s period-related code (lines ~185, 265, 293, 471-476, 551-565, 585-593, 636-641, 681) and every `ScheduledChange` create/read site.

**No inline reimplementation of "when does access/entitlement end" was found.** Every date computation is either pure rolling-cycle arithmetic (`addBillingCycle`, `computeNextPeriodEnd`, `newPeriodStart = currentPeriodEnd`) — all (a), or `applyScheduledChange()`'s branches, which mutate `billingCycle`/`pricePerUser`/`activeAddons` on an in-memory projection but perform no date arithmetic of their own, deferring entirely to Step 6's `computeNextPeriodEnd`. The fourth possibility does not occur in this codebase today — everything funnels through either `currentPeriodEnd` directly (the (a)/(b) sites) or `getEntitlementWindow()`/`getAccessEntitlementEnd()` (the 3 fixed sites plus `calculateMonthlyToAnnualTransition()`).

### 6.6 Storage-decision status — reaffirmed, not reopened

No finding in this pass argues for a stored `entitlementWindowStart`/`entitlementWindowEnd` field. The (c) bucket (add-on-scope) is a genuinely separate, already-solved concept (its own per-instance `periodEnd`, stored since Phase 2c) and doesn't bear on the base-plan derive-on-read decision recorded above. That decision stands unchanged; this pass adds no new argument for or against it.

## 7. Task 3 — Add-on-level entitlement: concept scoping (research only)

**What "add-on-level entitlement" means, precisely:** for a `billingCycle: 'yearly'` add-on
instance, `activeAddons[].periodEnd` (Phase 2c: `addedAt` + 1 year, that instance's own
purchase-date anchor) is the analog of the base plan's entitlement window end — "when does
this specific add-on instance's paid-for period run out." For a monthly add-on instance,
`periodEnd` is `null` by design (Phase 2c never gave monthly instances an independent anchor —
they were never meant to need one), so there is no separate "monthly add-on entitlement
window" concept at all; a monthly add-on's entitlement genuinely *is* the base subscription's
own rolling cycle, same relationship a monthly base plan has to itself.

**Cross-checked against the business contract** (`PHASE2_ADDON_CYCLE_TRACE.md`'s "Business
contract" section): "Removing an annual add-on: ... Remains active until the end of its
annual period ... The annual period runs from the add-on's OWN purchase date." This is
exactly what `existingAddon.periodEnd || subscription.currentPeriodEnd` already implements —
the two known sites (`addonManagement.js:263`, `subscriptionController.js:5426`) are not
approximating the contract, they ARE the contract, verbatim.

**Does this need its own helper function, analogous to `getAccessEntitlementEnd()`?**
No — and for a reason stronger than "only two call sites." Confirmed by grep
(`\.periodEnd` across all of `backend/`): those are the **only two production reads of
`periodEnd` anywhere**, and both already do the identical one-line fallback
(`existingAddon.periodEnd || subscription.currentPeriodEnd`). Extracting a
`getAddonEntitlementEnd(addon, subscription)` helper would be a pure refactor with zero
behavior change and zero risk reduction — there's no third site that could get this wrong
independently, and no reclassification risk the way `getAccessEntitlementEnd()` solved for
the base plan (where the wrong field was read in three *different* shapes: a hard 403 gate, a
cron query, and template string interpolation). If a third genuine add-on-entitlement
consumer appears later, extracting the helper then — once there's an actual duplication
problem to solve — is the right time, not now.

**More significant finding: there is no add-on-level access-gate at all today.** The base
plan had three real "is the customer still entitled" enforcement points (a hard 403,
a cancellation-finalization cron, a customer-facing date claim). Add-ons have **zero**
equivalent — `periodEnd` is consulted only for computing a scheduled *removal's* effective
date, never for gating access to whatever the add-on unlocks (e.g. checking whether an
add-on-provided feature/seat/limit boost should still apply). This isn't necessarily a bug:
`restrictByPlan.js`'s `calculateAddonBoost()`/entitlement-boost logic (confirmed correct
in the earlier Phase 2 trace) sums boosts across every entry currently present in
`activeAddons`, regardless of cycle or `periodEnd` — i.e., today an add-on instance grants
its full boost for as long as it remains in `activeAddons` at all, and removal (whenever it
executes) is what actually revokes the boost, not a live `periodEnd` date check. Since
removal already correctly waits until `periodEnd` (via the two sites above) before ever
touching `activeAddons`, there is currently no gap between "when the boost should stop" and
"when it actually does" — the removal-scheduling mechanism already achieves the same effect
an access-gate check would, just via array membership instead of a live date comparison. No
fix needed; flagged here so this reasoning is on record rather than re-derived from scratch
if the question comes up again.

## Direct answers, restated (this pass)

1. **Full sweep confirmed complete** — independent re-grep across all of `backend/` found zero production sites beyond §1's original 33-item table.
2. **Helper verified exactly as believed:** `getAccessEntitlementEnd(subscription)`, `prorationMath.js:133-143` (exported line 185). Confirmed wired into all 3 previously-fixed call sites by direct reading, not assumption.
3. **Bucket counts, final (see §6.3.1 for the correction history):** (a) 30 [29 + item #3, reclassified from (b) after re-verification], (b) 2 physical sites [beyond the 3 already fixed] — **both now fixed**, (c) 2, remainder write/schema/safe/n-a.
4. **(b) — was unfixed, now FIXED (Task 1, §6.3.1):** `authController.js:351` and `subscriptionController.js:4649-4650` (the `verifyPayment` response). `subscriptionController.js:1624-1625,1652-1653` were initially miscounted as (b) but are genuinely (a) — proration-math inputs, not client-facing entitlement claims — confirmed by re-reading the code before fixing anything, and left untouched.
5. **(c) — separate future pass, add-on scope:** `addonManagement.js:263`; `subscriptionController.js:5419`. Both already correctly prefer the add-on's own `periodEnd`; flagged purely for scope visibility, not correctness.
6. **No inline reimplementation of entitlement math found** anywhere in `renewalEngine.js` or `ScheduledChange` sites.
7. **Storage decision not reopened** — no finding here argues for stored fields; the existing derive-on-read decision stands unchanged.
