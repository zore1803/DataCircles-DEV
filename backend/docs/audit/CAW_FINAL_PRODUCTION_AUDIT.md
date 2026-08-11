# CAW Billing — Final Production-Readiness Audit

Read-only audit. No code was modified to produce this document. Every finding cites file + line
number against the actual current code, not memory or design intent. Where a claim could not be
directly verified, that is stated explicitly rather than inferred.

---

## ⚠️ Headline finding — read this before anything else in this document

**The premise "CAW has replaced legacy Subscriptions-API billing" is false for the single most common
subscription event in this system: trial-to-paid conversion.**

Every organization starts on a trial (`startFreeTrial`, `subscriptionController.js`), which creates a
`Subscription` document immediately, with no `mandateTokenId`. `exports.createSubscription` — the CAW
onboarding path (Registration Link, `POST /create`) — is guarded to only run when **no** `Subscription`
document exists yet for the org (`subscriptionController.js:59-64`). Since every org already has one
from its trial, converting from trial to paid **never reaches `createSubscription`** — it goes to
`exports.updateSubscription` (`PUT /update`) instead, whose `!subscription.isPaymentConfirmed` branch
(lines 1158-1338) is, per the code's own comment at lines 1301-1304: *"the code path that actually runs
for the most common 'new subscriber' moment... not `exports.createSubscription`."* That branch calls
the **legacy** `razorpay.subscriptions.create(...)` (line 1269) and writes `razorpaySubscriptionId`/
`razorpayPlanId` — never `mandateTokenId`.

