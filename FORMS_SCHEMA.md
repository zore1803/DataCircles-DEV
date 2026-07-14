# Forms — Mongoose Collection Design

Status: **Design only. No code written yet.** Translates the frozen FORMS_DOMAIN_MODEL.md into concrete MongoDB collections, indexes, relationships, and constraints. Deliberately stops at persistence — no controllers, no API routes, no frontend. That's the next phase.

Every field below answers: **(1) why does it exist, (2) who writes it, (3) who reads it, (4) what breaks if removed.** A field that can't answer all four isn't included. Domain-model boundaries (FORMS_DOMAIN_MODEL.md) are treated as settled; any inconsistency found here is flagged explicitly, not silently patched.

---

## Collections overview

| Collection | Domain entity | Mutability |
|---|---|---|
| `FormDefinition` | FormDefinition (+ embedded publishState) | Mutable (draft edits, publish state changes) |
| `FormVersion` | FormVersion | `layout`/`schemaHash` immutable after creation; `resolvedFields` may be refreshed in place on a non-structural republish (§3a) |
| `FormSubmission` | FormSubmission | Mostly immutable; status/review fields update |
| `SubmissionEvent` | SubmissionEvent | Append-only, never updated |
| `DuplicateReview` | DuplicateReview | Mutable until `decision` set, then effectively frozen |

`FormPublishState` is **not** a separate collection — embedded subdocument on `FormDefinition`, per the domain model's resolved decision (§ FormPublishState / §7.2).

---

## 1. `FormDefinition`

```js
{
  _id,
  organization,        // ObjectId ref Organization
  module,               // enum: "Contact" | "Company" | "Vendor"
  title,                 // String
  status,                 // enum: "draft" | "published" | "paused" | "archived" — REACHABILITY
                            // only (does the public route resolve). See §2 for why this is
                            // distinct from hasUnpublishedChanges below.
  hasUnpublishedChanges,    // Boolean — is `layout` currently different from the FormVersion
                             // pointed to by publishState.activeFormVersionId. Independent of
                             // `status` — see §2.

  layout: [Section],       // canonical builder output — see §1a

  theme: { ... },            // presentation-only — see §1b

  publishState: {              // embedded, see §2 for full shape (lifecycle status lives on
                                 // the parent `status` field above, not duplicated here)
    publicSlug, activeFormVersionId, ...
  },

  createdBy,                    // ObjectId ref User
  updatedBy,                     // ObjectId ref User
  createdAt, updatedAt            // Mongoose timestamps
}
```

| Field | Why it exists | Who writes | Who reads | What breaks if removed |
|---|---|---|---|---|
| `organization` | Tenant isolation — every query in this app scopes by org (established pattern, Phase 0 services). | Set once at creation, never changed. | Every list/read query; access-control check on every mutation. | Cross-tenant data leakage — a form from Org A becomes visible/editable by Org B. |
| `module` | Determines which field-definition collection (`ContactFields`/`CompanyFields`/`VendorFields`) and which creation service (`contactService`/`companyService`/`vendorService`) this form's layout resolves against and submits into. | Set at creation, immutable after (changing module would invalidate every `fieldId` reference in the layout — see §1a). | Builder (which field picker to show), submission pipeline (which service to call), Settings list page (grouping). | Submission pipeline has no way to know which CRM entity type to create; builder can't offer a field list. |
| `title` | Human identity — what a user recognizes in the Forms list, what appears as the page `<title>`/heading on the public form. | User, via builder. | Forms list page, builder header, public form header. | Forms become unidentifiable in a list of more than one. |
| `status` | **Reachability only** — `draft` (never yet published, no `FormVersion` exists) / `published` (a `FormVersion` is currently live at the public URL) / `paused` (was live, temporarily taken offline, structure/version untouched) / `archived` (retired). Deliberately does **not** encode whether the current in-progress edits differ from what's live — that's `hasUnpublishedChanges`. Splitting these two facts fixes a real contradiction the previous single-status draft had with the domain model: FORMS_DOMAIN_MODEL.md's own `FormDefinition` lifecycle explicitly requires "return to draft-with-unpublished-changes while a *previous* Version stays live" — a state where the form is simultaneously still publicly reachable AND has in-progress edits. A single mutually-exclusive `draft\|published\|...` enum cannot represent that (an earlier pass of this schema incorrectly collapsed it to one field). With the split, that exact state is `{status: "published", hasUnpublishedChanges: true}` — publicly live, being actively edited, both true at once. | `status`: publish/pause/resume/archive actions only — **never** touched by ordinary draft-layout saves. `hasUnpublishedChanges`: set `true` by every draft-layout save; set back to `false` by the publish action once it mints/reuses a `FormVersion` matching the current layout. | Public form route (`status === "published"` required to serve — still a single, unambiguous reachability check, unaffected by draft edits in progress), Forms list page (status badge + a separate "unpublished changes" indicator sourced from `hasUnpublishedChanges`), Builder ("Publish" button enabled/highlighted state). | Without `status`: can't distinguish reachable from unreachable at all. Without `hasUnpublishedChanges`: no way to tell a user "you have edits that aren't live yet" — falls back to either always-safe-but-annoying (assume unpublished changes exist, prompt to publish constantly) or unsafe (assume none, silently let edits sit unpublished indefinitely with no visual cue). |
| `layout` | The canonical, editable working copy — per FORMS_DOMAIN_MODEL.md's explicit "FormDefinition *is* the working copy" statement. Structure: see §1a. | Builder, on every save — **and every such save also sets `hasUnpublishedChanges = true`** if `status === "published"` or `"paused"` (there's already a live version this edit now differs from). | Builder (to render itself), publish action (source for the next FormVersion snapshot). | No domain model concept currently holds "and this is where in-progress edits live" — this *is* that place; removing it collapses the draft/version distinction the whole model is built around. |
| `theme` | Presentation-only settings (see §1b) — deliberately excluded from FormVersion per the domain model's "does this alter the meaning of an old submission" test. | Builder. | Public form renderer, builder preview. | Theme changes would have nowhere to live except FormVersion, forcing a version-bump on every color change — exactly what the domain model rules out. |
| `publishState` | Embedded operational state — see §2. | Publish action, settings-panel edits (owner/notifications/duplicate-strategy) that don't require full republish. | Public form route (resolve org+version from slug), submission pipeline (duplicate strategy, notify settings). | No way to know which FormVersion is currently live, or where the public URL even is. |
| `createdBy` / `updatedBy` | Audit trail — who made/last touched this form, distinct from `organization` (which org) and distinct from `publishState.owner` (who the form is assigned to for notifications, a product concept, not an audit one). | Set on create / every save. | Forms list page ("created by"), audit/debugging. | No accountability trail for who built or last changed a form — minor but real gap for a multi-user org. |

