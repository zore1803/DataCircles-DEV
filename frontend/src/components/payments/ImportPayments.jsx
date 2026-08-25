import React, { useState, useEffect } from "react";
import { Upload, FileSpreadsheet, AlertCircle, X, Download } from "lucide-react";
import Papa from "papaparse";
import API from "../../services/api";

/*
 * Import for Payment records only — the one row-type payments-timeline
 * actually owns (Invoice/Purchase/Subscription rows are read from their own
 * modules, not created here). There's no bulk-import backend endpoint for
 * Payment, so this loops the existing single-row POST /payments-timeline
 * (createPayment), same as the page's own bulk-delete already loops
 * DELETE /payments-timeline/:id per row.
 *
 * Deliberately doesn't reuse company/ImportClients.jsx's FieldMappingModal —
 * that modal's field list ("Company Name", "Industry", ...) is hard-coded to
 * Company, not actually generic — so this does its own lightweight mapping
 * step scoped to Payment's much smaller field set.
 */

const TARGET_FIELDS = [
  { key: "vendorName", label: "Vendor / Party Name", required: true },
  { key: "amount", label: "Amount", required: true },
  { key: "paymentDate", label: "Payment Date", required: true },
  { key: "direction", label: "Direction (Credit/Debit or IN/OUT)", required: true },
  { key: "paymentType", label: "Payment Type", required: true },
  { key: "bank", label: "Bank Account" },
  { key: "notes", label: "Notes" },
];

const normalizeDirection = (raw) => {
  const v = String(raw || "").trim().toUpperCase();
  if (v === "IN" || v === "CREDIT") return "IN";
  if (v === "OUT" || v === "DEBIT") return "OUT";
  return null;
};

// Best-effort auto-match: pick the CSV header whose name most closely
// resembles the target field's key/label (case/space/punctuation-insensitive).
const guessHeader = (headers, field) => {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const targets = [field.key, field.label].map(norm);
  return headers.find((h) => targets.includes(norm(h))) || "";
};

