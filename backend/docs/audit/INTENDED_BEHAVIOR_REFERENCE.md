# Intended Behavior Reference — Upgrade / Downgrade / Add-ons / Coupons / Referrals

> **Status:** synthesis of the frozen documentation, no code. Companion to
> `COMMERCIAL_ACTIONS_INTERCONNECTION_MAP.md` (which describes *current implementation*). This
> describes how the five actions **should** work per the spec — so the frontend/backend converge
> toward intended behavior, not toward existing code. Citations are to
> `BILLING_DOMAIN_SPECIFICATION.md` (V1.1 frozen; "Ch.N") and `CAW_BILLING_DESIGN.md` ("CAW §N").
> Where current code diverges, the divergence is marked ⚠️/❌ and cross-referenced to the map.

---

## The unifying model (Ch.4 capability table — the authority)

Every one of the five is **one input configuration to the same Change/Invoice/Credit engines** (Ch.4:
"No capability should ever gain code that only that capability has"). There is no per-capability
implementation — there is one Change Engine (Ch.3.2, the six-question decision pipeline), one Invoice
Engine (`calculateInvoice`), and coupons/referrals as modifiers into it.

| Capability | Effective | Payment | Renewal impact | Commit point |
|---|---|---|---|---|
| **Upgrade** | now | charge now (prorated) | higher going forward | payment success (P10) |
| **Add add-on / add seat** | now | charge now (prorated) | includes it going forward | payment success |
| **Billing-cycle change** | now, always | charge now (unused value repriced) | immediate | payment success |
| **Downgrade** | next renewal | none now | lower from next cycle | renewal |
| **Remove add-on / seat** | next renewal | none now, no refund | excludes from next cycle | renewal |
| **Coupon** | at invoice time | reduces that invoice | recurs if `duration` says so | (rides invoice) |
| **Referral reward** | earned anytime | applied to next unpaid invoice | none directly | (rides invoice) |
| **Cancel** | next renewal, always | none | subscription ends instead of renewing | renewal |

**The single governing invariant across all of them (Ch.2 Invariant 1, Ch.22 Principle 1):** *nothing
commercial changes before payment confirmation.* Immediate actions hold everything (invoice pending,
Order/charge pending, subscription untouched) until payment succeeds; only then does one atomic,
idempotent commit apply plan+add-ons+invoice+BillingCycle+credits+events (Ch.4.1 P10).

---

## How each SHOULD work

### Upgrade (Ch.4.1 — the reference capability, 10-stage P1–P10)
- Preview prices via `calculateInvoice` (current plan, target, remaining days, unused-value credit,
  GST, credits) → **Invoice Preview**, nothing persisted (P1–P2).
- Checkout creates a **pending Invoice + Order**; subscription untouched (P3–P4).
- Changing target/add-ons before paying = **replace** (void old pending invoice, new one) — never
  merge (P5–P6, Ch.15 void-and-replace). Upgrading again before paying is allowed (P8).
- Payment fails → **nothing changes** (P9). Payment succeeds → the one atomic commit (P10).
- **Payment mechanism (CAW §Upgrade, DECIDED):** "Create Order (prorationAmount); **Charge Mandate**"
  → commit on `payment.captured`. Guard `newRecurringTotal <= mandateMaxAmount` else mandate
  regeneration (CAW §10).
- ❌ **Current code diverges:** interactive checkout modal, not a mandate charge (map §3).

### Add-ons (Ch.4.3 — "an add-on is just another commercial component")
- **A1:** `Invoice = Plan + Addon A + Addon B…`. Billing has no concept of "seat" — a seat is an
  add-on with no special logic (Ch.4 rows for seats say "no special logic").
- **Two types:** Feature (boolean enabled/disabled) vs Quantity (a running count). Quantity add-ons
  are **additive, never reject-on-duplicate** (Ch.4.3 DECIDED) — buy more seats anytime, each its own
  `SubscriptionChange`, priced independently.
- **Add** = immediate, prorated, charge now (same shape as Upgrade, A4–A6). Should **charge mandate**
  (CAW §Add-on). ❌ current: interactive checkout (map §1).
- **Remove** = scheduled at renewal, **no refund**, effective next cycle (Ch.4). Represented as a
  `ScheduledChange` — the component stays `ACTIVE` until renewal (Ch.16: components never store
  `PENDING_REMOVAL`; a live `ScheduledChange` is the *only* representation).
- **Re-adding an add-on with a pending removal does NOT cancel the removal** (Ch.4.3 DECIDED, Invariant
  7 — engine never infers intent) — both records persist and both execute at their own times.

### Downgrade (Ch.4 + Ch.12 — the big under-built capability)
- **Effective next renewal, no charge, no refund.** Future intent = a `ScheduledChange` (Ownership
  Law 5); no `pending*` field should exist. ⚠️ current: triple-write (map §1).
- **⭐ Downgrade Eligibility Validation (Ch.12) — a MAJOR spec'd capability almost certainly not built
  in the UI:** a downgrade **cannot be scheduled** unless every limited resource the org actually uses
  fits the destination plan's limits *after* chosen carry-forward add-ons. Plans define *included*
  capacity, not a ceiling — carry-forward add-ons extend it. Blocked only when even max carry-forward
  can't cover actual usage.
