# Forms Schema — Implementation Notes

Not design documents. This captures items surfaced during the FORMS_SCHEMA.md review pass that are real but belong to the implementation phase (Mongoose mechanics, service-layer concurrency/retry handling) or need a product decision rather than a schema change — kept out of FORMS_SCHEMA.md so that document stays a persistence design, not an implementation guide.

## Mongoose implementation mechanics (address when writing the actual model files)

- **`rawData`/`processedData`/`incomingData` are `Mixed`-typed.** Mongoose doesn't auto-detect in-place mutations to `Mixed` fields. Anywhere `processedData` is re-processed (not fully reassigned), call `.markModified('processedData')` or the write silently won't persist.
- **`FormVersion.layout`/`schemaHash` immutability alongside a mutable `resolvedFields`** on the same document: use per-path `immutable: true` on `layout` and `schemaHash` specifically, not a blanket pre-save hook (which would also block the legitimate `resolvedFields` refresh).
- **`resultingRecord` (`FormSubmission`) and `existingRecord` (`DuplicateReview`)** are polymorphic references (`{module, recordId}` pointing at one of Contact/Company/Vendor). Use Mongoose's `refPath` option so `.populate()` works, rather than a plain unref'd ObjectId.
- **`publicSlug`'s partial unique index** needs `schema.index({...}, {partialFilterExpression: {...}})` — the path-level `unique: true` shorthand doesn't support partial filters.
- **The `layout[].elements[]` tagged union** (discriminated by `type`) will likely be awkward with Mongoose's native `Schema.discriminator()`, which handles nested-array discriminators poorly. Expect to write manual per-`type` validation logic in a pre-save hook or custom validator rather than relying on the discriminator API.

## Service-layer concurrency, retry, and race handling (address when writing the publish/submission services)

- **Concurrent publish race**: two simultaneous publish actions on the same `FormDefinition` can both compute the same "next" `versionNumber` and collide on the unique `{formDefinition, versionNumber}` index. Needs an atomic increment (e.g. `findOneAndUpdate` with `$inc` on a counter) or a catch-and-retry on the resulting `E11000` duplicate-key error.
- **Partial-write mid-publish is self-healing, but only if retried correctly.** If a crash happens between creating a `FormVersion` and updating `activeFormVersionId`, a retry's schemaHash-compare-and-reuse logic will correctly find and reuse the orphaned version — **provided the retry queries "latest `FormVersion` by `versionNumber`" and not "latest `FormVersion` ever pointed at by `publishState`."** Get this query wrong and the self-healing property breaks.
- **TOCTOU on pause/archive during an in-flight submission**: a visitor's page may have loaded while the form was still `published`. The public submit endpoint must re-check `status === "published"` (and that `activeFormVersionId` hasn't changed) at submission time, not trust that the earlier `GET` succeeded.
- **`DuplicateReview` creation isn't retry-safe.** If submission processing crashes after creating a `DuplicateReview` but before finishing the rest of the pipeline, a naive retry can create a second `DuplicateReview` for the same submission+existingRecord pair. No idempotency guarantee or uniqueness constraint currently prevents this. Recommend a partial-unique index on `{formSubmission, existingRecord.module, existingRecord.recordId}` (where `formSubmission` is non-null) once this phase is implemented — flagged here, not added to the schema now, since it's a retry-safety mechanism, not a persistence-design requirement.
- **No optimistic concurrency control on `FormDefinition`** (no `__v` check, no dedicated revision field enforced on write) — two concurrent editors can silently last-write-wins clobber each other's draft edits. Decide the mechanism (Mongoose's built-in `__v`, a custom `revision` counter, or accept last-write-wins for v1) when building the builder's save endpoint — not a schema-shape decision.
- **Concurrent submissions racing the "don't re-ask" check**: two near-simultaneous submissions matching the same existing record can both miss each other's in-flight `DuplicateReview` and create duplicate pending reviews. Low severity (review-queue noise, not data corruption) — acceptable to defer past v1.

## Needs a product decision, not a schema change

- **Can a `rejected` `FormSubmission` be manually recovered/reopened** (e.g. a human overrides an auto-rejection)? Current schema has no transition back from `processingStatus: "rejected"`. If the answer is "rejected is genuinely terminal," no schema change needed. If not, `processingStatus` needs a recovery transition defined.
- **Can a `DuplicateReview` decision be reopened** if it turns out wrong? Currently `decision` has no "reconsider" path, and the "don't ask again" mechanism means a wrong `kept_separate` call is never resurfaced automatically. May be acceptable if manual merge exists elsewhere in the CRM as the correction path — needs confirming, not assuming.
- **`SubmissionEvent` retention/archival strategy** at scale — the domain model's "never hard-delete" rule means this collection grows unbounded forever. Not a v1 blocker, but worth an explicit future decision (cold storage, TTL after N years, etc.) rather than silently discovering it's a problem later.

## Explicitly out of scope for this schema pass (not forgotten, just not here)

- **`createdVia` provenance field on the existing `Contact`/`Company`/`Vendor` models** (per FORMS_ARCHITECTURE.md §2.5, needed for the "this record came from a form" UI). FORMS_SCHEMA.md scoped itself to the five new Forms collections only; modifying the three existing CRM models is a deliberate later step, not an oversight — noted here so it isn't lost before that phase.
