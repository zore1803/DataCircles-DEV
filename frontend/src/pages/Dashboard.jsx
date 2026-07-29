import { useEffect, useState, useMemo, useRef, Fragment } from "react";
import { createPortal } from "react-dom";
import { createColumnHelper } from "@tanstack/react-table";
import { ResponsiveContainer, ComposedChart, XAxis, YAxis, Area, Line, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown, Search, MoreVertical, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Eye, Edit2, Trash2, Pin, PinOff, EyeOff, Download, X, CheckSquare } from "lucide-react";
import FilterIcon from "../components/common/FilterIcon";
import DataTable from "../components/common/DataTable";
import InvoiceQuickView from "../components/invoice/InvoiceQuickView";
import Skeleton from "../components/common/Skeleton";
import { useTopLoadingSignal } from "../components/common/TopLoadingBar";

const getRootZoom = () => {
  if (typeof window === "undefined") return 1;
  const z = parseFloat(getComputedStyle(document.documentElement).zoom);
  return z && !Number.isNaN(z) ? z : 1;
};

// Default column config for the Invoices table (order + visibility + pin state
// are managed in component state, mirroring the Companies list).
const defaultInvoiceColumns = [
  { key: "invoiceId", label: "Invoice Id", visible: true, order: 0, sortable: true },
  { key: "client", label: "Client", visible: true, order: 1, sortable: true },
  { key: "contact", label: "Contact", visible: true, order: 2, sortable: true },
  { key: "deal", label: "Deal", visible: true, order: 3, sortable: true },
  { key: "invoiceDate", label: "Invoice Date", visible: true, order: 4, sortable: true },
  { key: "amount", label: "Amount", visible: true, order: 5, sortable: true },
  { key: "dueDate", label: "Due Date", visible: true, order: 6, sortable: true },
  { key: "status", label: "Status", visible: true, order: 7, sortable: true },
];

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

const getInvoiceFieldValue = (inv, key) => {
  switch (key) {
    case "invoiceId": return inv.invoiceNumber || "";
    case "client": return inv.deal?.company?.name || "";
    case "contact": return inv.deal?.contact?.name || "";
    case "deal": return inv.deal?.title || "";
    case "invoiceDate": return inv.date ? new Date(inv.date).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "";
    case "amount": return inv.amount != null ? `₹${Math.round(inv.amount).toLocaleString("en-IN")}` : "";
    case "dueDate": return inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "";
    case "status": return inv.status || "";
    default: return "";
  }
};

const invoiceColumnHelper = createColumnHelper();

const formatSalesRevenueTick = (value) => (value === 0 ? "0" : `₹${Math.round(value / 1000)}k`);

const InvoicesIcon = ({ size = 20, style }) => (
  <svg width={size} height={size} viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
    <path d="M0 15.6408V0L1.15396 1.02562L2.33979 0L3.52563 1.02562L4.71146 0L5.8975 1.02562L7.08333 0L8.26917 1.02562L9.45521 0L10.641 1.02562L11.8269 0L13.0127 1.02562L14.1667 0V15.6408L13.0127 14.6152L11.8269 15.6408L10.641 14.6152L9.45521 15.6408L8.26917 14.6152L7.08333 15.6408L5.8975 14.6152L4.71146 15.6408L3.52563 14.6152L2.33979 15.6408L1.15396 14.6152L0 15.6408ZM2.29167 11.5223H11.875V10.2723H2.29167V11.5223ZM2.29167 8.44542H11.875V7.19542H2.29167V8.44542ZM2.29167 5.36854H11.875V4.11854H2.29167V5.36854ZM1.25 13.7371H12.9167V1.90375H1.25V13.7371Z" fill={style?.color || "#1C1B1F"} />
  </svg>
);
import API from "../services/api";
import toast from "react-hot-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import TaskAndMeeting, { TasksCard } from "../components/dashboard/TaskAndMeeting";
import ClientsAndDeals from "../components/dashboard/ClientsAndDeals";
import DashboardSummary from "../components/dashboard/DashboardSummary";
import RevenueOvertime from "../components/dashboard/RevenueOvertime";
import PaymentInformation from "../components/dashboard/PaymentInformation";
import MeetingsInformation from "../components/dashboard/MeetingsInformation";
import logo from "/DataCircles.png";

const TotalIncomeIcon = ({ size = 24, style }) => (
  <svg width={size} height={size * (18 / 22)} viewBox="0 0 22 18" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
    <path d="M1.80775 15C1.30258 15 0.875 14.825 0.525 14.475C0.175 14.125 0 13.6974 0 13.1923V1.80775C0 1.30258 0.175 0.875 0.525 0.525C0.875 0.175 1.30258 0 1.80775 0H17.1923C17.6974 0 18.125 0.175 18.475 0.525C18.825 0.875 19 1.30258 19 1.80775V7.096H1.5V13.1923C1.5 13.2692 1.53208 13.3398 1.59625 13.4038C1.66025 13.4679 1.73075 13.5 1.80775 13.5H11.096V15H1.80775ZM1.5 3.904H17.5V1.80775C17.5 1.73075 17.4679 1.66025 17.4038 1.59625C17.3398 1.53208 17.2693 1.5 17.1923 1.5H1.80775C1.73075 1.5 1.66025 1.53208 1.59625 1.59625C1.53208 1.66025 1.5 1.73075 1.5 1.80775V3.904ZM16.75 17.25V14.25H13.75V12.75H16.75V9.75H18.25V12.75H21.25V14.25H18.25V17.25H16.75Z" fill={style?.color || "#0085FF"} />
  </svg>
);

const DealValueOvertimeIcon = ({ size = 24, style }) => (
  <svg width={size} height={size * (18 / 19)} viewBox="0 0 19 18" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
    <path d="M1.80775 17.5C1.30258 17.5 0.875 17.325 0.525 16.975C0.175 16.625 0 16.1974 0 15.6923V5.30775C0 4.80258 0.175 4.375 0.525 4.025C0.875 3.675 1.30258 3.5 1.80775 3.5H6V1.80775C6 1.30258 6.175 0.875 6.525 0.525C6.875 0.175 7.30258 0 7.80775 0H11.1923C11.6974 0 12.125 0.175 12.475 0.525C12.825 0.875 13 1.30258 13 1.80775V3.5H17.1923C17.6974 3.5 18.125 3.675 18.475 4.025C18.825 4.375 19 4.80258 19 5.30775V15.6923C19 16.1974 18.825 16.625 18.475 16.975C18.125 17.325 17.6974 17.5 17.1923 17.5H1.80775ZM1.80775 16H17.1923C17.2693 16 17.3398 15.9679 17.4038 15.9038C17.4679 15.8398 17.5 15.7692 17.5 15.6923V5.30775C17.5 5.23075 17.4679 5.16025 17.4038 5.09625C17.3398 5.03208 17.2693 5 17.1923 5H1.80775C1.73075 5 1.66025 5.03208 1.59625 5.09625C1.53208 5.16025 1.5 5.23075 1.5 5.30775V15.6923C1.5 15.7692 1.53208 15.8398 1.59625 15.9038C1.66025 15.9679 1.73075 16 1.80775 16ZM7.5 3.5H11.5V1.80775C11.5 1.73075 11.4679 1.66025 11.4038 1.59625C11.3398 1.53208 11.2692 1.5 11.1923 1.5H7.80775C7.73075 1.5 7.66025 1.53208 7.59625 1.59625C7.53208 1.66025 7.5 1.73075 7.5 1.80775V3.5Z" fill={style?.color || "#0085FF"} />
  </svg>
);

const TotalDealsClosedIcon = ({ size = 24, style }) => (
  <svg width={size} height={size * (19 / 22)} viewBox="0 0 22 19" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
    <path d="M10.2932 17.4807C10.3918 17.4807 10.4922 17.4577 10.5942 17.4115C10.696 17.3653 10.7764 17.3128 10.8354 17.2538L18.8334 9.25575C19.0591 9.03008 19.229 8.789 19.3432 8.5325C19.4572 8.27617 19.5142 8.007 19.5142 7.725C19.5142 7.43267 19.4572 7.15125 19.3432 6.88075C19.229 6.61008 19.0591 6.36708 18.8334 6.15175L14.8334 2.15175C14.6181 1.92608 14.3848 1.761 14.1334 1.6565C13.8823 1.55217 13.6105 1.5 13.3182 1.5C13.0362 1.5 12.7653 1.55217 12.5057 1.6565C12.246 1.761 12.0066 1.92608 11.7874 2.15175L11.2142 2.725L13.0642 4.59025C13.2885 4.80442 13.4543 5.04867 13.5614 5.323C13.6684 5.59733 13.7219 5.88192 13.7219 6.17675C13.7219 6.78708 13.5181 7.29608 13.1104 7.70375C12.7028 8.11142 12.1938 8.31525 11.5834 8.31525C11.2886 8.31525 11.003 8.2665 10.7267 8.169C10.4505 8.07167 10.2053 7.91592 9.99118 7.70175L8.09693 5.823L3.75093 10.169C3.67526 10.2447 3.61851 10.3293 3.58068 10.423C3.54285 10.5165 3.52393 10.6127 3.52393 10.7115C3.52393 10.896 3.58676 11.0537 3.71243 11.1845C3.8381 11.3153 3.99318 11.3808 4.17768 11.3808C4.27651 11.3808 4.37685 11.3577 4.47868 11.3115C4.58068 11.2653 4.66118 11.2128 4.72018 11.1538L8.00468 7.86925L9.05843 8.923L5.78918 12.2075C5.71368 12.2832 5.65701 12.3678 5.61918 12.4615C5.58135 12.555 5.56243 12.6512 5.56243 12.75C5.56243 12.9282 5.62685 13.0817 5.75568 13.2105C5.88451 13.3393 6.03801 13.4038 6.21618 13.4038C6.31501 13.4038 6.41535 13.3807 6.51718 13.3345C6.61918 13.2883 6.6996 13.2358 6.75843 13.1768L10.1584 9.79225L11.2124 10.846L7.82768 14.246C7.75851 14.305 7.70343 14.3854 7.66243 14.4873C7.62143 14.5893 7.60093 14.6896 7.60093 14.7883C7.60093 14.9666 7.66535 15.1202 7.79418 15.249C7.92301 15.3778 8.07651 15.4423 8.25468 15.4423C8.35335 15.4423 8.44951 15.4233 8.54318 15.3855C8.63668 15.3477 8.72126 15.2909 8.79693 15.2153L12.1969 11.8308L13.2509 12.8845L9.85093 16.2845C9.77526 16.3602 9.71851 16.448 9.68068 16.548C9.64285 16.648 9.62393 16.7442 9.62393 16.8365C9.62393 17.021 9.69251 17.1745 9.82968 17.297C9.96685 17.4195 10.1213 17.4807 10.2932 17.4807ZM10.2777 18.9805C9.71235 18.9805 9.21943 18.7844 8.79893 18.3923C8.37843 17.9999 8.1586 17.5114 8.13943 16.9268C7.57276 16.8883 7.09935 16.687 6.71918 16.323C6.33901 15.9588 6.13293 15.4806 6.10093 14.8883C5.5086 14.8499 5.02976 14.6429 4.66443 14.2673C4.29893 13.8916 4.10335 13.4191 4.07768 12.8497C3.48285 12.8114 2.99185 12.5957 2.60468 12.2028C2.21751 11.8098 2.02393 11.3127 2.02393 10.7115C2.02393 10.4167 2.08001 10.1278 2.19218 9.845C2.30435 9.56233 2.46751 9.314 2.68168 9.1L8.09693 3.7L11.0259 6.62875C11.0848 6.69792 11.1619 6.75308 11.2574 6.79425C11.3531 6.83525 11.4567 6.85575 11.5682 6.85575C11.7502 6.85575 11.9072 6.7955 12.0392 6.675C12.1713 6.5545 12.2374 6.39675 12.2374 6.20175C12.2374 6.09025 12.2169 5.98675 12.1759 5.89125C12.1348 5.79575 12.0796 5.7185 12.0104 5.6595L8.50268 2.15175C8.28735 1.92608 8.05243 1.761 7.79793 1.6565C7.54343 1.55217 7.27001 1.5 6.97768 1.5C6.69568 1.5 6.4281 1.55217 6.17493 1.6565C5.9216 1.761 5.68218 1.92608 5.45668 2.15175L2.17193 5.45175C1.98993 5.63375 1.84093 5.84883 1.72493 6.097C1.60893 6.345 1.54068 6.59792 1.52018 6.85575C1.49951 7.06858 1.5091 7.27917 1.54893 7.4875C1.5886 7.69583 1.65843 7.89167 1.75843 8.075L0.654681 9.17875C0.429014 8.85308 0.259181 8.48833 0.145181 8.0845C0.0310144 7.68067 -0.015819 7.27108 0.004681 6.85575C0.025181 6.39542 0.129014 5.95083 0.316181 5.522C0.503348 5.09317 0.765514 4.71017 1.10268 4.373L4.37768 1.098C4.75218 0.733833 5.1596 0.459833 5.59993 0.275999C6.04026 0.0919995 6.50276 0 6.98743 0C7.47193 0 7.93276 0.0919995 8.36993 0.275999C8.80726 0.459833 9.20793 0.733833 9.57193 1.098L10.1452 1.671L10.7182 1.098C11.0925 0.733833 11.4983 0.459833 11.9354 0.275999C12.3726 0.0919995 12.8335 0 13.3182 0C13.8028 0 14.2653 0.0919995 14.7057 0.275999C15.146 0.459833 15.5483 0.733833 15.9124 1.098L19.8874 5.073C20.2514 5.43717 20.5303 5.85158 20.7239 6.31625C20.9174 6.78092 21.0142 7.25558 21.0142 7.74025C21.0142 8.22492 20.9174 8.68583 20.7239 9.123C20.5303 9.56017 20.2514 9.96075 19.8874 10.3247L11.8892 18.3075C11.6687 18.528 11.4203 18.6953 11.1442 18.8095C10.8678 18.9235 10.579 18.9805 10.2777 18.9805Z" fill={style?.color || "#0085FF"} />
  </svg>
);

