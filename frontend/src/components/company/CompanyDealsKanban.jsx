import React, { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
} from "@dnd-kit/core";
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getAncestorZoom } from "../../utils/domUtils";
import {
  Search,
  Filter,
  LayoutGrid,
  List as ListIcon,
  Plus,
  Gem,
  Clock,
  Handshake,
  Sparkles,
  ListChecks,
  CalendarClock,
  MoreHorizontal,
  MoreVertical,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Pin,
  PinOff,
  EyeOff,
  Eye,
  Edit2,
  Trash2,
  FileText,
  User,
  Tag,
  IndianRupee,
  Calendar,
} from "lucide-react";
import toast from "react-hot-toast";
import API from "../../services/api";
import QuickDealForm from "../deal/QuickDealForm";
import FilterIcon from "../common/FilterIcon";
import CompanyFilterPanel from "./CompanyFilterPanel";
import { applyColumnFilters } from "../../utils/advancedFilters";
import StatTileSkeleton from "../common/StatTileSkeleton";
import DealCardSkeleton from "../common/DealCardSkeleton";
import Skeleton from "../common/Skeleton";
import { formatNumberToIndian } from "../../utils/numberFormatter";

const AMOUNT_RANGES = [
  { label: "Under ₹10,000", test: (v) => v < 10000 },
  { label: "₹10,000 – ₹50,000", test: (v) => v >= 10000 && v < 50000 },
  { label: "₹50,000 – ₹1,00,000", test: (v) => v >= 50000 && v < 100000 },
  { label: "Above ₹1,00,000", test: (v) => v >= 100000 },
];

const getAmountRangeLabel = (amount) => {
  const num = Number(amount) || 0;
  return AMOUNT_RANGES.find((r) => r.test(num))?.label || "";
};

const daysAgo = (date) =>
  Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));

const DATE_RANGES = [
  { label: "Today", test: (d) => daysAgo(d) < 1 },
  { label: "This Week", test: (d) => daysAgo(d) < 7 },
  { label: "This Month", test: (d) => daysAgo(d) < 30 },
  { label: "Older", test: (d) => daysAgo(d) >= 30 },
];

const getDateRangeLabel = (date) => {
  if (!date) return "";
  return DATE_RANGES.find((r) => r.test(date))?.label || "";
};

const DEAL_FILTER_COLUMNS = (statuses) => [
  { key: "stage", label: "Stage", options: statuses },
  { key: "amount", label: "Amount", options: AMOUNT_RANGES.map((r) => r.label) },
  { key: "lastUpdated", label: "Last Updated", options: DATE_RANGES.map((r) => r.label) },
];

const getDealFieldValue = (deal, key) => {
  switch (key) {
    case "contact":
      return deal.contact?.name || "";
    case "stage":
      return deal.status || "";
    case "amount":
      return getAmountRangeLabel(deal.amount);
    case "lastUpdated":
      return getDateRangeLabel(deal.updatedAt);
    default:
      return deal[key];
  }
};

const TERMINAL_STATUSES = ["won", "lost"];

// The app scales its desktop layout via a dynamic CSS `zoom` on <html> (App.jsx).
// getBoundingClientRect() returns UNSCALED layout coordinates while portal overlays on
// document.body render in visual space, so rect-derived positions must be multiplied by
// this zoom factor to line up on screen.
const getRootZoom = () => {
  if (typeof window === "undefined") return 1;
  const z = parseFloat(getComputedStyle(document.documentElement).zoom);
  return z && !Number.isNaN(z) ? z : 1;
};

