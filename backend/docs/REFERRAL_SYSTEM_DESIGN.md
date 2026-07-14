# Referral System — Design Specification (architecture-first, no code yet)

*This is a design document, not an implementation plan. Nothing here should
be built until this design is reviewed and agreed. Pairs with
`PRICING_MODIFIER_ARCHITECTURE.md`, which owns the generic modifier
interface/resolver contract — this document owns everything referral-
specific (entity model, referral lifecycle, fraud signals, referral
analytics) and implements that interface rather than redefining it. For
whether/when to build this, see `PROJECT_STATE.md`. Written before writing
any referral code, specifically so the data model and settlement
boundaries are right the first time — this is exactly the kind of thing
that's expensive to redo once real referral data exists.*

---

## 0. Goal

Design a referral system that:

- follows every invariant in `ARCHITECTURE.md` §1,
- is a **consumer of** the Pricing Engine via the Modifier interface
  (`PRICING_MODIFIER_ARCHITECTURE.md`), not a second pricing mechanism,
- is provider-independent (owes nothing to Razorpay or any specific payment provider),
- introduces no new duplicate writers,
- keeps every record it produces immutable and auditable,
- scales to thousands of referrals without a redesign,
- doesn't need to be redesigned when the next discount type (partner
  program, loyalty credit, seasonal promo, ...) shows up.

---

## 1. Overall philosophy

**The referral system is not a marketing feature. It is a billing feature.**
It must obey the same architecture as subscriptions, upgrades, add-ons, and
coupons. A referral must never directly modify canonical billing state —
it participates in the same intent → settlement pipeline as every other
business action (`ARCHITECTURE.md` §0/§2). Referrals are the first consumer
of the generic **Pricing Modifier** concept
(`PRICING_MODIFIER_ARCHITECTURE.md`), not a one-off special case bolted
onto the pricing engine.

---

## 2. Four distinct entities, not one

A first draft of this design conflated "referral" and "reward" into one
concept. They're not the same thing, and neither is a "referral code" the
same as a "referral program." Four separate entities, each with a single
responsibility:

```
Organization
    ↓ owns
ReferralProgram        — the configured rules an org's referrals operate under
    ↓ generates
ReferralCode            — the shareable code itself (an org can have more than one, e.g. reissued)
    ↓ used by
Referral                — one specific instance of another org signing up with a code
    ↓ produces, on qualification
Reward                  — an immutable grant, created once, never edited
    ↓ tracked via
RewardUsage              — one row per attempt to apply the reward to an invoice
```

Why split this far: a `ReferralCode` can be reissued or rotated without
losing the history of `Referral`s it already produced. A `Reward`, once
earned, must never change even if the organization's `ReferralProgram`
configuration changes later (§7). Whether a reward was actually *used* is a
separate question from whether it was *earned* — tracked by `RewardUsage`,
not by mutating the `Reward` itself (§6).

---

## 3. How referrals fit the existing architecture

Today, every business action looks like:

```
Business Action → Intent → External Confirmation → Settlement → Canonical State → Billing Events
```

Referrals should look identical:

```
Organization A shares a referral code
        ↓
Organization B's referral code becomes known and validated
        (intent — Referral record, status: pending)
        ↓
Organization B's first payment is captured       (external confirmation)
        ↓
Settlement: Reward created (immutable)           (the ONLY place a Reward comes into existence)
        ↓
Modifier Resolver surfaces the reward as an available Modifier on a later invoice
        ↓
Pricing Engine applies it, produces a Pricing Snapshot
        ↓
Settlement creates/updates a RewardUsage row, Billing Event emitted
```

**The intent-recording business event is "this code is now known and
validated for this organization" — never gated behind a trial start or a
purchase decision.** An earlier version of this design gated intent
recording behind checkout submission, reasoning that organization creation
and checkout are different events and only checkout represents genuine
commitment. That reasoning was half right and half wrong: it correctly
avoided creating a `Referral` before a code is even known, but it wrongly
made `Pending` visibility depend on whether the customer chooses to start
a trial or pay — and those choices must have **no bearing** on whether a
referral is recorded. `Pending` exists specifically so *both* organizations
can already see the referral happened, which is the incentive that makes
completing the first payment (and unlocking the reward) meaningful in the
first place; gating it behind checkout submission silently broke that.

