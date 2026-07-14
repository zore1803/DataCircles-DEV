import React, { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, Search, ChevronDown, Filter } from "lucide-react";

const OPERATORS = [
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Does not contain" },
  { value: "is", label: "Is exact" },
  { value: "is_not", label: "Is not" },
  { value: "in", label: "In (comma separated)" },
  { value: "not_in", label: "Not in (comma separated)" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
];

// --- Custom Searchable Dropdown Sub-Component ---
const SearchableColumnSelect = ({ columns, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredColumns = columns.filter((col) =>
    col.label.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const selectedColumn = columns.find((col) => col.key === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between border border-gray-300 rounded-lg text-sm px-3 py-2 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
      >
        <span className="truncate pr-2">
          {selectedColumn ? selectedColumn.label : "Select column..."}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100 flex items-center gap-2 bg-gray-50">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              autoFocus
              placeholder="Search columns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <ul className="max-h-48 overflow-y-auto">
            {filteredColumns.length > 0 ? (
              filteredColumns.map((col) => (
                <li
                  key={col.key}
                  onClick={() => {
                    onChange(col.key);
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                  className="px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 truncate">
                    {col.icon && <col.icon className="w-4 h-4 text-gray-400" />}
                    <span className="truncate">{col.label}</span>
                  </div>
                  {col.isCustomField && (
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">
                      Custom
                    </span>
                  )}
                </li>
              ))
            ) : (
              <li className="px-3 py-4 text-sm text-center text-gray-500">
                No columns found
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

// --- Main Panel Component ---
export default function AdvancedFilterPanel({
  isOpen,
  onClose,
  columns,
  filters,
  setFilters,
  onApply,
  title = "Advanced Filters",
  subtitle = "Build dynamic queries for your CRM",
  emptyStateText = "Add a rule to narrow down your list.",
}) {
  const [localFilters, setLocalFilters] = useState([]);

  useEffect(() => {
    if (isOpen) {
      const filtersWithIds = (filters || []).map((f) => ({
        ...f,
        id: Math.random().toString(36).substr(2, 9),
      }));
      setLocalFilters(filtersWithIds);
    }
  }, [isOpen, filters]);

  const addFilter = () => {
    setLocalFilters([
      ...localFilters,
      {
        id: Math.random().toString(36).substr(2, 9),
        column: "",
        operator: "contains",
        value: "",
      },
    ]);
  };

  const updateFilter = (id, field, value) => {
    setLocalFilters((prev) =>
      prev.map((filter) => {
        if (filter.id === id) {
          const updated = { ...filter, [field]: value };
          if (
            field === "operator" &&
            (value === "is_empty" || value === "is_not_empty")
          ) {
            updated.value = "";
          }
          return updated;
        }
        return filter;
      }),
    );
  };

  const removeFilter = (id) => {
    setLocalFilters((prev) => prev.filter((f) => f.id !== id));
  };

  const handleApply = () => {
    const validFilters = localFilters
      .filter(
        (f) =>
          f.column &&
          f.operator &&
          (["is_empty", "is_not_empty"].includes(f.operator) ||
            f.value.trim() !== ""),
      )
      .map(({ id, ...rest }) => rest);

    setFilters(validFilters);
    onApply(validFilters);
    onClose();
  };

  const handleClear = () => {
    setLocalFilters([]);
    setFilters([]);
    onApply([]);
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 h-full w-[450px] bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Filter className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              {/* USE DYNAMIC TITLE & SUBTITLE HERE */}
              <h2 className="text-lg font-bold text-gray-900 font-sf">
                {title}
              </h2>
              <p className="text-xs text-gray-500 font-inter">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50/30">
          {localFilters.length === 0 ? (
            <div className="text-center py-10 px-4 border-2 border-dashed border-gray-200 rounded-xl bg-white">
              <Filter className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-gray-700">
                No filters applied
              </h3>
              {/* USE DYNAMIC EMPTY STATE TEXT HERE */}
              <p className="text-xs text-gray-500 mt-1 mb-4">
                {emptyStateText}
              </p>
              <button
                onClick={addFilter}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add Rule
              </button>
            </div>
          ) : (
            localFilters.map((filter) => {
              const isValueDisabled = ["is_empty", "is_not_empty"].includes(
                filter.operator,
              );

              return (
                <div
                  key={filter.id}
                  className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative group"
                >
                  <button
                    onClick={() => removeFilter(filter.id)}
                    className="absolute -top-2 -right-2 bg-white border border-gray-200 p-1.5 rounded-full text-red-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all shadow-sm z-10"
                    title="Remove filter"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                        Where
                      </label>
                      <SearchableColumnSelect
                        columns={columns}
                        value={filter.column}
                        onChange={(val) =>
                          updateFilter(filter.id, "column", val)
                        }
                      />
                    </div>

                    <div className="flex gap-2">
                      <div className="w-[45%]">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                          Condition
                        </label>
                        <select
                          value={filter.operator}
                          onChange={(e) =>
                            updateFilter(filter.id, "operator", e.target.value)
                          }
                          className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          {OPERATORS.map((op) => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-[55%]">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                          Value
                        </label>
                        {!isValueDisabled ? (
                          <input
                            type="text"
                            value={filter.value}
                            onChange={(e) =>
                              updateFilter(filter.id, "value", e.target.value)
                            }
                            placeholder="Enter value..."
                            className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        ) : (
                          <div className="w-full bg-gray-50 border border-gray-200 rounded-lg flex items-center px-3 py-2 text-sm text-gray-400 italic">
                            N/A
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {localFilters.length > 0 && (
            <button
              onClick={addFilter}
              className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-blue-200 bg-blue-50/50 rounded-xl text-sm font-medium text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Another Rule
            </button>
          )}
        </div>

        <div className="p-5 border-t border-gray-200 flex gap-3 bg-white">
          <button
            onClick={handleClear}
            className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Clear All
          </button>
          <button
            onClick={handleApply}
            className="flex-[2] py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </>
  );
}
