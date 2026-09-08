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
    avatar: "system:contact.avatar",
    // Contact.lifecycleStage is a required enum with a "Lead" default. stageStatus is deliberately
    // NOT exposed: the model's pre-save hook rejects invalid (lifecycleStage, stageStatus) pairs,
    // so letting a visitor pick them independently would turn a normal submission into a
    // ValidationError. contactService derives the correct stageStatus from lifecycleStage whenever
    // stageStatus is absent (DEFAULT_STAGE_STATUSES), which is exactly what a form submission wants.
    lifecycleStage: "system:contact.lifecycleStage",
    // Deliberately no `company` entry here: Contact.company is an ObjectId ref (see Contact.js),
    // not a value a visitor can type. A Contact form collects the relationship via the Company
    // system fields instead (system:company.name, etc.) — submissionService's Contact->Company
    // bucket logic creates/links the Company and sets this ref server-side. Exposing this as a
    // fillable field is what caused the CastError("company") incident; do not re-add it.
    "socialMedia.twitter": "system:contact.socialMedia.twitter",
    "socialMedia.linkedin": "system:contact.socialMedia.linkedin",
    "socialMedia.facebook": "system:contact.socialMedia.facebook",
    "socialMedia.whatsapp": "system:contact.socialMedia.whatsapp",
  },
  Company: {
    name: "system:company.name",
    industry: "system:company.industry",
    gstin: "system:company.gstin",
    // Legacy single-line address. Company.address still exists on the model ("kept for
    // search/back-compat"), so this keeps working — but the CRM's own create form no longer
    // collects it, having moved to the structured billing/shipping addresses below. Retained for
    // already-published forms; dropped from the Builder palette so new forms use the structured set.
    address: "system:company.address",
    email: "system:company.email",
    leadSource: "system:company.leadSource",
    website: "system:company.website",
    profilePicture: "system:company.profilePicture",
    // Structured postal addresses (Company.postalAddressSchema). Exactly one billing address —
    // GST (CGST/SGST vs IGST) is derived from its state, so it is the load-bearing one.
    "billingAddress.addressLine1": "system:company.billingAddress.addressLine1",
    "billingAddress.addressLine2": "system:company.billingAddress.addressLine2",
    "billingAddress.city": "system:company.billingAddress.city",
    "billingAddress.state": "system:company.billingAddress.state",
    "billingAddress.pincode": "system:company.billingAddress.pincode",
    "billingAddress.country": "system:company.billingAddress.country",
    // Company.shippingAddresses is an ARRAY and the CRM UI supports "+ Add another". A static form
    // layout can only express ONE, so these map into element [0] (see ARRAY_CRM_PARENT_KEYS and
    // submissionService.buildCrmPayloads). Field IDs are singular to reflect that.
    "shippingAddresses.addressLine1": "system:company.shippingAddress.addressLine1",
    "shippingAddresses.addressLine2": "system:company.shippingAddress.addressLine2",
    "shippingAddresses.city": "system:company.shippingAddress.city",
    "shippingAddresses.state": "system:company.shippingAddress.state",
    "shippingAddresses.pincode": "system:company.shippingAddress.pincode",
    "shippingAddresses.country": "system:company.shippingAddress.country",
    "socialMedia.twitter": "system:company.socialMedia.twitter",
    "socialMedia.linkedin": "system:company.socialMedia.linkedin",
    "socialMedia.facebook": "system:company.socialMedia.facebook",
    "socialMedia.whatsapp": "system:company.socialMedia.whatsapp",
  },
  Vendor: {
    name: "system:vendor.name",
    gstin: "system:vendor.gstin",
    phone: "system:vendor.phone",
    email: "system:vendor.email",
    company: "system:vendor.company",
    avatar: "system:vendor.avatar",
    // Vendor.address became a NESTED object ({line1,line2,city,state,pincode,country}) — note
    // `line1`, not `addressLine1` as Company uses. The old flat "system:vendor.address" is handled
    // by LEGACY_CRM_FIELD_REMAP below, not by a key here (a crmFieldName may appear only once).
    "address.line1": "system:vendor.address.line1",
    "address.line2": "system:vendor.address.line2",
    "address.city": "system:vendor.address.city",
    "address.state": "system:vendor.address.state",
    "address.pincode": "system:vendor.address.pincode",
    "address.country": "system:vendor.address.country",
    "socialMedia.twitter": "system:vendor.socialMedia.twitter",
    "socialMedia.linkedin": "system:vendor.socialMedia.linkedin",
    // Vendor's socialMediaSchema is the only one of the three that has instagram.
    "socialMedia.instagram": "system:vendor.socialMedia.instagram",
    "socialMedia.facebook": "system:vendor.socialMedia.facebook",
    "socialMedia.whatsapp": "system:vendor.socialMedia.whatsapp",
  },
};

