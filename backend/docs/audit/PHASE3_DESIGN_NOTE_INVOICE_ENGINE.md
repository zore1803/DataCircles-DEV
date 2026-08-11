# Phase 3 Design Note — Realizing the Invoice Engine's Stage 5 (Commercial Adjustments)

**Status:** Option C'' implemented in `utils/invoiceEngine.js` (engine-level only — see §7.6 for a
sign-convention bug this note's own §5/§7.2 sketches got wrong, caught by an equivalence test, not
shipped). No controller has been migrated yet.
**Scope:** Answers one question only: *how should `calculateInvoice()` be implemented so that Stage 5
(proration/unused-value) exists inside the one Invoice Engine Chapter 3.3 already specifies?* This
note does not re-derive the domain model — Chapter 3.3 already settled that (one pipeline, one
Invoice per Commercial Event, ten stages). It exists because Phase 2's investigation
(`IMPLEMENTATION_PLAN_V1.md` §Part 3 top note) found Stage 5 was never actually built into the
canonical engine — two call sites reach for standalone proration utilities instead.

---

## 1. What each existing function computes, precisely

| Function | Inputs | Outputs | Chapter 3.3 stage(s) | Gap |
|---|---|---|---|---|
| `calculateInvoice()` (`utils/invoiceEngine.js`) | subscription-shaped object, optional `changeset`, `resolvedModifiers[]` | `{subtotal, discount, taxable, gst, total, lines[]}` | 1–4 (implicit), 6–7 (generic, unordered-by-type), 8–9 | **No Stage 5.** Has no concept of an "old" component to compare against — every call prices a state as if it were the first time. |
| `buildPricingSnapshot()` (`utils/pricingEngine.js`) | `plan`, `billingCycle`, `activeAddons`, `couponDiscount`, `modifiers`, `basePriceOverride` | `{subtotal, discount, totalAmount, gst, grandTotal}` | 4, 6–9 | Same absence. `basePriceOverride` is the actual seam where a pre-computed number is smuggled in from outside — proration happens *before* this function is called, never inside it. |
| `calculatePlanUpgradeProration()` (`utils/addonManagement.js`) | `oldBasePrice`, `newBasePrice`, `currentPeriodStart`, `currentPeriodEnd` | one bare rupee number | Stage 5 only | Produces a single delta, not a line item; has no subtotal, no discount/GST awareness, no invoice shape at all. Caller applies GST and modifiers to this number *manually*, outside both this function and `calculateInvoice()`. |
| `calculateAddonProration()` (`utils/addonManagement.js`) | `quantity`, `pricePerUnit`, `currentPeriodStart`, `currentPeriodEnd` | one bare rupee number | Stage 5 only | Same isolation as above. |

**Confirmed directly against `BILLING_DOMAIN_SPECIFICATION.md` §3.3** (not assumed): Stage 5 is
specified as *"Commercial Adjustments (Pricing, not a discount) — proration, unused old-plan/old-cycle
value... must happen first: the customer never pays for value they already own,"* ordered strictly
before Stage 6 (Coupon) and Stage 7 (Referral) — *"discounting against the pre-proration list price
would discount value the customer never owed."* The worked example shows a proration line
(`Unused Starter Plan Credit (15 days) −₹125`) sitting inside the same line-item list as the plan and
add-on charges, not computed separately.

**What this means concretely:** today's two proration functions compute *the Stage 5 number* but
never produce *a Stage 5 line item inside an invoice*. GST is then applied to that bare number
directly by the caller (`computeGST(discountedProrationAmount)` in both `updateSubscription` and
`initiateAddonPurchase`), which happens to be numerically equivalent to running Stage 8 on a
single-line invoice — but it never goes through Stage 6/7 in the spec's actual order relative to
Stage 5, because there is no Stage 5 line for Coupon/Referral to apply *after*.

---

## 2. The real asymmetry (this is the finding, not an assumption)

Every other input `calculateInvoice()` needs is a single point-in-time snapshot: *what does this
commercial state cost, priced fresh, right now.* Stage 5 needs something structurally different:

```
Stage 1-4, 6-10 need:        { new component }
Stage 5 needs:                { old component, new component, elapsed/remaining time }
```

