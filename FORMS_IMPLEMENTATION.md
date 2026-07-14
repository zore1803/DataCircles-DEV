# Forms Module — Implementation Log

Running log of what's been implemented, per phase, against `FORMS_ARCHITECTURE.md`.

---

## Phase 0 — Service Layer Extraction

**Status: COMPLETE. All three modules (Vendor/Contact/Company) implemented and live-verified against the running dev server. Zero regressions found.**

### Contact slice — live verification results (2026-07-13)

| Case | Result |
|---|---|
| Create, name only | `201`, `lifecycleStage:"Lead"`, `stageStatus:"New"` defaults applied, user/createdBy/lastUpdatedBy populated correctly |
| Create, completely empty body | `201` — Contact model has zero required fields, matches original behavior (not "fixed" to require anything) |
| Create, unrecognized `additionalFields` key | defaults to `type:"text"` — preserved |
| Update, success | `200`, all fields including `company`/`user`/`createdBy`/`lastUpdatedBy` populates intact |
| Update, non-existent `_id` | `404 {error: "Contact not found"}` — exact match |

Three test contacts created and deleted; no residual data.

### Company slice — live verification results (2026-07-13)

| Case | Result |
|---|---|
| Create, name + industry only | `201`, correct shape, `parentCompany: null`, `subsidiaries: []` |
| Create, missing required `industry` | `400 {error: "Company validation failed: industry: Path \`industry\` is required."}` — exact match |
| Create, unrecognized `additionalFields` key | defaults to `type:"text"` — preserved |
| Update, success | `200`, all fields correct |
| Update, non-existent `_id` | `404 {error: "Company not found"}` — exact match |

Two test companies created and deleted; no residual data.

**Not exercised for either module** (same reasoning as Vendor): the full additionalFields type matrix beyond the unknown-key-defaults-to-text path, since no custom field definitions exist in this test org and `fieldCoercionService` is a verbatim port of the same switch statement already proven correct via the Vendor test and via direct code diff against all three original controllers. The 403 permission-check paths (`updateContact`/`updateCompany`) were not exercised live either — they're unmodified by this refactor (still living in the controller, untouched), so no regression risk there; verifying them would need a second non-admin test user, which is more setup than this checkpoint warrants.

**Correction found during Company extraction**: `Company.create(companyData)` (single-object form) doesn't accept a `session` option in Mongoose — session support requires the array form `Company.create([companyData], {session})`. `companyService.createCompany` uses this form (`.then(docs => docs[0])` to keep the return type identical to before). Confirmed behavior-identical when `session` is `undefined` (the case for every Phase 0 caller).

## Forms Services Layer (2026-07-13)

Implemented per user direction, after Mongoose models were approved: `formPublishService`, `formVersionService`, `submissionService`, `duplicateDetectionService`, `duplicateResolutionService`, plus `utils/systemFields.js` (the stable-ID registry from FORMS_SCHEMA.md §1c). No controllers/routes yet — these are called directly by an E2E test script, not HTTP.

**D9 applied**: `duplicateStrategy`'s `"auto_merge_high_confidence"` renamed to `"auto_attach_existing"` across FORMS_ARCHITECTURE.md (new decision D9), FORMS_SCHEMA.md, and the `FormDefinition` model — "merge" was ambiguous between three distinct outcomes (keep both / field-by-field merge / link-attach); the automatable one is link-attach, never merge (merge requires human judgment by construction, per `duplicateResolutionService.mergeIntoExisting`'s hard requirement for caller-supplied `resolvedFieldValues`).

**Live end-to-end verification** (real dev DB, throwaway data cleaned up after): publish → unchanged-republish reuses the same `FormVersion` → draft edit while `status: "published"` correctly leaves `status` untouched and only flips `hasUnpublishedChanges` (confirms the draft/live decoupling fix actually holds under real writes, not just on paper) → public route still resolves the old version mid-edit → structural republish correctly mints version 2 → public submission → duplicate detection on a repeat email → manual `linkToExisting` resolution (confirmed: does **not** create a second Contact) → "don't ask again" correctly short-circuits a third submission with zero new pending reviews.

**Two real bugs found and fixed during this test, not anticipated by any prior design review**:
1. `submissionService.submitToForm` returned the stale in-memory `FormSubmission` object after `createCrmRecord` updated the DB via `findByIdAndUpdate` — the returned doc's `importStatus`/`resultingRecord` reflected pre-import state. Fixed by re-fetching before every return that follows a DB-mutating branch.
2. `processedData` is keyed by `fieldId` (e.g. `"system:contact.email"`), but `createContact`/`duplicateDetectionService` expect plain CRM field names (`email`). The first pass silently created Contacts with no name/email at all, which is also why duplicate detection initially found nothing (comparing against blank fields). Fixed by adding `submissionService.buildCrmPayload()` (using a new reverse lookup in `utils/systemFields.js`) to translate fieldId-keyed data into the CRM-schema-keyed shape before calling either the duplicate engine or the create services.
3. (Calibration, not a logic bug) Initial duplicate-match weights were miscalibrated against the review/auto-attach thresholds — an exact email match scored only 60, below the 80-point review threshold, so an actual duplicate silently created a second record instead of queuing. Reweighted so a single unique-identifier signal (exact email for Contact, exact GSTIN for Company/Vendor) alone clears the ≥95 auto-attach band, consistent with FORMS_ARCHITECTURE.md §2.4's description of these as "high confidence" signals.