- **The rejection must be an itemized checklist** (Ch.12 DECIDED), not a generic error:
  ```
  Cannot downgrade yet.
    [X] Remove 2 users
    [X] Reduce storage by 1.8 GB
    [OK] Pipelines are within limit
  ```
- **Never silently delete/lock data** — the customer resolves the mismatch themselves; the downgrade
  stays blocked (not scheduled) until they do (Ch.12 DECIDED). This is stricter/better than the
  industry "let them over-limit then lock" pattern.
- **Boundary (Ch.13):** billing runs one generic algorithm (`allowed = plan-included + carried add-ons;
  if usage > allowed → block`); each product module (Forms/Storage/Pipelines/CRM/Automations) reports
  its own usage + limit numbers. Billing never knows what a "form" is.

### Coupons (Ch.13, Ch.14 — Policy Object, redemption integrity)
- **Definition model (confirmed final, Ch.13):** `isActive` + `startDate`/`expiryDate` derived, per-
  product rules (`{productType, productKey, discountType, discountValue}`). No stored lifecycle enum.
- **Validation pipeline (Ch.14, strict order, specific reason at each stage):** Exists → Active →
  Within window → Org eligible → Cycle eligible → Item eligible → Global limit → Per-org limit →
  Duration valid → Apply. ✅ `discountEngine.js` implements most of this.
- **⭐ Core redemption invariant (Ch.14):** *a redemption is earned only by a successful payment, tied
  permanently to the Organization.* Abandoned/failed/voided/replaced invoices never consume a
  redemption. Retry of the same invoice = exactly one redemption, not one per attempt. ✅ matches code
  (`recordRedemption` only from `runFirstPaymentSettlement`).
- **Duration & recurrence:** a coupon with `duration` (first invoice / N cycles / lifetime) reduces
  **recurring** invoices accordingly — cycle count advances only when a renewal is actually **paid**
  (Ch.14). ⚠️ **must verify** the Renewal Engine feeds `appliedCoupon` into `calculateInvoice` so a
  recurring coupon actually recurs (map §4 item 5).
- **Redemption identity = Organization only** (Ch.14), never per-subscription/user/mandate — survives
  plan change, cycle change, mandate re-acquisition, suspension, reactivation. Anti-abuse by design.
- **Should apply to any invoice with an eligible item** — including upgrade/add-on invoices, since
  those are just invoices with line items. ⚠️ current: coupons wired only at acquisition; the frontend
  `couponAppliesAtCheckout` rule (business logic in React) exists only because backend upgrade/add-on
  paths don't accept a coupon (map §2, §4 item 4).

### Referrals / Rewards (Ch.13, Ch.20)
- **Reward** belongs to the **Organization**, immutable (only `revokedAt` changes), earned on the
  org's first successful paid subscription, lifetime (Ch.13, §3.6b). ✅ matches.
- **RewardUsage** is `Reserved → Consumed | Released`, at most one live reservation per reward, with a
  `releaseReason` (`TIMEOUT | PAYMENT_FAILED | ADMIN_RELEASE | REPLACED_BY_NEW_INVOICE`, Ch.13). ✅
  `referralRewards.js` implements reserve/consume/release; `REPLACED_BY_NEW_INVOICE` follows Law 11.
- **Applied to the next unpaid invoice** (Ch.4) as a `referral` modifier through `calculateInvoice`,
  after coupon (`PRIORITY coupon:10, referral:20`). ✅ matches on upgrade/add-on paths.
- **Referral invitation `expired` state is intentionally NOT implemented** (Ch.13 DECIDED) — "pending
  forever" is valid unless the business asks for invitation expiry. Not a bug.
- **Needs a daily cleanup job** releasing `reserved` usages past `expiresAt` (Ch.13 DECIDED) — ⚠️
  verify this job exists.

---

## Billing Cycle Change (Monthly ↔ Yearly) — SETTLED at the design level; NOT implemented in code

**Correction to an earlier read of this document:** the "open questions" that appear mid-§3.7
(Renewal Engine per-bucket, retry per-bucket, day-level proration formula, empty-bucket handling) are
**open questions against the Billing Bucket sub-model, which was itself superseded within the same
session.** They are not open against the final model. The document's own **final-status section at
the V1.0 freeze** explicitly lists "Billing Cycle Change" under **Done**, and states "same-day-due
bundling question are all closed (§3.3, §3.7, Chapter 9's Commercial Event findings)." Confirmed by
Razorpay-support context separately: CAW UPI mandate acquisition is not broken either — it is
test-mode-restricted on this account (per `CHARGE_AT_WILL_VALIDATION.md`), confirmed working in live
mode; that's an environment limitation, not a design or code defect.

**The settled model, in order of supersession (final model last):**
1. ❌ §3.2's flat "cycle change is deterministically NOW, airline-style unused-value repricing on one
   subscription-level `billingCycle`" — superseded once cadence was found to need to vary per-component.
2. ❌ §4.1's original Annual↔Monthly conversion formula — superseded by the entitlement-window model.
3. ❌ §3.7's own first correction, the **Billing Bucket** model (Subscription owns a Monthly Bucket
   and/or Yearly Bucket, same-cadence components consolidate) — superseded within the same session.
