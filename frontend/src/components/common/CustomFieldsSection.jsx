import React from "react";

/*
 * Renders one input per org-defined custom field, backed by a document's
 * `additionalFields: [{key, value}]` array — the same shape Contact/Company/
 * Deal/Vendor/Task/Meeting all store. Used by any create/edit form that
 * wants to expose those fields without hand-rolling the type switch per
 * module.
 *
 * `fieldDefs`: [{name, type, options, required, category}] from the
 *   module's <module>-fields endpoint (e.g. GET /task-fields).
 * `values`: the document's current additionalFields array.
 * `onChange(nextAdditionalFields)`: called with the full updated array.
 * `errors`: optional { [fieldName]: message } — shows an inline error and
 *   red border under that field. Pair with getMissingRequiredFields below.
 */
const CustomFieldsSection = ({ fieldDefs, values, onChange, title = "Custom Fields", errors = {} }) => {
  if (!fieldDefs || fieldDefs.length === 0) return null;

  const valueFor = (name) => values?.find((v) => v.key === name)?.value ?? "";

  const setValue = (name, type, value) => {
    const next = (values || []).filter((v) => v.key !== name);
    next.push({ key: name, value, type });
    onChange(next);
  };

  const errorText = (name) =>
    errors[name] && <p className="mt-1 text-xs text-red-600">{errors[name]}</p>;

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fieldDefs.map((field) => {
          const current = valueFor(field.name);
          const label = (
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {field.name}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
          );

          if (field.type === "dropdown") {
            return (
              <div key={field.name}>
                {label}
                <select
                  value={current}
                  onChange={(e) => setValue(field.name, field.type, e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select…</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {errorText(field.name)}
              </div>
            );
          }

          if (field.type === "multiselect") {
            const selected = Array.isArray(current) ? current : (current ? String(current).split(",").filter(Boolean) : []);
            const toggle = (opt) => {
              const next = selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt];
              setValue(field.name, field.type, next.join(","));
            };
            return (
              <div key={field.name}>
                {label}
                <div className="flex flex-wrap gap-1.5">
                  {(field.options || []).map((opt) => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => toggle(opt)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        selected.includes(opt)
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {errorText(field.name)}
              </div>
            );
          }

          if (field.type === "number") {
            return (
              <div key={field.name}>
                {label}
                <input
                  type="number"
                  value={current}
                  onChange={(e) => setValue(field.name, field.type, e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errorText(field.name)}
              </div>
            );
          }

          if (field.type === "date") {
            return (
              <div key={field.name}>
                {label}
                <input
                  type="date"
                  value={current}
                  onChange={(e) => setValue(field.name, field.type, e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errorText(field.name)}
              </div>
            );
          }

          if (field.type === "url") {
            return (
              <div key={field.name}>
                {label}
                <input
                  type="url"
                  value={current}
                  onChange={(e) => setValue(field.name, field.type, e.target.value)}
                  placeholder="https://…"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errorText(field.name)}
              </div>
            );
          }

          if (field.type === "text") {
            return (
              <div key={field.name} className="sm:col-span-2">
                {label}
                <textarea
                  value={current}
                  onChange={(e) => setValue(field.name, field.type, e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errorText(field.name)}
              </div>
            );
          }

          // "string" and any unrecognized type fall back to a single-line input.
          return (
            <div key={field.name}>
              {label}
              <input
                type="text"
                value={current}
                onChange={(e) => setValue(field.name, field.type, e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errorText(field.name)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/*
 * Returns { [fieldName]: message } for any required field left empty in
 * `values` — but only when `isEditing` is false. A field marked required
 * after a record already existed shouldn't retroactively block that older
 * record from being saved just because it predates the field; "required"
 * only applies going forward, to new records. Callers merge this into
 * their own validation-error state and pass it back in as `errors`.
 */
export const getMissingRequiredFields = (fieldDefs, values, isEditing) => {
  const errors = {};
  if (isEditing || !fieldDefs) return errors;

  fieldDefs.forEach((field) => {
    if (!field.required) return;
    const current = values?.find((v) => v.key === field.name)?.value;
    if (current === undefined || current === null || current.toString().trim() === "") {
      errors[field.name] = `${field.name} is required`;
    }
  });

  return errors;
};

export default CustomFieldsSection;
