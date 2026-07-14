// src/components/common/ExportModal.jsx
import React, { useState, useEffect, useMemo } from "react";
import { X, Search, Download, CheckSquare, Square } from "lucide-react";
import toast from "react-hot-toast";
import API from "../../services/api"; // Make sure your API instance is imported

export default function ExportModal({
  isOpen,
  onClose,
  columns,
  selectedIds, 
  exportUrl, 
  fileName = "export.csv",
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCols, setSelectedCols] = useState([]);
  const [isExporting, setIsExporting] = useState(false);

  // When modal opens, select all visible columns by default
  useEffect(() => {
    if (isOpen) {
      setSelectedCols(
        columns.map((c) => c.key),
      );
      setSearchQuery("");
    }
  }, [isOpen, columns]);

  // Filter columns based on search
  const filteredColumns = useMemo(() => {
    return columns.filter((c) =>
      c.label.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [columns, searchQuery]);

  const toggleColumn = (key) => {
    setSelectedCols((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const toggleAll = () => {
    if (selectedCols.length === filteredColumns.length) {
      setSelectedCols([]);
    } else {
      setSelectedCols(filteredColumns.map((c) => c.key));
    }
  };

  const handleExport = async () => {
    if (selectedCols.length === 0) {
      toast.error("Please select at least one column to export");
      return;
    }

    // Format columns for the backend to understand
    const colsToExport = columns
      .filter((c) => selectedCols.includes(c.key))
      .map((c) => ({
        key: c.key,
        label: c.label,
        isCustomField: !!c.isCustomField,
      }));

    setIsExporting(true);
    const loadingToast = toast.loading("Generating Excel file...");

    try {
      // ✅ Make POST request to Backend, demanding a 'blob' (file) in return
      const response = await API.post(
        exportUrl,
        {
          selectedIds: selectedIds, // Send the IDs from all pages
          columns: colsToExport,
        },
        {
          responseType: "blob", // CRITICAL: Tells axios we are downloading a file, not JSON
        },
      );

      // Create a URL for the downloaded file and trigger browser download
      const blob = new Blob([response.data], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Successfully exported ${selectedIds.length} records!`, {
        id: loadingToast,
      });
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Failed to export data", { id: loadingToast });
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  const isAllSelected =
    filteredColumns.length > 0 &&
    selectedCols.length === filteredColumns.length;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Download className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 font-sf">
                Export Data
              </h2>
              <p className="text-xs text-gray-500">
                Select columns for Excel export
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 bg-green-50 text-green-700 p-3 rounded-lg text-sm font-medium mb-4 shrink-0 border border-green-200">
            Exporting {selectedIds.length} selected record
            {selectedIds.length === 1 ? "" : "s"}
          </div>

          <div className="relative mb-4 shrink-0">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search columns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>

          <button
            onClick={toggleAll}
            className="flex items-center gap-2 mb-3 text-sm font-semibold text-blue-600 hover:text-blue-700 shrink-0"
          >
            {isAllSelected ? (
              <>
                <CheckSquare className="w-4 h-4" /> Deselect All
              </>
            ) : (
              <>
                <Square className="w-4 h-4" /> Select All
              </>
            )}
          </button>

          <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg p-2 custom-scrollbar bg-gray-50/50">
            {filteredColumns.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">
                No columns match your search
              </div>
            ) : (
              <div className="space-y-1">
                {filteredColumns.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-3 p-2 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-blue-100"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCols.includes(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-gray-700 flex-1">
                      {col.label}
                    </span>
                    {col.isCustomField && (
                      <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                        Custom
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-b-xl shrink-0">
          <span className="text-sm font-medium text-gray-500">
            {selectedCols.length} columns selected
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={selectedCols.length === 0 || isExporting}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "Exporting..." : "Export to Excel"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
