import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen, Plus, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, MoreVertical, Pin, PinOff,
  EyeOff, Pencil, ArrowDownCircle, ArrowUpCircle, Trash2, Eye,
} from "lucide-react";
import toast from "react-hot-toast";
import SearchIcon from "../components/common/SearchIcon";
import HighlightText from "../components/common/HighlightText";
import TableSkeletonRows from "../components/common/TableSkeletonRows";
import { getAncestorZoom } from "../utils/domUtils";
import { getPinnedBoundaryOverlayStyle } from "../utils/pinnedColumnShadow";
import QuickJournalForm from "../components/journal/QuickJournalForm";
import JournalLedgerDrawer from "../components/journal/JournalLedgerDrawer";
import PayInOutModal from "../components/journal/PayInOutModal";
import API from "../services/api";

/*
 * Table UI parity pass — same pin/drag/search/row-menu infrastructure
 * Deals.jsx/Contacts.jsx/Tasks.jsx/Inventory.jsx already have (this mirrors
 * Inventory.jsx's implementation directly). Backed by the real Journal API
 * now (see backend/routes/journalRoutes.js): list/create/edit/delete all
 * hit the server. Pay In/Pay Out post to POST /journals/:id/entries and
 * update both the row's balance here and (if open) the Ledger drawer.
 */

const DEFAULT_COL_WIDTHS = {
  selection: 60,
  balance: 160,
  name: 220,
  category: 160,
  date: 160,
  lastUpdated: 160,
  description: 220,
};
const MIN_COL_WIDTH = 60;

const ALL_COLUMNS = [
  { id: "balance", key: "balance", label: "Balance" },
  { id: "name", key: "name", label: "Journal" },
  { id: "category", key: "category", label: "Category" },
  { id: "date", key: "date", label: "Date" },
  { id: "lastUpdated", key: "lastUpdated", label: "Last Updated" },
  { id: "description", key: "description", label: "Description" },
];

const money = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const cellTextFor = (colId, j) => {
  switch (colId) {
    case "balance": return money(j.currentBalance);
    case "name": return j.name || "";
    case "category": return j.category || "";
    case "date": return formatDate(j.date);
    case "lastUpdated": return formatDate(j.updatedAt);
    case "description": return j.description || "";
    default: return "";
  }
};

