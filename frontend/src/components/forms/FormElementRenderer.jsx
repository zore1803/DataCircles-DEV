import React, { useState } from "react";

const FONT_SIZE_CLASS = { small: "text-sm", normal: "text-base", large: "text-xl", xlarge: "text-3xl" };

// interactive === true: real form (public page). interactive === false: static preview (Builder canvas).
// `theme` supplies form-wide typography defaults (fontSize/fontWeight/textAlign) — per-element
// overrides on heading/paragraph always take precedence; theme is only the fallback.
// `onUploadFile`: async (File) => url — only supplied by the public page (PublicFormPage.jsx), which
// owns the publicSlug needed to call POST /api/public/forms/:slug/upload. Without it (Builder canvas
// preview), a "file" field renders as a disabled, non-functional input like every other field type
// does when interactive === false.
export default function FormElementRenderer({ element, fieldMeta, value, onChange, interactive = false, theme, onUploadFile }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const alignClass = { left: "text-left", center: "text-center", right: "text-right" }[element.textAlign || theme?.textAlign] || "text-left";
  const weightClass = (element.fontWeight || theme?.fontWeight) === "bold" ? "font-bold" : "font-normal";
  const sizeClass = FONT_SIZE_CLASS[element.fontSize || theme?.fontSize] || (element.type === "heading" ? "text-xl" : "text-sm");
  const labelSizeClass = FONT_SIZE_CLASS[theme?.fontSize] || "text-sm";
  const labelAlignClass = { left: "text-left", center: "text-center", right: "text-right" }[theme?.textAlign] || "text-left";
  const labelWeightClass = theme?.fontWeight === "bold" ? "font-bold" : "font-medium";

  // Per-element color wins; theme.textColor is the form-wide fallback; the Tailwind class is the
  // final default (only applied when neither is set, so it can't fight an explicit color).
  const textColor = element.textColor || theme?.textColor;
  if (element.type === "heading") {
    return (
      <p
        className={`${sizeClass} ${weightClass || "font-bold"} ${textColor ? "" : "form-heading"} ${alignClass}`}
        style={textColor ? { color: textColor } : undefined}
      >
        {element.text || "Heading"}
      </p>
    );
  }
  if (element.type === "paragraph") {
    return (
      <p
        className={`${sizeClass} ${weightClass} ${textColor ? "" : "form-help"} ${alignClass}`}
        style={textColor ? { color: textColor } : undefined}
      >
        {element.text || "Paragraph text"}
      </p>
    );
  }
  // A section header. In the Builder this is a draggable marker in the flat element list; on the
  // published form it is simply the heading that introduces the group beneath it.
  if (element.type === "sectionBreak" || element.type === "pageBreak") {
    return (
      <div className="w-full">
        {element.title && (
          <p className={`text-base font-semibold ${textColor ? "" : "form-heading"}`} style={textColor ? { color: textColor } : undefined}>
            {element.title}
          </p>
        )}
        {element.description && <p className="form-help text-sm mt-0.5">{element.description}</p>}
        {!element.title && !element.description && !interactive && (
          <p className="text-xs text-gray-300 italic">Untitled section</p>
        )}
      </div>
    );
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
  if (element.type === "image") {
    // Alignment is done with flex justify on a wrapper rather than `text-align`, so it works
    // regardless of the image's width; `imageWidth` is a percentage of the form's content width.
    const justifyClass = { left: "justify-start", center: "justify-center", right: "justify-end" }[element.textAlign] || "justify-start";
    if (!element.url) {
      // Placed but no image chosen yet — the Builder shows a prompt so the element is still
      // visible/selectable/movable. The public form renders nothing at all for an empty image.
      if (interactive) return null;
      return (
        <div className={`w-full flex ${justifyClass}`}>
          <div
            style={{ width: `${element.imageWidth ?? 100}%` }}
            className="border border-dashed border-gray-300 rounded-lg py-6 flex items-center justify-center"
          >
            <span className="text-xs text-gray-400">Select this block to upload an image</span>
          </div>
        </div>
      );
    }
    return (
      <div className={`w-full flex ${justifyClass}`}>
        <img src={element.url} alt={element.alt || ""} style={{ width: `${element.imageWidth ?? 100}%` }} className="object-contain rounded" />
      </div>
    );
  }
  if (element.type === "submitButton") {
    // Per-element settings win; anything left unset falls through to the theme's tokens.
    const posClass = { left: "justify-start", center: "justify-center", right: "justify-end" }[element.position || theme?.buttonPosition] || "justify-start";
    const style = element.style || theme?.buttonStyle;
    return (
      <div className={`flex w-full ${posClass}`}>
        <button
          type={interactive ? "submit" : "button"}
          disabled={!interactive}
          style={{
            // An explicit per-button colour overrides the theme token; otherwise the CSS var wins.
            backgroundColor: element.color || undefined,
            borderRadius: style === "rounded" ? "999px" : undefined,
          }}
          className={`form-button text-sm ${style === "outline" ? "form-button--outline" : ""} ${theme?.buttonWidth === "full" ? "form-button--full" : ""}`}
        >
          {element.label || "Submit"}
        </button>
      </div>
    );
  }
  if (element.type === "field") {
    const fieldType = fieldMeta?.type;
    const isDropdown = fieldType === "dropdown";
    // "text" is the CRM's MULTI-LINE type (ContactFields/CompanyFields/VendorFields enum), distinct
    // from "string" — the CRM's own forms render it as a <textarea>, so this must too.
    const isLongText = fieldType === "text";
    const isMultiselect = fieldType === "multiselect";
    const isFile = fieldType === "file";
    // string/anything unmapped -> plain text input; number/date/url map to their native HTML input
    // type so the browser gets the right keyboard/validation/picker.
    const HTML_INPUT_TYPE = { number: "number", date: "date", url: "url" };
    const inputType = HTML_INPUT_TYPE[fieldType] || "text";

    // Multi-select is a checkbox list, matching the CRM's own renderer — a native <select multiple>
    // needs ctrl/cmd-click, which is undiscoverable for a public visitor and unusable on touch.
    // Accepts either an array or the comma-separated string the CRM stores, same as CompanyForm.
    const selectedValues = Array.isArray(value)
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? value.split(",").map((v) => v.trim())
        : [];

    const handleFileSelect = async (e) => {
      const file = e.target.files?.[0];
      e.target.value = ""; // allow re-selecting the same file after a failed/replaced upload
      if (!file || !onUploadFile) return;
      setUploadError(null);
      setUploading(true);
      try {
        const url = await onUploadFile(file);
        onChange?.(url);
      } catch (err) {
        setUploadError(err?.response?.data?.error || "Upload failed. Please try again.");
      } finally {
        setUploading(false);
      }
    };

    return (
      <div className="w-full">
        <label
          className={`form-label block ${labelSizeClass} ${labelWeightClass} mb-1 ${labelAlignClass}`}
          style={textColor ? { color: textColor } : undefined}
        >
          {fieldMeta?.label || element.fieldId}
          {element.required && <span className="text-red-500"> *</span>}
        </label>
        {isFile ? (
          <div className="flex items-center gap-3">
            {value ? (
              <img src={value} alt="" className="w-12 h-12 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-lg border border-dashed border-gray-300 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={!interactive || uploading}
                onChange={handleFileSelect}
                className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 disabled:opacity-50"
              />
              {uploading && <p className="text-xs text-gray-400 mt-1">Uploading...</p>}
              {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
            </div>
          </div>
        ) : isDropdown ? (
          <select
            disabled={!interactive}
            required={interactive && !!element.required}
            value={value ?? ""}
            onChange={(e) => onChange?.(e.target.value)}
            className="form-input text-sm"
          >
            <option value="">{element.placeholder || "Select..."}</option>
            {(fieldMeta?.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : isMultiselect ? (
          <div className="flex flex-col gap-1.5">
            {(fieldMeta?.options || []).map((opt) => (
              <label key={opt} className={`flex items-center gap-2 text-sm ${interactive ? "cursor-pointer" : "opacity-60"}`}>
                <input
                  type="checkbox"
                  disabled={!interactive}
                  checked={selectedValues.includes(opt)}
                  onChange={(e) =>
                    onChange?.(
                      e.target.checked
                        ? [...selectedValues, opt]
                        : selectedValues.filter((v) => v !== opt)
                    )
                  }
                  className="w-4 h-4"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        ) : isLongText ? (
          <textarea
            rows={3}
            disabled={!interactive}
            required={interactive && !!element.required}
            value={value ?? ""}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={element.placeholder || ""}
            className="form-input text-sm resize-y"
          />
        ) : (
          <input
            type={inputType}
            disabled={!interactive}
            required={interactive && !!element.required}
            value={value ?? ""}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={element.placeholder || ""}
            className="form-input text-sm"
          />
        )}
        {element.helpText && <p className="form-help text-xs mt-1">{element.helpText}</p>}
      </div>
    );
  }
  return null;
}