**Corrected rule: record intent the moment a code is known and validated,
by whichever of two paths supplies it — never later than that, and never
gated behind trial/payment:**
- A code from a **shared link** is known before the organization even
  exists (captured client-side before registration) — recorded **at
  registration**, the earliest correct moment.
- A code **typed in manually** can only be known once the organization
  already exists (there's nowhere earlier to type it) — recorded
  **immediately when the user applies it**, via its own explicit action,
  not folded into a later Subscribe/Start Trial submission.

Where the input field lives on screen (currently: the plan-selection
screen, next to the coupon field, for the manual-entry case) is a separate
question from when the `Referral` is created — a future signup flow
(sales-rep-assisted onboarding, an API-driven signup, an invoice-based
flow) could look completely different on screen and still be correct,
because the architecture keys off "code known and validated," never off
any specific page or a purchase decision.

**The reward is not created when a code is entered, whichever screen that
happens on.** It's created only after settlement confirms the referred
organization actually became a paying customer. Recording intent before
that point (whether at checkout or, in principle, anywhere else a business
event warranted it) is exactly like `pendingPlanChange`/`pendingAddonAddition`
are intent for other actions — never canonical state, and never something
a reward is derived from until settlement says so.

**The Pricing Engine never reads a referral code, ever, at any point.** It
only ever resolves *already-earned* rewards through the Modifier Resolver
(`PRICING_MODIFIER_ARCHITECTURE.md`). A referral code's entire job is to
produce (via qualification) a `Reward` — after that, the code itself is
irrelevant to pricing; only the `Reward` document matters.

**Target product vision vs. today's implementation constraint — keep these
explicitly separate, because they read very differently at first glance.**

The actual product intent is: *entering a referral code at checkout gives
the referred customer an immediate benefit on that same purchase* —
`₹1000 → ₹800`, visible before they pay, so referring feels immediately
rewarding to both sides. That is **not** what's built today, and the gap
is not a product decision — it's Razorpay's Subscriptions product
assuming one fixed recurring amount for the life of the subscription (the
same constraint behind Gap A, `KNOWN_BILLING_GAPS.md`). A subscription
can be created at ₹1000 or at ₹800, but not "₹800 once, then ₹1000
forever" — there's no first-invoice-differs-from-recurring mechanism to
hook into without either Charge-at-Will or a similar capability Razorpay
hasn't confirmed yet.

**What's built instead, today:** the code is still entered at checkout,
right next to the coupon field — same screen, same moment, same UX
location the target vision always intended. The difference is honesty
about the outcome: the UI validates the code and tells the customer
plainly that *they* won't see a discount on this invoice, but the person
who referred them earns a reward toward a future purchase. **The UI must
never show a discounted total it can't actually charge** — showing
`Referral -₹200` and then billing the full amount would be a broken
promise, strictly worse than not showing a discount at all.

**Why this matters enough to write down:** when Charge-at-Will (or
whatever mechanism Razorpay settles on) makes a differing first-invoice
amount possible, this becomes a matter of *enabling* an existing product
feature — swapping in the real discount at the same checkout screen,
using the same `Referral`/`Reward`/Modifier Resolver machinery that
already exists — not designing a new one. Nothing in the architecture
(Pricing Engine, Modifier Resolver, settlement, the reservation lifecycle)
needs to change for that day to arrive; only the adapter that instructs
the payment provider what to charge on the first invoice does. Document
and communicate this as "temporarily constrained," not "not supported."

---

## 4. Referral ownership

The referral (and the program, code, and rewards it produces) belongs to
an **Organization**, never a User.

```
Organization A → Referral Code → Organization B → Reward
```

If referrals were owned by individual users, deleting a user, transferring
admin ownership, or offboarding an employee would all become referral-data
problems. Organizations already own subscriptions — they should own
referral programs/codes/rewards too, for the same reason `Subscription` is
one document per org rather than per user.

**Explicit rule for multi-admin organizations:** a referral code (and every
reward it produces) belongs to the organization, not to whichever admin
generated it. It survives admin transfers, admin removal, and changes in
who currently holds the "admin" role — exactly like `Subscription` already
survives all of those without any special handling, because it's org-owned
too.

---

## 5. Referral lifecycle

```
Created → Code Entered → Waiting for First Payment → Payment Captured → Reward Created
```

This mirrors the intent/settlement split already used everywhere else in
billing (`ARCHITECTURE.md` §2).

---

## 6. Reward immutability — Reward vs. RewardUsage

**A `Reward`, once created, never changes.** It records what was earned
and why, permanently:

```
Reward
  id
  organization        — who earns it (see below — both sides of a referral get one)
  referral            — which Referral produced it
  source              — REFERRAL | MANUAL | PARTNER | LOYALTY | SUPER_ADMIN | PROMOTION
  rewardType          — percentage | fixed (frozen at creation — see §7)
  rewardValue          — frozen at creation
  createdAt
```

**Amended: both sides of a referral earn a reward, not just the referrer.**
The original version of this design only rewarded the organization that
shared the code (the referrer). By explicit decision, qualification now
creates **two** `Reward` documents at once — one for the referrer, one for
the referred organization itself — both from the same `ReferralProgram`
config/value (a deliberately simple choice over separately configurable
per-side amounts). No new field was needed for this: which side a given
`Reward` belongs to is always derivable by comparing its `organization` to
the linked `Referral`'s `referrerOrganization`/`referredOrganization`. The
referred organization's reward can't be applied to the very signup payment
that earned it (new-subscription signup is one of the checkouts blocked by
the fixed-recurring-plan constraint, §24/`PROJECT_STATE.md` §11) — it's
usable starting with that organization's own next add-on purchase or
upgrade, exactly like any other reward.

Whether it's been used is a **separate, append-only** record:

```
RewardUsage
  id
  rewardId
  invoiceId / paymentId    — what this usage attempt was for
  status                    — reserved | consumed | released
  reservedAt
  consumedAt
  expiresAt                 — see §9, reservation ownership
```

**Why split them:** a `Reward` behaving like `BillingEvent` or `Invoice` —
create once, never mutate — makes it trivially auditable ("show me every
reward this org has ever earned, exactly as earned"). If a single `Reward`
document instead had a mutable `status` field flipping between Available/
Reserved/Consumed, a bug in that state machine could corrupt the historical
record of what was earned, not just what's currently usable. Splitting the
concepts means a bug in usage-tracking can never touch the ground truth of
what was granted.

A reward's current "is it usable" state is derived, not stored: a reward is
available if it has no `RewardUsage` row in `reserved` or `consumed` status.
This is the same "derive, don't cache" principle `ARCHITECTURE.md`
invariant #6 already applies to entitlements.

**The `source` field.** Every reward records *why* it exists, not just
`referralId`. A reward manually granted by a Super Admin for a support case,
or a future partner-program reward, is still a `Reward` — just with a
different `source` and no `referral` reference. This is what lets
analytics (§16) answer "how much of our reward liability came from actual
referrals vs. manual goodwill grants" without a schema change later.

---

## 7. Configuration changes never rewrite history

If Super Admin changes the referral reward value from 20% to 10%, **every
already-earned `Reward` keeps its original `rewardType`/`rewardValue`
forever.** The config change only affects rewards created *after* the
change. This falls directly out of §6's immutability rule — a `Reward`
freezes its value at creation the same way `BillingEvent` freezes its
before/after snapshot at emission time, and for the identical reason: an
already-granted promise to a customer must not silently change underneath
them because an admin later adjusted a default.

---

## 8. What the reward actually is

The reward is **not** a coupon, **not** a promo code, and **not** a
discount field on `Subscription`. It is a billing credit — a record that
says "this organization is entitled to one discount on one future invoice."
The Pricing Engine doesn't need to know *why* a discount exists — only that
a resolved Modifier (`PRICING_MODIFIER_ARCHITECTURE.md` §3) exists and
needs to be applied. A `Reward` is the referral-specific record that the
Modifier Resolver turns into a generic `Modifier` before the engine ever
sees it.

---

## 9. Reservation ownership

A `RewardUsage` in `reserved` status must record exactly what it's reserved
against — `invoiceId`/`paymentId` and an `expiresAt`. Without this,
concurrent invoice attempts (e.g. a retried failed payment, or two
overlapping checkout attempts) could race over which one gets to consume
the same reward, or a reservation could hang forever if its invoice is
abandoned without ever explicitly failing. `expiresAt` gives a reservation
a bounded lifetime — if nothing consumes it by then, it releases back to
available automatically, mirroring how the frontend's checkout polling
(`waitForSettlement`, `PROJECT_STATE.md` §7) already has a bounded timeout
rather than waiting forever.

---

## 10. Discount order

```
Plan + Add-ons  →  Coupon  →  Referral Reward  →  GST  →  Final Total
```

GST is always computed last, on the post-discount figure — this matches
`buildPricingSnapshot`'s existing behavior exactly (`totalAmount` is
pre-GST/post-discount; `gst`/`grandTotal` are derived from it). In Modifier
terms (`PRICING_MODIFIER_ARCHITECTURE.md` §3), coupon has a lower priority
number than referral reward — this is data, not a hardcoded engine stage.

---

## 11. Referral reward scope

Applies to the **entire invoice** (plan + all add-ons), not just the base
plan — the same scope coupons already use, expressed as `appliesTo:
'entire_invoice'` on the resolved Modifier.

---

## 12. Multiple referrals — never overwrite, always append

An organization can successfully refer many other organizations. Each
success creates a **new**, immutable `Reward` record (§6). Never store
`referralDiscount: 20` as a single mutable field — that's exactly the
anti-pattern `ARCHITECTURE.md` §1 invariant #7 already warns against.

---

## 13. Reward consumption — one per billing cycle, never stacked

Five available rewards means five separate future invoices each get one
reward applied, in order — not one invoice getting a 100% discount, and
never a negative invoice. Each reward is consumed independently, tracked
via its own `RewardUsage` row.

This was chosen over two alternatives considered and rejected:

- **Stacking all rewards** (5 × 20% = 100%, or worse with more referrals) —
  requires answering what happens above 100%, effectively becomes a full
  credit-accounting system to do safely.
- **Converting rewards to stored monetary credit** (₹100/referral, applied
  and partially carried over) — the common SaaS "wallet" pattern, but
  requires a full ledger (partial consumption, carry-over balances,
  refund-to-wallet) that's disproportionate for a first version. (See §20
  on deliberately leaving room for this later without it being a rewrite.)

