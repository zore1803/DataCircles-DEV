# How Our Billing System Works — Plain-Language Walkthrough

> **What this document is:** a complete, plain-English explanation of every decision we've already
> made about how billing works — registration, plans, upgrades, downgrades, add-ons, coupons,
> referrals, renewals, failed payments, and cancellations. No code, no technical terms, no engine
> names. Just: here's what happens, in what order, and why.
>
> **What this document is not:** a request for you to decide anything. Everything below has
> already been decided, except a small number of items explicitly marked **OPEN** — those are
> real, honest gaps we haven't closed yet, not things we're hiding.
>
> **How to read it:** each section is one real-life situation, told as a story — "the customer
> does X, then Y happens, then Z." Where we made a deliberate choice between two reasonable
> options, we say so and explain why we picked the one we did.

---

## A Few Words, Defined Up Front

So the rest of this document reads cleanly, five words used throughout, in plain terms:

- **Subscription** — a customer's current plan and add-ons, right now. Not their history — just
  "what they have today."
- **Plan** — the base package a customer is on (Starter, Growth, Business, etc.).
- **Add-on** — anything extra bought on top of a plan (more seats, WhatsApp, storage, etc.).
- **Invoice** — a bill. Once created and paid, it never changes, even if prices change later.
- **Renewal** — the recurring moment a customer is billed again for continuing service.

---

## The Whole Customer Journey, in One Page

Before the details, here's the entire lifecycle end to end, so every later section has a home in
the bigger picture:

```
Customer signs up
      ↓
(If we offer a trial: a free period first — see the note in Part 2;
 this is one of the few things NOT yet fully decided)
      ↓
Authorizes automatic payment + pays first invoice
      ↓
Subscription is Active
      ↓
   ┌──────────────────────────────────────────────┐
   │   While active, any of these can happen:      │
   │   - Upgrade (now, charged immediately)         │
   │   - Downgrade (scheduled for next renewal)     │
   │   - Add an add-on (now, charged immediately)   │
   │   - Remove an add-on (scheduled for renewal)   │
   │   - Switch Monthly ↔ Yearly (now, charged)     │
   │   - Apply a coupon / earn a referral reward    │
   └──────────────────────────────────────────────┘
      ↓
Renewal date arrives → invoice generated → charge attempted
      ↓                                 ↓
  Charge succeeds                  Charge fails
      ↓                                 ↓
Subscription continues,          Marked "Payment Overdue"
scheduled changes now apply            ↓
                                  Automatic retries over ~5 days
                                        ↓
                              Retry succeeds ──→ back to Active
                                        ↓
                              All retries fail
                                        ↓
                                   Suspended
                                        ↓
                          Customer pays outstanding amount
                                        ↓
                                   Reactivated
                                        (see Part 9 — long-suspension
                                         reactivation is still an open question)

At any point while Active: Customer can Cancel
      ↓
Takes effect at next renewal (never immediately, never refunded)
      ↓
Subscription ends
      ↓
Resubscribing later = starting completely fresh, not a resume
```

Every part below is one piece of this picture, explained in full.

---

## Part 1 — The Big Picture

### Why anything changed at all

Previously, our payment provider (Razorpay) managed subscriptions on our behalf — it kept track of
the plan, the price, and when to charge the customer next. We recently moved to a model called
**"Charge-at-Will."** Under this model, Razorpay no longer manages any of that — it only provides
the payment rail. We now own the entire billing brain ourselves: what plan a customer is on, when
they get charged, how much, and what happens if it fails.

This means every commercial decision — what a customer owns, what they owe, what changes
immediately versus what waits until renewal, and how failures are handled — is now determined by
our own business rules, not by Razorpay's defaults. In practice, this gives us far more
flexibility (custom pricing, custom timing, our own retry rules, coupons, referrals) at the cost
of us being fully responsible for getting every scenario right. That responsibility is what the
rest of this document walks through.

### The one-time setup: a "Mandate"

Before we can charge a customer automatically, they have to authorize us once, up front. This
authorization is called a **Mandate**. Think of it like a customer telling their bank, "This
company is allowed to charge my card/account automatically, up to a certain amount, whenever they
need to." We set that maximum amount with some headroom above their current plan cost, so a
routine renewal or a modest upgrade doesn't need them to re-authorize every time.

**What happens if a future bill goes above that authorized maximum?** For example, a customer
authorized us for up to ₹1,000, and later upgrades plus adds three add-ons, bringing their bill to
₹1,400. In that situation, we cannot simply charge the higher amount — the customer must approve a
new, higher authorization first. Practically: at the moment such a change would push the bill
above their current limit, the customer is asked to re-approve a larger authorization as a normal
part of completing that action (see Part 4, upgrades) — it isn't a separate, confusing interruption
later on.

Once authorization is in place, we can create a bill and charge it whenever we need to, without the
customer manually re-entering payment details every time — that's what makes subscriptions
"automatic."

---

## Part 2 — Signing Up (Registration)