This is not a stylistic difference — `calculatePlanUpgradeProration()` and
`calculateAddonProration()` cannot be expressed as a pure function of "the current subscription,"
because their entire output depends on comparing *two* states across *time*, which `calculateInvoice()`'s
current signature has no slot for at all.

---

## 3. Three implementation shapes (paper only — none of these are built)

**Option A — One flat orchestrating function.**
```
calculateInvoice({ subscription, changeset, oldComponent, currentPeriodStart, currentPeriodEnd, resolvedModifiers })
  → Stage1..Stage10 inline, Stage 5 as an if-branch keyed on whether oldComponent was passed
```
Simplest to write. Directly risks becoming the "god function" shape — every future Commercial Event
that needs its own optional inputs (metered usage, future retry-specific adjustments) adds another
optional parameter to the same function, and callers that don't need Stage 5 (signup) still carry its
parameters as always-`undefined`.

**Option B — `InvoiceEngine` as an explicit object/module, `calculateInvoice()` becomes a thin wrapper.**
```
InvoiceEngine.compute({ context, commercialState, modifiers })
  internally: stage1(...) → stage2(...) → ... → stage10(...)
calculateInvoice(...) = a compatibility wrapper preserved for existing callers
```
Same flattening risk as Option A at the stage-5 boundary specifically, just renamed — doesn't resolve
the asymmetry, only relocates it. Worth it only if the goal is decomposing Stages 1–10 generally
(useful for testability), not specifically for solving the old-state/time input problem.

**Option C — Stage 5 delegated to a dedicated calculator, still one Invoice Engine.**
```
calculateCommercialAdjustments({ oldComponent, newComponent, currentPeriodStart, currentPeriodEnd })
  → { lines: [{ type: 'commercial_adjustment', key, amount }], adjustmentTotal }

calculateInvoice({ subscription, changeset, resolvedModifiers, adjustments })
  → Stage 4 includes adjustments.lines directly in the line-item list
  → Stage 5 is "did the caller pass adjustments? include them, in position, before Stage 6/7"
  → everything else unchanged
```
`calculatePlanUpgradeProration()`/`calculateAddonProration()` become the two callers of
`calculateCommercialAdjustments()` (or are absorbed into it as its two supported adjustment types),
each still handling their own old/new/time inputs — but their *output* becomes a proper Stage 5 line
item that `calculateInvoice()` consumes structurally, rather than a bare number GST is bolted onto
outside the pipeline entirely.

---

## 4. Evaluation against engineering criteria

| Criterion | Option A | Option B | Option C |
|---|---|---|---|
| Preserves Chapter 3.3's one-pipeline model | ✅ | ✅ | ✅ |
| Avoids duplicated pricing math (Ownership Law 1) | ✅ | ✅ | ✅ |
| Avoids a "god function" / unbounded optional-parameter growth | ❌ — every new Commercial Event's special-case inputs land on the same function signature | ⚠ — same problem, just under a different name | ✅ — Stage 5's unusual inputs stay isolated in its own calculator; `calculateInvoice()`'s signature grows by exactly one optional field (`adjustments`), not one per adjustment type |
| Stage 5 line items participate correctly in the Stage 5→6→7 order (adjustment before coupon before referral) | ⚠ possible, but easy to get wrong inline | ⚠ same | ✅ — structurally enforced, since `adjustments.lines` are just more Stage 4 line items by the time Stage 6/7 run |
| Testability (unit-test Stage 5 in isolation) | ❌ — entangled with the rest of the pipeline | ⚠ — better than A, still coupled to the module | ✅ — `calculateCommercialAdjustments()` is independently testable, exactly like today's two proration functions already are |
| Cost to implement given current code | Low | Medium (renames/relocates working code for no functional gain) | Low–Medium (two existing functions gain a line-item-shaped return value; `calculateInvoice()` gains one optional input) |

---

## 5. Recommendation (mine — not yet adopted; this is the one decision left open)

**Option C.** It's the only shape that turns the real asymmetry found in §2 into a structural
boundary instead of either ignoring it (Option A) or relocating it under a new name (Option B). It
also requires the least disruption to code that already works correctly today (both proration
functions are already pure, already tested in spirit by the concurrency/reservation logic around
them) — they gain a return-shape change, not a rewrite.

