# Audit — Production Readiness Checklist

> **Living document.** Reviewed as if shipping to production. Not yet done —
> this is the target. Mark each item during the hardening pass.

## High-risk (verify first)
- [ ] **Reward consumption end-to-end** — `consumeReservation` never observed firing on a completed payment. Prove it. (`flows/Rewards.md`, HANDOFF §8)
- [ ] **Settlement race fix under real UPI** — only `node -c`'d; run a real UPI subscription. (§11a)
- [ ] **Downgrade reconciliation (Gap A)** — DB shows stale plan after scheduled downgrade. (KNOWN_BILLING_GAPS)
- [ ] **Orphaned Order payments** — paying a superseded upgrade/add-on Order (pending overwritten) charges the customer with nothing applied. Is this reachable? mitigation?

## Data integrity / concurrency
- [ ] Confirm partial-unique-index guard under real concurrent reserves (currently reasoned, not load-tested).
- [ ] Every mutation of canonical state goes through settlement (no rogue writers).
- [ ] `Subscription.status` vs `appStatus` divergence audit.
- [ ] Idempotency of every webhook handler (dup + out-of-order).

## Observability / recovery
- [ ] BillingEvent completeness (see `audit/EventMatrix.md`) — no missing/duplicate events.
- [ ] Logging on every settlement side-effect failure (some are try/catch-swallowed — confirm they log).
- [ ] Scheduled cleanup for expired reservations (currently inline-only — fine, but no cron backstop).
- [ ] Manual-recovery paths for stuck states (e.g. the reservation-release we did by hand — should be an admin action, not a script).

## Security
- [ ] Super Admin auth: token priority bug — a phone `token` in localStorage shadows `superAdminToken` in the request interceptor (`services/api.js`). Confirm impact + fix.
- [ ] Authorization on every referral/coupon/subscription endpoint (org can't act on another org).
- [ ] Razorpay webhook signature verification present + enforced.
- [ ] No secrets logged (note: something prints the SendGrid key on module load — investigate).

## Enforcement gaps (documented, deferred)
- [ ] `ReferralProgram`: stacksWithCoupons, honoredDuringTrial, minimumActiveDays, appliesTo, eligiblePlans, eligibleBillingCycles, minimumQualifyingPlan — stored but unenforced. (§11d)
- [ ] Add-on checkout discount not surfaced (needs preview endpoint).
- [ ] `confirmFirstPayment()` consolidation. (§11b)

## Tests / docs
- [ ] No automated test suite for billing flows/concurrency/webhooks yet.
- [ ] `flows/` scaffolds marked "NOT YET AUDITED" must be traced + confirmed.
- [ ] Keep docs in sync with code as the audit changes behavior.