**⚠️ Before the flow below: whether we offer a free trial at all is still an open business
decision, not something this document assumes one way or the other.** If a trial is offered, real
questions follow it around — how long it lasts, whether a card is required to start one, and what
happens the moment it ends with no plan chosen. None of that is decided yet. Everything described
below in this Part assumes a customer who is going straight to a paid plan; it does not imply a
trial does or doesn't exist.

**The flow:**
1. The customer picks a plan.
2. We ask them to authorize the Mandate (the one-time payment permission described above).
3. As part of that same step, we also charge them for their **first invoice** — authorization and
   first payment happen together, not as two separate steps.
4. Razorpay tells us, via an automatic notification, whether the payment and the authorization each
   succeeded.
5. The customer gets access as soon as the **first payment** succeeds — even if the separate
   confirmation of the ongoing authorization arrives a little later (see below for what happens if
   it never arrives at all).

**An important real-world wrinkle we already found and handled:** Razorpay doesn't always tell us
things in a predictable order. Sometimes we get told "the customer paid" before we're told "the
authorization is confirmed" — and sometimes it's the other way around. We've built this to handle
either order correctly, and we've actually tested this exact out-of-order scenario live, twice,
successfully.

**What if the customer pays, but the authorization for future charges never comes through?**

This is a real edge case: a customer's very first payment can succeed, while the "permission to
charge me automatically in the future" part fails or never arrives (for example, if their bank
blocks the second confirmation step but not the first payment). We treat this as two separate
facts, not one combined status:
- The customer paid, so they get access. Their subscription is active.
- Separately, we know we don't yet have a valid ongoing authorization.

The practical result: the customer isn't punished for something that isn't fully their fault (they
did pay), but we know internally that we can't yet auto-renew them next cycle, and we'll need to
prompt them to fix their authorization before their next bill comes due.

**What if the customer abandons signup partway through — closes the browser mid-payment?**

No subscription is created, and nothing is charged, until the first payment is actually confirmed
successful. A closed browser or an incomplete checkout simply leaves no trace of a subscription —
the customer can start over at any time with no cleanup needed on our end.

**What if a payment confirmation arrives more than once for the same signup (a duplicate
notification, or the customer double-clicks pay)?** This never creates two subscriptions, charges
the customer twice, or grants a referral reward twice for the same event — a repeated confirmation
for something that already happened is simply ignored the second time.

**What if the customer needs a phone number and doesn't have one on file?**

Our payment provider requires a phone number to set up automatic recurring payments. We found that
some customers who signed up through Google/social login never gave us one. We now ask for it
explicitly at this step if it's missing, with a clear explanation of why, rather than the signup
silently failing.

---

## Part 3 — Plans and Billing Cycles (Monthly vs. Yearly)

### The core idea: every purchase is tracked on its own, but customers get one predictable bill

Every priced item on a subscription — the base plan itself, or any add-on (extra seats, WhatsApp
integration, storage, etc.) — is tracked as its own independent purchase: we always know exactly
when it was bought, what price was agreed at the time, and when it's next due. The base plan isn't
special — it's simply the very first purchase a customer ever makes, so its due date happens to
match the day they first paid. Every add-on bought afterward is tracked from the day *it* was
purchased.

**However — items that end up due on the same day are always billed together, as one invoice, not
several.** If several purchases happen to fall due on the same date (typically because they were
bought together originally), the customer gets **one combined bill** listing everything due that
day — never several separate invoices for one conceptual renewal. This is a deliberate choice: it
keeps every purchase individually accountable (so we always know its exact history and price) while
still giving the customer one clean, predictable bill rather than a stack of confusing ones.

**Why we designed it this way:** it scales cleanly to any future add-on type without needing new
rules, and it avoids a messy problem where we'd have to decide what happens if someone buys
something on exactly another item's due date. This is a common approach used by subscription
billing systems generally.

### What happens when something is added in the middle of a billing period

If a customer buys an add-on partway through their month (say, on day 10 of a 30-day month):

1. **Right away**, they get a separate invoice for just that add-on, priced only for the remaining
   days of the current period (a prorated, partial charge) — it doesn't wait for the next renewal.
   We do this so the customer isn't charged immediately for unrelated items already covered by
   their existing bill, while still paying fairly, right away, for the new thing they just added.
2. **From the next renewal onward**, that add-on's due date shifts to line up with the rest of the
   subscription, so going forward it's simply included in the one regular combined renewal
   invoice, rather than staying on its own permanently separate schedule.

**Business translation:** you get charged fairly for exactly what you use right when you add
something, but afterward everything settles into one predictable monthly (or yearly) bill.

### Annual plans are a 12-month entitlement, not a fresh contract every time you touch them

This was a deliberate decision: when a customer buys or switches to an annual plan, they are buying
**12 months of service from the date they first ever paid us** — not "the next 12 calendar months
from today," every time something changes.

**Example:** A customer starts on the monthly plan on January 17th. Three months later, they
switch to yearly. Because they've already used 3 of the 12 months they're now buying, they only
pay for the *remaining 9 months* — and their yearly renewal date is still January 17th next year,
not the date they switched. The exact charge calculation for this kind of switch is explained fully
in Part 7.

