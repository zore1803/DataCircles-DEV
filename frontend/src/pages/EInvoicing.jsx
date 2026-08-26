import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Download,
  Edit2,
  Eye,
  EyeOff,
  MoreVertical,
  Pin,
  PinOff,
  Plug,
  Settings,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";

import API from "../services/api";
import Skeleton from "../components/common/Skeleton";
import TableSkeletonRows from "../components/common/TableSkeletonRows";
import { useTopLoadingSignal } from "../components/common/TopLoadingBar";
import FilterIcon from "../components/common/FilterIcon";
import SearchIcon from "../components/common/SearchIcon";
import AdvancedFilterPanel from "../components/common/AdvancedFilterPanel";
import ColumnSettingsPanel from "../components/ColumnSettingsPanel";
import { useColumnSettings } from "../hooks/useColumnSettings";
import { exportClientSide, formatINR } from "../utils/clientExport";
import HighlightText from "../components/common/HighlightText";
import { getPinnedBoundaryOverlayStyle } from "../utils/pinnedColumnShadow";
import useSearchOverlayOpen from "../hooks/useSearchOverlayOpen";

const getAncestorZoom = (el) => {
  let z = 1;
  let node = el;
  while (node && node.nodeType === 1) {
    const cz = parseFloat(getComputedStyle(node).zoom);
    if (cz && !Number.isNaN(cz)) z *= cz;
    node = node.parentElement;
  }
  return z || 1;
};

const columnHelper = createColumnHelper();

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "success", label: "Success", icon: CheckCircle2, badgeClass: "bg-green-100 text-green-700 border-transparent" },
  { key: "pending", label: "Pending", icon: Clock, badgeClass: "bg-yellow-100 text-yellow-700 border-transparent" },
  { key: "failed", label: "Failed", icon: XCircle, badgeClass: "bg-red-100 text-red-700 border-transparent" },
  { key: "cancelled", label: "Cancelled", icon: Ban, badgeClass: "bg-gray-100 text-gray-700 border-transparent" },
];

const statusBadge = (status) => {
  const t = STATUS_TABS.find((x) => x.key === (status || "").toLowerCase());
  return t?.badgeClass || "bg-gray-100 text-gray-700 border-transparent";
};

const DEFAULT_COLUMNS = [
  { key: "invoiceNumber", label: "Purchase Number", visible: true, order: 0, sortable: true },
  { key: "customer", label: "Vendor", visible: true, order: 1, sortable: true },
  { key: "amount", label: "Amount", visible: true, order: 2, sortable: true },
  { key: "status", label: "Status", visible: true, order: 3, sortable: true },
  { key: "date", label: "Date", visible: true, order: 4, sortable: true },
];

const EMPTY_LIST = [];

