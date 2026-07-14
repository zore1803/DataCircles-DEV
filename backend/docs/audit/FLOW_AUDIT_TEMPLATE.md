# Capability Audit Template — how we investigate (not just document)

> **Mindset shift:** we are not answering "what does the code do?" We are
> answering **"how does the billing system behave, and what does it
> guarantee?"** The code is evidence for a behavioral model and a business
> contract — not the end product itself.
>
> **We audit business capabilities, not pages.** Not "Billing Page" — **Trial**.
> Not "Dashboard" — **Access Control**. Not "Pricing Page" — **Subscription
> Acquisition**. Not "Referral Page" — **Referral Lifecycle**. Pages change;
> capabilities last.

## The three-person package (every capability gets this)

1. **User walkthrough (you)** — perform the action for real. Report what you
   clicked, what you expected, what you saw in the UI, what's in Mongo, what's
   in the Network tab, what Razorpay showed, anything weird. No code required.
2. **Code investigation (me)** — full implementation trace: controller →
   service/util → DB write → external call → response, cited `file:line`.
   Database changes, APIs, events, access control, scheduled jobs, dead code,
   bugs. Never "looks good" — always the trace, and always tagged (below).
3. **Architecture review (ChatGPT / architect role)** — the business contract,
   invariants, interactions with other capabilities, documentation routing,
   architectural smells, missing test scenarios.

## Required epistemic tags — use these, not "traced/unverified" loosely

Every claim in every capability doc must carry exactly one of:

- **Observed** — a human (you) actually ran it and saw the result (UI, Mongo, Network, Razorpay dashboard).
- **Verified** — I traced the code and confirmed it produces the observed result (cite file:line). Observed + Verified together = a proven fact.
- **Assumed** — believed true by inference (e.g. "Growth features are identical to trial" before actually diffing them) — must be promoted to Verified or corrected, never left as a permanent fact.
- **Impossible (today)** — traced and confirmed the system architecturally cannot do this right now (e.g. reward on a recurring Razorpay Subscription — blocked by the fixed-recurring-amount constraint). Cite the blocking constraint.
- **Future** — intentionally deferred, documented as a target, not currently attempted.

Never state an Assumed claim as if it were Verified. If you can't tell which
tag applies, that itself is a finding — write "❓ needs a targeted check," don't guess.

## Where each kind of finding goes (the routing table lives in `DOCUMENTATION_ROUTING.md` — this is the capability-specific subset)

| For this capability, produce... | Goes in |
|---|---|
| The full walkthrough + trace (this template, sections 1–12 below) | `flows/<Capability>.md` |
| The business contract (what's guaranteed vs. not) | `audit/BusinessContracts.md` — one section per capability |
| How this capability behaves when combined with another | `audit/InteractionMatrix.md` — a row per pair, cross-linked from both flow docs |
| Legal states/transitions touched | `state-machines/<Entity>.md` |
| A confirmed bug | `KNOWN_BILLING_GAPS.md` |
| A BillingEvent fired/missing | `audit/EventMatrix.md` |
| An untested scenario | `audit/EdgeCases.md` |
| A race/idempotency concern, dead code, duplication | `audit/ProductionChecklist.md` |

---

## Per-capability structure — `flows/<Capability>.md`

### 1. Purpose
Why does this capability exist? What business problem does it solve?

### 2. Business contract (write this FIRST, then prove every line)
What does this capability **guarantee**, in plain business language — not
implementation. E.g. for Trial: "one trial per organization," "no payment
required," "Growth feature access," "automatic expiry." Each line gets an
Observed/Verified/Assumed/Impossible/Future tag once investigated. This
section is mirrored into `audit/BusinessContracts.md`.

### 3. NOT guaranteed / unknown
Everything the contract does NOT promise, or that's genuinely unverified —
this becomes the testing backlog. E.g. "reward behavior during trial: ❓."

### 4. Entry points
Every way it can be triggered: REST endpoints, frontend pages/handlers,
webhooks, crons, internal calls, Super Admin overrides. Auth/role required.

### 5. Preconditions
What MUST already be true to reach the happy path. Cite the guard in code.

### 6. Complete execution trace
Controller → service/util → DB write → external API → state change →
response. Cite `file:line`. Split **initiation** (records intent) from
**settlement** (mutates canonical state).

### 7. Database changes
Per collection: before → after, which fields, which document (inserted vs.
updated — confirm it's not accidentally creating a duplicate).

### 8. UI changes
Exactly what changes on screen, and **when** (immediately / after webhook /
after polling / after refresh). Does the UI faithfully reflect backend state?

### 9. State transitions
Real enums only — never invented states.

### 10. BillingEvents / emails / analytics
What fires, from where, confirmed vs. missing.

### 11. Access control
If relevant: which middleware, what it actually checks, why access
changes when this capability activates/deactivates.

### 12. Interactions with other capabilities ⭐
Do NOT try to fully resolve this per-flow — enumerate the pairs and add rows
to `audit/InteractionMatrix.md`. This capability's flow doc just links to its
matrix rows.

### 13. Edge cases
Each: expected + status (Observed/Verified/Assumed/Impossible/Future/❓unknown).

### 14. Findings
Categorized: Bug / Architecture smell / Dead code / Missing feature /
Corrected assumption / Confirmed-good architecture. Each routed per the table above.

### 15. Improvement ideas
ONLY after 1–14 are understood. Never before. No speculative rewrites.
