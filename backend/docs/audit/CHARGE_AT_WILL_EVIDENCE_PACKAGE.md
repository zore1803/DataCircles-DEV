# Charge-at-Will Migration — Evidence Package

> ## ⚠️ RESOLVED — CONCLUSION REVERSED (read this first)
> **Charge-at-Will works on this account. There is no account-level restriction.** The entire
> "blocked / requires Razorpay escalation" narrative below was caused by using the **wrong test card**:
> `4111 1111 1111 1111` (one-time payment card, not enrolled for recurring), which Razorpay's test
> gateway rejects with the misleading message *"the seller does not support recurring payments."*
> The correct **recurring test card `4718 6091 0820 4366`** completes the mandate successfully.
>
> **Proven end-to-end (live webhooks):** Registration Link → hosted auth page → card + OTP →
> `token.confirmed` (`token_TEAQs4ztj3WShU`, recurring, confirmed) → `payment.captured`
> (`pay_TEAQrXu2tuVkW0`) → `order.paid` → `invoice.paid`. Combined with the already-proven
> charge-existing-token success, **the full CAW runtime (Acquisition + recurring charge) is validated.**
>
> **Do NOT send the escalation/rebuttal ticket in §8 — Razorpay Support was correct.** Sections 1–8
> below are preserved as the (mistaken) investigative trail; §9 (production checklist) remains valid.
> Root-cause lesson: the investigation concluded "restricted" without ever observing one successful
> authorization — a missing positive control outweighed extensive failure analysis.

## Final Conclusion (authoritative)

Charge-at-Will has been successfully validated on the merchant account.

The supported onboarding flow is **Registration Link** (`subscription_registration/auth_links`), which
successfully completed mandate registration and produced a reusable recurring token. Existing recurring
token charging was independently validated using `POST /v1/payments/create/recurring`.

Earlier failures were reproduced only when using an unsupported test card and attempting mandate
registration through a different checkout flow. After using Razorpay's documented recurring test card
(`4718 6091 0820 4366`) and the Registration Link flow, the complete lifecycle succeeded.

Supplementary: UPI Autopay mandate registration is not testable in test mode (test mode uses card;
UPI Autopay works in live with real UPI apps). The Plans/Subscriptions 401s are real but irrelevant to
Charge-at-Will.

**The migration is therefore technically feasible. Remaining work consists of integrating the
Charge-at-Will lifecycle into the application's billing architecture** (see §9 Production Implementation
Checklist).

---

**Status:** RESOLVED — CAW confirmed working; migration Acquisition path unblocked.
**Prepared from:** live and test-mode API probing, browser-driven checkout attempts, a field-by-field
lifecycle audit, and a final successful mandate registration with the correct recurring test card.
**Full raw evidence:** `docs/audit/CHARGE_AT_WILL_VALIDATION.md` (payloads, IDs, timestamps).
**Accounts:** test `rzp_test_T53zjtHIAybDn3`, live `rzp_live_T3SnCFAE0GIbQT`.

---

## 1. Executive Summary

We are migrating billing from Razorpay **Subscriptions** to a **Charge-at-Will** (token/mandate + on-demand
order) model. During validation we found a hard blocker: **this account can charge existing recurring
tokens, but cannot register new recurring mandates.**

- Charging an existing stored token via `POST /v1/payments/create/recurring` **works** (HTTP 200,
  `payment.captured` + `order.paid` fired live).
- Registering a **new** mandate **fails** at the customer-authorization step with
  **"The seller does not support recurring payments"** — for both UPI and card, and even when the request
  is copied **verbatim** from Razorpay's official documentation.
- The Plans and Subscriptions APIs return **401 Unauthorized** on both test and live; Orders, Payments,
  Customers, Tokens all work.

A full field-by-field audit against Razorpay's documented lifecycle found **no missing or malformed step
upstream of the failure**. The failure is at the authorization moment (Razorpay/bank side), not in our
request. The evidence points to an **account/product-level restriction on new-mandate registration** that
only Razorpay can confirm and resolve.