**Consequence:** a subscription converted this way never has `mandateTokenId` set, so it is invisible
to `runRenewalJob()`'s own query (`mandateTokenId: { $ne: null }`, `billingOrchestration.js:37`) — the
new Renewal Engine will never process it, ever. Its actual renewals continue to run entirely through
the legacy Razorpay Subscriptions-API webhook path (`subscription.charged` → `handleSubscriptionCharged`,
still fully wired in `handleWebhook`'s switch statement), completely untouched by anything built or
verified in this migration.

This means: everything verified in Parts 1-3 and 5-8 below is real, correct, and fixture/live-tested —
but it may only apply to a minority of actual subscriptions (those onboarded via the CAW Registration
Link path specifically), not the general population, if trial-to-paid conversion is in fact the
dominant signup flow in production (not independently confirmed this session — flagged as the one
fact that would need checking against real usage data before this changes the checklist verdict in
Part 8). Full evidence and the related legacy-surface findings are in Part 4.

---

## Part 1 — Architecture Verification

| Component | Status | Evidence |
|---|---|---|
| Acquisition flow (Registration Link) | Matches architecture | `subscriptionController.js` CAW onboarding path; correlates via `registrationLinkId`, per `CAW_BILLING_DESIGN.md` §7a's decided design. Live-validated this session (real mandate registration, `token.confirmed` → `payment.captured` sequence observed). |
| Registration Links | Matches architecture | Same as above — `POST /v1/subscription_registration/auth_links` flow, per `CHARGE_AT_WILL_VALIDATION.md`'s "RESOLVED" section (live-proven, not just documented). |
| Token confirmation | Matches architecture | `handleCAWTokenEvent` (`subscriptionController.js:1955`, per earlier reads this session) persists `mandateStatus`/`mandateMaxAmount`/`mandateExpiresAt` on `token.confirmed`/`paused`/`cancelled`/`rejected`, calls shared `reconcileMandate()`. |
| Renewal Engine | Matches architecture, fixture-verified | `utils/renewalEngine.js` — full R1-R13-ish flow: resume check (line 98), ScheduledChange application (line 133, `buildEffectiveSubscription`), pricing (line 173), invoice/transaction creation (183-211), charge (225-289), invoice PAID (293-305), subscription advance (311-319), BillingCycle (325-337), transaction COMPLETED (340-343), ScheduledChange EXECUTED (345-353). 7 fixtures passed this session (`scripts/verifyScheduledChangeRenewal.js`), including 2 real bugs found and fixed during that verification (appliedScheduledChangeIds not assigned in fresh path; Mongoose subdocument object-spread producing NaN pricing). |
| Retry Engine | Matches architecture, fixture-verified | `utils/retryEngine.js` — eligibility (55-57), pending-transaction check (59-70), exhaustion (72-78), timestamp gating (80-95), attempt bookkeeping (97-101), delegation to `renewSubscription()` (108), outcome handling (111-137). 6 fixtures passed (`scripts/verifyRetryEngine.js`), including direct proof of the `[24h,72h,120h]` retry-interval arithmetic against real timestamps, not just code inspection. |
| Scheduled Changes | Matches architecture | Write side: `addonManagement.js`, `subscriptionController.js` (multiple sites, cancel-prior-then-create pattern). Read side: `renewalEngine.js:409-443` (`buildEffectiveSubscription`), the first and only reader. |
| Cron jobs | Matches architecture (as of this session) | `jobs/renewalLifecycleJobs.js`, mounted in `server.js` (confirmed: `require('./jobs/renewalLifecycleJobs');`). Manually invoked with real charges this session (`RENEWED`, `RETRY_SUCCEEDED`), output recorded in `IMPLEMENTATION_PLAN_V1.md`. **Note:** `renewalEngine.js:9-10` and `retryEngine.js:5` still contain header comments claiming "Not wired into any cron... callable, not running" — stale, see Part 7. |
| Webhook handlers | Matches architecture for Acquisition; Renewal correlation added this session | `handleCAWPaymentCaptured`/`handleCAWPaymentFailed` (`subscriptionController.js:1935-2016` per this session's reads) — dual correlation: `registrationLinkId` (Acquisition) with fallback to `CommercialTransaction.target.orderId` (Renewal, via `findCompletedRenewalTransactionByOrder`, line 1926). |
| Idempotency | Matches architecture, fixture-verified | `RazorpayWebhookEvent.razorpayEventId` unique index + `recordWebhookEventOnce` (throws E11000 on duplicate, caught, returns `null`). Verified this session via a real signed duplicate-webhook fixture (`scripts/verifyRenewalWebhookReconciliation.js`, Fixture 4). |
| Repair-forward | Matches architecture, fixture-verified | `renewSubscription()`'s step-by-step "already happened?" markers (lines 225, 293, 311, 329, 340) — verified via `_injectFailureAfter` scenarios (this session's fixture suite and an earlier session's four-scenario table, recorded in `IMPLEMENTATION_PLAN_V1.md`). |
| CommercialTransaction lifecycle | Matches architecture — see Part 2 for full state machine | |
| BillingInvoice lifecycle | Matches architecture — see Part 2 | |
| BillingCycle lifecycle | Matches architecture — see Part 2 | |
| Referral handling | **Not verified this session** — out of scope for the CAW renewal/retry work traced here. `renewalEngine.js:41-43` states explicitly: "No referral modifier is constructed in this slice at all... R8's full scope is deferred." This is a documented, deliberate deferral, not a silent gap — but it means referral interaction with renewal pricing has not been audited as part of this pass. |
| Coupon handling | Minor, documented deviation | `renewalEngine.js:157-168`: reuses `subscription.appliedCoupon.discountAmount` as a flat fixed-amount modifier on renewal, explicitly **without** revalidating duration/cycles-remaining. This is named in the file's own header (lines 36-40) as deferred R7 engine work, not silently missing. |

---

## Part 2 — State Machine Audit

### CommercialTransaction.status

Schema enum (`models/CommercialTransaction.js:26-30`): `CREATED | PRICED | AWAITING_PAYMENT | FAILED | COMMITTED | COMPLETED | VOID`

For `type: 'RENEWAL'` specifically, traced transitions:

| From | To | Writer | Evidence |
|---|---|---|---|
| (create) | `PRICED` | `renewSubscription()` fresh path | `renewalEngine.js:204-211` |
| `PRICED` | `COMMITTED` | `renewSubscription()`, on successful charge | `renewalEngine.js:279` |
| `COMMITTED` | `COMPLETED` | `renewSubscription()`, after invoice/subscription/cycle steps | `renewalEngine.js:340-343` |
| `PRICED` (unchanged) | `PRICED` | Retry Engine attempt bookkeeping only mutates `attemptCount`/`lastAttemptAt`, not `status` | `retryEngine.js:99-101` |

**Impossible/unreachable states for `type:'RENEWAL'`:** `CREATED`, `AWAITING_PAYMENT`, `FAILED`, and `VOID` are all valid schema values but **never set anywhere in the RENEWAL code path traced this session.** `CREATED` is bypassed entirely (`renewalEngine.js:197-198`'s own comment: "CREATED/PRICED collapsed into one write... never lingers in CREATED"). `FAILED`/`VOID` are used elsewhere in the codebase for other transaction types (e.g. `ADDON_PURCHASE` VOID-on-recycle, per `CommercialTransaction.js:41-50`'s own comment referencing `initiateAddonPurchase`), but a `RENEWAL` transaction that fails cleanly stays at `PRICED` (`renewalEngine.js:248-267`, explicit comment: "not marked FAILED/VOID here, deliberately"). **This is intentional, not a gap** — the whole point is that Retry Engine finds it via `status:'PRICED'`.

**Transitions with no reverse:** `COMMITTED → COMPLETED` has no reverse path anywhere. **`COMPLETED` itself has exactly one reverse-adjacent write**: `handleCAWPaymentFailed`'s Phase 2 flag (`subscriptionController.js:2013`, `renewalTransaction.failureReason = note`) — this does **not** change `status`, only a sibling field. There is no code anywhere that moves a `RENEWAL` transaction from `COMPLETED` back to any earlier state. (This was a deliberate, discussed-and-reverted design decision this session — see the review history in `IMPLEMENTATION_PLAN_V1.md`'s webhook-reconciliation section.)

**Transitions with multiple writers:** None found for `CommercialTransaction.status` on `type:'RENEWAL'` — every transition traced above has exactly one writer (`renewSubscription()`). Retry Engine explicitly does not write `status` (only `attemptCount`/`lastAttemptAt`).

**Transitions lacking idempotency:** None found — every write is gated behind a "did this already happen?" check (`renewalEngine.js:225` `!== 'COMMITTED'`, `:340` `!== 'COMPLETED'`).

**The partial unique index gap, found and fixed this session:** `CommercialTransaction.js:51-59`'s unique index on `{subscription:1, type:1}` covers only non-terminal statuses (`CREATED/PRICED/AWAITING_PAYMENT/FAILED`) — `COMPLETED` is excluded by design (so a genuinely new period's transaction can be created later). This was traced in detail this session as the reason automatic reopening-into-retry was assessed as unsafe (see Part 5).

