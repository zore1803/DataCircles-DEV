# Capability Audit — Subscription Acquisition

> ⚠ **NOT YET STARTED as a full audit** (this is a stub seeded from evidence
> collected during the Trial walkthrough — see `audit/UserObservations.md`
> "Session 1"). This is a distinct capability from Trial: it's the funnel a
> brand-new, subscription-less org goes through, of which "start a trial" is
> only one branch (the others being Subscribe directly, or apply a
> coupon/referral code first). Audit this properly when we reach it in the
> dependency order (`audit/BusinessFlowAudit.md`).

## 1. Purpose
Get a brand-new organization (no Subscription document at all) to either a
trial or a paid plan, with coupon/referral capture available before any
payment.

## 2. Observed entry (from UserObservations.md)
New org creation → redirected straight to the pricing page (no intermediate
"you have no subscription" interstitial — the pricing page itself IS the
landing point). Pricing page shows: Monthly/Annual toggle, "7-Day Free Trial
Available," coupon field, referral field, Trial/Starter/Growth/Business cards,
feature comparison table, FAQ.

## 3. Two intentional-looking pre-subscription-accessible pages (Observed, business-decision status Assumed not Verified)

Both of these were Observed to be fully functional with **zero** subscription:

- **Billing page** — shows a clean "No active subscription yet. Choose a plan →" empty state, not an error. User's own reaction: *"this is awesome i didnt even ask to do this"* — read as a genuinely good, deliberate empty-state design.
- **Referrals page** — fully functional (own code, share/email invite, stats all showing zero) with no subscription at all.

**Status: Assumed intentional, not yet Verified as a deliberate product
decision vs. simply "nobody gated these routes."** Both happen to work
because neither route chains `restrictByPlan` the way Companies/Deals do —
which is the SAME underlying mechanism as the Products & Services
inconsistency documented in `KNOWN_BILLING_GAPS.md`. Whether that's "good,
keep it" or "accidentally permissive" needs an explicit decision, not an
inference from the fact that it currently feels fine. Route to
`BillingArchitecture.md` as a stated design decision once confirmed
deliberate.

## 4. Product idea raised during walkthrough — referred org's first invoice discount even pre-payment

Raised in `audit/UserObservations.md` (Referrals-page-pre-subscription entry):
referring should be allowed before the referrer/referee have any subscription,
but if the referred org signs up and is only on trial (or has no
subscription), they should still eventually see a discount on their **first
invoice** once they do pay — with the **recurring** amount unaffected.

**This is not a new idea** — it's the same target vision already captured in
`PROJECT_STATE.md`'s "🔖 Future Enhancement (Blocked by Razorpay)" note and
`REFERRAL_SYSTEM_DESIGN.md`'s "target vision vs. implementation constraint"
section: a Razorpay Subscription has one fixed recurring amount, so a
first-invoice-only discount isn't buildable without Charge-at-Will (or
equivalent). **User explicitly confirmed this is understood and not to be
worked on now** — logged here only so the walkthrough's raw observation has a
home and isn't lost, per `audit/UserObservations.md`'s own rule.

## 5. Not yet audited
Everything else about this capability (Subscribe path from the pricing page,
coupon/referral field wiring at THIS moment vs. at checkout, plan comparison
correctness, FAQ content ownership) — deferred to when this capability comes
up properly in the dependency order.
