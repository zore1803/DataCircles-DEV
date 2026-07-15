// pages/FormBuilderPage.jsx
// Form Builder — dedicated full-width route, /forms/:id/builder (see FORMS_FRONTEND_ARCHITECTURE.md
// §1.2 amendment). Vertical slice: Canvas + drag/drop + Properties + Save (PATCH) + Publish (POST).
//
// Drag/drop uses @dnd-kit (already a dependency, already used the same way in KanbanSettings.jsx —
// DndContext/PointerSensor/SortableContext/useSortable/arrayMove — no new library introduced).
//
// Scope notes, not blockers:
// - Single section only for v1 (layout is an array of sections per FORMS_SCHEMA.md §1a).
// - Field "Label" in the Properties panel is READ-ONLY: FormDefinition's elementSchema has no label
//   field for type:"field" elements — the display label always comes from the field definition
//   itself (system field meta, or a custom field's own `name`), edited in Settings > *Fields.
// - Layout components: Heading/Paragraph/Divider only (Spacer/Image deferred — Image has no upload
//   endpoint, so it would only ever be a raw-URL field if added).
// - A submitButton element is auto-ensured (not draggable, not deletable) so every form is usable.
// - Preview is a simplified read-only render, not the shared public-renderer preview the original
//   spec described — that renderer doesn't exist yet (separate, larger, already-scheduled work).
// - Cross-module guard: the Company-fields group on a Contact form lists ONLY system Company fields
//   — custom Company fields are never fetched or offered as draggable options, per invariant #17.
// - A field already placed on the canvas is disabled (not draggable) in the FieldsPanel — the
//   backend's assertUniqueFieldIds guard at publish time is a correctness backstop, not the only
//   thing preventing a duplicate; the UI must not let you create that state to begin with.
// - Theme tab exposes fontFamily only (form-wide). Button color/position/style live on the
//   submitButton ELEMENT itself (elementSchema.submitButton's own label/color/position/style) —
//   deliberately not duplicated into theme.buttonColor/etc, to avoid two places editing "the same"
//   button setting with different scopes.
// - Per-element text styling (fontSize/fontWeight/textAlign on heading/paragraph) required a small
//   additive schema change (backend/models/FormDefinition.js + FormVersion.js) — done alongside this.
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import API from "../services/api";
import toast from "react-hot-toast";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  GripVertical,
  Trash2,
  Type,
  Heading as HeadingIcon,
  Minus,
  X,
  Eye,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
} from "lucide-react";
import FormElementRenderer from "../components/forms/FormElementRenderer";

// Mirrors backend/utils/systemFields.js exactly (SYSTEM_FIELD_IDS/SYSTEM_FIELD_META) — no frontend
// endpoint exposes this static registry, so it's inlined rather than fetched.
const SYSTEM_FIELDS = {
  Contact: [
    { fieldId: "system:contact.name", label: "Name", type: "string", baseRequired: true },
    { fieldId: "system:contact.email", label: "Email", type: "string", baseRequired: true },
    { fieldId: "system:contact.phone", label: "Phone", type: "string" },
    // No "Company" entry: Contact.company is an internal ObjectId relationship, not a visitor-
    // fillable value. Use the Company system fields below (Company Name, Industry, ...) instead —
    // the relationship is created/linked automatically server-side.
    { fieldId: "system:contact.socialMedia.twitter", label: "Twitter / X", type: "string" },
    { fieldId: "system:contact.socialMedia.linkedin", label: "LinkedIn", type: "string" },
    { fieldId: "system:contact.socialMedia.facebook", label: "Facebook", type: "string" },
    { fieldId: "system:contact.socialMedia.whatsapp", label: "WhatsApp Number", type: "string" },
  ],
  Company: [
    { fieldId: "system:company.name", label: "Company Name", type: "string", baseRequired: true },
    { fieldId: "system:company.industry", label: "Industry", type: "dropdown", baseRequired: true },
    { fieldId: "system:company.gstin", label: "GSTIN", type: "string" },
    { fieldId: "system:company.address", label: "Address", type: "string" },
    { fieldId: "system:company.website", label: "Website", type: "url" },
    // No true file-upload support exists yet: FormSubmission.processedData is Mixed but the
    // ContactFields/CompanyFields field-type enum has no "file" type, and there's no public-safe
    // upload endpoint for an unauthenticated visitor. This is a URL field (visitor pastes an
    // image link), matching backend SYSTEM_FIELD_META's "system:company.profilePicture": url.
    { fieldId: "system:company.profilePicture", label: "Profile Picture (Image URL)", type: "url" },
    { fieldId: "system:company.socialMedia.twitter", label: "Twitter / X", type: "string" },
    { fieldId: "system:company.socialMedia.linkedin", label: "LinkedIn", type: "string" },
    { fieldId: "system:company.socialMedia.facebook", label: "Facebook", type: "string" },
    { fieldId: "system:company.socialMedia.whatsapp", label: "WhatsApp Number", type: "string" },
  ],
  Vendor: [
    { fieldId: "system:vendor.name", label: "Vendor Name", type: "string", baseRequired: true },
    { fieldId: "system:vendor.gstin", label: "GSTIN", type: "string" },
    { fieldId: "system:vendor.phone", label: "Phone", type: "string" },
    { fieldId: "system:vendor.email", label: "Email", type: "string" },
    { fieldId: "system:vendor.address", label: "Address", type: "string" },
    { fieldId: "system:vendor.socialMedia.twitter", label: "Twitter / X", type: "string" },
    { fieldId: "system:vendor.socialMedia.linkedin", label: "LinkedIn", type: "string" },
    { fieldId: "system:vendor.socialMedia.facebook", label: "Facebook", type: "string" },
    { fieldId: "system:vendor.socialMedia.whatsapp", label: "WhatsApp Number", type: "string" },
  ],
};

// fieldId -> true for system fields whose underlying CRM schema hard-requires the value
// (backend/utils/systemFields.js SYSTEM_FIELD_META baseRequired). A form element for one of
// these must never be submittable as optional — the Builder can't let a visitor skip it only to
// have companyService.createCompany() etc. throw a Mongoose ValidationError downstream.
const BASE_REQUIRED_FIELD_IDS = new Set(
  Object.values(SYSTEM_FIELDS)
    .flat()
    .filter((f) => f.baseRequired)
    .map((f) => f.fieldId)
);

const FIELD_ENDPOINT_BY_MODULE = {
  Contact: "/contact-fields",
  Company: "/company-fields",
  Vendor: "/vendor-fields",
};

const FONT_OPTIONS = ["Inter", "Arial", "Georgia", "Times New Roman", "Courier New", "Verdana"];
const BUTTON_COLORS = ["#0C4FCD", "#16A34A", "#DC2626", "#7C3AED", "#111827"];
const FONT_SIZE_CLASS = { small: "text-sm", normal: "text-base", large: "text-xl", xlarge: "text-3xl" };

function uid() {
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// "system:company.industry" -> "Company", etc. — used to figure out which module's mandatory
// fields must be backfilled when a system field from that module gets placed on the canvas
// (including the Company-fields-inside-a-Contact-form cross-module case).
function moduleFromFieldId(fieldId) {
  if (fieldId?.startsWith("system:contact.")) return "Contact";
  if (fieldId?.startsWith("system:company.")) return "Company";
  if (fieldId?.startsWith("system:vendor.")) return "Vendor";
  return null;
}

function ensureSubmitButton(elements) {
  if (elements.some((e) => e.type === "submitButton")) return elements;
  return [...elements, { id: uid(), type: "submitButton", order: elements.length, label: "Submit", color: BUTTON_COLORS[0], position: "left" }];
}

// --- Palette (Fields panel) ---

function PaletteItem({ id, data, disabled, children }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id, data, disabled });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(disabled ? {} : { ...listeners, ...attributes })}
      className={`px-3 py-2 border rounded-lg text-sm select-none transition-colors ${
        disabled
          ? "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed"
          : "bg-white border-gray-200 text-gray-700 cursor-grab active:cursor-grabbing hover:border-blue-300 hover:bg-blue-50"
      }`}
      title={disabled ? "Already on this form" : undefined}
    >
      {children}
    </div>
  );
}

