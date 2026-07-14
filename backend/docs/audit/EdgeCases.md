# Audit — Edge Case Matrix

> **Living document.** Target: 200+ scenarios. Columns: Scenario · Expected ·
> Actual · Status · Notes. Status ∈ {✅ pass, ❌ fail, ⚠ unverified, — not tested}.
> Almost everything below is **⚠ unverified** — this is a to-do list, not results.

## Payment / webhook ordering & idempotency
| Scenario | Expected | Status |
|---|---|---|
| `subscription.charged` arrives first (UPI) | settlement runs, referral qualifies | ✅ (fixed §11a; runtime-reverify) |
| Duplicate `payment.captured` webhook | no double settlement | ⚠ |
| Out-of-order webhooks | settlement once, idempotent | ⚠ |
| `verifyPayment` after webhook already confirmed | early-return + settlement ran | ⚠ |
| Payment captured twice | one BillingEvent, no double reward | ⚠ |
| Payment failed then retried | past_due → active, no dup settlement | ⚠ |

## Referral / reward
| Scenario | Expected | Status |
|---|---|---|
| Register with link code | Referral pending immediately | ✅ live |
| Register with self code | rejected | ⚠ |
| Org already referred, second code | rejected | ⚠ |
| Referred org first payment | qualified + 2 rewards | ✅ live |
| Reward reserved, checkout abandoned | released after 30 min | ✅ observed (release) |
| Re-open same upgrade checkout | prior reservation recycled, no lockout | ⚠ (code only) |
| Reward consumed on completed payment | reserved → consumed, available −1 | ❌ NEVER OBSERVED — top priority |
| Both rewards reserved, 3rd checkout | no discount (correct) | ✅ live |
| Reward on new subscription | NOT applied (Razorpay limit) | ✅ by design |
| Tiny proration (~₹1) + % reward | ~₹0 discount, banner hidden | ✅ live |

## Combinations
| Scenario | Expected | Status |
|---|---|---|
| Referral + coupon at checkout | both stack (stacksWithCoupons unenforced) | ⚠ |
| Coupon + upgrade | ? coupons don't apply to Orders | ⚠ |
| Referral + upgrade | reward reduces Order | ✅ live (reserve+apply) |
| Referral + add-on | reward reduces Order | ✅ live (reserve+apply) |
| Downgrade after add-on | add-on carry/drop? | ⚠ |

## Plan / lifecycle
| Scenario | Expected | Status |
|---|---|---|
| Trial expires | access blocked | ⚠ (expiry mechanism unverified) |
| Annual ↔ Monthly change | correct proration + cycle | ⚠ |
| Downgrade reconciliation at renewal | DB reflects new plan | ❌ Gap A (known) |
| Cancel after payment | active until period end | ⚠ |
| Plan disabled while subscribed | ? | ⚠ |
| Add-on deleted from catalog while active | ? | ⚠ |

## Concurrency
| Scenario | Expected | Status |
|---|---|---|
| Concurrent upgrade + add-on (2 tabs) | at most rewards-available consumed, no double-spend | ⚠ |
| Concurrent reserve of last reward | one wins (partial unique idx), other retries/none | ⚠ (walkthrough only) |