**Why this matters:** without this rule, a customer who changes their billing cycle partway through
the year could end up with an "annual" renewal date that keeps drifting every time they touch their
account. This rule keeps one fixed, predictable annual anchor date for the life of the account,
regardless of what changes in between.

**Annual plans and monthly add-ons can coexist.** A customer on an annual plan can still buy
add-ons billed monthly. Each side keeps its own rhythm — the annual plan renews once a year on its
fixed anchor date, while any monthly add-on follows the ordinary monthly rules described
throughout this document. One doesn't force the other onto its schedule.

### Paying late never shifts your renewal date

If a payment fails on the day it was due, and succeeds a few days later once we retry it, the
customer's *next* renewal is still calculated from the original date — not from whenever the late
payment happened to go through. The reasoning: that late payment is for the period the customer
already owed, not for extra service beyond it — so no extra days are added, and nothing shifts.
Otherwise, a customer could effectively push their billing date forward every cycle just by paying
a few days late each time, which we don't want to allow.

### Where to find upgrade, downgrade, and billing-cycle-change details

This chapter covers how billing periods and renewal dates work in general. The specific rules for
what happens when a customer changes plan (Part 4 — Upgrades, Part 5 — Downgrades) or switches
between Monthly and Yearly (Part 7) are covered in their own dedicated sections next.

---

## Part 4 — Upgrades

**The full customer journey, step by step:**

1. Customer picks a higher plan.
2. We immediately show them exactly what they'd pay — the new plan's price, minus credit for the
   unused portion of what they're currently on, plus tax. Nothing has happened yet at this point;
   it's just a preview.
3. If they proceed, we create the actual bill and take them to checkout.
4. **Nothing about their account changes yet** — not the plan, not their limits, not their access.
   They're still exactly on their old plan until payment is confirmed.
5. If they close the checkout window without paying: nothing changes, no charge, no plan switch.
   They're free to try again later.
6. If they change their mind and pick a *different* upgrade target before paying: we simply throw
   away the first bill and create a new one for the new choice — no leftover partial state.
7. **If payment fails:** nothing changes at all — same plan, same everything, only a "payment
   failed" note is recorded so they can retry.
8. **If payment succeeds — this is the one and only moment everything actually changes:** the new
   plan takes effect, any new add-on limits apply, the invoice is marked paid, and the record of
   what happened is saved permanently.

**If a customer changes both their plan and their billing cycle at the same time** (for example,
moving from Starter Monthly directly to Growth Yearly in one action), both calculations — the plan
change and the cycle change — are performed together as one single action, producing one bill, not
two separate changes handled independently.

**If the new plan doesn't support an add-on the customer currently has** (or does, but the customer
needs to decide whether to keep it): the same carry-forward choice described in Part 6 (Add-ons)
applies here too — the customer is asked to explicitly confirm whether to keep any add-on the new
plan still allows, and any add-on the new plan simply doesn't offer is automatically scheduled for
removal at the same time. This is triggered by the plan change itself, so it's worth knowing it
applies during an upgrade, not only as a standalone add-on action.

**Why we insist so strongly that nothing changes until payment succeeds:** this is the single
biggest rule in our entire billing system, and it applies to every kind of change, not just
upgrades. If we ever let something "commit" (change for real) before the money is actually
collected, we open ourselves up to a mess where a customer's account has already changed but we
never got paid for it, and unwinding that later gets complicated and error-prone. So the rule is
simple and absolute: **no money, no change** — with one narrow exception described in Part 8
(failed renewal payments), where the only thing allowed to change without a successful payment is
marking the account as "payment overdue."

**What the customer sees on the invoice — nothing hidden:**

Every number the customer is charged is shown to them individually — the plan price, every add-on
listed separately, every discount listed separately by name (referral, coupon, unused-time
credit), and the tax shown on its own line, before the final total. Where an unused-time credit
applies, the invoice shows how it was worked out (how many days were unused and what they were
worth), not just the final credit number — so both the customer and our own Support team can look
at any invoice and reconstruct exactly how it was calculated, not just see the result.

---

## Part 5 — Downgrades

Downgrades work completely differently from upgrades, on purpose.

**The rule: a downgrade never happens immediately, and it's never charged.**

1. Customer requests to move to a cheaper plan.
2. We record that request as "scheduled for the next renewal" — nothing about their account
   changes today. They keep their current plan, current limits, current everything until the
   period they've already paid for ends.
3. At their next renewal, the downgrade takes effect automatically, and from that point on
   they're billed at the lower price.

**Why downgrades are never immediate:** the customer already paid for their current period in
full. Switching them down immediately would mean either overcharging them for something they
already own, or giving them a refund mid-cycle — both messier than simply letting the current,
already-paid-for period play out and switching at the natural boundary.

**What if a customer schedules a downgrade, then changes their mind before it takes effect?**
They can update or cancel the scheduled downgrade at any time before the renewal date arrives —
whatever they've most recently told us is what takes effect. For example, if a customer first
schedules "downgrade to Growth" and later, before it takes effect, schedules "downgrade to
Starter" instead, the second request simply replaces the first — only one scheduled downgrade is
ever in effect at a time, never both stacked together.