export default function EInvoicing() {
  const isSearchOverlayOpen = useSearchOverlayOpen();

  const [portalConnected, setPortalConnected] = useState(() => {
    try {
      return localStorage.getItem("einvoicing_portal_connected") === "true";
    } catch {
      return false;
    }
  });

  const [eInvoices, setEInvoices] = useState(EMPTY_LIST);
  const [loading, setLoading] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const showLoadingSkeleton = loading && eInvoices.length === 0 && !hasLoadedOnceRef.current;
  useTopLoadingSignal(loading);

  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef(null);

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState([]);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);

  const [pagination, setPagination] = useState({ currentPage: 1, limit: 50 });
  const [editingPage, setEditingPage] = useState(false);
  const [pageInput, setPageInput] = useState("");

  const [openRowActionsId, setOpenRowActionsId] = useState(null);
  const [rowActionsPos, setRowActionsPos] = useState(null);
  const rowActionsRef = useRef(null);

  const { columns, saveColumns, getVisibleColumns } = useColumnSettings("e-invoicing", DEFAULT_COLUMNS);

  const [sortConfig, setSortConfig] = useState({ key: "date", direction: "desc" });
  const [pinnedColumns, setPinnedColumns] = useState([]);
  const [openColumnMenuKey, setOpenColumnMenuKey] = useState(null);
  const [columnMenuPos, setColumnMenuPos] = useState(null);
  const columnMenuRef = useRef(null);
  const tableScrollRef = useRef(null);

  // Drag-and-drop column reorder state
  const [draggedColKey, setDraggedColKey] = useState(null);
  const [dragOverColKey, setDragOverColKey] = useState(null);
  const [dragGhost, setDragGhost] = useState(null);
  const dragOverRef = useRef(null);
  const ghostElRef = useRef(null);

  const [columnSizing, setColumnSizing] = useState({});

  const getPinSide = (key) => pinnedColumns.find((p) => p.key === key)?.side || null;
  const pinColumn = (key, side) =>
    setPinnedColumns((prev) => [...prev.filter((p) => p.key !== key), { key, side }]);
  const unpinColumn = (key) =>
    setPinnedColumns((prev) => prev.filter((p) => p.key !== key));

  const visibleColumns = useMemo(() => {
    return getVisibleColumns ? getVisibleColumns() : columns.filter((c) => c.visible);
  }, [columns, getVisibleColumns]);

  // Debounce search
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Fetch e-invoices
  useEffect(() => {
    const fetchEInvoices = async () => {
      setLoading(true);
      try {
        const res = await API.get("/e-invoices");
        setEInvoices(res.data || EMPTY_LIST);
      } catch (err) {
        console.error("Error fetching e-invoices:", err);
        toast.error("Failed to load e-invoices");
      } finally {
        setLoading(false);
        hasLoadedOnceRef.current = true;
      }
    };
    fetchEInvoices();
  }, []);

  // Click-outside
  useEffect(() => {
    const handle = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) setIsMoreMenuOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Close menus on scroll/click-outside
  useEffect(() => {
    if (!openRowActionsId && !openColumnMenuKey) return;
    const close = (e) => {
      if (e.type === "keydown" && !["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(e.key)) return;
      setOpenRowActionsId(null);
      setRowActionsPos(null);
      setOpenColumnMenuKey(null);
      setColumnMenuPos(null);
    };
    window.addEventListener("wheel", close, { passive: true, capture: true });
    window.addEventListener("touchmove", close, { passive: true, capture: true });
    window.addEventListener("keydown", close, true);
    return () => {
      window.removeEventListener("wheel", close, { capture: true });
      window.removeEventListener("touchmove", close, { capture: true });
      window.removeEventListener("keydown", close, true);
    };
  }, [openRowActionsId, openColumnMenuKey]);

  // Filtered + sorted data
  const filteredEInvoices = useMemo(() => {
    let rows = eInvoices;
    if (debouncedSearchTerm) {
      const q = debouncedSearchTerm.toLowerCase();
      rows = rows.filter((r) =>
        [r.invoiceNumber, r.customer?.name, r.ackNo, r.irn]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }
    if (activeFilters.length > 0) {
      rows = rows.filter((r) =>
        activeFilters.every((f) => {
          const val = (r[f.field] ?? "").toString().toLowerCase();
          const target = (f.value ?? "").toString().toLowerCase();
          if (f.operator === "equals") return val === target;
          if (f.operator === "not_equals") return val !== target;
          if (f.operator === "contains") return val.includes(target);
          if (f.operator === "not_contains") return !val.includes(target);
          return true;
        })
      );
    }
    return rows;
  }, [eInvoices, debouncedSearchTerm, activeFilters]);

  const totalPages = Math.max(1, Math.ceil(filteredEInvoices.length / pagination.limit));
  const currentPage = Math.min(pagination.currentPage, totalPages);
  const pageRows = filteredEInvoices.slice(
    (currentPage - 1) * pagination.limit,
    currentPage * pagination.limit
  );

  const sortedEInvoices = pageRows;

  // Helper to get field value from a row
  const getFieldValue = (row, key) => {
    if (key === "customer") return row.customer?.name || "—";
    if (key === "amount") return row.amount || 0;
    if (key === "date") return row.date ? new Date(row.date).toLocaleDateString("en-IN") : "—";
    return row[key] || "—";
  };

  // ── TanStack React Table setup (matches Purchases/Companies) ────────
  const leftPinnedKeys = pinnedColumns.filter((p) => p.side === "left").map((p) => p.key);
  const rightPinnedKeys = pinnedColumns.filter((p) => p.side === "right").map((p) => p.key);
  const leftPinnedFields = visibleColumns.filter((vc) => leftPinnedKeys.includes(vc.key));
  const rightPinnedFields = visibleColumns.filter((vc) => rightPinnedKeys.includes(vc.key));
  const unpinnedFields = visibleColumns.filter(
    (vc) => !leftPinnedKeys.includes(vc.key) && !rightPinnedKeys.includes(vc.key),
  );
  const orderedFields = [...leftPinnedFields, ...unpinnedFields, ...rightPinnedFields];

  const tableColumns = useMemo(() => {
    const cols = [];

    // Checkbox column
    cols.push(
      columnHelper.display({
        id: "selection",
        size: 50,
        header: () => <div className="w-full flex justify-center"><input type="checkbox" disabled className="w-4 h-4 rounded border-gray-300" /></div>,
        cell: () => <div className="w-full flex justify-center"><input type="checkbox" disabled className="w-4 h-4 rounded border-gray-300" /></div>,
      })
    );

    orderedFields.forEach((vc) => {
      cols.push(
        columnHelper.accessor((row) => getFieldValue(row, vc.key), {
          id: vc.key,
          size: vc.key === "invoiceNumber" ? 220 : vc.key === "customer" ? 220 : 150,
          header: () => {
            const isSortable = vc.sortable !== false;
            const pinSide = getPinSide(vc.key);
            const isMenuOpen = openColumnMenuKey === vc.key;

            return (
              <div className="flex items-center justify-between w-full group">
                <span className="truncate flex-1 min-w-0 flex items-center gap-1.5" title={vc.label}>
                  <span className="truncate">{vc.label}</span>
                  {pinSide && (
                    <Pin size={12} className="text-blue-500 fill-blue-500 flex-shrink-0" style={{ transform: "rotate(45deg)" }} />
                  )}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isMenuOpen) {
                      setOpenColumnMenuKey(null);
                      setColumnMenuPos(null);
                      return;
                    }
                    const zMenu = getAncestorZoom(document.body);
                    const MENU_W = 160;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const boundsRight = tableScrollRef.current?.getBoundingClientRect().right ?? window.innerWidth;
                    let calcLeft = rect.right / zMenu - MENU_W;
                    calcLeft = Math.min(calcLeft, boundsRight / zMenu - MENU_W - 8);
                    calcLeft = Math.max(calcLeft, 8);
                    setColumnMenuPos({ top: rect.bottom / zMenu + 4, left: calcLeft });
                    setOpenColumnMenuKey(vc.key);
                  }}
                  className="p-1 rounded hover:bg-gray-200 transition-colors text-gray-500 flex-shrink-0"
                  title="Column options"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {isMenuOpen && columnMenuPos && createPortal(
                  <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => { setOpenColumnMenuKey(null); setColumnMenuPos(null); }} />
                    <div
                      ref={columnMenuRef}
                      style={{ position: "fixed", top: columnMenuPos.top, left: columnMenuPos.left }}
                      className="w-[160px] z-[9999] bg-white border border-[#E5E5EC] rounded-lg shadow-[7px_24px_24px_-7px_rgba(0,0,0,0.25)] p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in duration-150 origin-top-right"
                    >
                      <button
                        onClick={() => {
                          setOpenColumnMenuKey(null); setColumnMenuPos(null);
                          pinSide === "left" ? unpinColumn(vc.key) : pinColumn(vc.key, "left");
                        }}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal whitespace-nowrap ${pinSide === "left" ? "bg-blue-50 text-blue-700" : "text-[#161618] hover:bg-gray-50"}`}
                      >
                        {pinSide === "left" ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5 text-[#1C1B1F]" />}
                        Pin to Left
                      </button>
                      <button
                        onClick={() => {
                          setOpenColumnMenuKey(null); setColumnMenuPos(null);
                          pinSide === "right" ? unpinColumn(vc.key) : pinColumn(vc.key, "right");
                        }}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal whitespace-nowrap ${pinSide === "right" ? "bg-blue-50 text-blue-700" : "text-[#161618] hover:bg-gray-50"}`}
                      >
                        {pinSide === "right" ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5 text-[#1C1B1F]" />}
                        Pin to Right
                      </button>

                      {isSortable && (
                        <>
                          <button
                            onClick={() => {
                              setOpenColumnMenuKey(null); setColumnMenuPos(null);
                              setSortConfig({ key: vc.key, direction: "asc" });
                              setPagination((p) => ({ ...p, currentPage: 1 }));
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal text-[#161618] hover:bg-gray-50 whitespace-nowrap"
                          >
                            <ChevronUp className="w-3.5 h-3.5 text-[#1C1B1F]" />
                            Sort Ascending
                          </button>
                          <button
                            onClick={() => {
                              setOpenColumnMenuKey(null); setColumnMenuPos(null);
                              setSortConfig({ key: vc.key, direction: "desc" });
                              setPagination((p) => ({ ...p, currentPage: 1 }));
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal text-[#161618] hover:bg-gray-50 whitespace-nowrap"
                          >
                            <ChevronDown className="w-3.5 h-3.5 text-[#1C1B1F]" />
                            Sort Descending
                          </button>
                        </>
                      )}

                      <div className="w-full border-t border-[#F1F1F5] my-0.5" />

                      <button
                        onClick={() => {
                          setOpenColumnMenuKey(null); setColumnMenuPos(null);
                          saveColumns(columns.map((c) => (c.key === vc.key ? { ...c, visible: false } : c)));
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal text-[#161618] hover:bg-gray-50 whitespace-nowrap"
                      >
                        <EyeOff className="w-3.5 h-3.5 text-[#1C1B1F]" />
                        Hide Column
                      </button>
                    </div>
                  </>,
                  document.body
                )}
              </div>
            );
          },
          cell: ({ row }) => {
            const r = row.original;
            const key = vc.key;
            switch (key) {
              case "invoiceNumber":
                return (
                  <span className="text-[#0085FF] font-semibold">
                    <HighlightText text={r.invoiceNumber || "—"} query={debouncedSearchTerm} />
                  </span>
                );
              case "customer":
                return <HighlightText text={r.customer?.name || "—"} query={debouncedSearchTerm} />;
              case "amount":
                return <span className="font-medium">{formatINR(r.amount || 0)}</span>;
              case "status":
                return (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadge(r.status)}`}>
                    {r.status || "—"}
                  </span>
                );
              case "date":
                return r.date ? new Date(r.date).toLocaleDateString("en-IN") : "—";
              default:
                return r[key] || "—";
            }
          },
        })
      );
    });

    // Row actions column
    cols.push(
      columnHelper.display({
        id: "actions",
        size: 50,
        header: () => null,
        cell: ({ row }) => {
          const r = row.original;
          const id = r._id || r.id;
          return (
            <button
              onClick={(e) => openRowActions(e, id)}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              title="More actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          );
        },
      })
    );

    return cols;
  }, [orderedFields, openColumnMenuKey, columnMenuPos, pinnedColumns, columns, debouncedSearchTerm, sortConfig]);

  const table = useReactTable({
    data: sortedEInvoices,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    onColumnSizingChange: setColumnSizing,
    state: { columnSizing },
  });

  // ── Drag-and-drop column reordering ─────────────────────────────────
  const startColumnDrag = (e, colId) => {
    if (e.button !== 0) return;
    if (e.target.closest("button") || e.target.closest("[data-resize-handle]")) return;

    const th = e.currentTarget;
    const startX = e.clientX;
    const startY = e.clientY;
    const DRAG_THRESHOLD = 5;
    const dragState = { started: false, offsetX: 0, offsetY: 0, zGhost: 1 };

    const positionGhost = (clientX, clientY) => {
      const el = ghostElRef.current;
      if (!el) return;
      el.style.top = `${(clientY - dragState.offsetY) / dragState.zGhost}px`;
      el.style.left = `${(clientX - dragState.offsetX) / dragState.zGhost}px`;
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
      const label = visibleColumns.find((vc) => vc.key === colId)?.label || colId;
      const previewRows = sortedEInvoices.map((r) => String(getFieldValue(r, colId) ?? "").trim() || "—");
      dragState.zGhost = getAncestorZoom(document.body);
      dragState.offsetX = startX - rect.left;
      dragState.offsetY = startY - rect.top;
      dragOverRef.current = null;
      setDraggedColKey(colId);
      setDragOverColKey(null);
      document.body.style.userSelect = "none";
      setDragGhost({ label, previewRows, width: rect.width / dragState.zGhost, height: rect.height / dragState.zGhost });
      requestAnimationFrame(() => positionGhost(startX, startY));
    };

    const handleMouseMove = (moveEvent) => {
      if (!dragState.started) {
        if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < DRAG_THRESHOLD) return;
        e.preventDefault();
        beginDrag();
      }
      positionGhost(moveEvent.clientX, moveEvent.clientY);
      updateDragOver(moveEvent.clientX, moveEvent.clientY);
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

  const handleColumnReorder = (draggedKey, targetKey) => {
    if (!draggedKey || draggedKey === targetKey) return;
    const sorted = [...columns].sort((a, b) => a.order - b.order);
    const visSorted = sorted.filter((c) => c.visible);
    const draggedIdx = visSorted.findIndex((c) => c.key === draggedKey);
    const targetIdx = visSorted.findIndex((c) => c.key === targetKey);
    if (draggedIdx === -1 || targetIdx === -1) return;
    const reordered = [...visSorted];
    const [moved] = reordered.splice(draggedIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    let cursor = 0;
    const newColumns = sorted
      .map((c) => (c.visible ? reordered[cursor++] : c))
      .map((c, idx) => ({ ...c, order: idx }));
    saveColumns(newColumns);
  };

  // ── Handlers ───────────────────────────────────────────────────────
  const handleConnectPortal = () => {
    if (portalConnected) {
      if (!window.confirm("Disconnect from the E-Invoicing Portal?")) return;
      localStorage.setItem("einvoicing_portal_connected", "false");
      setPortalConnected(false);
      toast.success("Disconnected from E-Invoicing Portal");
    } else {
      toast("Portal connection flow is coming soon.", { icon: "🔌" });
    }
  };

  const openRowActions = (e, id) => {
    e.stopPropagation();
    const zMenu = getAncestorZoom(document.body);
    const MENU_W = 160;
    const MENU_H = 184;
    const MARGIN = 8;
    const rect = e.currentTarget.getBoundingClientRect();
    const viewportH = window.innerHeight / zMenu;
    const viewportW = window.innerWidth / zMenu;
    const top = rect.bottom / zMenu + 4;
    const openUp = viewportH - top < MENU_H + MARGIN;
    let calcTop = openUp ? rect.top / zMenu - 4 - MENU_H : top;
    calcTop = Math.max(MARGIN, Math.min(calcTop, viewportH - MENU_H - MARGIN));
    let calcLeft = rect.right / zMenu - MENU_W;
    calcLeft = Math.min(calcLeft, viewportW - MENU_W - MARGIN);
    calcLeft = Math.max(calcLeft, MARGIN);
    setRowActionsPos({ top: calcTop, left: calcLeft });
    setOpenRowActionsId(id);
  };

  const closeRowActions = () => { setOpenRowActionsId(null); setRowActionsPos(null); };

  const soon = (label) => () => {
    toast(`${label} — coming soon.`, { icon: "🚧" });
    closeRowActions();
  };

  const EXPORT_COLUMNS = [
    { label: "Invoice #", value: (r) => r.invoiceNumber || "" },
    { label: "Customer", value: (r) => r.customer?.name || "" },
    { label: "Amount", value: (r) => formatINR(r.amount || 0) },
    { label: "Status", value: (r) => r.status || "" },
    { label: "Date", value: (r) => (r.date ? new Date(r.date).toLocaleDateString("en-IN") : "") },
  ];

  const handleExport = (format) => {
    if (filteredEInvoices.length === 0) {
      toast.error("Nothing to export — the current view is empty.");
      return;
    }
    exportClientSide(format, {
      rows: filteredEInvoices,
      columns: EXPORT_COLUMNS,
      fileNamePrefix: "e_invoices_export",
      title: "E-Invoices Report",
    });
    setIsMoreMenuOpen(false);
  };

  const filterColumns = [
    { key: "invoiceNumber", label: "Invoice #", type: "text" },
    { key: "status", label: "Status", type: "select", options: STATUS_TABS.filter((t) => t.key !== "all").map((t) => t.key) },
    { key: "customer", label: "Customer", type: "text" },
  ];

  // Pagination controls — same as PurchasePage
  const PaginationControls = () => (
    <div className="flex items-center justify-between w-full px-4 lg:px-6">
      <div className="text-xs text-gray-500 font-inter">
        Showing{" "}
        <span className="font-semibold text-gray-800">{filteredEInvoices.length > 0 ? (currentPage - 1) * pagination.limit + 1 : 0}</span>
        {" "}to{" "}
        <span className="font-semibold text-gray-800">{Math.min(currentPage * pagination.limit, filteredEInvoices.length)}</span>
        {" "}of{" "}
        <span className="font-semibold text-gray-800">{filteredEInvoices.length}</span>
        {" "}results
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <select
            value={pagination.limit}
            onChange={(e) => setPagination({ currentPage: 1, limit: Number(e.target.value) })}
            className="appearance-none h-9 pl-3 pr-8 text-sm font-medium bg-white border border-[#E1E4EA] rounded-lg text-gray-700 focus:outline-none focus:border-[#0085FF] cursor-pointer"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>{n} per page</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

        <button
          onClick={() => setPagination((p) => ({ ...p, currentPage: Math.max(1, currentPage - 1) }))}
          disabled={currentPage <= 1}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#E1E4EA] text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((p) => (
          <button
            key={p}
            onClick={() => setPagination((prev) => ({ ...prev, currentPage: p }))}
            className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium ${
              p === currentPage
                ? "bg-[#0085FF] text-white"
                : "border border-[#E1E4EA] text-gray-600 hover:bg-gray-50"
            }`}
          >
            {p}
          </button>
        ))}

        <button
          onClick={() => setPagination((p) => ({ ...p, currentPage: Math.min(totalPages, currentPage + 1) }))}
          disabled={currentPage >= totalPages}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#E1E4EA] text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="-mt-6 -mx-4 sm:-mx-6 lg:-mx-8 pt-4">
      {/* ── Column Settings Panel ──────────────────────────────────── */}
      <ColumnSettingsPanel
        isOpen={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        columns={columns}
        onSave={saveColumns}
        moduleName="E-Invoices"
      />

      {/* ── Fixed header toolbar — edge-to-edge, matches PurchasePage ──*/}
      <div
        className="fixed right-0 h-16 px-4 lg:px-6 border-b bg-white border-[#E1E4EA] flex items-center top-[54px] lg:top-16"
        style={{ left: "var(--sidebar-width, 0px)", zIndex: 40, minHeight: "64px", maxHeight: "64px", boxSizing: "border-box" }}
      >
        <div className="flex items-center gap-2 lg:gap-4 w-full h-full">
          <div className={`flex-shrink-0 flex flex-col justify-center gap-1.5 overflow-hidden transition-all duration-300 ease-in-out lg:!w-auto lg:!opacity-100 ${isSearchExpanded ? "w-0 opacity-0" : "w-[190px] opacity-100"}`}>
            {showLoadingSkeleton ? (
              <>
                <Skeleton width={110} height={18} />
                <Skeleton width={170} height={12} />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h1 className="m-0 leading-tight font-bold text-base sm:text-lg text-gray-900 truncate">E-Invoices</h1>
                </div>
                <p className="m-0 leading-tight text-[10px] sm:text-xs text-gray-500 font-inter truncate">
                  Create, manage, and track your GST e-invoices
                </p>
              </>
            )}
          </div>

          {showLoadingSkeleton ? (
            <div className="relative flex-1 flex items-center justify-end gap-3">
              <Skeleton width={40} height={40} shape="circle" />
              <Skeleton width={40} height={40} shape="circle" />
              <Skeleton width={150} height={40} shape="circle" />
            </div>
          ) : (
            <>
              {/* Search (expandable circle → pill) */}
              <div className="relative flex-1 min-w-0 flex items-center justify-end">
                <div
                  className={`relative h-10 flex items-center border border-[#E1E4EA] rounded-full bg-white transition-all duration-300 ease-in-out hover:bg-gray-50 focus-within:border-[#0085FF] focus-within:hover:bg-white ${isSearchExpanded ? "w-full lg:w-[416px]" : "w-10"} max-w-full`}
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
                    onBlur={() => { if (!searchTerm) setIsSearchExpanded(false); }}
                    placeholder="Search by invoice #, customer..."
                    className={`w-full h-full pl-9 pr-9 bg-transparent text-sm focus:outline-none transition-opacity duration-200 font-inter cursor-pointer ${isSearchExpanded ? "opacity-100 focus:cursor-text" : "opacity-0"}`}
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

              {/* Actions group */}
              <div className="relative flex items-center gap-2 lg:gap-4 flex-shrink-0">
                {/* Advanced filter button */}
                <button
                  onClick={() => setShowAdvancedFilters(true)}
                  className={`hidden lg:flex relative items-center justify-center w-10 h-10 rounded-full border transition-colors bg-white ${
                    activeFilters.length > 0
                      ? "border-[#0085FF] text-[#0085FF]"
                      : "border-[#E1E4EA] text-gray-500 hover:bg-gray-50"
                  }`}
                  title="Filters"
                >
                  <FilterIcon size={15} className={activeFilters.length > 0 ? "text-[#0085FF]" : "text-gray-800"} />
                  {activeFilters.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#0085FF] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {activeFilters.length}
                    </span>
                  )}
                </button>

                {/* Overflow menu */}
                <div className="relative" ref={moreMenuRef}>
                  <button
                    onClick={() => setIsMoreMenuOpen((prev) => !prev)}
                    className="relative flex items-center justify-center w-10 h-10 rounded-full border border-[#E1E4EA] text-gray-800 hover:bg-gray-50 transition-colors"
                    title="More options"
                  >
                    <MoreVertical strokeWidth={2.5} className="w-4 h-4" />
                  </button>
                  {isMoreMenuOpen && (
                    <div className="absolute right-0 z-50 mt-2 w-52 bg-white border border-gray-100 rounded-xl shadow-xl py-2 animate-in fade-in zoom-in duration-200 origin-top-right">
                      <button
                        onClick={() => { setShowAdvancedFilters(true); setIsMoreMenuOpen(false); }}
                        className="lg:hidden w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <FilterIcon size={14} className="text-gray-400" />
                        Filters
                        {activeFilters.length > 0 && (
                          <span className="ml-auto bg-blue-100 text-blue-600 text-xs font-bold px-1.5 py-0.5 rounded-full">
                            {activeFilters.length}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => { toast("Import — coming soon.", { icon: "🚧" }); setIsMoreMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Upload className="w-4 h-4 text-gray-400" />
                        Import
                      </button>
                      <button
                        onClick={() => handleExport("excel")}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Download className="w-4 h-4 text-gray-400" />
                        Export as Excel
                      </button>
                      <button
                        onClick={() => handleExport("pdf")}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Download className="w-4 h-4 text-gray-400" />
                        Export as PDF
                      </button>
                      <button
                        onClick={() => { setShowColumnSettings(true); setIsMoreMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Settings className="w-4 h-4 text-gray-400" />
                        Columns
                      </button>
                    </div>
                  )}
                </div>

                {/* Primary action — Connect to Portal */}
                <button
                  onClick={handleConnectPortal}
                  className={`inline-flex items-center justify-center gap-2 h-10 w-10 lg:w-auto px-0 lg:px-4 text-sm font-medium rounded-full focus:outline-none cursor-pointer transition-colors flex-shrink-0 ${
                    portalConnected
                      ? "bg-green-50 text-green-700 hover:bg-green-100"
                      : "bg-[#0085FF] text-white hover:bg-blue-600"
                  }`}
                  title={portalConnected ? "Portal Connected" : "Connect to E-Invoicing Portal"}
                >
                  {portalConnected ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      <span className="hidden lg:inline">Portal Connected</span>
                    </>
                  ) : (
                    <>
                      <Plug className="w-4 h-4 flex-shrink-0" />
                      <span className="hidden lg:inline">Connect Portal</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Edge-to-edge scrollable table area ─────────────────────── */}
      <div
        ref={tableScrollRef}
        className="overflow-x-auto overflow-y-auto top-[118px] lg:top-[128px]"
        style={{
          position: "fixed",
          left: "var(--sidebar-width, 0px)",
          right: 0,
          bottom: !showLoadingSkeleton ? 64 : 0,
        }}
      >
        <div className={`relative bg-white border-r border-[#E1E4EA] ${showLoadingSkeleton || eInvoices.length > 0 ? "border-b" : ""}`}>
          <table
            className="w-full border-separate border-spacing-0 text-left"
            style={{ minWidth: `${table.getTotalSize()}px`, tableLayout: "fixed" }}
          >
            {(() => {
              const allHeaders = table.getHeaderGroups()[0]?.headers || [];
              const leftPinnedInOrder = allHeaders.map((h) => h.column.id).filter((id) => leftPinnedKeys.includes(id));
              const rightPinnedInOrder = allHeaders.map((h) => h.column.id).filter((id) => rightPinnedKeys.includes(id));
              const lastLeftPinnedKey = leftPinnedInOrder.length > 0 ? leftPinnedInOrder[leftPinnedInOrder.length - 1] : null;
              const firstRightPinnedKey = rightPinnedInOrder.length > 0 ? rightPinnedInOrder[0] : null;

              const pinnedLeftOffsets = {};
              let cumLeft = 0;
              allHeaders.forEach((h) => {
                const isLeftStickyCol = h.column.id === "selection" || leftPinnedKeys.includes(h.column.id);
                if (isLeftStickyCol) {
                  pinnedLeftOffsets[h.column.id] = cumLeft;
                  cumLeft += h.getSize();
                }
              });

              const pinnedRightOffsets = {};
              let cumRight = 0;
              [...allHeaders].reverse().forEach((h) => {
                if (rightPinnedKeys.includes(h.column.id)) {
                  pinnedRightOffsets[h.column.id] = cumRight;
                  cumRight += h.getSize();
                }
              });

              return (
                <>
                  <thead className="bg-[#F5F7FA] border-b border-[#E1E4EA] sticky top-0 z-30 select-none">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => {
                          const colId = header.column.id;
                          const isLeftSticky = colId === "selection" || leftPinnedKeys.includes(colId);
                          const isRightSticky = rightPinnedKeys.includes(colId);
                          const isSticky = isLeftSticky || isRightSticky;
                          const isLeftBoundary = colId === lastLeftPinnedKey;
                          const isRightBoundary = colId === firstRightPinnedKey;
                          const isDraggable = colId !== "selection" && colId !== "actions";
                          const isDragging = draggedColKey === colId;
                          const isDragOver = dragOverColKey === colId && draggedColKey && draggedColKey !== colId;

                          return (
                            <th
                              key={header.id}
                              data-col-id={colId}
                              onMouseDown={isDraggable ? (e) => startColumnDrag(e, colId) : undefined}
                              style={{
                                width: header.getSize(),
                                position: isSticky ? "sticky" : "relative",
                                left: isLeftSticky ? pinnedLeftOffsets[colId] ?? 0 : "auto",
                                right: isRightSticky ? pinnedRightOffsets[colId] ?? 0 : "auto",
                                zIndex: isSticky ? 20 : 1,
                              }}
                              className={`px-4 py-3 text-sm font-bold text-[#525866] border-r border-[#E1E4EA] last:border-r-0 transition-colors bg-[#F5F7FA] ${isDraggable ? "cursor-grab active:cursor-grabbing" : ""} ${isDragOver ? "bg-blue-100" : "hover:bg-gray-100"}`}
                            >
                              <div className="w-full min-w-0" style={{ opacity: isDragging ? 0.35 : 1 }}>
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </div>
                              {(isLeftBoundary || isRightBoundary) && (
                                <div style={getPinnedBoundaryOverlayStyle(isLeftBoundary ? "left" : "right")} />
                              )}
                              {colId !== "selection" && colId !== "actions" && header.column.getCanResize() && (
                                <div
                                  data-resize-handle="true"
                                  onMouseDown={(e) => { e.stopPropagation(); header.getResizeHandler()(e); }}
                                  onTouchStart={header.getResizeHandler()}
                                  className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none z-50 bg-transparent"
                                />
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    ))}
                  </thead>

                  <tbody className="bg-white">
                    {showLoadingSkeleton ? (
                      <TableSkeletonRows numRows={pagination.limit} columns={table.getVisibleLeafColumns().filter((c) => c.id !== "selection")} hasCheckbox />
                    ) : sortedEInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={table.getAllColumns().length} className="px-6 py-12 text-center text-gray-500 font-inter">
                          <EmptyState
                            hasSearch={!!debouncedSearchTerm || activeFilters.length > 0}
                            onClear={() => { setSearchTerm(""); setActiveFilters([]); }}
                            onConnect={handleConnectPortal}
                            portalConnected={portalConnected}
                          />
                        </td>
                      </tr>
                    ) : (
                      table.getRowModel().rows.map((row) => (
                        <tr key={row.id} className="bg-white hover:bg-blue-50 transition-colors">
                          {row.getVisibleCells().map((cell) => {
                            const colId = cell.column.id;
                            const isLeftSticky = colId === "selection" || leftPinnedKeys.includes(colId);
                            const isRightSticky = rightPinnedKeys.includes(colId);
                            const isSticky = isLeftSticky || isRightSticky;
                            const isLeftBoundary = colId === lastLeftPinnedKey;
                            const isRightBoundary = colId === firstRightPinnedKey;
                            const isColDragging = draggedColKey === colId;

                            return (
                              <td
                                key={cell.id}
                                style={{
                                  width: cell.column.getSize(),
                                  position: isSticky ? "sticky" : "static",
                                  left: isLeftSticky ? pinnedLeftOffsets[colId] ?? 0 : "auto",
                                  right: isRightSticky ? pinnedRightOffsets[colId] ?? 0 : "auto",
                                  zIndex: isSticky ? 10 : 1,
                                }}
                                className="px-4 py-2 align-middle text-sm text-[#1C1B1F] bg-inherit border-r border-b border-[#E1E4EA] last:border-r-0"
                              >
                                <div style={{ opacity: isColDragging ? 0.35 : 1 }}>
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </div>
                                {(isLeftBoundary || isRightBoundary) && (
                                  <div style={getPinnedBoundaryOverlayStyle(isLeftBoundary ? "left" : "right")} />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </>
              );
            })()}
          </table>
        </div>
      </div>

      {/* ── Drag ghost — portaled to body ──────────────────────────── */}
      {dragGhost && createPortal(
        <div
          ref={ghostElRef}
          style={{ position: "fixed", top: -9999, left: -9999, width: dragGhost.width, zIndex: 10000, pointerEvents: "none" }}
          className="flex flex-col bg-white rounded-lg shadow-2xl overflow-hidden"
        >
          <div className="px-4 py-3 bg-[#F5F7FA] border-b border-[#E1E4EA]" style={{ height: dragGhost.height }}>
            <span className="text-sm font-bold text-[#525866] truncate block">{dragGhost.label}</span>
          </div>
          {dragGhost.previewRows.slice(0, 5).map((rowVal, i) => (
            <div key={i} className="px-4 py-2 border-b border-[#F1F1F5] last:border-b-0">
              <span className="text-sm text-gray-700 truncate block">{rowVal}</span>
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* ── Row actions popover — portaled ─────────────────────────── */}
      {openRowActionsId && rowActionsPos && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={closeRowActions} />
          <div
            ref={rowActionsRef}
            style={{ position: "fixed", top: rowActionsPos.top, left: rowActionsPos.left }}
            className="w-[160px] z-[9999] bg-white border border-[#E5E5EC] rounded-lg shadow-[7px_24px_24px_-7px_rgba(0,0,0,0.25)] p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in duration-150 origin-top-right"
          >
            <button onClick={soon("View e-invoice")} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal text-[#161618] hover:bg-gray-50 whitespace-nowrap">
              <Eye className="w-3.5 h-3.5 text-[#1C1B1F]" /> View
            </button>
            <button onClick={soon("Edit e-invoice")} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal text-[#161618] hover:bg-gray-50 whitespace-nowrap">
              <Edit2 className="w-3.5 h-3.5 text-[#1C1B1F]" /> Edit
            </button>
            <button onClick={soon("Download")} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal text-[#161618] hover:bg-gray-50 whitespace-nowrap">
              <Download className="w-3.5 h-3.5 text-[#1C1B1F]" /> Download
            </button>
            <div className="w-full border-t border-[#F1F1F5] my-0.5" />
            <button onClick={soon("Delete e-invoice")} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal text-red-600 hover:bg-red-50 whitespace-nowrap">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </>,
        document.body
      )}

      {/* ── Fixed pagination bar ──────────────────────────────────── */}
      {!showLoadingSkeleton && (
        <div
          className={`fixed bottom-0 right-0 bg-white border-t border-[#E1E4EA] shadow-sm z-[9992] flex items-center ${isSearchOverlayOpen ? "pointer-events-none" : ""}`}
          style={{
            left: "var(--sidebar-width, 0px)",
            height: 64,
            filter: isSearchOverlayOpen ? "brightness(0.6)" : "none",
          }}
        >
          {PaginationControls()}
        </div>
      )}

      {/* ── Slide-in panels ────────────────────────────────────────── */}
      <AdvancedFilterPanel
        isOpen={showAdvancedFilters}
        onClose={() => setShowAdvancedFilters(false)}
        columns={filterColumns}
        filters={activeFilters}
        setFilters={setActiveFilters}
        onApply={(next) => {
          setActiveFilters(next);
          setPagination((p) => ({ ...p, currentPage: 1 }));
        }}
        title="Filter E-Invoices"
        subtitle="Narrow the list by any field"
        emptyStateText="Add a rule to narrow down your e-invoice list."
      />
    </div>
  );
}

function EmptyState({ hasSearch, onClear, onConnect, portalConnected }) {
  if (hasSearch) {
    return (
      <div className="flex flex-col items-center text-center py-8">
        <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-4">
          <Eye className="w-6 h-6 text-gray-300" />
        </div>
        <p className="text-sm font-semibold text-gray-800">No e-invoices match your filters</p>
        <p className="text-xs text-gray-500 mt-1 max-w-sm">
          Try removing a filter or clearing the search.
        </p>
        <button
          onClick={onClear}
          className="mt-4 px-4 py-2 text-xs font-semibold text-[#0085FF] hover:bg-[#0085FF]/5 rounded-full transition-colors"
        >
          Clear filters
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center text-center py-8">
      <div className="text-4xl mb-3">🧾</div>
      <p className="text-base font-semibold text-gray-800">No e-invoices yet</p>
      <p className="text-xs text-gray-500 mt-1 max-w-md">
        Once you connect your GST E-Invoicing Portal and register invoices, they'll show up here
        with their IRN, Ack No., and status.
      </p>
      {!portalConnected && (
        <button
          onClick={onConnect}
          className="mt-4 inline-flex items-center gap-2 h-10 px-5 bg-[#0085FF] hover:bg-[#0075E6] text-white text-sm font-semibold rounded-full transition-colors"
        >
          <Plug className="w-4 h-4" />
          Connect to E-Invoicing Portal
        </button>
      )}
    </div>
  );
}