**Business impact:** existing customers with tokens can still be charged; **new customers cannot be
onboarded to autopay** until this is resolved. Migration engineering (renewal/upgrade/charge) is otherwise
viable — the blocked piece is Acquisition.

---

## 2. Timeline of Experiments

| # | Experiment | Result |
|---|---|---|
| 0 | API-surface probe (test key) | Plans/Subscriptions 401; Orders/Payments/Customers/Invoices OK |
| 1 | Inspect pre-existing payment/token/order/invoice chain | Legacy flow already mints reusable UPI token (`token_TBnT7mU4PdTbV2`), silently discarded by code |
| 2 | Object relationship map | Token FK = customer_id; `entity_id` = provenance only; Invoice bridges all IDs; `subscriptions.fetch`-by-id also 401 |
| 3 | Webhook-code audit | `token_id` never read anywhere in `subscriptionController.js` (~70 payment reads grepped) |
| 4 | Existing webhook subscription audit | Only `payment.captured`/`payment.failed` enabled; all `token.*` off |
| 5 | Stand up throwaway listener + tunnel; widen webhook events | Pipeline proven; card payment fired authorized→captured→order.paid (~700ms/~500ms apart) |
| 6 | Fresh UPI Autopay mandate via checkout | Only QR/intent offered; no collect; order stayed `created`, 0 attempts |
| 7 | Force UPI collect via checkout config | "No appropriate payment method found" |
| 8 | Server-side S2S `/payments/create/upi` | HTTP 400 "URL not found" (S2S not enabled) |
| 9 | Card recurring mandate via checkout | **"seller does not support recurring payments"** |
| 10 | **Charge existing token** via `/payments/create/recurring` | **HTTP 200**, payment captured, order.paid |
| 11 | Live read-only probe | Same 401 signature on live; live customers already hold UPI tokens |
| 12 | Docs-exact card mandate (₹1, method:card, frequency:monthly, recurring:true, low max_amount) | **Same failure: "seller does not support recurring payments"** |
| 13 | Capability probe (`/v1/preferences`, `/v1/methods`) | preferences reports recurring/upi_autopay present (ambiguous); `/v1/methods` 401 both keys |
| 14 | Full lifecycle audit vs official docs | No skipped/malformed step upstream of the authorization failure |
| 15 | **Support replied: CAW + UPI Autopay enabled; use Registration Link method** | New authoritative info; earlier "restriction" conclusion re-opened |
| 16 | **Test the Support-recommended Registration Link** (`/subscription_registration/auth_links`, docs-exact) | Link created HTTP 200; hosted page rendered CAW mandate terms; **authorization failed identically: "seller does not support recurring payments"**; order `attempted`/0 payments/invoice unpaid |

---

## 3. Evidence Collected

- **API restriction (test + live):** `plans.all`, `subscriptions.all`, `subscriptions.fetch(id)`,
  `/v1/methods` → **401**. `customers`, `orders`, `payments`, `invoices`, `tokens` → **200**.
- **Existing token is chargeable now:** `POST /v1/payments/create/recurring` on `token_TBnT7mU4PdTbV2`
  → HTTP 200 → `pay_TE9JcSdtbOwpqR`; webhooks `payment.captured` → `order.paid` (notably **no
  `payment.authorized`** on a token debit).
- **New-mandate registration blocked:** card checkout → "seller does not support recurring payments";
  UPI → QR/intent only, no collect; S2S UPI → 404. Reproduced with a **docs-verbatim** request.
- **Legacy flow already mints tokens:** existing UPI payments carry `token_id` (test and live); code
  never reads it.
- **Capability API is ambiguous:** `/v1/preferences` reports `methods.recurring.card` populated and
  `methods.recurring.upi_autopay: {collect:true, intent:true}` on both modes — but this contradicts the
  observed failure and may be a generic catalog; authoritative `/v1/methods` is 401.