Concretely, if Option C is adopted, Phase 3 item 5a becomes:
1. Change `calculatePlanUpgradeProration()`/`calculateAddonProration()` to return
   `{ amount, lines: [{ type: 'commercial_adjustment', key, amount }] }` instead of a bare number —
   additive to their existing return value, not a breaking rename (existing callers reading `.amount`
   keep working during the transition).
2. Add an optional `adjustments` input to `calculateInvoice()` that, when present, inserts those lines
   at Stage 4/5 position, before `resolvedModifiers` (Stage 6/7) are applied.
3. Migrate `updateSubscription` and `initiateAddonPurchase` to call `calculateInvoice()` with
   `adjustments` populated, instead of computing GST/discounts on the bare proration number manually.
4. Only then does Phase 3 item 6 (`BillingInvoice` creation for these two flows) become honest —
   the persisted invoice's `lines[]`/`total` are the actual computation that produced the charge.

---

## 6. Revision — Option C'' (superseding §5's recommendation, not deleting it)

**A review round raised a real objection to plain Option C:** the controller still makes two calls —
`calculateCommercialAdjustments()` then `calculateInvoice()` — meaning the *caller*, not the engine,
decides when Stage 5 runs. Left as-is, a future engineer adding a new Commercial Event could forget
to call both in the right order; that's a genuine misuse-resistance cost, even though it doesn't
affect correctness or violate Ownership Law 1 (Law 1 governs which computation is authoritative, not
how many functions a controller calls).

**That review's own proposed fix (Option C') was checked and rejected — it re-introduces the exact
problem §3/§4 marked Option A down for.** C' proposed `InvoiceEngine.compute(context)` deciding
internally, via `eventType`, whether to run Stage 5. Tracing through what that requires: every caller
— including signup and renewal, which have no "old state" at all — would need to pass
`currentSubscription`/`targetSubscription`/`effectiveAt` as top-level fields, permanently `null` for
those paths. An internal `if (eventType === UPGRADE) runStage5()` branch is structurally identical to
Option A's "if-branch keyed on whether `oldComponent` was passed" — an enum check standing in for a
presence check. Swapping the dispatch mechanism doesn't change the shape; it's Option A relabeled in
ownership language, not a refinement of Option C.

**Resolution — Option C'': keep Option C's data shape, move the orchestration decision inside
`calculateInvoice()` itself, without requiring universal always-`null` fields.**
```
calculateInvoice({
  subscription, changeset, resolvedModifiers,
  adjustmentContext,   // optional, single bundle — NOT decomposed into always-present top-level fields
})
  → internally: if (adjustmentContext) { adjustments = calculateCommercialAdjustments(adjustmentContext) }
  → Stage 4 includes adjustments.lines when present, before Stage 6/7
  → signup/renewal callers simply never pass adjustmentContext — no eventType, no null fields to carry
```
This differs from plain Option C only in **who calls `calculateCommercialAdjustments()`** — the
engine now does, internally, when handed the bundle — not in the parameter shape, which stays a
single optional field exactly as §5 already scored well on god-function risk. It differs from C' in
that there is no `eventType` dispatch and no always-present `currentSubscription`/`targetSubscription`
fields forced onto every caller — only one optional bundle, present or absent.

**Updated evaluation — the one criterion this changes:**

| Criterion | Option C | Option C'' |
|---|---|---|
| Controller simplicity (one call vs. two) | ⚠ — controller calls `calculateCommercialAdjustments()` then passes its output into `calculateInvoice()` | ✅ — controller makes one call; `calculateInvoice()` invokes Stage 5 internally when the bundle is present |
| Avoids god-function/always-undefined-field growth | ✅ | ✅ — unchanged; still one optional bundle, not decomposed fields |
| Everything else from §4's table | unchanged | unchanged |

**Recommendation, revised: Option C''.** It captures the genuine ergonomic point the review raised
(engine, not controller, owns the Stage 5 *invocation* decision) without adopting that review's actual
proposed shape, which independently re-created Option A's marked-down problem. Concretely, this only
changes step 2 of the four implementation steps above: `calculateInvoice()` calls
`calculateCommercialAdjustments()` internally when `adjustmentContext` is present, rather than the
controller calling it and passing pre-computed `adjustments` in. Steps 1, 3, and 4 are unchanged.

