# Billing System — Business Rules Decision Sheet

> **Who this is for:** the person approving how billing works — not engineers.
> **What this is:** a list of real-world situations that will happen to real customers, each with
> one plain question, a recommended answer, and a blank line for you to confirm or change it.
> **What this is not:** a technical document. There is no mention of code, databases, or how
> anything is built — only what should happen from the customer's, Support's, and Finance's
> point of view.
>
> **How to use this:** for each item below, either write "Agreed" next to the recommendation, or
> write what you'd prefer instead. You don't need to explain why — just the decision. Once every
> item has an answer, those answers become permanent business rules and get written into the
> technical specification. Nothing gets built differently from what you approve here.

---

## How to read each item

Each item has four parts:

- **The situation** — something that will actually happen to a customer.
- **Why it matters** — what goes wrong if we don't decide this in advance.
- **Recommended default** — what we suggest, so you're reacting to a proposal, not staring at a
  blank page.
- **Your decision:** — a blank line for you to fill in.

---

## Part 1 — Must decide before we build anything further

These six are the ones most likely to cause a customer complaint, a support escalation, or a
financial dispute if left undecided.

### 1. Free trials

**The situation:** A new customer signs up. How long do they get to try the product before being
asked to pay, and what happens the moment that period ends if they haven't chosen a plan?

**Why it matters:** This is the very first money-related moment in every customer's relationship
with us. If this isn't decided clearly, different customers could get inconsistent treatment —
some locked out immediately, others left with access indefinitely.

**Recommended default:** 14-day trial. No card required to start the trial. On day 14, if no plan
has been chosen, access is suspended (not deleted) and the customer sees a "choose a plan to
continue" screen. Support can manually extend a specific customer's trial on request.

**Your decision:** _______________________________________________

---

### 2. What happens when we raise prices

**The situation:** Six months from now, we decide to increase the price of a plan. What happens
to the customers already paying the old price?

**Why it matters:** This will happen at some point to every subscription business. If we haven't
decided this in advance, existing customers could be silently charged a higher price without
warning — a guaranteed source of complaints and possible reputational damage.

**Recommended default:** Existing customers keep their current price for as long as they stay
subscribed without interruption ("grandfathered"). New customers pay the new price from day one.
If we ever want to move existing customers to the new price, that requires at least 30 days'
advance notice by email before it takes effect.

**Your decision:** _______________________________________________

---

### 3. Refunds

**The situation:** A customer asks for money back — because they cancelled early, because they
were charged in error, because they're unhappy, or any other reason.

**Why it matters:** This is one of the most common questions Support and Finance will ever be
asked, and right now there is no answer at all. Silence on this doesn't mean "no refunds" — it
means every agent will make up their own answer.

**Recommended default:** No refunds for unused time on any plan (monthly or annual) — cancelling
simply means access continues until the period already paid for ends, then stops. The only
exception is a genuine billing error (we charged the wrong amount, or charged twice) — those are
corrected in full. Any exception beyond that (goodwill, escalations) requires specific written
sign-off from you or Finance, case by case — it is never an agent's own call.

**Your decision:** _______________________________________________

---

### 4. Customer downgrades to a smaller plan than they're currently using

**The situation:** A customer is on a plan that allows, say, 40 team members, and downgrades to a
plan that only allows 5. What happens to the other 35 people?

**Why it matters:** This is one of the most common downgrade scenarios in practice, and right now
nothing says what happens — meaning real customer data or access could be affected without a
clear, deliberate rule behind it.

**Recommended default:** The downgrade is not allowed to complete until the customer manually
reduces their usage (removes users, deletes data, etc.) below the new plan's limit. We show them
exactly what needs to be reduced before they can confirm the downgrade.

**Your decision:** _______________________________________________

---

### 5. Preventing customers from gaming discounts by cancelling and resubscribing

**The situation:** A referral reward or a "first invoice only" discount is given the first time
someone pays us. Can a customer cancel and sign back up repeateds, over and over, to keep
collecting that same one-time reward or discount each time?

**Why it matters:** If not blocked, this is a direct and repeatable way to lose money the moment
referrals or first-time discounts go live — and it will be found and used.

**Recommended default:** Any "first payment" reward, discount, or referral bonus is tied to the
organization itself (its account, email domain, or business identity), not to the specific
subscription. It can only ever be granted once per organization, ever — even if they cancel and
come back later.

**Your decision:** _______________________________________________

---

