// services/formVersionService.js
// FormVersion creation mechanics: schemaHash computation (FORMS_SCHEMA.md §3a) and field-metadata
// resolution (the "resolve" half of publish = freeze(layout) + resolve(fieldIds) — FORMS_SCHEMA.md §3).
// No Express dependency — see FORMS_ARCHITECTURE.md's "services take explicit params, not req" rule.
const crypto = require("crypto");
const ContactFields = require("../models/ContactFields");
const CompanyFields = require("../models/CompanyFields");
const VendorFields = require("../models/VendorFields");
const Industry = require("../models/Industry");
const FormVersion = require("../models/FormVersion");
const { isSystemFieldId, getSystemFieldMeta, getSystemFieldModule } = require("../utils/systemFields");

const FIELD_MODEL_BY_MODULE = {
  Contact: ContactFields,
  Company: CompanyFields,
  Vendor: VendorFields,
};

/**
 * Purpose: Derive the owning CRM module (targetModule) of a single field element — the module
 * whose collection/service this captured value routes into. DERIVED, never user-supplied.
 * System fields carry their owner in the ID prefix ("system:company.x" -> Company); custom fields
 * resolve against the form's own module only (no cross-module custom fields exist today), so they
 * default to `formModule`.
 * Explicit, non-generic guard (FORMS_DOMAIN_MODEL.md "DO NOT GENERALIZE"): the ONLY supported
 * cross-module relationship is Contact->Company. Any field resolving to some other foreign module
 * (e.g. a Company system field inside a Vendor form — Vendor is fully isolated) is an invalid form
 * definition and fails the publish, rather than being silently mis-routed.
 * Inputs: formModule ("Contact"|"Company"|"Vendor"), element (a layout element)
 * Outputs: String targetModule
 * Errors thrown: on a disallowed foreign module
 */
function deriveTargetModule(formModule, element) {
  let owner = formModule;
  if (isSystemFieldId(element.fieldId)) {
    owner = getSystemFieldModule(element.fieldId) || formModule;
  }
  const isSameModule = owner === formModule;
  const isContactToCompany = formModule === "Contact" && owner === "Company";
  if (!isSameModule && !isContactToCompany) {
    throw new Error(
      `Invalid form definition: field "${element.fieldId}" resolves to module "${owner}", which is not permitted in a "${formModule}" form. The only supported cross-module relationship is Contact->Company.`
    );
  }
  return owner;
}

/**
 * Purpose: Return a plain-object copy of `layout` with `targetModule` derived onto every field
 * element (FORMS_SCHEMA.md §1a). This is the "resolve field ownership during publish" step — it
 * runs once, at publish time, and the result is what gets both hashed and frozen so submission
 * processing never needs a runtime ContactFields/CompanyFields lookup (FORMS_DOMAIN_MODEL.md
 * amendment; only the timing is architecturally required — the mechanism here happens to be the
 * system-field-ID prefix, an implementation detail).
 * Inputs: formModule, layout (FormDefinition.layout — Mongoose subdocs or plain objects)
 * Outputs: Array<Section> plain objects, every field element carrying `targetModule`
 * Errors thrown: propagates deriveTargetModule's invalid-module error
 * Known callers: formPublishService.publishForm
 */
function resolveLayoutTargetModules(formModule, layout) {
  return (layout || []).map((section) => {
    const s = typeof section.toObject === "function" ? section.toObject() : { ...section };
    s.elements = (s.elements || []).map((el) => {
      if (el.type !== "field") return el;
      return { ...el, targetModule: deriveTargetModule(formModule, el) };
    });
    return s;
  });
}

/**
 * Purpose: Enforce that a `fieldId` appears at most once across the entire layout — the invariant
 * multiple services already silently assume (resolveFields dedupes via a Set; coerceAndValidate
 * and buildCrmPayloads index by fieldId). With per-element targetModule, a repeated fieldId could
 * even carry conflicting routing, so this is enforced at publish time rather than documented and
 * hoped-for (FORMS_SCHEMA.md invariant #16).
 * Inputs: layout
 * Outputs: undefined
 * Errors thrown: on the first duplicate fieldId encountered
 * Known callers: formPublishService.publishForm
 */
function assertUniqueFieldIds(layout) {
  const seen = new Set();
  (layout || []).forEach((section) => {
    (section.elements || []).forEach((el) => {
      if (el.type !== "field" || !el.fieldId) return;
      if (seen.has(el.fieldId)) {
        throw new Error(
          `Invalid form definition: fieldId "${el.fieldId}" appears more than once in the layout. Each field may be placed at most once.`
        );
      }
      seen.add(el.fieldId);
    });
  });
}

/**
 * Purpose: Deterministic hash over the SCHEMA-boundary subset of a layout — structure only,
 * never labels/options/helpText/defaultValue (FORMS_SCHEMA.md §3a, Option A boundary).
 * Inputs: layout (FormDefinition.layout array, plain objects or Mongoose subdocs)
 * Outputs: String (SHA-256 hex)
 * Side effects: none
 * Errors thrown: none
 * Known callers: formPublishService.publishForm
 */