**Correction after this log was first written — duplicateStrategy simplified further (2026-07-13, same day).** Product clarification: the system never auto-resolves a duplicate at *any* confidence score, not just below some band — the engine only flags and explains (`score`/`matchDetails`), a human always chooses between exactly two outcomes (Keep Both / Keep Existing). `"auto_attach_existing"` (and its removed predecessor `"auto_merge_high_confidence"`) is gone entirely — `duplicateStrategy` is now just `"review_queue" | "allow_duplicates"`. Updated FORMS_ARCHITECTURE.md D9, FORMS_SCHEMA.md, `FormDefinition.js`, and removed the auto-attach branch (and the now-dead `AUTO_ATTACH_THRESHOLD`/`duplicateResolutionService` import) from `submissionService.js`. `duplicateResolutionService.mergeIntoExisting` (field-by-field merge) is kept in the codebase as a documented, intentionally-unwired future capability — not part of the v1 Review Center surface, which exposes only Keep Both / Keep Existing. Re-ran the live E2E test after the change: the same 97-score exact-email match that previously (correctly, under the old three-value model) triggered auto-resolution now correctly stays `pending`/`needs_review` regardless of score, and both manual resolution paths (`keepSeparate`, `linkToExisting`) still work.

**Schema & Resolution Semantics Update (2026-07-13, same day):** Product clarification confirmed `resultingRecord` must be replaced entirely with `resultingRecords` (array). Furthermore, `resultingRecords` must *only* contain newly created records. Linked records are intentionally excluded to maintain a single source of truth (the DuplicateReview/CRM reference).
Verified the cross-module deferred creation logic manually via a script testing Contact forms containing Company fields. 
1. `keepSeparate` ("Keep Both"): correctly creates the deferred Company using `DuplicateReview.incomingData`, links the Contact to the new Company, and appends the new Company to `resultingRecords`.
2. `linkToExisting` ("Keep Existing"): correctly links the Contact to the existing Company without appending the existing Company to `resultingRecords`.
All architecture documents (§2.4, §2.5, D7) were updated to remove remaining "auto-link" assumptions, firmly establishing D9's two-outcome manual review model across the board.

**Explicitly not yet done** (per FORMS_SCHEMA_IMPLEMENTATION_NOTES.md, deliberately deferred): atomic version-number increment under concurrent publish, retry-safety on DuplicateReview creation, TOCTOU re-check on the submit endpoint (no endpoint exists yet), captcha/rate-limiting, file uploads. None of these blocked verifying the core flow.

### Cross-module routing amendment — per-field `targetModule` (2026-07-13, same day)

