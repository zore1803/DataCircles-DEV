import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Plus, ChevronDown, Check, Pencil, Trash2, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import API from "../../services/api";

/*
 * Right-hand drawer for the saved Notes / Terms blocks that print in a
 * document's footer.
 *
 * An organization keeps several per document type — a domestic and an export
 * set of terms, say — with one marked as the default. This panel lists them,
 * creates and edits them, and can drop one into the document currently open.
 * Applying copies the text, so editing a template later never rewrites a
 * document that was already issued.
 */

const TABS = [
  { key: "notes", label: "Notes", noun: "Note" },
  { key: "terms", label: "Terms", noun: "Terms" },
];

/* Only the document types this app renders a footer for. */
const DOC_TYPES = [
  { key: "tax", label: "Invoice" },
  { key: "performa", label: "Pro Forma Invoice" },
  { key: "quotation", label: "Quotation" },
  { key: "deliveryChallan", label: "Delivery Challan" },
];

const PLACEHOLDER = {
  notes: `A short message to the customer, e.g. "Thank you for the business!"`,
  terms:
    "1. Goods once sold cannot be taken back or exchanged.\n2. Subject to local jurisdiction.",
};

const Badge = ({ tone = "gray", children }) => {
  const tones = {
    blue: "bg-[#E3F1FF] text-[#0085FF]",
    green: "bg-green-100 text-green-700",
    gray: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${tones[tone]}`}>
      {children}
    </span>
  );
};

const NotesTermsDrawer = ({
  isOpen,
  onClose,
  focus = "notes",
  type = "tax",
  docName = "Invoice",
  onApplyNotes,
  onApplyTerms,
}) => {
  const [active, setActive] = useState(focus);
  const [docType, setDocType] = useState(type);
  const [typeOpen, setTypeOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState([]);
  // null = list view; otherwise the record being edited ({} for a new one).
  const [editing, setEditing] = useState(null);

  const tabRefs = useRef({});
  const typeRef = useRef(null);
  const titleRef = useRef(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const tab = useMemo(() => TABS.find((t) => t.key === active) || TABS[0], [active]);
  const typeLabel = DOC_TYPES.find((d) => d.key === docType)?.label || DOC_TYPES[0].label;

  // Open on the tab that was clicked, and on the document you're editing.
  useEffect(() => {
    if (!isOpen) return;
    setActive(focus);
    setDocType(type);
    setEditing(null);
  }, [isOpen, focus, type]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await API.get("/document-footers", {
        params: { kind: active, docType },
      });
      setTemplates(res.data?.templates || []);
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't load saved templates");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, active, docType]);

  // Focus the first field once, when the editor opens for a given record.
  // Keyed on the record id (or "new") rather than the `editing` object itself:
  // that object is recreated on every keystroke, so depending on it re-ran
  // this effect per character and stole the caret out of whatever you were
  // typing in.
  const editingKey = editing ? editing._id || "new" : null;
  useEffect(() => {
    if (editingKey) titleRef.current?.focus();
  }, [editingKey]);

  // Slide the underline to the active tab, same as the Contacts nav.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const el = tabRefs.current[active];
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [isOpen, active]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (typeOpen) setTypeOpen(false);
      else if (editing) setEditing(null);
      else onClose();
    };
    const onClick = (e) => {
      if (typeRef.current && !typeRef.current.contains(e.target)) setTypeOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [isOpen, onClose, typeOpen, editing]);

  const handleSave = async () => {
    if (!editing.body?.trim()) return toast.error(`${tab.label} text can't be empty.`);
    setSaving(true);
    try {
      const payload = {
        title: editing.title || "",
        body: editing.body,
        isDefault: !!editing.isDefault,
        isActive: editing.isActive !== false,
      };
      if (editing._id) {
        await API.patch(`/document-footers/${editing._id}`, payload);
      } else {
        await API.post("/document-footers", { ...payload, kind: active, docType });
      }
      toast.success(`${tab.noun} saved`);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t) => {
    try {
      await API.delete(`/document-footers/${t._id}`);
      toast.success(`${tab.noun} deleted`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete");
    }
  };

  const handleMakeDefault = async (t) => {
    try {
      await API.patch(`/document-footers/${t._id}`, { isDefault: true });
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to set default");
    }
  };

  const handleApply = (t) => {
    (active === "notes" ? onApplyNotes : onApplyTerms)?.(t.body);
    toast.success(`Applied to this ${docName.toLowerCase()}`);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100004]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside
        role="dialog"
        aria-label="Document notes and terms"
        className="fixed dc-panel-card dc-panel-w bg-white shadow-2xl flex flex-col overflow-hidden animate-slideInRight"
      >
        {/* The switcher lives in the header, so the panel's bottom border does
            double duty as the tab underline track. */}
        <header className="flex-shrink-0 flex items-stretch justify-between gap-3 px-3 border-b border-[#E1E4EA]">
          <nav className="relative flex items-stretch h-14">
            {TABS.map((t) => {
              const on = active === t.key;
              return (
                <button
                  key={t.key}
                  ref={(el) => (tabRefs.current[t.key] = el)}
                  type="button"
                  onClick={() => {
                    setActive(t.key);
                    setEditing(null);
                  }}
                  aria-pressed={on}
                  className="flex items-center justify-center px-5 h-full whitespace-nowrap transition-colors"
                  style={{
                    fontFamily: "Inter",
                    fontWeight: 600,
                    fontSize: "14px",
                    letterSpacing: "-0.04em",
                    color: on ? "#0085FF" : "#44444A",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
            <span
              className="absolute bottom-0 pointer-events-none transition-all duration-300 ease-out"
              style={{ left: indicator.left, width: indicator.width, height: 3, background: "#0085FF" }}
            />
          </nav>
          <button
            type="button"
            onClick={onClose}
            className="self-center p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {editing ? (
          /* ---------------------------------------------------- edit view */
          <>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#525866] hover:text-[#1F2937] self-start"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to list
              </button>

              <input
                ref={titleRef}
                value={editing.title || ""}
                onChange={(e) => setEditing((p) => ({ ...p, title: e.target.value }))}
                placeholder={`${tab.noun} name (optional), e.g. "Export terms"`}
                className="w-full h-10 px-3 rounded-lg border border-[#E1E4EA] text-[13px] placeholder:text-[#99A0AE] focus:outline-none focus:border-[#0085FF] flex-shrink-0"
              />
              <textarea
                value={editing.body || ""}
                onChange={(e) => setEditing((p) => ({ ...p, body: e.target.value }))}
                placeholder={PLACEHOLDER[active]}
                className="flex-1 min-h-[180px] w-full px-3 py-2 rounded-lg border border-[#E1E4EA] text-[13px] leading-relaxed placeholder:text-[#99A0AE] focus:outline-none focus:border-[#0085FF] resize-none"
              />

              <div className="flex flex-col gap-2 flex-shrink-0">
                <label className="flex items-center gap-2 text-[13px] text-[#1F2937] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!editing.isDefault}
                    onChange={(e) => setEditing((p) => ({ ...p, isDefault: e.target.checked }))}
                    className="w-4 h-4 accent-[#0085FF]"
                  />
                  Use as the default for {typeLabel.toLowerCase()}s
                </label>
                <label className="flex items-center gap-2 text-[13px] text-[#1F2937] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.isActive !== false}
                    onChange={(e) => setEditing((p) => ({ ...p, isActive: e.target.checked }))}
                    className="w-4 h-4 accent-[#0085FF]"
                  />
                  Active
                </label>
              </div>
            </div>

            <footer className="flex-shrink-0 px-5 py-3 border-t border-[#E1E4EA] bg-[#FAFBFC] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="h-9 px-4 rounded-full border border-[#E1E4EA] text-[13px] font-medium text-[#1F2937] hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="h-9 px-5 rounded-full bg-[#0085FF] hover:bg-blue-600 text-white text-[13px] font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </footer>
          </>
        ) : (
          /* ---------------------------------------------------- list view */
          <>
            <div className="flex-shrink-0 px-5 pt-4 flex items-center justify-between gap-3">
              <div ref={typeRef} className="relative w-full max-w-[280px]">
                <button
                  type="button"
                  onClick={() => setTypeOpen((v) => !v)}
                  className="w-full h-10 flex items-center gap-2 px-3 rounded-lg border border-[#E1E4EA] bg-white text-left hover:border-[#C9CFD8] focus:outline-none focus:border-[#0085FF] transition-colors"
                >
                  <span className="flex-1 truncate text-sm text-[#1F2937]">{typeLabel}</span>
                  <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </button>
                {typeOpen && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-[#E1E4EA] rounded-lg shadow-lg z-50 py-1 max-h-64 overflow-auto">
                    {DOC_TYPES.map((d) => {
                      const on = d.key === docType;
                      return (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => {
                            setDocType(d.key);
                            setTypeOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${on ? "text-[#0085FF] font-medium" : "text-gray-700"}`}
                        >
                          <span className="flex-1 text-left truncate">{d.label}</span>
                          {on && <Check className="w-4 h-4 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditing({ title: "", body: "", isDefault: false, isActive: true })
                }
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-[#0085FF] hover:bg-blue-600 text-white text-[13px] font-medium transition-colors flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                Create New {tab.noun}
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-2">
              {loading ? (
                [0, 1, 2].map((i) => (
                  <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
                ))
              ) : templates.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm font-medium text-[#1F2937]">
                    No {tab.label.toLowerCase()} saved yet
                  </p>
                  <p className="text-xs text-[#99A0AE] mt-1">
                    Create one to reuse it on every {typeLabel.toLowerCase()}.
                  </p>
                </div>
              ) : (
                templates.map((t) => (
                  <div
                    key={t._id}
                    className={`rounded-xl border p-3 transition-colors ${t.isDefault ? "border-[#0085FF] bg-[#F5FAFF]" : "border-[#E1E4EA] bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-[#1F2937] truncate">
                            {t.title || `Untitled ${tab.noun.toLowerCase()}`}
                          </span>
                          {t.isDefault && <Badge tone="blue">Default</Badge>}
                          <Badge tone={t.isActive ? "green" : "gray"}>
                            {t.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-[12px] text-[#525866] mt-1 line-clamp-2 whitespace-pre-line">
                          {t.body}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditing(t)}
                          title="Edit"
                          className="p-1.5 rounded-lg text-[#525866] hover:bg-gray-100 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(t)}
                          title="Delete"
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[#E1E4EA]/70">
                      <button
                        type="button"
                        onClick={() => handleApply(t)}
                        className="text-[12px] font-medium text-[#0085FF] hover:underline"
                      >
                        Apply to this {docName.toLowerCase()}
                      </button>
                      {!t.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleMakeDefault(t)}
                          className="text-[12px] font-medium text-[#525866] hover:underline"
                        >
                          Make default
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <footer className="flex-shrink-0 px-5 py-3 border-t border-[#E1E4EA] bg-[#FAFBFC] flex items-center justify-between gap-3">
              <p className="text-[11px] text-[#99A0AE] min-w-0 truncate">
                Applying copies the text onto this {docName.toLowerCase()}.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-5 rounded-full border border-[#E1E4EA] text-[13px] font-medium text-[#1F2937] hover:bg-gray-50 transition-colors flex-shrink-0"
              >
                Close
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>,
    document.body
  );
};

export default NotesTermsDrawer;
