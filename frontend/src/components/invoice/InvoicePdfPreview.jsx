import { useEffect, useState } from "react";
import { X, Download, Loader2 } from "lucide-react";
import API from "../../services/api";
import toast from "react-hot-toast";

/**
 * Renders a saved document's own PDF — the same bytes the download produces,
 * from GET /<path>/download/:id — so the preview can never disagree with the
 * file the customer receives.
 *
 * Deliberately not a re-implementation of the document layout: anything that
 * re-renders the invoice from its fields in the browser is a second source of
 * truth, and the two drift.
 */
export default function InvoicePdfPreview({ open, id, title, apiPath = "invoices", onClose }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !id) return;
    let objectUrl = null;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await API.get(`/${apiPath}/download/${id}`, { responseType: "blob" });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
        setPdfUrl(objectUrl);
      } catch {
        if (!cancelled) toast.error("Couldn't load the document preview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setPdfUrl(null);
    };
  }, [open, id, apiPath]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10005] bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E1E4EA] flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{title || "Invoice"}</h3>
            <p className="text-xs text-gray-500">Preview</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={pdfUrl || undefined}
              download={`${title || "invoice"}.pdf`}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E1E4EA] text-sm font-medium text-gray-700 hover:bg-gray-50 ${
                pdfUrl ? "" : "pointer-events-none opacity-50"
              }`}
            >
              <Download className="w-4 h-4" />
              Download
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-gray-100">
          {loading || !pdfUrl ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading preview…
            </div>
          ) : (
            <iframe src={pdfUrl} title="Invoice preview" className="w-full h-full border-0" />
          )}
        </div>
      </div>
    </div>
  );
}
