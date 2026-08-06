import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const EditablePaginationButtons = ({
  currentPage,
  totalPages,
  hasPrevPage,
  hasNextPage,
  onPageChange,
  getPageNumbers
}) => {
  const [editingPage, setEditingPage] = useState(false);
  const [pageInput, setPageInput] = useState("");

  const commitPage = () => {
    let n = parseInt(pageInput, 10);
    if (!Number.isNaN(n)) {
      if (n < 1) n = 1;
      if (n > totalPages) n = totalPages;
      if (n !== currentPage) {
        onPageChange(n);
      }
    }
    setEditingPage(false);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!hasPrevPage}
        className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {totalPages > 0 &&
        getPageNumbers().map((item, index) => {
          if (item === "left-dots" || item === "right-dots" || item === "...") {
            return (
              <span
                key={`${item}-${index}`}
                className="flex items-center justify-center w-8 h-8 text-sm font-medium text-gray-400 select-none"
              >
                ...
              </span>
            );
          }
          const isCurrent = item === currentPage;
          if (isCurrent && editingPage) {
            return (
              <input
                key="page-edit"
                autoFocus
                type="number"
                min={1}
                max={totalPages}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={commitPage}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitPage();
                  if (e.key === "Escape") setEditingPage(false);
                }}
                className="w-10 h-8 rounded-full border border-blue-500 text-center text-sm font-medium text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            );
          }
          return (
            <button
              key={`page-${item}`}
              onClick={() => {
                if (isCurrent) {
                  setPageInput(String(currentPage));
                  setEditingPage(true);
                } else {
                  onPageChange(item);
                }
              }}
              title={isCurrent ? "Click to type a page number" : undefined}
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                isCurrent
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {item}
            </button>
          );
        })}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!hasNextPage}
        className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};
