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
  ChevronLeft,
  ChevronRight,
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
  CalendarDays,
  Briefcase,
  Settings,
  List,
  Award,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import toast from "react-hot-toast";
import confetti from "canvas-confetti";
// Note: We are replacing the external KanbanColumn with an internal Modern version
// import KanbanColumn from "../components/deal/KanbanColumn"; 
import DealsTable from "../components/deal/DealsTable";
import VideoTutorialModal from "../components/VideoTutorialModal";
import { getVideoTutorial } from "../utils/videoTutorials";
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
  const companyName = deal.company?.name || "No Company";
  const avatarSeeds = [deal.contact?.name, deal.user?.name].filter(Boolean);

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, width: "300px" }}
      {...attributes}
      {...listeners}
      onClick={() => onClick(deal)}
      className="flex flex-col items-start bg-white border border-[#E5E5EC] rounded-[10px] p-4 gap-4 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing group relative"
    >
      <div className="flex flex-col items-start gap-2 w-full">
        <div className="flex items-center justify-between w-full">
          <span
            className="truncate"
            style={{ fontFamily: "Inter", fontWeight: 600, fontSize: "14px", lineHeight: "150%", letterSpacing: "-0.02em", color: "#161618" }}
          >
            {deal.title}
          </span>
          <MoreVertical className="w-4 h-4 text-[#BEBEC8] flex-shrink-0" />
        </div>
        <div
          className="w-full"
          style={{ fontFamily: "Inter", fontWeight: 500, fontSize: "14px", lineHeight: "150%", letterSpacing: "-0.06em", color: "#161618" }}
        >
          ₹{amount}
        </div>
      </div>

      <div className="w-full border-t border-[#F1F1F5]" />

      <div className="flex items-center gap-2 w-full">
        <div className="flex items-center justify-center w-[18px] h-[18px] rounded-[5px] bg-[#48494C] flex-shrink-0">
          <Briefcase className="w-2.5 h-2.5 text-white" />
        </div>
        <span
          className="truncate flex-1"
          style={{ fontFamily: "Inter", fontWeight: 500, fontSize: "12px", lineHeight: "15px", letterSpacing: "-0.02em", color: "#161618" }}
        >
          {companyName}
        </span>
        {avatarSeeds.length > 0 && (
          <div className="flex items-center flex-shrink-0">
            {avatarSeeds.map((seed, i) => (
              <img
                key={seed}
                src={`https://api.dicebear.com/7.x/initials/svg?seed=${seed}`}
                className="w-[18px] h-[18px] rounded-full border border-white bg-slate-100"
                style={{ marginLeft: i > 0 ? "-4px" : 0 }}
                alt="avatar"
              />
            ))}
          </div>
        )}
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

  const tintColor =
    colorTheme === "green" ? "0, 201, 80" : colorTheme === "red" ? "232, 34, 34" : "179, 204, 255";

  return (
    <div
      className="flex flex-col items-start flex-shrink-0 bg-white"
      style={{ width: "340px", height: "510px", border: "1px solid #E7E7E9", borderRadius: "12px", overflow: "hidden" }}
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
            {deals.length}
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

      {/* Body */}
      <div
        className="flex flex-col items-start w-full flex-1 overflow-y-auto"
        style={{ padding: "20px", gap: "14px" }}
      >
        {/* Summary Card */}
        <div
          className="flex flex-row justify-between items-center w-full flex-shrink-0"
          style={{
            padding: "16px",
            background: `linear-gradient(94.22deg, rgba(255, 255, 255, 0) -7.06%, rgba(${tintColor}, 0.2) 101.14%), #FFFFFF`,
            border: "1px solid #E5E5EC",
            borderRadius: "10px",
          }}
        >
          <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: "22px", lineHeight: "150%", letterSpacing: "-0.03em", color: "#48494C" }}>
            ₹{formattedTotal}
          </span>
          <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: "12px", lineHeight: "15px", letterSpacing: "-0.02em", color: "#5B5A64" }}>
            Total
          </span>
        </div>

        {/* Droppable Area */}
        <div
          ref={setNodeRef}
          className="flex flex-col items-start w-full flex-1"
          style={{ gap: "14px" }}
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
    </div>
  );
};

