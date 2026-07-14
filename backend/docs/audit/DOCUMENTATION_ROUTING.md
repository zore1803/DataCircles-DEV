# Documentation Routing Table — the constitution

> Whenever anyone (you, ChatGPT, or me) discovers something during the audit,
> this table says where it goes. **No document contains implementation details
> that belong somewhere else.** A flow doc says "system recalculates pricing";
> it does NOT explain how — that's `PRICING_MODIFIER_ARCHITECTURE.md`'s job.
> This prevents duplication in the documentation itself, the same way we don't
> want duplication in the code.

## The three-layer rule (do not collapse these)

Every finding has three layers, and **all three must survive**, never just the last one:

1. **Evidence** (you) — raw, verbatim-as-possible observation. Goes in `audit/UserObservations.md`. NEVER summarized away, NEVER deleted, NEVER rewritten to sound technical.
2. **Investigation** (me) — why it happens, traced to code. Goes in the capability's `flows/<Capability>.md`.
3. **Architecture judgment** (ChatGPT) — good / bad / smell / debt / bug / future. Goes in `KNOWN_BILLING_GAPS.md`, `audit/ProductionChecklist.md`, or `BillingArchitecture.md` depending on severity/permanence.

A "business issue" and its "technical cause" are DIFFERENT things and must
both be written down, not merged into one summary sentence. See
`KNOWN_BILLING_GAPS.md`'s Trial-audit entries for the pattern to follow.

| Discovery | Goes in |
|---|---|
| Raw QA observation (what a human saw, unedited) | `audit/UserObservations.md` — layer 1, permanent, never shrinks |
| A business capability's full walkthrough + trace | `flows/<Capability>.md` (audit **capabilities**, not pages — see `FLOW_AUDIT_TEMPLATE.md`) |
| A business **contract** — what a capability guarantees, in plain language | `audit/BusinessContracts.md` — one section per capability, every line tagged Observed/Verified/Assumed/Impossible/Future |
| How TWO capabilities behave together (e.g. Trial + Coupon, Upgrade + Reward) | `audit/InteractionMatrix.md` — one row per pair. Do NOT resolve cross-capability behavior inline in a single flow doc. |
| Legal states + transitions for an entity | `state-machines/<Entity>.md` |
| Pricing/discount arithmetic | `PRICING_MODIFIER_ARCHITECTURE.md` |
| Overall philosophy / invariants / goals | `BillingArchitecture.md` |
| A confirmed bug (implementation ≠ intended behavior) | `KNOWN_BILLING_GAPS.md` |
| A BillingEvent that fires (or should, or is missing) | `audit/EventMatrix.md` |
| A scenario we haven't tested / a missing edge case | `audit/EdgeCases.md` |
| A race condition / idempotency concern, dead code, duplicated logic | `audit/ProductionChecklist.md` (promote to a `RefactorPlan.md` if it grows large) |

## Epistemic tags (mandatory on every claim — see `FLOW_AUDIT_TEMPLATE.md`)

**Observed** (a human ran it) · **Verified** (code traced + confirms it,
file:line) · **Assumed** (inferred, not yet checked — must be promoted or
corrected) · **Impossible today** (architecturally blocked, cite the
constraint) · **Future** (intentionally deferred). Never state Assumed as
if it were Verified.
| A UI showing something inconsistent with backend state | `KNOWN_BILLING_GAPS.md` (cross-reference the flow) |
| Which controller/service/line implements a step | Inside the flow doc's **§4 Execution Trace** ONLY — never duplicated elsewhere |
| Cross-flow interaction (upgrade + coupon + addon, etc.) | The flow doc's **§8 Cross-flow coherence** section, AND the checklist in `audit/BusinessFlowAudit.md` |
| Implementation status (traced/observed/unverified) | Wherever the claim is made — every claim in every doc must be tagged |

## The filter before any code change

Before proposing or making a change, it must pass:
1. Does this fit the business model (BillingArchitecture.md's goals/invariants)?
2. Does it violate a System Invariant?
3. Does it duplicate existing logic?
4. Should this responsibility already live somewhere else (wrong layer)?
5. Will another flow break because of this (check `BusinessFlowAudit.md`'s cross-flow checklist)?
6. Does it require a NEW state, or just a new transition on an existing one?
7. Which documents need updating as a result?

If any answer raises a concern: **stop, discuss, redesign — before writing code.**

## The four-person loop (per action)

1. **You (QA/product owner):** perform the action for real. Report: what you clicked, what you expected, what you saw in the UI, what's in Mongo, what's in the Network tab, what Razorpay showed, anything weird. No code reading required from you.
2. **ChatGPT (architect):** takes your report, asks the business/architecture questions (was this allowed? should it have been? what state changed? what event should fire? what invariants apply? what other flows touch this?), and says which document(s) this belongs in per the table above.
3. **Me (implementation investigator):** trace the actual code for that action — controller → service/util → DB write → external call → response. Cite `file:line`. Answer *why* it happens, not *what should* happen. Flag duplication, races, missing idempotency, TODOs, similar existing implementations. Never say "looks good" — always show the trace.
4. **ChatGPT (again):** compares business model vs. my trace. If they differ: is it a bug, a missing feature, a doc error, or intentional? Decides where the finding is routed. Only after this does anyone touch code — and only with explicit agreement.

## Audit order (dependency order — corrected from feature order)

Later flows build on earlier ones, so audit in this sequence (see
`audit/BusinessFlowAudit.md` for live status):

1. **Pricing Engine** (foundation — everything prices through it)
2. **New Subscription**
3. **Settlement** (everything after successful payment converges here)
4. **Coupons**
5. **Referral & Rewards**
6. **Add-ons** (purchase + removal)
7. **Upgrade**
8. **Downgrade**
9. **Cancellation**
10. **Renewal**
11. **Super Admin**
12. **Cross-flow interaction audit** (only after 1–11: upgrade+coupon+addon+pending-change combinations, etc.)

Within each flow, finish completely (UI, DB, network, business rules, code
trace, edge cases, doc) before moving to the next — no jumping around.
