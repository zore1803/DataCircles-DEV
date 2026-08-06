import React, { useMemo, useState, useRef, useEffect } from "react";
import { X, ChevronDown } from "lucide-react";

// A custom dropdown component for each filter column
const FilterDropdown = ({ label, options, selected, onToggle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Format placeholder safely
  const placeholder = label.endsWith("s") ? `All ${label}` : (label.endsWith("us") ? `All ${label}es` : `All ${label}s`);

  return (
    <div className="flex flex-col gap-1.5 w-full relative" ref={dropdownRef}>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full border border-gray-200 rounded-lg px-3 py-2 cursor-pointer bg-white hover:border-gray-300 transition-colors min-h-[42px]"
      >
        <div className="flex flex-wrap gap-1.5 items-center overflow-hidden">
          {selected.length === 0 ? (
            <span className="text-sm text-gray-500">{placeholder}</span>
          ) : (
            selected.map(val => (
              <span key={val} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                <span className="truncate max-w-[120px]">{val}</span>
                <X 
                  size={14} 
                  className="cursor-pointer hover:text-blue-900 transition-colors rounded-full hover:bg-blue-100 p-px" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(val);
                  }}
                />
              </span>
            ))
          )}
        </div>
        <ChevronDown size={16} className={`text-gray-400 flex-shrink-0 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-100 rounded-lg shadow-xl z-[100] max-h-60 overflow-y-auto py-1">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 italic">No options</div>
          ) : (
            options.map(opt => (
              <label key={opt} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={selected.includes(opt)}
                  onChange={() => onToggle(opt)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-sm text-gray-700 truncate">{opt}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default function CompanyFilterPanel({
  isOpen,
  onClose,
  columns,
  data = [],
  getFieldValue,
  selected = {},
  onApply,
}) {
  const [draft, setDraft] = useState(selected);

  React.useEffect(() => {
    if (isOpen) setDraft(selected);
  }, [isOpen, selected]);

  const valuesByColumn = useMemo(() => {
    const map = {};
    columns.forEach((col) => {
      const fromData = new Set();
      data.forEach((item) => {
        const v = getFieldValue(item, col.key);
        if (v !== undefined && v !== null && v !== "") fromData.add(String(v));
      });

      if (!col.options) {
        map[col.key] = Array.from(fromData).sort();
        return;
      }

      const declared = col.options.map(String);
      const declaredSet = new Set(declared);
      const extras = Array.from(fromData)
        .filter((v) => !declaredSet.has(v))
        .sort();
      map[col.key] = [...declared, ...extras];
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
    setTimeout(() => {
      onClose();
    }, 400); // Small delay so user sees it clear before closing
  };

  return (
    <div 
      className="fixed inset-0 z-[10001] bg-transparent"
      onClick={onClose}
    >
      <div 
        className="absolute top-[220px] right-[24px] md:right-[60px] lg:right-[80px] bg-white rounded-xl shadow-[0px_8px_30px_rgba(0,0,0,0.12)] border border-gray-100 w-full max-w-[320px] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 font-sf">Filters</h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-5">
          {columns.map(col => (
             <FilterDropdown 
                key={col.key}
                label={col.label}
                options={valuesByColumn[col.key] || []}
                selected={draft[col.key] || []}
                onToggle={(val) => toggleValue(col.key, val)}
             />
          ))}
        </div>

        {/* Footer */}
        <div className="p-5 flex items-center gap-3">
          <button 
            onClick={handleClear}
            className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
          >
            Reset
          </button>
          <button 
            onClick={handleApply}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
