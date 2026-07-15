import React, { useEffect, useState, useMemo, useRef } from "react";
import API from "../services/api";
import { formatNumberToIndian } from "../utils/numberFormatter";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  sortableKeyboardCoordinates,
  useSortable,
  SortableContext,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { autoTable } from "jspdf-autotable";
import DealsForm from "../components/deal/DealsForm";
import ImportDeals from "../components/deal/ImportDeals";
import BulkActions from "../components/BulkActions";
import logo from "/DataCircles.png";
import {
  ChevronUp,
  ChevronDown,
  MoreVertical,
  Edit2,
  X,
  Trash2,
  FileText,
  Tag,
  IndianRupee,
  Calendar,
  Building2,
  CheckSquare,
  Search,
  Plus,
  Filter,
  Download,
  Upload,
  MoreHorizontal,
  CalendarDays,
  Briefcase,
  Settings
} from "lucide-react";

import toast from "react-hot-toast";
import confetti from "canvas-confetti";
// Note: We are replacing the external KanbanColumn with an internal Modern version
// import KanbanColumn from "../components/deal/KanbanColumn"; 
import DealsTable from "../components/deal/DealsTable";
import VideoTutorialModal from "../components/VideoTutorialModal";
import { getVideoTutorial } from "../utils/videoTutorials";
import VideoTutorialButton from "../components/VideoTutorialButton";
import ExportModal from "../components/common/ExportModal";
import DealQuickView from "../components/deal/DealQuickView";
// Add these to your existing lucide-react imports:

// Add these to your component imports:
import ColumnSettingsPanel from "../components/ColumnSettingsPanel";
import { useColumnSettings } from "../hooks/useColumnSettings";
import AppToaster from "../components/AppToaster";

// Array of cool loading messages relevant for dashboard
const loadingMessages = [
  "Tracking every opportunity — from lead to win!",
  "Your deal pipeline is getting ready to roll!",
  "Visualizing your sales journey — almost there!",
  "Because every deal deserves clarity.",
  "Your next big win is loading…",
  "Turning opportunities into outcomes — hang tight!",
  "Smart deal tracking — simplified with DataCircles.",
  "Let’s make your sales funnel flow smoother!",
  "Every deal tells a story — fetching yours now.",
  "DataCircles — where deals turn into growth.",
];



// Select a random message
const randomMessage =
  loadingMessages[Math.floor(Math.random() * loadingMessages.length)];

// Export strategies following Open/Closed principle
class ExcelExporter {
  static export(deals) {
    const data = deals?.map((deal) => ({
      Title: deal.title || "",
      Amount: deal.amount || "",
      Status: deal.status || "",
      Company: deal.company?.name || "N/A",
      Contact: deal.contact?.name || "N/A",
      "Created Date": new Date(deal.createdAt).toLocaleDateString(),
      "Updated Date": new Date(deal.updatedAt).toLocaleDateString(),
    }));

    // Generate CSV content
    const ws = window.XLSX?.utils.json_to_sheet(data);
    const csv = window.XLSX?.utils.sheet_to_csv(ws, {
      FS: ",", // Field separator (comma)
      RS: "\n", // Row separator (newline)
      forceQuotes: true, // Enclose all fields in quotes to handle special characters
      blankrows: false, // Skip blank rows
    });

    // Create a downloadable CSV file
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `deals_export_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

class PDFExporter {
  static export(deals) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Deals Report", 14, 20);

    const tableColumn = [
      "#",
      "Title",
      "Amount",
      "Status",
      "Company",
      "Contact",
    ];
    const tableRows = [];

    deals.forEach((deal, index) => {
      const dealData = [
        index + 1,
        deal.title || "—",
        `₹${formatNumberToIndian(parseInt(deal.amount || 0))}`,
        deal.status || "—",
        deal.company?.name || "—",
        deal.contact?.name || "—",
      ];
      tableRows.push(dealData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      styles: {
        fontSize: 10,
        cellPadding: 3,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [52, 144, 220],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      margin: { top: 30 },
    });

    doc.save(`deals_report_${new Date().toISOString().split("T")[0]}.pdf`);
  }
}

const QuickActionDropZone = ({
  status,
  icon,
  bgColor,
  borderColor,
  textColor,
  hoverBorderColor,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `quick-${status}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`relative bg-white border-2 ${isOver ? "border-gray-400 shadow-md" : "border-gray-200"
        } rounded-lg px-5 py-3 transition-all duration-200 ${isOver ? "scale-105" : "hover:border-gray-300"
        } flex items-center gap-3 min-w-[50%] cursor-pointer`}
    >
      {/* Icon */}
      <div
        className={`flex-shrink-0 transition-transform ${isOver ? "scale-110" : ""
          }`}
      >
        <div
          className={`w-8 h-8 flex items-center justify-center ${status === "Won" ? "text-gray-700" : "text-gray-600"
            }`}
        >
          {icon}
        </div>
      </div>

      {/* Text */}
      <div className="flex flex-col">
        <p className="text-sm font-semibold text-gray-900">{status}</p>
        <p className="text-xs text-gray-500">
          {isOver ? "Release now" : "Drop here"}
        </p>
      </div>

      {/* Subtle indicator line when hovering */}
      {isOver && (
        <div
          className={`absolute bottom-0 left-0 right-0 h-1 rounded-b-lg ${status === "Won" ? "bg-gray-700" : "bg-gray-600"
            }`}
        ></div>
      )}
    </div>
  );
};

