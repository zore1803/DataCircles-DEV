# State Machine — Referral

> ✅ **AUDITED** against `models/Referral.js`, `utils/referralUtils.js`,
> `subscriptionController.maybeQualifyReferral`.

A `Referral` links a **referrer** org to a **referred** org (unique per referred
org — one referrer, permanent).

## States (confirmed)

```
pending · qualified · expired
```

## Transitions

```
   (none) ──► pending      recordReferralIntent()  — at registration (link code)
                            or applyReferralCode() (manual code). The ONLY writer
                            of a pending Referral.

  pending ──► qualified    maybeQualifyReferral()  — when the REFERRED org's first
                            payment is confirmed (via runFirstPaymentSettlement).
                            Side effect: creates TWO Rewards (referrer + referee).

  pending ──► expired      ⚠ NOT YET AUDITED — the `expired` status exists in the
                            enum but where/whether a pending referral is expired
                            is unverified. Likely no active expirer yet.
```

Illegal: `qualified → pending`, any write to a Referral that already has a
referrer for that referred org (enforced by unique index + `orgAlreadyHasReferrer`).

## Invariants

- `pending` visibility must **never** depend on trial/payment status (both sides see the referral immediately).
- Qualification is idempotent (`maybeQualifyReferral` finds a `pending` referral or returns).
- One referred org → at most one Referral (unique index on `referredOrganization`).

## BillingEvents emitted

- `REFERRAL_RECORDED` (on pending creation)
- `REFERRAL_REWARD_EARNED` (on qualification, once per side — referrer + referee)

## Open questions for the audit

- Who (if anyone) sets `expired`? Is there a max-age policy? (see `ReferralProgram.minimumActiveDays` — currently unenforced).
- `maxPendingReferrals` / `maxTotalReferrals` block *new* pending referrals — confirm the caps are checked in `recordReferralIntent` path (they are, in `referralUtils`).
