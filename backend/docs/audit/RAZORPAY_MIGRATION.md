# Razorpay Migration — Subscriptions → Charge at Will

> **Status: VALIDATION COMPLETE — this is now the implementation guide (no production code written yet).**
> Charge-at-Will has been validated end-to-end on the account (see
> `CHARGE_AT_WILL_EVIDENCE_PACKAGE.md` and `CHARGE_AT_WILL_VALIDATION.md`). This is a **required**
> migration: the current Subscriptions/Plans code path returns 401 on the live account (Charge-at-Will
> and Subscriptions cannot run simultaneously). **Investigation is closed; the sections below from §0a
> onward are preserved as the research trail. Read §IG (Implementation Guide, immediately below) as the
> authoritative plan — where it conflicts with older sections, §IG wins.**

---

# §IG. Implementation Guide (authoritative)

## IG.0 — Validated facts this plan is built on

| Fact | Evidence |
|---|---|
| Onboarding path that works here | **Registration Link** — `POST /v1/subscription_registration/auth_links` (NOT Standard Checkout `order+recurring`) |
| Mandate registration succeeds | live webhook `token.confirmed` → `token_TEAQs4ztj3WShU` (recurring, confirmed, max_amount echoed) |
| Recurring charge succeeds | `POST /v1/payments/create/recurring` → HTTP 200, `payment.captured` |
| Auth webhook sequence | `token.confirmed` → `payment.authorized` → `payment.captured` → `order.paid` → `invoice.paid` |
| Recurring-charge webhook sequence | `payment.captured` → `order.paid` (NO `payment.authorized` on a token debit) |
| Test-mode instrument | card `4718 6091 0820 4366` (recurring test card); **UPI Autopay only works in live** |
| Irrelevant to CAW | Plans/Subscriptions/Methods 401s — CAW never calls these |

## IG.1 — Architecture decisions (the 11 questions, answered)

1. **Where is `token_id` stored?** New field on `Subscription` (or a new `Mandate` sub-doc). Persisted
   from the `token.confirmed` webhook (and/or read off `payment.captured.token_id`).
2. **What replaces `razorpaySubscriptionId`?** Nothing 1:1. The durable handle becomes **`token_id` +
   `customer_id`**. `razorpaySubscriptionId`/`razorpayPlanId` are removed.
3. **How are renewals scheduled?** Our **own cron** owns all scheduling. Razorpay never auto-renews.
   Cron → find orgs due today → create order → `payments/create/recurring` against stored token.
4. **How do upgrades work?** Compute new bill → create order for the difference (or the new amount) →
   charge token → update stored recurring amount. No new subscription, no plan swap, no plan cache.
5. **How do downgrades work?** Store `pendingUpdate` locally only; **no Razorpay call at schedule time**;
   the renewal cron computes the lower amount and charges the token at cycle end.
6. **How do seat increases work?** Same as upgrade — recompute bill, charge difference, update stored
   amount. Must stay under the mandate `max_amount` (build headroom at Acquisition).
7. **How do failed renewals work?** `payment.failed` webhook → mark past_due → retry policy (our cron).
   Note: a failed recurring debit may require re-authorization (docs) — handle as a real branch.
8. **How do retries work?** Our cron owns retries. If we send a pre-debit `notification` object, Razorpay
   does NOT auto-retry (we must); the 36h5m TAT applies. Decide notification policy explicitly.
9. **Token paused?** `token.paused` webhook → block charges, prompt customer to resume.
10. **Token cancelled?** `token.cancelled`/`token.rejected` → mandate dead; require a new Registration
    Link (re-onboard) before charging again.
11. **Which webhook owns what?** `token.confirmed` → activate mandate/store token. `payment.captured` +
    `order.paid` → record successful charge, extend period. `payment.failed` → past_due/retry.
    `token.paused/cancelled/rejected` → mandate state changes. Verify `X-Razorpay-Signature` on all.

## IG.2 — Implementation order (backend first; do NOT start frontend)

**Step 1 — `Subscription` model.** Remove `razorpaySubscriptionId`, `razorpayPlanId` (and the
`required:true` on the latter). Add: `razorpayCustomerId`, `mandateTokenId`, `mandateStatus`
(none|initiated|confirmed|paused|cancelled|rejected), `mandateMaxAmount`, `mandateExpiresAt`.

**Step 2 — Acquisition.** Replace `subscriptions.create()` with
`POST /v1/subscription_registration/auth_links` (fields validated: `type:link`, `amount`, `currency`,
`subscription_registration:{method, max_amount, expire_at, frequency}`). Surface the returned
`short_url` to the customer. Build **headroom** into `max_amount`.