**What if they schedule a downgrade and then try to do something else that costs more right now?**
While a downgrade is scheduled, we block any *immediate, pay-right-now* action — an upgrade, buying
a paid add-on right now, **or switching billing cycle (Monthly ↔ Yearly)** — because charging them
more right now would directly contradict the fact that they've already told us they want to pay
less going forward. They would need to cancel the scheduled downgrade first if they've changed
their mind and want to do one of these instead.

**What if a customer has both a scheduled downgrade and a scheduled cancellation at the same
time?** Cancellation always wins — see Part 10 for the full explanation.

**Can a customer schedule a downgrade to a plan cheaper than what they're currently using — e.g.
they have 10 seats and want to move to a plan that only includes 2?** Yes, provided the numbers
actually work out. A destination plan's included amount isn't a hard ceiling — it's a starting
point that can be extended by carrying forward compatible add-ons. If the customer has an extra-seat
add-on and chooses to carry enough of it forward, the math might look like: Growth includes 2 seats,
carry forward 8 more, total capacity 10 — exactly matching what they currently use, so the downgrade
is allowed.

**What if, even after carrying forward every available add-on, the numbers still don't work?** Then
the downgrade cannot be scheduled at all — for example, a customer with 2 million saved records
trying to move to a plan that maxes out at 1 million records, even with every add-on applied.
**We never delete a customer's data or lock their account to force a downgrade to happen.** Instead,
we tell them clearly, resource by resource, what's blocking it:

```
Cannot downgrade yet.
  [X] Remove 2 users
  [X] Reduce storage by 1.8 GB
  [OK] Pipelines are within limit
  [X] Remove 3 forms
```

The customer can then reduce their usage themselves and try again — they're never surprised by a
downgrade that silently changes what they can access, because it simply doesn't happen until the
numbers genuinely fit. **This check happens twice, not once:** when the downgrade is first
scheduled, and again right before it actually takes effect at renewal — because a customer's usage
can grow in the time between scheduling a downgrade and it actually happening (e.g. they add 50 more
users the week after scheduling it). If they no longer qualify by the time renewal arrives, the
downgrade simply doesn't happen, their current plan continues unchanged, and they're told why.

---

## Part 6 — Add-ons (Seats, Storage, WhatsApp, etc.)

Add-ons follow the exact same "pay now vs. pay later" pattern as upgrades and downgrades:

| Action | When it happens | Do they pay right away? |
|---|---|---|
| **Adding** an add-on, or **increasing** a quantity (e.g. more seats) | Immediately | Yes, a prorated charge right now |
| **Removing** an add-on, or **decreasing** a quantity | At the next renewal | No, and no refund for the unused portion |

**There are two kinds of add-ons, and they behave a little differently:**
- **On/off add-ons** (like WhatsApp integration or an AI feature) — you either have it or you
  don't. You can't "buy it twice."
- **Quantity add-ons** (like extra seats or storage) — these can be increased or decreased as many
  times as the customer wants, at any time. Each immediate purchase is billed on its own right
  away; anything scheduled for later is tracked on its own until it actually takes effect at
  renewal, at which point it joins the customer's regular combined bill going forward (the same
  pattern described in Part 3).

**A deliberate decision worth calling out: every action is remembered individually, and nothing is
silently merged or cancelled on the customer's behalf.** Quantity add-ons in particular can be
adjusted many times within the same billing period — increased, decreased, increased again — and
every single request is preserved and tracked individually until it naturally takes effect, rather
than being collapsed into one running total behind the scenes.

**For example:** a customer starts with 10 seats. They add 2 more right now (billed immediately,
now at 13). A week later they schedule a removal of 2 seats for next renewal (still 13 until then).
Later that same week they schedule removal of 1 more seat for next renewal (still 13). At renewal,
both scheduled removals apply together, bringing them to 10. Every one of these actions — the
immediate add, and each separate scheduled removal — is kept as its own distinct record, visible
in the customer's activity history exactly as they happened, never silently combined into a single
"net change" number.

**Similarly:** if a customer schedules "remove this add-on next renewal," and later that same day
decides to add a different quantity of the same add-on back *right now*, we do **not** assume they
meant to cancel their original removal request. Both actions are kept as separate, real events —
the immediate add takes effect now, and the previously scheduled removal still happens later,
unless the customer explicitly cancels that removal themselves. We made this choice deliberately:
we never want the system silently guessing what a customer "really meant" — if they want to undo
something, they should be the one to say so.

---

## Part 7 — Switching Between Monthly and Yearly

This is treated as its own category — not a plan change, and not an add-on change.

**The rule: this always happens immediately, and is always charged right away.** The amount charged
is always the same underlying idea: **the customer pays for the new cycle, minus credit for
whatever portion of their current commitment they haven't used yet** — but exactly how much
"unused portion" they get credit for depends on how much of their prior entitlement they've already
consumed, consistent with the 12-month annual entitlement rule from Part 3.

