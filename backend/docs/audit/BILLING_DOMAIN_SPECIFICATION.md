# Billing Domain Specification

> **What this is.** Once Razorpay stopped owning the subscription lifecycle (Charge-at-Will), we did not
> build one new engine — we became responsible for an entire billing operating system. This document is
> the domain-level specification of that system: the concepts, state machines, engines, and ownership
> rules that everything else (`CAW_BILLING_DESIGN.md`, the implementation, individual endpoints) must
> conform to. `CAW_BILLING_DESIGN.md` remains the tactical companion — Razorpay-adjacent invariants,
> webhook mechanics, the concrete `calculateInvoice()` signature. This document sits above it.
>
> **Status:** specification, no code written against it yet. Per the agreed plan, the next 2-3 days of
> work are audit/specification passes through Chapters 1-7, in order, before any new endpoint is written.
> Code becomes translation of a settled model, not discovery of business rules while writing controllers.

---

## Chapter 1 — Core Concepts

| Concept | Definition |
|---|---|
| **Subscription** | The customer's *current* commercial and mandate state. Never holds history. |
| **BillingCycle** | One period's record — what was invoiced, what was charged, what happened. History lives here, not on Subscription. *(⚠️ Corrected, contradiction audit: the original wording here referenced "one Billing Bucket," a model this very table supersedes two rows below. Under the current model, a BillingCycle's period is whatever a `RENEWAL` Commercial Event bundles together for a subscription on a given day — see Billable Item and Commercial Event, below — not a declared bucket.)* |
| **Billing Anchor** *(✅ current, §3.7 — now per-component, not per-subscription)* | The date a given `BillableItem` was added/purchased — its own independent renewal anniversary. The base Plan's anchor happens to be the subscription's first-ever payment (it's simply the first component); every add-on gets its own anchor from its own purchase date. Never resets on upgrade/downgrade/cadence change/late-payment recovery. |
| **Billable Item** *(✅ current, §3.7 — replaces "a Subscription has one billing cycle" AND the short-lived "Billing Bucket" model)* | The smallest independently-billable unit: a Plan or an add-on (type `PLAN`/`ADDON`), each owning its own price snapshot, quantity, frequency, and renewal dates. Answers *"what is recurring?"* — **not** "what produces one invoice" (that's Commercial Event, below — conflating the two was corrected mid-session). |
| **Commercial Event** *(✅ current, §3.7 — the concept that actually determines invoice boundaries)* | Answers *"why are we billing right now, and what does this invoice cover?"* Exactly four types: `NEW_PURCHASE`, `MID_CYCLE_PURCHASE`, `RENEWAL`, `RETRY`. A `RENEWAL` event bundles every `BillableItem` due that day for a subscription into **one** invoice — components don't each get their own invoice just because they're independent recurring units. |
| ~~Billing Bucket~~ | ❌ Superseded within the same design session — see §3.7. Assumed same-cadence components consolidate structurally; the final model achieves a similar practical effect (grouped renewal invoicing) through Commercial Event grouping + mid-cycle anchor realignment instead, not a declared bucket. |
| **Invoice** | The priced output of one billing event (renewal, upgrade, add-on purchase) — line items, credits applied, tax, total. Immutable once paid. |
| **Payment** | One Razorpay transaction — its IDs, status, method. Belongs to exactly one BillingCycle. |
| **Credit** | A monetary amount owed *to* the customer, to be applied against a future invoice — regardless of origin (referral, coupon, wallet, admin grant, refund). |
| **Mandate** | The Razorpay-side reusable authorization (token) that lets us charge on demand, up to a cap. Its lifecycle is Razorpay's; we only observe and react to it. |
| **Change** | A requested modification to the Subscription's commercial state — the unifying concept behind "upgrade," "downgrade," "add add-on," "remove add-on," "seat increase/decrease," "billing cycle change." Resolved immediately (NOW) or becomes a **Scheduled Change**. |
| **Scheduled Change** | A Change whose effective time is NEXT_RENEWAL, persisted as its own record (not a flag on Subscription). A subscription has **one current state** but **many independent Scheduled Changes**, one per target (Chapter 3.2 Rule 1). The Renewal Engine applies every Scheduled Change whose effective date has arrived, as a set. |
| **Policy** | A business rule with a value (proration formula, grace period length, retry cadence, coupon stacking rule) — always configurable, never hardcoded into an engine. |
| ~~Commercial Transaction~~ | ❌ **Superseded — this concept turned out to be unnecessary and is not part of the domain vocabulary.** It was originally proposed to give Invoice/Payment/Settlement a shared parent record, specifically to resolve "does a second upgrade before payment reuse the Order or create a new one" (Chapter 5 P9). That question is now closed by **Chapter 10's Law 11** ("a subscription can never have more than one collectible invoice at a time") without needing any new object — a second commercial action simply voids the first pending invoice and replaces it. No dedicated "Commercial Transaction" record is needed; **Commercial Event** (§3.7) already does the job this concept was reaching for. |
| **Commit Engine** *(✅ mechanism decided, §3.5 R13.5 — no longer "deferred")* | Implements the idempotent-commit invariant via **the Reconciliation Engine, not a rollback or saga**: `CommitInvoice(paymentId)` is safe to call any number of times; on partial failure, the payment is treated as the source of truth and every remaining step is repaired *forward* on retry (never reversed) — the exact pattern already proven live in Phase 3B's `reconcileMandate`. Not a new mechanism to build from scratch; an extension of one already working. |

These concepts (excluding the struck-through, superseded ones) are the entire vocabulary of the domain. Every capability (Chapter 4) is built from combinations of these; no capability introduces a concept not on this list.

---

## Chapter 2 — State Machines

Six state machines. Each is independent — a transition in one never directly writes a field in another; cross-machine effects happen only through an engine reading multiple states and deciding (Chapter 3).

### Subscription (product access)
```
trialing → active → past_due → retrying → suspended
              ↑___________________________|  (payment recovers)
any state → cancelled
```
Owned by: **Subscription Engine** (state itself), written by: **Renewal Engine**, **Retry Engine** (transitions), per the Ownership Matrix (Chapter 6).

### Mandate (can we auto-charge)
```
none → pending → confirmed → paused ⇄ confirmed
                → rejected
                → cancelled
(cancelled/rejected → pending, via a new Acquire Mandate)
```
Owned by: **Subscription Engine** (field), written by: **Change Engine** (Acquisition) and raw Razorpay webhook facts (no business interpretation at write time — see CAW_BILLING_DESIGN.md §7a).

### Payment (one transaction)
```
created → authorized → captured
                     → failed
```
Owned by: **BillingCycle Engine**. A Payment belongs to exactly one BillingCycle; never reused across cycles (Invariant, Chapter 6).

### BillingCycle (one period)
```
pending → paid
        → failed → retrying → paid
                             → written_off (retries exhausted, grace elapsed)
```
Owned by: **BillingCycle Engine**, driven by: **Renewal Engine** (creates it) and **Retry Engine** (advances it on failure).

### Change — ✅ FORMAL STATE MACHINE (supersedes the earlier sketch)

```
                         Requested
                             │
                  ┌──────────┴──────────┐
                  ▼                     ▼
             Immediate              Scheduled
           (payment now)            (renewal)
                  │                     │
                  ▼                     ▼
          AwaitingPayment          PendingRenewal
                  │                     │
         payment fails/expires    renewal date arrives
                  │                     │
                  ▼                     ▼
             Cancelled               Applying
                                        │
                                        ▼
                                    Completed
```
Plus two terminal states reachable from `Requested` directly: **Rejected** (never accepted — e.g.
downgrade below minimum plan, incompatible/archived add-on, or blocked by Rule 4) and **Superseded**
(a `PendingRenewal` change replaced by a later same-target request — Chapter 3.2 Rule 1).

| State | Meaning |
|---|---|
| **Requested** | Customer asked for a change. Nothing exists yet — no invoice, no subscription mutation. This stage decides: immediate or scheduled? allowed or rejected? payment required? |
| **AwaitingPayment** (immediate changes only) | Invoice + Razorpay Order created. **Subscription still unchanged.** Customer may pay or abandon — nothing has happened either way. |
| **Cancelled** | Payment never succeeded (closed checkout, failed payment, expired order). Invoice → cancelled, Change → cancelled, Subscription → untouched. |
| **PendingRenewal** (scheduled changes only) | No checkout, no Order, no invoice — the customer already paid for the current period. Customer keeps current plan/add-ons/limits/renewal-date exactly as-is until renewal. |
| **Applying** | Entered ONLY after payment confirmation (immediate) or at renewal date (scheduled). The commit step — see Rule 6, idempotent by requirement. |
| **Completed** | Commercial state changed, everything committed: invoice paid, subscription updated, BillingCycle updated, events written, rewards consumed. |
| **Superseded** | A `PendingRenewal` change replaced by a later request for the same target (Rule 1). |
| **Rejected** | Never accepted into the engine at all — no invoice, no payment, no Change record persisted. |

**Renewal-time Applying is a set operation, not per-change:** the Renewal Engine asks "do I have pending
changes?", and if yes, applies **all of them together in a single transaction** — one subscription
update, one invoice, one renewal event — not one commit per scheduled change.

Owned by: **Change Engine** (Chapter 3.2 — four categories, two effective times, one Scheduled Change per
target). Many `PendingRenewal` changes may coexist across *different* targets simultaneously — not a
single pending-downgrade flag, each is its own record, all applied atomically as a set at the next
renewal.

**Change Engine Invariants (hard rules, not guidelines):**
1. **A commercial change never mutates the Subscription before payment confirmation.** (This IS the
   "payment confirmation is the only commit point" invariant locked earlier in this chapter — restated
   here precisely for the state machine; the two are the same rule, not two rules.)
2. Every **immediate** change has exactly one invoice.
3. **Scheduled** changes never create an invoice until renewal.
4. Only one `PendingRenewal` change may exist per commercial property/target (Chapter 3.2 Rule 1) —
   different targets (a pending downgrade + a pending add-on removal) coexist freely.
5. Payment confirmation is the **only** event that transitions `AwaitingPayment → Applying`. No frontend
   callback, no browser redirect, no optimistic update counts.
6. **Every `Applying` step must be idempotent** — a crash mid-`Applying`, followed by a rerun, must
   safely complete remaining work with no duplicated invoices, events, rewards, or subscription
   mutations. (This is the Commit Engine's job, Chapter 1 — invariant locked now, mechanism deferred.)
7. **⭐ The Billing Engine never hides user intent** (added during Add-on specification, §4.3 — this is
   the invariant that most changes the storage model). The engine never silently merges, cancels,
   replaces, or infers a commercial action on the customer's behalf. If the customer performs five
   actions, the system remembers five actions — each its own immutable `SubscriptionChange` record. The
   Renewal Engine's job is to *execute* every record whose effective date has arrived, in sequence, not
   the Change Engine's job to *collapse* several actions into one before storage. Consequence: **the
   engine stores intent, not derived state.** Never store `pendingRemoval=true` on a Subscription —
   store a `SubscriptionChange{type:REMOVE_ADDON, effectiveAt}` record; `pendingRemoval` becomes a
   derived read ("is there a scheduled REMOVE_ADDON for this target?"), never a written field. This keeps
   the code deterministic (no engine-side judgment calls), the audit trail complete, invoices
   explainable, and the UI transparent — exactly what the customer clicked is exactly what's stored and
   exactly what executes.

**⚠️ How Invariant 7 interacts with L1-L4 (Phase 1.3) — reconciled, not contradicted.** `PLAN` and
`BILLING_CYCLE` still replace-on-conflict (L1/L2) — but this is a **structural fact, not a convenience
simplification**: a subscription has exactly one future plan and one future billing cadence; two
different scheduled plan changes cannot both meaningfully execute, so only one can be `Pending` at a
time. Critically, per Invariant 7, the superseded one is **not deleted** — the Ledger entry state
machine (Phase 1.3) already has a `Superseded` terminal state precisely so the customer's full sequence
of decisions stays visible, even though only one record is ever the *active* one for that property.
**`ADDON` changes are different in kind, not degree:** multiple `SubscriptionChange` records for the
*same* add-on target genuinely coexist and all execute — an immediate `ADD Storage` and a
renewal-scheduled `REMOVE Storage` are not contradictory, they act at different times and both fire. No
replace/supersede logic applies to add-ons at all, quantity or feature-type alike.

### Phase 1.2 — Change Decision Engine — ✅ SPECIFIED (the brain; every endpoint calls this, not its own logic)

```
Upgrade API  \
Add-on API   ---→ Change Engine.decide(request) → Decision → execute(decision)
Downgrade API/
```

**The engine answers exactly six questions, nothing else.** It never talks to Razorpay, never computes
GST, never touches Mongo — pure decision-making:
```
1. Is this request valid?
2. What exactly changes?
3. When does it become effective?
4. Is payment required?
5. Does anything already scheduled conflict?
6. What should happen next?
```

**Decision Pipeline — every request, same six stages, no exceptions:**
```
Receive → Validate (D1) → Normalize (D2) → Resolve Conflicts (D3)
        → Effective Date (D4) → Payment Decision (D5) → Renewal Impact (D6) → Decision
```

**D1 — Validate.** Rejects before anything else exists: plan doesn't exist, plan archived, add-on
doesn't exist, add-on incompatible with current plan (never silently removed — simply not purchasable,
per the earlier add-on-compatibility rule), a pending downgrade exists and this is *any* other commercial
action (Rule 2, enforced here — the frontend disabling buttons is UX only, the backend is the actual
enforcement), requesting the plan/add-on state the subscription is already in, or removing an add-on not
owned.

**D2 — Normalize.** Every request becomes one shape regardless of which endpoint it arrived through
(`POST /upgrade`, `POST /change-plan`, `POST /billing-cycle` — irrelevant downstream): `PLAN_CHANGE`,
`ADDON_ADD`, `ADDON_REMOVE`, `BILLING_CYCLE_CHANGE`. Later stages never know or care which HTTP route
produced the request.

**D3 — Conflict Resolution (hardest stage) — Rules C1-C6:**
| Rule | Existing pending | New request | Result |
|---|---|---|---|
| C1 | Pending downgrade | anything | **Reject** (Rule 2) |
| C2 | Pending remove Add-on A | remove Add-on A again | **Replace**, no duplicate |
| C3 | Pending remove Add-on A | remove Add-on B | **Keep both** — different target |
| C4 | Pending remove Seat add-on | remove Storage add-on | **Keep both** — different target |
| C5 | Pending remove Seat add-on | remove Seat add-on again | **Replace** |
| C6 | Pending billing-cycle change | billing-cycle change again | **Replace**, newest wins |

This is Chapter 3.2's Rule 1 (one Scheduled Change per target) operationalized: the engine maintains
**one pending record per commercial property** — `Pending Plan Change`, `Pending Billing Cycle Change`,
`Pending Addon Removal A`, `Pending Addon Removal B`, ... — never a single monolithic "pending change."

**D4 — Effective Date** and **D5 — Payment Decision** — restate the Chapter 3.2/4.1 tables (Upgrade/
Add-on-add/Billing-cycle → now, payment required; Downgrade/Add-on-remove → renewal, no payment) as the
engine's actual decision output, not just documentation.

**D6 — Renewal Impact** — what changes for every *subsequent* cycle, stated explicitly per change type
(e.g. downgrade: `currentCycle=Business, nextCycle=Starter`; remove add-on:
`currentCycle=[Storage,Seats,Analytics], nextCycle=[Seats,Analytics]`; billing-cycle switch: current
cycle replaced immediately, new renewal date = today + 365).

**Output — a Decision Object** (conceptual, not code yet). Three examples:
```
Approved / Plan Upgrade / Effective: Immediately / Payment: Required
  → Invoice: Create, Checkout: Start, Renewal: Update immediately
  → Events: PLAN_UPGRADE, PAYMENT_SUCCESS

Approved / Downgrade / Effective: Renewal / Payment: None
  → Invoice: None, Pending Change: Create, Renewal: Apply at cycle end
  → Events: DOWNGRADE_SCHEDULED

Rejected / Reason: Pending downgrade exists
  → No invoice, no payment, no checkout, no mutation
```

### Next section (per the stated plan): Commercial Change Ledger (Pending Change Model)

**A real gap, surfaced while specifying D3:** every stage above says "create a pending downgrade" /
"one record per property" but **the storage model for a pending change doesn't exist yet.** Without it,
the Renewal Engine, the UI, and the reconciliation scheduler would each end up inventing their own
representation of "what's scheduled" — exactly the kind of drift the legacy `pendingUpgrade` /
`pendingPlanChange` duplication (found and worked around in `CAW_BILLING_DESIGN.md`'s Phase 5 notes)
already caused once. This is the last major building block before the Renewal Engine — specified next.

### Phase 1.3 — Commercial Change Ledger — ✅ SPECIFIED

**Deliberately a Ledger, not a queue.** A queue implies ordering/replay; this is *future approved
commercial state* — the Renewal Engine doesn't replay history, it asks "what future state has already
been approved?"

**What it stores:** every approved commercial change **not yet in effect.** It does **not** store
immediate changes — `Upgrade → Payment → Completed` needs no pending record; it becomes history the
instant it completes. The Ledger is exclusively the scheduled/future side.

**One entry = one future commercial mutation** — not an endpoint, not a checkout, not a payment. A
single renewal may apply 1, 5, or 20 ledger entries together in one transaction.

**Ledger entry state machine:**
```
Created → Pending → Applying → Completed
Created → Superseded
Created → Cancelled
```

**Exactly three categories** (not six — seats are an add-on, so they collapse in):
| Category | Cardinality | Reason |
|---|---|---|
| `PLAN` | at most **one** pending, always | there is only one future plan |
| `BILLING_CYCLE` | at most **one** pending, always | there is only one future billing cadence |
| `ADDON` (keyed per add-on id) | **unlimited**, one per distinct add-on | Remove Analytics + Remove Storage + Remove AI + Remove SMS can all coexist |

**Identity is the commercial property, not a UUID.** `PLAN`, `BILLING_CYCLE`, and one `ADDON_ID` per
add-on are the only identities that exist. This is what makes supersession deterministic:

| Rule | Meaning |
|---|---|
| L1 | `PLAN` replaces `PLAN` — `Business→Growth` then `Business→Starter`: only `Starter` survives |
| L2 | `BILLING_CYCLE` replaces `BILLING_CYCLE` — only the latest survives |
| L3 | ❌ **Corrected (Chapter 17) — L3 as originally written here does not apply to `ADDON_ID` at all.** `ADDON` changes never replace on identity alone — see the very next paragraph below, and §4.3's decided quantity-add-on walkthrough, both of which already state add-ons always coexist and never replace, regardless of same or different target. L3 was an error carried over from L1/L2's PLAN/BILLING_CYCLE framing; add-ons were never actually meant to follow it, and no code or later decision in this document ever implemented "replace" for a same-`ADDON_ID` request. |
| L4 | `ADDON_ID` never replaces a *different* `ADDON_ID` — both coexist (this remains true, but is now understood as a special case of "add-ons never replace," not a contrast with L3) |

(L1-L2 are the same rule as Rule 1 / C1-C6 above, restated as the storage-layer identity model for
`PLAN` and `BILLING_CYCLE` specifically — L3/L4 do not extend that same "replace on identity" pattern
to `ADDON`, per the correction above.)

**`effectiveAt`, not `createdAt`, is what the Renewal Engine queries.** A change created June 4th with
`effectiveAt` = the June 30th renewal sits inert until then. Renewal query is exactly:
`effectiveAt <= now AND status = Pending` → apply all as one transaction → `Completed`.

**A ledger entry disappears before execution for exactly three reasons:** (C1) superseded by a later
same-identity request (L1-L4), (C2) the subscription itself is cancelled — everything pending dies with
it, (C3) an admin manually removes it (rare, still possible).

**✅ DECIDED — the live-reference vs. snapshot question:** if a target plan's price/features change
between scheduling and renewal, the ledger stores **only the target reference** (Option A), not a frozen
snapshot. At renewal, the plan is looked up **as it exists that day** — if Growth's price changed while a
downgrade to Growth was pending, the customer gets the new price. Chosen because it produces a
*materially cleaner engine* (no snapshot-staleness/reconciliation-with-catalog-changes problem to solve
later) — explicitly a deliberate product tradeoff, not a default.

### Credit (an invoice credit, any origin)
```
earned → available → applied (to a specific invoice)
                    → expired (if the origin defines an expiry)
                    → revoked (origin-side reversal, e.g. referral fraud)
```
**⚠️ Correction (contradiction audit) — "Credit Engine" below is the superseded name; owned in
practice by the Coupon Engine (§3.6a) or the Referral Engine (§3.6b) depending on origin, not by a
single generic engine.** Owned by: the Coupon Engine (for coupon-origin credits) or the Referral
Engine (for referral-origin credits) — there is no single "Credit Engine" object; wallet/admin/refund
credit sources remain explicitly out of scope per §3.6's decision, not additional Credit Engine
origins.

---

## Chapter 3 — Business Engines

Nine engines (a 9th added below — see 3.9, a real gap found only after eight engines' worth of workflow
examples all silently assumed something calls them in order without ever naming what that something is).
Each has one responsibility and **never reaches into another engine's storage directly** — it reads
facts and calls the other engine's function, per the Ownership Matrix (Chapter 6).

### 3.1 Subscription Engine
Owns Subscription's current-state fields. Never calculates money, never charges. Pure state + validated transitions (reuses `setAppStatus`-style guarded writes, generalized beyond just `appStatus`).

### 3.2 Change Engine — ✅ SPECIFIED (implementation not started)

Knows nothing about Razorpay. Only answers: *"the customer wants to change something — what should
happen?"* Every capability in Chapter 4 is a call into this one engine with different input, not a
separate implementation.

**There are exactly four kinds of commercial change — not "upgrade/downgrade/seat increase/seat
decrease."** Those are user-facing names; internally they're all one of:

```
1. Plan Change        (Starter ↔ Growth ↔ Business)
2. Add-on Change       (add / remove / increase / decrease quantity — seats are just an add-on, no special seat logic)
3. Billing Cycle Change (Monthly ↔ Yearly — NOT a plan change, its own category)
4. Cancellation         (immediate or end-of-cycle, per policy)
```

**Every change has exactly one effective time — nothing else exists:**
```
NOW | NEXT_RENEWAL
```

| Change | Effective | Charge now? | Invoice | Renewal action |
|---|---|---|---|---|
| Plan upgrade | NOW | Yes | Immediate | Already applied |
| Plan downgrade | NEXT_RENEWAL | No | Renewal | Apply at renewal |
| Add-on add / quantity increase | NOW | Yes | Immediate | Already applied |
| Add-on remove / quantity decrease | NEXT_RENEWAL | No (no refund) | Renewal | Remove at renewal |
| Billing cycle change (either direction) | NOW | Yes | Immediate | Already applied |
| Cancellation | per policy (NOW or NEXT_RENEWAL) | No | None | End subscription |

**Billing Cycle Change is deterministically NOW, always** — the current period ends immediately, a new
one starts immediately, priced by unused-value repricing (airline-style):
```
unusedValue = oldPeriodPrice × (daysRemaining / totalCycleDays)
newPeriodPrice = newCycleFullPrice
amountDue = newPeriodPrice − unusedValue
```
Example: Monthly ₹450, 20 of 30 days unused → unused value ₹300; Yearly ₹5400 → invoice = ₹5400 − ₹300 =
₹5100. Same algorithm in reverse (Yearly→Monthly, unused yearly value credited toward the new monthly
period). This is why Billing Cycle Change is its own category, not a variant of Plan Change.

**Scheduled Change model (superseding the earlier "single pending downgrade" draft):** a subscription
has **one current state** and **many independent Scheduled Changes** — not a set of ad hoc
`pendingDowngrade`/`pendingAddonRemoval`/`pendingSeatDecrease` flags on the Subscription document. Every
NEXT_RENEWAL change is its own record, typed (`PLAN_CHANGE`, `ADDON_ADD`, `ADDON_REMOVE`,
`BILLING_CYCLE_CHANGE`, `CANCELLATION`), with a target and an effective date. The Renewal Engine's job
becomes mechanical: *select every Scheduled Change with `effectiveDate <= today AND status = scheduled`,
sort, apply.* No special-casing per combination.

**Rule 1 — one active Scheduled Change per target.** Many Scheduled Changes may coexist (a plan
downgrade + an add-on removal + a seat reduction, all for the next renewal), but only one per **target**:
```
Target: Plan            → at most one scheduled plan change
Target: a specific add-on (AI, WhatsApp, Storage, Seats, ...) → at most one scheduled change EACH
```
Valid: `Business→Growth` (plan) + `Remove AI add-on` + `Seats 10→5` — three different targets, all
coexist as one future "renewal package." Invalid as three separate records: `Growth→Starter` then later
`Starter→Business` — same target (Plan); the later request **replaces** the earlier one, it does not
stack. Same logic for quantity changes on the same add-on (schedule "remove 5 seats," then later
"actually only remove 2" — updates the existing record, no second one created) and for direct reversals
(schedule "remove AI add-on," then later "add AI add-on back" — the scheduled removal is **cancelled**,
not left to fire alongside a contradictory add).

**Rule 2 — what gets blocked, and why (resolves Interaction Matrix Q1 AND Q2, Chapter 5; supersedes the
earlier "disable everything while a downgrade is pending" draft):**
- **Blocked:** any **immediate/charge-now** change (an upgrade, adding a paid add-on now, a billing
  cycle change) while *any* Scheduled Change exists. Charging more right now while the subscription is
  already scheduled to change contradicts the customer's stated future state.
- **Allowed:** additional **Scheduled Changes** (another downgrade-direction plan change subject to Rule
  1, an add-on removal, a seat reduction, a cancel-at-renewal) — as long as each targets something not
  already scheduled, or updates/cancels its own existing scheduled record per Rule 1. These all merge
  into the same future renewal package; the Renewal Engine applies them together, atomically, on the
  effective date.

This means **Q2 is now fully answered, not just narrowed:** an add-on removal *can* coexist with a
pending downgrade — they're different targets, both NEXT_RENEWAL, both apply at the same renewal. What's
blocked is only the *immediate* side (no upgrading NOW while a downgrade is scheduled), not scheduling
more for later.

**⭐ THE core invariant of the entire Change Engine — payment confirmation is the only commit point for
any immediate commercial change.** Until a payment is confirmed:
- Subscription (plan, add-ons, billing cycle, renewal date, access) **never changes**.
- Credits are **never consumed**.
- The only things that exist are **temporary artifacts**: an Invoice Preview / pending Invoice, a
  pending Razorpay Order, a Credit *reservation* (not consumption).

Everything commits in **one place, atomically, only after payment confirmation** — this is the single
biggest simplification available to this system, and it generalizes/strengthens
`CAW_BILLING_DESIGN.md`'s existing Invariant 2 ("only a captured payment advances a period") from *just
period advancement* to *every immediate commercial change*. It also collapses webhook logic to one shape:
`payment confirmed → CommitInvoice() → everything updates`. There is exactly one place in the system
where commercial state mutates.

**Add-on compatibility across a plan change — ✅ refined by Renewal Engine R10 (Chapter 3.5):** when
scheduling any plan change, add-ons the target plan still supports are **not silently carried forward or
silently dropped** — the customer is explicitly asked to choose. Add-ons the target plan does not
support **cannot** be carried (not a real option) and are automatically scheduled for removal effective
the same renewal — no separate decision needed since there's nothing to decide. This means the Renewal
Engine (R3) never encounters an add-on it doesn't know what to do with: every add-on is either
carry-forward-confirmed or auto-scheduled for removal by the time renewal day arrives.

### 3.3 Invoice Engine — ✅ SPECIFIED (the actual algorithm, not just `calculateInvoice()`'s signature)

Answers one question for every endpoint, cron, retry, and renewal: *"given the current subscription and
a requested billing event, what exactly should the customer pay?"* Receives **already-resolved**
commercial state (Renewal Engine's R3 resolves pending changes before calling this; an immediate
Upgrade/Add-on's Change Engine decision resolves it before calling this) — **the Invoice Engine never
sees a pending change, only current state to price.** Nothing mutates, no charging, no persistence side
effects (Invariant 6, `CAW_BILLING_DESIGN.md` §5).

**Stage 1 — Determine Billing Context.** Why does this invoice exist? Everything downstream depends on
this:
```
NEW_SUBSCRIPTION | RENEWAL | PLAN_UPGRADE | BILLING_CYCLE_CHANGE | ADDON_PURCHASE
RETRY | MANUAL | REFUND | ADMIN_ADJUSTMENT
```

**Stage 2 — Load Commercial State** (read-only): plan, billing cycle, active add-ons, pending changes
(for context only — see below), referral credits, coupons, taxes, mandate, current period, current
invoice, usage (future — metered/overage billing not yet designed, flagged below).

**Stage 3 — Apply Changes, via the Change Engine, never decided here.** The Invoice Engine asks the
Change Engine *"what should the commercial state be for THIS invoice?"* — it never resolves this itself.
Example: an Upgrade context returns the new plan + carried add-ons; a `RENEWAL` context (after R3 already
ran) returns whatever the post-scheduled-changes state is; a mid-cycle check on a subscription with a
*pending* downgrade returns the *current* (unchanged) state, because the downgrade isn't effective yet.

**Stage 4 — Generate Billable Items (no totals yet).** Every priced component becomes its own line item
first — plan, each add-on, etc. — before any arithmetic happens. This is what makes the frozen invoice
fully transparent (the "show everything" decision, §4.1).

**Stages 5-7 — ✅ RE-FINALIZED (§3.6 correction: Coupon and Referral are two distinct engines, not one
merged "Credits" step).** Three genuinely distinct concepts, each its own phase, in a deterministic,
mathematically-necessary order:

- **Stage 5 — Commercial Adjustments (Pricing, not a discount)** — proration, unused old-plan/old-cycle
  value. Answers *"what is the correct amount before any incentive?"* Must happen first: the customer
  never pays for value they already own.
- **Stage 6 — Coupon Engine (§3.6a).** Per-billable-item discount lines (`Growth Discount −₹45`, `Seat
  Discount −₹18`) — never a lump total, and never merged with referral logic; a coupon rule only ever
  matches the invoice lines it's scoped to.
- **Stage 7 — Referral Engine (§3.6b).** Applied on the invoice total *after* coupon discounts — a
  referral reward is a single reduction on the total, not a per-line rule like coupons.

**Order is `Commercial Adjustments → Coupon → Referral`, mathematically required, not a preference** —
discounting against the pre-proration list price would discount value the customer never owed. Every
line item stays visible at every stage — nothing collapses into a single number until Stage 8 (GST).

**⭐ Invoice Engine Invariant 1 — ✅ locked: the Invoice Engine never prices against an outdated
commercial state.** On every billing event: load Subscription → find every pending change effective
*today* → apply **all** of them → persist the resulting commercial state → **only then** calculate the
invoice. This is not a new rule — it's the Invoice Engine's own restatement of what the Renewal Engine's
R3 (§3.5) already established (apply scheduled changes, then price) — recorded here explicitly so the
Invoice Engine itself never has to ask "should I use the old quantity/plan?" mid-calculation. That
question is always already answered by the time pricing starts.

**✅ DECIDED — every invoice carries exactly one `reason`/trigger, even when multiple things happen in
one event.** `NEW_SUBSCRIPTION | RENEWAL | PLAN_UPGRADE | ADDON_PURCHASE | BILLING_CYCLE_CHANGE | RETRY |
ADMIN_ADJUSTMENT`. A renewal that bundles a Plan + two add-ons is still `reason: RENEWAL` — the bundled
items are line items, not separate reasons. (`PLAN_DOWNGRADE` is not a real invoice trigger — downgrades
are scheduled, never invoiced directly; they surface later as a `RENEWAL` invoice reflecting the new,
lower state.)

**Stage 8 — Tax.** GST always last, on the fully-adjusted taxable amount — this is a tax-regulation
requirement, not an engine design choice (flagged explicitly: do not treat GST-vs-discount ordering as a
free parameter; follow applicable GST rules for discounts/credits).

**Stage 9 — Rounding.** Nearest whole rupee throughout (matches this product's existing whole-rupee
pricing) — not paise-level precision, not a separate "rounding adjustment" line unless a future policy
decision changes this.

**Stage 10 — Freeze.** The invoice becomes immutable (`CAW_BILLING_DESIGN.md` Invariant 5, confirmed
again here) — and specifically **stores full snapshots, never references**: plan name, price, add-ons,
coupon, credits, tax — all as they were at invoice time. If the plan's price changes six months later,
the invoice from six months ago must still read correctly. (Deliberately different from the Ledger's
Option-A *live-reference* decision, Phase 1.3 — a **scheduled change** looks up the plan fresh at
renewal, but the **invoice**, once generated, freezes what it priced. These are different objects with
different rules, not a contradiction.)

**Invoice metadata (the frozen invoice's companion fields — not just money):** every invoice carries `invoiceNumber`,
`organization`, `subscription`, `billingPeriod`, `issueDate`, `dueDate`, `generatedBy`, `invoiceType`,
`paymentMethod`, `mandateId`, `orderId`, `paymentId`. **✅ decided — invoice carries an explicit
`type`** (`renewal | upgrade | addon | manual | retry | billing_cycle_change | initial_subscription`),
never inferred from line items — makes finance, analytics, debugging, and support materially easier than
reverse-engineering intent from a line-item list.

**✅ DECIDED — add-on purchase invoices show ONLY the purchased add-on(s), never the subscription plan
again.** The plan itself isn't being charged in this transaction — repeating it would misrepresent what
the customer is actually paying for right now.

**Full, finalized pipeline:**
```
Commercial State → Apply Requested Change → Price New Commercial State
  → Commercial Adjustments (proration/unused value) → Credits (referral/wallet/admin/refund)
  → Coupons → GST → Rounding → Freeze Invoice
```

**Full worked example, showing every line (the "tell the entire story" principle, §4.1):**
```
Growth Plan                                    ₹450
Extra Users (2)                                ₹200
WhatsApp Addon                                 ₹150
------------------------------------------------
Commercial Total                               ₹800
Unused Starter Plan Credit (15 days)          −₹125
------------------------------------------------
Subtotal                                       ₹675
Referral Reward                               −₹100
Coupon (WELCOME10)                             −₹50
------------------------------------------------
Taxable Amount                                 ₹525
GST (18%)                                      ₹94.50
------------------------------------------------
Grand Total                                    ₹619.50
```

#### Line Item Taxonomy — exhaustive pass, not just what's been named in conversation so far

Every invoice, of any Billing Context, is expressible as a combination of these standardized types. Split
into **already required by a capability already specified** vs. **anticipated but not yet designed** —
the second group is named so the taxonomy has room for it, not because that capability is built.

**Charges — already required:**
| Line item | Used by |
|---|---|
| Plan charge | Upgrade, Renewal, New Subscription |
| Add-on charge (feature/boolean) | Add-on purchase |
| Add-on charge (quantity) | Add-on purchase (seats etc.) |
| Proration charge | Add-on purchase mid-cycle |
| Proration charge (new-cycle full price) | Billing Cycle Change |
| Renewal charge | Renewal |
| Manual adjustment (+) | Admin adjustment |

**Charges — anticipated, not yet designed (flagged, not assumed):**
| Line item | Why it will eventually exist |
|---|---|
| Overage / usage charge | Stage 2 already lists "Usage (future)" as a fact to load — metered billing beyond an included quota is a real future capability, not designed |
| Reinstatement / late fee | Reactivating after `suspended` — whether this exists at all, and its amount, is undecided (Chapter 3.4 Policy Engine territory) |
| Rounding adjustment | Currency-subunit rounding across multi-step proration math could leave a paisa-level discrepancy; whether this needs its own visible line or is silently absorbed is undecided |

**Credits / Discounts — already required:**
| Line item | Used by |
|---|---|
| Proration credit | Upgrade (unused old-plan value), Billing Cycle Change (unused old-cycle value) |
| Referral reward | Referral Engine (§3.6b) |
| Coupon discount | Coupon Engine (§3.6a) |
| Manual credit | Admin adjustment / support goodwill |
| Refund credit | ❌ Not applicable — refunds are closed as a policy (Chapter 12: none, ever). A billing-error correction (Chapter 19, CP5) is a distinct, separate line-item concept, not this one. |

**❌ Corrected — Wallet/Loyalty/Migration credit are explicitly OUT OF SCOPE, not "anticipated."** §3.6's
generic Credit Engine (which named these as a "tomorrow" list) was itself superseded — there are only
two real discount actors in this product, Coupon and Referral (§3.6a/3.6b). These three line-item types
are not being designed for or against; if a real wallet/loyalty feature is ever requested, it gets its
own specification pass then, not a retrofit into a speculative abstraction built today. `Manual Credit`
and `Promotional Credit` remain valid **line-item types** (an admin can still issue an ad hoc credit),
but do not get their own engine — they're simple, direct amount adjustments, not a policy-driven system
like Coupon/Referral.

**Taxes:**
| Line item | Status |
|---|---|
| GST (18%) | ✅ the only tax type this system supports; **explicit scope boundary, not an oversight** — multi-region tax (VAT, US sales tax) is out of scope until this product needs it |

**What's still genuinely open, surfaced by trying to be exhaustive:** whether `RETRY` context invoices
are a *new* invoice or a re-attempted charge against the *same* frozen invoice (an immutable invoice,
per Invariant 5, cannot gain/lose line items on retry — so a retry must reuse the same frozen invoice
object and only create a new Payment attempt against it, never regenerate line items). This wasn't
explicitly stated as a rule until this pass; recorded here as the answer implied by Invariant 5, not a
new invention.

### 3.4 Policy Engine
Currently scattered across the codebase (proration math inline in `updateSubscription`, GST inline in `pricingEngine`, retry numbers not yet written anywhere). Consolidation target for: proration formula, grace period, retry cadence/count, suspension trigger, credit-stacking order, seat policy, add-on compatibility rules, refund policy, cancellation policy. **Pure business rules — no I/O, no Razorpay calls, just "given these inputs, what does policy say."**

### 3.5 Renewal Engine — ✅ DEEPENED (granular R1-R13 walkthrough, same rigor as the Change Engine pass)

**Framing that matters more than any individual step:** the Renewal Engine is not "charge the customer."
It's **one atomic Commercial Renewal Transaction** — input `{Subscription, BillableItems, Pending
Changes, Coupons, Referral Rewards, Current Billing Cycle, Mandate, Policy, Current Date}`, output
either `Renewal Completed` or `Renewal Failed`. Everything else is internal.

**R1 — Is this subscription due?** `renewalDate <= now`? No → stop, nothing interesting. Yes → continue.

**R2 — Is this subscription renewable? ✅ DECIDED — explicit ownership boundary with the Retry Engine:**
| `appStatus` | Renew? | Why |
|---|---|---|
| `active` | YES | normal case |
| `trial` | NO | not yet a paying renewal |
| `past_due` | YES (retry path) | a fresh renewal attempt, not a retry of the same failed one |
| `retrying` | **NO** | owned entirely by the **Retry Engine** — Renewal Engine never touches a `retrying` subscription |
| `suspended` | NO | |
| `cancelled` | NO | |
This closes a boundary that was previously implicit: **Retry Engine owns `retrying`, full stop.**

**R3 — Build the "Effective Subscription."** ✅ *Naming locked at the Version 1.0 freeze — "Effective
Subscription" is the chosen term, over "Projected Subscription" and "Renewal Snapshot." This was
always an editorial choice, not an architectural one; picked and closed rather than left open.*
Starting from the current subscription, ask: *if payment succeeds, what should tomorrow's
subscription look like?* Apply every `Pending`/scheduled change (downgrade, add-on removal, quantity
reduction) **in memory only — nothing is written yet.** This is the same computation R3 in the earlier
(coarser) walkthrough below described, now named. **Validates the whole Change Engine design in one
observation:** renewal only ever executes *deferred* changes — anything immediate (an upgrade, an
add-on addition, a seat increase) already happened months ago, at the moment it was requested, per
Renewal Principle 1's payment-gates-everything rule. It is *impossible* for a pending upgrade/add-on-
increase/seat-increase to be sitting there waiting for renewal — those types never defer.

**✅ R4 — CLOSED by consolidation, not a new decision — the tension dissolves once R10 is accounted
for.** Two positions were originally stated in the same design pass:
- **Position A (a specific mutation order):** Plan change → validate add-on compatibility against the
  new plan → apply add-on removals → apply quantity reductions.
- **Position B (materialize the final state directly, no order):** the Renewal Engine shouldn't
  perform a sequence of mutations; it should materialize the final desired subscription state in one
  shot.

**Resolution:** Position A's entire premise — that the Renewal Engine needs to *validate add-on
compatibility* during renewal — is already false, per R10 (§3.5, above): add-on compatibility is
resolved at **scheduling** time, not execution time. By the time renewal day arrives, every add-on
already has either an explicit carry-forward decision or an auto-scheduled removal in place, and
"the Renewal Engine itself makes no compatibility judgment call at all" (R10's own words). There is
therefore no ordering question left to answer at renewal — nothing needs to be validated in a
particular sequence, because there's no live compatibility check happening then. **Position B is
simply what's already locked**, and has been since R13 (below) and Law 7 (Chapter 8): the Renewal
Engine collects every due `ScheduledChange`, computes the resulting Effective Subscription as one
materialized state, and commits it as a single atomic transaction — never a sequence of individual
mutations. This closes R4 without inventing anything new; it was already answered in R10 and R13, it
simply hadn't been connected back to this specific question before this audit.

**R5 — Component assembly.** The Effective Subscription's final owned items (e.g. `Growth + 3 Seats +
WhatsApp + Storage`) — purely commercial, no money yet.

**R6 — Calculate recurring charges.** Sum each item's contribution (`Growth ₹450 + Seats 3×₹80 +
Storage ₹300 + API ₹150 = subtotal`) — still no GST, no Coupon, no Referral.

**R7 — Coupon Engine** (§3.6a) — per-item discount lines, never invents new lines, only modifies
existing ones.

**R8 — Referral Engine** (§3.6b) — applied on the post-coupon total. Order restated, already settled:
`Coupon → Referral`, never the reverse.

**R9 — GST** — always last, on the fully-discounted taxable amount.

**R10 — Invoice.** `Commercial Event: RENEWAL`, `reason: RENEWAL`, all line items, immutable once
frozen. Still nothing committed to the Subscription.

**R11 — Can we charge? ✅ Explicit non-goal — do NOT redesign the Mandate system here.** The Mandate
subsystem is already fully specified (`CAW_BILLING_DESIGN.md`, validated live across Phases 1-6 of this
migration) — the Renewal Engine only **asks** it a question, never manages it: *is the mandate valid?*
Yes → create the order, charge the token (Charge-at-Will, nothing special, already proven). No → fail
immediately with `past_due`, `reason: MANDATE_REQUIRED` — the same shape as the first-payment case
below, reused, not reinvented.

**R12 — Payment result — the most important state, because it defines what's allowed to change before
success: nothing, per Renewal Principle 1 (above).** Failure → `past_due` only, retry scheduled, **zero
commercial state touched** — exactly like upgrades, add-ons, and first purchase. Success → proceed to
commit.

**R13 — Commit (one transaction, confirmed explicitly — "yes" to the one-transaction question).** Only
now: Effective Subscription becomes the real Subscription (downgrade/removals/quantity changes all
become real simultaneously) → advance Billing Cycle → persist invoice → persist payment → **consume
referral reward** (only now — invoice is paid) → **increment coupon redemption count** (only now) →
emit Billing Events (`RENEWAL`, `PAYMENT_SUCCESS`, `COUPON_APPLIED`, `REFERRAL_CONSUMED`,
`ADDON_REMOVED`, `PLAN_DOWNGRADED`, ... whatever actually happened) → invoice status → `Paid`,
immutable forever.

**✅ NEW — first-payment settlement extended with an explicit mandate-outcome branch (a real
strengthening of `CAW_BILLING_DESIGN.md`'s Invariant 10, not a new invention).** Invariant 10 previously
left "payment captured but mandate never confirms" as a vague derived condition "surfaced to UI/ops."
This gives it a concrete, first-class resolution, reusing the exact settlement flow already built in
Phase 3B (`reconcileMandate`):
```
Payment Success → Verify → Invoice Paid → Create Subscription → Create BillingCycle
  → Qualify Referral → Consume Rewards → Acquire Mandate
     → Mandate Success?  YES → ACTIVE
                          NO  → PAST_DUE, reason: MANDATE_REQUIRED → prompt customer to re-authorize
```
**This is a candidate real code change** to the already-built `reconcileMandate` (Phase 3B) — currently
it only sets `mandateStatus`/derives the recovery condition; it does not yet set an explicit
`reason: MANDATE_REQUIRED` on the subscription. Flagged as follow-up implementation work, not just a
docs update.

**🚩 R13.5 — partial-commit failure — ✅ MECHANISM DECIDED (supersedes "deferred" in Chapter 1's Commit
Engine entry).** If the commit sequence fails partway (payment captured, invoice saved, plan updated,
but reward consumption throws before events emit) — **do not attempt to roll back the payment.**
Razorpay already has the money; treating that as reversible is the wrong instinct. **The commit must be
fully idempotent, and recovery is the Reconciliation Engine's job, not a rollback mechanism**: the
payment is the source of truth, and any partially-applied state is *repaired forward* on the next
attempt (re-running the same commit steps, each checking "did I already happen?" before acting) —
**exactly the pattern already proven live in Phase 3B's `reconcileMandate`.** This is the concrete
answer Chapter 1's "Commit Engine — mechanism deferred" was waiting for: **the mechanism is idempotent
retry via the Reconciliation Engine, not a saga, not a rollback.** Chapter 1's Commit Engine entry
should be updated to reflect this rather than left as "not yet designed."

**The full deepened pipeline, for reference:**
```
Renewal Due? → Build Effective Subscription → Invoice Engine → Pending Invoice → Charge Mandate
  → Payment Successful?
       NO  → past_due, retry scheduled (nothing else changes)
       YES → Commit Effective Subscription (one transaction) → Advance Billing Cycle
             → Consume Rewards → Redeem Coupon → Billing Events → Invoice Paid → Done
```

---

**Coarser R1-R7 sketch below (earlier pass, first principle statement still correct, kept for
continuity — not contradicted by the above, just less granular):**

```
R1 Load  →  R2 Validate  →  R3 Apply Scheduled Changes  →  R4 Build Invoice  →  R5 Charge  →  R6 Commit Success | R7 Hand to Retry
```

**R1 — Load.** Gather facts only, nothing mutates: current plan, add-ons, coupon, credits, mandate,
every `SubscriptionChange` still `Pending` for this subscription, billing history, current cycle.

**R2 — Validate can-renew.** Cancelled? Suspended? Mandate invalid? Already renewed today? Invoice
already exists? Another renewal already running for this subscription (concurrency guard)? Any failure
stops here, no partial work begun.

**R3 — Determine (do NOT commit) what applying every due scheduled change would produce — ✅ REVISED,
corrects the earlier draft below.** The Renewal Engine asks *"which `SubscriptionChange` records have
`effectiveAt <= today` and `status = Pending`?"* and computes the **resulting commercial state for
pricing purposes only** — plan change, quantity decreases, boolean removals, automatic incompatible-
add-on removals. **This state is NOT written to the Subscription yet.** The earlier draft of this
section said "apply as one transaction, then price" — that was wrong, and is corrected by Renewal
Principle 1 immediately below.

**R4 — Build Invoice.** The Invoice Engine (Chapter 3.3) receives the **computed-but-not-yet-committed**
would-be commercial state from R3, purely to price it. It has no knowledge of *why* that state looks the
way it does (which scheduled changes produced it) — it only prices a hypothetical current state, exactly
like a `changeset` preview (§4.1's Upgrade Preview, P1-P2).

**R5 — Charge.** Invoice → Charge Mandate → wait. Nothing else happens here. **Subscription is still
completely untouched.**

**R6 — Commit success (only after payment confirms — everything commits together, here, for the first
time):** capture → **now** write the R3-computed commercial state to the Subscription (plan, add-ons,
quantities) → advance BillingCycle to the next period → advance Subscription's renewal date → persist
invoice → persist payment → emit BillingEvents → emails → analytics. **One commit point, one moment —
not "commit the plan in R3, commit the cycle in R6."**

**✅ DECIDED — the billing anchor never drifts because of late payment.** A renewal invoice pays for a
specific, already-determined period (e.g. `17 Jul → 17 Aug`), not "one month from whenever payment
happens to succeed." If payment fails on the due date and succeeds three days later, the next period is
still `17 Aug → 17 Sep` — **not** `20 Aug → 20 Sep`. Late payment affects only `appStatus`
(`ACTIVE → PAST_DUE → ACTIVE`), never the anchor date. Otherwise a customer could drift their billing
date forward indefinitely by paying late every cycle. (This is the seed of the much larger Billing
Anchor invariant formalized in §3.7 below.)

**R7 — Failure: genuinely no rollback needed, because nothing was written yet.** The invoice exists (as
a priced-but-unpaid record) and the customer owes money, but **the Subscription's commercial state was
never touched** — there's nothing to roll back. `appStatus → past_due`. Hand off entirely to the Retry
Engine.

**⭐ Renewal Principle 1 — ✅ SUPERSEDES the earlier R8 policy below (a genuine reversal, not a
refinement — flagged explicitly rather than silently blended):** **no commercial state changes until
payment succeeds — not plan, not add-ons, not quantities, not billing cycle, not scheduled changes.**
The *only* state transition permitted before payment succeeds is `ACTIVE → PAST_DUE`. Previously (R8,
below) this document said the opposite — that a scheduled downgrade commits at renewal regardless of
whether the subsequent charge succeeds, and only *access* reverts on failure. That created exactly the
rollback nightmare this principle exists to avoid: if a downgrade, an add-on removal, and a quantity
change had already committed and *then* payment failed, unwinding all of it (plan, add-ons, quantities,
invoice snapshot, entitlement cache) is a mess. **The corrected model:** build the invoice against the
would-be state (R3-R4), attempt payment (R5), and only on success does anything actually change (R6). On
failure, everything just stays exactly as it was before renewal day started, plus `PAST_DUE`.

**Renewal state machine, including the case most billing systems get wrong:**
```
Renewal Due → Loading → Applying Scheduled Changes → Invoice Built → Charging
                                                                          │
                                          ┌───────────────┬──────────────┘
                                          ▼               ▼
                                       Success          Failed → Retry Queue
                                          │
                                          ▼ (Razorpay times out / ambiguous response)
                                       Unknown → Reconciliation Queue (NOT an immediate retry —
                                                  avoids double-charging; ask "what actually happened?"
                                                  before acting, same principle as Phase 3B's
                                                  reconcileMandate)
```

**❌ R8 — SUPERSEDED by Renewal Principle 1 above. Kept here for the reasoning trail, not as current
policy.** The original claim was: a failed payment does not undo the commercial decision; it only
affects access state. This is the single most important policy decision in the Renewal Engine, and it's a clean
separation this project has been converging toward all along:
```
Growth → scheduled downgrade to Starter → renewal day
  → R3 applies the downgrade: subscription is now Starter (committed, real, done)
  → R4 builds an invoice FOR Starter
  → R5 charge fails
  → subscription = Starter + appStatus:past_due   ← NOT "Growth + past_due"
```
Reverting to Growth would be inconsistent, this argued — the commercial change already executed in R3.
**This is exactly the reasoning Renewal Principle 1 overturned:** the flaw is that R3 should never have
committed the downgrade before payment succeeded in the first place. **Under the corrected model:** the
invoice is built pricing what Starter *would* cost, payment fails, and the subscription simply
**remains Growth + `past_due`** — nothing rolled back because nothing was committed. The
commercial-state/access-state separation (`appStatus` distinct from plan fields, `CAW_BILLING_DESIGN.md`)
is still correct and still important — it's *how* `past_due` coexists with unaffected commercial state —
but the mechanism is "nothing committed yet," not "committed then reverted."

**✅ R9 — SETTLED: multiple scheduled removals apply atomically** — already the direct consequence of
R3's "apply everything together, one transaction" design; no separate rule needed.

**✅ R10 — SETTLED: add-on incompatibility at a scheduled plan change — carry-forward is a user choice,
not an inferred behavior (corrects/refines the earlier "third option is cleanest" guess).** When a
customer schedules a plan change (up or down) where the target plan supports some but not all of their
current add-ons: **compatible add-ons — the user is explicitly asked whether to carry them forward** (a
real choice, made at scheduling time, not assumed either way). **Incompatible add-ons cannot be carried
— they are automatically scheduled for removal, effective the same renewal**, no separate decision
needed because keeping them is not a real option. By renewal day, this means R3 never encounters an
"impossible" state — every add-on either has an explicit carry-forward decision or an auto-scheduled
removal already in place; the Renewal Engine itself makes no compatibility judgment call at all. **Gap
this surfaces, not yet specified:** the exact data shape of a "carry-forward decision" — is it its own
field on the `SubscriptionChange{PLAN_CHANGE}` record, or a set of accompanying `ADDON` change records
created at the same time the plan change is scheduled? Not designed yet.

**appStatus, now with a fully specified transition source:** `trial → active → past_due → suspended →
cancelled / expired`. **Commercial state (plan/add-ons/billing-cycle) and access state (`appStatus`) are
fully independent** — `Subscription.planName=starter` and `Subscription.appStatus=past_due` coexisting is
not a contradiction, it's the expected shape after R7. The Retry Engine (Chapter 3.5's sibling, per
Chapter 7's Scheduler Matrix) owns exactly the `past_due → active` (on retry success) and `past_due →
suspended` (retries exhausted, grace period elapsed) transitions — reminders at each retry attempt,
industry-standard cadence, cross-referencing the retry policy already locked as **default, configurable**
in `CAW_BILLING_DESIGN.md` §9 (`maxAttempts=3`, `retryIntervals=[24h,72h,120h]`) — this Renewal Engine
work does not change that policy, it confirms where it plugs in.

### 3.6 ❌ SUPERSEDED — the generic "Credit Engine" was overengineering; replaced by two concrete engines

**What changed:** the original framing unified referral/coupon/wallet/admin/promotional/refund/migration
credits under one abstraction on the theory they're "all the same underlying thing." After reviewing the
actual product (the Super Admin coupon management screen and the org-facing referral screen — real UI,
not hypothetical), **there are only two financial actors in this system today: Coupon and Referral
Reward.** Wallet, loyalty, migration, and promotional credits are not real product requirements right
now — building a generic engine to unify money-sources that don't exist yet is exactly the kind of
premature abstraction this project has been trying to avoid elsewhere. **Corrected:** two concrete
engines, not one generic one. (If a real wallet/loyalty feature is requested later, it gets its own
engine spec then — not retrofitted into a speculative unification built today.)

**Pricing itself is not a discount, and doesn't belong here at all:** GST, proration, plan/add-on
pricing are **Pricing**, computed by the Invoice Engine (§3.3) directly. Only Coupon and Referral Reward
are actual discounts.

#### 3.6a Coupon Engine — ✅ specified from the real admin UI

**Every dimension a coupon actually has, inferred directly from the Super Admin screen:**
| Dimension | Values |
|---|---|
| Eligibility | `Global` (any org) or `Specific Organizations` (an explicit allow-list; when set, per-org redemption limits become moot — the list itself is the limit) |
| Product scope | **Per billable item**, not "off the whole invoice" — e.g. `Starter: 6%`, `Growth: 9%`, `Seats: 6%`, `Business: no discount`. A coupon is a **set of per-item rules**, not one blanket percentage. |
| Billing cycle scope | `Monthly`, `Yearly`, or `Both` |
| Duration | `First invoice`, `Lifetime`, `N billing cycles`, `Until cancelled (by Super Admin)` — the live UI currently only exposes Lifetime/Until-cancelled; the engine should support all four |
| Discount type | `Percentage` or `Fixed amount`, chosen independently **per billable item** (not one type for the whole coupon) |
| Validity window | `Start date` / `Expiry date` |
| Redemption limits | Global max total redemptions (blank = unlimited) **and** max redemptions per organization — both real, both visible in the UI (`Max Total Redemptions`, `Max Redemptions / Organization`) |

**Coupon Engine input/output — ✅ decided: outputs discount LINES, never a single total.**
```
Input:  Subscription, Invoice Type, Invoice Lines, Organization, Current Date, Coupon
Output: Discount Lines — one per matching invoice line, not a lump "Total Discount"
```
Example: invoice has `Growth (₹450)` + `Seats x3` + `Storage`; coupon has rules for `Growth` and
`Seats` only → output is `Growth Discount (−₹45)` + `Seat Discount (−₹18, say)`; **Storage receives
nothing** — exactly matching the real UI's per-item rule behavior.

**✅ DECIDED — future-proof the product-scope key, don't hardcode plan/add-on names.** The current UI's
`Starter/Growth/Business/Seats` list will break the day a new add-on is added. Internally, coupon rules
should be keyed against a stable **billable item key** (`starter_plan`, `growth_plan`, `business_plan`,
`seat_addon`, `storage_addon`, `whatsapp_addon`, ...) — i.e. keyed by `BillableItem` identity
(§3.7), not by a hardcoded enum. The Coupon Engine then just asks, per invoice line, *"is there a rule
for this billable item's key? yes → apply; no → skip"* — this scales to every future add-on with zero
coupon-engine changes.

**⚠️ Real, known gap — not yet audited to the rigor the rest of this document has had:** the user
flagged that the current coupon implementation has sync bugs — e.g. a plan change should recompute which
coupon rules still apply, and currently doesn't do this reliably. This needs its own dedicated audit
pass (same rigor as the CAW webhook/onboarding work), not assumed fixed by this specification alone —
flagged as real, outstanding, pre-existing work.

#### 3.6b Referral Engine — ✅ specified, and the two-sided lifecycle now fully clear

**Much simpler than coupons — one configuration, from the real org-facing settings screen:**
```
reward type        Percentage (%) | Fixed (₹)
reward value
max reward amount   (₹, blank = none)
expiry               (days, blank = never — how long a granted reward stays usable)
max pending referrals (blank = ∞)
max total referrals   (blank = ∞)
min active days before qualifying   [⚠️ saved but NOT enforced yet — real gap]
stacks with coupons                 [⚠️ NOT enforced yet — currently always stacks regardless of setting]
honored during trial                [⚠️ saved but NOT enforced yet — confirmed against real code]
```
**Three settings are currently decorative — saved to the DB but do nothing.** Real, pre-existing gaps,
not something this specification fixes by itself; flagged so they aren't mistaken for working policy.
**`honoredDuringTrial` specifically: the code gap remains open (the toggle is still unenforced), but
the underlying business question it was meant to answer is now closed (Chapter 19, RF8) — trial users
are allowed to earn referral rewards, decided in the "always allow" direction regardless of this
toggle's value.** The other two (min active days, coupon-stacking) remain genuinely open code gaps
with no corresponding policy decision yet.

**`honoredDuringTrial` confirmed dead, directly against the real code, not just inferred:** the field
exists on `ReferralProgram` (`backend/models/ReferralProgram.js:29`, `Boolean, default: false`) and
Super Admin can edit it, but it is never read anywhere in the actual referral or reward flow.
`recordReferralIntent` (which creates a `Referral`) has no check on the referrer's or referee's
trial/subscription status at all — the code's own comment states this is deliberate ("the business
event... must never be gated behind a trial start or a purchase decision"). `maybeQualifyReferral`
(which grants the `Reward` the moment the referred org's first payment succeeds) checks only that
the referral is `pending` and the program is `enabled` — it never reads `honoredDuringTrial`.
**Practical effect, confirmed:** an organization on a free trial can send a referral invite today
with zero restriction, and if the referred org later pays, the reward is granted regardless of the
referrer's trial status or what the `honoredDuringTrial` toggle is set to — flipping that toggle in
the admin panel currently changes nothing.

**Referral Engine input/output:**
```
Input:  Organization, Invoice, Available Rewards
Output: Reward Applied, Remaining Rewards
```
Example: invoice `₹900`, reward `20% capped at ₹100` → output `Referral Reward −₹100`. Simple, no
per-line-item complexity (unlike coupons) — a referral reward reduces the invoice total directly.

**✅ The two-sided lifecycle, confirmed clear and mostly already built:**
```
Referrer sends invite → Referred org signs up → Referred org makes FIRST payment
  → BOTH referrer and referred org receive a reward, same program config, same value
  → Referred org's reward applies to THAT first-payment invoice directly
  → Referrer's reward: if their subscription is already mid-cycle (no invoice due right now),
    applies to their NEXT invoice — i.e. the recurring bill, not an out-of-band credit
```
Referrals org-to-org are the common case (an org refers another org); a Super Admin manually granting a
reward is the rare exception, not the primary flow.

**⚠️ Real, concrete follow-up work, not just a design note:** this system was originally built and
audited under the legacy Subscriptions model, where the recurring amount **could not be changed** via
API — so applying a referral reward to reduce an *already-cycling* organization's recurring bill was
never completed; only first-payment application was viable. **Charge-at-Will removes that blocker
entirely** (a fresh Order + charge against the mandate can reflect any amount, any cycle — proven
throughout Phases 1-6 of this migration). This is now real, actionable implementation work — connecting
the existing `referralRewards.js`/`RewardUsage` reservation-lifecycle code (built earlier in this
project) to the new CAW renewal/invoice path — not a fresh design problem.

### 3.7 BillingCycle Engine — ❌ THE "BILLING BUCKET" MODEL BELOW IS SUPERSEDED (kept for the reasoning
trail only — see the Billable Item Model that replaces it, immediately after)

**What changed:** this section originally settled "Option B" — same-cadence components (base plan +
same-cadence add-ons) consolidate into one shared Bucket with one shared renewal date per cadence. That
is now **overturned in favor of Option A: every component keeps its own independent renewal anniversary**
— e.g. a Seat add-on purchased Aug 20 renews every 20th; a WhatsApp add-on purchased Sep 5 renews every
5th; **these do not share a date even though both are "monthly."** Reasoning: this is the actual Stripe/
Chargebee model (a subscription is a collection of independently-billed items, not a plan with an
attached cycle), it scales cleanly to future component types (SMS packs, AI credits, quarterly/one-time
cadences) without new architecture, and it removes an entire consolidation-timing problem the Bucket
model would have needed to solve (what happens when a component is added exactly on a bucket's renewal
day, etc.).

**The corrected model — Billable Item (replaces Billing Bucket):**
```
BillableItem
  id
  type              (PLAN | ADDON — seats/storage/etc. are all just ADDON, per Invariant A1)
  price
  quantity
  billingInterval    (MONTHLY | YEARLY | future: QUARTERLY | ONE_TIME)
  renewalAnchor      the date THIS component was added/purchased — its own independent anniversary
  nextRenewalDate    derived from renewalAnchor + billingInterval, never shared with another component
  status             created → active → pending_removal → removed
  compatiblePlans    (for compatibility checks against the base Plan, §3.2)
```
**The base Plan is not special** — it's simply the first `BillableItem` a subscription ever gets,
so its `renewalAnchor` happens to equal the subscription's first-ever payment date. Every subsequent
add-on gets its **own** `renewalAnchor` = the date it was purchased. This subsumes the earlier
"Billing Anchor" concept (Chapter 1) rather than removing it — the anchor idea was correct, it's just
**per-component now, not per-subscription.**

**Renewal Engine becomes:** *"which `BillableItem`s have `nextRenewalDate <= today`?"* — not
per-subscription, not per-bucket, per-component. For each due component: generate invoice → charge →
success → advance **only that component's** `nextRenewalDate`. Failure affects only `appStatus`, never
any component's anchor (same principle as R6's anchor-never-drifts rule, now per-component).

**Invoice Engine becomes:** an invoice simply *contains* whichever `BillableItem`s are due — the
distinction "base plan invoice" vs "add-on invoice" disappears; there is only ever one invoice shape,
listing whatever components triggered it.

**❌ SUPERSEDED — "every component always gets its own separate invoice" was wrong, corrected within
the same session after walking concrete examples (kept below for the reasoning trail, replaced by the
Commercial Event model immediately after).** The original reasoning (simpler Renewal Engine loop,
simpler invoice-failure scope) was sound engineering logic but produced bad product behavior: a
subscription with a Plan + 3 add-ons all sharing a renewal date would generate 4 separate invoices for
one conceptual "renewal," which is bad UX and bad accounting. Corrected below.

#### Billable Item Model — ✅ the full specification (fields/types/laws), now separated cleanly from invoicing rules

**Definition:** the smallest independently-billable commercial unit. Everything that can produce a
charge is a Billable Item — a Plan, an add-on (seats, storage, WhatsApp, AI credits, ...). **Not**
Billable Items: Coupon (modifies invoices, doesn't itself get billed), Referral Reward (a Credit),
GST (a tax), Mandate (infrastructure).

**Type — exactly two:** `PLAN | ADDON`. Seats, storage, every add-on — all just `ADDON` (Invariant A1,
§3.2). Business Plan, Starter Plan — `PLAN`.

**Fields:**
```
BillableItem
  Identity:        componentId, subscriptionId, organizationId, type, plan/addon key
  Commercial State: ACTIVE | PENDING_ADD | PENDING_REMOVE | CANCELLED
                     (✅ CLOSED — no PAST_DUE/SUSPENDED at item level, see the settled question below)
  Billing:         frequency (MONTHLY | YEARLY), quantity (boolean add-ons always quantity=1 —
                     simpler than a separate boolean/quantity type distinction)
  Pricing Snapshot: unitPrice, currency, GST class, pricingVersion — NEVER re-read the live catalog
                     during billing; catalog price changes must never retroactively alter what a
                     component charges (this is a component-level instance of Invariant 5's "invoice
                     never references live catalog state," extended one level earlier — the component
                     itself freezes its price at acquisition, not just the invoice at charge time)
  Renewal:         effectiveFrom, nextRenewalDate, lastRenewalDate — owned by the COMPONENT, not the
                     Subscription (§3.7's core correction to "Subscription has one billing cycle")
  Pending Change:   e.g. {REMOVE, effective:31 Jul} or {quantity: 5→3, effective:31 Jul} — same
                     `SubscriptionChange`/Ledger concept (Phase 1.3/1.4), now understood to be scoped
                     to the component it targets, not the subscription as a whole
  Compatibility:    supportedPlans — used by the carry-forward/auto-remove logic (§3.2/R10)
```

**Ownership split — a hard boundary:** the **Component** owns price, quantity, frequency, renewal dates,
lifecycle, pending change. The **Subscription** owns organization, overall status, mandate, current-plan
pointer, and the `List<Component>`. **The Subscription must never itself know a component's quantity,
frequency, or renewal date** — those questions only have answers by asking the component.

**Laws 1-6 (still current, unaffected by the invoicing correction below):**
1. Every commercial charge belongs to exactly one Billable Item, never two.
2. Every Billable Item produces its own billing schedule — never inherits the Subscription's.
3. A Billable Item generates many invoices over its lifetime (e.g. a monthly seat component:
   Jan, Feb, Mar, Apr invoices — same component, many invoices).
4. Changing one component never mutates another directly (an upgrade doesn't touch Storage's state
   unless compatibility rules explicitly say so).
5. Pending changes belong to Components, not the Subscription.
6. The Invoice Engine bills Components — a Subscription is billable only because it contains billable
   Components.

**❌ Laws 7-10 — SUPERSEDED, corrected below (kept for the trail):** originally "a component owns its
own BillingCycle history, never shared" and "every invoice belongs to exactly one component, never
multiple" — i.e. one-component-equals-one-invoice, always. **This is the part that was wrong.**

**✅ CLOSED — payment failure is subscription-wide, never per-item.** There is no such thing as one
Billable Item independently entering `PAST_DUE` while others stay `ACTIVE`. The subscription is sold and
billed as **one commercial contract** — if a renewal invoice (covering whichever items are due that day,
§ Commercial Event below) can't be collected, the **entire subscription** becomes `past_due`, not just
the item(s) on that particular invoice. This is why `PAST_DUE`/`SUSPENDED` were removed from the item's
own state enum above — those states only ever exist on `Subscription.appStatus`, never on a Billable
Item.

#### ✅ THE CORRECTED INVOICING MODEL: Commercial Event, not Billable Item, determines invoice boundaries

**The missing distinction:** *Billable Item* answers "what is recurring?" A separate concept —
**Commercial Event** — answers "why are we billing right now, and what does that invoice cover?"
Conflating these (Laws 7-10 above) was the error.

**Five Commercial Event types (four active today + one future-proofed), each producing at most one
invoice:**
```
NEW_PURCHASE        — everything acquired in one signup/checkout action → ONE invoice
MID_CYCLE_PURCHASE  — an upgrade or add-on bought mid-cycle → ONE invoice (prorated)
RENEWAL             — everything due on a given day for a subscription, bundled → ONE invoice
RETRY               — NOT an invoice-producing event at all — see below
ADJUSTMENT          — future-proofed, not needed today: admin-issued credit, refund, migration
                      correction. Named now so it has a home later; not designed, not built.
```

**✅ DECIDED — a RENEWAL event bundles every Billable Item due that day into ONE invoice, not one
invoice per component.** Concretely: the scheduler asks *"what's due today for this subscription?"* —
if that's `[Business Plan, Storage]` (because both were acquired together and share an anchor), it
produces **one** invoice containing both. If tomorrow only `Seats` is due, that's its own (single-line)
invoice. This is not cadence-based bucketing (the earlier-superseded Billing Bucket model) — it's
**coincidental grouping by actual due-date match on a given subscription**, which naturally falls out of
components sharing an origin (acquired together → same anchor → renew together) without needing a
declared "bucket" structure at all.

**✅ DECIDED — a mid-cycle purchase gets its own invoice now, but re-anchors to the main group going
forward.** When a component is added mid-cycle (e.g. 2 extra seats bought on day 10 of a 30-day month):
1. **Immediately:** a `MID_CYCLE_PURCHASE` invoice for the prorated amount — its own invoice, separate
   from anything else.
2. **From the next renewal onward:** that component's `nextRenewalDate` **realigns to match the
   subscription's existing matching-cadence renewal date**, not its own independent purchase-date
   anniversary. So going forward, its recurring charge folds into the main consolidated renewal
   invoice with everything else — it does not stay on a permanently independent anniversary.

**Why this isn't a contradiction with the earlier per-component-anchor decision (§3.7 above) — it's a
refinement of it:** components still each *start* with their own anchor (from when they were acquired),
but a mid-cycle addition's anchor is deliberately **realigned** at its first renewal to converge with
whatever it's grouped with, rather than staying independent forever. The practical effect ends up close
to what the earlier-superseded "Billing Bucket" model wanted (same-cadence components sharing one
renewal date) — but arrived at here as a consequence of event-driven invoicing plus one realignment
step, not as a declared bucket structure. Worth noting this convergence explicitly rather than pretend
it's unrelated to that earlier (superseded) idea.

**Not yet specified — the exact realignment mechanism:** does realignment mean the component's
`nextRenewalDate` is simply set equal to the group's next renewal date (shortening or lengthening that
one cycle to fit), and is this the same "unused-window" proration logic already established for
Annual↔Monthly conversion (§3.7's entitlement-window model), or a distinct formula? Not yet worked
through — flagged rather than assumed.

**✅ Retry ownership, made explicit (agreed, strengthened per review):** `RETRY` is **not** an
Invoice-Engine event at all — it never generates a new invoice. It belongs entirely to the **Retry
Engine** (§3.5's sibling), which re-attempts payment against the **same already-existing unpaid
invoice** a `RENEWAL` produced. `Invoice #123` fails → three days later, retry charges `Invoice #123`
again → never `Invoice #124`. This is exactly why Invariant 5 (invoice immutability) matters here:
retrying must never regenerate line items or create a new invoice number, or accounting/GST/finance
reporting becomes inconsistent.

**Not a contradiction with §3.3's worked example** (Growth Plan + Extra Users + WhatsApp all on one
invoice) — that was always a `NEW_PURCHASE`/`MID_CYCLE_PURCHASE`-type event (one action, multiple
components), which this model still produces as one invoice, unchanged.

**What is now explicitly open, not yet re-specified against this corrected model:**
1. Retry Engine policy questions remain deferred — **subscription-wide, not per-item** (per the
   closed decision above: any renewal invoice failing to collect pushes the whole subscription to
   `past_due`, regardless of which items were on that invoice). Still open: exact retry cadence
   applied to which invoice(s) if multiple items are independently due across different dates within
   the same `past_due` window.
2. Exact within-window proration rounding rule (day-level formula) — still not specified, same gap as
   before, now applies per-component instead of per-bucket.
3. Whether a component's `nextRenewalDate` can ever be asked to align with another's (a customer-facing
   convenience feature, e.g. "align all my monthly add-ons to one date") — not requested, not designed,
   explicitly out of scope unless asked for later.

Owns (once re-specified against this model): per-component current/past/next cycle records, invoice
linkage, payment linkage, retry linkage, per-component period advancement. Still what makes Invariant 1
(`CAW_BILLING_DESIGN.md` §5 — "a billing period advances exactly once") enforceable — now per-component.

---

**❌ SUPERSEDED CONTENT BELOW (Billing Bucket / Option B) — kept for the reasoning trail only:**

**A real business requirement changed the model fundamentally, discovered mid-specification — flagged
explicitly rather than quietly folded in.** Two changes arrived together:
1. **Annual billing is no longer "start a fresh 12-month cycle on upgrade."** It's a **repeating,
   entitlement-based 12-month window**, anchored to the customer's first-ever payment — described in
   detail below.
2. **Add-ons can be billed on a different cadence than the base plan** — a yearly-plan customer can have
   monthly add-ons, priced and renewed independently of the annual plan.

**This retires a prior assumption used throughout this document and `CAW_BILLING_DESIGN.md`: that a
Subscription has one `billingCycle` field governing everything on it.** That field described in
`CAW_BILLING_DESIGN.md` §2 is now known to be an oversimplification and needs revision in a future pass
of that document — not done in this edit, flagged so it isn't silently left stale.

**❌ SUPERSEDED — the original Annual↔Monthly conversion formula in §4.1** ("new period starts fresh
immediately, unused old-cycle value shown as a credit, e.g. Monthly ₹450/20-unused-days → Annual
₹5400 − ₹300 credit") **is wrong under the corrected model.** It assumed switching cadence always starts
a brand-new period. It does not — see the entitlement-window model immediately below.

#### The corrected model: annual billing is an entitlement window, not a fresh contract

The customer is purchasing **12 months of service**, not "the next 12 calendar months from today."
Switching to yearly mid-subscription **consumes months already elapsed within the current window**
rather than resetting the clock:
```
Customer starts monthly Jan 17 → uses the product for 3 months → switches to yearly on Apr 17
  → 3 of the annual window's 12 months are already consumed
  → Invoice = Annual Price − (3/12 months' worth) = pay for the remaining 9 months
  → The yearly window still ends Jan 17 next year — NOT Apr 17 next year
```
A larger example (17 months elapsed): `17 − 12 = 5` months already consumed **into a second window** →
invoice = Annual Price − 5 months' worth → pay for the remaining 7 months of that (second) window. The
window's end date is always a multiple of 12 months from the original anchor, never reset by the
upgrade event itself.

#### ✅ DECIDED — Option B: add-ons of the same cadence consolidate into ONE invoice per bucket, not
independent per-component invoices

The two options considered: **(A)** every component (plan, each add-on) renews and invoices
independently; **(B)** all same-cadence components consolidate into one invoice per cadence, while
different-cadence components stay separate. **Option B chosen** — an order of magnitude simpler, and
what B2B SaaS billing (Stripe/Chargebee/Zuora-style) typically does. A mid-cycle add-on purchase is
simply prorated to align with the *existing* bucket's next renewal date, so every component sharing a
cadence always shares one renewal date and one invoice, indefinitely.

#### The new core abstraction: Billing Buckets

**Replaces "a Subscription has one billing cycle."** A Subscription owns **zero, one, or two Billing
Buckets** — `MONTHLY` and/or `YEARLY` — each an independent consolidation unit:
```
Subscription
  ├── Monthly Bucket   (optional)  { components: [...], renewalDate, invoices }
  └── Yearly Bucket    (optional)  { components: [...], renewalDate, invoices }
```
A monthly-only customer has just a Monthly Bucket (plan + all add-ons). A yearly customer with monthly
add-ons has **both** — Yearly Bucket holds the base plan + any yearly add-ons; Monthly Bucket holds only
the monthly-cadence add-ons. Each bucket has **exactly one renewal date** and **exactly one invoice**
per cycle, regardless of how many components it contains. Buying a mid-cycle add-on on either cadence
prorates it to align with its bucket's existing renewal date — never creates a new bucket or a new
date.

#### ✅ DECIDED — the Billing Anchor is immutable, set at first-ever payment, and never resets

**Replaces the earlier (informal) assumption that a billing cycle's start date could shift on
plan/cadence changes.** The anchor is set once, at the customer's first successful payment, and every
bucket's renewal dates derive from it forever:
```
First payment: 17 Jan  →  anchor = 17
Monthly Bucket renews:  17 Feb, 17 Mar, 17 Apr, ...  (always the 17th)
Yearly Bucket renews:   17 Jan next year, 17 Jan the year after, ...  (always Jan 17)
```
Switching cadence, upgrading, downgrading — none of it moves the anchor. A monthly customer who upgrades
to yearly on `17 Apr` (3 months into using the product) gets billed for the *remaining 9 months of a
window that still ends 17 Jan next year* — not a fresh window starting `17 Apr`. This is the same
"anchor never drifts" principle already established for late-payment recovery (R6 above), generalized
from "one cycle" to "every bucket."

**⭐ New replacing invariant (supersedes "a Subscription has one billing cycle," `CAW_BILLING_DESIGN.md`
§2's implicit assumption):**
> **A Subscription owns one immutable billing anchor date. Every recurring charge belongs to exactly
> one Billing Bucket (monthly or yearly). Every bucket renews relative to the anchor date, never
> relative to when a component was added or when a late payment was recovered.**

**What this single abstraction now explains without a special case:** monthly plans, yearly plans,
mixed monthly/yearly add-ons, proration (always "how much of the current bucket window is
unconsumed/newly-consumed"), renewal (per-bucket, not per-subscription), retry (affects `appStatus`
only, never the anchor), scheduled changes (still resolve against whichever bucket they target).

**What is now explicitly open, not yet re-specified against this model (do not assume these are
solved):**
1. The Renewal Engine (§3.5) was written assuming one renewal per subscription — it needs a pass to
   become "one renewal per **due bucket**," since a yearly-plan customer with monthly add-ons now has
   two independent renewal events, not one.
2. Retry Engine policy questions (retry count, cadence, reminder timing, PAST_DUE→SUSPENDED threshold,
   whether manual payment during PAST_DUE cancels scheduled retries) were about to be specified before
   this change arrived — **deliberately deferred** until the per-bucket renewal model above is settled,
   since retry now potentially applies per-bucket, not per-subscription.
3. Exact proration formula for "months already consumed within a 12-month window" (the 3-month and
   17-month examples above establish the *concept* — pay for remaining whole/fractional months — but not
   the precise day-level rounding rule, analogous to §4.1's day-level proration formula for
   monthly-plan changes).
4. Whether a Yearly Bucket can exist without ever having a Monthly Bucket component, and vice versa, and
   what happens if the *last* component in a bucket is removed (does the empty bucket cease to exist?).

Owns (once re-specified against the bucket model): per-bucket current/past/next cycle records, the
invoice snapshot per cycle, payment linkage, retry linkage, period advancement. Still what makes
Invariant 1 (`CAW_BILLING_DESIGN.md` §5 — "a billing period advances exactly once") enforceable — now
per-bucket rather than per-subscription.

### 3.8 Event Engine
One business action → many side effects: BillingEvent (timeline), emails, notifications, analytics, audit log, CRM timeline, support timeline, finance export. Already exists in skeleton form (`emitBillingEvent`); this chapter formalizes it as an engine other engines call into, not a scattered set of ad hoc `console.log`/email calls at each call site (the historical pattern that caused the referral-settlement race documented earlier in this project).

### 3.9 Billing Orchestrator ("Billing Brain") — the missing piece, found by asking "who calls the engines?"

Every workflow described in this document so far — Upgrade, Renewal, Add-on purchase — implicitly
assumed something invokes Change Engine, then Invoice Engine, then charges, then commits, in the right
order. Nothing in Chapters 3.1-3.8 is that something. **It should not be the controller** (that's where
the legacy Subscriptions code accumulated business logic — the exact failure mode this whole
specification exists to prevent), **not cron** (Chapter 7 — schedulers only dispatch), **not Razorpay.**

**The Orchestrator owns workflows, not business logic.** It calls engines in sequence; it makes no
pricing, eligibility, or policy decisions itself — those all live in the engine being called. Two
examples, same shape, different engines:
```
Upgrade Workflow:   Validate → Change Engine → Invoice Engine → Payment → Commit → Events
Renewal Workflow:   Renewal Engine → Invoice Engine → Charge → Retry (on failure) → Events
```
Every capability (Downgrade, Add-on, Billing Cycle Change, Cancellation) gets its own workflow —
short, declarative sequences of engine calls, not reimplemented logic. **This is what makes every
endpoint "tiny"** (§ Change Decision Engine's closing point): `decision = ChangeEngine.evaluate();
Orchestrator.run(upgradeWorkflow, decision)` — the endpoint itself never branches on business rules.

**⭐ The master pipeline — every commercial-event workflow is this same sequence, engines swapped in and
out:**
```
Commercial Event
    ↓
Change Engine        (what changed, effective when)
    ↓
Invoice Engine        (what should this cost)
    ↓
Coupon Engine         (per-item discount lines)
    ↓
Referral Engine       (total-level reward)
    ↓
GST
    ↓
Invoice (frozen)
    ↓
Payment (charge the mandate)
    ↓
Commit State          (Subscription, add-ons, pending changes, Billing Cycle, rewards, coupons —
                        ALL of it, together, here)
    ↓
Billing Events
```
**The single strongest invariant this whole specification has converged on, restated one final time:**
everything above the `Payment` step is a **proposal** — nothing is written. Only after `Payment Success`
does anything commit, and it all commits **together, in one place** (§Commit Engine, Chapter 1;
Renewal Principle 1, §3.5). The one permitted exception is the transition to `past_due` when a required
payment cannot be collected — that's the only state change allowed before/without a successful charge.

**The engines stay fully independent of each other and of the Orchestrator** — Change Engine doesn't
know Invoice Engine exists; Invoice Engine doesn't know who's calling it. Only the Orchestrator knows the
full sequence for a given capability. This is what keeps 3.1-3.8 individually testable and individually
replaceable.

**Not yet specified:** the Orchestrator's own failure semantics (if step 3 of 5 in a workflow throws, who
decides retry vs. abort vs. hand to Reconciliation?) and its exact relationship to the idempotent-Commit
invariant (Invariant 6, Chapter 2) — does the Orchestrator *implement* CommitInvoice(), or call into a
separate Commit Engine (Chapter 1, still emerging) that implements it? Genuinely open, not decided here.

---

## Chapter 4 — Capability Specifications

Every capability is a configuration of the Change Engine (3.2) plus, where relevant, the Coupon Engine or Referral Engine (3.6a/3.6b). Restated from `CAW_BILLING_DESIGN.md` §4a, now as the domain-level table this document owns:

| Capability | Effective | Payment impact | Renewal impact | Engine(s) involved |
|---|---|---|---|---|
| Upgrade | now | charge now (prorated) | higher going forward | Change, Invoice, Policy |
| Downgrade | next renewal | none now | lower from next cycle | Change, Renewal |
| Add seat (an add-on, no special logic) | now | charge now (prorated) | higher going forward | Change, Invoice, Policy |
| Remove seat (an add-on, no special logic) | next renewal | none now | lower from next cycle | Change, Renewal |
| Add add-on | now | charge now (prorated) | includes add-on going forward | Change, Invoice, Policy |
| Remove add-on | next renewal | none (no refund) | excludes add-on from next cycle | Change, Renewal |
| Billing cycle change (Monthly↔Yearly) | now, always | charge now (unused-value repriced) | immediate | Change, Invoice, Policy |
| Coupon | applied at invoice time | reduces that invoice | reduces recurring if `duration` says so | Credit, Invoice, Policy |
| Referral | earned any time | applied to next unpaid invoice | none directly | Credit |
| Cancel | **next renewal, always** (✅ decided, §4.2) | none | subscription ends instead of renewing | Change, Renewal, Subscription |
| Renew | scheduled | charge | advances period | Renewal, Invoice, BillingCycle |
| Retry | scheduled (policy cadence) | charge (retry) | none unless exhausted | Retry, Policy |
| Suspend | after grace elapsed | none | blocks access | Retry, Policy, Subscription |
| Refund | on request/policy | money returned or credited | policy-dependent | Credit, Policy |

Each row is not a separate implementation — it's an input configuration to the Change/Invoice/Credit engines above. No capability should ever gain code that only that capability has, unless it is a genuinely capability-specific policy value (Chapter 3.4).

### 4.1 Upgrade — ✅ ~95% specified (first capability fully worked through; template for the rest)

The reference state machine every other immediate-change capability (add-on add, billing cycle change)
follows the same shape as. All ten stages obey the core invariant above — nothing commits before P10.

| # | Stage | What happens | Persists? |
|---|---|---|---|
| P1 | User clicks Upgrade, picks a target plan | Create Upgrade Preview | Nothing — pure pricing calc |
| P2 | Pricing Preview | Compute current plan, target plan, remaining days, unused value, target cost, GST, credits, final payable → return an **Invoice Preview** | Nothing persisted |
| P3 | User enters checkout | Create a **pending Invoice** + a **pending Razorpay Order** | Invoice (pending), Order (created) — Subscription/add-ons/billing-cycle **untouched** |
| P4 | Waiting for payment | `Invoice.status=pending`, `Order.status=created`, Subscription unchanged | (holding state) |
| P5 | User changes target plan before paying | **Replace**: old pending Invoice → `cancelled`, old Order → obsolete; generate a new Invoice + Order | Old artifacts discarded, not merged |
| P6 | User changes add-ons before paying | Same as P5 — replace entirely, old invoice dies, new one created | Same pattern |
| P7 | User closes checkout | Nothing happens; pending Invoice eventually expires; Subscription unchanged | Expiry, not an error |
| P8 | User upgrades again before paying (e.g. Starter→Growth→Business) | **Allowed** — every change simply regenerates Invoice+Order; no state changes until payment | Same replace pattern as P5 |
| P9 | Payment fails | **Nothing changes** — Subscription/billing-cycle/plan/add-ons all unchanged; only a `Payment Failed` event emitted. Retry generates a new Order against the same Invoice (or regenerates the Invoice if it expired) | No commercial state touched |
| P10 | **Payment succeeds — THE commit point** | One atomic transaction: apply plan → apply add-ons → apply invoice → create BillingCycle → consume credits → emit events → update subscription | Everything commits here, and only here |

**The three open items — now resolved (two decided, one deliberately deferred as an invariant):**

1. **❌ SUPERSEDED — see §3.7 "MAJOR REVISION."** The business model for annual billing changed
   fundamentally (entitlement-window, not fresh-contract-per-conversion) after this was written. Left
   below for the reasoning trail only — do not implement against this. **Original (now superseded)
   text:** new period starts fresh, immediately, on conversion —
   there is no partial/blended billing cycle. The unused portion of the old period is priced and shown
   as a credit, not folded silently into the new period's math:
   ```
   Business Annual                    ₹7,800
   Unused Business Monthly Credit     −₹213.71
   -------------------------------------------
   Subtotal                           ₹7,586.29
   GST                                ₹1,365.53
   -------------------------------------------
   Total                              ₹8,951.82
   ```
   Deliberately called **"Unused Monthly Credit," not "Proration"** on the customer-facing invoice —
   the customer doesn't think in proration terms, they think "you credited me for what I didn't use."

2. **✅ DECIDED — Invoice line-item structure: full transparency, nothing hidden.** Every calculation
   the backend performs appears on the invoice — subscription base, every add-on itemized, every credit
   itemized by source (referral, coupon, unused-cycle credit), tax shown separately:
   ```
   Subscription
   ------------------------------
   Business Annual                     ₹7800
   Add-ons
   ------------------------------
   Extra Seat x4                       ₹400
   WhatsApp                            ₹200
   Credits
   ------------------------------
   Referral Reward                    -₹300
   Coupon                             -₹200
   Unused Monthly Credit              -₹214
   Tax
   ------------------------------
   GST (18%)                          ₹1389
   ----------------------------------------
   TOTAL                              ₹9075
   ```
   This is a considered product decision, not just a default: "show everything, nothing magical" so
   support can read an invoice and understand exactly what happened, line by line — subject to revision
   later, but the starting principle. Feeds directly into `calculateInvoice()`'s `lines[]` output
   (`CAW_BILLING_DESIGN.md` §4) — this structure is now that field's contract.

3. **Deliberately deferred, but the invariant is locked now, not the mechanism:** partial-commit
   recovery is a **software engineering problem** (distributed-systems partial-commit), not a business
   decision, and does not need solving today. What's locked in is the invariant every future commit
   mechanism must satisfy:
   > **Every commercial commit must be idempotent. A partially completed commit may be safely
   > re-executed until all required state transitions have been applied exactly once.**

   Concretely: `CommitInvoice(paymentId)` must be safe to call 100 times — each internal step
   (subscription update, BillingCycle creation, credit consumption, event emission, invoice send) checks
   whether it already happened and skips if so, exactly the pattern already proven live in Phase 3B's
   `reconcileMandate`. The **reconciliation scheduler** (Chapter 7) is this invariant's operational
   safety net — "find partially-committed invoices → call `CommitInvoice()` again" — not a new class of
   cron, the same one already specified. **Not designing the exact per-step "already done" checks now**
   — that's the future Commit Engine's job (an emerging concept, alongside Commercial Transaction,
   Chapter 1), deferred until that phase.

**Upgrade is now fully specified at the invariant/decision level.** The one remaining piece
(per-step idempotency checks inside the eventual commit implementation) is intentionally deferred to
implementation-adjacent design, not left undecided — the invariant it must satisfy is locked.

### 4.2 Cancellation — ✅ SPECIFIED

**Trigger:** customer clicks Cancel Subscription. **Preconditions:** subscription is active, no pending
cancellation already exists.

**Decision:** create a **Ledger entry**, category effectively its own (`CANCELLATION`), `effectiveAt =
renewalDate`. **No payment, no refund, no invoice, no Razorpay charge, no plan change — nothing
commercial changes today.** Current period continues exactly as-is (plan, add-ons, limits, access) until
`renewalDate` — the identical shape as a scheduled downgrade.

**❌ SUPERSEDED by Change Proposal V1.1-001 (below) — kept for the reasoning trail, not current
policy.** *Original Version 1.0 text:* "cancellation makes every other future change meaningless, and
blocks them. Once scheduled, the UI disables Upgrade, Downgrade, Add-on add/remove, Billing Cycle
change — all of them, not just the ones that would conflict. Rationale: the customer has already
decided 'I don't want this subscription after this period' — any further commercial change scheduled
for after that point is meaningless. Same blocking mechanism as Rule 2 (pending downgrade blocks
immediate changes), extended: a pending cancellation blocks everything, immediate or scheduled."

---

#### ✅ Change Proposal V1.1-001 — Commercial Actions During Pending Cancellation (adopted)

**Raised by:** a pre-existing, pre-CAW findings register (`BUG-031`, `KNOWN_BILLING_GAPS.md`),
carrying an explicit, already-recorded product-owner statement that predates this specification:
because this system issues no refunds, an organization with a subscription scheduled to cancel at
period end is still a full paying customer with active entitlement through that period, and should
remain able to purchase add-ons or upgrade (prorated against the remaining period) until the
cancellation actually takes effect — not merely until it is scheduled. The legacy code independently
enforces the *old*, blocking rule in two separate places (`updateSubscription` and
`initiateAddonPurchase`, each with its own copy of the same check) — confirming this was a real,
live behavior, not just a theoretical rule.

**Existing Version 1.0 rule:** a pending cancellation blocks all commercial changes, immediate or
scheduled.

**Revised rule, adopted:**
> A pending cancellation blocks only *scheduled* commercial changes whose effective date would occur
> after the cancellation takes effect. **Immediate commercial transactions that take effect now and
> are paid for now — upgrades, add-on purchases, billing-cycle changes — remain allowed** for as long
> as the subscription is still active, right up to the cancellation's effective date.

**Why the Version 1.0 rule was too restrictive, not just differently worded:** its own rationale
("any further commercial change scheduled for after that point is meaningless") is correct for
*scheduled* changes — a downgrade or add-on removal set to take effect next renewal genuinely never
executes once the subscription ends there instead. But that reasoning does not extend to an
*immediate* action: a customer who buys 2 more seats today, to use during the 21 days they've already
paid for and still have left, gains real, immediate value from that purchase — it is not "meaningless"
merely because the subscription won't renew afterward.

**The distinction this proposal draws, stated as the new operative rule:**
- **Still blocked:** any *scheduled* change (a scheduled downgrade, add-on removal, billing-cycle
  change) — these remain meaningless once there's no future renewal for them to apply to, exactly as
  Version 1.0 already reasoned.
- **Now allowed:** any *immediate, pay-now* action (upgrade, add-on purchase, billing-cycle switch
  taking effect today) — these follow the ordinary Commercial Transaction path (Chapter 15) exactly
  as they would on an active subscription with no pending cancellation at all, right up until the
  cancellation's effective date arrives.

**Impact on other chapters:** none required beyond this one — Rule 2 (§3.2, "no immediate change
while any Scheduled Change exists") is not contradicted by this proposal, because a pending
cancellation is no longer treated as blocking immediate actions at all; Rule 2 still applies
normally to a pending *downgrade* coexisting with an immediate action, which this proposal does not
touch.

**Status: adopted as Version 1.1.** This is the one item from this round of reconciliation classified
as a genuine specification change rather than implementation guidance — recorded here per the
Version 1.1+ Change Process (end of this document), not silently folded into Version 1.0's original
text.

**Renewal day, if a pending cancellation exists:** the Renewal Engine does **not** build an invoice, does
**not** charge, does **not** create a new BillingCycle. Instead: `Subscription → cancelled`, access
removed, the pending cancellation ledger entry cleared. Finished — no active billing cycle, no future
renewal, no retries, no scheduled work remain.

**✅ DECIDED — resubscribing after cancellation is a brand-new subscription, not a resume.**
Cancellation is not account deletion; the organization persists. But there is no "uncancel," no resume,
no reopening old billing history. The flow is `Cancelled → Choose Plan → Acquire Mandate → Pay → New
Subscription → Active` — a fresh Acquisition (Chapter 3.2/`CAW_BILLING_DESIGN.md` §6), same mental model
as "Netflix cancelled, six months later subscribed again" — same account, entirely new subscription
lifecycle.

**Cancellation's own state path:** `requested → scheduled → effective_at_renewal → completed`, where
`completed` means `Subscription.status = cancelled` — the same shape as the general Change state machine
(Chapter 2), not a special case grafted on.

---

**Phase 1 progress: three of the hardest commercial changes are now fully specified — ✅ Upgrade, ✅
Downgrade (via the shared Scheduled-change path, Chapter 3.2), ✅ Cancellation.** These three define how
commercial state evolves over time; every remaining change (add-ons, coupons, referrals, credits,
renewals, retries) builds on the same state machine rather than introducing a new one.

### 4.3 Add-on Changes — ✅ SPECIFIED (revised mid-specification — see Invariant 7 above)

**Foundational invariants:**
- **A1 — an add-on is just another commercial component:** `Invoice = Plan + Addon A + Addon B + ...`.
  The billing engine has no concept of "seat" — only `Addon`, with `{id, price, billingCycle,
  compatibility, status}`. Nothing special about seats at all.
- **A2 — every add-on is independent**, each with its own lifecycle.
- **A3 — add-ons are never merged.** A `Storage` add-on's pending removal never affects `Seats` or
  `WhatsApp`'s state.

**Two fundamentally different add-on types — ✅ decided, resolves the first open question:**
| Type | Examples | Model |
|---|---|---|
| **Feature** (boolean) | WhatsApp, AI Assistant, Priority Support | `enabled` / `disabled` |
| **Quantity** | Seats, SMS Credits, AI Credits, Storage GB, Projects | a running `quantity`, incremented/decremented by each `SubscriptionChange` |

**✅ DECIDED — no reject-on-duplicate for quantity add-ons (corrects an earlier draft of this
chapter).** The original State A1 draft ("does this add-on already exist? if yes, reject") was wrong for
quantity types — a customer can add more seats at any time, immediately, priced and invoiced
independently of any previous purchase of the same add-on. Feature add-ons genuinely can't be "added
twice" (a boolean has no duplicate state), but quantity add-ons are additive by nature — full flexibility,
no reject.

**✅ DECIDED — re-adding an add-on that has a pending removal does NOT cancel the removal (corrects an
earlier draft's recommendation).** Both actions are stored as **separate, independent
`SubscriptionChange` records** and both execute:
```
Storage → REMOVE, effective=renewal, scheduled   (unchanged, still fires at renewal)
Storage → ADD,    effective=now,     completed   (fires immediately, invoiced now)
```
The customer sees both in their activity log, exactly as performed. No inferred "they must have meant
to cancel the removal" — per Invariant 7, the engine never makes that judgment call on the customer's
behalf. (Net product effect: Storage is active today because of the ADD, and is removed again at the next
renewal because the REMOVE was never cancelled — the customer can independently cancel the pending REMOVAL as its own explicit action if that's not what they wanted, rather than the system silently
inferring it from the ADD.)

**Quantity add-on walkthrough — full flexibility, nothing merges, ever:**
```
Seats: 10 (current)
  +1 now      → SubscriptionChange{ADD, qty:1, effective:now, completed}       → quantity → 11
  +2 (next day) → SubscriptionChange{ADD, qty:2, effective:now, completed}     → quantity → 13
  −2 (later)  → SubscriptionChange{REMOVE, qty:2, effective:renewal, scheduled} → still 13 until renewal
  −1 (later)  → SubscriptionChange{REMOVE, qty:1, effective:renewal, scheduled} → still 13 until renewal
Renewal: walk every scheduled change with effectiveAt<=today → apply −2, −1 in sequence → 13 → 10
```
Every action is its own record, its own invoice (if immediate), its own line in the activity log. The
Renewal Engine's job becomes purely mechanical: **"give me every scheduled change with `effectiveDate <=
today`, apply them in order"** — no special-casing per combination, no merge logic, no "does this
conflict" judgment call for add-ons at all.

**Add-on state walkthrough (A1-A10, corrected per Invariant 7):**
- **A1 (add):** feature add-ons — already active? reject (can't duplicate a boolean). Quantity add-ons —
  never reject, always additive.
- **A2 (add):** incompatible with current plan? Reject — no checkout, no invoice, nothing (same as
  Upgrade's compatibility rule, §3.2).
- **A3 (add, while a removal is already scheduled):** does NOT cancel the removal — see decision above,
  both persist as independent records.
- **A4 (add, payment):** if compatible, create a prorated invoice → checkout → await Razorpay, identical
  philosophy to Upgrade — nothing changes before payment confirms.
- **A5 (add, payment succeeds):** attach/activate the add-on immediately, increase limits, invoice
  stored, recurring amount updated.
- **A6 (add, payment fails):** nothing changes — no pending add-on, no partial state, identical to
  Upgrade's failure handling.
- **A7 (remove, then remove another):** both coexist, both apply together at renewal — same as multiple
  independent `SubscriptionChange` records for different targets always do.
- **A8 (remove scheduled, then upgrade):** pending removals survive an upgrade; renewal applies
  `Upgrade + Remove Storage + Remove Seats` together, in one transaction.
- **A9 (remove scheduled, then subscription cancelled):** **✅ confirmed precedence** — `Pending
  Cancellation > Pending Downgrade > Pending Addon Removal`. A pending cancellation short-circuits the
  entire renewal pipeline: the Renewal Engine's first check is "is there a pending cancellation?" — if
  yes, no invoice, no charge, no add-on reconciliation, subscription simply ends. Scheduled removals are
  **not deleted** (Invariant 7 — never destroy recorded intent), they just never execute because the
  subscription they'd apply to no longer renews.
- **A10 (removal already executed, then an unrelated plan change):** no interaction — the removal is
  `completed`, out of scope for anything that happens afterward.

**Both remaining open questions from the original draft are now closed:**
1. Quantity vs. feature add-on modeling — ✅ decided above (two types, quantity types accumulate via
   independent `SubscriptionChange` records, never merged into one running total field).
2. Re-add-cancels-pending-removal — ✅ decided **against** (both persist, per Invariant 7).
3. Cancellation precedence — ✅ confirmed: `Cancellation > Downgrade > Addon Removal`.

**Model shift this section produced:** dozens of per-capability pending fields on `Subscription`
(`pendingUpgrade`, `pendingDowngrade`, `pendingAddonRemoval`, ...) converge into **one abstraction**:
every commercial action is a `SubscriptionChange` record. `Subscription` stores only current state;
history, future, scheduling, and audit trail all live in `SubscriptionChange`. This *is* the concrete
implementation of Phase 1.3's "Ledger Entry" — same concept, now named and fielded. **Next section: the
`SubscriptionChange` model itself** — fields, lifecycle, statuses, transition rules — since every
capability specified so far (Upgrade, Downgrade, Cancellation, Add-ons, quantity changes) now uses this
one object rather than a capability-specific shape. Not yet specified.

---

## Chapter 5 — Interaction Matrix

Cross-references the interaction work already started in `CAW_BILLING_DESIGN.md` (Failure Matrix §10) and the earlier audit-era `InteractionMatrix.md`/`BusinessContracts.md`. This chapter's job going forward: answer "what if X then Y" for every pairwise combination of Chapter 4 capabilities until behavior is fully deterministic. Concretely, the three open questions already raised in `CAW_BILLING_DESIGN.md` §4a are the seed of this chapter:

1. Does a new upgrade cancel, merge with, or queue behind an in-progress downgrade?
2. If multiple changes are scheduled for the same renewal (add-on removal + downgrade), do they apply atomically, and in what order?
3. Exact credit-application timing: "next unpaid invoice" — the one being generated right now mid-pipeline, or strictly a future one if this one's already charged?

**Q1 — ✅ ANSWERED** (Chapter 3.2, Scheduled Change model + Rule 2): an *immediate* change is blocked
while any Scheduled Change exists — not rejected in some vaguer merge/supersede sense, simply blocked
until the scheduled renewal package takes effect. Surfaced in the UI as disabled controls with an
explanatory tooltip.

**Q2 — ✅ ANSWERED** (Chapter 3.2, Rule 1 + Rule 2, superseding the earlier "one pending downgrade blocks
everything" draft): multiple Scheduled Changes **do** coexist, one per target — a plan downgrade, an
add-on removal, and a seat reduction can all be scheduled for the same renewal simultaneously. What's
blocked is only *immediate/charge-now* changes, not additional scheduling. Precedence within the same
target (two requests both touching, say, the AI add-on) is handled by Rule 1: opposite-direction requests
cancel the existing scheduled record, same-direction requests update it in place — never stack as two
records.

**Q3 — still open.** Exact credit-application timing: "next unpaid invoice" — the one being generated
right now mid-pipeline, or strictly a future one if this one's already charged. Not addressed by this
chapter (the Referral Engine's concern, §3.6b, since this question is specifically about a referrer's
reward applying to "their next bill").

### Section 1 — Plan ↔ Plan (systematic state enumeration; walking the state graph, not inventing features)

| State | Scenario | Result | Status |
|---|---|---|---|
| P1 | No pending change; Starter → upgrade Growth | Immediate: invoice, proration, subscription updated | ✅ Decided |
| P2 | Growth → upgrade Business | Same as P1 | ✅ |
| P3 | Business → downgrade Growth | Scheduled for renewal | ✅ |
| P4 | Growth → downgrade Starter | Scheduled for renewal | ✅ |
| P5 | Scheduled `Business→Growth`; customer schedules `Business→Starter` instead | **✅ Closed — Replace** the scheduled record (Rule 1 — same target, same-direction edit). Confirmed, no longer just a leaning. | ✅ |
| P6 | Scheduled `Business→Starter`; customer changes mind to `Growth` | **✅ Closed — Replace**, not a second record. Same basis as P5, confirmed. | ✅ |
| P7 | Scheduled downgrade exists; customer clicks Upgrade | **Rejected** — Rule 2: no immediate change while a Scheduled Change exists | ✅ |
| P8 | Starter → upgrade Growth (commits) → immediately upgrade Business | **✅ Closed — (A): a second, independent prorated invoice, Growth→Business.** Confirmed, not recalculated as one Starter→Business change — the customer already owns Growth, a real, already-committed commercial fact; every upgrade is simply its own Commercial Event (§3.7), and there is no limit on how many successive upgrades can occur (each is a new commercial event; Chapter 9 finding P13 already established unlimited upgrades are allowed). | ✅ |
| P9 | Growth → upgrade Business initiated, payment pending → second tab initiates the same upgrade again | **✅ Effectively closed by Chapter 10's Law 11 ("a subscription can never have more than one collectible invoice at a time").** A second upgrade attempt, while the first is still pending payment, is exactly the same shape as any other new commercial action arriving while an invoice is outstanding: the first pending invoice is voided and a fresh one is generated representing the customer's current, full intended position. The dedicated "Commercial Transaction" concept below was originally invented to solve this gap; Law 11 turned out to solve it more simply, without needing a new object. | ✅ |
| P10 | Upgrade payment fails → customer retries | **✅ Closed — reuse the same, already-existing invoice; never regenerate.** This is exactly Chapter 10's Object 3 finding (`FAILED → PAID` is one invoice's own lifecycle across many payment attempts) applied to an upgrade invoice specifically, not just a renewal invoice — the rule is general to every invoice, regardless of which Commercial Event produced it. | ✅ |
| P11 | Webhook succeeds; frontend verify call never happens | Already solved — settlement is idempotent (Phase 3B `reconcileMandate`, proven live) | ✅ |
| P12 | Frontend verify succeeds; webhook arrives later | Already solved — settlement fires once regardless of which path wins the race | ✅ |
| P13 | Webhook fires, then retries 2x (at-least-once delivery) | Already solved — idempotent (event-id dedupe + idempotent activation, both proven live in Phase 3B) | ✅ |
| P14 | Scheduled downgrade exists; renewal itself fails | Belongs to the Renewal Engine chapter (3.5), not this one — deferred, not forgotten | — deferred |
| P15 | Scheduled downgrade exists; an admin manually upgrades the org | Does the admin action cancel the scheduled downgrade? Likely an Admin-capability chapter, not Plan↔Plan | — deferred |

**✅ All four "open decisions" originally surfaced by this pass are now closed, per the findings recorded directly in the table above (P5/P6/P8/P9/P10) — cross-referencing Chapter 10's Law 11 and Object 3 finding, which is what actually closed P9 and P10 without needing a new "Commercial Transaction" object. The only genuinely residual items from this pass are P14 and P15, which were always correctly deferred to other chapters rather than left as unresolved questions of this one.**

### Phase 2 — Change Precedence Rules (the actual heart of the Change Engine)

Section 1 (above) enumerated Plan↔Plan states. Phase 2 generalizes this into cross-category precedence
rules the Change Engine applies uniformly — not per-pair special cases. Once this exists, every endpoint
asks the Change Engine one question — *"here's the current subscription and a requested change, what
should happen?"* — instead of implementing its own business logic. Pairs to work through, systematically,
same rigor as Section 1:

- Upgrade → Upgrade (Section 1, done)
- Upgrade → Billing Cycle Change
- Upgrade → Add-on
- Add-on → Add-on
- Add-on → Remove Add-on
- Remove Add-on → Upgrade
- Downgrade + Remove Add-on (coexistence — already partly answered by Rule 1/2, needs the full pass)
- Multiple scheduled removals
- Conflicting pending changes generally — what replaces, what merges, what's rejected

**Not started yet.** Section 1 (Plan↔Plan) is the only pair fully worked through so far.

---

## Chapter 6 — Ownership Matrix

**⚠️ Superseded by Chapter 20 (The Definitive Ownership Matrix) — kept here as a historical record of
the first pass, not the current authoritative source.** Chapter 20 consolidates this table with two
later, more concrete ones (Chapter 11's object-level matrix and Chapter 13's Super Admin Authority
Matrix) into a single canonical table. Consult Chapter 20 for anything current.

One row per responsibility. The rule this table enforces: **no two engines may write the same fact.**

| Responsibility | Owner |
|---|---|
| Current commercial/mandate state | Subscription Engine |
| Decide what a requested change means (now vs. scheduled, replace vs. merge) | Change Engine |
| Apply scheduled downgrade/removal at renewal | Renewal Engine |
| Advance BillingCycle | BillingCycle Engine, triggered by Payment Success fact |
| Compute an invoice | Invoice Engine |
| Decide proration formula | Policy Engine |
| Reserve a credit/reward | Coupon Engine (coupon) / Referral Engine (referral reward) — see Chapter 20 |
| Consume a credit/reward | Coupon Engine (coupon) / Referral Engine (referral reward) — see Chapter 20 |
| Retry a failed payment | Retry Engine |
| Decide grace period length | Policy Engine |
| Expire a trial | Trial Engine (a thin specialization; see Chapter 7 Scheduler Matrix) |
| Reconcile a missing/orphaned webhook | Reconciliation Engine |
| Send an invoice email / timeline event | Event Engine |
| Verify webhook signature | (infrastructure, not a business engine — stays in the webhook handler layer) |

**Enforcement note:** this table is normative. Any future code review question of the form "which function should update field X" is answered by looking up X's responsibility here, not by convenience of where the code happens to be.

---

## Chapter 7 — Scheduler Matrix

Cron is not an engine and never decides business logic. It is a dispatcher: "is anything due? if so, call the engine." The "Never Does" column exists specifically to stop schedulers from slowly accumulating business logic — the failure mode the review flagged as "cron spaghetti" earlier in this project.

| Scheduler | Runs on | Calls | Never does |
|---|---|---|---|
| Renewal Scheduler | subscriptions due for renewal | Renewal Engine | calculate prices |
| Retry Scheduler | subscriptions with a failed payment past the retry interval | Retry Engine | decide grace period length |
| Trial Scheduler | trials nearing/at expiry | Trial Engine | create invoices |
| Reconciliation Scheduler | subscriptions stuck in an inconsistent state past a timeout | Reconciliation Engine | advance billing periods |

This is the "one reconciliation job, reused, not a family of crons" principle already established in
`CAW_BILLING_DESIGN.md` (§ Phase 3B Planning caution), generalized: **exactly one scheduler per
responsibility, and every scheduler's only job is "ask the engine if there's work; if so, call it."**

---

## Chapter 8 — Commercial Invariants (The Ten Laws)

**Why this chapter exists.** Chapters 1–7 designed features. This chapter is different: it's the
philosophy that should decide every *future* feature question without needing a fresh design
session each time. It was surfaced by a deliberate shift in approach — after the system was
designed, it was re-examined from an attacker's mindset (Chapter 9, Phase 2A), trying to break it
rather than build it. The pattern that fell out: **this billing system should optimize for
determinism, not flexibility.** Every extra degree of freedom creates exponentially more state
combinations to reason about; since this is the billing core itself (not a customer-facing feature
layer), the right instinct is the opposite of "make it configurable" — make it as close to
hardcoded as the business will tolerate.

**How to use this chapter going forward:** when a new requirement arrives ("can we do X?"), the
first question is not "how do we build it" — it's "does X violate one of these laws?" If it does,
either the requirement changes, or a law changes *deliberately and visibly*, the same way every
other correction in this document has been recorded (superseded-not-deleted), never silently.

1. **Money never moves without an invoice.** No charge, credit, or refund happens off the back of
   an invoice record — there is no such thing as an unattributed monetary movement.
2. **Nothing commercially changes until payment succeeds.** The only exception, anywhere in the
   system, is the transition into `past_due` — this restates the Change Engine's core invariant
   (§3.2) and Renewal Principle 1 (§3.5) as a system-wide law, not a rule local to one engine.
3. **Invoices are immutable.** Never edited, never recalculated, never reused for a different
   commercial event. A retry re-attempts collection of the *same* invoice; it never generates a new
   one (§3.7's Commercial Event model already established this for renewals — this law generalizes
   it to every invoice, unconditionally).
4. **Every customer action becomes its own commercial event.** No hidden deductions, no silent
   merges, no automatic cleanup performed on the customer's behalf.
5. **The system never guesses user intent.** A seat removal and a seat addition are two separate
   events, always — even when one would "obviously" seem to cancel the other. This is Invariant 7
   (§3.2) restated as a system-wide law rather than an Add-on-specific rule.
6. **The future can be scheduled, but only the present can change immediately.** This single rule
   is what already explains downgrades, add-on removals, and cancellation timing (Chapters 3.2,
   4.2, 4.3) — restated here as the general law those specific behaviors are instances of.
7. **One business action produces one business outcome.** No action partially succeeds. Either
   everything in a commit sequence lands, or nothing does — this is the Commit Engine's idempotent
   invariant (Chapter 1, §3.5 R13.5) generalized beyond just the renewal commit path.
8. **✅ DECIDED — commercial configuration (prices, plans) is not versioned; the currently
   configured value is simply applied consistently, everywhere, at the moment it's needed —
   deliberately choosing NOT to over-engineer this.** An earlier draft of this law proposed
   versioning every plan price (a new `Growth v2` object whenever price changes, existing customers
   pinned to `v1` until deliberately migrated) specifically to make a scenario like "customer's
   renewal fails, admin changes the plan price two days later, customer pays the retry" fully
   deterministic without ambiguity. **That proposal was explicitly rejected — on purpose, not by
   oversight.** The reasoning: plan price changes are rare, retries are relatively rare, the overlap
   of both happening in the same short window is rarer still, and *either* reasonable answer to "old
   price or new price" is fully explainable to a customer and to Finance. Building a whole
   versioning subsystem to make an already-rare, already-explainable edge case marginally cleaner is
   exactly the kind of premature machinery this project has repeatedly rejected elsewhere (the
   generic Credit Engine, the Billing Bucket model). **The actual rule, to be applied uniformly by
   whichever engine touches pricing:** whatever the plan/add-on's price is *at the moment an invoice
   is generated* is what that invoice charges — a retry attempts to collect the same, already-frozen
   invoice (per Law 3) and is therefore entirely unaffected by any price change that happens after
   that invoice was created. This one rule, applied consistently, is sufficient — no separate policy
   is needed for the retry-during-a-price-change overlap specifically.
9. **Time never stops.** Coupons expire, referrals expire, trials expire, on schedule, even while a
   customer is suspended. Being suspended pauses the customer's *access*, not the calendar — nothing
   about being suspended freezes any other clock in the system.
10. **Every commercial calculation must be reproducible, unchanged, years later.** Given an invoice,
    the product/plan version it was priced against, and a snapshot of whatever coupon/referral/GST
    rules applied at the time, Finance must be able to reproduce the exact total charged, even five
    years later. This is the invoice-immutability principle (Law 3, and Invariant 5 in
    `CAW_BILLING_DESIGN.md`) taken to its logical, auditable conclusion.

**A deliberately adopted triage discipline for every audit pass from here forward** (Phase 2A,
Chapter 9, and any future pass): findings are sorted into exactly three buckets, and only the first
gets the full "propose → correct → confirm" treatment this document has used throughout —
- **🟥 Critical** — affects money, accounting, customer entitlements, or state consistency. Always
  brought to the business for an explicit decision, recorded here as a Law or a Chapter 9 finding.
- **🟨 Medium** — affects UX or Support experience, not money or state integrity. Resolved directly
  against the Ten Laws above without a separate discussion, unless it conflicts with something
  already decided.
- **🟩 Low** — a genuinely rare edge case where either reasonable outcome is acceptable and
  explainable. Resolved with whatever's simplest and most consistent with the Laws, recorded, and
  not revisited — Law 8 above is the template for how a 🟩 finding gets closed out.

---

## Chapter 9 — Phase 2A: Interaction Matrix Audit (Attacker-Mindset Pass)

**Purpose and method.** Chapter 5 built the Interaction Matrix by systematically enumerating
Plan↔Plan states. This chapter extends that same discipline to every other object, but from a
different starting posture: instead of asking "how does this feature work," each finding below
started from "how would someone break this, or where does the design go silent." Each finding is
resolved directly against the Ten Laws (Chapter 8) — most of these turned out to already be implied
by a law once one existed; a small number needed their own explicit decision, marked accordingly.

### Category 1 — Plan Changes

| # | Scenario | Resolution |
|---|---|---|
| P11 | Customer starts an upgrade checkout, leaves without paying, returns the next day | **The old pending invoice expires; a fresh invoice is generated on return, priced against current commercial configuration** (current plan price, current coupon eligibility, current referral eligibility, current GST) — an upgrade invoice is a priced snapshot of "right now," never an indefinitely valid offer. Consistent with Law 8: whatever is current when the (new) invoice is generated is what's charged. |
| P12 | Customer is mid-checkout on an upgrade; admin changes the plan's price before they pay | **The already-generated invoice is honored at its original amount** (Law 3 — invoices are immutable once generated), regardless of what the price is changed to afterward. This is the same rule as P11 applied in the other direction: the invoice, once created, is the frozen truth; only a *fresh* invoice picks up a *new* price. |
| P13 | Customer's upgrade succeeds; they immediately upgrade again | **Allowed, with no limit.** Every successful payment is simply another Commercial Event (§3.7) producing another new commercial state — there is no concept of "too many upgrades in a row" anywhere in this design. |
| P14 | A downgrade is already scheduled for tomorrow's renewal; customer tries to buy an add-on today | **Blocked** — already decided in Chapter 3.2 Rule 2 (no immediate/charge-now action while any Scheduled Change exists). Restated here only because the audit specifically tested it and found the existing rule already covers it cleanly. |
| P15 | A downgrade is scheduled; customer schedules a *different* downgrade before the first takes effect | **Replaces the first** — already decided (Chapter 3.2 Rule 1 / Ledger rule L1). Confirmed clean under this audit. |
| P16 | A downgrade is scheduled; customer cancels the scheduled downgrade | **The subscription simply returns to normal** — no downgrade pending, no other side effect. Confirmed clean; no new rule needed. |

### Category 2 — Add-ons

| # | Scenario | Resolution |
|---|---|---|
| A11 | Seats increased four separate times in a row (+5, +5, +5, +5) | **Allowed, no artificial ceiling** beyond whatever real business/plan limits already exist. Each addition is its own commercial event (Law 4), priced and invoiced independently, exactly as already specified in §4.3's quantity add-on walkthrough. |
| A12 | Multiple seat *removals* are scheduled in a row, and the combined effect would take the customer's seat count below zero (or below whatever floor applies) | **✅ Decided — validate against the resulting future state, not just the current state, and reject the request that would produce an impossible number.** Example: current seats = 4; a removal of 3 is scheduled (future = 1, fine); a second removal of 3 is then requested (future would be −2) — **the second request is rejected outright, at the moment it's requested**, not silently accepted and discovered as a problem at renewal. This is a direct consequence of Law 6 (only the present can change immediately; the future can be scheduled, but it must still be a *legal* future) — a scheduled change is still validated against what it would produce, not exempted from validation just because it hasn't taken effect yet. |
| A13 | An add-on removal is already scheduled; separately, a plan change makes that same add-on incompatible with the new plan | **Still just one removal, not two.** The already-scheduled removal is not duplicated by the plan-change-driven auto-removal logic (§3.2's add-on compatibility rule) — if a removal for that add-on is already pending, the plan change simply doesn't need to schedule a second one for the same target, consistent with Ledger Rule L3 (an add-on's scheduled change is keyed by add-on identity, so there's only ever one slot for it to occupy). |
| A14 | A pending add-on removal is cancelled by the customer | **The pending removal simply disappears** — no residual state, no partial cancellation. Confirmed clean; no new rule needed. |
| A15 | An immediate add-on purchase's payment fails | **Nothing changes** — already fully covered by the existing "no money, no change" rule (Law 2); re-confirmed here, not a new finding. |

### Category 3 — Coupons

| # | Scenario | Resolution |
|---|---|---|
| C1 | An invoice is generated while a coupon is active; admin disables the coupon before the customer pays | **Honored at the invoice's original, already-discounted amount** — direct consequence of Law 3 (invoices are immutable once generated). Disabling a coupon only affects *future* invoice generation, never an invoice that already exists. |
| C2 | A coupon expires at 11:59pm; a renewal invoice is generated at 12:01am the same night | **✅ Decided — eligibility is evaluated at the exact moment the invoice is generated, using the invoice's generation timestamp as the single source of truth**, not the renewal's "due date" or any other nearby timestamp. If the coupon's expiry timestamp is earlier than the invoice-generation timestamp, it is expired for that invoice, full stop — no grace window, no rounding to the nearest day. |
| C3 | A customer has a "Lifetime" coupon; they upgrade to a different plan | **Depends entirely on the coupon's own configured scope (§3.6a), not on any special upgrade-time logic.** If the coupon's per-item rules include the new plan, the discount continues to apply to it; if not, the discount simply has nothing left to apply to on that invoice going forward. "Lifetime" describes the coupon's *duration*, not which billable items it's scoped to — those are two independent dimensions of the same coupon, both already specified in §3.6a, and this finding confirms they don't need any new interaction rule when combined. |
| C4 | A coupon is scoped to seats specifically; the customer removes all their seats | **The coupon simply has nothing to discount on the next invoice — it is not "lost," "paused," or "carried forward."** It remains configured exactly as it was; it just has zero matching line items to apply to until/unless the customer has seats again. No new state, no new rule. |

### Category 4 — Referrals

| # | Scenario | Resolution |
|---|---|---|
| R1 | A referral reward is earned (destined for the referrer's next invoice); the referrer cancels their subscription before that invoice is ever generated | **✅ Decided — the reward is preserved, not forfeited, until its own configured expiry (§3.6b) elapses on its own, or it's actually used.** Cancelling a subscription does not retroactively revoke an already-earned reward — the customer earned it by referring another organization, an action already completed; whether they later keep or cancel their own subscription is a separate fact. **✅ The residual question this originally left open is now closed too: a preserved, unused reward belongs to the *organization*, not to any specific subscription, and survives resubscribing.** Even though resubscribing after cancellation is a brand-new *subscription* (Chapter 4.2, Object 1 in Chapter 10) — a new commercial timeline, a new mandate, a new invoice history — the organization's identity is unchanged, and a `Reward` (Chapter 10, Object 5) is granted to an organization, not embedded inside a subscription record. A new subscription doesn't destroy a still-valid reward; it simply becomes available to apply to that new subscription's next eligible invoice, exactly as it would have applied before cancellation. |
| R2 | A referral reward is applied to an invoice; that invoice's payment fails | **✅ Decided — the reward is reserved, not consumed, until the invoice is actually paid**, consistent with the already-established reservation-lifecycle pattern (`referralRewards.js`, §3.6b) and with Law 2 (nothing commercially finalizes before payment succeeds). On failure, the reservation simply releases back to "available," exactly like the existing reservation/consumption mechanism already does for coupon-adjacent flows. |
| R3 | A referral reward and a renewal happen to fall due on the exact same day | **Resolved by C2's rule, applied identically:** the reward's expiry is evaluated against the invoice-generation timestamp, not any other nearby date. No separate policy needed — this is the same underlying rule as C2, just for a referral reward instead of a coupon. |

### Category 5 — Renewals

| # | Scenario | Resolution |
|---|---|---|
| N1 | A renewal charge succeeds, but the success webhook is delayed, and the retry scheduler wakes up in the meantime | **Already fully handled — this is exactly the idempotent, order-independent webhook design already proven live** (`CAW_BILLING_DESIGN.md` §7a, Invariant 12; `reconcileMandate`). Re-confirmed here, not a new finding. |
| N2 | A renewal charge succeeds, but the customer, looking at their account a moment later, still sees their old plan | **This is a UX/display-consistency question, not a billing-correctness question — classified 🟨 Medium, not 🟥 Critical.** The underlying commercial state is correct and consistent the instant the payment is confirmed (Law 2); any lag in what a particular screen displays afterward is an implementation/caching concern for that screen, not a billing invariant. No Law is implicated. |
| N3 | A renewal charge succeeds, but the confirmation email fails to send | **✅ Decided — an email delivery failure never affects billing in any way.** Email/notification delivery (Chapter on customer communication, `BILLING_SYSTEM_EXPLAINED.md` Part 16) is a side effect of a billing event, never a precondition for one — a failed email might be worth retrying as its own concern, but it must never roll back, delay, or reverse the commercial event it was meant to describe. |

### Category 6 — Suspension

| # | Scenario | Resolution |
|---|---|---|
| S1 | A referral reward is earned while the referrer's own subscription is suspended | **Stored normally, exactly as it would be for an active subscription.** Suspension affects product *access*, not the customer's underlying commercial facts or entitlements — this is the same access/commercial-state independence already established for `appStatus` throughout Chapter 3.5. |
| S2 | A coupon expires while a customer is suspended | **Expires on schedule, exactly as it would for an active customer — this is Law 9 (time never stops) directly.** Being suspended pauses access, not the calendar. |
| S3 | A renewal fails, the subscription goes `past_due`, and admin changes the plan's price before the customer eventually pays (via retry) | **Resolved by Law 8, with no special case for suspension.** The invoice generated at the original renewal attempt is already frozen (Law 3); the retry collects *that* invoice, at its original amount, regardless of any price change made afterward. This was flagged during the audit as potentially "the first genuinely major unresolved policy" before Law 8 was settled — it turned out not to need its own separate rule once Law 8 existed; restated here explicitly so the connection between the two is on record. |

### Category 7 — Cancellation

| # | Scenario | Resolution |
|---|---|---|
| X1 | A cancellation is already scheduled for the next renewal; a referral reward is earned before that renewal date arrives | **The reward is still theirs — earning a reward and having a subscription end are unrelated facts, per the same reasoning as R1.** |
| X2 | A cancellation is already scheduled; a coupon is newly issued to that customer in the meantime | **The coupon has nothing left to apply to, practically speaking, since no further invoice will be generated before the subscription ends — but this is a consequence of there being no renewal to attach it to, not a special "coupons are voided by cancellation" rule.** If the scheduled cancellation is itself cancelled before it takes effect (Chapter 4.2), the coupon becomes usable again on the next invoice generated, with no separate reactivation step needed. |

**What this chapter demonstrates, as a milestone:** every finding above except Law 8 itself turned
out to already be a direct, mechanical consequence of a rule established somewhere in Chapters 1–7
or the Ten Laws (Chapter 8) — not a new invention. That convergence is the actual sign this
specification has matured: an audit pass whose main output is "confirmed, already covered" far more
often than "here's a new rule" is exactly what a settled specification should produce.

---

## Chapter 10 — Phase 2B: State Integrity Audit

**Purpose and method.** Chapter 9 proved the business rules hold up under attack. This chapter
proves something different and, historically, harder to get right: that no object in this system
can ever land in a state that shouldn't exist, or take a transition that shouldn't be legal.
Production billing systems tend to fail here, not in the business logic — an *upgrade* being priced
wrong is a bug you'll notice quickly; a *subscription* silently sitting in two contradictory states
at once is a bug that quietly corrupts data until someone finally trips over it. This chapter goes
object by object — not feature by feature — and for each one answers: what states exist, who can
change them, which transitions are legal, which are impossible by design, and what invariant must
always hold.

### Object 1 — Subscription

**States:** `TRIAL (optional)` → `ACTIVE` → `PAST_DUE` → `SUSPENDED` → `CANCELLED`, with `ACTIVE`
and `PAST_DUE` able to move back and forth (a successful retry returns `PAST_DUE` to `ACTIVE`).

| Question | Answer |
|---|---|
| Can `ACTIVE` go directly to `CANCELLED`? | **No.** Cancellation is always scheduled (Chapter 4.2) — the real sequence is `ACTIVE` → *a Cancellation is scheduled* (a pending commercial event, not a subscription state) → the scheduled renewal day arrives → `CANCELLED`. "Cancellation Scheduled" is never itself a value the Subscription's state field holds. |
| Can `ACTIVE` become `SUSPENDED` directly? | **No.** It must always pass through `PAST_DUE` first — this is the existing Retry Engine boundary (§3.5) restated as a hard transition rule: there is no code path, ever, that suspends a subscription that hasn't first failed to renew and exhausted its retries. |
| Can `PAST_DUE` become `CANCELLED`? | **✅ Decided — yes, a cancellation can be scheduled while `PAST_DUE`.** The customer already wants to leave; cancelling simply means "don't renew me again," and does not erase the outstanding debt. The subscription sits as `PAST_DUE` **plus** a scheduled cancellation simultaneously, until either the debt resolves or the scheduled cancellation's date arrives (at which point, per Chapter 4.2, it becomes `CANCELLED` regardless of the outstanding balance — the balance becomes a separately-pursued matter, per the open item already flagged in `BILLING_SYSTEM_EXPLAINED.md` Part 15, item 3). |
| Can `SUSPENDED` become `CANCELLED`? | **Yes.** A suspended customer can still say "I don't want this anymore" — nothing about being suspended blocks a cancellation request. |
| Can `CANCELLED` become `ACTIVE`? | **No, never.** Already decided (Chapter 4.2) — resubscribing is always a fresh subscription, a fresh mandate, a fresh audit trail, never a resurrection of the cancelled one. |

**Subscription Laws (object-level invariants, subordinate to the Ten Laws in Chapter 8):**
1. **Exactly one lifecycle state at a time.** `ACTIVE + SUSPENDED` simultaneously is not a rare
   edge case to guard against — it is definitionally impossible, the same way a number can't be
   both even and odd.
2. **Pending changes are not subscription states.** A scheduled downgrade, add-on removal, or
   cancellation never lives in the Subscription's own state field — they are separate records
   (formalized as `ScheduledChange`, below) that the Subscription's *current* state is indifferent
   to until they execute.
3. **The Subscription's state never stores pricing.** Pricing lives on Components and Invoices, never
   inferred from or stored on the subscription's lifecycle state.
4. **The Subscription never stores invoice totals.** Same reasoning as Law 3 — a derived, historical
   fact does not belong on the one record that only ever describes "what's true right now."
5. **The Subscription owns access; invoices never decide access.** Access is a function of
   lifecycle state (`ACTIVE`/`PAST_DUE` = access, `SUSPENDED`/`CANCELLED` = no access) — never a
   function of any individual invoice's own status.

### Object 2 — Component (Billable Item)

**States:** `ACTIVE` → `PENDING_REMOVAL` → `REMOVED`. An immediate purchase enters directly at
`ACTIVE` — there is no intermediate state for something that was paid for immediately.

| Question | Answer |
|---|---|
| Can `REMOVED` become `ACTIVE`? | **No.** Re-adding the same add-on later is always a new Component, with its own fresh identity, price snapshot, and audit trail — never a resurrection of the removed one. |
| Can a Component have both a pending removal and a pending quantity *increase* simultaneously? | **No** — quantity increases are always immediate (§4.3), so there is nothing to be "pending" about an increase; it either already happened or hasn't been requested. This was already settled by the immediate/scheduled split established throughout Chapters 3.2–4.3, re-confirmed here as a hard state-level impossibility rather than just a business preference. |
| Can a Component have both a pending removal and a pending plan-downgrade affecting it? | **Yes.** These are two independent pending events on two different objects (the Component's own pending removal, and the Subscription-level scheduled plan change) — both execute together at the same renewal, exactly as already specified in §4.3's overlap discussion. |

### Object 3 — Invoice

**States:** `DRAFT` → `PENDING_PAYMENT` → `PAID`, or `DRAFT` → `PENDING_PAYMENT` → `FAILED`.

**✅ Decided — `FAILED` can become `PAID`, and this is important, not incidental.** A retry updates
the *same* invoice; it never creates a new one. Concretely: `PENDING_PAYMENT → FAILED → FAILED →
FAILED → PAID` is a single invoice's entire lifecycle across three failed attempts and one eventual
success — one accounting document, many payment attempts recorded against it (Object 7, below).
This is the direct, object-level expression of Law 3 (invoices are immutable in *content*, but their
*payment status* is exactly the one field allowed to keep evolving until it resolves) and of the
Commercial Event model's existing rule that `RETRY` never produces a new invoice (§3.7).

### Object 4 — Coupon

*(Audited against the real, implemented model — `backend/models/Coupon.js`, `utils/discountEngine.js`,
`couponController.js` — per the methodological correction below, not an invented state machine.)*

**Real fields, not an invented enum:** `isActive` (a Boolean enable/disable switch) and
`validity.startDate`/`validity.expiryDate` are **two independent mechanisms**, both checked at the
moment eligibility is evaluated (`discountEngine.evaluateOrderEligibility`) — there is no single
"Coupon status" field. A not-yet-started coupon (`startDate` in the future) and an expired one
(past `expiryDate`) are both derived at evaluation time from the dates, exactly like the "no
special enum for scheduled-vs-expired" pattern already used for `Reward` below.

| Question | Answer |
|---|---|
| Is `isActive` the same thing as expired? | **No — confirmed independent, exactly as C1/C2 already assumed.** Disabling a coupon (`isActive: false`) and a coupon expiring (`validity.expiryDate` passing) are two separate checks; this directly confirms C1 and C2 (Chapter 9) were not just reasonable design choices but already match the real, live implementation. |
| Can a disabled coupon be deleted outright? | **No — a soft-archive, not a deletion, once it has real redemption history.** `deleteCoupon` renames the coupon's code with an `-ARCHIVED-<timestamp>` suffix and force-disables it rather than removing the record — the same "never delete, only supersede" spirit as Law 3, applied to a different object. |
| Do all four documented duration types (`lifetime`, `first_payment`, `fixed_cycles`,
`until_cancelled`) actually work today? | **🟨 Confirmed gap, not a new one — cross-references the
already-recorded gap in §3.6a.** The schema declares `first_payment` and `fixed_cycles` as valid
enum values, but coupon creation currently **rejects** both at validation time — only `lifetime`
and `until_cancelled` (and `until_date`) are actually creatable today. §3.6a already flagged that
"the live UI currently only exposes Lifetime/Until-cancelled" as a known gap between the full
specification and the current implementation; this audit confirms the same gap exists at the
schema/validation layer, not just the UI. Not a new finding — recorded here to close the loop
between the two mentions. |

### Object 5 — Referral & Reward (three real objects, not one invented "Referral Reward")

*(Audited against the real, implemented model — `backend/models/Referral.js`, `Reward.js`,
`RewardUsage.js`, `utils/referralRewards.js` — per the methodological correction below.)* **The real
system is three distinct objects working together, not the single generic lifecycle this chapter
originally sketched:**

**Referral** — the invite/intent record. States: `pending → qualified` (set the moment the referred
organization completes its first payment, via `maybeQualifyReferral`), or a declared but unused
`expired` value.
- **🟨 Flagged gap, not resolved here — a genuine open business question, not an implementation
  bug.** No code path anywhere ever sets a Referral to `expired`. A referral that's never qualified
  (the invited organization simply never pays) sits as `pending` indefinitely today. This surfaces a
  real, undecided business question this document has not yet answered: **should a stale,
  never-qualified referral invite eventually be marked `expired` for reporting/cleanup purposes, or
  is "pending forever" the intended, acceptable behavior?** Not deciding this unilaterally — it's a
  reporting/data-hygiene question (🟨), not a money question, but it is genuinely open, not just an
  oversight to quietly patch.

**Reward** — the actual granted reward. **Deliberately immutable once created** (no `status` field
at all, by design) — only `revokedAt` is ever written afterward, matching Law 3's immutability
principle generalized to a second object beyond invoices. `source` has six declared values
(`REFERRAL`, `MANUAL`, `PARTNER`, `LOYALTY`, `SUPER_ADMIN`, `PROMOTION`); only `REFERRAL` and
`MANUAL` are ever actually created by any code path today.
- **🟩 Not a gap — confirms an already-made decision.** `LOYALTY` and `PROMOTION` being unused is
  fully consistent with §3.6's already-recorded decision that wallet/loyalty/promotional credit
  engines are explicitly out of scope — these enum values are simply headroom for a feature that was
  deliberately not built, not a missed wiring. `PARTNER` and `SUPER_ADMIN` being unused today is
  likewise not a defect — `MANUAL` already covers "an admin can issue an ad hoc credit" (§3.3's
  line-item taxonomy); no decision currently requires a separate `SUPER_ADMIN`-sourced reward type.

**RewardUsage** — the reservation lifecycle attached to a specific invoice attempt. States:
`reserved → consumed` (on payment success, via an atomic conditional update) or `reserved →
released` (on failure, or via a time-to-live sweep).
- **✅ This is not a new finding — it's live, working confirmation of R2 (Chapter 9).** R2's decision
  ("a referral reward is reserved, not consumed, until the invoice is actually paid") is not just a
  specification choice — it is exactly what the real `RewardUsage` state machine already does,
  enforced by a partial unique index guaranteeing at most one live reservation per reward at a time.
- **🟨 Flagged gap — no distinct `expired` value; TTL expiry and manual release are
  indistinguishable in the stored state.** Both a reservation that failed outright and one that
  simply timed out land in the same `released` value, distinguished (if at all) only by comparing
  `releasedAt` against `expiresAt` after the fact. Additionally, the time-to-live sweep only runs
  inline, immediately before a *new* reservation attempt on the *same* reward — the always-running,
  independent cleanup job originally planned for this was never built. **This is not a
  money-correctness gap** (the partial unique index already prevents any reward from being
  double-reserved, and the inline sweep self-heals the moment that reward is used again) — it is a
  **reporting/visibility gap**: a stale reservation can sit as `reserved` indefinitely if that
  specific reward is never attempted again, which would make it look unavailable in any report or
  UI that reads raw status rather than comparing against `expiresAt` itself. Recommended
  classification: 🟨, worth a dedicated cleanup pass, not a 🟥 blocking issue.

**A smaller, unverified item, noted rather than asserted as fact:** `ReferralCode.isActive` (a
per-code enable/disable flag) appears to have an issuance path but no confirmed deactivation path in
the files reviewed — recorded as "needs verification," not claimed as a confirmed gap, since the
audit did not exhaustively review every admin controller path.

### Object 6 — Mandate

**States:** `NOT_CREATED` → `PENDING` → `ACTIVE` → `REVOKED`, or `ACTIVE` → `EXPIRED`.

**Can `REVOKED` become `ACTIVE`?** **No.** A revoked or expired mandate requires a brand-new
Acquire-Mandate flow (`CAW_BILLING_DESIGN.md` §6) — there is no "reactivate the old one" path. Note:
this document's earlier mandate-state description (`CAW_BILLING_DESIGN.md` §7, `mandateStatus`:
`none|pending|confirmed|paused|cancelled|rejected`) is the authoritative, already-implemented state
set; the `NOT_CREATED/PENDING/ACTIVE/REVOKED/EXPIRED` naming above is this audit's shorthand for the
same underlying lifecycle (`none`≈`NOT_CREATED`, `confirmed`≈`ACTIVE`, `cancelled`/`rejected`≈
`REVOKED`) and does not introduce a second, competing state machine — the two are one and the same;
only the plain-English labels differ between the tactical design doc and this audit's phrasing.

### Object 7 — Payment Attempt

**States:** `CREATED` → `PROCESSING` → `SUCCESS`, or `CREATED` → `PROCESSING` → `FAILED`.

**Never reused.** Every retry against an Invoice (Object 3) creates its own new Payment Attempt —
an Invoice can accumulate many Payment Attempts over its lifetime, but a Payment Attempt itself
never gets "tried again" in place; a second try is definitionally a second, brand-new Payment
Attempt record pointed at the same still-unpaid Invoice.

### 🟥 Critical finding — Scheduled Changes are one object, not four

**The gap.** Chapters 3.2–4.3 describe downgrades, cancellations, add-on removals, and quantity
reductions as if each were its own bespoke pending mechanism. They are not — they are four
*instances* of exactly one underlying domain concept that this document had not yet named:

```
ScheduledChange
  id
  type          (DOWNGRADE | CANCEL | REMOVE_ADDON | REDUCE_QUANTITY)
  effectiveDate
  status        (PENDING | EXECUTED | CANCELLED)
  payload       (whatever the specific type needs — target plan, add-on id, quantity delta, etc.)
```

**Why this matters enough to be a 🟥 finding, not a 🟩 tidy-up.** This does not change a single
business rule already decided in this document — every existing decision about scheduling,
replacement (Ledger Rules L1–L4), and atomic renewal-day execution stays exactly as specified. What
changes is that the **Renewal Engine, the Scheduler, the UI, the audit log, and the notification
system all now consume one abstraction instead of four separate ones** — the Renewal Engine's job
becomes exactly "give me every `ScheduledChange` with `effectiveDate <= today AND status = PENDING`,
execute them as a set, mark each `EXECUTED`" — a single, uniform query and a single uniform
execution loop, regardless of which of the four types is involved. This is the same class of
simplification the Commercial Event abstraction (§3.7) already produced for invoicing, applied here
to scheduling — recorded as a 🟥 finding specifically because it changes what several engines and
the UI are built against, even though it changes no customer-facing behavior.

### 🟥 Critical finding — a subscription may have at most one collectible invoice at a time

**The scenario that surfaced this.** A renewal invoice is generated and fails to collect
(`past_due`). While a retry is still pending against that invoice, the customer initiates a new
commercial action — an upgrade, an added add-on, or cancelling a scheduled downgrade. What happens
to the original, still-unpaid invoice?

**Two options were weighed:**
- **(A) Keep retrying the original invoice; apply the customer's new request only after it's
  eventually paid.** Rejected — this produces bad UX (the customer wanted to pay for Business, but
  is first asked to pay off Growth, then immediately handed a second invoice for the upgrade) and
  leaves two commercial intentions half-tangled together.
- **(B) ✅ Decided — the customer's new commercial action immediately voids the old, unpaid invoice
  and replaces it with a new one that represents their full, current position.** Flow:
  `Invoice A (past_due) → customer upgrades → Invoice A → VOID → Invoice B generated → Invoice B
  paid → everything commits together`. `VOID` is a fourth invoice-status value alongside `DRAFT` /
  `PENDING_PAYMENT` / `PAID` / `FAILED` (Object 3) — an invoice is **never deleted or edited**, only
  ever moved to `VOID`, preserving the audit trail exactly as Law 3 requires.

**The generalized law this produces (recorded as an addition to Chapter 8's Ten Laws — call it Law
11, not a replacement for any existing law):** **A subscription can never have more than one
collectible invoice outstanding at a time.** Whenever a new commercial action would require pricing
a different position, the previous unpaid invoice becomes `VOID` (not deleted, not edited), and the
new invoice becomes the sole payable one. This one invariant simplifies retries, the payment UI,
reminder emails, Support's job, and accounting simultaneously — there is never a question of "which
invoice does this payment apply to," because there is only ever one candidate.

**A dependent question this raises, and its resolution:** should the replacement invoice (Invoice
B) silently forget the amount already owed from the voided one? **✅ Decided — no.** The customer
still owes what they owed; the new invoice must represent their *full* current commercial position,
not just the delta of the newest action. Concretely, Invoice B's line items include both the
previously-outstanding renewal amount and the new action's own charge (e.g. `Outstanding Renewal
₹450 | Upgrade Difference ₹200 | GST | Total`) — or, equivalently, the pricing engine may compute
the customer's whole new commercial position in one pass and produce a single invoice that already
reflects it fully. Either implementation is acceptable; the invariant that must hold either way is
that **no previously-owed amount is ever silently dropped when an old invoice is voided** — Invoice
B always represents the complete truth of what's owed, not just what's new.

### A methodological correction, recorded rather than silently applied

**An earlier draft of this chapter proposed generic, invented state machines for Coupon and
Referral Reward** (`SCHEDULED → ACTIVE → EXPIRED`, `GRANTED → RESERVED → CONSUMED`, etc.) built for
the purpose of this audit, without first checking what the actual, already-implemented models look
like. **This was flagged and corrected before being recorded as policy:** Coupon and Referral Reward
already have real, working implementations (`RewardUsage`, `referralRewards.js`'s reservation
lifecycle, the Coupon/discount models) built and proven earlier in this project (Phase 1–3 of the
referral system, per the project's own task history). Auditing against an invented parallel
abstraction risks producing "improvements" that would need to be reconciled against the real system
later, rather than verifying the real system directly. **The corrected method, applied to Objects 4
and 5 above and to any future object in this chapter:** take the actual states from the real,
current model; check every real transition for legality; look for transitions that are genuinely
missing or unreachable in the real code; recommend an addition only where a real gap is found — never
invent a competing lifecycle for something that already has one.

---

## Chapter 11 — Phase 2C: Scheduler Integrity Audit

**Purpose and method.** Under Charge-at-Will, almost everything eventually becomes "something that
should happen at a later time" — renewals, retries, suspensions, expiries. This chapter audits every
scheduled job in the system with one governing principle held over every finding: **cron must stay
the dumbest possible layer.** Its only legitimate question, ever, is *"what needs attention right
now?"* — never *"what should happen as a result."* Chapter 7 (Scheduler Matrix) already established
this at a high level ("cron is a dispatcher, never decides business logic"); this chapter re-derives
each real scheduled job from that principle and checks whether it actually needs to exist at all.

### Scheduler Job 1 — Renewal

Runs on a regular interval; finds every `BillableItem`/component due today; for each affected
organization, calls the Renewal Engine. Nothing more — matches Chapter 7's existing Renewal
Scheduler row exactly; re-confirmed here, not a new finding.

### Scheduler Job 2 — Retry

Finds every subscription in `PAST_DUE` whose next retry time has arrived; calls the Retry Engine.
Matches Chapter 7's existing Retry Scheduler row; re-confirmed, not new.

### Scheduler Job 3 — Suspension

Finds every subscription whose grace period has expired; marks it `SUSPENDED`. **No invoice
generation, no pricing happens here** — this job only ever writes the one lifecycle-state
transition it's responsible for (Object 1, Chapter 10), nothing else.

### 🟥 Scheduler Job 4 — Scheduled Commercial Changes: this scheduler should not exist

**✅ Decided — no separate scheduler is needed for `ScheduledChange` execution, and one entire
previously-assumed cron disappears as a result.** The reasoning: a `ScheduledChange` (Chapter 10's
unified object for downgrades, cancellations, add-on removals, and quantity reductions) only ever
executes as part of a *successful* renewal — the Renewal Engine already collects every
`ScheduledChange` due today and applies it as part of its own commit step (§3.5 R13, and Chapter
10's `ScheduledChange` finding). A dedicated "apply scheduled changes" scheduler would just be
duplicating exactly what the Renewal Scheduler (Job 1) already triggers, one layer removed — so it
is correctly *absent*, not merely unbuilt.

### Scheduler Jobs 5 & 6 — Coupon Expiry and Referral Expiry: also should not exist

**✅ Decided — neither coupon nor referral expiry needs a scheduled job, because expiry is a derived
fact, never a stored transition.** `today > expiryDate` is simply evaluated at the moment eligibility
is checked (exactly as Object 4/Object 5 in Chapter 10 already confirmed the real, implemented
Coupon and Reward models actually work) — there is nothing for a cron job to write, because nothing
needs to be written. An expired coupon or reward doesn't need to be marked expired in advance; it
simply evaluates as ineligible the next time anything asks.

### Scheduler Job 7 — Mandate Monitoring

**✅ Decided — this one genuinely needs active monitoring, unlike Jobs 4–6 above.** A customer can
revoke their mandate directly with their bank at any time (`BILLING_SYSTEM_EXPLAINED.md` Part 9's
bank-side cancellation scenario), and we should not be limited to discovering this only when the
next renewal already fails. **Preferred mechanism: real-time webhook events from Razorpay** for
mandate state changes, wherever Razorpay provides them; **periodic reconciliation as the fallback**
for anything a webhook doesn't cover or might have missed — the same "trust the webhook, reconcile
as a safety net, never as the primary mechanism" pattern already proven live elsewhere in this
project (`reconcileMandate`, `CAW_BILLING_DESIGN.md` §7a).

### 🟥 The big finding: capability-specific crons (Upgrade Cron, Downgrade Cron, Add-on Cron) do not exist under this architecture, and should not be reintroduced

**Why this is worth recording explicitly, not just implied by the jobs above.** An earlier,
pre-Charge-at-Will mental model assumed each commercial capability might need its own scheduled job
— an "Upgrade Cron," a "Downgrade Cron," an "Add-on Cron." **None of these exist, or should ever
exist, under the current architecture.** Every one of them collapses into the same single path:

```
Renewal Engine
    ↓
Apply Scheduled Changes (Chapter 10's unified ScheduledChange object)
    ↓
Invoice
    ↓
Charge
    ↓
Commit
```

This is the scheduling-layer expression of the same consolidation Chapter 10 already produced for
the *data model* (one `ScheduledChange` object instead of four) and Chapter 9 already produced for
*invoicing* (the Commercial Event model) — the same underlying discipline applied a third time, at
a third layer of the system. Recording this explicitly matters because it forecloses a specific,
plausible-sounding future mistake: a future contributor adding a new capability (say, a new kind of
scheduled quantity change) should reach for "does this fit into the existing `ScheduledChange` type
enum and the existing Renewal Engine path," never "what new cron job does this need."

### Notification Events — an explicit non-negotiable boundary

**✅ Decided — notifications only ever react to billing facts; they never decide or influence
them.** Every notification (Chapter on customer communication, `BILLING_SYSTEM_EXPLAINED.md` Part
16) is purely an observer of something that already happened: `Payment Success → Invoice Paid
Email`, `Payment Failed → Retry Reminder`, `Suspended → Account Suspended Email`, `Coupon Expiring
→ Reminder`. This restates and sharpens N3 (Chapter 9) — an email's own delivery success or
failure must never roll back, delay, or gate a commercial event — into the general, forward-looking
rule that notifications sit strictly downstream of billing, never upstream or inline with it. No
future notification feature should ever be given the ability to block, retry, or alter a commercial
decision.

### 🟥 An explicit business-level Ownership Matrix — who may write to what

**⚠️ Superseded by Chapter 20 (The Definitive Ownership Matrix)** — kept here as a historical record;
Chapter 20 is the current, single authoritative source.

**Why this needs its own explicit statement, beyond Chapter 6's existing (more abstract) Ownership
Matrix.** Chapter 6 already establishes, at the engine level, that no two engines may write the same
fact. This section makes the same discipline concrete and enforceable at the level of "which actual
flow is allowed to touch which object" — the two are the same principle, restated at a level
specific enough that a future code review can check a diff against it directly.

| Object | May be modified by | Explicitly NOT modified by |
|---|---|---|
| **Subscription** | Registration Flow (creation); Renewal Engine (after a successful payment); Commercial Change Engine (after a successful payment); Retry Recovery (on a successful retry); Suspension Engine (grace-period expiry only); Cancellation Execution (at the scheduled renewal) | Any other API endpoint, directly. If a new endpoint ever needs to change subscription state, it must go through one of the flows above, never write the field itself. |
| **Invoice** | Registration Flow; Commercial Change Engine; Renewal Engine; Retry Replacement (Chapter 10's `VOID`-and-replace mechanism, where applicable) | Never edited after creation, by anything, under any circumstance (Law 3) — a correction is always a new invoice plus voiding the old one, never an in-place edit. |
| **ScheduledChange** | Created by: Downgrade, Remove Add-on, Reduce Quantity, and Cancellation requests. Removed (transitioned to `CANCELLED`, never deleted) by: the user explicitly cancelling it, or the Renewal Engine successfully executing it (→ `EXECUTED`) | No engine other than the Renewal Engine may transition a `ScheduledChange` to `EXECUTED`. |
| **Coupon Usage (redemption)** | Only the Invoice Engine, at the moment it actually builds an invoice | Never Checkout directly, never a Razorpay callback directly — both of those may only trigger the Invoice Engine, never write a redemption themselves. This is Coupon Redemption's one-owner rule, made explicit. |
| **Referral Reward (`RewardUsage`)** | Reservation: only the Invoice Engine, when pricing an invoice that uses it. Consumption: only on confirmed successful payment. | Nothing else may reserve or consume a `RewardUsage` record — this is exactly what the real, already-implemented `referralRewards.js` reservation lifecycle (Chapter 10, Object 5) already enforces; recorded here as the general rule that implementation is a specific instance of. |

### 🟥 Resolved — a Past-Due subscription that pays via a replacement invoice returns to ACTIVE immediately, without waiting for another renewal pass

**The scenario.** `ACTIVE → renewal fails → PAST_DUE`. While in `PAST_DUE`, the customer initiates
an upgrade; per Chapter 10's Law 11, the original unpaid invoice is voided and replaced by one that
represents the customer's full current position (outstanding renewal amount plus the new upgrade);
that replacement invoice is paid successfully.

**✅ Decided — the subscription returns to `ACTIVE` immediately, in the same commit, not on the next
scheduler pass.** The replacement invoice has already settled everything that was outstanding — the
old renewal amount and the new upgrade both — so there is no remaining reason to make the customer
wait for a separate renewal cycle to run before their access is restored. The moment that payment
succeeds, every fact the system needs to restore the subscription and commit the new commercial
state is already in hand; deferring the `PAST_DUE → ACTIVE` transition to a later scheduler run
would just be an artificial delay with no correctness benefit. This is the last open interaction
between the Scheduler, Retry, and Commercial Change flows — with it settled, the object- and
schedule-level integrity audit (Phases 2B and 2C) is substantively complete; anything left is
data-ownership bookkeeping (largely already captured in the Ownership Matrix above) rather than a
new architectural question.

---

## Chapter 12 — Phase 2D: Policy Closures and the Downgrade Eligibility Model

**Purpose.** Phases 2A–2C produced a working list of genuinely open items. This chapter closes
several of them with real, confirmed business decisions (some newly made, some that had already
been decided in conversation but not yet written into this document), and introduces one
substantial new domain concept that Phase 2A/2B did not anticipate: **Downgrade Eligibility
Validation.** It also flags one newly-surfaced question that conflicts with something already
decided elsewhere in this document, rather than silently resolving it.

### ✅ Closed — Trial Policy

**Confirmed against the real, already-built product** (Super Admin subscription screen, observed
directly): a trial is not a separate, undecided concept — it already has working behavior.
- **A trial cannot be started while a paid subscription is live.** The real Super Admin UI enforces
  this directly: *"Trial Actions Unavailable — Live Paid Subscription... Cancel the subscription
  first and wait for it to take effect... only then will starting a trial become available."*
- ❌ **SUPERSEDED — see the resolution immediately below.** ~~Once a subscription becomes
  `CANCELLED` or `SUSPENDED`, a trial may be started again for that organization.~~ This sentence
  quietly contradicted Chapter 10's own state machine: `SUSPENDED` is explicitly non-terminal there
  (only `CANCELLED` is), so pairing it with `CANCELLED` here as if both freely allow a new
  Subscription was never actually resolved — it just wasn't noticed until the BUG-002 partial-index
  work forced the question of what "current" means to be answered precisely.

**✅ Decided — resolving the `SUSPENDED`/"trial may restart" tension identified during the BUG-002
partial-index work.** A suspended subscription has not ended — the whole point of the
commercial-state/access-state independence principle (Chapter 2, Chapter 10) is that `SUSPENDED` is
an access-state condition layered on top of an otherwise-still-current commercial contract, not a
terminal outcome. So a suspended subscription cannot simply coexist un-transitioned alongside a
brand-new one; that would leave two non-cancelled Subscription documents on file for the same
organization, with no single answer to "which one is current."

**The transition is made explicit, not an implicit side effect:** the moment a new trial or paid
Subscription is created for an organization that has a `SUSPENDED` Subscription on file, that
`SUSPENDED` subscription is first transitioned to `CANCELLED` — as its own real, auditable state
transition (own `appStatusHistory` entry, own `BillingEvent`), not silently overwritten or bypassed.
By the time the new Subscription document is actually inserted, no `SUSPENDED` Subscription remains
for that organization — only `CANCELLED` (terminal) and the one new, current record. This is why the
sentence above reads as contradictory once stated plainly: by design, a customer is never actually
looking at a live choice between "restart from `CANCELLED`" versus "restart from `SUSPENDED`" — the
system collapses the second case into the first before the new record ever exists.

**Ownership of this transition (Chapter 20 Engine Ownership Matrix, Subscription row):** this is not
Renewal Engine, Retry Engine, or Commercial Change Engine territory — it is a precondition of
*creating* a new Subscription, so it belongs to the **Registration Engine**, executed immediately
before the new Subscription document is inserted. No other engine may write `SUSPENDED → CANCELLED`
outside of this specific precondition or the normal Chapter 4.2 cancellation flow.

**Governance note, recorded honestly rather than smoothed over:** unlike BUG-031 (Change Proposal
V1.1-001 — raised, discussed, explicitly adopted, then written back into the spec), this
`SUSPENDED`/trial-restart resolution was decided and written directly into this frozen specification
in the same pass it was discovered, without a separate proposal-and-review step. The technical
resolution itself isn't in question, but on a team with multiple stakeholders this is exactly the
kind of change that should go through the same Version 1.1 proposal process as BUG-031 before being
treated as adopted — this note exists so a future reader can tell the difference between "reviewed
and adopted" and "decided in the moment," rather than assuming every entry in this document went
through identical scrutiny.

**Practical scope of this decision — narrower than it might first appear:** this only affects
"find the current subscription for this org" lookups (`findOne({organization})`-style calls) and the
BUG-002 partial unique index itself. It does **not** touch renewal eligibility (Chapter 3.5 R2 already
gates renewal by a specific document's own `appStatus`, never by "is this possibly one of two
non-cancelled Subscriptions") and does not touch `ScheduledChange`/`Invoice` ownership (both already
reference a specific `subscription` ObjectId, never "whichever one is current for the org").

**Resulting partial unique index (BUG-002, `Subscription.organization`) — now fully spec-derived, not
improvised:**
```js
Subscription.schema.index(
  { organization: 1 },
  { unique: true, partialFilterExpression: { appStatus: { $in: ['trial', 'active', 'past_due'] } } }
);
```
`suspended` is deliberately **excluded** from this list — not because it is terminal in the general
state-machine sense (it is not), but because this specific decision guarantees no `SUSPENDED`
Subscription is ever still on file at the moment a second one would be created. If that guarantee
were ever relaxed, this index would need to change with it.
- **Super Admin has direct control over trials**: starting one, adjusting/extending its duration,
  and (implicitly, via the same controls) ending one early.
- **Trial duration is a configurable policy value** (Chapter 3.4, Policy Engine), never hardcoded.

This closes the trial-policy gap that was flagged as open throughout Phase 2A/2B and in
`BILLING_SYSTEM_EXPLAINED.md` — remove those "open" markers; the answer was already built and
simply hadn't been written back into this specification yet.

### ✅ Closed — Refund Policy

**No refunds, under any circumstance.** No partial refunds, no goodwill refunds, no billing-error
refund flow. This is now the confirmed, deliberate policy — not an absence of one. It removes an
entire category of capability (refund processing, refund authorization, refund line items) from
anything that needs building; the `Refund` row in Chapter 4's capability table and the "Refund
credit" line item named as "not yet specified in detail" (§3.3) are both closed by this: there is
no refund capability to specify, by design.

### ✅ Closed — Price-Change Grandfathering (needs no new architecture)

**No new mechanism is needed here — Law 8 and Law 3 (Chapter 8) already fully cover this.** The
earlier open question ("does an existing customer keep their old price when admin changes a plan's
price?") does not require a versioning system, a grandfathering flag, or any new data model. Law 8
already establishes that whatever price is configured *at the moment an invoice is generated* is
what that invoice charges, and Law 3 already guarantees every past invoice stays exactly as it was
charged, forever, regardless of any later price change. Whether the business chooses, operationally,
to manually exempt a specific organization from a price increase is a business/admin decision made
at the time it happens — it is not something the architecture needs to anticipate or automate in
advance. Price changes are rare enough, and both possible outcomes explainable enough, that building
dedicated machinery for this would be exactly the kind of premature engineering this project has
repeatedly rejected elsewhere (the generic Credit Engine, the Billing Bucket model, and Law 8's own
rejected "versioned prices" proposal).

### ✅ Closed — Reactivation After a Long Suspension

**The previously-flagged "biggest open question in the system" is now resolved with a clean
two-branch rule,** consistent with Object 6's Mandate audit (Chapter 10):
- **If the customer's mandate is still valid:** they pay whatever is currently outstanding (or a
  fresh invoice representing their current position, per Law 11), and the subscription returns to
  `ACTIVE` — no separate re-authorization step needed.
- **If the mandate has expired or been revoked in the meantime:** a new mandate must be acquired
  first (the ordinary Acquire-Mandate flow, `CAW_BILLING_DESIGN.md` §6), and only once that succeeds
  does the outstanding amount get collected and the subscription return to `ACTIVE`.

This removes the "genuinely unresolved" marker previously attached to this question throughout
Phase 2B and `BILLING_SYSTEM_EXPLAINED.md` Part 9/15.

---

### 🟥 A major new domain concept — Downgrade Eligibility Validation (the Usage Compatibility Rule)

**Why this is a new chapter-worthy concept, not just a refinement of existing add-on
carry-forward logic.** §3.2 already specifies that compatible add-ons require an explicit
carry-forward choice at plan-change time, and that incompatible add-ons are auto-scheduled for
removal. What was missing is a check on the *other* side of the equation: even after carry-forward
choices are made, does the organization's **actual current usage** of every limited resource still
fit inside the destination plan? This had never been asked before this audit, and the answer
introduces a genuinely new mechanism — an eligibility check that must pass *before* a downgrade may
even be scheduled, not just before it's allowed to execute at renewal.

**✅ Decided — the governing rule:**
> A customer cannot successfully schedule a downgrade to a plan unless every limited resource the
> organization actually uses fits within that destination plan's limits, after applying whichever
> compatible add-ons the customer chooses to carry forward.

**⭐ The precise principle this rule rests on, made explicit — plans define included capacity, not
maximum capacity; compatible add-ons may extend that capacity as far as the customer needs.** A
destination plan's own included limit is a *starting* entitlement, never a hard ceiling — a customer
is never blocked from downgrading merely because the destination plan's included amount, by itself,
is smaller than what they currently use. **Worked example:** a Business-plan organization has 4
included seats plus a 6-seat add-on (10 total, actually used). They downgrade to Growth, which
includes only 2 seats. This is perfectly fine, provided they carry forward enough of their existing
seat add-on to cover the gap — e.g. carrying forward 8 seats of add-on brings their Growth entitlement
to `2 + 8 = 10`, exactly matching their current usage. **The downgrade is only ever blocked when,
even after every available compatible add-on is carried forward to its fullest extent, actual usage
still exceeds what the destination plan (base + add-ons) can support at all** — for example, 2,000,000
CRM records against a destination plan whose maximum possible capacity (base plus every compatible
add-on) tops out at 1,000,000; no combination of carry-forward choices can ever close that gap, so
that downgrade cannot be scheduled at all, regardless of which add-ons are chosen.

**✅ Decided — never silently delete or lock customer data to force compliance.** The customer is
always the one who resolves the mismatch, by their own action (removing seats, deleting records,
etc.) — the system never deletes data on their behalf, and the downgrade is simply **blocked, not
scheduled,** until they've done so. This is a stricter and, deliberately, better guarantee than the
common industry pattern (Slack/Notion/Atlassian-style "let them over-limit and lock new creation")
— those products let a customer *enter* an over-limit state and then restrict what they can do next;
this system instead prevents the downgrade from ever being scheduled in the first place if it would
produce an impossible state, so a customer is never surprised by a downgrade that silently changes
what they can access.

**The full validation sequence, replacing the simpler carry-forward-only flow in §3.2 for any plan
change that is a downgrade:**

```
Choose destination plan
    ↓
Determine which currently-owned add-ons are compatible with the destination plan
    ↓
Customer explicitly chooses which compatible add-ons to carry forward (§3.2, unchanged)
    ↓
Calculate destination limits = plan-included amount + carried-forward add-on amount,
    for every limited resource
    ↓
Compare actual current usage against those calculated limits, resource by resource
    ↓
If every resource fits  →  Downgrade may be scheduled (§3.2's existing rules apply from here)
If any resource does not fit  →  Downgrade is blocked; an itemized checklist is shown
    (see below) — the customer resolves it themselves, then retries
```

**Worked example.** A Business-plan organization has 4 included seats plus one purchased extra
seat (5 total), and is actually using all 5. They schedule a downgrade to Growth, which includes 2
seats. They're asked whether to carry forward their extra seat; they say yes. Destination limit
becomes `2 + 1 = 3` seats. Current usage (5) still exceeds that (3) — **the downgrade is blocked**,
and the customer is told exactly what to fix: *"Please remove 2 users before this downgrade can be
scheduled."* Once they remove two users (5 → 4 → 3), usage now equals the limit, and the downgrade
becomes schedulable.

**✅ Decided — the rejection must be an itemized checklist, not a single generic error.** Rather than
a flat "downgrade blocked" message, the customer sees exactly which resources are the problem and
which are already fine, for example:
```
Cannot downgrade yet.
  [X] Remove 2 users
  [X] Reduce storage by 1.8 GB
  [OK] Pipelines are within limit
  [X] Remove 3 forms
```
This is a deliberate product decision (matching this specification's existing "full transparency,
nothing hidden" invoice principle, §4.1) — a customer should always know exactly what they need to
do, in full, before attempting the downgrade again, never discover a second blocking reason only
after fixing the first one.

**✅ Decided — the rule is generic across every limited resource, not special-cased per resource
type.** The same algorithm applies uniformly:
```
for every limited resource on the destination plan:
    allowed = plan-included amount + carried-forward add-on amount (if any)
    if actual current usage > allowed:
        downgrade cannot proceed; add this resource to the rejection checklist
```
This is deliberately implemented as **one algorithm evaluated against a list of resources**, never
as resource-specific branching logic (`if seats... if storage... if forms...`) — the same
discipline this specification has applied elsewhere (the `ScheduledChange` unification, Chapter 10;
the Commercial Event model, §3.7) applied here to eligibility checking. Any future limited resource
plugs into the existing algorithm with zero new logic, only a new entry in the resource list.

**Current and near-term scope, stated honestly.** As of this writing, **Seats is the only fully
modeled add-on/limited resource** in the system. **Storage (cloud storage space) and Forms are
explicitly planned to become limited, add-on-eligible resources soon** — this rule is written to
already accommodate them (and any future resource: pipelines, email templates, CRM records) without
needing a redesign when they arrive; only their specific "current usage" and "plan-included amount"
need to be wired into the same generic algorithm above.

**What this changes about §3.2's existing carry-forward flow.** Nothing about the carry-forward
*choice* itself changes — it is still the customer's explicit decision, per add-on, exactly as
already specified. What's added is a **mandatory validation gate immediately after that choice**,
before the downgrade is accepted as a `ScheduledChange` (Chapter 10) at all — a downgrade request
that fails this validation is rejected at request time, the same way an invalid request is rejected
at D1 (§3.2's Change Decision Engine, Validate stage), not silently accepted and only discovered as
a problem later at renewal.

### ✅ Confirmed — a second scheduled downgrade replaces the destination, never stacks as a second pending change

**This is not a new decision — it is Rule 1 (§3.2) and Ledger Rule L1, confirmed once more in
concrete plan-change terms and worth stating on its own because it's easy to mistake for the
add-on pattern, which behaves differently on purpose.** A customer with `Business → Growth`
already scheduled who then schedules `Business → Starter` instead does not end up with two pending
plan changes chained together — there is only ever **one** pending plan change at a time, and the
newer request simply replaces its destination: the scheduled future state becomes `Starter`
directly, not `Business → Growth → Starter`. This is structurally necessary, not just a
convenience — a subscription cannot simultaneously be scheduled to become two different plans, so
there is nothing to "coexist."

**Contrast with add-ons, where the opposite rule deliberately applies — both are correct, for
different reasons, and this document's full, consolidated position is:**
- **Plan changes replace.** Only one plan exists; only one future plan can be scheduled at a time
  (L1).
- **Add-on changes coexist**, even multiple ones targeting the *same* add-on (§4.3's quantity
  walkthrough, and the corrected Ledger Rule L3/§18) — because each represents its own genuine,
  separate customer decision (remove 2 seats, then separately remove 1 more), and none of them
  contradicts the others simply by being scheduled at the same time.
- **Quantity operations append, unless a later action explicitly targets and replaces the same
  still-pending change** (e.g. editing an already-scheduled "remove 5 seats" down to "remove 3
  seats" updates that one record, rather than creating a second one for the same request).
- **Cancellation supersedes everything** — a pending cancellation short-circuits the entire renewal
  pipeline and takes precedence over any other pending plan or add-on change (Chapter 9's A9,
  Chapter 16's `Reason: Subscription Cancelled`).

None of this changes anything about the architecture — it confirms that a single, consistent
principle (replace when there is only ever one legitimate final state; coexist when there can
legitimately be several) already explains every one of these cases without a special rule per
capability.

---

### ✅ RESOLVED — Subscription Identity (closes the conflict flagged above and restated in Chapter 16)

**Decided as an explicit architectural decision, not a mechanical inference — this is the resolution,
not another restatement of the tension.** The apparent conflict between "one Subscription per
organization" and "resubscribing is always a fresh subscription" was real, and it existed because two
different relationships were being described with one word. There are actually two distinct
relationships:

1. **Organization → Current Subscription:** exactly one, always (or none, if never subscribed / fully
   cancelled with no successor yet).
2. **Organization → Subscription history:** an organization may accumulate **many** Subscription
   records over its lifetime — one per distinct commercial contract it has ever entered into.

**The four statements this document now locks in as policy:**
1. **An Organization is permanent.** It is the durable entity; it does not begin or end the way a
   commercial contract does.
2. **An Organization may own many Subscription records over its lifetime** — one per past or current
   commercial relationship.
3. **Only one Subscription may be `ACTIVE`/current at any given time** for a given Organization.
4. **Once a Subscription reaches `CANCELLED`, it is immutable and never reactivated** (confirming,
   not contradicting, Chapter 10 Object 1's original finding) — **a future purchase creates an
   entirely new Subscription record**, owning its own Commercial Transactions, Invoices, Billing
   Components, Scheduled Changes, and Mandate, with no crossing between it and any prior Subscription
   the same Organization once had.

**Why this is a correction to how this document had been reasoning, not just a tie-breaker between
two prior statements:** the Subscription was being treated, in places, as *the* permanent container —
Chapter 4.2 and Chapter 10 Object 1 correctly said a cancelled Subscription is never resurrected, but
without a name for what *is* permanent, that correctly-decided rule looked like it clashed with the
equally reasonable desire for one place to see an organization's whole billing history. **The
Organization is the permanent container; the Subscription is a bounded commercial contract that
naturally begins and ends** — a contract ending and a new one starting later was never actually in
tension with "the organization is one continuous entity." Support's question "when did this
customer's relationship with us start" is answered by the Organization; "what exact terms were they
on in March 2026" is answered by whichever Subscription record covers that period.

**This directly and cleanly resolves the previously-parked scenario** (a customer disappears for
months after suspension, then buys again): there is no attempt to revive the old commercial
relationship — a new Subscription is simply created, and the old one remains exactly as it was, a
complete, untouched historical record.

**Nothing else in this document needs to change as a result** — Chapter 4.2's cancellation text and
Chapter 10 Object 1's state machine were correct all along and remain exactly as written; only the
higher-level framing (what "permanent" refers to) needed to be added above them.

---

## Chapter 13 — Phase 2E: Coupon/Referral Model Confirmation & Super Admin Authority Matrix

**Purpose.** Chapter 10 audited the real Coupon/Referral/Reward/RewardUsage models and found a
small number of gaps. This chapter closes those gaps with real decisions, confirms the parts of the
model that need no change at all, and — since the real Super Admin UI has now been reviewed
directly — records an explicit Super Admin Authority Matrix, the same discipline already applied to
every other actor in this system (Chapter 6's Ownership Matrix, Chapter 11's engine-level ownership
table).

### ✅ Confirmed as final — no redesign needed

- **Coupon's `isActive` + `startDate`/`expiryDate` model is confirmed superior to a stored enum**
  (`ACTIVE`/`EXPIRED`/`DISABLED`) and should be kept exactly as built. A derived condition needs no
  scheduler, no extra write, and no synchronization risk between "what the database says" and "what
  is actually true right now" — the same reasoning already used in Chapter 11 to conclude coupon and
  referral expiry never need their own scheduled job.
- **`first_payment` and `fixed_cycles` remaining declared-but-unimplemented duration types is
  intentionally fine** — they are legitimate future-proofing, not a defect to rush into building.
- **`CouponRedemption`'s complete lack of a lifecycle (one immutable row per redemption) is exactly
  right** and needs no change — this is precisely how an accounting record should behave.
- **`Reward`'s immutability (no status field; only `revokedAt` ever changes) is exactly right** and
  needs no change.

### ✅ Decided — Referral's `expired` state is intentionally left unimplemented, not a bug to fix

**Reversing the framing in Chapter 10** (which flagged this as an open gap needing a decision): the
decision is now made, and it's to **leave `expired` unimplemented, unless the business explicitly
requests that referral invitations expire after some period** (e.g. "an unqualified referral expires
after 90 days"). Absent that explicit requirement, **"pending forever" is a perfectly valid,
deliberate business behavior** — a never-qualified referral simply sits as `pending` indefinitely,
and that is fine. This is one fewer state, one fewer scheduled job, and one fewer synchronization
bug to ever worry about. **This decision is conditional, not permanent** — if the business later
does want referral-link expiry, this is the one item in this chapter that would need to be revisited
and would then require real scheduling work (unlike coupon/referral discount expiry, which is
derived — an *invitation* expiring would need to actually close off future qualification, which is a
real state transition, not just a read-time computation).

**A related code-hygiene recommendation (not a business decision, just worth recording so a future
contributor doesn't mistake dead code for broken code):** the unused `expired` value on `Referral`,
and the unused `LOYALTY`/`PROMOTION`/`PARTNER` values on `Reward.source`, should be commented in the
schema as intentionally reserved/unused (e.g. *"reserved for a future product; not currently
wired"*) rather than left silently dead — this is a comment, not new logic.

### ✅ Decided — RewardUsage gains a `releaseReason`, not a new state

**The two-state shape (`reserved → consumed` or `reserved → released`) stays exactly as it is** —
no new state is added. What's added is a **reason code recorded alongside a release**, since
today's model conflates three genuinely different situations under one `released` value:

```
releaseReason: TIMEOUT | PAYMENT_FAILED | ADMIN_RELEASE | REPLACED_BY_NEW_INVOICE
```

`REPLACED_BY_NEW_INVOICE` is a direct consequence of Chapter 10's Law 11 — when a pending invoice is
voided and replaced (a new commercial action arriving mid-retry), any reward reservation attached to
the voided invoice is released for *that* specific reason, distinct from a genuine payment failure
or a passive timeout. This gives Support a real answer to "why is this reward marked released"
instead of one undifferentiated value — a small addition with real Support-facing value, not a
structural change.

### ✅ Decided — RewardUsage needs one standalone cleanup job after all

**This closes the gap Chapter 10 flagged** (the time-to-live sweep only ran inline, immediately
before a new reservation attempt on the *same* reward, with no independent job). **Add one
lightweight, low-frequency job** (daily is sufficient) whose only responsibility is releasing
reservations whose `expiresAt` has already passed. This does not violate Chapter 11's "cron is the
dumbest possible layer" principle — the job makes no decision of its own; it simply invokes the
exact same release logic that already exists (`releaseExpiredReservations`), on a schedule, so a
reward reservation that nobody happens to touch again doesn't sit in `reserved` indefinitely.

### ✅ Super Admin Authority Matrix

**⚠️ Superseded by Chapter 20 (The Definitive Ownership Matrix)** — kept here as a historical record;
Chapter 20 folds this in alongside every other actor's boundaries in one place.

**Reviewed directly against the real Super Admin UI**, this is what Super Admin may and may not do:

| Domain | Super Admin MAY | Super Admin may NOT |
|---|---|---|
| **Coupons** | Create, edit, disable, archive; set per-item discounts, billing-cycle applicability, duration, validity dates, redemption limits, organization allow-list | Force a redemption to occur; restore/undo a past redemption; delete redemption history |
| **Referrals** | Enable/disable the program; set reward percentage/fixed amount, max reward cap, expiry, pending-referral limit, total-referral limit; grant a manual reward; revoke a reward | Fake a qualification (mark a referral qualified without a real first payment); fake a payment; consume a reward on a customer's behalf |
| **Subscription** | (per Chapter 11's Ownership Matrix — unchanged) | Cancel a subscription *immediately*, bypassing the always-scheduled-at-renewal rule (Chapter 4.2); force an upgrade that bypasses payment (violates Law 2); forgive/write off an invoice; manually create an invoice outside the normal Commercial Event pipeline |
| **Mandate** | Trigger **"Request New Mandate"** — sends the customer back through the ordinary Acquire-Mandate authorization flow (`CAW_BILLING_DESIGN.md` §6) | **Directly reset, force-confirm, or otherwise fabricate a mandate's state.** A mandate is an agreement between the customer, their bank, and Razorpay — Admin has no authority to simulate or override any part of that relationship; the only lever Admin has is asking the customer to go through the real authorization flow again. |

**Why "no manual invoice forgiveness/creation/bypass" matters enough to state explicitly:** every one
of those capabilities, if granted, would directly violate an already-locked invariant elsewhere in
this document — forgiving an invoice contradicts Law 1 (money never moves without an invoice) and
Law 3 (invoices are immutable); bypassing payment for a forced upgrade contradicts Law 2 (nothing
commercially changes until payment succeeds). Recording Super Admin's boundaries explicitly here
means a future admin-tooling feature request can be checked against this table the same way a new
customer capability is checked against the Ten Laws (Chapter 8).

### ✅ Confirmed scope boundary — billing asks "is this eligible," product modules define "eligible"

**A closing clarification to Chapter 12's Downgrade Eligibility Validation.** The remaining
uncertainty this audit surfaces — what happens to forms, CRM records, pipelines, storage, or
automations on a downgrade — is **not a billing decision**, and this document does not attempt to
answer it. Chapter 12's generic algorithm (`for every limited resource: allowed = plan-included +
carried-forward add-ons; if usage > allowed, block`) is the entire billing-domain contract. **Each
product module (Forms, Storage, Pipelines, Automations, CRM Records) is responsible for defining its
own "current usage" and "plan-included amount" and plugging into that one generic check** — billing
itself never needs to know *what* a form or a pipeline is, only that some module reports a usage
number and a limit number for it. This is a deliberate, valuable architectural boundary: it confirms
the billing domain is now fully isolated from product-feature specifics, which is exactly the
separation a mature billing system should have.

---

## Chapter 14 — Phase 2F: Coupon Redemption Integrity

**Purpose.** Chapters 10 and 13 confirmed the Coupon *lifecycle* (`isActive` + dates) is already
correct and needs no change. This chapter is about something more consequential than the lifecycle:
**redemption control** — exactly when a coupon's use is allowed to count as "spent" against its
limits. This is where real abuse, fairness, and correctness bugs live, not in whether a coupon is
active.

### ✅ Decided — the Coupon Validation Pipeline (strict order, specific failure reason at each stage)

Every time a customer enters a coupon, the checks run in this order, and each failure returns its
own specific reason (never a generic "coupon invalid"):

```
Coupon Exists?
    ↓
Active? (isActive, per Chapter 10/13)
    ↓
Within Start/Expiry Window? (validity.startDate / validity.expiryDate)
    ↓
Organization Eligible? (global vs. specific-organization allow-list, §3.6a)
    ↓
Billing Cycle Eligible? (monthly/yearly/both, §3.6a)
    ↓
Item Eligible? (does this coupon have a rule for the billable item(s) on this invoice, §3.6a)
    ↓
Global Redemption Limit? (has this coupon hit its total-uses-across-all-customers cap?)
    ↓
Per-Organization Redemption Limit? (has THIS organization hit its own cap for this coupon?)
    ↓
Duration Still Valid? (first invoice / N cycles / lifetime / until cancelled, §3.6a)
    ↓
Apply Discount
```

This is a direct instance of the D1 Validate-stage discipline already established for the Change
Decision Engine (§3.2) — reject early, reject specifically, never let an invalid request travel
further than the first check it fails.

### ⭐ The core invariant — the single highest-value rule in the coupon system

> **A coupon redemption is earned only by a successful commercial payment, and is permanently
> associated with the organization that made that payment. Failed, abandoned, voided, or replaced
> invoices must never consume a redemption.**

Every scenario below is a direct, mechanical consequence of this one sentence — none of them need
their own separate rule once this invariant is locked in.

| Scenario | Resolution |
|---|---|
| Customer enters a coupon, checkout begins, an invoice is generated, then the customer abandons checkout or the payment fails | **No redemption is ever recorded.** Only `Invoice → PAID` creates a `CouponRedemption` (Chapter 10 already confirmed this matches the real code — `recordRedemption()` is only ever called from `runFirstPaymentSettlement`). This closes what would otherwise be a real customer-hostile bug: a customer must never permanently lose a coupon simply because they closed the checkout window or their card was declined once. |
| The same invoice fails, retries, and eventually succeeds (`PENDING → FAILED → FAILED → PAID`, Chapter 10's Object 3 finding) | **Exactly one redemption is recorded, not one per attempt.** It is still the same invoice (Object 3) — a redemption is tied to the invoice being paid, not to how many payment attempts it took to get there. |
| The original invoice is voided and replaced by a new one mid-retry (Chapter 10's Law 11 — e.g. the customer upgrades while `PAST_DUE`) | **No redemption is recorded against the voided invoice; the coupon "moves with" the commercial transaction, and redemption is finalized only if and when the *replacement* invoice is successfully paid.** A coupon is not consumed twice just because the underlying invoice object changed identity mid-flow — it's associated with the customer's actual, eventually-successful payment, never with an abandoned intermediate invoice. |
| A coupon has a duration of "first 3 billing cycles"; the customer schedules a downgrade | **Nothing about the coupon's remaining duration changes.** A scheduled-but-not-yet-executed change has no effect on anything (Chapter 8, Law 6 — only the present can change immediately) — the coupon's cycle count only ever advances when an actual renewal is actually paid, exactly like every other commercial fact in this system. |

### ✅ Decided — redemption identity is the Organization, and only the Organization

**The per-organization redemption limit (§3.6a) is explicitly per-Organization — never per-
Subscription, per-User, per-Mandate, or per-Billing-Cycle.** If an organization uses a coupon once,
that redemption stays permanently attached to the organization's identity regardless of anything
else that happens to their account afterward: changing plans, changing billing cycle, changing or
re-acquiring a mandate, being suspended, or being reactivated — none of these resets or reassigns a
past redemption. **This is a deliberate anti-abuse stance, not an oversight:** the only way a coupon
redemption limit resets is if the business explicitly decides it should (e.g., "cancelling and
resubscribing gives you a fresh set of first-time discounts") — and this document takes the position
that such a reset is **not desirable**, consistent with the anti-abuse posture already recorded for
referral rewards (§3.6b's "first successful paid subscription per organization, lifetime" framing)
and the still-open cancel/resubscribe abuse question flagged in earlier phases of this audit. A
future business decision could deliberately override this, but the default, and the one this
document records, is: **redemption identity survives everything except the organization itself
ceasing to exist.**

---

## Chapter 15 — Phase 2G: State Machine Verification, Beginning with Commercial Transaction

**Purpose and method.** Rather than continuing to hunt individual edge cases, this phase takes each
entity's *entire* state machine and, for every legal transition, asks: who triggers it, what
conditions must hold, and what side effects fire — the same rigor already applied piecemeal to
Subscription, Component, Invoice, Coupon, and Reward in Chapter 10, now applied systematically,
starting with the one object this pass revealed was still missing from the vocabulary.

### ❌ Reversed — "Commercial Transaction" is reinstated as a real object, not a superseded concept

**Chapter 1 previously struck this concept out**, on the reasoning that Chapter 10's Law 11 (one
collectible invoice at a time, replace via VOID) closed the specific gap Commercial Transaction was
invented for (P9's concurrent-upgrade-attempt question), so no dedicated object seemed necessary.
**This reversal corrects that call, flagged explicitly per this document's own standing discipline
of recording corrections rather than silently overwriting them:** Law 11 closes the question of "how
many invoices can exist," but it does not give a name to the thing that actually *persists* across a
failed attempt and its eventual retry — the customer's original business decision to upgrade, add an
add-on, change cycle, etc. **`Commercial Transaction` is that missing object**, and it is real,
necessary vocabulary, not a redundant wrapper around Invoice/Payment.

**Note on scope, resolved fully in Chapter 18:** the state machine and examples immediately below
were first framed around payment-bearing actions (upgrades) specifically. Chapter 18 later broadens
this to the correct, general definition — **every** commercial action creates a Commercial
Transaction, whether or not it involves payment (a downgrade, a cancellation, a Super Admin trial
start all create one too) — with Invoice and Scheduled Change both optional children of it. The
state machine below still applies; Chapter 18 explains how a no-payment action moves through it
without an `AWAITING_PAYMENT` step.

**✅ Decided — the state machine:**
```
CREATED
    │
    ▼
PRICED
    │
    ▼
AWAITING_PAYMENT ⇄ FAILED   (FAILED is NOT terminal — see below)
    │
    ▼
COMMITTED
    │
    ▼
COMPLETED

(any state before COMMITTED can also exit to VOID — see below)
```

**✅ Decided — a Commercial Transaction always moves from `CREATED` to `PRICED`; it never lingers in
`CREATED`.** If a request fails validation (unavailable plan, incompatible add-on, etc.), it is
rejected *before* a Commercial Transaction is ever created at all — this is D1 of the existing
Change Decision Engine (§3.2), unchanged; a Commercial Transaction coming into existence at all is
itself evidence the request already passed validation.

**✅ Decided — a customer changing their mind before paying voids and replaces, never mutates.** If
a customer is `AWAITING_PAYMENT` on Transaction A and changes the target (a different plan, a
different quantity) before paying, Transaction A moves to `VOID` and a new Transaction B is created
at `CREATED`. This is the Commercial-Transaction-level restatement of the same pattern §4.1 already
specified for Invoices during an in-progress Upgrade (P5/P6, replace not merge) and Chapter 10's Law
11 (void-and-replace, never edit) — the same discipline, one layer up.

**✅ Decided — `AWAITING_PAYMENT → FAILED` does not need a separate `ABANDONED` state.** Whether a
payment is actively declined, or the customer simply closes the checkout window, or the session
times out — all three produce the identical business outcome (nothing committed, the invoice stays
unpaid), so all three land on the same `FAILED` value. Adding `ABANDONED` as a distinct state would
distinguish a difference that has no business consequence.

**⭐ Decided — the core principle governing everything about retries: business intent is immutable;
payment outcome is mutable.** `FAILED` is explicitly **not terminal** for a Commercial Transaction —
it can return to `AWAITING_PAYMENT` on a retry, because a failed payment attempt does not mean the
customer made a new decision; it means the same decision hasn't yet succeeded. Concretely:
- **Immutable on a Commercial Transaction** (these define the business intent and never change once
  set): Transaction ID, Reason, Customer/Organization, Target (plan/add-on/quantity/cycle), Created
  By, Created At.
- **Mutable on a Commercial Transaction** (these are payment-execution bookkeeping, expected to
  change across attempts): Attempt Count, Latest Invoice reference, Latest Payment Attempt
  reference, Failure Reason, Last Attempt At.

A genuinely *different* business decision — e.g. the customer abandons an upgrade to Growth and
later decides to upgrade to Enterprise instead — is correctly a **second, separate** Commercial
Transaction, not a mutation of the first; only the *same* target being retried reuses the same
Transaction.

**Why this belongs above Invoice and Payment Attempt in importance, not beside them:** the ordering
recommended for the rest of this verification pass — Commercial Transaction, then Invoice, then
Subscription, then Component, then Scheduled Change, then Mandate, then Coupon/Redemption, then
Referral/Reward/RewardUsage — reflects that every one of those other state machines reacts to a
Commercial Transaction completing, not the reverse; verifying this one first should surface
downstream issues in the others faster than working bottom-up.

### 🟥 Flagged, not decided — whether a retry may regenerate a fresh, differently-priced invoice, and if so, when

**This is a genuine reversal proposal, not a straightforward addition, and it directly contradicts
several already-locked findings — recorded here as an open conflict, not silently resolved, per
this document's standing discipline (the same treatment already given to the Renewal Engine's R4
question and the Subscription Identity question, Chapter 12).**

**The proposal:** since a Commercial Transaction's business intent is immutable but its Invoice is
just one possible pricing of that intent at a moment in time, a long-delayed retry (the suggested
example: after ~10–15 minutes, or in general "once prices, coupons, referrals, or tax could plausibly
have changed") should **void the old, unpaid invoice and generate a fresh one, re-priced against
current commercial reality**, rather than simply re-attempting collection of the original invoice.

**What this directly contradicts, all previously locked in this same document:**
- **Law 8 (Chapter 8):** *"a retry attempts to collect the same, already-frozen invoice and is
  therefore entirely unaffected by any price change that happens after that invoice was created."*
  Law 8 was specifically written to close the "admin changes the price during a `past_due` retry
  window" question (§ S3, Chapter 10) — with the explicit conclusion that the retry always uses the
  original, frozen amount, with **no time-based exception**.
- **Chapter 10, Object 3 finding:** *"a retry updates the SAME invoice; it never creates a new
  one... one accounting document, many payment attempts."* No time threshold was part of that
  finding — it was stated as an unconditional rule.
- **Chapter 9, P10 and N1**, and **Chapter 14's coupon-retry example** all independently restate
  "reuse the same invoice, never regenerate" as settled, unconditional fact, each cross-referencing
  the same underlying rule.

**Why this isn't a small wording conflict:** if a time-based regeneration rule is adopted, Law 8, the
Object 3 finding, P10, N1, and the coupon-redemption retry example in Chapter 14 would all need to be
revised together, consistently, not just noted as an exception in one place — a stale invoice's
price, its coupon eligibility, its referral eligibility, and its GST rate would all need to be
allowed to float with elapsed time, which is a materially different, more complex system than the
one currently specified (it reopens exactly the "does this coupon/referral/price still apply" class
of question that Laws 3 and 8 were written to close permanently).

**Two real options, not yet chosen between:**
1. **Keep the current, simpler rule (no exceptions):** every retry, regardless of how much time has
   elapsed, always collects the original frozen invoice at its original price — full stop. This is
   what Law 8, Object 3, P10, N1, and Chapter 14 already say today.
2. **Adopt the proposed time-based exception**, which requires: (a) picking and documenting an
   actual threshold (a fixed duration, or an event-based boundary like "still within the same
   checkout session" vs. not), (b) revising Law 8 to explicitly carve out this exception rather than
   stating an absolute rule, and (c) updating every other place that currently states "always reuse,
   never regenerate" as an unconditional fact.

**Not deciding this here.** Option 1 remains this document's recorded, locked behavior until and
unless Option 2 is explicitly chosen — at which point Law 8 itself, not just this chapter, needs a
recorded revision.

---

## Chapter 16 — Phase 2G continued: Billing Component, Scheduled Change, and Mandate

### ❌ Correction to Chapter 10, Object 2 — Billing Component's state machine is smaller than
recorded, because "pending" is not a component property at all

**Chapter 10 originally recorded Billing Component's states as `ACTIVE → PENDING_REMOVAL →
REMOVED`.** This is now corrected to just **`ACTIVE → REMOVED`** — two states, not three. The
reasoning: this document already established, in §3.2's Invariant 7, that the system should "never
store `pendingRemoval=true`... `pendingRemoval` becomes a derived read, never a written field."
Chapter 10's Object 2 audit did not actually apply that already-locked principle consistently to
the Component's own state field — recording `PENDING_REMOVAL` as a real, stored state was an
inconsistency with Invariant 7, not a deliberate exception to it. **Corrected now:** a component
scheduled for removal stays `ACTIVE` — full stop — right up until the moment a `ScheduledChange`
(below) actually executes and moves it to `REMOVED`. Whether a component is "pending removal" is
answered by checking whether a live `ScheduledChange` currently targets it, never by reading a
field on the component itself.

**✅ Confirmed, unchanged:** `REMOVED` is terminal — the same reasoning already given for Commercial
Transaction and (per this chapter, below) Mandate applies here too: a component's record represents
"this recurring entitlement existed, from this date to that date." Re-purchasing the same add-on
later creates a **new** Billing Component (fresh identity, fresh history) rather than reactivating
the old one — this preserves a clean answer to "when did this customer stop, and when did they
start again," which the old model would have blurred.

**✅ Confirmed, unchanged and now explicitly cross-referenced:** a *quantity* add-on's quantity
(e.g. seats 2 → 3) is a **property of the existing component**, not a new component — this was
already the intent of §4.3's quantity-add-on walkthrough, now stated explicitly at the Object level:
a quantity increase or decrease is represented as a `ScheduledChange` (immediate ones execute
instantly; scheduled ones wait for renewal, exactly as §4.3 already specifies) that, on execution,
mutates the *existing* component's quantity field — it is never lifecycle, and the component itself
never becomes `PENDING_REMOVAL` just because a quantity decrease is scheduled against it.

**The resulting, generalized rule (worth stating once, since it now applies to every object in this
chapter):** nothing in this system "becomes pending." Pending work is represented entirely by a
`ScheduledChange` record referencing whatever it will eventually act on — never by a status value
on the thing being acted on.

### ✅ Decided — Scheduled Change's state machine, and what it simplifies

**A Scheduled Change is not a plan, a subscription, a component, or an invoice — it is a promise:**
"if these conditions are met at a future point, perform this business action." It owns nothing; it
only describes future intent. Every kind of future commercial action this document has specified —
plan downgrade, cancellation, add-on removal, seat decrease, storage reduction, a carry-forward
decision — is a `ScheduledChange`.

```
          PENDING
         /       \
        ▼         ▼
   EXECUTED    CANCELLED
```

- **`PENDING`** means "waiting on its execution conditions" — renewal day arriving, a successful
  payment, a still-valid mandate, the target subscription/component still existing. **Critically, a
  failed renewal payment does NOT move a Scheduled Change to `EXECUTED`** — consistent with
  Renewal Principle 1 (§3.5) and Law 2 (Chapter 8), a Scheduled Change tied to a renewal that failed
  simply stays `PENDING`, exactly like everything else that doesn't commit until payment succeeds.
- **`EXECUTED`** is terminal. Once executed, its effect is already reflected on the Subscription or
  Billing Component it targeted — the record itself becomes pure history.
- **`CANCELLED`** is terminal, and **covers both a genuine user cancellation and a supersession by a
  later, same-target request** — there is no separate `SUPERSEDED` state. When a customer schedules
  `Business→Growth` and later schedules `Business→Starter` instead (Rule 1, §3.2), the first record
  moves to `CANCELLED`, and a second, new `ScheduledChange` is created — never deleted, never
  edited, never resurrected. `CANCELLED` can never become `PENDING` again; a customer changing their
  mind later always produces a **new** `ScheduledChange`.

**✅ Decided — Scheduled Change carries a `Reason` field, valuable for Support, not for state
logic.** `Reason` is metadata alongside `CANCELLED`, distinguishing why: `Customer Request`,
`Superseded`, `Subscription Cancelled`, `Plan Deleted`, etc. This closes a real ambiguity left open
in §4.3's A9 finding — that finding said a scheduled add-on removal, made irrelevant by a
subscription cancellation, "is not deleted... it just never executes," without stating what its
final recorded status actually is. **Closed now:** it moves to `CANCELLED`, with `Reason:
Subscription Cancelled` — it does not sit in `PENDING` forever with nothing left to apply to.

**✅ Decided — the full traceability chain, and which direction the references point:** a Commercial
Transaction (Chapter 15) points *to* the Scheduled Change(s) and Invoice(s) it produces — never the
reverse.
```
Customer Intent → Commercial Transaction → Invoice(s) → Scheduled Change(s) → Billing Components / Subscription
```

**This chapter's Scheduled Change model refines and effectively supersedes two older, more
elaborate state machines recorded earlier in this document — flagged here, not silently replaced.**
Chapter 2's original **"Change"** state machine (with `Requested / Immediate / Scheduled /
AwaitingPayment / PendingRenewal / Applying / Completed / Superseded / Rejected`) and its
**"Phase 1.3 — Commercial Change Ledger"** entry state machine (`Created → Pending → Applying →
Completed`, plus separate `Superseded` and `Cancelled` branches) were both written before Commercial
Transaction (Chapter 15) and this Scheduled Change model existed as separate, distinct objects. In
hindsight, those two older diagrams were each trying to describe *both* an immediate, payment-gated
action *and* a future, scheduled-only action in a single state machine. **The correct split, now
that both objects are properly separated:** Commercial Transaction (Chapter 15) owns everything
about an immediate action that requires payment (`AwaitingPayment`/`Applying`-equivalent territory);
Scheduled Change (this chapter) owns everything about a future, no-payment-yet action
(`PendingRenewal`/`Superseded`-equivalent territory). **The older diagrams are kept, per this
document's standing discipline of never deleting superseded reasoning — but Commercial Transaction
+ Scheduled Change together should now be treated as the current, authoritative model** for anything
that previously would have been described using Chapter 2's `Change` or `Ledger Entry` state
machines.

### ✅ Decided — Mandate's state machine, reconciled with the real, already-implemented enum

**No new decisions here — this is verification, not redesign,** consistent with the real,
already-implemented `mandateStatus` enum (`none|pending|confirmed|paused|cancelled|rejected`,
`CAW_BILLING_DESIGN.md` §7) that Chapter 10's Object 6 already confirmed is authoritative:

```
           PENDING
          /       \
         ▼         ▼
     ACTIVE      FAILED
       │
  ┌────┴─────┐
  ▼          ▼
EXPIRED    REVOKED
```

- **`PENDING → ACTIVE`**: the bank confirms authorization.
- **`PENDING → FAILED`** (terminal): the authorization attempt itself fails — a closed bank page,
  an OTP timeout, an outright rejection. **A customer returning later always gets a brand-new
  Mandate**, never a repaired one — the same immutable-artifact treatment already given to
  Commercial Transaction and Billing Component in this chapter.
- **`ACTIVE` does NOT transition to `FAILED` on a payment failure.** This is an important, already-
  established separation (Invariant 9, `CAW_BILLING_DESIGN.md` §7; restated here for Mandate
  specifically): insufficient balance or a declined renewal charge is a *payment* failure, not an
  *authorization* failure — the Mandate remains `ACTIVE` throughout; only `appStatus` moves toward
  `past_due`.
- **✅ `EXPIRED` is a derived condition today — but this is conditional on a real fact about Razorpay,
  not a general principle the way Coupon/Referral expiry is, and the condition under which this
  would flip is worth stating explicitly.** There are genuinely two different things "mandate
  expired" could mean, and they are not the same kind of fact:
  - **Option A — Razorpay itself reports a real expiry event** (e.g. a `token.expired` webhook,
    should Razorpay ever add one). If that ever exists, it is a **real, factual event** — exactly
    like `token.confirmed`/`token.cancelled` today — and per Invariant 11 (Chapter 8's "store the
    vendor fact plus its timestamp, derive the rest") **it must be stored**, not derived, the moment
    it exists as a real vendor fact.
  - **Option B — we calculate `today > mandateExpiresAt` ourselves**, with no corresponding vendor
    event. This is what actually happens today, since `CAW_BILLING_DESIGN.md`'s Invariant 11 already
    confirms Razorpay does not currently send a `token.expired` event — so, for now, expiry is
    computed by comparison, the same "time never stops, always derived" pattern (Chapter 11) already
    used for Coupon/Referral validity windows.
  **Decided: keep Option B (derived) as the current, correct approach, explicitly *because* Option A
  doesn't currently exist** — not because deriving expiry is a universally superior pattern the way
  it is for Coupon/Referral. The moment Razorpay does emit a real mandate-expiry event, this
  should change to Option A (store the fact), per Invariant 11 itself — this is a conditional
  decision tied to an external vendor's current behavior, not a permanent architectural stance,
  and is written that way here so a future contributor doesn't mistake it for the latter.
- **`REVOKED`** (terminal): the customer deliberately revokes authorization with their bank (the
  scenario already specified in `BILLING_SYSTEM_EXPLAINED.md` Part 9), or — only if such a capability
  is ever explicitly introduced — an intentional admin invalidation (which, per Chapter 13's Super
  Admin Authority Matrix, does not currently exist; Admin's only real lever is **Request New
  Mandate**, never a direct state override).

**⭐ Law recorded — Mandates are immutable authorization records.** Once a Mandate reaches a terminal
state (`FAILED`, `EXPIRED`, or `REVOKED`), it is never reactivated; any future authorization attempt
creates a new Mandate. This closes the previously-parked scenario cleanly: a customer who pays once
but never completes mandate authorization, and returns three months later, gets a **new** Mandate
(`PENDING → ACTIVE`), a **new** Commercial Transaction, and a **new** Invoice — while their
Subscription identity (see the flagged question immediately below) is the one piece of continuity
across the gap.

---

### ✅ RESOLVED — the object-reuse table above needed a correction, and the underlying question is now closed (Chapter 12)

**This session's original object-reuse framing ("Subscription: ✅ Yes — reused, one per
organization") was itself incorrect, not just under-specified — corrected here, and the underlying
question closed properly in Chapter 12's resolution.** The corrected table:

| Object | Reused across a gap/failure? |
|---|---|
| Organization | ✅ Yes — the one genuinely permanent entity in this system |
| Subscription | ❌ Never reused — but an Organization may own **many** Subscription records over its lifetime, exactly one of which is current/`ACTIVE` at a time (Chapter 12's resolution) |
| Commercial Transaction | ❌ Never |
| Invoice | ❌ Never |
| Billing Component | ❌ Never after removal |
| Scheduled Change | ❌ Never |
| Mandate | ❌ Never |

**Every object in this system is append-only/never-reused, without exception — the permanence
belongs to the Organization, one level above Subscription, not to the Subscription itself.** This
was the missing piece: earlier framings (including the one flagged as an open conflict earlier in
this chapter) were trying to make Subscription do double duty as both "the permanent thing" and "the
thing that begins and ends with each commercial contract" — Chapter 12 resolved this by giving the
permanence to the Organization instead, which makes every row in this table consistent with the same
single pattern, no exceptions. Chapter 4.2 and Chapter 10 Object 1 needed no revision at all — they
were correct the entire time; only the higher-level framing above them was missing.

---

## Chapter 17 — Phase 3.1 Closing: Coupon/Referral/Reward as Object Categories, and the Cross-Object Consistency Pass

### ✅ Confirmed — Coupon is a Policy Object, not a Lifecycle Object

**Reframing, not a new decision — Chapters 10 and 13 already established the mechanics; this names
the category.** A Coupon has no stored lifecycle at all — `isActive` + `startDate`/`expiryDate` are
properties the system *evaluates* on demand; `NOT_STARTED`/`ACTIVE`/`EXPIRED`/`DISABLED` are
computed conditions, never transitions, and nothing in the database changes at midnight when a
coupon's start date arrives — only the interpretation of already-static data changes. This is worth
naming explicitly: Coupon belongs to a different category of object than Invoice or Mandate.

### ✅ Confirmed — CouponRedemption is a pure historical record

One row, created once, never updated — already established in Chapters 10 and 14. **Law, restated
for clarity: a `CouponRedemption` is never updated after creation, under any circumstance.**

### ✅ Decided — Referral's `expired` state should actually be implemented after all

**This revises Chapter 13's decision, and the revision is recorded rather than silently
overwritten.** Chapter 13 concluded `expired` should stay unimplemented unless the business
explicitly wants referral-link expiry. Re-examining the scenario directly — a referral invitation
that never converts, sitting as `pending` for years — surfaces a real, if modest, business cost:
`pending` specifically communicates "still expecting a future qualification," and an invite from
five years ago no longer meaningfully carries that expectation. **Decided:** `Referral` gains a real
`PENDING → EXPIRED` transition, triggered by whatever expiry condition the business configures
(program-level expiry, invite-level expiry, or manual expiry) — this does not affect `Reward` at all,
since a `Reward` doesn't exist until a `Referral` actually reaches `QUALIFIED`. **This is a genuine
reversal of Chapter 13's specific conclusion on this one point — flagged as such, not quietly
patched over** — the underlying reasoning in Chapter 13 (favor fewer states, avoid unnecessary
scheduled work) was sound in general, but on reflection this particular case has enough real
business value (a Support/reporting question — "is this old referral invite still live?" — that
currently has no clean answer) to justify the small addition. The 🟨-severity cleanup-job
recommendation from Chapter 13 (RewardUsage's own scheduled sweep) is a reasonable model for how this
would be evaluated too, but is not itself re-opened by this decision.

### ✅ Confirmed — Reward is an entitlement with soft-delete, not a lifecycle object

Already established in Chapters 10 and 13 (no `status` field; only `revokedAt` mutates). Naming the
category explicitly: **Reward is an entitlement, full stop — `Pending`/`Consumed`/`Expired` are all
concepts that belong to `RewardUsage`, never to `Reward` itself.**

### ✅ Confirmed, with one correction — RewardUsage is append-only, and `CONSUMED` is unconditionally terminal

**Confirmed:** `RESERVED → CONSUMED` or `RESERVED → RELEASED`, both terminal; a new attempt after
`RELEASED` always creates a **new** `RewardUsage`, never reopens the old one — the same append-only
pattern as every Transaction Object in this system. **Worth stating explicitly, since it wasn't
phrased this way before:** `CONSUMED → RELEASED` is not just unlikely, it is **structurally
impossible** — once consumed, the money has already moved (Law 1), so there is nothing left to
release; this isn't a business policy choice, it's a direct consequence of Law 1 and Law 3 acting
together.

### ✅ Object Categories (new organizing framework, not new rules)

This reframes everything validated so far into four categories — useful for reasoning about the
system at a glance, not a new architectural decision:

| Category | Members | Defining trait |
|---|---|---|
| **Long-lived** | Organization, Subscription, Coupon (as a policy object), Plan/Add-on Definitions | Describe the ongoing business relationship or catalog; not append-only |
| **Transaction (append-only)** | Commercial Transaction, Invoice, Payment Attempt, RewardUsage, CouponRedemption, Mandate, Scheduled Change | Immutable once created (in business-intent terms); a retry or a new attempt always creates a new record, never reopens an old one |
| **Catalog** | Plan Definitions, Add-on Definitions, Coupon Definitions, Referral Program Configuration | Admin-configured settings, not events |
| **Historical** | Invoice, CouponRedemption, RewardUsage, Commercial Transaction, Mandate | The subset of Transaction objects that specifically serve as the permanent audit trail once terminal |

---

## Chapter 18 — Cross-Object Consistency Pass

**Method.** Not a new state machine per object — a check of whether the state machines validated in
Chapters 10, 15, 16, and 17 actually fit together without contradiction, using the four questions
posed: can an object point to something that no longer exists; can two objects disagree about
reality; can a transition in one object violate another's state machine; does every transition have
exactly one owner.

### Q1 — Can any object point to something that no longer exists?

**Checked and confirmed safe, by construction (not by assumption):**
- **`CouponRedemption`/`RewardUsage` pointing to a `VOID` Invoice:** impossible. Both are only ever
  created *after* an invoice reaches `PAID` (Chapter 14's core invariant; Chapter 10's real-code
  confirmation that `recordRedemption`/`consumeReservation` are only called from settlement). `VOID`
  (Law 11) only ever happens to an invoice *before* it's paid. A `PAID` invoice is immutable (Law 3)
  and never subsequently becomes `VOID` — so there is no code path by which either object could end
  up pointing at a voided invoice.
- **An Invoice's stored Coupon/Reward reference, after the Coupon is later soft-archived or the
  Reward later revoked:** safe, because an Invoice stores a full **snapshot** at generation time
  (plan, price, add-ons, coupon, credits, tax — "all as they were at invoice time," §4.1), not a live
  reference re-resolved on every read. Archiving a coupon or revoking a reward afterward cannot alter
  or invalidate what an already-generated invoice displays.
- **A `RewardUsage` pointing to a `Reward` that gets revoked while the usage is still `RESERVED`:**
  already handled by real code, not just by design — Chapter 10 confirmed `revokeReward` explicitly
  looks up any live `reserved` `RewardUsage` for that reward and force-releases it as part of the same
  operation. No dangling reservation is possible.

**🟥 A real gap found — two Scheduled Changes can target the same Billing Component with no defined
precedence.** Nothing currently prevents a full `REMOVE` and a `REDUCE_QUANTITY` from both being
`PENDING` against the same component simultaneously (e.g., a customer schedules "remove Storage
entirely" and, separately, before that takes effect, also has an unrelated-seeming scheduled quantity
adjustment still pending against the same underlying component from an earlier action). Since the
Renewal Engine applies every effective-today `ScheduledChange` together, as one set (§3.5 R13), **what
happens if both fire in the same commit, with the component already being removed by one of them, is
currently undefined.** Recommended resolution, offered rather than assumed: **a `REMOVE` targeting a
component should implicitly supersede (→ `CANCELLED`, `Reason: Superseded`) any other still-`PENDING`
`ScheduledChange` targeting that same component**, the same "replace on the same identity" pattern
already used for `PLAN`/`BILLING_CYCLE` (L1/L2) — since once a component is gone, any other pending
change to it is meaningless, exactly like Chapter 16's cancellation-supersedes-downgrade case. **Not
adopted as decided here — flagged for confirmation**, since it is a real business-behavior choice
(should the customer be warned/asked, or should it happen silently as a "no-op" cleanup) rather than
a purely mechanical inference.

### Q2 — Can two objects (or two rules) disagree about reality?

**🟥 A real, direct contradiction found and corrected in place** (see the edit to §3.2's Ledger
Rules table, immediately above this chapter): **Rule L3 said `ADDON_ID` replaces the same `ADDON_ID`
("replace, not stack"), while the very next paragraph in the same section, and §4.3's fully worked
quantity-add-on walkthrough, both explicitly state add-ons never replace on identity — multiple
`SubscriptionChange` records for the same add-on always coexist and all execute.** These two
statements, a few paragraphs apart in the same chapter, directly disagreed with each other, and
nothing in this document had ever flagged it. **Corrected:** L3 is struck as not applicable to
`ADDON` at all; the actual, decided, and already-coded behavior is what §3.2's later paragraph and
§4.3 both already say — add-ons never replace, regardless of same or different target.

**A second, milder risk found — `BillingCycle.status` and `Invoice.status` both appear to track the
same underlying fact** (did this period's charge succeed) as two separately-named fields on two
separate objects. This is exactly the shape of risk Chapter 6's Ownership Matrix exists to prevent
("no two engines may write the same fact") — not yet a proven bug, but worth stating the rule
explicitly rather than leaving it implicit: **`BillingCycle.status` should be treated as derived from
its associated Invoice's status, never decided independently** — the two are permitted to be updated
together, in the same atomic commit (Law 7), but there must be exactly one place that decides "did
this period get paid," with the other field simply mirroring it.

### Q3 — Can a state transition in one object violate another object's state machine?

**Checked and confirmed safe, by construction:**
- `RewardUsage: reserved → consumed` cannot happen while its Invoice is not `PAID` — the real,
  audited code (`consumeReservation`) only runs from the settlement/payment-confirmation path, an
  atomic conditional update guarded on `status: 'reserved'`, itself only reachable after payment
  success.
- `CouponRedemption` creation cannot happen against a not-yet-`PAID` invoice — same reasoning,
  `recordRedemption` is only ever called from `runFirstPaymentSettlement`.
- `ScheduledChange → EXECUTED` cannot happen against a `CANCELLED` Subscription — already resolved
  by the cancellation-precedence rule (Chapter 9's A9, Chapter 16's `Reason: Subscription Cancelled`):
  the Renewal Engine's very first check on a due subscription is whether a cancellation is pending;
  if so, nothing else executes.

### Q4 — Does every state transition have exactly one owner?

**One legitimate exception to "exactly one owner" found, and it's fine — worth stating explicitly
rather than leaving an apparent gap.** `Subscription: PAST_DUE → ACTIVE` has **two genuinely
different, both-legitimate triggers**, not one: (a) the **Retry Engine**, when a retry against the
*same* outstanding invoice succeeds (the ordinary path), and (b) the **Commercial Change Engine**,
per Chapter 11's finding, when a *replacement* invoice (Law 11 — the customer initiated a new
commercial action mid-retry) is paid instead. **This is not a violation of single ownership** — both
paths converge on the identical underlying fact ("a payment that settles this subscription's
outstanding position has succeeded") — but Chapter 6/11's Ownership Matrix should list **both**
engines against this specific transition, rather than implying, by omission, that only the Retry
Engine ever performs it.

**No other transition audited across Chapters 10, 15, 16, and 17 was found to have more than one
legitimate owner**, or an owner gap.

### ✅ RESOLVED — a Commercial Transaction represents business intent, not payment; every commercial action creates one, whether or not money moves

**This closes the structural ambiguity above with an explicit redefinition, not a patch.** The
ambiguity existed because Commercial Transaction had been implicitly defined as "the thing that
wraps a charge" — every example used to introduce it (Chapter 15) was payment-shaped. **Corrected
definition:**

> A Commercial Transaction represents every commercial event that changes, or expresses intent to
> change, the commercial relationship between an Organization and the business. Payment is one
> possible consequence of a Commercial Transaction, never its defining characteristic.

**Why this is the right correction, not just a convenient one.** Test it against a real Support
question: a customer schedules a downgrade, then cancels the schedule the next day. *"When did they
ask for the downgrade, and from where?"* If a Commercial Transaction is never created for a
no-payment action, that question has no clean answer — a bare `ScheduledChange` record doesn't, by
itself, carry a full account of *who initiated it and why* the same way a Commercial Transaction
does. The same reasoning applies to a plain cancellation (no payment, but unquestionably a
commercial event) and to a Super Admin starting a trial (§4 territory, no payment, still a real
change to the relationship worth its own audit trail).

**✅ Decided — every commercial action creates a Commercial Transaction; an Invoice and a
Scheduled Change are both optional children of it, not required ones:**

```
Commercial Transaction
        │
        ├── Invoice (optional)
        ├── Scheduled Change (optional)
        ├── Mandate (optional)
        └── Commit
```

| Action | Commercial Transaction | Invoice | Scheduled Change |
|---|---|---|---|
| New purchase | ✅ | ✅ | ❌ |
| Upgrade | ✅ | ✅ | ❌ |
| Add-on purchase (immediate) | ✅ | ✅ | ❌ |
| Downgrade | ✅ | ❌ (until the renewal that bills it) | ✅ |
| Seat/quantity decrease | ✅ | ❌ | ✅ |
| Add-on removal | ✅ | ❌ | ✅ |
| Cancellation | ✅ | ❌ | ✅ |
| Trial start (Super Admin) | ✅ | ❌ | ❌ |

**Why this is better than the alternative of two separate audit trails.** If only payment-bearing
actions created a Commercial Transaction, the system would end up with one audit trail for paid
actions and a structurally different one for scheduled/no-payment actions — meaning Support would
have to know, in advance, which kind of action they're looking for before they know where to look.
One uniform object for every commercial event, with `Invoice` and `Scheduled Change` simply present
or absent depending on the action, keeps exactly one place to look regardless of whether money was
involved.

**What this means for Chapter 15's state machine, reconciled rather than left dangling:** for a
no-payment action, the Commercial Transaction still moves `CREATED → PRICED` (even a downgrade is
"priced," in the sense that its future commercial impact is calculated), then proceeds directly to
`COMMITTED → COMPLETED` the moment its resulting `Scheduled Change` (or, for a trial start, its
direct effect) is successfully created and accepted — it does not wait through an
`AWAITING_PAYMENT` state that never applies to it, and it does not stay open waiting to see whether
a future-dated Scheduled Change eventually executes; that later outcome belongs entirely to the
Scheduled Change's own state machine (Chapter 16), never to reopening the Commercial Transaction
that created it. A Commercial Transaction being `COMPLETED` means "the customer's decision was
successfully recorded and accepted," not "every downstream consequence has already happened" — those
are different facts, tracked by different objects, exactly as this document's broader philosophy
(Commercial Transaction = immutable business intent; everything downstream is a separate artifact)
already established in Chapter 15.

---

## Chapter 19 — Phase 5: Failure Matrix

**Purpose and method.** Chapters 1–18 answered "how does this work." This chapter asks, systematically,
"how can this fail" — for every major capability, not just the ones already touched by Chapter 9's
Interaction Matrix. Combined with Chapter 9's ~40 rows and `CAW_BILLING_DESIGN.md`'s original Failure
Matrix (§10), this chapter brings the system's total enumerated failure scenarios past the ~150
target set at the start of this phase.

**Every row is classified as exactly one of four types — no row is left as an unclassified
"recommendation."** A business specification decides; it doesn't hedge.

| Type | Meaning |
|---|---|
| ✅ **Business Rule** | Already decided — this row states, in plain business terms, which existing rule resolves it |
| 🟨 **Business Decision** | A genuine, still-open question requiring explicit business input — not yet locked |
| ⚙ **Implementation Requirement** | A business rule already exists; guaranteeing it holds under concurrency/duplication is an engineering responsibility, stated here as an outcome ("only one may succeed"), never as a mechanism |
| 🔍 **Verification Case** | Checked against the existing rules and confirmed the scenario either can't happen, or is already handled without any new rule |

### A — Registration & Mandate Acquisition

| # | Scenario | Type | Outcome |
|---|---|---|---|
| RA1 | Network drops before Razorpay redirect during signup | ✅ | No subscription is created |
| RA2 | Browser crashes after paying but before redirect back | ✅ | The webhook alone activates the subscription |
| RA3 | Signup form double-submitted | ⚙ | Only one subscription may ever be created per signup attempt |
| RA4 | Payment succeeds, mandate confirmation webhook never arrives | ✅ | Subscription is active; the mandate-recovery condition surfaces for the customer to fix before their next renewal |
| RA5 | Payment succeeds, mandate outright rejected | ✅ | Same as RA4 — active, prompted to re-authorize |
| RA6 | `token.confirmed` arrives before `payment.captured` | 🔍 | Already proven live, twice |
| RA7 | Same webhook delivered three times | 🔍 | Deduped by event id |
| RA8 | Missing phone number (social login) | ✅ | Signup is blocked with an explicit, actionable message until provided |
| RA9 | Card declined at signup | ✅ | No subscription created; customer may retry fresh |
| RA10 | A second signup attempt begins for the same org while the first (abandoned) attempt left no trace | ✅ | Allowed — nothing existed to conflict with |
| RA11 | Org has a `CANCELLED` Subscription; signs up again | ✅ | A new Subscription is created (Chapter 12) |
| RA12 | Referral-qualification check throws mid-settlement | ✅ | Repaired forward on retry, never left half-activated |

### B — Upgrade

| # | Scenario | Type | Outcome |
|---|---|---|---|
| UP1 | Customer closes checkout before paying | ✅ | Nothing changes |
| UP2 | Browser refresh mid-checkout | ✅ | The same pending Commercial Transaction and Invoice are reused |
| UP3 | Payment succeeds, webhook delayed | ✅ | Settlement waits for the webhook |
| UP4 | Duplicate webhook, same payment | 🔍 | Ignored |
| UP5 | Same upgrade initiated in two tabs | ✅ | The second voids and replaces the first |
| UP6 | Payment fails, customer retries later | ✅ | Same Commercial Transaction and Invoice reused, regardless of elapsed time |
| UP7 | Customer changes upgrade target before paying | ✅ | Old Commercial Transaction voided, new one created |
| UP8 | Upgrade succeeds, customer immediately upgrades again | ✅ | Allowed — a new, independent Commercial Transaction |
| UP9 | Payment succeeds but commit fails partway | ✅ | Repaired forward, never rolled back |
| UP10 | Target plan deleted/archived between preview and submission | ✅ | Rejected at request validation |
| UP11 | Customer declines the mandate-cap re-authorization step | ✅ | Nothing changes, same as any abandoned checkout |
| UP12 | Upgrade attempted while a downgrade is already scheduled | ✅ | Rejected outright |
| UP13 | Two admins on the same org simultaneously upgrade and add an add-on | ⚙ | Both may succeed only if they target different commercial properties; the Subscription's own state must never be corrupted by two simultaneous writers |
| UP14 | Payment succeeds; customer's session already expired before the success screen shows | ✅ | Billing correctness is unaffected |
| UP15 | Coupon expires in the seconds between preview and actual invoice generation | ✅ | Evaluated at the invoice's generation timestamp; the preview was never a guarantee |

### C — Downgrade

| # | Scenario | Type | Outcome |
|---|---|---|---|
| DG1 | Downgrade scheduled, then immediate upgrade attempted | ✅ | Blocked |
| DG2 | Downgrade re-scheduled to a different target before executing | ✅ | Replace, not stack |
| DG3 | Destination plan deleted/archived before the scheduled downgrade executes | ✅ | **Locked.** A scheduled downgrade is, in effect, a future purchase into that plan — and archived plans never accept new purchases (AD4). The downgrade cannot execute; the Billing page tells the customer the destination plan is no longer available and asks them to choose a different one. No automatic substitution to a different plan ever happens on the customer's behalf. |
| DG4 | Usage grows past the destination plan's limit after scheduling, before renewal | ✅ | **Locked, and formalized as a full business requirement, not just a rule.** The full sequence: schedule → eligibility checked → time passes → usage changes → renewal arrives → eligibility is **rechecked** (not assumed still valid). If still eligible, the downgrade executes normally. **If no longer eligible: the downgrade does not execute, the subscription remains on its current plan, no charge reduction happens, and the scheduled downgrade stays blocked (not silently cancelled — the customer can still resolve their usage and let it execute at the next renewal).** This is required to surface clearly in the product UI, not just be a silent backend outcome — the Billing page must explain *why*, itemized per resource (e.g. "Seats: allowed 2, current 5; Storage: allowed 20GB, current 34GB"), and offer the customer a clear path to resolve it (remove users, reduce storage, archive forms) or explicitly keep their current plan. This mirrors the itemized-checklist requirement already established for scheduling-time validation (Chapter 12) — now extended explicitly to the execution-time recheck as well, since both are the same underlying business requirement: the customer should never be surprised by a downgrade that silently failed with no explanation. |
| DG5 | Renewal that would execute the downgrade fails to charge | ✅ | Nothing executes, including the downgrade |
| DG6 | Downgrade scheduled, then cancellation scheduled | ✅ | Cancellation wins |
| DG7 | Downgrade cancelled, then the same downgrade re-scheduled | ✅ | A new `ScheduledChange` is created; the cancelled one stays in history |
| DG8 | Downgrade with mixed carry-forward choices across two compatible add-ons | ✅ | Each recorded independently |
| DG9 | Downgrade requested to a plan that never existed | ✅ | Rejected at request validation |
| DG10 | Subscription suspended (not cancelled) while a downgrade is pending | ✅ | **Locked.** Suspension changes access; a downgrade changes the plan — the two are independent facts (the same separation already established between `appStatus` and commercial state, §3.5). A pending downgrade is untouched by suspension and still executes at its scheduled renewal once the subscription is active again. |

### D — Add-ons

| # | Scenario | Type | Outcome |
|---|---|---|---|
| AO1 | Boolean add-on added twice | ✅ | Rejected — can't duplicate a boolean |
| AO2 | Rapid-fire duplicate add-on requests from a single accidental double-click, not a real second decision | ⚙ | Only one real addition may result from one real customer decision |
| AO3 | Seat removals scheduled past zero | ✅ | Rejected at request time |
| AO4 | Add-on scheduled for removal is discontinued from the catalog before renewal | ✅ | Treated as a no-op — the add-on being gone already achieves the intended outcome |
| AO5 | Add-on purchase and a concurrent removal both touch the same invoice's line items | ⚙ | The invoice must reflect one single, consistent state of the subscription, never a mix of two overlapping requests |
| AO6 | Add-on removal already scheduled; customer later upgrades to a plan that also doesn't support it | ✅ | Already covered, no duplicate removal created |
| AO7 | Add-on purchase payment fails, retried much later | ✅ | Same Commercial Transaction/Invoice reused regardless of elapsed time |
| AO8 | Quantity decrease and increase scheduled on the same add-on in one session | ✅ | Both real and independent; the increase is immediate, the decrease waits for renewal |
| AO9 | Add-on purchase succeeds while the product's own usage-limit module is unavailable | ✅ | Billing has already committed; the usage-limit module's own availability is outside billing's scope (Chapter 13) |
| AO10 | Same add-on purchased twice due to a UI bug sending the request twice | ⚙ | Same guarantee as AO2 — one real decision, one real result |

### E — Billing Cycle Change

| # | Scenario | Type | Outcome |
|---|---|---|---|
| BC1 | Monthly→Yearly switch payment fails | ✅ | Nothing changes |
| BC2 | Cycle switch attempted while a downgrade is scheduled | ✅ | Blocked |
| BC3 | Yearly→Monthly switch after crossing a second entitlement window | 🔍 | Resolved in principle by the existing entitlement-window math; confirmed to apply equally in the reverse direction |
| BC4 | Cycle switched twice in rapid succession before either commits | ✅ | First Commercial Transaction voids, second replaces |
| BC5 | Anchor-date math crosses a leap year | 🔍 | A date-arithmetic correctness question, not a business-policy question — the business rule (anchor never resets) is unaffected either way |

### F — Renewal

| # | Scenario | Type | Outcome |
|---|---|---|---|
| RN1 | Charge succeeds, webhook delayed, retry scheduler wakes meanwhile | 🔍 | Already resolved, idempotent |
| RN2 | Invoice generation itself errors before any charge is attempted (e.g. a corrupt coupon reference) | ✅ | **Locked as its own named failure class: an Internal Billing Error, categorically distinct from a payment decline.** No invoice is generated, no charge is attempted, the subscription is **not** marked `past_due` — the customer did nothing wrong, and must never see "payment failed" for a problem that was never actually a payment attempt. Instead: raise an internal alert, leave the subscription entirely unchanged, and retry once the underlying data problem is fixed. |
| RN3 | Two renewal cron ticks pick up the same subscription in the same run | ⚙ | Exactly one charge may ever result from one due renewal, regardless of how many times it's evaluated |
| RN4 | Combined coupon + referral exceed the invoice total | ✅ | **Locked — the last major open financial decision, now closed.** Discounts can never take an invoice below ₹0: no negative invoices, no carry-forward of the unused excess, no credit wallet. A ₹500 invoice with ₹400 + ₹300 in combined discounts simply charges ₹0 — the excess is not banked anywhere. |
| RN5 | Renewal fires against an expired mandate with no prior warning ever sent | ✅ | Fails with a clear "authorization required" reason, enters the normal retry/suspend path — a proactive expiry warning is a customer-communication addition, not a billing-behavior gap |
| RN6 | Renewal invoice bundles a mid-cycle-realigned item | ✅ | Still recorded with reason `RENEWAL` |
| RN7 | A due renewal coincides with an admin manual adjustment on the same subscription | ⚙ | Exactly one of the two may write the subscription's state at a time |
| RN8 | Multiple Billable Items share a due date only because of a leap year | 🔍 | The coincidental-grouping rule already handles this by construction |
| RN9 | One bundled item "succeeds," another "fails" within the same renewal invoice | 🔍 | Cannot happen — one bundled invoice is one charge, succeeding or failing as a whole |
| RN10 | Renewal fires a day early/late due to clock drift | 🔍 | A clock-accuracy question, not a business-policy question |
| RN11 | An unrelated `ScheduledChange` is cancelled the same instant the Renewal Engine reads what's due today | ⚙ | The Renewal Engine must act on one consistent snapshot of what's due, never a moving target |
| RN12 | Renewal commits successfully but the notification email fails to send | ✅ | Never affects billing |
| RN13 | Organization deleted/archived while a renewal is still pending | ✅ | **Locked.** Organization deletion first requires verifying there is no pending Commercial Transaction, no unpaid invoice, no active retry, and no pending scheduled billing. If any of these exist, **deletion is blocked** — billing history is permanent (Law 3/10) and an organization with live billing activity may only be **archived**, never deleted outright. |
| RN14 | Renewal produces a ₹0 invoice via a 100%-value coupon | ✅ | **Locked, resolved by RN4's rule.** A ₹0 invoice is still a successful settlement — it moves to `PAID` and the billing period advances normally, exactly like any other paid invoice. Zero is a valid, final price, not a special case. |
| RN15 | Cancellation's effective date is the same day as a renewal | ✅ | Cancellation short-circuits; no renewal invoice is generated |

### G — Retry

| # | Scenario | Type | Outcome |
|---|---|---|---|
| RT1 | First retry succeeds | ✅ | Returns to active |
| RT2 | All retries fail, grace elapses | ✅ | Suspended |
| RT3 | Customer manually pays mid-retry-window, ahead of the next scheduled attempt | ✅ | **Locked.** Restoration is immediate — there is never a reason to make a customer who has already paid wait for the next scheduled retry attempt, the same principle already locked for the replacement-invoice case (Chapter 11). |
| RT4 | A retry attempt and a customer upgrade race at nearly the same instant | ⚙ | Exactly one outcome may result — Law 11 already decides which invoice becomes authoritative; the race itself must be resolved atomically |
| RT5 | Mandate revoked between charge submission and webhook confirmation | 🔍 | The already-processed payment is honored regardless; only the next renewal is affected |
| RT6 | Retry cadence collides with a scheduled downgrade's effective date | ✅ | Nothing commits until the renewal actually succeeds |
| RT7 | `past_due` customer requests a refund of a prior, unrelated period | ✅ | No refunds, under any circumstance |
| RT8 | Retry scheduler itself down for days, then recovers | 🔍 | Every overdue subscription is simply picked up on the next tick |
| RT9 | Mandate independently expires during the retry window | ✅ | The next retry fails with "authorization required" instead of a decline; same downstream path, different reason |
| RT10 | A retry succeeds in the exact same tick the grace period technically elapses | ✅ | **Locked.** A successful payment always wins over a same-tick grace-period suspension — a customer who paid is never suspended for it. |

### H — Suspension & Reactivation

| # | Scenario | Type | Outcome |
|---|---|---|---|
| SU1 | Suspended, mandate still valid, pays outstanding | ✅ | Immediate reactivation |
| SU2 | Suspended, mandate expired/revoked during suspension | ✅ | New mandate required first |
| SU3 | Suspended customer attempts to upgrade before paying what's owed | ✅ | **Locked — blocked.** No charge-now action is permitted while the account is suspended and something is still outstanding, the same spirit as Rule 2. |
| SU4 | Coupon expires during suspension | ✅ | Expires on schedule regardless |
| SU5 | Referral reward earned before suspension, still unconsumed | ✅ | Preserved |
| SU6 | Long-suspended org later deleted/purged per data retention | ➜ | **Explicitly moved out of the billing domain's scope, not resolved here.** This is a data-retention/compliance question, not a billing question — billing's own position is simply that invoices and subscription history remain forever (Law 3/10), regardless of what happens to the organization's product data. Data retention belongs in an Organization Lifecycle or Compliance specification, not this one. |
| SU7 | Reactivation math produces a ₹0 or negative total via a credit | ✅ | Resolved by RN4/RN14's rule — a ₹0 reactivation invoice is a valid, successful settlement, same as any other |
| SU8 | Suspended subscription is the referred side of a still-pending referral | 🔍 | No special interaction — independent objects |
| SU9 | ❌ **Removed — this scenario cannot actually happen, and the question itself was based on a misreading of the Billable Item model.** | ✅ | **Corrected.** The original framing assumed Billable Items could sit in independent overdue states indefinitely (base plan overdue, an add-on not). This is not how the architecture works after the first alignment period (§3.7): components acquired together share one renewal anchor from the start, and even a mid-cycle addition realigns to join the group at its very next renewal. After that point, every component on the subscription renews together, as **one** combined invoice, with **one** overdue state, **one** retry process, and **one** suspension decision — there is no such thing as "Storage overdue but the base plan current" as a standing condition. (The only moment an add-on is billed on its own is its *first*, immediate, prorated purchase invoice — a one-time event, not an ongoing independent renewal.) Reactivation therefore always resolves a subscription's **single**, unified overdue position — there is nothing to select "only the overdue ones" from, because everything on a subscription is overdue together or not at all. This also answers the deeper question raised alongside it: an add-on like Seats or Storage is never a subscription in its own right — it has no meaning without the base plan it depends on, which is exactly why they share one billing fate once aligned. |
| SU10 | Reactivation happens immediately, no scheduler wait | 🔍 | Confirms the already-locked finding, restated on the suspension side |

### I — Cancellation

| # | Scenario | Type | Outcome |
|---|---|---|---|
| CX1 | Cancels while a downgrade is scheduled | ✅ | Cancellation wins |
| CX2 | Customer cancels the cancellation before it takes effect | ✅ | Allowed — a scheduled cancellation may itself be cancelled like any other scheduled change |
| CX3 | Cancels while `past_due` | ✅ | **Locked.** Cancellation stops future renewals — it never forgives already-incurred debt. Retries for the amount already owed continue exactly as they would have anyway. If the debt is eventually paid, the subscription still ends at its already-scheduled cancellation date; if it's never paid, the subscription is suspended, with the debt remaining outstanding regardless. (Deliberately strict: allowing cancellation to also cancel the retry would let anyone avoid an owed payment simply by clicking cancel.) |
| CX4 | Cancellation's effective date arrives, but a monthly add-on has a different renewal date than the base plan | ✅ | **Locked.** Cancellation is a Subscription-level action — it ends the entire subscription at the base plan's own next renewal, regardless of any individual add-on's independent schedule. |
| CX5 | Cancels, resubscribes, then tries reusing an already-redeemed coupon | ✅ | Blocked — redemption identity is the Organization, permanent across Subscriptions |
| CX6 | Customer cancels around the same time as an org they referred also cancels | 🔍 | No special interaction |
| CX7 | Org is merged/transferred to another org while a cancellation is pending | ➜ | **Removed from this specification's scope entirely.** Organization merge/transfer is not a billing capability at all today; if the product ever supports it, it needs its own dedicated specification rather than being folded into the billing domain. |
| CX8 | Two cancellation requests submitted in quick succession | ⚙ | Exactly one cancellation record may ever result |

### J — Coupon

| # | Scenario | Type | Outcome |
|---|---|---|---|
| CP1 | Coupon disabled mid-checkout, before an invoice even exists yet | ✅ | Re-validated at the actual invoice-generation moment |
| CP2 | Two organizations redeem the last slot of a global-limit coupon simultaneously | ⚙ | Exactly one redemption may succeed once a coupon's limit is reached |
| CP3 | Customer upgrades away from a coupon's scoped plan mid-duration | ✅ | The discount simply stops applying, no error |
| CP4 | "N billing cycles" coupon during a long suspension | ✅ | Only actually-paid cycles advance the count, never calendar time |
| CP5 | A past, paid invoice is later found to be mis-priced due to an unrelated bug | ✅ | **Locked, and explicitly not the same question as refunds.** A refund is a customer-facing, discretionary reversal (closed, Chapter 12: none, ever). A **correction** of the system's own pricing error is different, and now has its own rule: **billing errors are corrected through a one-time, manually-created Commercial Transaction (a credit or debit adjustment), never by editing the original invoice.** Past invoices remain immutable, exactly as Law 3 requires, forever — the correction is a new, separate, fully auditable event layered on top of history, not a revision of it. |
| CP6 | Org removed from a coupon's allow-list after already redeeming it, with cycles remaining | ✅ | The existing redemption continues undisturbed; only future eligibility is affected |
| CP7 | Coupon-scoped item removed then re-added later (a new Billable Item) | ✅ | The coupon still applies — rules are keyed by billable-item identity, not the specific component instance |
| CP8 | A coupon's global limit is misconfigured to 1 and hit by a single redemption | 🔍 | No special handling needed — whichever limit is hit first blocks further use |

### K — Referral

| # | Scenario | Type | Outcome |
|---|---|---|---|
| RF1 | Referral qualifies while the referrer is mid-retry/`past_due` | ✅ | The reward is still granted and reserved, waiting for the referrer's next real invoice whenever it arrives |
| RF2 | Two organizations both claim to have referred the same third organization | ✅ | **Corrected — this scenario cannot actually arise, given how referral attribution really works, so there is no conflict to resolve, only a confirmation of the existing mechanism.** Each organization has its own unique referral code and link; a referred organization must sign up **through that specific link**, which attaches a `Referral` record to the new organization at signup — **before any reward exists, and before qualification even happens.** There is no mechanism anywhere in this model for changing, contesting, or overwriting which referral is attached to an organization after the fact. So "Alice says she referred them, Bob says he did" cannot occur as a real data conflict — whoever's link was actually clicked and used at signup is the only referral that was ever recorded; a second person's independent claim, arriving later, has no attachment point to contest, because the attachment already happened. **The rule, restated precisely: the referral code successfully used at signup becomes permanently associated with that organization; there is no later mechanism to replace or override it.** This is not a policy tiebreak between two competing claims — it is a description of the only sequence the system permits in the first place. |
| RF3 | Reward's expiry passes before the referrer ever gets another invoice | ✅ | The reward is simply forfeited at expiry |
| RF4 | Referral program disabled mid-flight (invite sent, not yet qualified) | ✅ | Still honored under the terms active when the invite was sent. **Stated once, generally, as the operating policy: disabling the referral program only ever affects future referrals — any reward already earned remains exactly as earned, untouched.** |
| RF5 | Referred org's qualifying payment is later found fraudulent/charged back | ➜ | **Explicitly deferred to a future, dedicated Chargebacks chapter, not resolved piecemeal here.** Chargebacks affect Subscription, Invoice, Coupon, and Reward simultaneously — this is bigger than a referral-specific question, and deserves its own specification pass rather than a one-line answer bolted onto this section. |
| RF6 | Referrer's reward-bearing invoice is voided and replaced | ✅ | The reservation is released with `Reason: REPLACED_BY_NEW_INVOICE` and re-reserved against the replacement |
| RF7 | Reward's max-amount cap exceeds the actual invoice value | 🔍 | The reward simply applies at its real, lower value |
| RF8 | Referrer sends a referral invite while on a free trial (not yet a paying customer) | ✅ | **Locked — allowed.** The reward is never created until the *referred* organization actually makes its first paid invoice payment — a trial referrer isn't consuming or gaming anything by inviting someone; they're simply making an introduction. The `honoredDuringTrial` toggle (currently dead in code) should be treated as decided in the "always allow" direction rather than left as a live configuration switch. |

### L — Mandate

| # | Scenario | Type | Outcome |
|---|---|---|---|
| MD1 | Mandate creation fails outright at signup | ✅ | No activation possible until resolved |
| MD2 | Mandate revoked immediately after confirmation, before any charge | ✅ | Active (already paid); the next renewal fails for lack of authorization |
| MD3 | A renewal charge exactly equals the mandate's cap | ✅ | **Locked — succeeds, no re-authorization triggered.** Only a charge strictly greater than the authorized cap requires re-authorization; an exact match is within the customer's existing authorization. |
| MD4 | Customer's mandate-cap re-authorization itself is abandoned | ✅ | Same as any abandoned checkout — nothing changes |
| MD5 | Underlying bank account closes; Razorpay may or may not surface this distinctly | 🔍 | Whatever Razorpay actually reports is handled by the existing "store the fact, derive the rest" principle |
| MD6 | Mandate acquisition succeeds; the first invoice fails independently | ✅ | Two independent facts — already resolved |

### M — Administrative Actions (new category — Super Admin as its own actor)

**Why this category was missing, and matters.** Every prior chapter modeled the customer, the
scheduler, the webhook, retry, and renewal as the actors driving state. Super Admin is a distinct
fifth actor, and had no dedicated failure category of its own, even though Chapter 13 already
established an authority matrix for what Super Admin may and may not do. This category asks what
happens when an admin action collides with something already in motion.

| # | Scenario | Type | Outcome |
|---|---|---|---|
| AD1 | Super Admin disables a coupon while a customer is mid-retry on an invoice that already used it | ✅ | The already-generated invoice is honored at its original, discounted amount — disabling only affects future invoices (CP1) |
| AD2 | Super Admin edits a referral program's reward value while referrals are mid-flight (invited, not yet qualified) | ✅ | Same principle as RF4 — an in-flight referral is honored under the terms active when the invite was sent |
| AD3 | Super Admin changes the GST rate | ✅ | Applies to invoices generated after the change; invoices already issued are never revised (Chapter 12) |
| AD4 | Super Admin archives a plan that customers are currently subscribed to | ✅ | **Locked — archiving is allowed even with existing subscribers.** An archived plan simply stops accepting new subscribers; every organization already on it continues completely undisturbed, with no forced migration and no change to their commercial terms. |
| AD5 | Super Admin disables an add-on that customers currently have active | ✅ | **Locked — same rule as AD4, applied to add-ons.** Existing subscriptions with that add-on continue unaffected; only new purchases of it are blocked going forward. |
| AD6 | Super Admin changes a plan's included seat limit downward | ✅ | **Locked, following the same philosophy already established for price changes (Chapter 12).** Existing customers are never forced down immediately — they are grandfathered on their current usage. The new, lower limit applies only going forward, from their **next renewal** onward: if they're above the new limit at that point, the same Downgrade Eligibility mechanics (Chapter 12) apply — the Billing page tells them to reduce usage or buy the necessary add-ons before that renewal, exactly as if they were downgrading themselves. |
| AD7 | Super Admin changes the default trial duration | ✅ | Applies to trials started after the change; a trial already in progress keeps the duration it was granted under |
| AD8 | Super Admin revokes a reward that has a live, reserved `RewardUsage` against it | ✅ | The reservation is force-released as part of the same action (Chapter 10, already confirmed in real code) |
| AD9 | Super Admin attempts to cancel a subscription immediately, bypassing the always-scheduled-at-renewal rule | ✅ | **Not permitted** — this would violate the Subscription state machine and Chapter 4.2's rule; Super Admin has no override for this (Chapter 13's Authority Matrix) |
| AD10 | Super Admin attempts to forgive/write off an invoice | ✅ | **Not permitted** — would violate Law 1 and Law 3; no override exists (Chapter 13) |

### N — Boundary-Time Scenarios (new category — where billing systems actually break)

**Why this deserves its own category rather than staying scattered.** Several individual boundary-
timestamp cases already appear elsewhere (C2, R3, RN10) — this category exists to check the pattern
holds consistently everywhere a validity window, expiry, or deadline exists, rather than trusting
that it generalizes without checking.

| # | Scenario | Type | Outcome |
|---|---|---|---|
| BT1 | A coupon expires at the exact moment invoice generation reads it | ✅ | Judged against the invoice's actual generation timestamp, no grace window (C2) |
| BT2 | A referral reward expires at the exact moment a retry succeeds | ✅ | Same principle as BT1, applied to reward expiry (R3) |
| BT3 | A mandate's cap is reached by a charge computed to the exact rupee | ✅ | Succeeds — see MD3, now confirmed as the general boundary-inclusive rule for authorization caps |
| BT4 | A trial's end date arrives in the same instant a plan is purchased | 🔍 | No conflict — purchasing a plan is itself the normal, expected way a trial ends |
| BT5 | A Scheduled Change's effective date is the same calendar day the customer cancels it | ✅ | Whichever the system processes first is authoritative; a cancellation submitted before execution always takes precedence over an execution that hasn't happened yet |
| BT6 | Grace period's exact final second coincides with a retry attempt succeeding | ✅ | Resolved identically to RT10 — a successful payment always wins |
| BT7 | An annual entitlement window's boundary (the 12-month mark) is crossed in the same instant a plan change is requested | 🔍 | The entitlement-window math (§3.7) already operates on exact elapsed time, not calendar rounding, so this resolves without a special case |
| BT8 | A coupon's start date arrives in the same instant a customer attempts to redeem it | 🔍 | Evaluated inclusively — a coupon is valid from its start date onward, including the start date itself |

### O — Cross-Cutting / Infrastructure

| # | Scenario | Type | Outcome |
|---|---|---|---|
| XC1 | Commit step's DB write succeeds, process crashes before the notification is emitted | ✅ | Recoverable via idempotent retry; notification failure never affects billing |
| XC2 | Two different webhook types for the same acquisition arrive near-simultaneously | 🔍 | Already proven safe |
| XC3 | Clock drift causes a timestamp comparison to appear wrong | 🔍 | A clock-accuracy question, not a policy gap |
| XC4 | Renewal Scheduler and Retry Scheduler both act on the same subscription at a boundary moment | 🔍 | Already prevented — a subscription in retry is excluded from the Renewal Scheduler's own eligibility check |
| XC5 | An extended outage causes several renewal ticks to be skipped entirely | 🔍 | Degrades gracefully — every overdue subscription is picked up on the next tick |

### Tally and what this chapter actually adds

**137 scenarios enumerated across 15 categories**, combined with Chapter 9's ~40 and
`CAW_BILLING_DESIGN.md`'s original ~10, bringing this specification's total enumerated failure
scenarios comfortably past the ~150 target. **A follow-up review pass closed all ten of the
remaining open items — three by decision, three by explicit scope removal.**

**Closed by decision:**
- **DG3** — destination plan deleted before a scheduled downgrade executes: cannot execute, customer told to pick another plan, no auto-substitution
- **RN2** — pricing failure before any charge is attempted: a distinct "Internal Billing Error," never a customer-facing payment failure, never `past_due`
- **RN4 / RN14 / SU7** — the last major open financial decision: discounts can never take an invoice below ₹0 (no negative invoices, no carry-forward); a ₹0 invoice still counts as a successful, period-advancing settlement
- **RN13** — Organization deletion is blocked while any pending Commercial Transaction, unpaid invoice, active retry, or scheduled billing exists; archive instead, never delete with live billing activity
- **CX3** — cancellation stops future renewals but never forgives already-incurred debt; retries continue regardless of the cancellation
- **AD6** — admin-lowered plan limits never force existing customers down immediately; grandfathered until their next renewal, then subject to the same eligibility mechanics as a customer-initiated downgrade
- **RF8** — trial users may send referrals and earn rewards; no reward is ever created before the referred org's first real payment, so nothing is actually being gamed

**Explicitly moved out of this specification's scope, not left ambiguously "open":**
- **SU6** — data retention is a compliance/Organization-Lifecycle question, not a billing question; billing's own position (invoices and history persist forever) already stands regardless
- **CX7** — organization merge/transfer isn't a billing capability today; deserves its own specification if the product ever adds it, not a bolt-on to this one
- **RF5** — chargebacks affect Subscription, Invoice, Coupon, and Reward all at once; explicitly deferred to a future, dedicated Chargebacks chapter rather than answered piecemeal here

**Zero items remain open in the Failure Matrix.** Everything in this chapter is now either already
decided, mechanically implied by an existing decision, confirmed to not be a problem, or explicitly
and deliberately scoped out of this document.

---

## Chapter 20 — Ownership Matrix

**This chapter supersedes the earlier ownership tables in Chapter 6, Chapter 11 (§"An explicit
business-level Ownership Matrix"), and Chapter 13 (§"Super Admin Authority Matrix"), and it also
supersedes this chapter's own first draft.** All of those are kept exactly as originally written —
nothing is deleted, per this document's standing discipline — but they are now historical. This is
the final form, and the single authoritative source going forward.

### Purpose

Every business fact in the billing system has exactly one owner. Ownership answers four questions:
who creates this object, who is allowed to modify it, who is allowed to delete or archive it, and
which object is the source of truth when multiple objects reference the same concept. This is what
prevents race conditions, duplicated logic, conflicting writes, and multiple interpretations of the
same business rule. **This chapter introduces no new business rules — it explains why the
architecture already built in Chapters 1–19 remains internally consistent.**

### Ownership Law 1 — One Fact, One Owner

Every business fact has exactly one authoritative owner. Current subscription → Subscription.
Current entitlements → Billing Components. Future changes → Scheduled Change. Money owed → Invoice.
Payment authorization → Mandate. Coupon definition → Coupon. Referral relationship → Referral.
Earned reward → Reward. No second object may independently store or derive its own conflicting
version of the same fact. **`BillingCycle.status` is the one place this document found a live risk of
violating this law** (Chapter 18) — its status field is not its own source of truth; it strictly
mirrors `Invoice.status`, never decides independently.

### Ownership Law 2 — Single Writer

Each business object has exactly one engine responsible for changing its lifecycle. The Commercial
Change Engine owns Commercial Transactions. The Renewal Engine owns Scheduled Changes becoming
effective. The Retry Engine owns retry attempts. **Webhook handlers never invent business
decisions — they only record external facts** (Ownership Law 6 restates this from the vendor side).

### Ownership Law 3 — Historical Objects Are Immutable

Financial history never changes. After creation: Invoice contents never change. Invoice line items
never change. Coupon redemption records never change. Reward records never change. Payment attempts
never change except for lifecycle status. **Corrections always create new records rather than
rewriting history** — a billing-error correction (Chapter 19, CP5) is its own new, manually-initiated
Commercial Transaction of type `CORRECTION`, never an edit of the invoice it corrects.

### Ownership Law 4 — Configuration Never Rewrites History

Super Admin may modify Plans, Add-on Definitions, Coupon configuration, Referral configuration, and
Billing Policies. These changes affect only future calculations. Existing invoices remain exactly as
they were originally generated, regardless of any later configuration change.

### Ownership Law 5 — Future Intent Lives Only in Scheduled Changes

No object stores "pending" state internally. Subscription never stores `pendingPlan`,
`pendingBillingCycle`, or `pendingSeats`. Billing Components never store `pendingRemoval` or
`pendingQuantity`. The existence of a Scheduled Change is the only representation of future intent —
this is the direct generalization of Invariant 7 and the correction already made to the Billing
Component state machine (Chapter 16).

### Ownership Law 6 — External Systems Never Own Business State

Razorpay is never the source of truth. It only reports facts — payment captured, payment failed,
mandate confirmed, mandate revoked. Those facts are interpreted by the Billing Engine before any
business object changes. **Super Admin, too, has no direct write access to Mandate state** — the only
lever Admin has is "Request New Mandate," which simply re-sends the customer through the real
authorization flow (Chapter 13); Admin cannot reset, force-confirm, or fabricate any part of a
mandate directly, for the same reason Razorpay's facts can't be second-guessed.

### Ownership Law 7 — Derived State Is Never Persisted

States such as coupon expired, coupon not started, mandate expired, and (unless the business
explicitly adopts referral-link expiry) referral expired are derived when needed, not separately
stored. **Mandate `EXPIRED` specifically is derived only because Razorpay does not currently emit a
real expiry event** — if that ever changes, this one becomes a stored, factual transition instead
(Chapter 16); it is a conditional application of this law, not an exception to it.

### Ownership Law 8 — Every Mutation Has One Entry Point

Every business mutation begins through exactly one entry point: a customer action, a renewal, a
retry, a Super Admin action, or an external webhook. All downstream changes originate from that one
trigger — this is what makes Law 6's "one business event may touch several objects" (Chapter 20's
consolidated draft) safe: many objects may be created or updated in response, but there is always
exactly one originating trigger to point back to.

---

### Ownership Matrix

| Object | Created By | Updated By | Archived / Deleted | Source of Truth | Notes |
|---|---|---|---|---|---|
| Subscription | Registration | Renewal Engine, Commercial Change Engine (after payment); Retry Recovery; Suspension Engine (access only) | Never deleted — `CANCELLED` is terminal, cancellation replaces deletion | Customer's current commercial relationship | Exactly one active per organization; many historical ones may accumulate (Chapter 12) |
| Billing Component | Registration / Commercial Change Engine | Commercial Change Engine or Renewal Engine — quantity only, never a "pending" field | Removed (soft) when no longer active; re-purchase is always a new component | Customer entitlements | Base plan and add-ons; quantity lives on the component, pending changes never do (Chapter 16) |
| Scheduled Change | Customer / Admin, via the Change Engine | Renewal Engine (execution) or customer/system supersession (cancellation, with `Reason`) | Never deleted | Future customer intent | Append-only history; the one object replacing four previously-separate "pending X" fields |
| Commercial Transaction | Billing Engine (any commercial action, customer- or admin-initiated) | Itself, through its own state machine | Never | Commercial operation awaiting or having reached settlement | Business-intent fields immutable; only payment-execution bookkeeping mutates (Chapter 15) |
| Invoice | Billing Engine | Billing Engine — status only, never content | Never | Amount owed / amount billed | Immutable after generation; at most one collectible invoice per subscription at a time (Law 11) |
| Invoice Line Item | Billing Engine | Never | Never | Invoice breakdown | Immutable, exactly like the invoice it belongs to |
| Payment Attempt | Billing Engine | Billing Engine / Webhooks | Never | Individual payment execution | Historical; never reused across retries — each attempt is its own record |
| Mandate | Registration / Reauthorization | Mandate Webhooks only | Never | Payment authorization | New mandate created when required; **Super Admin cannot write to this object directly at all** — only "Request New Mandate" (Law 6) |
| BillingCycle | Billing Engine, triggered by Payment Success | Itself | Never | *Its own existence only* — **not its `status` field**, which mirrors Invoice.status | The deliberate exception to Law 1, named explicitly so it isn't rediscovered as a bug later (Chapter 18) |
| Coupon | Super Admin | Super Admin | Archive only, once real redemption history exists | Coupon definition | Never edits historical invoices; no stored lifecycle — a Policy Object, not a Lifecycle Object (Chapter 17) |
| Coupon Redemption | Billing Engine | Never | Never | Coupon usage history | Immutable; tied to Organization identity, survives any number of that organization's Subscriptions (Chapter 14) |
| Referral | Referral Engine | Referral Engine | Never | Referral relationship | `Pending → Qualified`, and now `→ Expired` (Chapter 17's reversal); permanently attached at signup, never re-attributable (Chapter 19, RF2) |
| Reward | Referral Engine / Super Admin | Super Admin (revocation only) | Never | Earned reward | Immutable after creation; belongs to the Organization, not the Subscription (Chapter 9, R1) |
| Reward Usage | Billing Engine | Billing Engine | Never | Reward reservation lifecycle | `Reserved → Consumed / Released`, with an explicit `releaseReason` (Chapter 13); at most one live reservation per reward |
| Plan | Super Admin | Super Admin | Archive | Product catalogue | Future subscriptions only — existing subscribers unaffected by archival (Chapter 19, AD4) |
| Add-on Definition | Super Admin | Super Admin | Archive | Add-on catalogue | Future purchases only, same pattern as Plan (Chapter 19, AD5) |
| Referral Program Configuration | Super Admin | Super Admin | Never (singleton config) | Current referral program terms | Disabling only affects future referrals, not already-earned rewards (Chapter 19, RF4); `honoredDuringTrial` is currently dead code, unread anywhere (Chapter 17/19, RF8) |
| Billing Policy | Super Admin | Super Admin | Replace | Global billing rules | Retry cadence, GST, grace period, proration formula — changes are always forward-only (Law 4) |

---

### Engine Ownership Matrix

This answers a different question: which engine is responsible for each business operation?

| Engine | Owns |
|---|---|
| Registration Engine | New Subscription, initial Billing Components, first Mandate acquisition. Also the sole owner of the `SUSPENDED → CANCELLED` precondition transition run immediately before creating a new Subscription for an organization that has a suspended one on file (Chapter 12's trial-restart resolution) — no other engine may write this transition outside of that precondition or the normal Chapter 4.2 cancellation flow. |
| Commercial Change Engine | Upgrades, add-ons, billing-cycle changes, Commercial Transactions, Downgrade Eligibility Validation (both at scheduling and at renewal-time re-validation, Chapter 19 DG4) |
| Renewal Engine | Renewals, Scheduled Change execution (the only engine ever allowed to transition one to `EXECUTED`) |
| Retry Engine | Payment retries, suspension progression |
| Billing Engine | Invoice generation, Payment Attempts, Billing Error Correction transactions |
| BillingCycle Engine | Period advancement, triggered only by the Payment Success fact |
| Coupon Engine | Coupon validation and redemption |
| Referral Engine | Referral qualification and Reward creation |
| Mandate Engine | Mandate acquisition and replacement — the only writer of Mandate state, alongside real Razorpay facts |
| Reconciliation Engine | Idempotent forward-repair of any partially-committed or orphaned state — never a rollback |
| Event Engine | Notifications and timeline events — strictly downstream, never gates a billing decision |
| Super Admin | Configuration only — catalog, policy, program settings; never a transaction-level fact |
| Webhook Processor | External fact recording only — signature verification and event persistence, never a business decision |

### Source-of-Truth Matrix

This is arguably the most valuable part of the chapter — every recurring "which object do I trust
for this" question, answered once.

| Business Question | Source of Truth |
|---|---|
| Which plan does the customer have? | Billing Component (base plan) |
| Which add-ons are active? | Billing Components |
| What changes are waiting? | Scheduled Changes |
| What does the customer owe? | Invoice |
| What actually got paid? | Paid Invoice + Payment Attempt |
| Can we charge automatically? | Mandate |
| Is this coupon valid right now? | Coupon, evaluated live (never a stored status) |
| Has this coupon already been used? | Coupon Redemption |
| Who referred whom? | Referral |
| Which rewards exist? | Reward |
| Which reward is reserved against this invoice? | Reward Usage |
| What are today's plan prices? | Plan |
| What retry cadence should be used? | Billing Policy |
| Did this billing period get paid? | Invoice — **never `BillingCycle.status` independently** |

### What this chapter deliberately still does not cover

Data retention/purge policy (SU6), organization merge/transfer (CX7), and chargebacks (RF5) remain
explicitly out of this specification's scope, per Chapter 19 — ownership for them belongs to whatever
future specification eventually addresses each.

### Final Principle

> **Every business fact has exactly one source of truth, exactly one owner responsible for changing
> it, and exactly one lifecycle. All other objects reference that fact rather than duplicating it.**

---

## ⚠️ Standing note (added after a major business-model change mid-specification — corrected twice in
one session, both times recorded rather than silently overwritten)

A manager-level business decision — annual billing as a repeating entitlement window, plus
independently-cadenced add-ons — arrived after the Renewal Engine (§3.5) and the Annual↔Monthly
proration decision (§4.1) were already marked done. The first correction pass introduced a "Billing
Bucket" model (cadence-consolidated). **That was itself superseded within the same session** by the
**Billable Item Model** (§3.7): every base-plan-or-add-on item is its own `BillableItem` with a
fully independent renewal anniversary — no consolidation by cadence at all. **`CAW_BILLING_DESIGN.md`'s
Subscription model (single `billingCycle` field) is now known-stale and needs its own revision pass —
not done as part of this edit, flagged so it isn't forgotten.** Lesson for how this document gets used
going forward: a "✅ done" mark means "correct against everything known at the time," not "will never
change" — this is exactly why superseded sections are kept and labeled, not deleted, even when they're
superseded twice in a row.

## Specification Roadmap (supersedes the earlier "next 2-3 days" list — that work is done)

**Done:** Change Engine (Chapters 3.2, 4.1-4.3), Renewal Engine (3.5), Retry philosophy (embedded in
3.5/§9), Subscription lifecycle, scheduling philosophy, immediate-vs-scheduled, Add-on model, Upgrade
model, Cancellation, Billing Cycle Change, Change precedence (Chapter 5 Section 1 + Phase 2). This is no
longer "implement upgrade / implement downgrade / implement cron" — it converged into the operating
system that runs the billing product, which is the actual milestone.

**⚠️ Correction (contradiction audit) — this roadmap was written mid-project and is now materially
stale; superseded by the actual final status below rather than left as a misleading "remaining work"
list.** At the time this roadmap was written, items 5 and 6 were genuinely incomplete and item 2's
four policy gaps were genuinely undecided — none of that is true any longer, and leaving the original
wording in place would actively mislead a reader about what's still open.

**Final status of every item on this list, as of the Version 1.0 freeze:**

1. **Invoice Engine** — ✅ done. The full pipeline, taxonomy, rounding rule (nearest rupee throughout),
   and same-day-due bundling question are all closed (§3.3, §3.7, Chapter 9's Commercial Event
   findings).
2. **Coupon Engine + Referral Engine** — ✅ done, and all four originally-listed policy gaps are now
   closed: combined coupon+referral exceeding the invoice is resolved (no negative invoices, no
   carry-forward, Chapter 19 RN4); zero-value invoices are a valid, period-advancing settlement
   (Chapter 19 RN14); coupon duration types and their interaction with rounding are specified (§3.6a,
   Chapter 19 CP4/CP8). The referral reservation-to-CAW-renewal connection remains real, not-yet-done
   *implementation* work (not a design gap) — unchanged from the original note.
3. **Billing Cycle Engine** — ✅ effectively done via Chapter 20's Payment Objects table, which gives
   `BillingCycle` its full ownership definition, including the explicit correction that its `status`
   field mirrors `Invoice.status` rather than deciding independently (Chapter 18). The R4
   compute-order-vs-commit-order question remains genuinely open, exactly as originally flagged — not
   resolved by this note. "Effective Subscription" remains an unconfirmed working term, also unchanged.
4. **Billing Orchestrator** — substantially subsumed by Commercial Transaction (Chapter 15) and the
   Ownership Matrix (Chapter 20), which together answer most of what an "Orchestrator" was reaching
   for — sequencing engine calls and owning workflow-level failure handling. Its precise relationship
   to the Commit Engine remains open, as originally flagged.
5. **Failure Matrix** — ✅ done. 137 scenarios (Chapter 19) plus Chapter 9's ~40 plus
   `CAW_BILLING_DESIGN.md`'s original ~10 comfortably exceed the ~150 target, and every item Chapter 19
   originally left open has since been closed (Chapter 19's own follow-up review, and this
   contradiction audit).
6. **Ownership Matrix** — ✅ done (Chapter 20), including the four-question framework (created by /
   updated by / deleted / source of truth) that goes beyond the "single owner" scope this item
   originally asked for.
7. **Policy Engine** — partially done. The individual values (proration formula, retry cadence, grace
   period, GST rate) are each specified where they're introduced and listed together in Chapter 20's
   Configuration Objects and Billing Policy rows, but a single dedicated Policy Engine chapter
   consolidating all of them with their exact configuration mechanics was never written. Left as
   genuinely open, low-severity, implementation-adjacent work.
8. **Scheduler Matrix** — ✅ done (Chapter 7), further confirmed and extended by Chapter 11's Phase 2C
   audit (the "capability-specific crons don't exist" finding and the Mandate Monitoring job).

**Net effect:** of the original eight roadmap items, six are now closed, one (Billing Orchestrator) is
substantially subsumed by later chapters with one narrow question still open, and one (Policy Engine
consolidation) remains genuinely unconsolidated but low-severity. This is consistent with, and
directly confirms, the "architecture is finished, only verification work remains" conclusion this
document reaches at its freeze.

---

## Chapter 21 — Billing Glossary

One definition per term, used consistently in every chapter above. Where a term was corrected or
superseded during this project, only the current definition appears here — see the relevant chapter
for the reasoning trail.

**Organization** — The one permanent entity in the billing domain. Does not begin or end the way a
commercial contract does; may own many Subscriptions over its lifetime, but only one current one
(Chapter 12).

**Subscription** — The customer's *current* commercial and mandate state for one Organization. Never
holds history. Exactly one `ACTIVE` per Organization at a time; a cancelled Subscription is never
reactivated — a new one is created instead (Chapter 12).

**Billing Component** (also: Billable Item) — The smallest independently-billable unit: a Plan or an
add-on. Each owns its own price snapshot, quantity, frequency, and renewal anchor. Answers "what is
recurring," never "what produces one invoice" (that's Commercial Event). Terminal once `REMOVED`; a
later re-purchase always creates a new component (Chapters 3.7, 10, 16).

**Commercial Event** — Answers "why are we billing right now, and what does this invoice cover?"
Exactly four active types: `NEW_PURCHASE`, `MID_CYCLE_PURCHASE`, `RENEWAL`, `RETRY` (plus
future-proofed `ADJUSTMENT`). A `RENEWAL` event bundles every Billing Component due that day into one
invoice (§3.7).

**Commercial Transaction** — The immutable record of one business decision — a customer's or admin's
actual intent (upgrade, downgrade, add-on purchase, cancellation, trial start, etc.), whether or not
it involves payment. States: `CREATED → PRICED → AWAITING_PAYMENT ⇄ FAILED → COMMITTED → COMPLETED`,
or `VOID`. Business-intent fields are immutable; only payment-execution bookkeeping mutates
(Chapters 15, 18).

**Scheduled Change** — A promise that a future commercial action will happen once its conditions are
met (renewal day, successful payment). States: `PENDING → EXECUTED` or `PENDING → CANCELLED` (with a
`Reason`). The single object representing every kind of deferred intent — downgrades, cancellations,
add-on removals, quantity reductions — replacing four previously-separate "pending X" concepts
(Chapter 16).

**Billing Anchor** — The date a given Billing Component was added or purchased; its own independent
renewal anniversary. Never resets on upgrade, downgrade, cadence change, or late-payment recovery
(§3.7).

**Billing Cycle** — One period's record: what was invoiced, charged, and what happened. Its own
`status` field is not its own source of truth — it strictly mirrors `Invoice.status` (Chapter 18, 20).

**Invoice** — The priced, frozen output of one Commercial Event. Immutable after generation except
for its own status field (`PENDING_PAYMENT → PAID / FAILED / VOID`). At most one collectible
(unpaid, non-`VOID`) invoice may exist per Subscription at a time (Law 11).

**Payment Attempt** — One specific charge attempt against an Invoice. Never reused across retries —
every attempt, including retries, is its own new record (Chapter 10).

**Mandate** — The Razorpay-side reusable authorization that lets the business charge a customer on
demand, up to a cap. States: `PENDING → ACTIVE → (EXPIRED | REVOKED)`, or `PENDING → FAILED`. Only
real vendor facts and the Acquire-Mandate flow may write to it — Super Admin has no direct write
access, only "Request New Mandate" (Chapters 16, 20).

**Renewal** — The recurring moment a Subscription is billed again for continuing service, driven by
the Renewal Engine and priced by the Invoice Engine (§3.5).

**Retry** — The automatic re-attempt of a failed renewal charge, on a configurable cadence (default:
3 attempts over ~5 days), owned exclusively by the Retry Engine (§3.5, §9).

**Coupon** — A Policy Object, not a Lifecycle Object: `isActive` plus start/expiry dates are
evaluated live at the moment of use; there is no stored coupon status (§3.6a, Chapter 17).

**Coupon Redemption** — The permanent, immutable record that a specific Organization redeemed a
specific coupon. Only ever created against a `PAID` invoice. Tied to Organization identity, surviving
any number of that Organization's Subscriptions (Chapter 14).

**Referral** — The record of one Organization signing up through another Organization's specific
referral link. States: `pending → qualified` (on first payment) or `pending → expired`. Permanently
attached at signup; never re-attributable afterward (Chapters 17, 19).

**Reward** — An earned entitlement, granted the moment a Referral qualifies (or via Super Admin
manual grant). Immutable except for a soft `revokedAt`. Belongs to the Organization, not the
Subscription, and survives across any number of that Organization's Subscriptions (Chapters 9, 10).

**Reward Usage** — The reservation of a specific Reward against a specific Invoice attempt. States:
`reserved → consumed` (only on confirmed payment) or `reserved → released` (with a `releaseReason`).
At most one live reservation per Reward at a time (Chapter 10, 13).

**Carry-forward** — At a plan change, the customer's explicit choice to keep a currently-owned,
still-compatible add-on on the destination plan. Never assumed either way; add-ons the destination
plan doesn't support at all are auto-scheduled for removal instead (§3.2).

**Entitlement Window** — The 12-month period an annual-plan customer is actually purchasing,
anchored to their original first-ever payment date — not a fresh 12 months from whenever they most
recently touched their account (§3.7).

**Downgrade Eligibility Validation** (also: the Usage Compatibility Rule) — The mandatory check that
a customer's actual usage of every limited resource fits within a destination plan's capacity (base
plus carried-forward add-ons) before a downgrade may be scheduled, and again before it may execute
(Chapter 12, 19 DG4).

**Snapshot** — A value frozen at a specific moment (a price, a plan's terms, a discount) and stored
directly on the record that used it, so that record's meaning never changes even if the live
configuration it was drawn from later changes. Invoices are the primary example (Law 3).

**Source of Truth** — Whichever single object is authoritative for a given business fact. Every
other object that references the same concept must derive from it, never decide independently
(Ownership Law 1, Chapter 20).

**Effective Subscription** — ⚠️ *A working term, not yet formally confirmed* — the renewal-time
projected state of a Subscription after every due Scheduled Change is applied, computed before
payment, committed only after (§3.5 R3).

---

## Chapter 22 — Core Billing Principles (the Constitution)

Ten business principles, not technical ones. Every Law, Invariant, and chapter above derives from
these. A future feature request should be evaluated by asking "does this violate one of these?" —
before any design or code is written, the same discipline applied throughout this document.

1. **Never mutate before payment.** No commercial fact changes until money has actually moved,
   except the single narrow exception of marking an account `past_due`.
2. **Every commercial action is append-only.** A change of mind, a retry, a correction — each is a
   new record layered on top of history, never an edit of what came before.
3. **One invoice has one reason.** Even when several things are bundled into it, an invoice records
   a single, clear cause for its own existence.
4. **Invoices are immutable.** Once generated, an invoice's content never changes — only its payment
   status may still move.
5. **Scheduled work executes only after successful payment, and only as part of the same commit
   that confirms it.**
6. **A failed payment never commits any state.** If a charge doesn't succeed, nothing about the
   customer's plan, add-ons, or scheduled changes is any different than before the attempt.
7. **Billing is idempotent.** Any operation — a webhook, a retry, a reconciliation pass — may run
   more than once without ever double-charging, double-crediting, or double-anything.
8. **Customers always see line-item transparency.** Every number on a bill is shown individually,
   never collapsed into an unexplained total.
9. **Support must be able to reconstruct every bill.** Given an invoice, its inputs (plan, add-ons,
   coupon, referral, tax) must be fully recoverable, even years later.
10. **Every business fact has exactly one owner.** No two engines, objects, or actors may
    independently decide the same fact.

---

## Version 1.1 — Current

```
Billing Domain Specification
Version 1.1 (Version 1.0 frozen; V1.1-001 adopted per the Change Process below)

Status: FEATURE-FROZEN, PENDING IMPLEMENTATION

No behavioral changes without a documented design decision.
```

**Change log:**
- **V1.1-001** — Commercial Actions During Pending Cancellation (§4.2). Immediate, pay-now actions
  (upgrade, add-on purchase, billing-cycle change) are now allowed while a cancellation is pending,
  up until it takes effect; only *scheduled* changes remain blocked. Superseded text preserved in
  §4.2, not deleted.

**Feature-frozen, not "finished and untouchable."** The business model itself has reached closure —
every lifecycle (Subscription, Commercial Transaction, Invoice, Scheduled Change, Billing Component,
Mandate, Coupon, Referral, Reward, Reward Usage), every Law and Invariant, the Ownership Matrix, the
Failure Matrix, the Interaction Matrix, and the state machines are all complete and internally
consistent, confirmed by this document's own contradiction audit. What "feature-frozen" specifically
means: no new business concept is expected to be *discovered* during implementation — the contradiction
audit that preceded this freeze found documentation-consistency problems (a stale cross-reference, a
superseded name left in place, an out-of-date roadmap), never an architectural one. Implementation is
still expected to surface real tweaks — every production billing system does — but those are Version
1.1, 1.2, and so on: refinements to a settled foundation, not the discovery of a missing concept.

This document, together with `CAW_BILLING_DESIGN.md` (the tactical companion) and
`BILLING_SYSTEM_EXPLAINED.md` (the plain-language companion), is the single source of truth for the
billing domain's business behavior. From this point forward:

- **A business rule stated here may not be silently changed by implementation.** If an engineering
  discovery reveals a rule needs to change, that change is proposed, discussed, and recorded in this
  document first — the same discipline followed throughout its construction (superseded, never
  silently overwritten) — before code is written to match it.
- **Only one item remains genuinely open as a business question: the three areas explicitly moved
  out of this document's scope entirely** — data retention/purge policy, organization merge/transfer,
  and chargebacks (Chapter 19). Everything else previously listed as "open" has been reclassified at
  this freeze, not left ambiguous:
  - The R4 renewal-ordering question (§3.5) — **closed**, resolved by consolidation with R10 (add-on
    compatibility is already settled at scheduling time, not renewal time; there was no real conflict
    once that connection was made).
  - "Effective Subscription" naming (§3.5) — **closed**, an editorial choice, now locked as the
    permanent term.
  - The Billing Orchestrator's relationship to the Commit Engine (§3.9) and Policy Engine
    consolidation (Chapter 20's Roadmap correction) — **reclassified as implementation-track work,
    not open business questions.** Both are about how the already-decided business rules get
    organized in code, not what the rules are; they do not block this freeze and do not need a
    business decision to resolve.
- **Implementation documentation is a separate, evolving layer.** API contracts, database migrations,
  service boundaries, job scheduling, event flows, and module breakdowns may all change freely as
  engineering work proceeds — none of that requires revisiting this document, provided it doesn't
  change what this document has already decided.
- **This document itself may still be corrected** if implementation surfaces a genuine contradiction
  or a real product change occurs — but any such change is itself a documented design decision, added
  the same way every other correction in this document was: recorded, not silently overwritten.

### The Version 1.1+ Change Process

**No quiet edits to Version 1.0.** Once implementation begins, this document is not touched
ad hoc — a discovery that something needs to change follows a fixed process, so the architectural
history stays as clean as everything recorded above it:

1. **Raise a Version 1.1 Change Proposal** — named as such, not folded silently into a passing edit.
2. **Explain why implementation exposed a flaw** — what was actually discovered, not a hypothetical.
3. **Describe the impact** — which chapters, Laws, or Ownership rows the change would touch.
4. **Accept or reject it explicitly** — the same deliberate confirmation every other decision in this
   document received, never assumed.
5. **Update the spec accordingly** — superseding the affected section with the same discipline used
   throughout (recorded, not silently overwritten), incrementing the version number.

This is what keeps the specification the source of truth that code is measured against, rather than
documentation that quietly drifts out of sync with whatever the code ends up doing.

---

**Scope at freeze, for the record:** the domain model, every object lifecycle, the Failure Matrix,
Interaction Matrix, Ownership Matrix, the Laws, Invariants, Core Billing Principles, and the Billing
Glossary are all Version 1.0, frozen. Data retention/archival policy, organization merge/split, and
chargebacks/payment disputes are consciously deferred to their own future specifications, not
unfinished work. Everything else — Policy Engine, Billing Orchestrator, Commit Engine, scheduler,
database schema, APIs, cron jobs, idempotency and locking implementation, the Razorpay integration
itself, UI/admin screens, and testing — is implementation work, driven by this specification rather
than shaping it.
