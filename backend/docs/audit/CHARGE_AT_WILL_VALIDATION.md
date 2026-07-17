# Charge-at-Will Validation

Phase 1 of the migration plan (see `RAZORPAY_MIGRATION.md`). This document exists to eliminate
implementation uncertainty **before any production code changes**. Everything here is produced by
throwaway scripts run against the project's TEST-mode Razorpay key
(`RAZORPAY_KEY_ID=rzp_test_T53zjtHIAybDn3`, confirmed in `backend/.env`). No production code was
modified to produce this evidence. Scripts live outside the repo, in the session scratchpad
directory, and are not committed.

Format per finding: **Finding / Evidence / Raw payload / Conclusion**.

---

## Test 0 — API surface probe (prerequisite check before designing Test 1-6)

**Finding:** The TEST-mode key has the identical 401 split previously found against the
live-adjacent key: `plans.all` and `subscriptions.all` return 401 Unauthorized; `customers.all`,
`orders.all`, `payments.all`, `invoices.all` all succeed.

**Evidence:** Direct SDK calls, `00-probe-apis.js`.

**Raw output:**
```
Using key_id: rzp_test_T53zjtHIAybDn3
FAIL plans.all: 401 "Unauthorized"
FAIL subscriptions.all: 401 "Unauthorized"
OK   customers.all: {...}
OK   orders.all: {...}
OK   payments.all: {...}
OK   invoices.all: {...}
```

**Conclusion:** The account-level product restriction is not a live-vs-test artifact — it's
consistent across both keys. Charge-at-Will validation (Tests 1-6) can proceed entirely on
Orders + Payments + Tokens, which is exactly the API surface the target architecture depends on.
This is good news for the migration: nothing in Tests 1-6 depends on an API that's blocked.

---

## Test 1 (partial) — Token production as a side effect of the legacy flow