**The simple case — a customer switching shortly after starting their current period:**
A customer on a ₹450/month plan switches to yearly with 20 of their current 30 days still unused.
That's worth ₹300 in unused credit. The yearly plan costs ₹5,400. They pay
₹5,400 − ₹300 = ₹5,100 today, and their annual anchor date is set from today (since this is their
first-ever entitlement window).

**The general case — a customer with billing history behind them:**
A customer who started on the monthly plan in January and switches to yearly after 3 months has
already consumed 3 of the 12 months they're now buying. Per the entitlement-window rule (Part 3),
they pay for the **remaining 9 months** of that window, not simply "the days left in their current
month" — and their annual renewal date is fixed at their original January anchor date, not reset
to today. This is the same underlying principle as the simple case above, just applied over the
customer's full unused entitlement rather than a single partial month, because by this point
they have a real entitlement window already in progress.

The same calculation works in reverse if someone switches from yearly back to monthly — unused
entitlement is credited toward the new monthly price, and the customer's anchor date does not
reset.

---

## Part 8 — Renewals (The Regular Billing Cycle)

This is what happens automatically, in the background, every time a customer's regular billing
date arrives.

**Step by step:**

1. We check: is anything actually due today for this customer? If not, nothing happens.
2. We check: is this customer even eligible to be renewed right now? (For example, someone
   currently in the middle of a payment retry is handled by the retry process instead, not treated
   as a fresh renewal.)
3. We check: do we still have a valid, active authorization to charge this customer at all? If not,
   the renewal doesn't proceed as a normal charge — it fails immediately with a clear reason
   ("authorization required"), the same as any other failed renewal charge (see below), rather than
   attempting a charge we already know can't succeed.
4. We figure out what the customer's subscription *should* look like tomorrow, taking into account
   anything they've scheduled (a downgrade, an add-on removal, a quantity decrease) that's now due
   to take effect. **Nothing is actually changed on their account yet at this point** — we're only
   calculating what the bill should be.
5. We generate the invoice for that calculated amount — every scheduled change, every applicable
   coupon, every referral reward, and tax, all applied in that specific order (explained in Part
   13 below).
6. **If this invoice's amount is higher than what the customer is currently authorized for** (see
   Part 1, Mandate), the renewal cannot proceed as a normal automatic charge — the customer is
   prompted to approve a higher authorization before the charge can go through, the same underlying
   situation as the upgrade case in Part 1, just triggered by a renewal instead.
7. We attempt to charge the customer using their existing payment authorization.
8. **If the charge fails:** absolutely nothing about the customer's account changes — not their
   plan, not their add-ons, not anything they had scheduled. The *only* thing that changes is that
   their account is marked "payment overdue," and the retry process (Part 9) takes over from here.
9. **If the charge succeeds:** everything commits together, at once — the scheduled downgrade or
   add-on removal actually takes effect now, the new renewal date is set, the invoice is marked
   paid, and any referral reward or coupon usage is now finalized (not before).

**A quick clarification on late payments:** if a renewal charge fails and then succeeds later via
a retry, this does not create any extra days of service or push the next renewal date forward —
that rule (explained fully in Part 3) applies here too.

**Why we insist that a failed renewal charge doesn't undo or half-apply anything:** We originally
considered a different rule — that a scheduled downgrade would take effect at renewal regardless
of whether the subsequent charge succeeded, with only the customer's access being affected by a
failure. We deliberately reversed that decision. The problem: if a downgrade, an add-on removal,
and a quantity change had all already taken effect, and *then* the payment failed, un-doing all of
that is messy and error-prone. Under the current, corrected rule, nothing real ever changes until
the money is actually collected — so there's never anything to undo. If a charge fails, the
customer's account simply stays exactly as it was, with an "overdue" flag, until either a retry
succeeds or the situation is otherwise resolved.

---

## Part 9 — What Happens When a Payment Fails (Retries)

1. **First failure:** the account is marked "payment overdue." Nothing else changes — same plan,
   same access, same everything, per Part 8 above.
2. We automatically retry the charge a few times over the following days, spaced out (not
   back-to-back) — the current default is **3 attempts, spread across roughly the following five
   days** (24 hours, then 3 days later, then 5 days after that).
3. **If a retry succeeds:** the account returns to normal immediately, nothing further needed.
4. **If all retries fail** and a grace period afterward (currently **7 days** from the very first
   failure) also passes with no successful payment: the account moves to **suspended**.

**What "suspended" means for the customer:** their access is blocked until the situation is
resolved. This is separate from the earlier "payment overdue" period, where access is not
affected — suspension is the final consequence after every attempt to collect payment has been
exhausted.

**Getting back in after a recent suspension:** if the customer resolves the outstanding payment
soon after being suspended, their existing payment authorization is still valid, and access resumes
with everything as it was before (same plan, same add-ons, same future renewal date going
forward), with no separate re-approval process needed.

**⚠️ Still open — reactivation after a long suspension.** If a customer stays suspended for an
extended period (weeks or months), their original payment authorization may have expired,
been cancelled, or otherwise gone stale in that time. Whether reactivation in that situation
requires just paying the outstanding amount, or also re-authorizing a brand-new payment mandate
from scratch, is a genuine, unresolved question — flagged honestly here rather than assumed one
way or the other (see also Part 15).

