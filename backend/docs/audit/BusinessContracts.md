# Business Contracts

> What each capability **guarantees** — in business language, not
> implementation. One section per capability. Every line carries an
> Observed / Verified / Assumed / Impossible / Future tag (see
> `FLOW_AUDIT_TEMPLATE.md`). A contract is only trustworthy once every line
> is Verified or explicitly marked otherwise — no silent assumptions.

---

## Trial

| Guarantee | Status | Evidence |
|---|---|---|
| One trial per organization | **Verified** (with a caveat) | `startFreeTrial` blocks a second trial via `existingSubscription.trialUsed` (subscriptionController.js:406). **Caveat:** this guard is bypassable if the org's prior subscription doc never had `trialUsed` set (e.g. a paid-only org that cancelled) — see the second-Subscription-document risk in `KNOWN_BILLING_GAPS.md`. So "one trial" holds for the common path but is **not structurally enforced** (no unique index on `Subscription.organization`). |
| No payment required | **Verified** | `startFreeTrial` never calls Razorpay; `totalAmount:0`, no order/subscription created (subscriptionController.js:400-464). |
| Growth feature access | **Verified** | `planName:'growth'` hardcoded at creation (subscriptionController.js:420); `restrictByPlan` looks up `PlanConfig.findOne({planId: subscription.planName})` — same lookup a real Growth subscriber gets (restrictByPlan.js:145). Not a duplicated feature list. |
| Growth usage limits | **Verified** | Same mechanism as above — `restrictByPlan`'s per-module numeric limit check runs against `planLimits` from the live Growth `PlanConfig`. |
| No invoice generated | **Assumed** — plausible from `totalAmount:0` and no Razorpay call, but I have not traced the invoice-generation path specifically to confirm nothing fires. |
| No recurring billing | **Verified** | No `razorpaySubscriptionId` set at trial creation (only `razorpayPlanId:'plan_trial'`, a literal placeholder, not a real Razorpay plan). |
| Trial start recorded on billing timeline | **Verified** | `TRIAL_STARTED` BillingEvent emitted (subscriptionController.js:438-445), confirmed rendered on the Billing page timeline (Observed — user screenshot: "Free Trial Started · Growth · Ends 17 Jul 2026"). |
| Reminder emails (48h, 24h before expiry) | **Verified** | `jobs/subscriptionLifecycleJobs.js` Job 1, registered at server startup (server.js:7). Sent at-most-once each via `trialReminder48hSent`/`trialReminder24hSent` flags. **This corrects an earlier doubt** — these were suspected possibly-missing; they exist. |
| Automatic expiry (no manual step needed) | **Verified** | `jobs/subscriptionLifecycleJobs.js` Job 2, cron `* * * * *` (every minute), sets `appStatus:'expired'` via `setAppStatus`, which `subscriptionGate` then reads to block writes. |
| Expiry notification email | **Verified** | Same job, `sendTrialExpiredEmail()`, best-effort. |
| Expiry recorded on billing timeline | **Verified** | `TRIAL_ENDED` BillingEvent emitted in the same cron job. |
| Conversion path to paid (same UI, no re-signup) | **Observed** partially — Growth card showed "Complete Payment" during active trial (user screenshot). **NOT Verified as an intentional "convert" affordance** — see Finding below; the label is a side-effect of unrelated boolean logic, not a designed conversion CTA. |

### NOT guaranteed / unknown (testing backlog)
- Reward earn/qualify behavior while referred org is on trial — `ReferralProgram.honoredDuringTrial` exists but is **confirmed unenforced** (PROJECT_STATE §11d). Status: **Verified-unenforced**, i.e. we know the gate doesn't exist, not that behavior is undefined.
- Coupon application during trial — ❓ not traced this pass.
- Upgrade during trial — Observed in passing (Growth "Complete Payment" case), not fully traced as a distinct path.
- Downgrade during trial — ❓ not traced.
- Add-on purchase during trial — ❓ not traced (add-ons reserve/consume rewards; unclear whether that path even applies pre-payment).
- Referral qualification if the REFERRED org is only ever on trial and never pays — by contract, qualification requires "first payment confirmed" (`maybeQualifyReferral`), so a trial-only org should never qualify a referral. **Verified** by the settlement trace (qualification is wired to payment-confirmation paths only, not trial start) — but not Observed live.
- Trial cancellation path — ❓ not traced.
- Second-Subscription-document risk — see above; **Verified as a code-level risk**, not yet Observed (would require a deliberate reproduction).

---

## (other capabilities — sections to be added as each is audited)

- Subscription Acquisition (new subscription) — not started.
- Settlement — partially audited in `flows/Settlement.md`; contract not yet extracted into this format.
- Coupons — not started.
- Referral & Rewards — partially audited in `flows/Referral.md` / `Rewards.md`; contract not yet extracted into this format.
- Add-ons — not started.
- Upgrade / Downgrade / Renewal / Cancellation — not started.
- Super Admin — not started.