### 6. What happens to a customer's data when they're suspended or cancelled

**The situation:** A customer stops paying (suspended) or actively cancels. What happens to their
data — can they see it, export it, get it back later? For how long do we keep it before deleting
it permanently?

**Why it matters:** This is both a customer-trust question and a legal one (data retention laws,
and the ability to produce old invoices for tax purposes). Support will be asked this on nearly
every cancellation.

**Recommended default:** Suspended accounts are read-only (can view and export data, cannot make
changes) for as long as they remain suspended. Cancelled accounts keep their data, read-only, for
90 days after cancellation, after which it is permanently deleted. Invoices/billing history are
kept and downloadable for a longer period regardless (for tax/audit purposes) — recommend 7 years,
matching general Indian tax record-keeping practice, but Finance should confirm this number.

**Your decision:** _______________________________________________

---

## Part 2 — Should decide soon; the system can launch without these, but Support will hit them quickly

### 7. What discounts do when they add up to more than the bill

**The situation:** A customer has both a coupon and a referral reward active, and together they're
worth more than the invoice itself. Do we charge nothing? Cap the discount at the bill amount and
lose the rest? Or carry the leftover forward to their next bill?

**Why it matters:** Someone will ask Finance "why is this invoice ₹0" or "why didn't the full
discount apply," and there needs to be one consistent answer.

**Recommended default:** Discounts can never take a bill below ₹0. Any amount left over is simply
lost for that invoice — it does not carry forward or roll over to future bills.

**Your decision:** _______________________________________________

---

### 8. What customers are told, and when

**The situation:** At every stage of the billing relationship — an upcoming renewal, a successful
payment, a failed payment, an approaching suspension, a scheduled downgrade — does the customer
get any kind of notice, or do these things just happen silently?

**Why it matters:** From the customer's perspective, getting suspended or charged with zero
warning feels like being blindsided, regardless of whether our internal logic was technically
correct. This is one of the biggest drivers of complaints in subscription businesses generally.

**Recommended default:** Customers are emailed for all of the following: a receipt after every
successful payment; a warning immediately after any failed payment, explaining we'll retry; a
final warning before their account is suspended; and a confirmation whenever they schedule a
downgrade, add-on removal, or cancellation, stating exactly what will change and when.

**Your decision:** _______________________________________________

---

### 9. Updating a payment method on its own (not tied to any other change)

**The situation:** A customer's card is about to expire, or they simply want to pay from a
different bank account — with no other change to their plan.

**Why it matters:** This is one of the most routine requests in any subscription business, and
right now the document only discusses payment authorization in the context of signing up or
recovering from a failure — not as its own simple action.

**Recommended default:** A customer can update their payment method at any time from their
account settings, with no impact to their current plan, add-ons, or renewal date.

**Your decision:** _______________________________________________

---

### 10. What a customer can and can't do while a payment has failed but they're not yet suspended

**The situation:** A payment just failed and we're about to retry it, but the account isn't
suspended yet. Can the customer still use the product fully during this window, or is something
already restricted?

**Why it matters:** Customers and Support will both want a clear, single answer — "am I locked out
right now or not?" — rather than a vague "it depends."

**Recommended default:** Full access continues, unchanged, during this window. A visible banner
tells the customer their payment failed and will be retried, with a way to fix it immediately if
they want to. Access is only restricted once we reach full suspension (after all retries and the
grace period are exhausted).

**Your decision:** _______________________________________________

---

### 11. Can a customer cancel while we're still trying to collect a failed payment from them?

**The situation:** A customer owes us money from a renewal that hasn't gone through yet, and asks
to cancel right now.

**Why it matters:** Without a clear rule, Support won't know whether to allow this, or what happens
to the money owed if they do.

**Recommended default:** Yes, they can cancel at any time. Cancelling stops any further retry
attempts, but the amount already owed for the period they used is still due and will be pursued
as an outstanding balance, separately from their now-cancelled subscription.

**Your decision:** _______________________________________________

---

### 12. Getting back in after being suspended for non-payment

**The situation:** A suspended customer wants to come back. What exactly do they have to do?

**Why it matters:** This is the natural next question after every suspension, and currently
there's no defined path back in.

**Recommended default:** The customer pays whatever is currently owed, and their account
reactivates immediately with everything exactly as it was before suspension (same plan, same
add-ons, same renewal date going forward). No separate approval step needed.

**Your decision:** _______________________________________________

---