Both the retry count and the timing are treated as adjustable business settings, not fixed
rules — meaning we can change "3 attempts" or "7 days" later if the business wants to, without
it being a structural change to how the system works.

### A different scenario: the customer cancels or pauses autopay through their own bank, not through us

This is genuinely different from a failed charge, and worth calling out on its own. A customer can
go into their own banking app and cancel or pause the standing authorization they gave us —
without ever telling us, and without any charge having failed yet.

**What happens:** nothing changes right away. The period the customer already paid for continues
normally, exactly as before — this is not treated as a failure and does not affect their current
access at all. The impact only shows up at their **next renewal**: since we no longer have a valid
authorization to charge them, that renewal attempt fails immediately (the same "payment overdue"
path described above, just for a different underlying reason — "no valid authorization" rather
than "the bank declined the charge"). From that point on, it follows the same retry-then-suspend
path as any other failed renewal.

**Why this distinction matters for Support:** the *conversation* with the customer is different
even though the billing mechanics converge on the same path. A customer whose card was simply
declined needs to fix a payment problem; a customer who deliberately cancelled autopay in their
banking app needs to be told they'll need to re-authorize automatic payments with us again if they
want their subscription to keep renewing.

---

## Part 10 — Cancellation

**The rule: cancellation always takes effect at the customer's next renewal date — never
immediately, and it's never refunded** for time already paid for, whether the plan is monthly or
annual (an annual customer who cancels partway through their prepaid year keeps access for the
rest of that year, with no partial refund for the remaining months).

1. Customer requests cancellation.
2. Nothing changes today — no refund, no immediate loss of access, no plan change. They keep
   everything exactly as-is until the period they've already paid for ends.
3. Once cancellation is scheduled, we block every other kind of change on that account — no
   upgrades, downgrades, or add-on changes are allowed anymore, because the customer has already
   told us they don't want the subscription to continue past this point, so any further change
   would be pointless.
4. On their actual renewal date: instead of billing them again, the subscription simply ends.
   Access is removed at that point, and there's nothing further scheduled or owed.

**If a customer already has a scheduled downgrade when they cancel:** cancellation always takes
precedence. The scheduled downgrade is not deleted from their record, but it simply never executes,
because there's no future renewal left for it to apply to — the subscription ends before that
point is ever reached.

**Resubscribing later:** if a cancelled customer wants to come back, that's treated as starting
completely fresh — a brand-new subscription, a brand-new plan choice, a brand-new payment
authorization. There's no "resume" option that picks up where they left off — the same idea as
cancelling a streaming service and signing up again months later on a new plan.

---

## Part 11 — Coupons

Coupons are configured by our Super Admin team and can be quite specific. Here's how they actually
behave from a customer's point of view:

- A coupon can apply to **specific items only** — for example, a coupon might give 6% off the
  Starter plan and 9% off the Growth plan, but nothing off Business or off seats. It is never just
  one flat percentage off the whole bill unless it's been configured that way.
- Each discount can be either a **percentage off** or a **fixed rupee amount off**, chosen per item
  — a single coupon can give a percentage off one plan and a fixed amount off another.
- A coupon can be available to **everyone**, or restricted to a **specific list of customers**.
- A coupon can last for:
  - just the **first invoice** only,
  - a **fixed number of billing cycles**,
  - the customer's entire **lifetime** with us, or
  - **indefinitely, until a Super Admin manually cancels it** for that customer — a distinct option
    from "lifetime," since it's a deliberate, ongoing administrative choice rather than a fixed
    duration set in advance.
- A coupon can have a **maximum number of total uses** across all customers, and/or a
  **maximum number of uses per customer**.
- A coupon can have a **start and expiry date**.

**How a coupon shows up on the invoice:** it appears as its own separate line for each item it
applies to — e.g. "Growth Plan Discount −₹45" and "Seat Discount −₹18" as two separate lines, not
one combined number — matching the same "show everything" transparency principle used everywhere
else on the invoice.

**A known, real gap we want to flag honestly:** today, when a customer changes plans, the system
doesn't always correctly re-check whether their existing coupon still applies to their new plan.
This is a known bug in the current coupon logic that needs its own dedicated fix — it is not
something this specification claims to have already solved.

---

## Part 12 — Referrals

Referrals are simpler than coupons — one configuration applies company-wide (reward type, amount,
expiry, and limits), rather than lots of individual rules per referral.

