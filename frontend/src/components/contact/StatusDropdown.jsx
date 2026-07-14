import React, { useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { lifecycleStageStatuses } from "../../utils/contactConstants";

const StatusDropdown = ({ contact, onUpdate, isOpen, onToggle }) => {
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                if (isOpen) onToggle(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen, onToggle]);

    const getStatusColor = (status) => {
        switch (status) {
            case "New":
            case "Lead":
                return "bg-blue-100 text-blue-800";
            case "Contacted":
                return "bg-amber-100 text-amber-800";
            case "Interested":
                return "bg-cyan-100 text-cyan-800";
            case "Qualified":
            case "Won":
                return "bg-purple-100 text-purple-800 border-purple-200";
            case "Un-Qualified":
            case "Lost":
                return "bg-red-100 text-red-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };

    return (
        <div className="relative inline-block text-left" ref={dropdownRef}>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onToggle(isOpen ? null : contact._id);
                }}
                className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all hover:ring-2 hover:ring-opacity-50 ${getStatusColor(
                    contact.stageStatus || "New"
                )}`}
            >
                <span>{contact.stageStatus || "New"}</span>
                <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""
                        }`}
                />
            </button>

            {isOpen && (
                <div className="absolute left-0 mt-2 w-40 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-left">
                    {lifecycleStageStatuses.map((status) => (
                        <button
                            key={status}
                            onClick={(e) => {
                                e.stopPropagation();
                                onUpdate(contact._id, status);
                                onToggle(null);
                            }}
                            className={`w-full text-left px-4 py-2 text-xs transition-colors hover:bg-gray-50 ${contact.stageStatus === status
                                    ? "bg-blue-50 text-blue-700 font-bold"
                                    : "text-gray-700"
                                }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StatusDropdown;
