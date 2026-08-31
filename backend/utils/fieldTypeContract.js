// utils/fieldTypeContract.js
//
// THE canonical contract for what each field type supports and how its configuration is enforced.
//
// Why this file exists: the Builder used to decide which controls to show, and the submission
// validator independently decided what to check — and the two never agreed. The result was a form
// owner setting "Maximum Length: 10" in the Builder, that value being frozen into the FormVersion
// and hashed as structural, and then never being read at submit time. Min, max, regex,
// restrictPastDates, restrictFutureDates and allowedDomains were ALL stored-but-ignored: a
// submission violating every one of them came back `validationErrors: []`, status `validated`, and
// created a CRM record.
//
// The rule this file enforces: anything the Builder exposes must be enforced HERE, server-side.
// The browser may mirror these rules for immediate feedback, but a public form is entirely under
// the submitter's control, so the client is never authoritative.
//
// `supports` drives BOTH the Builder's property panel and the checks below, so a control cannot
// exist without a rule behind it. The `min`/`max` values say what those two Mixed schema fields
// MEAN for that type — the same stored key is a character count for text, a numeric bound for
// numbers, a date for dates and a selection count for multi-select.

const FIELD_TYPE_CONTRACT = {
  string: {
    label: "Short text",
    supports: { placeholder: true, defaultValue: true, min: "length", max: "length", regex: true },
  },
  text: {
    label: "Long text",
    supports: { placeholder: true, defaultValue: true, min: "length", max: "length", regex: true },
  },
  number: {
    label: "Number",
    supports: { placeholder: true, defaultValue: true, min: "value", max: "value" },
  },
  url: {
    label: "URL",
    supports: { placeholder: true, defaultValue: true, regex: true },
  },
  date: {
    label: "Date",
    supports: { defaultValue: true, min: "date", max: "date", restrictPastDates: true, restrictFutureDates: true },
  },
  dropdown: {
    label: "Dropdown",
    // No min/max/regex: the value is constrained by being one of `options`, which is a stronger
    // and more understandable guarantee than a length bound on a value the visitor never types.
    supports: { placeholder: true, defaultValue: true, options: true },
  },
  multiselect: {
    label: "Multi-select",
    supports: { options: true, min: "count", max: "count" },
  },
  file: {
    // Deliberately supports NOTHING configurable. Accepted types and the size cap are enforced by
    // the public upload endpoint itself (middlewares/uploadMiddlewarePublicForm.js: JPG/PNG/WEBP/GIF,
    // 5MB) and are the same for every file field. Exposing per-field controls here would mean
    // storing limits the upload path does not read — precisely the stored-but-ignored bug this
    // file exists to prevent. The Builder shows the real limits as read-only text instead.
    label: "File upload",
    supports: {},
  },
};

// Enforced limits of the public upload endpoint, surfaced so the Builder can TELL the owner what
// actually applies rather than pretending it is configurable. Keep in step with
// middlewares/uploadMiddlewarePublicForm.js.
const FILE_UPLOAD_LIMITS = { accepted: ["JPG", "PNG", "WEBP", "GIF"], maxSizeMb: 5 };

// A user-authored regex runs against visitor-supplied input, which is a catastrophic-backtracking
// (ReDoS) vector. The regex author is an authenticated form owner rather than the public, so this
// is a footgun rather than an attack surface — but a careless pattern plus a long submission could
// still stall the request. Bounding the tested length bounds the blow-up.
const MAX_REGEX_TEST_LENGTH = 1000;

function supportsFor(type) {
  return (FIELD_TYPE_CONTRACT[type] || FIELD_TYPE_CONTRACT.string).supports;
}