**Finding:** The existing/legacy `subscriptions.create()` UPI flow already produces a reusable
token (`token_id`) on the resulting payment. The current codebase never reads or stores this
field anywhere (confirmed earlier: `Subscription.js` has no token/mandate fields at all). This
resolves the open question flagged in `RAZORPAY_MIGRATION.md` §6 ("whether legacy code already
captures a token_id it discards") — **confirmed yes, it does, and it's discarded.**

**Evidence:** `01-inspect-existing-customer-tokens.js` (led to discovery), `02-fetch-payment-full.js`,
`03-fetch-token.js`, run against pre-existing test-mode data (`cust_T8EOR3KdzSWvZT`,
`order_TBnT0zlSNOaVix`, `pay_TBnT7LJ73qANWo`) already present in the test account before this
session — these were not created by today's scripts, they're artifacts of earlier legacy-flow
usage.

**Raw payload — payment.fetch(pay_TBnT7LJ73qANWo):**
```json
{
  "id": "pay_TBnT7LJ73qANWo",
  "status": "captured",
  "order_id": "order_TBnT0zlSNOaVix",
  "method": "upi",
  "description": "undefined Plan - monthly",
  "customer_id": "cust_T8EOR3KdzSWvZT",
  "token_id": "token_TBnT7mU4PdTbV2",
  "amount": 76700,
  "fee": 826,
  "tax": 126,
  "vpa": "testuser@razorpay",
  "upi": { "vpa": "testuser@razorpay", "flow": "intent" }
}
```

**Raw payload — tokens.fetch(token_TBnT7mU4PdTbV2):**
```json
{
  "id": "token_TBnT7mU4PdTbV2",
  "entity": "token",
  "method": "upi",
  "vpa": { "username": "testuser", "handle": "razorpay", "status": "valid" },
  "created_at": 1783685864,
  "start_time": 1783685924,
  "entity_id": "TBnSzxBNgSTMGp",
  "max_amount": 76700,
  "expired_at": 1812911400,
  "customer_id": "cust_T8EOR3KdzSWvZT"
}
```

**Conclusion:**
1. `entity_id: "TBnSzxBNgSTMGp"` is a subscription ID — this token is bound to the legacy
   Subscriptions product, reconfirming it's a side-effect of that flow, not something the app
   requested directly.
2. `max_amount: 76700` = exactly ₹767 (the plan amount at time of mandate creation) — **reconfirms
   the zero-headroom finding from `RAZORPAY_MIGRATION.md` §5b with the literal token itself**, not
   an inference from a different token. This is now Verified twice, independently.
3. `expired_at - created_at` = 29,225,536 seconds ≈ **338 days**, reconfirming the "~11 months"
   expiry estimate with concrete data instead of a relayed/assumed figure.
4. Also noted in passing, not chased: `payment.description = "undefined Plan - monthly"` — a
   pre-existing bug (plan name not populated at subscription-create time). Logging as a pointer
   only per the standing rule against branching into new investigations mid-test; not registering
   in `BillingFindings.md` yet since it wasn't observed via product UI.

**Still outstanding for Test 1 (needs a browser-driven checkout, not pure API):** the from-scratch
flow — Customer → Order-with-token-intent → checkout authorization → capture → token stored →
fresh Order → charge with `token_id` → webhook → success — has not yet been exercised end-to-end
under this session's control. The token above was pre-existing, not created live. Proceeding to
that next, using the in-app Browser tool for the checkout/authorization step since Razorpay's UPI
intent flow cannot be completed headlessly via server-side API calls alone.

---

## Test 1 (partial, continued) — Read-only relationship map + webhook-code audit

Per explicit instruction, these three read-only investigations were completed **before** standing
up any webhook listener or browser-driven checkout, since they might eliminate uncertainty without
creating new test payments.

### 1. Object relationship map (Customer → Token → Subscription → Invoice → Order → Payment)

**Evidence:** `04-map-relationships.js` — direct fetches of `orders.fetch`, `orders.fetchPayments`,
`customers.fetch`, `subscriptions.fetch` (by ID, not just `.all`), `invoices.fetch`, all against the
pre-existing chain rooted at `pay_TBnT7LJ73qANWo`.

**Raw payload — orders.fetch(order_TBnT0zlSNOaVix):**
```json
{ "id": "order_TBnT0zlSNOaVix", "amount": 76700, "amount_paid": 76700, "amount_due": 0,
  "status": "paid", "attempts": 1, "created_at": 1783685858 }
```

**Raw payload — customers.fetch(cust_T8EOR3KdzSWvZT):**
```json
{ "id": "cust_T8EOR3KdzSWvZT", "email": "chaitya.doshi@somaiya.edu",
  "contact": "+918928844957", "created_at": 1782907321 }
```

**Raw payload — subscriptions.fetch("TBnSzxBNgSTMGp") [the token's entity_id]:**
```
FAIL 401 "Unauthorized"
```
New data point: the restriction applies to **fetch-by-ID**, not just `.all()` listing. The
Plans/Subscriptions product is fully inaccessible on this key, not just its list endpoints.

**Raw payload — invoices.fetch(inv_TBnT0q3d1u3SAc) — the bridge object:**
```json
{
  "id": "inv_TBnT0q3d1u3SAc",
  "customer_id": "cust_T8EOR3KdzSWvZT",
  "order_id": "order_TBnT0zlSNOaVix",
  "subscription_id": "sub_TBnSzxBNgSTMGp",
  "payment_id": "pay_TBnT7LJ73qANWo",
  "status": "paid",
  "line_items": [{ "name": "growth (Rs.767/mo incl. GST)", "amount": 76700, "type": "plan" }]
}
```

**Conclusion — full chain, IDs verified end to end:**
```
Customer (cust_T8EOR3KdzSWvZT)
      │ customer_id (the real FK)
      ▼
Token (token_TBnT7mU4PdTbV2) — entity_id: "TBnSzxBNgSTMGp" (provenance, not ownership)
      ▼
Subscription (sub_TBnSzxBNgSTMGp) — NOT directly fetchable (401 on fetch-by-ID too)
      ▼ (confirmed only via Invoice.subscription_id)
Invoice (inv_TBnT0q3d1u3SAc) — the object that actually links subscription ↔ order ↔ payment
      ▼
Order (order_TBnT0zlSNOaVix)
      ▼
Payment (pay_TBnT7LJ73qANWo) — carries token_id, closing the loop back to Token
```
The Invoice object is the only entity that carries all four IDs simultaneously — it's the
practical Rosetta stone for tracing legacy Subscriptions data even though Subscriptions itself is
unreachable via this key.

### 2. Is `token_id` already arriving in the current webhook flow, just ignored?

**Evidence:** grepped every occurrence of `razorpayPayment.` in
`controllers/subscriptionController.js` (Grep tool, ~70 matches across `handlePaymentCaptured` and
all sibling webhook-payload consumers).

**Finding:** confirmed — **`token_id` is never read, anywhere in this file.** Only `id`, `order_id`,
`amount`, `status`, `method`, `notes` are ever destructured off the payment payload. Since we've
independently confirmed (Test 1-partial) that Razorpay's actual `payment.captured` payload for a
UPI Autopay payment does carry `token_id`, this means: **the data is already arriving at the
webhook handler today and is simply dropped on the floor.**

**Conclusion:** Acquisition doesn't necessarily need a new callback flow. The minimal viable change
could be as small as: in the existing `payment.captured` handler, read `razorpayPayment.token_id`
and persist it. This needs to be proven against a **fresh** end-to-end run (not just this
pre-existing token) before being taken as fully confirmed — flagged as the next validation step.

### 3. Is the token a customer asset or a subscription asset?

**Evidence:** field-level inspection of the token object (Test 1-partial) plus the relationship map
above.

**Finding:** `Token.customer_id` is the field actually used to fetch/scope a token
(`tokens.fetch({id, customer_id})` requires it) — that's the real foreign key. `Token.entity_id`
just records what created the token (here, a subscription), it is not a live ownership link with
its own fetch semantics tied to the token. Structurally: **the token is a customer asset that
happens to log its origin**, not a subscription-owned object.

**Not resolved read-only — genuinely needs a live test or a support ticket:** whether the token
remains chargeable after `sub_TBnSzxBNgSTMGp` is cancelled. `subscriptions.fetch` by ID is 401'd on
this key (see above), so subscription status can't even be checked to set up that test read-only.
This is carried into Test 4 (failure behaviour) or, if Test 4 can't safely trigger it, into a direct
question to Razorpay support.

**Migration doc updated:** `RAZORPAY_MIGRATION.md` §0b now documents the corrected model — the
migration is not creating a new payment identity from scratch, it's exposing and persisting a
token that Razorpay's existing flow already produces.

---

## Test 0b — Existing webhook subscription audit (found while preparing to stand up a listener)

**Finding:** the account's one existing webhook config (`webhooks.all()`, read-only) subscribes to
**only two events: `payment.failed` and `payment.captured`.** Every other event is `false`,
including **all six `token.*` events** (`token.authenticated`, `token.confirmed`, `token.rejected`,
`token.paused`, `token.cancelled`, `token.cancellation_initiated`), `order.paid`, and all
`invoice.*` events.

**Raw payload — webhooks.all():**
```json
{
  "id": "T53yomULm9sE0v",
  "url": "https://pluck-chewable-briskness.ngrok-free.dev/api/subscription/webhook",
  "active": true,
  "events": {
    "payment.authorized": false, "payment.failed": true, "payment.captured": true,
    "order.paid": false, "invoice.paid": false,
    "token.authenticated": false, "token.confirmed": false, "token.rejected": false,
    "token.paused": false, "token.cancelled": false, "token.cancellation_initiated": false
  }
}
```
(full 48-event object recorded in script output; all omitted here are also `false`)

**Conclusion:** independent of anything in the application code, **this app cannot possibly be
reacting to token lifecycle changes today, because Razorpay is never configured to send those
events to it.** This is a prerequisite gap for Charge-at-Will regardless of how the application
code is written — the webhook subscription itself needs `token.confirmed`, `token.rejected`,
`token.paused`, and `token.cancelled` (at minimum) enabled before any token-based renewal/retry
logic can react to them. Not registering this in `BillingFindings.md` yet (that register is
scoped to the legacy Subscriptions billing flows); it belongs in the migration's Acquisition/Token
design instead, and is noted in `RAZORPAY_MIGRATION.md`.

**Action taken:** rather than modifying this existing webhook config (points at the real
`/api/subscription/webhook` production route, tied to whatever is currently tunneled at that ngrok
URL), a **separate, temporary webhook** was created via `webhooks.create()` for this validation
only, pointed at a throwaway listener on a fresh ngrok tunnel, subscribed to every event relevant
to Charge-at-Will testing. It will be deleted via `webhooks.delete()` once Tests 1-6 are done.

---

## Test 2 + Test 6 (partial) — Live webhook capture proven working; order lifecycle + arrival order confirmed

**Context:** the from-scratch UPI Autopay mandate authorization (Test 1, live) is still blocked —
Test Mode's UPI QR doesn't auto-simulate on click (confirmed: order stayed `status: "created"`,
`attempts: 0` after clicking the QR), and no plain "Enter UPI ID" collect field is offered on an
order created with `method: 'upi'` + `token: {...}` mandate params. While isolating that (via a
**control order created without any method/token restriction**, `order_TE8xl8ZqTFx6Zh`), the user
completed a real Test Mode **card** payment against it. This incidentally proved the entire
webhook pipeline end-to-end for the first time this session (temporary listener, widened event
subscription, ngrok tunnel, signature header, raw payload capture all confirmed working) and
produced real order-lifecycle and webhook-ordering evidence.

**Raw webhook payloads received, in arrival order, with real timestamps:**

1. `payment.authorized` — arrived `2026-07-16T10:38:47.109Z`
   `pay_TE8zCQlPBPbE8H`, `status: "authorized"`, `captured: false`, `method: "card"`,
   `token_id: "token_T8EAPf5r5M8SCF"` (a token was minted even for a plain card payment —
   Checkout.js defaults to offering to save the card; confirms token creation isn't exclusive to
   explicit `token:` mandate params, worth carrying into the Acquisition design)
2. `payment.captured` — arrived `2026-07-16T10:38:47.810Z` (**701ms after authorized**)
   same payment, `status: "captured"`, `captured: true`
3. `order.paid` — arrived `2026-07-16T10:38:48.317Z` (**507ms after captured**)
   contains both `payment` and `order` objects; `order.status: "paid"`, `amount_due: 0`

**Order state, confirmed via direct API fetch after the fact:**
```json
{ "id": "order_TE8xl8ZqTFx6Zh", "status": "paid", "amount_paid": 49900, "amount_due": 0, "attempts": 1 }
```

**Conclusions:**
- **Webhook ordering (Test 6), confirmed with real data:** `payment.authorized` →
  `payment.captured` → `order.paid`, strictly in that order, each a few hundred ms apart. This
  matches the docs-derived assumption in `RAZORPAY_MIGRATION.md` and is now Verified with a live
  timestamped example rather than inferred from documentation alone.
- **Order lifecycle (Test 2), confirmed:** `created` (`amount_due` = full amount, `attempts: 0`) →
  `paid` (`amount_due: 0`, `attempts: 1`) happens atomically with the capture; no intermediate
  state was observed between capture and the order flipping to paid.
- **New, unplanned finding:** a `token_id` appears on a payment even when the order didn't request
  one via explicit `token: {...}` params — Checkout.js's default "save card" behavior mints one.
  This means token creation may be even more pervasive in the existing checkout flow than
  previously found (§0b), not limited to the explicit Autopay-mandate code path.
- **Still unresolved:** the actual UPI Autopay mandate registration (real Test 1) — this control
  test used card, not UPI, and had no `token: {max_amount, expire_at, frequency}` mandate params at
  all, so it does not substitute for validating the mandate-specific flow. Continuing to
  investigate a way to complete that specific authorization in Test Mode.

## Test 1 / Test 3 — THE decisive finding: new-mandate acquisition is blocked at the account level, but charging an existing stored token works end-to-end via API

This is the most important result in the validation phase. It bifurcates the migration risk cleanly
and answers "are we missing something" about the failed browser attempts: the browser wasn't the
real blocker — the **account** is, and only for one half of the flow.

### Finding A — Registering a NEW mandate is blocked, for every instrument, at the account level

Multiple independent attempts to authorize a fresh mandate all failed, and the final one produced an
explicit account-level error rather than an environment/UI quirk:

- UPI Autopay via checkout (`method: 'upi'` order + token config): only ever rendered QR/intent, which
  requires a real UPI app; no collect (`Enter UPI ID`) field is offered on this account. Order stayed
  `status: "created"`, `attempts: 0` after interaction. (Not conclusive on its own — could be blamed on
  test-mode/desktop.)
- Forcing UPI collect-only via `config.display.blocks`: **"No appropriate payment method found."**
- Server-side S2S `/v1/payments/create/upi` with `success@razorpay`: **HTTP 400, "The requested URL
  was not found on the server."** (S2S recurring not enabled on this account.)
- Card recurring mandate via checkout (order with token config, no method restriction, `recurring:'1'`,
  test card 4111...): checkout rendered the correct recurring/mandate UI, then failed on submit with:
  **"Your payment was not successful as the seller does not support recurring payments."**

**Conclusion:** the inability to mint a fresh mandate is **not** a test-mode limitation, a browser
limitation, or a wrong-checkout-config problem — it is an **account-level product state**: this account
does not currently support registering new recurring mandates through the standard rails. This is
consistent with, and sharpens, the P0 root cause already documented in `RAZORPAY_MIGRATION.md` §7
(Charge-at-Will enabled, Subscriptions/recurring-registration surface restricted).

### Finding B — Charging an EXISTING stored token via API works, fully, right now

Using the pre-existing UPI token `token_TBnT7mU4PdTbV2` (customer `cust_T8EOR3KdzSWvZT`), a recurring
charge succeeded end-to-end with no browser interaction:

**Request:** `POST /v1/payments/create/recurring` with a fresh order (`order_TE9JbtjRMIYnFF`, ₹100,
well under the token's ₹767 `max_amount`), `token: "token_TBnT7mU4PdTbV2"`, `recurring: '1'`.

**Response — HTTP 200:**
```json
{
  "razorpay_payment_id": "pay_TE9JcSdtbOwpqR",
  "razorpay_order_id": "order_TE9JbtjRMIYnFF",
  "razorpay_signature": "c2f2b1580b1b82e896a7b344815162ad6e6a9a2298b89864b7783c23249eadb5"
}
```

**Webhooks that fired (captured live):** `payment.captured` → `order.paid`.
**Notably ABSENT: `payment.authorized`.** Unlike the fresh card payment in Test 2 (which fired
`payment.authorized` → `payment.captured` → `order.paid`), a debit against an already-authorized
mandate skips the authorized state and goes straight to captured. This is a real, observed behavioral
difference between first-authorization and subsequent-charge that the renewal engine's webhook handling
must account for — it cannot assume `payment.authorized` always precedes `payment.captured`.

### Why this is the decisive result for the migration

The migration's central runtime loop — **compute invoice → create Order → charge stored token → handle
webhooks** (Renewal, Upgrade, Add-on, Downgrade-at-renewal per `RAZORPAY_MIGRATION.md` §1) — is
**proven to work on this account today, via API, with no browser and no new mandate.** The one capability
that is currently blocked is **Acquisition** (minting the *first* mandate/token for a new customer).

This splits the migration into two risk tiers, now evidence-backed rather than assumed:
- **Low risk / already working:** everything that charges an existing token (Renewal, Upgrade, Add-on,
  Downgrade-at-renewal). Verified live.
- **Blocked pending Razorpay account enablement:** Acquisition (new-mandate registration). This is a
  product/account issue to resolve with Razorpay support, **not** something the migration code can fix
  on its own, and **not** something further test-mode effort will unblock.

This also means the ~35 pre-existing tokens on this account (found earlier) are not just historical
artifacts — they are **chargeable assets right now**, which strengthens the §0b insight that the
migration is largely about *exposing and using* tokens Razorpay already holds, not creating a new
payment identity from scratch.

## Test 1 (final) — Docs-exact confirmation: new-mandate registration fails even with a request that copies Razorpay's documentation verbatim

**Purpose:** before concluding "account-level restriction," eliminate every deviation between our
request and Razorpay's official card authorization-transaction example, so the only remaining
explanation is account/product state.

### Field-by-field: our earlier request vs. the official docs

| Field | Official docs (card auth txn) | Earlier request | Docs-exact request (this test) |
|---|---|---|---|
| `amount` | `100` (₹1) | `49900` (₹499) | **`100`** |
| `currency` | `INR` | `INR` | `INR` |
| `customer_id` | mandatory | present | present |
| `method` | `"card"` | omitted | **`"card"`** |
| `token.max_amount` | int | `500000` | **`10000`** (kept low per instructor guidance) |
| `token.expire_at` | `2709971120` | +1yr | **`2709971120`** (verbatim) |
| `token.frequency` | `"monthly"` | `"as_presented"` | **`"monthly"`** |
| `recurring` (checkout) | `true` (boolean) | `'1'` (string) | **`true`** |
| `notes`/`receipt` | optional | present | **omitted** (minimal) |

All three prior deviations (`amount`, `frequency`, `recurring` type) plus `max_amount` were removed.
Instructor guidance ("keep the mandate/authorization amount low during onboarding") was incorporated:
₹1 auth amount, ₹100 mandate ceiling.

### Result — identical failure

- **Create Order:** HTTP 200. Razorpay accepted the order and echoed the `token` block
  (`order_TE9fO9KhTmpVlw`, `method:"card"`, `token:{max_amount:10000, expire_at:2709971120,
  frequency:"monthly"}`).
- **Checkout:** rendered the recurring-mandate UI correctly.
- **Authorization submit (test card 4111...):** **FAILED — "Your payment was not successful as the
  seller does not support recurring payments."** — byte-for-byte the same error as the ₹499/
  `as_presented`/`'1'` attempt.

### Conclusion (now with the last uncertainty removed)

The three-step behavior is stable across a from-scratch business-logic request AND a verbatim-from-docs
request:
1. Order creation succeeds (payload + embedded token accepted).
2. Checkout recognizes and renders the recurring-mandate flow.
3. Authorization fails only on submit, with a **capability** error, not a validation error.

Because a request copied directly from Razorpay's documentation produces the identical failure, the
remaining explanation is **not** an integration defect. This is strong, defensible evidence of an
**account/product-level restriction on new recurring-mandate registration** (consistent with the
Plans/Subscriptions 401s on both test and live, and the P0 Charge-at-Will story). This is the point
to stop debugging integration and raise a Razorpay support ticket.

**Still formally open (only Razorpay can answer):** whether this is a direct consequence of
Charge-at-Will being enabled, and what activation/flag re-enables new-mandate registration while
keeping existing tokens chargeable (which is confirmed working — see the Finding B section above).

### Support ticket (evidence-based, prepared)

> We are migrating from Subscriptions to Charge at Will. On account `rzp_live_T3SnCFAE0GIbQT` (same
> behavior reproduced in test mode):
> - Plans and Subscriptions APIs return 401 Unauthorized; Orders/Payments/Customers/Tokens work.
> - Charging existing recurring tokens via `POST /v1/payments/create/recurring` succeeds (HTTP 200).
> - Creating a **new** recurring authorization transaction **exactly as documented** in your card
>   recurring API reference (amount ₹1, `method:"card"`, `token{max_amount, expire_at, frequency:"monthly"}`,
>   checkout `recurring:true`) results in: the order is created successfully, Checkout renders the
>   recurring mandate UI, but authorization fails with **"The seller does not support recurring payments."**
>
> Could you confirm whether this account is enabled for **new recurring-mandate registration** under
> Charge at Will, whether this is a consequence of Charge-at-Will being enabled, and what activation or
> product flag is required to enable new UPI Autopay / card mandate registration while keeping existing
> tokens chargeable?

## Full-lifecycle audit — Official documented flow vs. our validation flow, stage by stage

Every stage of a successful recurring mandate per Razorpay's official docs, compared field-by-field to
what our validation actually did. Account-level conclusions deliberately set aside; this audit only
asks "did we follow the documented flow, and where do we deviate."

Sources: cards Create-Authorisation-Transaction, cards Create-Subsequent-Payments, Recurring-Payments
Webhooks (all rendered directly from the API reference).

### Stage 1 — Create Customer
| Aspect | Official | Ours | Deviation |
|---|---|---|---|
| Endpoint | `POST /customers` | `rzp.customers.create` | none |
| Fields | name, email, contact, fail_existing, notes | name, email, contact, fail_existing | none (notes optional) |
| Result | returns `customer_id` | returns `customer_id` | none |

### Stage 2 — Create Authorisation Order
| Aspect | Official | Ours (docs-exact, script 16) | Deviation |
|---|---|---|---|
| Endpoint | `POST /orders` | `rzp.orders.create` | none |
| `amount` | 100 (₹1) mandatory | 100 | none |
| `currency` | INR mandatory | INR | none |
| `customer_id` | mandatory | present | none |
| `method` | optional "card" | "card" | none |
| `token.max_amount` | int | 10000 | none |
| `token.expire_at` | unix | 2709971120 | none |
| `token.frequency` | "monthly" | "monthly" | none |
| Result | order `created` + token echoed | HTTP 200, token echoed | none |

### Stage 3 — Create Authorisation Payment (Checkout)
| Aspect | Official | Ours (checkout-docs-exact.html) | Deviation |
|---|---|---|---|
| Script | checkout.js | checkout.js | none |
| `key` | required | present | none |
| `order_id` | mandatory | present | none |
| `customer_id` | mandatory | present | none |
| `recurring` | mandatory boolean `true` | `true` | none |
| Confirmation method | handler fn OR callback_url | handler fn | none (handler valid for web) |
| **Outcome** | customer authorizes → token generated | **FAILS: "seller does not support recurring payments"** | **← failure point** |

### Stage 4 — Handle Authorisation Response  *(never reached — auth failed at Stage 3)*
| Aspect | Official | Ours | Deviation |
|---|---|---|---|
| Response | razorpay_payment_id, razorpay_order_id, razorpay_signature to handler | n/a — never returned | not reached |
| **Signature verification** | expected (HMAC-SHA256 of order_id\|payment_id with key_secret) | **handler only logs, no verify** | **harness gap (moot — never reached)** |

### Stage 5 — Token Confirmation  *(never reached)*
| Aspect | Official | Ours | Deviation |
|---|---|---|---|
| Token states | initiated → confirmed (or rejected/cancelled/paused) | n/a | not reached |
| `token.confirmed` webhook | wait for it before charging | subscription widened to receive it; **never fired** (no fresh auth) | not reached |
| Fetch Token API | confirm status == confirmed before charge | not called for a fresh token | not reached |

### Stage 6 — Create Subsequent Order  *(exercised against a PRE-EXISTING token, script 14)*
| Aspect | Official | Ours | Deviation |
|---|---|---|---|
| Endpoint | `POST /orders` | `rzp.orders.create` | none |
| `amount` | mandatory | 10000 | none |
| `currency` | mandatory | INR | none |
| `payment_capture` | **mandatory boolean** | **omitted** | ⚠️ **omitted a documented-mandatory field** (Razorpay defaulted it; capture still occurred) |
| `notification{token_id, payment_after}` | optional; if omitted → auto-debit after 36h5m, no auto-retry | omitted | ⚠️ assumption (immediate debit worked anyway in test) |
| Result | order created | order created | none |

### Stage 7 — Create Recurring Payment  *(pre-existing token, script 14)*
| Aspect | Official | Ours | Deviation |
|---|---|---|---|
| Endpoint | `POST /payments/create/recurring` | same (raw https) | none |
| `email` / `contact` | mandatory | present | none |
| `amount` / `currency` | mandatory | present | none |
| `order_id` / `customer_id` | mandatory | present | none |
| `token` | mandatory | present | none |
| `recurring` | mandatory boolean | **`'1'` (string)** | ⚠️ minor type deviation (accepted; HTTP 200) |
| `description` | optional | present | none |
| Result | razorpay_payment_id (+order_id+signature) | **HTTP 200, payment_id returned** | none |
| **Response signature verification** | expected | **not verified** | harness gap |

### Stage 8 — Webhooks
| Aspect | Official | Ours (observed live) | Deviation |
|---|---|---|---|
| Auth-txn events | payment.authorized → captured → order.paid; token.confirmed | fresh auth never completed → none for a new mandate | not reached |
| Subsequent-charge events | payment.captured, order.paid | **payment.captured → order.paid observed; NO payment.authorized** | matches docs (authorized is for auth-txn, not token debit) |
| **X-Razorpay-Signature verification** | mandatory (HMAC-SHA256 of raw body with webhook secret) | **listener does NOT verify** | ⚠️ **harness gap** (throwaway listener only; production route `/api/subscription/webhook` uses `rawBodyMiddleware` — separate audit) |
| Idempotency via x-razorpay-event-id | recommended | not implemented in listener | harness gap |

### The decisive audit conclusion

Walking the official flow stage by stage, **the first six documented actions up to and including the
authorization-payment creation (Stages 1–3) were performed exactly as documented** — the docs-exact
request matched every mandatory field. **There is no official step between "create order" and
"customer authorizes" that we skipped.** The checkout invocation *is* the authorization-payment
creation, and we matched its every required parameter (`order_id`, `customer_id`, `recurring: true`).

The failure occurs precisely at the **customer-authorization** moment (Stage 3 outcome) — the step
owned by Razorpay/the bank, not by our request. Every deviation the audit found is either:
- **After** the failure point (Stages 6–8, exercised only against an already-confirmed pre-existing
  token), or
- A **harness gap** (no signature verification in the throwaway listener/checkout — irrelevant to
  whether authorization succeeds), or
- A **documented-optional/defaulted** field (`payment_capture` omitted but defaulted; `notification`
  omitted; `recurring:'1'` string coerced).

**None of the deviations sit on the path to reaching authorization, and none could produce a
"seller does not support recurring payments" gateway rejection.** The audit therefore finds no
skipped or malformed step upstream of the failure. (Account-level interpretation resumes in the
sections above.)

### Genuine gaps this audit surfaces for the eventual production implementation (not causes of the failure)
1. **Authorization-response signature verification** must exist in real code (harness skipped it).
2. **Webhook `X-Razorpay-Signature` verification** — confirm the production `/api/subscription/webhook`
   route actually verifies it (the throwaway listener does not; separate code audit needed).
3. **`payment_capture` is documented-mandatory** on the subsequent order — real renewal code must set
   it explicitly rather than rely on the default.
4. **Pre-debit `notification` object + the 36h5m TAT and no-auto-retry rule** — a real design decision
   the renewal engine must make deliberately (affects retry behavior).
5. **Webhook idempotency via `x-razorpay-event-id`** must be implemented.
6. **Token-status gate** — real Acquisition code must wait for `token.confirmed` / Fetch-Token before
   the first commercial charge; never assume confirmation.

## Post-support test — the Registration Link (CAW) method Support explicitly recommended ALSO fails identically

**Context:** Razorpay Support reviewed the account and replied that **UPI Autopay and Charge at Will
(CAW) are enabled**, pointing to the **Registration Link** creation method
(`/docs/payments/recurring-payments/create/#1-create-a-registration-link`). This is a *different*
integration path from the Standard Checkout (`order+token+recurring:true`) we had been testing — so
we tested it.

**What we did:** `POST /v1/subscription_registration/auth_links` (script 18), docs-exact:
`type:"link"`, `amount:100` (₹1), `subscription_registration:{ method:"card", max_amount:10000,
expire_at:2709971120, frequency:"monthly" }`.

**Link creation: HTTP 200.** Created customer `cust_TEAC8wnfb9NL3U`, order `order_TEAC9B5sWj6EyX`,
invoice `inv_TEAC901hRW4Ixk`, hosted `short_url`. Razorpay's hosted authorization page rendered
correctly, showing the CAW mandate terms: *"Maximum auto-debit amount ₹100.00… Billing frequency:
You may be charged any time until expiry… Expiry 16 Nov 2055."*

**Authorization result: IDENTICAL FAILURE — "Your payment was not successful as the seller does not
support recurring payments."** on Razorpay's own hosted page.

**Server-side state (read-only, script 19):**
- Order `order_TEAC9B5sWj6EyX`: status **`attempted`**, `attempts: 1`, `amount_paid: 0`.
- Payments on order: **0** (the rejected authorization did not create a payment entity).
- Invoice `inv_TEAC901hRW4Ixk`: status **`issued`**, `auth_link_status: "issued"` — mandate never registered.
- No `token.confirmed`, no `payment.failed` webhook fired.

### Revised conclusion (supersedes the earlier "strongly suggests account restriction")

The earlier conclusion was appropriately hedged pending Support. Support's reply ("CAW + UPI Autopay
enabled, use the Registration Link method") was tested directly and **reproduces the identical
failure on Razorpay's own hosted authorization page.** This is now stronger than an inference:

- We have used **both** documented acquisition paths (Standard Checkout **and** the Support-recommended
  Registration Link), on **both** card and UPI, with **docs-verbatim** requests.
- All fail at the customer-authorization step with the same capability error.
- Meanwhile charging **existing** tokens works (HTTP 200).

Therefore: the account is **marked** as CAW/UPI-Autopay enabled, but **new-mandate registration is
non-functional in practice** — the enablement flag Support checked does not reflect the actual
gateway behavior. This is a **Razorpay-side defect or incomplete activation**, not an integration
choice on our end. The support ticket should now be a **rebuttal with reproduction evidence**, asking
for escalation rather than re-reading the docs.

## ✅ RESOLVED / CONCLUSION REVERSED — Charge-at-Will works; the blocker was the wrong test card

**This supersedes every "account-level restriction" conclusion above in this document.** Those
conclusions are now known to be WRONG. Preserved above for the investigative record, but do not act on
them.

**Root cause of every prior failure:** we used test card **`4111 1111 1111 1111`** — a *one-time
payment* test card not enrolled for recurring. Razorpay's test gateway rejects it with the misleading
message *"the seller does not support recurring payments."* The correct **recurring authentication
test card is `4718 6091 0820 4366`** (Domestic Visa Credit, per Razorpay's Test Subscriptions docs).
This card was supplied by Razorpay Support on a call, after Support had already (correctly) stated CAW
and UPI Autopay are enabled on the account.

**Proof — full successful mandate registration via the Registration Link (CAW) method**, captured live:

Webhook sequence: `token.confirmed` → `payment.authorized` → `payment.captured` → `order.paid` →
`invoice.paid`.

- **`token.confirmed`:** `token_TEAQs4ztj3WShU`, `method:"card"`, `recurring:true`,
  `recurring_details.status:"confirmed"`, `max_amount:10000`.
- **`payment.captured`:** `pay_TEAQrXu2tuVkW0`, `token_id:token_TEAQs4ztj3WShU`, card `4366`, on
  `order_TEAC9B5sWj6EyX` — **the exact registration-link order previously recorded as "failed."**
- Order → `paid`, invoice → `paid`.

**What this means:**
1. **New-mandate registration (Acquisition) WORKS on this account.** Support was correct that CAW +
   UPI Autopay are enabled.
2. Combined with the earlier-proven **charge-existing-token** success (`/payments/create/recurring`
   HTTP 200), **the entire Charge-at-Will runtime is now validated end-to-end on this account**:
   Acquisition (register mandate → token.confirmed) AND recurring charge (charge token → captured).
3. The **Plans/Subscriptions 401s are real but irrelevant** to CAW — the CAW flow uses Orders +
   Registration Links + `/payments/create/recurring`, none of which are blocked.
4. **Migration is unblocked.** There is no account issue to resolve. Do not send the escalation/rebuttal
   ticket drafted earlier — Support was right.

**Lesson for the record:** the investigation concluded "restricted" without ever having observed a
single successful authorization. A missing positive control (one confirmed success) mattered more than
any amount of failure analysis. The correct test instrument, once used, resolved it immediately.

**Additional Support clarification — UPI Autopay is not testable in test mode:** Razorpay Support
confirmed that **UPI Autopay mandate registration only works in LIVE mode**; in **test mode you must
use a card** (the `4718 6091 0820 4366` recurring test card). This fully explains the earlier
"UPI only renders QR/intent, no collect, can't complete" observations — that was **not** an account
restriction or an integration defect; UPI Autopay mandate registration simply cannot be simulated in
test mode. Practical consequence for the migration:
- **Test mode:** validate the mandate-registration + token + charge lifecycle using the **card**
  recurring test card. (Done — see above.)
- **Live mode:** UPI Autopay mandate registration works with real UPI apps (real customer approves in
  GPay/PhonePe/etc.). The pre-existing live UPI tokens on the account are evidence this already works.
- Therefore the one genuinely UPI-specific leg (real UPI-app approval) can only be exercised with a
  single small real-money live authorization when ready — it is expected to work, not a risk to chase
  further in test mode.

## Open items carried into next steps

- Complete a from-scratch Test 1 run (needs Browser tool for checkout authorization).
- Stand up a throwaway webhook listener (separate from the production `/api/subscription/webhook`
  route) to capture raw webhook payloads and arrival timestamps for Tests 2, 3, 5, 6.
- Test 4 (failure injection: max_amount exceeded, invalid/expired/cancelled token) can run purely
  server-side once a valid token exists to test against — either the pre-existing
  `token_TBnT7mU4PdTbV2` or a freshly created one.