**Step 3 — Webhook handler.** Add handlers for `token.confirmed` (persist `mandateTokenId`,
`mandateStatus=confirmed`, `mandateMaxAmount`), `token.paused/cancelled/rejected`. **Verify
`X-Razorpay-Signature` on the raw body.** Add idempotency via `x-razorpay-event-id`.

**Step 4 — Renewal engine (cron).** find-orgs-due-today → `calculateInvoice()` → create order (set
`payment_capture` explicitly) → `POST /v1/payments/create/recurring` (token) → handle
captured/failed via webhook.

**Step 5 — Upgrade / Downgrade / Seats.** All route through `calculateInvoice()` → order → charge token
(upgrade/seat now) or store `pendingUpdate` for renewal (downgrade). This is where the earlier Upgrade
and Downgrade findings (BUG-040 etc.) get structurally resolved by a single source of truth.

**Step 6 — Remove dead architecture.** Delete Plan creation scripts, `findOrCreateRazorpayPlan()`, the
Razorpay-Plan cache, and all `subscriptions.*`/`plans.*` call sites once flows are cut over.

## IG.3 — Build checklist (from the lifecycle audit; do not skip)

Persist `token_id`; verify auth-response signature; verify webhook signature (raw body); gate first
charge on `token.confirmed`; subscribe to `token.*` events; set `payment_capture` explicitly; decide
pre-debit `notification` policy (36h5m TAT, no auto-retry); webhook idempotency; handle
`payment.failed`→re-auth; mandate headroom on `max_amount`; normalize `recurring` to boolean; loosen
`Subscription.razorpayPlanId` schema; renewal engine owns all scheduling.

---

## 0a. ⚠ eMandate vs. UPI Autopay — a real open distinction, not yet resolved for this account

**Crawled directly from `razorpay.com/docs/payments/recurring-payments`
(the hub page) and the full eMandate sub-tree this session.** Important
correction to the framing of everything before this point in the document's
history: **eMandate and UPI Autopay are two separate Razorpay products**,
with different payment instruments and different API shapes. The hub page
lists them as distinct entries alongside Cards and Paper NACH. Earlier
research in this document implicitly assumed UPI Autopay throughout (the
walkthroughs in this audit showed UPI QR checkout screens); the eMandate
docs describe a materially different flow that this document had not
previously accounted for:

| | UPI Autopay | eMandate |
|---|---|---|
| Instrument | UPI | Net Banking, Debit Card, or Aadhaar authentication |
| Order params | token-based, UPI-specific fields | `method`, `recurring: 1` flag, bank account/auth-type fields — **`recurring` must literally equal `1` or the payment is treated as one-time**, per the fetched APIs page |
| Token confirmation timing | not separately confirmed this session | **Confirmed: T+1 days for HDFC and SBI** specifically (per the fetched APIs page) — i.e. NOT instant by default |
| Same-day subsequent-charge cutoff | not found | **Confirmed: the charge request must arrive by 8:59 a.m. for same-day authorization** — a real operational deadline for a renewal cron |
| Instant first-charge option | not confirmed this session | Exists (**"charge during registration"**), but **restricted to HDFC and ICICI only**, and is an **on-demand feature requiring Razorpay support-team activation** — not available by default |

**Action needed before implementation, not just documentation:** confirm
directly with Razorpay support (or the account dashboard) **which product
this specific account's Charge-at-Will setup actually uses** — UPI Autopay,
eMandate, or both. The correct integration code, the onboarding timeline
customers experience, and the renewal cron's scheduling constraints (see the
8:59 a.m. cutoff above) all depend on this answer, and it is not yet
determined. This document's remaining sections describe the pattern common
to both (mandate → token → Order-per-charge), which holds either way, but
the exact field names and timing constraints diverge and must be verified
against whichever product is actually active.

**Tried, and this reveals a new finding — `GET /v1/methods` is ALSO
blocked.** Called directly this session (both via the SDK, which doesn't
even wrap this endpoint, and via a raw authenticated HTTPS request, ruling
out a shell/credential-parsing artifact):

| Endpoint | Status |
|---|---|
| `/v1/methods` | ❌ 401 |
| `/v1/payments` | ✅ 200 |
| `/v1/orders` | ✅ 200 |
| `/v1/customers` | ✅ 200 |
| `/v1/plans` | ❌ 401 |
| `/v1/subscriptions` | ❌ 401 |

**This means the account-level restriction found earlier (§7) is broader
than "Subscriptions + Plans."** `methods` — the endpoint needed to discover
which banks this account can actually use for eMandate — is blocked too.
The bank-list question can no longer be answered by an API call from this
environment; it needs either the Razorpay **Dashboard UI** directly, or a
direct question to Razorpay support alongside the same-ticket follow-up
already recommended (§7/§8). Flagging this as a **pattern worth asking
Razorpay about explicitly**: is the restriction scoped to "legacy
Subscriptions-adjacent APIs" (Plans, Subscriptions, and apparently Methods),
or is it broader than currently mapped? Worth testing 1–2 more adjacent
endpoints (e.g. `/v1/tokens`, `/v1/invoices`) before assuming the boundary
is fully known.