- **Lifecycle audit:** Stages 1–3 (customer → auth order → auth-payment creation) performed exactly as
  documented; failure occurs at the customer-authorization outcome.

---

## 4. Hypotheses Considered

- **H1** — Credentials/env misconfiguration (wrong key, dotenv order, whitespace).
- **H2** — Our request is malformed / missing a required field.
- **H3** — Wrong amount (₹499 vs documented ₹1 auth) triggers rejection.
- **H4** — Wrong `frequency` (`as_presented` vs `monthly`) or `recurring` type (`'1'` vs `true`).
- **H5** — Wrong instrument path (UPI-only limitation; card would work).
- **H6** — A skipped step in the documented lifecycle before authorization.
- **H7** — Test-mode/browser limitation (can't simulate UPI mandate on desktop).
- **H8** — Account/product-level restriction on new-mandate registration (e.g., a Charge-at-Will side effect).

---

## 5. Hypotheses Eliminated

- **H1 — Eliminated.** Verified `.env` load order, single active key pair, no whitespace/CRLF; the same
  keys successfully call Orders/Payments/Customers/Tokens and charge an existing token (HTTP 200).
- **H2 — Eliminated.** Order creation returns HTTP 200 and echoes the token block; a malformed request
  returns a field-level `BAD_REQUEST_ERROR` before checkout renders. Checkout rendered the mandate UI.
- **H3 — Eliminated.** Re-ran at the documented ₹1 auth amount; identical failure.
- **H4 — Eliminated.** Re-ran with `frequency:"monthly"` and `recurring:true` (boolean); identical failure.
- **H5 — Eliminated.** Card path fails with the same capability error as UPI; not instrument-specific.
- **H6 — Eliminated.** Lifecycle audit shows no documented step exists between order creation and
  customer authorization that we skipped; Stages 1–3 matched the docs exactly.
- **H7 — Eliminated as the cause of the blocker.** The *card* mandate is fully completable in test mode
  (test card), yet it fails with the capability error — so the block is not a test-mode simulation gap.
  (Test-mode/desktop genuinely can't drive the UPI-app approval, but that is a separate, expected limit.)

---

## 6. Remaining Hypotheses

- **H8 — Standing / most probable.** New recurring-mandate registration is restricted at the
  account/product level, likely as a consequence of Charge-at-Will being enabled (Plans/Subscriptions
  401s are consistent). **Only Razorpay can confirm and lift this.**
- **H8a — Sub-hypothesis to confirm with Razorpay.** The `/v1/preferences` capability data reports
  recurring as available, contradicting the error — so there may be a **deeper agreement/product flag**
  below the checkout-method layer that gates authorization, distinct from method visibility.

---

## 7. Final Engineering Conclusion

Our integration matches Razorpay's official Charge-at-Will documentation on every mandatory field through
the point of failure. Razorpay accepts the order, Checkout renders the recurring-mandate UI, and the
transaction is rejected only at customer authorization with a **capability** error — not a validation
error — even for a docs-verbatim request, on both card and UPI, in both test and live. Existing tokens
remain chargeable. **This is not an integration defect.**

**Post-support update (strengthens the conclusion):** Support stated CAW + UPI Autopay are enabled and
recommended the **Registration Link** method. We tested that exact method (`subscription_registration/
auth_links`, docs-exact). The link was created (HTTP 200), Razorpay's **own hosted authorization page**
rendered the CAW mandate terms, and authorization **failed with the identical error**
(order `attempted`, 0 payments, mandate never registered). We have now exercised **both** documented
acquisition paths — Standard Checkout and the Support-recommended Registration Link — and both fail the
same way, while existing-token charging succeeds. **The account is flagged as enabled but new-mandate
registration is non-functional in practice.** This is a Razorpay-side defect or incomplete activation
requiring escalation, not an integration issue. Engineering due diligence is complete.

---

## 8. Rebuttal + Questions for Razorpay Support (reproduction evidence)

Account: `rzp_live_T3SnCFAE0GIbQT` (behavior reproduced in test `rzp_test_T53zjtHIAybDn3`).

> Thank you for confirming CAW and UPI Autopay are enabled. We followed your recommendation and used the
> **Registration Link** method exactly as documented — and it still fails. Reproduction (test mode):
> - `POST /v1/subscription_registration/auth_links` with `type:"link"`, `amount:100`,
>   `subscription_registration:{ method:"card", max_amount:10000, expire_at:2709971120, frequency:"monthly" }`
>   → HTTP 200, created invoice `inv_TEAC901hRW4Ixk`, order `order_TEAC9B5sWj6EyX`, hosted link.
> - Opening the hosted link, the Razorpay page correctly displays the mandate (max auto-debit ₹100,
>   expiry 16 Nov 2055, "charged any time until expiry"), then on submit with test card 4111... fails with:
>   **"Your payment was not successful as the seller does not support recurring payments."**
> - Server state: order `attempted`, 0 payments created, invoice still `issued`, no token generated.
> - The Standard Checkout path (`order + token + recurring:true`) fails identically, for both card and UPI.
> - Meanwhile, charging an **existing** token via `POST /v1/payments/create/recurring` succeeds (HTTP 200).

Given the above, please confirm/escalate:

1. Why does **new-mandate authorization fail on your own hosted registration-link page** with "seller
   does not support recurring payments," despite CAW/UPI Autopay being marked enabled?
2. Is there a **separate processor/agreement-level flag** (below the account "enabled" flag) that gates
   the actual authorization, distinct from the enablement you verified?
3. Your `/v1/preferences` reports `methods.recurring.card` populated and
   `methods.recurring.upi_autopay:{collect:true,intent:true}` — consistent with "enabled," yet
   authorization fails. Please reconcile.
4. Why do **Plans/Subscriptions APIs return 401** while Orders/Payments/Customers/Tokens succeed?
5. What exact action makes **new-mandate registration functional** while keeping existing tokens
   chargeable (which already works)?
6. Do our existing ~35 tokens remain chargeable long-term, and does a token survive cancellation of its
   originating subscription?

---

## 9. Production Implementation Checklist (separate from the investigation)

These are real requirements for the eventual Charge-at-Will build. **None of them caused the current
blocker** — they are surfaced by the lifecycle audit for when Acquisition is unblocked.

- [ ] **Persist `token_id`** from the authorization `payment.captured` webhook (currently discarded).
- [ ] **Verify authorization-response signature** (HMAC-SHA256 of `order_id|payment_id` with key_secret).
- [ ] **Verify webhook `X-Razorpay-Signature`** on the raw body — confirm the production
      `/api/subscription/webhook` route does this (throwaway listener did not).
- [ ] **Gate first commercial charge on `token.confirmed`** (Fetch Token / webhook) — never assume.
- [ ] **Subscribe to `token.*` webhook events** (confirmed/rejected/paused/cancelled) — currently all off.
- [ ] **Set `payment_capture` explicitly** on subsequent orders (documented-mandatory; do not rely on default).
- [ ] **Decide pre-debit `notification` policy** — the 36h5m TAT and no-auto-retry rule affect renewals.
- [ ] **Webhook idempotency** via `x-razorpay-event-id`.
- [ ] **Handle `payment.failed` → re-authorization** (docs: a failed recurring debit may require a new mandate).
- [ ] **Build mandate headroom** — `max_amount` must exceed current bill; exceeding the cap is a hard failure.
- [ ] **Normalize `recurring` to boolean `true`** (not `'1'`).
- [ ] **Loosen `Subscription.razorpayPlanId` schema** (currently `required:true`) for the token model.
- [ ] **Renewal engine owns all scheduling** — Razorpay executes on-demand only.
