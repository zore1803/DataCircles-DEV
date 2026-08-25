import React, { useState, useEffect, useRef } from "react";
import { X, FileText, Download } from "lucide-react";

// Sanitize characters illegal in most OS file systems
const sanitize = (name) =>
  name
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim() || "Document";

// Substitute placeholders with actual document values
const evaluate = (template, data) => {
  let result = template;
  const map = {
    "{invoiceNumber}": data.invoiceNumber ?? "",
    "{companyName}": data.companyName ?? "",
    "{customerName}": data.customerName ?? "",
    "{documentType}": data.documentType ?? "",
    "{date}": data.date ?? "",
  };
  Object.entries(map).forEach(([k, v]) => {
    result = result.split(k).join(v);
  });
  // Clean up double separators left by empty placeholders
  result = result.replace(/\s*-\s*-+\s*/g, " - ").trim();
  return sanitize(result);
};

const PLACEHOLDERS = [
  "{invoiceNumber}",
  "{companyName}",
  "{customerName}",
  "{documentType}",
  "{date}",
];

const DownloadPdfModal = ({ isOpen, documentData, onConfirm, onCancel }) => {
  const DEFAULT_FORMAT = "{invoiceNumber} - {companyName}";
  const [format, setFormat] = useState(DEFAULT_FORMAT);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setFormat(DEFAULT_FORMAT);
      // focus the input after the modal mounts
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen || !documentData) return null;

  const preview = evaluate(format, documentData);

  const insertPlaceholder = (ph) => {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? format.length;
    const end = el.selectionEnd ?? format.length;
    const next = format.slice(0, start) + ph + format.slice(end);
    setFormat(next);
    // restore cursor after the inserted text
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + ph.length, start + ph.length);
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") onConfirm(preview);
    if (e.key === "Escape") onCancel();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[10000]"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-xl shadow-2xl w-full max-w-[440px] overflow-hidden pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-900">
                Download PDF
              </h2>
            </div>
            <button
              onClick={onCancel}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4">
            {/* Filename input */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                File Name
              </label>
              <input
                ref={inputRef}
                type="text"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="{invoiceNumber} - {companyName}"
              />
            </div>

            {/* Available placeholders */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">
                Available placeholders{" "}
                <span className="font-normal text-gray-400">
                  (click to insert)
                </span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDERS.map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => insertPlaceholder(ph)}
                    className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 border border-blue-100 text-xs text-blue-700 font-mono hover:bg-blue-100 hover:border-blue-200 transition-colors"
                  >
                    {ph}
                  </button>
                ))}
              </div>
            </div>

            {/* Live preview */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">
                Preview
              </p>
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-900 truncate font-medium">
                  {preview}.pdf
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-5 py-3 bg-gray-50 border-t border-gray-100">
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(preview)}
              className="px-3.5 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DownloadPdfModal;
