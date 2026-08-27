import React, { useEffect, useState } from "react";
import {
  Plus,
  Edit3,
  Trash2,
  Save,
  X,
  Tag,
  Type,
  Hash,
  ChevronDown,
  Calendar,
  Link as LinkIcon,
  CheckSquare,
} from "lucide-react";
import toast from "react-hot-toast";
import API from "../../services/api";
import ConfirmDialog from "../common/ConfirmDialog";

const FIELD_TYPES = [
  { value: "text", label: "Text (Multi-line)", icon: <Type className="w-4 h-4" /> },
  { value: "string", label: "String (Single-line)", icon: <Type className="w-4 h-4" /> },
  { value: "number", label: "Number", icon: <Hash className="w-4 h-4" /> },
  { value: "dropdown", label: "Dropdown", icon: <ChevronDown className="w-4 h-4" /> },
  { value: "multiselect", label: "Multi-select", icon: <CheckSquare className="w-4 h-4" /> },
  { value: "url", label: "URL", icon: <LinkIcon className="w-4 h-4" /> },
  { value: "date", label: "Date Picker", icon: <Calendar className="w-4 h-4" /> },
];

const emptyField = () => ({ name: "", type: "text", options: [], required: false, category: "Uncategorized" });

/*
 * Reusable custom-field-definition manager: add / edit / delete a field,
 * assign it to a category, and (for dropdown/multiselect) manage its option
 * list. Talks to whichever `<module>-fields` CRUD endpoint is passed in via
 * `apiBase` (e.g. "/task-fields") — that endpoint's shape (fields[],
 * fieldCategories[], category CRUD sub-routes) is the same contract every
 * *FieldSettings component already speaks (ContactFieldSettings,
 * DealFieldSettings, CompanyFieldSettings, VendorFieldSettings), so this is
 * one implementation instead of a fifth near-identical 1000+-line copy.
 *
 * Deliberately narrower than those four: no drag-and-drop category
 * reassignment. Same category CRUD and per-field editing, reached through a
 * dropdown instead of drag targets.
 */
