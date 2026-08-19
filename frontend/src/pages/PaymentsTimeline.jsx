import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X, ChevronDown, ChevronUp, MoreVertical, Pencil, Trash2, Eye, EyeOff,
  SlidersHorizontal, Plus, Download, Share2, Edit2,
  ChevronLeft, ChevronRight, Pin, PinOff, FileText,
  Settings, Upload, Video, TrendingUp, TrendingDown, Wallet, ListChecks,
} from "lucide-react";
import SearchIcon from "../components/common/SearchIcon";
import FilterIcon from "../components/common/FilterIcon";
import AdvancedFilterPanel from "../components/common/AdvancedFilterPanel";
import API from "../services/api";
import toast from "react-hot-toast";
import TableSkeletonRows from "../components/common/TableSkeletonRows";
import PaymentFormModal from "../components/payments/PaymentFormModal";
import { useTopLoadingSignal } from "../components/common/TopLoadingBar";
import { getAncestorZoom } from "../utils/domUtils";
import BulkActionBar from "../components/common/BulkActionBar";
import { useBulkStrip } from "../hooks/useBulkSelection";
import * as XLSX from "xlsx";
import { useColumnSettings } from "../hooks/useColumnSettings";
import ColumnSettingsPanel from "../components/ColumnSettingsPanel";
import VideoTutorialModal from "../components/VideoTutorialModal";
import { getVideoTutorial } from "../utils/videoTutorials";
import BulkActions from "../components/BulkActions";
import ImportPayments from "../components/payments/ImportPayments";
import { getPinnedBoundaryOverlayStyle } from "../utils/pinnedColumnShadow";
import PageSkeleton from "../components/common/PageSkeleton";

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
// Matches Deals.jsx's KPI band desktop height (h-[120px]) so the two pages'
// header/stats layout lines up the same way.
const KPI_BAND_HEIGHT = 120;

