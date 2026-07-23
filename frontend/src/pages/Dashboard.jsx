import { useEffect, useState, useMemo, Fragment } from "react";
import { TrendingUp, TrendingDown, Search, SlidersHorizontal, MoreVertical, ChevronUp, ChevronDown, Eye, Edit2, Trash2 } from "lucide-react";

const yAxisLabels = ["₹180k", "₹160k", "₹140k", "₹120k", "₹100k", "₹80k", "₹60k", "₹40k", "₹20k", "0"];

const InvoicesIcon = ({ size = 20, style }) => (
  <svg width={size} height={size} viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
    <path d="M0 15.6408V0L1.15396 1.02562L2.33979 0L3.52563 1.02562L4.71146 0L5.8975 1.02562L7.08333 0L8.26917 1.02562L9.45521 0L10.641 1.02562L11.8269 0L13.0127 1.02562L14.1667 0V15.6408L13.0127 14.6152L11.8269 15.6408L10.641 14.6152L9.45521 15.6408L8.26917 14.6152L7.08333 15.6408L5.8975 14.6152L4.71146 15.6408L3.52563 14.6152L2.33979 15.6408L1.15396 14.6152L0 15.6408ZM2.29167 11.5223H11.875V10.2723H2.29167V11.5223ZM2.29167 8.44542H11.875V7.19542H2.29167V8.44542ZM2.29167 5.36854H11.875V4.11854H2.29167V5.36854ZM1.25 13.7371H12.9167V1.90375H1.25V13.7371Z" fill={style?.color || "#1C1B1F"} />
  </svg>
);
import API from "../services/api";
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

  const [user, setUser] = useState({});
  const [tasks, setTasks] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [allMeetings, setAllMeetings] = useState([]);

  const [deals, setDeals] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [invoiceSortConfig, setInvoiceSortConfig] = useState({ key: null, direction: "asc" });
  const [invoiceColWidths, setInvoiceColWidths] = useState({
    invoiceId: 160,
    client: 150,
    contact: 150,
    deal: 160,
    invoiceDate: 130,
    amount: 130,
    dueDate: 130,
    status: 120,
    actions: 120,
  });

  const handleInvoiceSort = (key) => {
    setInvoiceSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleInvoiceColResizeStart = (key) => (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = invoiceColWidths[key];
    const onMouseMove = (moveEvent) => {
      const newWidth = Math.max(80, startWidth + (moveEvent.clientX - startX));
      setInvoiceColWidths((prev) => ({ ...prev, [key]: newWidth }));
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const handleSelectAllInvoices = () => {
    setSelectedInvoices((prev) => (prev.length === invoices.length ? [] : invoices.map((inv) => inv._id)));
  };

  const handleSelectInvoice = (id) => {
    setSelectedInvoices((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const sortedInvoices = useMemo(() => {
    if (!invoiceSortConfig.key) return invoices;
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
    return [...invoices].sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (va < vb) return invoiceSortConfig.direction === "asc" ? -1 : 1;
      if (va > vb) return invoiceSortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [invoices, invoiceSortConfig]);

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
          className="box-border flex flex-row justify-between items-center flex-shrink-0 self-stretch -mx-4 sm:-mx-6 lg:-mx-8"
          style={{
            padding: "0px 24px",
            gap: 16,
            height: 56,
            background: "#FFFFFF",
            borderBottom: "1px solid #E1E4EA",
            borderRadius: 0,
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
                  <span className="whitespace-nowrap" style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 18, lineHeight: "120%", color: "#0E121B" }}>
                    {value}
                  </span>
                </div>
              </div>
              <div className="flex flex-row items-center flex-shrink-0 absolute" style={{ gap: 4, right: 16, bottom: 16 }}>
                {trendUp ? (
                  <TrendingUp size={14} style={{ color: "#00C950" }} />
                ) : (
                  <TrendingDown size={14} style={{ color: "#E82222" }} />
                )}
                <span className="whitespace-nowrap" style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 12, lineHeight: "120%", color: trendUp ? "#00C950" : "#E82222" }}>
                  {trend}
                </span>
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
                className="box-border flex flex-row justify-center items-center flex-shrink-0"
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

              <div className="flex flex-col items-start self-stretch min-h-0 overflow-y-auto" style={{ gap: 2, width: "100%", flex: 1 }}>
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
              <Search size={20} style={{ opacity: 0.5, color: "#1F2937" }} />
              <span
                className="whitespace-nowrap"
                style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 14, lineHeight: "20px", color: "#1F2937", opacity: 0.5 }}
              >
                Search invoice by number, client, or deal...
              </span>
            </div>

            <button
              className="box-border flex flex-row justify-center items-center flex-shrink-0"
              style={{ padding: 12, gap: 8, width: 44, height: 44, background: "#FFFFFF", border: "1px solid #E1E4EA", borderRadius: 95 }}
            >
              <SlidersHorizontal size={20} style={{ color: "#1F2937" }} />
            </button>

            <button
              className="box-border flex flex-row justify-center items-center flex-shrink-0"
              style={{ padding: 12, gap: 8, width: 44, height: 44, background: "#FFFFFF", border: "1px solid #E1E4EA", borderRadius: 96 }}
            >
              <MoreVertical size={20} style={{ color: "#1F2937" }} />
            </button>
          </div>
        </div>

        <div
          className="box-border flex flex-col items-start self-stretch overflow-hidden"
          style={{
            padding: 0,
            width: "100%",
            height: 488,
            background: "#FFFFFF",
            border: "1px solid #E1E4EA",
            borderRadius: 8,
            marginTop: 16,
          }}
        >
          <div className="w-full overflow-x-auto overflow-y-auto" style={{ height: "100%" }}>
            <div className="flex" style={{ height: "44px", minWidth: "fit-content" }}>
              <div className="flex items-center px-3 border-b border-[#E1E4EA] flex-shrink-0" style={{ width: "50px", background: "#F5F7FA" }}>
                <input
                  type="checkbox"
                  checked={invoices.length > 0 && selectedInvoices.length === invoices.length}
                  onChange={handleSelectAllInvoices}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                />
              </div>

              {[
                { key: "invoiceId", label: "Invoice Id" },
                { key: "client", label: "Client" },
                { key: "contact", label: "Contact" },
                { key: "deal", label: "Deal" },
                { key: "invoiceDate", label: "Invoice Date" },
                { key: "amount", label: "Amount" },
                { key: "dueDate", label: "Due Date" },
                { key: "status", label: "Status" },
              ].map((col) => (
                <div
                  key={col.key}
                  className="relative flex items-center gap-2 px-3 border-b border-[#E1E4EA] cursor-pointer select-none hover:bg-gray-100 transition-colors flex-shrink-0"
                  style={{ width: invoiceColWidths[col.key], background: "#F5F7FA" }}
                  onClick={() => handleInvoiceSort(col.key)}
                >
                  <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: "12px", lineHeight: "120%", color: "#525866" }}>
                    {col.label}
                  </span>
                  <div className="flex flex-col">
                    <ChevronUp className={`w-3 h-3 -mb-1 ${invoiceSortConfig.key === col.key && invoiceSortConfig.direction === "asc" ? "text-blue-600" : "text-gray-300"}`} />
                    <ChevronDown className={`w-3 h-3 ${invoiceSortConfig.key === col.key && invoiceSortConfig.direction === "desc" ? "text-blue-600" : "text-gray-300"}`} />
                  </div>
                  <div
                    onMouseDown={handleInvoiceColResizeStart(col.key)}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-blue-400 z-50 bg-transparent"
                  />
                </div>
              ))}

              <div className="flex items-center px-3 border-b border-[#E1E4EA] flex-shrink-0" style={{ width: invoiceColWidths.actions, background: "#F5F7FA" }}>
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: "12px", lineHeight: "120%", color: "#525866" }}>
                  Actions
                </span>
              </div>
            </div>

            {sortedInvoices.map((inv) => {
              const isPaid = inv.status?.toLowerCase() === "paid" || inv.status?.toLowerCase() === "accepted";
              return (
                <div key={inv._id} className="flex hover:bg-gray-50 transition-colors" style={{ height: "52px", minWidth: "fit-content" }}>
                  <div className="flex items-center px-3 border-b border-gray-100 flex-shrink-0" style={{ width: "50px" }}>
                    <input
                      type="checkbox"
                      checked={selectedInvoices.includes(inv._id)}
                      onChange={() => handleSelectInvoice(inv._id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center px-3 border-b border-gray-100 flex-shrink-0" style={{ width: invoiceColWidths.invoiceId }}>
                    <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: "12px", color: "#1F2937" }}>
                      {inv.invoiceNumber || "—"}
                    </span>
                  </div>
                  <div className="flex items-center px-3 border-b border-gray-100 flex-shrink-0" style={{ width: invoiceColWidths.client }}>
                    <span style={{ fontFamily: "Inter", fontWeight: 400, fontSize: "12px", color: "#1F2937" }}>
                      {inv.deal?.company?.name || "—"}
                    </span>
                  </div>
                  <div className="flex items-center px-3 border-b border-gray-100 flex-shrink-0" style={{ width: invoiceColWidths.contact }}>
                    <span style={{ fontFamily: "Inter", fontWeight: 400, fontSize: "12px", color: "#1F2937" }}>
                      {inv.deal?.contact?.name || "—"}
                    </span>
                  </div>
                  <div className="flex items-center px-3 border-b border-gray-100 flex-shrink-0" style={{ width: invoiceColWidths.deal }}>
                    <span style={{ fontFamily: "Inter", fontWeight: 400, fontSize: "12px", color: "#1F2937" }}>
                      {inv.deal?.title || "—"}
                    </span>
                  </div>
                  <div className="flex items-center px-3 border-b border-gray-100 flex-shrink-0" style={{ width: invoiceColWidths.invoiceDate }}>
                    <span style={{ fontFamily: "Inter", fontWeight: 400, fontSize: "12px", color: "#1F2937" }}>
                      {inv.date ? new Date(inv.date).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center px-3 border-b border-gray-100 flex-shrink-0" style={{ width: invoiceColWidths.amount }}>
                    <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: "12px", color: "#1F2937" }}>
                      {`₹${Math.round(inv.amount || 0).toLocaleString("en-IN")}`}
                    </span>
                  </div>
                  <div className="flex items-center px-3 border-b border-gray-100 flex-shrink-0" style={{ width: invoiceColWidths.dueDate }}>
                    <span style={{ fontFamily: "Inter", fontWeight: 400, fontSize: "12px", color: "#1F2937" }}>
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center px-3 border-b border-gray-100 flex-shrink-0" style={{ width: invoiceColWidths.status }}>
                    <span
                      className="inline-flex items-center justify-center px-3 py-[5px] rounded-full"
                      style={{
                        fontFamily: "Inter",
                        fontWeight: 500,
                        fontSize: "12px",
                        lineHeight: "120%",
                        background: isPaid ? "rgba(0, 201, 80, 0.1)" : "rgba(254, 89, 25, 0.1)",
                        color: isPaid ? "#00C950" : "#FE5919",
                      }}
                    >
                      {inv.status || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 border-b border-gray-100 flex-shrink-0" style={{ width: invoiceColWidths.actions }}>
                    <button className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors" title="View Invoice">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors" title="Edit Invoice">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 text-red-500 hover:text-red-700 rounded-md hover:bg-red-50 transition-colors" title="Delete Invoice">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ------------------- Dashboard UI -------------------
  return (
    <div style={{ marginTop: -16 }}>
      <div
        className="box-border flex flex-row justify-between items-center flex-shrink-0 self-stretch -mx-4 sm:-mx-6 lg:-mx-8"
        style={{
          padding: "0px 24px",
          gap: 16,
          height: 56,
          background: "#FFFFFF",
          borderBottom: "1px solid #E1E4EA",
          borderRadius: 0,
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

      {/* KPI Cards */}
      <div
        className="flex flex-row items-stretch -mx-4 sm:-mx-6 lg:-mx-8 px-6"
        style={{ gap: 16, marginTop: 24 }}
      >
        {[
          { icon: TotalIncomeIcon, label: "Total Income", value: `₹${Math.round(overviewKpis.totalIncome).toLocaleString("en-IN")}`, trend: `${overviewKpis.totalIncomeTrend.pct}% this month`, trendUp: overviewKpis.totalIncomeTrend.up },
          { icon: RevenueGeneratedIcon, label: "Revenue Generated", value: `₹${Math.round(overviewKpis.revenueGenerated).toLocaleString("en-IN")}`, trend: `${overviewKpis.revenueGeneratedTrend.pct}% this month`, trendUp: overviewKpis.revenueGeneratedTrend.up },
          { icon: TotalDealsClosedIcon, label: "Total Deals Closed", value: `${overviewKpis.dealsClosedCount}`, trend: `${overviewKpis.dealsClosedTrend.pct}% this month`, trendUp: overviewKpis.dealsClosedTrend.up },
          { icon: DealValueOvertimeIcon, label: "Deal Value Overtime", value: `₹${Math.round(overviewKpis.dealValue).toLocaleString("en-IN")}`, trend: `${overviewKpis.dealValueTrend.pct}% this month`, trendUp: overviewKpis.dealValueTrend.up },
        ].map(({ icon: Icon, label, value, trend, trendUp }, i) => (
          <div
            key={i}
            className="box-border flex flex-row justify-between items-start relative"
            style={{
              padding: 16,
              width: 313.5,
              height: 72,
              background: "#FFFFFF",
              border: "1px solid #E1E4EA",
              borderRadius: 12,
              flexGrow: 1,
            }}
          >
            <div className="flex flex-row items-center" style={{ gap: 14 }}>
              <div
                className="box-border flex items-center justify-center flex-shrink-0"
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
              <div className="flex flex-col items-start" style={{ gap: 4 }}>
                <span
                  className="whitespace-nowrap"
                  style={{ fontFamily: "'Inter Tight', Inter, sans-serif", fontWeight: 400, fontSize: 12, lineHeight: "120%", color: "#525866" }}
                >
                  {label}
                </span>
                <span
                  className="whitespace-nowrap"
                  style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 18, lineHeight: "120%", color: "#0E121B" }}
                >
                  {value}
                </span>
              </div>
            </div>
            <div
              className="flex flex-row items-center flex-shrink-0 absolute"
              style={{ gap: 4, right: 16, bottom: 16 }}
            >
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
        className="box-border flex flex-row items-end self-stretch"
        style={{ padding: 12, gap: 16, height: 505, border: "1px solid #E1E4EA", borderRadius: 12, marginTop: 16, flexGrow: 1 }}
      >
        <div
          className="flex flex-col justify-between items-start self-stretch flex-shrink-0"
          style={{ padding: "0px 0px 22px", gap: 16, width: 34, height: 481 }}
        >
          {yAxisLabels.map((label) => (
            <span
              key={label}
              className="mx-auto whitespace-nowrap"
              style={{
                fontFamily: "Inter",
                fontWeight: 400,
                fontSize: 12,
                lineHeight: "140%",
                textAlign: "center",
                color: "rgba(33, 32, 31, 0.56)",
              }}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="flex flex-col flex-1 self-stretch" style={{ gap: 0 }}>
          <svg
            className="flex-1 self-stretch"
            width="100%"
            height="481"
            viewBox="0 0 1253 445"
            fill="none"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g opacity="0.8">
              <path fillRule="evenodd" clipRule="evenodd" d="M1.00009 0V1L1245.11 1V0L1.00009 0Z" fill="#E7E4E3" />
              <path fillRule="evenodd" clipRule="evenodd" d="M1.00009 111V112L1245.11 112V111L1.00009 111Z" fill="#E7E4E3" />
              <path fillRule="evenodd" clipRule="evenodd" d="M1.00009 222V223L1245.11 223V222L1.00009 222Z" fill="#E7E4E3" />
              <path fillRule="evenodd" clipRule="evenodd" d="M1.00009 333V334L1245.11 334V333L1.00009 333Z" fill="#E7E4E3" />
              <path fillRule="evenodd" clipRule="evenodd" d="M1.00009 444V445L1245.11 445V444L1.00009 444Z" fill="#E7E4E3" />
            </g>
            <path
              d="M8.45635 176.31L1.00009 165.505V380.974H1245.11V172.302C1245.11 168.064 1239.39 166.736 1237.52 170.541L1234.52 176.668L1225.36 161.32L1217.08 191.883L1205.32 176.668L1199.12 169.901L1194.63 155.053L1185.69 124.018L1168.56 155.053V191.883L1158.32 176.668L1133.83 165.992L1114.5 25.7274L1102.34 124.018L1097.43 90.7794L1085.32 52.2827L1076.51 90.7794V120.995L1068.43 169.859L1060.42 154.867L1046.1 146.567L1039.81 111.58L1028.8 150.665L1024.44 127.666L1013.98 55.9615L1012.48 52.2826L998.764 172.173L989.252 52.2826L977.838 21.3453L966.798 130.607L955.537 114.957L949.085 175.18L941.699 150.665L928.382 169.859L922.372 183.273L911.602 200.95L899.004 189.811L885.945 194.604L881.457 169.859L865.935 179.288L860.118 175.18L855.629 214.198L849.479 189.811L838.056 198.164L831.262 228.465L819.326 205.888L804.65 210.205V189.811L789.873 150.665L782.022 198.164L771.292 169.859V146.567H754.884V130.607L744.855 150.665L734.361 159.206V146.567V111.58L726.506 124.018L718.642 130.607L711.247 161.905L704.422 217.26L694.173 205.888V198.164L686.016 189.811L677.81 200.95L670.2 228.465L664.09 179.288V161.905L657.098 150.665L647.705 159.206V175.18L638.727 189.811L624.656 198.164V150.665L615.083 159.206L603.861 214.198L599.373 159.206L593.218 124.018L585.696 111.58L577.201 137.176L567.619 161.905V198.164L556.336 214.198L547.341 198.164L505.374 221.609L496.116 208.45L487.257 221.609V236.004L480.261 247.321V259.368L467.702 270.77V286.671L451.51 295.277L434.169 310.868L419.826 305.022L412.177 316.784L403.2 340.309L387.481 327.97L377.237 322.46L365.975 335.879L358.462 322.46L346.956 316.784V298.686L330.868 310.868L319.248 322.46L310.27 310.868L301.749 301.499L295.012 286.671L285.78 295.277L275.777 310.868L262.973 301.499V286.671L253.737 264.343L245.373 273.605L236.484 286.671L227.252 276.743L218.919 270.77V236.004L212.975 244.081L203.998 267.486V286.671L190.747 279.511V247.321L184.952 238.962L177.088 250.943L171.004 267.486L163.162 259.368L156.012 247.321V236.004L146.049 250.943L129.229 264.343V289.625L115.939 310.868V289.625L108.193 282.486V273.605L101.789 259.368L92.908 273.92L86.7799 264.343V250.943L79.2053 238.962L72.0691 221.609L64.2139 230.974L51.1293 247.321L43.2697 238.962L35.0858 250.943L29.2865 208.45L21.107 198.164V180.035L8.45635 176.31Z"
              fill="url(#paint0_linear_2_753)"
              fillOpacity="0.6"
            />
            <path
              d="M1.00009 165.556L8.45635 176.365L21.107 180.092V198.226L29.2865 208.516L35.0858 251.024L43.2697 239.039L51.1293 247.401L64.2139 231.048L72.0691 221.68L79.2053 239.039L86.7799 251.024V264.429L92.908 274.009L101.789 259.453L108.193 273.694V282.578L115.939 289.72V310.971L129.229 289.72V264.429L146.049 251.024L156.012 236.08V247.401L163.162 259.453L171.004 267.573L177.088 251.024L184.952 239.039L190.747 247.401V279.603L203.998 286.765V267.573L212.975 244.16L218.919 236.08V270.859L227.252 276.834L236.484 286.765L245.373 273.694L253.737 264.429L262.973 286.765V301.598L275.777 310.971L285.78 295.374L295.012 286.765L301.749 301.598L310.27 310.971L319.248 322.567L330.868 310.971L346.956 298.785V316.889L358.462 322.567L365.975 335.99L377.237 322.567L387.481 328.078L403.2 340.422L412.177 316.889L419.826 305.123L434.169 310.971L451.51 295.374L467.702 286.765V270.859L480.261 259.453V247.401L487.257 236.08V221.68L496.116 208.516L505.374 221.68L547.341 198.226L556.336 214.267L567.619 198.226V161.955L577.201 137.217L585.696 111.612L593.218 124.055L599.373 159.255L603.861 214.267L615.083 159.255L624.656 150.711V198.226L638.727 189.871L647.705 175.234V159.255L657.098 150.711L664.09 161.955V179.344L670.2 228.539L677.81 201.014L686.016 189.871L694.174 198.226V205.954L704.422 217.329L711.247 161.955L718.642 130.646L726.506 124.055L734.361 111.612V146.611V159.255L744.855 150.711L754.884 130.646V146.611H771.292V169.911L782.022 198.226L789.873 150.711L804.65 189.871V210.272L819.326 205.954L831.262 228.539L838.056 198.226L849.479 189.871L855.629 214.267L860.118 175.234L865.935 179.344L881.457 169.911L885.945 194.665L899.004 189.871L911.602 201.014L922.372 183.33L928.382 169.911L941.699 150.711L949.085 175.234L955.537 114.99L966.798 130.646L977.838 21.3453L989.252 52.2936L998.764 172.227L1012.48 52.2936L1013.98 55.9738L1024.44 127.704L1028.8 150.711L1039.81 111.612L1046.1 146.611L1060.42 154.914L1068.43 169.911L1076.51 121.031V90.804L1085.32 52.2937L1097.43 90.804L1102.34 124.055L1114.5 25.7289L1133.83 166.043L1158.32 176.723L1168.56 191.943V155.1L1185.69 124.055L1194.63 155.1L1199.12 169.954L1205.32 176.723L1217.08 191.943L1225.36 161.369L1234.52 176.723L1245.11 155.1"
              stroke="#0C4FCD"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M1245.11 182.625C1197.55 188.794 1121.09 201.389 1051.62 235.617C996.035 263.006 947.623 273.469 913.762 273.469C879.901 273.469 831.529 275.151 727.528 225.524C623.528 175.896 534.039 91.7819 427.619 91.7819C321.2 91.7819 290.055 135.16 265.572 154.026C244.517 170.252 175.141 312.808 1.00009 312.808"
              stroke="#34C759"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="5 5"
            />
            <path
              d="M1247.02 150.953C1250.02 150.953 1252.5 153.547 1252.5 156.811C1252.5 160.074 1250.02 162.667 1247.02 162.667C1244.02 162.667 1241.54 160.074 1241.54 156.811C1241.54 153.547 1244.02 150.953 1247.02 150.953Z"
              fill="white"
              stroke="#0C4FCD"
            />
            <defs>
              <linearGradient id="paint0_linear_2_753" x1="1034.65" y1="-514.839" x2="1072.23" y2="356.032" gradientUnits="userSpaceOnUse">
                <stop offset="0.392082" stopColor="#0C4FCD" />
                <stop offset="1" stopColor="white" />
              </linearGradient>
            </defs>
          </svg>

          <div
            className="flex flex-row justify-center items-center self-stretch flex-shrink-0"
            style={{ padding: 0, gap: 8, height: 24 }}
          >
            {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((month) => (
              <span
                key={month}
                className="flex items-center justify-center flex-1"
                style={{
                  height: 24,
                  fontFamily: "Inter",
                  fontWeight: 400,
                  fontSize: 12,
                  lineHeight: "20px",
                  textAlign: "center",
                  letterSpacing: "-0.02em",
                  color: "rgba(33, 32, 31, 0.56)",
                }}
              >
                {month}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-row" style={{ gap: 16, marginTop: 16 }}>
        <div
          className="box-border flex flex-col items-start"
          style={{
            padding: 18,
            gap: 16,
            width: 426,
            height: 390,
            background: "#FFFFFF",
            border: "1px solid #E1E4EA",
            boxShadow: "0px 38px 23px rgba(0, 0, 0, 0.01), 0px 17px 17px rgba(0, 0, 0, 0.02), 0px 4px 9px rgba(0, 0, 0, 0.02)",
            borderRadius: 12,
          }}
        >
          <div className="flex flex-row items-start self-stretch flex-shrink-0" style={{ gap: 16, width: 390, height: 88 }}>
            <div className="flex flex-col items-start flex-1" style={{ gap: 8, height: 76 }}>
              <span
                className="self-stretch"
                style={{ fontFamily: "'Inter Tight', Inter, sans-serif", fontWeight: 500, fontSize: 14, lineHeight: "120%", color: "#1F2937", opacity: 0.7 }}
              >
                Total Invoices Issued
              </span>
              <span
                className="self-stretch"
                style={{ fontFamily: "'Inter Tight', Inter, sans-serif", fontWeight: 600, fontSize: 24, lineHeight: "120%", color: "#000000" }}
              >
                19,38,493 INR
              </span>
              <span
                className="self-stretch"
                style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#6B7280" }}
              >
                20% Cleared
              </span>
            </div>

            <div className="flex-shrink-0 self-stretch" style={{ width: 1, background: "#1F2937", opacity: 0.1 }} />

            <div className="flex flex-col items-start flex-1" style={{ gap: 8, height: 88 }}>
              <span
                className="self-stretch"
                style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#1F2937", opacity: 0.7 }}
              >
                DataCircles
              </span>

              <div
                className="box-border flex flex-col items-start self-stretch flex-shrink-0"
                style={{ padding: 6, gap: 6, height: 66, background: "#F8FAFC", borderRadius: 6 }}
              >
                <div className="flex flex-row justify-between items-center self-stretch flex-shrink-0" style={{ gap: 8, height: 12 }}>
                  <span style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 10, lineHeight: "120%", color: "#6B7280" }}>
                    Website Project
                  </span>
                  <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 10, lineHeight: "120%", color: "#1F2937" }}>
                    60%
                  </span>
                </div>

                <div className="flex flex-row items-start self-stretch flex-shrink-0" style={{ gap: 2, height: 18 }}>
                  {[
                    ...Array(27).fill("#0085FF"),
                    ...Array(5).fill("#E2E5E8"),
                    ...Array(7).fill("rgba(31, 41, 55, 0.1)"),
                  ].map((color, idx) => (
                    <div key={idx} className="flex-1" style={{ width: 2.32, height: 18, background: color }} />
                  ))}
                </div>

                <div className="flex flex-row justify-between items-center self-stretch flex-shrink-0" style={{ gap: 8, height: 12 }}>
                  <span style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 10, lineHeight: "120%", color: "#6B7280" }}>
                    Invoices Paid
                  </span>
                  <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 10, lineHeight: "120%", color: "#1F2937" }}>
                    1 of 3
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="self-stretch flex-shrink-0" style={{ width: 390, height: 1, background: "#1F2937", opacity: 0.1 }} />

          <div
            className="box-border flex flex-col items-start self-stretch flex-shrink-0"
            style={{ padding: 8, gap: 6, isolation: "isolate", width: 390, height: 233, background: "#F8FAFC", borderRadius: 6 }}
          >
            <span
              className="self-stretch"
              style={{ fontFamily: "'Inter Tight', Inter, sans-serif", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#1F2937" }}
            >
              Payment Progress
            </span>

            <div className="relative flex flex-row items-center self-stretch flex-shrink-0" style={{ height: 197 }}>
              {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"].map((month) => (
                <div
                  key={month}
                  className="flex flex-col justify-center items-center self-stretch flex-1"
                  style={{ gap: 6 }}
                >
                  <div className="flex-1" style={{ width: 1, background: "rgba(31, 41, 55, 0.1)" }} />
                  <span style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 12, lineHeight: "120%", color: "#6B7280" }}>
                    {month}
                  </span>
                </div>
              ))}

              <div className="absolute" style={{ width: 374, height: 124, right: 8, top: 29 }}>
                <svg width="374" height="124" viewBox="0 0 374 124" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 119 L58.55 105.6 L119.75 87.35 L180.5 66.35 L241.5 45.35 L302.5 22.35 L363 2" stroke="#0085FF" strokeWidth="2" fill="none" />
                  {[
                    [1.5, 121.5],
                    [60.5, 107],
                    [122, 88],
                    [182.5, 67],
                    [243.5, 46],
                    [304.5, 23],
                    [365, 3.5],
                  ].map(([cx, cy], idx) => (
                    <circle key={idx} cx={cx} cy={cy} r={2.5} fill="#FFFFFF" stroke="#0085FF" strokeWidth="1" />
                  ))}
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col self-stretch" style={{ gap: 12, width: 426 }}>
          <div
            className="box-border flex flex-col items-start self-stretch flex-shrink-0"
            style={{
              padding: 18,
              gap: 8,
              width: 426,
              height: 150,
              background: "#FFFFFF",
              border: "1px solid #E0E3E9",
              boxShadow: "0px 38px 23px rgba(0, 0, 0, 0.01), 0px 17px 17px rgba(0, 0, 0, 0.02), 0px 4px 9px rgba(0, 0, 0, 0.02)",
              borderRadius: 12,
            }}
          >
            <div className="flex flex-row items-start self-stretch flex-shrink-0" style={{ gap: 16, width: 390, height: 76 }}>
              <div className="flex flex-col items-start flex-1" style={{ gap: 8, height: 76 }}>
                <span
                  className="self-stretch"
                  style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "120%", color: "#1F2937", opacity: 0.7 }}
                >
                  Q1 Earnings
                </span>
                <span
                  className="self-stretch"
                  style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 24, lineHeight: "120%", color: "#1F2937" }}
                >
                  5,39,200 INR
                </span>
                <span
                  className="self-stretch"
                  style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#6B7280" }}
                >
                  6.4% from last quarter
                </span>
              </div>

              <div className="flex-shrink-0 self-stretch" style={{ width: 1, background: "#1F2937", opacity: 0.1 }} />

              <div className="flex flex-col justify-center items-start flex-1" style={{ gap: 8, height: 68 }}>
                {[
                  { label: "Revenue", value: "₹3,49,000" },
                  { label: "Profit", value: "₹1,23,000" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="box-border flex flex-col items-start self-stretch flex-shrink-0"
                    style={{ padding: 8, gap: 6, width: 178.5, height: 30, background: "#F8FAFC", borderRadius: 6 }}
                  >
                    <div className="flex flex-row justify-between items-center self-stretch flex-shrink-0" style={{ gap: 8, height: 14 }}>
                      <span style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 12, lineHeight: "120%", color: "#6B7280" }}>
                        {item.label}
                      </span>
                      <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#1F2937" }}>
                        {item.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="box-border flex flex-col items-start self-stretch flex-shrink-0"
              style={{ padding: 8, gap: 6, width: 390, height: 30, background: "rgba(0, 133, 255, 0.1)", borderRadius: 6 }}
            >
              <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#0085FF" }}>
                Outperforming benchmark by 2.5%
              </span>
            </div>
          </div>

          <div
            className="box-border flex flex-col justify-center items-center self-stretch flex-shrink-0"
            style={{
              padding: 18,
              gap: 8,
              width: 426,
              height: 228,
              background: "#FFFFFF",
              border: "1px solid #E0E3E9",
              boxShadow: "0px 38px 23px rgba(0, 0, 0, 0.01), 0px 17px 17px rgba(0, 0, 0, 0.02), 0px 4px 9px rgba(0, 0, 0, 0.02)",
              borderRadius: 12,
            }}
          >
            <div className="flex flex-row justify-between items-center self-stretch flex-shrink-0" style={{ gap: 8, width: 390, height: 28 }}>
              <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
                Earnings Performance
              </span>

              <div
                className="box-border flex flex-row justify-center items-center flex-shrink-0"
                style={{ padding: "4px 6px 4px 12px", gap: 6, width: 64, height: 28, border: "1px solid rgba(31, 41, 55, 0.3)", borderRadius: 4 }}
              >
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 16, lineHeight: "20px", color: "#1F2937" }}>
                  Q1
                </span>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5.5 7.5L10 12L14.5 7.5" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            <div className="flex flex-row items-start self-stretch flex-shrink-0" style={{ gap: 8, width: 390, height: 134 }}>
              <div className="flex flex-col justify-center items-center self-stretch flex-shrink-0" style={{ gap: 8, width: 248, height: 134 }}>
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
                  Revenue
                </span>
                <div className="self-stretch flex-shrink-0" style={{ width: 248, height: 24, background: "#0085FF", borderRadius: 4 }} />
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
                  8.1
                </span>
              </div>

              <div className="flex flex-col justify-center items-center self-stretch flex-shrink-0 flex-1" style={{ gap: 8, height: 134 }}>
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
                  Profit
                </span>
                <div className="self-stretch flex-shrink-0" style={{ width: 134, height: 24, background: "#0AA43E", borderRadius: 4 }} />
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
                  6.2
                </span>
              </div>
            </div>

            <div className="flex flex-row justify-center items-center self-stretch flex-shrink-0" style={{ gap: 16, width: 390, height: 14 }}>
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
          </div>
        </div>

        <div
          className="box-border flex flex-col items-start"
          style={{
            padding: 18,
            gap: 16,
            width: 426,
            height: 390,
            background: "#FFFFFF",
            border: "1px solid #E1E4EA",
            boxShadow: "0px 38px 23px rgba(0, 0, 0, 0.01), 0px 17px 17px rgba(0, 0, 0, 0.02), 0px 4px 9px rgba(0, 0, 0, 0.02)",
            borderRadius: 12,
          }}
        >
          <div className="flex flex-col items-start self-stretch flex-shrink-0" style={{ gap: 8, width: 402, height: 81 }}>
            <div className="flex flex-row justify-between items-center self-stretch flex-shrink-0" style={{ gap: 8, height: 22 }}>
              <span
                style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "120%", color: "#1F2937", opacity: 0.7 }}
              >
                Recent Deals
              </span>

              <div
                className="flex flex-row justify-center items-center flex-shrink-0"
                style={{ padding: "4px 6px", gap: 10, width: 63, height: 22, background: "rgba(0, 133, 255, 0.1)", borderRadius: 41, marginRight: 12 }}
              >
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#0085FF" }}>
                  Top Deal
                </span>
              </div>
            </div>

            <span
              className="self-stretch"
              style={{ fontFamily: "'Inter Tight', Inter, sans-serif", fontWeight: 600, fontSize: 24, lineHeight: "120%", color: "#000000" }}
            >
              Cottson Clothing
            </span>

            <span
              className="self-stretch"
              style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#6B7280" }}
            >
              INR 1,39,200 deal value
            </span>
          </div>

          <div className="self-stretch flex-shrink-0" style={{ width: 402, height: 1, background: "#1F2937", opacity: 0.1 }} />

          <div
            className="box-border flex flex-col items-start self-stretch flex-shrink-0"
            style={{ padding: 8, gap: 6, width: 402, height: 240, background: "#F8FAFC", borderRadius: 6 }}
          >
            <div
              className="flex flex-row items-start self-stretch flex-shrink-0"
              style={{ width: 386, height: 22, background: "#FFFFFF", borderRadius: 6 }}
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

            <div className="flex flex-col items-start self-stretch flex-shrink-0" style={{ gap: 2, width: 386, height: 208 }}>
              <div className="self-stretch flex-shrink-0" style={{ width: 386, height: 1, background: "#1F2937", opacity: 0.1 }} />

              {[
                { client: "Cottson Clothing", deal: "Website Project", amount: "1,39,200 INR" },
                { client: "Asterisks.Inc", deal: "Digital Product", amount: "40,100 INR" },
                { client: "DataCircles", deal: "Branding", amount: "41,000 INR" },
                { client: "DataCircles", deal: "Branding", amount: "41,000 INR" },
                { client: "DataCircles", deal: "Branding", amount: "41,000 INR" },
                { client: "Cottson Clothing", deal: "Clothing", amount: "41,500 INR" },
              ].map((row, idx) => (
                <div key={idx} className="flex flex-col items-start self-stretch flex-shrink-0">
                  <div className="flex flex-row items-start self-stretch flex-shrink-0" style={{ width: 386, height: 30 }}>
                    <div className="flex flex-row justify-start items-center flex-1" style={{ padding: "8px 6px", gap: 10, height: 30 }}>
                      <span className="self-stretch" style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#1F2937" }}>
                        {row.client}
                      </span>
                    </div>
                    <div className="flex flex-row justify-start items-center flex-1" style={{ padding: "8px 6px", gap: 10, height: 30 }}>
                      <span className="self-stretch" style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#1F2937" }}>
                        {row.deal}
                      </span>
                    </div>
                    <div className="flex flex-row justify-end items-center flex-1" style={{ padding: "8px 6px", gap: 10, height: 30 }}>
                      <span style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 12, lineHeight: "120%", color: "#1F2937", textAlign: "right" }}>
                        {row.amount}
                      </span>
                    </div>
                  </div>
                  <div className="self-stretch flex-shrink-0" style={{ width: 386, height: 1, background: "#1F2937", opacity: 0.1 }} />
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