const DealSettingSidebar = ({ isOpen, onClose, staleDays, setStaleDays }) => {
  const [days, setDays] = useState(staleDays);

  useEffect(() => {
    setDays(staleDays);
  }, [staleDays]);

  const handleSave = async () => {
    const loadingToast = toast.loading("Updating stale days...");

    try {
      const res = await API.put("/deal-settings", { staleDays: days });
      setStaleDays(res.data.staleDays);
      toast.success("Stale days updated successfully", { id: loadingToast });
      onClose();
    } catch (error) {
      console.error("Error updating stale days:", error);
      if (error.response?.status === 402) {
        toast.error(error.response?.data?.message || "An active subscription is required to make changes.", { id: loadingToast });
      } else {
        toast.error(error.response?.data?.error || "Failed to update stale days", { id: loadingToast });
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/20 flex justify-end z-[100005]"
      onClick={onClose}
    >
      <div
        className="bg-white w-80 h-full p-6 shadow-lg overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Deal Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Stale after (days):
          </label>
          <input
            type="number"
            min="0"
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value) || 0)}
            className="border border-gray-300 rounded-lg p-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-2 text-xs text-gray-500">
            Deals older than this will be highlighted in red.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white font-medium text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition flex-1"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="bg-gray-200 text-gray-900 font-medium text-sm px-4 py-2 rounded-lg hover:bg-gray-300 transition flex-1"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// --- MODERN UI COMPONENTS (New) ---

const ModernDealCard = ({ deal, onClick, isStale, colorTheme = "blue" }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Safe formatting
  const amount = deal.amount ? formatNumberToIndian(parseInt(deal.amount)) : "0";
  const date = new Date(deal.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  const companyName = deal.company?.name || "No Company";

  // Stale check style (Removed as per request)
  // const staleStyle = isStale(deal.createdAt) ? "border-l-4 border-l-red-500" : "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(deal)}
      className={`bg-[#FFFFFF] border border-gray-200 p-4 rounded-lg space-y-4 hover:shadow-lg transition-shadow cursor-grab active:cursor-grabbing group relative`}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          {/* Avatar Placeholder */}
          <img
            src={`https://api.dicebear.com/7.x/initials/svg?seed=${deal.contact?.name || deal.title}`}
            className="w-6 h-6 rounded-full bg-slate-100"
            alt="avatar"
          />
          <span className={`text-[10px] font-medium bg-${colorTheme}-50 text-[#111216] px-2 py-0.5 rounded uppercase tracking-wider truncate max-w-[120px]`}>
            {deal.status}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[#111216]">
          <CalendarDays style={{ fontSize: 12, width: 12, height: 12 }} />
          <span className="text-[10px]">{date}</span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-lg font-bold text-[#111216]">₹{amount}</div>
        <div className="text-sm font-medium text-[#111216] line-clamp-2 leading-tight">
          {deal.title}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-[#111216] mt-3 bg-[#E0E0E1] rounded-md px-2 py-1 w-fit">
        <Briefcase style={{ fontSize: 14, width: 14, height: 14 }} />
        <span className="truncate">{companyName}</span>
      </div>
    </div>
  );
};

const ModernKanbanColumn = ({
  status,
  deals,
  colorTheme = "blue",
  onAddClick,
  handleEditDeal,
  isStale
}) => {
  const { setNodeRef } = useDroppable({ id: status });
  const dealIds = useMemo(() => deals.map((d) => d._id), [deals]);

  const totalAmount = deals.reduce((sum, deal) => sum + (parseInt(deal.amount) || 0), 0);
  const formattedTotal = formatNumberToIndian(totalAmount);

  // Dynamic Tailwind Classes based on theme
  const bgSoft = `bg-${colorTheme}-50/30`;
  const bgDarkSoft = `dark:bg-${colorTheme}-900/10`;
  const border = `border-${colorTheme}-100`;
  const borderDark = `dark:border-${colorTheme}-900/20`;
  const textDark = `text-${colorTheme}-700`;
  const textLight = `dark:text-${colorTheme}-300`;
  const badgeBg = `bg-${colorTheme}-100`;
  const badgeBgDark = `dark:bg-${colorTheme}-900/40`;
  const textColor = `text-${colorTheme}-600`;

  return (
    <div className="min-w-[368px] w-[368px] flex-shrink-0 space-y-4 pt-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 ${badgeBg} ${badgeBgDark} ${textDark} ${textLight} rounded text-xs font-semibold`}>
            {status}
          </span>
          <span className="text-black text-sm font-medium">{deals.length}</span>
        </div>
        <button
          onClick={onAddClick}
          className="text-black cursor-pointer hover:text-blue-600 transition-colors"
        >
          <Plus fontSize="small" className="w-5 h-5" />
        </button>
      </div>

      {/* Summary Card */}
      <div className={`bg-gradient-to-r from-white to-${colorTheme}-100 border border-[#E5E5EC] p-4 rounded-xl`}>
        <div className="flex justify-between items-start">
          <span className="text-xl font-bold text-black">₹{formattedTotal}</span>
          {/* Static growth indicator for UI demo, could be dynamic */}
          <span className="text-[#111216] text-xs font-semibold">Total</span>
        </div>
      </div>

      {/* Droppable Area */}
      <div
        ref={setNodeRef}
        className="flex-1 space-y-4 min-h-[150px]"
      >
        <SortableContext
          id={status}
          items={dealIds}
          strategy={verticalListSortingStrategy}
        >
          {deals.map((deal) => (
            <ModernDealCard
              key={deal._id}
              deal={deal}
              onClick={handleEditDeal}
              isStale={isStale}
              colorTheme={colorTheme}
            />
          ))}
        </SortableContext>
        {/* Spacer for easier dropping at bottom */}
        <div className="h-10 w-full" />
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

function Deals() {
  const [deals, setDeals] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState({
    title: "",
    amount: "",
    status: "Open",
    company: "",
    contact: "",
  });
  const [loading, setLoading] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: "All",
    company: "All",
    user: "All",
    minAmount: "",
    maxAmount: "",
    startDate: "",
    endDate: "",
    searchTerm: "",
  });
  const [name, setName] = useState("");
  const [showKanban, setShowKanban] = useState(true);
  const [permission, setPermission] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [dealFields, setDealFields] = useState([]);
  const [additionalFieldValues, setAdditionalFieldValues] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [dealToDelete, setDealToDelete] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = location;
  const [showImport, setShowImport] = useState(false);
  const [staleDays, setStaleDays] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [activeDeal, setActiveDeal] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });
  // Video Tutorial State
  const [showVideoTutorial, setShowVideoTutorial] = useState(false);


  const [quickViewDealId, setQuickViewDealId] = useState(null);

  // NEW: Confetti celebration state
  const [celebrationDeal, setCelebrationDeal] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportButtonRef = useRef(null);

  // Add these states at the top of your Deals component
  const [selectionMode, setSelectionMode] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [users, setUsers] = useState([]);
  const [overId, setOverId] = useState(null);

  const [showExportModal, setShowExportModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // 👉 NEW: Column Settings State & Logic
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  const defaultColumns = useMemo(() => {
    const baseColumns = [
      { key: "title", label: "Deal Title", visible: true, order: 0, required: true, defaultVisible: true, sortable: true },
      { key: "amount", label: "Amount", visible: true, order: 1, sortable: true },
      { key: "status", label: "Stage", visible: true, order: 2, sortable: true },
      { key: "company", label: "Company", visible: true, order: 3, sortable: true },
      { key: "contact", label: "Contact", visible: true, order: 4, sortable: true },
    ];

    if (dealFields && dealFields.length > 0) {
      const customColumns = dealFields.map((field, index) => ({
        key: field.name || field,
        label: field.name || field,
        visible: false, // Hidden by default
        order: baseColumns.length + index,
        isCustomField: true,
        type: field.type || "text",
        options: field.options,
        description: `Custom field: ${field.name || field}`,
      }));
      return [...baseColumns, ...customColumns];
    }
    return baseColumns;
  }, [dealFields]);

  const { columns, saveColumns, getVisibleColumns } = useColumnSettings(
    "deals",
    defaultColumns
  );

  const visibleColumns = useMemo(() => getVisibleColumns(), [columns]);
  // ----------------------------------------------------

  const [starredDeals, setStarredDeals] = useState(() => {
    const saved = localStorage.getItem("starred_deals");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("starred_deals", JSON.stringify(starredDeals));
  }, [starredDeals]);

  const toggleStar = (e, dealId) => {
    e.stopPropagation();
    setStarredDeals((prev) =>
      prev.includes(dealId)
        ? prev.filter((id) => id !== dealId)
        : [...prev, dealId]
    );
  };

  // Columns specifically mapped for the Export Modal
  const exportColumns = useMemo(() => {
    const baseCols = [
      { key: "title", label: "Deal Title", visible: true },
      { key: "amount", label: "Amount", visible: true },
      { key: "status", label: "Stage", visible: true },
      { key: "company", label: "Company", visible: true },
      { key: "contact", label: "Contact", visible: true },
    ];

    // Add custom fields
    const customCols = (dealFields || []).map((field) => ({
      key: field.name || field,
      label: field.name || field,
      visible: false, // Hidden by default in export
      isCustomField: true,
    }));

    return [...baseCols, ...customCols];
  }, [dealFields]);

  // Add these handler functions in your Deals component

  // Long press handlers
  const handleRowMouseDown = (dealId) => {
    const timer = setTimeout(() => {
      setSelectionMode(true);
      if (!selectedRows.includes(dealId)) {
        setSelectedRows([...selectedRows, dealId]);
      }
    }, 500); // 500ms for long press
    setLongPressTimer(timer);
  };

  const handleRowMouseUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };


  const handleRowTouchStart = (dealId) => {
    const timer = setTimeout(() => {
      setSelectionMode(true);
      if (!selectedRows.includes(dealId)) {
        setSelectedRows([...selectedRows, dealId]);
      }
    }, 500);
    setLongPressTimer(timer);
  };

  const handleRowTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // Bulk delete handler
  // Bulk handlers
  const handleBulkDeleteDeals = async (itemIds) => {
    setLoading(true);
    try {
      await Promise.all(itemIds.map((id) => API.delete(`/deals/${id}`)));
      await fetchDeals();
      setSelectedRows([]);
      setSelectionMode(false);
      toast.success(`Successfully deleted ${itemIds.length} deals`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Bulk delete failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpdateDeals = async ({ field, value, itemIds }) => {
    setLoading(true);
    try {
      await Promise.all(
        itemIds.map((id) => {
          const payload = { [field]: value };
          return API.put(`/deals/${id}`, payload);
        }),
      );
      await fetchDeals();
      setSelectedRows([]);
      setSelectionMode(false);
      toast.success(`Successfully updated ${itemIds.length} deals`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Bulk update failed");
    } finally {
      setLoading(false);
    }
  };

  // Deal field config
  const dealFieldConfig = {
    fields: [
      {
        key: "status",
        label: "Stage",
        type: "select",
        options: statuses,
      },
    ],
  };

  // dnd-kit sensors configuration
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        exportButtonRef.current &&
        !exportButtonRef.current.contains(event.target)
      ) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sorting function
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // Sort deals based on sortConfig
  // Sort deals based on starred status first, then sortConfig
  const getSortedDeals = (deals) => {
    if (!deals || deals.length === 0) return [];

    return [...deals].sort((a, b) => {
      // 1. Primary Sort: Starred Deals always float to the top
      // (Assumes starredDeals state is in scope from step 1)
      const isAStarred = starredDeals.includes(a._id);
      const isBStarred = starredDeals.includes(b._id);

      if (isAStarred && !isBStarred) return -1;
      if (!isAStarred && isBStarred) return 1;

      // 2. Secondary Sort: Apply standard column sorting if active
      if (!sortConfig.key) return 0;

      let aValue, bValue;

      if (sortConfig.key === "company") {
        aValue = a.company?.name || "";
        bValue = b.company?.name || "";
      } else if (sortConfig.key === "amount") {
        aValue = parseInt(a.amount || 0);
        bValue = parseInt(b.amount || 0);
      } else if (sortConfig.key === "updatedAt") {
        aValue = new Date(a.updatedAt);
        bValue = new Date(b.updatedAt);
      } else {
        aValue = a[sortConfig.key] || "";
        bValue = b[sortConfig.key] || "";
      }

      if (typeof aValue === "string") aValue = aValue.toLowerCase();
      if (typeof bValue === "string") bValue = bValue.toLowerCase();

      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  };

  // Component for sortable column header
  const SortableHeader = ({ field, children, className = "" }) => (
    <th
      className={`px-4 py-2 cursor-pointer hover:bg-gray-100 select-none ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <div className="flex flex-col">
          <ChevronUp
            className={`w-3 h-3 ${sortConfig.key === field && sortConfig.direction === "asc"
              ? "text-blue-600"
              : "text-gray-400"
              }`}
          />
          <ChevronDown
            className={`w-3 h-3 -mt-1 ${sortConfig.key === field && sortConfig.direction === "desc"
              ? "text-blue-600"
              : "text-gray-400"
              }`}
          />
        </div>
      </div>
    </th>
  );

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchStatuses(),
          fetchDeals(),
          fetchCompanies(),
          fetchContacts(),
          fetchName(),
          fetchPermission(),
          fetchDealFields(),
          fetchStaleDays(),
          fetchUsers(),
        ]);
      } catch (error) {
        toast.error("Failed to load data", {
          style: {
            zIndex: 99999,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            color: "#374151",
            padding: "10px",
            fontSize: "14px",
            maxWidth: "90vw",
          },
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await API.get("/auth/all-user"); // Adjust endpoint if needed: /users or /auth/users
      setUsers(res.data.allUsers || res.data); // Adjust based on your API response
    } catch (error) {
      console.error("Error fetching users:", error);
      // Don't block UI if users fail to load
    }
  };

  const fetchStaleDays = async () => {
    try {
      const res = await API.get("/deal-settings");
      setStaleDays(res.data?.staleDays || 0);
    } catch (error) {
      console.error("Failed to fetch stale days", error);
      toast.error("Failed to fetch stale days", {
        style: {
          zIndex: 99999,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          color: "#374151",
          padding: "10px",
          fontSize: "14px",
          maxWidth: "90vw",
        },
      });
    }
  };

  const fetchDealFields = async () => {
    try {
      const res = await API.get("/deal-fields");
      if (res.data?.fields) {
        const fieldData = res.data.fields;
        if (fieldData.length > 0 && typeof fieldData[0] === "object") {
          setDealFields(fieldData);
        } else {
          setDealFields(fieldData);
        }
      }
    } catch (error) {
      console.error("Failed to fetch deal fields", error);
      toast.error("Failed to fetch deal fields", {
        style: {
          zIndex: 99999,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          color: "#374151",
          padding: "10px",
          fontSize: "14px",
          maxWidth: "90vw",
        },
      });
    }
  };

  const fetchPermission = async () => {
    try {
      const res = await API.get("/auth/me");
      const user = res.data.user;
      const dealPerm = user?.permissions?.find(
        (p) => p?.name.toLowerCase() === "deals",
      );
      setPermission(dealPerm?.permission || "no");
    } catch (err) {
      console.error("Failed to fetch permission");
      toast.error("Failed to fetch permission", {
        style: {
          zIndex: 99999,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          color: "#374151",
          padding: "10px",
          fontSize: "14px",
          maxWidth: "90vw",
        },
      });
    }
  };

  const fetchName = async () => {
    try {
      const res = await API.get("/kanban-name");
      setName(res.data?.name);
    } catch (error) {
      console.error("Error fetching Name:", error);
      toast.error("Failed to fetch kanban name", {
        style: {
          zIndex: 99999,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          color: "#374151",
          padding: "10px",
          fontSize: "14px",
          maxWidth: "90vw",
        },
      });
    }
  };

  const fetchStatuses = async () => {
    try {
      const res = await API.get("/kanban");
      setStatuses(res.data?.statuses);
    } catch (error) {
      console.error("Error fetching statuses:", error);
      toast.error("Failed to fetch statuses", {
        style: {
          zIndex: 99999,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          color: "#374151",
          padding: "10px",
          fontSize: "14px",
          maxWidth: "90vw",
        },
      });
    }
  };

  const fetchDeals = async () => {
    try {
      const res = await API.get("/deals");
      setDeals(res.data);
    } catch (error) {
      console.error("Error fetching deals:", error);
      toast.error("Failed to fetch deals", {
        style: {
          zIndex: 99999,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          color: "#374151",
          padding: "10px",
          fontSize: "14px",
          maxWidth: "90vw",
        },
      });
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await API.get("/companies");
      setCompanies(res.data);
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast.error("Failed to fetch companies", {
        style: {
          zIndex: 99999,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          color: "#374151",
          padding: "10px",
          fontSize: "14px",
          maxWidth: "90vw",
        },
      });
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await API.get("/contacts");
      setContacts(res.data);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      toast.error("Failed to fetch contacts", {
        style: {
          zIndex: 99999,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          color: "#374151",
          padding: "10px",
          fontSize: "14px",
          maxWidth: "90vw",
        },
      });
    }
  };

  const handleEditDeal = (deal) => {
    setForm({
      _id: deal._id,
      title: deal.title || "",
      amount: deal.amount || "",
      status: deal.status || "Open",
      company: deal.company?._id || "",
      contact: deal.contact?._id || "",
    });

    const processedFields = {};
    if (deal.additionalFields) {
      deal.additionalFields.forEach((field) => {
        processedFields[field.key] = field.value;
      });
    }

    setAdditionalFieldValues(processedFields);
    setShowForm(true);
  };

  const handleDeleteDeal = (dealId) => {
    if (permission !== "read-write") {
      toast.error("You do not have permission to delete deals.", {
        style: {
          zIndex: 99999,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          color: "#374151",
          padding: "10px",
          fontSize: "14px",
          maxWidth: "90vw",
        },
      });
      return;
    }

    setDealToDelete(dealId);
    setShowDeleteModal(true);
  };

  const confirmDeleteDeal = async () => {
    if (!dealToDelete) return;

    const loadingToast = toast.loading("Deleting deal...", {
      style: {
        zIndex: 99999,
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        color: "#374151",
        padding: "10px",
        fontSize: "14px",
        maxWidth: "90vw",
      },
    });

    try {
      setLoading(true);
      await API.delete(`/deals/${dealToDelete}`);
      setDeals((prevDeals) =>
        prevDeals.filter((deal) => deal._id !== dealToDelete),
      );
      // Remove from selected rows if it was selected
      setSelectedRows((prev) => prev.filter((id) => id !== dealToDelete));
      toast.success("Deal deleted successfully!", {
        id: loadingToast,
        style: {
          zIndex: 99999,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          color: "#374151",
          padding: "10px",
          fontSize: "14px",
          maxWidth: "90vw",
        },
      });
    } catch (error) {
      console.error("Error deleting deal:", error);
      let errorMessage = "Failed to delete deal";
      if (error.response && error.response.status === 402) {
        errorMessage = error.response.data.message || "An active subscription is required to make changes.";
      } else if (error.response && error.response.status === 403) {
        errorMessage = error.response.data.message || "Access denied";
      }
      toast.error(errorMessage, {
        id: loadingToast,
        style: {
          zIndex: 99999,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          color: "#374151",
          padding: "10px",
          fontSize: "14px",
          maxWidth: "90vw",
        },
      });
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
      setDealToDelete(null);
    }
  };

  // dnd-kit handlers
  const handleDragStart = (event) => {
    const { active } = event;
    const deal = deals.find((d) => d._id.toString() === active.id.toString());
    setActiveDeal(deal);
  };

  const handleDragOver = (event) => {
    const { active, over } = event;

    if (!over) {
      setOverId(null);
      return;
    }

    setOverId(over.id);

    const activeId = active.id.toString();
    const overId = over.id.toString();

    if (activeId === overId) return;

    // Find which status the active deal belongs to
    const activeDeal = deals.find((d) => d._id.toString() === activeId);
    if (!activeDeal) return;

    const activeStatus = activeDeal.status;

    // Find which status we're hovering over
    // Check if overId is a status (column) or another deal
    let overStatus;

    // Handle Quick Drop Zones
    if (overId.startsWith("quick-")) {
      overStatus = overId.replace("quick-", "");
    } else if (statuses.includes(overId)) {
      // Dropped on a column header
      overStatus = overId;
    } else {
      // Find the deal we're hovering over
      const overDeal = deals.find((d) => d._id.toString() === overId);
      if (overDeal) {
        overStatus = overDeal.status;
      }
    }

    if (!overStatus || activeStatus === overStatus) {
      // Same column, no need to update
      return;
    }

    // IMPORTANT: Optimistically update the UI for cross-column dragging
    // This makes other items create space immediately
    setDeals((prevDeals) => {
      const newDeals = prevDeals.map((deal) => {
        if (deal._id.toString() === activeId) {
          return { ...deal, status: overStatus };
        }
        return deal;
      });
      return newDeals;
    });
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    setActiveDeal(null);
    setOverId(null);

    if (!over) {
      console.log("Dropped outside droppable area");
      await fetchDeals();
      return;
    }

    if (permission !== "read-write") {
      toast.error("You do not have permission to update deal status.");
      await fetchDeals();
      return;
    }

    const dealId = active.id.toString();
    let newStatus = over.id.toString();

    // Handle Quick Drop Zones
    if (newStatus.startsWith("quick-")) {
      newStatus = newStatus.replace("quick-", "");
    }

    const droppedOnDeal = deals.find((d) => d._id.toString() === newStatus);
    if (droppedOnDeal) {
      newStatus = droppedOnDeal.status;
    }

    // IMPORTANT: Find the ORIGINAL deal from the initial deals state
    // NOT from the current deals which was updated by onDragOver
    const originalDeal = deals.find((deal) => deal._id.toString() === dealId);

    if (!originalDeal) {
      console.error("Deal not found:", dealId);
      await fetchDeals();
      return;
    }

    // Get OLD status from activeDeal that was saved in handleDragStart
    // This is the status BEFORE any drag operation
    const oldStatus = activeDeal?.status || originalDeal.status;

    if (oldStatus === newStatus) {
      console.log("Dropped in same column");
      return;
    }

    console.log(`Moving deal from ${oldStatus} to ${newStatus}`);

    try {
      const response = await API.post(`/deals/${dealId}/status`, {
        oldStatus, // Use oldStatus here
        newStatus,
      });

      setDeals((prevDeals) =>
        prevDeals.map((deal) =>
          deal._id.toString() === dealId ? response.data : deal,
        ),
      );

      // CHECK WITH oldStatus (not originalStatus)
      if (newStatus === "Won" && oldStatus !== "Won") {
        console.log("🎉 DEAL WON! Triggering celebration...");
        setCelebrationDeal(response.data);
        toast.success(`🎉 ${response.data.title} marked as Won!`, {
          duration: 5000,
          icon: "🏆",
        });
      } else {
        toast.success("Deal status updated successfully");
      }
    } catch (error) {
      console.error("Error updating deal status:", error);
      await fetchDeals();
      if (error.response?.status === 402) {
        toast.error(error.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(error.response?.data?.error || "Failed to update deal status");
      }
    }
  };

  const handleStatusChange = async (dealId, oldStatus, newStatus) => {
    if (permission !== "read-write") {
      toast.error("You do not have permission to update deal status.", {
        style: {
          zIndex: 99999,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          color: "#374151",
          padding: "10px",
          fontSize: "14px",
          maxWidth: "90vw",
        },
      });
      return;
    }

    setDeals((prevDeals) =>
      prevDeals?.map((deal) =>
        deal._id === dealId ? { ...deal, status: newStatus } : deal,
      ),
    );

    try {
      const response = await API.post(`/deals/${dealId}/status`, {
        oldStatus,
        newStatus,
      });
      console.log("Deal status updated successfully:", response.data);
      setDeals((prevDeals) =>
        prevDeals?.map((deal) => (deal._id === dealId ? response.data : deal)),
      );
      toast.success("Deal status updated successfully", {
        style: {
          zIndex: 99999,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          color: "#374151",
          padding: "10px",
          fontSize: "14px",
          maxWidth: "90vw",
        },
      });
    } catch (error) {
      console.error("Error updating deal status:", error);
      if (error.response?.status === 409) {
        const currentStatus = error.response.data.currentStatus;
        setDeals((prevDeals) =>
          prevDeals?.map((deal) =>
            deal._id === dealId ? { ...deal, status: currentStatus } : deal,
          ),
        );
        toast.error(error.response.data.error, {
          style: {
            zIndex: 99999,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            color: "#374151",
            padding: "10px",
            fontSize: "14px",
            maxWidth: "90vw",
          },
        });
      } else {
        setDeals((prevDeals) =>
          prevDeals?.map((deal) =>
            deal._id === dealId ? { ...deal, status: oldStatus } : deal,
          ),
        );
        const errorMsg = error.response?.status === 402
          ? (error.response?.data?.message || "An active subscription is required to make changes.")
          : (error.response?.data?.error || "Failed to update deal status");
        toast.error(errorMsg, {
          style: {
            zIndex: 99999,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            color: "#374151",
            padding: "10px",
            fontSize: "14px",
            maxWidth: "90vw",
          },
        });
      }
    }
  };

  const isStale = (createdAt) => {
    if (staleDays <= 0) return false;
    const daysDiff = (new Date() - new Date(createdAt)) / (1000 * 60 * 60 * 24);
    return daysDiff > staleDays;
  };

  // Filter strategies
  class StatusFilter {
    static filter(deals, status) {
      return status === "All"
        ? deals
        : deals.filter((deal) => deal.status === status);
    }
  }

  class AmountFilter {
    static filter(deals, minAmount, maxAmount) {
      return deals.filter((deal) => {
        const amount = parseInt(deal.amount || 0);
        return amount >= minAmount && amount <= maxAmount;
      });
    }
  }

  class UserFilter {
    static filter(deals, userId) {
      if (userId === "All" || !userId) return deals;
      return deals.filter(
        (deal) => deal.user?._id === userId || deal.user === userId,
      );
    }
  }

  class CompanyFilter {
    static filter(deals, companyId) {
      return companyId === "All"
        ? deals
        : deals.filter(
          (deal) =>
            deal.company === companyId || deal.company?._id === companyId,
        );
    }
  }

  class DateFilter {
    static filter(deals, startDate, endDate) {
      if (!startDate && !endDate) return deals;
      const start = startDate ? new Date(startDate) : new Date("1900-01-01");
      const end = endDate ? new Date(endDate) : new Date("2100-12-31");
      return deals.filter((deal) => {
        const d = new Date(deal.createdAt);
        return d >= start && d <= end;
      });
    }
  }

  const filteredDeals = useMemo(() => {
    let filtered = [...deals];

    filtered = StatusFilter.filter(filtered, filters.status);
    filtered = CompanyFilter.filter(filtered, filters.company);
    filtered = UserFilter.filter(filtered, filters.user); // Add this line

    if (filters.minAmount || filters.maxAmount) {
      const min = parseInt(filters.minAmount || 0);
      const max = parseInt(filters.maxAmount || Infinity);
      filtered = AmountFilter.filter(filtered, min, max);
    }
    if (filters.startDate || filters.endDate) {
      filtered = DateFilter.filter(
        filtered,
        filters.startDate,
        filters.endDate,
      );
    }
    if (filters.searchTerm) {
      filtered = filtered.filter(
        (deal) =>
          deal.title.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
          deal.company?.name
            ?.toLowerCase()
            .includes(filters.searchTerm.toLowerCase()) ||
          deal.contact?.name
            ?.toLowerCase()
            .includes(filters.searchTerm.toLowerCase()),
      );
    }

    return filtered.sort((a, b) => {
      const aIsStale = isStale(a.createdAt);
      const bIsStale = isStale(b.createdAt);
      return aIsStale === bIsStale ? 0 : aIsStale ? 1 : -1;
    });
  }, [deals, filters, staleDays]);

  const sortedTableDeals = getSortedDeals(filteredDeals);

  // NEW: Calculate statistics for all deals or selected deals
  const dealStatistics = useMemo(() => {
    const dealsToCalculate =
      selectedRows.length > 0
        ? sortedTableDeals.filter((deal) => selectedRows.includes(deal._id))
        : sortedTableDeals;

    const totalPipeline = dealsToCalculate.reduce(
      (sum, deal) => sum + (parseFloat(deal.amount) || 0),
      0,
    );
    const wonDeals = dealsToCalculate.filter((deal) => deal.status === "Won");
    const lostDeals = dealsToCalculate.filter((deal) => deal.status === "Lost");
    const totalWon = wonDeals.reduce(
      (sum, deal) => sum + (parseFloat(deal.amount) || 0),
      0,
    );
    const totalLost = lostDeals.reduce(
      (sum, deal) => sum + (parseFloat(deal.amount) || 0),
      0,
    );

    return {
      totalPipeline,
      wonCount: wonDeals.length,
      lostCount: lostDeals.length,
      totalWon,
      totalLost,
      isFiltered: selectedRows.length > 0,
    };
  }, [sortedTableDeals, selectedRows]);

  // NEW: Handle row selection
  const handleRowSelect = (dealId) => {
    setSelectedRows((prev) => {
      if (prev.includes(dealId)) {
        return prev.filter((id) => id !== dealId);
      } else {
        return [...prev, dealId];
      }
    });
  };

  // NEW: Handle select all
  const handleSelectAll = () => {
    if (selectedRows.length === sortedTableDeals.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(sortedTableDeals.map((deal) => deal._id));
    }
  };

  const handleExport = (format) => {
    if (permission === "readonly") {
      toast.error("You do not have permission to export deals.", {
        style: {
          zIndex: 99999,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          color: "#374151",
          padding: "10px",
          fontSize: "14px",
          maxWidth: "90vw",
        },
      });
      return;
    }

    if (!window.confirm(`Do you want to export in ${format}?`)) {
      return;
    }

    if (format === "excel") {
      if (!window.XLSX) {
        const script = document.createElement("script");
        script.src =
          "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
        script.onload = () => ExcelExporter.export(filteredDeals);
        document.head.appendChild(script);
      } else {
        ExcelExporter.export(filteredDeals);
      }
    } else if (format === "pdf") {
      if (!window.jspdf) {
        const script = document.createElement("script");
        script.src =
          "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        script.onload = () => PDFExporter.export(filteredDeals);
        document.head.appendChild(script);
      } else {
        PDFExporter.export(filteredDeals);
      }
    }
  };

  const clearFilters = () => {
    setFilters({
      status: "All",
      company: "All",
      minAmount: "",
      maxAmount: "",
      startDate: "",
      endDate: "",
      searchTerm: "",
    });
  };

  // Helper to get color theme for columns
  const getColorTheme = (index, status) => {
    if (status === "Won") return "green";
    if (status === "Lost") return "red";
    const themes = ["blue", "yellow", "purple", "green"];
    return themes[index % themes.length];
  };

  const getStatusTotal = (status) => {
    return filteredDeals
      .filter((deal) => deal.status === status)
      .reduce((total, deal) => total + (parseFloat(deal.amount) || 0), 0);
  };

  const resetForm = () => {
    setForm({
      title: "",
      amount: "",
      status: "Open",
      company: "",
      contact: "",
    });
    setAdditionalFieldValues({});
  };

  const toggleForm = () => {
    if (showForm) {
      resetForm();
    }
    setShowForm(!showForm);
  };

  const formatIndianNumber = (num) => {
    if (!num && num !== 0) return "0";

    const number = parseFloat(num);
    if (isNaN(number)) return "0";

    // Convert to string and split into integer and decimal parts
    const parts = number.toString().split(".");
    let integerPart = parts[0];
    const decimalPart = parts[1] ? "." + parts[1] : "";

    // Handle negative numbers
    const isNegative = integerPart[0] === "-";
    if (isNegative) {
      integerPart = integerPart.slice(1);
    }

    // Apply Indian numbering format
    let lastThree = integerPart.substring(integerPart.length - 3);
    const otherNumbers = integerPart.substring(0, integerPart.length - 3);

    if (otherNumbers !== "") {
      lastThree = "," + lastThree;
    }

    const formatted =
      otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;

    return (isNegative ? "-" : "") + formatted + decimalPart;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center justify-center">
          <img
            src={logo}
            alt="Loading..."
            className="animate-spin-smooth drop-shadow-lg"
            style={{
              width: "48px",
              height: "48px",
              animationDuration: "1.8s",
              filter: "invert(100%)",
            }}
          />
          <p className="mt-3 text-gray-600 font-medium">{randomMessage}</p>
        </div>
      </div>
    );
  }

  // Enhanced Confetti Component with Scattered Pieces (Like Image)
  const ConfettiCelebration = ({ deal, onClose }) => {
    useEffect(() => {
      const duration = 5000;
      const animationEnd = Date.now() + duration;

      function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
      }

      // Initial burst of confetti
      const burstCount = 150;
      confetti({
        particleCount: burstCount,
        spread: 180,
        origin: { y: 0.6 },
        colors: [
          "#FFD700",
          "#FFA500",
          "#FF69B4",
          "#00FF00",
          "#00CED1",
          "#FF1493",
          "#FFED4E",
          "#9370DB",
        ],
        shapes: ["square", "circle"],
        scalar: randomInRange(0.8, 1.4),
        zIndex: 99999,
      });

      // Continuous floating confetti like in the image
      const interval = setInterval(function () {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        // Random positions around the screen
        const x = Math.random();
        const y = Math.random() * 0.5;

        confetti({
          particleCount: 2,
          angle: randomInRange(60, 120),
          spread: randomInRange(50, 100),
          origin: { x, y },
          colors: [
            "#FFD700",
            "#FFA500",
            "#FF69B4",
            "#00FF00",
            "#00CED1",
            "#FF1493",
            "#FFED4E",
            "#9370DB",
            "#FF6347",
          ],
          shapes: ["square", "circle"],
          scalar: randomInRange(0.6, 1.2),
          gravity: randomInRange(0.3, 0.6),
          drift: randomInRange(-0.5, 0.5),
          ticks: 400,
          zIndex: 99999,
        });
      }, 100);

      const timeout = setTimeout(() => {
        onClose();
      }, 5000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }, [onClose]);

    return (
      <div className="fixed inset-0 flex items-center justify-center z-[99998] pointer-events-none p-4">
        {/* Semi-transparent backdrop */}
        <div
          className="absolute inset-0 bg-black/5 pointer-events-auto"
          onClick={onClose}
        ></div>

        {/* Modal Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 pointer-events-auto animate-scale-in max-w-md w-full relative z-[99999]">
          <div className="p-10 text-center">
            {/* Green Check Icon */}
            <div className="flex justify-center mb-6 animate-bounce-once">
              <div className="bg-green-500 rounded-full w-16 h-16 flex items-center justify-center shadow-lg">
                <svg
                  className="w-9 h-9 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="3"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Deal Won!</h2>

            {/* Deal Title */}
            <p className="text-base text-gray-700 mb-3 font-medium">
              {deal.title}
            </p>

            {/* Amount */}
            <div className="mb-6">
              <h6 className="text-2xl font-bold text-gray-900">
                ₹{formatNumberToIndian(parseInt(deal.amount || 0))}
              </h6>
            </div>

            {/* Motivational Message */}
            <p className="text-sm text-gray-600 leading-relaxed">
              Great job! Keep up the amazing work! 💪
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white min-h-screen font-sans">
      <AppToaster />

      {/* Video Tutorial Modal */}
      <VideoTutorialModal
        isOpen={showVideoTutorial}
        onClose={() => setShowVideoTutorial(false)}
        videoId={getVideoTutorial("deals")?.videoId}
        title={getVideoTutorial("deals")?.title}
      />

      <ColumnSettingsPanel
        isOpen={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        columns={columns}
        onSave={saveColumns}
        moduleName="Deals"
      />

      {/* NEW: Confetti Celebration Modal */}
      {celebrationDeal && (
        <ConfettiCelebration
          deal={celebrationDeal}
          onClose={() => setCelebrationDeal(null)}
        />
      )}

      <div className="p-6 space-y-8">
        {/* Modern Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Deals</h2>
            <p className="text-[#5B5A64] text-sm mt-1">
              Manage Your Sales Pipeline
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <VideoTutorialButton
              onClick={() => setShowVideoTutorial(true)}
              variant="minimal"
            />

            {/* Import Button */}
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import</span>
            </button>

            {/* Export Dropdown */}
            <div className="relative" ref={exportButtonRef}>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
              {showExportMenu && (
                <div className="absolute right-0 z-10 mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-xl">
                  <button
                    onClick={() => {
                      handleExport("excel");
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors first:rounded-t-lg flex items-center gap-2"
                  >
                    Export as Excel
                  </button>
                  <button
                    onClick={() => {
                      handleExport("pdf");
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors last:rounded-b-lg flex items-center gap-2"
                  >
                    Export as PDF
                  </button>
                </div>
              )}
            </div>

            {/* Add Deal Button */}
            <button
              onClick={toggleForm}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              {showForm ? "Cancel" : "Add New Deal"}
            </button>
          </div>
        </div>

        {/* Kanban Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-r from-white to-blue-100 border border-[#E5E5EC] p-6 rounded-2xl relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-[#5B5A64] text-sm font-medium">
                Total Pipelines
              </h3>
              <MoreVertical className="text-slate-400 cursor-pointer w-4 h-4" />
            </div>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold">
                ₹{formatNumberToIndian(dealStatistics.totalPipeline)}
              </span>
              <span className="text-blue-600 dark:text-blue-400 text-xs font-semibold">
                {dealStatistics.isFiltered ? "(Filtered)" : "All Deals"}
              </span>
            </div>
          </div>
          <div className="bg-gradient-to-r from-white to-green-100 border border-[#E5E5EC] p-6 rounded-2xl relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-[#5B5A64] text-sm font-medium">Deals Won</h3>
              <MoreVertical className="text-slate-400 cursor-pointer w-4 h-4" />
            </div>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold">
                ₹{formatNumberToIndian(dealStatistics.totalWon)}
              </span>
              <span className="text-green-600 dark:text-green-400 text-xs font-semibold">
                {dealStatistics.wonCount} Deals
              </span>
            </div>
          </div>
          <div className="bg-gradient-to-r from-white to-red-100 border border-[#E5E5EC] p-6 rounded-2xl relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-[#5B5A64] text-sm font-medium">Deals Lost</h3>
              <MoreVertical className="text-slate-400 cursor-pointer w-4 h-4" />
            </div>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold">
                ₹{formatNumberToIndian(dealStatistics.totalLost)}
              </span>
              <span className="text-red-600 dark:text-red-400 text-xs font-semibold">
                {dealStatistics.lostCount} Deals
              </span>
            </div>
          </div>
        </div>

        {/* View Toggles & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-t border-[#E5E5EC] pt-4 gap-4">
          <div className="flex gap-8">
            <button
              onClick={() => setShowKanban(false)}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 ${!showKanban ? "text-blue-600 border-blue-600" : "text-slate-500 border-transparent hover:text-blue-600"}`}
            >
              List View
            </button>
            <button
              onClick={() => setShowKanban(true)}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 ${showKanban ? "text-blue-600 border-blue-600" : "text-slate-500 border-transparent hover:text-blue-600"}`}
            >
              Kanban
            </button>
          </div>

          <div className="flex items-center gap-4 pb-3">
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              <MoreHorizontal className="w-5 h-5" />
              Settings
            </button>
            <button
              onClick={() => setShowColumnSettings(true)}
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
              title="Column Settings"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Columns</span>
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              <Filter className="w-5 h-5" />
              Filters
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 animate-slide-down">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search deals..."
                  value={filters.searchTerm}
                  onChange={(e) =>
                    setFilters({ ...filters, searchTerm: e.target.value })
                  }
                  className="w-full pl-10 pr-4 py-2 bg-gradient-to-r from-white to-blue-100 border border-[#E0E0E1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Status Select */}
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value })
                }
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="All">All Status</option>
                {statuses?.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              {/* Company Select */}
              <select
                value={filters.company}
                onChange={(e) =>
                  setFilters({ ...filters, company: e.target.value })
                }
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="All">All Companies</option>
                {companies?.map((company) => (
                  <option key={company._id} value={company._id}>
                    {company?.name}
                  </option>
                ))}
              </select>

              {/* Clear Button */}
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Clear Filters
              </button>
            </div>
            {/* Results Count */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>
                Showing{" "}
                <span className="font-semibold text-gray-900">
                  {filteredDeals?.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-gray-900">
                  {deals?.length}
                </span>{" "}
                deals
              </span>
            </div>
          </div>
        )}

        {/* Modals & Overlays */}
        <ImportDeals
          isOpen={showImport}
          onClose={() => setShowImport(false)}
          dealFieldNames={dealFields}
          onImportSuccess={() => {
            fetchDeals();
            toast.success("Deals imported successfully");
          }}
        />

        {showForm && (
          <DealsForm
            form={form}
            setForm={setForm}
            additionalFieldValues={additionalFieldValues}
            setAdditionalFieldValues={setAdditionalFieldValues}
            dealFields={dealFields}
            companies={companies}
            contacts={contacts}
            loading={loading}
            setLoading={setLoading}
            setError={(message) =>
              toast.error(message || "Failed to save deal")
            }
            setSuccess={(message) =>
              toast.success(message || "Deal saved successfully")
            }
            fetchDeals={fetchDeals}
            fetchStatuses={fetchStatuses}
            onRequestClose={() => {
              resetForm();
              setShowForm(false);
            }}
          />
        )}

        {/* Delete Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
                Delete Deal?
              </h2>
              <p className="text-sm text-gray-600 text-center mb-6">
                This action cannot be undone. The deal will be permanently
                removed from your pipeline.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDealToDelete(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteDeal}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-semibold text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        <DealSettingSidebar
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          staleDays={staleDays}
          setStaleDays={setStaleDays}
        />

        {quickViewDealId && (
          <DealQuickView
            dealId={quickViewDealId}
            onClose={() => setQuickViewDealId(null)}
            onEdit={(deal) => {
              handleEditDeal(deal);
              // optionally: setQuickViewDealId(null);
            }}
          />
        )}

        {/* --- MAIN CONTENT AREA --- */}
        {showKanban ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="overflow-x-auto overflow-y-hidden pb-8 pt-0 scrollbar-hide -mx-6 px-6 -mt-8">
              <div
                className="flex"
                style={{
                  minWidth: `${statuses?.length * 368 + (statuses?.length ? (statuses.length - 1) * 25 : 0)}px`,
                }}
              >
                {statuses?.map((status, index) => {
                  const columnDeals = filteredDeals.filter(
                    (deal) => deal.status === status,
                  );
                  return (
                    <React.Fragment key={status}>
                      <ModernKanbanColumn
                        status={status}
                        deals={columnDeals}
                        colorTheme={getColorTheme(index, status)}
                        onAddClick={toggleForm}
                        handleEditDeal={handleEditDeal}
                        isStale={isStale}
                      />
                      {index < statuses.length - 1 && (
                        <div className="w-[1px] bg-[#E5E5EC] mx-3 self-stretch flex-shrink-0" />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            <DragOverlay>
              {activeDeal ? (
                <div className="bg-[#FFFFFF] border border-gray-200 p-4 rounded-xl space-y-4 shadow-2xl rotate-3 cursor-grabbing w-[368px]">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      {/* Avatar Placeholder - simplified for overlay if needed or keep same */}
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs">
                        {activeDeal.contact?.name?.[0] || activeDeal.title?.[0]}
                      </div>
                      <span
                        className={`text-[10px] font-medium bg-${getColorTheme(statuses.indexOf(activeDeal.status), activeDeal.status)}-50 text-[#111216] px-2 py-0.5 rounded uppercase tracking-wider`}
                      >
                        {activeDeal.status}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-lg font-bold text-[#111216]">
                      ₹{formatNumberToIndian(parseInt(activeDeal.amount || 0))}
                    </div>
                    <div className="text-sm font-medium text-[#111216]">
                      {activeDeal.title}
                    </div>
                  </div>
                </div>
              ) : null}
            </DragOverlay>

            {/* Quick Action Bottom Bar - Shows when dragging */}
            {activeDeal && (
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 animate-slide-up">
                <div className="max-w-5xl mx-auto px-6 py-4">
                  <div className="flex justify-center items-center gap-4">
                    <QuickActionDropZone
                      status="Won"
                      icon={
                        <svg
                          className="w-6 h-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2.5"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          ></path>
                        </svg>
                      }
                    />
                    <div className="h-8 w-px bg-gray-200"></div>
                    <QuickActionDropZone
                      status="Lost"
                      icon={
                        <svg
                          className="w-6 h-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2.5"
                            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                          ></path>
                        </svg>
                      }
                    />
                  </div>
                  <p className="text-center text-xs text-gray-500 mt-3">
                    Drag deal here to quickly update status
                  </p>
                </div>
              </div>
            )}

            <div className="py-10 text-center space-y-4">
              <p className="text-slate-400 text-xs italic">
                Scroll Horizontal to see more Columns
              </p>
            </div>
          </DndContext>
        ) : (
          <div>
            {/* Table View Implementation (Kept original logic) */}
            {/* Table View Implementation */}
            {selectedRows.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-sm gap-4">
                <div className="flex items-center gap-3">
                  <CheckSquare className="w-5 h-5 text-blue-600" />
                  <span className="text-blue-800 font-semibold font-inter">
                    {selectedRows.length} deal
                    {selectedRows.length !== 1 ? "s" : ""} selected
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  {/* ✅ Export Button */}
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="px-4 py-2 bg-white border border-green-600 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 focus:outline-none transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </button>

                  {/* ✅ Bulk Update Button */}
                  <button
                    onClick={() => setShowBulkActions(true)}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none transition-colors flex items-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Bulk Update
                  </button>

                  {/* ✅ Bulk Delete Button */}
                  <button
                    onClick={() => setShowBulkDeleteModal(true)}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 focus:outline-none transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>

                  {/* Cancel Button */}
                  <button
                    onClick={() => {
                      setSelectionMode(false);
                      setSelectedRows([]);
                    }}
                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none transition-colors flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-auto">
                <DealsTable
                  sortedTableDeals={sortedTableDeals}
                  selectedRows={selectedRows}
                  handleSelectAll={handleSelectAll}
                  handleRowSelect={handleRowSelect}
                  handleRowMouseDown={handleRowMouseDown}
                  handleRowMouseUp={handleRowMouseUp}
                  handleRowTouchStart={handleRowTouchStart}
                  handleRowTouchEnd={handleRowTouchEnd}
                  handleStatusChange={handleStatusChange}
                  handleEditDeal={handleEditDeal}
                  handleDeleteDeal={handleDeleteDeal}
                  isStale={isStale}
                  statuses={statuses}
                  permission={permission}
                  sortConfig={sortConfig}
                  handleSort={handleSort}
                  setQuickViewDealId={setQuickViewDealId}
                  starredDeals={starredDeals}
                  toggleStar={toggleStar}
                />
              </div>
            </div>

            <BulkActions
              isOpen={showBulkActions}
              onClose={() => setShowBulkActions(false)}
              selectedItems={sortedTableDeals.filter((d) =>
                selectedRows.includes(d._id),
              )}
              onBulkUpdate={handleBulkUpdateDeals}
              fieldConfig={dealFieldConfig}
              module="deals"
            />

            {/* Export Selected Deals Modal */}
            <ExportModal
              isOpen={showExportModal}
              onClose={() => setShowExportModal(false)}
              columns={exportColumns}
              selectedIds={selectedRows}
              exportUrl="/deals/export-selected"
              fileName="Exported_Deals.csv"
            />

            {/* Bulk Delete Confirmation Modal */}
            {showBulkDeleteModal && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-6 text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Trash2 className="w-6 h-6 text-red-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2 font-sf">
                      Confirm Bulk Delete
                    </h3>
                    <p className="text-sm text-gray-500 font-inter mb-6">
                      Are you sure you want to delete{" "}
                      <strong>{selectedRows.length}</strong> deals? This action
                      cannot be undone.
                    </p>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={() => setShowBulkDeleteModal(false)}
                        disabled={loading}
                        className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          await handleBulkDeleteDeals(selectedRows);
                          setShowBulkDeleteModal(false);
                        }}
                        disabled={loading}
                        className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm flex items-center justify-center min-w-[120px]"
                      >
                        {loading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Deleting...
                          </>
                        ) : (
                          "Delete All"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Deals;