export default function Journals() {
  /* search (existing) */
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [editingJournal, setEditingJournal] = useState(null);
  const [ledgerJournalId, setLedgerJournalId] = useState(null);
  const [payModal, setPayModal] = useState({ open: false, journal: null, type: "payin" });
  // Bumped whenever a Pay In/Out lands while the Ledger drawer for that same
  // journal is open, so JournalLedgerDrawer knows to re-pull its rows.
  const [ledgerRefreshKey, setLedgerRefreshKey] = useState(0);
  const searchInputRef = useRef(null);

  /* journal list — fetched from the real API */
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("active"); // "active" | "cancelled"

  /* pagination — client-side over the already-loaded list (journals don't
     paginate server-side; the whole org's list is small enough to fetch in
     one call), same edge-to-edge bottom-bar treatment as PaymentsTimeline.jsx/
     Inventory.jsx/PurchasePage.jsx. */
  const [journalsPagination, setJournalsPagination] = useState({ currentPage: 1, limit: 20 });
  const [editingJournalsPage, setEditingJournalsPage] = useState(false);
  const [journalsPageInput, setJournalsPageInput] = useState("");

  const fetchJournals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get("/journals");
      setJournals(res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load journals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJournals();
  }, [fetchJournals]);

  /* columns — local pin/order/hide, same shape as PaymentsTimeline.jsx
     (no useColumnSettings persistence needed for a page with no real data
     source yet). */
  const [columnOrder, setColumnOrder] = useState(ALL_COLUMNS.map((c) => c.id));
  const [colWidths, setColWidths] = useState(DEFAULT_COL_WIDTHS);
  const [pinnedCols, setPinnedCols] = useState({});
  const [hiddenCols, setHiddenCols] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  /* column header menu */
  const [openColumnMenuKey, setOpenColumnMenuKey] = useState(null);
  const [columnMenuPos, setColumnMenuPos] = useState(null);

  /* drag-reorder */
  const [draggedColKey, setDraggedColKey] = useState(null);
  const [dragOverColKey, setDragOverColKey] = useState(null);
  const [dragGhost, setDragGhost] = useState(null);
  const dragOverRef = useRef(null);
  const ghostElRef = useRef(null);

  /* row action menu */
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [actionMenuPos, setActionMenuPos] = useState(null);

  /* ── ordered columns (pinned left → unpinned → pinned right) ─────── */
  const orderedColumns = useMemo(
    () =>
      columnOrder
        .map((id) => ALL_COLUMNS.find((c) => c.id === id))
        .filter((c) => c && !hiddenCols.includes(c.id))
        .sort((a, b) => {
          const rank = (c) => (pinnedCols[c.id] === "left" ? 0 : pinnedCols[c.id] === "right" ? 2 : 1);
          return rank(a) - rank(b);
        }),
    [columnOrder, pinnedCols, hiddenCols]
  );

  const leftPinnedInOrder = orderedColumns.filter((c) => pinnedCols[c.id] === "left");
  const rightPinnedInOrder = orderedColumns.filter((c) => pinnedCols[c.id] === "right");
  const lastLeftPinnedKey = leftPinnedInOrder.length ? leftPinnedInOrder[leftPinnedInOrder.length - 1].id : null;
  const firstRightPinnedKey = rightPinnedInOrder.length ? rightPinnedInOrder[0].id : null;
  const boundaryShadowSideFor = (colId) =>
    colId === lastLeftPinnedKey ? "left" : colId === firstRightPinnedKey ? "right" : null;

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

  const stickyStyleFor = useCallback((colId) => stickyStyles[colId] || {}, [stickyStyles]);

  const setColumnPin = useCallback((colId, side) => {
    setPinnedCols((prev) => {
      const next = { ...prev };
      if (next[colId] === side) delete next[colId];
      else next[colId] = side;
      return next;
    });
  }, []);

  const openColumnMenu = (e, colId) => {
    e.stopPropagation();
    const zMenu = getAncestorZoom(document.body);
    const MENU_W = 220;
    const rect = e.currentTarget.getBoundingClientRect();
    let calcLeft = rect.right / zMenu - MENU_W;
    calcLeft = Math.min(calcLeft, window.innerWidth / zMenu - MENU_W - 8);
    calcLeft = Math.max(calcLeft, 8);
    setColumnMenuPos({ top: rect.bottom / zMenu + 4, left: calcLeft });
    setOpenColumnMenuKey(colId);
  };
  const closeColumnMenu = () => { setOpenColumnMenuKey(null); setColumnMenuPos(null); };

  /* ── column resize ───────────────────────────────────────────────── */
  const startColumnResize = useCallback((e, colId) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidths[colId] ?? MIN_COL_WIDTH;
    const onMove = (mv) =>
      setColWidths((prev) => ({ ...prev, [colId]: Math.max(MIN_COL_WIDTH, startW + mv.clientX - startX) }));
    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [colWidths]);

  const ResizeHandle = useCallback(
    ({ colId }) => (
      <div
        data-resize-handle="true"
        onMouseDown={(e) => startColumnResize(e, colId)}
        onClick={(e) => e.stopPropagation()}
        title="Drag to resize column"
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none z-30 hover:bg-[#0085FF]/40 active:bg-[#0085FF]"
      />
    ),
    [startColumnResize]
  );

  /* ── column drag-reorder ─────────────────────────────────────────── */
  const handleColumnReorder = useCallback((draggedKey, targetKey) => {
    if (!draggedKey || draggedKey === targetKey) return;
    setColumnOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(draggedKey);
      const to = next.indexOf(targetKey);
      if (from === -1 || to === -1) return prev;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const startColumnDrag = (e, colId) => {
    if (e.button !== 0) return;
    if (e.target.closest("button") || e.target.closest("[data-resize-handle]")) return;

    const th = e.currentTarget;
    const startX = e.clientX;
    const startY = e.clientY;
    const THRESHOLD = 5;
    const dragState = { started: false, offsetX: 0, offsetY: 0, zGhost: 1 };

    const positionGhost = (clientX, clientY) => {
      const el = ghostElRef.current;
      if (!el) return;
      const visualTop = clientY - dragState.offsetY;
      const visualLeft = clientX - dragState.offsetX;
      el.style.top = `${visualTop / dragState.zGhost}px`;
      el.style.left = `${visualLeft / dragState.zGhost}px`;
      el.style.maxHeight = `${Math.max(100, window.innerHeight - visualTop - 72) / dragState.zGhost}px`;
    };

    const updateDragOver = (clientX, clientY) => {
      const elAtPoint = document.elementFromPoint(clientX, clientY);
      const thAtPoint = elAtPoint?.closest("th[data-col-id]");
      const overKey = thAtPoint?.getAttribute("data-col-id") || null;
      if (dragOverRef.current !== overKey) {
        dragOverRef.current = overKey;
        setDragOverColKey(overKey);
      }
    };

    const beginDrag = () => {
      dragState.started = true;
      window.getSelection?.()?.removeAllRanges();
      const rect = th.getBoundingClientRect();
      const col = ALL_COLUMNS.find((c) => c.id === colId);
      const previewRows = journals.map((j) => cellTextFor(colId, j));
      dragState.zGhost = getAncestorZoom(document.body);
      dragState.offsetX = startX - rect.left;
      dragState.offsetY = startY - rect.top;
      dragOverRef.current = null;
      setDraggedColKey(colId);
      setDragOverColKey(null);
      document.body.style.userSelect = "none";
      setDragGhost({
        label: col?.label || colId,
        previewRows,
        width: rect.width / dragState.zGhost,
        height: rect.height / dragState.zGhost,
      });
      requestAnimationFrame(() => positionGhost(startX, startY));
    };

    const handleMouseMove = (mv) => {
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
      document.removeEventListener("mouseup", handleMouseUp);
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
    document.addEventListener("mouseup", handleMouseUp);
  };

  /* ── filtered + sorted list ───────────────────────────────────────── */
  const filteredJournals = useMemo(() => {
    let list = journals.filter((j) => (activeTab === "cancelled" ? j.status === "cancelled" : j.status !== "cancelled"));
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (j) =>
          (j.name || "").toLowerCase().includes(q) ||
          (j.category || "").toLowerCase().includes(q) ||
          (j.description || "").toLowerCase().includes(q)
      );
    }
    if (sortConfig.key) {
      list = [...list].sort((a, b) => {
        let va = a[sortConfig.key];
        let vb = b[sortConfig.key];
        if (typeof va === "string") va = va.toLowerCase();
        if (typeof vb === "string") vb = vb.toLowerCase();
        if (va < vb) return sortConfig.direction === "asc" ? -1 : 1;
        if (va > vb) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [journals, activeTab, searchTerm, sortConfig]);

  // Reset to page 1 whenever the visible set changes shape (tab/search/sort) —
  // otherwise a narrowed result set can strand the user on a now-empty page.
  useEffect(() => {
    setJournalsPagination((p) => ({ ...p, currentPage: 1 }));
  }, [activeTab, searchTerm, sortConfig]);

  const journalsTotalCount = filteredJournals.length;
  const journalsTotalPages = Math.max(1, Math.ceil(journalsTotalCount / journalsPagination.limit));
  const paginatedJournals = useMemo(() => {
    const start = (journalsPagination.currentPage - 1) * journalsPagination.limit;
    return filteredJournals.slice(start, start + journalsPagination.limit);
  }, [filteredJournals, journalsPagination]);

  const handleJournalsPageChange = (page) => {
    if (page >= 1 && page <= journalsTotalPages && page !== journalsPagination.currentPage) {
      setJournalsPagination((p) => ({ ...p, currentPage: page }));
    }
  };
  const handleJournalsLimitChange = (limit) => {
    setJournalsPagination({ currentPage: 1, limit });
  };

  const handleDeleteJournal = async (j) => {
    try {
      await API.delete(`/journals/${j._id}`);
      setJournals((prev) => prev.filter((row) => row._id !== j._id));
      toast.success("Journal deleted");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete journal");
    }
  };

  /* ── row action menu ─────────────────────────────────────────────── */
  const renderActionMenu = (j) => {
    const isOpen = openActionMenuId === j._id;
    const closeMenu = () => { setOpenActionMenuId(null); setActionMenuPos(null); };
    const openPay = (payType) => { closeMenu(); setPayModal({ open: true, journal: j, type: payType }); };
    return (
      <div className="relative flex-shrink-0 flex items-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isOpen) { closeMenu(); return; }
            const zMenu = getAncestorZoom(document.body);
            const MENU_W = 176;
            const MENU_H = 210;
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
            setOpenActionMenuId(j._id);
          }}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <MoreVertical size={15} />
        </button>
        {isOpen && actionMenuPos && createPortal(
          <>
            <div className="fixed inset-0 z-[59]" onClick={closeMenu} />
            <div
              className="fixed w-44 bg-white rounded-xl shadow-lg border border-[#E1E4EA] py-1 z-[60] overflow-hidden"
              style={{ top: actionMenuPos.top, left: actionMenuPos.left }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => { closeMenu(); setEditingJournal(j); setShowQuickAdd(true); }}
              >
                <Pencil className="w-4 h-4 text-blue-600" /> Edit
              </button>
              <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => openPay("payin")}>
                <ArrowDownCircle className="w-4 h-4 text-green-600" /> Pay In
              </button>
              <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => openPay("payout")}>
                <ArrowUpCircle className="w-4 h-4 text-red-600" /> Pay Out
              </button>
              <button
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => { closeMenu(); setLedgerJournalId(j._id); }}
              >
                <Eye className="w-4 h-4 text-gray-400" /> Ledger
              </button>
              <div className="h-px bg-gray-100 my-1" />
              <button
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                onClick={() => { closeMenu(); handleDeleteJournal(j); }}
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </>,
          document.body
        )}
      </div>
    );
  };

  /* ── cell renderer ───────────────────────────────────────────────── */
  const renderCell = (colId, j, isRightmost) => {
    let content;
    switch (colId) {
      case "balance":
        content = (
          <span className={`text-sm font-bold ${Number(j.currentBalance) < 0 ? "text-red-600" : "text-gray-900"}`}>
            {money(j.currentBalance)}
          </span>
        );
        break;
      case "name":
        content = (
          <span className="text-sm font-semibold text-gray-900 truncate">
            <HighlightText text={j.name} query={searchTerm} />
          </span>
        );
        break;
      case "category":
        content = j.category ? (
          <span className="text-sm text-gray-700 truncate">
            <HighlightText text={j.category} query={searchTerm} />
          </span>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        );
        break;
      case "date":
        content = <span className="text-sm text-gray-600">{formatDate(j.date)}</span>;
        break;
      case "lastUpdated":
        content = <span className="text-sm text-gray-600">{formatDate(j.updatedAt)}</span>;
        break;
      case "description":
        content = j.description ? (
          <span className="text-sm text-gray-700 truncate block">
            <HighlightText text={j.description} query={searchTerm} />
          </span>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        );
        break;
      default:
        content = <span className="text-sm text-gray-700">—</span>;
    }
    return (
      <div className="flex items-center justify-between gap-2 w-full min-w-0">
        <div className="flex-1 min-w-0">{content}</div>
        {/* Ledger lives solely in the ⋮ menu — the inline pill duplicated it on every
            row and crowded the last column. */}
        {isRightmost && renderActionMenu(j)}
      </div>
    );
  };

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
      {/* ── Fixed header bar (same shape as Inventory.jsx/PaymentsTimeline.jsx) ── */}
      <div
        className="fixed right-0 h-16 px-4 lg:px-6 border-b border-[#E1E4EA] bg-white flex items-center justify-between gap-4 top-[54px] lg:top-16"
        style={{ left: "var(--sidebar-width, 0px)", zIndex: 40, minHeight: 64, maxHeight: 64, boxSizing: "border-box" }}
      >
        <div className="flex flex-col justify-center gap-1 min-w-0 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="m-0 leading-tight font-bold text-base sm:text-lg text-gray-900 truncate">Journals</h1>
            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] sm:text-xs font-semibold flex-shrink-0">
              {filteredJournals.length}
            </span>
          </div>
          <p className="m-0 leading-tight text-[10px] sm:text-xs text-gray-500 truncate">Track accounting journal entries</p>
        </div>

        <div className="relative flex-1 min-w-0 flex items-center justify-end gap-2">
          <div
            className={`relative h-10 flex items-center border border-[#E1E4EA] rounded-full bg-white transition-all duration-300 ease-in-out hover:bg-gray-50 focus-within:border-[#0085FF] focus-within:hover:bg-white ${
              isSearchExpanded ? "w-full lg:w-[380px]" : "w-10"
            } max-w-full`}
          >
            <SearchIcon
              className="absolute left-3 cursor-pointer z-10 flex-shrink-0 top-1/2 -translate-y-1/2 w-4 h-4 text-[#525866]"
              onClick={() => { setIsSearchExpanded(true); searchInputRef.current?.focus(); }}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsSearchExpanded(true)}
              onBlur={() => { if (!searchTerm) setIsSearchExpanded(false); }}
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

      {/* ── Active/Cancelled tabs ─────────────────────────────────────── */}
      <div
        className="fixed right-0 h-11 px-4 lg:px-6 border-b border-[#E1E4EA] bg-white flex items-center gap-6 top-[118px] lg:top-[128px]"
        style={{ left: "var(--sidebar-width, 0px)", zIndex: 39 }}
      >
        {[
          { key: "active", label: "Active Journals", count: journals.filter((j) => j.status !== "cancelled").length },
          { key: "cancelled", label: "Cancelled", count: journals.filter((j) => j.status === "cancelled").length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`h-full flex items-center gap-1.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key ? "border-[#0085FF] text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            {tab.key === "active" && tab.count > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {showQuickAdd && (
        <QuickJournalForm
          editJournal={editingJournal}
          onRequestClose={() => { setShowQuickAdd(false); setEditingJournal(null); }}
          onJournalCreated={(journal) => setJournals((prev) => [journal, ...prev])}
          onJournalUpdated={(journal) =>
            setJournals((prev) => prev.map((row) => (row._id === journal._id ? journal : row)))
          }
        />
      )}

      <JournalLedgerDrawer
        isOpen={!!ledgerJournalId}
        journalId={ledgerJournalId}
        refreshKey={ledgerRefreshKey}
        onClose={() => setLedgerJournalId(null)}
        onOpenPayIn={(journal) => setPayModal({ open: true, journal, type: "payin" })}
        onOpenPayOut={(journal) => setPayModal({ open: true, journal, type: "payout" })}
      />

      <PayInOutModal
        isOpen={payModal.open}
        journal={payModal.journal}
        type={payModal.type}
        onClose={() => setPayModal((p) => ({ ...p, open: false }))}
        onSuccess={(updatedJournal) => {
          // Keep the list row's balance in sync without a full refetch, and
          // let the Ledger drawer (if this same journal's ledger is open)
          // know a new entry landed so it re-pulls its rows.
          setJournals((prev) => prev.map((row) => (row._id === updatedJournal._id ? updatedJournal : row)));
          if (ledgerJournalId === updatedJournal._id) {
            setLedgerRefreshKey((k) => k + 1);
          }
        }}
      />

      {/* ── Full-bleed table, edge to edge ───────────────────────────── */}
      <div
        className="fixed right-0 overflow-x-auto overflow-y-auto bg-white"
        style={{ left: "var(--sidebar-width, 0px)", bottom: 64, top: 173 }}
      >
        <table className="min-w-full divide-y divide-gray-200 table-fixed">
          <thead className="bg-[#F5F7FA] sticky top-0 z-20">
            <tr>
              <th
                style={{ width: colWidths.selection, position: "sticky", left: 0, zIndex: 20 }}
                className="relative px-4 py-3 bg-[#F5F7FA] border-b border-r border-[#E1E4EA]"
              >
                <div className="flex justify-center items-center">
                  <input type="checkbox" disabled className="w-4 h-4 text-blue-600 border-gray-300 rounded opacity-40" />
                </div>
                <ResizeHandle colId="selection" />
              </th>

              {orderedColumns.map((col) => {
                const isDragging = draggedColKey === col.id;
                const isDragOver = dragOverColKey === col.id && draggedColKey && draggedColKey !== col.id;
                const boundaryShadowSide = boundaryShadowSideFor(col.id);
                return (
                  <th
                    key={col.id}
                    data-col-id={col.id}
                    onMouseDown={(e) => startColumnDrag(e, col.id)}
                    title="Drag to move this column"
                    style={{ width: colWidths[col.id], opacity: isDragging ? 0.35 : 1, ...stickyStyleFor(col.id) }}
                    className={`relative px-4 py-3 text-left text-xs font-bold text-[#525866] uppercase tracking-wider whitespace-nowrap border-b border-r border-[#E1E4EA] transition-colors ${
                      isDragOver ? "bg-blue-100" : "bg-[#F5F7FA] hover:bg-[#EDF0F5]"
                    } ${draggedColKey ? "cursor-grabbing" : "cursor-grab"} active:cursor-grabbing`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate flex-1">{col.label}</span>
                      {pinnedCols[col.id] && <Pin className="w-3 h-3 text-[#0085FF] flex-shrink-0" />}
                      <button
                        onClick={(e) => openColumnMenu(e, col.id)}
                        title="Column options"
                        className="p-1 rounded hover:bg-gray-200 transition-colors text-gray-500 flex-shrink-0"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <ResizeHandle colId={col.id} />
                    {boundaryShadowSide && <div style={getPinnedBoundaryOverlayStyle(boundaryShadowSide)} />}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="bg-white">
            {loading ? (
              <TableSkeletonRows
                numRows={journalsPagination.limit}
                columns={orderedColumns.map((c) => colWidths[c.id])}
                hasCheckbox
                checkboxWidth={colWidths.selection}
              />
            ) : filteredJournals.length === 0 ? (
              <tr>
                <td colSpan={orderedColumns.length + 1} className="px-6 py-20 text-center">
                  <BookOpen className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                  <p className="text-sm font-medium text-gray-500">
                    {searchTerm ? "No journals match your search." : "No journals yet."}
                  </p>
                  {!searchTerm && (
                    <p className="text-xs text-gray-400 mt-1.5 max-w-sm mx-auto">
                      Click "New Journal" to add one.
                    </p>
                  )}
                </td>
              </tr>
            ) : (
              paginatedJournals.map((j) => (
                <tr key={j._id} className="bg-white hover:bg-blue-50 transition-colors">
                  <td
                    style={{ width: colWidths.selection, position: "sticky", left: 0, zIndex: 10 }}
                    className="px-4 py-3 align-middle border-b border-r border-[#E1E4EA] bg-inherit"
                  >
                    <div className="flex justify-center items-center">
                      <input type="checkbox" disabled className="w-4 h-4 text-blue-600 border-gray-300 rounded opacity-40" />
                    </div>
                  </td>

                  {orderedColumns.map((col, colIdx) => {
                    const isRightmost = colIdx === orderedColumns.length - 1;
                    const cellBoundaryShadowSide = boundaryShadowSideFor(col.id);
                    return (
                      <td
                        key={col.id}
                        style={{ width: colWidths[col.id], ...stickyStyleFor(col.id) }}
                        className={`px-4 py-3 text-sm text-gray-900 border-b border-r border-[#E1E4EA] last:border-r-0 bg-inherit whitespace-nowrap ${
                          cellBoundaryShadowSide ? "" : "overflow-hidden"
                        }`}
                      >
                        {renderCell(col.id, j, isRightmost)}
                        {cellBoundaryShadowSide && <div style={getPinnedBoundaryOverlayStyle(cellBoundaryShadowSide)} />}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination bar — edge-to-edge, same shape as PaymentsTimeline.jsx ── */}
      <div
        className="fixed bottom-0 right-0 h-16 bg-white border-t border-[#E1E4EA] flex items-center justify-between px-6 z-40"
        style={{ left: "var(--sidebar-width, 0px)" }}
      >
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-700">
            Showing{" "}
            <span className="font-semibold">
              {journalsTotalCount === 0 ? 0 : (journalsPagination.currentPage - 1) * journalsPagination.limit + 1}
            </span>{" "}to{" "}
            <span className="font-semibold">
              {Math.min(journalsPagination.currentPage * journalsPagination.limit, journalsTotalCount)}
            </span>{" "}of{" "}
            <span className="font-semibold">{journalsTotalCount}</span> journals
          </p>
          <select
            value={journalsPagination.limit}
            onChange={(e) => handleJournalsLimitChange(parseInt(e.target.value))}
            className="border border-gray-300 rounded-md text-sm py-1 pl-2 pr-6 focus:outline-none focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF]"
          >
            {[10, 20, 50, 100].map((val) => (
              <option key={val} value={val}>{val} per page</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleJournalsPageChange(journalsPagination.currentPage - 1)}
            disabled={journalsPagination.currentPage <= 1}
            className="flex items-center justify-center w-8 h-8 rounded-full border border-[#E1E4EA] bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {(() => {
            const commitPage = () => {
              const val = parseInt(journalsPageInput, 10);
              if (!isNaN(val) && val >= 1 && val <= journalsTotalPages) {
                handleJournalsPageChange(val);
              }
              setEditingJournalsPage(false);
            };
            const { currentPage } = journalsPagination;
            const items = [];
            if (journalsTotalPages <= 1) {
              items.push(1);
            } else {
              items.push(1);
              if (currentPage > 2) items.push("left-dots");
              if (currentPage !== 1 && currentPage !== journalsTotalPages) items.push(currentPage);
              if (currentPage < journalsTotalPages - 1) items.push("right-dots");
              items.push(journalsTotalPages);
            }
            return items.map((item, index) => {
              if (item === "left-dots" || item === "right-dots") {
                return (
                  <span key={`${item}-${index}`} className="flex items-center justify-center w-8 h-8 text-sm font-medium text-gray-400 select-none">
                    ....
                  </span>
                );
              }
              const isCurrent = item === currentPage;
              if (isCurrent && editingJournalsPage) {
                return (
                  <input
                    key="page-edit"
                    autoFocus
                    type="number"
                    min={1}
                    max={journalsTotalPages}
                    value={journalsPageInput}
                    onChange={(e) => setJournalsPageInput(e.target.value)}
                    onBlur={commitPage}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitPage();
                      if (e.key === "Escape") setEditingJournalsPage(false);
                    }}
                    className="w-10 h-8 rounded-full border border-blue-500 text-center text-sm font-medium text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                );
              }
              return (
                <button
                  key={`page-${item}`}
                  onClick={() => handleJournalsPageChange(item)}
                  onDoubleClick={() => {
                    if (isCurrent) {
                      setJournalsPageInput(String(currentPage));
                      setEditingJournalsPage(true);
                    }
                  }}
                  title={isCurrent ? "Double-click to type a page number" : undefined}
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    isCurrent ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {item}
                </button>
              );
            });
          })()}

          <button
            onClick={() => handleJournalsPageChange(journalsPagination.currentPage + 1)}
            disabled={journalsPagination.currentPage >= journalsTotalPages}
            className="flex items-center justify-center w-8 h-8 rounded-full border border-[#E1E4EA] bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Column header menu ───────────────────────────────────────── */}
      {openColumnMenuKey && columnMenuPos && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={closeColumnMenu} />
          <div
            className="fixed w-[220px] bg-white rounded-xl shadow-lg border border-[#E1E4EA] py-1 z-[9999]"
            style={{ top: columnMenuPos.top, left: columnMenuPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const col = ALL_COLUMNS.find((c) => c.id === openColumnMenuKey);
              if (!col) return null;
              const itemClass = "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors";
              return (
                <>
                  <button
                    onClick={() => { closeColumnMenu(); setColumnPin(col.id, "left"); }}
                    className={`${itemClass} ${pinnedCols[col.id] === "left" ? "bg-blue-50 text-blue-700 font-medium" : "text-[#161618] hover:bg-gray-50"}`}
                  >
                    {pinnedCols[col.id] === "left" ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                    {pinnedCols[col.id] === "left" ? "Unpin from left" : "Pin left"}
                  </button>
                  <button
                    onClick={() => { closeColumnMenu(); setColumnPin(col.id, "right"); }}
                    className={`${itemClass} ${pinnedCols[col.id] === "right" ? "bg-blue-50 text-blue-700 font-medium" : "text-[#161618] hover:bg-gray-50"}`}
                  >
                    {pinnedCols[col.id] === "right" ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                    {pinnedCols[col.id] === "right" ? "Unpin from right" : "Pin right"}
                  </button>
                  <div className="w-full border-t border-[#F1F1F5] my-0.5" />
                  <button
                    onClick={() => { closeColumnMenu(); setSortConfig({ key: col.id, direction: "asc" }); }}
                    className={`${itemClass} ${sortConfig.key === col.id && sortConfig.direction === "asc" ? "bg-blue-50 text-blue-700 font-medium" : "text-[#161618] hover:bg-gray-50"}`}
                  >
                    <ChevronUp className="w-3.5 h-3.5" /> Sort Ascending
                  </button>
                  <button
                    onClick={() => { closeColumnMenu(); setSortConfig({ key: col.id, direction: "desc" }); }}
                    className={`${itemClass} ${sortConfig.key === col.id && sortConfig.direction === "desc" ? "bg-blue-50 text-blue-700 font-medium" : "text-[#161618] hover:bg-gray-50"}`}
                  >
                    <ChevronDown className="w-3.5 h-3.5" /> Sort Descending
                  </button>
                  <div className="w-full border-t border-[#F1F1F5] my-0.5" />
                  <button
                    onClick={() => { closeColumnMenu(); setHiddenCols((prev) => [...prev, col.id]); }}
                    className={`${itemClass} text-[#161618] hover:bg-gray-50`}
                  >
                    <EyeOff className="w-3.5 h-3.5" /> Hide Column
                  </button>
                </>
              );
            })()}
          </div>
        </>,
        document.body
      )}

      {/* ── Drag ghost ───────────────────────────────────────────────── */}
      {dragGhost && createPortal(
        <div
          ref={ghostElRef}
          style={{ position: "fixed", top: -9999, left: -9999, width: dragGhost.width, zIndex: 10000, pointerEvents: "none" }}
          className="flex flex-col bg-white rounded-lg shadow-2xl overflow-hidden"
        >
          <div className="px-4 py-3 bg-[#F5F7FA] border-b border-[#E1E4EA]" style={{ height: dragGhost.height }}>
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
    </div>
  );
}
