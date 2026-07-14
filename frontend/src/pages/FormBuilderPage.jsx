// pages/FormBuilderPage.jsx
// Form Builder — dedicated full-width route, /forms/:id/builder (see FORMS_FRONTEND_ARCHITECTURE.md
// §1.2 amendment). Vertical slice: Canvas + drag/drop + Properties + Save (PATCH) + Publish (POST),
// enough for a user to drag fields onto a form, save, reload, and publish.
//
// Drag/drop uses @dnd-kit (already a dependency, already used the same way in KanbanSettings.jsx —
// DndContext/PointerSensor/SortableContext/useSortable/arrayMove — no new library introduced).
//
// Scope notes, not blockers:
// - Single section only for v1 (layout is an array of sections per FORMS_SCHEMA.md §1a; multi-
//   section UI is extra complexity not needed to prove "drag two fields, save, publish").
// - Field "Label" in the Properties panel is READ-ONLY: FormDefinition's elementSchema has no label
//   field for type:"field" elements — the display label is always derived from the field definition
//   itself (system field meta, or a custom field's own `name`), edited in Settings > *Fields, not here.
// - Layout components: Heading/Paragraph/Divider only for this slice (Spacer/Image deferred — Image
//   in particular has no upload endpoint, so it would only ever be a raw-URL field if added).
// - A submitButton element is auto-ensured (not draggable, not deletable) so every form is usable.
// - Preview is a simplified read-only render, not the shared public-renderer preview the original
//   spec described — that renderer doesn't exist yet (flagged repeatedly; building it is separate,
//   larger work). This preview proves the layout looks right without pretending to be the real thing.
// - Cross-module guard: the Company-fields group on a Contact form lists ONLY system Company fields
//   (hardcoded, matching backend/utils/systemFields.js exactly) — custom Company fields are never
//   fetched or offered as draggable options, per FORMS_SCHEMA.md invariant #17.
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
} from "lucide-react";

// Mirrors backend/utils/systemFields.js exactly (SYSTEM_FIELD_IDS/SYSTEM_FIELD_META) — no frontend
// endpoint exposes this static registry, so it's inlined rather than fetched.
const SYSTEM_FIELDS = {
  Contact: [
    { fieldId: "system:contact.name", label: "Name", type: "string" },
    { fieldId: "system:contact.email", label: "Email", type: "string" },
    { fieldId: "system:contact.phone", label: "Phone", type: "string" },
    { fieldId: "system:contact.company", label: "Company", type: "string" },
  ],
  Company: [
    { fieldId: "system:company.name", label: "Company Name", type: "string" },
    { fieldId: "system:company.industry", label: "Industry", type: "dropdown" },
    { fieldId: "system:company.gstin", label: "GSTIN", type: "string" },
    { fieldId: "system:company.address", label: "Address", type: "string" },
    { fieldId: "system:company.website", label: "Website", type: "url" },
  ],
  Vendor: [
    { fieldId: "system:vendor.name", label: "Vendor Name", type: "string" },
    { fieldId: "system:vendor.gstin", label: "GSTIN", type: "string" },
    { fieldId: "system:vendor.phone", label: "Phone", type: "string" },
    { fieldId: "system:vendor.email", label: "Email", type: "string" },
    { fieldId: "system:vendor.address", label: "Address", type: "string" },
  ],
};

const FIELD_ENDPOINT_BY_MODULE = {
  Contact: "/contact-fields",
  Company: "/company-fields",
  Vendor: "/vendor-fields",
};

function uid() {
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function ensureSubmitButton(elements) {
  if (elements.some((e) => e.type === "submitButton")) return elements;
  return [...elements, { id: uid(), type: "submitButton", order: elements.length, label: "Submit" }];
}

// --- Palette (Fields panel) ---

function PaletteItem({ id, data, children }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id, data });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 cursor-grab active:cursor-grabbing hover:border-blue-300 hover:bg-blue-50 transition-colors select-none"
    >
      {children}
    </div>
  );
}

