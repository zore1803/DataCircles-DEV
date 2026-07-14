# User Observations — raw QA evidence

> **Layer 1 of 3** (Evidence → Investigation → Architecture). This is what a
> human actually saw, in their own words, as close to verbatim as practical.
> **Nothing here is code, implementation, or architecture — never edit an
> entry to sound more technical.** This document NEVER shrinks; if something
> looks redundant with `flows/*.md`, that's fine — `flows/*.md` is the
> investigation built FROM this evidence, not a replacement for it.
>
> Each entry: what was done → what was seen (UI/toasts/Mongo/Network, verbatim
> where possible) → any reaction/expectation noted at the time. A pointer to
> where it got investigated is added AFTER the fact, once known — the
> observation itself is never rewritten to match the finding.

---

## Session 1 — Signup → Trial → first CRM use (2026-07-10)

### Auth / org creation
- Landing → "Sign in with Google" → Auth0 account chooser (already had a saved account in this browser).
- "Set Up Your Company" → chose "Create New" → typed org name "test" → Continue.
- "Company Created Successfully — Share this unique code with your team members" — code shown: `Z0MEZVY3`.
- **Note (explicitly deferred by the user):** did NOT go through a referral link this time — logged in directly, no `?ref=`. Auth/access-control/user-management were explicitly marked out of scope for this audit ("that is also something to think about" but not now — tested extensively already, architecture built on it).

### Landed on pricing immediately, no subscription
- After "Go to Dashboard," redirected straight into: Choose Your Plan page. Monthly/Annual toggle, "7-Day Free Trial Available," "Have a coupon code? Apply," "Have a referral code? Apply," Trial / Starter / Growth / Business cards, feature comparison table, FAQ accordion.
- → *Investigated in `flows/Trial.md` §4 (entry point) and needs its own `flows/SubscriptionAcquisition.md` — see completeness audit below.*

### Trying to use the app WITHOUT subscribing (before trial)
- Went to Companies (and other pages) directly. Observed on screen simultaneously:
  - "No subscription found. Please subscribe to continue." (**shown 3 times**, stacked)
  - "Failed to fetch company fields"
  - Companies page itself still rendered its shell (search bar, filters, "New Company" button) despite the errors.
