// Mirrors backend/utils/fieldTypeContract.js — the `supports` map ONLY.
//
// Same rationale as SYSTEM_FIELDS in FormBuilderPage.jsx: no endpoint exposes this static registry,
// so it is inlined rather than fetched, following this codebase's established "copy, don't extract"
// pattern for Forms.
//
// The enforcement rules themselves are deliberately NOT duplicated here. The backend validator is
// the sole authority — a public form is entirely under the submitter's control, so anything checked
// only in the browser is decoration. What this copy decides is narrower and purely visual: which
// controls the Properties panel is allowed to render. Keeping that in step with the backend's
// `supports` is what stops the Builder offering configuration nothing enforces, which is exactly
// how min/max/regex came to be stored-but-ignored.
//
// If you add a key to a type here, add the rule that enforces it in the backend file FIRST.

export const FIELD_TYPE_CONTRACT = {
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
    supports: { placeholder: true, defaultValue: true, options: true },
  },
  multiselect: {
    label: "Multi-select",
    supports: { options: true, min: "count", max: "count" },
  },
  file: {
    label: "File upload",
    supports: {},
  },
};

// The limits the public upload endpoint actually enforces, shown read-only so the owner knows what
// applies. Not configurable per field — see the backend file for why.
export const FILE_UPLOAD_LIMITS = { accepted: ["JPG", "PNG", "WEBP", "GIF"], maxSizeMb: 5 };

export function supportsFor(type) {
  return (FIELD_TYPE_CONTRACT[type] || FIELD_TYPE_CONTRACT.string).supports;
}

export function typeLabel(type) {
  return (FIELD_TYPE_CONTRACT[type] || FIELD_TYPE_CONTRACT.string).label;
}

// Human wording for the min/max pair, which means something different per type.
export const BOUND_LABELS = {
  length: { min: "Minimum length", max: "Maximum length", unit: "characters", input: "number" },
  value: { min: "Minimum value", max: "Maximum value", unit: "", input: "number" },
  date: { min: "Earliest date", max: "Latest date", unit: "", input: "date" },
  count: { min: "Minimum selections", max: "Maximum selections", unit: "", input: "number" },
};
