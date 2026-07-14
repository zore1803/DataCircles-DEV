# State Machine — Reward + RewardUsage

> ✅ **AUDITED** against `models/Reward.js`, `models/RewardUsage.js`,
> `utils/referralRewards.js`.

**Key design:** `Reward` is **immutable** (write-once, only `revokedAt` may be
set later). A reward's *usability* is NOT a field on the Reward — it is
**derived** by scanning its `RewardUsage` rows. This is what makes concurrency
safe. Do not add a mutable `status` to `Reward`.

## Reward (the grant) — "states" are derived

```
available   — not revoked, not expired, no consumed/live-reserved RewardUsage
reserved    — has a RewardUsage {status:'reserved', expiresAt > now}
consumed    — has a RewardUsage {status:'consumed'}
expired     — reward.expiresAt <= now
revoked     — reward.revokedAt set (Super Admin revoke / program disable path)
```
Derivation lives in `getNextAvailableReward` (selection) and
`buildReferralOverview` (display). Same logic, one source.

## RewardUsage (the reservation record) — real states

```
reserved · consumed · released
```

## Transitions (RewardUsage)

```
   (none) ──► reserved    reserveNextAvailableReward()  — at upgrade/add-on checkout init.
                          Guarded by a PARTIAL UNIQUE INDEX
                          { reward:1, partialFilter:{status:'reserved'} } — the atomic
                          concurrency guard. E11000 on race → retry next reward.

 reserved ──► consumed    consumeReservation(usageId)   — on that Order's payment
                          settlement. Atomic conditional update (findOneAndUpdate
                          guarded on status:'reserved') → idempotent vs duplicate webhooks.

 reserved ──► released    releaseReservation(usageId)   — order never created / abandoned /
                          superseded (same-flow recycle), OR
                          releaseExpiredReservations()  — TTL (30 min) elapsed.
```

Illegal: `consumed → *` (terminal), `released → consumed`. The atomic guards
make these impossible under races (the conditional update simply won't match).

## Invariants

- Never consume a reward directly — always reserve → consume.
- A reward can have at most ONE live `reserved` usage at a time (partial unique index).
- Reservations auto-expire after `DEFAULT_RESERVATION_TTL_MS` (30 min).
- `releaseExpiredReservations()` runs inline at the start of each reserve, so correctness never depends on a cron.

## BillingEvents

`REFERRAL_REWARD_EARNED` (grant), `_RESERVED`, `_CONSUMED`, `_RELEASED`,
`_REVOKED`, `_EXPIRED`.

## Known operational note

Abandoned upgrade/add-on checkouts leave rewards `reserved` for up to 30 min.
A **safe same-flow recycle** (release the org's own prior reservation for the
same flow before re-reserving) is implemented in both `initiate` paths. Naive
cross-flow recycling would reintroduce double-spend — do NOT add it.
