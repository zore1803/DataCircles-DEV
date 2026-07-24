import React, { useMemo, useState } from "react";
import { X, ChevronDown, ChevronRight } from "lucide-react";
import FilterIcon from "../common/FilterIcon";

// Amazon-style faceted filter panel for the company profile sub-tabs (Deals,
// Contacts, Invoices, Notes, Tasks, Meetings): a list of columns, click one to
// reveal the actual distinct values present in the data for that column as
// checkboxes, select some, hit Apply.
//
// columns: [{ key, label }]
// data: the raw list of items currently shown, used to derive each column's
//   distinct values
// getFieldValue(item, key): resolves the raw value of `key` on `item`
// selected: { [columnKey]: string[] } currently-applied selections (controlled)
// onApply(selected): called with the full selection map when Apply is clicked
export default function CompanyFilterPanel({
  isOpen,
  onClose,
  columns,
  data = [],
  getFieldValue,
  selected = {},
  onApply,
  title = "Filters",
  subtitle = "Filter this list by column",
}) {
  const [expandedColumn, setExpandedColumn] = useState(null);
  const [draft, setDraft] = useState(selected);

  React.useEffect(() => {
    if (isOpen) setDraft(selected);
  }, [isOpen, selected]);

  const valuesByColumn = useMemo(() => {
    const map = {};
    columns.forEach((col) => {
      // Columns with an explicit `options` list (e.g. Stage, Amount ranges)
      // always show the full fixed set, regardless of what's in the current data.
      if (col.options) {
        map[col.key] = col.options;
        return;
      }
      const set = new Set();
      data.forEach((item) => {
        const v = getFieldValue(item, col.key);
        if (v !== undefined && v !== null && v !== "") set.add(String(v));
      });
      map[col.key] = Array.from(set).sort();
    });
    return map;
  }, [columns, data, getFieldValue]);

  if (!isOpen) return null;

  const toggleValue = (colKey, value) => {
    setDraft((prev) => {
      const current = prev[colKey] || [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [colKey]: next };
    });
  };

  const totalSelected = Object.values(draft).reduce(
    (sum, arr) => sum + (arr?.length || 0),
    0,
  );

  const handleApply = () => {
    const cleaned = Object.fromEntries(
      Object.entries(draft).filter(([, arr]) => arr && arr.length > 0),
    );
    onApply(cleaned);
    onClose();
  };

  const handleClear = () => {
    setDraft({});
    onApply({});
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-end z-[10001] p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[26px] w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl border border-gray-100 flex flex-col animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-6 bg-gray-50/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FilterIcon size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 font-sf">{title}</h2>
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

        <div className="flex-1 overflow-y-auto">
          {columns.map((col) => {
            const isExpanded = expandedColumn === col.key;
            const values = valuesByColumn[col.key] || [];
            const selectedCount = draft[col.key]?.length || 0;

            return (
              <div key={col.key} className="border-b border-gray-100">
                <button
                  type="button"
                  onClick={() => setExpandedColumn(isExpanded ? null : col.key)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-800 flex items-center gap-2">
                    {col.label}
                    {selectedCount > 0 && (
                      <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {selectedCount}
                      </span>
                    )}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-5 pb-4 space-y-2 max-h-56 overflow-y-auto">
                    {values.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">
                        No values available for this column.
                      </p>
                    ) : (
                      values.map((value) => (
                        <label
                          key={value}
                          className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={(draft[col.key] || []).includes(value)}
                            onChange={() => toggleValue(col.key, value)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="truncate">{value}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-gray-200 flex gap-3 bg-white flex-shrink-0">
          <button
            onClick={handleClear}
            className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
          >
            Clear All
          </button>
          <button
            onClick={handleApply}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Apply Filters{totalSelected > 0 ? ` (${totalSelected})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
