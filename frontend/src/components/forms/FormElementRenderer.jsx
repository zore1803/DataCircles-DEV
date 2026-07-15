import React from "react";

const FONT_SIZE_CLASS = { small: "text-sm", normal: "text-base", large: "text-xl", xlarge: "text-3xl" };

// interactive === true: real form (public page). interactive === false: static preview (Builder canvas).
// `theme` supplies form-wide typography defaults (fontSize/fontWeight/textAlign) — per-element
// overrides on heading/paragraph always take precedence; theme is only the fallback.
export default function FormElementRenderer({ element, fieldMeta, value, onChange, interactive = false, theme }) {
  const alignClass = { left: "text-left", center: "text-center", right: "text-right" }[element.textAlign || theme?.textAlign] || "text-left";
  const weightClass = (element.fontWeight || theme?.fontWeight) === "bold" ? "font-bold" : "font-normal";
  const sizeClass = FONT_SIZE_CLASS[element.fontSize || theme?.fontSize] || (element.type === "heading" ? "text-xl" : "text-sm");
  const labelSizeClass = FONT_SIZE_CLASS[theme?.fontSize] || "text-sm";
  const labelAlignClass = { left: "text-left", center: "text-center", right: "text-right" }[theme?.textAlign] || "text-left";
  const labelWeightClass = theme?.fontWeight === "bold" ? "font-bold" : "font-medium";

  if (element.type === "heading") {
    return <p className={`${sizeClass} ${weightClass || "font-bold"} text-gray-900 ${alignClass}`}>{element.text || "Heading"}</p>;
  }
  if (element.type === "paragraph") {
    return <p className={`${sizeClass} ${weightClass} text-gray-600 ${alignClass}`}>{element.text || "Paragraph text"}</p>;
  }
  if (element.type === "divider") {
    return (
      <hr
        className="border-gray-200 w-full"
        style={{
          borderTopWidth: element.dividerThickness ? `${element.dividerThickness}px` : undefined,
          borderColor: element.dividerColor || undefined,
          marginTop: element.dividerSpacingTop ?? undefined,
          marginBottom: element.dividerSpacingBottom ?? undefined,
        }}
      />
    );
  }
  if (element.type === "submitButton") {
    const posClass = { left: "justify-start", center: "justify-center", right: "justify-end" }[element.position] || "justify-start";
    return (
      <div className={`flex w-full ${posClass}`}>
        <button
          type={interactive ? "submit" : "button"}
          disabled={!interactive}
          style={{ backgroundColor: element.color || "#0C4FCD" }}
          className={`px-5 py-2 text-white text-sm font-semibold ${element.style === "outline" ? "bg-transparent border-2" : ""} ${element.style === "rounded" ? "rounded-full" : "rounded-lg"}`}
        >
          {element.label || "Submit"}
        </button>
      </div>
    );
  }
  if (element.type === "field") {
    const fieldType = fieldMeta?.type;
    const isDropdown = fieldType === "dropdown";
    const isMultiselect = fieldType === "multiselect";
    // string/text/dropdown/multiselect/anything unmapped -> plain text input; number/date/url map
    // to their native HTML input type so the browser gets the right keyboard/validation/picker.
    const HTML_INPUT_TYPE = { number: "number", date: "date", url: "url" };
    const inputType = HTML_INPUT_TYPE[fieldType] || "text";
    return (
      <div className="w-full">
        <label className={`block ${labelSizeClass} ${labelWeightClass} text-gray-700 mb-1 ${labelAlignClass}`}>
          {fieldMeta?.label || element.fieldId}
          {element.required && <span className="text-red-500"> *</span>}
        </label>
        {isDropdown ? (
          <select
            disabled={!interactive}
            required={interactive && !!element.required}
            value={value ?? ""}
            onChange={(e) => onChange?.(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">{element.placeholder || "Select..."}</option>
            {(fieldMeta?.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : isMultiselect ? (
          <select
            multiple
            disabled={!interactive}
            required={interactive && !!element.required}
            value={Array.isArray(value) ? value : []}
            onChange={(e) => onChange?.(Array.from(e.target.selectedOptions, (o) => o.value))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-400"
          >
            {(fieldMeta?.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : (
          <input
            type={inputType}
            disabled={!interactive}
            required={interactive && !!element.required}
            value={value ?? ""}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={element.placeholder || ""}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-400"
          />
        )}
        {element.helpText && <p className="text-xs text-gray-400 mt-1">{element.helpText}</p>}
      </div>
    );
  }
  return null;
}