### 1a. `layout` — Section/Element shape

```js
layout: [
  {
    id,           // String, stable within this FormDefinition (not a Mongo _id — see note)
    title,          // String, section heading
    description,     // String, optional section subtext
    order,             // Number
    elements: [
      // Tagged union, discriminated by `type`
      { id, type: "field", order, fieldId, source: "system" | "custom",
        targetModule,  // DERIVED at publish, never user-editable — see note below and §3a
        required, helpText, defaultValue, validationOverrides },
      { id, type: "heading", order, text },
      { id, type: "paragraph", order, text },
      { id, type: "divider", order },
      { id, type: "spacer", order, height },
      { id, type: "image", order, url, alt },
      { id, type: "submitButton", order, label, color, position, style }
    ]
  }
]
```

**Note on `id` fields within layout**: these are client-generated stable strings (e.g. UUIDs), not Mongo `_id`s — because layout is a nested structure inside a parent document, not a separate collection, and the builder needs stable identifiers for drag-reorder operations before anything is ever persisted. **`fieldId`** (on `type: "field"` elements) is the one exception — it references either a real custom-field-definition `_id` (`CompanyFields`/`ContactFields`/`VendorFields` sub-document) or a synthetic stable string for system fields (see §1c) — per the domain model's §5b decision.

