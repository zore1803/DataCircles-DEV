import React, { useEffect, useState, useRef } from "react";

const CustomDropdown = ({ options, value, onChange, placeholder, className = "", buttonClassName = "", renderValue, dropdownIcon }) => {
    const [isOpen, setIsOpen] = useState(false);
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

    const displayValue = value || "";

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={buttonClassName || `w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] text-left flex items-center justify-between transition-all bg-white font-inter ${isOpen ? "ring-1 ring-blue-500 border-blue-500" : ""
                    } ${!displayValue ? "text-[#A0A0A0]" : "text-gray-900 font-medium"}`}
            >
                {renderValue ? renderValue(displayValue || placeholder) : <span className="truncate">{displayValue || placeholder}</span>}
                {dropdownIcon ? dropdownIcon : (
                    <svg
                        className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                )}
            </button>

            {isOpen && (
                <div className="absolute z-[10010] mt-2 w-full bg-white border border-[#E0E0E1] rounded-xl shadow-xl max-h-60 overflow-y-auto py-2 animate-in fade-in zoom-in duration-200">
                    {options.map((option, index) => {
                        const isSelected = option === value;
                        return (
                            <button
                                key={index}
                                type="button"
                                onClick={() => {
                                    onChange(option);
                                    setIsOpen(false);
                                }}
                                className={`w-full px-4 py-2.5 text-[14px] text-left hover:bg-[#F2F2F7] transition-colors font-inter ${isSelected ? "bg-[#F2F2F7] text-blue-600 font-bold" : "text-gray-700"
                                    }`}
                            >
                                {option}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default CustomDropdown;