const RevenueGeneratedIcon = ({ size = 24, style }) => (
  <svg width={size} height={size * (17 / 18)} viewBox="0 0 18 17" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
    <path d="M1.80775 17C1.30908 17 0.883083 16.8234 0.52975 16.4703C0.176583 16.1169 0 15.6909 0 15.1923V1.80775C0 1.30908 0.176583 0.883083 0.52975 0.52975C0.883083 0.176583 1.30908 0 1.80775 0H15.1923C15.6909 0 16.1169 0.176583 16.4703 0.52975C16.8234 0.883083 17 1.30908 17 1.80775V4.529H15.5V1.80775C15.5 1.71792 15.4712 1.64417 15.4135 1.5865C15.3558 1.52883 15.2821 1.5 15.1923 1.5H1.80775C1.71792 1.5 1.64417 1.52883 1.5865 1.5865C1.52883 1.64417 1.5 1.71792 1.5 1.80775V15.1923C1.5 15.2821 1.52883 15.3558 1.5865 15.4135C1.64417 15.4712 1.71792 15.5 1.80775 15.5H15.1923C15.2821 15.5 15.3558 15.4712 15.4135 15.4135C15.4712 15.3558 15.5 15.2821 15.5 15.1923V12.471H17V15.1923C17 15.6909 16.8234 16.1169 16.4703 16.4703C16.1169 16.8234 15.6909 17 15.1923 17H1.80775ZM9.80775 13C9.30908 13 8.88308 12.8234 8.52975 12.4703C8.17658 12.1169 8 11.6909 8 11.1923V5.80775C8 5.30908 8.17658 4.88308 8.52975 4.52975C8.88308 4.17658 9.30908 4 9.80775 4H16.1923C16.6909 4 17.1169 4.17658 17.4703 4.52975C17.8234 4.88308 18 5.30908 18 5.80775V11.1923C18 11.6909 17.8234 12.1169 17.4703 12.4703C17.1169 12.8234 16.6909 13 16.1923 13H9.80775ZM16.1923 11.5C16.2821 11.5 16.3558 11.4712 16.4135 11.4135C16.4712 11.3558 16.5 11.2821 16.5 11.1923V5.80775C16.5 5.71792 16.4712 5.64417 16.4135 5.5865C16.3558 5.52883 16.2821 5.5 16.1923 5.5H9.80775C9.71792 5.5 9.64417 5.52883 9.5865 5.5865C9.52883 5.64417 9.5 5.71792 9.5 5.80775V11.1923C9.5 11.2821 9.52883 11.3558 9.5865 11.4135C9.64417 11.4712 9.71792 11.5 9.80775 11.5H16.1923ZM13.5625 9.5625C13.8542 9.27083 14 8.91667 14 8.5C14 8.08333 13.8542 7.72917 13.5625 7.4375C13.2708 7.14583 12.9167 7 12.5 7C12.0833 7 11.7292 7.14583 11.4375 7.4375C11.1458 7.72917 11 8.08333 11 8.5C11 8.91667 11.1458 9.27083 11.4375 9.5625C11.7292 9.85417 12.0833 10 12.5 10C12.9167 10 13.2708 9.85417 13.5625 9.5625Z" fill={style?.color || "#0085FF"} />
  </svg>
);