**The configuration includes:**
- A reward type — either a **percentage off** or a **fixed rupee amount off**.
- An optional **maximum reward amount** (a cap, so a percentage-based reward can't grow unbounded).
- An optional **expiry** — how long a granted reward stays usable before it's forfeited if unused.
- An optional **cap on the number of referrals** a customer can have pending or completed in total.

**The two-sided journey, in full:**

1. An existing customer ("the referrer") invites another company to join us.
2. That invited company signs up and makes their **first payment**.
3. At that moment, **both** the referrer and the newly referred company receive the same reward
   (same type, same value) — this is a two-sided reward, not one-sided.
4. The referred company's reward is applied straight to that very first invoice.
5. The referrer's reward is applied to **their next upcoming bill** — since they're usually
   already mid-cycle with no invoice due right this moment.

**A real piece of follow-up work we want to be upfront about:** this referral system was
originally built back when our payment provider didn't allow us to change an already-active
subscription's ongoing bill amount — so applying a referrer's reward to their *next regular bill*
(rather than only ever to a brand-new first-time signup) was never fully finished. Now that we've
moved to Charge-at-Will, that technical limitation is gone, and finishing this connection is real,
concrete, actionable work — not a design question, just something still to be completed.

**Settings that exist on paper today but don't actually do anything yet** (flagging honestly
rather than pretending they work): a minimum number of active days before a referral reward
qualifies, and whether a referral reward is allowed to combine with a coupon. These are currently
saved when configured, but not yet enforced anywhere.

**Can a customer on a free trial send referrals and earn rewards? Yes — decided, and deliberately
allowed.** A reward is never created until the *referred* company actually makes their first real
payment, so a trial customer inviting someone isn't gaming anything by doing so — they're simply
making an introduction, and nothing is paid out until a genuine paying customer results from it.

---

## Part 13 — How All the Pieces Fit Together on One Invoice

Whenever we generate any bill — whether it's a renewal, an upgrade, or a one-time add-on
purchase — the math is always done in the exact same order, for a very deliberate reason: doing it
in a different order would produce a different (and sometimes unfair) final number.

**The order, always:**

1. Start with the plan and any add-ons — the raw, full price of everything being billed.
2. Apply any "fair value" adjustment — like unused-time credit from a previous plan (proration).
   This must happen before any discount, because the customer shouldn't get a discount calculated
   on value they never actually owed in the first place.
3. Apply any **coupon** discount, item by item.
4. Apply any **referral** reward, as a reduction on the whole remaining total (not item by item).
5. Apply tax (GST), calculated last, on whatever amount remains after every discount — this order
   is a tax-law requirement, not a choice we made.
6. Round to the nearest whole rupee.
7. Freeze the invoice — once generated, an invoice never changes. If a plan's price changes later,
   old invoices still show exactly what was charged at the time, forever.

**Worked example, showing every step, including the proration detail:**

```
Growth Plan                                    ₹450
Extra Users (2)                                ₹200
WhatsApp Addon                                 ₹150
------------------------------------------------
Commercial Total                               ₹800
Unused Starter Plan Credit (15 of 30 days
  unused, ₹250 plan → ₹125 credit)            −₹125
------------------------------------------------
Subtotal                                       ₹675
Coupon (WELCOME10)                             −₹50
Referral Reward                               −₹100
------------------------------------------------
Taxable Amount                                 ₹525
GST (18%)                                      ₹94.50
------------------------------------------------
Grand Total                                    ₹619.50
```

**One invoice, one reason.** Even if a renewal bundles a plan plus two add-ons all in one bill, we
still record that invoice as "a renewal" — a single, clear reason for why it was generated — not
several separate reasons stitched together. This makes it much easier for Support and Finance to
answer "why was this customer billed" at a glance.

---

## Part 14 — What Happens When Things Overlap

A few concrete "what if two things happen at once" situations we've already worked through:

- **A customer has a scheduled downgrade, and also schedules an add-on removal, both for the same
  future renewal date.** Both happen together, at the same renewal, in one combined update — not
  as two separate events.
- **A customer has multiple, separate quantity changes on the same add-on pending at once** — for
  example, they add 2 seats right now, then later schedule a removal of 1 seat and a removal of 2
  more seats, both for the next renewal. All of these are tracked individually (per Part 6) and all
  apply in the order they were requested — the immediate add takes effect right away, and both
  scheduled removals apply together at the next renewal.