### 13. Can more than one discount code be active on the same account at once?

**The situation:** A customer already has one active coupon, and either Sales or the customer
tries to apply a second one.

**Why it matters:** Sales or Support may assume this is allowed unless told otherwise, and it
changes how much revenue a given account generates.

**Recommended default:** Only one coupon can be active per account at a time. Applying a new one
replaces the old one — they don't combine. (Referral rewards are separate from this and can still
apply on top, per item 7 above.)

**Your decision:** _______________________________________________

---

### 14. Special pricing or custom deals for individual customers

**The situation:** Sales wants to offer one specific customer a non-standard price, seat count, or
contract term outside our normal plans.

**Why it matters:** If this isn't addressed, Sales may promise something the billing system has
no way to actually reflect — creating a gap between what's sold and what's billed.

**Recommended default:** Not supported at launch — every customer is on one of the standard,
published plans. Custom/negotiated deals are a separate future decision, not something Sales
should offer until we explicitly build support for it.

**Your decision:** _______________________________________________

---

### 15. When an upgrade needs authorization for a bigger payment amount than originally approved

**The situation:** A customer originally authorized us to charge up to a certain amount
automatically. They now want to upgrade to something that costs more than that. What do they have
to do, and does anything change for them while they do it?

**Why it matters:** Without a clear answer, this could either silently block a customer's upgrade
with no explanation, or leave their account in a confusing in-between state.

**Recommended default:** The customer is asked to re-approve a higher payment authorization at the
moment they attempt the upgrade — this is a normal part of the upgrade flow, not a separate
interruption. Nothing about their current plan changes until that re-approval and the upgrade
payment both succeed.

**Your decision:** _______________________________________________

---

### 16. Cancelling an annual (prepaid) plan partway through the year

**The situation:** A customer paid for a full year upfront, and cancels two months in.

**Why it matters:** This is the same question as refunds (item 3), but the amount of money at
stake is much larger for annual customers, so it deserves its own explicit confirmation rather
than assuming the same answer as monthly plans.

**Recommended default:** Same as item 3 — no refund for unused time. The customer keeps full
access for the remainder of the year they already paid for, and the subscription simply doesn't
renew after that.

**Your decision:** _______________________________________________

---

### 17. Tax details on invoices for business customers

**The situation:** A business customer needs their GST number shown on our invoices for their own
tax filing.

**Why it matters:** This is a Finance/compliance requirement for business customers specifically,
and needs a yes/no decision on whether we collect and display it.

**Recommended default:** Yes — we collect a customer's GST number (optional field) during signup
or from account settings, and if provided, it's shown on every invoice.

**Your decision:** _______________________________________________

---

### 18. A customer disputes a charge with their own bank (chargeback)

**The situation:** Instead of contacting us, a customer disputes a payment directly with their
bank, and the bank reverses money we already received, sometimes weeks later.

**Why it matters:** This is a normal, expected event in any payments business and currently has no
defined handling at all.

**Recommended default:** The account is suspended immediately when we're notified of a dispute,
pending manual review by Finance. It is not auto-reactivated — a person decides the outcome case
by case, since disputes often involve fraud or genuine billing confusion that needs a human look.

**Your decision:** _______________________________________________

---

## Part 3 — Good to confirm, but won't block launch

### 19. Multiple currencies / customers outside India

**Recommended default:** Not supported — Indian Rupees only, for now, by design.
**Your decision:** _______________________________________________

### 20. Can one company/organization have more than one subscription with us?

**Recommended default:** No — one organization, one subscription at a time.
**Your decision:** _______________________________________________

### 21. Moving a subscription from one organization account to another (e.g. a company restructuring)

**Recommended default:** Not self-serve — handled manually by Support on a case-by-case basis.
**Your decision:** _______________________________________________

### 22. What happens to billing if the government changes the GST rate

**Recommended default:** The new rate applies to invoices generated after the change; invoices
already issued before the change are not revised.
**Your decision:** _______________________________________________

### 23. Minimum number of seats/users a plan can be reduced to

**Recommended default:** Every plan has a minimum of 1. Add-on seats can be removed down to that
plan's included minimum, never below it.
**Your decision:** _______________________________________________

---

## What happens after this is filled in

Once every item above has your decision written next to it, these answers become the official
business rules for the billing system — Support, Finance, and engineering all follow exactly what
you've approved here, nothing more and nothing less. The recommendations are just starting points;
where you write something different, that's what we build.
