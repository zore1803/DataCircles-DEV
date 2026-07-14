# Flow — Referral

> ✅ **AUDITED.** See REFERRAL_SYSTEM_DESIGN.md for the full design; this is the
> operational narrative.

## Happy path (link-based)

```
Referrer shares link:  https://app.datacircles.in/?ref=CODE
        ▼
Recipient visits → main.jsx captures ?ref into localStorage BEFORE React mounts
        ▼
Recipient registers a NEW org → Login.jsx sends referralCode in the create-org payload
        ▼
authController.completeRegistration → recordReferralIntent(orgId, code)
        ▼
Referral: pending   (+ BillingEvent REFERRAL_RECORDED)
        ▼
Referred org's FIRST payment confirmed → runFirstPaymentSettlement → maybeQualifyReferral
        ▼
Referral: qualified   +   TWO Rewards created (referrer + referee)   (+ REFERRAL_REWARD_EARNED ×2)
        ▼
Both dashboards update (org-facing Referrals.jsx; Super Admin ReferralProgramAdmin.jsx)
```

## Alternate entry — manual code

```
On checkout page, user types code → applyReferralCode endpoint → recordReferralIntent
(applies immediately; NOT gated behind Subscribe/Start Trial)
```

Both entries funnel through the **same** `recordReferralIntent`. Two-sided
reward (referrer AND referee each get one).

## Why capture is in main.jsx (not a component)

An unauthenticated visitor hitting `/?ref=CODE` is redirected to `/login` by
`PrivateRoute` (strips the query), and Auth0's `redirect_uri` is
`window.location.origin` (no query). A component `useEffect` runs *after* those,
too late. Capturing synchronously before `createRoot().render()` is the only
point that still sees the original query. Logout preserves `referralCode` across
`localStorage.clear()` (Navbar).

## Guards (recordReferralIntent → validateReferralCode)

- Org already has a referrer (`orgAlreadyHasReferrer`) → rejected (one referrer, permanent).
- Self-referral (own org's code) → rejected.
- Code inactive/not found → rejected.
- `maxPendingReferrals` / `maxTotalReferrals` caps (enforced).

## Failure / edge

- No code in payload → no referral (silent, correct).
- Registration must NOT fail if referral recording fails (best-effort, try/catch).

## Emails

`sendReferralEmail` sends an invite carrying the link (reuses SendGrid +
`generateReferralEmailHTML`). **Sending an email creates NO Referral** — a
referral only becomes pending when the recipient registers with the code.

## Verified status

Registration→pending and qualification→rewards proven against live DB. See
BILLING_HANDOFF.md §8.
