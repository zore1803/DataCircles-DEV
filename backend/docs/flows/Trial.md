# Capability Audit — Trial

> Method: `audit/FLOW_AUDIT_TEMPLATE.md`. Business contract lives in
> `audit/BusinessContracts.md#trial` (do not duplicate it here — this doc
> proves it). Interactions with other capabilities live in
> `audit/InteractionMatrix.md` (search "Trial |").

## 1. Purpose
Let a brand-new organization experience the product with zero friction before
paying — full Growth-tier access for 7 days, no card required — to drive
conversion to a paid plan.

## 2. Business contract
See `audit/BusinessContracts.md#trial` — every guarantee tagged and evidenced there.

## 3. NOT guaranteed / unknown
See `audit/BusinessContracts.md#trial` "NOT guaranteed" section — this is the testing backlog.

## 4. Entry points
- **API:** `POST /subscription/trial` → `requireAuth`, `adminMiddleware` → `subscriptionController.startFreeTrial` (routes/subscription.js:35).
- **Frontend:** `SubscriptionPlans.jsx` trial card → `TrialModal.jsx` confirmation ("Start Your Free Trial — Get access to all Growth plan features for 7 days. No credit card required.") → confirm → API call.
- No other entry point found (no Super Admin "grant trial" traced this pass — ❓).

## 5. Preconditions
- Org must not have `Subscription.trialUsed === true` (subscriptionController.js:406). This is the **only** guard — see Finding #2.

## 6. Complete execution trace (Verified)
```
POST /subscription/trial → startFreeTrial (subscriptionController.js:400)
  1. Subscription.findOne({organization})
  2. if existingSubscription?.trialUsed → 400 reject "Free trial already used"
  3. trialStart = now; trialEnd = now + 7 days
  4. new Subscription({                          ← INSERT, not update (see §7)
       organization, razorpayPlanId:'plan_trial' (literal placeholder, not a real Razorpay plan),
       planName:'growth'  ← HARDCODED STRING, not a PlanConfig lookup,
       status:'active', billingCycle:'monthly', pricePerUser:0, totalAmount:0,
       trialStart, trialEnd, isTrialActive:true, trialUsed:true,
       currentPeriodStart:trialStart, currentPeriodEnd:trialEnd,
     })
  5. setAppStatus(subscription, 'trial', 'trial started')  ← the field subscriptionGate actually reads
  6. subscription.save()
  7. emitBillingEvent({eventType:'TRIAL_STARTED', effectiveAt: trialEnd})
  8. try { sendTrialStartedEmail() } catch — best-effort, never blocks trial creation
  9. respond { success, message, subscription }
```
No Razorpay API call anywhere in this path.

## 7. Database changes (Verified)
- **`Subscription`** — a NEW document is inserted (`new Subscription(...)`, not `findOneAndUpdate`). Fields: see trace above. `isPaymentConfirmed` and `paymentStatus` are left at their Mongoose schema defaults (`false` and `'pending_payment'` respectively) — **never explicitly set by this handler.** This default-leak is the root cause of Finding #1 below.
- **`BillingEvent`** — one `TRIAL_STARTED` row.
- **`Referral`, `Reward`, `CouponRedemption`** — untouched.

## 8. UI changes
- **Observed:** pricing page shows "Free Trial Active — Growth Plan Features — 7 days remaining (Ends: 17 Jul 2026)" banner + toast "Free trial activated! Enjoy all Growth features for 7 days." Growth plan card's button changes from "Subscribe" to **"Complete Payment"** (see Finding #1 — this is not what it appears to be). Billing page shows plan "Growth · ACTIVE · ₹0/mo," timeline entry "Free Trial Started · Growth · Ends 17 Jul 2026." Dashboard shows a "Trial ends in 7 days / Upgrade Now" banner.
- **Component sourcing:** the trial-active pricing-page banner and dashboard countdown banner components were **not individually traced this pass** — ❓, flagged for a follow-up trace.
- **Before trial (Observed):** every CRM page (Companies, Deals, Products, etc.) showed "No subscription found. Please subscribe to continue." repeated once per module/route (see §11), plus "Failed to fetch..." toasts from the underlying list-fetch calls failing.

## 9. State transitions (real enums)
```
(no Subscription doc) → appStatus='trial'                         [startFreeTrial]
trial → expired                                                    [cron, Verified — §10]
trial → active                                                     [real payment confirms; not traced end-to-end this pass]
trial → cancelled                                                  ❓ not traced
```

## 10. BillingEvents / emails / analytics
- `TRIAL_STARTED` — **Verified** emitted at creation.
- `TRIAL_ENDED` — **Verified** emitted by the expiry cron (below), not by any lazy/request-time check.
- **Reminder emails (48h/24h before expiry)** — **Verified** real and wired: `jobs/subscriptionLifecycleJobs.js` Job 1, registered at server startup (`server.js:7`), cron `* * * * *`, sends each reminder at-most-once via `trialReminder48hSent`/`trialReminder24hSent` flags. **This corrects an earlier documented doubt** ("may not exist") — they exist.
- **Expiry** — **Verified**: Job 2 in the same file, cron `* * * * *` (so expiry is enforced within ~60s of `trialEnd`, not at a fixed clock time), sets `isTrialActive=false`, `setAppStatus(...,'expired',...)`, emits `TRIAL_ENDED`, sends `sendTrialExpiredEmail()` best-effort.
- **Analytics/metrics** — ❓ not found this pass, likely absent.