## 0. The core mental model — one mandate, one token, reused across variable charges

> **Epistemic status of this section:** the strong version of this model
> ("one token, indefinitely, never a new mandate") is **directionally
> correct but overstated relative to what Razorpay's public docs actually
> prove.** What's genuinely **Verified** (cited, in Razorpay's UPI Autopay
> recurring-payments + tokens + subsequent-payments docs): a mandate/token is
> reused for future debits, the merchant computes the amount and creates a
> new Order per recurring charge, and Razorpay just executes the debit
> against the existing token. What's **Assumed / not proven by public docs**:
> that the token lasts "indefinitely" in the literal sense, that "no new
> mandate ever" holds as a universal statement across every edge case, and
> exactly which conditions besides revocation/cap-exceeded force
> re-authorization. Treat everything below as the strong architectural
> default, not a guarantee — build the "acquire a new mandate" path as a
> real, reachable code branch, not a theoretical one.

**This is the single most important architectural framing for this
migration, even with that caveat.**

A UPI Autopay **mandate is not a subscription plan.** It does not encode
"Starter" or "₹999/month" or anything about *what* is being billed. A
mandate is, per the docs, an authorization ceiling: *"I permit this merchant
to debit me up to ₹X, on this token, until [some end condition]."* Nothing
about plan tier, seats, add-ons, or coupons lives inside it — that part is
solid, not in question.

**Working assumption for design purposes (not a proven guarantee): the
mandate is created at Acquisition and reused by every other capability** —
Upgrade, Downgrade, Add-on purchase, and Renewal charge a *different amount*
against the *same existing token*, without re-authorizing the customer, **as
long as the amount stays within the mandate's cap and the token hasn't hit
whatever its actual (partially undocumented) end conditions are.** The
migration inventory in §5 reflects this (only the Acquisition row creates a
mandate; every other row says "charge token"), but every capability's
implementation must handle **"the token is no longer usable"** as a real
failure mode — not assume it away because the common case is reuse.

```
Customer authorizes:  "Merchant may debit up to ₹15,000"
        │
        ▼
   token_id  (created once; reused for future debits — confirmed by docs;
              "for how long" and "under what exact conditions it stops
              being valid" are NOT fully specified publicly)
        │
   ┌────┴─────────────────────────────────────────┐
   ▼            ▼            ▼            ▼        ▼
 Month 1      Upgrade      Add-on      Downgrade  Month N
 ₹999         ₹1,499       ₹2,350        ₹850      ₹6,100
   │            │            │            │        │
   └────────────┴────────────┴────────────┴────────┘
     same token, IF still valid and amount is within cap
```

**When a new mandate/authorization is needed** — updated after directly
fetching `razorpay.com/docs/payments/recurring-payments/emandate/integrate/`
and `.../api/payments/recurring-payments/webhooks/` (primary source, not
relayed):

- **Verified:** the computed invoice **exceeds the mandate's `max_amount`** → hard failure, no auto-expansion.
- **Verified, and a genuine correction to the original draft of this doc:** a **failed recurring payment also requires a new authorization transaction**, per the `payment.failed` webhook's own documented description: *"If the payment fails, you need to create an authorisation transaction again."* This is a real, cited trigger for re-authorization that the original "when a new mandate is needed" list did not include — payment failure isn't just "retry the charge," it can mean re-doing mandate setup.
- **Verified:** `token.rejected` and `token.cancelled` are real, distinct webhook-observable states — a token can become unusable outside of the cap-exceeded case, confirming the earlier caution against treating token validity as guaranteed.
- **Still Assumed, not directly confirmed:** customer revocation and payment-method/bank changes as triggers — plausible, not found explicitly stated on the pages fetched this session.

**Also newly confirmed — merchant owns 100% of scheduling, cited directly:**
*"Subsequent payments need to be created manually by you"* and *"Once a
token goes to the confirmed state, you can start creating recurring
payments for the customer as per your business requirements"* — Razorpay
never auto-triggers a recurring charge; every debit is merchant-initiated.
This directly confirms §0's core premise and resolves the scheduling
question raised earlier: **your cron/job layer is the entire scheduler —
Razorpay is purely an on-demand execution rail.**