function computeSchemaHash(layout) {
  const structural = (layout || []).map((section) => ({
    order: section.order,
    // Where the form breaks across pages is structural: it changes what the visitor is shown and
    // in what sequence, exactly like element order. Note this shifts the hash for every existing
    // form, so the first publish after this ships mints one new version — a one-time, harmless
    // consequence of the field entering the structural boundary.
    startsNewPage: !!section.startsNewPage,
    elements: (section.elements || [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((el) => {
        if (el.type === "field") {
          return {
            type: "field",
            fieldId: el.fieldId,
            // Routing between Contact and Company is structural — changing it must mint a new
            // FormVersion (FORMS_SCHEMA.md §3a). Derived onto the layout before this runs.
            targetModule: el.targetModule || null,
            required: el.required || false,
            validationOverrides: el.validationOverrides || null,
          };
        }
        // Non-field elements: type + order affects structural sequence (§3a: "reordering what
        // the visitor sees and in what sequence is a structural change").
        return { type: el.type };
      }),
  }));

  const canonicalJson = JSON.stringify(structural);
  return crypto.createHash("sha256").update(canonicalJson).digest("hex");
}

/**
 * Purpose: Resolve one distinct fieldId's current metadata (label/type/options/baseRequired) —
 * the per-field lookup used to build FormVersion.resolvedFields.
 * Inputs: module ("Contact"|"Company"|"Vendor"), fieldId (String), organizationId
 * Outputs: Promise<{fieldId, source, label, type, options, baseRequired} | null> — null if a
 *   custom fieldId no longer exists (field was deleted; caller decides how to handle a dangling
 *   reference — see FORMS_ARCHITECTURE.md Open Decision D4).
 * Side effects: one read query per distinct custom fieldId (system fields: no DB access)
 * Errors thrown: none
 * Known callers: resolveFields (this file)
 */
async function resolveOneField(module, fieldId, organizationId) {
  if (isSystemFieldId(fieldId)) {
    const meta = getSystemFieldMeta(fieldId);
    if (!meta) return null;
    // Most system dropdowns have a fixed enum declared alongside their metadata (lifecycleStage,
    // leadSource) — carry it through so the public renderer has options without a lookup.
    let options = meta.options || [];
    if (fieldId === "system:company.industry") {
      // Industry has no fixed enum (Company.industry is a plain String) — its dropdown options
      // come from the org's Industry collection (defaults + org-created), the same source
      // CompanyIndustrySettings.jsx manages. Resolved at publish time and frozen into
      // resolvedFields so the public renderer never needs an authenticated lookup.
      const industries = await Industry.find(
        { $or: [{ isDefault: true }, { organization: organizationId }] },
        { name: 1 }
      ).sort({ isDefault: -1, name: 1 });
      options = industries.map((i) => i.name);
    }
    return { fieldId, source: "system", label: meta.label, type: meta.type, format: meta.format, options, baseRequired: meta.baseRequired };
  }

  const Model = FIELD_MODEL_BY_MODULE[module];
  if (!Model) return null;

  const fieldDefDoc = await Model.findOne(
    { organization: organizationId, "fields._id": fieldId },
    { "fields.$": 1 }
  );
  const fieldDef = fieldDefDoc && fieldDefDoc.fields && fieldDefDoc.fields[0];
  if (!fieldDef) return null;

  return {
    fieldId,
    source: "custom",
    label: fieldDef.name,
    type: fieldDef.type,
    options: fieldDef.options || [],
    baseRequired: fieldDef.required || false,
  };
}

/**
 * Purpose: Resolve every distinct fieldId referenced in a layout into FormVersion.resolvedFields.
 * Inputs: module, layout (array of sections), organizationId
 * Outputs: Promise<Array<ResolvedField>> — dangling references (deleted custom fields) are
 *   silently skipped, not included (caller/UI is responsible for surfacing D4-related warnings
 *   before this point; this function's job is just to resolve what's currently resolvable).
 * Side effects: one read query per distinct custom fieldId in the layout
 * Errors thrown: none
 * Known callers: formPublishService.publishForm
 */
async function resolveFields(module, layout, organizationId) {
  const fieldIds = new Set();
  (layout || []).forEach((section) => {
    (section.elements || []).forEach((el) => {
      if (el.type === "field" && el.fieldId) fieldIds.add(el.fieldId);
    });
  });

  const resolved = await Promise.all(
    Array.from(fieldIds).map((fieldId) => resolveOneField(module, fieldId, organizationId))
  );

  return resolved.filter(Boolean);
}

/**
 * Purpose: Refresh resolvedFields on an existing, already-active FormVersion in place — the one
 * deliberate exception to FormVersion immutability (FORMS_SCHEMA.md §3a: a label/option-only
 * field edit doesn't bump the version, but shouldn't leave the live version's display metadata
 * stale either).
 * Inputs: formVersionId, module, organizationId
 * Outputs: Promise<FormVersionDocument>
 * Side effects: one FormVersion write, touching ONLY resolvedFields (never layout/schemaHash)
 * Errors thrown: throws if formVersionId doesn't resolve to a document
 * Known callers: formPublishService.publishForm (the "unchanged, reuse" branch)
 */
async function refreshResolvedFields(formVersionId, module, organizationId) {
  const version = await FormVersion.findById(formVersionId);
  if (!version) throw new Error("FormVersion not found");

  version.resolvedFields = await resolveFields(module, version.layout, organizationId);
  await version.save();
  return version;
}

// The exact complement of what computeSchemaHash covers (§3a, Option A boundary): every element
// property that is presentation, not structure. Structural properties — type, fieldId, source,
// targetModule, required, validationOverrides, order — are deliberately absent and must never be
// refreshed in place, because changing one of them is what mints a new FormVersion.
const PRESENTATION_ELEMENT_FIELDS = [
  "text", "fontSize", "fontWeight", "textAlign", "textColor", "layoutWidth",
  "height",
  "dividerThickness", "dividerColor", "dividerSpacingTop", "dividerSpacingBottom",
  "url", "alt", "imageWidth",
  "label", "color", "position", "style",
  "helpText", "placeholder", "defaultValue",
];

function plain(doc) {
  return doc && typeof doc.toObject === "function" ? doc.toObject() : doc;
}

/**
 * Purpose: Project the draft layout's PRESENTATION-only values onto a frozen layout, preserving
 * every structural value from the frozen copy. Returns null if the two layouts don't line up
 * element-for-element — a caller should then leave the frozen layout untouched rather than guess.
 * Inputs: frozenLayout (FormVersion.layout), draftLayout (FormDefinition.layout, targetModule-resolved)
 * Outputs: Array (new plain-object layout) | null
 * Side effects: none (pure transform)
 */
function mergePresentationIntoLayout(frozenLayout, draftLayout) {
  const frozen = (frozenLayout || []).map(plain);
  const draft = (draftLayout || []).map(plain);
  if (frozen.length !== draft.length) return null;

  const merged = [];
  for (let i = 0; i < frozen.length; i++) {
    const fSec = frozen[i];
    const dSec = draft[i];
    // Sort both the same way computeSchemaHash does, so a matching hash guarantees these two
    // sequences are element-for-element equivalent and can be paired by index.
    const fEls = (fSec.elements || []).map(plain).slice().sort((a, b) => a.order - b.order);
    const dEls = (dSec.elements || []).map(plain).slice().sort((a, b) => a.order - b.order);
    if (fEls.length !== dEls.length) return null;

    const elements = fEls.map((fEl, j) => {
      const dEl = dEls[j];
      if (!dEl || dEl.type !== fEl.type) return fEl; // defensive: hash equality should rule this out
      const next = { ...fEl };
      for (const key of PRESENTATION_ELEMENT_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(dEl, key) && dEl[key] !== undefined) {
          next[key] = dEl[key];
        } else {
          // Cleared in the draft (e.g. an image's URL removed) — clear it on the frozen copy too,
          // rather than leaving the old value stranded on the live version.
          delete next[key];
        }
      }
      return next;
    });

    // Section title/description are presentation as well — computeSchemaHash reads only
    // section.order and the element sequence.
    merged.push({ ...fSec, title: dSec.title, description: dSec.description, elements });
  }
  return merged;
}

/**
 * Purpose: Push presentation-only edits (image URL/size/position, heading text, divider styling,
 * help text, button label...) onto an already-active FormVersion whose structure is unchanged.
 *
 * Why this exists: §3a deliberately keeps presentation OUT of schemaHash so that retitling a
 * heading or swapping a logo doesn't mint a new version and strand old submissions. But layout is
 * frozen, so without this the live form would keep serving the presentation it had at first
 * publish — republishing appeared to do nothing. This is the same in-place exception, and the same
 * reasoning, as refreshResolvedFields above (which does it for labels/options); it is deliberately
 * narrow, touching only PRESENTATION_ELEMENT_FIELDS and never a structural property.
 *
 * Inputs: formVersionId, draftLayout (the targetModule-resolved FormDefinition.layout)
 * Outputs: Promise<void>
 * Side effects: at most one FormVersion write, touching ONLY layout (never schemaHash/versionNumber).
 *   No-ops if the layouts don't align element-for-element.
 * Errors thrown: none beyond driver errors
 * Known callers: formPublishService.publishForm (the "unchanged, reuse" branch)
 */
async function refreshLayoutPresentation(formVersionId, draftLayout) {
  const version = await FormVersion.findById(formVersionId);
  if (!version) throw new Error("FormVersion not found");

  const merged = mergePresentationIntoLayout(version.layout, draftLayout);
  if (!merged) return;

  // `layout` is immutable: true, which is exactly the protection we want against a structural
  // rewrite — so this bypass is explicit and scoped to this one call rather than being unlocked
  // schema-wide. schemaHash and versionNumber are untouched and stay immutable.
  await FormVersion.updateOne({ _id: formVersionId }, { $set: { layout: merged } }, { overwriteImmutable: true });
}

module.exports = {
  computeSchemaHash,
  resolveFields,
  refreshResolvedFields,
  refreshLayoutPresentation,
  mergePresentationIntoLayout,
  deriveTargetModule,
  resolveLayoutTargetModules,
  assertUniqueFieldIds,
};