## 11. Access control (Verified — full trace)
```
subscriptionGate (middlewares/subscriptionGate.js)
  reads subscription.appStatus
  FULL_ACCESS_STATUSES = ['trial','active','past_due']
  'trial' → next() unconditionally (all methods, not just reads)
  before trial: no Subscription doc → 'no_subscription' → GETs pass through, writes get 402

restrictByPlan(moduleName, 'read'|'write') (middlewares/restrictByPlan.js)
  runs AFTER subscriptionGate, on a per-module basis (companies, deals, etc. each wire it separately)
  if NO subscription doc at all → 403 "No subscription found. Please subscribe to continue." (line 134 — the exact repeated string Observed)
  else: PlanConfig.findOne({ planId: subscription.planName })  ← planName='growth' for trial, SAME lookup a paid Growth subscriber gets
  checks plan.features.modules[moduleName].read/write + per-module numeric limit against real counts
```
**This fully explains the Observed behavior:** trial creates a real `Subscription` with `planName:'growth'`, so `restrictByPlan` grants exactly what a paying Growth subscriber gets — genuinely correct architecture, not a special case. The repeated pre-trial error message is `restrictByPlan` firing independently per module/route (Companies, Deals, Contacts, company-fields are separate calls), not a single shared gate.

**Note:** `restrictByPlan` has no read-exception for missing subscriptions (unlike `subscriptionGate`) — it 403s GETs too when there's no Subscription doc.

**Cross-module inconsistency (Verified, full writeup in `KNOWN_BILLING_GAPS.md`):** `routes/itemRoutes.js` (Products & Services) only chains `subscriptionGate`, never `restrictByPlan` — so its list loads with zero subscription, while Companies/Deals/Contacts (which chain both) 403. This exactly matches the walkthrough's Observed inconsistency (`audit/UserObservations.md`).

## 12. Interactions with other capabilities
See `audit/InteractionMatrix.md`, rows starting "Trial |". Summary of what's known: Trial+Referral(referrer side) verified fine; Trial+Referral(qualifying) verified correctly blocked; Trial+Rewards unenforced (no gate exists either way); Trial+Coupon, Trial+Add-on, Trial+Downgrade all ❓ unknown.

