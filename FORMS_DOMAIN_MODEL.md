# Forms — Domain Model

Status: **FROZEN, except for issues discovered during schema design that force a genuine entity-boundary change.** Entity boundaries, responsibilities, and the resolved decisions below (§4 aggregate root, §5a canonical layout, §5b field-ID references, §5c field-metadata snapshotting) are settled. The next step (Mongoose collection/index/relationship design) should flag domain-model inconsistencies it discovers rather than silently revising this document.

Purpose: answer "what is a Form, as a business object" before anything gets translated into collections. Mongo-shaped thinking (embedding vs referencing, index design) is deliberately deferred to the next step.

---

## 1. What is a Form?

Not one thing — the word "Form" is being asked to carry four different responsibilities in the discussion so far, and conflating them is exactly what would produce an overloaded schema. Separating them:

- **A Form Definition** — the reusable *design*: which fields, in what layout, with what theme and tools. This is what the builder edits. It has no opinion about whether it's live, and no memory of who submitted anything.
- **A Form Version** — an immutable snapshot of a Form Definition's structure, taken at the moment of publish. Exists because a submission six months from now needs to be interpretable against "the form as it was," not "the form as it is today."
- **A Published Form** — the fact that a specific Version is currently the one live at a public URL, and the operational settings around that (duplicate strategy, notifications, thank-you behavior). This is a *state*, not a document with its own rich content — it's closer to a pointer + settings than a thing with a lifecycle of its own.
- **A Form Submission** — a single visitor's response, forever bound to the Version that produced it, independent of what happens to the Form Definition afterward.

So: **"Form" is not a document, it's an aggregate name for a family of related concepts.** The question the architecture doc needs to answer is which of these is the *aggregate root* (the thing that owns identity and that other things reference), and the answer is **not obviously "Form."**

## 2. Entities and their responsibilities

```
Organization
     │
     ▼
FormDefinition ──────────────┐
     │                       │
     │ (has many)            │ (has one active, embedded)
     ▼                       ▼
FormVersion              publishState (subdocument, not a collection — see §2)
     │                       │
     │ (referenced by)       │ (points to one FormVersion)
     ▼                       │
FormSubmission ◄─────────────┘
     │
     ├──(has many, append-only)──▶ SubmissionEvent
     │
     │ (may produce)
     ▼
DuplicateReview
```

### FormDefinition
**Responsibility**: identity, ownership, and the *current, editable* draft state of a form. This is what appears in the Settings "Forms" list, what the builder opens, what has a title.

**Explicit statement, since it's easy to leave implicit and confuse a future reader**: **FormDefinition *is* the working copy.** There is no separate "Draft" entity. If a user edits a published form and never republishes — browser crash, walks away, whatever — that in-progress edit lives directly on FormDefinition's own fields, distinct from (and untouched by) whatever FormVersion is currently live via FormPublishState. This is *why* FormVersion has to be a separate immutable snapshot rather than "the current state of FormDefinition" — the draft is allowed to be in a half-edited, structurally-invalid-for-publishing state at any time, while the live FormVersion a public visitor hits must always be exactly what was last deliberately published. One entity can't safely be both.
**Owns**: title, module (Contact/Company/Vendor), organization, owner/creator, current draft structure (layout/theme/tools — whatever the builder is actively editing right now, pre-publish), a **reachability status** (`draft` | `published` | `paused` | `archived`), and a **separate, independent flag for whether the current draft differs from what's live** (added during schema design — see amendment note below; the domain model as originally written under-specified this and a first schema-design pass produced a real contradiction as a result).
**Does not own**: submission data, published-URL mechanics, historical structure. Those belong to other entities so that editing a draft doesn't touch anything that a live submission depends on.
**Lifecycle**: created empty (or from a "New Form" action) → edited freely, reachability status `draft` (nothing live yet) → transitions to `published` (which mints/updates a FormVersion and a FormPublishState) → **can continue being edited while still `published`** — the draft-divergence flag turns on, reachability status stays `published`, the previous FormVersion keeps serving visitors untouched — → publishing again clears the divergence flag (reuses or mints a new FormVersion per the schemaHash comparison) → `paused` (temporarily unreachable, structure intact, divergence flag unaffected) ⇄ `published` → any reachable-or-paused state `→ archived` (retired, keeps history).

