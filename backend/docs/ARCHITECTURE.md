# Billing System — Architecture

*Timeless design rules and blueprints — describes how the system is supposed
to work, not what state it's in today. This file should barely change
release to release. It contains no function names, file paths, line
numbers, or "currently N writers" counts — those are implementation facts
and belong in `PROJECT_STATE.md`, which maps each rule/role below onto the
code that plays it today, including where that mapping is currently broken.
If you're about to write a function name or a status word like "done" or
"broken" in this file, it belongs in `PROJECT_STATE.md` instead.*

Read this first if you're new to the project. Then `PROJECT_STATE.md` for
what's actually built and what's next.

---

## 0. System flow, one page

Every business action — upgrade, add-on purchase, seat purchase, downgrade,
cancellation — moves through the same four stages. This is the shape to
hold in your head before reading anything else below.

```
                 User Action
                      │
                      ▼
              Initiation Service
                      │
             writes pending* (intent only)
                      │
                      ▼
          Payment / Renewal / Cron
           (external confirmation)
                      │
                      ▼
                 Settlement
                      │
        updates Subscription — the ONLY
           stage allowed to do so
                      │
                      ▼
            Modifier Resolution
     (coupon, referral reward, future
      modifier types → ordered list)
                      │
                      ▼
               Pricing Engine
                      │
                      ▼
               Pricing Snapshot
                      │
      ┌───────────────┼────────────────┐
      ▼               ▼                ▼
BillingEvent   SubscriptionPayment   Invoice / UI
      │               │                │
      └───────────────┼────────────────┘
                      ▼
              Billing Center UI
```

Everything before Settlement records what the customer *wants*. Only
Settlement decides what's *true*. Everything after Settlement is a read
derived from that truth — never an independent writer of it. Modifier
Resolution and the Pricing Engine are pure/derivation stages, not
additional settlement owners — full detail: §4 and
`PRICING_MODIFIER_ARCHITECTURE.md`.

---

## 1. Architecture invariants

Check every proposed billing change against this list before writing code.
If a change introduces a second writer to a field, bypasses settlement,
reimplements pricing/entitlement logic instead of deriving it, or lets a
payment provider decide business state, it violates one of these and needs
to be redesigned, not merged.

1. **Every business action has exactly one initiation path.**
2. **Every business action has exactly one settlement owner** — the single
   function/handler allowed to act on a `pending*` field and turn it into
   canonical state.
3. **Canonical `Subscription` state is only mutated during settlement.**
   Initiation records intent only.
4. **Every settlement emits exactly one immutable `BillingEvent`.**
5. **Pricing is computed by a single pricing engine**, not re-derived
   independently at each call site.
6. **Entitlements are derived from canonical state**, never cached or
   computed independently elsewhere.
7. **Every mutable field has one authoritative writer.** If you're about to
   add a second function that writes a canonical field, stop — route
   through the existing writer instead.
8. **External providers never own business state.** A payment provider
   confirms that money moved. It does not decide the plan, entitlements,
   pricing, coupons, seats, or lifecycle state — those are always decided
   by settlement, using the provider's confirmation as one input.
9. **Business logic is provider-independent.** The pricing engine,
   entitlements, coupons, and seat logic know nothing about any specific
   payment provider's API. Only a thin adapter layer talks to the provider;
   everything else would work unchanged if the provider were swapped.

None of these hold universally yet — `PROJECT_STATE.md` tracks which rules
are currently violated, by what, and why (frozen decision vs. genuine bug vs.
dead code). New code must not add violations even while old ones are being
paid down.

---

## 2. The settlement model

Every business action is shaped the same way, regardless of which fields it
touches: intent is recorded before anything external happens, external
confirmation arrives independently and asynchronously, and exactly one
function is trusted to turn that confirmation into canonical state.

**Why intent and settlement are different stages, concretely:** a customer
can start an upgrade and never complete payment. If initiation wrote
canonical state directly, the subscription would show a plan nobody paid
for. Recording intent and only settling on confirmed payment means an
abandoned action leaves no trace in canonical state — just an inert
pending-state field, harmless until acted on.

**Why settlement must be singular:** if two functions can both act on the
same confirmation (e.g. a webhook and a cron job, or a client-side confirm
and a server webhook), they race. Whichever runs first wins silently, and
anything the loser would have done — emitting an event, sending a
notification — simply doesn't happen. There is no partial credit for "two
paths that usually agree."

---

## 3. Billing state machine

The blueprint both the backend and any UI that shows subscription state
(e.g. a timeline) should agree on. Each row is a transition: what triggers
it, what role settles it, and what that settlement is allowed to touch.