function FieldsPanel({ module, customFields }) {
  const systemFields = SYSTEM_FIELDS[module] || [];

  return (
    <div className="w-64 shrink-0 bg-white border-r border-gray-200 p-4 overflow-y-auto flex flex-col gap-5">
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{module} Fields</p>
        <div className="flex flex-col gap-1.5">
          {systemFields.map((f) => (
            <PaletteItem key={f.fieldId} id={`palette-${f.fieldId}`} data={{ type: "palette", source: "system", field: f }}>
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
          {/* Cross-module guard, built into the panel itself: ONLY system Company fields are ever
              listed here — custom Company fields are never fetched or offered, since the backend
              rejects any cross-module custom field at publish time (FORMS_SCHEMA.md invariant #17).
              A user should never be able to drag the wrong thing in the first place. */}
          <div className="flex flex-col gap-1.5">
            {SYSTEM_FIELDS.Company.map((f) => (
              <PaletteItem key={f.fieldId} id={`palette-${f.fieldId}`} data={{ type: "palette", source: "system", field: f }}>
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
  );
}

// --- Canvas ---

function elementLabel(element, fieldMetaById) {
  if (element.type === "field") return fieldMetaById.get(element.fieldId)?.label || element.fieldId;
  if (element.type === "heading") return element.text || "Heading";
  if (element.type === "paragraph") return element.text || "Paragraph text";
  if (element.type === "divider") return "Divider";
  if (element.type === "submitButton") return element.label || "Submit";
  return element.type;
}

function CanvasItem({ element, fieldMetaById, isSelected, onSelect, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: element.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const deletable = element.type !== "submitButton";

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(element.id)}
      className={`flex items-center gap-2 bg-white border-2 rounded-lg px-3 py-2.5 cursor-pointer transition-all ${
        isSelected ? "border-blue-400 shadow-md" : "border-gray-200 hover:border-gray-300"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      <button {...attributes} {...listeners} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{elementLabel(element, fieldMetaById)}</p>
        {element.type === "field" && <p className="text-xs text-gray-400">{element.required ? "Required" : "Optional"}</p>}
      </div>
      {deletable && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(element.id); }}
          className="text-gray-300 hover:text-red-500 p-1"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function Canvas({ elements, fieldMetaById, selectedId, onSelect, onDelete }) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-droppable" });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 p-8 overflow-y-auto ${isOver ? "bg-blue-50/40" : ""}`}
    >
      <div className="max-w-xl mx-auto bg-white rounded-xl border border-gray-200 shadow-sm p-6 min-h-[500px]">
        {elements.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[400px] text-center">
            <p className="text-gray-400 text-sm">Drag fields here to build your form</p>
          </div>
        ) : (
          <SortableContext items={elements.map((e) => e.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {elements.map((el) => (
                <CanvasItem
                  key={el.id}
                  element={el}
                  fieldMetaById={fieldMetaById}
                  isSelected={selectedId === el.id}
                  onSelect={onSelect}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
}

// --- Properties panel ---

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
    return (
      <div className="w-72 shrink-0 bg-white border-l border-gray-200 p-4 overflow-y-auto flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>
          {/* Read-only: no per-form label override exists in the schema — the label always comes
              from the field definition itself (edited in Settings > *Fields, not here). */}
          <p className="text-sm text-gray-700 px-2 py-1.5 bg-gray-50 rounded border border-gray-100">{meta?.label || element.fieldId}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={!!element.required}
            onChange={(e) => onChange({ ...element, required: e.target.checked })}
          />
          Required
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
              <label className="block text-xs text-gray-500 mb-1">Min</label>
              <input
                type="text"
                value={overrides.min ?? ""}
                onChange={(e) => onChange({ ...element, validationOverrides: { ...overrides, min: e.target.value } })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Max</label>
              <input
                type="text"
                value={overrides.max ?? ""}
                onChange={(e) => onChange({ ...element, validationOverrides: { ...overrides, max: e.target.value } })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>
          <div className="mt-2">
            <label className="block text-xs text-gray-500 mb-1">Regex</label>
            <input
              type="text"
              value={overrides.regex || ""}
              onChange={(e) => onChange({ ...element, validationOverrides: { ...overrides, regex: e.target.value } })}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            />
          </div>
        </div>
      </div>
    );
  }

  if (element.type === "heading" || element.type === "paragraph") {
    return (
      <div className="w-72 shrink-0 bg-white border-l border-gray-200 p-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">Text</label>
        <textarea
          value={element.text || ""}
          onChange={(e) => onChange({ ...element, text: e.target.value })}
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
          rows={element.type === "paragraph" ? 4 : 2}
        />
      </div>
    );
  }

  if (element.type === "submitButton") {
    return (
      <div className="w-72 shrink-0 bg-white border-l border-gray-200 p-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">Button Label</label>
        <input
          type="text"
          value={element.label || ""}
          onChange={(e) => onChange({ ...element, label: e.target.value })}
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
        />
      </div>
    );
  }

  return (
    <div className="w-72 shrink-0 bg-white border-l border-gray-200 p-4">
      <p className="text-sm text-gray-400">No editable properties for this element.</p>
    </div>
  );
}

// --- Preview (simplified — not the shared public renderer, which doesn't exist yet) ---

function PreviewModal({ elements, fieldMetaById, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Preview</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Simplified preview — the real public form renderer doesn't exist yet.
          </p>
          {elements.map((el) => {
            if (el.type === "heading") return <h3 key={el.id} className="text-lg font-bold text-gray-900">{el.text || "Heading"}</h3>;
            if (el.type === "paragraph") return <p key={el.id} className="text-sm text-gray-600">{el.text || "Paragraph text"}</p>;
            if (el.type === "divider") return <hr key={el.id} className="border-gray-200" />;
            if (el.type === "submitButton") return (
              <button key={el.id} disabled className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg opacity-70">
                {el.label || "Submit"}
              </button>
            );
            if (el.type === "field") {
              const meta = fieldMetaById.get(el.fieldId);
              return (
                <div key={el.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {meta?.label || el.fieldId}{el.required && <span className="text-red-500"> *</span>}
                  </label>
                  <input disabled placeholder={el.placeholder || ""} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50" />
                  {el.helpText && <p className="text-xs text-gray-400 mt-1">{el.helpText}</p>}
                </div>
              );
            }
            return null;
          })}
        </div>
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
  const [customFields, setCustomFields] = useState([]);
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
    customFields.forEach((f) => map.set(f._id, { fieldId: f._id, label: f.name, type: f.type }));
    return map;
  }, [form, customFields]);

  const updateElement = (updated) => {
    setElements((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setDirty(true);
  };

  const deleteElement = (elId) => {
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
        // system or custom field — targetModule is deliberately NOT set here; it's derived
        // server-side at publish time (formVersionService.deriveTargetModule), never by the UI.
        newElement = {
          id: uid(),
          type: "field",
          fieldId: field.fieldId,
          source,
          required: false,
        };
      }
      if (!newElement) return;

      setElements((prev) => {
        const withoutSubmit = prev.filter((e) => e.type !== "submitButton");
        const submitEl = prev.find((e) => e.type === "submitButton");
        const overIndex = withoutSubmit.findIndex((e) => e.id === over.id);
        const insertAt = overIndex === -1 ? withoutSubmit.length : overIndex + 1;
        const next = [...withoutSubmit];
        next.splice(insertAt, 0, newElement);
        return ensureSubmitButton(submitEl ? [...next, submitEl] : next);
      });
      setDirty(true);
      return;
    }

    // Reordering an existing canvas element
    if (active.id !== over.id) {
      setElements((prev) => {
        const oldIndex = prev.findIndex((e) => e.id === active.id);
        const newIndex = prev.findIndex((e) => e.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
      setDirty(true);
    }
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
      const res = await API.patch(`/forms/${id}`, { layout: buildLayoutPayload() });
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
      const saveRes = await API.patch(`/forms/${id}`, { layout: buildLayoutPayload() });
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
          <FieldsPanel module={form.module} customFields={customFields} />
          <Canvas
            elements={elements}
            fieldMetaById={fieldMetaById}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={deleteElement}
          />
          <PropertiesPanel element={selectedElement} fieldMetaById={fieldMetaById} onChange={updateElement} />
        </div>
      </div>

      {showPreview && <PreviewModal elements={elements} fieldMetaById={fieldMetaById} onClose={() => setShowPreview(false)} />}
    </DndContext>
  );
};

export default FormBuilderPage;