export default function ImportPayments({ isOpen, onClose, onImportSuccess }) {
  const [file, setFile] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setCsvHeaders([]);
      setCsvRows([]);
      setMapping({});
      setError("");
      setSuccess("");
      setLoading(false);
      setProgress(0);
    }
  }, [isOpen]);

  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;
    const name = selectedFile.name.toLowerCase();
    if (!name.endsWith(".csv")) {
      setError("Please select a CSV file");
      return;
    }
    setFile(selectedFile);
    setError("");
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          setError("CSV file appears to be empty or invalid");
          return;
        }
        const headers = Object.keys(results.data[0] || {});
        setCsvHeaders(headers);
        setCsvRows(results.data);
        const autoMapping = {};
        TARGET_FIELDS.forEach((f) => { autoMapping[f.key] = guessHeader(headers, f); });
        setMapping(autoMapping);
      },
      error: (err) => setError("Failed to parse CSV file: " + err.message),
    });
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]);
  };

  const handleImport = async () => {
    const missingRequired = TARGET_FIELDS.filter((f) => f.required && !mapping[f.key]);
    if (missingRequired.length > 0) {
      setError(`Please map: ${missingRequired.map((f) => f.label).join(", ")}`);
      return;
    }

    setLoading(true);
    setError("");
    setProgress(0);

    let imported = 0;
    let failed = 0;
    const total = csvRows.length;

    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i];
      const direction = normalizeDirection(row[mapping.direction]);
      const amount = parseFloat(row[mapping.amount]);
      const vendorName = String(row[mapping.vendorName] || "").trim();
      const paymentDate = row[mapping.paymentDate];
      const paymentType = String(row[mapping.paymentType] || "").trim();

      if (!vendorName || !amount || !direction || !paymentDate || !paymentType) {
        failed++;
      } else {
        try {
          await API.post("/payments-timeline", {
            vendorName,
            amount,
            paymentDate,
            direction,
            paymentType,
            bank: mapping.bank ? row[mapping.bank] : "",
            notes: mapping.notes ? row[mapping.notes] : "",
          });
          imported++;
        } catch {
          failed++;
        }
      }
      setProgress(Math.round(((i + 1) / total) * 100));
    }

    setLoading(false);
    if (imported > 0) {
      setSuccess(`Imported ${imported} of ${total} payment${total !== 1 ? "s" : ""}.${failed ? ` ${failed} skipped (missing/invalid required fields).` : ""}`);
      if (onImportSuccess) onImportSuccess();
      setTimeout(() => onClose(), 2000);
    } else {
      setError("No rows were imported — check that Direction is Credit/Debit (or IN/OUT) and all required fields are mapped correctly.");
    }
  };

  const downloadSampleCSV = () => {
    const csvContent = `Vendor Name,Amount,Payment Date,Direction,Payment Type,Bank Account,Notes
Acme Supplies,15000,2026-01-15,Debit,Bank Transfer,HDFC Current,Office supplies
Global Traders,8500,2026-01-18,Credit,UPI,SBI Savings,Advance received`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "payment_import_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[10000] animate-fadeIn" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-xl bg-white shadow-2xl z-[10001] flex flex-col overflow-hidden animate-slideInRight">
        <div className="p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Import Payments from CSV</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" disabled={loading}>
              <X size={24} />
            </button>
          </div>

          {loading && (
            <div className="mb-6">
              <div className="bg-gray-200 rounded-full h-3 w-full overflow-hidden">
                <div className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-in-out" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-sm text-gray-600 mt-2">Importing... {progress}% done</p>
            </div>
          )}

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors mb-6 ${
              dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
            } ${loading ? "opacity-50 pointer-events-none" : ""}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center">
              {file ? (
                <>
                  <FileSpreadsheet className="w-12 h-12 text-green-500 mb-3" />
                  <p className="text-sm text-gray-700 mb-2"><span className="font-medium">{file.name}</span></p>
                  <p className="text-xs text-gray-500 mb-4">{csvHeaders.length > 0 && `${csvHeaders.length} columns, ${csvRows.length} rows detected`}</p>
                </>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-gray-400 mb-3" />
                  <p className="text-sm text-gray-700 mb-2"><span className="font-medium">Click to upload</span> or drag and drop</p>
                  <p className="text-xs text-gray-500 mb-4">CSV files only</p>
                </>
              )}
              <input type="file" onChange={(e) => handleFileChange(e.target.files[0])} accept=".csv" className="hidden" id="payments-import-file" disabled={loading} />
              <label htmlFor="payments-import-file" className={`bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer transition-colors shadow-sm ${loading ? "opacity-50 cursor-not-allowed" : ""}`}>
                Choose File
              </label>
            </div>
          </div>

          <div className="mb-6">
            <button onClick={downloadSampleCSV} className="flex items-center text-sm text-blue-600 hover:text-blue-800 transition-colors" disabled={loading}>
              <Download className="w-4 h-4 mr-2" /> Download Sample Template
            </button>
          </div>

          {csvHeaders.length > 0 && (
            <div className="mb-6 space-y-3">
              <h4 className="text-sm font-medium text-gray-900">Map CSV Columns</h4>
              {TARGET_FIELDS.map((f) => (
                <div key={f.key} className="flex items-center gap-3">
                  <label className="w-48 text-xs text-gray-600 flex-shrink-0">
                    {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  <select
                    value={mapping[f.key] || ""}
                    onChange={(e) => setMapping((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    disabled={loading}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Not mapped --</option>
                    {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded flex items-center">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded">{success}</div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200 mt-6">
            <button onClick={onClose} className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors" disabled={loading}>
              Cancel
            </button>
            {csvHeaders.length > 0 && (
              <button
                onClick={handleImport}
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Importing..." : `Import ${csvRows.length} Row${csvRows.length !== 1 ? "s" : ""}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
