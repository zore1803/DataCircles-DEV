# Business Flow Audit — master notebook

> The engineering notebook for the production-hardening audit. One row per flow.
> A flow is only "done" when every column is ✅ **AND** its documentation
> completeness checklist (see `flows/Trial.md` §16 for the pattern) shows
> nothing outstanding. Method: `FLOW_AUDIT_TEMPLATE.md`. Raw QA evidence lives
> permanently in `audit/UserObservations.md` — cross-cutting interactions in
> `audit/InteractionMatrix.md` — guarantees in `audit/BusinessContracts.md`.
> Legend: ✅ done · ⏳ in progress · ❌ not started · — n/a.

## Per-flow status

| Flow | Traced | UI verified | DB verified | Edge cases | BillingEvents | Emails | Race conds | Prod-ready |
|---|---|---|---|---|---|---|---|---|
| Settlement | ✅ | — | ⏳ | ❌ | ⏳ | ❌ | ⏳ | ❌ |
| Referral (invite→qualify) | ✅ | ✅ | ✅ | ⏳ | ⏳ | ❌ | ⏳ | ❌ |
| Reward reservation | ✅ | ✅ | ✅ | ⏳ | ✅ | — | ⏳ | ❌ |
| Reward consumption | ✅ | ⏳ | ❌ | ❌ | ⏳ | — | ❌ | ❌ |
| **Upgrade** | ⏳ | ⏳ | ⏳ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Add-on purchase | ⏳ | ❌ | ⏳ | ❌ | ❌ | — | ❌ | ❌ |
| Add-on removal | ❌ | ❌ | ❌ | ❌ | ❌ | — | ❌ | ❌ |
| New subscription | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Subscription Acquisition (pre-payment funnel) | ⏳ (stub only) | ⏳ | ❌ | ❌ | — | — | — | ❌ |
| **Trial** | ✅ | ⏳ (2 banner components unlocated) | ✅ | ⏳ | ✅ | ✅ | — | ❌ |
| Downgrade | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | — | ❌ |
| Renewal | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Cancellation | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | — | ❌ |
| Coupon application | ❌ | ❌ | ❌ | ❌ | ❌ | — | ❌ | ❌ |
| Coupon redemption | ❌ | — | ❌ | ❌ | ❌ | — | ❌ | ❌ |
| Payment verification | ⏳ | — | ⏳ | ❌ | ❌ | — | ⏳ | ❌ |
| Webhook processing | ⏳ | — | ⏳ | ❌ | ❌ | — | ⏳ | ❌ |
| Super Admin: coupons | ❌ | ⏳ | ❌ | ❌ | — | — | — | ❌ |
| Super Admin: referral | ✅ | ⏳ | ✅ | ❌ | — | — | — | ❌ |

## Audit order — DEPENDENCY order (corrected; see `DOCUMENTATION_ROUTING.md`)

Later flows build on earlier ones — audit foundation-first, not richest-first.
Finish a flow COMPLETELY (UI + DB + network + rules + trace + edge cases + doc)
before moving to the next. Cross-flow combinations are audited LAST, once every
individual flow is understood.

1. **Pricing Engine** — the foundation; everything prices through it. ← START HERE
2. **New Subscription**
3. **Settlement** — every payment confirmation path converges here.
4. **Coupons**
5. **Referral & Rewards**
6. **Add-ons** (purchase + removal)
7. **Upgrade**
8. **Downgrade**
9. **Cancellation**
10. **Renewal**
11. **Super Admin**
12. **Cross-flow interaction audit** (only after 1–11)

> Note: some flows below already have partial trace work from earlier sessions
> (Settlement, Referral, Reward, Upgrade) — that work is preserved, but the
> FRESH per-flow process (customer walkthrough → your report → architect
> questions → my trace) starts now at #1, Pricing Engine.

## Cross-flow coherence questions to answer (the real goal)

These span multiple flows — track answers as flows get audited:

- [ ] Add-on purchased → removal scheduled → upgrade to a plan that disallows it → what happens? (see `flows/Upgrade.md §8`)
- [ ] Upgrade started while a downgrade is pending → allowed? which wins?
- [ ] Coupon applied → plan changed → does the coupon still apply / re-price correctly?
- [ ] Reward reserved but never consumed → released cleanly? (release ✅; consume path ❌ unverified)
- [ ] Two upgrade tabs open → double-charge? double reward? (reward: same-flow recycle; payment: ❓)
- [ ] `payment.captured` twice → single settlement? (idempotent by design; ⚠ unverified)
- [ ] Frontend success but webhook never arrives → state consistent? (relies on `verifyPayment` settling too)
- [ ] Webhook before frontend → consistent? (both settle idempotently; ⚠ unverified)
- [ ] Payment fails after reservation → reservation released? (order-create failure releases; post-order failure → TTL)
- [ ] Add-on no longer in catalog / plan disabled → checkout behaviour? (❓)
- [ ] Coupon usage limit reached between pricing and payment → charged wrong amount? (❓ — coupons validated at pricing, redeemed at settlement)

## How to run observations (this repo)
- DB: Mongoose scripts against `MONGO_URI` (read-only for observation; writes only with explicit approval).
- Razorpay: **test** keys (`rzp_test`). Test-mode **UPI cannot complete** — use card `4111 1111 1111 1111` + "Success" on the 3DS page.
- UI: cannot be driven from here; note UI observations from the user's screenshots/runs.