const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Wraps every case-insensitive occurrence of `query` inside `text` in a <mark>.
const HighlightText = ({ text, query }) => {
  const str = text === null || text === undefined ? "" : String(text);
  const q = (query || "").trim();
  if (!q) return <>{str}</>;

  const parts = str.split(new RegExp(`(${escapeRegExp(q)})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-yellow-200 text-inherit rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
};

const Avatar = ({ name, className = "" }) => (
  <div
    className={`w-[18px] h-[18px] rounded-full bg-gray-200 border border-white flex items-center justify-center text-[8px] font-semibold text-gray-600 flex-shrink-0 ${className}`}
    title={name}
  >
    {name?.charAt(0)?.toUpperCase() || "?"}
  </div>
);

// Card geometry/appearance lives here once so the sortable card and the drag
// overlay can never drift apart. Unchanged from the previous implementation.
const DEAL_CARD_BOX = {
  width: "300px",
  height: "132px",
  padding: "16px",
  gap: "16px",
  borderColor: "#E5E5EC",
};
const DEAL_CARD_CLASS =
  "box-border flex flex-col items-start bg-white border rounded-[10px] mb-3 hover:shadow-sm transition-shadow overflow-hidden";

// Inner markup only — no drag wiring, no navigation. Rendered by both shells below.
const DealCardContent = ({ deal }) => {
  const tagLabel = deal.company?.name || deal.company?.industry || deal.contact?.name;
  const avatarNames = [deal.contact?.name, deal.user?.name].filter(Boolean);

  return (
    <>
      <div className="flex flex-col items-start gap-2 w-full">
        <div className="flex items-center justify-between w-full">
          <span
            className="truncate"
            style={{ fontFamily: "Inter", fontWeight: 600, fontSize: "14px", lineHeight: "150%", letterSpacing: "-0.02em", color: "#161618" }}
          >
            {deal.title || "Deal Name"}
          </span>
          <MoreHorizontal className="w-4 h-4 text-[#BEBEC8] flex-shrink-0" />
        </div>
        <span
          className="w-full"
          style={{ fontFamily: "Inter", fontWeight: 500, fontSize: "14px", lineHeight: "150%", letterSpacing: "-0.02em", color: "#161618" }}
        >
          ₹{(deal.amount || 0).toLocaleString("en-IN")}
        </span>
      </div>

      <div className="w-full border-t border-[#F1F1F5]" />

      <div className="flex items-center gap-2 w-full">
        <div className="flex items-center justify-center w-[18px] h-[18px] rounded-[5px] bg-[#48494C] flex-shrink-0">
          <Building2 className="w-2.5 h-2.5 text-white" />
        </div>
        <span
          className="truncate flex-1"
          style={{ fontFamily: "Inter", fontWeight: 500, fontSize: "12px", lineHeight: "15px", letterSpacing: "-0.02em", color: "#161618" }}
        >
          {tagLabel || "—"}
        </span>
        {avatarNames.length > 0 && (
          <div className="flex items-center flex-shrink-0">
            {avatarNames.map((name, idx) => (
              <Avatar key={idx} name={name} className={idx > 0 ? "-ml-1" : ""} />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

// The in-list card. Still a <Link>, so a plain click navigates exactly as before —
// the sensor's 8px activation constraint means a click never starts a drag, and a
// drag never fires the link. `transition` (which useDraggable did not provide) is
// what lets neighbouring cards glide aside instead of snapping.
const DealCard = ({ deal }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: deal._id });

  const style = {
    ...DEAL_CARD_BOX,
    transform: CSS.Transform.toString(transform),
    transition,
    // The original stays in place, faded, while the overlay follows the cursor.
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Link
      to={`/deals/${deal._id}`}
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`${DEAL_CARD_CLASS} cursor-grab active:cursor-grabbing`}
    >
      <DealCardContent deal={deal} />
    </Link>
  );
};

// The floating preview. Deliberately a plain <div>, not a <Link>: it must never be
// clickable or navigable, and pointer-events-none keeps it from stealing hit-testing
// from the columns underneath it during the drag.
const DealCardOverlay = ({ deal }) => (
  <div
    style={{ ...DEAL_CARD_BOX, cursor: "grabbing" }}
    className={`${DEAL_CARD_CLASS} shadow-lg pointer-events-none`}
  >
    <DealCardContent deal={deal} />
  </div>
);

// Presentation ported verbatim from ModernKanbanColumn in pages/Deals.jsx so the
// company-profile Deals tab and the standalone /deals board look identical:
// same 340px shell, #F5F7FA header, pill counter, per-status tinted summary card
// and week-over-week trend badge.
const KanbanColumn = ({ status, deals, colorTheme = "blue", onAddClick, loading = false }) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const dealIds = useMemo(() => deals.map((d) => d._id), [deals]);

  const totalAmount = deals.reduce((sum, deal) => sum + (parseInt(deal.amount) || 0), 0);
  const formattedTotal = formatNumberToIndian(totalAmount);

  const trendPct = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const thisWeekStart = now - 7 * oneDay;
    const lastWeekStart = now - 14 * oneDay;
    const inRange = (deal, start, end) => {
      const t = new Date(deal.createdAt).getTime();
      return t >= start && t < end;
    };
    const sumAmount = (list) => list.reduce((sum, d) => sum + (parseInt(d.amount) || 0), 0);
    const thisWeek = sumAmount(deals.filter((d) => inRange(d, thisWeekStart, now)));
    const lastWeek = sumAmount(deals.filter((d) => inRange(d, lastWeekStart, thisWeekStart)));
    if (lastWeek === 0) return thisWeek === 0 ? 0 : 100;
    return Math.max(-999, Math.min(999, Math.round(((thisWeek - lastWeek) / lastWeek) * 100)));
  }, [deals]);

  const tintColor =
    colorTheme === "green" ? "0, 201, 80" : colorTheme === "red" ? "232, 34, 34" : "179, 204, 255";

  return (
    <div
      className="flex flex-col items-start flex-shrink-0 bg-white"
      style={{ width: "340px", border: "1px solid #E7E7E9", borderRadius: "12px", overflow: "hidden" }}
    >
      {/* Header */}
      <div
        className="flex flex-row justify-between items-center w-full flex-shrink-0"
        style={{ height: "46px", padding: "0 18px", background: "#F5F7FA" }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="truncate"
            style={{ fontFamily: "Inter", fontWeight: 600, fontSize: "12px", lineHeight: "15px", letterSpacing: "-0.02em", color: "#44444A" }}
          >
            {status}
          </span>
          <span
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: "22px",
              height: "22px",
              background: "#FFFFFF",
              border: "1px solid #E5E5EC",
              boxShadow: "0px 1px 2px rgba(82, 88, 102, 0.06)",
              borderRadius: "20px",
              fontFamily: "Inter",
              fontWeight: 600,
              fontSize: "12px",
              lineHeight: "15px",
              letterSpacing: "-0.02em",
              color: "#161618",
            }}
          >
            {loading ? <Skeleton width={14} height={12} /> : deals.length}
          </span>
        </div>
        <button
          onClick={onAddClick}
          className="flex items-center justify-center cursor-pointer hover:opacity-70 transition-opacity flex-shrink-0"
          title="Add deal"
        >
          <Plus className="w-4 h-4" style={{ color: "#BEBEC8" }} />
        </button>
      </div>

      <div className="w-full flex-shrink-0" style={{ height: "1px", background: "#E7E7E9" }} />

      {/* Summary card — always visible, unlike the old version which hid it when empty */}
      <div className="w-full flex-shrink-0" style={{ padding: "20px 20px 0" }}>
        <div
          className="box-border flex flex-row justify-between items-center w-full"
          style={{
            padding: "16px",
            gap: "10px",
            background: `linear-gradient(94.22deg, rgba(255, 255, 255, 0) -7.06%, rgba(${tintColor}, 0.2) 101.14%), #FFFFFF`,
            border: "1px solid #E5E5EC",
            borderRadius: "10px",
          }}
        >
          {loading ? (
            <Skeleton width={90} height={22} />
          ) : (
            <span
              className="truncate"
              style={{ fontFamily: "Inter", fontWeight: 600, fontSize: "22px", lineHeight: "150%", letterSpacing: "-0.03em", color: "#48494C", minWidth: 0 }}
            >
              ₹{formattedTotal}
            </span>
          )}
          {!loading && (
            <span
              className="flex-shrink-0"
              style={{
                fontFamily: "Inter",
                fontWeight: 500,
                fontSize: "12px",
                lineHeight: "15px",
                letterSpacing: "-0.02em",
                color: trendPct >= 0 ? "#0747A6" : "#E82222",
                marginLeft: "auto",
              }}
            >
              {trendPct >= 0 ? "+" : ""}{trendPct}%
            </span>
          )}
        </div>
      </div>

      {/* Cards — capped to ~7 tall, then scrolls internally. */}
      <div
        ref={setNodeRef}
        className={`overflow-y-auto dc-card-scroll w-full px-[18px] pb-[18px] pt-3 transition-colors ${isOver ? "bg-blue-50/40" : ""}`}
        style={{ maxHeight: "1030px" }}
      >
        <div className="min-h-[80px]">
          <SortableContext id={status} items={dealIds} strategy={verticalListSortingStrategy}>
            {deals.map((deal) => (
              <DealCard key={deal._id} deal={deal} />
            ))}
          </SortableContext>
          {/* Slack below the last card so dropping at the end of a long column
              doesn't require hitting the final card precisely. */}
          <div className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
};

