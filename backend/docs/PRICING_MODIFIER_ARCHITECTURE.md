# Pricing Modifier Architecture — Design Specification (no code yet)

*Timeless design, like `ARCHITECTURE.md` — describes an abstraction, not a
status. Written before `REFERRAL_SYSTEM_DESIGN.md` is implemented, on
purpose: referrals are the first consumer of this abstraction, not a
special case that this abstraction was reverse-engineered from. If a future
change to referrals only makes sense by special-casing something inside the
Pricing Engine, that's a signal this document is being violated, not a
signal to add an exception.*

---

## 0. Why this document exists

Coupons exist today. Referral rewards are designed (`REFERRAL_SYSTEM_DESIGN.md`)
but not built. Partner discounts, loyalty credits, seasonal promotions, and
employee discounts don't exist yet but will eventually be asked for. Without
this document, each one becomes its own hardcoded stage bolted onto the
Pricing Engine — exactly the "five call sites, same formula, retyped five
times" smell `PROJECT_STATE.md` §9 found and fixed for base pricing. This
document does the equivalent generalization for *discounts*, before a
second one (referrals) gets built and locks in the pattern of "one discount
type = one hardcoded engine stage."

**The abstraction: a coupon is not special. It is one instance of a Pricing
Modifier.** Referral rewards are another instance. Every future discount
type is another instance. The Pricing Engine should apply an ordered list
of modifiers and never need to know which kind any of them are.

---

## 1. The evolved system flow

The flow documented in `ARCHITECTURE.md` §0 gets one new stage inserted
between Settlement and the Pricing Engine:

```
Business Action
      ↓
Intent (pending state)
      ↓
External Confirmation (payment / webhook / renewal)
      ↓
Settlement (single owner — the only stage allowed to mutate
            canonical Subscription state)
      ↓
Modifier Resolution  ←── NEW
      ↓
Pricing Engine (pure calculation)
      ↓
Pricing Snapshot
      ↓
Invoice / Order / Payment
      ↓
Billing Events
      ↓
Billing Center UI (Timeline, History, sidebar)
```

**Why this stage has to exist separately, not be folded into settlement or
the engine:** settlement's job is deciding *what happened* (a plan changed,
an add-on was added, an invoice is being computed). The Pricing Engine's
job is pure arithmetic on a fixed set of inputs. Neither should own "which
discounts currently apply to this organization, in what order" — that's a
lookup and prioritization problem, not a settlement decision or arithmetic.
Without this stage, that lookup logic ends up duplicated inside settlement
call sites (querying coupons here, querying referral rewards there) exactly
the way pricing arithmetic used to be duplicated before the engine existed.

---

## 2. The Modifier Resolver

**Input:** an organization (and enough context to know what's being priced
— plan, billing cycle, whether this is a new subscription vs. a renewal vs.
an upgrade).

**Output:** an ordered list of `Modifier` objects, each already resolved to
a concrete value — no further DB lookups needed by the engine.

**What it does, concretely:**
1. Looks up every discount-bearing entity that could apply (an active
   coupon on the subscription, an available referral reward, eventually a
   partner discount or loyalty credit).
2. Resolves each into a common `Modifier` shape (§3).
3. Applies eligibility filtering (is this modifier valid for this plan /
   billing cycle / action type).
4. Orders them by priority.
5. Applies stacking rules (does a lower-priority modifier still apply if a
   higher-priority one already consumed the "stacks with others" slot).

**What it explicitly does not do:** it does not compute money. Resolving
"this org has a 20%-off referral reward available" is not the same as
computing what 20% of ₹3400 is — that arithmetic still belongs entirely to
the Pricing Engine. The resolver's output is inert data; the engine is the
only thing that does arithmetic on it.

**Where DB I/O lives:** here, not in the Pricing Engine. This is exactly the
same split `PROJECT_STATE.md` §9 already established for coupon eligibility
(`discountEngine.evaluateOrderEligibility` is I/O and stays outside the
pure pricing function) — the resolver generalizes that one-off split into
the permanent architecture, rather than every new modifier type needing to
rediscover it independently.