const GenericFieldSettings = ({ apiBase, moduleLabel, icon }) => {
  const [fields, setFields] = useState([]);
  const [categories, setCategories] = useState([]);
  const [fieldDocId, setFieldDocId] = useState(null);
  const [loading, setLoading] = useState(true);

  const [newField, setNewField] = useState(emptyField());
  const [newOption, setNewOption] = useState("");

  const [editIndex, setEditIndex] = useState(null);
  const [editValue, setEditValue] = useState(emptyField());
  const [editOption, setEditOption] = useState("");

  const [newCategory, setNewCategory] = useState("");
  const [editingCategory, setEditingCategory] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState("");

  const [pendingDeleteIndex, setPendingDeleteIndex] = useState(null);
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState(null);

  useEffect(() => {
    fetchFields();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  const fetchFields = async () => {
    try {
      setLoading(true);
      const res = await API.get(apiBase);
      setFields(res.data?.fields || []);
      setCategories(res.data?.fieldCategories || []);
      setFieldDocId(res.data?._id || null);
    } catch (err) {
      console.error(`Failed to fetch ${moduleLabel} fields`, err);
      toast.error(`Failed to load ${moduleLabel} fields`);
    } finally {
      setLoading(false);
    }
  };

  const saveFields = async (updatedFields, updatedCategories = categories) => {
    try {
      const payload = { fields: updatedFields, fieldCategories: updatedCategories };
      if (fieldDocId) {
        await API.put(`${apiBase}/${fieldDocId}`, payload);
      } else {
        const res = await API.post(apiBase, payload);
        setFieldDocId(res.data._id);
      }
      setFields(updatedFields);
      setCategories(updatedCategories);
      return true;
    } catch (err) {
      console.error(`Failed to save ${moduleLabel} fields`, err);
      toast.error(err.response?.data?.error || "Failed to save");
      return false;
    }
  };

  const validateDraft = (draft) => {
    if (!draft.name.trim()) {
      toast.error("Field name is required");
      return false;
    }
    if ((draft.type === "dropdown" || draft.type === "multiselect") && (!draft.options || draft.options.length === 0)) {
      toast.error(`${draft.type === "dropdown" ? "Dropdown" : "Multi-select"} fields need at least one option`);
      return false;
    }
    return true;
  };

  const handleAdd = async () => {
    if (!validateDraft(newField)) return;
    if (fields.some((f) => f.name.toLowerCase() === newField.name.trim().toLowerCase())) {
      return toast.error("A field with this name already exists");
    }
    const category = newField.category?.trim() || "Uncategorized";
    const toAdd = { ...newField, name: newField.name.trim(), category };
    const updated = [...fields, toAdd];
    const nextCategories = categories.includes(category) ? categories : [...categories, category];
    const ok = await saveFields(updated, nextCategories);
    if (ok) {
      toast.success("Field added");
      setNewField(emptyField());
      setNewOption("");
    }
  };

  const startEdit = (index) => {
    setEditIndex(index);
    setEditValue({ ...fields[index], options: [...(fields[index].options || [])] });
    setEditOption("");
  };

  const cancelEdit = () => {
    setEditIndex(null);
    setEditValue(emptyField());
  };

  const handleUpdate = async () => {
    if (!validateDraft(editValue)) return;
    const updated = fields.map((f, i) => (i === editIndex ? { ...editValue, name: editValue.name.trim() } : f));
    const category = editValue.category?.trim() || "Uncategorized";
    const nextCategories = categories.includes(category) ? categories : [...categories, category];
    const ok = await saveFields(updated, nextCategories);
    if (ok) {
      toast.success("Field updated");
      cancelEdit();
    }
  };

  const confirmDelete = async () => {
    if (pendingDeleteIndex === null) return;
    const updated = fields.filter((_, i) => i !== pendingDeleteIndex);
    setPendingDeleteIndex(null);
    const ok = await saveFields(updated);
    if (ok) toast.success("Field deleted");
  };

  const handleCreateCategory = async () => {
    const name = newCategory.trim();
    if (!name) return toast.error("Enter a category name");
    if (categories.includes(name)) return toast.error("Category already exists");
    try {
      const res = await API.post(`${apiBase}/categories`, { categoryName: name });
      setCategories(res.data.categories);
      setNewCategory("");
      toast.success(`Category "${name}" created`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create category");
    }
  };

  const handleRenameCategory = async (oldName) => {
    const trimmed = editCategoryName.trim();
    if (!trimmed) return toast.error("Category name cannot be empty");
    if (trimmed === oldName) return setEditingCategory(null);
    try {
      const res = await API.put(`${apiBase}/categories`, { oldCategoryName: oldName, newCategoryName: trimmed });
      setCategories(res.data.categories);
      setFields(res.data.fields);
      setEditingCategory(null);
      toast.success("Category renamed");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to rename category");
    }
  };

  const doDeleteCategory = async () => {
    const name = pendingDeleteCategory;
    setPendingDeleteCategory(null);
    if (!name) return;
    try {
      const res = await API.delete(`${apiBase}/categories/${encodeURIComponent(name)}`);
      setCategories(res.data.categories);
      setFields(res.data.fields);
      toast.success("Category deleted — its fields moved to Uncategorized");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete category");
    }
  };

  const typeIcon = (type) => FIELD_TYPES.find((t) => t.value === type)?.icon || <Type className="w-4 h-4" />;

  const OptionsEditor = ({ value, onChange, draftOption, setDraftOption }) => (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={draftOption}
          onChange={(e) => setDraftOption(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const v = draftOption.trim();
              if (v && !value.options.includes(v)) {
                onChange({ ...value, options: [...value.options, v] });
                setDraftOption("");
              }
            }
          }}
          placeholder="Add an option and press Enter"
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {value.options.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.options.map((opt, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
              {opt}
              <button
                type="button"
                onClick={() => onChange({ ...value, options: value.options.filter((_, oi) => oi !== i) })}
                className="hover:text-blue-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading {moduleLabel} fields…</div>;
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h2 className="text-lg font-semibold text-gray-900">{moduleLabel} Custom Fields</h2>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Fields defined here appear in the Column Settings panel on the {moduleLabel} list (with a{" "}
        <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">Custom</span> badge)
        and as editable fields on the {moduleLabel.toLowerCase()} form.
      </p>

      {/* Add field */}
      <div className="border border-gray-200 rounded-xl p-4 mb-6 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add a field
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <input
            type="text"
            value={newField.name}
            onChange={(e) => setNewField({ ...newField, name: e.target.value })}
            placeholder="Field name (e.g. Follow-up Channel)"
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={newField.type}
            onChange={(e) => setNewField({ ...newField, type: e.target.value, options: [] })}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input
            type="text"
            list="field-categories"
            value={newField.category}
            onChange={(e) => setNewField({ ...newField, category: e.target.value })}
            placeholder="Category (optional)"
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <datalist id="field-categories">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
          <label className="flex items-center gap-2 text-sm text-gray-600 px-1">
            <input
              type="checkbox"
              checked={newField.required}
              onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
              className="rounded border-gray-300"
            />
            Required on the form
          </label>
        </div>
        {(newField.type === "dropdown" || newField.type === "multiselect") && (
          <div className="mb-3">
            <OptionsEditor value={newField} onChange={setNewField} draftOption={newOption} setDraftOption={setNewOption} />
          </div>
        )}
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Add Field
        </button>
      </div>

      {/* Categories */}
      <div className="border border-gray-200 rounded-xl p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <Tag className="w-4 h-4" /> Categories
        </h3>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="New category name"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="button" onClick={handleCreateCategory} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Add
          </button>
        </div>
        {categories.length === 0 ? (
          <p className="text-xs text-gray-400">No categories yet — fields default to "Uncategorized".</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <div key={c} className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-full text-xs">
                {editingCategory === c ? (
                  <>
                    <input
                      autoFocus
                      value={editCategoryName}
                      onChange={(e) => setEditCategoryName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRenameCategory(c)}
                      className="px-1.5 py-0.5 text-xs border border-blue-300 rounded"
                    />
                    <button onClick={() => handleRenameCategory(c)} className="text-green-600"><Save className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setEditingCategory(null)} className="text-gray-400"><X className="w-3.5 h-3.5" /></button>
                  </>
                ) : (
                  <>
                    <span>{c}</span>
                    <button onClick={() => { setEditingCategory(c); setEditCategoryName(c); }} className="text-gray-400 hover:text-gray-700">
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button onClick={() => setPendingDeleteCategory(c)} className="text-gray-400 hover:text-red-600">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Field list */}
      <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
        {fields.length === 0 ? (
          <p className="p-6 text-sm text-gray-400 text-center">No custom fields yet — add one above.</p>
        ) : (
          fields.map((field, index) => (
            <div key={index} className="p-4">
              {editIndex === index ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={editValue.name}
                      onChange={(e) => setEditValue({ ...editValue, name: e.target.value })}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    />
                    <select
                      value={editValue.type}
                      onChange={(e) => setEditValue({ ...editValue, type: e.target.value, options: editValue.options })}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    >
                      {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <input
                      type="text"
                      list="field-categories"
                      value={editValue.category}
                      onChange={(e) => setEditValue({ ...editValue, category: e.target.value })}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    />
                    <label className="flex items-center gap-2 text-sm text-gray-600 px-1">
                      <input
                        type="checkbox"
                        checked={!!editValue.required}
                        onChange={(e) => setEditValue({ ...editValue, required: e.target.checked })}
                      />
                      Required
                    </label>
                  </div>
                  {(editValue.type === "dropdown" || editValue.type === "multiselect") && (
                    <OptionsEditor value={editValue} onChange={setEditValue} draftOption={editOption} setDraftOption={setEditOption} />
                  )}
                  <div className="flex gap-2">
                    <button onClick={handleUpdate} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
                      <Save className="w-3.5 h-3.5" /> Save
                    </button>
                    <button onClick={cancelEdit} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-gray-400">{typeIcon(field.type)}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">{field.name}</span>
                        {field.required && <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded">Required</span>}
                      </div>
                      <div className="text-xs text-gray-400">
                        {FIELD_TYPES.find((t) => t.value === field.type)?.label || field.type} · {field.category || "Uncategorized"}
                        {field.options?.length ? ` · ${field.options.length} option${field.options.length === 1 ? "" : "s"}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => startEdit(index)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setPendingDeleteIndex(index)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        isOpen={pendingDeleteIndex !== null}
        title="Delete this field?"
        message={`This removes "${fields[pendingDeleteIndex]?.name}" from the ${moduleLabel.toLowerCase()} field list and from the Column Settings panel. Values already saved on existing ${moduleLabel.toLowerCase()}s are left untouched but become unlabeled.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteIndex(null)}
      />
      <ConfirmDialog
        isOpen={!!pendingDeleteCategory}
        title="Delete this category?"
        message={`Fields in "${pendingDeleteCategory}" will be moved to Uncategorized, not deleted.`}
        confirmLabel="Delete"
        onConfirm={doDeleteCategory}
        onCancel={() => setPendingDeleteCategory(null)}
      />
    </div>
  );
};

export default GenericFieldSettings;