**Amendment note (schema-design-forced, per this document's own frozen-except-for-genuine-entity-boundary-problems exception)**: the original text above ("can return to `draft`-with-unpublished-changes while a *previous* Version stays live") used the word `draft` ambiguously — as both the reachability status and as shorthand for "has in-progress edits." Mongoose schema design (FORMS_SCHEMA.md) surfaced that these are two different facts that must be independently representable (a form can be `published`-and-reachable while *also* having in-progress edits — it cannot become reachability-status `draft` again without going offline, which was never the intent). Resolved by splitting into `status` (reachability) and a separate boolean (draft-divergence), documented fully in FORMS_SCHEMA.md §1/§2. This was the first entity-boundary amendment made since freezing; a second (per-field `targetModule` routing on FormVersion) follows under the FormVersion entity below.
**Deletion rule**: soft-delete only (`archived`), never hard-delete, because FormSubmissions and DuplicateReviews reference it transitively through FormVersion and must remain interpretable. A hard "delete forever" action, if ever offered, would need to first confirm zero submissions exist or explicitly orphan them with a warning — out of scope to design now, flagged as a future decision.

### FormVersion
**Responsibility**: an immutable structural snapshot — exactly the layout/fields/validation rules that were live at a point in time. This is the thing a FormSubmission actually needs to be interpretable against.

**The governing test for every field in this entity: "does changing this alter the meaning of an old submission?"** If no, it does not belong here, full stop — even if it feels structurally related. Applying that test explicitly, since the earlier draft of this document under-specified it and risked snapshotting more than necessary:

- **Belongs**: field list, field types, required-ness, validation rules (min/max/regex/date-restrictions), section/element ordering and structural layout (headings/dividers/etc. as they affect what was asked and in what order) — anything that changes what data a submission could have contained or what was demanded of the visitor.
- **Does not belong, explicitly ruled out**: logo, theme, button color, border radius, animation, fonts, background (pure presentation — already excluded via §3, restated here for emphasis), notifications/emails/duplicate strategy/owner (operational, lives in FormPublishState — none of these change what a past submission *means*), captcha config, privacy-policy checkbox wording (spam/compliance tooling, not data-shape — a captcha requirement being added later doesn't retroactively change what an old submission's data represents).

**Owns**: a frozen copy of layout restricted to the "belongs" list above, a version number, a timestamp, which FormDefinition it belongs to, and a **`schemaHash`** — a deterministic hash (e.g. SHA-256) of the canonical layout JSON. Justification: without it, answering "did the structure actually change since the last publish" (needed by §5's "don't churn version numbers on a no-op republish" rule) means deep-comparing two full layout trees field-by-field. A hash reduces that to one string comparison. This isn't a query-optimization nicety, it's what makes the "only version-bump on real structural change" rule cheap enough to enforce on every publish.
**Does not own**: theme/styling (see §3 on why theme is excluded), tools config, publishing settings (owner, notifications, duplicate strategy) — those can change without invalidating what a past submission means, so they don't belong in the thing that exists specifically to preserve meaning.
**Lifecycle**: created once, at publish time, from the FormDefinition's current draft structure. **Never mutated after creation.** A subsequent publish of structural changes creates a *new* FormVersion, not an edit to the old one.
**Deletion rule**: never deleted while any FormSubmission references it. This is the actual justification for why versions must be immutable and separately addressable — it's not bureaucracy, it's the only way "what did this submission actually ask for" stays answerable.

**Amendment note (schema-design-forced, second entity-boundary amendment since freezing)**: the original "belongs" list above enumerated *what a field asked* (type, required-ness, validation, ordering) but assumed every field on a form routed into that form's single `module`. Implementation surfaced a real cross-module case: a Contact form may embed Company fields (e.g. capture the contact **and** their company in one submission), so *which CRM record a captured value becomes* is a per-field fact, not a per-form one. Applying this entity's own governing test — "does changing this alter the meaning of an old submission?" — routing passes decisively: flipping a field from Contact to Company changes which record the value became, so a historical submission must stay interpretable under the routing it was actually processed with. Routing (`targetModule`) is therefore **frozen on FormVersion.layout** and included in `schemaHash`; a routing change mints a new FormVersion. It is DERIVED at publish (never user-authored), defaults to the form's own module (no migration for existing single-module forms), and the only supported cross-module relationship is Contact→Company (Vendor stays isolated — deliberately not generalized). Full mechanics in FORMS_SCHEMA.md §1a/§3a and invariants #16/#17.

### FormPublishState — conceptually separate entity, embedded subdocument in practice
**Responsibility**: the live, mutable "is this form currently reachable, and how does it behave right now" state. Modeled as a **conceptually distinct entity with its own responsibility boundary**, but — resolving open question §7.2 — **not its own Mongo collection**. It has no independent identity anyone ever needs to reference by ID (nothing points at "publish-state #4123" the way FormSubmission points at a FormVersion), and it only ever has one live instance per FormDefinition. That combination (no external references, singleton-per-parent) is exactly the case where embedding is the right Mongo pattern without violating the domain boundary: the application code still treats it as a distinct responsibility (different mutation frequency/risk than structural edits), it just doesn't need a separate `_id`/collection to do that.
**Owns**: the public slug, which FormVersion is currently active, owner/notification settings, duplicate-handling strategy, thank-you behavior, tools config (captcha keys, privacy policy toggle) — i.e., everything from the original architecture doc's `Form.settings`/`Form.tools` that is genuinely about *how a live form behaves* rather than what it structurally contains.
**Does not own**: the layout itself (that's FormVersion's job) — this is the key separation the reconciliation is making versus the original single-`Form`-document design.
**Lifecycle**: created/updated when a FormDefinition is published; a slug, once minted, is stable across republishes (changing the *content* of a form shouldn't break an already-shared link) unless the user explicitly requests a new one.
**Deletion rule**: deleting/unpublishing sets the form unreachable but the record persists (submissions already collected still need their originating publish context for audit purposes — e.g. "which duplicate strategy was active when this came in").

### FormSubmission
**Responsibility**: one visitor's response, and its processing state (validated/needs-review/imported/etc.) — matches `FormResponse` in the original architecture doc, renamed here for domain clarity and to fix the earlier ambiguity between "Form" the aggregate and "FormResponse" the entity name.
**Owns**: raw input (write-once, audit-only — per the earlier "rawData immutability" refinement), **`processedData`** (renamed from the earlier "normalizedData" — type coercion is only the first of what this field will eventually hold; phone cleanup, email lowercasing, country/state inference, company-linking, and future AI enrichment are all *processing*, not merely *normalization*, and the field name should describe its role rather than its current, narrower implementation), which FormVersion it was submitted against, processing status, resulting CRM record if imported.
**Does not own**: anything about the form's current structure — deliberately decoupled, since a submission's meaning must survive the form being edited or even archived afterward.
**Lifecycle**: created on public submission → validated/coerced → optionally flagged for review (triggers a DuplicateReview) → imported (creates/links a CRM record) or rejected. Terminal states (`imported`, `rejected`) are not further mutated except for audit fields (`reviewedBy`, `reviewedAt`).
**Deletion rule**: never hard-deleted by normal product flows (it's the audit trail for how a CRM record came to exist); a data-retention/GDPR-style purge is a separate, explicit future concern, not handled by this design.

### SubmissionEvent
**Responsibility**: an append-only timeline of what happened to a FormSubmission — not just its current status, but the sequence that produced it. This entity wasn't in the original design; added because `FormSubmission.status` alone can only ever answer "what state is this in *now*," never "what actually happened" (e.g. was a duplicate detected and then overridden? did notification sending fail silently? was it auto-imported or did a human approve it?). That distinction matters the moment someone is debugging "why does this contact look wrong" months later.
**Owns**: an ordered list of `{eventType: string, occurredAt, actor (system|userId), payload: Mixed}` entries per submission. Deliberately **not** a closed enum of event types (`submission_received`, `duplicate_detected`, etc., as an earlier draft implied) — `eventType` is a free-form string and `payload` is opaque/type-specific, because the set of things that can happen to a submission will keep growing (webhook retries, automation triggers, email delivery, future AI extraction/OCR steps, Slack notifications, CRM sync) and a closed enum would mean a schema migration every time a new capability is added. The entity's job is "append an event, in order, with whatever payload that event type needs" — it doesn't need to understand or validate the payload shape itself; that's the concern of whatever code emits a given `eventType`.
**Does not own**: the submission's data itself (stays on FormSubmission) — this is purely the "what happened, in order" record, not a copy of the payload.
**Lifecycle**: append-only, one entry created per meaningful state transition. Never edited or deleted, for the same audit reason FormSubmission itself is never deleted.
**Relationship note**: could be modeled as a subdocument array embedded in FormSubmission instead of a separate collection — same embedding-vs-collection judgment call as FormPublishState. Leaning toward a **separate collection** here (unlike FormPublishState), because event volume per submission could genuinely grow (retries, multiple review actions) and because "show me all duplicate-detection events across the org this week" is a plausible cross-submission query that a separate collection serves far better than an embedded array ever could. Flagged as a decision for the schema-design step, not settled here — but the reasoning differs from FormPublishState specifically because of the *cross-entity query* need, which FormPublishState doesn't have.

### DuplicateReview
**Responsibility**: a flagged potential match between an incoming submission (or, per the shared-engine decision, any incoming record from Import/manual-create later) and an existing CRM record, plus the eventual human decision.
**Owns**: score, per-signal match details, decision, who decided, and an **`engineVersion`** — which version of the duplicate-matching logic produced this score. Justification: the matching engine (§2.4 of FORMS_ARCHITECTURE.md) is explicitly expected to evolve — better fuzzy-matching, new signals, retuned score bands. Without `engineVersion`, a review created under a since-replaced scoring approach is indistinguishable from one created under the current approach, which makes it impossible to answer "why did the engine flag this" for old reviews once the engine has moved on, or to bulk-reassess old `pending` reviews against a new engine version with any confidence about what "new" vs. "old" means.
**Lifecycle**: created by the duplicate engine at submission-processing time → `pending` until a human acts → `merged`/`kept_separate`/`linked_to_existing`, at which point the decision is remembered (per the earlier product requirement) so the same signal doesn't re-flag future submissions against the same existing record.
**Deletion rule**: never deleted — it's the record of a data-quality decision, useful for audit even after resolution.

## 3. What should never live together (the separations that matter)

- **Structure (FormVersion) must never live in the same mutable document as publish operations (FormPublishState).** If they did, changing the owner or toggling a notification setting would risk being logged against the "same document" as a structural edit, muddying what actually changed when a submission later looks broken.
- **Theme/styling must never live inside FormVersion.** A form's colors and fonts changing shouldn't create a new "version" for submission-interpretation purposes — theme is purely presentational and has zero bearing on what data a submission contains or means. It's product state hanging off FormDefinition (or FormPublishState, since a redesign is also something you'd want without disturbing draft-editing state) — **this is one of the open questions for the schema-design step**, not resolved here, but the one hard constraint is: theme must not be able to invalidate or version-bump a FormVersion.
- **Submission data must never live inside FormDefinition or FormVersion.** This was true in the original architecture doc too (`FormResponse` was already separate) — restated here because the domain-modeling pass confirms it's still correct: submissions are high-volume, append-only, and have a completely different access pattern (queried by status/date, not by "give me the form") than structural documents.
- **DuplicateReview must never be Forms-specific in its data shape**, even though only Forms populates it in phase 1 — per the earlier D6 decision (shared engine), embedding Forms-only fields into it now would make the later Import/manual-create reuse a migration instead of "just start writing to the same collection."

## 4. Is FormDefinition or FormVersion the aggregate root?

Worth answering explicitly rather than assuming. Candidates and the reasoning:

**FormDefinition as root**: everything else (FormVersion, FormPublishState, FormSubmission transitively) hangs off a `formDefinitionId`. This matches how the product is *talked about* — "the Vendor Onboarding form," singular, with history — and how the Settings list page and the builder both naturally address it ("open the form," not "open version 3 of the form").

**FormVersion as root**: would mean FormSubmission references a FormVersion directly with no need to go through FormDefinition at all, and FormDefinition becomes more of a grouping/label than a true parent.

**Decision: FormDefinition is the aggregate root.** Reasoning: the product-level operations that matter (list forms, open a form to edit, publish a form, view a form's submissions) are all naturally scoped to "the form" as a persistent identity that outlives any single version — a user thinks "show me all submissions to my Vendor Onboarding form across every time I've edited it," not "show me submissions to version 3." FormVersion is a **child entity that exists to give FormSubmission something stable to point at**, not a competing root. This mirrors a fairly standard content-versioning pattern (think: a CMS page vs. its revision history) rather than anything Forms-specific.

Practical consequence for the next design step: FormSubmission should store **both** `formDefinitionId` (for "all submissions to this form, ever" queries — the common case) **and** `formVersionId` (for "what exact structure produced this submission" — the audit/interpretation case). Storing only the version and joining through it to find the definition would make the common query one hop more expensive for no benefit; storing only the definition would lose the interpretability guarantee that's the entire reason FormVersion exists. Both references are justified, not redundant.

## 5. Ownership, versioning, publishing, deletion — consolidated rules

(Restating from above in one place since these cut across entities)

- **Ownership**: every entity in this model scopes to `organization` (directly or transitively through FormDefinition) — no exception, matching the multi-tenancy pattern already established in Phase 0's services.
- **Versioning**: only FormDefinition→FormVersion has real versioning (immutable snapshots, monotonic version number). Nothing else in this model needs independent versioning — FormPublishState and DuplicateReview are mutable-in-place with an audit trail (`updatedAt`, `decidedBy`/`decidedAt`), not versioned documents, because their history isn't something anyone needs to reconstruct field-by-field the way form structure is.
- **Publishing**: is an action on FormDefinition that has two effects — create-or-reuse a FormVersion (only creates a new one if the structure actually changed since the last publish; republishing unchanged content should not churn version numbers) and update FormPublishState to point at it. Written out explicitly rather than left implied, since this is exactly the kind of flow a future reader will otherwise have to reverse-engineer from code:

  ```
  User edits FormDefinition (draft, working copy — see FormDefinition's own section)
       │
       ▼
  User clicks Publish
       │
       ▼
  Compute schemaHash of current draft layout (§ FormVersion — restricted to the
  "belongs" fields only: field list/types/required-ness/validation/structural ordering)
       │
       ▼
  Compare against latest existing FormVersion.schemaHash for this FormDefinition
       │
       ├── Unchanged → skip creating a new FormVersion, reuse the existing one
       │
       └── Changed (or no prior version exists) → create a new FormVersion
               (immutable snapshot, incremented version number)
       │
       ▼
  Update FormPublishState.activeVersionId to point at the resulting FormVersion
  (new or reused), mint a publicSlug if this is the first publish, leave the
  slug untouched if one already exists. Set FormDefinition.status = "published"
  (if not already). Clear the draft-divergence flag (this draft now matches
  what's live).
       │
       ▼
  Done — form is live at the (possibly unchanged) public URL
  ```

  Note theme/tools/notification changes (FormPublishState-owned, not FormVersion-owned per the "belongs"/"does not belong" split above) can be saved and take effect on the live form *without* going through this publish flow at all — they're not structural, so they don't need version reconciliation. Whether the product actually exposes that as an instant-save vs. requiring an explicit "Publish" click either way is a UI decision for a later phase, not a domain-model constraint.
- **Deletion**: nothing in this model is ever hard-deleted by a normal user action. FormDefinition archives; FormPublishState unpublishes; FormVersion, FormSubmission, DuplicateReview are permanent once created. This is a deliberate, not incidental, property — it's what makes "why was this submission interpreted this way" always answerable.

## 5a. Is builder layout canonical or derived?

Explicit answer, since leaving this implicit is exactly the kind of ambiguity that produces a confused schema later: **builder layout is canonical — it is the source of truth, never regenerated from field definitions.**

Reasoning: the domain model's own layout schema (FORMS_ARCHITECTURE.md §2.2's tagged-union `Element` type — headings, paragraphs, dividers, spacers, images, submit buttons, *and* fields) already contains structural and presentational content that has no corresponding "field definition" to derive from at all. A heading isn't a field. A divider isn't a field. If layout were treated as derived/regenerable, every non-field element the builder produces would need somewhere else to live, defeating the entire point of modeling layout as a tagged union in the first place. The field *references* within that layout (`fieldKey`, `source: "system"|"custom"`) do resolve live against the current field definitions for rendering purposes (per FORMS_ARCHITECTURE.md §2.7 — "resolves each fieldKey against the current field definitions live"), but that's resolving a *pointer*, not regenerating the *layout structure itself*. The distinction: field *existence/type/required-ness* is looked up live; field *placement, ordering, and surrounding non-field content* is 100% canonical builder output, stored as-is, never synthesized.

Practical consequence: deleting a custom field definition in Settings (Open Decision D4) doesn't mean "regenerate this form's layout without it" — it means the canonical layout now contains a dangling reference, which is exactly why D4 has to be an explicit product decision (block deletion vs. auto-remove-and-flag) rather than something that resolves itself automatically. If layout were derived, D4 wouldn't need to exist as a decision at all — another point in favor of canonical being the correct answer.

## 5b. Field references: by ID, not by key

This wasn't addressed in the original design and is a real scalability gap worth closing now, before any schema is implemented, since retrofitting it later means migrating every stored layout.

**The problem**: layout elements reference fields via a name-like `fieldKey` (per FORMS_ARCHITECTURE.md §2.2/§2.7 — `fieldKey`, resolved live against current field definitions). Custom field *names* are user-editable (Settings → Company/Contact/Vendor Fields lets a user rename a field, e.g. `industry` → `industry_type`). If layout stores the name itself, a rename silently breaks every form referencing that field — the builder shows a dangling reference not because the field was deleted (which Open Decision D4 already accounts for) but because it was merely renamed, which is a much more common, much less deliberate action than deletion.

**Decision: layout elements must reference fields by a stable identifier (`fieldId` — the field definition's own database ID), never by name/key.** The renderer resolves current display metadata (label, type, options, required-ness) by looking up that ID against the live field definition at render time — this is the same "resolve a pointer live" pattern already established in §2.7 and reaffirmed in §5a's canonical-vs-derived discussion, just keyed correctly. A rename in Settings then just works: every form referencing that field's ID immediately reflects the new label with zero migration, because nothing about the reference itself needed to change.

**Consequence for the existing system-field case**: today's system fields (Company Name, Industry, Website, etc.) aren't stored as documents with their own `_id` the way custom fields are — they're a hardcoded list per module. For `fieldId` to work uniformly, system fields need *some* stable identifier too, even if it's a fixed string constant (e.g. `"system:company.name"`) rather than a Mongo ObjectId — the requirement is stability under rename, not that every ID be database-generated. This is a real design detail for the schema-design step (do system fields get synthetic stable IDs, and where is that mapping maintained), not resolved here, but flagged so it isn't missed: **"reference by ID" must apply uniformly to both system and custom fields, or renaming a custom field is safe while some other future system-field label change isn't** — an inconsistency worth avoiding from day one rather than patching in later.

## 5c. Field snapshots: FormVersion resolves live metadata, or freezes its own copy?

Direct consequence of §5b's `fieldId` decision that needs its own answer, because "reference by stable ID" only solves *which* field is being referenced — it doesn't say whether the *metadata* of that field (label, type, options) is read live or frozen at publish time. Those are genuinely different failure modes:

- **Resolve live** (look up the current field definition by `fieldId` every time a FormVersion is rendered/interpreted): a field's label/options edited after publish retroactively changes how *every past version* displays — including versions belonging to old, already-submitted data. Concretely: a dropdown option gets renamed from "Manufacturing" to "Industrial," and now a six-month-old FormVersion (and the submissions interpreted against it) silently shows a value that was never actually one of the options presented to that visitor at submission time. That breaks the entire premise of FormVersion existing — "interpretable against what was actually asked" stops being true.
- **Snapshot metadata into FormVersion at publish time** (freeze label/type/options/required-ness as they were, not just the `fieldId` pointer): a FormVersion becomes fully self-contained and genuinely immutable — exactly the property §FormVersion's lifecycle already claims ("never mutated after creation"), which the live-resolve approach would silently violate in spirit even though no write touches the FormVersion document itself.

**Decision: FormVersion snapshots field metadata at publish time; it does not resolve live.** This is the only choice consistent with FormVersion's own stated immutability guarantee — "never mutated after creation" has to mean *effectively* never mutated, not just "no write operation touches this specific document," or the guarantee is hollow. `fieldId` is still stored (needed for other purposes — e.g. linking a submission's answer back to the current field for CRM-record creation, and for the builder to show "this field was later deleted/renamed" indicators), but the label/type/options/required-ness used to *render and validate* against that historical version are the frozen copy, not a live lookup.

This resolves cleanly with §5a's canonical-layout decision and §5b's ID-reference decision rather than conflicting with them: layout *structure* (which elements, in what order) is canonical builder output; field *identity* is referenced by stable ID (survives rename without a migration); field *metadata as it existed at that moment* is snapshotted (preserves true immutability). Three distinct concerns, three distinct answers, no contradiction.

## 6. Future extensibility check

Confirming this shape doesn't box in the roadmap items from FORMS_ARCHITECTURE.md §2.10:

- **Deal/Pipeline forms**: additive — `FormDefinition.module` gains an enum case, nothing else in this model changes shape.
- **Workflow automation / webhooks**: hook off `FormSubmission` reaching `imported`, same as originally designed — this model doesn't change that.
- **Analytics** (views, drop-off): would be a new entity (`FormView` or similar), sibling to FormSubmission, not something that needs to be retrofitted into any entity here. Note this is a distinct concept from `SubmissionEvent` — SubmissionEvent tracks what happened to a submission that *occurred*; a future `FormView` would track visits that never became submissions at all (drop-off analysis specifically needs the non-converting traffic, which SubmissionEvent structurally can't represent since it only exists once a FormSubmission does).
- **A/B testing multiple themes on one form** (not currently planned, but worth checking the model doesn't accidentally prevent it): possible later precisely *because* theme was kept out of FormVersion in §3 — a future "theme variant" concept could hang off FormPublishState without touching structural versioning at all.

---

## 7. Open questions for the next step (schema design)

Two of the original three questions are resolved above; restated here with status:

1. **Resolved (§5a alongside it)**: theme lives on FormDefinition, not FormPublishState or FormVersion — a theme edit while in draft shouldn't require "publishing" to preview, and theme has no interpretability requirement the way structure does.
2. **Resolved (§ FormPublishState)**: embedded subdocument on FormDefinition, not a separate collection — no external references to it, singleton-per-parent.
3. **Still open**: exact shape of "structure changed enough to warrant a new FormVersion." The `schemaHash` addition (§ FormVersion) makes *detecting* a change cheap, but doesn't answer *what counts* — e.g. does a help-text edit bump the version, or only field add/remove/required-change? Given §FormVersion's "belongs"/"does not belong" test, help-text likely *does* count (it's part of what was demanded of the visitor), but the precise line needs a concrete rule before implementation, not just the general principle.
4. **Still open**: separate collection vs. embedded array on FormSubmission for SubmissionEvent — leaning separate collection (reasoning in the entity's own section above), but not settled.
5. **New, from §5b**: how system fields (which aren't documents with their own `_id` today) get a stable ID-equivalent so `fieldId`-based references work uniformly across system and custom fields. Needs a concrete answer (synthetic constant IDs? a lightweight registry?) before the layout schema can be finalized.

---

*Next step once reviewed: translate this into the actual Mongoose collection design (which of §7's embedding questions get resolved, exact field lists with justifications per the "why does this field exist" standard), replacing the schema in FORMS_ARCHITECTURE.md §2.2.*
