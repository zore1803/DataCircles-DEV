# Billing & Referral UX Specification

Frozen UX contract for every payment surface, before any shared React component gets built. Once this is approved, the component should be a direct implementation of this document — not a negotiation.

Three questions every screen must answer without the customer guessing:
1. What reward(s) do I currently have?
2. Where did this discount come from — coupon, referral, or both?
3. What will I actually pay — today, and on the next renewal?

## 0. Single Source of Truth

**The backend pricing engine is the sole authority for all pricing, discounts, GST, totals, and reward eligibility. The frontend must never derive commercial values from business logic; it renders only the data returned by the pricing engine.**

Every rule in this document — the row set, the hide-if-zero exceptions, the discount ordering, the eligibility messaging — is a consequence of this one principle. When an implementation question isn't directly answered below, resolve it by asking which side owns the computation: if it's a monetary amount, an eligibility decision, or a discount ordering, it comes from the backend response, full stop; the frontend's only job is formatting (currency symbols, thousands separators, row visibility) and layout.

---

## 1. The universal Order Summary

One component, one API shape, used by all six commercial actions: **signup, trial→paid, upgrade, add-on purchase, renewal preview, seat purchase.**

### 1.1 Row set (fixed order, top to bottom)

| Row | Always shown? | Notes |
|---|---|---|
| Plan Price | yes | base recurring price, or prorated amount for upgrades |
| Seats / Add-ons (one row per line item) | only if any exist | e.g. "Seats ×3 — ₹300" |
| **Subtotal** | yes | sum of the above |
| Coupon Discount | **only if > 0** | always red/negative, always labelled with the coupon code |
| Referral Reward | **only if > 0** | always red/negative, always labelled with the reward % |
| **Taxable Amount** | yes | Subtotal − discounts |
| GST (18%) | yes | even if ₹0, for tax transparency — this is the one row that stays even at zero, since "no tax" is itself information a customer should see stated, not omitted |
| **Total Payable** | yes | bold, largest type on the screen |

Rule: **hide a discount row when its value is zero; never hide Subtotal, Taxable Amount, GST, or Total.** GST is the sole named exception to the "hide if zero" rule.

**Invariant:** `Taxable Amount = Subtotal − Coupon Discount − Referral Discount`. Always computed this way, never re-derived from Subtotal directly when a discount is present — this is the exact equation to protect against a future "simplification" that computes GST off Subtotal and silently ignores an active discount.

**Invariant:** discounts are displayed in the exact order they are applied by the pricing engine (Coupon before Referral, per Stage 6→7). Presentation order must always equal computation order — never reordered for visual preference.

### 1.2 Canonical API shape

Every endpoint behind these six actions (signup, trial-conversion, upgrade, add-on purchase, renewal preview, seat purchase) must return the same shape:

```json
{
  "pricingLineItems": [{ "label": "Growth Plan", "amount": 450 }],
  "subtotal": 550,
  "couponDiscount": { "amount": 50, "code": "WELCOME10" },
  "referralDiscount": { "amount": 110, "percent": 20 },
  "taxableAmount": 390,
  "gst": 70,
  "total": 460
}
```

`couponDiscount`/`referralDiscount` are `null` (not `0`, not omitted) when absent — the frontend keys visibility off `null` vs. an object, not off a numeric zero-check, so a genuinely-applied-but-zero-value discount (edge case, but possible with a capped coupon) still renders. GST is computed server-side and sent, not recomputed client-side — closes the drift risk between the engine's rounding and the frontend's `Math.round(total * 0.18)`.

### 1.3 Combination matrix — what the row set looks like

**No discount:**
```
Growth Plan            ₹450
Subtotal                ₹450
GST (18%)                ₹81
Total Payable            ₹531
```

**Coupon only:**
```
Growth Plan            ₹450
Subtotal                ₹450
Coupon Discount (WELCOME10)   −₹45
Taxable Amount           ₹405
GST (18%)                ₹73
Total Payable            ₹478
```

**Referral only:**
```
Growth Plan            ₹450
Subtotal                ₹450
Referral Reward (20% off)     −₹90
Taxable Amount           ₹360
GST (18%)                ₹65
Total Payable            ₹425
```

**Both:**
```
Growth Plan            ₹450
Subtotal                ₹450
Coupon Discount (WELCOME10)   −₹45
Referral Reward (20% off)     −₹81
Taxable Amount           ₹324
GST (18%)                ₹58
Total Payable            ₹382
```
Coupon always listed above Referral — matches the engine's own Stage 6→7 sequencing, so the visual order matches the computation order.