function FieldsPanel({ module, customFields, usedFieldIds, theme, onThemeChange }) {
  const [tab, setTab] = useState("fields");
  const systemFields = SYSTEM_FIELDS[module] || [];

  return (
    <div className="w-64 shrink-0 bg-white border-r border-gray-200 flex flex-col">
      <div className="flex border-b border-gray-100 shrink-0">
        <button
          onClick={() => setTab("fields")}
          className={`flex-1 px-3 py-2.5 text-sm font-medium ${tab === "fields" ? "text-blue-600 border-b-2 border-blue-600 -mb-px" : "text-gray-500 hover:text-gray-800"}`}
        >
          Fields
        </button>
        <button
          onClick={() => setTab("theme")}
          className={`flex-1 px-3 py-2.5 text-sm font-medium ${tab === "theme" ? "text-blue-600 border-b-2 border-blue-600 -mb-px" : "text-gray-500 hover:text-gray-800"}`}
        >
          Theme
        </button>
      </div>

      {tab === "theme" ? (
        <div className="p-4 flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Typography</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Font Family</label>
                <select
                  value={theme?.fontFamily || FONT_OPTIONS[0]}
                  onChange={(e) => onThemeChange({ ...theme, fontFamily: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                >
                  {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Font Size</label>
                <select
                  value={theme?.fontSize || "normal"}
                  onChange={(e) => onThemeChange({ ...theme, fontSize: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                >
                  <option value="small">Small</option>
                  <option value="normal">Normal</option>
                  <option value="large">Large</option>
                  <option value="xlarge">Extra Large</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Font Weight</label>
                <select
                  value={theme?.fontWeight || "normal"}
                  onChange={(e) => onThemeChange({ ...theme, fontWeight: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Text Alignment</label>
                <AlignButtons value={theme?.textAlign || "left"} onChange={(v) => onThemeChange({ ...theme, textAlign: v })} />
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
            Applies to the whole form as the default — individual Heading/Paragraph elements can still override these. Button color/style is set on the Submit Button itself — click it on the canvas.
          </p>
        </div>
      ) : (
        <div className="p-4 overflow-y-auto flex flex-col gap-5">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{module} Fields</p>
            <div className="flex flex-col gap-1.5">
              {systemFields.map((f) => (
                <PaletteItem key={f.fieldId} id={`palette-${f.fieldId}`} data={{ type: "palette", source: "system", field: f }} disabled={usedFieldIds.has(f.fieldId)}>
                  {f.label}
                </PaletteItem>
              ))}
            </div>
          </div>

          {customFields.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Custom</p>
              <div className="flex flex-col gap-1.5">
                {customFields.map((f) => (
                  <PaletteItem
                    key={f._id}
                    id={`palette-${f._id}`}
                    data={{ type: "palette", source: "custom", field: { fieldId: f._id, label: f.name, type: f.type } }}
                    disabled={usedFieldIds.has(f._id)}
                  >
                    {f.name}
                  </PaletteItem>
                ))}
              </div>
            </div>
          )}

          {module === "Contact" && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Company Fields</p>
              {/* Cross-module guard, built into the panel itself: ONLY system Company fields are
                  ever listed here — custom Company fields are never fetched or offered. */}
              <div className="flex flex-col gap-1.5">
                {SYSTEM_FIELDS.Company.map((f) => (
                  <PaletteItem key={f.fieldId} id={`palette-${f.fieldId}`} data={{ type: "palette", source: "system", field: f }} disabled={usedFieldIds.has(f.fieldId)}>
                    {f.label}
                  </PaletteItem>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Layout</p>
            <div className="flex flex-col gap-1.5">
              <PaletteItem id="palette-heading" data={{ type: "palette", source: "layout", field: { layoutType: "heading" } }}>
                <span className="flex items-center gap-2"><HeadingIcon className="w-3.5 h-3.5" /> Heading</span>
              </PaletteItem>
              <PaletteItem id="palette-paragraph" data={{ type: "palette", source: "layout", field: { layoutType: "paragraph" } }}>
                <span className="flex items-center gap-2"><Type className="w-3.5 h-3.5" /> Paragraph</span>
              </PaletteItem>
              <PaletteItem id="palette-divider" data={{ type: "palette", source: "layout", field: { layoutType: "divider" } }}>
                <span className="flex items-center gap-2"><Minus className="w-3.5 h-3.5" /> Divider</span>
              </PaletteItem>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Canvas — renders each element as it will actually look, not a generic card ---

// Canvas rendering is handled by the shared FormElementRenderer component.

function CanvasItem({ element, fieldMetaById, isSelected, onSelect, onDelete, isLocked, theme }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: element.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const deletable = element.type !== "submitButton";

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(element.id)}
      className={`relative group border-2 rounded-lg px-3 py-3 cursor-pointer transition-all ${
        isSelected ? "border-blue-400 shadow-md" : "border-transparent hover:border-gray-200"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="absolute -left-1 top-1/2 -translate-y-1/2 -translate-x-full opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 pr-1">
        <button {...attributes} {...listeners} className="text-gray-300 hover:text-gray-600 cursor-grab active:cursor-grabbing bg-white rounded border border-gray-100 p-1">
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      </div>
      <FormElementRenderer
        element={element}
        fieldMeta={element.fieldId ? fieldMetaById.get(element.fieldId) : undefined}
        interactive={false}
        theme={theme}
      />
      {deletable && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(element.id); }}
          title={isLocked ? `${fieldMetaById.get(element.fieldId)?.label || "This field"} is required while ${moduleFromFieldId(element.fieldId)} fields exist on this form.` : undefined}
          className={`absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 transition-opacity ${
            isLocked ? "text-gray-300 cursor-not-allowed" : "text-gray-300 hover:text-red-500"
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function Canvas({ elements, fieldMetaById, selectedId, onSelect, onDelete, isFieldLocked, theme }) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-droppable" });

  return (
    <div ref={setNodeRef} className={`flex-1 p-8 overflow-y-auto ${isOver ? "bg-blue-50/40" : ""}`}>
      <div
        className="max-w-xl mx-auto bg-white rounded-xl border border-gray-200 shadow-sm p-6 min-h-[500px]"
        style={{ fontFamily: theme?.fontFamily || undefined }}
      >
        {elements.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[400px] text-center">
            <p className="text-gray-400 text-sm">Drag fields here to build your form</p>
          </div>
        ) : (
          <SortableContext items={elements.map((e) => e.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {elements.map((el) => (
                <CanvasItem
                  key={el.id}
                  element={el}
                  fieldMetaById={fieldMetaById}
                  isSelected={selectedId === el.id}
                  onSelect={onSelect}
                  onDelete={onDelete}
                  isLocked={isFieldLocked(el)}
                  theme={theme}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
}

// --- Properties panel — plain-language labels, not raw backend field names ---

const ALIGN_OPTIONS = [
  { value: "left", icon: AlignLeft },
  { value: "center", icon: AlignCenter },
  { value: "right", icon: AlignRight },
];

function AlignButtons({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {ALIGN_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`p-1.5 rounded border ${value === opt.value ? "bg-blue-50 border-blue-300 text-blue-600" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}
        >
          <opt.icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  );
}

function PropertiesPanel({ element, fieldMetaById, onChange }) {
  if (!element) {
    return (
      <div className="w-72 shrink-0 bg-white border-l border-gray-200 p-4">
        <p className="text-sm text-gray-400">Select an element to edit its properties.</p>
      </div>
    );
  }

  if (element.type === "field") {
    const meta = fieldMetaById.get(element.fieldId);
    const overrides = element.validationOverrides || {};
    const isNumeric = meta?.type === "number";
    const patternRelevant = meta?.type === "string" || meta?.type === "url"; // only pattern-matching-relevant types

    return (
      <div className="w-72 shrink-0 bg-white border-l border-gray-200 p-4 overflow-y-auto flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>
          {/* Read-only: no per-form label override exists in the schema — comes from the field
              definition itself (edited in Settings > *Fields, not here). */}
          <p className="text-sm text-gray-700 px-2 py-1.5 bg-gray-50 rounded border border-gray-100">{meta?.label || element.fieldId}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={!!element.required}
            disabled={BASE_REQUIRED_FIELD_IDS.has(element.fieldId) || !!meta?.baseRequired}
            onChange={(e) => onChange({ ...element, required: e.target.checked })}
          />
          Required
          {(BASE_REQUIRED_FIELD_IDS.has(element.fieldId) || !!meta?.baseRequired) && (
            <span className="text-xs text-gray-400">(always required)</span>
          )}
        </label>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Placeholder</label>
          <input
            type="text"
            value={element.placeholder || ""}
            onChange={(e) => onChange({ ...element, placeholder: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Help Text</label>
          <textarea
            value={element.helpText || ""}
            onChange={(e) => onChange({ ...element, helpText: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            rows={2}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Default Value</label>
          <input
            type="text"
            value={element.defaultValue ?? ""}
            onChange={(e) => onChange({ ...element, defaultValue: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
          />
        </div>
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Validation</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Minimum {isNumeric ? "Value" : "Length"}</label>
              <input
                type="text"
                value={overrides.min ?? ""}
                onChange={(e) => onChange({ ...element, validationOverrides: { ...overrides, min: e.target.value } })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Maximum {isNumeric ? "Value" : "Length"}</label>
              <input
                type="text"
                value={overrides.max ?? ""}
                onChange={(e) => onChange({ ...element, validationOverrides: { ...overrides, max: e.target.value } })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>
          {patternRelevant && (
            <div className="mt-2">
              <label className="block text-xs text-gray-500 mb-1">Only allow this pattern (advanced)</label>
              <input
                type="text"
                value={overrides.regex || ""}
                onChange={(e) => onChange({ ...element, validationOverrides: { ...overrides, regex: e.target.value } })}
                placeholder="Leave blank unless you need custom pattern matching"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">Advanced — most forms don't need this.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (element.type === "heading" || element.type === "paragraph") {
    return (
      <div className="w-72 shrink-0 bg-white border-l border-gray-200 p-4 flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Text</label>
          <textarea
            value={element.text || ""}
            onChange={(e) => onChange({ ...element, text: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            rows={element.type === "paragraph" ? 4 : 2}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Font Size</label>
          <select
            value={element.fontSize || (element.type === "heading" ? "large" : "normal")}
            onChange={(e) => onChange({ ...element, fontSize: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
          >
            <option value="small">Small</option>
            <option value="normal">Normal</option>
            <option value="large">Large</option>
            <option value="xlarge">Extra Large</option>
          </select>
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={element.fontWeight === "bold"}
              onChange={(e) => onChange({ ...element, fontWeight: e.target.checked ? "bold" : "normal" })}
            />
            <Bold className="w-3.5 h-3.5" /> Bold
          </label>
          <AlignButtons value={element.textAlign || "left"} onChange={(v) => onChange({ ...element, textAlign: v })} />
        </div>
      </div>
    );
  }

  if (element.type === "submitButton") {
    return (
      <div className="w-72 shrink-0 bg-white border-l border-gray-200 p-4 flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Button Label</label>
          <input
            type="text"
            value={element.label || ""}
            onChange={(e) => onChange({ ...element, label: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Color</label>
          <div className="flex gap-2">
            {BUTTON_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onChange({ ...element, color: c })}
                style={{ backgroundColor: c }}
                className={`w-7 h-7 rounded-full border-2 ${element.color === c ? "border-gray-900" : "border-transparent"}`}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Position</label>
          <AlignButtons value={element.position || "left"} onChange={(v) => onChange({ ...element, position: v })} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Style</label>
          <select
            value={element.style || "solid"}
            onChange={(e) => onChange({ ...element, style: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
          >
            <option value="solid">Solid</option>
            <option value="outline">Outline</option>
            <option value="rounded">Rounded (pill)</option>
          </select>
        </div>
      </div>
    );
  }

  if (element.type === "divider") {
    return (
      <div className="w-72 shrink-0 bg-white border-l border-gray-200 p-4 flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Thickness (px)</label>
          <input
            type="number"
            min={1}
            max={12}
            value={element.dividerThickness ?? 1}
            onChange={(e) => onChange({ ...element, dividerThickness: Number(e.target.value) })}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Color</label>
          <input
            type="color"
            value={element.dividerColor || "#e5e7eb"}
            onChange={(e) => onChange({ ...element, dividerColor: e.target.value })}
            className="w-full h-9 border border-gray-300 rounded cursor-pointer"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Top Spacing (px)</label>
            <input
              type="number"
              min={0}
              max={64}
              value={element.dividerSpacingTop ?? 0}
              onChange={(e) => onChange({ ...element, dividerSpacingTop: Number(e.target.value) })}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Bottom Spacing (px)</label>
            <input
              type="number"
              min={0}
              max={64}
              value={element.dividerSpacingBottom ?? 0}
              onChange={(e) => onChange({ ...element, dividerSpacingBottom: Number(e.target.value) })}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 shrink-0 bg-white border-l border-gray-200 p-4">
      <p className="text-sm text-gray-400">No editable properties for this element.</p>
    </div>
  );
}

// --- Preview — a real interactive sandbox, not a screenshot. Reuses FormElementRenderer's
// existing `interactive` mode (the same code path a future public-form renderer would use) rather
// than a second, fake read-only copy — typing, dropdowns, and native required-field validation all
// behave as they would on the real public form. The one difference: submit is intercepted so
// nothing is ever actually sent anywhere.

function PreviewModal({ elements, fieldMetaById, theme, onClose }) {
  const [values, setValues] = useState({});

  const handleChange = (fieldId, value) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    toast.success("This is a preview — no data was submitted.");
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Preview</h2>
            <p className="text-xs text-gray-400">Try it out — nothing you enter here gets submitted.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4" style={{ fontFamily: theme?.fontFamily || undefined }}>
          {elements.map((el) => (
            <FormElementRenderer
              key={el.id}
              element={el}
              fieldMeta={el.fieldId ? fieldMetaById.get(el.fieldId) : undefined}
              interactive={true}
              value={el.fieldId ? values[el.fieldId] : undefined}
              onChange={el.fieldId ? (v) => handleChange(el.fieldId, v) : undefined}
              theme={theme}
            />
          ))}
        </form>
      </div>
    </div>
  );
}

// --- Page ---

const FormBuilderPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [elements, setElements] = useState([]);
  const [theme, setTheme] = useState({});
  const [customFields, setCustomFields] = useState([]);
  const [industryOptions, setIndustryOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [dirty, setDirty] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get(`/forms/${id}`);
      const f = res.data.form;
      setForm(f);
      setTheme(f.theme || {});
      const section = f.layout?.[0];
      setElements(ensureSubmitButton(section?.elements || []));

      const endpoint = FIELD_ENDPOINT_BY_MODULE[f.module];
      if (endpoint) {
        try {
          const fieldsRes = await API.get(endpoint);
          setCustomFields(fieldsRes.data?.fields || []);
        } catch {
          setCustomFields([]);
        }
      }

      if (f.module === "Company") {
        try {
          const industriesRes = await API.get("/company-industries");
          setIndustryOptions((industriesRes.data || []).map((i) => i.name));
        } catch {
          setIndustryOptions([]);
        }
      }
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error("Form not found");
        navigate("/settings/forms");
      } else {
        toast.error("Failed to load form");
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const fieldMetaById = useMemo(() => {
    const map = new Map();
    if (form) {
      (SYSTEM_FIELDS[form.module] || []).forEach((f) => map.set(f.fieldId, f));
      SYSTEM_FIELDS.Company.forEach((f) => map.set(f.fieldId, f));
    }
    if (map.has("system:company.industry")) {
      map.set("system:company.industry", { ...map.get("system:company.industry"), options: industryOptions });
    }
    customFields.forEach((f) =>
      map.set(f._id, { fieldId: f._id, label: f.name, type: f.type, options: f.options || [], baseRequired: !!f.required })
    );
    return map;
  }, [form, customFields, industryOptions]);

  // A field is "always required" (locked, can't be unchecked) if it's a hardcoded system
  // baseRequired field OR a custom field whose own definition (Settings > *Fields) has
  // `required: true`. Reads live off fieldMetaById so a Settings-side change is reflected here
  // with zero Builder code changes — same principle as the custom-fields palette itself.
  const isAlwaysRequired = useCallback(
    (fieldId) => BASE_REQUIRED_FIELD_IDS.has(fieldId) || !!fieldMetaById.get(fieldId)?.baseRequired,
    [fieldMetaById]
  );

  // All fields (system + custom) that must exist on the canvas for `module` to be creatable —
  // used both to lock a field's Required checkbox and to auto-backfill missing ones.
  const getRequiredFieldsForModule = useCallback(
    (module) => {
      const systemRequired = (SYSTEM_FIELDS[module] || []).filter((f) => f.baseRequired);
      const customRequired =
        form?.module === module
          ? customFields.filter((f) => f.required).map((f) => ({ fieldId: f._id, label: f.name }))
          : [];
      return [...systemRequired, ...customRequired];
    },
    [form, customFields]
  );

  // Fields already placed on canvas — used to disable them in the palette so a duplicate can't be
  // dragged a second time. The backend's assertUniqueFieldIds is a correctness backstop for this,
  // not the primary defense.
  const usedFieldIds = useMemo(
    () => new Set(elements.filter((e) => e.type === "field").map((e) => e.fieldId)),
    [elements]
  );

  const updateElement = (updated) => {
    setElements((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setDirty(true);
  };

  const updateTheme = (updated) => {
    setTheme(updated);
    setDirty(true);
  };

  // A baseRequired field (e.g. Company Name, Industry) can't be removed while any other field from
  // the same module is still on the canvas — that other field is evidence the form still creates a
  // record in that module, so the mandatory field must stay regardless of whether it was dropped in
  // manually or auto-inserted. Once it's the last field left for that module, deleting it is safe.
  const isFieldLocked = useCallback(
    (element) => {
      if (element.type !== "field" || !isAlwaysRequired(element.fieldId)) return false;
      const owningModule = moduleFromFieldId(element.fieldId) || (element.source === "custom" ? form?.module : null);
      if (!owningModule) return false;
      return elements.some(
        (e) => e.id !== element.id && e.type === "field" && (moduleFromFieldId(e.fieldId) || (e.source === "custom" ? form?.module : null)) === owningModule
      );
    },
    [elements, isAlwaysRequired, form]
  );

  const deleteElement = (elId) => {
    const target = elements.find((e) => e.id === elId);
    if (target && isFieldLocked(target)) {
      const label = fieldMetaById.get(target.fieldId)?.label || "This field";
      toast.error(`${label} is required while ${moduleFromFieldId(target.fieldId)} fields exist on this form.`);
      return;
    }
    setElements((prev) => prev.filter((e) => e.id !== elId));
    if (selectedId === elId) setSelectedId(null);
    setDirty(true);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;

    if (active.data.current?.type === "palette") {
      const { source, field } = active.data.current;
      let newElement;
      if (source === "layout") {
        if (field.layoutType === "heading") newElement = { id: uid(), type: "heading", text: "Heading" };
        else if (field.layoutType === "paragraph") newElement = { id: uid(), type: "paragraph", text: "Paragraph text" };
        else if (field.layoutType === "divider") newElement = { id: uid(), type: "divider" };
      } else {
        if (usedFieldIds.has(field.fieldId)) return; // guard: same check as the disabled palette state
        // system or custom field — targetModule is deliberately NOT set here; it's derived
        // server-side at publish time (formVersionService.deriveTargetModule), never by the UI.
        newElement = {
          id: uid(),
          type: "field",
          fieldId: field.fieldId,
          source,
          required: isAlwaysRequired(field.fieldId),
        };
      }
      if (!newElement) return;

      setElements((prev) => {
        const withoutSubmit = prev.filter((e) => e.type !== "submitButton");
        const submitEl = prev.find((e) => e.type === "submitButton");
        const overIndex = withoutSubmit.findIndex((e) => e.id === over.id);
        const insertAt = overIndex === -1 ? withoutSubmit.length : overIndex + 1;
        let next = [...withoutSubmit];
        next.splice(insertAt, 0, newElement);

        // Any field (system or custom) belongs to a CRM module that has its own hard-required
        // fields (e.g. Company Name for any Company field, or a custom field marked Required in
        // Settings) — the builder must never let a visitor-facing form reach publish in a state
        // that can't actually create the record it's meant for. Backfill silently, mark the
        // inserted fields so the canvas can explain why they're there.
        if (source === "system" || source === "custom") {
          const owningModule = source === "system" ? moduleFromFieldId(field.fieldId) : form?.module;
          if (owningModule) {
            const requiredFields = getRequiredFieldsForModule(owningModule);
            const existingIds = new Set(next.filter((e) => e.type === "field").map((e) => e.fieldId));
            const missing = requiredFields.filter((f) => !existingIds.has(f.fieldId));
            if (missing.length > 0) {
              const missingElements = missing.map((f) => ({
                id: uid(),
                type: "field",
                fieldId: f.fieldId,
                source: SYSTEM_FIELDS[owningModule]?.some((sf) => sf.fieldId === f.fieldId) ? "system" : "custom",
                required: true,
              }));
              next = [...missingElements, ...next];
              const labels = missing.map((f) => f.label).join(" and ");
              // One-time notification only — no permanent marker is kept on the element (backend
              // schema has no autoAdded field either). Once inserted, these fields behave exactly
              // like any other field; the user only needs to be told why, once.
              setTimeout(() => toast(`${labels} automatically added — required to create ${owningModule} records.`, { icon: "ℹ️" }), 0);
            }
          }
        }

        return ensureSubmitButton(submitEl ? [...next, submitEl] : next);
      });
      setDirty(true);
      return;
    }

    // Reordering an existing canvas element. If dropped over the canvas container itself (empty
    // space below/between items, geometrically closest to the container rather than a specific
    // sortable item — a real gap in the first version of this file, not a hypothetical one), treat
    // it as "move to the end" instead of silently doing nothing.
    if (active.id === over.id) return;
    setElements((prev) => {
      const oldIndex = prev.findIndex((e) => e.id === active.id);
      if (oldIndex === -1) return prev;
      if (over.id === "canvas-droppable") {
        const withoutActive = prev.filter((e) => e.id !== active.id);
        const submitIdx = withoutActive.findIndex((e) => e.type === "submitButton");
        const insertAt = submitIdx === -1 ? withoutActive.length : submitIdx;
        const moved = prev[oldIndex];
        const next = [...withoutActive];
        next.splice(insertAt, 0, moved);
        return next;
      }
      const newIndex = prev.findIndex((e) => e.id === over.id);
      if (newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
    setDirty(true);
  };

  const buildLayoutPayload = () => [
    {
      id: form.layout?.[0]?.id || uid(),
      title: form.layout?.[0]?.title || "",
      order: 0,
      elements: elements.map((e, i) => ({ ...e, order: i })),
    },
  ];

  const saveDraft = async () => {
    setSaving(true);
    try {
      const res = await API.patch(`/forms/${id}`, { layout: buildLayoutPayload(), theme });
      setForm(res.data.form);
      setDirty(false);
      toast.success("Draft saved");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      // Save first so publish always reflects the current canvas, not the last save.
      const saveRes = await API.patch(`/forms/${id}`, { layout: buildLayoutPayload(), theme });
      setForm(saveRes.data.form);
      setDirty(false);
      const res = await API.post(`/forms/${id}/publish`);
      toast.success(`Published (version ${res.data.versionNumber})`);
      navigate(`/forms/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  const selectedElement = elements.find((e) => e.id === selectedId) || null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="h-screen flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shrink-0">
          <Link to={`/forms/${id}`} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 text-sm font-medium">
            <ArrowLeft className="w-3.5 h-3.5" />
            {form.title}
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-900">Builder</span>
          {dirty && <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>}
          <div className="flex-1" />
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
          >
            <Eye className="w-4 h-4" /> Preview
          </button>
          <button
            onClick={saveDraft}
            disabled={saving}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Draft"}
          </button>
          <button
            onClick={publish}
            disabled={publishing}
            className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {publishing ? "Publishing..." : "Publish"}
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <FieldsPanel
            module={form.module}
            customFields={customFields}
            usedFieldIds={usedFieldIds}
            theme={theme}
            onThemeChange={updateTheme}
          />
          <Canvas
            elements={elements}
            fieldMetaById={fieldMetaById}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={deleteElement}
            isFieldLocked={isFieldLocked}
            theme={theme}
          />
          <PropertiesPanel element={selectedElement} fieldMetaById={fieldMetaById} onChange={updateElement} />
        </div>
      </div>

      {showPreview && <PreviewModal elements={elements} fieldMetaById={fieldMetaById} theme={theme} onClose={() => setShowPreview(false)} />}
    </DndContext>
  );
};

export default FormBuilderPage;
