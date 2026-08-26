import React, { useEffect, useState } from "react";
import { Pencil, Printer, Trash2, X } from "lucide-react";
import API from "../../services/api";

// Same server-rendered-PDF approach as PurchaseOrderPreview.jsx: fetch the
// actual PDF (backend/utils/htmlDocumentPdf.js, type "salesOrder") and show
// it in an iframe — what you see here is exactly what downloads/prints.
const SalesOrderPreview = ({ salesOrder, isOpen, onClose, onEdit, onDelete }) => {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isOpen) setTimeout(() => setOpen(true), 10);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && salesOrder?._id) {
      fetchPdf();
    }
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, salesOrder?._id]);

  const fetchPdf = async () => {
    setLoadError(false);
    setPdfUrl(null);
    try {
      const response = await API.get(`/sales-orders/download/${salesOrder._id}`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      setPdfUrl(URL.createObjectURL(blob));
    } catch (error) {
      console.error("Sales order PDF fetch error:", error);
      setLoadError(true);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(onClose, 300);
  };

  if (!isOpen || !salesOrder) return null;

  const handlePrint = () => {
    const frame = document.getElementById("sales-order-pdf-frame");
    if (frame?.contentWindow) frame.contentWindow.print();
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[10000] transition-opacity duration-300 ease-in-out"
        style={{ opacity: open ? 1 : 0 }}
        onClick={handleClose}
      />

      <div
        className={`
          fixed inset-0 z-[10001] flex items-center justify-center p-2
          transition-opacity duration-300 ease-in-out
          ${open ? "opacity-100" : "opacity-0"}
        `}
        onClick={handleClose}
      >
      <div
        className={`
          bg-white rounded-xl w-full h-[97vh] max-w-[1400px]
          shadow-2xl flex flex-col overflow-hidden
          transform transition-transform duration-300 ease-in-out
          ${open ? "scale-100" : "scale-95"}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500">
            Sales Order Preview
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

        <div className="flex-1 p-2 overflow-auto bg-gray-100">
          {pdfUrl ? (
            <iframe
              id="sales-order-pdf-frame"
              src={`${pdfUrl}#navpanes=0`}
              title="Sales Order PDF"
              className="w-full h-full border-0 rounded-lg"
            />
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <p className="text-sm text-red-600 font-medium mb-2">
                Couldn't load this sales order's PDF.
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
      </div>
    </>
  );
};

export default SalesOrderPreview;