**Practical implication for the mandate amount chosen at Acquisition:** since
this SaaS has variable, growing invoices (seats, add-ons, upgrades), the
initial mandate ceiling should be set with meaningful headroom above the
customer's current plan price — not exactly equal to it — specifically to
avoid hitting the hard-failure case on a routine upgrade or seat purchase.
This is a product decision (how much headroom, and what happens on the
rare case it's still exceeded) that belongs in the Acquisition design, not
something to defer.

## 0b. Verified correction — the legacy flow already produces the token; migration doesn't create a new payment identity, it exposes one that already exists

**Provenance note:** everything in this section is from direct, read-only
Razorpay API calls against this project's own TEST-mode account (no new test
payments created), recorded in full with raw payloads in
`docs/audit/CHARGE_AT_WILL_VALIDATION.md` (Test 0, Test 1-partial, and the
three read-only relationship investigations). This corrects an assumption
implicit in earlier drafts of this document.

**What was assumed:** the migration replaces one payment model with another —
roughly `Subscription → Payment` (legacy) becomes `Customer → Token → Order →
Payment` (Charge-at-Will), as if the new token-based identity has to be
created from scratch by new Acquisition code.

**What's actually true, verified against a real payment/order/token/invoice
chain in this account:** the existing legacy `subscriptions.create()` flow
**already mints a reusable UPI token as a side effect of every successful
payment**, and the current code silently discards it — it's never read from
the webhook payload, never stored on `Subscription`. Traced exhaustively:
every one of the ~70 reads of `razorpayPayment.*` in
`controllers/subscriptionController.js` was grepped; `token_id` is not among
them, anywhere.

```
Subscription (legacy onboarding — still the thing that triggers creation)
        │
        ▼
     Payment            (carries token_id today — already, right now)
        │
        ▼
     Token              ← this is the object that survives the migration
        │                  (customer_id is its real foreign key — it's a
        │                  customer-scoped asset, not a subscription-scoped
        │                  one; entity_id only records what created it)
        ▼
   (reused by Upgrade / Downgrade / Add-on / Renewal — new Order each time,
    same token, per §0/§1)
```

**Concrete evidence chain** (one real payment in this account, IDs redacted
of nothing — these are the actual test-mode IDs):
`cust_T8EOR3KdzSWvZT` → `token_TBnT7mU4PdTbV2` (`max_amount: 76700`,
`entity_id: "TBnSzxBNgSTMGp"`) → `sub_TBnSzxBNgSTMGp` (confirmed via
`Invoice.subscription_id`; **not** fetchable directly — `subscriptions.fetch`
by ID also returns 401, not just `subscriptions.all`, a new data point) →
`inv_TBnT0q3d1u3SAc` → `order_TBnT0zlSNOaVix` → `pay_TBnT7LJ73qANWo`
(`token_id: token_TBnT7mU4PdTbV2`, closing the loop).

**Why this matters for the migration:** Acquisition may not need a whole new
"mandate creation" callback flow built from nothing. If `payment.captured`
already carries `token_id` (confirmed — the webhook handler receives the same
payment object shape fetched here), the minimal Acquisition change could be:
customer completes the existing checkout → webhook arrives → **extract and
store `token_id` (currently thrown away) → subscription is now
Charge-at-Will-capable.** That's a materially smaller change than "build a
new authorization flow." This still needs to be proven end-to-end with a
fresh, from-scratch run (Test 1 live), not just inferred from one pre-existing
token — recorded as the next validation step.

**One item this can't resolve read-only:** whether the token remains
chargeable after its originating subscription (`sub_TBnSzxBNgSTMGp`) is
cancelled. Since `subscriptions.fetch` is 401'd, subscription status can't be
checked by ID at all through this account's current restriction, and testing
it live would require either firing an actual charge attempt post-cancellation
or asking Razorpay support directly. Left open in §6.

## 1. The reframe — this is 6 capabilities, not 27 call sites

The raw inventory found 27 individual `razorpay.subscriptions.*` /
`razorpay.plans.*` / `findOrCreateRazorpayPlan()` call sites. Organizing the
migration around them individually would be a mistake — they collapse into
six business capabilities, each following one of three simple patterns:

| Capability | Legacy pattern | Charge-at-Will pattern |
|---|---|---|
| New Subscription (Acquisition) | Create Plan → Create Subscription | Create Customer → Authorize Mandate → store `token_id` |
| Upgrade | `subscriptions.update` (recurring plan swap) | Compute invoice → create Order → charge token |
| Downgrade | `findOrCreateRazorpayPlan` + `subscriptions.update(..., schedule_change_at:'cycle_end')` | Store `pendingUpdate` locally only; **no Razorpay call at schedule time at all** — renewal cron computes the lower invoice and charges the token |
| Add-on purchase/removal | `subscriptions.update` (recurring plan swap) | Compute invoice → create Order → charge token |
| Renewal | Razorpay's own Subscription auto-renews | Cron computes invoice → creates Order → charges token |
| Cancellation | `subscriptions.cancel` | Disable the renewal cron for this org; optionally revoke the token |