### BillingInvoice.status

Schema enum (`models/BillingInvoice.js:51`): `PENDING_PAYMENT | PAID | FAILED | VOID`

For renewal-originated invoices, traced transitions:

| From | To | Writer | Evidence |
|---|---|---|---|
| (create) | `PENDING_PAYMENT` | `renewSubscription()` fresh path | `renewalEngine.js:183-195` |
| `PENDING_PAYMENT` | `PAID` | `renewSubscription()`, after charge succeeds | `renewalEngine.js:293-301` |

**Unreachable states for renewal invoices:** `FAILED` and `VOID` are schema-valid but **never set for a `RENEWAL`-reason invoice** in any code path traced this session. A charge failure leaves the invoice at `PENDING_PAYMENT` (`renewalEngine.js:252-253`, explicit comment). The Phase 2 webhook-reconciliation flag (`subscriptionController.js:2011-2014`) explicitly does **not** touch `BillingInvoice.status` (confirmed by direct read — no `billingInvoice` variable exists in that code path at all after the Phase 2 scale-back; only `renewalTransaction.failureReason` is written).

**Transitions with multiple writers:** None found for renewal invoices — single writer (`renewSubscription()`) for both transitions.

### BillingCycle.status

Schema (`models/BillingCycle.js:18`): untyped `String`, no enum. Comment: "Derived/mirrored from `invoice.status` at read time — never written independently."

**Verified against actual write sites:** `renewalEngine.js:335` writes `status: billingInvoice.status` **at creation time only** — a snapshot, not a live mirror. If `BillingInvoice.status` changes later (it doesn't, per the above — renewal invoices only ever go `PENDING_PAYMENT → PAID`, and `BillingCycle` is only created in Step 7 *after* Step 5's `PAID` write, so in practice `BillingCycle.status` is always created already reading `'PAID'`), nothing re-syncs `BillingCycle.status`. **This is a documented design comment ("never written independently") that the code technically honors** (no second writer exists), but the comment's implication of "mirrored… at read time" is not literally true — it's a one-time copy at creation, not a live read-through. Worth naming precisely: not a bug (no divergence currently possible given the invoice is always `PAID` by the time the cycle is created), but the comment overstates what the code does.

### Subscription.appStatus

Schema enum (`models/Subscription.js`, confirmed earlier this session): `trial | active | past_due | cancelled | expired | suspended`.

**All `setAppStatus()` call sites found (whole-backend grep, 14 real call sites across 5 files):**

| File | Line | Transition |
|---|---|---|
| `subscriptionLifecycleJobs.js` | 117 | `→ expired` (trial ended, cron) |
| `subscriptionLifecycleJobs.js` | 163 | `→ cancelled` (scheduled cancellation, cron) |
| `retryEngine.js` | 115 | `→ active` (retry succeeded) |
| `renewalEngine.js` | 142 | `→ cancelled` (scheduled cancellation at renewal) |
| `renewalEngine.js` | 259 | `→ past_due` (renewal charge failed) |
| `superAdminController.js` | 1454, 1464, 1531 | admin-initiated transitions |
| `subscriptionController.js` | 582, 608, 768, 1730, 1907, 2234, 2858, 2888, 2920, 3003, 3073, 3147 | legacy + CAW webhook/onboarding transitions |

**Multiple writers, confirmed real:** `→ past_due` is written from at least 3 independent call sites (`renewalEngine.js:259`, `subscriptionController.js:582`, `subscriptionController.js:2920`) — the latter two are the **legacy** (non-CAW) webhook path. `→ active` similarly has multiple writers (CAW `retryEngine.js:115`, plus multiple legacy sites). This is expected — legacy and CAW subscriptions are genuinely different subscriptions going through different flows — but it means `appStatus`'s history is not attributable to a single subsystem, worth knowing when debugging.

**Idempotency:** `setAppStatus()` itself (`subscriptionController.js:495-521`, confirmed this session) is a no-op when `previous === newStatus` — verified directly relevant to Retry Engine safety (repeated `past_due → past_due` calls don't corrupt `appStatusHistory`, confirmed via this session's own fixture work).

---

## Part 3 — Failure Matrix

Every row below is traced to actual code, not inferred behavior. "Automatic" means the system self-recovers with no human action; "Manual" means a human must act (query, decide, act).

