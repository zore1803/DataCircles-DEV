// components/common/TableFilters.jsx
import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  Search,
  X,
  ChevronDown,
  SortAsc,
  SortDesc,
  Download,
} from "lucide-react";
import jsPDF from "jspdf";
import { autoTable } from "jspdf-autotable";
import FilterIcon from "./common/FilterIcon";

const TableFilters = ({
  data = [],
  columns = [],
  onFilteredDataChange,
  searchableColumns = [],
  sortableColumns = [],
  customFilters = {},
  showSearch = true,
  showSort = true,
  showColumnFilters = true,
  showExport = true,
  className = "",
  placeholder = "Search...",
  exportFileName = "data",
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "" });
  const [columnFilters, setColumnFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);

  // Helper function to get nested object values
  const getNestedValue = useCallback((obj, path) => {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }, []);

  // import.meta and filter data
  const filteredAndSortedData = useMemo(() => {
    let filtered = [...data];

    // Apply search filter
    if (searchTerm && showSearch) {
      const searchColumns =
        searchableColumns.length > 0 ? searchableColumns : columns;
      filtered = filtered.filter((item) =>
        searchColumns.some((column) => {
          const value = getNestedValue(item, column.key);
          return (
            value &&
            value.toString().toLowerCase().includes(searchTerm.toLowerCase())
          );
        })
      );
    }

    // Apply column-specific filters
    if (showColumnFilters) {
      Object.entries(columnFilters).forEach(([columnKey, filterValue]) => {
        if (filterValue && filterValue !== "all") {
          filtered = filtered.filter((item) => {
            if (customFilters[columnKey]) {
              return customFilters[columnKey](item, filterValue);
            }
            const value = getNestedValue(item, columnKey);
            return (
              value &&
              value.toString().toLowerCase().includes(filterValue.toLowerCase())
            );
          });
        }
      });
    }

    // Apply sorting
    if (sortConfig.key && showSort) {
      filtered.sort((a, b) => {
        const aValue = getNestedValue(a, sortConfig.key);
        const bValue = getNestedValue(b, sortConfig.key);

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        // Handle dates
        if (
          sortConfig.key.includes("Date") ||
          sortConfig.key.includes("date")
        ) {
          const aDate = new Date(aValue);
          const bDate = new Date(bValue);
          return sortConfig.direction === "asc" ? aDate - bDate : bDate - aDate;
        }

        // Handle strings
        if (typeof aValue === "string" && typeof bValue === "string") {
          const comparison = aValue
            .toLowerCase()
            .localeCompare(bValue.toLowerCase());
          return sortConfig.direction === "asc" ? comparison : -comparison;
        }

        // Handle numbers
        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [
    data,
    searchTerm,
    columnFilters,
    sortConfig,
    columns,
    searchableColumns,
    customFilters,
    showSearch,
    showSort,
    showColumnFilters,
    getNestedValue,
  ]);

  // Notify parent of changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (onFilteredDataChange) {
        onFilteredDataChange(filteredAndSortedData);
      }
    }, 150);
    return () => clearTimeout(timeoutId);
  }, [filteredAndSortedData, onFilteredDataChange]);

  // Get unique values for column filters (limit to prevent overwhelming UI)
  const getColumnUniqueValues = useCallback(
    (columnKey) => {
      const values = data
        .map((item) => getNestedValue(item, columnKey))
        .filter((value) => value !== null && value !== undefined)
        .map((value) => value.toString());
      const uniqueValues = [...new Set(values)].sort();
      return uniqueValues.slice(0, 20); // Limit to 20 options
    },
    [data, getNestedValue]
  );

  const handleSort = (columnKey) => {
    if (!showSort) return;

    const isSortable =
      sortableColumns.length === 0 ||
      sortableColumns.some((col) => col.key === columnKey);
    if (!isSortable) return;

    setSortConfig((prev) => {
      if (prev.key === columnKey) {
        if (prev.direction === "asc") {
          return { key: columnKey, direction: "desc" };
        } else {
          return { key: "", direction: "" }; // Clear sort
        }
      }
      return { key: columnKey, direction: "asc" };
    });
  };

  const handleColumnFilter = (columnKey, value) => {
    setColumnFilters((prev) => ({
      ...prev,
      [columnKey]: value,
    }));
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setColumnFilters({});
    setSortConfig({ key: "", direction: "" });
  };

  // PDF Export function
  const exportToPDF = () => {
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(16);
    doc.text(`${exportFileName} Report`, 14, 20);

    // Add generation date
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Total Records: ${filteredAndSortedData.length}`, 14, 35);

    // Prepare table data
    const headers = columns.map((col) => col.label);
    const rows = filteredAndSortedData.map((item) =>
      columns.map((col) => {
        const value = getNestedValue(item, col.key);
        if (value === null || value === undefined) return "";
        if (col.key.includes("Date") || col.key.includes("date")) {
          return new Date(value).toLocaleDateString();
        }
        return value.toString();
      })
    );

    // Generate table
    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 45,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [59, 130, 246], // Blue header
        textColor: 255,
        fontSize: 9,
      },
      columnStyles: {
        0: { cellWidth: "auto" },
      },
      margin: { top: 45, bottom: 20 },
      didDrawPage: function (data) {
        // Footer
        doc.setFontSize(8);
        doc.text(
          "Page " + doc.internal.getNumberOfPages(),
          data.settings.margin.left,
          doc.internal.pageSize.height - 10
        );
      },
    });

    // Save the PDF
    doc.save(`${exportFileName}-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchTerm) count++;
    count += Object.values(columnFilters).filter(
      (value) => value && value !== "all"
    ).length;
    if (sortConfig.key) count++;
    return count;
  }, [searchTerm, columnFilters, sortConfig]);

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}
    >
      {/* Main Control Bar */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Search */}
          {showSearch && (
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={placeholder}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            {/* Sort Dropdown */}
            {showSort && sortableColumns.length > 0 && (
              <div className="relative">
                <select
                  value={
                    sortConfig.key
                      ? `${sortConfig.key}-${sortConfig.direction}`
                      : ""
                  }
                  onChange={(e) => {
                    if (!e.target.value) {
                      setSortConfig({ key: "", direction: "" });
                    } else {
                      const [key, direction] = e.target.value.split("-");
                      setSortConfig({ key, direction });
                    }
                  }}
                  className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sort by...</option>
                  {sortableColumns.map((col) => {
                    const column = columns.find((c) => c.key === col.key);
                    return column
                      ? [
                          <option
                            key={`${col.key}-asc`}
                            value={`${col.key}-asc`}
                          >
                            {column.label} (A-Z)
                          </option>,
                          <option
                            key={`${col.key}-desc`}
                            value={`${col.key}-desc`}
                          >
                            {column.label} (Z-A)
                          </option>,
                        ]
                      : null;
                  })}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
              </div>
            )}

            {/* Filters Toggle */}
            {showColumnFilters && columns.length > 0 && (
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  showFilters ||
                  Object.keys(columnFilters).some(
                    (key) => columnFilters[key] && columnFilters[key] !== "all"
                  )
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <FilterIcon size={16} />
                Filters
                {Object.keys(columnFilters).some(
                  (key) => columnFilters[key] && columnFilters[key] !== "all"
                ) && (
                  <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {
                      Object.values(columnFilters).filter(
                        (value) => value && value !== "all"
                      ).length
                    }
                  </span>
                )}
              </button>
            )}

            {/* Export PDF */}
            {showExport && filteredAndSortedData.length > 0 && (
              <button
                onClick={exportToPDF}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
            )}

            {/* Clear All */}
            {activeFiltersCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
          <span>
            Showing{" "}
            <span className="font-semibold text-gray-900">
              {filteredAndSortedData.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-gray-900">{data.length}</span>{" "}
            results
          </span>
          {activeFiltersCount > 0 && (
            <span className="text-blue-600 font-medium">
              {activeFiltersCount} active filter
              {activeFiltersCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Column Filters Panel */}
      {showFilters && showColumnFilters && (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {columns.map((column) => {
              if (column.filterable === false) return null;

              const uniqueValues = getColumnUniqueValues(column.key);
              if (uniqueValues.length <= 1) return null;

              return (
                <div key={column.key} className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {column.label}
                  </label>
                  <div className="relative">
                    <select
                      value={columnFilters[column.key] || "all"}
                      onChange={(e) =>
                        handleColumnFilter(column.key, e.target.value)
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                    >
                      <option value="all">All ({uniqueValues.length})</option>
                      {uniqueValues.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="p-3 bg-blue-50 border-b border-blue-200">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium text-blue-800">
              Active filters:
            </span>
            {searchTerm && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-blue-200 rounded text-sm text-blue-700">
                Search: "{searchTerm}"
                <button
                  onClick={() => setSearchTerm("")}
                  className="text-blue-500 hover:text-blue-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {Object.entries(columnFilters).map(([key, value]) => {
              if (!value || value === "all") return null;
              const column = columns.find((col) => col.key === key);
              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-blue-200 rounded text-sm text-blue-700"
                >
                  {column?.label || key}: {value}
                  <button
                    onClick={() => handleColumnFilter(key, "all")}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
            {sortConfig.key && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-blue-200 rounded text-sm text-blue-700">
                Sort:{" "}
                {columns.find((col) => col.key === sortConfig.key)?.label ||
                  sortConfig.key}{" "}
                ({sortConfig.direction.toUpperCase()})
                <button
                  onClick={() => setSortConfig({ key: "", direction: "" })}
                  className="text-blue-500 hover:text-blue-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TableFilters;
