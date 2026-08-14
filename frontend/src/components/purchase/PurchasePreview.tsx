import React, { useEffect, useState } from "react";
import { Pencil, Printer, Trash2, X } from "lucide-react";
import API from "../../services/api";

// Same server-rendered-PDF approach as Accounting.jsx's InvoiceViewer: fetch
// the actual PDF (backend/utils/purchaseDocumentPdf.js) and show it in an
// iframe, instead of re-rendering the document as plain JSX in the panel —
// what you see here is exactly what downloads/prints.
const PurchasePreview = ({ purchase, isOpen, onClose, onEdit, onDelete }) => {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loadError, setLoadError] = useState(false);
  // Local mount-in/out state, same pattern as PurchaseForm: the parent
  // unmounts this component the instant `isOpen` goes false, which would
  // otherwise skip the close transition entirely — so `open` lags `isOpen`
  // by one tick on the way in, and `handleClose` delays telling the parent
  // to unmount until the slide-out animation has actually played.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isOpen) setTimeout(() => setOpen(true), 10);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && purchase?._id) {
      fetchPdf();
    }
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, purchase?._id]);

  const fetchPdf = async () => {
    setLoadError(false);
    setPdfUrl(null);
    try {
      const response = await API.get(`/purchases/download/${purchase._id}`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      setPdfUrl(URL.createObjectURL(blob));
    } catch (error) {
      console.error("Purchase PDF fetch error:", error);
      setLoadError(true);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(onClose, 300);
  };

  if (!isOpen || !purchase) return null;

  const handlePrint = () => {
    const frame = document.getElementById("purchase-pdf-frame");
    if (frame?.contentWindow) frame.contentWindow.print();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[10000] transition-opacity duration-300 ease-in-out"
        style={{ opacity: open ? 1 : 0 }}
        onClick={handleClose}
      />

      {/* Floating rounded card — matched to PurchaseForm.jsx's own shell
          (top-6/bottom-6/right-6 margin, rounded-[24px], 600px), so viewing
          a record and editing it are the same surface instead of two
          different container styles. */}
      <div
        className={`
          fixed top-6 bottom-6 right-6 rounded-[24px] z-[10001]
          w-full sm:w-[600px]
          bg-white shadow-2xl flex flex-col overflow-hidden
          transform transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "translate-x-[calc(100%+2rem)]"}
        `}
      >
        {/* Header — icon-only actions (edit / print / delete / close)
            instead of a text "Print" button, matching the reference. */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500">
            Purchase Preview
          </h2>
          <div className="flex items-center gap-1">
            {onEdit && (
              <button
                onClick={onEdit}
                title="Edit"
                className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handlePrint}
              title="Print"
              disabled={!pdfUrl}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer className="w-4 h-4" />
            </button>
            {onDelete && (
              <button
                onClick={onDelete}
                title="Delete"
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <button
              onClick={handleClose}
              title="Close"
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PDF */}
        <div className="flex-1 overflow-hidden bg-gray-100">
          {pdfUrl ? (
            <iframe
              id="purchase-pdf-frame"
              src={pdfUrl}
              title="Purchase PDF"
              className="w-full h-full border-0"
            />
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <p className="text-sm text-red-600 font-medium mb-2">
                Couldn't load this purchase's PDF.
              </p>
              <button
                onClick={fetchPdf}
                className="text-sm text-blue-600 hover:underline"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-3"></div>
              <p className="text-gray-600">Loading PDF...</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PurchasePreview;