const PipelineSummaryIcon = (props) => (
  <svg width="19" height="16" viewBox="0 0 19 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M17.1923 16H1.80775C1.30258 16 0.875 15.825 0.525 15.475C0.175 15.125 0 14.6974 0 14.1923V2.80775C0 2.30258 0.175 1.875 0.525 1.525C0.875 1.175 1.30258 1 1.80775 1H11.327V2.5H1.80775C1.73075 2.5 1.66025 2.53208 1.59625 2.59625C1.53208 2.66025 1.5 2.73075 1.5 2.80775V14.1923C1.5 14.2692 1.53208 14.3398 1.59625 14.4038C1.66025 14.4679 1.73075 14.5 1.80775 14.5H17.1923C17.2693 14.5 17.3398 14.4679 17.4038 14.4038C17.4679 14.3398 17.5 14.2692 17.5 14.1923V7.577H19V14.1923C19 14.6974 18.825 15.125 18.475 15.475C18.125 15.825 17.6974 16 17.1923 16ZM3.88475 12.173H10.25V9.69225H3.88475V12.173ZM3.88475 7.30775H10.25V4.827H3.88475V7.30775ZM12.6348 12.173H15.1152V7.577H12.6348V12.173ZM15.5 5.5V3.5H13.5V2H15.5V0H17V2H19V3.5H17V5.5H15.5Z" fill="#0085FF" />
  </svg>
);

const DealsWonIcon = (props) => (
  <svg width="18" height="20" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M3.3365 20V12.4098L0 7L4.31725 0H12.9713L17.2885 7L13.952 12.4098V20L8.64425 18.202L3.3365 20ZM4.8365 17.8788L8.64425 16.6115L12.452 17.8788V14H4.8365V17.8788ZM5.15375 1.5L1.75375 7L5.15375 12.5H12.1348L15.5348 7L12.1348 1.5H5.15375ZM7.59425 10.7192L4.4 7.55L5.46925 6.48075L7.59425 8.60575L11.8193 4.35575L12.8885 5.4L7.59425 10.7192Z" fill="#0085FF" />
  </svg>
);

const AverageDealSizeIcon = (props) => (
  <svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M5.7965 18.252C4.64033 17.7533 3.63467 17.0766 2.7795 16.2218C1.92433 15.3669 1.24725 14.3617 0.74825 13.206C0.249417 12.0503 0 10.8156 0 9.50175C0 8.18775 0.249333 6.95267 0.748 5.7965C1.24667 4.64033 1.92342 3.63467 2.77825 2.7795C3.63308 1.92433 4.63833 1.24725 5.794 0.74825C6.94967 0.249417 8.18442 0 9.49825 0C10.8123 0 12.0473 0.249333 13.2035 0.748C14.3597 1.24667 15.3653 1.92342 16.2205 2.77825C17.0757 3.63308 17.7528 4.63833 18.2518 5.794C18.7506 6.94967 19 8.18442 19 9.49825C19 10.8123 18.7507 12.0473 18.252 13.2035C17.7533 14.3597 17.0766 15.3653 16.2218 16.2205C15.3669 17.0757 14.3617 17.7528 13.206 18.2518C12.0503 18.7506 10.8156 19 9.50175 19C8.18775 19 6.95267 18.7507 5.7965 18.252ZM15.175 15.175C16.725 13.625 17.5 11.7333 17.5 9.5C17.5 7.26667 16.725 5.375 15.175 3.825C13.625 2.275 11.7333 1.5 9.5 1.5C7.26667 1.5 5.375 2.275 3.825 3.825C2.275 5.375 1.5 7.26667 1.5 9.5C1.5 11.7333 2.275 13.625 3.825 15.175C5.375 16.725 7.26667 17.5 9.5 17.5C11.7333 17.5 13.625 16.725 15.175 15.175ZM5.60575 13.3965C4.53525 12.3275 4 11.0294 4 9.50225C4 7.97508 4.5345 6.67625 5.6035 5.60575C6.6725 4.53525 7.97058 4 9.49775 4C11.0249 4 12.3238 4.5345 13.3943 5.6035C14.4648 6.6725 15 7.97058 15 9.49775C15 11.0249 14.4655 12.3238 13.3965 13.3943C12.3275 14.4648 11.0294 15 9.50225 15C7.97508 15 6.67625 14.4655 5.60575 13.3965ZM12.325 12.325C13.1083 11.5417 13.5 10.6 13.5 9.5C13.5 8.4 13.1083 7.45833 12.325 6.675C11.5417 5.89167 10.6 5.5 9.5 5.5C8.4 5.5 7.45833 5.89167 6.675 6.675C5.89167 7.45833 5.5 8.4 5.5 9.5C5.5 10.6 5.89167 11.5417 6.675 12.325C7.45833 13.1083 8.4 13.5 9.5 13.5C10.6 13.5 11.5417 13.1083 12.325 12.325ZM8.44325 10.5568C8.14775 10.2613 8 9.909 8 9.5C8 9.091 8.14775 8.73875 8.44325 8.44325C8.73875 8.14775 9.091 8 9.5 8C9.909 8 10.2613 8.14775 10.5568 8.44325C10.8523 8.73875 11 9.091 11 9.5C11 9.909 10.8523 10.2613 10.5568 10.5568C10.2613 10.8523 9.909 11 9.5 11C9.091 11 8.73875 10.8523 8.44325 10.5568Z" fill="#0085FF" />
  </svg>
);

