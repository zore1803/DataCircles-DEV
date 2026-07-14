# Architecture Review — Upgrade (Pass 3)

> **This is the verdict, not the evidence.** Evidence lives in
> `flows/Upgrade.md` (Pass 1, functional documentation) and the Stage-2
> lifecycle traces embedded in this conversation's investigation; individual
> bugs live in `audit/BillingFindings.md` (BUG-021 through BUG-031). This
> document does not restate code, file paths, or line numbers — it evaluates
> whether the implementation satisfies Upgrade's business contract, and what
> that means architecturally. Every BUG-ID referenced here is a pointer, not
> a re-investigation.

## 1. Capability Purpose

Allows an active paying organization to move from its current subscription
tier to a higher entitlement tier without interrupting service — while
preserving billing continuity, recalculating recurring pricing, collecting
only the prorated upgrade amount immediately, updating future recurring
charges, preserving or retiring compatible add-ons according to the target
plan, and ensuring that coupons, referral rewards, and feature entitlements
remain consistent throughout the transition.

Upgrade is not merely "change plan." It also owns: entitlement migration,
pricing migration, recurring-billing migration, coupon continuity, referral
reward consumption, add-on compatibility and quantity management, Razorpay
recurring-plan replacement, and the audit trail (timeline, payment history,
invoices) for all of the above.

## 2. Business Scope

**Included:**
- Higher-tier plan selection, same billing cycle
- Prorated upgrade-charge calculation and collection
- Coupon participation in upgrade pricing
- Referral reward reservation and redemption against the upgrade charge
- Add-on compatibility evaluation against the target plan
- Carry-forward of compatible add-ons (including remapping to an equivalent add-on)
- Scheduling removal of incompatible add-ons, with access retained until cycle end
- Purchase of additional add-ons at the moment of upgrade
- Feature entitlement migration (immediate, not deferred)
- Razorpay recurring subscription update (best-effort)
- Timeline, payment history, and invoice generation for the upgrade event

