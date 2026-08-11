import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Search, X, ChevronDown, MoreVertical, Pencil, Trash2, Eye, 
  SlidersHorizontal, Plus, Download, Share2, 
  ChevronLeft, ChevronRight
} from "lucide-react";
import SearchIcon from "../components/common/SearchIcon";
import API from "../services/api";
import toast from "react-hot-toast";
import TableSkeletonRows from "../components/common/TableSkeletonRows";
import PaymentFormModal from "../components/payments/PaymentFormModal";
import { useTopLoadingSignal } from "../components/common/TopLoadingBar";

const DEFAULT_COL_WIDTHS = {
  selection: 60,
  "payment-id": 140,
  party: 220,
  amount: 140,
  direction: 120,
  type: 140,
  date: 180,
};
const MIN_COL_WIDTH = 60;

const INITIAL_COLUMN_DEFS = [
  { id: "selection", label: "" },
  { id: "payment-id", label: "Transaction ID" },
  { id: "party", label: "Party / Entity" },
  { id: "amount", label: "Amount" },
  { id: "direction", label: "Direction" },
  { id: "type", label: "Type" },
  { id: "date", label: "Date" }
];

export default function PaymentsTimeline() {
  const [documents, setDocuments] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1, limit: 10, totalCount: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false
  });
  const [showLoadingSkeleton, setShowLoadingSkeleton] = useState(true);
  useTopLoadingSignal(showLoadingSkeleton);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [colWidths, setColWidths] = useState(DEFAULT_COL_WIDTHS);
  
  const [orderedColumns, setOrderedColumns] = useState(INITIAL_COLUMN_DEFS);
  
  // Drag State for Columns
  const [draggedColId, setDraggedColId] = useState(null);
  const [dragOverColId, setDragOverColId] = useState(null);

  // Column Resizer State
  const [draggedResizeColKey, setDraggedResizeColKey] = useState(null);

  const [pinnedCols, setPinnedCols] = useState({
    selection: "left",
    "payment-id": "left"
  });

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef(null);
  
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClick = () => {
      setShowFilterMenu(false);
      setOpenActionMenuId(null);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const fetchData = async () => {
    setShowLoadingSkeleton(true);
    try {
      const res = await API.get(`/payments-timeline?page=${pagination.currentPage}&limit=${pagination.limit}`);
      setDocuments(res.data.documents || []);
      if (res.data.pagination) {
        setPagination(res.data.pagination);
      }
    } catch (err) {
      toast.error("Failed to load transactions timeline");
      console.error(err);
    } finally {
      setShowLoadingSkeleton(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [pagination.currentPage, pagination.limit]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = new Set(filteredDocs.map((doc) => doc._id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, currentPage: newPage }));
    }
  };

  const handleLimitChange = (newLimit) => {
    setPagination(prev => ({ ...prev, limit: newLimit, currentPage: 1 }));
  };

  // --- Drag and Drop for Columns ---
  const handleDragStart = (e, colId) => {
    if (colId === "selection") {
      e.preventDefault();
      return;
    }
    setDraggedColId(colId);
    e.dataTransfer.effectAllowed = "move";
  };
  
  const handleDragOver = (e, colId) => {
    e.preventDefault();
    if (colId === "selection" || draggedColId === colId) return;
    setDragOverColId(colId);
  };
  
  const handleDrop = (e, colId) => {
    e.preventDefault();
    if (!draggedColId || draggedColId === colId || colId === "selection") {
      setDraggedColId(null);
      setDragOverColId(null);
      return;
    }
    
    const newOrder = [...orderedColumns];
    const draggedIndex = newOrder.findIndex(c => c.id === draggedColId);
    const dropIndex = newOrder.findIndex(c => c.id === colId);
    
    const [draggedCol] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, draggedCol);
    
    setOrderedColumns(newOrder);
    setDraggedColId(null);
    setDragOverColId(null);
  };

  // --- Column Resizing ---
  const startColumnDrag = (e, colId) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedResizeColKey(colId);
    const startX = e.clientX;
    const startWidth = colWidths[colId] || MIN_COL_WIDTH;
    const onMouseMove = (ev) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.max(MIN_COL_WIDTH, startWidth + delta);
      setColWidths((prev) => ({ ...prev, [colId]: newWidth }));
    };
    const onMouseUp = () => {
      setDraggedResizeColKey(null);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const stickyStyleFor = (colId) => {
    if (pinnedCols[colId] === "left") {
      let leftPos = 0;
      if (colId === "payment-id") leftPos = colWidths.selection;
      return { position: "sticky", left: leftPos, zIndex: 10, background: "inherit" };
    }
    return {};
  };

  const filteredDocs = documents.filter(doc => {
    const term = searchQuery.toLowerCase();
    const matchSearch = 
      (doc["payment-id"] || "").toLowerCase().includes(term) ||
      (doc.party || "").toLowerCase().includes(term);
    return matchSearch;
  });

  const renderCell = (colId, doc) => {
    const value = doc[colId];
    if (colId === "selection") {
      const isSelected = selectedIds.has(doc._id);
      return (
        <div className="flex justify-center items-center h-full w-full">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => handleSelectRow(doc._id)}
            className="w-4 h-4 text-[#0085FF] border-gray-300 rounded focus:ring-[#0085FF]"
          />
        </div>
      );
    }
    if (colId === "amount") {
      return `₹${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (colId === "date") {
      return value ? new Date(value).toLocaleString() : "";
    }
    if (colId === "party") {
      return (
        <div className="flex flex-col truncate">
          <span className="text-sm font-semibold text-gray-900 truncate">{doc.party}</span>
          {doc.source && (
            <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mt-0.5 truncate">
              {doc.source}
            </span>
          )}
        </div>
      );
    }
    if (colId === "direction") {
      const isCredit = doc.direction === "IN";
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isCredit ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {isCredit ? 'IN' : 'OUT'}
        </span>
      );
    }
    return <span className="font-medium text-gray-700 truncate block">{value ?? ""}</span>;
  };

  const renderActionMenu = (doc) => {
    const isOpen = openActionMenuId === doc._id;
    return (
      <div className="relative flex-shrink-0 flex items-center h-full">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpenActionMenuId(isOpen ? null : doc._id);
          }}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <MoreVertical size={16} />
        </button>
        
        {isOpen && (
          <div 
            className="absolute right-8 top-1/2 -translate-y-1/2 w-40 bg-white rounded-xl shadow-lg border border-[#E1E4EA] py-1 z-[60] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => { setOpenActionMenuId(null); toast.success("View details functionality coming soon!"); }}
            >
              <Eye className="w-4 h-4 text-gray-400" /> View
            </button>
            <button 
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => { setOpenActionMenuId(null); toast.success("Edit functionality coming soon!"); }}
            >
              <Pencil className="w-4 h-4 text-gray-400" /> Edit
            </button>
            <button 
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => { setOpenActionMenuId(null); toast.success("Download coming soon!"); }}
            >
              <Download className="w-4 h-4 text-gray-400" /> Download
            </button>
            <button 
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => { setOpenActionMenuId(null); toast.success("Share coming soon!"); }}
            >
              <Share2 className="w-4 h-4 text-gray-400" /> Share
            </button>
            <div className="h-px bg-gray-100 my-1"></div>
            <button 
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              onClick={() => {
                setOpenActionMenuId(null);
                if (doc.source === "Payment") {
                  API.delete(`/vendors/${doc.vendor}/payments/${doc._id}`).then(() => fetchData()).catch(err => toast.error("Failed to delete"));
                } else {
                  toast.error(`Cannot delete ${doc.source} from timeline.`);
                }
              }}
            >
              <Trash2 className="w-4 h-4 text-red-500" /> Delete
            </button>
          </div>
        )}
      </div>
    );
  };

  const paginationItems = useMemo(() => {
    const items = [];
    const { currentPage, totalPages } = pagination;
    if (totalPages <= 1) return items;

    if (totalPages > 1) items.push(1);
    if (currentPage > 2) items.push("left-dots");
    if (currentPage !== 1 && currentPage !== totalPages) items.push(currentPage);
    if (currentPage < totalPages - 1) items.push("right-dots");
    if (totalPages > 1) items.push(totalPages);
    return items;
  }, [pagination]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-[#FAFBFC]">
      {/* Header section */}
      <div 
        className="fixed right-0 h-[72px] px-6 flex items-center justify-between border-b border-[#E1E4EA] bg-white top-[54px] lg:top-16"
        style={{ left: "var(--sidebar-width, 0px)", zIndex: 39 }}
      >
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Payments Timeline</h1>
          <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">
            {pagination.totalCount} total
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <div
            className={`relative h-10 flex items-center border border-[#E1E4EA] rounded-lg bg-white transition-all duration-300 ease-in-out hover:bg-gray-50 focus-within:border-[#0085FF] focus-within:ring-1 focus-within:ring-[#0085FF] ${isSearchExpanded ? "w-[260px] sm:w-[320px]" : "w-10"} max-w-full`}
          >
            <SearchIcon
              className="absolute left-3 text-gray-400 w-4 h-4 cursor-pointer z-10"
              onClick={() => {
                setIsSearchExpanded(true);
                searchInputRef.current?.focus();
              }}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchExpanded(true)}
              onBlur={() => {
                if (!searchQuery) setIsSearchExpanded(false);
              }}
              placeholder="Search by ID or party..."
              className={`w-full h-full bg-transparent pl-9 pr-8 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none transition-opacity duration-200 cursor-pointer ${isSearchExpanded ? "opacity-100 focus:cursor-text" : "opacity-0"}`}
            />
            {isSearchExpanded && searchQuery && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 text-gray-400"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilterMenu((v) => !v)}
            className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-colors bg-white ${filterStatus ? "border-[#0085FF] text-[#0085FF] bg-blue-50" : "border-[#E1E4EA] text-gray-600 hover:bg-gray-50"}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="h-10 px-4 rounded-lg bg-[#0085FF] hover:bg-blue-600 text-white font-medium text-sm shadow-sm transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Payment</span>
          </button>
        </div>
      </div>

      {/* Main Content Area - edge to edge table */}
      <div 
        className="fixed right-0 overflow-x-auto overflow-y-auto bg-white top-[126px] lg:top-[136px]"
        style={{ left: "var(--sidebar-width, 0px)", bottom: 64 }}
      >
        <div className="inline-block min-w-full align-middle border-b border-[#E1E4EA]">
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-[#F9FAFB] sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <tr>
                {orderedColumns.map((col) => {
                  const style = stickyStyleFor(col.id);
                  const isSelect = col.id === "selection";
                  const isDragOver = dragOverColId === col.id;
                  const isDragging = draggedColId === col.id;
                  
                  return (
                    <th
                      key={col.id}
                      draggable={!isSelect}
                      onDragStart={(e) => handleDragStart(e, col.id)}
                      onDragOver={(e) => handleDragOver(e, col.id)}
                      onDragLeave={() => setDragOverColId(null)}
                      onDrop={(e) => handleDrop(e, col.id)}
                      onDragEnd={() => { setDraggedColId(null); setDragOverColId(null); }}
                      className={`relative px-4 py-3 text-left text-xs font-bold text-[#525866] uppercase tracking-wider select-none border-b border-r border-[#E1E4EA] transition-colors ${
                        isDragOver ? "bg-blue-100" : pinnedCols[col.id] ? "bg-[#F9FAFB]" : "bg-[#F5F7FA] hover:bg-[#EDF0F5]"
                      } ${!isSelect ? "cursor-grab active:cursor-grabbing" : ""} ${isDragging ? "opacity-30 border-blue-500 border-2" : ""}`}
                      style={{ ...style, width: colWidths[col.id], minWidth: colWidths[col.id], maxWidth: colWidths[col.id] }}
                    >
                      <div className="flex items-center justify-between w-full group h-full">
                        {isSelect ? (
                          <div className="flex justify-center items-center w-full">
                            <input
                              type="checkbox"
                              checked={filteredDocs.length > 0 && selectedIds.size === filteredDocs.length}
                              onChange={handleSelectAll}
                              className="w-4 h-4 text-[#0085FF] border-gray-300 rounded focus:ring-[#0085FF]"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-1 min-w-0 pointer-events-none">
                            <span className="truncate">{col.label}</span>
                            {!pinnedCols[col.id] && (
                              <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-gray-200 rounded pointer-events-auto">
                                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                              </button>
                            )}
                          </div>
                        )}
                        {!isSelect && (
                          <div
                            onMouseDown={(e) => startColumnDrag(e, col.id)}
                            className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize z-30 hover:bg-[#0085FF]/40 active:bg-[#0085FF]"
                          />
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-[#E1E4EA]">
              {showLoadingSkeleton ? (
                <TableSkeletonRows 
                  numRows={pagination.limit}
                  columns={orderedColumns.map(c => colWidths[c.id])} 
                  hasCheckbox={false} 
                />
              ) : filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={orderedColumns.length} className="px-4 py-12 text-center text-sm text-gray-500">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr 
                    key={doc._id} 
                    className={`hover:bg-gray-50 transition-colors ${selectedIds.has(doc._id) ? 'bg-blue-50/30' : ''}`}
                  >
                    {orderedColumns.map((col, colIdx) => {
                      const style = stickyStyleFor(col.id);
                      const isRightmost = colIdx === orderedColumns.length - 1;
                      return (
                        <td
                          key={col.id}
                          className={`px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-[#E1E4EA] last:border-r-0 ${pinnedCols[col.id] ? "bg-inherit" : ""}`}
                          style={{ ...style, width: colWidths[col.id], minWidth: colWidths[col.id], maxWidth: colWidths[col.id] }}
                        >
                          <div className={`flex items-center justify-between gap-2 h-full w-full ${isRightmost ? "pr-1" : ""}`}>
                            <div className="flex-1 truncate">
                              {renderCell(col.id, doc)}
                            </div>
                            {isRightmost && renderActionMenu(doc)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Bar */}
      <div 
        className="fixed bottom-0 right-0 h-16 bg-white border-t border-[#E1E4EA] flex items-center justify-between px-6 z-40"
        style={{ left: "var(--sidebar-width, 0px)" }}
      >
        <div className="flex items-center">
          <p className="text-sm text-gray-700">
            Showing <span className="font-semibold">{pagination.totalCount === 0 ? 0 : (pagination.currentPage - 1) * pagination.limit + 1}</span> to <span className="font-semibold">{Math.min(pagination.currentPage * pagination.limit, pagination.totalCount)}</span> of <span className="font-semibold">{pagination.totalCount}</span> transactions
          </p>
          <div className="ml-4 flex items-center">
            <select
              value={pagination.limit}
              onChange={(e) => handleLimitChange(parseInt(e.target.value))}
              className="border border-gray-300 rounded-md text-sm py-1 pl-2 pr-6 focus:outline-none focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF]"
            >
              {[10, 25, 50, 100].map(val => (
                <option key={val} value={val}>{val} / page</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(pagination.currentPage - 1)}
            disabled={!pagination.hasPrevPage}
            className="flex items-center justify-center w-8 h-8 rounded-full border border-[#E1E4EA] bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          {paginationItems.map((item, idx) => {
            if (item === "left-dots" || item === "right-dots") {
              return <span key={`${item}-${idx}`} className="px-2 text-gray-400">...</span>;
            }
            return (
              <button
                key={item}
                onClick={() => handlePageChange(item)}
                className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${pagination.currentPage === item ? "bg-[#0085FF] text-white" : "text-gray-700 hover:bg-gray-100"}`}
              >
                {item}
              </button>
            );
          })}

          <button
            onClick={() => handlePageChange(pagination.currentPage + 1)}
            disabled={!pagination.hasNextPage}
            className="flex items-center justify-center w-8 h-8 rounded-full border border-[#E1E4EA] bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <PaymentFormModal 
        isOpen={isPaymentModalOpen} 
        onClose={() => setIsPaymentModalOpen(false)} 
        onSuccess={() => fetchData()} 
      />
    </div>
  );
}
