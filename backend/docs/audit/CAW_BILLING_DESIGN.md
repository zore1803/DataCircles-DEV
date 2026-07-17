# Charge-at-Will Billing System — Design Specification

> **Purpose.** The billing system's blueprint and durable reference — not a migration memo. A new
> engineer, six months from now, should read this to understand *why* Charge-at-Will was chosen, how the
> billing lifecycle works, what every webhook does, and how renewals, upgrades, downgrades, coupons,
> seats, retries, and mandates interact — before reading a line of code.
>
> **Status:** design (no production code written). Technical feasibility is proven —
> `CHARGE_AT_WILL_EVIDENCE_PACKAGE.md`. **Razorpay-specific endpoints, field names, and payloads live in
> the implementation guide (`RAZORPAY_MIGRATION.md` §IG), not here.** This document stays at the level of
> concepts and rules that survive a vendor endpoint change.
>
> **Marker legend:** `[DECIDED]` settled (validation, prior decision, or clear architectural rule).
> `[POLICY — default, configurable]` a business value with a documented default that must not be
> hardcoded. `[POLICY — needs business confirmation]` not yet settled by the business.

---

## 0. Why Charge-at-Will (context for the future reader)

The account moved from Razorpay **Subscriptions** to **Charge at Will (CAW)**; the two cannot coexist on
one account. Under Subscriptions, Razorpay owned the plan, schedule, and renewal. Under CAW, **we own
everything except the payment rail**:

- A **mandate** (tokenized authorization) is created once per customer, capped at a maximum amount.
- To take money we **create an Order** and **charge the mandate** — for renewal, upgrade, add-on, or
  seat increase. Amounts vary per charge.
- Razorpay never schedules anything. Our cron is the entire scheduler.

Strictly more flexible (variable amounts, our own proration/coupons/retry policy) at the cost of owning
more logic. This document specifies that logic.

---

## 1. Ownership map (who owns what)

The single most useful orientation for a new engineer. Each concern has exactly one owner.

| Concept | Owns |
|---|---|
| **Subscription** | the customer's **current** billing state (plan, seats, add-ons, mandate, status) |
| **BillingCycle** | the record of **one period** — what was invoiced, charged, and what happened |
| **Invoice Engine** (`calculateInvoice`) | all **money calculation** — the only pricing authority |
| **Payment** | one Razorpay **transaction** (its IDs, status, method) |
| **Cron** | **scheduling** — deciding *when* to attempt a charge |
| **Webhooks** | **state transitions** — deciding the *outcome* of a charge |
| **Billing Policy** (§9) | **business rules** — proration, retry cadence, grace, suspension |

---

## 2. Subscription Model — *current state only*

The durable identity becomes **customer + mandate token** (no Razorpay subscription or plan object
exists anymore). The Subscription holds **current** state; historical per-period data lives in
BillingCycle (§3) so this document never overloads Subscription with history.

```
Subscription
  organizationId
  planId                  # internal plan key (starter/growth/…), NOT a Razorpay plan
  billingCycle            # monthly | yearly
  status                  # trialing|active|past_due|retrying|suspended|cancelled  (§7)
  # --- mandate ---
  razorpayCustomerId
  mandateTokenId          # the reusable authorization
  mandateStatus           # none|pending|confirmed|paused|cancelled|rejected  (§7)
  mandateMaxAmount        # cap; charges above it HARD FAIL (§10)
  mandateExpiresAt
  # --- commercial inputs to calculateInvoice ---
  basePrice
  seatCount
  addons[]                # [{ key, quantity, pricePerUnit }]
  coupon                  # reference, re-resolved live every charge (see note)
  referralModifiers       # reward references (existing referral system)
  # --- scheduling (current) ---
  currentPeriodStart
  currentPeriodEnd
  nextInvoiceDate
  pendingUpdate           # { planId?/addons?/seatCount?, effectiveDate } — downgrades only (§6)
```

**Removed from the old model:** `razorpaySubscriptionId`, `razorpayPlanId` (and its `required:true`),
and Razorpay-Plan cache references.

**Coupon note (fixes the BUG-021/022/023 frozen-snapshot family):** the coupon is a **reference**,
re-resolved by `calculateInvoice()` at every charge — never frozen at subscribe time.

---

## 3. BillingCycle — *one period's history* (new entity)

Subscription = "what is true now." BillingCycle = "what happened this period." Keeping them separate
prevents Subscription from slowly accumulating historical fields, and gives finance/support an immutable
per-period ledger.