### 1.4 Per-surface variants (same rows, different header/context line only)

| Surface | Header | Context line above rows |
|---|---|---|
| Signup | "Order Summary" | none |
| Trial → Paid | "Confirm Your Subscription" | "Your 7-day trial ends now." |
| Upgrade | "Upgrade to {plan}" | "You'll be charged the prorated difference today." |
| Add-on purchase | "Add {addon}" | none |
| Renewal preview | "Next Renewal" | "Charged automatically on {date}." — no "Pay Now" button, this is read-only |
| Seat purchase | "Add Seats" | none |

Renewal preview is the one variant that's non-interactive (no submit action) — it's the same visual block, rendered inside the billing dashboard rather than inside a checkout modal.

### 1.5 During checkout: explicit callout above the totals

When a referral reward is being consumed (not just previewed), add one line directly above the row set, visually distinct (small badge, not part of the table):

```
✓ Referral Reward Applied — You're saving ₹90 today.
```

This exists so a customer scanning quickly doesn't have to parse the table to know a reward fired — it answers "why am I paying less" before they even reach the rows.

---

## 2. Reward visibility — every surface that should reinforce it

The underlying problem: a reward is earned, then nothing reminds the customer until they stumble onto it. Fix: reward status is not confined to the Referrals page — it echoes wherever a purchase decision could consume it.

### 2.1 Reward lifecycle (canonical states, everywhere)

```
Available → Reserved → Applied → Consumed
                ↓
            Released (if payment fails — returns to Available)
```

- **Available** — earned, unreserved, nothing pending.
- **Reserved** — a checkout is in progress holding this reward (TTL window).
- **Applied** — shown transiently, at the instant of successful payment confirmation.
- **Consumed** — terminal. Reward disappears from "available" lists permanently, but its history remains visible (see §4).
- **Released** — reservation expired or payment failed; reward returns to Available. Not terminal.

A customer-facing UI never needs to render "Reserved" as a distinct visible state during normal flow — it's the ~30-minute window of an in-progress checkout. It matters only if the customer abandons checkout and comes back (reward should still show Available once released) — see §5 for the exact copy at that moment.

### 2.2 Where "Available Reward" appears