4. **✅ FINAL — the Billable Item model:** every plan/add-on is its own `BillableItem`, each with an
   **immutable Billing Anchor** (the date it was purchased — the base plan's anchor is the
   subscription's first-ever payment). The anchor never resets on upgrade/downgrade/cadence
   change/late-payment recovery. Invoice boundaries are decided separately by **Commercial Event**
   grouping (`NEW_PURCHASE`/`MID_CYCLE_PURCHASE`/`RENEWAL`/`RETRY`) — a `RENEWAL` event bundles every
   `BillableItem` due that day into one invoice; components don't get independent invoices just
   because they have independent anchors. Cross-cadence add-ons (a yearly-plan customer with monthly
   add-ons) are supported natively by this model, each on its own anchor.

**What's NOT done — this is purely an implementation gap, not a design gap:**
- `Subscription.billingCycle` is still a single flat field — no `BillableItem`/per-component Billing
  Anchor exists anywhere in the schema. This is the exact revision §3.7/the standing note (line
  ~3767-3780) says `CAW_BILLING_DESIGN.md` §2 needs and flags as "not done in this edit."
- `updateSubscription`'s cycle-change branch still behaves per the pre-Billable-Item model (routes
  non-UPI changes to the scheduled-at-cycle-end path) — it was never re-implemented against the final,
  settled Billable Item / Commercial Event model.
- `IMPLEMENTATION_PLAN_V1.md`'s pricing-topology table still marks this "🔍 Not yet investigated" —
  that line is stale relative to the spec's own final status and should be corrected to "design
  settled (Billable Item model); implementation not started."

**This is implementation work against an already-decided design**, not a V1.1 Change Proposal. The
schema change (adding a `BillableItem`-shaped model with per-component anchors) is real and non-trivial
— touching Subscription, add-ons, the Renewal Engine (needs one renewal check per due item, not per
subscription), and proration — but there is no open business question blocking it.

## Cross-cutting rules the frontend MUST honor (not re-derive)

1. **Pending cancellation (Ch.4.2 + V1.1-001):** blocks only *scheduled* changes; **immediate pay-now
   actions (upgrade, add-on, cycle change) remain allowed** right up to the effective date. The
   frontend must not disable upgrade/add-on buttons during pending cancellation — only scheduled ones.
   ⚠️ legacy code enforced the old blanket-block in two places; verify UI matches V1.1-001.
2. **One pending record per property (Ch.3.2 Rule 1, C1–C6):** PLAN and BILLING_CYCLE replace-on-
   conflict (newest wins, old → CANCELLED, never deleted); ADDON changes coexist, never replace. UI
   must reflect the *set* of pending changes, read from `ScheduledChange`, never a single flag.
3. **Full line-item transparency (Ch.4.1 #2, Ch.22 Principle 8):** every number shown individually —
   base, each add-on, each credit by source (referral/coupon/unused-cycle), GST separate. The checkout
   and invoice UI render `calculateInvoice().lines[]` faithfully, never a collapsed total.
4. **"Unused Monthly Credit," not "Proration"** on customer-facing invoices (Ch.4.1) — a labeling rule.
5. **Resubscribe after cancel = brand-new subscription** (Ch.4.2), not a resume. No "uncancel" button.
6. **Idempotency everywhere (Ch.22 Principle 7):** every webhook/retry/reconcile may run repeatedly;
   the UI must never assume a single delivery (already the cause of the triple-timeline symptom).

---

## Net gap list (intended vs. built) — feeds the change set in the interconnection map

| Area | Intended (spec) | Built | Severity |
|---|---|---|---|
| Upgrade/Add-on payment | Charge mandate, commit on webhook (CAW §Upgrade/Add-on) | Interactive checkout modal | ❌ major |
| Downgrade eligibility | Usage-compatibility checklist blocks scheduling (Ch.12) | Add-on compatibility only; no usage/limit checklist | ❌ major, likely absent |
| Coupons on upgrade/add-on | Any eligible invoice (Ch.14) | Acquisition only; React gates the rest | ⚠️ |
| Recurring coupon at renewal | Advances per paid cycle (Ch.14) | Unverified in Renewal Engine | ⚠️ verify |
| Future intent storage | `ScheduledChange` only (Law 5) | `pendingUpdate`/`pendingAddonRemovals` + `ScheduledChange` | ⚠️ dual-write |
| Pending-cancellation blocking | Block scheduled only (V1.1-001) | Verify UI/backend match | ⚠️ verify |
| RewardUsage cleanup job | Daily release of stale reservations (Ch.13) | Verify exists | ⚠️ verify |
| Frontend state derivation | One canonical UI state | Per-component legacy-field reads | ❌ (Journey 1) |

**Discipline reminder (operating manual):** every ⚠️/❌ backend/spec item is *reported*, and where it
changes decided behavior it goes through the V1.1 Change Process — never worked around in React. The
frontend's only job is to render the canonical state faithfully once the backend provides it.