**Still not yet adopted.** This is the second and (pending further review) likely final iteration of
this recommendation — recorded as a revision, not a silent replacement, per the project's own
supersede-in-place discipline.

**This recommendation is not a decision.** It is the input to the decision you asked to make
explicitly before any implementation starts.

---

## 7. Verification against real code (three items traced, not asserted)

Three open items remained after §6 — all apply equally to C and C'', since the underlying data flow
is the same in both. Traced directly against `utils/invoiceEngine.js`, `utils/pricingEngine.js`, and
`controllers/subscriptionController.js` (not re-asserted from the earlier description). **One of
these findings corrects a wrong claim earlier in this note.**

### 7.1 — Stage-ordering splice point: §3/§6's description of Option C/C'' was wrong

`calculateInvoice()`'s `lines[]` array (built at `invoiceEngine.js:68-74`) is assembled **after** all
real arithmetic has already happened inside `buildPricingSnapshot()` — it is a display-only
reconstruction from already-computed `snapshot` fields (`snapshot.discount`, `snapshot.gst`, etc.),
not an input to further computation. Modifiers (Stage 6/7) are applied inside `buildPricingSnapshot()`
against `subtotal` (`basePriceOverride + addonsTotal`, `pricingEngine.js:77-90`), never against
anything in `lines`. **§3 and §6's description — "insert `adjustments.lines` into the line-item list
before Stage 6/7 run" — describes something that isn't actually possible against this code:** Stage
6/7 never reads the line list at all.

### 7.2 — `basePriceOverride`'s fate: it is the mechanism, not a seam to retire (this follows from 7.1)

`basePriceOverride` (`invoiceEngine.js:64`, currently `pricePerUser + seatPrice`) is exactly what
feeds `subtotal`, which is what modifiers actually run against. For a Stage 5 adjustment to correctly
reduce the amount Coupon/Referral discount off of — §3.3's own mathematical requirement, *"discounting
against the pre-proration list price would discount value the customer never owed"* — the adjustment
must be folded into this same `basePriceOverride` computation, not layered on afterward as a display
line. **Correction to §5/§6's implementation sketch:** step 2 should not read "insert adjustment lines
into the line-item list, before Stage 6/7 are applied" — it should read:

```
effectiveBase = pricePerUser + seatPrice − (adjustmentContext ? calculateCommercialAdjustments(adjustmentContext).amount : 0)
snapshot = buildPricingSnapshot({ ..., basePriceOverride: effectiveBase, modifiers: resolvedModifiers })
lines = [ ...plan/seat/addon lines..., adjustment line (display only, from the same computed amount), discount line, tax line ]
```
This uses the *same* `basePriceOverride` seam that already exists — not a second, parallel path. The
risk flagged earlier (two ways for a pre-computed amount to enter the engine) does not materialize:
there remains exactly one seam, and the new call simply computes what value flows into it.

### 7.3 — Billing-cycle-change: does not need the bundle at all, not merely "compatible" with it

Traced the actual code path (`subscriptionController.js:1506-1594`): **billing-cycle-change is always
scheduled** (`isBillingCycleChange || !isUpgrade` → `pendingUpdate`, effective at
`currentPeriodEnd`), identically to a downgrade — it never charges anything immediately and never
computes a proration amount today. Its eventual invoice would be produced by the (not-yet-built)
Renewal Engine at cycle end, pricing a fresh recurring state exactly like signup/renewal — no old
state, no elapsed-time input. **So billing-cycle-change doesn't need to be checked against
`calculateCommercialAdjustments()`'s signature at all** — like signup and renewal, it simply never
passes `adjustmentContext`. This is a stronger, more specific answer than "looks compatible": it's a
fourth caller in the "no Stage 5" group, not a third caller in the "needs the bundle" group.

**Caveat worth naming, not resolving here:** §3.3 Stage 1 lists `BILLING_CYCLE_CHANGE` among invoice
*trigger* reasons, which is consistent with a possible future decision to make billing-cycle changes
immediate (mid-cycle, prorated) rather than always-scheduled. If that decision is ever made, it would
join the "needs `adjustmentContext`" group and this section would need revisiting. Today's actual
behavior does not require that, and this note does not recommend changing it.