One-reward-per-cycle is simple, predictable, and trivial to explain to a
customer ("your 3rd free month is next month") — and if a future business
need calls for stacking or a wallet ledger, that's a new `Reward.source`/
type plumbed through the same Modifier interface, not a redesign.

---

## 14. Reward value — configurable, not hardcoded

Supported types at launch: **Percentage**, **Fixed Amount**. Future reward
types (free billing cycle, partner credit, promotional credit, seasonal
credit, loyalty reward) should be addable without redesigning `Reward` or
the engine — only by adding a new value handler under the same Modifier
interface.

---

## 15. Super Admin configuration (`ReferralProgram` settings)

Nothing about referral business rules should be hardcoded. Configurable,
and — per §7 — every value here is a *default for future rewards only*,
never retroactive:

- Enable/disable referrals globally
- Reward type: percentage or fixed amount
- Reward value
- Maximum reward amount (cap on a percentage-based reward in rupee terms)
- Whether referral rewards stack with coupons on the same invoice
- Apply-to scope: entire invoice or plan only
- Expiry duration for an unconsumed reward — **default: never expires**
  (see §22 — this is a deliberate choice, not just "configurable and
  unset"; "refer friends, your reward never expires" is a real selling
  point worth keeping as the default)
- Maximum pending (unconverted) referrals per organization
- Minimum qualifying plan / eligible plans / eligible billing cycles
- Whether referrals are honored during trial
- Whether the referred org must stay active for N days before the reward is granted
- Maximum total referrals per organization
- Manually issue a reward (creates a `Reward` with `source: MANUAL`)
- Manually revoke a reward (see §6 — revocation should still preserve the
  original `Reward` record and add an explicit revocation marker/event,
  not delete it — auditability over tidiness)