```
BillingCycle
  subscriptionId
  periodStart
  periodEnd
  invoiceSnapshot         # the InvoiceBreakdown that was charged (immutable once paid)
  status                  # pending|paid|failed|retrying|written_off
  paymentId               # the successful Razorpay payment (once captured)
  retryCount
  generatedAt
  paidAt
```

**[DECIDED]** One BillingCycle per subscription per period. It is the thing a period "advances" into
(§Invariants). Invoices are immutable once the cycle is `paid`.

---

## 4. Invoice Engine — the single source of truth

**One function every path calls.** Renewal, upgrade, downgrade preview, add-on, seat change, admin
preview, invoice document, and email compute money **only** through this. Nothing else may total a bill.
This is the heart of the system.

```
calculateInvoice(subscription, options) → InvoiceBreakdown
```

**Inputs**
- `subscription` — the commercial-state fields (plan, seats, addons, coupon, referralModifiers, cycle).
- `options.asOf` — the instant to price at (coupon validity, proration reference date).
- `options.changeset?` — a hypothetical mutation (upgrade/downgrade/seat/add-on) to price **without**
  mutating state. Drives admin preview and upgrade proration.
- `options.proration?` — proration inputs (period bounds, remaining days) when pricing a mid-cycle change.

**Output — `InvoiceBreakdown`**
```
{ basePrice, seatPrice, addonPrice, subtotal, discount, taxable, gst, total, lines[] }
```

**Invariants of this function (must always hold)**
- **Pure:** no I/O, no Razorpay calls, no DB writes. Deterministic for a given input.
- **Total authority:** it is the *only* code that produces `total`. No controller, cron, or frontend may
  compute money independently.
- **Live resolution:** coupons and referral modifiers are resolved from `asOf`, never from a stored
  snapshot.
- **Tax computed here:** GST is derived inside, never pre-baked into inputs.
- Reuses existing engines (`pricingEngine`, `modifierResolver`, `referralRewards`) *internally* — it
  consolidates logic today scattered across frontend and controllers (the root cause of BUG-040).

This function is exhaustively unit-tested; every downstream flow trusts its output.

---

## 5. Invariants (architectural rules that must always hold)

These are non-negotiable. Every feature must preserve them.

1. **A billing period advances exactly once.** Exactly one BillingCycle transition per period.
2. **Only a captured payment advances a period.** Not the cron, not the API response — the
   `payment.captured` webhook.
3. **Every successful payment belongs to exactly one billing period** (one BillingCycle).
4. **A payment is never attached to multiple invoices/cycles.**
5. **Invoices are immutable after payment** (the BillingCycle `invoiceSnapshot` is frozen once paid).
6. **`calculateInvoice()` is the only pricing authority.**
7. **Every charge is idempotent per period** — a duplicate webhook or retry cannot double-charge or
   double-advance.
8. **A charge never exceeds `mandateMaxAmount`** — exceeding it is a hard failure requiring mandate
   regeneration (§10), never a silent partial.
9. **Mandate state and subscription state are separate axes** (§7) — a webhook moves one without
   implying the other.
10. **A captured payment does not imply a confirmed mandate.** Acquisition charges the real first
    invoice as part of the authorization transaction (§6, Model 2); `token.confirmed` can arrive after
    the payment, or never. `payment.captured` without a subsequent `token.confirmed` is a **distinct
    failure mode** from `payment.failed` — the customer paid but has no reusable mandate. This is
    **derived**, never a stored composite state (§7): `subscription.status` stays `active` (they paid,
    they get access); `mandateStatus` independently reflects the real mandate fact
    (`pending`/`rejected`/`cancelled`). The recovery condition is simply
    `paymentStatus === 'paid' && mandateStatus !== 'confirmed'` — no new enum value, no new field.
