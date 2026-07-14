const ContactFields = require("../models/ContactFields");
const CompanyFields = require("../models/CompanyFields");
const VendorFields = require("../models/VendorFields");

const FIELD_MODEL_BY_MODULE = {
  contact: ContactFields,
  company: CompanyFields,
  vendor: VendorFields,
};

/**
 * Purpose: Fetch the organization's custom field definitions for a module and
 * return them as a name -> fieldDef lookup map, matching the shape each
 * controller previously built inline.
 * Inputs: module ("contact"|"company"|"vendor"), organizationId (ObjectId|string)
 * Outputs: Promise<Object<string, FieldDef>> - empty object if no definitions doc exists
 * Side effects: one read query against the module's *Fields collection
 * Errors thrown: none (missing definitions doc resolves to {})
 * Known callers: contactService, companyService, vendorService (Phase 0)
 */
async function loadFieldDefs(module, organizationId) {
  const Model = FIELD_MODEL_BY_MODULE[module];
  if (!Model) {
    throw new Error(`Unknown module for field coercion: ${module}`);
  }

  const fieldDefinitions = await Model.findOne({ organization: organizationId });

  const fieldTypes = {};
  if (fieldDefinitions && fieldDefinitions.fields) {
    fieldDefinitions.fields.forEach((field) => {
      fieldTypes[field.name] = field;
    });
  }

  return fieldTypes;
}

/**
 * Purpose: Coerce a raw `additionalFields` array into the typed shape stored
 * on Contact/Company/Vendor documents. This is a verbatim generalization of
 * vendorController's original processAdditionalFields — same coercion rules,
 * same fallback-to-"text" behavior for unrecognized keys, same number
 * handling (parseFloat(...)||0). Deliberately preserves that fallback rather
 * than rejecting unknown fields, matching existing behavior across all three
 * modules today.
 * Inputs:
 *   additionalFields: Array<{key, value}> | undefined
 *   fieldDefs: Object<string, FieldDef> - as returned by loadFieldDefs()
 * Outputs: Array<{key, value, type}> - [] if additionalFields is missing/not an array
 * Side effects: none (pure transform, no DB access)
 * Errors thrown: none
 * Known callers: contactService, companyService, vendorService (Phase 0)
 */
function coerceAdditionalFields(additionalFields, fieldDefs) {
  if (!additionalFields || !Array.isArray(additionalFields)) {
    return [];
  }

  return additionalFields.map((field) => {
    const fieldDef = fieldDefs[field.key];
    let processedValue = field.value;

    if (fieldDef) {
      switch (fieldDef.type) {
        case "number":
          processedValue = parseFloat(field.value) || 0;
          break;
        case "dropdown":
        case "string":
        case "text":
        default:
          processedValue = String(field.value || "");
          break;
      }

      return {
        key: field.key,
        value: processedValue,
        type: fieldDef.type,
      };
    }

    // Default handling for fields without definitions — preserved as-is.
    return {
      key: field.key,
      value: String(field.value || ""),
      type: "text",
    };
  });
}

/**
 * Purpose: Convenience wrapper combining loadFieldDefs + coerceAdditionalFields,
 * matching the single-call usage pattern of the original processAdditionalFields.
 * Inputs:
 *   module: "contact"|"company"|"vendor"
 *   additionalFields: Array<{key, value}> | undefined
 *   organizationId: ObjectId|string
 * Outputs: Promise<Array<{key, value, type}>>
 * Side effects: one read query (via loadFieldDefs)
 * Errors thrown: propagates any error from loadFieldDefs (unknown module)
 * Known callers: contactService, companyService, vendorService (Phase 0)
 */
async function processAdditionalFields(module, additionalFields, organizationId) {
  const fieldDefs = await loadFieldDefs(module, organizationId);
  return coerceAdditionalFields(additionalFields, fieldDefs);
}

module.exports = {
  loadFieldDefs,
  coerceAdditionalFields,
  processAdditionalFields,
};
