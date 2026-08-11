# Business Contract — Mandate Strategy & Annual Billing (FINAL)

Settled this session, in this order: the mandate-resize gap was found while implementing
Phase 3 (`docs/audit/PHASE3_MONTHLY_TO_ANNUAL_PRORATION.md`'s "Open item" section) →
confirmed by code that `mandateMaxAmount` mirrors an actual Razorpay-side token value, not a
purely local field → confirmed by Razorpay's own docs that tokens cannot be edited
post-registration → this contract resolves it as a registration-time policy instead of a
resize-after-the-fact mechanism. This document supersedes the informal
`firstInvoice × MANDATE_HEADROOM_MULTIPLIER` reasoning wherever it's referenced elsewhere.

## Mandate registration

At first successful payment (any plan, any cycle — monthly or annual):

```
Register mandate max_amount at ₹15,000 flat, not at
firstInvoice × MANDATE_HEADROOM_MULTIPLIER.
```

Replaces the formula in `cawAcquisition.js` (and the `subscriptionController.js` write sites
at lines 2121, 2991, 3125 — confirm exact sites before changing, do not assume line numbers
are still accurate by the time this is implemented).

**Rationale**: Razorpay mandate tokens cannot be edited post-registration (confirmed directly
against Razorpay's own docs: *"You cannot edit the details of the token once you register the
mandate"*) — registering at the ceiling from day one avoids ever needing a resize that isn't
actually possible without full re-authorization.

## Recurring charge behavior relative to the ceiling

| Charge amount | Behavior |
|---|---|
| ≤ ₹15,000 | Auto-charges silently, no customer action |
| > ₹15,000 | Auto-attempts; Razorpay requires per-debit UPI-PIN confirmation via a pre-debit notification (sent 24h prior). **Not** manual payment — one customer tap to complete. If unconfirmed in time: falls to the existing `PAST_DUE`/`MANDATE_CAPACITY_EXCEEDED` handling, unchanged from today. |

## When the >₹15,000 scenario actually occurs

Checked against real `PlanConfig`/`PlanAddon` data, not assumed:

- Base annual prices (Starter ₹2,400 / Growth ₹4,800 / Business ₹7,200) are all comfortably
  under ₹15,000 alone.
- Real crossover only occurs via seat add-ons (₹200/year/seat): Business annual + ~40 extra
  seats crosses ₹15,000.
- **This can happen to an existing plan simply through org growth** (adding seats over time),
  not only via a future high-priced tier — both cases should be watched for, not just new
  pricing launches.

## Annual base plan — cycle transitions

- **Monthly → Annual**: implemented (Phase 3). The transition charge itself is a plain
  Razorpay Order, not mandate-gated. Future annual renewals ARE mandate-gated per the rules
  above.
- **Annual → Monthly**: cancel (no refund/proration, already settled) → wait for the paid
  period to end → resubscribe fresh on monthly. No in-place conversion function needed or
  built — this is cancel-then-resubscribe, the same mechanism as any fresh signup.

## Mandate re-registration (explicitly not built)

If any future charge exceeds a customer's registered ceiling in a way the ₹15k-flat policy
doesn't cover, the only fix is a brand-new Razorpay Registration Link with full
re-authorization. No automated flow exists for this. Build it when a real case is observed,
not speculatively — same posture as the `pendingCycleTransition`/`RECONCILIATION_NEEDED` gap
(`PHASE3_MONTHLY_TO_ANNUAL_PRORATION.md`).

## Implementation status — DONE / VERIFIED

`computeMandateMaxAmountRupees()` updated in both places it's independently defined —
`utils/cawAcquisition.js` and `controllers/subscriptionController.js` (a pre-existing
duplication, not introduced here; kept in sync per each file's cross-reference comment).
Function signature unchanged in both (`(firstInvoiceRupees)`), so every existing call site
needed zero changes — only the internal formula changed, from
`firstInvoiceRupees × MANDATE_HEADROOM_MULTIPLIER` to a flat `MANDATE_CEILING_RUPEES`
(default 15000, env-overridable via `CAW_MANDATE_CEILING_RUPEES`). Reconciliation read sites
that sync this app's field to whatever Razorpay's token actually reports
(`subscriptionController.js:2991,3125`) were deliberately left untouched — those correctly
mirror Razorpay's authoritative value regardless of what policy created it.

**Verified:** `scripts/verifyMandateCeilingFlat.js`, 4/4 passing — flat ₹15,000 regardless of
first-invoice size (both a small and a large real invoice amount), env override respected,
and the `subscriptionController.js` duplicate confirmed (by source inspection, since that
function isn't separately exported) to use the same flat formula, not the superseded
multiplier. Full regression suite re-run: **75/75 passing, 0 failed** (71 prior + 4 new).

## Migration note

**N/A — no existing customers/subscriptions predate this policy.** This is the mandate
strategy from first launch, not a change applied to a live base. No backfill, no
legacy-formula population to consider, no migration script needed.