- User's own reaction, verbatim: *"anything else i open up without a trial or anything this is what happens"* — implying this was seen across **multiple pages**, not just Companies.
- Later, on Products & Services page (no subscription): same pattern — page shell rendered, list loaded (**this page's list actually loaded fine** — contradicts the "Failed to fetch" pattern seen elsewhere; not explained, not yet investigated).
- Later again, general note while browsing multiple pages: *"Failed to fetch deal fields / Failed to fetch companies / Failed to fetch deals / Failed to fetch contacts / subscribe to continue. / No subscription found. Please subscribe to continue. / No subscription found. Please subscribe to continue. / Failed to fetch company fields just in whichever page i go"* — explicit statement that this happens on **every page**, and the user called this out as a dump: *"there are just way too many."*
- → *Investigated in `flows/Trial.md` §11 (restrictByPlan traced). NOT YET investigated: why Products & Services list loaded despite the same lack of subscription — inconsistent with Companies/Deals/Contacts.*

### Referrals page — accessible with NO subscription
- Navigated to Settings → Referrals with no subscription active at all.
- Fully rendered and functional: "Referrals sent 0 / Pending 0 / Qualified 0 / Rewards available 0," own referral code shown (`MJFRIO0`), "Invite a friend" + "Invite via email" both present, "People you've referred" empty state.
- User's own framing (paraphrased, kept close to original): referring should be allowed before subscribing, but if the referred org uses the code and has no subscription or is only on trial, they should still eventually get a reward tied to their first invoice — while the recurring amount stays separate. **User explicitly flagged this architecture is not built yet**, and explicitly said this is because of the Razorpay recurring-subscription limitation already written up in PROJECT_STATE.md — **not something to solve now**.
- → *Partially investigated: referral code sharing pre-subscription confirmed unrestricted in `InteractionMatrix.md` ("Trial | Referral (as referrer)"). The specific product idea — "referred org's FIRST INVOICE gets a discount even if they only trial/haven't paid yet" — is a distinct, NOT-YET-DOCUMENTED product requirement. See completeness-audit gap below.*

### Missing "Start Trial" CTA
- User's own words: *"there should be a start a free trial whichever page i go and that was there now its not there anymore."*
- This states two things: (1) a product expectation that a Start Trial CTA should be reachable from any page when there's no subscription, and (2) a **regression claim** — it used to be there and isn't anymore.
- → *NOT investigated at all this pass. Not in any doc yet. See completeness-audit gap below — this is the single clearest miss.*

### Billing page — accessible with NO subscription
- Settings → Billing, before any subscription existed: "No active subscription yet. Choose a plan →" — clean empty state, not an error.
- User's reaction, verbatim: *"billing is perfect this is awesome i didnt even ask to do this."*
- → *Not yet explicitly documented as an intentional pre-subscription-accessible page. See gap below.*

### Starting the trial
- Clicked "Start Trial" on the Trial card.
- Confirmation modal appeared: "Start Your Free Trial — Get access to all Growth plan features for 7 days. No credit card required." Buttons: "Start Free Trial" / "Maybe Later."
- Confirmed. User's expectation stated before checking: *"it should have all growth features and all... we will look inside the code and all to see if there is all the growth features."*
- → *Investigated: `flows/Trial.md` §5 (Growth feature parity, Verified via `PlanConfig` lookup).*

### After trial started — pricing page
- Banner: "Free Trial Active — Growth Plan Features · All premium features unlocked · 7 days remaining (Ends: 17 Jul 2026)." Toast: "Trial Active — Free trial activated! Enjoy all Growth features for 7 days."
- Growth card's action button changed from "Subscribe" to **"Complete Payment."** Other cards (Starter, Business) unchanged, still say "Subscribe."
- User's own remark: *"dates are perfect and all."*
- → *Investigated: `flows/Trial.md` Finding #1 — traced to `paymentStatus` schema default, not a designed conversion CTA. See completeness-audit note below: the ORIGINAL suggestion (a clearer label like "Upgrade to Paid"/"Convert to Subscription") got folded into the technical finding but the two are distinct and should both be recorded — see fix below.*

### CRM pages after trial started
- Companies page: real functionality, including genuinely fake/seed demo data ("Auto Manufacturers," "EduTech Academy," etc. — 10 results, pagination controls). User confirmed this is fake seed data, explicitly noted it's visible/usable.
- Creating a new company ("qwdjoij", industry "Education & EdTech") — **worked as intended.**
- → *Not specifically investigated (CRUD correctness is explicitly out of scope for this billing audit per the user's own framing — noted here for completeness only.)*

### Billing page after trial started
- Settings → Billing: "Growth · ACTIVE · ₹0/mo," "Next Renewal —" (blank), "Manage Subscription" button, Timeline: "Free Trial Started · Growth · Ends 17 Jul 2026 · 10 Jul 2026, 11:48 am," "Payment History (0)," plus links to "Referrals" and "Billing Information."
- User's remark: *"this is also perfect."*
- → *Investigated: `flows/Trial.md` §8/§10 (timeline entry, TRIAL_STARTED confirmed).*

### Dashboard banner
- Top bar shows: "Book Free Demo · Trial ends in 7 days · Upgrade Now" alongside the normal search/nav.
- User's remark: *"this is also perfect for now i think this is enough."*
- → *NOT investigated — the specific component was flagged as unlocated in `flows/Trial.md` §8/§11 ("2 banner components unlocated"). Confirmed still open.*

---

## How to use this document going forward
- Add a new dated session heading per walkthrough.
- Never delete/rewrite an entry once added — if a later trace shows something was misread, add a correction note below the original entry, don't erase it.
- Every entry should eventually get a "→ *Investigated in...*" pointer once traced. An entry with no pointer after a completeness audit is an open gap — see `flows/Trial.md`'s completeness-audit checklist for the current list.
