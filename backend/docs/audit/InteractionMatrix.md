# Interaction Matrix

> This is the document that will save weeks later. Billing systems are simple
> in isolation and become monsters in combination. Every pair of capabilities
> gets a row. **Supported** = should this combination work, per intended
> design? **Tested** = has it actually been Observed? **Status tags**: same
> five as everywhere else (Observed / Verified / Assumed / Impossible / Future),
> plus ❓ for genuinely unknown.
>
> A capability's `flows/<Capability>.md` §12 links here rather than trying to
> resolve interactions in isolation — cross-cutting behavior belongs in ONE
> place, not duplicated per flow.

| Capability A | Capability B | Supported (intended) | Status | Notes |
|---|---|---|---|---|
| Trial | Coupon | ❓ | ❓ not traced | Does a coupon field even apply pre-payment during trial? Unknown. |
| Trial | Referral (as referrer) | ✅ (referrer side unaffected by trial) | **Verified** | Referral code issuance/sharing (`getOrgReferralCode`) has no trial gating — traced, org can share its code regardless of subscription state. |
| Trial | Referral (as referred, qualifying) | ❌ intended — trial alone cannot qualify a referral | **Verified** | `maybeQualifyReferral` only runs from payment-confirmation settlement paths, never from `startFreeTrial`. A trial-only org's referral should stay `pending` indefinitely until real payment. Not Observed live. |
| Trial | Rewards (`honoredDuringTrial`) | Intended: configurable per `ReferralProgram.honoredDuringTrial` | **Verified-unenforced** | Field exists, nothing reads it (PROJECT_STATE §11d). So behavior today = rewards ignore trial status entirely, regardless of the flag's value. |
| Trial | Add-on purchase | ❓ | ❓ not traced | `initiateAddonPurchase` requires an active paid-feeling subscription context — does it even permit purchase pre-payment, and would `restrictByPlan` allow it under `planName:'growth'`? Unknown. |
| Trial | Upgrade | Partially observed | **Assumed-broken labeling** | Growth card showed "Complete Payment" during trial (Observed), traced to `PlanCard.jsx isPendingPayment()` — a coincidental match, not a real "upgrade" path exercised. Whether clicking it actually converts correctly end-to-end: ❓ not traced. |
| Trial | Downgrade | ❓ | ❓ not traced | N/A concept during trial (no plan to downgrade from in the traditional sense) — needs a definition, not just a trace. |
| Trial | Access control (`restrictByPlan`/`subscriptionGate`) | ✅ | **Verified** | Fully traced — see `flows/Trial.md` §4/§11. Trial uses the exact same gates as paid plans. |
| Upgrade | Coupon | ❓ (coupon is recurring-subscription-level) | **Assumed** | Believed coupons do NOT apply to the one-time upgrade Order (only referral rewards do, per `flows/Upgrade.md` §7) — not explicitly Verified this pass. |
| Upgrade | Referral reward | ✅ | **Verified** | `flows/Upgrade.md` / `flows/Rewards.md` — reserve→apply→consume traced and partially Observed (reserve+discount live; consume never Observed — see `flows/Rewards.md`). |
| Upgrade | Add-on (incompatible on target plan) | Intended: incompatible add-ons scheduled for removal at cycle end | **Verified (mechanism)**, coherence with a SEPARATE pending removal ❓ | `classifyAddonsForPlanChange` traced (`flows/Upgrade.md` §8 row 1) — the specific scenario "add-on removal already scheduled, then upgrade to a plan that also disallows it" is flagged ❓ unresolved. |
| Upgrade | Pending downgrade | ❓ | ❓ not traced | `flows/Upgrade.md` §8 row 2 — `pendingPlanChange` is a single field; unclear if a pending downgrade is even representable there or silently overwritten. |
| Coupon | Referral reward | Intended: `stacksWithCoupons` should govern this | **Verified-unenforced** | Field exists on `ReferralProgram`, never read; today coupon + referral reward **always** stack regardless of the setting (PROJECT_STATE §11d). |
| Coupon | Add-on purchase | ❌ not applied today | **Verified** | `flows/AddonPurchase.md` §7 — "Coupons do NOT apply to add-on purchases yet (known gap)." |
| Reward | Add-on purchase | ✅ | **Verified + Observed (reserve/discount)** | `flows/Rewards.md` / `flows/AddonPurchase.md`. Consumption itself: unproven (see below). |
| Reward | Consumption (any flow) | ✅ intended | **Traced-only, NEVER Observed** | The single most important unresolved item across the whole audit — `consumeReservation` has never fired on a completed payment in any flow (Razorpay test-gateway timeouts). Flagged in `flows/Rewards.md`, `EdgeCases.md`, `ProductionChecklist.md`. |
| Downgrade | Add-on | Intended: some carry/drop logic (same `classifyAddonsForPlanChange`?) | ❓ | Not traced yet — Downgrade capability not started. |
| Downgrade | Reconciliation at renewal | ❌ known-broken | **Verified** | Gap A, `KNOWN_BILLING_GAPS.md` — DB never reflects the new plan after a scheduled downgrade takes effect. |
| Renewal | Reward | ❓ | ❓ not traced | Renewal capability not started. |
| Renewal | Coupon | Intended: recurring discount re-applies each cycle | **Assumed** | Not explicitly Verified this pass. |
| Two concurrent checkouts (any flow) | Reward reservation | ✅ protected | **Verified** | Partial unique index on `RewardUsage{reward, status:'reserved'}` — the concurrency guard, code-reviewed (not load-tested). |
| Two concurrent checkouts (any flow) | Payment (double-charge risk) | ❓ | ❓ not traced | Orphaned-Order risk noted in `flows/Upgrade.md` §8 (paying a superseded Order) — not the same as true concurrency, but related; needs its own row once traced properly. |

## How to add a row
When any capability's audit touches a second capability, add (or update) the
row here rather than resolving it inline in the flow doc. Link back from both
flow docs' §12 to the relevant row(s).