### 7.4 — A fourth item, real and independent of Stage 5: Coupon/Referral ordering is not engine-enforced

A later review round asked whether "where Stage 6/7 execute" (settled in 7.1) also means "in what
order" — a genuinely separate question this pass had not actually checked. Traced directly against
`utils/pricingEngine.js` and `utils/modifierResolver.js`:

- **`buildPricingSnapshot()` has no internal ordering enforcement.** Its modifier-application loop is
  a plain `for...of` over whatever `modifiers[]` array it receives — pure array order, no `type`-keyed
  sort. (The separate legacy `couponDiscount` parameter is force-unshifted to front, but that's a
  different code path from the `modifiers[]` array `resolvedModifiers` populates.)
- **The one function that does enforce Coupon-before-Referral ordering — `modifierResolver.js`'s
  `resolveModifiers()`, which explicitly sorts by `priority` (`coupon: 10 < referral: 20`,
  §3.3/§3.5's "Coupon before Referral, mathematically required," never the reverse) — is never
  called anywhere in the codebase.** Grepped the full backend: defined, exported, unused.
- **Consequence, checked, not assumed:** every real call site builds its own array by hand instead.
  `createSubscription` only ever passes a coupon-only array (single element — no referral is ever
  combined there). `updateSubscription`'s upgrade path and `initiateAddonPurchase` only ever pass a
  referral-only array via `applyModifiers()` (single element — no coupon is ever combined there
  either). **No current call site actually combines both modifiers in one array today**, which is
  why this hasn't yet produced a visibly wrong invoice — the gap is latent, not live.

**This is a real, independent gap, not a hypothetical to defer on faith.** The spec's ordering
requirement currently holds only by accident (no caller has combined both yet), not by any
enforcement in the engine. It is orthogonal to the Stage 5/`adjustmentContext` decision (§6) — Stage
5 could be implemented exactly as recommended and this gap would still exist untouched.

**This is a second architectural fork of the exact same shape as C vs. C'' (§6), and it gets the same
explicit treatment, not a one-line aside.** The question is the same call-count-vs-encapsulation
tradeoff: should `buildPricingSnapshot()` enforce ordering internally, or should callers be required
to pass an already-sorted array (produced by calling `resolveModifiers()` first)? The latter is the
"controller must remember two steps" fragility C'' was specifically built to avoid — just for
modifiers instead of adjustments. So this is not a consequence of the Stage 5 decision; it is the same
decision being made a second time, on its own merits.

**Before settling which fix, the actual object shapes were traced (not assumed) — and this surfaced a
concrete blocker to the naive fix.** Checked whether `resolveModifiers()`'s `priority` field
(`coupon: 10 < referral: 20`) actually matches what real callers produce:
- `updateSubscription`'s and `initiateAddonPurchase`'s referral modifiers **do** go through
  `rewardToModifier()` (`modifierResolver.js`) and carry `priority: 20`.
- `createSubscription`'s coupon modifier is built **ad hoc, inline**
  (`subscriptionController.js:140`: `{ type: 'coupon', value: {...}, appliesTo: 'entire_invoice' }`)
  — **it carries no `priority` field at all.**

**Consequence: "just add `modifiers.sort((a,b) => a.priority - b.priority)` inside
`buildPricingSnapshot()`" would not be a safe fix as stated.** The moment a coupon and a
`rewardToModifier()`-built referral modifier land in the same array, the comparator evaluates
`undefined - 20 = NaN`; `Array.prototype.sort`'s behavior with a NaN-returning comparator is
implementation-defined, not a reliable ordering guarantee. A shape reconciliation is required, not
just a sort call.

**Resolution: `buildPricingSnapshot()` derives priority internally from `type`, never trusts a
caller-supplied `.priority` field at all.** This is the more robust version of the "engine owns it"
fork — it doesn't just move the sort inside the engine, it removes the engine's dependency on callers
correctly attaching metadata in the first place (the same class of fragility as trusting call order,
just at the field level instead of the call-sequence level):
```
// inside pricingEngine.js, not modifierResolver.js — the engine owns this, not the resolver
const STAGE_PRIORITY = { coupon: 6, referral: 7 }; // named after Chapter 3.3's actual stage numbers
allModifiers.sort((a, b) => (STAGE_PRIORITY[a.type] ?? 99) - (STAGE_PRIORITY[b.type] ?? 99));
```
This makes `resolveModifiers()`'s own `.sort()` redundant for ordering purposes (harmless to leave, since
it becomes a no-op once the engine re-sorts, but its real remaining job — DB resolution/lookup — is
unaffected and still worth keeping wired up as the standard way callers obtain modifiers). It also
means every ad hoc inline modifier object (like `createSubscription`'s coupon literal) is sorted
correctly with zero changes required at the call site — consistent with C''s principle that the
engine should not require callers to get metadata right, only to supply the right *type* of input.

### 7.5 — Net effect on the recommendation

§6's Option C'' still stands as the recommended shape for Stage 5. What changes is the *implementation
detail* in §5/§6's step 2, corrected above (7.2) — the adjustment must reach `buildPricingSnapshot()`
via `basePriceOverride`, not via a separate line-item splice that Stage 6/7 would never actually read.
Steps 1, 3, and 4 from §5, and the rest of §6's reasoning, are unaffected. **Phase 3's scope now also
includes 7.4's ordering-enforcement item**, tracked separately from Stage 5 since it's a distinct
defect with its own fix, not a consequence of the Stage 5 decision. This note is now verified against
real code on every item raised across this review.

**Classification, for the record — not every item found here is the same kind of finding:**

| # | Finding | Type |
|---|---|---|
| 1 | Stage 5 sits entirely outside `calculateInvoice()` — upgrade/add-on flows use separate proration utilities instead of the Chapter 3.3 pipeline (§Part 3 top note) | Implementation gap → Phase 3 item 5a |
| 2 | Stage 5's inputs (`old state, new state, time`) genuinely differ in shape from every other stage's (§2) | Architecture/design finding, not itself a defect |
| 3 | The correct integration seam is `buildPricingSnapshot()`'s `subtotal`/`basePriceOverride`, not a post-hoc `lines[]` splice (§7.1–7.2) | Implementation correction to the design, not a new gap |
| 4 | Modifier ordering isn't enforced by the engine; `resolveModifiers()` exists correctly but is dead code (§7.4) | Implementation gap → Phase 3 item 5b |
| 5 | The naive "sort by `.priority`" fix for #4 would itself have been wrong, since real modifier shapes are inconsistent (§7.4) | Implementation correction to 5b's fix, not a sixth gap |

**Billing-cycle-change (§7.3) is deliberately not listed above as a gap.** What was found there is that
today's billing-cycle change is always scheduled, and therefore correctly does not participate in
Stage 5 today — a scope clarification (confirming the invariant doesn't apply here, not yet), not a
defect requiring a fix. Only a future decision to make billing-cycle changes immediate would revisit
that. Counting it alongside 1–5 would conflate "investigated and found not applicable" with
"investigated and found broken," which are different outcomes and shouldn't be scored the same way.

---

## 7.6 — Correction: §5/§7.2's own sketches modeled the adjustment sign wrong (implemented, then fixed)

**This was baked into this note's own written reasoning, not introduced fresh by implementation —
found by grepping this file for the subtraction, not by memory.** §5 step 1's framing (and this
document's own §1 opening reference to §3.3's `Unused Starter Plan Credit −₹125` worked example)
led §7.2's "corrected" implementation sketch to write:
```
effectiveBase = pricePerUser + seatPrice − (adjustmentContext ? calculateCommercialAdjustments(adjustmentContext).amount : 0)
```
i.e., treating the Stage 5 amount as a **credit subtracted from a separately-itemized full price** —
exactly §3.3's worked example's framing. When actually implemented and equivalence-tested against
today's live computation, this produced a **negative invoice total** on the first test run.

**Root cause:** `calculatePlanUpgradeProration()`/`calculateAddonProration()` do not compute a
"credit for unused old value" the way §3.3's worked example frames Stage 5 — they compute a **net
positive amount already owed right now** (the customer paying more for a better plan, or for more
add-on units), time-weighted by the remaining cycle fraction. Today's code already nets the "full new
charge minus old-value credit" concept from the spec's worked example down into one delta; it was
never two itemized lines to begin with. Subtracting that already-net positive delta from a base of
`pricePerUser` (typically `0` for these one-time-charge calls, since there's no separately-billed
recurring line in the same invoice) produces a negative number — the bug, exactly as it appeared.

**Fix, implemented and re-verified:** the amount is **added** to `basePriceOverride`, not subtracted,
and the display line is shown positive, not negated. Re-running the equivalence test after this fix
produced exact matches (§7.7). This note's §5/§7.2 sketches above are left as originally written, per
this document's own supersede-in-place discipline — this section is the correction, not a silent edit
to the earlier text.

**Why this matters beyond "a bug got fixed":** it confirms §3.3's worked-example framing
("Commercial Total → Unused Credit → Subtotal") describes a *different, more decomposed* invoice shape
than what today's actual proration functions compute. Today's functions produce one net delta, not a
separate full-new-plan line plus a separate credit line. This note's Stage 5 implementation matches
today's *actual* commercial reality (one net adjustment), not §3.3's fully-itemized worked example —
worth flagging as a residual, unresolved gap between the spec's illustrative example and the
implementation, not something this note claims to have fully reconciled.

## 7.7 — Direct answers to open verification questions (not restated confidence, actual traces)

**What did the equivalence test's "old computation" baseline actually consist of?** It re-ran
`calculatePlanUpgradeProration()`/`calculateAddonProration()` and `computeGST()`/`applyModifiers()` —
the exact same functions the live controllers call today — as its own oracle, then compared their
output to the new `calculateInvoice()` path calling the same underlying functions internally. **This
proves the new path is arithmetically equivalent to the old path. It does not independently verify
that the old path was correct** — it cannot, by construction, since both sides of the comparison
ultimately call the same proration functions. This migration's own premise (BUG-022, the GST
18-paise-discrepancy finding) is that scattered manual computation had real bugs; "equivalent to the
old path" and "correct" are different claims, and only the first was tested here. **No real
historical transaction data was used** — the production database has exactly one `Subscription`
document total (confirmed during the Phase 1 BUG-002 duplicate-check), so no historical upgrade/
add-on transaction exists to validate against even if this were attempted. Independent correctness
(vs. mere equivalence) remains unverified and should not be assumed from "the equivalence test
passed."