- Disable a specific organization's referral privileges (abuse response)

---

## 16. Settlement ownership

Settlement remains the only writer of canonical state — invariant #2/#3
applied again, unchanged for referrals:

**When a code is entered:** record intent only (a `Referral` in `pending`
status). Do not create a `Reward`, do not apply a discount, do not touch
the subscription.

**When the referred org's first payment settles:** *that* settlement
function is the one and only place a `Reward` is created. No other code
path may create one (manual grants from §15 are the one deliberate
exception — a distinct, explicit admin action, still funneled through the
same `Reward` creation path with `source: MANUAL`, not a second writer of
the same underlying concept).

---

## 17. Billing Events

New event types, following the existing `BillingEvent` pattern
(`ARCHITECTURE.md` §2 — immutable, one event per settlement). Deliberately
more granular than just "earned/consumed" — each `RewardUsage` transition
gets its own event so the Timeline can show the full lifecycle, not just
the endpoints:

- `REFERRAL_RECORDED` — intent recorded (code entered)
- `REFERRAL_REWARD_EARNED` — settlement created a `Reward`
- `REFERRAL_REWARD_RESERVED` — a `RewardUsage` was created against an invoice
- `REFERRAL_REWARD_RELEASED` — a reservation expired or its invoice failed, reward is available again
- `REFERRAL_REWARD_CONSUMED` — the invoice settled, `RewardUsage` finalized
- `REFERRAL_REWARD_REVOKED` — admin action
- `REFERRAL_REWARD_EXPIRED` — if expiry is enabled for that reward
- `REFERRAL_DISABLED` — admin disabled referrals for an org or globally