Three of the six (Upgrade, Add-on, Renewal) are **literally the same
pattern** — compute an invoice, create an Order, charge the stored token.
Downgrade is a variant (schedule the *input* to that same pattern, don't
call Razorpay until it's time to charge). Acquisition and Cancellation are
the two genuinely distinct operations (mandate setup, mandate teardown).

## 2. The real chokepoint is not `findOrCreateRazorpayPlan()`

The original inventory named `utils/addonManagement.js:14`
(`findOrCreateRazorpayPlan`) as the chokepoint. That was the **legacy**
chokepoint — correct for today's code, wrong target for the redesign.

**The new chokepoint should be one canonical invoice computation function**
— `calculateInvoice(subscription)` or `calculateRenewalAmount(subscription)`
— that every capability calls instead of independently recomputing a total:

```
Subscription
     │
     ▼
calculateInvoice()
     │
     ├── plan
     ├── seats / add-ons
     ├── coupons
     ├── referral rewards
     ├── scheduled changes (pendingUpdate)
     ├── pending removals (pendingAddonRemovals)
     └── GST
     │
     ▼
Invoice Amount
     │
     ▼
create Order → charge token
```

## 3. Why this fixes a whole class of bugs, not just the outage

This is the most important architectural point from this audit. Re-reading
the findings register with this lens:

- **BUG-022** (coupon dropped from `totalAmount` during upgrade settlement) — caused by `buildPricingSnapshot()` being called *without* a coupon argument at one specific recalculation site.
- **BUG-026** (same coupon-drop pattern suspected at renewal-time add-on removal) — a second, independent recalculation site with the same omission.
- **Gap A** (downgrade never reconciled at renewal) — caused by `pendingUpdate` being read by *no* renewal code path at all; a third recalculation site that was never built.
- **BUG-023 / BUG-029** (checkout, Scheduled Change card, Timeline, and Billing sidebar disagreeing about the same subscription's price) — each of these is yet another *independent* recalculation, reading a different subset of the same underlying fields.

**These are not five unrelated bugs. They are five different call sites
each computing "what does this subscription cost" from scratch, with no
shared function guaranteeing they agree.** The Upgrade Architecture
Review's §12 finding ("Pricing has no single authoritative representation")
was already pointing at this — the migration is the natural place to fix it
structurally, not by patching each site individually.

**Broadened root cause (this is the sharper framing):** the actual
architectural defect underlying nearly every billing inconsistency found in
this entire audit is that **the Razorpay Subscription object became a
second source of truth.** This backend already owns plans, seats, add-ons,
coupons, referrals, and scheduled changes — but Razorpay's own Plan/
Subscription/Schedule objects hold a *second, independently-updated*
representation of the same facts. Every synchronization bug this audit
found is two representations drifting apart. Charge at Will removes the
second representation almost entirely — there is no Razorpay-side "Plan" or
"Subscription" object left to drift out of sync with. Only a Customer and a
Token remain on Razorpay's side, and neither encodes pricing.

## 4. What changes vs. what doesn't (this is not a billing rewrite)

**Keep — unchanged by this migration:**
- `Subscription` model (all business fields: `planName`, `activeAddons`, `appliedCoupon`, `pendingUpdate`, `pendingAddonRemovals`, etc.)
- `PlanConfig`, `PlanAddon` (catalog)
- Coupon engine (`discountEngine.js`, `Coupon` model)
- Referral/reward engine (`referralUtils.js`, `referralRewards.js`, `Reward`/`RewardUsage`/`Referral` models) — the reserve/consume/release lifecycle is **payment-rail-agnostic**; it already only cares about a one-time Order's amount, which Charge at Will still uses
- Trial logic, access control (`subscriptionGate`, `restrictByPlan`)
- `BillingEvent`/Timeline, `SubscriptionPayment` history
- Every business rule documented across this audit (Trial contract, Acquisition contract, Upgrade contract, Downgrade scenarios)

**Replace — the payment execution layer only:**
- Every `razorpay.plans.*` call (all deleted — no Plan objects needed)
- Every `razorpay.subscriptions.*` call (replaced with Order + token calls, or deleted where it only *read* Razorpay-side state your backend already owns)
- `findOrCreateRazorpayPlan()` (deleted, superseded by `calculateInvoice()` + a plain Order)
- The two one-off setup scripts (`createRazorpayPlans.js`, `createExtraSeatRazorpayPlan.js`) — deleted, unnecessary under Charge-at-Will
- The Subscription-lifecycle webhook handlers — replaced with Order/payment/token-event webhook handlers

**This framing matters for anyone reading this doc cold:** this is not "we
are rewriting billing." The business logic — pricing rules, coupon
eligibility, referral qualification, entitlements, scheduling semantics —
survives entirely. Only the mechanism that turns "here's what we computed"
into "money moved" is being replaced.

## 5. Full call-site inventory (for implementation reference)

Grouped by target capability, not file order. Every legacy call found via
`grep -rn "razorpay\.subscriptions\.\|razorpay\.plans\.\|findOrCreateRazorpayPlan("`.

**Acquisition** (New Subscription): `subscriptionController.js:585,588` (create plan+subscription), `:2273`, `:2669` (additional creation paths — `:2669` needs confirming it isn't dead/duplicate code before migrating), `:688` (`subscriptions.fetch` for payment-mode detection — Delete, not Replace).

**Upgrade**: `:1867,1870` (settlement plan-swap — this is the exact code already traced in the Upgrade Architecture Review carrying BUG-022).

**Downgrade**: `:1221,1222` (schedule-at-cycle-end mechanism — becomes pure local state, no Razorpay call at schedule time), `:1524,1528` (the dead `pendingUpdate`-reconciliation-at-cancellation code, i.e. the code adjacent to Gap A — Delete entirely, redundant once renewal computes invoices directly).

**Add-on purchase/removal**: `:1645,1647` (add-on settlement plan-swap), `addonManagement.js:330` (inside `applyScheduledAddonRemovals`, the renewal-time removal-application code already confirmed this session to be the real renewal-application path).

**Cancellation**: `:898,909` (cancel+recreate on plan-switch-while-unpaid), `:1052,1057,1064` (near-duplicate of the above, worth merging during rewrite), `:1358` (`subscriptions.cancel`).

**Renewal**: `addonManagement.js:14-19` (`findOrCreateRazorpayPlan`, the legacy chokepoint itself — deleted, all 7 callers redirected to `calculateInvoice()`), `subscriptionController.js:2500,2635` (`subscriptions.fetch` for reconciliation — Delete, state comes from Order/payment webhook payload instead).

**Setup scripts** (not a runtime capability): `scripts/createExtraSeatRazorpayPlan.js:18`, `scripts/createRazorpayPlans.js:46` — both deleted.

## 5a. Webhook infrastructure — source clarified, one real gap found in current code

**Two different Razorpay doc pages, disambiguated this session (the user
asked directly which one actually applies):**
- `razorpay.com/docs/payments/recurring-payments/subscribe-to-webhooks/` — a thin landing/index page; confirmed to contain no event names, no setup steps, no verification details. Not useful beyond pointing elsewhere.
- `razorpay.com/docs/webhooks/` — Razorpay's **general-purpose** webhook documentation (all products: orders, payments, settlements, disputes), **not** recurring-payment-specific. It does NOT list `token.confirmed` or any mandate/token events — confirming those genuinely only exist on the API-reference page already cited in §6 (`docs/api/payments/recurring-payments/webhooks/`), which remains the correct, sole source for the 9-event catalog already in this document.

**One fact from the general webhook page that IS new and relevant:**
Razorpay explicitly states *"You can set up webhooks from your Dashboard and
configure separate URLs for **Live** mode and **Test** mode"* — test and
live webhooks are independently configured (separate URL, separate secret),
not a single shared configuration.

**Gap confirmed in the current codebase (not previously checked):** grepped
`.env` and `subscriptionController.js` — there is exactly **one**
`RAZORPAY_WEBHOOK_SECRET`, used unconditionally by `handleWebhook`'s HMAC
signature check regardless of mode. This is fine today (test-mode only), but
**going live will require adding a second, live-mode webhook secret** — the
code has no mode-aware branching for this at all currently. Small, but a
real pre-go-live checklist item, not something to discover at cutover time.

## 5b. Live account evidence — the biggest findings in this entire document

**This section is different in kind from everything above it.** Everything
in §0–§5a is derived from Razorpay's public documentation. What follows is
**real data pulled directly from this account's live Razorpay state** via
authenticated API calls this session — not inference, not documentation.

**Tested `/v1/invoices` and `/v1/tokens` (via the correct
`/v1/customers/{id}/tokens` scoped path, not the bare 404'ing path) against
the currently-active credentials:**

| Endpoint | Result |
|---|---|
| `/v1/invoices` | ✅ 200 — and returned a real, existing invoice |
| `/v1/customers/{id}/tokens` | ✅ 200 — **not blocked at all**; my first attempt at a bare `/v1/tokens` 404'd only because Tokens is customer-scoped, not because of an account restriction |

**Finding 1 — the eMandate-vs-UPI-Autopay open question from §0a is
resolved, definitively:** this account has **35 existing tokens**, every
one inspected has `method: "upi"`. **This account's Charge-at-Will setup is
UPI Autopay, not eMandate.** The eMandate-specific facts gathered in §0a
(T+1 confirmation, 8:59 a.m. cutoff, HDFC/ICICI-only instant-charge) do
**not** directly apply to this account's actual integration — they remain
useful context (the general mandate/token *pattern* is shared across both
products) but should not be treated as this account's specific operational
constraints going forward. **This is exactly the ambiguity §0a flagged as
needing resolution — now resolved by data, not assumption.**

**Finding 2 — a real, live version of the exact risk warned about in §0
already exists in this account's data.** Inspecting individual tokens:
```json
{ "max_amount": 76700, "recurring_details": { "amount_blocked": 76700, "amount_debited": 76700 } }
```
`max_amount` here is **exactly** ₹767.00 — which matches, precisely, the
Business-plan total (₹650 + 18% GST) observed live during this audit's
earlier Upgrade walkthrough. **The mandate cap was set to the exact current
bill, with zero headroom.** §0's "practical implication" section
recommended headroom specifically to avoid this; the live data shows the
current (legacy Subscriptions-based) integration does the opposite. Under
the new architecture, `calculateInvoice()`'s output must never be used
directly as the mandate's `max_amount` — a customer's very first upgrade or
seat purchase would immediately exceed a zero-headroom cap and hard-fail.
**This is now a confirmed, not hypothetical, design requirement for Phase 4
(the frozen target architecture).**

**Finding 3 — token expiry is real and now has a concrete number, not
"partially documented":**
```
token created_at:  2026-07-10T12:17:44Z
token expired_at:  2027-06-13T18:30:00Z   (≈ 11 months later)
```
This directly replaces §0's earlier "not proven to last indefinitely, exact
end conditions partially documented" hedge with an actual data point: **UPI
Autopay tokens on this account carry a finite validity window of roughly 11
months from creation**, not an indefinite one. The re-authorization flow
(Acquisition's pattern) needs to be reachable as a real, periodic event for
every customer — not an edge case.

**Finding 4 — relevant to open question 3 (existing-subscriber migration):**
this account already has a real customer (`cust_T8EOR3KdzSWvZT`) with 35
confirmed, valid UPI tokens accumulated from this audit's own earlier
manual testing (visible in the volume — one token was minted per successful
UPI payment made throughout this session's walkthroughs). This is
circumstantial but suggestive evidence that **the legacy `subscriptions.create()`
call, when paid via UPI, already mints a real UPI Autopay token as a
side-effect today** — meaning at least some infrastructure for token
capture may already effectively exist in this account's payment history,
even though the code never stored or used those `token_id`s. Worth a
targeted check (not done this session): does the `payment.captured` webhook
payload for a UPI-paid subscription already include a token reference the
current code silently discards?

---

**Provenance note:** the entries below marked "Verified — fetched directly"
were confirmed by actually retrieving Razorpay's pages this session
(`docs/payments/recurring-payments/emandate/integrate/` and
`docs/api/payments/recurring-payments/webhooks/`) — not by accepting a
paraphrase secondhand. Everything else in this section was relayed from
earlier research and is marked accordingly; do not treat the two tiers as
equally reliable.

**Verified — fetched directly, this session:**
- The flow is mandate/token-based; the token is reused for future recurring debits.
- **Scheduling is entirely the merchant's responsibility.** Quoting the fetched page directly: *"Subsequent payments need to be created manually by you"* and *"Once a token goes to the confirmed state, you can start creating recurring payments for the customer as per your business requirements."* Razorpay never auto-triggers a charge — this resolves the scheduling question raised directly against this doc: your cron/job layer is the entire scheduler; Razorpay is purely on-demand execution.
- The merchant creates a **new Order per recurring charge**, tied 1:1 to that debit.
- **The full webhook event catalog for recurring payments is now known, not assumed** (from `docs/api/payments/recurring-payments/webhooks/`):

  | Event | Fires when |
  |---|---|
  | `payment.authorized` | Customer's payment details successfully authenticated by the bank |
  | `payment.captured` | Payment captured (survives from the legacy list, confirmed real) |
  | `order.paid` | An order's payment completes |
  | `payment.failed` | Payment failed — **and, per the doc, "you need to create an authorisation transaction again"** |
  | `token.confirmed` | Bank completed mandate registration — subsequent payments can now be created |
  | `token.rejected` | Token creation/registration failed before completing |
  | `token.cancelled` | Token explicitly cancelled/deactivated, usually after a successful creation |
  | `token.paused` | Customer paused the token (UPI only) |
  | `invoice.paid` | A registration link was successfully paid |

  This directly **resolves the former open question #4** and supersedes the
  placeholder event names implied elsewhere in this document — `token.*` and
  `payment.*`/`order.paid` are the real event set for Phase 7's webhook
  replacement, not a guess.
- **Correction to §0's "when a new mandate is needed" list:** a failed recurring payment is itself a documented trigger requiring a fresh authorization transaction (`payment.failed`'s description, quoted above) — not just cap-exceeded or revocation. §0 has been updated to reflect this.
- An **optional "charge during registration" capability exists** — the merchant can charge the customer at the same time as the authorization step, as a distinct feature from a pure ₹0/low-value authorization. This does not fully resolve open question 1 below (the docs still don't state whether this is required, recommended, or how it interacts with your specific invoice amount), but it does confirm Model 1/Model 2 from earlier research are both real, supported options — not speculation.

**Relayed from earlier research, not independently re-verified this
session** (retain the original lower-confidence tag):
- That the token/mandate remains valid "indefinitely" in the literal sense — reuse is documented; the token's full lifecycle end-conditions beyond `token.rejected`/`token.cancelled`/`payment.failed` (now confirmed above) are still not exhaustively documented.
- Existing-subscriber migration (open question 3 below).

**Still open:**

1. Is the first mandate authorization also the first commercial charge, or a separate low-value authorization followed by the real charge? **Now substantially resolved for eMandate specifically** (crawled directly, §0a): the **default** behavior is a pure authorization with **no charge**, followed by a **T+1-day-or-longer wait** for token confirmation (T+1 confirmed for HDFC/SBI) before any commercial charge can be made — Model 3 from the earlier research, not Model 1 or 2. An **instant combined authorize-and-charge** option does exist ("charge during registration"), but it is **restricted to HDFC/ICICI only** and requires **Razorpay support-team activation** — not a default, general-purpose option. **Product implication, not yet decided:** new customers should be told upfront to expect a delay before their subscription activates (unless they're on HDFC/ICICI and the feature is specifically enabled for this account), which is a real onboarding-UX decision this document hasn't addressed until now. If UPI Autopay turns out to be the product actually in use (see §0a), this specific timing may differ and needs separate confirmation.
2. **Product decision needed, not a documentation gap:** what should this system do when a computed invoice exceeds the existing mandate's cap? Options: block the charge and notify the customer to re-authorize with a higher cap; proactively re-authorize before hitting the failure; or size initial mandates generously. Not something more doc-reading resolves.
3. Is there a way to migrate an *existing* paid subscriber's Razorpay Subscription into a Charge-at-Will mandate without forcing re-authorization? Razorpay documents a **separate** "Autopay interoperability" flow for importing eMandates from *other payment aggregators* — a different scenario from converting an existing Razorpay Subscription object. **Still undocumented publicly for this exact case** — needs direct Razorpay confirmation.

## 7. Evidence this migration is actually required right now (not optional)

Directly tested, this session, against the live account using the
currently-active `.env` credentials (not simulated):

| API family | Result |
|---|---|
| `payments.*` | ✅ Works |
| `orders.*` | ✅ Works |
| `customers.*` | ✅ Works |
| `plans.*` | ❌ 401 Unauthorized |
| `subscriptions.*` | ❌ 401 Unauthorized |

Confirmed via both the Razorpay Node SDK and raw `curl` with HTTP Basic
Auth (ruling out an SDK bug). Every currently-shipped code path in §5 that
calls `subscriptions.*`/`plans.*` will fail with this exact 401 until this
migration lands — this is why "payments used to work, then stopped."

## 8. Suggested order of work (not started)

1. Design `calculateInvoice(subscription)` — one function, all 6
   capabilities call it. This should absorb the logic currently duplicated
   across `buildPricingSnapshot` call sites (§3) and explicitly include
   coupon + referral-reward modifiers on **every** call, closing BUG-022/026
   by construction rather than by patching each site.
2. Design the mandate-authorization flow for Acquisition (blocked on open
   question #1 above — needs a real test transaction or Razorpay support
   confirmation before finalizing).
3. Replace Upgrade/Add-on/Renewal's `subscriptions.update` calls with
   `calculateInvoice()` → Order → charge-token (the shared pattern).
4. Replace Downgrade's schedule-time Razorpay call with pure local state;
   wire `calculateInvoice()` into the renewal cron so scheduled downgrades
   finally take effect (this is Gap A, closed as a side effect).
5. Replace Cancellation's `subscriptions.cancel` with local
   disable-renewal + optional token revocation.
6. Delete the two setup scripts and `findOrCreateRazorpayPlan`.
7. Replace webhook handlers: Subscription lifecycle events → Order/payment/
   token lifecycle events.
8. Existing-subscriber migration plan (open question #3) — last, since it
   depends on whatever Razorpay support says is possible.

No code has been written for any of the above. This document is the
roadmap; implementation is a separate, deliberate next step.
