import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import API from "../../services/api";
import { Save, FileText, PenSquare, Eye, Plus, Trash2, CheckCircle, ShieldCheck } from "lucide-react";
import SignatureModal from "./SignatureModal";

const documentTypeMeta = [
  { key: "invoice", label: "Invoice" },
  { key: "quote", label: "Quote" },
  { key: "proformaInvoice", label: "Proforma Invoice" },
  { key: "deliveryChallan", label: "Delivery Challan" },
];

const createDefaultDocumentTypeSettings = () => ({
  invoice: { prefix: "INV-", suffix: "", prefixes: ["INV-"], suffixes: [] },
  quote: { prefix: "QT", suffix: "", prefixes: ["QT", "QTN"], suffixes: [] },
  proformaInvoice: { prefix: "PI", suffix: "", prefixes: ["PI", "PFI"], suffixes: [] },
  deliveryChallan: { prefix: "DC", suffix: "", prefixes: ["DC"], suffixes: [] },
});

function DocumentSettings() {
  const [form, setForm] = useState({
    nextInvoiceNumber: 1,
    defaultNotes: "",
    defaultTerms: "",
    documentTypeSettings: createDefaultDocumentTypeSettings(),
  });
  const [signatures, setSignatures] = useState([]);
  const [isSigModalOpen, setIsSigModalOpen] = useState(false);
  const [newValues, setNewValues] = useState({
    invoice: { prefix: "", suffix: "" },
    quote: { prefix: "", suffix: "" },
    proformaInvoice: { prefix: "", suffix: "" },
    deliveryChallan: { prefix: "", suffix: "" },
  });
  const [activeTab, setActiveTab] = useState("prefix");
  const [activeDocumentType, setActiveDocumentType] = useState("invoice");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSignatures = async () => {
    try {
      const res = await API.get("/document-settings/signatures");
      setSignatures(res.data || []);
    } catch (err) {
      console.error("Failed to load signatures", err);
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await API.get("/document-settings");
        const incoming = res.data?.documentTypeSettings || {};
        const normalizeSection = (key, fallback) => ({
          prefix: incoming?.[key]?.prefix || fallback.prefix || "INV",
          suffix: incoming?.[key]?.suffix || fallback.suffix || "",
          prefixes: incoming?.[key]?.prefixes || fallback.prefixes || [],
          suffixes: incoming?.[key]?.suffixes || fallback.suffixes || [],
        });

        setForm({
          nextInvoiceNumber: res.data?.nextInvoiceNumber || 1,
          defaultNotes: res.data?.defaultNotes || "",
          defaultTerms: res.data?.defaultTerms || "",
          documentTypeSettings: {
            invoice: normalizeSection("invoice", { prefix: "INV-", suffix: "", prefixes: ["INV-"], suffixes: [] }),
            quote: normalizeSection("quote", { prefix: "QT", suffix: "", prefixes: ["QT", "QTN"], suffixes: [] }),
            proformaInvoice: normalizeSection("proformaInvoice", { prefix: "PI", suffix: "", prefixes: ["PI", "PFI"], suffixes: [] }),
            deliveryChallan: normalizeSection("deliveryChallan", { prefix: "DC", suffix: "", prefixes: ["DC"], suffixes: [] }),
          },
        });
        await fetchSignatures();
      } catch (error) {
        console.error("Failed to load document settings", error);
        toast.error("Failed to load document settings");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const invoiceSection = form.documentTypeSettings.invoice || {};
      await API.put("/document-settings", {
        invoicePrefix: (invoiceSection.prefix || "INV").trim(),
        invoiceSuffix: (invoiceSection.suffix || "").trim(),
        invoicePrefixes: invoiceSection.prefixes || [],
        invoiceSuffixes: invoiceSection.suffixes || [],
        documentTypeSettings: form.documentTypeSettings,
        nextInvoiceNumber: Number(form.nextInvoiceNumber) || 1,
        defaultNotes: form.defaultNotes,
        defaultTerms: form.defaultTerms,
      });
      toast.success("Document settings updated");
    } catch (error) {
      console.error("Failed to save document settings", error);
      toast.error(error.response?.data?.error || "Failed to save document settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSignature = async (sigData) => {
    try {
      const res = await API.post("/document-settings/signatures", sigData);
      setSignatures(res.data.signatures || []);
      toast.success("Signature added successfully");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to save signature");
    }
  };

  const handleDeleteSignature = async (id) => {
    try {
      const res = await API.delete(`/document-settings/signatures/${id}`);
      setSignatures(res.data.signatures || []);
      toast.success("Signature deleted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete signature");
    }
  };

  const handleSetDefaultSignature = async (id) => {
    try {
      const res = await API.patch(`/document-settings/signatures/${id}/default`);
      setSignatures(res.data.signatures || []);
      toast.success("Default signature updated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update default signature");
    }
  };

  const addValue = (documentType, kind) => {
    const value = (newValues[documentType]?.[kind] || "").trim();
    if (!value) return;

    setForm((prev) => {
      const nextSettings = { ...prev.documentTypeSettings };
      const currentSection = { ...(nextSettings[documentType] || {}) };
      const existing = kind === "prefix" ? currentSection.prefixes || [] : currentSection.suffixes || [];
      const nextValues = existing.includes(value) ? existing : [...existing, value];

      nextSettings[documentType] = {
        ...currentSection,
        ...(kind === "prefix"
          ? { prefixes: nextValues, prefix: value }
          : { suffixes: nextValues, suffix: value }),
      };

      return { ...prev, documentTypeSettings: nextSettings };
    });

    setNewValues((prev) => ({
      ...prev,
      [documentType]: { ...prev[documentType], [kind]: "" },
    }));
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-sm text-sm text-gray-500">
        Loading document settings...
      </div>
    );
  }

  const currentSection = form.documentTypeSettings?.[activeDocumentType] || {};
  const currentValue = activeTab === "prefix" ? currentSection.prefix || "" : currentSection.suffix || "";
  const previewPrefix = currentSection.prefix?.trim();
  const previewSuffix = currentSection.suffix?.trim();
  const previewSegments = [
    ...(previewPrefix ? [previewPrefix] : []),
    String(form.nextInvoiceNumber || 1),
    ...(previewSuffix ? [previewSuffix] : []),
  ];
  const previewNumber = previewSegments.length ? previewSegments.join(" - ") : `INV-${form.nextInvoiceNumber || 1}`;

  return (
    <div className="space-y-8">
      {/* SECTION 1: Document Numbering Settings */}
      <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-sky-50 text-sky-600">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Document Settings</h3>
            <p className="text-sm text-gray-500">Manage saved prefixes and suffixes for invoices, quotes, proforma invoices, and delivery challans.</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {[
                { key: "prefix", label: "Prefix" },
                { key: "suffix", label: "Suffix" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === tab.key ? "bg-sky-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {documentTypeMeta.map((documentType) => {
                const isActive = activeDocumentType === documentType.key;
                return (
                  <button
                    key={documentType.key}
                    type="button"
                    onClick={() => setActiveDocumentType(documentType.key)}
                    className={`rounded-full border px-3 py-2 text-sm font-medium ${isActive ? "border-sky-600 bg-sky-50 text-sky-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
                  >
                    {documentType.label}
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              {(() => {
                const options = activeTab === "prefix" ? currentSection.prefixes || [] : currentSection.suffixes || [];
                const placeholder = activeTab === "prefix"
                  ? `Add new ${documentTypeMeta.find((item) => item.key === activeDocumentType)?.label.toLowerCase()} prefix`
                  : `Add new ${documentTypeMeta.find((item) => item.key === activeDocumentType)?.label.toLowerCase()} suffix`;

                return (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800">
                        {documentTypeMeta.find((item) => item.key === activeDocumentType)?.label} {activeTab === "prefix" ? "Prefix" : "Suffix"}
                      </h4>
                      <p className="text-sm text-gray-500">Update the saved {activeTab} for this document type.</p>
                    </div>

                    <label className="flex flex-col gap-2 text-sm">
                      <span className="font-medium text-gray-700">{activeTab === "prefix" ? "Prefix" : "Suffix"}</span>
                      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                        <PenSquare className="w-4 h-4 text-gray-400" />
                        <select
                          value={currentValue}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              documentTypeSettings: {
                                ...prev.documentTypeSettings,
                                [activeDocumentType]: {
                                  ...prev.documentTypeSettings[activeDocumentType],
                                  [activeTab]: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full outline-none bg-transparent"
                        >
                          {activeTab === "suffix" && <option value="">None</option>}
                          {options.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex gap-2">
                        <input
                          value={newValues[activeDocumentType]?.[activeTab] || ""}
                          onChange={(e) =>
                            setNewValues((prev) => ({
                              ...prev,
                              [activeDocumentType]: {
                                ...prev[activeDocumentType],
                                [activeTab]: e.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                          placeholder={placeholder}
                        />
                        <button
                          type="button"
                          onClick={() => addValue(activeDocumentType, activeTab)}
                          className="rounded-lg border border-sky-200 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50"
                        >
                          Add
                        </button>
                      </div>
                    </label>
                  </div>
                );
              })()}
            </div>

            {/* Footer boilerplate. The document editor's "Add Notes" / "Add
                Terms" buttons drop these into a document on request; nothing is
                applied automatically, so existing documents are untouched. */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-800">Default Notes &amp; Terms</h4>
                <p className="text-sm text-gray-500">
                  Saved once here, then inserted with one click while creating a document.
                </p>
              </div>

              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-gray-700">Notes</span>
                <textarea
                  rows={3}
                  value={form.defaultNotes}
                  onChange={(e) => setForm((prev) => ({ ...prev, defaultNotes: e.target.value }))}
                  placeholder="Thank you for the business!"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 resize-y"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-gray-700">Terms and Conditions</span>
                <textarea
                  rows={4}
                  value={form.defaultTerms}
                  onChange={(e) => setForm((prev) => ({ ...prev, defaultTerms: e.target.value }))}
                  placeholder={"1. Goods once sold cannot be taken back or exchanged.\n2. Subject to local jurisdiction."}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 resize-y"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </form>

          <div className="rounded-2xl border border-gray-200 bg-slate-50 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Eye className="w-4 h-4" />
              Preview
            </div>

            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-500">
                <span>{documentTypeMeta.find((item) => item.key === activeDocumentType)?.label}</span>
                <span>Draft</span>
              </div>
              <div className="mt-4 space-y-3 text-sm text-gray-700">
                <div className="flex justify-between">
                  <span className="text-gray-500">Document No.</span>
                  <span className="font-semibold text-gray-900">{previewNumber}</span>
                </div>
                <div className="flex justify-center">
                  <div className="max-w-fit overflow-hidden rounded-full border border-slate-200 bg-slate-100 p-0.5">
                    <div className="inline-flex items-center gap-0.5">
                      {previewPrefix ? <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-slate-700">{previewPrefix}</span> : null}
                      <span className="rounded-full bg-sky-600 px-2 py-0.5 font-semibold text-white">{form.nextInvoiceNumber || 1}</span>
                      {previewSuffix ? <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-slate-700">{previewSuffix}</span> : null}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Prefix</span>
                  <span>{previewPrefix || "Not set"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Suffix</span>
                  <span>{previewSuffix || "Not set"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Signature Settings */}
      <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Digital Signatures</h3>
              <p className="text-sm text-gray-500">
                Add and manage signatures for authorized document signing. (Upload, Draw, or Type)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSigModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Signature
          </button>
        </div>

        {signatures.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-10 text-center">
            <div className="p-3 rounded-full bg-purple-50 text-purple-600 mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-gray-800">No signatures added yet</p>
            <p className="text-xs text-gray-500 max-w-sm mt-1">
              Add your digital signature by uploading an image, drawing on pad, or typing with custom stylized fonts.
            </p>
            <button
              type="button"
              onClick={() => setIsSigModalOpen(true)}
              className="mt-4 text-xs font-bold text-purple-600 hover:text-purple-700 hover:underline"
            >
              + Add First Signature
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {signatures.map((sig) => (
              <div
                key={sig.id}
                className={`relative flex flex-col justify-between rounded-2xl border-2 p-4 transition-all ${
                  sig.isDefault ? "border-purple-500 bg-purple-50/20 shadow-md" : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                {sig.isDefault && (
                  <span className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-purple-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                    <CheckCircle className="w-3 h-3" /> Default
                  </span>
                )}

                <div>
                  <div className="h-28 w-full flex items-center justify-center rounded-xl bg-slate-50 p-3 shadow-inner border border-slate-100 overflow-hidden">
                    <img src={sig.dataUrl} alt={sig.name} className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="mt-3">
                    <h4 className="font-bold text-gray-900 text-sm">{sig.name}</h4>
                    <p className="text-xs text-gray-400 capitalize mt-0.5">Method: {sig.type}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                  {!sig.isDefault ? (
                    <button
                      type="button"
                      onClick={() => handleSetDefaultSignature(sig.id)}
                      className="text-xs font-semibold text-purple-600 hover:underline"
                    >
                      Make Default
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">Current Default</span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDeleteSignature(sig.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600 transition"
                    title="Delete signature"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <SignatureModal
          isOpen={isSigModalOpen}
          onClose={() => setIsSigModalOpen(false)}
          onSave={handleSaveSignature}
        />
      </div>
    </div>
  );
}

export default DocumentSettings;