These surface naturally in the existing Timeline UI without any
timeline-specific referral logic. The Reserved/Released granularity in
particular is what makes debugging a "why didn't my reward apply" support
case tractable — without it, a released reservation and a reward that was
simply never touched look identical from the outside.

---

## 18. Fraud prevention (document now, implement selectively)

Not all of this needs to ship at launch, but the checks should be
documented now so nobody has to rediscover them under pressure once abuse
shows up. Fraud checks occur **before qualification** — i.e., before a
`Referral` is allowed to transition toward producing a `Reward`, not after:

- Disposable/temporary email domains on the referred organization's signup
- Same GST number as the referrer
- Same PAN
- Same payment method (card/UPI fingerprint) as the referrer
- Same IP address as the referrer at signup
- Same phone number
- Same browser fingerprint
- Velocity limits (too many referrals qualifying in too short a window from one referrer)

None of these alone is conclusive — a shared IP could be a coworking space,
a shared payment method could be a legitimate corporate card used across
subsidiaries. These are signals for a manual review queue or a
velocity-limit soft-block, not automatic hard denials, at least initially.

---

## 19. API boundary — frontend never computes referral math

Same philosophy already established for pricing generally
(`PROJECT_STATE.md` §7, rule #3): the frontend must never independently
calculate a reward's discount amount, eligibility, or remaining value. It
only ever displays a `Pricing Snapshot` (or a `ReferralDashboard` read
model, §21) that the backend already computed. If a UI screen needs "how
much would my next invoice be with this reward applied," that's a request
to the backend for a snapshot, not client-side arithmetic on a raw reward
percentage.

---

## 20. Invoice transparency

When a reward is applied, the invoice must show it as its own explicit
line, not fold it silently into a bigger number:

```
Starter Plan                    ₹350
Extra Seat                      ₹100
Coupon                          −₹50
Referral Reward (20%)           −₹80
─────────────────────────────────────
Subtotal                        ₹320
GST                              ₹57.60
─────────────────────────────────────
Grand Total                     ₹377.60
```

This is a direct consequence of the Pricing Snapshot already carrying a
`discount` breakdown (`ARCHITECTURE.md` §4) — extending it to show *which*
modifier contributed how much (coupon vs. referral, once more than one can
apply on the same invoice) rather than one combined `discount` number, is
the one concrete change this document asks of the snapshot shape.

---

## 21. Notifications

Document now, build alongside the feature, not as an afterthought:

- On referral qualification: "Your referral converted — you've earned
  [reward description]."
- On reward application: "Your referral reward has been applied to this
  invoice."
- (Optional, lower priority) On reservation release/expiry, if a customer
  is actively watching a checkout that didn't complete.

---

## 22. Referral dashboard (organization-facing)

Not built now, but the data model above should make this close to a pure
read/aggregation layer when it is built:

- Referral code
- Successful referrals (count)
- Pending referrals (count, awaiting first payment)
- Rewards available
- Rewards used
- Rewards expired (if expiry is ever enabled)
- Estimated next reward (if a referral is pending and likely to qualify)

---

## 23. Analytics and reward liability (future, not built now)

Because every `Referral`, `Reward`, and `RewardUsage` is its own stored,
immutable record, these become aggregate queries whenever they're needed —
no data-model changes required later:

- Referrals sent / successful referrals / conversion rate
- Average time to convert (code entered → first payment)
- Top referrers
- Rewards issued / rewards consumed / rewards outstanding
- Revenue generated by referred organizations
- Revenue discounted via referral rewards
- LTV of referred organizations vs. non-referred
- **Reward liability** — the sum of every unconsumed `Reward`'s value,
  projected against future invoices. This is a real, easy-to-overlook
  financial obligation: 5,000 unused 20%-off rewards is a future revenue
  reduction the business should be able to see on an admin dashboard, not
  discover invoice-by-invoice as rewards get consumed. Worth a dedicated
  "Outstanding Reward Liability" figure once volume makes it material.

---

## 24. Edge cases — decisions needed, with recommendations

**Self-referral.** A company shouldn't be able to refer itself (e.g. via a
second email address at signup). See §18 for candidate signals. No single
signal is fully reliable; accepting some false negatives is fine — this is
abuse mitigation, not a security boundary.