| Failure | Current Behaviour (evidence) | Recovery | Automatic | Manual |
|---|---|---|---|---|
| Razorpay timeout (no HTTP response) | `razorpayChargeMandate.js`'s `isDefiniteApiRejection()` check fails (no `{statusCode,error}` shape) → error rethrown → `renewalEngine.js:236-245` catches, returns `RECONCILIATION_NEEDED` | None automatic | ❌ | ✅ (only path: someone finds `RECONCILIATION_NEEDED` outcome — but per Part 6 finding, this outcome is a return value, not persisted anywhere queryable — see operational audit) |
| `payment.failed` (charge-time, synchronous) | `renewalEngine.js:248-267` — `appStatus → past_due`, transaction/invoice left non-terminal | Retry Engine, next cron tick | ✅ | — |
| `payment.captured` (webhook, on-time) | `handleCAWPaymentCaptured` — Acquisition: activates subscription. Renewal (already `COMPLETED`): no-op confirmation | N/A — no recovery needed | ✅ | — |
| Webhook duplicated | `recordWebhookEventOnce` — unique index on `razorpayEventId`, E11000 caught, silent no-op | N/A | ✅ | — |
| Webhook delayed (minutes) | No special handling — processed whenever it arrives, correlation logic doesn't care about elapsed time | N/A | ✅ | — |
| Webhook missing entirely | **No sweep/timeout job found this session for the RENEWAL path** (pending confirmation from Part 6's dedicated research) | None found | ❌ | ❌ (nothing currently surfaces this at all) |
| Server restart mid-renewal | Repair-forward: `renewSubscription()`'s Step 0 resume check (`renewalEngine.js:98-103`) finds the non-terminal transaction on next invocation and resumes from the correct step | Next cron tick or manual retry | ✅ | — |
| Cron overlap (same job, two ticks) | `renewalLifecycleJobs.js`'s in-process boolean guard (`renewalJobRunning`/`retryJobRunning`) skips the second tick | N/A | ✅ (single-process only — see Part 5) | — |
| Mongo write failure mid-sequence | Each step is a separate `await ....save()`/`.create()`; a failure between two steps leaves durable state exactly where repair-forward expects it (this is the entire design rationale stated in `renewalEngine.js:70-77`) | Next invocation resumes | ✅ | — |
| Process crash | Same as server restart — repair-forward | Next cron tick | ✅ | — |
| Razorpay 5xx | Same as timeout — no `{statusCode,error}` shape with a clean 4xx-style error → ambiguous → `RECONCILIATION_NEEDED` | None automatic | ❌ | ✅ (same visibility gap as timeout) |
| Network timeout | Same as Razorpay timeout | None automatic | ❌ | ✅ (same visibility gap) |
| Retry exhausted (3 attempts) | `retryEngine.js:73-78` — returns `RETRIES_EXHAUSTED`, `appStatus` stays `past_due`. Suspension (Chapter 7 Job 3) explicitly **not built** (`billingOrchestration.js:82-91`, `runSuspensionJob()` throws "not implemented") | None — subscription sits `past_due` indefinitely once retries are exhausted, unless a human acts | ❌ | ✅ (no tooling found this session to surface this either — pending Part 6) |
| Late `payment.failed` after `COMPLETED` | Phase 2 flag only (`subscriptionController.js:2011-2014`) — `CommercialTransaction.failureReason` set, no state change | Human review | ❌ (deliberately, per this session's design review) | ✅ (but see Part 6 — no tooling confirmed to surface `failureReason` yet) |

**Cross-cutting observation:** `RECONCILIATION_NEEDED` as a *returned outcome* from `renewSubscription()`/`retryRenewal()` (charge-time ambiguity) and `RECONCILIATION_NEEDED` as a *persisted flag* on `CommercialTransaction.failureReason` (late webhook-time ambiguity) are two different mechanisms for what is conceptually the same problem. The charge-time version is not persisted anywhere — `billingOrchestration.js:45` puts it in the returned array (`results.push(...)`), which is only durable if whatever calls `runRenewalJob()` logs or stores it. `renewalLifecycleJobs.js`'s cron wrapper does `console.log` the outcome counts (aggregate counts only, not full detail) — so a charge-time `RECONCILIATION_NEEDED` is visible in logs but not in any queryable collection, unlike the webhook-time version which lives on `CommercialTransaction.failureReason`. This asymmetry is real and worth closing (not fixed here, per this audit's no-implementation constraint).

---

## Part 5 — Security Audit

**Race conditions:**
- Cron overlap within one process: closed by the boolean guard (`renewalLifecycleJobs.js`). **Not closed across multiple processes/instances** — the guard is `let renewalJobRunning = false;` at module scope, in-memory, per-process. If this app is ever horizontally scaled (multiple Node processes/containers each requiring `renewalLifecycleJobs.js`), each process has its own independent boolean and neither knows about the other — both could run `runRenewalJob()` at the same hourly tick. **This is a real, currently-live gap** if the deployment target is (or becomes) multi-instance. Not verified this session whether the actual deployment is single- or multi-instance — flagged, not assumed either way.
- Two concurrent `renewSubscription()` calls for the *same* subscription: partially protected by `CommercialTransaction`'s partial unique index (`{subscription:1,type:1}`, non-terminal statuses) — a second concurrent `create()` for a fresh renewal would hit a duplicate-key error while one is in flight. Not itself caught/handled gracefully in `renewalEngine.js`'s current code (would surface as an uncaught Mongo error) — worth noting, not fixed here.

**Double-charge possibilities:**
- Confirmed, evidence-based, from this session's own investigation: `razorpayChargeMandate.js` creates a **new Order on every call**, no reuse, no idempotency key on the Razorpay request itself. `CHARGE_AT_WILL_VALIDATION.md` Test 5 (Scenario E, and the dedicated idempotency test) directly proved Razorpay provides **zero** dedup protection — two charge attempts against the same intent produce two independent, both-capturable Payment records.
- The one place this risk was live this session — automatic reopening of a `COMPLETED` renewal into Retry Engine on a late `payment.failed` — was implemented, identified as unsafe during review, and **reverted** to a flag-only approach (`subscriptionController.js:1997-2015`). Confirmed by direct read: no code path currently reopens a `COMPLETED` transaction.
- Residual, stated precisely in `renewalEngine.js:269-278`: if the `commercialTransaction.status = 'COMMITTED'` save (line 279-286) itself fails *after* the real charge succeeded but *before* this write commits, there is no durable record of the charge yet on a retry. The comment names this explicitly as a real, unclosed gap, closable only by an independent confirmation channel (webhook) — which exists for Acquisition but, per Part 3, has no sweep/timeout mechanism for Renewal.

**Duplicate webhook processing:** closed — `RazorpayWebhookEvent` unique index, fixture-verified this session (real signed request, same `x-razorpay-event-id` sent twice, second one no-ops).

**Idempotency gaps:** the one found and fixed this session was the `Subscription.findOne({registrationLinkId: undefined})` cross-subscription mismatch (confirmed live against real data: matches ANY subscription lacking the field) — fixed via an `invoice_id`-presence guard (`subscriptionController.js:1942-1944`, `1983-1985`). Confirmed fixed by fixture (Fixture 3, `verifyRenewalWebhookReconciliation.js`).

**Stale reads:** `renewalEngine.js`'s resume path (line 110-118) re-reads `BillingInvoice`/target period fresh from `commercialTransaction.target` rather than trusting in-memory state — correct pattern, no stale-read risk found in the traced renewal/retry path.

**Missing transactions (DB, not billing):** confirmed — this codebase does not use MongoDB multi-document transactions anywhere in the renewal/retry path (`renewalEngine.js:73` comment states this explicitly: "not a Mongo transaction... no local transaction can roll it back"). This is a deliberate design choice (the external charge can't be transactional anyway), not an oversight, but worth naming plainly: individual writes within a renewal (invoice create, transaction create, invoice link-back) are not atomic as a group, relying entirely on the repair-forward step markers instead.

**Inconsistent writes:** none found beyond the `BillingCycle.status` snapshot-vs-mirror comment overstatement noted in Part 2 — not a functional bug given current write patterns, but worth knowing.

**Missing validation:** `razorpayChargeMandate.js` throws if `mandateTokenId`/`razorpayCustomerId` are missing (a data-integrity guard, confirmed present) but does not independently validate `amount` is positive/non-zero before building the charge request — not verified this session whether `calculateInvoice()` upstream can ever produce a zero/negative total that would reach this point; not confirmed either way, flagged as unverified rather than asserted safe or unsafe.

---

## Part 6 — Operational Audit

**1. Cron registration — EXISTS.** `server.js` requires jobs files in this exact order: line 9 `utils/reminderJob` (imported as `startReminderJob`, a function reference — **not self-registering**, must be explicitly invoked; it is invoked nowhere — `server.js:242` shows the call commented out: `// startReminderJob();`), line 10 `jobs/subscriptionLifecycleJobs`, line 11 `jobs/referralLifecycleJobs`, **line 12 `jobs/renewalLifecycleJobs`**. All three lifecycle-job files self-register via `cron.schedule(...)` at require-time. `jobs/billingOrchestration.js` remains correctly non-self-registering (its own header comment says so, lines 1-8) — it only exports functions that `renewalLifecycleJobs.js` calls.

**2. Startup order — a real, previously-unflagged ordering gap.** `mongoose.connect(...)` is called at `server.js:238`, **after** all three cron-registering `require(...)` calls (lines 9-12). Requiring a jobs file only registers the schedule (the callback doesn't run until a tick fires), so in practice this is not dangerous today — `subscriptionLifecycleJobs.js`'s fastest job is every-minute, `mongoose.connect()` typically resolves in well under a second — but there is **no explicit ordering guarantee**. If `mongoose.connect()` were slow, retried, or failed on a given deploy, a cron tick landing in that window would run Mongoose queries against a not-yet-connected (or reconnecting) database. Nothing in `server.js` sequences cron registration to happen only after a successful DB connection.

**3. Logging — mostly consistent, with a real gap.** `jobs/renewalLifecycleJobs.js`, `jobs/subscriptionLifecycleJobs.js`, `jobs/billingOrchestration.js` all use consistent `console.log`/`console.error` with a `[filename]` bracket prefix. `controllers/subscriptionController.js` is inconsistent — some CAW-specific logs are prefixed (e.g. `[handleCAWPaymentFailed]`), many other catch blocks (e.g. lines 907, 920, 2796, 2828) log with plain unprefixed strings. **`utils/renewalEngine.js`, `utils/retryEngine.js`, and `utils/razorpayChargeMandate.js` contain zero `console.log`/`console.error` calls of their own** — confirmed by search, not assumed. This means the actual charging/renewal/retry logic produces no log output at all on its own; visibility depends entirely on the caller (`billingOrchestration.js`'s two log lines, which only report aggregate outcome counts, not per-subscription detail beyond what's in the returned array). No fully silent (unlogged) catch blocks were found in `subscriptionController.js` — every sampled catch block does log something.

**4. Monitoring — DOES NOT EXIST.** Whole-backend search for Sentry, Datadog, PagerDuty, Slack-webhook, or ops-alert-email integration found no hits anywhere in billing-related code (the only email utilities found are customer-facing transactional/reminder emails, unrelated to failure alerting). No external monitoring/alerting service is wired into the CAW billing paths, nor does one exist elsewhere in the backend that could be reused.

**5. Reconciliation flags — confirmed exactly as documented in Part 3/5, plus one addition.** `CommercialTransaction.failureReason` (`models/CommercialTransaction.js:37`) is a plain `String`, no enum, no dedicated collection. The only write site in the entire backend is `subscriptionController.js:2013`. **The only reader anywhere in the backend is the verification script's own assertion** (`scripts/verifyRenewalWebhookReconciliation.js`) — no route, admin controller, or dashboard reads `failureReason` back out. This confirms precisely what was suspected: the flag is currently write-only in production terms — it exists in the database but nothing surfaces it to a human without a manual database query.

**6. Cleanup jobs — DOES NOT EXIST.** No job anywhere deletes or archives stale/orphaned `BillingInvoice`, `CommercialTransaction`, `BillingCycle`, or `RazorpayWebhookEvent` documents. (`referralLifecycleJobs.js` has an unrelated "invite-expiry sweep" that only touches `Referral.status` — not a billing-document cleanup job, despite the naming similarity.)

**7. Timeout jobs — DOES NOT EXIST.** No cron job or callable function anywhere checks for a `CommercialTransaction`/`BillingInvoice` stuck in a non-terminal state (`PRICED`/`COMMITTED`/`PENDING_PAYMENT`) past a time cutoff. The closest-related code, `runSuspensionJob()` (`billingOrchestration.js:82-91`), is an explicit stub that throws `'not implemented'` — and even that is about grace-period suspension of already-`past_due` subscriptions, not a "webhook never arrived" safety net. This is the same gap named in Part 3's failure matrix ("Webhook missing entirely" row) — now confirmed by dedicated search, not inferred.

---

## Part 7 — Documentation Audit

Comparing `IMPLEMENTATION_PLAN_V1.md`, `CAW_BILLING_DESIGN.md`, `CHARGE_AT_WILL_VALIDATION.md` against
the actual current code.

### `IMPLEMENTATION_PLAN_V1.md`

**Outdated/incorrect — the document's own top-level "Summary" section.** Quote (this doc, near its
end, predating the later-appended cron-wiring section): *"the Renewal and Retry Engines — arguably
the two most important pieces of a subscription billing system — **do not exist in any form yet**."*
This is false as of this session — both engines are fully built (`utils/renewalEngine.js`,
`utils/retryEngine.js`), fixture-verified, and running hourly via cron. The Summary section was never
revised after the engines were built; a reader who stops there gets a materially false picture. The
document does correct itself later (its own "Cron wiring" section, added this session, is accurate),
but the earlier Summary contradicts it and was left standing.

**Incorrect — `handleCAWPaymentFailed` correlation-key description.** An earlier passage in this doc
describes `handleCAWPaymentFailed` as matching *only* via `registrationLinkId`, with no order-based
correlation path. This is no longer true — `subscriptionController.js:1926-1933` and `1979-2016` now
add a `CommercialTransaction.target.orderId` correlation fallback for renewal payments, added this
session. The doc's own later "Cron wiring" section doesn't mention this fix either, despite it being
implemented in the same overall session — the webhook-correlation work and the cron-wiring work were
documented in different passes and never cross-referenced.

**Undocumented — the renewal webhook-correlation fix and `RECONCILIATION_NEEDED` flagging.** No
reference anywhere in any of the three docs to `findCompletedRenewalTransactionByOrder()`
(`subscriptionController.js:1926-1933`), to renewal-payment webhook correlation via `order_id`, or to
the `failureReason`-based manual-review flag (`subscriptionController.js:1997-2016`) — including its
explicit, deliberate "flag, don't auto-reopen" policy and the double-charge-risk rationale documented
only in the code comment, never in a design doc.

### `CAW_BILLING_DESIGN.md`

**Diverges — the single most significant finding in this audit.** This document's own Decision
Register lists, as **"✅ DECIDED"**: *"Cron initiates, webhook confirms"* — with an explicit renewal
pseudocode block reading *"open a BillingCycle (status=pending); Create Order; Charge Mandate → **do
NOT mark success here** — [webhook] `payment.captured` → cycle=paid, advance period."*

The actual implementation does the opposite: `renewalEngine.js:225-343` marks
`CommercialTransaction.status = 'COMMITTED'` (line 279), `BillingInvoice.status = 'PAID'` (line 294),
advances the subscription's period (lines 311-315), and creates the `BillingCycle` (lines 325-337) —
all synchronously, inside one function call, based purely on the charge call's return value, without
ever waiting for a webhook. This is not an accidental drift discovered now — it was a conscious,
extensively-discussed decision made and re-confirmed across this session's design-review exchanges
(see this document's own "webhook reconciliation" discussion), and the code itself documents the
optimistic-completion rationale directly (`subscriptionController.js:1956-1962`). **But
`CAW_BILLING_DESIGN.md`'s own Decision Register was never updated to reflect this reversal** — it
still reads as the authoritative, decided architecture, and directly contradicts what was actually
built and then re-affirmed as the intentional design. This is the clearest, most consequential
documentation-vs-code gap found in this audit — not because the implementation is wrong (it was
deliberately, repeatedly reasoned through this session and landed on optimistic-completion +
flag-only reconciliation as the safer choice), but because the design doc still asserts the opposite
as decided fact.

**Diverges — mandate-cap pre-charge guard (§10 of the design doc).** The design doc describes an
application-level guard comparing `invoice.total <= mandateMaxAmount` before ever calling Razorpay,
branching to a distinct "mandate-cap path" on failure. No such guard exists in `renewalEngine.js` —
`razorpayChargeMandate.js` submits the charge directly and treats a mandate-cap rejection identically
to any other clean Razorpay rejection (a generic `{success:false, reason}`). There is no distinct
mandate-regeneration branch anywhere.

**Diverges (self-resolved elsewhere) — `retrying` as a persisted status.** The design doc's state
diagram presents `retrying` as a real, distinct `Subscription.appStatus` value. `retryEngine.js:7-9`
states outright it is documentation shorthand only — the subscription stays `past_due` throughout.
`IMPLEMENTATION_PLAN_V1.md` already resolves this contradiction explicitly elsewhere in its own text,
but `CAW_BILLING_DESIGN.md` itself was never corrected, so a reader of that doc alone would be misled.

**Diverges/outdated — `pendingUpdate` vs. `ScheduledChange` as the downgrade read path.** The design
doc describes the renewal cron as reading a `pendingUpdate` field to apply scheduled downgrades.
`renewalEngine.js:126-131` states explicitly the opposite is now true — it reads exclusively from
`ScheduledChange`, and must never also read `pendingUpdate`. The design doc's fix was superseded by a
different model entirely, and the doc was never updated to reflect the swap.

### `CHARGE_AT_WILL_VALIDATION.md`

**No material discrepancies found.** This document is an explicitly time-boxed, honest record of
throwaway pre-implementation validation-script evidence ("no production code was modified to produce
this evidence") — it makes no ongoing claims about the current state of the engines, and its concrete
findings (e.g. `recurring: '1'` as a string, not `recurring: true`) remain consistent with the current
code (`razorpayChargeMandate.js` still uses the string form, matching this doc's own conclusion, and
matching the one live-verified success this session actually built on).

---

## Part 4 — Dead Code Audit

### Genuinely dead (shadowed by a later declaration, never executed)

- **`handlePaymentFailed`**, first declared `subscriptionController.js:565-587` — completely shadowed by a second declaration at **line 2905-2936** (same top-level module scope; JS hoisting means the later one wins). Every call site resolves to the line-2905 version. The line-565 body never executes. Not equivalent: the live (2905) version additionally emits a `PAYMENT_FAILED` billing event.
- **`handleSubscriptionHalted`**, first declared `subscriptionController.js:601-611` — shadowed by a second declaration at **line 3136-3151**, which is the one `handleWebhook` actually calls (line 2125). Near-identical bodies otherwise.
- **`exports.maybeQualifyReferral`** (line 488) and **`exports.reconcileMandate`** (line 2047) — the functions themselves are live (used internally via their unexported local names), but the `exports.X = X` re-export lines have zero external consumers anywhere in the backend. The export statements are dead; the functions are not.

### Deliberate stub, not drift

- **`runSuspensionJob()`** (`billingOrchestration.js:82-93`) — zero call sites anywhere, always throws `'not implemented'`. This is a documented, intentional placeholder for the unbuilt Chapter 7 "Suspension" scheduler job, not accidental dead code — but its practical effect is real: **nothing in this codebase currently transitions a subscription from `past_due` to `suspended` on grace-period expiry.** Retry-exhausted subscriptions sit at `past_due` indefinitely with no further automatic action (cross-referenced in Part 3's failure matrix).

### Provably unreachable branches

- **`ScheduledChange.type === 'REDUCE_QUANTITY'`** (`renewalEngine.js:393-398`) — a valid schema enum value, but no production code anywhere creates a `ScheduledChange` with this type (only a test fixture does). The throw-loudly guard is intentional and correct, but the branch itself is dead in production today.
- **`Subscription.status` enum values `'paused'`/`'completed'`/`'expired'`** (`models/Subscription.js:61-65`) — never explicitly assigned by application code (only `'created'/'authenticated'/'active'/'halted'/'cancelled'` are). Two sites do a dynamic passthrough of Razorpay's own returned `status` string (lines 2227, 3339), so these values are not *provably* impossible, but no application branch anywhere checks for them — only `appStatus` (a separate field) is used for real gating logic.

### Duplicated logic (copy-paste-drift risk, not incorrect today)

- The VOID-prior-then-create `CommercialTransaction` sequence is independently implemented at 4+ sites (upgrade `:960-981`, downgrade `:1482-1504`, cancellation `:1700-1721` and again `:1770-1802`, addon purchase via an injectable-function variant in `addonPurchaseLifecycle.js:20-21,100-122`) rather than through one shared helper. All four are logically equivalent and currently consistent, but a future fix to the VOID status-list would need to be applied in every site independently.
- The `COMMITTED → COMPLETED` two-step `CommercialTransaction` update is likewise repeated verbatim at 5+ sites (`:1541-1550`, `:1793-1802`, `:2307-2321`/`:2393`, `:2519-2535`/`:2709-2715`). Same drift risk, not a present bug.

### Legacy Subscriptions-API surface — reachable, not dead (see headline finding above)

Confirmed live, reachable usages beyond the trial-to-paid conversion path already covered above:
`razorpay.subscriptions.create` (`:1269`, `:3111` region), `.fetch` (`:826`), `.cancel` (`:1096, 1262,
1753`), `.update` (`:1515, 2212, 2678`; `addonManagement.js:344`), `findOrCreateRazorpayPlan`
(`:1257`, wraps `razorpay.plans.create`). `handleWebhook` still dispatches to all six legacy
Subscriptions-API webhook handlers unconditionally on every incoming webhook
(`subscription.authenticated/activated/charged/cancelled/halted`, plus both legacy and CAW handlers
for `payment.captured`/`payment.failed` running back-to-back). None of this is orphaned — it's the
live path for any subscription carrying a `razorpaySubscriptionId`, which per the headline finding
includes ordinary trial-to-paid conversions, not just legacy grandfathered accounts.

**Not present:** the CAW-specific files themselves (`renewalEngine.js`, `retryEngine.js`,
`razorpayChargeMandate.js`, `billingOrchestration.js`, `renewalLifecycleJobs.js`) are cleanly
CAW-only — no legacy Subscriptions/Plans API calls found in any of them.

### Documentation-accuracy cross-finding

The header comments in `CommercialTransaction.js:9-10`, `BillingInvoice.js:13-14`,
`BillingCycle.js:8-9`, and `ScheduledChange.js:11-15` all still say **"NOT READ OR WRITTEN BY ANY
CONTROLLER YET"** / "inert until later phases" — stale, all four collections are now actively
read/written by live code. Same class of finding as Part 7, listed here because it was surfaced
independently by this research pass too.

---

## Part 8 — Production Checklist

| Item | Status | Basis |
|---|---|---|
| Acquisition (Registration Link onboarding) | ✅ Complete | Live-validated this session; correlates correctly |
| Token confirmation / mandate reconciliation | ✅ Complete | `reconcileMandate`, live-tested webhook sequence |
| Renewal Engine | ✅ Complete | 7 fixtures passed, 2 real bugs found & fixed |
| Retry Engine | ✅ Complete | 6 fixtures passed, retry-interval arithmetic proven with real timestamps |
| Scheduled Changes (write + read) | ✅ Complete | Write sites + `renewalEngine.js`'s read path, fixture-verified |
| Repair-forward | ✅ Complete | `_injectFailureAfter` scenarios, all resume correctly |
| Webhook idempotency | ✅ Complete | `RazorpayWebhookEvent` unique index, fixture-verified |
| Renewal webhook correlation | ✅ Complete | Fixed and fixture-verified this session; real cross-subscription bug found and closed |
| Cron wiring | ✅ Complete | Mounted, hourly, real-charge manual invocation confirmed |
| CommercialTransaction / BillingInvoice / BillingCycle lifecycles | ✅ Complete for `type:'RENEWAL'` | Full state machine traced, Part 2 |
| **CAW as the actual onboarding path for the common case (trial→paid)** | ❌ **Missing** | **Headline finding — trial-to-paid conversion never reaches CAW's `createSubscription`; it runs the legacy Subscriptions-API path instead** |
| Legacy-path subscriptions covered by the new Renewal/Retry Engines | ❌ **Missing** | Direct consequence of the above — `mandateTokenId`-gated queries never see legacy subscriptions |
| `RECONCILIATION_NEEDED` reconciliation, automated | ⚠ Needs Attention (deliberately deferred) | Flag-only by design, pending Razorpay terminal-state evidence — correct as a Phase 1, not a gap |
| `RECONCILIATION_NEEDED` visibility to a human | ❌ Missing | No route/dashboard/alert reads `failureReason` anywhere; only a manual DB query can see it |
| Charge-time `RECONCILIATION_NEEDED` (ambiguous synchronous errors) persistence | ❌ Missing | Only returned in-memory from `runRenewalJob`/`runRetryJob`, logged as aggregate counts only, not persisted per-subscription |
| Timeout/sweep job for "webhook never arrives" | ❌ Missing | Confirmed by dedicated search — does not exist |
| Cleanup job for stale billing documents | ❌ Missing | Confirmed by dedicated search — does not exist |
| Suspension job (`past_due` grace-period expiry) | ❌ Missing | Explicit stub, throws `not implemented` |
| Monitoring/alerting integration | ❌ Missing | No Sentry/Datadog/PagerDuty/Slack/email-alert integration anywhere near billing code |
| Cross-process cron locking | ⚠ Needs Attention | In-process boolean guard only; safe if single-instance, unverified whether deployment is single-instance |
| Startup ordering (cron vs. DB connect) | ⚠ Needs Attention | Cron files required before `mongoose.connect()`; not dangerous today given job intervals, but no explicit guarantee |
| Logging coverage in core engines | ⚠ Needs Attention | `renewalEngine.js`/`retryEngine.js`/`razorpayChargeMandate.js` produce zero log output of their own |
| Documentation accuracy (`CAW_BILLING_DESIGN.md`, `IMPLEMENTATION_PLAN_V1.md`) | ⚠ Needs Attention | Several stale/contradictory passages found, Part 7 — most importantly the "cron initiates, webhook confirms" Decision Register entry contradicting the actual optimistic-completion design |
| Dead/shadowed code (`handlePaymentFailed`, `handleSubscriptionHalted` duplicates) | ⚠ Needs Attention | Confirmed shadowed, currently harmless (only the later declaration ever runs), but confusing for future maintenance |
| Mandate-cap pre-charge guard (§10 of design doc) | ⚠ Needs Attention | Designed, not implemented — relies entirely on Razorpay's own rejection instead |
| Referral / coupon interaction with renewal pricing | ⚠ Needs Attention | Referral not audited this pass (out of scope); coupon revalidation explicitly deferred, documented |

No recommendations beyond status, per this audit's own constraint.