---

## 3. The Modifier interface

Every discount-bearing thing — coupon, referral reward, future types —
must be resolvable into this common shape before it reaches the engine:

```
Modifier
  type            — 'coupon' | 'referral' | 'partner' | 'loyalty' | ... (open set)
  source          — where this modifier's value actually came from
                    (see REFERRAL_SYSTEM_DESIGN.md §5 for the concrete
                    source enum for referral-adjacent modifiers)
  priority        — lower number = applied earlier in the discount sequence
  value           — { kind: 'percentage' | 'fixed', amount: number }
  appliesTo       — 'entire_invoice' | 'plan_only'
  stackable       — whether a lower-priority modifier can still apply
                    after this one
  referenceId     — the id of whatever produced this modifier (a Coupon
                    document id, a ReferralReward usage id, ...) — for
                    tracing/auditing which record a line-item discount
                    came from, never for the engine to re-derive anything
```

The Pricing Engine's job becomes: given `basePrice + addonsTotal` and an
ordered `Modifier[]`, apply each in priority order, respect `stackable`,
and return the snapshot. It has no `if (type === 'coupon')` branch anywhere
— type only matters to whoever produces the `referenceId`, never to the
arithmetic.

**Priority ordering today, concretely:** coupon before referral reward
(matching the existing discount order in `REFERRAL_SYSTEM_DESIGN.md` §8) —
expressed as coupon having a lower `priority` number than referral. This is
data (an assigned priority per modifier type), not a hardcoded stage in the
engine — reordering discount precedence in the future is a config change,
not an engine change.

---

## 4. Consuming a modifier — settlement's role, not the engine's

Resolving a modifier and *consuming* it are different moments. The engine
computing a snapshot that happens to include a referral reward's discount
does not, by itself, mark that reward as used — only settlement does that,
following the exact same intent → settlement split used everywhere else:

```
Modifier resolved (available) → included in a Pricing Snapshot (reserved)
      → invoice/payment settles → modifier's underlying record marked consumed
```

If the payment this snapshot was computed for never settles (abandoned
checkout, failed payment), the modifier's underlying record must revert to
available — the resolver/engine having *seen* a modifier is not the same as
it having been *spent*. This mirrors `REFERRAL_SYSTEM_DESIGN.md`'s
reward-reservation lifecycle (Available → Reserved → Consumed, or back to
Available on failure) exactly, generalized: every modifier type that can be
"used up" needs the same three-state lifecycle, not just referral rewards.

---

## 5. What this does NOT change

- The Pricing Engine's existing pure-function contract
  (`ARCHITECTURE.md` §4) is unchanged — modifiers are just a more general
  shape for the "discount" input it already accepts.
- Coupon eligibility logic in `discountEngine.js` is unchanged in behavior
  — it becomes one modifier *producer* that the resolver calls, not a
  redesign of how coupons themselves work.
- Nothing here requires touching Razorpay or any settlement code that's
  currently frozen pending Charge-at-Will. This entire abstraction sits in
  the domain layer (`ARCHITECTURE.md` §7) and is provider-independent by
  construction — it doesn't know or care what payment provider eventually
  settles the invoice it discounted.

---

## 6. Relationship to `REFERRAL_SYSTEM_DESIGN.md`

That document should be read as: "here is how referral rewards implement
the Modifier interface defined here, and here is the referral-specific
lifecycle (Referral → Reward → RewardUsage) that produces one." Where the
two documents could be read as disagreeing, this one wins on anything about
the *engine/resolver contract*; the referral doc wins on anything
referral-specific (self-referral rules, referral code lifecycle, fraud
signals, referral analytics). Future modifier types (partner discounts,
loyalty credits) should each get their own short design note that does the
same thing this relationship does for referrals — implements this
interface, doesn't redefine it.