**Every "reward available" surface below must state eligibility, not just existence** — "a reward exists" doesn't answer "why didn't it apply to what I just bought." This line is mandatory, not optional decoration:
```
Eligible for: Upgrade · Renewal · Seat Purchase
```
(list only the actions the specific reward's program config actually permits — this itself comes from the backend, not a hardcoded frontend list, per §0.)

**Billing dashboard** (next to the plan/price):
```
Growth · ₹649/mo

🎁 Referral Reward Available — 20% off your next purchase
Eligible for: Upgrade · Renewal · Seat Purchase
```

**Billing dashboard, if the reward will hit the next renewal specifically:**
```
Next Renewal — 27 Aug 2026

Original            ₹649
Coupon Discount      −₹50   (only if a recurring coupon is still active — see §1.1's hide-if-zero rule)
Referral Reward      −₹130
Estimated            ₹469
```
This is the renewal-preview variant of §1's universal component — same rows, read-only, same hide-if-zero rule. It must never show only the referral row while silently dropping an active recurring coupon; that would be the dashboard quietly disagreeing with the same universal component it's supposed to be an instance of.

**Plan/pricing page** (above the Upgrade button, only if a reward exists and this plan is eligible):
```
Growth → Business

🎁 20% referral reward available — applies automatically at checkout
Eligible for: Upgrade · Renewal · Seat Purchase
```

**Referrals page** (replaces the current bare "Rewards Available: 1"):
```
Available Reward

20% OFF
Applies automatically to your next eligible purchase.

Eligible for: Upgrade · Renewal · Add-ons · First payment (if on trial)
```

**Manage Subscription page** (next to Upgrade/Add-on actions):
```
Upgrade

🎁 Referral reward available — 20% off your next purchase
Eligible for: Upgrade · Renewal · Seat Purchase
```

All five surfaces read the same underlying "do I have an available reward" state — one API call, five render sites. No surface invents its own copy variant beyond the header context.

### 2.3 Multiple rewards

Rewards are consumed FIFO (oldest-earned first). The UI never exposes reward ordering, selection, or "which one" — that decision is entirely backend-owned, and no surface should imply the customer has any choice in which reward fires.

If more than one reward is Available, list them (`Reward #1`, `Reward #2`, ...) on the Referrals page only — every other surface (dashboard, plan page, upgrade button) shows only a single aggregate line: "🎁 Referral reward available" without a count, since which specific reward gets consumed is a backend selection (FIFO) the customer doesn't need to reason about pre-checkout. Post-consumption, the Referrals page list simply drops to the remaining reward(s) — no special "1 of 2 used" messaging needed, the list itself is the record.

### 2.4 Reward exists, but this purchase isn't eligible

Distinct from "no reward exists" — do not render the same empty/neutral state for both. If a reward is Available but the program config doesn't permit it on the action the customer is currently viewing/attempting (e.g. reward is upgrade/renewal-only, customer is on the add-on purchase screen), the checkout must say so explicitly rather than silently showing no discount:

```
Reward not applicable to this purchase
You have a 20% reward available — eligible for Upgrade, Renewal.
```

This line replaces the "Referral Reward Applied" callout (§1.5) for this one purchase; it does not appear in the Order Summary rows (§1.1) — since no discount applies, no discount row renders, per the standard hide-if-zero/null rule. The explanation lives in the callout position, not the table.

---

## 3. Referee messaging (the incorrect copy to replace)

**Current (wrong, per backend behavior as of the trial-conversion fix):**
> Referral applied — referred by {name}
> You won't see a discount on this invoice, but whoever referred you earns a reward toward their next purchase.

**Replacement, pre-payment (checkout screen, referral code widget):**
```
Referral Applied

You were invited by {referrerOrgName}. A 20% discount has been
applied to your first invoice.
```

**Replacement, in the Order Summary itself (§1's row set naturally covers this — no separate copy needed beyond the row):**
```
Referral Reward (20% off)     −₹90
```

**Replacement, post-payment success screen:**
```
Payment Successful

Referral Reward Applied — you saved ₹90 on this purchase.
```

**Referral landing page** (pre-signup, invited-link landing — currently just "Referral applied"):
```
You've been invited by {referrerOrgName}

You'll receive 20% off your first subscription.
```

No wording anywhere on the referee side should mention "reward," "earning," or "next purchase" — those are referrer-side concepts.

**The referee gets a discount. The referrer gets a reward.** That one distinction drives nearly every copy decision in this section and in §4/§5 — the referee's benefit is immediate and one-time, applied to money they're spending right now; the referrer's benefit is deferred and durable, tracked through the full Available→Reserved→Consumed lifecycle. Any copy that blurs the two (calls the referee's discount a "reward," or implies the referrer will see something on "this invoice") is wrong regardless of which screen it's on.

---

## 4. Referrer messaging & reward history

**Referrals page, per-reward history line (replaces the bare word "Consumed"):**
```
20% OFF
Used on Business Upgrade · 27 Jul 2026
```
Format: `{value}% OFF` / `Used on {planName or "Add-on purchase" or "Renewal"} · {date}` — same "Used," not "Applied," as the timeline (§5), for the same reason: this is a historical receipt, not a checkout-in-progress state. This is the one place a consumed reward remains visible — as a receipt, not as an available action.

**If released (payment failed) — shown only transiently on the reward's own history line, not as a persistent banner:**
```
20% OFF
Reservation released · payment did not complete · reward available again
```

---

## 5. Billing timeline

Both sides need distinct sequences — the referrer owns a Reward object with a multi-step lifecycle; the referee has a single discount event. Rendering the referrer's sequence to the referee (or vice versa) is the exact bug this spec is meant to prevent from recurring in a different surface.

**Referrer's timeline:**
```
Referral Sent
  ↓
Referral Joined
  ↓
Referral Made First Payment
  ↓
Reward Earned
  ↓
Reward Used — {context, e.g. "on Business Upgrade"}
```
Named "Reward Used," not "Reward Applied" — "Applied" reads as a checkout-in-progress verb (matches the §1.5 callout, which is correct there), but the timeline records history after the fact, and the reward is gone permanently at this point. "Used" makes the finality unambiguous in a way "Applied" doesn't.

"Reward Reserved" is not a separate timeline entry — reservation is a transient in-progress state (§2.1), not a durable event worth a permanent timeline row. Showing it would create a confusing extra step that then immediately resolves to "Used" moments later in the common case, or vanishes back to nothing if abandoned. The timeline records outcomes, not intermediate lock states.

**Referee's timeline:**
```
Joined Using Referral
  ↓
Referral Discount Applied
  ↓
Subscribed
```
Never shows "Reward Earned" — the referee does not own a Reward object (per the one-benefit-per-participant design), so that event type must never be emitted to their timeline in the first place; this is as much a backend-event-routing rule as a copy rule.

**Icon mapping required** (currently missing from `BillingTimeline.jsx`'s `EVENT_ICONS`): `REFERRAL_REWARD_EARNED`, `REFERRAL_REWARD_CONSUMED`. Use the same 🎁 gift glyph used in §2's dashboard/plan-page callouts, so the timeline icon and the "you have a reward" badge are visually the same symbol everywhere — one icon, one meaning, across the whole product.

---

## 6. Trial users

Made explicit rather than left implied, because it's a product rule, not an incidental consequence of the trial-conversion fix:

**Trial users can:**
- Invite referrals (their referral code is live from registration, before any subscription exists)
- Earn rewards (a referee they invited can pay while the referrer is still on trial — the reward is earned immediately, independent of the referrer's own payment status)
- View earned rewards (all of §2's visibility surfaces apply identically to a trial user — a reward doesn't wait for the customer to become "a real paying customer" to become visible)
- Consume earned rewards on their first paid subscription (trial→paid conversion is a first-class consumption point, identical in every UI respect to an existing customer's upgrade/renewal/add-on purchase — see §1.4's Trial → Paid row)

The referral system does not care when the referrer earned the reward — only that they currently have one available. A trial user and a two-year paying customer see identical reward-visibility UI (§2.2); the only thing that differs is which specific action (trial-conversion vs. upgrade/renewal/add-on) ends up consuming it.

---

## 7. Edge cases (centralized — the same rules stated throughout §1–§6, collected here as a single reference)

| Situation | Behavior |
|---|---|
| Coupon + Referral both active | Show both rows, Coupon above Referral (§1.1, §1.3) |
| Referral only | Hide the Coupon row entirely (§1.1) |
| Coupon only | Hide the Referral row entirely (§1.1) |
| GST is ₹0 | Still show the GST row — the sole exception to hide-if-zero (§1.1) |
| Multiple rewards available | Show a single aggregate line everywhere except the Referrals page, which lists each one; consumption order is FIFO and never exposed in the UI (§2.3) |
| Payment fails after a reward was reserved | Reward returns to Available; reservation history shows "released," not "consumed" (§2.1, §4) |
| Reward exists but isn't eligible for the action being attempted | Explicit "Reward not applicable to this purchase" callout — never silently show nothing (§2.4) |
| Reward expires (if/when expiry is implemented) | Not yet implemented as of this spec — when it is, an expired reward must be visually distinct from Consumed on the Referrals page (a reward that timed out unused is a different story than one that was spent) and must not appear in any "Available" surface in §2.2. Placeholder rule only; revisit once expiry ships. |

---

## 8. What's explicitly out of scope for this spec

Deferred to P2 per the priority list already agreed: reward-card visual polish (badges, animation, "Congratulations" screens), empty-state copy beyond what's specified in §2/§3, admin-side auditing UI. This document defines rows, states, and copy — not colors, icons-as-graphics, or motion. Those are implementation-detail decisions for whoever builds the shared component, constrained by (but not specified in) this document.

---

## 9. Acceptance checklist (traces 1:1 to the priority list already agreed)

- [ ] One Order Summary component (§1) renders identically across all six surfaces, sourced from one API shape.
- [ ] Every discount row is hidden when zero except GST (§1.1).
- [ ] `Taxable Amount = Subtotal − Coupon Discount − Referral Discount` is computed this way everywhere, never re-derived from Subtotal alone when a discount is active (§1.1).
- [ ] Reward availability is visible on: Billing dashboard, Plan page, Referrals page, Manage Subscription (§2.2) — not just the Referrals page — and every instance states eligibility ("Eligible for: ...", §2.2), not just existence.
- [ ] Referee never sees referrer-side language ("earn," "next purchase," "Reward Earned") anywhere (§3, §5).
- [ ] Referrer's reward history shows what it was used on and when, not just "Consumed" (§4).
- [ ] Timeline routes referrer events and referee events through two distinct, non-overlapping sequences (§5).
- [ ] Next-renewal preview, when a reward will apply, shows Original → Discount(s) → Estimated, including any active recurring coupon, not referral-only (§2.2).
- [ ] Trial users see identical reward-visibility UI to paying customers (§6).
- [ ] A reward that exists but isn't eligible for the current purchase says so explicitly, rather than rendering the same as "no reward" (§2.4).
- [ ] Every monetary amount displayed in checkout comes from backend pricing responses. The frontend performs no pricing arithmetic beyond formatting (§0).
