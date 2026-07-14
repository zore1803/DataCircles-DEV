// utils/systemFields.js
// Stable-ID registry for system (non-custom) fields — FORMS_SCHEMA.md §1c.
// Not a Mongo collection: system fields aren't user-creatable/deletable, so there's no CRUD
// reason to store them as documents. These string constants are APPEND-ONLY once shipped
// (FORMS_SCHEMA.md invariant #10) — never rename or repurpose an existing key.

const SYSTEM_FIELD_IDS = {
  Contact: {
    name: "system:contact.name",
    email: "system:contact.email",
    phone: "system:contact.phone",
    company: "system:contact.company",
  },
  Company: {
    name: "system:company.name",
    industry: "system:company.industry",
    gstin: "system:company.gstin",
    address: "system:company.address",
    website: "system:company.website",
    profilePicture: "system:company.profilePicture",
  },
  Vendor: {
    name: "system:vendor.name",
    gstin: "system:vendor.gstin",
    phone: "system:vendor.phone",
    email: "system:vendor.email",
    company: "system:vendor.company",
    address: "system:vendor.address",
  },
};

// Metadata mirrors what a resolvedFields entry needs (label/type/baseRequired) — see
// FORMS_SCHEMA.md §3 resolvedFieldSchema. Kept alongside the ID constants since both are
// static, code-defined facts about system fields, not database-derived ones.
const SYSTEM_FIELD_META = {
  "system:contact.name": { label: "Name", type: "string", baseRequired: false },
  "system:contact.email": { label: "Email", type: "string", baseRequired: false },
  "system:contact.phone": { label: "Phone", type: "string", baseRequired: false },
  "system:contact.company": { label: "Company", type: "string", baseRequired: false },
  "system:company.name": { label: "Company Name", type: "string", baseRequired: true },
  "system:company.industry": { label: "Industry", type: "dropdown", baseRequired: true },
  "system:company.gstin": { label: "GSTIN", type: "string", baseRequired: false },
  "system:company.address": { label: "Address", type: "string", baseRequired: false },
  "system:company.website": { label: "Website", type: "url", baseRequired: false },
  "system:company.profilePicture": { label: "Profile Picture", type: "url", baseRequired: false },
  "system:vendor.name": { label: "Vendor Name", type: "string", baseRequired: true },
  "system:vendor.gstin": { label: "GSTIN", type: "string", baseRequired: false },
  "system:vendor.phone": { label: "Phone", type: "string", baseRequired: false },
  "system:vendor.email": { label: "Email", type: "string", baseRequired: false },
  "system:vendor.company": { label: "Company", type: "string", baseRequired: false },
  "system:vendor.address": { label: "Address", type: "string", baseRequired: false },
};

function isSystemFieldId(fieldId) {
  return typeof fieldId === "string" && fieldId.startsWith("system:");
}

function getSystemFieldMeta(fieldId) {
  return SYSTEM_FIELD_META[fieldId] || null;
}

// Reverse lookup: "system:contact.email" -> { module: "Contact", crmFieldName: "email" }.
// Needed to translate a submission's fieldId-keyed processedData back into the plain
// CRM-schema-keyed payload the module create/update services and duplicate engine expect.
const REVERSE_LOOKUP = {};
for (const [module, fields] of Object.entries(SYSTEM_FIELD_IDS)) {
  for (const [crmFieldName, fieldId] of Object.entries(fields)) {
    REVERSE_LOOKUP[fieldId] = { module, crmFieldName };
  }
}

function getCrmFieldNameForSystemId(fieldId) {
  const entry = REVERSE_LOOKUP[fieldId];
  return entry ? entry.crmFieldName : null;
}

// The owning CRM module encoded in a system field ID: "system:company.website" -> "Company".
// Used at publish time to derive an element's targetModule (formVersionService). Returns null
// for a non-system or unknown ID (caller falls back to the form's own module).
function getSystemFieldModule(fieldId) {
  const entry = REVERSE_LOOKUP[fieldId];
  return entry ? entry.module : null;
}

module.exports = {
  SYSTEM_FIELD_IDS,
  SYSTEM_FIELD_META,
  isSystemFieldId,
  getSystemFieldMeta,
  getCrmFieldNameForSystemId,
  getSystemFieldModule,
};