**Rounding-boundary behavior — now actually tested, not argued from likelihood.** Four fixtures were
constructed specifically to be boundary-prone (odd/prime prices, period splits chosen so the
pre-rounding proration factor lands near `.5`, and a 33% referral modifier — a percentage chosen for
its own rounding sensitivity — applied on top of each). Compared old-path vs. new-path output for
both the no-modifier and with-modifier case on every fixture: **all eight comparisons matched exactly**
(`upgrade A`: 177/177, 118/118; `B`: 289/289, 194/194; `C`: 2/2, 1/1; `D`: 549/549, 368/368).

**Why this isn't a coincidence of the specific values tried — the structural reason:**
`resolveModifierAmount()` (`pricingEngine.js`) is the **one shared function** both today's
`applyModifiers()` and the new path's internal `buildPricingSnapshot()` modifier loop call — not two
independent implementations that happen to round the same way. Likewise, `computeGST()` is called
identically in both paths, on the identical already-rounded integer, in the same position in the
sequence. For the specific flows tested (upgrade/add-on proration with zero or one modifier), the two
paths are not merely empirically equivalent — they are the same function calls in the same order,
which makes divergence structurally impossible, not just untriggered by the fixtures tried. This is a
stronger guarantee than "the boundary tests passed" alone would provide, and it's stated as such
rather than left implicit.

**The third caller (`authController.js`'s seat-purchase endpoint) — precise status, not summarized.**
It was **not** run through the equivalence test, because it doesn't call `calculateInvoice()` at all —
it was never migrated, only protected from an unrelated change (the `prorationMath.js` extraction).
"Fully protected" meant: confirmed the re-exported `calculateAddonProration()` from
`addonManagement.js` resolves to the identical function in `prorationMath.js` and returns the same
value it always did (verified with a real call, `dotenv` loaded). It is accurate to say this caller's
behavior is **unchanged**, but that is because it was **untouched**, not because it was
**behaviorally re-verified against a new path** — those are different claims and the earlier summary
should have said "untouched, confirmed unchanged" rather than "fully protected," which implied more
scrutiny than was actually applied.