**Multiple referral codes.** One organization can have exactly one
referrer — the first code entered and successfully qualified, permanent
after that. An organization *generating* multiple codes (reissue/rotation,
§2) is a separate, allowed thing from an organization *using* multiple
codes as a referred party, which is not allowed.

**Referral code changes.** Allowed freely before the first successful
payment (nothing has settled yet — it's still intent). Locked forever after
settlement (canonical state, invariant #3).

**Referral never converts.** The referred org never pays — the referral
stays `pending` indefinitely (or expires, if configured), and no `Reward`
is ever created.

**Expiry — default is never.** See §15. Configurable per program, but the
default should be "rewards never expire," matching common, customer-
friendly SaaS referral practice.

**Failed payment.** A `RewardUsage` moves `reserved → released` if its
payment fails — mirrors `pendingAddonAddition` reverting on a
failed/abandoned checkout. The underlying `Reward` is never touched; only
its usage record changes.

**Cancellation.** Unused rewards remain on the organization. If they
resubscribe later (even months later), the rewards are still there and
still usable.

**Refund.** If an invoice that consumed a reward is later refunded,
recommend releasing that `RewardUsage` back to available (not deleting or
mutating the `Reward` — §6) rather than the customer permanently losing a
reward for a payment that didn't stand. Needs an explicit business
decision before implementation, same shape of question as the "does a
GST-inclusive coupon apply on upgrade" open item already tracked in
`PROJECT_STATE.md` §5.

**Upgrade / downgrade / add-on purchases / trial conversion.** No special
referral logic needed for any of these — the Modifier Resolver and Pricing
Engine (`PRICING_MODIFIER_ARCHITECTURE.md`) apply a reward uniformly
regardless of which business action produced the invoice being priced.

**Multiple available rewards.** Exactly one is consumed per invoice (§13);
the rest remain available for future invoices.

**Abuse.** Super Admin should be able to pause referrals globally, disable
a specific organization's referral privileges, revoke a specific reward,
manually grant a reward (support goodwill), and adjust reward values going
forward without affecting already-earned rewards (§7).

---

## 25. Relationship to the rest of the billing architecture

```
Business Action → Intent → Settlement → Modifier Resolution → Pricing Engine
      → Pricing Snapshot → Invoice/Payment → Billing Events → Timeline/UI
```

(Full detail on the Modifier Resolution stage: `PRICING_MODIFIER_ARCHITECTURE.md`.)

Referrals plug into every stage of this exactly like every other billing
feature. Nothing in the referral system should bypass settlement. Nothing
should calculate money outside the Pricing Engine. Nothing should mutate
canonical billing state directly, and nothing should mutate an
already-created `Reward` (§6). If a future referral-related change seems
to require doing any of those, that's a signal the change is misdesigned,
not a signal to make an exception.

**Provider independence.** Referral rewards must not depend on Razorpay (or
any specific payment provider) in any way — invariant #8/#9 in
`ARCHITECTURE.md` apply here unchanged. This is what keeps the referral
system unaffected by the pending Charge-at-Will decision — it sits entirely
in the domain layer (`ARCHITECTURE.md` §7), never the infrastructure layer.

---

## 26. Deliberately left for later — a Reward Ledger

Not building this now, but the design above should not need to be
redesigned to grow into one. If reward accounting ever needs true
double-entry rigor (e.g. once a wallet-credit reward type from §14 exists),
the natural evolution is a `RewardLedger` — an append-only log of every
state transition (`created`, `reserved`, `released`, `consumed`, `expired`,
`revoked`) rather than deriving current state from scanning `RewardUsage`
rows. `RewardUsage` as designed here is already a step toward that (it's
append-only per usage attempt); a full ledger would just formalize the same
pattern for every transition type, not introduce a new one.

---

## 27. Future-proofing

If this design is followed, later additions — partner referral programs,
affiliate programs, seasonal promotions, loyalty rewards, employee
discounts, marketing campaigns, cashback, wallet credits, promotional
credits, referral tiers, premium partner incentives — should all fit by
introducing a new `Reward.source` and/or Modifier type
(`PRICING_MODIFIER_ARCHITECTURE.md`), not a new billing flow. Referrals are
meant to be the *first* consumer of that generic architecture, not a
one-off feature that later needs to be generalized retroactively.

---

## 28. Suggested data model (conceptual — not a schema yet)

Five entities per §2 (not two, as an earlier draft of this document had):

**ReferralProgram** (one per organization, or a shared platform default)
- organization
- enabled
- rewardType, rewardValue, maxRewardAmount
- stacksWithCoupons, appliesTo
- expiryDurationDays (nullable — null/0 = never expires, the default)
- eligiblePlans, eligibleBillingCycles, minimumQualifyingPlan
- honoredDuringTrial, minimumActiveDays
- maxPendingReferrals, maxTotalReferrals

**ReferralCode**
- organization
- code
- createdAt, isActive (supports reissue/rotation without losing history)

**Referral**
- referrerOrganization, referredOrganization
- referralCode
- status (pending / qualified / expired)
- createdAt, qualifiedAt

**Reward** (immutable — §6)
- organization, referral (nullable if `source` isn't REFERRAL)
- source (REFERRAL / MANUAL / PARTNER / LOYALTY / SUPER_ADMIN / PROMOTION)
- rewardType, rewardValue
- createdAt
- revokedAt (nullable — presence marks it revoked; the record itself is never deleted or edited)

**RewardUsage**
- reward
- invoiceId / paymentId
- status (reserved / consumed / released)
- reservedAt, consumedAt, expiresAt

This preserves complete history, supports the analytics/liability queries
in §23, and keeps `Subscription` free of referral-specific transient state
— matching how `BillingEvent` is a separate append-only collection rather
than fields bolted onto `Subscription`.

---

## 29. Implementation order (once this design is approved)

1. Finalize and review this document and `PRICING_MODIFIER_ARCHITECTURE.md` together.
2. Design the actual database schemas for the five entities in §28
   (this doc is conceptual — not field types/indexes/validation yet).
3. Build the Modifier Resolver (`PRICING_MODIFIER_ARCHITECTURE.md` §2) as a
   generic component, before wiring referrals into it specifically.
4. Add Super Admin `ReferralProgram` configuration (§15).
5. Implement referral-code generation and validation.
6. Record referral intent at signup (creates a `Referral` in `pending` status).
7. Create `Reward`s only inside payment settlement (never anywhere else,
   except the explicit manual-grant admin action, §16).
8. Extend the Pricing Engine to consume one available reward per snapshot,
   via the Modifier Resolver — not a referral-specific code path inside the engine.
9. Emit the Billing Events in §17.
10. Surface rewards in the Billing Timeline, invoices (§20), payment
    history, and the referral dashboard (§22).
11. Test across every existing billing flow this could interact with:
    subscriptions, upgrades, downgrades, add-ons, cancellations, coupons,
    renewals, retries, refunds, and failed payments — not just the
    referral-specific happy path.

**Not in scope for this document, and not to be started yet:** per
`PROJECT_STATE.md` §1/§6, this remains a *new feature*, frozen behind the
current billing-stabilization work and the Charge-at-Will decision for
anything that would touch renewal settlement. This document (and
`PRICING_MODIFIER_ARCHITECTURE.md`) exist so the design is ready and
reviewed whenever that freeze lifts — not as a signal to start
implementation now.