const DealsLostIcon = (props) => (
  <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M19.0305 20.0845L16.769 17.823H2.6845C2.17933 17.823 1.75175 17.648 1.40175 17.298C1.05175 16.948 0.87675 16.5204 0.87675 16.0153V5.63075C0.87675 5.12558 1.05175 4.698 1.40175 4.348C1.75175 3.998 2.17933 3.823 2.6845 3.823H4.87675L6.37675 5.323H2.6845C2.6075 5.323 2.537 5.35508 2.473 5.41925C2.40883 5.48325 2.37675 5.55375 2.37675 5.63075V16.0153C2.37675 16.0923 2.40883 16.1628 2.473 16.2267C2.537 16.2909 2.6075 16.323 2.6845 16.323H15.2538L0 1.05375L1.05375 0L20.0845 19.0308L19.0305 20.0845ZM19.8768 16.0308L18.3768 14.5308V5.63075C18.3768 5.55375 18.3447 5.48325 18.2805 5.41925C18.2165 5.35508 18.146 5.323 18.069 5.323H9.169L6.87675 3.03075V2.13075C6.87675 1.62558 7.05175 1.198 7.40175 0.848C7.75175 0.498 8.17933 0.323 8.6845 0.323H12.069C12.5742 0.323 13.0018 0.498 13.3518 0.848C13.7018 1.198 13.8768 1.62558 13.8768 2.13075V3.823H18.069C18.5742 3.823 19.0018 3.998 19.3518 4.348C19.7018 4.698 19.8768 5.12558 19.8768 5.63075V16.0308ZM8.37675 3.823H12.3768V2.13075C12.3768 2.05375 12.3447 1.98325 12.2805 1.91925C12.2165 1.85508 12.146 1.823 12.069 1.823H8.6845C8.6075 1.823 8.537 1.85508 8.473 1.91925C8.40883 1.98325 8.37675 2.05375 8.37675 2.13075V3.823Z" fill="#0085FF" />
  </svg>
);

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
  const [dealsCurrentPage, setDealsCurrentPage] = useState(1);
  const [dealsPerPage, setDealsPerPage] = useState(10);
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
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);

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
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(event.target)
      ) {
        setIsMoreMenuOpen(false);
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
  const dealsTotalPages = Math.max(1, Math.ceil(sortedTableDeals.length / dealsPerPage));
  const dealsCurrentPageClamped = Math.min(dealsCurrentPage, dealsTotalPages);
  const paginatedTableDeals = sortedTableDeals.slice(
    (dealsCurrentPageClamped - 1) * dealsPerPage,
    dealsCurrentPageClamped * dealsPerPage
  );

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

    const averageDealSize =
      dealsToCalculate.length > 0
        ? Math.round(totalPipeline / dealsToCalculate.length)
        : 0;

    // Real week-over-week trend, based on deal.createdAt (only real timestamp available)
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const thisWeekStart = now - 7 * oneDay;
    const lastWeekStart = now - 14 * oneDay;

    const inRange = (deal, start, end) => {
      const t = new Date(deal.createdAt).getTime();
      return t >= start && t < end;
    };

    const thisWeekDeals = dealsToCalculate.filter((d) => inRange(d, thisWeekStart, now));
    const lastWeekDeals = dealsToCalculate.filter((d) => inRange(d, lastWeekStart, thisWeekStart));

    const sumAmount = (deals) =>
      deals.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);

    const pctChange = (current, previous) => {
      if (previous === 0) return current === 0 ? 0 : 100;
      const pct = Math.round(((current - previous) / previous) * 100);
      return Math.max(-999, Math.min(999, pct));
    };

    const thisWeekWon = thisWeekDeals.filter((d) => d.status === "Won");
    const lastWeekWon = lastWeekDeals.filter((d) => d.status === "Won");
    const thisWeekLost = thisWeekDeals.filter((d) => d.status === "Lost");
    const lastWeekLost = lastWeekDeals.filter((d) => d.status === "Lost");

    const thisWeekAvg = thisWeekDeals.length > 0 ? sumAmount(thisWeekDeals) / thisWeekDeals.length : 0;
    const lastWeekAvg = lastWeekDeals.length > 0 ? sumAmount(lastWeekDeals) / lastWeekDeals.length : 0;

    const trends = {
      pipeline: pctChange(sumAmount(thisWeekDeals), sumAmount(lastWeekDeals)),
      won: pctChange(sumAmount(thisWeekWon), sumAmount(lastWeekWon)),
      avgSize: pctChange(thisWeekAvg, lastWeekAvg),
      lost: pctChange(sumAmount(thisWeekLost), sumAmount(lastWeekLost)),
    };

    return {
      totalPipeline,
      wonCount: wonDeals.length,
      lostCount: lostDeals.length,
      totalWon,
      trends,
      totalLost,
      averageDealSize,
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

      {/* New Strip */}
      <div
        className="sticky -mt-6 -mx-4 sm:-mx-6 lg:-mx-8 border-b border-[#E1E4EA] bg-white flex items-center justify-between gap-3 px-6"
        style={{ top: "64px", zIndex: 40, height: "64px", minHeight: "64px", maxHeight: "64px", boxSizing: "border-box" }}
      >
        <div className="flex flex-col gap-1.5">
          <h2
            className="m-0 font-medium"
            style={{ fontSize: "16px", lineHeight: "120%", letterSpacing: "-0.5px", color: "#0E121B" }}
          >
            Deals
          </h2>
          <p className="text-[#5B5A64] text-sm m-0 leading-tight">
            Manage Your Sales Pipeline
          </p>
        </div>

        <div className="relative flex-1 flex items-center justify-end">
          <div className="relative w-[416px] max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={filters.searchTerm}
              onChange={(e) =>
                setFilters({ ...filters, searchTerm: e.target.value })
              }
              className="w-full h-10 pl-9 pr-4 border border-[#E1E4EA] rounded-full text-sm focus:outline-none focus:border-[#0085FF] transition-colors font-inter bg-white"
              placeholder="Search deals by title, company, or status..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
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
                  onClick={() => {
                    setShowVideoTutorial(true);
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <FileText className="w-4 h-4 text-gray-400" />
                  Video Tutorial
                </button>
                <button
                  onClick={() => {
                    setShowImport(true);
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Upload className="w-4 h-4 text-gray-400" />
                  Import
                </button>
                <div className="relative" ref={exportButtonRef}>
                  <button
                    onClick={() => setShowExportMenu((prev) => !prev)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Download className="w-4 h-4 text-gray-400" />
                    Export
                  </button>
                  {showExportMenu && (
                    <div className="absolute left-full top-0 ml-1 z-10 w-44 bg-white border border-gray-200 rounded-lg shadow-xl">
                      <button
                        onClick={() => {
                          handleExport("excel");
                          setShowExportMenu(false);
                          setIsMoreMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors first:rounded-t-lg flex items-center gap-2"
                      >
                        Export as Excel
                      </button>
                      <button
                        onClick={() => {
                          handleExport("pdf");
                          setShowExportMenu(false);
                          setIsMoreMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors last:rounded-b-lg flex items-center gap-2"
                      >
                        Export as PDF
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowSettings(true);
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Settings className="w-4 h-4 text-gray-400" />
                  Deal Settings
                </button>
              </div>
            )}
          </div>

          {/* Filters */}
          <button
            onClick={() => setShowFilters((prev) => !prev)}
            className="relative flex items-center justify-center w-10 h-10 rounded-full border border-[#E1E4EA] text-gray-500 hover:bg-gray-50 transition-colors"
            title="Filters"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.66667 2.91667C1.66667 2.22631 2.22631 1.66667 2.91667 1.66667C3.60702 1.66667 4.16667 2.22631 4.16667 2.91667C4.16667 3.60703 3.60702 4.16667 2.91667 4.16667C2.22631 4.16667 1.66667 3.60703 1.66667 2.91667ZM2.91667 0C1.30583 0 0 1.30583 0 2.91667C0 4.5275 1.30583 5.83333 2.91667 5.83333C4.5275 5.83333 5.83333 4.5275 5.83333 2.91667C5.83333 1.30583 4.5275 0 2.91667 0ZM7.5 3.75H14.1667V2.08333H7.5V3.75ZM10.8333 11.25C10.8333 10.5597 11.393 10 12.0833 10C12.7737 10 13.3333 10.5597 13.3333 11.25C13.3333 11.9403 12.7737 12.5 12.0833 12.5C11.393 12.5 10.8333 11.9403 10.8333 11.25ZM12.0833 8.33333C10.4725 8.33333 9.16667 9.63917 9.16667 11.25C9.16667 12.8608 10.4725 14.1667 12.0833 14.1667C13.6942 14.1667 15 12.8608 15 11.25C15 9.63917 13.6942 8.33333 12.0833 8.33333ZM0.833333 10.4167V12.0833H7.5V10.4167H0.833333Z" fill="#1F2937" />
            </svg>
          </button>

          {/* List / Kanban Toggle */}
          <div className="flex items-center bg-gray-100 rounded-full p-1 flex-shrink-0">
            <button
              onClick={() => setShowKanban(false)}
              className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${!showKanban ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowKanban(true)}
              className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${showKanban ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              title="Kanban View"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3.33333 11.6667H5V3.33333H3.33333V11.6667ZM10 10H11.6667V3.33333H10V10ZM6.66667 7.5H8.33333V3.33333H6.66667V7.5ZM1.66667 15C1.20833 15 0.815972 14.8368 0.489583 14.5104C0.163194 14.184 0 13.7917 0 13.3333V1.66667C0 1.20833 0.163194 0.815972 0.489583 0.489583C0.815972 0.163194 1.20833 0 1.66667 0H13.3333C13.7917 0 14.184 0.163194 14.5104 0.489583C14.8368 0.815972 15 1.20833 15 1.66667V13.3333C15 13.7917 14.8368 14.184 14.5104 14.5104C14.184 14.8368 13.7917 15 13.3333 15H1.66667ZM1.66667 13.3333H13.3333V1.66667H1.66667V13.3333Z" fill="currentColor" />
              </svg>
            </button>
          </div>

          {/* Add Deal Button */}
          <button
            onClick={toggleForm}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-[#0085FF] text-white text-sm font-medium rounded-full hover:bg-blue-600 focus:outline-none cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            {showForm ? "Cancel" : "New Deal"}
          </button>
        </div>
      </div>

      <div
        className="-mx-4 sm:-mx-6 lg:-mx-8 flex flex-row items-center gap-6 border-b border-[#E1E4EA] box-border"
        style={{ padding: "24px", height: "120px" }}
      >
        {/* KPI Strip */}
        {[
            { label: "Pipeline Summary", value: `₹${formatNumberToIndian(dealStatistics.totalPipeline)}`, icon: PipelineSummaryIcon, trend: dealStatistics.trends.pipeline },
            { label: "Deals Won", value: `₹${formatNumberToIndian(dealStatistics.totalWon)}`, icon: DealsWonIcon, trend: dealStatistics.trends.won },
            { label: "Average Deal Size", value: `₹${formatNumberToIndian(dealStatistics.averageDealSize)}`, icon: AverageDealSizeIcon, trend: dealStatistics.trends.avgSize },
            { label: "Deals Lost", value: `₹${formatNumberToIndian(dealStatistics.totalLost)}`, icon: DealsLostIcon, trend: dealStatistics.trends.lost },
          ].map(({ label, value, icon: Icon, trend }) => (
            <div
              key={label}
              className="flex flex-col justify-center items-start bg-white border border-[#E1E4EA] rounded-xl flex-1"
              style={{ padding: "16px", gap: "14px", height: "72px" }}
            >
              <div className="flex flex-row items-end gap-3.5 w-full">
                <div className="flex items-center justify-center w-10 h-10 border border-[#E1E4EA] rounded-md text-[#0085FF] flex-shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex flex-col items-start gap-1">
                  <p
                    className="m-0 whitespace-nowrap"
                    style={{ fontFamily: "'Inter Tight', 'Inter', sans-serif", fontWeight: 400, fontSize: "12px", lineHeight: "120%", color: "#525866" }}
                  >
                    {label}
                  </p>
                  <div className="flex flex-row items-center gap-2">
                    <p
                      className="m-0 whitespace-nowrap"
                      style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: "18px", lineHeight: "120%", color: "#0E121B" }}
                    >
                      {value}
                    </p>
                    <div className="flex flex-row items-center gap-1">
                      {trend >= 0 ? (
                        <TrendingUp className="w-3.5 h-3.5" style={{ color: "#00C950" }} />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5" style={{ color: "#E82222" }} />
                      )}
                      <span
                        className="m-0 whitespace-nowrap"
                        style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: "12px", lineHeight: "120%", color: trend >= 0 ? "#00C950" : "#E82222" }}
                      >
                        {Math.abs(trend)}%
                      </span>
                      <span
                        className="m-0 whitespace-nowrap"
                        style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: "12px", lineHeight: "120%", color: "#525866" }}
                      >
                        Last week
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>

      <div className="p-6 space-y-8">
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
            <div className="overflow-x-auto overflow-y-hidden scrollbar-hide -mx-6" style={{ padding: "24px" }}>
              <div className="flex min-w-max" style={{ gap: "16px" }}>
                {statuses?.map((status) => {
                  const columnDeals = sortedTableDeals.filter((d) => d.status === status);
                  const colorTheme =
                    status === "Won" ? "green" : status === "Lost" ? "red" : "blue";
                  return (
                    <ModernKanbanColumn
                      key={status}
                      status={status}
                      deals={columnDeals}
                      colorTheme={colorTheme}
                      onAddClick={toggleForm}
                      handleEditDeal={handleEditDeal}
                      isStale={isStale}
                    />
                  );
                })}
              </div>
            </div>
            <DragOverlay>
              {activeDeal ? (
                <ModernDealCard deal={activeDeal} onClick={() => {}} isStale={isStale} />
              ) : null}
            </DragOverlay>
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
                  sortedTableDeals={paginatedTableDeals}
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

            {sortedTableDeals.length > 0 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex items-center space-x-2">
                  <p className="text-sm text-gray-700 font-inter">
                    Showing{" "}
                    <span className="font-semibold">
                      {(dealsCurrentPageClamped - 1) * dealsPerPage + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-semibold">
                      {Math.min(dealsCurrentPageClamped * dealsPerPage, sortedTableDeals.length)}
                    </span>{" "}
                    of <span className="font-semibold">{sortedTableDeals.length}</span> results
                  </p>
                  <select
                    value={dealsPerPage}
                    onChange={(e) => {
                      setDealsPerPage(parseInt(e.target.value));
                      setDealsCurrentPage(1);
                    }}
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
                    onClick={() => setDealsCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={dealsCurrentPageClamped === 1}
                    className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {Array.from({ length: dealsTotalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setDealsCurrentPage(page)}
                      className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${page === dealsCurrentPageClamped
                        ? "bg-blue-600 text-white"
                        : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    onClick={() => setDealsCurrentPage((p) => Math.min(dealsTotalPages, p + 1))}
                    disabled={dealsCurrentPageClamped === dealsTotalPages}
                    className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

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