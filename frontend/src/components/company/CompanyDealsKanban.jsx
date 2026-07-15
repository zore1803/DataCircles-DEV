import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  DndContext,
  closestCorners,
  useDraggable,
  useDroppable,
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
  MoreVertical,
  Building2,
} from "lucide-react";
import toast from "react-hot-toast";
import API from "../../services/api";

const TERMINAL_STATUSES = ["won", "lost"];

const Avatar = ({ name, className = "" }) => (
  <div
    className={`w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[10px] font-semibold text-gray-600 ${className}`}
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
      className="block bg-white border border-gray-200 rounded-xl p-4 mb-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow"
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {deal.title || "Deal Name"}
        </p>
        <MoreVertical size={14} className="text-gray-300 flex-shrink-0" />
      </div>
      <p className="text-sm text-gray-700 mb-2">
        ₹{(deal.amount || 0).toLocaleString("en-IN")}
      </p>
      {(tagLabel || avatarNames.length > 0) && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          {tagLabel ? (
            <span className="flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 px-2 py-1 rounded-md truncate">
              <Building2 size={11} className="flex-shrink-0" />
              {tagLabel}
            </span>
          ) : (
            <span />
          )}
          {avatarNames.length > 0 && (
            <div className="flex -space-x-1.5 flex-shrink-0">
              {avatarNames.map((name, idx) => (
                <Avatar key={idx} name={name} />
              ))}
            </div>
          )}
        </div>
      )}
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

export default function CompanyDealsKanban({ deals, setDeals }) {
  const [statuses, setStatuses] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("board");

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
    if (!searchTerm.trim()) return deals;
    const q = searchTerm.toLowerCase();
    return deals.filter((d) => (d.title || "").toLowerCase().includes(q));
  }, [deals, searchTerm]);

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

  return (
    <div>
      {/* KPI Tiles */}
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

      {/* Search + Controls */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by deal name..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-blue-300"
          />
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50">
          <Filter size={14} />
          Filter
        </button>
        <div className="flex items-center bg-gray-100 rounded-full p-1">
          <button
            onClick={() => setViewMode("board")}
            className={`p-1.5 rounded-full transition-colors ${viewMode === "board" ? "bg-white shadow-sm text-blue-600" : "text-gray-500"
              }`}
          >
            <LayoutGrid size={14} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-full transition-colors ${viewMode === "list" ? "bg-white shadow-sm text-blue-600" : "text-gray-500"
              }`}
          >
            <ListIcon size={14} />
          </button>
        </div>
        <Link
          to="/deals"
          className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
          title="Add Deal"
        >
          <Plus size={16} />
        </Link>
      </div>

      {viewMode === "board" ? (
        <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDeals.length === 0 ? (
            <div className="text-sm text-gray-500 bg-gray-50 p-6 rounded-xl border border-dashed border-gray-200 text-center col-span-full">
              No deals found for this company.
            </div>
          ) : (
            filteredDeals.map((deal) => (
              <Link
                to={`/deals/${deal._id}`}
                key={deal._id}
                className="group flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:shadow-sm hover:border-blue-300 transition-all"
              >
                <div className="w-10 h-10 bg-blue-100 group-hover:bg-blue-200 transition-colors rounded-full flex items-center justify-center font-semibold text-blue-700 flex-shrink-0">
                  <Gem size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                    {deal.title}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {deal.status || "Open"}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