| Field | Why | Who writes | Who reads | What breaks if removed |
|---|---|---|---|---|
| `fieldId` (not `fieldKey`) | §5b of the domain model: field names are user-editable in Settings; referencing by name breaks on rename. | Builder, when a field is dragged onto the canvas. | Renderer (resolve current label/type live for the *draft* — snapshotting only happens at publish, per §5c), publish action (source for FormVersion's frozen copy). | A field rename in Settings would silently orphan every form referencing it by name — the exact failure mode §5b exists to prevent. |
| `source: "system"\|"custom"` | System fields (Company Name, Industry, etc.) aren't documents in a `*Fields` collection — the renderer needs to know which lookup path to use for `fieldId`. | Builder, when the field is added (determined by which panel — Fields vs. System — it was dragged from). | Renderer, publish snapshot logic. | Ambiguous whether to look up `fieldId` against a `*Fields` collection or the hardcoded system-field registry (§1c). |
| `required`, `helpText`, `defaultValue`, `validationOverrides` | Per-form overrides layered on top of the field definition's own base settings (e.g. a field optional everywhere else can be made required on *this* form). | Builder, via the field's Properties panel. | Renderer, validation logic at submission time. | Every form referencing a shared field would be forced to use identical validation/required-ness — defeats the entire point of per-form customization the product discussion asked for. |
| `targetModule` | The CRM module this field's value routes into. A Contact form may embed Company fields (the only supported cross-module relationship — Contact→Company); without per-element routing, submission processing cannot know a `system:company.*` field belongs in the Company payload, not the Contact one. | **Not the builder — DERIVED.** Computed at publish time by `resolveLayoutTargetModules` from the field's owning module (system-field ID prefix; custom fields → the form's own module). Never user-editable. | Submission processing (`buildCrmPayloads` routes each value into `payloads[targetModule]`); `computeSchemaHash` (routing is structural — §3a). | A Contact form with embedded Company fields would merge everything into one payload validated against a single module — the exact architectural gap this field closes. See invariant #17. |

**Note on `targetModule` derivation and defaults**: `targetModule` is never present on the working-copy draft the builder saves — it is materialized only onto the frozen FormVersion layout at publish. It defaults to the form's own module (`form.module`), so existing single-module forms need no migration and produce an unchanged routing. The only value that ever differs from `form.module` is a `system:company.*` field inside a `Contact` form (→ `Company`); any other foreign module fails publication (`deriveTargetModule` throws — Vendor is fully isolated, DO NOT GENERALIZE).

### 1b. `theme` shape (kept intentionally shallow)

```js
theme: {
  logoUrl, backgroundColor, backgroundImageUrl,
  fontFamily, buttonColor, buttonPosition, buttonStyle,
  formAlignment: "top" | "left" | "right" | "center"
}
```

No per-field justification table here — every one of these exists for exactly one reason (visual presentation of the public form) and is read by exactly one thing (the renderer, for both builder-preview and public-form contexts). Listed together rather than field-by-field to avoid the "150-field schema" bloat risk flagged earlier; if this section starts accumulating fields that need individual justification, that's the signal it's grown beyond "pure presentation" and something has leaked in that belongs elsewhere.

### 1c. System field stable-ID registry — resolves domain-model open question #5

Per FORMS_DOMAIN_MODEL.md §5b's flagged gap: system fields need a stable-ID equivalent. Resolution: a small hardcoded constant map per module, colocated with each module's existing hardcoded system-field list (wherever that already lives, e.g. alongside `CompanyFields`/`ContactFields`/`VendorFields` controllers), of the form:

```js
// Not a Mongo collection — a static, versioned-in-code constant.
SYSTEM_FIELD_IDS.company = {
  name: "system:company.name",
  industry: "system:company.industry",
  gstin: "system:company.gstin",
  // ...
}
```

**Why a code constant instead of a collection**: system fields aren't user-creatable/deletable, so there's no CRUD reason to store them as documents — a collection would exist purely to hold IDs that never change, which is a persistence layer solving a problem code already solves for free. The `"system:"` prefix makes the two ID spaces (system vs. custom-field-ObjectId) trivially distinguishable at lookup time without a separate `source` field being load-bearing (kept anyway in §1a for readability/query-filtering convenience, not because it's strictly required to disambiguate).

**Risk flagged, not resolved here**: if a system field is ever renamed *in code* (e.g. the constant string itself changes), that has the exact same rename-breaks-references problem §5b was designed to prevent — the constant strings, once shipped, must be treated as append-only/permanent, same discipline as a public API contract.

---

## 2. `FormPublishState` (embedded subdocument on `FormDefinition.publishState`)

```js
publishState: {
  publicSlug,                 // String, unique, indexed — see constraints
  activeFormVersionId,          // ObjectId ref FormVersion, required once status has ever been "published"
  owner,                          // ObjectId ref User
  notifyOwnerOnSubmit,               // Boolean
  duplicateStrategy,                    // enum: "review_queue" | "allow_duplicates" — TWO values, not
                                          // three. Per FORMS_ARCHITECTURE.md D9 (revised after product
                                          // clarification): the system never auto-resolves a duplicate at
                                          // any confidence score — it only flags a possible match and lets
                                          // a human choose Keep Both or Keep Existing. There is no
                                          // "auto_attach_existing"/"auto_merge_high_confidence" value —
                                          // both were removed; no strategy value ever causes automatic
                                          // resolution, because that behavior doesn't exist in this product.
  tools: { captchaEnabled, captchaSiteKey, captchaSecretKeyRef, privacyPolicyEnabled, privacyPolicyUrl },
  thankYou: { type: "message" | "redirect", message, redirectUrl },
  publishedAt                            // Date
}
```

**Lifecycle reachability lives on `FormDefinition.status`; whether the draft has diverged from what's live lives on `FormDefinition.hasUnpublishedChanges`.** The earlier draft had both `FormDefinition.status` (`draft|published|archived`) *and* `publishState.isPublished`, which review feedback correctly flagged as two representations of one state machine that could silently diverge. That was resolved by merging into a single `status` field — but doing so surfaced a *second*, more fundamental problem: a single reachability enum cannot also represent "is currently being edited with changes not yet live," which the domain model explicitly requires as an independent, simultaneously-true fact. Fixed by keeping `status` as reachability-only and adding `hasUnpublishedChanges` as a second, orthogonal field (defined on `FormDefinition` itself, not here — see §1) — not a reversion to the original two-boolean mistake, because these two fields represent genuinely independent facts (reachability vs. draft-divergence), unlike `status`/`isPublished` which represented the *same* fact twice.

**`FormDefinition.status` enum: `"draft" | "published" | "paused" | "archived"`.** `draft` now means specifically "no `FormVersion` has ever been created for this form" (not "currently has unpublished edits," which `hasUnpublishedChanges` covers independently and can be `true` even while `status` is `published`). `paused` is a real, distinct product need (temporarily take a live form offline without losing its published structure or reverting to `draft`). Valid transitions: `draft → published` (first publish, via publish action) → `published ⇄ paused` (pause/resume, no structural change, `activeFormVersionId` untouched) → any of `published`/`paused`/`draft` `→ archived` (retire). `archived` is terminal in practice. **None of these transitions are triggered by ordinary draft-layout saves** — editing `layout` while `status` is `published` only ever touches `hasUnpublishedChanges`, never `status` itself; this is precisely what makes "edit without going offline" representable.

| Field | Why | Who writes | Who reads | What breaks if removed |
|---|---|---|---|---|
| `publicSlug` | Stable, unguessable public URL component — per FORMS_ARCHITECTURE.md's security requirements (random, not sequential/derivable). | Minted once, on first publish. Never changes on republish (link stability). | Public route resolution (`GET /api/public/forms/:publicSlug`), share/embed/QR generation. | No public URL exists at all — the entire point of Forms. |
| `activeFormVersionId` | The pointer that makes the publish flow's "reuse existing FormVersion if unchanged, else create new" logic (FORMS_DOMAIN_MODEL.md §5's publish flow diagram) actually resolvable — this is literally what "currently live" means. | Publish action. | Public route (which FormVersion to serve/validate against), FormSubmission creation (which version to stamp). | Public route has no way to know which structural snapshot is currently authoritative. |
| `owner` | Product concept: who gets notified, who's accountable for this form's submissions — distinct from `createdBy` on the parent (who built it) since ownership can be reassigned without re-authoring. | Builder settings panel. | Notification service (Phase 9), Forms list page ("assigned to"). | No one to notify on submission; ambiguous who's responsible for triaging the review queue. |
| `notifyOwnerOnSubmit` | Per-form toggle — some forms are high-volume and notification-per-submission would be noise. | Builder settings panel. | Notification trigger logic (Phase 9). | Every form would either always or never notify, no per-form control. |
| `duplicateStrategy` | Drives submission-pipeline branching (FORMS_ARCHITECTURE.md §2.8 step 6) — `"review_queue"` (run the engine; flag possible matches for a human to resolve as Keep Both / Keep Existing; score never changes the outcome, only whether it's flagged at all — D9) vs. `"allow_duplicates"` (skip the engine entirely, every submission creates a new record). | Builder settings panel. | Submission pipeline (Phase 4). | Submission pipeline has no configured behavior to branch on; would need a hardcoded global default, removing the per-form flexibility the product discussion specifically asked for. |
| `tools.*` | Captcha/privacy-policy configuration — operational/compliance, not structural (confirmed non-versioned by the domain model's FormVersion "belongs" test). | Builder settings panel. | Public form renderer (show captcha widget), submission validation (verify captcha token, enforce privacy-policy checkbox). | No spam protection configurable per form; no way to satisfy privacy-policy-consent requirements the product discussion raised. |
| `thankYou.*` | Post-submission visitor experience. | Builder settings panel. | Public form (post-submit render/redirect). | Visitor gets no feedback that their submission succeeded — bad UX, no domain-model consequence, but a real product gap. |
| `publishedAt` | When this form first went live — distinct from `FormDefinition.createdAt`/`updatedAt` (which track the *definition* record, not the *publish event*). | Set on first publish, never changed on republish. | Forms list page ("live since"), analytics (future). | Can't distinguish "form created" from "form actually went live," which can be a meaningfully different date. |

**Constraint**: `publicSlug` must be unique across the entire collection (not just per-org) — it's the sole lookup key for the unauthenticated public route, which has no organization context to scope by until *after* resolving the slug. Enforced via a unique index (§5).

---

## 3. `FormVersion`

```js
{
  _id,
  formDefinition,        // ObjectId ref FormDefinition
  versionNumber,           // Number, monotonic per FormDefinition — display/ordering only, see note
  schemaHash,                // String (SHA-256 hex) — see §3a for exactly what's hashed

  layout: [Section],           // frozen copy of BUILDER STRUCTURE ONLY — same shape as §1a
                                 // (sections, elements, fieldId references, per-form overrides),
                                 // PLUS the derived `targetModule` on each field element (materialized
                                 // at publish — §1a note). Does NOT contain resolved label/type/options
                                 // (see resolvedFields); routing lives here, not in resolvedFields (#17).

  resolvedFields: [              // frozen FIELD METADATA SNAPSHOT — separate from layout, on purpose
    { fieldId, source, label, type, options, baseRequired }
  ],

  createdAt, updatedAt          // updatedAt exists ONLY to track resolvedFields refreshes (§3a) —
                                  // layout and schemaHash never change after creation; if updatedAt
                                  // differs from createdAt, it can only mean a resolvedFields refresh
                                  // happened, never a structural edit.
}
```

**`layout` vs `resolvedFields` — two distinct responsibilities, split per review feedback**: the earlier draft of this schema conflated "what the builder produced" (structure, ordering, per-form overrides) with "what a field meant at that moment" (label, type, options) inside a single frozen `layout` blob. Splitting them makes the publish operation explicit and mechanical rather than a black box:

```
publish = freeze(FormDefinition.layout)              → FormVersion.layout
        + resolve(fieldIds against current field defs) → FormVersion.resolvedFields
```

`layout` is a structural copy of FormDefinition's canonical layout (§1a) — same shape, same `fieldId` references, same per-form `required`/`validationOverrides`. `resolvedFields` is a separate flat array, one entry per distinct `fieldId` referenced anywhere in that layout, holding exactly the metadata that comes *from the field definition itself* (not from this form's overrides) as it existed at freeze time: `label`, `type`, `options` (for dropdown/multiselect), and the field definition's own `baseRequired` (distinct from the per-form `required` override living in `layout` — a field can be optional by default but required on *this* form; both facts need to survive independently, which is exactly why they're not merged into one flattened object).

A renderer reconstructing this FormVersion joins the two in memory (`layout` element's `fieldId` → look up in `resolvedFields`) — this is the mechanical "two inputs, one render" operation the split makes possible, versus the earlier single-blob shape which hid that join inside the freeze step itself.

| Field | Why | Who writes | Who reads | What breaks if removed |
|---|---|---|---|---|
| `formDefinition` | Parent reference — every FormVersion belongs to exactly one FormDefinition (aggregate-root relationship, domain model §4). | Set at creation, never changed. | "All versions of this form" queries (rare — mostly internal/debug), submission-to-definition traversal. | No way to group versions under their parent form; orphaned snapshots. |
| `versionNumber` | Human-meaningful ordinal ("this is version 3") for display — **explicitly not authoritative for "what's currently live."** That's always `FormDefinition.publishState.activeVersionId`, never `max(versionNumber)` — stated explicitly per review feedback, since the two could in principle diverge (e.g. a rollback to an earlier version would make the highest `versionNumber` *not* the active one) and any code computing "the live version" via `max()` instead of following the pointer would be a latent bug. | Publish action, incremented from the prior latest version for this FormDefinition. | Builder ("you're viewing version 2 of 3" if that UI ever exists), audit/debug — display only. | `_id` alone doesn't convey ordering or "how many versions has this form had" without a sort — minor convenience loss, not a correctness break, but cheap to keep. |
| `schemaHash` | Per domain model — cheap change-detection for the publish flow's reuse-vs-create decision. Exact scope defined in §3a below (this was the source of the inconsistency flagged in the previous draft; resolved there, not here). | Computed at creation. | Publish action (compare against latest existing version's hash). | Publish flow degrades to a full structural deep-compare on every publish — works, but exactly the cost `schemaHash` exists to avoid. |
| `layout` | Frozen builder structure — the immutability guarantee for *what was asked and in what order/configuration*. | Set once at creation, copied verbatim from FormDefinition's draft layout at publish time. | Public form renderer (structure), submission validation (which fields/required-ness applied), FormSubmission audit trail. | No record of the form's actual structure at submission time — the core interpretability guarantee breaks. |
| `resolvedFields` | Frozen field metadata — the immutability guarantee for *what each field meant* (label/type/options) at that moment, per domain model §5c. | Set once at creation, resolved from current field definitions as part of the freeze step. | Public form renderer (joined against `layout` to render labels/options), submission validation (valid dropdown options at that time). | A dropdown's option list could later be edited, silently reinterpreting what an old submission's stored value actually meant — the exact failure mode §5c exists to prevent. |

### 3a. What exactly does `schemaHash` hash? — resolves the schema-boundary question directly

Per review feedback: the earlier draft's inconsistency wasn't really about hash *timing*, it was about never having defined what "schema" means. Defining the boundary explicitly, choosing **Option A** (structure is schema; presentation is not):

**Included in the hash** (because these determine what data a submission could contain or what was demanded of the visitor — the same test FormVersion's own "belongs" list already uses): the ordered list of `fieldId`s present in the layout, each field's `type`, each field's effective `required` (form-level override if set, else the field definition's `baseRequired`), each field's `validationOverrides`, each field's `targetModule` (routing between Contact and Company changes *which record* a captured value becomes — as structural as the field being present at all; flipping it must mint a new FormVersion so historical submissions keep the routing they were actually processed under), and section/element structural ordering (including non-field elements like headings/dividers, since reordering *what the visitor sees and in what sequence* is a structural change).

**Excluded from the hash** (Option A's boundary — not schema): field `label`, `options` list contents/wording, `helpText`, `defaultValue`. These affect what's *displayed*, not what's *structurally demanded* — a dropdown still has the same number of choices in the same position in the form whether an option is spelled "Manufacturing" or "Industrial."

**Direct consequence, stated plainly rather than left implicit**: a field's label or dropdown-option wording changing between publishes does **not** bump `versionNumber` or create a new FormVersion — by design, because labels/options are outside the schema boundary just defined. When a republish happens with only that kind of change, `resolvedFields` on the **existing, reused** FormVersion is refreshed in place as part of that republish (not creating a new version, but not leaving it stale either) — this is a normal write to the parent's publish-time freeze step, not a violation of "FormVersion never mutates after creation," because the *identity* of which version is active doesn't change and no submission's interpretation is altered (an old submission was validated against `type`/`required`/`options`-*membership*, i.e. schema, at the time it was submitted — display wording changing after the fact doesn't change what that submission actually contains or means). This directly replaces the earlier draft's invented "patch version" concept, which is no longer needed once the schema/presentation boundary is explicit.

---

## 4. `FormSubmission`

```js
{
  _id,
  formDefinition,       // ObjectId ref FormDefinition
  formVersion,            // ObjectId ref FormVersion
  organization,             // ObjectId ref Organization (denormalized)
  submittedAt,                // Date
  sourceMeta: { ip, userAgent, utm, referrer },
  rawData,                       // Mixed, write-once
  processedData,                   // Mixed (renamed from normalizedData, domain model §6)
  uploadedFiles: [{ fieldId, url, originalName, size, mimeType }],

  // Three orthogonal statuses, not one combined enum — see note below.
  processingStatus,                    // enum: "pending" | "validated" | "rejected"
  reviewStatus,                          // enum: "not_required" | "needs_review" | "resolved"
  importStatus,                            // enum: "not_imported" | "imported"

  validationErrors: [{ fieldId, message }],
  resultingRecords: [{ module, recordId }], // tracks only records newly created by this submission
  reviewedBy, reviewedAt                    // set only when reviewStatus reaches "resolved"
}
```

**Why three fields instead of one `status` enum**: the earlier draft's single `status` (`pending_validation|validated|rejected|needs_review|duplicate_flagged|approved|imported`) mixed three genuinely independent axes — *did the submitted data pass basic validation* (processing), *does this need a human to look at it before it's trusted* (review), and *has it actually become a CRM record* (import). Collapsed into one enum, invalid-looking combinations become representable by construction (e.g. nothing prevents a future code path from producing something that reads as simultaneously `"validated"` and `"duplicate_flagged"` and `"approved"`, because those were never actually mutually exclusive states of the same axis — they're independent facts). Splitting them means each field has a small, genuinely mutually-exclusive set of values, and a combination like "processing rejected + review resolved + imported" is simply impossible to reach because `importStatus` only ever transitions to `"imported"` from a state where `processingStatus === "validated"` — enforced by the service layer's transition logic (application-level, same as all referential integrity in this schema — see §8), not by the schema itself.

**Valid combinations in practice** (not enforced by Mongo, but this is the intended state space): `{pending, not_required, not_imported}` → on validation: `{validated, not_required, not_imported}` *or* `{rejected, not_required, not_imported}` (rejected is terminal) → if `validated` and duplicate engine flags something: `{validated, needs_review, not_imported}` → on human resolution: `{validated, resolved, not_imported}` → on import: `{validated, resolved-or-not_required, imported}`. A `Submissions Inbox` "what needs my attention" query becomes simply `reviewStatus: "needs_review"`, independent of whatever `processingStatus`/`importStatus` combination produced it — arguably clearer than the single-enum version's query surface too, not just safer.

| Field | Why | Who writes | Who reads | What breaks if removed |
|---|---|---|---|---|
| `formDefinition` | "All submissions to this form, ever" — the common query, per domain model §4's explicit both-references decision. | Set at creation. | Submissions Inbox (Phase 8), Forms list page (submission count). | Every "show me submissions to this form" query would need to join through FormVersion — one extra hop, for the *common* case, per submission. |
| `formVersion` | "What exact structure produced this" — the audit/interpretation query, per domain model §4. | Set at creation, from `publishState.activeFormVersionId` at the moment of submission. | Review Center (render the submission against the version that produced it), any future "why does this look wrong" debugging. | Can't correctly re-render or re-validate a historical submission against its actual originating structure — the core interpretability guarantee breaks. |
| `organization` | Denormalized for fast org-scoped queries without a join through FormDefinition — same pattern already used elsewhere in this app (established, not novel). | Set at creation (resolved from FormDefinition, not client-supplied — security requirement, FORMS_ARCHITECTURE.md §2.9). | Every org-scoped submission query (Submissions Inbox, Review Center). | Every query needs a join through FormDefinition just to filter by tenant — meaningful cost at submission-table scale. |
| `rawData` | Write-once audit trail of exactly what the visitor sent — per the earlier "rawData immutability" refinement. | Set once, at creation. Never updated (enforced at service layer, not schema — Mongoose can't enforce field-level immutability natively). | Audit/debug only — never read by application logic for rendering or matching. | Loses the one artifact that proves what was actually submitted, independent of any processing bugs introduced later. |
| `processedData` | Coerced/cleaned/enriched data — what the submission pipeline and CRM-record-creation actually operate on. **Invariant, stated explicitly per review feedback: the processing pipeline that produces `processedData` from `rawData` must be idempotent** — running it twice on the same `rawData` must yield the same `processedData`, byte for byte. This isn't a nice-to-have; it's what makes retries, replay, and future re-processing (e.g. re-running enrichment after a pipeline bug fix) safe operations rather than ones that risk silently drifting a record's data on every re-run. Any processing step that isn't naturally idempotent (e.g. an AI-enrichment call that could return different phrasing each time) must be made deterministic for this field's purposes — cache its result keyed by `rawData`'s content, or otherwise pin it — rather than re-invoked freely. | Submission pipeline (initial coercion), potentially re-processed on manual review/edit-before-approve. | Duplicate engine, review UI, `create{Contact,Company,Vendor}FromRawData` service call. | Nothing to actually create a CRM record from — `rawData` alone hasn't been validated/typed. |
| `uploadedFiles` | Separate from `processedData` because file uploads have a distinct storage mechanism (S3 URL, not inline data) and distinct metadata (size/mimetype, relevant for the security requirements in FORMS_ARCHITECTURE.md §2.9). | Submission pipeline, on file-upload fields. | Review UI (render/download), CRM record creation (attach as avatar/document). | File references would need to be smuggled into `processedData`'s otherwise-typed shape, mixing concerns. |
| `processingStatus` / `reviewStatus` / `importStatus` | Drives the entire pipeline branching (FORMS_ARCHITECTURE.md §2.8), split into three orthogonal axes per review feedback — see the note above the js snippet for why one combined enum was replaced. | Submission pipeline (`processingStatus`, `reviewStatus` transitions to `needs_review`), review actions (`reviewStatus` → `resolved`), import step (`importStatus` → `imported`). | Submissions Inbox (filter/sort, primarily on `reviewStatus`), Review Center. | No way to know what stage a submission is at on any axis — Inbox/Review Center have nothing to query against. |
| `validationErrors` | Per Open Decision D8 (soft-flag format issues, don't hard-reject) — the CRM user needs to see *what* was wrong to fix-and-approve. | Submission pipeline, at validation time. | Submissions Inbox (surface the issue), review UI. | A `needs_review` submission with no indication of *why* — user has to guess. |
| `resultingRecords` | Array of provenance links once imported - tracks *only* records newly created by this submission. Does not track existing records that were merely linked (those are derived via DuplicateReview). Needed for UI linking. | Appended on successful import. | CRM record detail view (future "created via form" badge), Submissions Inbox (link out to the created records). | No traceability from a CRM record back to its originating form submission. |
| `reviewedBy` / `reviewedAt` | Accountability for manual review decisions — who approved/rejected/merged, when. | Review action handlers. | Audit/debug, Review Center. | No accountability trail for data-quality decisions made on ambiguous submissions. |

**Note**: `SubmissionEvent` (below) is what actually answers "what happened to this submission, in order" per the domain model — the three status fields are a current-state snapshot, `SubmissionEvent` is the timeline. Both are kept; they don't overlap in responsibility.

---

## 5. `SubmissionEvent`

```js
{
  _id,
  formSubmission,     // ObjectId ref FormSubmission
  organization,         // ObjectId ref Organization (denormalized, same rationale as FormSubmission)
  eventType,              // String, open-ended (domain model: not a closed enum)
  occurredAt,               // Date
  actor: { kind, id, displayName },   // kind: open string, not a closed enum — see note below
  payload                     // Mixed, shape defined by eventType, not validated at schema level
}
```

Resolves domain-model open question #4 (separate collection vs. embedded array): **separate collection**, per the domain model's own leaning and reasoning (cross-submission queries like "all duplicate-detection events across the org this week," and unbounded growth per submission from retries/multi-step review). Confirmed rather than re-litigated here.

| Field | Why | Who writes | Who reads | What breaks if removed |
|---|---|---|---|---|
| `formSubmission` | Parent reference — every event belongs to exactly one submission. | Set at creation. | Timeline view for a given submission (Review Center detail). | No way to reconstruct a submission's history. |
| `organization` | Same denormalization rationale as FormSubmission — cross-submission org-scoped queries (e.g. the "all duplicate-detection events this week" case the collection choice was justified by) need this without a join. | Set at creation. | Org-wide event queries (future admin/debug tooling). | The exact cross-submission query use case that justified a separate collection over an embedded array becomes a join anyway — undermines the reason this collection exists as separate. |
| `eventType` | Free-form, per domain model — identifies what kind of event this is without a closed enum forcing a migration for every new capability. | Whatever pipeline/service step is emitting the event. | Timeline rendering (icon/label lookup keyed by string, in application code, not schema). | No way to distinguish event kinds at all. |
| `occurredAt` | Ordering — the entire point of a timeline. | Set at creation (server time, not client-supplied). | Timeline rendering (sort order). | Events would only have insertion order via `_id`, which is usually equivalent but not guaranteed under all Mongo configurations — cheap to store explicitly rather than rely on that. |
| `actor` | Distinguishes who/what caused an event — relevant for both UI ("you did this" vs "the system did this") and future accountability audits. Shaped as `{kind, id, displayName}` rather than the narrower `{type: "system"|"user", userId}` from an earlier draft, per review feedback: `kind` is an open string (`"user"`, `"system"`, and eventually `"api_key"`, `"workflow"`, `"webhook"`, `"ai"`, `"cron"` — none of which fit a `system|user` binary), `id` generalizes `userId` to whatever identifier that actor kind uses (a user's ObjectId, an API key's ID, a workflow run ID), and `displayName` is included redundantly-but-deliberately so the timeline can render a human-readable label even for actor kinds that don't resolve through the `User` collection (an API key or workflow has no `User` document to join against for a name). | Whatever code path triggers the event. | Timeline rendering, audit. | Can't tell whether a state change was automatic or a deliberate human/system/integration action — meaningfully different trust levels for debugging "why is this data wrong," and a closed `system|user` union would need a schema change for every new actor kind Forms' automation roadmap (§2.10) eventually introduces. |
| `payload` | Event-specific detail (e.g. a `duplicate_detected` event's payload holds the score/matchDetails; a `notification_failed` event's payload holds the error). Deliberately unvalidated at the schema level — validating it would require the closed-enum-of-event-types the domain model explicitly rejected. | Whatever code path triggers the event; that code owns its own payload shape. | Timeline rendering (interprets by `eventType`), debugging. | Events would be reduced to a bare type+timestamp with no detail — insufficient for the actual debugging use case this entity exists for. |

---

## 6. `DuplicateReview`

```js
{
  _id,
  organization,           // ObjectId ref Organization
  module,                   // enum: "Contact" | "Company" | "Vendor"
  formSubmission,             // ObjectId ref FormSubmission, nullable (see note)
  existingRecord: { module, recordId },
  incomingData,                  // Mixed — the candidate data being compared
  score,                           // Number, 0-100
  matchDetails,                        // [{ signal, matched, existingValue, incomingValue, weight }]
                                         // matchedOn (quick-scan signal list) is NOT stored — it's
                                         // matchDetails.filter(d => d.matched).map(d => d.signal),
                                         // computed on read. Storing both would be two sources of
                                         // truth for the same information — removed per review feedback.
  reasonSummary,                         // String — human-readable one-liner
  engineVersion,                           // String
  decision,                                  // enum: "pending" | "merged" | "kept_separate" | "linked_to_existing"
  decidedBy, decidedAt
}
```

| Field | Why | Who writes | Who reads | What breaks if removed |
|---|---|---|---|---|
| `formSubmission` (nullable) | Links back to the submission that triggered this review — but nullable because per the shared-engine decision (D6), this collection must also serve future Import/manual-create callers that have no FormSubmission at all. | Duplicate engine, when triggered from the Forms pipeline. | Review Center (jump from a review to its originating submission, when one exists). | Forms-triggered reviews lose their originating-submission context; a non-nullable FK would also block the shared-engine reuse this field's own nullability exists to support. |
| `existingRecord` | The CRM record this incoming data was matched against — the other half of the comparison. | Duplicate engine. | Review Center (render the "existing" side of the compare UI). | Nothing to compare the incoming data against — the review is meaningless without it. |
| `incomingData` | The candidate data itself — needed to render the "incoming" side of the compare UI (per the product discussion's explicit request for a field-by-field diff view). | Duplicate engine, copied from the submission's `processedData` (or an Import/manual-create equivalent later). | Review Center compare UI. | No way to show what's actually being proposed as a match — the compare UI has nothing on one side. |
| `score`, `matchDetails`, `reasonSummary` | The confidence-and-explanation contract established in FORMS_ARCHITECTURE.md §2.4/§2.2 — per your explicit requirement that duplicates show *why* they matched, not just a bare boolean. (`matchedOn` intentionally not a separate stored field — see js snippet note; it's a derived view over `matchDetails`, computed in application code or a virtual, not persisted.) | Duplicate engine. | Review Center compare UI. | Reduces to Bigin's "duplicate: yes/no" — the entire differentiator this design was built around. |
| `engineVersion` | Per domain model refinement — which version of the matching logic produced this score, so a future engine rewrite doesn't make old reviews unexplainable. | Duplicate engine, stamped from its own current version constant at scoring time. | Debug/audit tooling (future), potentially a "re-run under current engine" bulk action (future). | Old reviews become impossible to distinguish from new ones when the engine changes — the exact scenario this field was added to prevent. |
| `decision`, `decidedBy`, `decidedAt` | The human resolution — and per the product discussion's explicit requirement, this is what makes "once sorted, don't ask again" possible (a future submission matching the same `existingRecord` can check for a prior `kept_separate` decision and skip re-flagging). | Review action handlers. | Duplicate engine (checks for prior decisions on the same existingRecord before creating a new review — this is the "don't re-ask" mechanism), Review Center (audit). | The core "don't repeatedly ask about the same records" product requirement breaks — every matching submission would re-flag forever. |

---

## 7. Indexes

| Collection | Index | Purpose |
|---|---|---|
| `FormDefinition` | `{ organization, status }` | Forms list page — filter by org (always) and status (draft/published/archived tabs). |
| `FormDefinition` | unique `{ "publishState.publicSlug" }`, partial (only where `publicSlug` exists) | Public route lookup; uniqueness enforced globally, not per-org, since the public route has no org context before resolving the slug. |
| `FormDefinition` | `{ organization, "layout.elements.fieldId" }` (multikey) | Open Decision D4's required check — "does any form in this org reference this fieldId" — before allowing a custom field to be deleted in Settings. Without this, that check is a full collection scan of every form's nested layout. |
| `FormVersion` | `{ formDefinition, versionNumber }`, unique compound | "Latest version for this form" queries; enforces no duplicate version numbers per form. |
| `FormSubmission` | `{ formDefinition, reviewStatus }` | Submissions Inbox — per-form, filtered by review status (the primary "needs attention" query). |
| `FormSubmission` | `{ organization, reviewStatus }` | Org-wide review queue / cross-form Inbox views. |
| `FormSubmission` | `{ organization, submittedAt }` | Org-wide "recent submissions across all my forms," date-sorted, status-agnostic — not served by the `reviewStatus`-keyed indexes above. |
| `FormSubmission` | `{ submittedAt }` | Chronological sort across the whole collection (cross-org, admin/ops use), retention/cleanup queries (future). |
| `SubmissionEvent` | `{ formSubmission, occurredAt }` | Timeline query for a given submission, in order. |
| `SubmissionEvent` | `{ organization, eventType, occurredAt }` | The cross-submission query that justified this being a separate collection (e.g. "all duplicate_detected events this week"). |
| `DuplicateReview` | `{ organization, decision }` | Review queue (pending items). |
| `DuplicateReview` | `{ "existingRecord.module", "existingRecord.recordId" }` | The "don't re-ask" lookup — check prior decisions against a given existing record before creating a new review. |

## 8. Constraints and relationships summary

- **Referential integrity is application-enforced, not Mongo-enforced** (standard for this stack — no evidence of `$lookup`-based FK constraints elsewhere in the existing codebase either). Services must verify parent existence before writing children (e.g. `FormSubmission` creation verifies `formDefinition`/`formVersion` exist and belong to the resolved organization) rather than relying on the database to reject orphans.
- **`organization` denormalization** (present on `FormSubmission`, `SubmissionEvent`, in addition to `FormDefinition`) is a deliberate, repeated tradeoff — write-time cost (must be correctly propagated, not just copied blindly) for read-time query simplicity and safety (a query can filter by `organization` directly without ever trusting a joined/looked-up value for tenant isolation, which matters more here than in most collections given the public/unauthenticated submission path).
- **No cascading deletes anywhere** — consistent with the domain model's "nothing is ever hard-deleted" rule (§5). Archiving a `FormDefinition` does not touch `FormVersion`/`FormSubmission`/`SubmissionEvent`/`DuplicateReview` at all.

---

## 9. Resolved: the schemaHash/version-bump question from the previous draft

The previous draft flagged an open inconsistency between `schemaHash` computation and §5c's snapshot decision. Resolved in §3a above by defining the schema/presentation boundary explicitly (Option A: structure is schema, labels/options are not) — no "patch version" concept needed. Label/option edits refresh `resolvedFields` in place on the existing active FormVersion rather than minting a new one; structural edits (field add/remove/required-change/reordering) mint a new FormVersion via the normal publish flow. No open item remains here.

## 10. Schema Invariants

Rules, not fields — the non-negotiable properties every service, controller, and future migration touching these collections must preserve. Added per review feedback: these are often more valuable than another row in a field table, because they're the actual checklist against which new code should be reviewed.

1. Every `FormSubmission` references exactly one `FormVersion` and exactly one `FormDefinition` (both, per domain model §4 — not derivable from one another without an extra hop).
2. Every `FormVersion` references exactly one `FormDefinition`.
3. `FormVersion.layout` and `FormVersion.schemaHash` are immutable after creation. `FormVersion.resolvedFields` may be refreshed in place (§3a) — this is the one deliberate, narrow exception, not a loophole for anything else.
4. `FormDefinition` is the only editable working copy of a form's structure. No other collection holds in-progress, structurally-invalid-for-publishing state.
5. `FormDefinition.publishState.activeFormVersionId`, when set, must reference a `FormVersion` whose `formDefinition` equals this same `FormDefinition`'s `_id`. Cross-form pointers are never valid.
6. `FormDefinition.status` is the single source of truth for **reachability** — no second field may be introduced that represents reachability redundantly (e.g. a resurrected `isPublished` meaning "is this reachable," which is what `status` already answers). This does not prohibit `hasUnpublishedChanges`, which represents a genuinely different fact (draft-divergence from what's live, not reachability) — the distinction is what the earlier `isPublished` mistake got wrong: two fields answering the *same* question is the violation, not two fields answering *different* questions.
7. `organization` on every collection is **always server-derived, never accepted from the client** — resolved from an authenticated session (for authenticated writes) or from `publicSlug → FormDefinition.organization` (for public submissions), never from a request body field. This is a security invariant, not a convenience one (FORMS_ARCHITECTURE.md §2.9).
8. `publicSlug` is globally unique across the entire `FormDefinition` collection, not scoped per-organization — the public route has no tenant context until the slug resolves one.
9. `fieldId` references (in `FormDefinition.layout` and `FormVersion.layout`) are permanent once used in a persisted layout. Renaming a field's display name must never require changing a stored `fieldId` reference (§5b).
10. System-field IDs (the `"system:module.fieldname"` constants, §1c) are **append-only**, treated with the same permanence discipline as a public API contract. If a system field's meaning changes enough to warrant a new identity, a **new** ID is added — the old one is never renamed or repurposed.
11. `FormSubmission.rawData` is write-once and immutable after creation — never updated by any application code, regardless of what downstream processing or review corrections happen to `processedData`.
12. `FormSubmission.processedData` is produced by an idempotent pipeline: identical `rawData` in must always produce identical `processedData` out, across retries and replays (§ FormSubmission's `processedData` row).
13. No document in this schema is ever hard-deleted by normal product flows. `FormDefinition` archives (`status: "archived"`); everything else is permanent once created. (Domain model §5, restated here as a binding invariant, not just a design preference.)
14. `DuplicateReview.matchedOn` is never persisted — always derived from `matchDetails` at read time. Any future code that needs "which signals matched" must compute it, never write a separate stored copy that could drift.
15. **Every denormalized `organization` field must equal its parent chain's `organization` at all times**: `FormSubmission.organization` must equal `FormSubmission.formDefinition.organization`; `SubmissionEvent.organization` must equal `SubmissionEvent.formSubmission.organization`; `DuplicateReview.organization` must equal `DuplicateReview.formSubmission.organization` when `formSubmission` is set. This is stated as its own invariant, separate from #7's "server-derived only" rule, because server-derivation alone doesn't guarantee *consistency* — a correctly server-derived value can still be derived from the wrong source at a given call site. Since every tenant-scoped query filters on these denormalized fields directly (that's the reason they're denormalized), a violation here is a cross-tenant data-isolation defect, not merely a data-quality one.
16. **A `fieldId` appears at most once across an entire `FormVersion.layout`** (and therefore across the working-copy `FormDefinition.layout` it was frozen from). A field may be placed in exactly one element; the same field cannot appear twice, even in different sections. This is enforced at publish time by `assertUniqueFieldIds` (formVersionService), which fails publication with a clear "invalid form definition" error naming the duplicated `fieldId` — it is **not** auto-deduplicated, and intent is never inferred. Multiple services already silently assume this (`resolveFields` dedupes via a Set; `coerceAndValidate` and `buildCrmPayloads` index `processedData`/routing by `fieldId` and would otherwise last-write-wins). With per-element `targetModule` (#17), a repeated `fieldId` could even carry *conflicting* routing, making the ambiguity structural rather than cosmetic — hence enforcement, not documentation-and-hope.
17. **`targetModule` is DERIVED, never user-editable, and lives on `layout` only — never duplicated into `resolvedFields`.** It is computed at publish time (`resolveLayoutTargetModules`/`deriveTargetModule`) from the field's owning module: system fields from their `"system:module.*"` ID prefix, custom fields from the form's own module. It defaults to `form.module` (no migration for single-module forms). The **only** permitted cross-module value is a Company field inside a Contact form (Contact→Company); any other foreign module fails publication (Vendor is fully isolated — DO NOT GENERALIZE). Routing belongs with `layout` because `layout` and `resolvedFields` are two projections of the same FormVersion joined in memory by `fieldId`; putting routing in both would create two sources of truth. It is part of the structural snapshot and included in `schemaHash` (§3a).

---

*Next step: this schema is ready for review. Once approved, the actual Mongoose model files can be implemented (still no API/controllers/frontend — that's the phase after) — see FORMS_SCHEMA_IMPLEMENTATION_NOTES.md for the Mongoose-mechanics, concurrency/retry, and product-decision items already flagged for that phase, kept separate from this design document.*