**Excluded (separate capabilities):**
- Downgrade (different branch, cycle-end-scheduled, not this one-time-Order mechanism)
- Renewal (recurring cycle charges, though Upgrade and Renewal share the add-on-removal-application code path — see Interactions)
- Subscription Acquisition (first-ever payment)
- Trial (structurally cannot upgrade — see Entry Conditions)
- Refund processing (this system does not refund; see Entry Conditions' cancellation rule)

## 3. Entry Conditions

- Active, payment-confirmed subscription (`isPaymentConfirmed: true`).
- Target plan is a genuinely higher tier, same billing cycle.
- Target plan exists and is active in the catalog.
- **Cancellation-in-progress rule (business intent vs. implementation — see §5, §12):** the intended rule, per explicit product direction, is that a subscription scheduled for cancellation should remain upgrade-eligible until the cancellation actually takes effect at period end (no refunds are issued anywhere in this system, so the customer has already paid for the remaining period and should be able to use it, including upgrading, prorated, within that window). **The current implementation does not match this** — it blocks upgrade the moment cancellation is *scheduled*, not when it *takes effect*. This is now BUG-031 (see §12).
- Trial subscriptions cannot reach this branch at all — trials have `isPaymentConfirmed: false` by construction (`flows/Trial.md`), and the upgrade branch requires that flag true. This is a structural exclusion, not a checked condition — Verified by exclusion.

## 4. Exit Conditions

**Successful:** plan and price migrated immediately; compatible add-ons retained; incompatible add-ons scheduled for cycle-end removal; recurring amount recalculated (see §5/§12 for the coupon caveat); Razorpay Order captured; timeline entry recorded; payment history recorded; entitlements (feature access, limits) reflect the new plan immediately.

**Abandoned:** `pendingPlanChange` remains on the subscription document; no entitlement change; existing plan/add-ons/pricing fully intact; no expiry mechanism retires this state on its own (BUG-028).

**Failed:** amount-mismatch or plan-not-found at settlement aborts the apply step; subscription remains on its prior plan; customer notification in this failure case is Unknown (not traced).

**Access control during all of the above:** feature-gating middleware (`restrictByPlan`) reads `planName` directly off the live subscription document, so the moment settlement flips `planName`, entitlements follow immediately and consistently — this part of the capability is Verified working correctly, cross-cutting concern confirmed sound.

## 5. Business Contract

| Statement | Status |
|---|---|
| Active, payment-confirmed subscription required | Verified |
| Trial subscriptions cannot upgrade | Verified (structural exclusion) |
| A subscription scheduled for cancellation remains upgrade-eligible, prorated, until the cancellation takes effect | **Failed** — see BUG-031. Current code blocks upgrade at the moment cancellation is scheduled, not at period end. |
| Upgrade collects only the prorated difference immediately | Verified |
| Feature entitlements change immediately upon successful payment, not deferred | Verified |
| Future recurring amount reflects the upgraded plan | Partially Verified — the *plan tier* is reflected; the *coupon discount* may not be (BUG-022) |
| Compatible add-ons may carry forward automatically | Verified (as behavior); whether "automatic, no confirmation" is the *right* contract is a product decision, not a code defect — BUG-027 |
| Add-ons incompatible with the target plan remain usable until the current period ends, then are removed | Verified for "remain usable"; **Partially Verified** for "then removed" — the removal itself produces no audit-trail confirmation (BUG-025) |
| Users may purchase additional compatible add-ons at the moment of upgrade | Verified |
| Coupon continues to discount pricing after an upgrade, on every surface the customer sees | **Failed** — BUG-021 (display), BUG-022 (the actual recurring charge), BUG-023 (surfaces disagree with each other) |
| A referral reward, if available, may reduce the upgrade's prorated charge | Verified for reservation and application; consumption on settlement is Partially Verified (traced, not freshly re-confirmed against a completed payment this session) |
| Timeline faithfully records the upgrade's full lifecycle, including future-scheduled consequences | Partially Verified — the upgrade event itself is recorded correctly; the *later* completion of any add-on removal it scheduled is not (BUG-025) |
| Feature access always matches the currently active plan and add-ons | Verified |
| Pricing shown to the customer is consistent across every surface | **Failed** — BUG-023, and by extension BUG-021/022/029 |

## 6. State Machine

```
Active
   │
   ▼
Upgrade Requested
   │  (add-on compatibility evaluated, reward reserved if available, proration computed)
   ▼
Pending Payment  (pendingPlanChange set; entitlements UNCHANGED)
   │
   ├── checkout dismissed ──────► Active (unchanged) — pendingPlanChange persists indefinitely (BUG-028)
   ├── payment fails ───────────► Active (unchanged)
   └── payment succeeds
          ▼
   Plan Migration      (planName/price flip — entitlements change NOW)
          ▼
   Add-on Reconciliation  (carry forward / schedule incompatible removal / apply new purchases)
          ▼
   Pricing Recalculation  (see §12 — coupon not carried into this step)
          ▼
   Reward Consumption   (if one was reserved)
          ▼
   Razorpay Recurring Sync  ──┬── succeeds → Active (upgraded, fully synced)
                              └── fails (UPI) → Active (upgraded), needsRazorpaySync retained,
                                                  reconciled lazily on next renewal charge
          ▼
   Timeline + Payment History recorded
```

Both terminal branches land in **Active** on the new tier — the difference is only whether Razorpay's own recurring-plan object has caught up yet, an internal reconciliation detail rather than a customer-visible state.

## 7. System Invariants

| Invariant | Status |
|---|---|
| Only active, payment-confirmed, non-trial subscriptions may enter Upgrade | Verified |
| Upgrade never interrupts service — the prior plan remains fully functional until settlement | Verified |
| The immediate charge is prorated only, never the full new-plan price | Verified |
| Feature access always matches the currently active plan tier | Verified |
| Recurring billing fully reflects the upgraded subscription's total charge composition | **Failed** — coupon is dropped from the recalculation (BUG-022) |
| All customer-visible pricing surfaces derive from one authoritative subscription state | **Failed** — BUG-021, BUG-023, BUG-029 |
| Every meaningful state transition in this capability's lifecycle produces a corresponding audit record | **Failed** — the add-on-removal completion has no event (BUG-025); the upgrade-initiation event conflates "requested" with "granted" in comparable spirit to Acquisition's BUG-010/011 pattern |
| Add-ons incompatible with a target plan are never billed twice nor lost before their paid-for period ends | Verified |
| A cancellation-in-progress subscription is not treated identically to a terminated one | **Failed** — BUG-031 |
| Long-lived pending states (an abandoned upgrade attempt) do not silently accumulate without any resolution path | **Failed** — BUG-028 (no expiry; only overwritten by a subsequent attempt) |

## 8. Ownership

Upgrade owns: `pendingPlanChange` (exclusively — no other capability writes it, aside from same-flow reservation recycling reading it), the upgrade Order and its payment record, the proration calculation, the immediate entitlement flip, and the `PLAN_UPGRADE` billing event.

Upgrade **shares** ownership of `activeAddons` and `pendingAddonRemovals` with the standalone Add-on capability — this is a deliberate, verified interaction (Upgrade both reads pending removals to preserve them and writes new ones for newly-incompatible add-ons), not a conflict, but it does mean the Add-on capability's own architecture review must account for Upgrade as a second writer.

Upgrade does **not** own `appliedCoupon` at all — it neither reads nor writes it during settlement, which is precisely why the coupon becomes inconsistent post-upgrade (BUG-021/022). Ownership of "what discount currently applies to a subscription" is not clearly assigned to any single capability across Acquisition, Upgrade, and Add-on-removal — each recalculates pricing independently, with only Acquisition's original creation step ever actually reading the coupon.

## 9. Interactions

- **Pricing Engine** — consumed at initiation (proration + reward discount) and at settlement (new recurring total), but these two calls compute different things from different inputs, and neither includes the coupon.
- **Coupons** — see above; the weakest interaction in this capability.
- **Referral Rewards** — clean, verified interaction: reserve-before-Order, consume-on-settlement, same-flow recycling for abandoned attempts. The one open item (BUG-030) is not an Upgrade-specific defect — it's a cross-capability visibility question about when reward-earning events surface, flagged for the Referral capability's own review, not resolved here.
- **Add-ons** — two-way, verified interaction (carry-forward, incompatible scheduling, pending-removal preservation), sharing write access to `activeAddons`/`pendingAddonRemovals` as noted in §8.
- **Razorpay** — one-time Order for the charge, best-effort recurring-plan sync, with a known graceful-degradation path for UPI (lazy reconciliation at next renewal). This interaction is architecturally sound — it accepts the platform's real constraint rather than pretending synchronous sync always works.
- **Renewal** — shares the add-on-removal *application* step (`applyScheduledAddonRemovals` runs from the renewal webhook, not from Upgrade itself), meaning Upgrade schedules work that a different capability later executes, with no event marking that handoff's completion.
- **Cancellation** — see §5/§12, the eligibility-window contract is currently not honored.
- **Timeline/Billing Events** — records the upgrade transition itself well; does not record the deferred consequences (add-on removal completion) it sets in motion.

## 10. Failure Model

- User closes the Razorpay checkout before paying.
- Payment authorization fails.
- Payment succeeds but the Razorpay recurring-subscription update fails (the UPI case) — handled as a deferred-reconciliation path, not a failure state.
- A coupon that was valid at initiation may no longer be reflected correctly by settlement (not because it expired, but because settlement doesn't consult it at all).
- A referral reward reserved for this upgrade cannot be consumed if the reservation was independently released or expired between initiation and payment.
- The target plan is deactivated between initiation and payment (settlement aborts).
- The captured payment amount doesn't match what was expected within tolerance (settlement aborts).

## 11. Recovery Model

- Resuming an abandoned upgrade: re-initiating overwrites the stale `pendingPlanChange` and recycles any reward reservation it held — this is the only recovery path; there is no automatic timeout-based recovery.
- UPI recurring-sync failure: recovers lazily, reconciled the next time the renewal webhook fires (`needsRazorpaySync`).
- No recovery path exists for a settlement that aborted due to amount-mismatch or plan-not-found beyond the customer discovering their upgrade didn't take and retrying manually — Unknown whether they're told why.

## 12. Architectural Smells

**Pricing has no single authoritative representation after a plan change.** (BUG-021, BUG-022, BUG-023, BUG-029) Multiple independent components — the current-plan card, the billing sidebar, the settlement recalculation itself — each derive "what this subscription costs" from different inputs at different times, and none of them is designated as the one the others must agree with. This isn't four separate bugs; it's one structural gap: no single function or service owns "the current authoritative price of this subscription," so every consumer computes its own answer.

**Coupon is not modeled as a first-class, continuously-valid entity across the subscription's lifecycle.** (BUG-021, BUG-022, BUG-026) A coupon is captured once, at whichever moment first creates the subscription, and every subsequent capability that changes the subscription's composition (Upgrade, and apparently the add-on-removal-at-renewal path too) simply doesn't carry it forward into its own pricing recalculation. The coupon "lives" only in the moment it was applied; nothing re-asserts it at the moments that matter.

**The capability mixes immediate and deferred state transitions without a unifying model.** (BUG-023, BUG-025, BUG-028) Some effects of an upgrade are immediate (entitlements), some are deferred to cycle end (incompatible add-on removal), and some are indefinitely pending with no resolution deadline at all (`pendingPlanChange` on abandonment). Each of these is individually reasonable, but the capability has no single, explicit representation of "what is still in flight for this subscription and when will it resolve" — a customer or support agent has to reconstruct that by reading several different fields.

**The audit trail records intentions and initiations more reliably than it records completions.** (BUG-025, and structurally consistent with Acquisition's BUG-010/011 pattern) The upgrade event itself is well-recorded; the add-on removal it schedules is not confirmed when it actually happens. This is the same underlying design tendency observed in a different capability (Acquisition) — a pattern, not a one-off.

**A business rule the product owner intends (cancellation-eligibility window) is not represented in the code at all.** (BUG-031) The current check is binary (`cancelAtPeriodEnd` true/false) where the intended rule needs a *temporal* check (has the period actually ended yet). This isn't a subtle bug — it's a business rule that was apparently never encoded as stated.

## 13. Known Gaps

See `audit/BillingFindings.md`: BUG-021, BUG-022, BUG-023, BUG-024, BUG-025, BUG-026, BUG-027, BUG-028, BUG-029, BUG-031.

## 14. Open Questions

- BUG-030 (unexplained referral reward events) — needs a direct database check before it can be evaluated architecturally at all; not addressed here.
- Whether ordinary (no-plan-change) renewals correctly re-apply the coupon, independent of Upgrade — relevant context for judging how isolated the coupon gap is, but belongs to the Renewal capability's own review.
- Whether the customer receives any notification when a settlement abort occurs (amount mismatch, plan not found) — Unknown, not traced.
