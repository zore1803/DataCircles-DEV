# State Machine — Subscription

> ⚠ **PARTIALLY AUDITED.** `appStatus` values are confirmed from
> `setAppStatus()` in `subscriptionController.js`. The legal-transition table
> below is the *intended* model; verify every transition against code during
> the settlement/subscription audit before trusting it.

## Two status fields (important)

A `Subscription` carries **two** status fields — this is a real source of confusion:

- **`appStatus`** — the canonical *app-level* lifecycle. Written only via
  `setAppStatus(subscription, newStatus, reason)`, which pushes to
  `appStatusHistory` (each entry: `{from, to, reason, at}`). **This is the one to reason about.**
- **`status`** — mirrors the Razorpay subscription state (`authenticated`,
  `active`, `halted`, etc.) and some app values. Set directly in several places.

> Audit item: these two overlap and are set independently. Candidate for
> consolidation, but high-risk — inventory every writer first.

## `appStatus` — legal states (confirmed enum)

```
trial · active · past_due · cancelled · expired · suspended
```

## Intended transitions (⚠ verify)

```
          trial ──────► active            (first payment confirmed)
          trial ──────► cancelled         (user cancels during trial)
          trial ──────► expired           (trial ends, no payment)
         active ──────► past_due          (payment failed — handlePaymentFailed)
       past_due ──────► active            (recovery charge succeeds)
       past_due ──────► suspended         (Razorpay halts after retries — handleSubscriptionHalted)
         active ──────► cancelled         (period ends after cancel-at-period-end)
```

Illegal (must never happen): `active → trial`, `cancelled → active`
(re-subscribe creates a new contract, not a back-transition), `expired → trial`.

## Related transient sub-state (not appStatus)

- `pendingPlanChange` — an in-flight **upgrade** (one-time Order). Set at initiation, cleared/applied on settlement. Backs a reward reservation (`referralRewardUsageId`).
- `pendingAddonAddition` — an in-flight **add-on purchase** (one-time Order). Same pattern.
- `cancelAtPeriodEnd` — cancellation scheduled; stays `active` until the period actually ends.

## Open questions for the audit

- Is every `status` write mirrored by an `appStatus` write (or vice-versa)? Where do they diverge?
- `TRIAL_ENDED` / expiry: is there a cron that moves `trial → expired`, or only lazy on next request? (verify — see `flows/Trial.md`)
- Downgrade: `pendingPlanChange` for a downgrade is documented as **not reconciled** (KNOWN_BILLING_GAPS Gap A).