- **A customer schedules a downgrade, then tries to upgrade, add a paid add-on, or switch billing
  cycle before it takes effect.** Blocked — they can't pay for more right now while they've already
  told us they want to pay less later (they'd need to cancel the scheduled downgrade first).
- **A customer has both a scheduled downgrade and a scheduled cancellation.** Cancellation wins —
  if the subscription is ending anyway, the downgrade becomes irrelevant and never takes effect
  (it isn't deleted from the record, it simply never executes because there's no future renewal
  for it to apply to).
- **A webhook or confirmation from our payment provider arrives more than once for the same
  event** (this genuinely happens with real payment providers). We've built this so that a repeat
  notification never double-charges, never double-applies a reward, and never duplicates anything
  — we've tested this directly, firing the same event three times in a row against a real test
  account and confirming nothing changed the second or third time.
- **A customer wants to cancel while a renewal payment is still overdue/being retried.** ⚠️ *Still
  open* — see Part 15.

---

## Part 15 — What's Still Genuinely Open (Being Honest About Gaps)

**Updated since this document was first written — most of what used to be listed here has since
been decided.** Five genuine gaps remain; none of the business-policy ones are things a customer
will notice in everyday use, and the last two are known, real implementation follow-ups rather than
open questions.

1. **Data retention and archival policy** — exactly how long a cancelled or long-suspended
   customer's data is kept before permanent deletion is a compliance/legal question, deliberately
   kept separate from this document.
2. **Organization mergers or transfers** (e.g. two companies combining) — not a supported capability
   today, and out of scope for this document if it's ever built.
3. **Chargebacks** — a customer disputing a charge directly with their bank, rather than through us,
   is a large enough topic (it touches the subscription, every invoice, coupons, and rewards at
   once) that it deserves its own dedicated policy, not a quick answer folded in here.
4. **A known coupon bug, not yet fixed:** when a customer changes plans, the system doesn't always
   correctly re-check whether their existing coupon still applies to the new plan. This is a real,
   pre-existing bug that needs its own dedicated fix — not something this document claims is already
   solved.
5. **Finishing the referral-to-recurring-bill connection.** Applying a referrer's reward to their
   *next regular bill* (rather than only ever to a brand-new customer's first payment) was never
   fully completed under our old payment system, which couldn't change an already-active
   subscription's bill amount. Our new payment system removes that limitation — this is now real,
   actionable work to finish, not a design question.

**Everything else that used to be listed as open is now decided, including:**
- **Trials** — a trial cannot run while a paid subscription is active; once cancelled or suspended,
  a trial can be started again; Super Admin controls trial duration and can extend one for a
  specific customer.
- **Reactivation after a long suspension** — if the customer's payment authorization is still
  valid, they simply pay what's owed and are reactivated immediately; if the authorization has gone
  stale, they set up a new one first, then reactivate.
- **Cancelling while a payment is overdue** — allowed. Cancelling stops future renewals, but never
  forgives money already owed; we keep trying to collect what's due even after the subscription
  itself has ended.
- **Combined discounts exceeding the bill** — a bill can never go below ₹0. If a coupon and a
  referral reward together are worth more than the total, the excess is simply not applied anywhere
  else — it isn't banked or carried forward.
- **A ₹0 bill** — still counts as a fully successful payment. The billing period moves forward
  normally, exactly as if a normal amount had been charged.

**One thing we can already promise, regardless of anything above:** a customer will never be
charged twice for the same thing, and will never end up with duplicate access or duplicate rewards
from the same event.

---

## Part 16 — What Customers Are Told, and When

Everything above describes what happens to a customer's billing. This section covers something
different but equally important: what the customer actually **hears from us** at each of those
moments, since silence at the wrong time is its own kind of failure, separate from getting the
billing math right.

At minimum, a customer should receive a message at each of these moments:

- **After every successful payment** — a receipt, confirming what was charged and why.
- **Immediately after any failed payment** — a notice that the charge didn't go through and that
  we'll automatically retry, so it isn't a surprise later.
- **Before the account is suspended** — a final warning, giving the customer a last chance to fix
  the issue before access is actually blocked.
- **Whenever a downgrade, add-on removal, or cancellation is scheduled** — a confirmation stating
  exactly what will change and on what date, so there's a paper trail the customer (and Support)
  can always refer back to.
- **If autopay is cancelled on the customer's side** (Part 9) — a notice at their next renewal
  attempt, since that's the first moment we ourselves become aware of it.

**This is intentionally a short list of moments, not a finished communication plan** — the exact
wording, subject lines, and delivery channel (email vs. in-app) are a separate piece of work. What
matters at this level is that none of these moments should ever happen silently.

---

## Part 17 — What's Fully Automatic vs. What Support Can Override

Everything described in this document happens automatically, by rule, with no human judgment
involved — that's the whole point of the system. But it's worth being explicit about where a human
(Support, or you) can still step in and make an exception, versus where the system's behavior is
final.

**Can be manually overridden by Support/Admin, case by case:**
- Starting, extending, or adjusting a trial for a specific customer.
- Manually cancelling a scheduled change on a customer's behalf if they ask via Support instead of
  doing it themselves in-product.
- Manually reactivating a suspended account.
- Archiving a plan or add-on so it stops accepting new customers, without affecting anyone already
  on it.
- Correcting a genuine billing mistake (we charged the wrong amount due to a bug) — but this is
  always a separate, new adjustment, never an edit to the original bill (see below).

**Never overridden — these are hard, automatic rules with no manual exception path, for anyone,
including Support and Admin:**
- **Refunds. There are none, ever, under any circumstance** — not for early cancellation, not as a
  goodwill gesture, not for any reason. This is a deliberate, permanent policy, not a temporary gap.
- The order in which discounts, proration, and tax are applied to an invoice (Part 13).
- The rule that nothing commercial changes before a payment actually succeeds (Parts 4, 5, 6, 8).
- Which invoice a referral or coupon applies to, once that invoice is generated and frozen.
- Cancelling a subscription *immediately* — even Support/Admin can only schedule a cancellation for
  the next renewal, never cancel on the spot.
- Directly resetting or fabricating a customer's payment authorization — the only lever Support has
  is asking the customer to re-authorize through the normal flow again.

**Why this distinction matters:** it tells Support exactly what they're allowed to promise a
customer on a call, versus what they need to explain is simply how the system works and cannot be
special-cased.