function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeDashboardTab = searchParams.get("tab") || "Overview";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useTopLoadingSignal(loading);

  const [user, setUser] = useState({});
  const [tasks, setTasks] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [allMeetings, setAllMeetings] = useState([]);

  const [deals, setDeals] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const salesRevenueScrollRef = useRef(null);

  // Sales Revenue chart visible window: 5 months at a time on mobile (<lg), 12 on desktop.
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 1024
  );
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const handler = (e) => setIsMobileViewport(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const [selectedInvoices, setSelectedInvoices] = useState([]);
  // Delays the bulk-strip's unmount so it can play a slide-out-right exit
  // animation on deselect (mirroring the slide-in entrance).
  const [showBulkStrip, setShowBulkStrip] = useState(false);
  const [bulkStripClosing, setBulkStripClosing] = useState(false);
  useEffect(() => {
    if (selectedInvoices.length > 0) {
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
  }, [selectedInvoices.length]);
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState("");
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoicesPerPage, setInvoicesPerPage] = useState(10);
  const [invoiceEditingPage, setInvoiceEditingPage] = useState(false);
  const [invoicePageInput, setInvoicePageInput] = useState("");
  const [invoiceSortConfig, setInvoiceSortConfig] = useState({ key: null, direction: "asc" });

  // "Earnings Performance" widget — quarter picker
  const [selectedQuarter, setSelectedQuarter] = useState("Q1");
  const [showQuarterMenu, setShowQuarterMenu] = useState(false);

  // Invoices table (Companies-style): column sizing, pin state, column config
  // (order/visibility) and the per-column header menu.
  const [invoiceColumnSizing, setInvoiceColumnSizing] = useState({});
  const [invoicePinnedColumns, setInvoicePinnedColumns] = useState([]); // [{ key, side }]
  const [invoiceColumnsConfig, setInvoiceColumnsConfig] = useState(defaultInvoiceColumns);
  const [openInvoiceColMenuKey, setOpenInvoiceColMenuKey] = useState(null);
  const [openInvoiceActionsId, setOpenInvoiceActionsId] = useState(null);
  const [invoiceActionsPos, setInvoiceActionsPos] = useState(null);
  const invoiceActionsRef = useRef(null);
  // Invoice view/edit slide-over: { invoice, mode: "view" | "edit" }
  const [invoiceQuickView, setInvoiceQuickView] = useState(null);
  const [invoiceColMenuPos, setInvoiceColMenuPos] = useState(null);
  const invoiceColMenuRef = useRef(null);
  const selectedInvoicesSet = useMemo(() => new Set(selectedInvoices), [selectedInvoices]);

  const invoiceVisibleColumns = useMemo(
    () => [...invoiceColumnsConfig].filter((c) => c.visible).sort((a, b) => a.order - b.order),
    [invoiceColumnsConfig],
  );

  const invoicePinColumnToSide = (colKey, side) =>
    setInvoicePinnedColumns((prev) => [...prev.filter((p) => p.key !== colKey), { key: colKey, side }]);
  const invoiceUnpinColumn = (colKey) =>
    setInvoicePinnedColumns((prev) => prev.filter((p) => p.key !== colKey));
  const getInvoicePinSide = (colKey) => invoicePinnedColumns.find((p) => p.key === colKey)?.side || null;

  const handleInvoiceColumnReorder = (draggedKey, targetKey) => {
    if (!draggedKey || draggedKey === targetKey) return;
    const sorted = [...invoiceColumnsConfig].sort((a, b) => a.order - b.order);
    const visibleSorted = sorted.filter((c) => c.visible);
    const draggedIdx = visibleSorted.findIndex((c) => c.key === draggedKey);
    const targetIdx = visibleSorted.findIndex((c) => c.key === targetKey);
    if (draggedIdx === -1 || targetIdx === -1) return;
    const reordered = [...visibleSorted];
    const [moved] = reordered.splice(draggedIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    let cursor = 0;
    setInvoiceColumnsConfig(
      sorted.map((c) => (c.visible ? reordered[cursor++] : c)).map((c, idx) => ({ ...c, order: idx })),
    );
  };

  const handleInvoiceSort = (key, direction) => {
    setInvoiceSortConfig((prev) =>
      direction
        ? { key, direction }
        : { key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" },
    );
  };

  const handleSelectAllInvoices = () => {
    setSelectedInvoices((prev) => (prev.length === invoices.length ? [] : invoices.map((inv) => inv._id)));
  };

  const handleSelectInvoice = (id) => {
    setSelectedInvoices((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // "Select All" grabs every invoice matching the current search (all
  // invoices are already loaded client-side, so this selects the full
  // filtered set, not only the current page). "Deselect All" is its
  // counterpart: it doesn't clear the selection outright — it steps back
  // down to only the rows on the current page.
  const handleSelectAllInvoicesAcrossPages = () => {
    setSelectedInvoices(sortedInvoices.map((inv) => inv._id));
  };

  const handleDeselectAllInvoicesExtra = () => {
    setSelectedInvoices(paginatedInvoices.map((inv) => inv._id));
  };

  const [showBulkInvoiceDeleteModal, setShowBulkInvoiceDeleteModal] = useState(false);
  const [showBulkInvoiceStatusModal, setShowBulkInvoiceStatusModal] = useState(false);
  const [bulkInvoiceStatus, setBulkInvoiceStatus] = useState("Paid");
  const [bulkInvoiceLoading, setBulkInvoiceLoading] = useState(false);

  const handleBulkDeleteInvoices = async () => {
    setBulkInvoiceLoading(true);
    try {
      await Promise.all(selectedInvoices.map((id) => API.delete(`/invoices/${id}`)));
      setInvoices((prev) => prev.filter((i) => !selectedInvoices.includes(i._id)));
      toast.success(`${selectedInvoices.length} invoice(s) deleted`);
      setSelectedInvoices([]);
      setShowBulkInvoiceDeleteModal(false);
    } catch (err) {
      console.error("Bulk invoice delete failed:", err);
      toast.error(err.response?.data?.message || "Bulk delete failed");
    } finally {
      setBulkInvoiceLoading(false);
    }
  };

  const handleBulkUpdateInvoiceStatus = async () => {
    setBulkInvoiceLoading(true);
    try {
      await Promise.all(
        selectedInvoices.map((id) => API.put(`/invoices/status/${id}`, { status: bulkInvoiceStatus })),
      );
      setInvoices((prev) =>
        prev.map((i) => (selectedInvoices.includes(i._id) ? { ...i, status: bulkInvoiceStatus } : i)),
      );
      toast.success(`${selectedInvoices.length} invoice(s) updated`);
      setSelectedInvoices([]);
      setShowBulkInvoiceStatusModal(false);
    } catch (err) {
      console.error("Bulk invoice status update failed:", err);
      toast.error(err.response?.data?.message || "Bulk update failed");
    } finally {
      setBulkInvoiceLoading(false);
    }
  };

  const handleExportSelectedInvoices = () => {
    const rows = invoices.filter((i) => selectedInvoices.includes(i._id));
    const header = ["Invoice Id", "Client", "Deal", "Invoice Date", "Amount", "Due Date", "Status"];
    const csvRows = rows.map((inv) =>
      [
        inv.invoiceNumber || "",
        inv.deal?.company?.name || "",
        inv.deal?.title || "",
        inv.date ? new Date(inv.date).toLocaleDateString("en-IN") : "",
        inv.amount || 0,
        inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-IN") : "",
        inv.status || "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "invoices-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleViewInvoice = (inv) => {
    setInvoiceQuickView({ invoice: inv, mode: "view" });
  };

  const handleEditInvoice = (inv) => {
    setInvoiceQuickView({ invoice: inv, mode: "edit" });
  };

  const [invoiceToDelete, setInvoiceToDelete] = useState(null);

  const handleDeleteInvoice = (inv) => {
    setInvoiceToDelete(inv);
  };

  const confirmDeleteInvoice = async () => {
    const inv = invoiceToDelete;
    if (!inv) return;
    setInvoiceToDelete(null);
    try {
      await API.delete(`/invoices/${inv._id}`);
      setInvoices((prev) => prev.filter((i) => i._id !== inv._id));
      setSelectedInvoices((prev) => prev.filter((id) => id !== inv._id));
      toast.success("Invoice deleted");
    } catch (err) {
      console.error("Failed to delete invoice:", err);
      toast.error(err.response?.data?.message || "Failed to delete invoice");
    }
  };

  const sortedInvoices = useMemo(() => {
    const term = invoiceSearchTerm.trim().toLowerCase();
    const filtered = term
      ? invoices.filter((inv) => {
          const values = ["invoiceId", "client", "contact", "deal", "invoiceDate", "amount", "dueDate", "status"]
            .map((key) => String(getInvoiceFieldValue(inv, key) ?? "").trim())
            .filter(Boolean);
          // Also match the raw, unformatted amount (no ₹ / commas) so typing
          // plain digits like "45000" still finds "₹45,000".
          if (inv.amount != null) values.push(String(Math.round(inv.amount)));
          return values.some((v) => v.toLowerCase().includes(term));
        })
      : invoices;

    if (!invoiceSortConfig.key) return filtered;
    const getVal = (inv) => {
      switch (invoiceSortConfig.key) {
        case "invoiceId": return inv.invoiceNumber || "";
        case "client": return inv.deal?.company?.name || "";
        case "contact": return inv.deal?.contact?.name || "";
        case "deal": return inv.deal?.title || "";
        case "invoiceDate": return new Date(inv.date || 0).getTime();
        case "amount": return inv.amount || 0;
        case "dueDate": return new Date(inv.dueDate || 0).getTime();
        case "status": return inv.status || "";
        default: return "";
      }
    };
    return [...filtered].sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (va < vb) return invoiceSortConfig.direction === "asc" ? -1 : 1;
      if (va > vb) return invoiceSortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [invoices, invoiceSortConfig, invoiceSearchTerm]);

  const invoiceTotalPages = Math.max(1, Math.ceil(sortedInvoices.length / invoicesPerPage));
  const paginatedInvoices = useMemo(() => {
    const start = (invoicePage - 1) * invoicesPerPage;
    return sortedInvoices.slice(start, start + invoicesPerPage);
  }, [sortedInvoices, invoicePage, invoicesPerPage]);

  useEffect(() => {
    setInvoicePage(1);
  }, [invoiceSearchTerm, invoiceSortConfig, invoicesPerPage]);

  useEffect(() => {
    if (invoicePage > invoiceTotalPages) setInvoicePage(invoiceTotalPages);
  }, [invoiceTotalPages, invoicePage]);

  // Lock background scroll while a row-actions / column popup is open so the
  // page underneath can't move until the menu is dismissed.
  useEffect(() => {
    const menuOpen = openInvoiceActionsId != null || openInvoiceColMenuKey != null;
    if (!menuOpen) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [openInvoiceActionsId, openInvoiceColMenuKey]);

  const getInvoiceGhostPreview = (colId) =>
    (sortedInvoices || []).map((inv) => String(getInvoiceFieldValue(inv, colId) ?? "").trim() || "—");

  // Build the TanStack column defs for the Invoices table (selection + data
  // columns + per-column header menu with pin/sort/hide), grouped by pin side.
  const invoiceTableColumns = useMemo(() => {
    const cols = [];

    cols.push(
      invoiceColumnHelper.display({
        id: "selection",
        size: 60,
        enableResizing: false,
        header: () => (
          <div className="flex justify-center items-center w-full">
            <input
              type="checkbox"
              checked={invoices.length > 0 && selectedInvoices.length === invoices.length}
              onChange={handleSelectAllInvoices}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex justify-center items-center w-full">
            <input
              type="checkbox"
              checked={selectedInvoicesSet.has(row.original._id)}
              onChange={() => handleSelectInvoice(row.original._id)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        ),
      }),
    );

    const leftPinnedKeys = invoicePinnedColumns.filter((p) => p.side === "left").map((p) => p.key);
    const rightPinnedKeys = invoicePinnedColumns.filter((p) => p.side === "right").map((p) => p.key);
    const leftFields = invoiceVisibleColumns.filter((vc) => leftPinnedKeys.includes(vc.key));
    const rightFields = invoiceVisibleColumns.filter((vc) => rightPinnedKeys.includes(vc.key));
    const unpinnedFields = invoiceVisibleColumns.filter(
      (vc) => !leftPinnedKeys.includes(vc.key) && !rightPinnedKeys.includes(vc.key),
    );
    const orderedFields = [...leftFields, ...unpinnedFields, ...rightFields];
    const lastColumnKey = orderedFields[orderedFields.length - 1]?.key;

    orderedFields.forEach((vc) => {
      cols.push(
        invoiceColumnHelper.accessor((row) => getInvoiceFieldValue(row, vc.key), {
          id: vc.key,
          size: vc.key === "invoiceId" || vc.key === "deal" ? 170 : 150,
          header: () => {
            const isSortable = vc.sortable !== false;
            const pinSide = getInvoicePinSide(vc.key);
            const isMenuOpen = openInvoiceColMenuKey === vc.key;
            return (
              <div className="flex items-center justify-between w-full group">
                <span className="truncate flex-1 min-w-0" title={vc.label}>{vc.label}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isMenuOpen) {
                      setOpenInvoiceColMenuKey(null);
                      setInvoiceColMenuPos(null);
                      return;
                    }
                    // rect is VISUAL px; the menu is portaled into document.body, which
                    // paints inside the dynamic <html> zoom, so rect-derived values must
                    // be divided by that zoom to line up with the trigger button.
                    const zMenu = getRootZoom();
                    const MENU_W = 190;
                    const rect = e.currentTarget.getBoundingClientRect();
                    let calcLeft = rect.right / zMenu - MENU_W;
                    calcLeft = Math.min(calcLeft, window.innerWidth / zMenu - MENU_W - 8);
                    calcLeft = Math.max(calcLeft, 8);
                    setInvoiceColMenuPos({ top: rect.bottom / zMenu + 4, left: calcLeft });
                    setOpenInvoiceColMenuKey(vc.key);
                  }}
                  className="p-1 rounded hover:bg-gray-200 transition-colors text-gray-500 flex-shrink-0"
                  title="Column options"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {isMenuOpen && invoiceColMenuPos && createPortal(
                  <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => { setOpenInvoiceColMenuKey(null); setInvoiceColMenuPos(null); }} />
                    <div
                      ref={invoiceColMenuRef}
                      style={{ position: "fixed", top: invoiceColMenuPos.top, left: invoiceColMenuPos.left }}
                      className="w-[190px] z-[9999] bg-white border border-[#E5E5EC] rounded-xl shadow-[7px_24px_24px_-7px_rgba(0,0,0,0.25)] p-2 flex flex-col gap-1 animate-in fade-in zoom-in duration-150 origin-top-right"
                    >
                      <button
                        onClick={() => {
                          setOpenInvoiceColMenuKey(null);
                          setInvoiceColMenuPos(null);
                          pinSide === "left" ? invoiceUnpinColumn(vc.key) : invoicePinColumnToSide(vc.key, "left");
                        }}
                        className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${pinSide === "left" ? "bg-blue-50 text-blue-700" : "text-[#161618] hover:bg-gray-50"}`}
                      >
                        {pinSide === "left" ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4 text-[#1C1B1F]" />}
                        Pin to Left
                      </button>
                      <button
                        onClick={() => {
                          setOpenInvoiceColMenuKey(null);
                          setInvoiceColMenuPos(null);
                          pinSide === "right" ? invoiceUnpinColumn(vc.key) : invoicePinColumnToSide(vc.key, "right");
                        }}
                        className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${pinSide === "right" ? "bg-blue-50 text-blue-700" : "text-[#161618] hover:bg-gray-50"}`}
                      >
                        {pinSide === "right" ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4 text-[#1C1B1F]" />}
                        Pin to Right
                      </button>

                      {isSortable && (
                        <>
                          <button
                            onClick={() => {
                              setOpenInvoiceColMenuKey(null);
                              setInvoiceColMenuPos(null);
                              handleInvoiceSort(vc.key, "asc");
                            }}
                            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-semibold text-[#161618] hover:bg-gray-50 whitespace-nowrap"
                          >
                            <ChevronUp className="w-4 h-4 text-[#1C1B1F]" />
                            Sort Ascending
                          </button>
                          <button
                            onClick={() => {
                              setOpenInvoiceColMenuKey(null);
                              setInvoiceColMenuPos(null);
                              handleInvoiceSort(vc.key, "desc");
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
                          setOpenInvoiceColMenuKey(null);
                          setInvoiceColMenuPos(null);
                          setInvoiceColumnsConfig((prev) =>
                            prev.map((c) => (c.key === vc.key ? { ...c, visible: false } : c)),
                          );
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
            );
          },
          cell: ({ row, getValue }) => {
            const inv = row.original;
            let baseContent;

            if (vc.key === "invoiceId") {
              baseContent = (
                <span className="text-sm font-semibold text-[#1F2937] truncate block" title={inv.invoiceNumber}>
                  {inv.invoiceNumber ? <HighlightText text={inv.invoiceNumber} query={invoiceSearchTerm} /> : "—"}
                </span>
              );
            } else if (vc.key === "amount") {
              baseContent = (
                <span className="text-sm font-medium text-[#1F2937]">
                  {inv.amount != null ? (
                    <HighlightText text={`₹${Math.round(inv.amount).toLocaleString("en-IN")}`} query={invoiceSearchTerm} />
                  ) : (
                    "—"
                  )}
                </span>
              );
            } else if (vc.key === "status") {
              const isPaid = inv.status?.toLowerCase() === "paid" || inv.status?.toLowerCase() === "accepted";
              baseContent = (
                <span
                  className="inline-flex items-center justify-center px-3 py-[5px] rounded-full text-xs font-medium"
                  style={{
                    background: isPaid ? "rgba(0, 201, 80, 0.1)" : "rgba(254, 89, 25, 0.1)",
                    color: isPaid ? "#00C950" : "#FE5919",
                  }}
                >
                  {inv.status ? <HighlightText text={inv.status} query={invoiceSearchTerm} /> : "—"}
                </span>
              );
            } else {
              const val = String(getValue() ?? "").trim();
              baseContent = (
                <span className="text-sm text-gray-700 truncate block" title={val}>
                  {val ? <HighlightText text={val} query={invoiceSearchTerm} /> : "—"}
                </span>
              );
            }

            if (vc.key === lastColumnKey) {
              const isActionsOpen = openInvoiceActionsId === inv._id;
              return (
                <div className="flex items-center justify-between w-full gap-2">
                  <div className="min-w-0 flex-1">{baseContent}</div>
                  <div className="relative flex-shrink-0" onMouseDown={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isActionsOpen) {
                          setOpenInvoiceActionsId(null);
                          setInvoiceActionsPos(null);
                          return;
                        }
                        setInvoiceActionsPos({ top: e.clientY + 4, left: e.clientX - 190 });
                        setOpenInvoiceActionsId(inv._id);
                      }}
                      className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                      title="More actions"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {isActionsOpen && invoiceActionsPos && createPortal(
                      <>
                        <div className="fixed inset-0 z-[9998]" onClick={() => { setOpenInvoiceActionsId(null); setInvoiceActionsPos(null); }} />
                        <div
                          ref={invoiceActionsRef}
                          style={{ position: "fixed", top: invoiceActionsPos.top, left: invoiceActionsPos.left }}
                          className="w-[190px] z-[9999] bg-white border border-[#E5E5EC] rounded-xl shadow-[7px_24px_24px_-7px_rgba(0,0,0,0.25)] p-2 flex flex-col gap-1 animate-in fade-in zoom-in duration-150 origin-top-right"
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenInvoiceActionsId(null);
                              setInvoiceActionsPos(null);
                              handleViewInvoice(inv);
                            }}
                            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-semibold text-[#161618] hover:bg-gray-50 whitespace-nowrap"
                          >
                            <Eye className="w-4 h-4 text-[#1C1B1F]" />
                            View Invoice
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenInvoiceActionsId(null);
                              setInvoiceActionsPos(null);
                              handleEditInvoice(inv);
                            }}
                            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-semibold text-[#161618] hover:bg-gray-50 whitespace-nowrap"
                          >
                            <Edit2 className="w-4 h-4 text-[#1C1B1F]" />
                            Edit Invoice
                          </button>
                          <div className="w-full border-t border-[#F1F1F5] my-0.5" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenInvoiceActionsId(null);
                              setInvoiceActionsPos(null);
                              handleDeleteInvoice(inv);
                            }}
                            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 whitespace-nowrap"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete Invoice
                          </button>
                        </div>
                      </>,
                      document.body,
                    )}
                  </div>
                </div>
              );
            }
            return baseContent;
          },
        }),
      );
    });

    return cols;
  }, [
    invoices.length,
    selectedInvoices,
    selectedInvoicesSet,
    invoiceVisibleColumns,
    invoicePinnedColumns,
    invoiceSortConfig,
    openInvoiceColMenuKey,
    invoiceColMenuPos,
    openInvoiceActionsId,
    invoiceActionsPos,
    invoiceSearchTerm,
  ]);

  const [totalClients, setTotalClients] = useState(0);
  const [activeDeals, setActiveDeals] = useState(0);
  const [totalTasks, setTotalTasks] = useState(0);
  const [totalMeetings, setTotalMeetings] = useState(0);

  const [averageDealSize, setAverageDealSize] = useState(0);
  const [invoiceStats, setInvoiceStats] = useState({
    delivered: 0,
    sent: 0,
    accepted: 0,
    due: 0,
    total: 0,
  });

  // Stable loading message (no re-renders)
  const loadingMessage = useMemo(() => {
    const messages = [
      "Gathering your business insights...",
      "Loading your CRM dashboard...",
      "Preparing your sales overview...",
      "Crunching client data for you...",
      "Setting up your success metrics...",
      "Fetching deals and tasks...",
      "Building your business snapshot...",
      "Syncing your customer pipeline...",
      "Organizing your dashboard data...",
      "Your CRM command center is loading...",
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }, []);

  // --------------- Utility Functions ------------------
  const calculateAverageDealAmount = (deals) => {
    if (!Array.isArray(deals) || deals.length === 0) return 0;
    const total = deals.reduce((sum, d) => sum + (d.amount || 0), 0);
    return total / deals.length;
  };

  const calculateInvoiceStats = (invoices) => {
    const stats = { delivered: 0, sent: 0, accepted: 0, due: 0, total: 0 };
    const today = new Date();

    invoices?.forEach((invoice) => {
      const amount = invoice.amount || 0;
      const status = invoice.status?.toLowerCase();

      if (status === "delivered") stats.delivered += amount;
      if (status === "sent") stats.sent += amount;
      if (status === "accepted") stats.accepted += amount;

      if (status !== "accepted" && invoice.dueDate && new Date(invoice.dueDate) < today) {
        stats.due += amount;
      }
    });

    stats.total = stats.delivered + stats.sent + stats.accepted;
    return stats;
  };

  // ---------------- Greeting & Subtitle ----------------
  const friendlyGreeting = useMemo(() => {
    const hour = new Date().getHours();
    const firstName = (user?.name || "there").split(" ")[0];
    const isWeekend = [0, 6].includes(new Date().getDay());

    const sets = {
      weekend: [
        `Weekend warrior, ${firstName}!`,
        `Hey ${firstName}! Working on the weekend?`,
        `Weekend vibes, ${firstName}!`,
      ],
      morning: [
        `Good morning, ${firstName}!`,
        `Rise and shine, ${firstName}!`,
        `Morning, ${firstName}! Ready to crush today?`,
      ],
      afternoon: [
        `Good afternoon, ${firstName}!`,
        `Hey ${firstName}, hope your day is productive!`,
      ],
      evening: [
        `Good evening, ${firstName}!`,
        `Evening, ${firstName}! Still going strong?`,
      ],
      night: [
        `Burning the midnight oil, ${firstName}?`,
        `Late night hustle, ${firstName}? Impressive!`,
      ],
    };

    if (isWeekend)
      return sets.weekend[Math.floor(Math.random() * sets.weekend.length)];

    if (hour < 12)
      return sets.morning[Math.floor(Math.random() * sets.morning.length)];
    if (hour < 17)
      return sets.afternoon[Math.floor(Math.random() * sets.afternoon.length)];
    if (hour < 22)
      return sets.evening[Math.floor(Math.random() * sets.evening.length)];

    return sets.night[Math.floor(Math.random() * sets.night.length)];
  }, [user]);

  const motivationalSubtitle = useMemo(() => {
    const subtitles = [
      "Let's see what's on your plate today",
      "Here's your business snapshot",
      "Time to make things happen",
      "Your success dashboard awaits",
      "Let's dive into your metrics",
    ];
    return subtitles[Math.floor(Math.random() * subtitles.length)];
  }, []);

  const summaryStats = useMemo(() => {
    const wonDeals = deals.filter(d => d.status === "Won");
    const closedCount = wonDeals.length;
    const revenueSum = wonDeals.reduce((sum, d) => sum + (d.amount || 0), 0);

    // Revenue section summary stats (for PaymentInformation)
    const allInvoices = invoices || [];
    const totalIssued = allInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalPaidSum = allInvoices
      .filter((inv) => inv.status?.toLowerCase() === "paid" || inv.status?.toLowerCase() === "accepted")
      .reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalUnpaid = totalIssued - totalPaidSum;

    // Monthly deal value (all deals created this month)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyValue = deals
      .filter(d => {
        const date = new Date(d.createdAt);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      })
      .reduce((sum, d) => sum + (d.amount || 0), 0);

    return {
      closedDeals: closedCount || 0,
      revenue: revenueSum || 0,
      monthlyDealValue: monthlyValue || 0,
      revenueSummary: {
        totalIssued: totalIssued || 0,
        totalPaid: totalPaidSum || 0,
        totalUnpaid: totalUnpaid || 0,
      }
    };
  }, [deals, invoices]);

  // Compares "this month" vs "last month" totals for a list of items and returns % change + direction
  const getMonthOverMonthChange = (items, dateField, valueField) => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonthDate = new Date(thisYear, thisMonth - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();

    let current = 0;
    let previous = 0;

    (items || []).forEach((item) => {
      const raw = item[dateField];
      if (!raw) return;
      const d = new Date(raw);
      if (isNaN(d)) return;
      const val = valueField ? item[valueField] || 0 : 1;

      if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) current += val;
      else if (d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear) previous += val;
    });

    if (previous === 0) {
      return { current, previous, pct: current > 0 ? 100 : 0, up: true };
    }
    const change = ((current - previous) / previous) * 100;
    return { current, previous, pct: Math.abs(Math.round(change)), up: change >= 0 };
  };

  const overviewKpis = useMemo(() => {
    const wonDeals = deals.filter((d) => d.status === "Won");
    const paidInvoices = invoices.filter((inv) => inv.status?.toLowerCase() === "paid" || inv.status?.toLowerCase() === "accepted");

    const totalIncomeTrend = getMonthOverMonthChange(invoices, "date", "amount");
    const revenueGeneratedTrend = getMonthOverMonthChange(paidInvoices, "date", "amount");
    const dealsClosedTrend = getMonthOverMonthChange(wonDeals, "createdAt", null);
    const dealValueTrend = getMonthOverMonthChange(wonDeals, "createdAt", "amount");

    return {
      totalIncome: invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0),
      totalIncomeTrend,
      revenueGenerated: paidInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0),
      revenueGeneratedTrend,
      dealsClosedCount: wonDeals.length,
      dealsClosedTrend,
      dealValue: wonDeals.reduce((sum, d) => sum + (d.amount || 0), 0),
      dealValueTrend,
    };
  }, [deals, invoices]);

  // "Earnings Performance" widget — revenue (paid invoices) + profit (won deals)
  // for the selected quarter of the current year, plus the quarter-over-quarter change.
  const quarterlyEarnings = useMemo(() => {
    const qIndex = { Q1: 0, Q2: 1, Q3: 2, Q4: 3 }[selectedQuarter];
    const year = new Date().getFullYear();
    const inQuarter = (dateStr, q, yr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (isNaN(d)) return false;
      return Math.floor(d.getMonth() / 3) === q && d.getFullYear() === yr;
    };
    const revenueFor = (q, yr) =>
      (invoices || [])
        .filter((inv) => (inv.status?.toLowerCase() === "paid" || inv.status?.toLowerCase() === "accepted") && inQuarter(inv.date, q, yr))
        .reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const profitFor = (q, yr) =>
      (deals || [])
        .filter((d) => d.status === "Won" && inQuarter(d.createdAt, q, yr))
        .reduce((sum, d) => sum + (d.amount || 0), 0);

    const revenue = revenueFor(qIndex, year);
    const profit = profitFor(qIndex, year);
    const total = revenue + profit;

    const prevQIndex = qIndex === 0 ? 3 : qIndex - 1;
    const prevYear = qIndex === 0 ? year - 1 : year;
    const prevTotal = revenueFor(prevQIndex, prevYear) + profitFor(prevQIndex, prevYear);
    const pctChange = prevTotal === 0 ? (total > 0 ? 100 : 0) : Math.round(((total - prevTotal) / prevTotal) * 100);

    const scoreBasis = Math.max(total, 1);
    const revenueScore = Math.round((revenue / scoreBasis) * 100) / 10;
    const profitScore = Math.round((profit / scoreBasis) * 100) / 10;

    return { revenue, profit, total, pctChange, revenueScore, profitScore };
  }, [deals, invoices, selectedQuarter]);

  // "Recent Deals" widget — highest-value deal + most recently created deals
  const recentDealsWidget = useMemo(() => {
    const list = deals || [];
    const topDeal = [...list].sort((a, b) => (b.amount || 0) - (a.amount || 0))[0] || null;
    const recent = [...list]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 6)
      .map((d) => ({
        client: d.company?.name || d.contact?.name || "—",
        deal: d.title || "Untitled Deal",
        amount: `${Math.round(d.amount || 0).toLocaleString("en-IN")} INR`,
      }));
    return { topDeal, recent };
  }, [deals]);

  const invoiceKpiTrends = useMemo(() => {
    const paidInvoices = invoices.filter((inv) => inv.status?.toLowerCase() === "paid" || inv.status?.toLowerCase() === "accepted");
    const pendingInvoices = invoices.filter((inv) => inv.status?.toLowerCase() === "sent" || inv.status?.toLowerCase() === "pending");
    const today = new Date();
    const dueInvoices = invoices.filter(
      (inv) => !(inv.status?.toLowerCase() === "paid" || inv.status?.toLowerCase() === "accepted") && inv.dueDate && new Date(inv.dueDate) < today
    );

    return {
      total: getMonthOverMonthChange(invoices, "date", "amount"),
      paid: getMonthOverMonthChange(paidInvoices, "date", "amount"),
      pending: getMonthOverMonthChange(pendingInvoices, "date", "amount"),
      due: getMonthOverMonthChange(dueInvoices, "dueDate", "amount"),
    };
  }, [invoices]);

  // "Total Invoices Issued" card — top client (by invoiced amount) summary +
  // last-7-months paid-amount trend for the sparkline underneath it.
  const totalInvoicesCard = useMemo(() => {
    const clearedPct = invoiceStats.total > 0
      ? Math.round((invoiceStats.accepted / invoiceStats.total) * 100)
      : 0;

    const dealsById = {};
    (deals || []).forEach((d) => { dealsById[d._id] = d; });

    const byCompany = {};
    invoices.forEach((inv) => {
      const dealId = inv.deal?._id || inv.deal;
      const fullDeal = dealsById[dealId];
      const companyName = fullDeal?.company?.name || inv.deal?.company?.name;
      if (!companyName) return;
      const isPaid = inv.status?.toLowerCase() === "accepted";
      if (!byCompany[companyName]) {
        byCompany[companyName] = { companyName, dealTitle: "", total: 0, paidAmount: 0, count: 0, paidCount: 0 };
      }
      const entry = byCompany[companyName];
      entry.total += inv.amount || 0;
      entry.count += 1;
      if (isPaid) {
        entry.paidAmount += inv.amount || 0;
        entry.paidCount += 1;
      }
      entry.dealTitle = inv.deal?.title || fullDeal?.title || entry.dealTitle;
    });
    const topClient = Object.values(byCompany).sort((a, b) => b.total - a.total)[0] || null;
    const topClientPct = topClient && topClient.total > 0
      ? Math.round((topClient.paidAmount / topClient.total) * 100)
      : 0;

    const months = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: d.toLocaleDateString("en-US", { month: "short" }), amount: 0 });
    }
    invoices.forEach((inv) => {
      if (inv.status?.toLowerCase() !== "accepted") return;
      const date = inv.date || inv.createdAt;
      if (!date) return;
      const d = new Date(date);
      const bucket = months.find((m) => m.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (bucket) bucket.amount += inv.amount || 0;
    });
    const maxAmount = Math.max(1, ...months.map((m) => m.amount));
    const xStep = 362 / (months.length - 1);
    const points = months.map((m, i) => ({
      x: 1 + i * xStep,
      y: 119 - (m.amount / maxAmount) * 117,
    }));
    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

    return { clearedPct, topClient, topClientPct, points, linePath, months: months.map((m) => m.month) };
  }, [invoices, deals, invoiceStats]);

  // Sales Revenue widget — 100 evenly-spaced points across the last 12 months, seeded with a
  // gentle upward trend and topped up with real invoice totals so the demo chart has a dense curve to scroll through.
  const monthlySalesRevenueData = useMemo(() => {
    const pointCount = 100;
    const totalDays = 365;
    const now = new Date();
    const startTime = now.getTime() - totalDays * 24 * 60 * 60 * 1000;
    const msPerPoint = (totalDays * 24 * 60 * 60 * 1000) / (pointCount - 1);

    // Deterministic pseudo-random noise per point (stable across re-renders) using a seeded hash.
    const pseudoRandom = (seed) => {
      const x = Math.sin(seed * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };

    let trailingRevenue = 400000;
    const points = Array.from({ length: pointCount }, (_, i) => {
      const d = new Date(startTime + i * msPerPoint);
      const progress = i / (pointCount - 1);
      const growthBaseline = 400000 + progress * 500000;
      const wobble = (pseudoRandom(i) - 0.5) * 220000;
      // Smooth the noise against the previous point so consecutive values don't jump around.
      trailingRevenue = trailingRevenue * 0.55 + (growthBaseline + wobble) * 0.45;
      return {
        date: d,
        month: d.toLocaleDateString("en-US", { day: "2-digit", month: "short" }),
        revenue: Math.max(0, Math.round(trailingRevenue / 500) * 500),
      };
    });

    invoices.forEach((inv) => {
      const date = inv.date || inv.createdAt;
      if (!date) return;
      const t = new Date(date).getTime();
      if (t < startTime || t > now.getTime()) return;
      const idx = Math.min(pointCount - 1, Math.max(0, Math.round((t - startTime) / msPerPoint)));
      points[idx].revenue += inv.amount || 0;
    });

    // Inverse wave: a pure cosine curve (not derived from the noisy data) that starts
    // high while revenue is low and eases down as revenue trends up over the year —
    // a clean sinusoidal shape rather than a mirrored copy of the real line.
    const revenueMax = Math.max(...points.map((p) => p.revenue));
    const revenueMin = Math.min(...points.map((p) => p.revenue));
    const mid = (revenueMax + revenueMin) / 2;
    const amplitude = (revenueMax - revenueMin) / 2;
    points.forEach((p, i) => {
      const t = i / (pointCount - 1);
      p.inverseRevenue = mid + amplitude * Math.cos(t * Math.PI);
    });

    return points;
  }, [invoices]);

  const salesRevenueYMax = useMemo(() => {
    const max = Math.max(0, ...monthlySalesRevenueData.map((m) => m.revenue));
    if (max === 0) return 100;
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / magnitude) * magnitude;
  }, [monthlySalesRevenueData]);

  // Only show one tick per calendar month on the X-axis, even though the underlying data is daily.
  const salesRevenueMonthTicks = useMemo(() => {
    const ticks = [];
    let lastMonthKey = null;
    monthlySalesRevenueData.forEach((p) => {
      const monthKey = `${p.date.getFullYear()}-${p.date.getMonth()}`;
      if (monthKey !== lastMonthKey) {
        ticks.push(p.month);
        lastMonthKey = monthKey;
      }
    });
    return ticks;
  }, [monthlySalesRevenueData]);

  const formatSalesRevenueMonthTick = (value) => value.split(" ")[0] || value;

  // Default the Sales Revenue plot to showing the current year (rightmost 12 months);
  // older years are still reachable by scrolling left.
  useEffect(() => {
    if (!loading && salesRevenueScrollRef.current) {
      salesRevenueScrollRef.current.scrollLeft = salesRevenueScrollRef.current.scrollWidth;
    }
  }, [loading, monthlySalesRevenueData, isMobileViewport]);

  // ------------------- Auth Check ---------------------
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));

    if (!storedUser) {
      return navigate("/login");
    }

    // Remove the admin restriction
    setUser(storedUser);
  }, [navigate]);

  // ------------------- Data Fetching -------------------
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        // const [
        //   companiesRes,
        //   contactsRes,
        //   dealsRes,
        //   tasksRes,
        //   invoicesRes,
        //   meetingRes,
        // ] = await Promise.all([
        //   API.get("/companies"),
        //   API.get("/contacts"),
        //   API.get("/deals"),
        //   API.get("/tasks/admin"),
        //   API.get("/invoices"),
        //   API.get("/meetings/all-meetings"),
        // ]);

        const [
          companiesRes,
          contactsRes,
          dealsRes,
          tasksRes,
          invoicesRes,
          meetingRes,
        ] = await Promise.all([
          API.get("/companies"),
          API.get("/contacts"),
          API.get("/deals/dashboard-deals"),
          API.get("/tasks"), // ⬅️ staff can now access this
          API.get("/invoices"), // ⬅️ filtered automatically
          API.get("/meetings/dashboard"), // ⬅️ staff gets own meetings
        ]);

        const allInvoices = invoicesRes.data;

        setDeals(dealsRes.data);
        setTotalClients(companiesRes.data.length);
        setActiveDeals(dealsRes.data.filter((d) => d.status === "Open").length);

        const allTasksData = tasksRes.data;
        setTasks(
          allTasksData.filter((t) => t.status === "Pending").slice(0, 3)
        );
        setAllTasks(allTasksData);
        setTotalTasks(allTasksData.length);

        setAllMeetings(meetingRes.data);
        setMeetings(meetingRes.data.slice(0, 3));
        setTotalMeetings(meetingRes.data.length);

        setInvoices(allInvoices);
        setAverageDealSize(calculateAverageDealAmount(dealsRes.data));
        setInvoiceStats(calculateInvoiceStats(allInvoices));
      } catch (err) {
        console.log(err);
        if (err.response?.data?.code == "NO_SUBSCRIPTION") {
          navigate("/subscription");
        }
        console.error("Dashboard error:", err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [navigate]);

  // ------------------- Loading UI -------------------
  // if (loading) {
  //   return (
  //     <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-100 z-50">
  //       <img
  //         src={logo}
  //         alt="Loading..."
  //         className="animate-spin drop-shadow-lg"
  //         style={{
  //           width: 48,
  //           height: 48,
  //           animationDuration: "1.8s",
  //           filter: "invert(100%)",
  //         }}
  //       />
  //       <p className="mt-3 text-gray-600 font-medium">{loadingMessage}</p>
  //     </div>
  //   );
  // }

  // ------------------- Error UI -------------------
  if (error) {
    return <div></div>;
  }

  // ------------------- CRM tab (empty for now) -------------------
  if (activeDashboardTab === "CRM") {
    return <div></div>;
  }

  // ------------------- Invoices tab -------------------
  if (activeDashboardTab === "Invoices") {
    return (
      <div style={{ marginTop: -16 }}>
        <div
          className="box-border flex flex-row justify-between items-center"
          style={{
            position: "fixed",
            top: 64,
            left: "var(--sidebar-width, 0px)",
            right: 0,
            zIndex: 40,
            padding: "0px 24px",
            gap: 16,
            height: 64,
            minHeight: 64,
            maxHeight: 64,
            background: "#FFFFFF",
            borderBottom: "1px solid #E1E4EA",
            boxSizing: "border-box",
          }}
        >
          <div
            className="flex flex-col items-start flex-shrink-0"
            style={{ gap: 6, width: 614, height: 39 }}
          >
            <span
              style={{
                fontFamily: "Inter",
                fontWeight: 500,
                fontSize: 16,
                lineHeight: "120%",
                letterSpacing: "-0.5px",
                color: "#0E121B",
              }}
            >
              Invoices
            </span>
            <span
              style={{
                fontFamily: "Inter",
                fontWeight: 400,
                fontSize: 12,
                lineHeight: "120%",
                color: "#525866",
              }}
            >
              Visual summary of key lead performance metrics and your data
            </span>
          </div>
        </div>
        {/* Spacer to offset the fixed header bar */}
        <div style={{ height: 64 }} />

        {/* KPI Cards */}
        <div
          className="flex flex-row items-stretch -mx-4 sm:-mx-6 lg:-mx-8 px-6"
          style={{ gap: 16, marginTop: 24 }}
        >
          {[
            { icon: TotalIncomeIcon, label: "Total Invoices Issued", value: `₹${Math.round(invoiceStats.total).toLocaleString("en-IN")}`, trend: `${invoiceKpiTrends.total.pct}% this month`, trendUp: invoiceKpiTrends.total.up },
            { icon: RevenueGeneratedIcon, label: "Paid Invoices", value: `₹${Math.round(invoiceStats.accepted).toLocaleString("en-IN")}`, trend: `${invoiceKpiTrends.paid.pct}% this month`, trendUp: invoiceKpiTrends.paid.up },
            { icon: TotalDealsClosedIcon, label: "Pending Invoices", value: `₹${Math.round(invoiceStats.sent).toLocaleString("en-IN")}`, trend: `${invoiceKpiTrends.pending.pct}% this month`, trendUp: invoiceKpiTrends.pending.up },
            { icon: DealValueOvertimeIcon, label: "Due Invoices", value: `₹${Math.round(invoiceStats.due).toLocaleString("en-IN")}`, trend: `${invoiceKpiTrends.due.pct}% this month`, trendUp: invoiceKpiTrends.due.up },
          ].map(({ icon: Icon, label, value, trend, trendUp }, i) => (
            <div
              key={i}
              className="box-border flex flex-col justify-center items-start relative min-w-0"
              style={{ padding: 16, height: 72, background: "#FFFFFF", border: "1px solid #E1E4EA", borderRadius: 12, flex: "1 1 0" }}
            >
              <div className="flex flex-row items-end w-full" style={{ gap: 14, height: 40 }}>
                <div
                  className="box-border flex items-center justify-center flex-shrink-0"
                  style={{ width: 40, height: 40, padding: 8, background: "rgba(255, 255, 255, 0.1)", border: "1px solid #E1E4EA", borderRadius: 6 }}
                >
                  <Icon size={24} style={{ color: "#0085FF" }} />
                </div>
                <div className="flex flex-col items-start flex-1 min-w-0" style={{ gap: 4, height: 40 }}>
                  <span className="whitespace-nowrap" style={{ fontFamily: "'Inter Tight', Inter, sans-serif", fontWeight: 400, fontSize: 12, lineHeight: "120%", color: "#525866" }}>
                    {label}
                  </span>
                  {loading ? (
                    <Skeleton width={70} height={18} />
                  ) : (
                    <span className="whitespace-nowrap" style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 18, lineHeight: "120%", color: "#0E121B" }}>
                      {value}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-row items-center flex-shrink-0 absolute" style={{ gap: 4, right: 16, bottom: 16 }}>
                {loading ? (
                  <Skeleton width={60} height={12} />
                ) : (
                  <>
                    {trendUp ? (
                      <TrendingUp size={14} style={{ color: "#00C950" }} />
                    ) : (
                      <TrendingDown size={14} style={{ color: "#E82222" }} />
                    )}
                    <span className="whitespace-nowrap" style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 12, lineHeight: "120%", color: trendUp ? "#00C950" : "#E82222" }}>
                      {trend}
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div
          className="box-border flex flex-row items-center self-stretch"
          style={{ padding: 12, gap: 16, marginTop: 24, background: "rgba(0, 133, 255, 0.1)", border: "1px solid rgba(0, 133, 255, 0.2)", borderRadius: 8 }}
        >
          <div className="flex flex-row justify-end items-center flex-1 self-stretch" style={{ gap: 12 }}>
            <div
              className="flex flex-row items-center flex-shrink-0"
              style={{ padding: 8, gap: 10, width: 36, height: 36, background: "#FFFFFF", borderRadius: 8 }}
            >
              <InvoicesIcon size={20} style={{ color: "#0085FF" }} />
            </div>

            <div className="flex flex-col items-start flex-1" style={{ gap: 6, height: 40 }}>
              <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#0085FF" }}>
                2 Invoices Awaiting To Send
              </span>
              <span className="self-stretch" style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "140%", color: "#6B7280" }}>
                2 invoices are waiting to be sent to the client.
              </span>
            </div>

            <div className="flex flex-row items-center flex-shrink-0" style={{ gap: 8, width: 157, height: 32 }}>
              <button
                className="box-border flex flex-row justify-center items-center flex-shrink-0"
                style={{ padding: 12, gap: 8, width: 83, height: 32, background: "#FFFFFF", border: "1px solid rgba(31, 41, 55, 0.3)", borderRadius: 96 }}
              >
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "20px", color: "#1F2937" }}>
                  Dismiss
                </span>
              </button>

              <button
                className="flex flex-row justify-center items-center flex-shrink-0"
                style={{ padding: "12px 14px", gap: 10, width: 66, height: 32, background: "#0085FF", borderRadius: 96 }}
              >
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "20px", color: "#FFFFFF" }}>
                  View
                </span>
              </button>
            </div>
          </div>
        </div>

        <div
          className="-mx-4 sm:-mx-6 lg:-mx-8"
          style={{ marginTop: 24, borderBottom: "1px solid #E1E4EA" }}
        />

        <div className="flex flex-row" style={{ gap: 16, marginTop: 24, width: "100%" }}>
          <div
            className="box-border flex flex-col items-start min-w-0"
            style={{
              padding: 18,
              gap: 10,
              height: 470,
              background: "#FFFFFF",
              border: "1px solid #E1E4EA",
              borderRadius: 12,
              flex: "1 1 917px",
            }}
          >
            <span
              className="whitespace-nowrap"
              style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 16, lineHeight: "120%", color: "#1F2937" }}
            >
              Invoice Performance Analysis
            </span>

            <div className="self-stretch flex-shrink-0" style={{ width: "100%", height: 1, background: "#1F2937", opacity: 0.1 }} />

            <div className="flex flex-col items-start self-stretch flex-shrink-0" style={{ gap: 24, width: "100%", height: 101 }}>
              <div className="flex flex-row items-start self-stretch flex-shrink-0" style={{ gap: 24, width: "100%", height: 51 }}>
                {[
                  { label: "Lorem Ipsum", value: "+2.1%", color: "#1F2937" },
                  { label: "Lorem Ipsum", value: "95%", color: "#1F2937" },
                  { label: "Lorem Ipsum", value: "3.3L INR", color: "#1F2937" },
                  { label: "Lorem Ipsum", value: "12%", color: "#00C950" },
                ].map((item, idx) => (
                  <>
                    <div key={idx} className="flex flex-col items-start self-stretch flex-1" style={{ gap: 8, width: 184.25, height: 51 }}>
                      <span className="self-stretch" style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#1F2937", opacity: 0.7 }}>
                        {item.label}
                      </span>
                      <span className="self-stretch" style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 24, lineHeight: "120%", color: item.color }}>
                        {item.value}
                      </span>
                    </div>
                    {idx < 3 && <div key={`divider-${idx}`} className="self-stretch flex-shrink-0" style={{ width: 0, borderLeft: "1px solid rgba(31, 41, 55, 0.3)" }} />}
                  </>
                ))}
              </div>

              <div className="self-stretch flex-shrink-0" style={{ width: "100%", height: 1, background: "#1F2937", opacity: 0.1 }} />
            </div>

            <div
              className="flex flex-col justify-center items-center self-stretch flex-shrink-0"
              style={{ padding: "14px 0px", gap: 10, width: "100%", height: 282, background: "#F8FAFC", borderRadius: 14 }}
            >
              <div className="flex flex-col items-start self-stretch flex-shrink-0 relative" style={{ gap: 6, width: "100%", height: 230 }}>
                <div className="flex flex-col justify-between items-center self-stretch flex-shrink-0" style={{ gap: 10, width: "100%", height: 210 }}>
                  {[
                    { pct: "9%", dashed: true },
                    { pct: "8%", dashed: true },
                    { pct: "7%", dashed: true },
                    { pct: "6%", dashed: true },
                    { pct: "5%", dashed: false },
                  ].map((row) => (
                    <div key={row.pct} className="mx-auto flex flex-row items-center self-stretch flex-shrink-0" style={{ gap: 6, width: "100%", height: 14 }}>
                      <span style={{ width: 22, height: 14, fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", textAlign: "right", color: "#1F2937" }}>
                        {row.pct}
                      </span>
                      <div
                        className="flex-1"
                        style={{
                          height: 0,
                          borderTop: row.dashed ? "1px dashed rgba(31, 41, 55, 0.1)" : "1px solid rgba(31, 41, 55, 0.3)",
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div className="mx-auto flex flex-row justify-between items-center self-stretch flex-shrink-0" style={{ padding: "0px 0px 0px 28px", gap: 10, width: "100%", height: 14 }}>
                  {["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8"].map((q) => (
                    <span key={q} className="mx-auto" style={{ height: 14, fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", textAlign: "right", color: "#1F2937" }}>
                      {q}
                    </span>
                  ))}
                </div>

                <div className="absolute flex flex-row justify-between items-center" style={{ gap: 22, width: "93.4%", height: 196, left: "3.4%", top: 7 }}>
                  {Array.from({ length: 8 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="self-stretch flex-shrink-0"
                      style={{ width: 0, borderLeft: idx === 0 ? "1px solid rgba(31, 41, 55, 0.3)" : "1px dashed rgba(31, 41, 55, 0.1)" }}
                    />
                  ))}
                </div>

              </div>

              <div className="flex flex-row justify-center items-center" style={{ gap: 16, width: "100%", height: 14 }}>
                <div className="flex flex-row items-center flex-shrink-0" style={{ gap: 4, width: 95, height: 14 }}>
                  <div className="flex-shrink-0" style={{ width: 16, height: 8, background: "#0AA43E", borderRadius: 4 }} />
                  <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#1F2937" }}>
                    Lorem Ipsum
                  </span>
                </div>

                <div className="flex flex-row items-center flex-shrink-0" style={{ gap: 4, width: 95, height: 14 }}>
                  <div className="flex-shrink-0" style={{ width: 16, height: 8, background: "#0085FF", borderRadius: 4 }} />
                  <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#1F2937" }}>
                    Lorem Ipsum
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div
            className="box-border flex flex-col items-start flex-shrink-0"
            style={{
              padding: 18,
              gap: 16,
              width: 393,
              height: 470,
              background: "#FFFFFF",
              border: "1px solid #E1E4EA",
              borderRadius: 12,
            }}
          >
            <div className="flex flex-row justify-between items-center self-stretch flex-shrink-0" style={{ gap: 16, width: "100%", height: 32 }}>
              <span
                className="whitespace-nowrap"
                style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 16, lineHeight: "120%", color: "#1F2937" }}
              >
                Invoice History
              </span>

              <button
                onClick={() => navigate("/invoices")}
                className="box-border flex flex-row justify-center items-center flex-shrink-0 hover:bg-gray-50 transition-colors"
                style={{ padding: 12, gap: 8, width: 84, height: 32, background: "#FFFFFF", border: "1px solid rgba(31, 41, 55, 0.3)", borderRadius: 96 }}
              >
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "20px", color: "#1F2937" }}>
                  View All
                </span>
              </button>
            </div>

            <div
              className="box-border flex flex-col items-start self-stretch min-h-0"
              style={{ padding: 8, gap: 6, width: "100%", background: "#F8FAFC", borderRadius: 6, flex: 1 }}
            >
              <div
                className="flex flex-row items-center self-stretch flex-shrink-0"
                style={{ width: "100%", height: 32, background: "#FFFFFF", borderRadius: 96 }}
              >
                <div className="flex flex-row justify-center items-center flex-1" style={{ padding: "4px 6px 4px 16px", gap: 10, height: 22 }}>
                  <span className="flex-1" style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 12, lineHeight: "120%", color: "#1F2937" }}>
                    Invoice
                  </span>
                </div>
                <div className="flex flex-row items-center flex-1" style={{ padding: "4px 6px", gap: 10, height: 22 }}>
                  <span className="flex-1" style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 12, lineHeight: "120%", textAlign: "right", color: "#1F2937" }}>
                    Amount
                  </span>
                </div>
                <div className="flex flex-row justify-center items-center flex-1" style={{ padding: "4px 6px", gap: 10, height: 22 }}>
                  <span className="flex-1" style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 12, lineHeight: "120%", color: "#1F2937" }}>
                    Status
                  </span>
                </div>
              </div>

              <div className="self-stretch flex-shrink-0" style={{ width: "100%", height: 1, background: "#1F2937", opacity: 0.1 }} />

              <div className="flex flex-col items-start self-stretch min-h-0 overflow-y-auto dc-card-scroll" style={{ gap: 2, width: "100%", flex: 1 }}>
                {invoices.map((inv, idx) => {
                  const isPaid = inv.status?.toLowerCase() === "paid" || inv.status?.toLowerCase() === "accepted";
                  return (
                  <div key={inv._id || idx} className="flex flex-col items-start self-stretch flex-shrink-0">
                    <div className="flex flex-row items-center self-stretch flex-shrink-0" style={{ width: "100%", height: 44 }}>
                      <div className="flex flex-row justify-center items-center flex-1" style={{ padding: "8px 6px 8px 16px", gap: 10, height: 30 }}>
                        <span className="flex-1" style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#1F2937" }}>
                          {inv.invoiceNumber || `INV-${idx}`}
                        </span>
                      </div>
                      <div className="flex flex-row items-center flex-1" style={{ padding: "8px 6px", gap: 10, height: 30 }}>
                        <span className="flex-1" style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 12, lineHeight: "120%", textAlign: "right", color: "#1F2937" }}>
                          {`${Math.round(inv.amount || 0).toLocaleString("en-IN")} INR`}
                        </span>
                      </div>
                      <div className="flex flex-row items-center flex-1" style={{ padding: "8px 6px", gap: 10, height: 34 }}>
                        <div
                          className="flex flex-row justify-center items-center flex-shrink-0"
                          style={{
                            padding: "6px 8px",
                            gap: 10,
                            height: 18,
                            borderRadius: 48,
                            background: isPaid ? "rgba(0, 201, 80, 0.1)" : "rgba(254, 89, 25, 0.1)",
                          }}
                        >
                          <span
                            className="whitespace-nowrap"
                            style={{
                              fontFamily: "Inter",
                              fontWeight: 600,
                              fontSize: 10,
                              lineHeight: "120%",
                              color: isPaid ? "#00C950" : "#FE5919",
                            }}
                          >
                            {inv.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="self-stretch flex-shrink-0" style={{ width: "100%", height: 1, background: "#1F2937", opacity: 0.1 }} />
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {showBulkStrip ? (
          <div
            className={`${bulkStripClosing ? "animate-slideOutLeft" : "animate-slideInLeft"} flex flex-wrap items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4`}
            style={{ width: "100%", minHeight: 44, marginTop: 24 }}
          >
            <div className="flex flex-wrap items-center gap-2 py-2">
              <button
                onClick={handleExportSelectedInvoices}
                className="px-3.5 py-2 bg-white border border-green-600 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={() => setShowBulkInvoiceStatusModal(true)}
                className="px-3.5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Bulk Update
              </button>
              <button
                onClick={() => setShowBulkInvoiceDeleteModal(true)}
                className="px-3.5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <button
                onClick={() => setSelectedInvoices([])}
                className="px-3.5 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
            <div className="flex items-center gap-3">
              <CheckSquare className="w-5 h-5 text-blue-600" />
              <span className="text-blue-800 font-semibold font-inter text-sm">
                {selectedInvoices.length} invoice{selectedInvoices.length !== 1 ? "s" : ""} selected
              </span>
              <button
                onClick={handleSelectAllInvoicesAcrossPages}
                className="px-3.5 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <CheckSquare className="w-4 h-4" />
                Select All
              </button>
              <button
                onClick={handleDeselectAllInvoicesExtra}
                className="px-3.5 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Deselect All
              </button>
            </div>
          </div>
        ) : (
        <div
          className="flex flex-row justify-between items-center"
          style={{ gap: 16, width: "100%", height: 44, marginTop: 24 }}
        >
          <div className="flex flex-col items-start flex-shrink-0" style={{ gap: 6, width: 614, height: 19 }}>
            <span
              className="whitespace-nowrap"
              style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 16, lineHeight: "120%", letterSpacing: "-0.5px", color: "#0E121B" }}
            >
              Top Invoices
            </span>
          </div>

          <div className="flex flex-row items-center flex-shrink-0" style={{ gap: 12, width: 528, height: 44 }}>
            <div
              className="box-border flex flex-row items-center flex-1"
              style={{ padding: "12px 14px", gap: 10, height: 44, border: "1px solid rgba(31, 41, 55, 0.1)", borderRadius: 95 }}
            >
              <Search size={20} style={{ opacity: 0.5, color: "#1F2937", flexShrink: 0 }} />
              <input
                type="text"
                value={invoiceSearchTerm}
                onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                placeholder="Search invoice by number, client, or deal..."
                className="w-full bg-transparent outline-none"
                style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 14, lineHeight: "20px", color: "#1F2937" }}
              />
            </div>

            <button
              className="box-border flex flex-row justify-center items-center flex-shrink-0"
              style={{ padding: 12, gap: 8, width: 44, height: 44, background: "#FFFFFF", border: "1px solid #E1E4EA", borderRadius: 95 }}
            >
              <FilterIcon size={20} style={{ color: "#1F2937" }} />
            </button>

            <button
              className="box-border flex flex-row justify-center items-center flex-shrink-0"
              style={{ padding: 12, gap: 8, width: 44, height: 44, background: "#FFFFFF", border: "1px solid #E1E4EA", borderRadius: 96 }}
            >
              <MoreVertical size={20} style={{ color: "#1F2937" }} />
            </button>
          </div>
        </div>
        )}

        <div
          className="box-border overflow-hidden"
          style={{
            padding: 0,
            width: "100%",
            background: "#FFFFFF",
            border: "1px solid #E1E4EA",
            borderRadius: 8,
            marginTop: 16,
          }}
        >
          <DataTable
            variant="card"
            maxHeight={440}
            data={paginatedInvoices}
            columns={invoiceTableColumns}
            columnSizing={invoiceColumnSizing}
            onColumnSizingChange={setInvoiceColumnSizing}
            pinnedColumns={invoicePinnedColumns}
            visibleColumns={invoiceVisibleColumns}
            onColumnReorder={handleInvoiceColumnReorder}
            getGhostPreview={getInvoiceGhostPreview}
            rowClassName={(inv) => (selectedInvoicesSet.has(inv._id) ? "!bg-blue-50" : "")}
            emptyContent={<p className="font-medium">No invoices found</p>}
          />

          {/* Pagination - Companies-style, contained within the card (not a fixed bottom navbar) */}
          {sortedInvoices.length > 0 && (
            <div
              className="w-full bg-white px-4 py-3 flex items-center justify-between flex-shrink-0"
              style={{ borderTop: "1px solid #E1E4EA" }}
            >
              <div className="flex items-center space-x-2">
                <p className="text-sm text-gray-700 font-inter">
                  Showing <span className="font-semibold">{(invoicePage - 1) * invoicesPerPage + 1}</span> to{" "}
                  <span className="font-semibold">{Math.min(invoicePage * invoicesPerPage, sortedInvoices.length)}</span> of{" "}
                  <span className="font-semibold">{sortedInvoices.length}</span> results
                </p>
                <div className="relative ml-2">
                  <select
                    value={invoicesPerPage}
                    onChange={(e) => setInvoicesPerPage(parseInt(e.target.value))}
                    className="appearance-none border border-gray-300 rounded-lg pl-3 pr-8 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-inter"
                  >
                    <option value={10}>10 per page</option>
                    <option value={20}>20 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                    <option value={150}>150 per page</option>
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInvoicePage((p) => Math.max(1, p - 1))}
                  disabled={invoicePage === 1}
                  className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {(() => {
                  const commitPage = () => {
                    const n = parseInt(invoicePageInput, 10);
                    if (!Number.isNaN(n)) setInvoicePage(Math.min(Math.max(n, 1), invoiceTotalPages));
                    setInvoiceEditingPage(false);
                  };
                  const items = [1];
                  if (invoicePage > 2) items.push("left-dots");
                  if (invoicePage !== 1 && invoicePage !== invoiceTotalPages) items.push(invoicePage);
                  if (invoicePage < invoiceTotalPages - 1) items.push("right-dots");
                  if (invoiceTotalPages > 1) items.push(invoiceTotalPages);

                  return items.map((item, index) => {
                    if (item === "left-dots" || item === "right-dots") {
                      return (
                        <span
                          key={`${item}-${index}`}
                          className="flex items-center justify-center w-8 h-8 text-sm font-medium text-gray-400 select-none"
                        >
                          ....
                        </span>
                      );
                    }
                    const isCurrent = item === invoicePage;
                    if (isCurrent && invoiceEditingPage) {
                      return (
                        <input
                          key="page-edit"
                          autoFocus
                          type="number"
                          min={1}
                          max={invoiceTotalPages}
                          value={invoicePageInput}
                          onChange={(e) => setInvoicePageInput(e.target.value)}
                          onBlur={commitPage}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitPage();
                            if (e.key === "Escape") setInvoiceEditingPage(false);
                          }}
                          className="w-10 h-8 rounded-full border border-blue-500 text-center text-sm font-medium text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                      );
                    }
                    return (
                      <button
                        key={`page-${item}`}
                        onClick={() => setInvoicePage(item)}
                        onDoubleClick={() => {
                          if (isCurrent) {
                            setInvoicePageInput(String(invoicePage));
                            setInvoiceEditingPage(true);
                          }
                        }}
                        title={isCurrent ? "Double-click to type a page number" : undefined}
                        className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                          isCurrent
                            ? "bg-blue-600 text-white"
                            : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {item}
                      </button>
                    );
                  });
                })()}

                <button
                  onClick={() => setInvoicePage((p) => Math.min(invoiceTotalPages, p + 1))}
                  disabled={invoicePage === invoiceTotalPages}
                  className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {invoiceQuickView && (
          <InvoiceQuickView
            invoice={invoiceQuickView.invoice}
            mode={invoiceQuickView.mode}
            onClose={() => setInvoiceQuickView(null)}
            onUpdated={(updated) => {
              setInvoices((prev) => prev.map((i) => (i._id === updated._id ? { ...i, ...updated } : i)));
              setInvoiceQuickView((prev) => (prev ? { ...prev, invoice: { ...prev.invoice, ...updated } } : prev));
            }}
          />
        )}

        {showBulkInvoiceDeleteModal && (
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
                  Delete {selectedInvoices.length} selected invoice{selectedInvoices.length !== 1 ? "s" : ""}? This action cannot be undone.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setShowBulkInvoiceDeleteModal(false)}
                    disabled={bulkInvoiceLoading}
                    className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkDeleteInvoices}
                    disabled={bulkInvoiceLoading}
                    className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {bulkInvoiceLoading ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showBulkInvoiceStatusModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10005] p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-1 font-sf">
                  Bulk Update Status
                </h3>
                <p className="text-sm text-gray-500 font-inter mb-4">
                  Set status for {selectedInvoices.length} selected invoice{selectedInvoices.length !== 1 ? "s" : ""}.
                </p>
                <select
                  value={bulkInvoiceStatus}
                  onChange={(e) => setBulkInvoiceStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
                >
                  <option value="Pending">Pending</option>
                  <option value="Paid">Paid</option>
                  <option value="Overdue">Overdue</option>
                </select>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowBulkInvoiceStatusModal(false)}
                    disabled={bulkInvoiceLoading}
                    className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkUpdateInvoiceStatus}
                    disabled={bulkInvoiceLoading}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {bulkInvoiceLoading ? "Updating..." : "Update"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {invoiceToDelete && (
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
                  Delete invoice {invoiceToDelete.invoiceNumber || ""}? This action cannot be undone.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setInvoiceToDelete(null)}
                    className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteInvoice}
                    className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ------------------- Dashboard UI -------------------
  return (
    <div style={{ marginTop: -16 }}>
      <div
        className="box-border flex flex-row justify-between items-center h-[72px] min-h-[72px] max-h-[72px] px-6 py-3 top-[54px] lg:h-16 lg:min-h-16 lg:max-h-16 lg:px-6 lg:py-0 lg:top-16"
        style={{
          position: "fixed",
          left: "var(--sidebar-width, 0px)",
          right: 0,
          zIndex: 40,
          gap: 16,
          background: "#FFFFFF",
          borderBottom: "1px solid #E1E4EA",
          boxSizing: "border-box",
        }}
      >
        <div
          className="flex flex-col items-start flex-shrink-0"
          style={{ gap: 6, width: 614, height: 39 }}
        >
          <span
            style={{
              fontFamily: "Inter",
              fontWeight: 500,
              fontSize: 16,
              lineHeight: "120%",
              letterSpacing: "-0.5px",
              color: "#0E121B",
            }}
          >
            Overview
          </span>
          {loading ? (
            <Skeleton width={260} height={12} />
          ) : (
            <span
              style={{
                fontFamily: "Inter",
                fontWeight: 400,
                fontSize: 12,
                lineHeight: "120%",
                color: "#525866",
              }}
            >
              Visual summary of key lead performance metrics and your data
            </span>
          )}
        </div>
      </div>
      {/* Spacer to offset the fixed header bar */}
      <div className="h-[72px] lg:h-16" />

      {/* KPI Cards */}
      <div
        className="grid grid-cols-2 gap-3 lg:flex lg:flex-row lg:items-stretch lg:gap-4 -mx-4 sm:-mx-6 lg:-mx-8 px-6"
        style={{ marginTop: 24 }}
      >
        {[
          { icon: TotalIncomeIcon, label: "Total Income", value: `₹${Math.round(overviewKpis.totalIncome).toLocaleString("en-IN")}`, trend: `${overviewKpis.totalIncomeTrend.pct}% this month`, trendUp: overviewKpis.totalIncomeTrend.up },
          { icon: RevenueGeneratedIcon, label: "Revenue Generated", value: `₹${Math.round(overviewKpis.revenueGenerated).toLocaleString("en-IN")}`, trend: `${overviewKpis.revenueGeneratedTrend.pct}% this month`, trendUp: overviewKpis.revenueGeneratedTrend.up },
          { icon: TotalDealsClosedIcon, label: "Total Deals Closed", value: `${overviewKpis.dealsClosedCount}`, trend: `${overviewKpis.dealsClosedTrend.pct}% this month`, trendUp: overviewKpis.dealsClosedTrend.up },
          { icon: DealValueOvertimeIcon, label: "Deal Value Overtime", value: `₹${Math.round(overviewKpis.dealValue).toLocaleString("en-IN")}`, trend: `${overviewKpis.dealValueTrend.pct}% this month`, trendUp: overviewKpis.dealValueTrend.up },
        ].map(({ icon: Icon, label, value, trend, trendUp }, i) => (
          <div
            key={i}
            className="box-border flex flex-row justify-start items-center relative w-full h-[89px] rounded-2xl shadow-sm lg:shadow-none lg:rounded-xl lg:justify-between lg:items-start lg:min-w-[200px] lg:w-[313.5px] lg:h-[72px] lg:flex-1 lg:shrink lg:basis-0"
            style={{
              padding: 16,
              background: "#FFFFFF",
              border: "1px solid #E1E4EA",
            }}
          >
            <div className="flex flex-row items-center w-full min-w-0" style={{ gap: 14 }}>
              {loading ? (
                <Skeleton width={40} height={40} />
              ) : (
                <>
                  {/* Mobile: plain icon, no badge/border */}
                  <div className="flex lg:hidden flex-shrink-0">
                    <Icon size={20} style={{ color: "#0085FF" }} />
                  </div>
                  {/* Desktop: original icon style */}
                  <div
                    className="hidden lg:flex box-border items-center justify-center flex-shrink-0"
                    style={{
                      width: 40,
                      height: 40,
                      padding: 8,
                      background: "rgba(255, 255, 255, 0.1)",
                      border: "1px solid #E1E4EA",
                      borderRadius: 6,
                    }}
                  >
                    <Icon size={24} style={{ color: "#0085FF" }} />
                  </div>
                </>
              )}
              <div className="flex flex-col items-start min-w-0 flex-1" style={{ gap: 4 }}>
                {loading ? (
                  <Skeleton width={90} height={10} />
                ) : (
                  <span
                    className="truncate w-full text-[10px] sm:text-xs uppercase tracking-wide font-semibold lg:normal-case lg:tracking-normal lg:font-normal lg:text-xs"
                    style={{ fontFamily: "'Inter Tight', Inter, sans-serif", lineHeight: "120%", color: "#525866" }}
                  >
                    {label}
                  </span>
                )}
                {loading ? (
                  <Skeleton width={70} height={16} />
                ) : (
                  <span
                    className="truncate w-full text-base sm:text-lg"
                    style={{ fontFamily: "Inter", fontWeight: 600, lineHeight: "120%", color: "#0E121B" }}
                  >
                    {value}
                  </span>
                )}
                {/* Trend, inline under the value on mobile (matches Figma mobile card) */}
                {!loading && (
                  <div className="flex lg:hidden flex-row items-center w-full min-w-0" style={{ gap: 4 }}>
                    {trendUp ? (
                      <TrendingUp size={12} className="flex-shrink-0" style={{ color: "#00C950" }} />
                    ) : (
                      <TrendingDown size={12} className="flex-shrink-0" style={{ color: "#E82222" }} />
                    )}
                    <span
                      className="truncate min-w-0 text-[9px]"
                      style={{ fontFamily: "Inter", fontWeight: 400, lineHeight: "120%", color: trendUp ? "#00C950" : "#E82222" }}
                    >
                      {trend}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {/* Trend, absolute bottom-right on desktop */}
            <div
              className="hidden lg:flex flex-row items-center flex-shrink-0 absolute"
              style={{ gap: 4, right: 16, bottom: 16 }}
            >
              {loading ? (
                <Skeleton width={60} height={11} />
              ) : (
                <>
                  {trendUp ? (
                    <TrendingUp size={14} style={{ color: "#00C950" }} />
                  ) : (
                    <TrendingDown size={14} style={{ color: "#E82222" }} />
                  )}
                  <span
                    className="whitespace-nowrap"
                    style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 12, lineHeight: "120%", color: trendUp ? "#00C950" : "#E82222" }}
                  >
                    {trend}
                  </span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* KPI section divider, 120px below the strip's divider (24 + 72 card height + 24) */}
      <div
        className="-mx-4 sm:-mx-6 lg:-mx-8"
        style={{ marginTop: 24, borderBottom: "1px solid #E1E4EA" }}
      />

      <div className="flex flex-col items-start" style={{ gap: 6, width: 186, height: 19, marginTop: 24 }}>
        <span
          className="whitespace-nowrap"
          style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 16, lineHeight: "120%", letterSpacing: "-0.5px", color: "#0E121B" }}
        >
          Sales Revenue
        </span>
      </div>

      <div
        className="box-border flex flex-row items-stretch self-stretch"
        style={{ padding: 12, gap: 16, height: 450, maxHeight: 450, border: "1px solid #E1E4EA", borderRadius: 12, marginTop: 16, flexShrink: 0 }}
      >
        {loading ? (
          <div className="flex flex-row flex-1 min-w-0" style={{ gap: 0 }}>
            <div
              className="flex flex-col justify-between items-start flex-shrink-0"
              style={{ width: 64, height: "100%", padding: "8px 0" }}
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} width={44} height={11} />
              ))}
            </div>
            <div className="flex-1 min-w-0 animate-pulse" style={{ height: "100%" }}>
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 400 160"
                preserveAspectRatio="none"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0 130 C 20 125, 35 118, 50 122 C 65 126, 75 132, 90 128 C 105 124, 115 100, 130 90 C 145 80, 155 96, 170 92 C 185 88, 195 60, 210 50 C 225 40, 235 58, 250 55 C 265 52, 280 68, 295 72 C 310 76, 320 62, 335 66 C 350 70, 365 82, 380 86 L 400 88 L 400 160 L 0 160 Z"
                  fill="#E5E7EB"
                />
                <path
                  d="M0 130 C 20 125, 35 118, 50 122 C 65 126, 75 132, 90 128 C 105 124, 115 100, 130 90 C 145 80, 155 96, 170 92 C 185 88, 195 60, 210 50 C 225 40, 235 58, 250 55 C 265 52, 280 68, 295 72 C 310 76, 320 62, 335 66 C 350 70, 365 82, 380 86 L 400 88"
                  stroke="#D1D5DB"
                  strokeWidth="2"
                  fill="none"
                />
              </svg>
            </div>
          </div>
        ) : (
          <div className="flex flex-row flex-1 min-w-0" style={{ gap: 0 }}>
            {/* Fixed Y-axis, mirrors the Financial Overview chart's fixed axis column */}
            <div style={{ width: 64, height: "100%", flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlySalesRevenueData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={false}
                    padding={{ left: 0, right: 0 }}
                  />
                  <YAxis
                    domain={[0, salesRevenueYMax]}
                    tickFormatter={formatSalesRevenueTick}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={64}
                    tick={{ fontSize: 12, fontFamily: "Inter", fill: "rgba(33, 32, 31, 0.56)" }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="none" fill="none" isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div
              ref={salesRevenueScrollRef}
              className="sales-revenue-chart-scroll flex-1 min-w-0 overflow-x-auto overflow-y-hidden"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none", cursor: "grab", height: "100%" }}
            >
              <div
                style={{
                  minWidth: `${Math.max(100, (salesRevenueMonthTicks.length / (isMobileViewport ? 5 : 12)) * 100)}%`,
                  height: "100%",
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlySalesRevenueData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0C4FCD" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0C4FCD" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7E4E3" vertical={false} />
                    <XAxis
                      dataKey="month"
                      ticks={salesRevenueMonthTicks}
                      tickFormatter={formatSalesRevenueMonthTick}
                      tickLine={false}
                      axisLine={false}
                      padding={{ left: 12, right: 12 }}
                      tick={{ fontSize: 12, fontFamily: "Inter", fill: "rgba(33, 32, 31, 0.56)" }}
                    />
                    <YAxis domain={[0, salesRevenueYMax]} hide />
                    <Area
                      type="linear"
                      dataKey="revenue"
                      stroke="#0C4FCD"
                      strokeWidth={2}
                      fill="url(#salesRevenueGradient)"
                      isAnimationActive={false}
                      dot={(dotProps) => {
                        const { cx, cy, index, key } = dotProps;
                        if (index !== monthlySalesRevenueData.length - 1) return <Fragment key={key} />;
                        return <circle key={key} cx={cx} cy={cy} r={6} fill="#FFFFFF" stroke="#0C4FCD" strokeWidth={1} />;
                      }}
                    />
                    <Line
                      type="natural"
                      dataKey="inverseRevenue"
                      stroke="#34C759"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      dot={false}
                      activeDot={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row" style={{ gap: 16, marginTop: 16, width: "100%" }}>
        <div
          className="box-border flex flex-col items-start flex-none w-full lg:flex-1 lg:basis-0 lg:w-auto"
          style={{
            padding: 18,
            gap: 16,
            minWidth: 0,
            height: 390,
            background: "#FFFFFF",
            border: "1px solid #E1E4EA",
            boxShadow: "0px 38px 23px rgba(0, 0, 0, 0.01), 0px 17px 17px rgba(0, 0, 0, 0.02), 0px 4px 9px rgba(0, 0, 0, 0.02)",
            borderRadius: 12,
          }}
        >
          <div className="flex flex-row items-start self-stretch flex-shrink-0" style={{ gap: 16, width: "100%", height: 88 }}>
            <div className="flex flex-col items-start flex-1 min-w-0" style={{ gap: 8, height: 76 }}>
              {loading ? (
                <Skeleton width={110} height={12} />
              ) : (
              <span
                className="self-stretch truncate text-[11px] sm:text-sm"
                style={{ fontFamily: "'Inter Tight', Inter, sans-serif", fontWeight: 500, lineHeight: "120%", color: "#1F2937", opacity: 0.7 }}
              >
                Total Invoices Issued
              </span>
              )}
              {loading ? (
                <Skeleton width={140} height={24} />
              ) : (
                <span
                  className="self-stretch truncate text-base sm:text-2xl"
                  style={{ fontFamily: "'Inter Tight', Inter, sans-serif", fontWeight: 600, lineHeight: "120%", color: "#000000" }}
                >
                  ₹{Math.round(invoiceStats.total).toLocaleString("en-IN")}
                </span>
              )}
              {loading ? (
                <Skeleton width={80} height={12} />
              ) : (
                <span
                  className="self-stretch truncate text-[10px] sm:text-xs"
                  style={{ fontFamily: "Inter", fontWeight: 500, lineHeight: "120%", color: "#6B7280" }}
                >
                  {totalInvoicesCard.clearedPct}% Cleared
                </span>
              )}
            </div>

            <div className="flex-shrink-0 self-stretch" style={{ width: 1, background: "#1F2937", opacity: 0.1 }} />

            <div className="flex flex-col items-start flex-1 min-w-0" style={{ gap: 8, height: 88 }}>
              {loading ? (
                <Skeleton width={80} height={12} />
              ) : (
                <span
                  className="self-stretch truncate text-[10px] sm:text-xs"
                  style={{ fontFamily: "Inter", fontWeight: 500, lineHeight: "120%", color: "#1F2937", opacity: 0.7 }}
                >
                  {totalInvoicesCard.topClient?.companyName || "No invoices yet"}
                </span>
              )}

              {loading ? (
                <Skeleton width="100%" height={66} shape="rect" className="rounded-md" />
              ) : (
                <div
                  className="box-border flex flex-col items-start self-stretch flex-shrink-0"
                  style={{ padding: 6, gap: 6, height: 66, background: "#F8FAFC", borderRadius: 6 }}
                >
                  <div className="flex flex-row justify-between items-center self-stretch flex-shrink-0 min-w-0" style={{ gap: 8, height: 12 }}>
                    <span className="truncate min-w-0" style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 10, lineHeight: "120%", color: "#6B7280" }}>
                      {totalInvoicesCard.topClient?.dealTitle || "—"}
                    </span>
                    <span className="flex-shrink-0" style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 10, lineHeight: "120%", color: "#1F2937" }}>
                      {totalInvoicesCard.topClientPct}%
                    </span>
                  </div>

                  <div className="flex flex-row items-start self-stretch flex-shrink-0" style={{ gap: 2, height: 18 }}>
                    {Array.from({ length: 39 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="flex-1"
                        style={{
                          width: 2.32,
                          height: 18,
                          background: idx < Math.round((totalInvoicesCard.topClientPct / 100) * 39) ? "#0085FF" : "#E2E5E8",
                        }}
                      />
                    ))}
                  </div>

                  <div className="flex flex-row justify-between items-center self-stretch flex-shrink-0" style={{ gap: 8, height: 12 }}>
                    <span style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 10, lineHeight: "120%", color: "#6B7280" }}>
                      Invoices Paid
                    </span>
                    <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 10, lineHeight: "120%", color: "#1F2937" }}>
                      {totalInvoicesCard.topClient?.paidCount || 0} of {totalInvoicesCard.topClient?.count || 0}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="self-stretch flex-shrink-0" style={{ width: "100%", height: 1, background: "#1F2937", opacity: 0.1 }} />

          <div
            className="box-border flex flex-col items-start self-stretch flex-shrink-0"
            style={{ padding: 8, gap: 6, isolation: "isolate", width: "100%", height: 233, background: "#F8FAFC", borderRadius: 6 }}
          >
            {loading ? (
              <Skeleton width={130} height={12} />
            ) : (
            <span
              className="self-stretch"
              style={{ fontFamily: "'Inter Tight', Inter, sans-serif", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#1F2937" }}
            >
              Payment Progress
            </span>
            )}

            {loading ? (
              <Skeleton width="100%" height={197} shape="rect" className="rounded-md" />
            ) : (
              <div className="relative flex flex-row items-center self-stretch flex-shrink-0" style={{ height: 197 }}>
                {totalInvoicesCard.points.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col justify-center items-center self-stretch flex-1"
                    style={{ gap: 6 }}
                  >
                    <div className="flex-1" style={{ width: 1, background: "rgba(31, 41, 55, 0.1)" }} />
                    <span style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 12, lineHeight: "120%", color: "#6B7280" }}>
                      {totalInvoicesCard.months[idx]}
                    </span>
                  </div>
                ))}

                <div className="absolute" style={{ left: 0, right: 0, height: 124, top: 29 }}>
                  <svg width="100%" height="124" viewBox="0 0 374 124" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d={totalInvoicesCard.linePath} stroke="#0085FF" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
                    {totalInvoicesCard.points.map((p, idx) => (
                      <circle key={idx} cx={p.x} cy={p.y} r={2.5} fill="#FFFFFF" stroke="#0085FF" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                    ))}
                  </svg>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col self-stretch flex-none w-full lg:flex-1 lg:basis-0 lg:w-auto" style={{ gap: 12, minWidth: 0 }}>
          <div
            className="box-border flex flex-col items-start self-stretch flex-shrink-0"
            style={{
              padding: 18,
              gap: 8,
              width: "100%",
              height: 150,
              background: "#FFFFFF",
              border: "1px solid #E0E3E9",
              boxShadow: "0px 38px 23px rgba(0, 0, 0, 0.01), 0px 17px 17px rgba(0, 0, 0, 0.02), 0px 4px 9px rgba(0, 0, 0, 0.02)",
              borderRadius: 12,
            }}
          >
            <div className="flex flex-row items-start self-stretch flex-shrink-0" style={{ gap: 16, width: "100%", height: 76 }}>
              <div className="flex flex-col items-start flex-1 min-w-0" style={{ gap: 8, height: 76 }}>
                {loading ? <Skeleton width={80} height={12} /> : (
                <span
                  className="self-stretch truncate text-[11px] sm:text-sm"
                  style={{ fontFamily: "Inter", fontWeight: 500, lineHeight: "120%", color: "#1F2937", opacity: 0.7 }}
                >
                  {selectedQuarter} Earnings
                </span>
                )}
                {loading ? <Skeleton width={130} height={24} /> : (
                <span
                  className="self-stretch truncate text-base sm:text-2xl"
                  style={{ fontFamily: "Inter", fontWeight: 600, lineHeight: "120%", color: "#1F2937" }}
                >
                  {Math.round(quarterlyEarnings.total).toLocaleString("en-IN")} INR
                </span>
                )}
                {loading ? <Skeleton width={110} height={12} /> : (
                <span
                  className="self-stretch truncate text-[10px] sm:text-xs"
                  style={{ fontFamily: "Inter", fontWeight: 500, lineHeight: "120%", color: "#6B7280" }}
                >
                  {quarterlyEarnings.pctChange >= 0 ? "+" : ""}{quarterlyEarnings.pctChange}% from last quarter
                </span>
                )}
              </div>

              <div className="flex-shrink-0 self-stretch" style={{ width: 1, background: "#1F2937", opacity: 0.1 }} />

              <div className="flex flex-col justify-center items-start flex-1" style={{ gap: 8, height: 68 }}>
                {loading ? (
                  <>
                    <Skeleton width="100%" height={30} shape="rect" className="rounded-md" />
                    <Skeleton width="100%" height={30} shape="rect" className="rounded-md" />
                  </>
                ) : (
                  [
                    { label: "Revenue", value: `₹${Math.round(quarterlyEarnings.revenue).toLocaleString("en-IN")}` },
                    { label: "Profit", value: `₹${Math.round(quarterlyEarnings.profit).toLocaleString("en-IN")}` },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="box-border flex flex-col items-start self-stretch flex-shrink-0 min-w-0 w-full sm:w-[178.5px]"
                      style={{ padding: 8, gap: 6, height: 30, background: "#F8FAFC", borderRadius: 6 }}
                    >
                      <div className="flex flex-row justify-between items-center self-stretch flex-shrink-0 min-w-0" style={{ gap: 8, height: 14 }}>
                        <span className="truncate text-[10px] sm:text-xs" style={{ fontFamily: "Inter", fontWeight: 400, lineHeight: "120%", color: "#6B7280" }}>
                          {item.label}
                        </span>
                        <span className="truncate text-[10px] sm:text-xs" style={{ fontFamily: "Inter", fontWeight: 500, lineHeight: "120%", color: "#1F2937" }}>
                          {item.value}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {loading ? (
              <Skeleton width="100%" height={30} shape="rect" className="rounded-md" />
            ) : (
              <div
                className="box-border flex flex-col items-start self-stretch flex-shrink-0 h-auto min-h-[30px] sm:h-[30px]"
                style={{
                  padding: 8, gap: 6, width: "100%", borderRadius: 6,
                  background: quarterlyEarnings.pctChange >= 0 ? "rgba(0, 133, 255, 0.1)" : "rgba(232, 34, 34, 0.1)",
                }}
              >
                <span className="text-[10px] sm:text-xs" style={{ fontFamily: "Inter", fontWeight: 500, lineHeight: "120%", color: quarterlyEarnings.pctChange >= 0 ? "#0085FF" : "#E82222" }}>
                  {quarterlyEarnings.pctChange >= 0 ? "Outperforming" : "Underperforming"} last quarter by {Math.abs(quarterlyEarnings.pctChange)}%
                </span>
              </div>
            )}
          </div>

          <div
            className="box-border flex flex-col justify-center items-center self-stretch flex-shrink-0"
            style={{
              padding: 18,
              gap: 8,
              width: "100%",
              height: 228,
              background: "#FFFFFF",
              border: "1px solid #E0E3E9",
              boxShadow: "0px 38px 23px rgba(0, 0, 0, 0.01), 0px 17px 17px rgba(0, 0, 0, 0.02), 0px 4px 9px rgba(0, 0, 0, 0.02)",
              borderRadius: 12,
            }}
          >
            <div className="flex flex-row justify-between items-center self-stretch flex-shrink-0" style={{ gap: 8, width: "100%", height: 28 }}>
              {loading ? <Skeleton width={140} height={14} /> : (
              <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
                Earnings Performance
              </span>
              )}

              {loading ? (
                <Skeleton width={64} height={28} shape="rect" style={{ borderRadius: 4 }} />
              ) : (
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setShowQuarterMenu((v) => !v)}
                  className="box-border flex flex-row justify-center items-center flex-shrink-0"
                  style={{ padding: "4px 6px 4px 12px", gap: 6, width: 64, height: 28, border: "1px solid rgba(31, 41, 55, 0.3)", borderRadius: 4, background: "#FFFFFF", cursor: "pointer" }}
                >
                  <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 16, lineHeight: "20px", color: "#1F2937" }}>
                    {selectedQuarter}
                  </span>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5.5 7.5L10 12L14.5 7.5" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {showQuarterMenu && (
                  <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setShowQuarterMenu(false)} />
                    <div
                      className="absolute right-0 top-full mt-1 z-[9999] bg-white border border-[#E5E5EC] rounded-lg shadow-[7px_24px_24px_-7px_rgba(0,0,0,0.25)] p-1 flex flex-col gap-0.5"
                      style={{ width: 64 }}
                    >
                      {["Q1", "Q2", "Q3", "Q4"].map((q) => (
                        <button
                          key={q}
                          onClick={() => {
                            setSelectedQuarter(q);
                            setShowQuarterMenu(false);
                          }}
                          className={`w-full text-left px-2 py-1.5 rounded-md text-sm font-medium ${q === selectedQuarter ? "bg-blue-50 text-blue-700" : "text-[#1F2937] hover:bg-gray-50"}`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              )}
            </div>

            <div className="flex flex-row items-start self-stretch flex-shrink-0" style={{ gap: 8, width: "100%", height: 134 }}>
              <div className="flex flex-col justify-center items-center self-stretch flex-shrink-0" style={{ gap: 8, width: 248, height: 134 }}>
                {loading ? <Skeleton width={70} height={14} /> : (
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
                  Revenue
                </span>
                )}
                {loading ? (
                  <Skeleton width="100%" height={60} shape="rect" style={{ borderRadius: 4 }} />
                ) : (
                <div className="self-stretch flex-shrink-0" style={{ width: `${Math.max(8, quarterlyEarnings.revenueScore * 10)}%`, height: 24, background: "#0085FF", borderRadius: 4 }} />
                )}
                {loading ? <Skeleton width={24} height={14} /> : (
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
                  {quarterlyEarnings.revenueScore}
                </span>
                )}
              </div>

              <div className="flex flex-col justify-center items-center self-stretch flex-shrink-0 flex-1" style={{ gap: 8, height: 134 }}>
                {loading ? <Skeleton width={50} height={14} /> : (
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
                  Profit
                </span>
                )}
                {loading ? (
                  <Skeleton width="100%" height={90} shape="rect" style={{ borderRadius: 4 }} />
                ) : (
                <div className="self-stretch flex-shrink-0" style={{ width: `${Math.max(8, quarterlyEarnings.profitScore * 10)}%`, height: 24, background: "#0AA43E", borderRadius: 4 }} />
                )}
                {loading ? <Skeleton width={24} height={14} /> : (
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
                  {quarterlyEarnings.profitScore}
                </span>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex flex-row justify-center items-center self-stretch flex-shrink-0" style={{ gap: 16, width: "100%", height: 14 }}>
                <Skeleton width={70} height={14} />
                <Skeleton width={52} height={14} />
              </div>
            ) : (
            <div className="flex flex-row justify-center items-center self-stretch flex-shrink-0" style={{ gap: 16, width: "100%", height: 14 }}>
              <div className="flex flex-row items-center flex-shrink-0" style={{ gap: 4, width: 70, height: 14 }}>
                <div className="flex-shrink-0" style={{ width: 16, height: 8, background: "#0085FF", borderRadius: 4 }} />
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#1F2937" }}>
                  Revenue
                </span>
              </div>

              <div className="flex flex-row items-center flex-shrink-0" style={{ gap: 4, width: 52, height: 14 }}>
                <div className="flex-shrink-0" style={{ width: 16, height: 8, background: "#0AA43E", borderRadius: 4 }} />
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#1F2937" }}>
                  Profit
                </span>
              </div>
            </div>
            )}
          </div>
        </div>

        <div
          className="box-border flex flex-col items-start flex-none w-full lg:flex-1 lg:basis-0 lg:w-auto"
          style={{
            padding: 18,
            gap: 16,
            minWidth: 0,
            height: 390,
            background: "#FFFFFF",
            border: "1px solid #E1E4EA",
            boxShadow: "0px 38px 23px rgba(0, 0, 0, 0.01), 0px 17px 17px rgba(0, 0, 0, 0.02), 0px 4px 9px rgba(0, 0, 0, 0.02)",
            borderRadius: 12,
          }}
        >
          <div className="flex flex-col items-start self-stretch flex-shrink-0 min-w-0" style={{ gap: 8, width: "100%", height: 81 }}>
            <div className="flex flex-row justify-between items-center self-stretch flex-shrink-0 min-w-0" style={{ gap: 8, height: 22 }}>
              <span
                className="truncate min-w-0 text-[11px] sm:text-sm"
                style={{ fontFamily: "Inter", fontWeight: 500, lineHeight: "120%", color: "#1F2937", opacity: 0.7 }}
              >
                Recent Deals
              </span>

              <div
                className="flex flex-row justify-center items-center flex-shrink-0"
                style={{ padding: "4px 6px", gap: 10, width: 63, height: 22, background: "rgba(0, 133, 255, 0.1)", borderRadius: 41, marginRight: 12 }}
              >
                <span className="text-[10px] sm:text-xs" style={{ fontFamily: "Inter", fontWeight: 500, lineHeight: "120%", color: "#0085FF" }}>
                  Top Deal
                </span>
              </div>
            </div>

            {loading ? <Skeleton width={150} height={24} /> : (
            <span
              className="self-stretch truncate text-base sm:text-2xl"
              style={{ fontFamily: "'Inter Tight', Inter, sans-serif", fontWeight: 600, lineHeight: "120%", color: "#000000" }}
            >
              {recentDealsWidget.topDeal
                ? (recentDealsWidget.topDeal.company?.name || recentDealsWidget.topDeal.title || "—")
                : "No deals yet"}
            </span>
            )}

            {loading ? <Skeleton width={130} height={12} /> : (
            <span
              className="self-stretch truncate text-[10px] sm:text-xs"
              style={{ fontFamily: "Inter", fontWeight: 500, lineHeight: "120%", color: "#6B7280" }}
            >
              {recentDealsWidget.topDeal
                ? `INR ${Math.round(recentDealsWidget.topDeal.amount || 0).toLocaleString("en-IN")} deal value`
                : "—"}
            </span>
            )}
          </div>

          <div className="self-stretch flex-shrink-0" style={{ width: "100%", height: 1, background: "#1F2937", opacity: 0.1 }} />

          <div
            className="box-border flex flex-col items-start self-stretch"
            style={{ padding: 8, gap: 6, width: "100%", flex: "1 1 auto", minHeight: 0, background: "#F8FAFC", borderRadius: 6 }}
          >
            <div
              className="flex flex-row items-start self-stretch flex-shrink-0"
              style={{ width: "100%", height: 22, background: "#FFFFFF", borderRadius: 6 }}
            >
              {["Client", "Deal", "Amount"].map((label, idx) => (
                <div
                  key={label}
                  className="flex flex-row items-center flex-1"
                  style={{ justifyContent: idx === 2 ? "flex-end" : "flex-start", padding: "4px 6px", gap: 10, height: 22 }}
                >
                  <span style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 12, lineHeight: "120%", color: "#1F2937", textAlign: idx === 2 ? "right" : "left" }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-start self-stretch justify-between" style={{ gap: 2, width: "100%", flex: "1 1 auto", minHeight: 0 }}>
              <div className="self-stretch flex-shrink-0" style={{ width: "100%", height: 1, background: "#1F2937", opacity: 0.1 }} />

              {loading
                ? Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="flex flex-col items-start self-stretch flex-shrink-0">
                    <div className="flex flex-row items-center self-stretch flex-shrink-0" style={{ width: "100%", height: 30, gap: 10 }}>
                      <div className="flex-1" style={{ padding: "0 6px" }}><Skeleton width="70%" height={11} /></div>
                      <div className="flex-1" style={{ padding: "0 6px" }}><Skeleton width="60%" height={11} /></div>
                      <div className="flex-1 flex justify-end" style={{ padding: "0 6px" }}><Skeleton width="50%" height={11} /></div>
                    </div>
                    <div className="self-stretch flex-shrink-0" style={{ width: "100%", height: 1, background: "#1F2937", opacity: 0.1 }} />
                  </div>
                ))
                : recentDealsWidget.recent.length === 0 ? (
                  <div className="flex items-center justify-center self-stretch" style={{ padding: "20px 0" }}>
                    <span style={{ fontFamily: "Inter", fontSize: 12, color: "#6B7280" }}>No deals yet</span>
                  </div>
                ) : recentDealsWidget.recent.map((row, idx) => (
                <div key={idx} className="flex flex-col items-start self-stretch flex-shrink-0">
                  <div className="flex flex-row items-center self-stretch flex-shrink-0" style={{ width: "100%", height: 30 }}>
                    <div className="flex flex-row justify-start items-center flex-1" style={{ padding: "8px 6px", gap: 10, height: 30, minWidth: 0 }}>
                      <span className="self-stretch truncate" style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#1F2937" }}>
                        {row.client}
                      </span>
                    </div>
                    <div className="flex flex-row justify-start items-center flex-1" style={{ padding: "8px 6px", gap: 10, height: 30, minWidth: 0 }}>
                      <span className="self-stretch truncate" style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#1F2937" }}>
                        {row.deal}
                      </span>
                    </div>
                    <div className="flex flex-row justify-end items-center flex-1" style={{ padding: "8px 6px", gap: 10, height: 30, minWidth: 0 }}>
                      <span className="truncate" style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 12, lineHeight: "120%", color: "#1F2937", textAlign: "right" }}>
                        {row.amount}
                      </span>
                    </div>
                  </div>
                  <div className="self-stretch flex-shrink-0" style={{ width: "100%", height: 1, background: "#1F2937", opacity: 0.1 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