11. **Store the vendor fact plus its timestamp; derive every business conclusion from those — never
    persist a derived conclusion as if it were a vendor fact.** `status` (product access) and
    `mandateStatus` (can-we-auto-charge) are set only from real Razorpay facts, never from each other or
    from a derived condition. Composite situations ("active but mandate pending", "expired", "action
    required") are computed at read time from `status`/`paymentStatus`/`mandateStatus`/`mandateExpiresAt`
    — they are UI/business concepts, not stored enum values, and not vendor facts (Razorpay does not send
    a `token.expired` event or an "action required" token status today; do not design around "only these
    forever" — the rule is persist-fact-then-derive, which holds regardless of what Razorpay adds later).
12. **Webhook handlers are idempotent and order-independent (verified — see §7a).** Razorpay does not
    guarantee cross-event delivery order and uses at-least-once delivery. Every handler must (a) persist
    its own fact safely on replay, (b) dedupe via `x-razorpay-event-id`, and (c) trigger any dependent
    action (e.g. activation) via an idempotent check of currently-persisted state, never by assuming
    which handler runs first.

---

## 6. Billing lifecycle flows (vendor-neutral verbs)

Actual endpoints/fields: see `RAZORPAY_MIGRATION.md` §IG. Here we use **Acquire Mandate**, **Charge
Mandate**, **Create Order**.

**Acquisition**
```
choose plan → Acquire Mandate (max amount set with headroom) → customer authorizes
→ [webhook] token.confirmed → persist token, mandateStatus=confirmed → subscription active
```

**Renewal (cron initiates; webhook confirms)**
```
cron: find subscriptions with nextInvoiceDate <= now, status ∈ {active, past_due, retrying}
  apply any pendingUpdate whose effectiveDate has arrived (§6-downgrade)
  invoice = calculateInvoice(sub, { asOf: now })
  guard: invoice.total <= mandateMaxAmount ? else → mandate-cap path (§10)
  open a BillingCycle (status=pending); Create Order; Charge Mandate
  → do NOT mark success here —
  [webhook] payment.captured → cycle=paid, advance period       (§8)
  [webhook] payment.failed   → retry policy (§9)
```

**Upgrade / Add-on / Seat increase — charge now** `[DECIDED]`
```
preview = calculateInvoice(sub, { changeset })            # show the delta
prorationAmount = delta for remaining days in current period   # [DECIDED] §9
Create Order (prorationAmount); Charge Mandate
[webhook] payment.captured → commit changeset; future renewals use the new amount
guard: newRecurringTotal <= mandateMaxAmount, else mandate regeneration (§10)
```

**Downgrade — never charge; schedule only** `[DECIDED]`
```
store pendingUpdate = { …, effectiveDate: currentPeriodEnd }    # NO charge, NO vendor call
renewal cron at period end applies pendingUpdate, then invoices the lower amount
```
This is the **structural fix for BUG-040**: today `pendingUpdate` is written but never read; here the
renewal cron is the *single reader* that applies it. Exactly one place computes "future state."
`[POLICY]` allow "undo scheduled downgrade" before effectiveDate.

---

## 7. Mandate + Subscription State Machine — two independent axes, never merged

`status` (product access) and `mandateStatus` (can-we-auto-charge) are **fully separate state
machines** (Invariant 9, 11). Neither is ever combined into a composite value in either enum; the
"paid but mandate not confirmed" situation is **derived at read time**, not stored.

**Subscription `status`** (unchanged by Acquisition's payment/mandate split):
```
trialing ──▶ active ──(payment.failed, renewal)──▶ past_due ──▶ retrying ──▶ suspended
                ▲                                      │ payment.captured (retry success)
                └──────────────────────────────────────┘
active/past_due/... ──▶ cancelled
```
`status` becomes/stays `active` as soon as the **first invoice payment is captured** — full stop. It does
not wait on, or get blocked by, mandate confirmation.

**`mandateStatus`** (its own lifecycle, driven only by mandate/token webhooks):
```
none ──(Acquire Mandate)──▶ pending ──(token.confirmed)──▶ confirmed
                                    ├──(token.rejected)───▶ rejected
                                    └──(token.cancelled)──▶ cancelled
confirmed ──(token.paused)──▶ paused ──(resume)──▶ confirmed
confirmed/paused/rejected/cancelled ──(new Acquire Mandate)──▶ pending
```

**The recovery condition is derived, not a new state** (Invariant 10):
```
needsMandateRecovery = (paymentStatus === 'paid') AND (mandateStatus !== 'confirmed')
```
When true: subscription stays `active` (customer paid, they keep access); surface a UI prompt
("complete your recurring payment authorization") computed from this expression; a reconciliation job
(not a cron *retry*) periodically finds subscriptions matching it for longer than a reasonable window
(accounting for delayed eMandate confirmation) and notifies the customer/support. This is an onboarding
**recovery** flow, not the renewal retry engine (§9) — it's about acquiring/fixing a mandate, not
retrying a charge. At the **next renewal**, if `mandateStatus` is still not `confirmed`, there is no
token to charge — that renewal attempt fails and enters the normal `past_due`/retry path (§9) with the
root cause visible via `mandateStatus`, not a special subscription state.

---

## 7a. Webhook delivery semantics — order is NOT guaranteed (verified, not assumed)

**Verified from Razorpay's own documentation, not inferred:** *"Ideally you should receive webhooks in
the order in which the webhook events occur, however you may not always receive the webhooks in order.
You should configure your webhook URL to not expect delivery of these events in this order and handle
such scenarios."* — Razorpay Webhooks Best Practices. Combined with **at-least-once delivery** (the same
event can arrive more than once; dedupe via `x-razorpay-event-id`).

**Empirically reproduced, not just theoretical:** in our own successful Acquisition test, `token.confirmed`
arrived 288ms **before** `payment.authorized`/`payment.captured` — i.e. the mandate-confirmation event
beat the payment event, the reverse of what a naive "payment happens, then mandate confirms" mental model
would assume.

**Design consequence — activation is a fact-based AND-gate, never order-dependent:**
```
payment.captured handler:
  persist { paymentStatus: 'paid', lastPaymentId, ... }   (idempotent — safe to re-run)
  if mandateStatus === 'confirmed': activate()             else: no-op, wait
  # activate() itself is idempotent — safe even if mandate.confirmed handler activates first

token.confirmed handler:
  persist { mandateStatus: 'confirmed', mandateTokenId, mandateMaxAmount, mandateExpiresAt }
  if paymentStatus === 'paid': activate()                  else: no-op, wait
```
Neither handler assumes the other has already run. `activate()` itself is idempotent (setting
`status='active'` when it's already `'active'` is a no-op) — so it is safe for **both** handlers to call
it, whichever arrives first, and safe for either to be retried (at-least-once delivery). This is the same
AND-gate shape as `paymentStatus==='paid' && mandateStatus!=='confirmed'` in §7 — both are pure functions
of currently-persisted state, never of event arrival order.

**Corollary — persist facts + timestamps, derive everything else (a stronger general rule than
Invariant 11's original wording):** every webhook handler stores the **raw vendor fact** it received
(and when), never a business conclusion. "Expired," "action required," "activation happened" are all
**derived reads** over persisted facts + timestamps — not written by any single handler as if that
handler alone determined the outcome.

## 8. Webhook Ownership (which event owns which write)

Every handler verifies the signature on the raw body and dedupes on the event id (Invariant 7).

| Webhook | Owns | Action |
|---|---|---|
| `token.confirmed` | mandate activation | persist token, `mandateStatus=confirmed`, cap; activate subscription |
| `payment.authorized` | auth-txn leg only | informational; NOT fired on mandate debits |
| `payment.captured` | successful charge | record Payment; BillingCycle→paid; advance period; clear retry |
| `order.paid` | order closure | confirm order settled (pairs with captured) |
| `payment.failed` | failed charge | retryCount++; → past_due/retrying (§9) |
| `token.paused` | mandate pause | block charges; prompt resume |
| `token.cancelled`/`token.rejected` | mandate death | → cancelled; require new mandate before charging |
| `invoice.paid` | onboarding auth | first-mandate invoice settled during Acquisition |

**[DECIDED]** `payment.captured` is the *sole* trigger that advances a period. One writer per fact.

---

## 9. Billing Policy (business rules — separated from architecture)

These are **not engineering decisions**. They have defaults but must be **configurable**, not hardcoded
into the architecture. Changing any value here must not require an architecture change.

**Proration** `[DECIDED]`
- Mid-cycle upgrades/seats/add-ons are **charged immediately**, prorated by **remaining days in the
  current billing period**. (Confirmed with product; also the common SaaS default — Stripe/Chargebee.)

**Retry policy** `[POLICY — default, configurable]`
```
maxAttempts     = 3
retryIntervals  = [24h, 72h, 120h]   # spread over days, not back-to-back
```
- Manager guidance: "industry standard, three attempts." Defaults above encode that; **values are
  configurable**, not laws. Retries re-run `calculateInvoice()` → new Order → charge.

**Grace period** `[POLICY — default, configurable]`
```
gracePeriod = 7 days   # from first failure to hard-suspension
```
- Default documented; configurable. Finance/product may set 3/14/30 days, or exempt enterprise.

**Suspension policy** `[POLICY — needs business confirmation]`
- After retries exhausted + grace elapsed → `suspended` (block product access). Final rule (including
  possible "enterprise never suspends") pending business confirmation.

**Pre-debit notification** `[DECIDED — omit initially]`
- Do not send the pre-debit notification object initially (simpler; vendor auto-attempts; we own
  retries). Revisit only if RBI/compliance or business requires it.

---

## 10. Failure Matrix

| Event | Action |
|---|---|
| mandate rejected at signup | stop signup; surface error; offer retry with new mandate |
| charge failed (renewal) | retry per §9; past_due → suspended after grace |
| webhook duplicate (event id seen) | ignore (Invariant 7) |
| order creation fails | retry with backoff; alert if persistent |
| vendor timeout / no webhook | reconcile via fetch before re-charging |
| mandate paused | block charges; prompt resume |
| mandate cancelled/rejected | mark cancelled; require new mandate |
| invoice total > mandate cap | cannot charge; regenerate mandate with higher cap first (Invariant 8) |
| partial webhook (captured, no order.paid) | trust `payment.captured` for advance; reconcile order async |
| double-charge risk on retry | one successful capture per period (Invariants 1, 7) |

---

## 11. Migration Strategy (existing customers)

```
existing Subscription docs (razorpaySubscriptionId, no token)
  ├─ usable historical token?  (legacy UPI payments minted token_ids the code discarded)
  │     → backfill mandateTokenId from historical payment token where present & confirmed
  └─ none → re-onboard: Acquire Mandate → customer authorizes → token.confirmed
```
`[POLICY — needs business confirmation]` parallel-run old + new during cutover; a subscription uses CAW
once `mandateStatus=confirmed`. Confirm with vendor whether historical discarded tokens are chargeable
(open item, evidence pkg §8). Customer comms plan for those who must re-authorize.

---

## 12. Sequence Diagrams (vendor-neutral)

**Signup**
```
User → App: choose plan
App: Acquire Mandate (cap with headroom) → hosted authorization link
User: authorize
[webhook] token.confirmed → persist token, active
[webhook] first-charge captured → subscription active
```
**Renewal**
```
Cron: due today → calculateInvoice() → open BillingCycle → Create Order → Charge Mandate
[webhook] payment.captured → cycle paid, period advances   (or) payment.failed → retry (§9)
```
**Upgrade / Add-on / Seat**
```
User: change → calculateInvoice({changeset}) → prorated delta → Create Order → Charge Mandate
[webhook] payment.captured → commit changeset; future renewals use new amount
```
**Downgrade**
```
User: downgrade → store pendingUpdate{ effectiveDate = periodEnd }   (NO charge)
Cron @ periodEnd: apply pendingUpdate → calculateInvoice() → charge lower amount
```

---

## 13. Decision Register

| Decision | Status |
|---|---|
| Proration = immediate, remaining days in period | ✅ DECIDED |
| Upgrade/seat/add-on charged immediately | ✅ DECIDED |
| Downgrade deferred to renewal (schedule only) | ✅ DECIDED |
| Cron initiates, webhook confirms | ✅ DECIDED |
| `calculateInvoice()` = single pricing authority | ✅ DECIDED |
| Pre-debit notification omitted initially | ✅ DECIDED |
| Retry policy (maxAttempts=3, intervals=[24h,72h,120h]) | 🟡 default documented, configurable |
| Grace period (7 days) | 🟡 default documented, configurable |
| Suspension policy | 🟡 needs business confirmation |
| Migration parallel-run + token backfill | 🟡 needs business confirmation + vendor answer |
| Acquisition: charge full first invoice, mandate confirms in background (Model 2) | ✅ DECIDED — see PHASE2_ONBOARDING_AUDIT.md |
| Payment-succeeds-but-mandate-never-confirms: derived condition, NOT a stored subscription state | ✅ DECIDED (Invariant 10/11, §7) — corrected after review; `paid_pending_mandate` was rejected |
| `mandateStatus` enum stays exactly `none/pending/confirmed/paused/cancelled/rejected` — no `expired`/`action_required` | ✅ DECIDED — those are derived (from `mandateExpiresAt`, from the recovery condition), not real Razorpay-sent facts. General rule (Invariant 11): persist fact+timestamp, derive the rest — not a special case for "expired" alone |
| Webhook order is NOT guaranteed; handlers must be idempotent AND-gates | ✅ DECIDED — verified via Razorpay's Webhooks Best Practices doc + reproduced empirically (token.confirmed arrived before payment.captured in our own test). See §7a, Invariant 12 |

---

## 14. What this design deliberately does NOT do

- It does **not** rewrite the existing pricing/coupon/referral engines — they are reused *inside*
  `calculateInvoice()`. This migration changes **who calls them and when money moves**, not how a price
  is computed.
- It does **not** touch the frontend until the backend billing core is built and tested.
- It does **not** hardcode business policy (§9) or vendor endpoints (see §IG) into the architecture.

---

## Implementation Notes (append findings here as phases land — no separate audit doc per phase)

**Phase 2 (Registration Link onboarding):**
- `createSubscription` is the CAW implementation directly (no alias/parallel route). Legacy
  Subscriptions/Plans code kept unexported (`legacyCreateSubscription_DEPRECATED`), deleted in Phase 8.
- `method`/`expire_at` on `subscription_registration` are optional (confirmed via the Razorpay SDK's own
  type definitions) — both omitted; the backend does not choose the payment instrument, Razorpay's
  hosted page shows every method enabled on the account. `max_amount` stays overridden (invoice-
  proportional, not Razorpay's flat ₹99,000 default).
- **`token.confirmed` cannot be correlated to a Subscription by itself** — verified against a real
  payload: no `customer_id`, `entity_id` was `null`. **`payment.captured` carries both `invoice_id`
  (matches our stored `registrationLinkId`) and `token_id`** in the same event — that's the real bridge.
  Combined with confirmed out-of-order delivery (§7a), **Phase 3 must correlate via `payment.captured`,
  not `token.confirmed`.**

**Phase 3A (webhook plumbing — persistence only, no activation):** added `RazorpayWebhookEvent` (dedup
by `razorpayEventId`, unique index) and handlers for `payment.captured`/`payment.failed` (correlate via
`invoice_id === registrationLinkId`) and `token.confirmed`/`paused`/`cancelled`/`rejected` (correlate via
`mandateTokenId === token.entity.id`, only when already set by a prior `payment.captured`). Each handler
only persists the raw fact on a **direct** match — no combined-state interpretation, no activation, no
settlement, no retries. Wired additively into the existing `handleWebhook` switch; the legacy
`payment.captured`/`payment.failed` handlers run unchanged, untouched. **Operational follow-up, not
code:** the live webhook subscription currently only has `payment.captured`/`payment.failed` enabled —
`token.confirmed`/`paused`/`cancelled`/`rejected` need enabling on the Razorpay dashboard/API before
Phase 3A's new handlers can ever fire in practice. **Done** — widened live during Phase 3A testing.

**Bug found + fixed during live testing (not caught by load-only verification):** Razorpay requires
`contact` on the customer for recurring Registration Links (`BAD_REQUEST_ERROR /
input_validation_failed`, confirmed live) — this isn't obvious from the docs' always-populated example
and wasn't caught because Phase 2 was only verified to *load*, never actually exercised against the live
API before merging. OAuth signups don't always have `req.user.phone` set. Fixed: `createSubscription`
now validates `req.user.phone` up front with an actionable error, instead of letting Razorpay's raw
validation error surface to the customer. **Lesson: "loads without a syntax error" is not the same bar
as "runs successfully against the live API" — Phase 3B should be smoke-tested live before being
considered done, not just required-loaded.**

**Second bug found live:** `receipt` is capped at 40 chars by Razorpay ("The receipt may not be greater
than 40 characters.") — the original `caw-${orgObjectId}-${timestamp}` format ran to 42 chars (a 24-char
Mongo ObjectId alone eats most of the budget). Fixed: shortened to `caw-${orgId.slice(-12)}-
${Date.now().toString(36)}` (~25 chars, safe margin).

**Real product gap surfaced by live testing (not a bug, a missing capability):** there is currently **no
point in onboarding that collects a phone number** before Subscribe, yet Razorpay requires `contact` for
recurring Registration Links. OAuth signups in particular never have one. Currently handled with a clear
400 error telling the customer to add a phone number to their profile first — but if there's nowhere in
the product to actually do that, real customers will get stuck at exactly this step. **This needs a real
fix (a phone-number field somewhere in signup or pre-Subscribe), not just a validation message** —
flagged here so it isn't lost; not fixed as part of Phase 2/3A (frontend/onboarding-flow scope, not
webhook plumbing).

**Third bug found live + fixed:** `plan.name` was always `undefined` (PlanConfig only has `planId`, no
`name` field) — visible to the customer on Razorpay's own hosted page as "PURPOSE: undefined Plan -
monthly." Pre-existing bug inherited from the legacy `createSubscription`'s identical line; fixed only in
the new code (uses `planId`, capitalized) — the two other occurrences remain in legacy/out-of-scope code.

**✅ Phase 3A end-to-end checkpoint — PASSED, live, with the real out-of-order scenario observed (not
just simulated):** a live Registration Link was completed (test card, contact/receipt bugs fixed) and
produced exactly 2 `RazorpayWebhookEvent` rows, no duplicates:
```
token.confirmed    subscription: null   (arrived FIRST — mandateTokenId not set yet, correctly
                                          persisted unattached, no invented correlation)
payment.captured   subscription: <id>   (arrived second, correlated via invoice_id, set
                                          paymentStatus='payment_completed' + mandateTokenId)
```
Confirmed via direct DB read: `status` stayed `"created"`, `mandateStatus` stayed `"pending"` —
**nothing activated**, exactly as scoped. This is the real-world case Phase 3B's idempotent AND-gate
(§7a) must reconcile: an unattached `token.confirmed` sitting in the event log, waiting for a mechanism
to associate it with the subscription now that `mandateTokenId` is known.

**Correction (per review):** "Phase 3A passed" describes persistence, not the system. The orphaned
`token.confirmed` row does not resolve itself — "Phase 3B will notice `mandateTokenId` is now known" is
not a mechanism, it's a restatement of the problem. The reconciliation step must be an explicit,
named piece of code with an owner (below), not an assumption.

## Phase 3B Planning — State Transitions (table first, no activation code until this is reviewed)

**Reconciliation — one shared helper, called by BOTH handlers, not embedded in either one**
(per review — tying it to `handleCAWPaymentCaptured` specifically bakes in today's observed ordering;
Razorpay does not guarantee that ordering stays this way):
```
reconcileMandate(subscription)
  → look for any orphaned token.* event (RazorpayWebhookEvent: subscription:null,
    payload.id === subscription.mandateTokenId) and claim it — set its `subscription` field (the
    existing field already means "claimed", no new field needed) and apply its status to
    mandateStatus — only meaningful once mandateTokenId is known
  → if paymentStatus === 'payment_completed' AND mandateStatus === 'confirmed':
      activate via the EXISTING setAppStatus(subscription, 'active', reason) — already idempotent
      (no-op if appStatus is already 'active'), then run the existing runFirstPaymentSettlement()
      (already idempotent — guarded by appliedCoupon.redeemed / reward-qualification checks)
  → else: no-op, wait for more facts
```
Both `handleCAWPaymentCaptured` and `handleCAWTokenEvent` persist their own fact, THEN call
`reconcileMandate(subscription)` — order-independent by construction (§7a), and correct even if
Razorpay's delivery order changes in the future.

| Event / Scenario | Pre-state | Post-state | Side effects | Idempotency rule |
|---|---|---|---|---|
| `token.confirmed`, matches an existing `mandateTokenId` | `mandateStatus: pending` | `confirmed` | store `mandateMaxAmount`/`mandateExpiresAt` from token | dedupe on `razorpayEventId` (unique index) — retry of same event is a no-op |
| `token.confirmed`, NO match (arrives before `payment.captured`) | — | — | persisted with `subscription: null` | not an error; resolved later by the reconciliation step above, not by this handler |
| `payment.captured`, first time | `paymentStatus: pending_payment` | `payment_completed` | set `mandateTokenId`; **run reconciliation** (above) | correlated via `invoice_id` — a payment retried on the same Registration Link always resolves to the same subscription |
| `payment.captured`, duplicate delivery (same `razorpayEventId`) | any | unchanged | none | unique index on `razorpayEventId` → `recordWebhookEventOnce` returns null → handler returns immediately |
| **`payment.captured` NEVER arrives** (open gap, not solved by webhooks alone) | `pending_payment` forever | — | mandate may have actually confirmed on Razorpay's side but we never learn `mandateTokenId`, so reconciliation never triggers | **Not solvable by webhook handlers alone.** A reconciliation job does NOT blindly "fix missing webhooks" — it asks Razorpay for the authoritative state: for any Registration Link stuck `pending_payment` past a **configurable timeout**, Fetch the Invoice/Payment/Token directly and apply whatever `reconcileMandate` would have applied from a webhook. This covers webhook loss, ngrok downtime, and server restarts uniformly — one job asking "what's actually true," not several crons patching symptoms (§ caution below). |
| `payment.failed` → later `payment.captured` (retry after a failed attempt) | `payment_failed` | `payment_completed` | same handler, same `invoice_id` correlation — self-healing, no special-case code needed | correlation key is `invoice_id`, not `payment_id`, so a retried attempt naturally resolves to the same subscription |
| **`payment.captured` retried by Razorpay 2-3× (at-least-once delivery)** | `payment_completed`, `active` (already activated by the first delivery) | unchanged | **the row is only ever stored once** (unique index) — but the real requirement is stronger: **business logic (activation, settlement) must run exactly once**, not just "the row is stored once." `reconcileMandate`'s activation step calls the already-idempotent `setAppStatus`/`runFirstPaymentSettlement`, so even if `recordWebhookEventOnce` somehow let a duplicate through, the second call would still be a safe no-op | two independent layers of protection: (1) dedupe at the event-log level, (2) idempotent activation at the business-logic level — neither depends on the other holding |
| **Server crashes/restarts between two webhooks** (e.g. crash after `token.confirmed` persisted but before `payment.captured` arrives; restart; Razorpay retries) | `mandateStatus` persisted (survives restart — it's in MongoDB, not memory), `paymentStatus` not yet set | on restart + retried `payment.captured`: correlates, sets `mandateTokenId`, calls `reconcileMandate`, finds the orphaned token event, activates | **must still converge correctly** — nothing in this design holds any state in process memory between webhooks (every fact is persisted immediately), so a crash between two webhook deliveries is not a special case, it's just "two independent handler invocations, in any order, at any time apart" — the same guarantee §7a already requires | if this does NOT converge after a crash+retry, that is a real bug (state was incorrectly held in memory somewhere) — worth a manual test before considering 3B done |
| `payment.captured` → later `token.rejected` (Invariant 10 case — paid, mandate never confirms) | `paymentStatus: payment_completed`, `mandateStatus: pending` | `mandateStatus: rejected` | **`status`/product access is NOT touched** — derived recovery condition (`paymentStatus==='paid' && mandateStatus!=='confirmed'`) becomes true, surfaced to UI/ops, not a stored state | token-side handler only ever writes `mandateStatus`; access decisions read the derived condition, never write it |
| `payment.captured` → `token.confirmed` → later `token.cancelled` (customer cancels autopay in their bank app, well after onboarding) | `mandateStatus: confirmed` | `cancelled` | **`status`/product access NOT touched** — only future renewals are affected (no confirmed token to charge next cycle) | mandate axis and access axis stay independent (Invariant 9) — a cancellation mid-subscription doesn't retroactively revoke the period already paid for |

**What Phase 3B is scoped to build, given this table:** the shared `reconcileMandate(subscription)`
helper (called from both handlers, not embedded in either), and the activation AND-gate itself (§7a)
gated on `paymentStatus==='payment_completed' && mandateStatus==='confirmed'`. The timeout-based
reconciliation job for "payment.captured never arrives" is a real, separate follow-up — **exactly one
job**, not a family of crons. Caution recorded here on purpose: this system must not accumulate a
reconciliation cron, an activation cron, a retry cron, a cleanup cron, and an expiry cron over time —
one reconciliation job, reused, is the target; new timing needs should extend it, not spawn a sibling.

**✅ Phase 3B implemented and proven convergent on a real, previously-stuck case (not synthetic):** the
shared `reconcileMandate(subscription)` helper (exported for reuse by the future sweep job) is called
from both `handleCAWPaymentCaptured` and `handleCAWTokenEvent` after each persists its own fact. Ran it
directly against the actual subscription orphaned during the Phase 3A live test (`paymentStatus:
payment_completed`, `mandateStatus: pending`, orphaned `token.confirmed` with no further webhook ever
coming) — this is a real instance of the "server restart / webhook never retried" convergence scenario
from the table above, not a contrived test:
```
BEFORE: appStatus=trial, paymentStatus=payment_completed, mandateStatus=pending, isPaymentConfirmed=false
AFTER:  appStatus=active, paymentStatus=payment_completed, mandateStatus=confirmed, isPaymentConfirmed=true
```
The orphaned `RazorpayWebhookEvent` row's `subscription` field is now set (no longer `null`) — claimed,
not duplicated. Activation went through `setAppStatus` (existing idempotent function, logged the
transition) and `runFirstPaymentSettlement` (existing idempotent function). Zero orphaned events remain.
The timeout-based sweep job (for the case where `payment.captured` truly never arrives at all) remains
the one open follow-up, not yet built.

## 15. How this document (and the schema) evolves

Architecture is frozen at the level of **concepts and invariants** (§1–§8, §14). **Business policy (§9)
and migration specifics (§11) stay open/configurable.** Implement against the frozen core, discover edge
cases, and update this document to stay aligned with the implementation — do not attempt to predict every
future requirement before writing code.

**Schema is intentionally evolutionary — a standing rule for every implementation phase.** Each phase
adds only the fields its own logic (and the immediately-upcoming phase) concretely requires. It is
expected and correct to extend the model in later phases as requirements become real. Do **not** invent
fields speculatively to "complete" the schema. Concretely, the model in §2 is a *current* snapshot, not a
final contract — e.g. `registrationLinkId`/status arrives with Phase 2 onboarding **if** onboarding needs
to persist it, retry/failure fields arrive with Phase 7, etc. Nobody gets the final schema right on day
one; adding a field three weeks later is normal, not a design failure.
