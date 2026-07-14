import React, { useEffect, useState, useRef, useMemo } from "react";

const SearchableDropdown = ({
  options,
  value,
  onChange,
  placeholder,
  displayKey = "name",
  valueKey = "_id",
  required = false,
  error = null,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter((option) =>
      option[displayKey].toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm, displayKey]);

  const selectedOption = options.find((option) => option[valueKey] === value);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (option) => {
    onChange(option[valueKey]);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = () => {
    onChange("");
    setIsOpen(false);
    setSearchTerm("");
  };

  // Determine the border color based on validation state
  const getBorderColor = () => {
    if (error) return 'border-red-300 ring-1 ring-red-500';
    return isOpen ? 'border-blue-500 ring-1 ring-blue-500' : 'border-[#E0E0E1]';
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div
        className={`w-full border rounded-xl px-4 h-12 transition-all cursor-pointer bg-white flex items-center justify-between font-inter ${getBorderColor()}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`text-[14px] truncate ${selectedOption ? "text-gray-900 font-medium" : "text-[#A0A0A0]"}`}>
          {selectedOption ? selectedOption[displayKey] : placeholder}
        </span>
        <div className="flex items-center gap-2">
          {selectedOption && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Hidden input for HTML5 validation */}
      {required && (
        <input
          type="text"
          value={value || ""}
          onChange={() => { }}
          required
          className="absolute inset-0 opacity-0 pointer-events-none -z-10"
          tabIndex={-1}
        />
      )}

      {isOpen && (
        <div className="absolute z-[10010] w-full mt-2 bg-white border border-[#E0E0E1] rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
          <div className="p-3 border-b border-[#F2F2F7]">
            <input
              type="text"
              placeholder={`Search ${placeholder.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 px-3 text-[14px] border border-[#E0E0E1] rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-inter placeholder:text-[#A0A0A0]"
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filteredOptions.length > 0 ? (
              <>
                <div
                  className="px-4 py-2.5 text-[14px] text-gray-400 hover:bg-[#F2F2F7] cursor-pointer transition-colors italic border-b border-[#F2F2F7]"
                  onClick={handleClear}
                >
                  Clear selection
                </div>
                {filteredOptions.map((option) => (
                  <div
                    key={option[valueKey]}
                    className={`px-4 py-2.5 text-[14px] cursor-pointer hover:bg-[#F2F2F7] transition-all font-inter ${option[valueKey] === value
                        ? "bg-[#F2F2F7] text-blue-600 font-bold"
                        : "text-gray-700"
                      }`}
                    onClick={() => handleSelect(option)}
                  >
                    {option[displayKey]}
                  </div>
                ))}
              </>
            ) : (
              <div className="px-4 py-6 text-[14px] text-gray-400 text-center font-inter italic">
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableDropdown;