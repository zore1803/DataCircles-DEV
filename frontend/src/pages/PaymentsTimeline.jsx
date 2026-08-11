import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { 
  X, ChevronDown, ChevronUp, MoreVertical, Pencil, Trash2, Eye, EyeOff,
  SlidersHorizontal, Plus, Download, Share2, Edit2,
  ChevronLeft, ChevronRight, Pin, PinOff, FileText
} from "lucide-react";
import SearchIcon from "../components/common/SearchIcon";
import API from "../services/api";
import toast from "react-hot-toast";
import TableSkeletonRows from "../components/common/TableSkeletonRows";
import PaymentFormModal from "../components/payments/PaymentFormModal";
import { useTopLoadingSignal } from "../components/common/TopLoadingBar";
import { getAncestorZoom } from "../utils/domUtils";
import BulkActionBar from "../components/common/BulkActionBar";
import { useBulkStrip } from "../hooks/useBulkSelection";

/* ─── Column definitions ───────────────────────────────────────────── */
const DEFAULT_COL_WIDTHS = {
  selection: 60,
  "payment-id": 160,
  party: 220,
  amount: 140,
  direction: 120,
  type: 140,
  date: 180,
};
const MIN_COL_WIDTH = 60;

const ALL_COLUMNS = [
  { id: "payment-id", label: "Transaction ID" },
  { id: "party",     label: "Party / Entity"  },
  { id: "amount",    label: "Amount"           },
  { id: "direction", label: "Direction"        },
  { id: "type",      label: "Type"             },
  { id: "date",      label: "Date"             },
];

/* ─── Shared resize handle (same as Accounting.jsx pattern) ─────────── */
const ColumnResizeHandle = React.memo(({ colId, onResizeStart }) => (
  <div
    data-resize-handle="true"
    onMouseDown={(e) => onResizeStart(e, colId)}
    onClick={(e) => e.stopPropagation()}
    title="Drag to resize column"
    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none z-30 hover:bg-[#0085FF]/40 active:bg-[#0085FF]"
  />
));
ColumnResizeHandle.displayName = "ColumnResizeHandle";

/* helper: plain-text preview for ghost */
const cellTextFor = (colId, doc) => {
  switch (colId) {
    case "payment-id": return doc["payment-id"] || "";
    case "party":      return doc.party || "";
    case "amount":     return doc.amount != null ? `₹${Number(doc.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "";
    case "direction":  return doc.direction === "IN" ? "Credit" : "Debit";
    case "type":       return doc.type || "";
    case "date":       return doc.date ? new Date(doc.date).toLocaleString() : "";
    default:           return "";
  }
};

/* ─── Component ─────────────────────────────────────────────────────── */
export default function PaymentsTimeline() {
  const [documents, setDocuments] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1, limit: 10, totalCount: 0, totalPages: 0,
    hasNextPage: false, hasPrevPage: false
  });
  const [showLoadingSkeleton, setShowLoadingSkeleton] = useState(true);
  useTopLoadingSignal(showLoadingSkeleton);

  /* search */
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef(null);

  /* columns */
  const [columnOrder, setColumnOrder] = useState(ALL_COLUMNS.map(c => c.id));
  const [colWidths, setColWidths]     = useState(DEFAULT_COL_WIDTHS);
  const [pinnedCols, setPinnedCols]   = useState({});
  const [hiddenCols, setHiddenCols]   = useState([]);
  const [sortConfig, setSortConfig]   = useState({ key: null, direction: null });

  /* Column header menu */
  const [openColumnMenuKey, setOpenColumnMenuKey] = useState(null);
  const [columnMenuPos, setColumnMenuPos]         = useState(null);

  /* Filter states */
  const [companies, setCompanies]               = useState([]);
  const [partyFilter, setPartyFilter]           = useState("");
  const [directionFilter, setDirectionFilter]   = useState("");
  const [typeFilter, setTypeFilter]             = useState("");

  /* drag-reorder state (mirror of Accounting.jsx) */
  const [draggedColKey,  setDraggedColKey]  = useState(null);
  const [dragOverColKey, setDragOverColKey] = useState(null);
  const [dragGhost,      setDragGhost]      = useState(null);
  const dragOverRef = useRef(null);
  const ghostElRef  = useRef(null);

  /* row selection */
  const [selectedIds, setSelectedIds] = useState([]);
  const { visible: stripVisible, closing: stripClosing } = useBulkStrip(selectedIds.length);

  /* misc UI */
  const [showFilterMenu,    setShowFilterMenu]    = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingPaymentItem, setEditingPaymentItem] = useState(null);
  const [openActionMenuId,  setOpenActionMenuId]  = useState(null);
  const [actionMenuPos,     setActionMenuPos]     = useState(null);
  const [deleteConfirmState, setDeleteConfirmState] = useState({ isOpen: false, type: "single", target: null });

  /* Fetch companies list for Party filter */
  useEffect(() => {
    API.get("/companies")
      .then(res => {
        const raw = res.data?.companies || res.data || [];
        const seen = new Set();
        const unique = [];
        raw.forEach(c => {
          const name = (c.companyName || c.name || (typeof c === "string" ? c : "")).trim();
          if (name && !seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            unique.push(c);
          }
        });
        setCompanies(unique);
      })
      .catch(err => console.error("Error fetching companies:", err));
  }, []);

  const openColumnMenu = (e, colId) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const z = getAncestorZoom(document.body);
    setColumnMenuPos({
      top: (rect.bottom + 4) / z,
      left: Math.min(window.innerWidth - 186, rect.left) / z,
    });
    setOpenColumnMenuKey(colId);
  };

  const closeColumnMenu = () => {
    setOpenColumnMenuKey(null);
    setColumnMenuPos(null);
  };

  const setColumnPin = useCallback((colId, side) => {
    setPinnedCols(prev => {
      const next = { ...prev };
      if (next[colId] === side) delete next[colId];
      else next[colId] = side;
      return next;
    });
  }, []);

  /* ── orderedColumns (mirrors Accounting.jsx pattern) ─────────────── */
  const orderedColumns = useMemo(
    () => columnOrder
      .map(id => ALL_COLUMNS.find(c => c.id === id))
      .filter(c => c && !hiddenCols.includes(c.id))
      .sort((a, b) => {
        const rank = c => pinnedCols[c.id] === "left" ? 0 : pinnedCols[c.id] === "right" ? 2 : 1;
        return rank(a) - rank(b);
      }),
    [columnOrder, pinnedCols, hiddenCols]
  );

  /* ── sticky offset map (same as Accounting.jsx) ─────────────────── */
  const stickyStyles = useMemo(() => {
    const map = {};
    let leftOffset = colWidths.selection;
    for (const c of orderedColumns) {
      if (pinnedCols[c.id] === "left") {
        map[c.id] = { position: "sticky", left: leftOffset, zIndex: 15 };
        leftOffset += colWidths[c.id];
      }
    }
    let rightOffset = 0;
    for (const c of [...orderedColumns].reverse()) {
      if (pinnedCols[c.id] === "right") {
        map[c.id] = { position: "sticky", right: rightOffset, zIndex: 15 };
        rightOffset += colWidths[c.id];
      }
    }
    return map;
  }, [orderedColumns, pinnedCols, colWidths]);

  const stickyStyleFor = useCallback(colId => stickyStyles[colId] || {}, [stickyStyles]);

  /* ── close menus on outside click ───────────────────────────────── */
  useEffect(() => {
    const handle = () => { setShowFilterMenu(false); setOpenActionMenuId(null); };
    document.addEventListener("click", handle);
    return () => document.removeEventListener("click", handle);
  }, []);

  /* ── data fetching ───────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    setShowLoadingSkeleton(true);
    try {
      const partyParam = partyFilter ? `&party=${encodeURIComponent(partyFilter)}` : "";
      const res = await API.get(`/payments-timeline?page=${pagination.currentPage}&limit=${pagination.limit}${partyParam}`);
      setDocuments(res.data.documents || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch (err) {
      toast.error("Failed to load transactions timeline");
      console.error(err);
    } finally {
      setShowLoadingSkeleton(false);
    }
  }, [pagination.currentPage, pagination.limit, partyFilter]);

  /* ── fetch ALL record IDs from DB for global Select All ─────────── */
  const fetchAllIds = useCallback(async () => {
    const tid = toast.loading("Selecting all records...");
    try {
      const partyParam = partyFilter ? `&party=${encodeURIComponent(partyFilter)}` : "";
      const res = await API.get(`/payments-timeline?page=1&limit=99999${partyParam}`);
      const allDocs = res.data.documents || [];
      setSelectedIds(allDocs.map(d => d._id));
      toast.success(`Selected all ${allDocs.length} record(s).`, { id: tid });
    } catch (err) {
      toast.error("Failed to fetch all records", { id: tid });
      console.error(err);
    }
  }, [partyFilter]);

  useEffect(() => { fetchData(); }, [pagination.currentPage, pagination.limit, partyFilter]);

  /* ── filtered and sorted docs ─────────────────────────────────────── */
  const filteredDocs = useMemo(() => {
    let list = documents.filter(doc => {
      const term = searchQuery.toLowerCase();
      const matchesSearch = (doc["payment-id"] || "").toLowerCase().includes(term) ||
                            (doc.party || "").toLowerCase().includes(term);
      if (!matchesSearch) return false;

      if (partyFilter && doc.party !== partyFilter) return false;

      if (directionFilter) {
        if (directionFilter === "Credit" && doc.direction !== "IN") return false;
        if (directionFilter === "Debit" && doc.direction !== "OUT") return false;
      }

      if (typeFilter) {
        if (typeFilter === "Credit" && doc.direction !== "IN") return false;
        if (typeFilter === "Debit" && doc.direction !== "OUT") return false;
        if (["Invoice", "Purchase", "Subscription", "Payment"].includes(typeFilter)) {
          if ((doc.source || "").toLowerCase() !== typeFilter.toLowerCase()) return false;
        }
      }

      return true;
    });

    if (sortConfig.key) {
      list = [...list].sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        if (sortConfig.key === "party") {
          valA = a.party || "";
          valB = b.party || "";
        }
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();
        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [documents, searchQuery, partyFilter, directionFilter, typeFilter, sortConfig]);

  const handleSelectAll = e =>
    setSelectedIds(e.target.checked ? filteredDocs.map(d => d._id) : []);

  const handleSelectRow = id =>
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  /* ── pagination ─────────────────────────────────────────────────── */
  const handlePageChange  = newPage   => { if (newPage > 0 && newPage <= pagination.totalPages) setPagination(p => ({ ...p, currentPage: newPage })); };
  const handleLimitChange = newLimit  => setPagination(p => ({ ...p, limit: newLimit, currentPage: 1 }));

  /* ── Column resize (same pattern as Accounting.jsx) ─────────────── */
  const startColumnResize = useCallback((e, colId) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const startX   = e.clientX;
    const startW   = colWidths[colId] ?? MIN_COL_WIDTH;
    const onMove   = mv => setColWidths(prev => ({ ...prev, [colId]: Math.max(MIN_COL_WIDTH, startW + mv.clientX - startX) }));
    const onUp     = () => {
      document.body.style.cursor  = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
    document.body.style.cursor    = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }, [colWidths]);

  const ResizeHandle = useCallback(({ colId }) => (
    <ColumnResizeHandle colId={colId} onResizeStart={startColumnResize} />
  ), []);

  /* ── Column drag-reorder (exact clone of Accounting.jsx) ─────────── */
  const handleColumnReorder = useCallback((draggedKey, targetKey) => {
    if (!draggedKey || draggedKey === targetKey) return;
    setColumnOrder(prev => {
      const next = [...prev];
      const from = next.indexOf(draggedKey);
      const to   = next.indexOf(targetKey);
      if (from === -1 || to === -1) return prev;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const startColumnDrag = (e, colId) => {
    if (e.button !== 0) return;
    if (e.target.closest("button") || e.target.closest("[data-resize-handle]")) return;

    const th      = e.currentTarget;
    const startX  = e.clientX;
    const startY  = e.clientY;
    const THRESHOLD = 5;

    const dragState = { started: false, offsetX: 0, offsetY: 0, zGhost: 1 };

    const positionGhost = (clientX, clientY) => {
      const el = ghostElRef.current;
      if (!el) return;
      const visualTop  = clientY - dragState.offsetY;
      const visualLeft = clientX - dragState.offsetX;
      el.style.top     = `${visualTop  / dragState.zGhost}px`;
      el.style.left    = `${visualLeft / dragState.zGhost}px`;
      el.style.maxHeight = `${Math.max(100, window.innerHeight - visualTop - 72) / dragState.zGhost}px`;
    };

    const updateDragOver = (clientX, clientY) => {
      const elAtPoint = document.elementFromPoint(clientX, clientY);
      const thAtPoint = elAtPoint?.closest("th[data-col-id]");
      const overKey   = thAtPoint?.getAttribute("data-col-id") || null;
      if (dragOverRef.current !== overKey) {
        dragOverRef.current = overKey;
        setDragOverColKey(overKey);
      }
    };

    const beginDrag = () => {
      dragState.started = true;
      window.getSelection?.()?.removeAllRanges();

      const rect = th.getBoundingClientRect();
      const col  = ALL_COLUMNS.find(c => c.id === colId);
      const previewRows = documents.slice(0, 5).map(doc => cellTextFor(colId, doc));

      dragState.zGhost  = getAncestorZoom(document.body);
      dragState.offsetX = startX - rect.left;
      dragState.offsetY = startY - rect.top;

      dragOverRef.current = null;
      setDraggedColKey(colId);
      setDragOverColKey(null);
      document.body.style.userSelect = "none";
      setDragGhost({
        label: col?.label || colId,
        previewRows,
        width:  rect.width  / dragState.zGhost,
        height: rect.height / dragState.zGhost,
      });

      requestAnimationFrame(() => positionGhost(startX, startY));
    };

    const handleMouseMove = mv => {
      if (!dragState.started) {
        if (Math.hypot(mv.clientX - startX, mv.clientY - startY) < THRESHOLD) return;
        e.preventDefault();
        beginDrag();
      }
      positionGhost(mv.clientX, mv.clientY);
      updateDragOver(mv.clientX, mv.clientY);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup",   handleMouseUp);
      if (!dragState.started) return;
      document.body.style.userSelect = "";
      const overKey = dragOverRef.current;
      if (overKey && overKey !== colId) handleColumnReorder(colId, overKey);
      dragOverRef.current = null;
      setDraggedColKey(null);
      setDragOverColKey(null);
      setDragGhost(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup",   handleMouseUp);
  };

  /* ── Action menu ─────────────────────────────────────────────────── */
  const renderActionMenu = doc => {
    const isOpen = openActionMenuId === doc._id;
    return (
      <div className="relative flex-shrink-0 flex items-center">
        <button
          onClick={e => {
            e.stopPropagation();
            if (isOpen) {
              setOpenActionMenuId(null);
              setActionMenuPos(null);
            } else {
              const rect = e.currentTarget.getBoundingClientRect();
              setActionMenuPos({ top: rect.top + rect.height / 2, right: window.innerWidth - rect.left + 4 });
              setOpenActionMenuId(doc._id);
            }
          }}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <MoreVertical size={15} />
        </button>
        {isOpen && actionMenuPos && createPortal(
          <>
            {/* Invisible backdrop to close menu on click-outside */}
            <div className="fixed inset-0 z-[59]" onClick={() => { setOpenActionMenuId(null); setActionMenuPos(null); }} />
            <div
              className="fixed w-40 bg-white rounded-xl shadow-lg border border-[#E1E4EA] py-1 z-[60] overflow-hidden"
              style={{ top: actionMenuPos.top, right: actionMenuPos.right, transform: "translateY(-50%)" }}
              onClick={e => e.stopPropagation()}
            >
              <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => { setOpenActionMenuId(null); setActionMenuPos(null); toast.success("View details coming soon!"); }}>
                <Eye className="w-4 h-4 text-gray-400" /> View
              </button>
              <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                  setOpenActionMenuId(null);
                  setActionMenuPos(null);
                  setEditingPaymentItem(doc);
                  setIsPaymentModalOpen(true);
                }}>
                <Pencil className="w-4 h-4 text-gray-400" /> Edit
              </button>
              <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => { setOpenActionMenuId(null); setActionMenuPos(null); toast.success("Download coming soon!"); }}>
                <Download className="w-4 h-4 text-gray-400" /> Download
              </button>
              <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => { setOpenActionMenuId(null); setActionMenuPos(null); toast.success("Share coming soon!"); }}>
                <Share2 className="w-4 h-4 text-gray-400" /> Share
              </button>
              <div className="h-px bg-gray-100 my-1" />
              <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer"
                onClick={() => {
                  setOpenActionMenuId(null);
                  setActionMenuPos(null);
                  setDeleteConfirmState({ isOpen: true, type: "single", target: doc });
                }}>
                <Trash2 className="w-4 h-4 text-red-500" /> Delete
              </button>
            </div>
          </>,
          document.body
        )}
      </div>
    );
  };

  /* ── Cell renderer ───────────────────────────────────────────────── */
  const renderCell = (colId, doc, isRightmost) => {
    let content;
    switch (colId) {
      case "amount":
        content = `₹${Number(doc.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        break;
      case "date":
        content = doc.date ? new Date(doc.date).toLocaleString() : "";
        break;
      case "party":
        content = (
          <div className="flex flex-col truncate">
            <span className="text-sm font-semibold text-gray-900 truncate">{doc.party}</span>
            {doc.source && <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mt-0.5 truncate">{doc.source}</span>}
          </div>
        );
        break;
      case "direction": {
        const isCredit = doc.direction === "IN";
        content = (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isCredit ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {isCredit ? "Credit" : "Debit"}
          </span>
        );
        break;
      }
      default:
        content = <span className="font-medium text-gray-700 truncate block">{doc[colId] ?? ""}</span>;
    }

    return (
      <div className="flex items-center justify-between gap-2 w-full min-w-0">
        <div className="flex-1 min-w-0">{content}</div>
        {isRightmost && renderActionMenu(doc)}
      </div>
    );
  };

  /* ── Pagination items ────────────────────────────────────────────── */
  const paginationItems = useMemo(() => {
    const items = [];
    const { currentPage, totalPages } = pagination;
    if (totalPages <= 1) return items;
    items.push(1);
    if (currentPage > 2)             items.push("left-dots");
    if (currentPage !== 1 && currentPage !== totalPages) items.push(currentPage);
    if (currentPage < totalPages - 1) items.push("right-dots");
    if (totalPages > 1)               items.push(totalPages);
    return items;
  }, [pagination]);

  /* ─────────────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-[#FAFBFC]">

      {/* ── Fixed header bar ─────────────────────────────────────────────────────── */}
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

        <div className="flex flex-row items-center gap-2 flex-shrink-0 min-w-0">
          {/* Search — expands in place from the icon */}
          <div
            className={`relative h-11 flex items-center border border-[#E1E4EA] rounded-full bg-white transition-all duration-300 ease-in-out hover:bg-gray-50 focus-within:border-[#0085FF] focus-within:hover:bg-white ${isSearchExpanded ? "w-[220px] sm:w-[300px] lg:w-[380px]" : "w-11"} max-w-full flex-shrink-0`}
          >
            <SearchIcon
              className="absolute left-3.5 text-[#525866] w-4 h-4 cursor-pointer z-10 flex-shrink-0 top-1/2 -translate-y-1/2"
              onClick={() => { setIsSearchExpanded(true); searchInputRef.current?.focus(); }}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchExpanded(true)}
              onBlur={() => { if (!searchQuery) setIsSearchExpanded(false); }}
              placeholder="Search by ID or party..."
              className={`w-full h-full bg-transparent rounded-full pl-11 pr-9 text-[14px] leading-[20px] text-[#1F2937] placeholder:text-[#99A0AE] focus:outline-none transition-opacity duration-200 cursor-pointer ${isSearchExpanded ? "opacity-100 focus:cursor-text" : "opacity-0"}`}
            />
            {isSearchExpanded && searchQuery && (
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-5 h-5 rounded-full text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2.5} />
              </button>
            )}
          </div>

          {/* Filter Button */}
          <div className="relative flex-shrink-0">
            <button
              title="Filter"
              onClick={e => { e.stopPropagation(); setShowFilterMenu(v => !v); }}
              className={`flex items-center justify-center w-11 h-11 rounded-full border transition-colors bg-white cursor-pointer ${showFilterMenu || typeFilter ? "border-[#0085FF] text-[#0085FF] bg-blue-50/50" : "border-[#E1E4EA] text-gray-500 hover:bg-gray-50"}`}
            >
              <SlidersHorizontal size={18} strokeWidth={2} className={showFilterMenu || typeFilter ? "text-[#0085FF]" : "text-[#1F2937]"} />
            </button>
            {showFilterMenu && (
              <div
                onClick={e => e.stopPropagation()}
                className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-[#E1E4EA] py-1 z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Filter by Type
                </div>
                {["", "Credit", "Debit", "Invoice", "Purchase", "Subscription", "Payment"].map(opt => {
                  const isSelected = typeFilter === opt;
                  return (
                    <button
                      key={opt || "all"}
                      onClick={() => {
                        setTypeFilter(opt);
                        setShowFilterMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors cursor-pointer ${isSelected ? "bg-blue-50 text-[#0085FF] font-medium" : "text-gray-700 hover:bg-gray-50"}`}
                    >
                      <span>{opt || "All Types"}</span>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#0085FF]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Button */}
          <button
            onClick={() => {
              setEditingPaymentItem(null);
              setIsPaymentModalOpen(true);
            }}
            style={{ minWidth: 146, height: 44, padding: 12, gap: 6, background: "#0085FF", borderRadius: 96 }}
            className="flex flex-row justify-center items-center hover:bg-blue-600 transition-colors flex-shrink-0 ml-1 cursor-pointer"
          >
            <Plus size={18} className="text-white flex-shrink-0" />
            <span className="text-white text-[14px] font-medium leading-[20px] whitespace-nowrap">Add Payment</span>
          </button>
        </div>
      </div>

      {/* ── BulkActionBar — floats between title bar and table when rows are selected ── */}
      {stripVisible && (
        <div
          className="fixed right-0 px-6 z-[40]"
          style={{ left: "var(--sidebar-width, 0px)", top: 134, paddingTop: 4, paddingBottom: 4 }}
        >
          <BulkActionBar
            selectedCount={selectedIds.length}
            entityName="payment"
            isClosing={stripClosing}
            onSelectAll={fetchAllIds}
            onDeselectAll={() => setSelectedIds([])}
            onExport={() => toast.success(`Exporting ${selectedIds.length} payment(s)...`)}
            onDelete={() => {
              setDeleteConfirmState({ isOpen: true, type: "bulk", target: selectedIds });
            }}
            onCancel={() => setSelectedIds([])}
          />
        </div>
      )}

      {/* ── Full-bleed table (matches Accounting.jsx layout) ──────── */}
      <div
        className="fixed right-0 overflow-x-auto overflow-y-auto bg-white"
        style={{
          left: "var(--sidebar-width, 0px)",
          bottom: 64,
          top: stripVisible ? 186 : 138,
        }}
      >
        <table className="min-w-full divide-y divide-gray-200 table-fixed">
          <thead className="bg-[#F5F7FA] sticky top-0 z-20">
            <tr>
              {/* Selection column */}
              <th
                style={{ width: colWidths.selection, position: "sticky", left: 0, zIndex: 20 }}
                className="relative px-4 py-3 bg-[#F5F7FA] border-b border-r border-[#E1E4EA]"
              >
                <div className="flex justify-center items-center">
                  <input
                    type="checkbox"
                    checked={filteredDocs.length > 0 && selectedIds.length === filteredDocs.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </div>
                <ResizeHandle colId="selection" />
              </th>

              {/* Data columns */}
              {orderedColumns.map(col => {
                const isDragging = draggedColKey === col.id;
                const isDragOver = dragOverColKey === col.id && draggedColKey && draggedColKey !== col.id;

                return (
                  <th
                    key={col.id}
                    data-col-id={col.id}
                    onMouseDown={e => startColumnDrag(e, col.id)}
                    title="Drag to move this column"
                    style={{
                      width: colWidths[col.id],
                      opacity: isDragging ? 0.35 : 1,
                      ...stickyStyleFor(col.id),
                    }}
                    className={`relative px-4 py-3 text-left text-xs font-bold text-[#525866] uppercase tracking-wider whitespace-nowrap border-b border-r border-[#E1E4EA] transition-colors ${
                      isDragOver ? "bg-blue-100" : "bg-[#F5F7FA] hover:bg-[#EDF0F5]"
                    } ${draggedColKey ? "cursor-grabbing" : "cursor-grab"} active:cursor-grabbing`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate flex-1">{col.label}</span>
                      {pinnedCols[col.id] && <Pin className="w-3 h-3 text-[#0085FF] flex-shrink-0" />}
                      <button
                        onClick={e => openColumnMenu(e, col.id)}
                        title="Column options"
                        className="p-1 rounded hover:bg-gray-200 transition-colors text-gray-500 flex-shrink-0"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <ResizeHandle colId={col.id} />
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="bg-white">
            {showLoadingSkeleton ? (
              <TableSkeletonRows
                numRows={pagination.limit}
                columns={orderedColumns.map(c => colWidths[c.id])}
                hasCheckbox
                checkboxWidth={colWidths.selection}
              />
            ) : filteredDocs.length === 0 ? (
              <tr>
                <td colSpan={orderedColumns.length + 1} className="px-6 py-20 text-center">
                  <FileText className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                  <p className="text-sm font-medium text-gray-500">No transactions found.</p>
                </td>
              </tr>
            ) : (
              filteredDocs.map(doc => (
                <tr
                  key={doc._id}
                  className={`bg-white hover:bg-blue-50 transition-colors ${selectedIds.includes(doc._id) ? "!bg-blue-50" : ""}`}
                >
                  {/* Selection cell */}
                  <td
                    style={{ width: colWidths.selection, position: "sticky", left: 0, zIndex: 10 }}
                    className="px-4 py-3 align-middle border-b border-r border-[#E1E4EA] bg-inherit"
                  >
                    <div className="flex justify-center items-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(doc._id)}
                        onChange={() => handleSelectRow(doc._id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                    </div>
                  </td>

                  {/* Data cells */}
                  {orderedColumns.map((col, colIdx) => {
                    const isRightmost = colIdx === orderedColumns.length - 1;
                    return (
                      <td
                        key={col.id}
                        style={{ width: colWidths[col.id], ...stickyStyleFor(col.id) }}
                        className="px-4 py-3 text-sm text-gray-900 border-b border-r border-[#E1E4EA] last:border-r-0 overflow-hidden bg-inherit whitespace-nowrap"
                      >
                        {renderCell(col.id, doc, isRightmost)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Drag ghost portal (exact copy of Accounting.jsx) ──────── */}
      {dragGhost && createPortal(
        <div
          ref={ghostElRef}
          style={{
            position: "fixed",
            top: -9999,
            left: -9999,
            width: dragGhost.width,
            zIndex: 10000,
            pointerEvents: "none",
          }}
          className="flex flex-col bg-white rounded-lg shadow-2xl overflow-hidden"
        >
          <div
            className="px-4 py-3 bg-[#F5F7FA] border-b border-[#E1E4EA]"
            style={{ height: dragGhost.height }}
          >
            <span className="text-sm font-bold text-[#525866] truncate block">{dragGhost.label}</span>
          </div>
          {dragGhost.previewRows.map((rowVal, i) => (
            <div key={i} className="px-4 py-2 border-b border-[#F1F1F5] last:border-b-0">
              <span className="text-sm text-gray-700 truncate block">{rowVal}</span>
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* ── Pagination bar ────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 right-0 h-16 bg-white border-t border-[#E1E4EA] flex items-center justify-between px-6 z-40"
        style={{ left: "var(--sidebar-width, 0px)" }}
      >
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-700">
            Showing{" "}
            <span className="font-semibold">
              {pagination.totalCount === 0 ? 0 : (pagination.currentPage - 1) * pagination.limit + 1}
            </span>{" "}to{" "}
            <span className="font-semibold">
              {Math.min(pagination.currentPage * pagination.limit, pagination.totalCount)}
            </span>{" "}of{" "}
            <span className="font-semibold">{pagination.totalCount}</span> transactions
          </p>
          <select
            value={pagination.limit}
            onChange={e => handleLimitChange(parseInt(e.target.value))}
            className="border border-gray-300 rounded-md text-sm py-1 pl-2 pr-6 focus:outline-none focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF]"
          >
            {[10, 25, 50, 100].map(val => <option key={val} value={val}>{val} / page</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(pagination.currentPage - 1)}
            disabled={!pagination.hasPrevPage}
            className="flex items-center justify-center w-8 h-8 rounded-full border border-[#E1E4EA] bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {paginationItems.map((item, idx) =>
            item === "left-dots" || item === "right-dots"
              ? <span key={`${item}-${idx}`} className="px-2 text-gray-400">…</span>
              : (
                <button
                  key={item}
                  onClick={() => handlePageChange(item)}
                  className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${pagination.currentPage === item ? "bg-[#0085FF] text-white" : "text-gray-700 hover:bg-gray-100"}`}
                >
                  {item}
                </button>
              )
          )}

          <button
            onClick={() => handlePageChange(pagination.currentPage + 1)}
            disabled={!pagination.hasNextPage}
            className="flex items-center justify-center w-8 h-8 rounded-full border border-[#E1E4EA] bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Shared Column Header Options Menu (Pin Left/Right, Sort, Filter, Hide) ── */}
      {openColumnMenuKey &&
        columnMenuPos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={closeColumnMenu} />
            <div
              style={{
                position: "fixed",
                top: columnMenuPos.top,
                left: columnMenuPos.left,
              }}
              className="w-[220px] z-[9999] bg-white border border-[#E5E5EC] rounded-lg shadow-[7px_24px_24px_-7px_rgba(0,0,0,0.25)] p-1.5 flex flex-col gap-0.5"
            >
              {(() => {
                const col = ALL_COLUMNS.find(c => c.id === openColumnMenuKey);
                if (!col) return null;
                const side = pinnedCols[col.id];
                const itemClass = "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal whitespace-nowrap";

                return (
                  <>
                    <button
                      onClick={() => {
                        closeColumnMenu();
                        setColumnPin(col.id, "left");
                      }}
                      className={`${itemClass} ${side === "left" ? "bg-blue-50 text-blue-700 font-medium" : "text-[#161618] hover:bg-gray-50"}`}
                    >
                      {side === "left" ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5 text-[#1C1B1F]" />}
                      {side === "left" ? "Unpin" : "Pin to Left"}
                    </button>
                    <button
                      onClick={() => {
                        closeColumnMenu();
                        setColumnPin(col.id, "right");
                      }}
                      className={`${itemClass} ${side === "right" ? "bg-blue-50 text-blue-700 font-medium" : "text-[#161618] hover:bg-gray-50"}`}
                    >
                      {side === "right" ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5 text-[#1C1B1F]" />}
                      {side === "right" ? "Unpin" : "Pin to Right"}
                    </button>

                    <div className="w-full border-t border-[#F1F1F5] my-0.5" />

                    <button
                      onClick={() => {
                        closeColumnMenu();
                        setSortConfig({ key: col.id, direction: "asc" });
                      }}
                      className={`${itemClass} ${sortConfig.key === col.id && sortConfig.direction === "asc" ? "bg-blue-50 text-blue-700 font-medium" : "text-[#161618] hover:bg-gray-50"}`}
                    >
                      <ChevronUp className="w-3.5 h-3.5 text-[#1C1B1F]" />
                      Sort Ascending
                    </button>
                    <button
                      onClick={() => {
                        closeColumnMenu();
                        setSortConfig({ key: col.id, direction: "desc" });
                      }}
                      className={`${itemClass} ${sortConfig.key === col.id && sortConfig.direction === "desc" ? "bg-blue-50 text-blue-700 font-medium" : "text-[#161618] hover:bg-gray-50"}`}
                    >
                      <ChevronDown className="w-3.5 h-3.5 text-[#1C1B1F]" />
                      Sort Descending
                    </button>

                    {/* Party Company Filter list if Party column */}
                    {col.id === "party" && (
                      <>
                        <div className="w-full border-t border-[#F1F1F5] my-0.5" />
                        <div className="px-2 py-1 text-[11px] font-bold text-gray-400 uppercase">Filter by Company</div>
                        <div className="max-h-36 overflow-y-auto flex flex-col gap-0.5 no-scrollbar">
                          <button
                            onClick={() => { closeColumnMenu(); setPartyFilter(""); }}
                            className={`${itemClass} ${!partyFilter ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-50"}`}
                          >
                            All Companies
                          </button>
                          {companies.map(c => {
                            const name = c.companyName || c.name || (typeof c === "string" ? c : "");
                            if (!name) return null;
                            return (
                              <button
                                key={c._id || name}
                                onClick={() => { closeColumnMenu(); setPartyFilter(name); }}
                                className={`${itemClass} ${partyFilter === name ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-50"}`}
                              >
                                {name}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* Direction Filter if Direction column */}
                    {col.id === "direction" && (
                      <>
                        <div className="w-full border-t border-[#F1F1F5] my-0.5" />
                        <div className="px-2 py-1 text-[11px] font-bold text-gray-400 uppercase">Filter Direction</div>
                        <button
                          onClick={() => { closeColumnMenu(); setDirectionFilter(""); }}
                          className={`${itemClass} ${!directionFilter ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-50"}`}
                        >
                          All Directions
                        </button>
                        <button
                          onClick={() => { closeColumnMenu(); setDirectionFilter("Credit"); }}
                          className={`${itemClass} ${directionFilter === "Credit" ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-50"}`}
                        >
                          Credit (IN)
                        </button>
                        <button
                          onClick={() => { closeColumnMenu(); setDirectionFilter("Debit"); }}
                          className={`${itemClass} ${directionFilter === "Debit" ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-50"}`}
                        >
                          Debit (OUT)
                        </button>
                      </>
                    )}

                    <div className="w-full border-t border-[#F1F1F5] my-0.5" />

                    <button
                      onClick={() => {
                        closeColumnMenu();
                        setHiddenCols(prev => [...prev, col.id]);
                      }}
                      className={`${itemClass} text-[#161618] hover:bg-gray-50`}
                    >
                      <EyeOff className="w-3.5 h-3.5 text-[#1C1B1F]" />
                      Hide Column
                    </button>
                  </>
                );
              })()}
            </div>
          </>,
          document.body
        )}

      <PaymentFormModal
        isOpen={isPaymentModalOpen}
        editItem={editingPaymentItem}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setEditingPaymentItem(null);
        }}
        onSuccess={() => fetchData()}
      />

      {/* ── Custom Delete Warning Modal ───────────────────────────── */}
      {deleteConfirmState.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Confirm Deletion
                </h3>
                <p className="text-xs text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-6">
              {deleteConfirmState.type === "single" ? (
                <>Are you sure you want to delete this <strong className="text-gray-800">{deleteConfirmState.target?.source?.toLowerCase() || "payment"}</strong> entry?</>
              ) : (
                <>Are you sure you want to delete <strong className="text-gray-800">{deleteConfirmState.target?.length || 0}</strong> selected entry(ies) from the database?</>
              )}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmState({ isOpen: false, type: "single", target: null })}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const { type, target } = deleteConfirmState;
                  setDeleteConfirmState({ isOpen: false, type: "single", target: null });
                  if (type === "single" && target) {
                    try {
                      await API.delete(`/payments-timeline/${target._id}?source=${encodeURIComponent(target.source)}`);
                      toast.success("Deleted successfully");
                      fetchData();
                    } catch (err) {
                      toast.error("Failed to delete");
                    }
                  } else if (type === "bulk" && Array.isArray(target)) {
                    try {
                      let count = 0;
                      for (const id of target) {
                        const doc = documents.find(d => d._id === id);
                        if (doc) {
                          await API.delete(`/payments-timeline/${doc._id}?source=${encodeURIComponent(doc.source)}`);
                          count++;
                        }
                      }
                      toast.success(`Deleted ${count} entry(ies).`);
                      setSelectedIds([]);
                      fetchData();
                    } catch {
                      toast.error("Failed to delete selected items");
                    }
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
