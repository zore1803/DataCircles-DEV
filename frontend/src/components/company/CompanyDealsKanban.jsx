import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  DndContext,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  PointerSensor,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
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

const Avatar = ({ name, className = "" }) => (
  <div
    className={`w-[18px] h-[18px] rounded-full bg-gray-200 border border-white flex items-center justify-center text-[8px] font-semibold text-gray-600 flex-shrink-0 ${className}`}
    title={name}
  >
    {name?.charAt(0)?.toUpperCase() || "?"}
  </div>
);

const DealCard = ({ deal }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: deal._id });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    width: "300px",
    height: "132px",
    padding: "16px",
    gap: "16px",
    borderColor: "#E5E5EC",
  };

  const tagLabel = deal.company?.name || deal.company?.industry || deal.contact?.name;
  const avatarNames = [deal.contact?.name, deal.user?.name].filter(Boolean);

  return (
    <Link
      to={`/deals/${deal._id}`}
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="box-border flex flex-col items-start bg-white border rounded-[10px] mb-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow overflow-hidden"
    >
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
    </Link>
  );
};

const KanbanColumn = ({ status, deals }) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const total = deals.reduce((sum, d) => sum + (d.amount || 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-[340px] bg-white border border-gray-200 rounded-xl transition-colors ${isOver ? "bg-blue-50 border-blue-300" : ""
        }`}
    >
      <div className="h-[46px] flex items-center justify-between px-[18px] bg-gray-50 rounded-t-xl border-b border-gray-200">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-gray-900">{status}</h4>
          <span className="w-5 h-5 flex items-center justify-center text-[11px] font-bold bg-white text-gray-600 rounded-full">
            {deals.length}
          </span>
        </div>
        <MoreVertical size={14} className="text-gray-300" />
      </div>
      <div className="px-[18px] pb-[18px] pt-5">
        {deals.length > 0 && (
          <div className="h-[67px] flex items-center justify-between bg-white bg-gradient-to-br from-white to-[#B3CCFF]/20 border border-[#E1E4EA] rounded-[10px] px-4 mb-3">
            <p className="text-lg font-bold text-gray-900">
              ₹{total.toLocaleString("en-IN")}
            </p>
          </div>
        )}
        <div className="min-h-[80px]">
          {deals.map((deal) => (
            <DealCard key={deal._id} deal={deal} />
          ))}
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
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
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
  const [limit, setLimit] = useState(10);
  const [pinnedColumn, setPinnedColumn] = useState(null);
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

  const togglePinColumn = (colId) => {
    setPinnedColumn((prev) => (prev === colId ? null : colId));
  };

  const startResize = (e, colId) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { colId, startX: e.clientX, startWidth: colWidths[colId] };
    setResizingCol(colId);

    const onMouseMove = (moveEvent) => {
      if (!resizingRef.current) return;
      const { colId: id, startX, startWidth } = resizingRef.current;
      const newWidth = Math.max(60, startWidth + (moveEvent.clientX - startX));
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
      result = result.filter((d) => (d.title || "").toLowerCase().includes(q));
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

  const getPageNumbers = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }
    if (currentPage - delta > 2) rangeWithDots.push(1, "...");
    else rangeWithDots.push(1);
    rangeWithDots.push(...range);
    if (currentPage + delta < totalPages - 1) rangeWithDots.push("...", totalPages);
    else if (totalPages > 1) rangeWithDots.push(totalPages);
    return rangeWithDots.filter((item, index, arr) => index === 0 || arr[index - 1] !== item);
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

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const dealId = active.id.toString();
    const newStatus = over.id.toString();
    const deal = deals.find((d) => d._id.toString() === dealId);
    if (!deal || deal.status === newStatus) return;

    const oldStatus = deal.status || "Open";

    setDeals((prev) =>
      prev.map((d) =>
        d._id.toString() === dealId ? { ...d, status: newStatus } : d,
      ),
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
            {kpiTiles.map((tile) => (
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

      {/* Search + Controls */}
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
            placeholder="Search by deal name..."
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
        <div className="flex items-center gap-1.5 p-1 bg-[#E9EAEB] rounded-full flex-shrink-0" style={{ height: "44px" }}>
          <button
            onClick={() => setViewMode("board")}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${viewMode === "board" ? "bg-white shadow-[0px_4px_4px_rgba(0,0,0,0.1)] text-blue-600" : "text-gray-500"
              }`}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${viewMode === "list" ? "bg-white shadow-sm text-blue-600" : "text-gray-500"
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
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {statuses.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                deals={dealsByStatus[status] || []}
              />
            ))}
          </div>
        </DndContext>
      ) : (
        <>
          <div
            className="box-border flex flex-col items-start bg-white self-stretch overflow-x-auto"
            style={{ border: "1px solid #E1E4EA", borderRadius: "8px" }}
          >
            <table
              className="text-sm text-left border-collapse"
              style={{ tableLayout: "fixed", width: "100%", minWidth: totalTableWidth, maxWidth: "100%" }}
            >
              <thead className="bg-[#F5F7FA] border-b border-[#E1E4EA]">
                <tr>
                  {[
                    { id: "dealId", label: "Deal ID", width: 127 },
                    { id: "title", label: "Deal Name", width: 185, icon: FileText, pinnable: true },
                    { id: "contact", label: "Contact", width: 150, icon: User, pinnable: true },
                    { id: "stage", label: "Stage", width: 131, icon: Tag, pinnable: true },
                    { id: "amount", label: "Amount", width: 123, icon: IndianRupee, pinnable: true },
                    { id: "lastUpdated", label: "Last Updated", width: 171, icon: Calendar },
                  ].map((col) => {
                    const isPinned = pinnedColumn === col.id;
                    return (
                      <th
                        key={col.id}
                        style={{ width: colWidths[col.id], height: 56, position: "relative" }}
                        className={`px-3 py-2.5 font-medium text-[#525866] text-xs ${col.id === "lastUpdated" ? "" : "border-r border-[#E1E4EA]"
                          }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          {col.pinnable ? (
                            <div
                              className="relative flex items-center justify-start flex-1 min-w-0 group cursor-pointer select-none"
                              onDoubleClick={() => togglePinColumn(col.id)}
                            >
                              <div className="flex items-center gap-1.5 flex-1 overflow-hidden">
                                <col.icon className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate">{col.label}</span>
                              </div>
                              <button
                                onClick={() => togglePinColumn(col.id)}
                                className={`ml-2 p-1 rounded hover:bg-gray-200 transition-opacity flex-shrink-0 ${isPinned ? "opacity-100 text-blue-600" : "opacity-0 group-hover:opacity-100 text-gray-400"
                                  }`}
                                title={isPinned ? "Unpin Column" : "Pin Column"}
                              >
                                {isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-start gap-1.5 whitespace-nowrap flex-1 min-w-0">
                              {col.icon && <col.icon className="w-3.5 h-3.5 flex-shrink-0" />}
                              <span>{col.label}</span>
                            </div>
                          )}

                          <div
                            className="flex flex-col ml-1 flex-shrink-0 cursor-pointer"
                            onClick={() => handleSort(col.id)}
                          >
                            <ChevronUp
                              className={`w-3 h-3 ${sortConfig.key === col.id && sortConfig.direction === "asc"
                                ? "text-blue-600"
                                : "text-gray-400"
                                }`}
                            />
                            <ChevronDown
                              className={`w-3 h-3 -mt-1 ${sortConfig.key === col.id && sortConfig.direction === "desc"
                                ? "text-blue-600"
                                : "text-gray-400"
                                }`}
                            />
                          </div>
                        </div>

                        {col.id !== "actions" && (
                          <div
                            onMouseDown={(e) => startResize(e, col.id)}
                            className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-blue-400 z-10 ${resizingCol === col.id ? "bg-blue-500" : "bg-transparent"
                              }`}
                          />
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E4EA] bg-white">
                {paginatedDeals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 font-medium">
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
                    return (
                      <tr key={deal._id} className="hover:bg-gray-50 transition-colors group">
                        <td
                          style={{ height: 54 }}
                          className="px-3 text-[14px] leading-5 font-medium text-[#525866] whitespace-nowrap text-left"
                        >
                          DL-{deal._id.slice(-5).toUpperCase()}
                        </td>
                        <td style={{ height: 54 }} className="px-3 text-left">
                          <Link
                            to={`/deals/${deal._id}`}
                            className="text-[14px] leading-5 font-medium text-[#222530] hover:text-blue-600 truncate block"
                          >
                            {deal.title || "Deal Name"}
                          </Link>
                        </td>
                        <td
                          style={{ height: 54 }}
                          className="px-3 text-[14px] leading-5 font-medium text-[#222530] truncate text-left"
                        >
                          {deal.contact?.name || "-"}
                        </td>
                        <td style={{ height: 54 }} className="px-3">
                          <div className="flex items-center justify-start">
                            <span
                              style={{ width: 80, height: 24, padding: "5px 12px", borderRadius: 53, ...pillStyle }}
                              className="inline-flex items-center justify-center text-xs font-medium"
                            >
                              {deal.status || "Open"}
                            </span>
                          </div>
                        </td>
                        <td
                          style={{ height: 54 }}
                          className="px-3 text-[14px] leading-5 font-medium text-[#525866] whitespace-nowrap text-left"
                        >
                          ₹{(deal.amount || 0).toLocaleString("en-IN")}
                        </td>
                        <td
                          style={{ height: 54 }}
                          className="px-3 text-[14px] leading-5 font-medium text-[#525866] whitespace-nowrap"
                        >
                          <div className="relative flex items-center justify-start">
                            <span>{lastUpdated}</span>
                            <button
                              className="absolute right-0 p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                              title="More options"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalCount > 0 && (
            <div className="w-full bg-white px-4 py-3 flex items-center justify-between sm:px-6">
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

                  {totalPages > 0 &&
                    getPageNumbers().map((pageNum, index) =>
                      pageNum === "..." ? (
                        <span
                          key={`dots-${index}`}
                          className="flex items-center justify-center w-8 h-8 text-sm font-medium text-gray-500"
                        >
                          ...
                        </span>
                      ) : (
                        <button
                          key={`page-${pageNum}`}
                          onClick={() => handlePageChange(pageNum)}
                          className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${pageNum === currentPage
                            ? "bg-blue-600 text-white"
                            : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                            }`}
                        >
                          {pageNum}
                        </button>
                      ),
                    )}

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
        </>
      )}
    </div>
  );
}