| # | From state | To state | Trigger | Settlement owner (role) | Canonical fields touched | Event emitted |
|---|---|---|---|---|---|---|
| 1 | *(none)* | Trial | Start trial | Trial-start handler (no external confirmation needed — it's free) | plan, lifecycle status | Trial started |
| 2 | Trial | Active | Trial converts to paid | Payment-confirmation handler | plan, lifecycle status, payment-confirmed flag | Subscription created |
| 3 | *(none)* | Active | New paid subscription | Payment-confirmation handler | plan, lifecycle status, payment-confirmed flag | Subscription created |
| 4 | Active | Upgrade pending | Customer requests a higher tier | Upgrade-initiation handler (intent only) | *(none)* | *(none until settled)* |
| 5 | Upgrade pending | Active (new plan) | Payment confirmed | Upgrade-settlement handler | plan, recurring amount, entitlements | Plan upgraded |
| 6 | Active | Downgrade scheduled | Customer requests a lower tier | Downgrade-initiation handler (intent only) | *(none)* | Downgrade scheduled |
| 7 | Downgrade scheduled | Active (new plan) | Next renewal | Renewal-settlement handler | plan, recurring amount | Plan downgraded |
| 8 | Active | Active (+add-on) | Customer buys an add-on | Add-on-initiation handler (intent only) | *(none)* | *(none until settled)* |
| 9 | *(add-on pending)* | Active (+add-on) | Payment confirmed | Add-on-purchase-settlement handler | entitlements, recurring amount | Add-on added |
| 10 | Active | Removal scheduled | Customer removes an add-on | Add-on-removal-initiation handler (intent only) | *(none)* | Add-on removal scheduled |
| 11 | *(removal scheduled)* | Active (removed) | Next renewal | Renewal-settlement handler | entitlements, recurring amount | Add-on removed |
| 12 | Active | Cancellation scheduled | Customer cancels | Cancellation-initiation handler | cancellation flag | Cancellation scheduled |
| 13 | Cancellation scheduled | Cancelled | Cancellation takes effect | Cancellation-finalization handler | lifecycle status | Cancellation completed |
| 14 | Any active state | Past due | Renewal charge fails | Renewal-settlement handler (failure path) | lifecycle status, payment status | Payment failed |

**Reading this table as a review tool:** before touching any billing flow,
find its row (or add one). If your change would touch a canonical field
from anything other than that row's settlement owner, you're adding a
second writer — stop and route through the existing owner instead.

`PROJECT_STATE.md` maps each "settlement owner (role)" above onto the actual
function/handler that plays it today, and flags which rows currently have
more than one owner or a missing one.

---

## 4. Pricing engine

**The question every pricing bug ultimately traces back to:** *who decides
how much the customer should pay?* The answer must be exactly one thing: a
single, pure function of the subscription's current state.

**Target abstraction — the Pricing Snapshot:**

```
Pricing Snapshot
  ├── plan
  ├── billingCycle
  ├── basePrice
  ├── addonBreakdown       (per add-on: key, quantity, unit price, line total)
  ├── couponBreakdown       (rule applied, discount amount)
  ├── subtotal
  ├── gst
  ├── grandTotal
  ├── recurringAmount       (what gets charged every cycle going forward)
  ├── oneTimeProration       (if this snapshot represents a mid-cycle change)
  └── generatedAt
```

One function takes `(plan, billingCycle, activeAddons, coupon)` and returns
this snapshot. Nothing else computes pricing arithmetic — every caller
consumes the snapshot instead of re-deriving figures:

- Orders are created from a snapshot's `oneTimeProration`.
- The recurring plan amount comes from a snapshot's `recurringAmount`.
- The Timeline shows a snapshot's breakdown as the "what changed" detail.
- `BillingEvent` freezes a snapshot as its before/after, instead of
  freezing raw fields.
- Invoices (once they exist) render a snapshot directly.
- Analytics (once they exist) aggregate over stored snapshots instead of
  re-deriving revenue from raw subscription fields.

One object, computed in one place, consumed everywhere.

**Design constraints:**
- Pure function — no I/O, no payment-provider calls, no DB writes. Turning
  a snapshot into a provider-side price change (e.g. updating a recurring
  plan) is a separate, thin adapter step — pricing itself has no side
  effects and knows nothing about any specific provider (invariant #9).
- Every current call site that independently computes
  `base + addons − coupon + GST` should eventually call this function and
  use its output instead.

The fields above illustrate the shape, not a frozen contract — an actual
implementation may name or split them differently (e.g. a single `discount`
number instead of a `couponBreakdown`) as long as it stays pure and every
caller consumes it instead of re-deriving figures. `PROJECT_STATE.md` has
the current implementation status and its exact shape.

**Pricing modifiers — the generalization a coupon is one instance of.** A
coupon is not special; it's one instance of a general concept: a **pricing
modifier** — something with a type, a priority/order, a value, eligibility
rules, and application rules (entire invoice vs. a subset), resolved by a
dedicated Modifier Resolution stage (§0) and applied by the engine in
sequence before computing GST. Referral rewards, and anything later like
partner discounts or loyalty credits, are further instances of the same
concept, not new special cases requiring the engine itself to change
shape. The engine's job is to apply an ordered list of already-resolved
modifiers and return the snapshot — it should never need a new hardcoded
stage per discount type, and it never does the DB lookups that decide which
modifiers apply (that's the resolver's job, kept separate on purpose — see
invariant #5's "pure function" requirement). Full design, including the
resolver's contract: `PRICING_MODIFIER_ARCHITECTURE.md`. Referrals as the
first concrete consumer of it: `REFERRAL_SYSTEM_DESIGN.md`.

---

## 5. Finding taxonomy

When auditing any billing flow against the invariants above, classify what
you find into one of four buckets — they imply different work, and mixing
them into one flat "gap list" hides that:

- ✅ **Canonical** — single path, matches the invariants.
- ⚠ **Deferred by architecture decision** — a known violation, intentionally
  not fixed because an upstream decision (e.g. a payment-provider migration)
  might change the correct fix.
- ✕ **Duplicate implementation** — two or more independent code paths doing
  the same business action.
- 🗑 **Dead/orphaned** — code that references state nothing else writes
  anymore, left over from a prior implementation.

`PROJECT_STATE.md` is where these findings live, tagged, with the actual
file/function references.

---

## 6. Review lens

Before touching any billing code, ask, for each canonical field the change
might touch: **who is allowed to mutate this?** If the honest answer is
"more than one function" — that's the finding, independent of whether the
change in front of you touches that field directly. This is a healthier
review question than "which controller changed?" — it reviews ownership of
state, not the shape of a diff.

---

## 7. Target layering (aspirational — not reflected in folders yet)

As this grows, the natural shape to converge on is a standard layered
architecture, with the payment provider pushed to the edge rather than
threaded through the middle:

```
Presentation
────────────────────────────────────────
Billing Center · User Management · Checkout
────────────────────────────────────────
Application layer
Upgrade Service · Add-on Service · Seat Service · Cancellation Service
────────────────────────────────────────
Domain layer
Subscription · Pricing Engine · Settlement · BillingEvent · Entitlements · Coupons
────────────────────────────────────────
Infrastructure
Database · Payment Provider · Email · Cron · Webhooks
```

The domain layer is where invariants #5, #6, #8, #9 live — it must be
expressible, tested, and reasoned about without ever mentioning a specific
payment provider. The infrastructure layer is the only place that provider's
name should appear. This is what makes a future provider migration (or
adding a second provider) a contained change instead of a rewrite: if the
domain layer is genuinely provider-independent, swapping the adapter
underneath it doesn't touch pricing, entitlements, coupons, or seat logic
at all.

Not a refactor to do in one pass — a direction to keep nudging every future
change toward.

---

## 8. Frontend rules

The backend invariants above (§1) exist so canonical state has exactly one
writer. The frontend's job is to *display* that state, never to compete
with settlement as a second source of truth. Four rules follow directly from
that:

1. **The frontend never confirms its own settlement.** After a checkout, the
   UI's job is to wait for the backend's settlement to happen and reflect
   it — not to decide for itself that payment succeeded. Concretely: the
   success state a user sees must come from re-reading canonical state
   (poll until the backend shows it settled), never from the checkout
   widget's own success callback alone. A payment popup reporting success is
   evidence a charge was attempted, not proof settlement happened.
2. **One resource, one fetch path.** If two components need the same backend
   resource (a subscription, a plan catalog, a seat count), there is one
   shared place that fetches and holds it, and every consumer reads from
   there. A second, independent fetch of the same resource is the frontend
   equivalent of a second writer — it can show two different values for the
   same fact at the same time.
3. **Client-side pricing math is a preview, never a source of truth, and
   must be visibly provisional.** It's fine to estimate a total before the
   backend has priced anything (e.g. while a user is still choosing add-ons)
   — but the moment a backend-computed number exists for the same figure,
   the UI shows that number, not its own arithmetic. A screen must never
   show a locally-computed final total as if it were confirmed.
4. **Business constants and business rules live on the backend, not
   hardcoded in the frontend.** Tax rates, plan-tier ordering, coupon
   eligibility rules — anything that determines a monetary outcome or an
   entitlement decision is data the backend already has and should expose,
   not a constant duplicated into a component. A duplicated constant is a
   silent-drift risk: it works fine until the backend's version changes and
   the frontend's copy doesn't.

`PROJECT_STATE.md` has the current audit of the billing frontend against
these four rules, including which flows currently violate rule #1 (there
are shipped ones) and where rule #4's constants are duplicated today.