function isBlank(v) {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

function toDate(v) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Purpose: Validate ONE submitted value against its field's type and the owner's configuration.
 *   The single authority for "is this submission acceptable" — the Builder shows only what this
 *   function can enforce.
 * Inputs:
 *   value      — the raw submitted value (string, number, or array for multi-select)
 *   meta       — resolvedFields entry: { type, label, options, format? }
 *   overrides  — element.validationOverrides (frozen on the FormVersion), may be undefined
 * Outputs: String error message, or null when the value is acceptable.
 * Side effects: none
 * Errors thrown: none — an unparseable owner-supplied regex is ignored rather than failing the
 *   submission, since a visitor cannot fix a misconfigured form and their data should not be lost.
 * Known callers: submissionService.coerceAndValidate
 */
function validateFieldValue(value, meta, overrides) {
  // Presence is handled by the caller (it knows about `required`); a blank optional value is fine
  // and must not be measured against a minimum.
  if (isBlank(value)) return null;

  const type = meta?.type || "string";
  const label = meta?.label || "This field";
  const supports = supportsFor(type);
  const o = overrides || {};

  const hasMin = o.min !== undefined && o.min !== null && o.min !== "";
  const hasMax = o.max !== undefined && o.max !== null && o.max !== "";

  // --- Dropdown: the value must be one of the frozen options -----------------------------------
  if (supports.options && type === "dropdown") {
    const options = meta?.options || [];
    if (options.length > 0 && !options.includes(String(value))) {
      return `${label} must be one of the available choices`;
    }
  }

  // --- Multi-select: every choice valid, plus how many may be picked ---------------------------
  if (type === "multiselect") {
    const chosen = Array.isArray(value) ? value : String(value).split(",").map((s) => s.trim()).filter(Boolean);
    const options = meta?.options || [];
    if (options.length > 0) {
      const unknown = chosen.find((c) => !options.includes(c));
      if (unknown) return `${label} contains a choice that isn't available`;
    }
    if (hasMin && chosen.length < Number(o.min)) return `${label} needs at least ${o.min} selected`;
    if (hasMax && chosen.length > Number(o.max)) return `${label} allows at most ${o.max} selected`;
    return null;
  }

  // --- Number ----------------------------------------------------------------------------------
  if (supports.min === "value" || supports.max === "value") {
    const n = Number(value);
    if (Number.isNaN(n)) return `${label} must be a number`;
    if (hasMin && n < Number(o.min)) return `${label} must be at least ${o.min}`;
    if (hasMax && n > Number(o.max)) return `${label} must be at most ${o.max}`;
    return null;
  }

  // --- Date ------------------------------------------------------------------------------------
  if (type === "date") {
    const d = toDate(value);
    if (!d) return `${label} must be a valid date`;
    if (hasMin) {
      const minD = toDate(o.min);
      if (minD && d < minD) return `${label} must be on or after ${o.min}`;
    }
    if (hasMax) {
      const maxD = toDate(o.max);
      if (maxD && d > maxD) return `${label} must be on or before ${o.max}`;
    }
    if (o.restrictPastDates && d < startOfToday()) return `${label} cannot be in the past`;
    if (o.restrictFutureDates && d > startOfToday()) return `${label} cannot be in the future`;
    return null;
  }

  // --- Text-ish (string / text / url) ----------------------------------------------------------
  const s = String(value);

  if (supports.min === "length" && hasMin && s.length < Number(o.min)) {
    return `${label} must be at least ${o.min} characters`;
  }
  if (supports.max === "length" && hasMax && s.length > Number(o.max)) {
    return `${label} must be no more than ${o.max} characters`;
  }

  // `format` is carried on the field's metadata, not its type: the CRM stores email and phone as
  // plain strings, so there is no distinct "email" type to branch on (see systemFields.js).
  if (meta?.format === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return `${label} must be a valid email address`;
    const domains = Array.isArray(o.allowedDomains) ? o.allowedDomains.filter(Boolean) : [];
    if (domains.length > 0) {
      const domain = s.split("@")[1]?.toLowerCase();
      const ok = domains.some((d) => domain === String(d).toLowerCase().replace(/^@/, ""));
      if (!ok) return `${label} must use one of these domains: ${domains.join(", ")}`;
    }
  }

  if (type === "url" && !/^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(s)) {
    return `${label} must be a valid URL starting with http:// or https://`;
  }

  if (supports.regex && o.regex) {
    if (s.length <= MAX_REGEX_TEST_LENGTH) {
      try {
        if (!new RegExp(o.regex).test(s)) return `${label} is not in the expected format`;
      } catch {
        // Invalid pattern saved by the owner — ignore it rather than rejecting a submission the
        // visitor has no way to fix.
      }
    }
  }

  return null;
}

module.exports = { FIELD_TYPE_CONTRACT, FILE_UPLOAD_LIMITS, validateFieldValue, supportsFor };