export default function CompanyDealsKanban({
  deals,
  setDeals,
  showStats = true,
  companyId,
  company,
  contacts = [],
  viewMode: controlledViewMode,
  setViewMode: setControlledViewMode,
  isLoading = false,
}) {
  // 8px of travel before a drag begins. This is what keeps a plain click on a card
  // navigating to the deal instead of being swallowed as a drag — do not lower it.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // The deal being dragged, captured on drag start. Serves two purposes: it feeds
  // the DragOverlay, and it preserves the ORIGINAL status — which onDragOver
  // overwrites in `deals` as soon as the pointer crosses into another column.
  const [activeDeal, setActiveDeal] = useState(null);

  const [showDealForm, setShowDealForm] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const handleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  };
  const [localViewMode, setLocalViewMode] = useState("board");
  const viewMode = controlledViewMode ?? localViewMode;
  const setViewMode = setControlledViewMode ?? setLocalViewMode;
  const [currentPage, setCurrentPage] = useState(1);
  const [editingPage, setEditingPage] = useState(false);
  const [pageInput, setPageInput] = useState("");
  const [limit, setLimit] = useState(10);
  const navigate = useNavigate();

  // Multi-column pinning, independent left/right sides: [{ key, side }]
  const [pinnedColumns, setPinnedColumns] = useState([]);
  const [hiddenColumns, setHiddenColumns] = useState([]);
  const pinColumnToSide = (colKey, side) => {
    setPinnedColumns((prev) => [...prev.filter((p) => p.key !== colKey), { key: colKey, side }]);
  };
  const unpinColumn = (colKey) => {
    setPinnedColumns((prev) => prev.filter((p) => p.key !== colKey));
  };
  const getColumnPinSide = (colKey) => pinnedColumns.find((p) => p.key === colKey)?.side || null;
  const hideColumn = (colKey) => setHiddenColumns((prev) => [...prev, colKey]);

  // Drag-to-reorder columns — same portal drag-ghost approach as the shared
  // DataTable component (used by the Dashboard "Top Invoices" table) for parity.
  const [columnOrder, setColumnOrder] = useState([]);
  const [draggedColKey, setDraggedColKey] = useState(null);
  const [dragOverColKey, setDragOverColKey] = useState(null);
  const [dragGhost, setDragGhost] = useState(null);
  const dragOverRef = useRef(null);
  const ghostElRef = useRef(null);

  const reorderColumns = (draggedKey, targetKey, fallbackOrder) => {
    if (!draggedKey || !targetKey || draggedKey === targetKey) return;
    const base = columnOrder.length ? columnOrder : fallbackOrder;
    const order = base.includes(draggedKey) ? [...base] : [...base, draggedKey];
    const from = order.indexOf(draggedKey);
    const to = order.indexOf(targetKey);
    if (from === -1 || to === -1) return;
    order.splice(from, 1);
    order.splice(to, 0, draggedKey);
    setColumnOrder(order);
  };

  const getDealColumnPreviewValue = (deal, colId) => {
    switch (colId) {
      case "dealId":
        return `DL-${deal._id.slice(-5).toUpperCase()}`;
      case "title":
        return deal.title || "-";
      case "contact":
        return deal.contact?.name || "-";
      case "stage":
        return deal.status || "-";
      case "amount":
        return `₹${(deal.amount || 0).toLocaleString("en-IN")}`;
      case "lastUpdated":
        return deal.updatedAt
          ? new Date(deal.updatedAt).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })
          : "-";
      default:
        return "-";
    }
  };

  const startColumnDrag = (e, colId, label, fallbackOrder) => {
    if (e.button !== 0) return;
    if (e.target.closest("button") || e.target.closest("[data-resize-handle]")) return;

    const th = e.currentTarget;
    const startX = e.clientX;
    const startY = e.clientY;
    const DRAG_THRESHOLD = 5;

    // Tracks whether the pointer has moved past the threshold yet. A plain click
    // (mousedown -> tiny/no movement -> mouseup) never crosses it, so it never shows
    // the drag ghost or touches drag state — only a deliberate drag does.
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
      const previewRows = paginatedDeals.map((d) => String(getDealColumnPreviewValue(d, colId)));
      dragState.zGhost = getRootZoom();
      dragState.offsetX = startX - rect.left;
      dragState.offsetY = startY - rect.top;

      dragOverRef.current = null;
      setDraggedColKey(colId);
      setDragOverColKey(null);
      document.body.style.userSelect = "none";
      setDragGhost({
        label,
        previewRows,
        offsetX: dragState.offsetX,
        offsetY: dragState.offsetY,
        width: rect.width / dragState.zGhost,
        height: rect.height / dragState.zGhost,
      });

      requestAnimationFrame(() => positionGhost(startX, startY));
    };

    const handleMouseMove = (moveEvent) => {
      if (!dragState.started) {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
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
      if (overKey && overKey !== colId) {
        reorderColumns(colId, overKey, fallbackOrder);
      }
      dragOverRef.current = null;
      setDraggedColKey(null);
      setDragOverColKey(null);
      setDragGhost(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const [openColMenuKey, setOpenColMenuKey] = useState(null);
  const [colMenuPos, setColMenuPos] = useState(null);
  const colMenuRef = useRef(null);

  const [openRowActionsId, setOpenRowActionsId] = useState(null);
  const [rowActionsPos, setRowActionsPos] = useState(null);
  const rowActionsRef = useRef(null);

  // Lock page scroll while a portal menu is open so the background can't shift/scroll
  // out from under the fixed-position menu (its position is only computed once, on open).
  // Any scroll/wheel/touch/keyboard-scroll attempt closes the menu instead of moving the page.
  useEffect(() => {
    if (!openRowActionsId && !openColMenuKey) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const SCROLL_KEYS = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "];
    const closeMenus = () => {
      setOpenRowActionsId(null);
      setRowActionsPos(null);
      setOpenColMenuKey(null);
      setColMenuPos(null);
    };
    const handleWheel = (e) => {
      e.preventDefault();
      closeMenus();
    };
    const handleTouchMove = () => closeMenus();
    const handleKeyDown = (e) => {
      if (SCROLL_KEYS.includes(e.key)) closeMenus();
    };
    const handleScroll = () => closeMenus();

    window.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true, capture: true });
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    document.addEventListener("scroll", handleScroll, { capture: true });

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("wheel", handleWheel, { capture: true });
      window.removeEventListener("touchmove", handleTouchMove, { capture: true });
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      document.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, [openRowActionsId, openColMenuKey]);

  const [dealToDelete, setDealToDelete] = useState(null);
  const [deletingDeal, setDeletingDeal] = useState(false);

  const handleDeleteDealConfirmed = async () => {
    if (!dealToDelete) return;
    setDeletingDeal(true);
    try {
      await API.delete(`/deals/${dealToDelete._id}`);
      setDeals((prev) => prev.filter((d) => d._id !== dealToDelete._id));
      toast.success("Deal deleted");
      setDealToDelete(null);
    } catch (err) {
      console.error("Failed to delete deal:", err);
      toast.error(err.response?.data?.message || "Failed to delete deal");
    } finally {
      setDeletingDeal(false);
    }
  };

  // Row selection + bulk actions
  const [selectedDeals, setSelectedDeals] = useState([]);
  // Delays the bulk-strip's unmount so it can play a slide-out-right exit
  // animation on deselect (mirroring the slide-in entrance).
  const [showBulkStrip, setShowBulkStrip] = useState(false);
  const [bulkStripClosing, setBulkStripClosing] = useState(false);
  useEffect(() => {
    const active = viewMode === "list" && selectedDeals.length > 0;
    if (active) {
      setBulkStripClosing(false);
      setShowBulkStrip(true);
    } else if (showBulkStrip) {
      setBulkStripClosing(true);
      const t = setTimeout(() => {
        setShowBulkStrip(false);
        setBulkStripClosing(false);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [viewMode, selectedDeals.length]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("Open");
  const [bulkLoading, setBulkLoading] = useState(false);

  const handleSelectAllDeals = () => {
    setSelectedDeals((prev) =>
      prev.length === paginatedDeals.length ? [] : paginatedDeals.map((d) => d._id),
    );
  };
  const handleSelectDeal = (id) => {
    setSelectedDeals((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleBulkDeleteDeals = async () => {
    setBulkLoading(true);
    try {
      await Promise.all(selectedDeals.map((id) => API.delete(`/deals/${id}`)));
      setDeals((prev) => prev.filter((d) => !selectedDeals.includes(d._id)));
      toast.success(`${selectedDeals.length} deal(s) deleted`);
      setSelectedDeals([]);
      setShowBulkDeleteModal(false);
    } catch (err) {
      console.error("Bulk deal delete failed:", err);
      toast.error(err.response?.data?.message || "Bulk delete failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkUpdateDealStatus = async () => {
    setBulkLoading(true);
    try {
      await Promise.all(
        selectedDeals.map((id) => {
          const deal = deals.find((d) => d._id === id);
          return API.post(`/deals/${id}/status`, { oldStatus: deal?.status || "Open", newStatus: bulkStatus });
        }),
      );
      setDeals((prev) => prev.map((d) => (selectedDeals.includes(d._id) ? { ...d, status: bulkStatus } : d)));
      toast.success(`${selectedDeals.length} deal(s) updated`);
      setSelectedDeals([]);
      setShowBulkStatusModal(false);
    } catch (err) {
      console.error("Bulk deal status update failed:", err);
      toast.error(err.response?.data?.message || "Bulk update failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExportSelectedDeals = () => {
    const rows = deals.filter((d) => selectedDeals.includes(d._id));
    const header = ["Deal ID", "Deal Name", "Contact", "Stage", "Amount", "Last Updated"];
    const csvRows = rows.map((d) =>
      [
        `DL-${d._id.slice(-5).toUpperCase()}`,
        d.title || "",
        d.contact?.name || "",
        d.status || "",
        d.amount || 0,
        d.updatedAt ? new Date(d.updatedAt).toLocaleDateString("en-IN") : "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "deals-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const [colWidths, setColWidths] = useState({
    dealId: 127,
    title: 185,
    contact: 150,
    stage: 131,
    amount: 123,
    lastUpdated: 171,
    actions: 56,
  });
  const [resizingCol, setResizingCol] = useState(null);
  const resizingRef = React.useRef(null);
  const totalTableWidth = useMemo(
    () => Object.values(colWidths).reduce((sum, w) => sum + w, 0),
    [colWidths],
  );

  const startResize = (e, colId) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { colId, startX: e.clientX, startWidth: colWidths[colId] };
    setResizingCol(colId);

    const onMouseMove = (moveEvent) => {
      if (!resizingRef.current) return;
      const { colId: id, startX, startWidth } = resizingRef.current;
      // clientX deltas arrive in real screen (zoomed/visual) pixels, but colWidths
      // are unscaled layout px rendered inside the zoomed #root (see getRootZoom
      // above) — divide the delta by zoom so the column edge tracks the cursor
      // 1:1 instead of lagging behind it under the 0.75 desktop zoom.
      const z = getRootZoom();
      const newWidth = Math.max(60, startWidth + (moveEvent.clientX - startX) / z);
      setColWidths((prev) => ({ ...prev, [id]: newWidth }));
    };

    const onMouseUp = () => {
      resizingRef.current = null;
      setResizingCol(null);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const res = await API.get("/kanban");
        setStatuses(res.data?.statuses || ["Open", "Won", "Lost"]);
      } catch (err) {
        console.error("Failed to load pipeline stages:", err);
        setStatuses(["Open", "Won", "Lost"]);
      }
    };
    fetchStatuses();
  }, []);

  const filteredDeals = useMemo(() => {
    let result = deals;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter((d) =>
        [
          `DL-${d._id.slice(-5).toUpperCase()}`,
          d.title,
          d.contact?.name,
          d.status,
          `₹${(d.amount || 0).toLocaleString("en-IN")}`,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    return applyColumnFilters(result, selectedFilters, getDealFieldValue);
  }, [deals, searchTerm, selectedFilters]);

  const sortedDeals = useMemo(() => {
    if (!sortConfig.key) return filteredDeals;
    const sorted = [...filteredDeals].sort((a, b) => {
      let aVal = getDealFieldValue(a, sortConfig.key);
      let bVal = getDealFieldValue(b, sortConfig.key);
      if (sortConfig.key === "amount") {
        aVal = a.amount || 0;
        bVal = b.amount || 0;
      } else if (sortConfig.key === "lastUpdated") {
        aVal = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        bVal = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      } else {
        aVal = (aVal || "").toString().toLowerCase();
        bVal = (bVal || "").toString().toLowerCase();
      }
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredDeals, sortConfig]);

  const totalCount = sortedDeals.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, totalCount);
  const hasPrevPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    setCurrentPage(1);
  };

  // "Select All" grabs every deal matching the current search/filters (all
  // deals for this company are already loaded client-side, so this selects
  // the full filtered set, not only the current page). "Deselect All" is its
  // counterpart: it doesn't clear the selection outright — it steps back
  // down to only the rows on the current page.
  const handleSelectAllAcrossPages = () => {
    setSelectedDeals(sortedDeals.map((d) => d._id));
  };

  const handleDeselectAllExtra = () => {
    setSelectedDeals(paginatedDeals.map((d) => d._id));
  };

  const paginatedDeals = useMemo(
    () => sortedDeals.slice((currentPage - 1) * limit, currentPage * limit),
    [sortedDeals, currentPage, limit],
  );

  const dealsByStatus = useMemo(() => {
    const map = {};
    statuses.forEach((s) => {
      map[s] = filteredDeals.filter((d) => (d.status || "Open") === s);
    });
    return map;
  }, [statuses, filteredDeals]);

  const isTerminal = (status, name) =>
    TERMINAL_STATUSES.includes((status || "").toLowerCase()) &&
    (status || "").toLowerCase() === name;

  const openDeals = deals.filter(
    (d) => !TERMINAL_STATUSES.includes((d.status || "Open").toLowerCase()),
  );
  const wonDeals = deals.filter((d) => (d.status || "").toLowerCase() === "won");
  const lostDeals = deals.filter((d) => (d.status || "").toLowerCase() === "lost");
  const pipelineValue = openDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
  const avgDealSize = deals.length
    ? deals.reduce((sum, d) => sum + (d.amount || 0), 0) / deals.length
    : 0;
  const avgClosingDays = (() => {
    const closed = deals.filter(
      (d) => (d.status || "").toLowerCase() === "won" && d.createdAt && d.updatedAt,
    );
    if (closed.length === 0) return 0;
    const totalDays = closed.reduce((sum, d) => {
      const days =
        (new Date(d.updatedAt) - new Date(d.createdAt)) / (1000 * 60 * 60 * 24);
      return sum + Math.max(days, 0);
    }, 0);
    return Math.round(totalDays / closed.length);
  })();

  const kpiTiles = [
    { label: "Open Deals", value: openDeals.length, icon: Gem },
    {
      label: "Pipeline Value",
      value: `₹${pipelineValue.toLocaleString("en-IN")}`,
      icon: Clock,
    },
    { label: "Won Deals", value: wonDeals.length, icon: Handshake },
    { label: "Lost Deals", value: lostDeals.length, icon: Sparkles },
    {
      label: "Avg. Deal Size",
      value: `₹${Math.round(avgDealSize).toLocaleString("en-IN")}`,
      icon: ListChecks,
    },
    {
      label: "Avg. Closing Time",
      value: `${avgClosingDays}d`,
      icon: CalendarClock,
    },
  ];

  // `over.id` is a column id when hovering the column body, but another deal's id
  // when hovering a card — sortable items are droppables too. Both handlers below
  // need the same resolution, so it lives in one place.
  const resolveDropStatus = (overId) => {
    if (!overId) return null;
    const id = overId.toString();
    if (statuses.includes(id)) return id;
    const overDeal = deals.find((d) => d._id.toString() === id);
    return overDeal ? overDeal.status || "Open" : null;
  };

  const handleDragStart = ({ active }) => {
    const deal = deals.find((d) => d._id.toString() === active.id.toString());
    // Shallow COPY, not a reference. Today every setDeals call replaces objects via
    // map+spread so a reference would survive intact, but the snapshot is the only
    // record of the pre-drag status (used for persistence and rollback) — copying
    // makes that guarantee independent of how state happens to be updated.
    setActiveDeal(deal ? { ...deal } : null);
  };

  // Optimistically move the deal into the hovered column mid-drag. The column
  // counts, totals and trend badges are all derived from `deals`, so this is what
  // makes them update live; it also lets the destination column open a real gap,
  // because the card genuinely joins that column's SortableContext.
  const handleDragOver = ({ active, over }) => {
    if (!over) return;
    const activeId = active.id.toString();
    if (activeId === over.id.toString()) return;

    const dragged = deals.find((d) => d._id.toString() === activeId);
    if (!dragged) return;

    const overStatus = resolveDropStatus(over.id);
    // Same column: dnd-kit handles the reordering animation itself, nothing to do.
    if (!overStatus || (dragged.status || "Open") === overStatus) return;

    setDeals((prev) =>
      prev.map((d) => (d._id.toString() === activeId ? { ...d, status: overStatus } : d)),
    );
  };

  const handleDragCancel = () => setActiveDeal(null);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    const dragged = activeDeal;
    setActiveDeal(null);
    if (!over || !dragged) return;

    const dealId = active.id.toString();
    const newStatus = resolveDropStatus(over.id);
    // Read the original status from the drag-start snapshot, NOT from `deals` —
    // handleDragOver has already rewritten it there.
    const oldStatus = dragged.status || "Open";
    if (!newStatus || newStatus === oldStatus) return;

    // handleDragOver has usually applied this already, but not if the drop landed
    // without an intervening over event — keep it idempotent.
    setDeals((prev) =>
      prev.map((d) => (d._id.toString() === dealId ? { ...d, status: newStatus } : d)),
    );

    try {
      await API.post(`/deals/${dealId}/status`, { oldStatus, newStatus });
      toast.success("Deal status updated");
    } catch (err) {
      console.error("Failed to update deal status:", err);
      toast.error("Failed to update deal status");
      setDeals((prev) =>
        prev.map((d) =>
          d._id.toString() === dealId ? { ...d, status: oldStatus } : d,
        ),
      );
    }
  };

  const handleDealCreated = async () => {
    try {
      const res = await API.get("/deals");
      setDeals(res.data.filter((d) => d.company?._id === companyId));
      toast.success("Deal created successfully!");
    } catch (err) {
      toast.error("Failed to refresh deals list.");
    }
    setShowDealForm(false);
  };

  return (
    <div>
      {/* KPI Tiles */}
      {showStats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => <StatTileSkeleton key={i} />)
              : kpiTiles.map((tile) => (
                <div
                  key={tile.label}
                  className="h-[72px] flex items-center gap-2 px-3 bg-white border border-gray-200 rounded-xl"
                >
                  <div className="w-10 h-10 text-blue-600 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                    <tile.icon size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-gray-500 truncate">{tile.label}</p>
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {tile.value}
                    </p>
                  </div>
                </div>
              ))}
          </div>

          <div className="-mx-6" style={{ marginTop: 24, paddingBottom: 24, borderTop: "1px solid #E1E4EA" }} />
        </>
      )}

      {/* Search + Controls (replaced by a bulk-actions strip when rows are selected) */}
      {isLoading ? (
        <div className="flex items-center gap-4 mb-4" style={{ height: "44px" }}>
          <Skeleton width="100%" height={44} shape="rounded" className="!rounded-full flex-1" />
          <Skeleton width={90} height={44} shape="rounded" className="!rounded-full flex-shrink-0" />
          <Skeleton width={88} height={44} shape="rounded" className="!rounded-full flex-shrink-0" />
          <Skeleton width={44} height={44} shape="circle" className="flex-shrink-0" />
        </div>
      ) : showBulkStrip ? (
        <div
          className={`${bulkStripClosing ? "animate-slideOutRight" : "animate-slideInRight"} flex flex-wrap items-center justify-end gap-6 bg-blue-50 border border-blue-200 rounded-xl px-4 mb-4`}
          style={{ minHeight: 44 }}
        >
          <div className="flex items-center gap-3 py-2">
            <span className="text-blue-800 font-semibold text-sm">
              {selectedDeals.length} deal{selectedDeals.length !== 1 ? "s" : ""} selected
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 py-2">
            <button
              onClick={handleSelectAllAcrossPages}
              className="px-3.5 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={handleDeselectAllExtra}
              className="px-3.5 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Deselect All
            </button>
            <button
              onClick={handleExportSelectedDeals}
              className="px-3.5 py-2 bg-white border border-green-600 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 transition-colors"
            >
              Export
            </button>
            <button
              onClick={() => setShowBulkStatusModal(true)}
              className="px-3.5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Bulk Update
            </button>
            <button
              onClick={() => setShowBulkDeleteModal(true)}
              className="px-3.5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => setSelectedDeals([])}
              className="px-3.5 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
      <div className="flex items-center gap-4 mb-4" style={{ height: "44px" }}>
        <div className="relative flex-1 h-full">
          <Search
            size={20}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-900 opacity-50"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search deals by name, contact, or status..."
            className="w-full h-full pl-10 pr-3.5 border rounded-full text-sm focus:outline-none focus:border-blue-300"
            style={{ borderColor: "rgba(31, 41, 55, 0.1)" }}
          />
        </div>
        <button
          onClick={() => setShowFilterPanel(true)}
          className="relative flex items-center justify-center gap-2 px-3 text-sm font-medium text-gray-800 bg-white border rounded-full hover:bg-gray-50 flex-shrink-0"
          style={{
            height: "44px",
            borderColor: Object.values(selectedFilters).flat().length > 0 ? "#0085FF" : "#E1E4EA",
          }}
        >
          <FilterIcon size={16} />
          Filter
          {Object.values(selectedFilters).flat().length > 0 && (
            <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full ring-2 ring-white">
              {Object.values(selectedFilters).flat().length}
            </span>
          )}
        </button>
        <div className="relative flex items-center gap-1.5 p-1 bg-[#E9EAEB] rounded-full flex-shrink-0 overflow-hidden" style={{ height: "44px" }}>
          <span
            className="absolute top-1 w-9 h-9 rounded-full bg-white shadow-[0px_4px_4px_rgba(0,0,0,0.1)] transition-all duration-300 ease-out pointer-events-none"
            style={{ left: viewMode === "list" ? 46 : 4 }}
          />
          <button
            onClick={() => setViewMode("board")}
            className={`relative z-10 w-9 h-9 flex items-center justify-center rounded-full transition-colors ${viewMode === "board" ? "text-blue-600" : "text-gray-500"
              }`}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`relative z-10 w-9 h-9 flex items-center justify-center rounded-full transition-colors ${viewMode === "list" ? "text-blue-600" : "text-gray-500"
              }`}
          >
            <ListIcon size={16} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowDealForm(true)}
          className="flex items-center justify-center rounded-full border hover:bg-gray-50 flex-shrink-0"
          style={{ width: "44px", height: "44px", borderColor: "#E1E4EA" }}
          title="Add Deal"
        >
          <Plus size={20} />
        </button>
      </div>
      )}

      {showDealForm && (
        <QuickDealForm
          companies={company ? [company] : []}
          contacts={contacts}
          initialCompanyId={companyId}
          onDealCreated={handleDealCreated}
          onRequestClose={() => setShowDealForm(false)}
        />
      )}

      <CompanyFilterPanel
        isOpen={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        columns={DEAL_FILTER_COLUMNS(statuses)}
        data={deals}
        getFieldValue={getDealFieldValue}
        selected={selectedFilters}
        onApply={setSelectedFilters}
        title="Filter Deals"
        subtitle="Filter this list by column"
      />

      {viewMode === "board" ? (
        isLoading || statuses.length === 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {(statuses.length ? statuses : ["Open", "Won", "Lost"]).map((status) => (
              <div key={status} className="w-[340px] flex-shrink-0 rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-[18px]" style={{ height: 46, background: "#F5F7FA" }}>
                  <div className="flex items-center gap-1.5">
                    <Skeleton width={60} height={12} />
                    <Skeleton shape="circle" width={20} height={20} />
                  </div>
                  <Skeleton shape="circle" width={14} height={14} />
                </div>
                <div className="px-[18px] pt-5">
                  <Skeleton width="100%" height={67} shape="rect" className="rounded-[10px]" />
                </div>
                <div className="flex flex-col items-start gap-3.5 px-[18px] py-5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <DealCardSkeleton key={i} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="flex gap-4 overflow-x-auto pb-2" style={{ "--kanban-top-offset": "16rem" }}>
            {statuses.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                deals={dealsByStatus[status] || []}
                colorTheme={status === "Won" ? "green" : status === "Lost" ? "red" : "blue"}
                onAddClick={() => setShowDealForm(true)}
              />
            ))}
          </div>

          {/* Floating preview that tracks the cursor. Rendered as a plain div, never
              a <Link>, so it can't navigate or capture clicks.

              PORTALED TO document.body ON PURPOSE. #root carries `zoom: 0.75`, and
              CSS `zoom` makes #root the containing block for position:fixed. dnd-kit
              positions the overlay from getBoundingClientRect() (visual px) and then
              applies a translate — but painted inside #root both get multiplied by
              0.75, so the card drifts above the cursor, increasingly so the further
              you drag. document.body sits outside that zoom, so the coordinates line
              up 1:1. createPortal keeps the React tree (and DndContext) intact.

              The inner wrapper re-applies the same zoom, because dnd-kit sizes the
              overlay to the source card's VISUAL rect (225x99, not 300x132) — without
              it the floating card would render a third larger than the real ones. */}
          {createPortal(
            <DragOverlay dropAnimation={null}>
              {activeDeal ? (
                <div style={{ zoom: getAncestorZoom(document.getElementById("root")) }}>
                  <DealCardOverlay deal={activeDeal} />
                </div>
              ) : null}
            </DragOverlay>,
            document.body,
          )}
        </DndContext>
        )
      ) : (
        <>
          <div
            className="box-border flex flex-col items-stretch bg-white self-stretch"
            style={{ border: "1px solid #E1E4EA", borderRadius: "8px" }}
          >
            <div className="w-full overflow-x-auto overflow-y-auto" style={{ maxHeight: "596px" }}>
            <table
              className="text-sm text-left border-separate"
              style={{ tableLayout: "fixed", width: "100%", minWidth: totalTableWidth, maxWidth: "100%", borderSpacing: 0 }}
            >
              <thead className="bg-[#F5F7FA] border-b border-[#E1E4EA] sticky top-0 z-10">
                <tr>
                  <th style={{ width: 44, height: 56 }} className="px-3 py-2.5 border-r border-[#E1E4EA]">
                    <div className="flex justify-center items-center w-full">
                      <input
                        type="checkbox"
                        checked={selectedDeals.length === paginatedDeals.length && paginatedDeals.length > 0}
                        onChange={handleSelectAllDeals}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                    </div>
                  </th>
                  {(() => {
                    const allCols = [
                      { id: "dealId", label: "Deal ID", width: 127, sortable: false },
                      { id: "title", label: "Deal Name", width: 185, icon: FileText },
                      { id: "contact", label: "Contact", width: 150, icon: User },
                      { id: "stage", label: "Stage", width: 131, icon: Tag },
                      { id: "amount", label: "Amount", width: 123, icon: IndianRupee },
                      { id: "lastUpdated", label: "Last Updated", width: 171, icon: Calendar, sortable: false },
                    ].filter((col) => !hiddenColumns.includes(col.id));
                    const orderRank = (id) => {
                      const idx = columnOrder.indexOf(id);
                      return idx === -1 ? columnOrder.length + allCols.findIndex((c) => c.id === id) : idx;
                    };
                    const fallbackOrder = allCols.map((c) => c.id);
                    return allCols
                      .slice()
                      .sort((a, b) => {
                        const rank = (id) => (getColumnPinSide(id) === "left" ? 0 : getColumnPinSide(id) === "right" ? 2 : 1);
                        const pinDiff = rank(a.id) - rank(b.id);
                        if (pinDiff !== 0) return pinDiff;
                        return orderRank(a.id) - orderRank(b.id);
                      })
                      .map((col) => {
                    const isMenuOpen = openColMenuKey === col.id;
                    const pinSide = getColumnPinSide(col.id);
                    const isDragging = draggedColKey === col.id;
                    const isDragOver = dragOverColKey === col.id && draggedColKey && draggedColKey !== col.id;
                    return (
                      <th
                        key={col.id}
                        data-col-id={col.id}
                        onMouseDown={(e) => startColumnDrag(e, col.id, col.label, fallbackOrder)}
                        style={{ width: colWidths[col.id], height: 56, position: "relative", opacity: isDragging ? 0.35 : 1 }}
                        className={`px-3 py-2.5 font-medium text-[#525866] text-xs border-r border-[#E1E4EA] cursor-grab active:cursor-grabbing transition-colors ${isDragOver ? "bg-blue-100" : ""}`}
                      >
                        <div className="flex items-center justify-between w-full group">
                          <div
                            className="flex items-center gap-1.5 flex-1 overflow-hidden cursor-pointer select-none"
                            onClick={() => col.sortable !== false && handleSort(col.id)}
                          >
                            {col.icon && <col.icon className="w-3.5 h-3.5 flex-shrink-0" />}
                            <span className="truncate">{col.label}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isMenuOpen) {
                                setOpenColMenuKey(null);
                                setColMenuPos(null);
                                return;
                              }
                              setColMenuPos({ top: e.clientY + 4, left: e.clientX - 190 });
                              setOpenColMenuKey(col.id);
                            }}
                            className="ml-1 p-1 rounded hover:bg-gray-200 transition-colors text-gray-500 flex-shrink-0"
                            title="Column options"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>

                          {isMenuOpen && colMenuPos && createPortal(
                            <>
                              <div className="fixed inset-0 z-[9998]" onClick={() => { setOpenColMenuKey(null); setColMenuPos(null); }} />
                              <div
                                ref={colMenuRef}
                                style={{ position: "fixed", top: colMenuPos.top, left: colMenuPos.left }}
                                className="w-[190px] z-[9999] bg-white border border-[#E5E5EC] rounded-xl shadow-[7px_24px_24px_-7px_rgba(0,0,0,0.25)] p-2 flex flex-col gap-1 animate-in fade-in zoom-in duration-150 origin-top-right"
                              >
                                <button
                                  onClick={() => {
                                    setOpenColMenuKey(null);
                                    setColMenuPos(null);
                                    pinSide === "left" ? unpinColumn(col.id) : pinColumnToSide(col.id, "left");
                                  }}
                                  className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${pinSide === "left" ? "bg-blue-50 text-blue-700" : "text-[#161618] hover:bg-gray-50"}`}
                                >
                                  {pinSide === "left" ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4 text-[#1C1B1F]" />}
                                  Pin to Left
                                </button>
                                <button
                                  onClick={() => {
                                    setOpenColMenuKey(null);
                                    setColMenuPos(null);
                                    pinSide === "right" ? unpinColumn(col.id) : pinColumnToSide(col.id, "right");
                                  }}
                                  className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${pinSide === "right" ? "bg-blue-50 text-blue-700" : "text-[#161618] hover:bg-gray-50"}`}
                                >
                                  {pinSide === "right" ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4 text-[#1C1B1F]" />}
                                  Pin to Right
                                </button>

                                {col.sortable !== false && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setOpenColMenuKey(null);
                                        setColMenuPos(null);
                                        handleSort(col.id);
                                      }}
                                      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-semibold text-[#161618] hover:bg-gray-50 whitespace-nowrap"
                                    >
                                      <ChevronUp className="w-4 h-4 text-[#1C1B1F]" />
                                      Sort Ascending
                                    </button>
                                    <button
                                      onClick={() => {
                                        setOpenColMenuKey(null);
                                        setColMenuPos(null);
                                        handleSort(col.id);
                                      }}
                                      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-semibold text-[#161618] hover:bg-gray-50 whitespace-nowrap"
                                    >
                                      <ChevronDown className="w-4 h-4 text-[#1C1B1F]" />
                                      Sort Descending
                                    </button>
                                  </>
                                )}

                                <div className="w-full border-t border-[#F1F1F5] my-0.5" />

                                <button
                                  onClick={() => {
                                    setOpenColMenuKey(null);
                                    setColMenuPos(null);
                                    hideColumn(col.id);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-semibold text-[#161618] hover:bg-gray-50 whitespace-nowrap"
                                >
                                  <EyeOff className="w-4 h-4 text-[#1C1B1F]" />
                                  Hide Column
                                </button>
                              </div>
                            </>,
                            document.body,
                          )}
                        </div>

                        <div
                          data-resize-handle="true"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            startResize(e, col.id);
                          }}
                          className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-blue-400 z-10 ${resizingCol === col.id ? "bg-blue-500" : "bg-transparent"
                            }`}
                        />
                      </th>
                    );
                  });
                  })()}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E4EA] bg-white">
                {paginatedDeals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500 font-medium">
                      No deals found.
                    </td>
                  </tr>
                ) : (
                  paginatedDeals.map((deal) => {
                    const lastUpdated = deal.updatedAt
                      ? new Date(deal.updatedAt).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                      : "—";
                    const pillStyle =
                      deal.status === "Won"
                        ? { backgroundColor: "rgba(0, 201, 80, 0.1)", color: "#00A63E" }
                        : deal.status === "Lost"
                          ? { backgroundColor: "rgba(232, 34, 34, 0.1)", color: "#E82222" }
                          : { backgroundColor: "rgba(0, 133, 255, 0.1)", color: "#0085FF" };
                    const isActionsOpen = openRowActionsId === deal._id;
                    const dealIdShort = `DL-${deal._id.slice(-5).toUpperCase()}`;
                    const isSelected = selectedDeals.includes(deal._id);
                    return (
                      <tr key={deal._id} className={`hover:bg-gray-50 transition-colors group ${isSelected ? "!bg-blue-50" : ""}`}>
                        <td style={{ height: 54, width: 44 }} className="px-3 border-r border-[#E1E4EA]">
                          <div className="flex justify-center items-center w-full">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectDeal(deal._id)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                            />
                          </div>
                        </td>
                        {!hiddenColumns.includes("dealId") && (
                          <td
                            style={{ height: 54 }}
                            className="px-3 text-[14px] leading-5 font-medium text-[#525866] whitespace-nowrap text-left border-r border-[#E1E4EA]"
                          >
                            <HighlightText text={dealIdShort} query={searchTerm} />
                          </td>
                        )}
                        {!hiddenColumns.includes("title") && (
                          <td style={{ height: 54 }} className="px-3 text-left border-r border-[#E1E4EA]">
                            <Link
                              to={`/deals/${deal._id}`}
                              className="text-[14px] leading-5 font-medium text-[#222530] hover:text-blue-600 truncate block"
                            >
                              <HighlightText text={deal.title || "Deal Name"} query={searchTerm} />
                            </Link>
                          </td>
                        )}
                        {!hiddenColumns.includes("contact") && (
                          <td
                            style={{ height: 54 }}
                            className="px-3 text-[14px] leading-5 font-medium text-[#222530] truncate text-left border-r border-[#E1E4EA]"
                          >
                            <HighlightText text={deal.contact?.name || "-"} query={searchTerm} />
                          </td>
                        )}
                        {!hiddenColumns.includes("stage") && (
                          <td style={{ height: 54 }} className="px-3 border-r border-[#E1E4EA]">
                            <div className="flex items-center justify-start">
                              <span
                                style={{ width: 80, height: 24, padding: "5px 12px", borderRadius: 53, ...pillStyle }}
                                className="inline-flex items-center justify-center text-xs font-medium"
                              >
                                <HighlightText text={deal.status || "Open"} query={searchTerm} />
                              </span>
                            </div>
                          </td>
                        )}
                        {!hiddenColumns.includes("amount") && (
                          <td
                            style={{ height: 54 }}
                            className="px-3 text-[14px] leading-5 font-medium text-[#525866] whitespace-nowrap text-left border-r border-[#E1E4EA]"
                          >
                            <HighlightText text={`₹${(deal.amount || 0).toLocaleString("en-IN")}`} query={searchTerm} />
                          </td>
                        )}
                        {!hiddenColumns.includes("lastUpdated") && (
                          <td
                            style={{ height: 54 }}
                            className="px-3 text-[14px] leading-5 font-medium text-[#525866] whitespace-nowrap"
                          >
                            <div className="flex items-center justify-between gap-2" onMouseDown={(e) => e.stopPropagation()}>
                              <HighlightText text={lastUpdated} query={searchTerm} />
                              <div className="relative flex items-center justify-center flex-shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isActionsOpen) {
                                      setOpenRowActionsId(null);
                                      setRowActionsPos(null);
                                      return;
                                    }
                                    const menuHeight = 128;
                                    const wouldOverflow = e.clientY + 4 + menuHeight > window.innerHeight;
                                    setRowActionsPos({
                                      top: wouldOverflow ? e.clientY - menuHeight - 4 : e.clientY + 4,
                                      left: e.clientX - 160,
                                    });
                                    setOpenRowActionsId(deal._id);
                                  }}
                                  className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                  title="More actions"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                                {isActionsOpen && rowActionsPos && createPortal(
                              <>
                                <div className="fixed inset-0 z-[9998]" onClick={() => { setOpenRowActionsId(null); setRowActionsPos(null); }} />
                                <div
                                  ref={rowActionsRef}
                                  style={{ position: "fixed", top: rowActionsPos.top, left: rowActionsPos.left }}
                                  className="w-[160px] z-[9999] bg-white border border-[#E5E5EC] rounded-lg shadow-[7px_24px_24px_-7px_rgba(0,0,0,0.25)] p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in duration-150 origin-top-right"
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenRowActionsId(null);
                                      setRowActionsPos(null);
                                      navigate(`/deals/${deal._id}`);
                                    }}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal text-[#161618] hover:bg-gray-50 whitespace-nowrap"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-[#1C1B1F]" />
                                    View Deal
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenRowActionsId(null);
                                      setRowActionsPos(null);
                                      navigate(`/deals/${deal._id}`);
                                    }}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal text-[#161618] hover:bg-gray-50 whitespace-nowrap"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-[#1C1B1F]" />
                                    Edit Deal
                                  </button>
                                  <div className="w-full border-t border-[#F1F1F5] my-0.5" />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenRowActionsId(null);
                                      setRowActionsPos(null);
                                      setDealToDelete(deal);
                                    }}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal text-red-600 hover:bg-red-50 whitespace-nowrap"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Delete Deal
                                  </button>
                                </div>
                              </>,
                              document.body,
                            )}
                              </div>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>

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
                <div className="px-3 py-3 bg-[#F5F7FA] border-b border-[#E1E4EA]" style={{ height: dragGhost.height }}>
                  <span className="text-sm font-bold text-[#525866] truncate block">{dragGhost.label}</span>
                </div>
                {dragGhost.previewRows.map((rowVal, i) => (
                  <div key={i} className="px-3 py-2 border-b border-[#F1F1F5] last:border-b-0">
                    <span className="text-sm text-gray-700 truncate block">{rowVal}</span>
                  </div>
                ))}
              </div>,
              document.body,
            )}

            {totalCount > 0 && (
            <div className="w-full bg-white px-4 py-3 flex items-center justify-between sm:px-6 border-t border-[#E1E4EA] rounded-b-lg">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={!hasPrevPage}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={!hasNextPage}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>

              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div className="flex items-center space-x-2">
                  <p className="text-sm text-gray-700 font-inter">
                    Showing <span className="font-semibold">{startItem}</span> to{" "}
                    <span className="font-semibold">{endItem}</span> of{" "}
                    <span className="font-semibold">{totalCount}</span> results
                  </p>
                  <select
                    value={limit}
                    onChange={(e) => handleLimitChange(parseInt(e.target.value))}
                    className="ml-2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-inter"
                  >
                    <option value={10}>10 per page</option>
                    <option value={20}>20 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={!hasPrevPage}
                    className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {(() => {
                    const commitPage = () => {
                      const n = parseInt(pageInput, 10);
                      if (!Number.isNaN(n)) handlePageChange(Math.min(Math.max(n, 1), totalPages));
                      setEditingPage(false);
                    };
                    const items = [1];
                    if (currentPage > 2) items.push("left-dots");
                    if (currentPage !== 1 && currentPage !== totalPages) items.push(currentPage);
                    if (currentPage < totalPages - 1) items.push("right-dots");
                    if (totalPages > 1) items.push(totalPages);

                    return items.map((item, index) => {
                      if (item === "left-dots" || item === "right-dots") {
                        return (
                          <span key={`${item}-${index}`} className="flex items-center justify-center w-8 h-8 text-sm font-medium text-gray-400 select-none">
                            ....
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
                          onClick={() => handlePageChange(item)}
                          onDoubleClick={() => {
                            if (isCurrent) {
                              setPageInput(String(currentPage));
                              setEditingPage(true);
                            }
                          }}
                          title={isCurrent ? "Double-click to type a page number" : undefined}
                          className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${isCurrent ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                        >
                          {item}
                        </button>
                      );
                    });
                  })()}

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={!hasNextPage}
                    className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            )}
          </div>
        </>
      )}

      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10005] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 font-sf">Confirm Delete</h3>
              <p className="text-sm text-gray-500 font-inter mb-6">
                Delete {selectedDeals.length} selected deal{selectedDeals.length !== 1 ? "s" : ""}? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowBulkDeleteModal(false)}
                  disabled={bulkLoading}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDeleteDeals}
                  disabled={bulkLoading}
                  className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {bulkLoading ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBulkStatusModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10005] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-1 font-sf">Bulk Update Stage</h3>
              <p className="text-sm text-gray-500 font-inter mb-4">
                Set stage for {selectedDeals.length} selected deal{selectedDeals.length !== 1 ? "s" : ""}.
              </p>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
              >
                {(statuses.length ? statuses : ["Open", "Won", "Lost"]).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowBulkStatusModal(false)}
                  disabled={bulkLoading}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkUpdateDealStatus}
                  disabled={bulkLoading}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {bulkLoading ? "Updating..." : "Update"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {dealToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10005] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 font-sf">
                Confirm Delete
              </h3>
              <p className="text-sm text-gray-500 font-inter mb-6">
                Delete deal "{dealToDelete.title || "Deal"}"? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setDealToDelete(null)}
                  disabled={deletingDeal}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteDealConfirmed}
                  disabled={deletingDeal}
                  className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {deletingDeal ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
