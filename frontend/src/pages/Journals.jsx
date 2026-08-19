import React, { useRef, useState } from "react";
import { BookOpen, Plus, Search as SearchIcon, X } from "lucide-react";
import QuickJournalForm from "../components/journal/QuickJournalForm";

export default function Journals() {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const searchInputRef = useRef(null);

  return (
    <div
      style={{
        marginTop: -24,
        marginLeft: -32,
        marginRight: -32,
        paddingLeft: 24,
        paddingRight: 24,
        boxSizing: "border-box",
      }}
    >
      {/* Fixed strip — same pinned-below-header treatment as Companies.jsx's
          toolbar. Title text lives in the top navbar (Header.jsx) instead;
          this strip carries the module title/subtitle, search, and the
          add-entry button so the banding matches other list pages even
          before Journals has real data to search/create. */}
      <div
        className="fixed right-0 h-16 px-4 lg:px-6 border-b border-[#E1E4EA] bg-white flex items-center justify-between gap-4 top-[54px] lg:top-16"
        style={{
          left: "var(--sidebar-width, 0px)",
          zIndex: 40,
          minHeight: "64px",
          maxHeight: "64px",
          boxSizing: "border-box",
        }}
      >
        <div className="flex flex-col justify-center gap-1 min-w-0 flex-shrink-0">
          <h1 className="m-0 leading-tight font-bold text-base sm:text-lg text-gray-900 truncate">
            Journals
          </h1>
          <p className="m-0 leading-tight text-[10px] sm:text-xs text-gray-500 truncate">
            Track accounting journal entries
          </p>
        </div>

        <div className="relative flex-1 min-w-0 flex items-center justify-end">
          <div
            className={`relative h-10 flex items-center border border-[#E1E4EA] rounded-full bg-white transition-all duration-300 ease-in-out hover:bg-gray-50 focus-within:border-[#0085FF] focus-within:hover:bg-white ${
              isSearchExpanded ? "w-full lg:w-[416px]" : "w-10"
            } max-w-full`}
          >
            <SearchIcon
              className="absolute left-3 cursor-pointer z-10 flex-shrink-0 top-1/2 -translate-y-1/2 w-4 h-4 text-[#525866]"
              onClick={() => {
                setIsSearchExpanded(true);
                searchInputRef.current?.focus();
              }}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsSearchExpanded(true)}
              onBlur={() => {
                if (!searchTerm) setIsSearchExpanded(false);
              }}
              className={`w-full h-full pl-9 pr-9 bg-transparent text-sm focus:outline-none transition-opacity duration-200 cursor-pointer ${
                isSearchExpanded ? "opacity-100 focus:cursor-text" : "opacity-0"
              }`}
              placeholder="Search journals..."
            />
            {isSearchExpanded && searchTerm && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setSearchTerm("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-5 h-5 rounded-full text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowQuickAdd(true)}
          className="inline-flex items-center justify-center gap-2 h-10 w-10 lg:w-auto px-0 lg:px-4 bg-[#0085FF] text-white text-sm font-medium rounded-full hover:bg-blue-600 focus:outline-none cursor-pointer transition-colors flex-shrink-0"
          title="New Journal"
        >
          <Plus className="w-4 h-4 flex-shrink-0" />
          <span className="hidden lg:inline">New Journal</span>
        </button>
      </div>

      {showQuickAdd && (
        <QuickJournalForm onRequestClose={() => setShowQuickAdd(false)} />
      )}

      <div className="pt-16 flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <BookOpen className="h-12 w-12 text-gray-300 mb-4" />
        <h1 className="text-xl font-semibold text-gray-800">Journals</h1>
        <p className="text-gray-500 mt-2 max-w-md">
          This feature is planned for a later stage.
        </p>
      </div>
    </div>
  );
}