**Motivation.** The resolution service was *ready* to defer Company creation for a Contact form embedding Company fields (the `keepSeparate`/`linkToExisting` cross-module paths above), but `submitToForm` could never actually *produce* a Company bucket: `buildCrmPayload` flattened all of `processedData` into one payload for `form.module`. The schema had no way to represent that a `system:company.*` field on a Contact form routes into the Company record, not the Contact one. This amendment closes that gap — an entity-boundary amendment, documented in FORMS_DOMAIN_MODEL.md (second amendment note under FormVersion) and FORMS_SCHEMA.md (§1a/§3a, invariants #16/#17).

**What changed (design-approved 6 points + a publish-time invariant guard):**
- `elementSchema` (FormDefinition) and `frozenElementSchema` (FormVersion) gained `targetModule` — DERIVED, never user-editable, materialized only onto the frozen layout at publish. **Not** added to `resolvedFieldSchema` (routing is a structural fact belonging to `layout`; `layout`+`resolvedFields` are two projections joined in memory by `fieldId`, so duplicating it would create two sources of truth).
- `utils/systemFields.js` gained `getSystemFieldModule(fieldId)` (owning module from the `"system:module.*"` ID prefix).
- `formVersionService.js` gained `deriveTargetModule` (same-module or Contact→Company only — any other foreign module throws; Vendor stays isolated, DO NOT GENERALIZE), `resolveLayoutTargetModules` (derives routing onto a plain-object copy of the layout at publish), and `assertUniqueFieldIds` (publish-time guard). `computeSchemaHash` now includes `targetModule` (a routing flip mints a new FormVersion). Default `targetModule = form.module`, so existing single-module forms need no migration and hash identically to before *except* for the added `targetModule: form.module` term (no production forms exist, so no churn).
- `formPublishService.publishForm` now runs `assertUniqueFieldIds` then `resolveLayoutTargetModules` **before** hashing/freezing, and hashes+freezes the *same* resolved layout — so the frozen snapshot carries routing and submission-time bucketing needs **no** runtime ContactFields/CompanyFields lookup.
- `submissionService.js`: `buildCrmPayload` → `buildCrmPayloads` (returns `{ [module]: payload }`, routed by each field element's frozen `targetModule`, with `form.module` fallback for legacy versions). `submitToForm` now processes the primary bucket first (always), then — only for a Contact form, only when the Company bucket has meaningful data, only when a Contact was actually created — runs the Company bucket through the same duplicate pipeline (`processModuleBucket`) and either creates+links the Company immediately (no dup) or queues a Company-scoped `DuplicateReview` for deferred linking (dup). New helpers: `hasMeaningfulData`, `processModuleBucket`, `handleRelatedCompany`, `linkContactToCompany`; `createCrmRecord` now takes an explicit `module` argument instead of assuming `form.module`. The immediate-link path mirrors `duplicateResolutionService` exactly (`{ company: <companyId> }`, no acting user).

**Publish-time invariant guard (#16).** `assertUniqueFieldIds` fails publication with a clear "invalid form definition" error naming the duplicated `fieldId` if any field is placed more than once. Treated as invariant enforcement, **not** a feature — no auto-deduplication, no intent inference. Previously this uniqueness was silently assumed by `resolveFields` (Set-dedupe) and `coerceAndValidate` (last-write-wins); with per-element `targetModule` a repeated `fieldId` could carry conflicting routing, making the ambiguity structural.

**Live E2E verification** (real dev DB, throwaway data cleaned up after — 39/39 assertions passed): drove the services directly (no HTTP, no builder — the builder doesn't exist yet; layouts were hand-constructed, same approach as the earlier cross-module resolution test).
- **schemaHash sensitivity**: a targetModule-only difference (Contact vs Company) produces different hashes; identical layouts hash identically.
- **Publish derivation**: a Contact form with Company system fields publishes v1 with `contact.*` → Contact and `company.*` → Company on the frozen layout; publicSlug minted.
- **Cross-module submit (novel Company)**: one Contact + one Company created, Contact.company linked to the new Company, `resultingRecords` = [Company, Contact], no field bleed (Company.name ≠ the contact's name).
- **Empty Company section (the common real-world path)**: a submission with the Company fields blank creates only a Contact — no Company record, no Company duplicate-detection, no `duplicate_detected`/`contact_linked_to_company` events, Contact.company unset. Clean short-circuit confirmed.
- **Company duplicate → deferred review**: same-GSTIN company queues a Company-scoped `DuplicateReview`, the Contact is still created immediately, no Company auto-created; `reviewStatus: needs_review`.
- **Keep Both** creates the deferred Company and links the Contact; **Keep Existing** links the Contact to the existing Company and creates no new record / doesn't append it to `resultingRecords`. (Also incidentally re-confirmed the "don't ask again" prior-decision short-circuit — a second submission against a company already resolved `kept_separate` creates directly instead of re-queuing.)
- **Publish guards**: a duplicate `fieldId` fails publication (error names the fieldId); a Company field inside a Vendor form fails publication ("not permitted").
- **Versioning / immutability**: a structural republish mints v2; the old submission still references v1; v1's frozen layout (5 elements, `company.gstin` → Company) is unchanged; v1.schemaHash ≠ v2.schemaHash.

The E2E driver was a throwaway script (deleted after the run, all test records purged), consistent with prior Forms-services verification practice.

**Deferred backlog item — "Support cross-module custom fields" (not scheduled).** Today the only supported cross-module fields are Company **system** fields on a Contact form (module encoded statically in the `"system:company.*"` ID prefix, so `deriveTargetModule` needs no runtime lookup). A Company **custom** field on a Contact form is intentionally NOT supported: a custom field's ObjectId does not encode its owning module, so routing it would require the exact publish-time `*Fields` lookup this design avoids — and the builder can't place such a field anyway (no builder yet). Closing this later means: publish-time module resolution for custom fieldIds, builder support for placing them, frozen metadata, still no submission-time runtime lookups. Deliberate boundary, not an accidental gap (FORMS_SCHEMA.md invariant #17; `deriveTargetModule` in formVersionService).

## Phase 1 — Public HTTP Layer (submit endpoint) (2026-07-13)

**Status: COMPLETE.** First HTTP exposure of the Forms pipeline. No architecture/schema/service changes — the service layer was already the intended seam; this phase is a thin adapter on top of it, exactly as FORMS_ARCHITECTURE.md §2.9 diagrammed. The authenticated form-management routes (`/api/forms`, `/api/duplicate-reviews`) are deliberately NOT part of this phase — they belong to the Builder / Review-Center milestones.

**What was added (3 files, all new; one 4-line mount edit to `server.js`):**
- `routes/publicFormRoutes.js` — a distinct, explicitly **unauthenticated** router mounted at `/api/public/forms` (no `requireAuth`/`subscriptionGate`/`checkPermission`), so "this route is intentionally public" is visible at a glance rather than an easily-missed omission. This codebase has **no other public route** (§2.9), which is exactly why it lives in its own file.
- `controllers/publicFormController.js` — `submitForm`, a thin HTTP adapter over `submissionService.submitToForm`. Shapes the request into `(publicSlug, rawData, sourceMeta)` and maps outcomes to a **public-safe** response.
- `server.js` — mounts the router after `express.json()` so the body is parsed.

**Contract.** `POST /api/public/forms/:publicSlug/submit`, body `{ data: { [fieldId]: value }, utm?: {...} }`.
- `201 { success, submissionId }` — accepted; **deliberately does not distinguish** "imported" from "queued for duplicate review", so the endpoint can't be used to probe whether a matching record already exists. No CRM record IDs, review state, or organization ever leak into the response.
- `422 { success:false, validationErrors }` — a required field was missing (the D8 hard-failure; echoed per-field so a renderer can highlight them).
- `400 { error }` — `data` missing / not a plain object / an array.
- `404 { error }` — slug doesn't resolve to a submittable (published) form; the same 404 covers not-found, paused, unpublished, and no-active-version so none of those internal states are distinguishable publicly.
- `500 { error }` — unexpected fault only (logged server-side).

**Security posture.** Organization is resolved **only** from `publicSlug → FormDefinition.organization` inside the service — never accepted from the client (FORMS_SCHEMA.md invariant #7). `sourceMeta` stores only a bounded allow-list (ip via `req.ip`, user-agent, referer, and five known UTM keys) — arbitrary client input is never spread into stored meta.

**Live HTTP E2E verification** (throwaway script — booted a minimal Express app mounting only the public router, hit it over real `fetch`/HTTP against the dev DB, cleaned up after; 17/17 passed): valid cross-module submit → 201, Contact+Company both created and linked, `sourceMeta` (UA/referrer/UTM) captured, response leaks nothing internal; missing-required → 422 naming the email fieldId; malformed body (missing `data` / non-object / array) → 400; unknown slug → 404 with no internal detail; **paused** form → 404. Script deleted after the run, all test records purged.

**Still deferred** (unchanged from Phase 0's list, none blocking this endpoint): concurrent-publish atomic version increment, DuplicateReview retry-safety, submit-endpoint TOCTOU re-check, captcha/rate-limiting, file uploads (the public S3 middleware still assumes an authenticated user — §1.2). A public write endpoint makes **rate-limiting / captcha** the most pressing of these before real exposure — flagged for a hardening pass, not done here.

## Backend fix — Company-bucket resume on Contact-review resolution (2026-07-13, same day)

**Context.** During UI-alignment review (ahead of the Builder/Review-Center milestones), it was flagged that `submitToForm` skips the Company bucket entirely when the Contact itself needs review, and asked whether this meant Company field values were lost. **Verified first, before any fix**: `FormSubmission.rawData`/`processedData` are written unconditionally, before any duplicate-detection branching — nothing is ever discarded. The gap was purely a missing *resume* step, not data loss. Confirmed by tracing every call site: neither `keepSeparate` nor `linkToExisting` contained any logic that re-derived an unprocessed Company bucket after a Contact review resolved.

**Fix (small, additive — no schema change, no dual-review redesign):**
- `submissionService.js` gained `resumeCompanyProcessing(submission, contactId)`, exported. Reloads the submission's frozen `FormVersion` + its own stored `processedData`, re-runs `buildCrmPayloads` to reconstruct just the Company bucket, and routes it through the **same** `handleRelatedCompany`/`processModuleBucket` path `submitToForm` would have used — reusing the existing duplicate-detection logic rather than duplicating it. No-ops if the form isn't Contact-module, the Company section was left empty, or Company processing already happened for this submission (idempotency guard: checks `resultingRecords` and for an existing Company-module `DuplicateReview` first).
- `duplicateResolutionService.js`'s `keepSeparate` and `linkToExisting` now call `resumeCompanyProcessing` immediately after resolving a **Contact**-module review (not Company — no behavior change to the Company-resolution branches' own control flow).
- **A second, related gap surfaced during verification of this fix, not anticipated beforehand**: the existing "find the Contact to link" lookup in both functions' `review.module === "Company"` branches read only `submission.resultingRecords`, which — correctly, per the documented invariant — never contains a Contact resolved via "Keep Existing" (only newly-created records are pushed there). Before this fix, that branch was only ever reachable when the Contact had been freshly created in the same request (which *does* push to `resultingRecords`), so the gap was latent and unreachable. Resuming a Company review after a **Keep-Existing** Contact resolution is what first exercises it. Fixed with a new `findLinkedContactId(submission)` helper: checks `resultingRecords` first, and falls back to the submission's own resolved Contact-module `DuplicateReview` (`decision: "linked_to_existing"` → `existingRecord.recordId`) — consistent with the schema's own stated principle that a linked record's source of truth is the `DuplicateReview`, not `resultingRecords`. No schema change; both `keepSeparate` and `linkToExisting` now call this helper instead of the direct `resultingRecords.find(...)`.

**Live E2E verification** (throwaware script, real dev DB, 17/17 passed, deleted after): a Contact-form submission where **both** the Contact and the Company are duplicates. Confirmed no records are created at submission time (`resultingRecords` empty, `reviewStatus: needs_review`) and no Company review exists yet. Resolved the Contact review via **Keep Both** → Company processing resumed automatically, correctly detected the Company duplicate, and queued a Company-scoped review (no Company record yet). Resolved that Company review via **Keep Both** → Company created and the Contact correctly linked to it. Re-invoked `resumeCompanyProcessing` directly on an already-processed submission → confirmed idempotent (no duplicate review created). Repeated the whole scenario resolving the Contact via **Keep Existing** instead → Company processing still resumed and queued correctly, and resolving that Company review via **Keep Existing** correctly linked the *pre-existing* seed Contact to the *pre-existing* seed Company (proving the `findLinkedContactId` fallback). A separate regression check (4/4 passed) confirmed the original non-resume paths — empty Company section short-circuit, and immediate-Contact + duplicate-Company resolved via the original `resultingRecords`-based lookup — are unchanged.

**Scope discipline maintained**: no dual-review Review Center, no atomic multi-review transaction, no schema changes. A submission still never carries two concurrently-pending reviews — the Company review (when one is needed) now simply gets created a moment later instead of never.

### Follow-up cleanup — Vendor bulk-import unified onto fieldCoercionService (2026-07-13)

Closed the gap flagged in FORMS_ARCHITECTURE.md's reconciliation note (#2): `vendorController.js`'s local `processAdditionalFields` helper (the one bulk-import called) is deleted; bulk-import now calls `fieldCoercionService.processAdditionalFields("vendor", ...)` directly, same as `vendorService`. The now-unused `VendorFields` import was also removed from the controller. Vendor's additionalFields coercion logic is now genuinely single-sourced — Manual Create, Update, and Bulk Import all go through one function.

Live-verified: `POST /api/vendors/bulk-import` with a vendor containing an unrecognized custom field key → `200 {imported: 1, skipped: 0}`, and the created record correctly shows `{key:"someUnknownField", value:"bulkval", type:"text"}` — coercion behavior unchanged, just no longer duplicated. Test vendor deleted after verification.

### Vendor slice — live verification results (2026-07-13)

Verified against the running dev server (localhost:5000/5173) through an authenticated session, using the app UI for the create case and direct API calls (same session token) for edge cases the UI can't construct (malformed JSON strings are a server-side/multipart concern, not reachable by normal form input):

| Case | Result |
|---|---|
| Create, all UI-required fields (name/phone/email/company/address/city/state/pincode/country) | `201`, correct shape, `additionalFields: []`, nested `address` object persisted correctly |
| Update, unrecognized `additionalFields` key | `200`, defaults to `{type:"text"}` — preserved |
| Create, malformed `address` JSON string | `400 {message: "Invalid address format"}` — exact match |
| Create, malformed `additionalFields` JSON string | `400 {message: "Invalid additionalFields format"}` — exact match |
| Create, missing required `name` | `400 {error: "Vendor validation failed: name: Path \`name\` is required."}` — exact match |
| Update, non-existent `_id` | `404 {error: "Vendor not found"}` — exact match |
| Delete (cleanup) | `200 {message: "Vendor deleted successfully"}` |

Not exercised live: the full additionalFields type matrix (number/dropdown/date/url/multiselect coercion) — this test org has zero custom Vendor field definitions configured, and creating them just to test coercion is more setup than this checkpoint warrants given `fieldCoercionService.coerceAdditionalFields` is a verbatim line-for-line port of the original `processAdditionalFields` switch statement (verified by direct code diff, not just behavior). The "unknown key → defaults to text" fallback path, which exercises the same function, did pass live.

No test suite exists in this repo (confirmed in §0.1), so this manual pass is the only verification available. Two throwaway test vendors were created and deleted as part of this check — no residual data left in the org.

## Frontend milestone checklist (running, updated as screens land)

Grounded in `FORMS_FRONTEND_ARCHITECTURE.md`'s build order (§12). Update this list in the same commit that lands each milestone — don't let it drift from what's actually merged.

**Backend (all complete, see entries above)**
- ✅ Domain models, versioning, public submission endpoint
- ✅ Duplicate detection, resume processing (Company-bucket resume + idempotency guard)
- ✅ Authenticated Forms API (`formController`/`formRoutes`)
- ✅ Billing / plan gating (`forms` registered in `PlanConfig`/`restrictByPlan`)

**Frontend**
- ✅ Settings → Forms card (`settingsItems` entry, `/settings/forms`)
- ✅ Company → Forms button
- ✅ Contact → Forms button
- ✅ Vendor → Forms button
- ✅ Forms List page (table, empty/loading states, permission gate, filters, pagination, Create Form modal) — `submissionCount` added to `formController.listForms` (small additive backend gap, needed for this screen's own column)
- ⬜ Form Detail shell (`/forms/:id`, tabs: Overview/Builder/Submissions/Duplicate Reviews/Settings)
- ⬜ Builder (last, largest — placeholder until then)
- ⬜ Submission Inbox (Submissions tab, real data)
- ⬜ Submission Details (drawer)
- ⬜ Duplicate Review Center (Duplicate Reviews tab, real data) — needs the flagged `formId` filter on `GET /api/duplicate-reviews` first

### Original plan (below), before implementation began

### Scope confirmation
Zero functional/UI/schema changes. Pure internal refactor. Contact/Company/Vendor manual creation and update must behave identically after this phase, byte-for-byte on responses (status codes, error message text, error key shapes, field defaults).

### 0.1 Ground truth from the actual code (not the earlier high-level audit)

Reading the real files surfaced three things the architecture doc's audit didn't call out at this precision, all of which the refactor must preserve exactly:

1. **Additional-fields coercion is duplicated in 4 places, not extracted anywhere except Vendor**: `contactController.createContact`, `contactController.updateContact`, `companyController.createCompany`, `companyController.updateCompany` all inline the same switch (`number → parseFloat(value)||0`, else `String(value||"")`, unknown field name → defaults to `type:"text"`). Only `vendorController.js` has this pulled into a standalone function, `processAdditionalFields(additionalFields, organizationId)` — this becomes the reference implementation to generalize, not something to reinvent.

2. **Vendor's create/update has extra behavior Contact/Company don't**: it JSON.parses `address` and `additionalFields` when they arrive as strings (because Vendor's client sends multipart/form-data with nested objects stringified), with try/catch → `400 {message: "Invalid address format"}` / `400 {message: "Invalid additionalFields format"}`. Contact/Company never do this parsing. The shared service must **not** silently add JSON-parsing to Contact/Company (would be a behavior change) — it takes a `parseJsonFields: string[]` option that only Vendor's caller passes.

3. **Permission-check asymmetry exists today and must not be "fixed" as a side effect**: `updateContact` and `updateCompany` have explicit 403 blocks (`"Access denied. You do not have read-write permissions for contacts."` / `"...for companies."`); `createContact`, `createCompany`, `createVendor`, `updateVendor` have no such in-controller check (permission enforcement for those happens via `checkPermission` route middleware instead, per the route files). The refactor preserves this exact asymmetry — it is out of scope to make it consistent, since that would be a behavior change, not a refactor.

4. **Error response shape is inconsistent today**: create/update handlers mostly return `400 {error: err.message}`; Vendor's JSON-parse failures return `400 {message: "..."}` (different key). Preserved as-is — normalizing this is explicitly out of scope for Phase 0.

5. **`ContactFields.fieldSchema.createdBy` is `required:true`; `CompanyFields`/`VendorFields` have no `createdBy` on their field sub-schema at all.** Not touched in Phase 0 (no schema changes), but flagged because `fieldValidationService`/`fieldCoercionService` must not assume `createdBy` exists on a field definition when written generically across all three modules.

6. **No test suite exists in this repo** (`backend/tests` doesn't exist; no `*.test.js`/`*.spec.js` outside `node_modules`). "Existing tests must continue to pass" is met trivially (there are none), but this raises the bar on manual verification — see §0.6.

### 0.2 New files to be created

```
backend/services/fieldCoercionService.js
  coerceAdditionalFields(additionalFields, fieldDefs) -> typed additionalFields array
  Generalizes vendorController's processAdditionalFields, parameterized by an already-fetched
  fieldDefs map instead of doing its own ContactFields/CompanyFields/VendorFields lookup —
  callers (the module services) own the DB fetch, this function stays a pure transform.

backend/services/fieldValidationService.js
  validateRequiredFields(fieldDefs, submittedData) -> { valid, errors: [{fieldKey, message}] }
  Net-new capability: today NOTHING enforces `required: true` on custom fields anywhere
  (confirmed in the architecture audit and in the code read above — createContact/createCompany/
  createVendor never check it). Phase 0 adds this function but does NOT wire it into the
  create/update controllers yet — wiring it in would change existing behavior (previously-optional
  submissions would start failing validation). It's built and unit-testable in isolation, wired in
  later when Forms needs it (Phase 4) or as an explicit separate follow-up decision, not silently
  bundled into this "zero functional change" phase.

backend/services/contactService.js
  createContact(organizationId, rawData, { userId, avatarUrl, source }) -> Contact doc
  updateContact(contactId, organizationId, rawData, { avatarUrl }) -> Contact doc | null
  Extracted verbatim from contactController's current inline logic, using fieldCoercionService
  for additionalFields. No JSON-parsing option enabled (matches current Contact behavior exactly).

backend/services/companyService.js
  createCompany(organizationId, rawData, { userId, profilePictureUrl, source }) -> Company doc
  updateCompany(companyId, organizationId, rawData, { profilePictureUrl }) -> Company doc | null
  Same pattern as contactService. No JSON-parsing option (matches current Company behavior).

backend/services/vendorService.js
  createVendor(organizationId, rawData, { userId, avatarUrl, source }) -> Vendor doc
  updateVendor(vendorId, organizationId, rawData, { avatarUrl }) -> Vendor doc | null
  Extracted from vendorController, preserving the address/additionalFields JSON-parse-if-string
  behavior and the {message: "..."} error shape for those specific parse failures (thrown as a
  typed error the controller maps back to the exact same 400 response).

```

**Revised — not creating scaffold files this phase.** Originally planned empty `duplicateEngine.js` and `submissionService.js` scaffolds; removed per review. An empty file with no logic and no caller is a forgotten promise, not a foundation — it'll be created in Phase 7 and Phase 4 respectively, when there's an actual first caller to design the function signature against. Same reasoning extends to `fileUploadService.js`, `notificationService.js` — created in the phase that actually needs them, not pre-staged now.

### 0.3 Existing files to be modified

```
backend/controllers/contactController.js
  createContact: replace inline field-merge + save with a call to contactService.createContact(...).
    Controller keeps: reading req.body/req.user/req.fileLocation, calling the service, and the
    exact same res.status(201).json(...) / catch -> res.status(400).json({error: err.message}).
  updateContact: same extraction for the body of the handler; the existing 403 permission-check
    block stays in the controller (it's route/request-context logic, not creation business logic —
    moving it into the service would blur the "service takes explicit params, not req" boundary
    the architecture doc calls for).

backend/controllers/companyController.js
  createCompany / updateCompany: same pattern as above, delegating to companyService.

backend/controllers/vendorController.js
  createVendor / updateVendor: same pattern, delegating to vendorService.
  CORRECTION during implementation: the module-scope processAdditionalFields() helper is
  NOT removed — grep confirmed it's also called from the bulk-import handler (line ~358),
  which is explicitly out of scope for this phase. Removing it would break bulk-import.
  It stays in place, now only used by bulk-import; createVendor/updateVendor no longer
  reference it.
```

**Not modified**: any route file (`contactRoutes.js`, `CompanyRoutes.js`, `vendorRoutes.js`) — middleware chains, paths, and permission gates are unchanged, since the service boundary sits below the controller, not at the route layer. Not modified: any model file (no schema changes, confirmed by the "zero database schema changes" requirement). Not modified: `bulk-import` handlers (inline in the route files) — out of scope for Phase 0, since the instruction is specifically "refactor existing Contact/Company/Vendor **creation flows**" (create/update), and bulk-import is a materially different code path with its own `insertMany` behavior that deserves its own review rather than being silently swept into this phase.

### 0.4 Dependency graph

```
fieldCoercionService.js  (no internal deps)
fieldValidationService.js (no internal deps, not wired in yet)
        │
        ├──> contactService.js  ──> ContactFields model, Contact model
        ├──> companyService.js  ──> CompanyFields model, Company model
        └──> vendorService.js   ──> VendorFields model, Vendor model
                     │
                     ▼
        contactController.js / companyController.js / vendorController.js
                     │
                     ▼
        contactRoutes.js / CompanyRoutes.js / vendorRoutes.js  (UNCHANGED)

duplicateEngine.js       — scaffold, no callers yet (Phase 7 wires it in)
submissionService.js     — scaffold, no callers yet (Phase 4 wires it in)
```

Build/land order: `fieldCoercionService` → one module service at a time (`vendorService` first, since it's the one with an existing reference implementation to generalize from and the extra JSON-parsing branch to validate against) → its controller → manual verification → repeat for `contactService`/`companyService` → `fieldValidationService` last (built but not wired, per §0.1 point... see note below). No `duplicateEngine`/`submissionService` in this phase's dependency graph at all — they don't exist yet (see §0.2 revision).

### 0.4a Transactions / MongoDB sessions — design note, not implemented this phase

Explicit answer to the question worth documenting now rather than after Forms needs it: **should service methods accept an optional MongoDB session/transaction parameter today?**

Today, no single Phase 0 operation spans more than one document write, so there's nothing to wrap in a transaction yet. But Forms will eventually need multi-document atomicity — e.g. a Contact-form submission that creates a Company *and* a Contact *and* links them (§2.5 of the architecture doc) should not leave an orphaned Company if the Contact save fails afterward.

Decision for Phase 0: **each service function accepts an optional trailing `{ session }` option, defaulted to `undefined`, and passes it through to `.save({ session })` / `Model.create([doc], { session })` / `findOneAndUpdate(..., { session })` wherever Mongoose accepts it.** This costs nothing today (an unused optional parameter, `undefined` behaves identically to no session) and means Phase 4/10's cross-entity submission flow can wrap `companyService.createCompany` + `contactService.createContact` in a single `mongoose.startSession()` transaction without a second refactor of these same functions. This is scoped narrowly — it is *not* "add transaction support," it's "leave the door open," and it changes zero behavior for any existing caller since nobody passes `session` yet.

Flagging one dependency to verify before relying on this: whether the MongoDB deployment backing this app runs as a replica set (transactions require it — a standalone `mongod` doesn't support them). Confirm this before Phase 4 actually opens a session, but the parameter can be added now regardless.

### 0.5 Service size discipline (per your instruction against "God Services")

Hard rule applied to this phase: `contactService.js`/`companyService.js`/`vendorService.js` contain **only** orchestration — fetch field defs, call `fieldCoercionService`, assemble the document, save, return. Any logic that isn't "shape the payload for this specific model" (e.g. the address JSON-parsing, the socialMedia normalization) either lives in its own small named function within the service file if it's module-specific, or gets pulled into `fieldCoercionService` if it turns out to be shared. If any one service file is approaching ~150–200 lines including its create+update pair, that's the signal to split further (e.g. a dedicated `socialMediaNormalizer.js`) rather than let it grow — flagged as a checkpoint to watch during implementation, not a violation to fix preemptively before writing any code.

### 0.5a Express-independence requirement (per your instruction)

Hard constraint on every function in `fieldCoercionService.js`, `fieldValidationService.js`, `contactService.js`, `companyService.js`, `vendorService.js`: **no parameter may be `req` or `res`, and no function may reference `req.*`/`res.*` in its body.** Every input a service needs (organizationId, userId, avatarUrl, raw field data) is passed explicitly by the controller as plain values. This is what makes these functions callable later from a background job, a queue worker, or the public Forms submission endpoint (none of which have an Express `req`) without a second extraction pass. Verified by inspection during code review of each new file before it's considered done — not just an aspiration.

### 0.6 Documentation requirement (per your instruction)

Every exported function in the new service files gets a header comment with: Purpose, Inputs (with types), Outputs, Side effects (DB writes, none-vs-throws), Errors thrown (exact shape), Known callers (updated as new callers are added in later phases — e.g. `contactService.createContact` will note "Phase 0: contactController. Phase 4 (planned): submissionService." so the caller list stays a living record rather than going stale).

### 0.7 Risks

- **Behavioral drift risk is the main one.** Because there's no test suite, "zero functional change" can only be verified by manual side-by-side testing (§0.8), not automated regression. This is the single biggest risk in this phase and the reason the build order above does one service at a time with a verification checkpoint between each, rather than all three at once.
- **The `ContactFields`-required-`createdBy` vs `CompanyFields`/`VendorFields`-no-`createdBy` asymmetry** could cause a subtle bug if `fieldCoercionService` is written assuming a uniform field-def shape. Mitigated by writing it against real fetched documents from all three models during implementation, not just the Contact case.
- **Vendor's stringified-JSON handling is easy to accidentally generalize into Contact/Company if not careful** — explicitly gated behind an opt-in parameter (§0.1 point 2) specifically to prevent this.
- **Multipart file field name differs per module** (`avatar` for Contact/Vendor, `profilePicture` for Company) — services take an already-resolved URL string as a parameter rather than knowing about `req.fileLocation`/field names at all, keeping that entirely in the controller/route layer.

### 0.8 How existing behavior will be verified preserved

No automated suite exists, so this is a manual regression pass — but run as a proper QA checklist with saved baselines, not ad hoc spot checks. Order: capture baselines for a module BEFORE touching its controller, refactor, then re-run the same checklist against the refactored code and diff.

**Baseline capture**: before refactoring each module, hit its endpoints via the existing frontend (or a REST client) and save raw JSON responses to `scratchpad/phase0-baseline/{module}-{case}.json` for every case below. After refactoring, repeat every case and diff the response body + status code against the saved baseline. Any diff is a regression unless it's something this plan explicitly calls out as intentionally preserved-as-inconsistent (e.g. don't expect the Vendor `{message}` vs Contact/Company `{error}` shapes to match *each other* — they never did; each just needs to match its own baseline).

**Contact** (`contact-*.json`)
- [ ] Create — required fields only (name, email, company)
- [ ] Create — with avatar file upload
- [ ] Create — without avatar
- [ ] Create — all base fields populated (phone, socialMedia x4)
- [ ] Create — additionalFields: one of each type (string, number, dropdown, text, url, date, multiselect)
- [ ] Create — additionalFields: unrecognized field key → confirm defaults to `type:"text"`
- [ ] Create — additionalFields: number field with non-numeric value → confirm `parseFloat(...)||0` behavior preserved
- [ ] Create — missing required base field (e.g. no `name`) → confirm Mongoose validation error, 400 shape
- [ ] Create — invalid `lifecycleStage`/`stageStatus` combination → confirm pre-save hook still rejects it
- [ ] Create — default `lifecycleStage`/`stageStatus` when omitted → confirm defaults to `Lead`/`New`
- [ ] Update — change base fields → confirm `findOneAndUpdate` result + populate shape unchanged
- [ ] Update — as a user without `contacts` read-write permission → confirm exact 403 message
- [ ] Update — non-existent `_id` → confirm 404 `"Contact not found"`
- [ ] Update — additionalFields same coverage as create (type coercion, unknown key, bad number)

**Company** (`company-*.json`)
- [ ] Create — required fields only (name, industry)
- [ ] Create — with profilePicture upload / without
- [ ] Create — GSTIN, address, website, socialMedia populated
- [ ] Create — additionalFields: same 7-type + unknown-key + bad-number coverage as Contact
- [ ] Create — missing required field (`name` or `industry`) → confirm validation error shape
- [ ] Create — with `parentCompany` set → confirm ref saved correctly
- [ ] Update — base fields → confirm response shape unchanged
- [ ] Update — as a user without `companies` read-write permission → confirm exact 403 message
- [ ] Update — non-existent `_id` → confirm 404 message
- [ ] Update — additionalFields coverage same as create

**Vendor** (`vendor-*.json`)
- [ ] Create — required fields only (name)
- [ ] Create — with avatar / without
- [ ] Create — `address` sent as a plain object (non-multipart) → confirm saved correctly
- [ ] Create — `address` sent as a JSON string (multipart) → confirm parsed correctly
- [ ] Create — `address` sent as a malformed JSON string → confirm exact `400 {message: "Invalid address format"}`
- [ ] Create — `additionalFields` sent as object vs JSON string, and malformed string → same three-way check, confirm `400 {message: "Invalid additionalFields format"}` on malformed
- [ ] Create — additionalFields: same 7-type + unknown-key + bad-number coverage as Contact/Company
- [ ] Create — GSTIN, phone, email, company (free-text) populated
- [ ] Update — base fields → confirm response shape unchanged
- [ ] Update — (no permission check exists on this route today) confirm still no 403 regardless of permission level, matching current behavior
- [ ] Update — non-existent `_id` → confirm 404 `"Vendor not found"`
- [ ] Update — additionalFields + address JSON-string coverage same as create

Every unchecked box after implementation is a blocker before Phase 0 is considered done.

---

*No files outside this log have been created or modified. Awaiting your review of this plan before touching `backend/controllers/*` or creating any `backend/services/*` file.*