// Field IDs whose CRM target moved after they shipped. The append-only rule (invariant #10) forbids
// renaming or repurposing a shipped ID, and these entries don't: they keep the ID meaning exactly
// what it always meant, while pointing it at where that value now lives on the model.
//
// "system:vendor.address" shipped when Vendor.address was a plain String. It is now a nested object,
// so a flat string assigned to it is silently DISCARDED by Mongoose — a visitor's address typed into
// an already-published Vendor form vanished with no error. Routing it to address.line1 preserves the
// submitted value; the alternative (leave it) is guaranteed data loss.
const LEGACY_CRM_FIELD_REMAP = {
  "system:vendor.address": "address.line1",
};

// CRM parent keys that are ARRAYS on the model rather than single nested objects. A form layout can
// only express one entry, so submissionService writes into element [0].
const ARRAY_CRM_PARENT_KEYS = new Set(["shippingAddresses"]);

// Shared by Company.leadSource and (in the CRM UI) Contact — kept in one place so the form's
// dropdown can't drift from what the CRM's own create forms offer.
const LEAD_SOURCE_OPTIONS = ["Referral", "Website", "Cold Call", "Social Media", "Event", "Advertisement", "Other"];

// Metadata mirrors what a resolvedFields entry needs (label/type/baseRequired) — see
// FORMS_SCHEMA.md §3 resolvedFieldSchema. Kept alongside the ID constants since both are
// static, code-defined facts about system fields, not database-derived ones.
const SYSTEM_FIELD_META = {
  "system:contact.name": { label: "Name", type: "string", baseRequired: true },
  // format is carried on the metadata, not the type: the CRM stores email as a plain String, so
  // there is no distinct "email" type for the validator to branch on. fieldTypeContract reads this.
  "system:contact.email": { label: "Email", type: "string", format: "email", baseRequired: true },
  // baseRequired mirrors what the CRM's own Create Contact form enforces (phone is marked * there).
  "system:contact.phone": { label: "Phone", type: "string", baseRequired: true },
  "system:contact.avatar": { label: "Profile Picture", type: "file", baseRequired: false },
  "system:contact.lifecycleStage": {
    label: "Lifecycle Stage",
    type: "dropdown",
    baseRequired: false, // model defaults to "Lead"; contactService fills it when absent
    options: ["Lead", "Sales Qualified Lead", "Customer"],
  },
  "system:company.name": { label: "Company Name", type: "string", baseRequired: true },
  "system:company.industry": { label: "Industry", type: "dropdown", baseRequired: true },
  "system:company.gstin": { label: "GSTIN", type: "string", baseRequired: false },
  "system:company.address": { label: "Address (legacy single line)", type: "string", baseRequired: false },
  "system:company.email": { label: "Email Address", type: "string", format: "email", baseRequired: false },
  "system:company.leadSource": { label: "Lead Source", type: "dropdown", baseRequired: false, options: LEAD_SOURCE_OPTIONS },
  "system:company.website": { label: "Website", type: "url", baseRequired: false },
  // Billing address: baseRequired mirrors the CRM's Create Company form, where line 1, city, state,
  // pincode and country are starred and line 2 is optional.
  "system:company.billingAddress.addressLine1": { label: "Billing Address Line 1", type: "string", baseRequired: false },
  "system:company.billingAddress.addressLine2": { label: "Billing Address Line 2", type: "string", baseRequired: false },
  "system:company.billingAddress.city": { label: "Billing City", type: "string", baseRequired: false },
  "system:company.billingAddress.state": { label: "Billing State", type: "string", baseRequired: false },
  "system:company.billingAddress.pincode": { label: "Billing Pincode", type: "string", baseRequired: false },
  "system:company.billingAddress.country": { label: "Billing Country", type: "string", baseRequired: false },
  "system:company.shippingAddress.addressLine1": { label: "Shipping Address Line 1", type: "string", baseRequired: false },
  "system:company.shippingAddress.addressLine2": { label: "Shipping Address Line 2", type: "string", baseRequired: false },
  "system:company.shippingAddress.city": { label: "Shipping City", type: "string", baseRequired: false },
  "system:company.shippingAddress.state": { label: "Shipping State", type: "string", baseRequired: false },
  "system:company.shippingAddress.pincode": { label: "Shipping Pincode", type: "string", baseRequired: false },
  "system:company.shippingAddress.country": { label: "Shipping Country", type: "string", baseRequired: false },
  // type: "file" — the visitor uploads an image (via POST /api/public/forms/:slug/upload, which
  // returns a URL) rather than pasting one. The value stored server-side is still a plain URL
  // string, identical in shape to a "url"-typed field — fieldCoercionService's default branch
  // (String(value)) and submissionService's coerceAndValidate need no changes for this type.
  "system:company.profilePicture": { label: "Profile Picture / Logo", type: "file", baseRequired: false },
  "system:vendor.name": { label: "Vendor Name", type: "string", baseRequired: true },
  // Starred in the CRM's Create Vendor form (it's the key the GSTIN "Fetch" auto-fill runs on).
  "system:vendor.gstin": { label: "GSTIN", type: "string", baseRequired: true },
  "system:vendor.phone": { label: "Phone", type: "string", baseRequired: false },
  "system:vendor.email": { label: "Email", type: "string", format: "email", baseRequired: false },
  "system:vendor.company": { label: "Company", type: "string", baseRequired: false },
  "system:vendor.avatar": { label: "Profile Picture", type: "file", baseRequired: false },
  // Legacy flat address — remapped to address.line1 (LEGACY_CRM_FIELD_REMAP). Kept resolvable so
  // already-published forms still render and now actually persist; not offered in the palette.
  "system:vendor.address": { label: "Address", type: "string", baseRequired: false },
  "system:vendor.address.line1": { label: "Address Line 1", type: "string", baseRequired: false },
  "system:vendor.address.line2": { label: "Address Line 2", type: "string", baseRequired: false },
  "system:vendor.address.city": { label: "City", type: "string", baseRequired: false },
  "system:vendor.address.state": { label: "State", type: "string", baseRequired: false },
  "system:vendor.address.pincode": { label: "Pincode", type: "string", baseRequired: false },
  "system:vendor.address.country": { label: "Country", type: "string", baseRequired: false },
  "system:vendor.socialMedia.instagram": { label: "Instagram", type: "string", baseRequired: false },
  "system:contact.socialMedia.twitter": { label: "Twitter / X", type: "string", baseRequired: false },
  "system:contact.socialMedia.linkedin": { label: "LinkedIn", type: "string", baseRequired: false },
  "system:contact.socialMedia.facebook": { label: "Facebook", type: "string", baseRequired: false },
  "system:contact.socialMedia.whatsapp": { label: "WhatsApp Number", type: "string", baseRequired: false },
  "system:company.socialMedia.twitter": { label: "Twitter / X", type: "string", baseRequired: false },
  "system:company.socialMedia.linkedin": { label: "LinkedIn", type: "string", baseRequired: false },
  "system:company.socialMedia.facebook": { label: "Facebook", type: "string", baseRequired: false },
  "system:company.socialMedia.whatsapp": { label: "WhatsApp Number", type: "string", baseRequired: false },
  "system:vendor.socialMedia.twitter": { label: "Twitter / X", type: "string", baseRequired: false },
  "system:vendor.socialMedia.linkedin": { label: "LinkedIn", type: "string", baseRequired: false },
  "system:vendor.socialMedia.facebook": { label: "Facebook", type: "string", baseRequired: false },
  "system:vendor.socialMedia.whatsapp": { label: "WhatsApp Number", type: "string", baseRequired: false },
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
  if (LEGACY_CRM_FIELD_REMAP[fieldId]) return LEGACY_CRM_FIELD_REMAP[fieldId];
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
  ARRAY_CRM_PARENT_KEYS,
  LEAD_SOURCE_OPTIONS,
  isSystemFieldId,
  getSystemFieldMeta,
  getCrmFieldNameForSystemId,
  getSystemFieldModule,
};