const ALL_COLUMNS = [
  { id: "payment-id", key: "payment-id", label: "Transaction ID" },
  { id: "party",      key: "party",      label: "Party / Entity"  },
  { id: "amount",     key: "amount",     label: "Amount"           },
  { id: "direction",  key: "direction",  label: "Direction"        },
  { id: "type",       key: "type",       label: "Type"             },
  { id: "date",       key: "date",       label: "Date"             },
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
  // Full-page skeleton (same as Deals.jsx/Companies.jsx) only for the very
  // first load of this page — subsequent refetches (page change, search,
  // sort) keep the header/KPIs/pagination visible and only skeleton the
  // table rows, so navigating away and back doesn't re-flash the whole page.
  const hasLoadedOnceRef = useRef(false);

  /* search */
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef(null);

  /* columns — visibility + order persist via useColumnSettings (same hook
     Companies.jsx uses); pin side stays local/session-only, matching how
     Companies.jsx's own pinnedColumns state also isn't part of that hook. */
  const defaultColumns = useMemo(
    () => ALL_COLUMNS.map((c, i) => ({ key: c.id, label: c.label, visible: true, order: i, sortable: true, required: i === 0 })),
    []
  );
  const { columns, saveColumns, getVisibleColumns } = useColumnSettings("paymentsTimeline", defaultColumns);
  const [colWidths, setColWidths]     = useState(DEFAULT_COL_WIDTHS);
  const [pinnedCols, setPinnedCols]   = useState({});
  const [sortConfig, setSortConfig]   = useState({ key: null, direction: null });
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  /* Column header menu */
  const [openColumnMenuKey, setOpenColumnMenuKey] = useState(null);
  const [columnMenuPos, setColumnMenuPos]         = useState(null);

  /* Filter states */
  const [companies, setCompanies]               = useState([]);
  const [partyFilter, setPartyFilter]           = useState("");
  const [directionFilter, setDirectionFilter]   = useState("");
  const [typeFilter, setTypeFilter]             = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [activeFilters, setActiveFilters]       = useState([]);

  /* drag-reorder state (mirror of Accounting.jsx) */
  const [draggedColKey,  setDraggedColKey]  = useState(null);
  const [dragOverColKey, setDragOverColKey] = useState(null);
  const [dragGhost,      setDragGhost]      = useState(null);
  const dragOverRef = useRef(null);
  const ghostElRef  = useRef(null);

  /* row selection */
  const [selectedIds, setSelectedIds] = useState([]);
  const { visible: stripVisible, closing: stripClosing } = useBulkStrip(selectedIds.length);

  /* three-dot header menu + KPI/Import/Video Tutorial/Bulk Update */
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);
  const [showStats, setShowStats] = useState(true);
  const [showVideoTutorial, setShowVideoTutorial] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);

  /* misc UI */
  const [showFilterMenu,    setShowFilterMenu]    = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingPaymentItem, setEditingPaymentItem] = useState(null);
  const [openActionMenuId,  setOpenActionMenuId]  = useState(null);
  const [actionMenuPos,     setActionMenuPos]     = useState(null);
  const [deleteConfirmState, setDeleteConfirmState] = useState({ isOpen: false, type: "single", target: null });
  const [editingPage, setEditingPage] = useState(false);
  const [pageInput, setPageInput] = useState("");

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
    // Anchor the menu's RIGHT edge to the chevron button's right edge (same
    // formula as DealsTable.jsx's renderHeaderMenu), not the button's left
    // edge — anchoring left made the menu grow rightward off a narrow
    // column's trigger and overshoot into the next column instead of
    // staying over the column it belongs to.
    const zMenu = getAncestorZoom(document.body);
    const MENU_W = 220;
    const rect = e.currentTarget.getBoundingClientRect();
    let calcLeft = rect.right / zMenu - MENU_W;
    calcLeft = Math.min(calcLeft, window.innerWidth / zMenu - MENU_W - 8);
    calcLeft = Math.max(calcLeft, 8);
    setColumnMenuPos({
      top: rect.bottom / zMenu + 4,
      left: calcLeft,
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
  const orderedColumns = useMemo(() => {
    const visible = getVisibleColumns(); // already ordered
    return visible
      .map(vc => ALL_COLUMNS.find(c => c.id === vc.key))
      .filter(Boolean)
      .sort((a, b) => {
        const rank = c => pinnedCols[c.id] === "left" ? 0 : pinnedCols[c.id] === "right" ? 2 : 1;
        return rank(a) - rank(b);
      });
  }, [columns, pinnedCols]);

  /* ── pinned-block boundary shadow (same as DealsTable.jsx) — applied to
     the last left-pinned column and the first right-pinned column, in
     display order, so the pinned block reads as "floating" above the
     scrollable columns behind it. ───────────────────────────────────── */
  const leftPinnedInOrder = orderedColumns.filter(c => pinnedCols[c.id] === "left");
  const rightPinnedInOrder = orderedColumns.filter(c => pinnedCols[c.id] === "right");
  const lastLeftPinnedKey = leftPinnedInOrder.length > 0 ? leftPinnedInOrder[leftPinnedInOrder.length - 1].id : null;
  const firstRightPinnedKey = rightPinnedInOrder.length > 0 ? rightPinnedInOrder[0].id : null;
  const boundaryShadowSideFor = (colId) =>
    colId === lastLeftPinnedKey ? "left" : colId === firstRightPinnedKey ? "right" : null;

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

  /* ── close the three-dot header menu on outside click ───────────── */
  useEffect(() => {
    const handle = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  /* ── data fetching ───────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    setShowLoadingSkeleton(true);
    try {
      const params = new URLSearchParams();
      params.append("page", pagination.currentPage);
      params.append("limit", pagination.limit);
      if (searchQuery) params.append("search", searchQuery);

      // Pass all active filters as JSON string to backend
      const validRules = (activeFilters || []).filter(f => f.column && (f.value !== "" || ["is_empty", "is_not_empty"].includes(f.operator)));
      if (validRules.length > 0) {
        params.append("rules", JSON.stringify(validRules));
      }

      const res = await API.get(`/payments-timeline?${params.toString()}`);
      setDocuments(res.data.documents || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch (err) {
      toast.error("Failed to load transactions timeline");
      console.error(err);
    } finally {
      setShowLoadingSkeleton(false);
      hasLoadedOnceRef.current = true;
    }
  }, [pagination.currentPage, pagination.limit, searchQuery, activeFilters]);

  /* ── fetch ALL record IDs from DB for global Select All ─────────── */
  const fetchAllIds = useCallback(async () => {
    const tid = toast.loading("Selecting all records...");
    try {
      const params = new URLSearchParams();
      params.append("page", 1);
      params.append("limit", 99999);
      if (searchQuery) params.append("search", searchQuery);

      const validRules = (activeFilters || []).filter(f => f.column && (f.value !== "" || ["is_empty", "is_not_empty"].includes(f.operator)));
      if (validRules.length > 0) {
        params.append("rules", JSON.stringify(validRules));
      }

      const res = await API.get(`/payments-timeline?${params.toString()}`);
      const allDocs = res.data.documents || [];
      setSelectedIds(allDocs.map(d => d._id));
      toast.success(`Selected all ${allDocs.length} record(s).`, { id: tid });
    } catch (err) {
      toast.error("Failed to fetch all records", { id: tid });
      console.error(err);
    }
  }, [searchQuery, activeFilters]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  }, [searchQuery, activeFilters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── sorted docs ─────────────────────────────────────── */
  const filteredDocs = useMemo(() => {
    let list = [...documents];

    if (sortConfig.key) {
      list.sort((a, b) => {
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
  }, [documents, sortConfig]);

  /* ── KPI stats — narrows to the current selection when one exists,
     same behavior as Deals.jsx's dealStatistics ─────────────────── */
  const paymentStats = useMemo(() => {
    const source = selectedIds.length > 0
      ? filteredDocs.filter(d => selectedIds.includes(d._id))
      : filteredDocs;
    let totalCredit = 0;
    let totalDebit = 0;
    source.forEach(d => {
      const amt = Number(d.amount) || 0;
      if (d.direction === "IN") totalCredit += amt;
      else totalDebit += amt;
    });
    return {
      totalCredit,
      totalDebit,
      net: totalCredit - totalDebit,
      count: source.length,
      isFiltered: selectedIds.length > 0,
    };
  }, [filteredDocs, selectedIds]);

  const handleSelectAll = e =>
    setSelectedIds(e.target.checked ? filteredDocs.map(d => d._id) : []);

  const handleSelectRow = id =>
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  /* ── Bulk Update ─────────────────────────────────────────────────
     Rows come from 4 different source collections (Payment/Invoice/
     Purchase/Subscription), so the editable field set is limited to the
     3 fields updateTimelineEntry's generic fallback branch actually
     applies uniformly across every source: paymentDate, notes, bank. */
  const paymentFieldConfig = {
    // Keys match the normalized doc's own property names (so BulkActions'
    // hasOwnProperty check against selected rows passes for every source) —
    // "date" gets translated to the backend's expected "paymentDate" body
    // key in handleBulkUpdatePayments below.
    fields: [
      { key: "date", label: "Date", type: "date" },
      { key: "bank", label: "Bank Account", type: "text" },
      { key: "notes", label: "Notes", type: "text" },
    ],
  };

  const handleBulkUpdatePayments = async ({ field, value, itemIds }) => {
    const bodyKey = field === "date" ? "paymentDate" : field;
    await Promise.all(itemIds.map(async (id) => {
      const doc = documents.find(d => d._id === id);
      if (!doc) return;
      await API.put(`/payments-timeline/${id}`, { source: doc.source, [bodyKey]: value });
    }));
    toast.success("Updated selected entries");
    setSelectedIds([]);
    fetchData();
  };

  /* ── Export to Excel function ───────────────────────────────────── */
  const handleExportExcel = useCallback((itemsToExport) => {
    const list = Array.isArray(itemsToExport) ? itemsToExport : [itemsToExport];
    if (!list.length) {
      toast.error("No entries selected for export");
      return;
    }

    const exportData = list.map(item => ({
      "Transaction ID": item["payment-id"] || item._id || "N/A",
      "Party / Entity": item.party || "N/A",
      "Amount (₹)": item.amount !== undefined ? item.amount : 0,
      "Direction": item.direction === "IN" ? "Credit (IN)" : "Debit (OUT)",
      "Type": item.type || item.paymentType || item.source || "N/A",
      "Date": item.date ? new Date(item.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A",
      "Bank Account": item.bank || "N/A",
      "Notes": item.notes || ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Payments Timeline");

    // Dynamic column width adjustment
    const colWidths = [
      { wch: 22 }, // Transaction ID
      { wch: 26 }, // Party
      { wch: 15 }, // Amount
      { wch: 15 }, // Direction
      { wch: 16 }, // Type
      { wch: 18 }, // Date
      { wch: 22 }, // Bank
      { wch: 30 }, // Notes
    ];
    worksheet["!cols"] = colWidths;

    const filename = `Payments_Timeline_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
    toast.success(`Exported ${list.length} item(s) to ${filename}`);
  }, []);

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

  /* ── Column drag-reorder — reorders only the visible columns and
     reassigns `order` for all of them, same pattern Companies.jsx's
     handleColumnReorder uses, so the new order persists via saveColumns. */
  const handleColumnReorder = useCallback((draggedKey, targetKey) => {
    if (!draggedKey || draggedKey === targetKey) return;
    const visible = columns.filter(c => c.visible).sort((a, b) => a.order - b.order);
    const from = visible.findIndex(c => c.key === draggedKey);
    const to = visible.findIndex(c => c.key === targetKey);
    if (from === -1 || to === -1) return;
    const reordered = [...visible];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const hidden = columns.filter(c => !c.visible);
    saveColumns([...reordered.map((c, i) => ({ ...c, order: i })), ...hidden]);
  }, [columns, saveColumns]);

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
      const previewRows = documents.map(doc => cellTextFor(colId, doc));

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
              return;
            }
            // Same zoom correction + row-center anchor + viewport clamp as
            // DealsTable.jsx's row-actions menu — this previously used the
            // raw (unzoomed) rect and anchored to the button's top edge with
            // no clamping at all, which under the app's CSS zoom drifted the
            // portal far from the row that was actually clicked.
            const zMenu = getAncestorZoom(document.body);
            const MENU_W = 160; // matches w-40 below
            const MENU_H = 189; // 5 buttons (~36px each) + 1 divider (~9px)
            const MARGIN = 8;
            const rect = e.currentTarget.getBoundingClientRect();
            const viewportH = window.innerHeight / zMenu;
            const viewportW = window.innerWidth / zMenu;

            const rowCenter = (rect.top + rect.bottom) / (2 * zMenu);
            let calcTop = rowCenter - MENU_H / 2;
            calcTop = Math.max(MARGIN, Math.min(calcTop, viewportH - MENU_H - MARGIN));

            let calcLeft = rect.right / zMenu - MENU_W;
            calcLeft = Math.min(calcLeft, viewportW - MENU_W - MARGIN);
            calcLeft = Math.max(calcLeft, MARGIN);

            setActionMenuPos({ top: calcTop, left: calcLeft });
            setOpenActionMenuId(doc._id);
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
              style={{ top: actionMenuPos.top, left: actionMenuPos.left }}
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
              <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                  setOpenActionMenuId(null);
                  setActionMenuPos(null);
                  handleExportExcel(doc);
                }}>
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

  // First-load-only full-page skeleton — same component/usage Deals.jsx
  // uses (`if (loading) return <PageSkeleton .../>`).
  if (showLoadingSkeleton && documents.length === 0 && !hasLoadedOnceRef.current) {
    return (
      <PageSkeleton variant="kanban" boardVariant="table" tableRows={pagination.limit} tableCols={ALL_COLUMNS.length} />
    );
  }

  /* ─────────────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-[#FAFBFC]">

      {/* ── Fixed header bar — same shape/classes as Deals.jsx's "New Strip":
          border-b bg-white flex justify-between, fixed 64px height, title
          block stacked (name + video icon, subtitle below) instead of a
          single title+badge line. ──────────────────────────────────────── */}
      <div
        className="fixed right-0 border-b border-[#E1E4EA] bg-white flex items-center justify-between gap-2 lg:gap-4 px-4 lg:px-6 top-[54px] lg:top-16"
        style={{
          left: "var(--sidebar-width, 0px)",
          zIndex: 40,
          height: "64px",
          minHeight: "64px",
          maxHeight: "64px",
          boxSizing: "border-box",
        }}
      >
        <div className="flex flex-col gap-1 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2
              className="m-0 font-medium truncate text-sm sm:text-base"
              style={{ lineHeight: "120%", letterSpacing: "-0.5px", color: "#0E121B" }}
            >
              Payments Timeline
            </h2>
            <button
              type="button"
              onClick={() => setShowVideoTutorial(true)}
              className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 hover:bg-blue-100 hover:border-blue-200 transition-all flex-shrink-0 shadow-sm"
              title="Watch Payments Timeline Video Guide"
            >
              <Video className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] sm:text-xs font-semibold flex-shrink-0">
              {pagination.totalCount} total
            </span>
          </div>
          <p className="text-[#5B5A64] text-[10px] sm:text-sm m-0 leading-tight truncate">
            Track money in and out
          </p>
        </div>

        <div className="flex flex-row items-center gap-2 flex-shrink-0 min-w-0">
          {/* Search — expands in place from the icon */}
          <div
            className={`relative h-10 flex items-center border border-[#E1E4EA] rounded-full bg-white transition-all duration-300 ease-in-out hover:bg-gray-50 focus-within:border-[#0085FF] focus-within:hover:bg-white ${isSearchExpanded ? "w-[220px] sm:w-[300px] lg:w-[380px]" : "w-10"} max-w-full flex-shrink-0`}
          >
            <SearchIcon
              className="absolute left-3 text-[#525866] w-4 h-4 cursor-pointer z-10 flex-shrink-0 top-1/2 -translate-y-1/2"
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
              className={`w-full h-full bg-transparent rounded-full pl-9 pr-9 text-[14px] leading-[20px] text-[#1F2937] placeholder:text-[#99A0AE] focus:outline-none transition-opacity duration-200 cursor-pointer ${isSearchExpanded ? "opacity-100 focus:cursor-text" : "opacity-0"}`}
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
          <button
            type="button"
            onClick={() => setShowAdvancedFilters(true)}
            className="relative flex items-center justify-center w-10 h-10 rounded-full border border-[#E1E4EA] text-gray-500 hover:bg-gray-50 transition-colors bg-white cursor-pointer flex-shrink-0"
            title="Filters"
          >
            <FilterIcon size={16} />
            {activeFilters.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#0085FF] text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                {activeFilters.length}
              </span>
            )}
          </button>

          {/* More options */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setIsMoreMenuOpen((prev) => !prev)}
              className="flex items-center justify-center w-10 h-10 rounded-full border border-[#E1E4EA] text-gray-500 hover:bg-gray-50 transition-colors"
              title="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isMoreMenuOpen && (
              <div className="absolute right-0 z-50 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-xl py-1 animate-in fade-in zoom-in duration-200 origin-top-right">
                <button
                  onClick={() => { setShowColumnSettings(true); setIsMoreMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Settings className="w-4 h-4 text-gray-400" />
                  Columns
                </button>
                <button
                  onClick={() => { setShowStats((prev) => !prev); setIsMoreMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Eye className="w-4 h-4 text-gray-400" />
                  {showStats ? "Hide KPIs" : "Unhide KPIs"}
                </button>
                <button
                  onClick={() => { setShowImport(true); setIsMoreMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Upload className="w-4 h-4 text-gray-400" />
                  Import
                </button>
                <button
                  onClick={() => { setShowVideoTutorial(true); setIsMoreMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Video className="w-4 h-4 text-gray-400" />
                  Video Tutorial
                </button>
              </div>
            )}
          </div>

          {/* Add Button */}
          <button
            onClick={() => {
              setEditingPaymentItem(null);
              setIsPaymentModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-[#0085FF] text-white text-sm font-medium rounded-full hover:bg-blue-600 transition-colors flex-shrink-0 ml-1 cursor-pointer"
          >
            <Plus className="w-4 h-4 flex-shrink-0 text-white" />
            <span className="whitespace-nowrap">Add Payment</span>
          </button>
        </div>
      </div>

      {/* ── KPI stat cards — same band treatment as Deals.jsx's stats row
          (bordered band, 40x40 icon boxes, gap-6 between cards), narrowing
          to the selection when rows are selected. Toggled via the
          three-dot menu's Hide/Unhide KPIs item. ─────────────────────── */}
      {showStats && (
        <div
          className="fixed right-0 box-border flex flex-col justify-center bg-white border-b border-[#E1E4EA] px-6 py-6"
          style={{ left: "var(--sidebar-width, 0px)", top: 126, height: KPI_BAND_HEIGHT, zIndex: 38, boxSizing: "border-box" }}
        >
          <div className="grid grid-cols-2 lg:flex lg:flex-row lg:items-stretch gap-3 lg:gap-6">
            {[
              { label: "Total Credit", value: `₹${paymentStats.totalCredit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: TrendingUp, iconClass: "text-green-600" },
              { label: "Total Debit", value: `₹${paymentStats.totalDebit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: TrendingDown, iconClass: "text-red-600" },
              { label: "Net", value: `₹${paymentStats.net.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: Wallet, iconClass: paymentStats.net >= 0 ? "text-green-600" : "text-red-600" },
              { label: "Transactions", value: paymentStats.count, icon: ListChecks, iconClass: "text-[#0085FF]" },
            ].map(({ label, value, icon: Icon, iconClass }) => (
              <div
                key={label}
                className="box-border flex flex-row items-center justify-between min-w-0 lg:min-w-[200px] lg:w-[280px] lg:flex-1 bg-white"
                style={{ padding: "16px", border: "1px solid #E1E4EA", borderRadius: "12px" }}
              >
                <div className="flex flex-row items-center min-w-0" style={{ gap: "14px" }}>
                  <div
                    className="flex items-center justify-center flex-shrink-0"
                    style={{ width: "40px", height: "40px", padding: "8px", background: "rgba(255, 255, 255, 0.1)", border: "1px solid #E1E4EA", borderRadius: "6px" }}
                  >
                    <Icon className={`w-5 h-5 ${iconClass}`} />
                  </div>
                  <div className="flex flex-col items-start min-w-0" style={{ gap: "4px" }}>
                    <span className="truncate text-xs" style={{ color: "#525866" }}>
                      {label}{paymentStats.isFiltered ? " (selected)" : ""}
                    </span>
                    <span className="truncate text-lg font-semibold" style={{ color: "#0E121B" }}>
                      {value}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── BulkActionBar — floats between title bar and table when rows are selected ── */}
      {stripVisible && (
        <div
          className="fixed right-0 px-6 z-[40]"
          style={{ left: "var(--sidebar-width, 0px)", top: 126 + (showStats ? KPI_BAND_HEIGHT : 0), paddingTop: 4, paddingBottom: 4 }}
        >
          <BulkActionBar
            selectedCount={selectedIds.length}
            entityName="payment"
            isClosing={stripClosing}
            onSelectAll={fetchAllIds}
            onDeselectAll={() => setSelectedIds([])}
            onExport={() => {
              const selectedDocs = documents.filter(doc => selectedIds.includes(doc._id));
              handleExportExcel(selectedDocs.length > 0 ? selectedDocs : selectedIds.map(id => ({ _id: id })));
            }}
            onDelete={() => {
              setDeleteConfirmState({ isOpen: true, type: "bulk", target: selectedIds });
            }}
            onUpdateStatus={() => setShowBulkActions(true)}
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
          top: (stripVisible ? 178 : 130) + (showStats ? KPI_BAND_HEIGHT : 0),
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
                const boundaryShadowSide = boundaryShadowSideFor(col.id);

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
                    {boundaryShadowSide && (
                      <div style={getPinnedBoundaryOverlayStyle(boundaryShadowSide)} />
                    )}
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
                    const cellBoundaryShadowSide = boundaryShadowSideFor(col.id);
                    return (
                      <td
                        key={col.id}
                        style={{ width: colWidths[col.id], ...stickyStyleFor(col.id) }}
                        className={`px-4 py-3 text-sm text-gray-900 border-b border-r border-[#E1E4EA] last:border-r-0 bg-inherit whitespace-nowrap ${cellBoundaryShadowSide ? "" : "overflow-hidden"}`}
                      >
                        {renderCell(col.id, doc, isRightmost)}
                        {cellBoundaryShadowSide && (
                          <div style={getPinnedBoundaryOverlayStyle(cellBoundaryShadowSide)} />
                        )}
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
            {[10, 25, 50, 100].map(val => <option key={val} value={val}>{val} per page</option>)}
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

          {(() => {
            const commitPage = () => {
              const val = parseInt(pageInput, 10);
              if (!isNaN(val) && val >= 1 && val <= pagination.totalPages) {
                handlePageChange(val);
              }
              setEditingPage(false);
            };

            return paginationItems.map((item, idx) => {
              if (item === "left-dots" || item === "right-dots") {
                return (
                  <span key={`${item}-${idx}`} className="flex items-center justify-center w-8 h-8 text-sm font-medium text-gray-400 select-none">
                    ....
                  </span>
                );
              }
              const isCurrent = item === pagination.currentPage;
              if (isCurrent && editingPage) {
                return (
                  <input
                    key="page-edit"
                    autoFocus
                    type="number"
                    min={1}
                    max={pagination.totalPages}
                    value={pageInput}
                    onChange={e => setPageInput(e.target.value)}
                    onBlur={commitPage}
                    onKeyDown={e => {
                      if (e.key === "Enter") commitPage();
                      if (e.key === "Escape") setEditingPage(false);
                    }}
                    className="w-10 h-8 rounded-full border border-blue-500 text-center text-sm font-medium text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                );
              }
              return (
                <button
                  key={item}
                  onClick={() => handlePageChange(item)}
                  onDoubleClick={() => {
                    if (isCurrent) {
                      setPageInput(String(pagination.currentPage));
                      setEditingPage(true);
                    }
                  }}
                  title={isCurrent ? "Double-click to type a page number" : undefined}
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors cursor-pointer ${isCurrent ? "bg-[#0085FF] text-white" : "bg-white border border-[#E1E4EA] text-gray-700 hover:bg-gray-50"}`}
                >
                  {item}
                </button>
              );
            });
          })()}

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
                    </button>                    <div className="w-full border-t border-[#F1F1F5] my-0.5" />

                    <button
                      onClick={() => {
                        closeColumnMenu();
                        saveColumns(columns.map(c => c.key === col.id ? { ...c, visible: false } : c));
                      }}
                      disabled={columns.find(c => c.key === col.id)?.required}
                      className={`${itemClass} text-[#161618] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
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

      {/* ── Advanced Filter Panel (same as Companies.jsx) ─────────────── */}
      <AdvancedFilterPanel
        isOpen={showAdvancedFilters}
        onClose={() => setShowAdvancedFilters(false)}
        columns={ALL_COLUMNS}
        filters={activeFilters}
        setFilters={setActiveFilters}
        onApply={(newFilters) => setActiveFilters(newFilters)}
        title="Filter Transactions"
        subtitle="Find specific transactions quickly"
        emptyStateText="Add a rule to narrow down your payments timeline."
      />

      {/* ── Columns panel (same shared component Companies.jsx/Deals.jsx use) ── */}
      <ColumnSettingsPanel
        isOpen={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        columns={columns}
        onSave={saveColumns}
        moduleName="Payments Timeline"
      />

      {/* ── Video Tutorial ───────────────────────────────────────────── */}
      <VideoTutorialModal
        isOpen={showVideoTutorial}
        onClose={() => setShowVideoTutorial(false)}
        videoId={getVideoTutorial("paymentsTimeline")?.videoId}
        title={getVideoTutorial("paymentsTimeline")?.title}
      />

      {/* ── Import (Payment records only) ───────────────────────────── */}
      <ImportPayments
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImportSuccess={() => fetchData()}
      />

      {/* ── Bulk Update ──────────────────────────────────────────────── */}
      <BulkActions
        isOpen={showBulkActions}
        onClose={() => setShowBulkActions(false)}
        selectedItems={documents.filter(doc => selectedIds.includes(doc._id))}
        onBulkUpdate={handleBulkUpdatePayments}
        fieldConfig={paymentFieldConfig}
        module="transactions"
      />
    </div>
  );
}