## 13. Edge cases
| Scenario | Status |
|---|---|
| Second trial attempt after using one | **Verified blocked** (`trialUsed` guard) |
| Second `Subscription` document created for an org with a prior non-trial subscription that never set `trialUsed` | **Verified as a code-level risk** (see Finding #2), not yet Observed |
| Trial expiry timing (exact moment) | **Verified**: cron polls every minute, not a fixed clock event |
| Trial + real payment race (converting mid-trial) | ❓ not traced |
| Super Admin trial extension/adjustment | Traced to exist (`superAdminController.js` ~line 1453), not fully walked |

## 14. Findings

**Bug — UI mislabel, Verified.** Business issue + technical cause fully split out in `KNOWN_BILLING_GAPS.md` ("Growth plan card shows 'Complete Payment' during an active trial") — do not re-summarize here, that doc is the source of truth for this finding.

**Architecture risk — data integrity, Verified (not yet Observed).** The second-Subscription-document risk. Full writeup: `KNOWN_BILLING_GAPS.md` is the intended home but **not yet written there** — currently only documented in this file and `audit/ProductionChecklist.md`. ⚠ open action: port this into `KNOWN_BILLING_GAPS.md` in the same before/after format as the other entries.

**UX gap — no reachable "Start Trial" CTA outside the pricing page, Verified (component-level).** Full writeup in `KNOWN_BILLING_GAPS.md`. Raw evidence + the user's regression suspicion: `audit/UserObservations.md`.

**Cross-module access-control inconsistency (Products & Services vs. Companies/Deals), Verified.** Full writeup in `KNOWN_BILLING_GAPS.md`.

**Dead code, Verified:**
`middlewares/subscriptionCheck.js` (`checkSubscriptionLimits`) is a complete, unused, second implementation of trial-expiry + access checking. Grepped every route file — zero references. It also has an internal correctness bug (checks `subscription.status`, not `appStatus`, which is what `subscriptionGate` actually reads) — but it's dead, so this bug is currently inert. Full writeup (status/risk/effect/recommendation format): `KNOWN_BILLING_GAPS.md`.

**Corrected assumption:**
Trial reminder emails were suspected possibly-missing; they exist and are correctly wired (48h/24h, sent-once guards). → noted in `audit/BusinessContracts.md#trial`.

**Confirmed-good architecture:**
Trial reuses the exact same `appStatus`/`restrictByPlan` machinery as paid plans — no separate trial-only access path, no duplicated feature list (feature parity is structural, via the shared `PlanConfig` lookup, not a copy that could drift). Expiry is enforced by a real, registered, correctly-`appStatus`-aware cron, not a lazy/unverified check as the earlier doc scaffold guessed.

## 15. Improvement ideas (deferred — not yet agreed/implemented)
- Explicitly set `paymentStatus` (e.g. a distinct value, or leave `isPendingPayment()` from also true-ing on trial) so the Growth-card label reflects reality.
- Add a unique index on `Subscription.organization`, or a stronger precondition in `startFreeTrial` (check for ANY existing subscription, not just `trialUsed`).
- Remove `middlewares/subscriptionCheck.js` (confirmed dead) — or wire it in deliberately if some future need calls for it, replacing its `status` check with `appStatus`.
- Trace the two unlocated frontend banner components.
- Add a "Start Free Trial" CTA to the header/dashboard for the true-no-subscription state (currently the promo banner renders nothing at all in that state).
- Resolve the Products-vs-Companies access-control inconsistency (decide: gate reads everywhere, or don't gate reads anywhere).

## 16. Documentation completeness audit (per the user's explicit request — Layer 1/2/3 check)

Every raw observation in `audit/UserObservations.md` "Session 1" compared
against what actually got documented. Checklist — ✅ = has a home, ⚠ = home
created/updated THIS pass, ❌ = still nowhere.

| Raw observation | Documented? | Where |
|---|---|---|
| Org creation → redirected straight to pricing (no interstitial) | ⚠ (was missing, now stubbed) | `flows/SubscriptionAcquisition.md` (new) |
| "No subscription found" ×3 stacked + "Failed to fetch..." on Companies/Deals/Contacts | ✅ was captured, but as a summarized conclusion only | Raw evidence now preserved verbatim in `UserObservations.md`; technical cause in `flows/Trial.md` §11 |
| Products & Services list loaded FINE despite no subscription (inconsistent with above) | ⚠ was NOT investigated at all in the original pass | Now traced + written up in `KNOWN_BILLING_GAPS.md` |
| Referrals page fully accessible pre-subscription | ⚠ only implicitly captured via InteractionMatrix row; the page-accessibility observation itself was not | `flows/SubscriptionAcquisition.md` (new) §3 |
| Billing page fully accessible pre-subscription, "billing is perfect... didn't even ask for this" | ❌ was completely absent from the original pass | `flows/SubscriptionAcquisition.md` (new) §3 |
| "there should be a start trial button whichever page i go... now its not there anymore" | ❌ was completely absent — the single clearest miss | `KNOWN_BILLING_GAPS.md` (new entry) + raw claim preserved in `UserObservations.md` |
| Referred-org first-invoice-discount product idea (trial/no-subscription referee) | ⚠ existed only in PROJECT_STATE.md's general future-enhancement note, not linked to this specific walkthrough moment | `flows/SubscriptionAcquisition.md` (new) §4, cross-referenced |
| Trial modal exact copy, dates rendering correctly | ✅ | `flows/Trial.md` §6/§8 |
| Growth card → "Complete Payment" + the suggestion of a clearer label | ⚠ technical cause was captured originally, but the ORIGINAL suggestion (better label) and the technical finding were collapsed into one — now split | `KNOWN_BILLING_GAPS.md` (business issue vs. technical cause, separated) |
| CRM CRUD "worked as intended" (fake seed data, create company) | ✅ (explicitly out of scope, noted for completeness only) | `UserObservations.md` |
| Billing page after trial (timeline, payment history) | ✅ | `flows/Trial.md` §8/§10 |
| Dashboard banner "Trial ends in 7 days · Upgrade Now" | ⚠ component was flagged unlocated originally; NOW located (`Header.jsx` ~line 1229) as part of the missing-CTA investigation | `flows/Trial.md` §8 note + `KNOWN_BILLING_GAPS.md` |
| Dead-code finding (`subscriptionCheck.js`) | ⚠ existed, but as a flat description; now in Status/Risk/Effect/Recommendation format | `KNOWN_BILLING_GAPS.md` |

**Still ❌ / open after this pass:**
- The "used to be there, now isn't" regression claim for the Start Trial CTA — cannot be confirmed or refuted without git history (unavailable in this environment). Recorded as an unverified user claim, not asserted as fact either way.
- Whether Billing/Referrals being pre-subscription-accessible is a deliberate product decision vs. accidental (an unrouted route) — flagged in `SubscriptionAcquisition.md` §3, needs an explicit answer, not an inference.
- Trial + Coupon, Trial + Add-on, Trial + Downgrade interactions — still ❓ in `InteractionMatrix.md`, not part of this completeness pass (those are new investigations, not lost evidence).

**Conclusion: Trial capability is not being declared 100% complete.** The
implementation trace is essentially done; the interaction matrix is not, per
the checklist above and per `audit/BusinessFlowAudit.md`.
