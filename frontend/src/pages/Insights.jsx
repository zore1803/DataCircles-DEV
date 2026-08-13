import React, { useEffect, useState, useMemo, useRef } from "react";
import logo from "/DataCircles.png";
import { formatNumberToIndian } from "../utils/numberFormatter";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import {
  Calendar,
  Download,
  Filter,
  TrendingUp,
  Users,
  Building,
  Briefcase,
  FileText,
  Target,
  Phone,
  Mail,
  ShoppingCart,
  Package,
  UserCheck,
  BarChart3,
  X,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  MapPin,
  ChevronDown as ExpandIcon,
  ChevronUp as CollapseIcon,
  Globe,
  ArrowUp,
  Minus,
  ArrowDown,
  ShoppingBag,
  Wallet,
  ClipboardList,
  IndianRupee,
  Trophy,
  XCircle,
  PieChartIcon,
  CheckSquare,
  Video,
  IndianRupeeIcon,
} from "lucide-react";
import API from "../services/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Array of cool loading messages relevant for dashboard
const loadingMessages = [
  "Crunching data to show what really matters.",

  "Bringing clarity to your business performance.",

  "Smart insights are just a few seconds away!",

  "Let’s turn your CRM data into meaningful growth.",

  "Analyzing deals, invoices, and customers — hang tight!",

  "Your analytics dashboard is getting smarter!",

  "Insights that help you make data-backed decisions.",

  "Numbers that speak — visuals that inspire.",
];

// Select a random message
const randomMessage =
  loadingMessages[Math.floor(Math.random() * loadingMessages.length)];

const Insights = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  });
  const [filters, setFilters] = useState({
    contactStatus: "all",
    companySize: "all",
    dealStage: "all",
    vendorStatus: "all",
    purchaseStatus: "all",
    poStatus: "all",
  });

  // Data states
  const [contacts, setContacts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [deals, setDeals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [activityTab, setActivityTab] = useState("all");
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState([]);
  const [selectedUser, setSelectedUser] = React.useState("all");

  const toggleExpandRow = (companyId) => {
    setExpandedRows((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId]
    );
  };

  const truncateText = (text, maxLength = 30) => {
    if (!text) return "—";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      icon: <TrendingUp className="w-4 h-4" />,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      id: "contacts",
      label: "Contacts",
      icon: <Users className="w-4 h-4" />,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      id: "companies",
      label: "Companies",
      icon: <Building className="w-4 h-4" />,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      id: "deals",
      label: "Deals",
      icon: <Briefcase className="w-4 h-4" />,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      id: "vendors",
      label: "Vendors",
      icon: <UserCheck className="w-4 h-4" />,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      id: "purchase-orders",
      label: "Purchase Orders",
      icon: <ShoppingCart className="w-4 h-4" />,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
    },
    {
      id: "purchases",
      label: "Purchases",
      icon: <Package className="w-4 h-4" />,
      color: "text-pink-600",
      bgColor: "bg-pink-50",
    },
    {
      id: "invoices",
      label: "Invoices",
      icon: <FileText className="w-4 h-4" />,
      color: "text-teal-600",
      bgColor: "bg-teal-50",
    },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [
        contactsRes,
        companiesRes,
        dealsRes,
        tasksRes,
        vendorsRes,
        purchaseOrdersRes,
        purchasesRes,
        invoicesRes,
        meetingsRes,
      ] = await Promise.all([
        API.get("/contacts"),
        API.get("/companies"),
        API.get("/deals"),
        API.get("/tasks"),
        API.get("/vendors"),
        API.get("/purchase-orders"),
        API.get("/purchases"),
        API.get("/invoices"),
        API.get("/meetings").catch(() => ({ data: { meetings: [] } })),
      ]);

      setContacts(contactsRes.data);
      setCompanies(companiesRes.data);
      setDeals(dealsRes.data);
      setTasks(tasksRes.data);
      setVendors(vendorsRes.data);
      setPurchaseOrders(purchaseOrdersRes.data);
      setPurchases(purchasesRes.data);
      setInvoices(invoicesRes.data);
      setMeetings(meetingsRes.data?.meetings || meetingsRes.data || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter data based on date range and filters
  const filteredData = useMemo(() => {
    let filteredContacts = contacts;
    let filteredCompanies = companies;
    let filteredDeals = deals;
    let filteredVendors = vendors;
    let filteredPurchaseOrders = purchaseOrders;
    let filteredPurchases = purchases;
    let filteredInvoices = invoices;

    // Apply date filters
    if (dateRange.startDate && dateRange.endDate) {
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);

      filteredContacts = contacts.filter((item) => {
        const createdAt = new Date(item.createdAt);
        return createdAt >= startDate && createdAt <= endDate;
      });

      filteredCompanies = companies.filter((item) => {
        const createdAt = new Date(item.createdAt);
        return createdAt >= startDate && createdAt <= endDate;
      });

      filteredDeals = deals.filter((item) => {
        const createdAt = new Date(item.createdAt);
        return createdAt >= startDate && createdAt <= endDate;
      });

      filteredVendors = vendors.filter((item) => {
        const createdAt = new Date(item.createdAt);
        return createdAt >= startDate && createdAt <= endDate;
      });

      filteredPurchaseOrders = purchaseOrders.filter((item) => {
        const orderDate = new Date(item.orderDate || item.createdAt);
        return orderDate >= startDate && orderDate <= endDate;
      });

      filteredPurchases = purchases.filter((item) => {
        const purchaseDate = new Date(item.purchaseDate || item.createdAt);
        return purchaseDate >= startDate && purchaseDate <= endDate;
      });

      filteredInvoices = invoices.filter((item) => {
        const invoiceDate = new Date(item.date || item.createdAt);
        return invoiceDate >= startDate && invoiceDate <= endDate;
      });
    }

    // Apply status filters
    if (filters.contactStatus !== "all") {
      filteredContacts = filteredContacts.filter(
        (contact) => contact.stageStatus === filters.contactStatus
      );
    }

    if (filters.dealStage !== "all") {
      filteredDeals = filteredDeals.filter(
        (deal) => deal.status === filters.dealStage
      );
    }

    if (filters.poStatus !== "all") {
      filteredPurchaseOrders = filteredPurchaseOrders.filter(
        (po) => po.status === filters.poStatus
      );
    }

    if (filters.purchaseStatus !== "all") {
      filteredPurchases = filteredPurchases.filter(
        (purchase) => purchase.status === filters.purchaseStatus
      );
    }

    return {
      filteredContacts,
      filteredCompanies,
      filteredDeals,
      filteredVendors,
      filteredPurchaseOrders,
      filteredPurchases,
      filteredInvoices,
    };
  }, [
    contacts,
    companies,
    deals,
    vendors,
    purchaseOrders,
    purchases,
    invoices,
    dateRange,
    filters,
  ]);

  // Generate chart data
  const chartData = useMemo(() => {
    const {
      filteredContacts,
      filteredCompanies,
      filteredDeals,
      filteredVendors,
      filteredPurchaseOrders,
      filteredPurchases,
      filteredInvoices,
    } = filteredData;

    // Monthly trends
    const monthlyTrends = [];
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    months.forEach((month, index) => {
      const contactsCount = filteredContacts.filter(
        (item) => new Date(item.createdAt).getMonth() === index
      ).length;

      const companiesCount = filteredCompanies.filter(
        (item) => new Date(item.createdAt).getMonth() === index
      ).length;

      const dealsCount = filteredDeals.filter(
        (item) => new Date(item.createdAt).getMonth() === index
      ).length;

      const vendorsCount = filteredVendors.filter(
        (item) => new Date(item.createdAt).getMonth() === index
      ).length;

      const purchaseOrdersCount = filteredPurchaseOrders.filter(
        (item) => new Date(item.createdAt).getMonth() === index
      ).length;

      const purchasesCount = filteredPurchases.filter(
        (item) => new Date(item.createdAt).getMonth() === index
      ).length;

      const invoicesCount = filteredInvoices.filter(
        (item) => new Date(item.createdAt).getMonth() === index
      ).length;

      monthlyTrends.push({
        month,
        contacts: contactsCount,
        companies: companiesCount,
        deals: dealsCount,
        vendors: vendorsCount,
        purchaseOrders: purchaseOrdersCount,
        purchases: purchasesCount,
        invoices: invoicesCount,
      });
    });

    // Daily trends — one bucket per calendar day, spanning from the
    // earliest record on file up to today (used by the "Revenue vs Business
    // Spends" chart, which scrolls horizontally across the whole range
    // instead of being capped at a fixed window).
    const dailyTrends = [];
    const dayMs = 24 * 60 * 60 * 1000;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let rangeStart;
    let rangeEnd;
    if (dateRange.startDate && dateRange.endDate) {
      // A date filter is active on the strip — the chart's window should
      // match it exactly instead of silently expanding to today.
      rangeStart = new Date(dateRange.startDate);
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = new Date(dateRange.endDate);
      rangeEnd.setHours(0, 0, 0, 0);
    } else {
      const allDatedRecords = [
        ...filteredInvoices.map((item) => item.date || item.createdAt),
        ...filteredPurchases.map((item) => item.purchaseDate || item.createdAt),
        ...filteredPurchaseOrders.map((item) => item.orderDate || item.createdAt),
      ]
        .map((d) => (d ? new Date(d) : null))
        .filter(Boolean);
      let earliestStart = todayStart;
      if (allDatedRecords.length > 0) {
        earliestStart = new Date(Math.min(...allDatedRecords.map((d) => d.getTime())));
        earliestStart.setHours(0, 0, 0, 0);
      }
      // Always show at least a 30-day window, even with no/recent-only data.
      const minStart = new Date(todayStart.getTime() - 29 * dayMs);
      rangeStart = earliestStart < minStart ? earliestStart : minStart;
      rangeEnd = todayStart;
    }
    const totalDays = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / dayMs) + 1;

    for (let i = 0; i < totalDays; i++) {
      const day = new Date(rangeStart.getTime() + i * dayMs);
      const dayKey = day.toDateString();

      const revenue = filteredInvoices
        .filter((item) => {
          const d = item.date || item.createdAt;
          return d && new Date(d).toDateString() === dayKey;
        })
        .reduce((sum, item) => sum + (item.amount || 0), 0);

      const purchases = filteredPurchases
        .filter((item) => {
          const d = item.purchaseDate || item.createdAt;
          return d && new Date(d).toDateString() === dayKey;
        })
        .reduce((sum, item) => sum + (item.totalAmount || 0), 0);

      const vendorSpends = filteredPurchaseOrders
        .filter((item) => {
          const d = item.orderDate || item.createdAt;
          return d && new Date(d).toDateString() === dayKey;
        })
        .reduce((sum, item) => sum + (item.totalAmount || 0), 0);

      dailyTrends.push({
        date: day.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        fullDate: day.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
        revenue,
        purchases,
        vendorSpends,
      });
    }

    // Contact status distribution
    const contactStatusData = [
      {
        name: "New",
        value: filteredContacts.filter((c) => c.stageStatus === "New").length,
        color: "#3b82f6",
      },
      {
        name: "Contacted",
        value: filteredContacts.filter((c) => c.stageStatus === "Contacted")
          .length,
        color: "#10b981",
      },
      {
        name: "Qualified",
        value: filteredContacts.filter((c) => c.stageStatus === "Qualified")
          .length,
        color: "#f59e0b",
      },
      {
        name: "Won",
        value: filteredContacts.filter((c) => c.stageStatus === "Won").length,
        color: "#ef4444",
      },
      {
        name: "Lost",
        value: filteredContacts.filter((c) => c.stageStatus === "Lost").length,
        color: "#06b6d4",
      },
    ];

    // Purchase Order status distribution
    const poStatusData = [
      {
        name: "Pending",
        value: filteredPurchaseOrders.filter((po) => po.status === "Pending")
          .length,
        color: "#f59e0b",
      },
      {
        name: "Approved",
        value: filteredPurchaseOrders.filter((po) => po.status === "Approved")
          .length,
        color: "#10b981",
      },
      {
        name: "Rejected",
        value: filteredPurchaseOrders.filter((po) => po.status === "Rejected")
          .length,
        color: "#ef4444",
      },
      {
        name: "Delivered",
        value: filteredPurchaseOrders.filter((po) => po.status === "Delivered")
          .length,
        color: "#3b82f6",
      },
    ];

    // Purchase status distribution
    const purchaseStatusData = [
      {
        name: "Draft",
        value: filteredPurchases.filter((p) => p.status === "Draft").length,
        color: "#f59e0b",
      },
      {
        name: "Pending",
        value: filteredPurchases.filter((p) => p.status === "Pending").length,
        color: "#ef4444",
      },
      {
        name: "Paid",
        value: filteredPurchases.filter((p) => p.status === "Paid").length,
        color: "#10b981",
      },
      {
        name: "Cancelled",
        value: filteredPurchases.filter((p) => p.status === "Cancelled").length,
        color: "#06b6d4",
      },
    ];

    // Invoice status distribution
    const invoiceStatusData = [
      {
        name: "Draft",
        value: filteredInvoices.filter((inv) => inv.status === "Draft").length,
        color: "#f59e0b",
      },
      {
        name: "Sent",
        value: filteredInvoices.filter((inv) => inv.status === "Sent").length,
        color: "#3b82f6",
      },
      {
        name: "Paid",
        value: filteredInvoices.filter((inv) => inv.status === "Paid").length,
        color: "#10b981",
      },
      {
        name: "Overdue",
        value: filteredInvoices.filter((inv) => inv.status === "Overdue")
          .length,
        color: "#ef4444",
      },
      {
        name: "Cancelled",
        value: filteredInvoices.filter((inv) => inv.status === "Cancelled")
          .length,
        color: "#06b6d4",
      },
    ];

    // Deal values
    const dealValues = filteredDeals.map((deal) => ({
      name: deal.title,
      value: deal.amount || 0,
      stage: deal.status,
    }));

    // Purchase values
    const purchaseValues = filteredPurchases.map((purchase) => ({
      name: purchase.purchaseNumber,
      value: purchase.totalAmount || 0,
      status: purchase.status,
    }));

    // Invoice values
    const invoiceValues = filteredInvoices.map((invoice) => ({
      name: invoice.invoiceNumber,
      value: invoice.amount || 0,
      status: invoice.status,
    }));

    return {
      monthlyTrends,
      dailyTrends,
      contactStatusData,
      dealValues,
      poStatusData,
      purchaseStatusData,
      purchaseValues,
      invoiceStatusData,
      invoiceValues,
    };
  }, [filteredData]);

  // Export functions
  const exportToPDF = (reportType) => {
    const doc = new jsPDF();
    const {
      filteredContacts,
      filteredCompanies,
      filteredDeals,
      filteredVendors,
      filteredPurchaseOrders,
      filteredPurchases,
      filteredInvoices,
    } = filteredData;

    doc.setFontSize(20);
    doc.text(`${reportType} Report`, 20, 20);

    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 35);
    doc.text(
      `Date Range: ${dateRange.startDate || "All time"} - ${
        dateRange.endDate || "Present"
      }`,
      20,
      45
    );

    let data = [];
    let headers = [];

    switch (reportType) {
      case "Contacts":
        headers = ["Name", "Email", "Phone", "Company", "Status"];
        data = filteredContacts.map((contact) => [
          contact.name,
          contact.email,
          contact.phone || "",
          contact.company?.name || "",
          contact.stageStatus || "",
        ]);
        break;

      case "Companies":
        headers = ["Name", "Industry", "Size", "Location", "Website"];
        data = filteredCompanies.map((company) => [
          company.name,
          company.industry || "",
          company.size || "",
          company.location || "",
          company.website || "",
        ]);
        break;

      case "Deals":
        headers = ["Title", "Value", "Stage", "Company", "Close Date"];
        data = filteredDeals.map((deal) => [
          deal.title,
          `₹${deal.amount || 0}`,
          deal.status || "",
          deal.company?.name || "",
          deal.closeDate ? new Date(deal.closeDate).toLocaleDateString() : "",
        ]);
        break;

      case "Vendors":
        headers = ["Name", "Email", "Phone", "Company", "GSTIN", "Balance"];
        data = filteredVendors.map((vendor) => [
          vendor.name,
          vendor.email || "",
          vendor.phone || "",
          vendor.company || "",
          vendor.gstin || "",
          `₹${vendor.balance || 0}`,
        ]);
        break;

      case "Purchase Orders":
        headers = [
          "PO Number",
          "Vendor",
          "Order Date",
          "Total Amount",
          "Status",
        ];
        data = filteredPurchaseOrders.map((po) => [
          po.poNumber,
          po.vendor?.name || "",
          new Date(po.orderDate).toLocaleDateString(),
          `₹${po.totalAmount || 0}`,
          po.status || "",
        ]);
        break;

      case "Purchases":
        headers = [
          "Purchase Number",
          "Vendor",
          "Purchase Date",
          "Total Amount",
          "Status",
        ];
        data = filteredPurchases.map((purchase) => [
          purchase.purchaseNumber,
          purchase.vendor?.name || "",
          new Date(purchase.purchaseDate).toLocaleDateString(),
          `₹${purchase.totalAmount || 0}`,
          purchase.status || "",
        ]);
        break;

      case "Invoices":
        headers = [
          "Invoice Number",
          "Deal",
          "Amount",
          "Status",
          "Date",
          "Due Date",
        ];
        data = filteredInvoices.map((invoice) => [
          invoice.invoiceNumber,
          invoice.deal?.title || "",
          `₹${invoice.amount || 0}`,
          invoice.status || "",
          new Date(invoice.date).toLocaleDateString(),
          invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "",
        ]);
        break;
    }

    autoTable(doc, {
      head: [headers],
      body: data,
      startY: 60,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(
      `${reportType}-report-${new Date().toISOString().split("T")[0]}.pdf`
    );
  };

  const StatCard = ({ title, value, icon, color, bgColor, change, changeLabel = "vs last month", trend }) => (
    <div className="relative min-h-[72px] flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-xl min-w-0">
      <div className="w-10 h-10 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
        <div className={color}>{React.cloneElement(icon, { className: "w-5 h-5" })}</div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate w-full text-[11px] text-gray-500">{title}</p>
        <p className="truncate w-full text-base font-bold text-gray-900">{value}</p>
      </div>
      {change !== undefined && (
        <div className="absolute bottom-2 right-3 flex items-center gap-1">
          <TrendingUp
            className={`w-3 h-3 flex-shrink-0 ${
              change >= 0 ? "text-green-600" : "text-red-600 rotate-180"
            }`}
          />
          <span
            className={`text-[11px] font-semibold whitespace-nowrap ${
              change >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {change >= 0 ? "+" : ""}
            {change}% {changeLabel}
          </span>
        </div>
      )}
    </div>
  );

  const TableWrapper = ({ title, onExport, children }) => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );

  const getStatusBadge = (status) => {
    const statusConfig = {
      New: {
        bg: "bg-blue-100",
        text: "text-blue-800",
        icon: <Clock className="w-3 h-3" />,
      },
      Contacted: {
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        icon: <Phone className="w-3 h-3" />,
      },
      Qualified: {
        bg: "bg-green-100",
        text: "text-green-800",
        icon: <CheckCircle className="w-3 h-3" />,
      },
      Won: {
        bg: "bg-green-100",
        text: "text-green-800",
        icon: <CheckCircle className="w-3 h-3" />,
      },
      Lost: {
        bg: "bg-red-100",
        text: "text-red-800",
        icon: <X className="w-3 h-3" />,
      },
      Pending: {
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        icon: <Clock className="w-3 h-3" />,
      },
      Approved: {
        bg: "bg-green-100",
        text: "text-green-800",
        icon: <CheckCircle className="w-3 h-3" />,
      },
      Rejected: {
        bg: "bg-red-100",
        text: "text-red-800",
        icon: <X className="w-3 h-3" />,
      },
      Delivered: {
        bg: "bg-blue-100",
        text: "text-blue-800",
        icon: <CheckCircle className="w-3 h-3" />,
      },
      Draft: {
        bg: "bg-gray-100",
        text: "text-gray-800",
        icon: <FileText className="w-3 h-3" />,
      },
      Paid: {
        bg: "bg-green-100",
        text: "text-green-800",
        icon: <CheckCircle className="w-3 h-3" />,
      },
      Sent: {
        bg: "bg-blue-100",
        text: "text-blue-800",
        icon: <Mail className="w-3 h-3" />,
      },
      Overdue: {
        bg: "bg-red-100",
        text: "text-red-800",
        icon: <AlertCircle className="w-3 h-3" />,
      },
      Cancelled: {
        bg: "bg-gray-100",
        text: "text-gray-800",
        icon: <X className="w-3 h-3" />,
      },
    };

    const config = statusConfig[status] || {
      bg: "bg-gray-100",
      text: "text-gray-800",
      icon: null,
    };

    return (
      <span
        className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full ${config.bg} ${config.text}`}
      >
        {config.icon}
        {status || "None"}
      </span>
    );
  };

  // Business Activity feed: recent deal stage changes, completed tasks,
  // meetings, and invoice/payment events, merged into one timeline and
  // sorted newest-first. Notes aren't included since notes are only
  // fetched per-company/contact, not org-wide.
  const businessActivity = useMemo(() => {
    const items = [];

    deals.forEach((deal) => {
      const at = deal.updatedAt || deal.createdAt;
      if (!at) return;
      items.push({
        id: `deal-${deal._id}`,
        type: "deals",
        icon: <Briefcase className="w-4 h-4" />,
        iconBg: "bg-blue-100 text-blue-600",
        title: `Deal Moved to ${deal.status || "Update"}`,
        subtitle: [deal.title, deal.company?.name].filter(Boolean).join(" • "),
        at,
      });
    });

    tasks
      .filter((task) => task.status === "Completed")
      .forEach((task) => {
        const at = task.updatedAt || task.createdAt;
        if (!at) return;
        items.push({
          id: `task-${task._id}`,
          type: "tasks",
          icon: <CheckSquare className="w-4 h-4" />,
          iconBg: "bg-green-100 text-green-600",
          title: "Task Completed",
          subtitle: task.title || "Untitled task",
          at,
        });
      });

    meetings.forEach((meeting) => {
      const at = meeting.updatedAt || meeting.scheduledAt || meeting.createdAt;
      if (!at) return;
      const isCompleted = meeting.status === "Completed";
      items.push({
        id: `meeting-${meeting._id}`,
        type: "meetings",
        icon: <Video className="w-4 h-4" />,
        iconBg: "bg-purple-100 text-purple-600",
        title: isCompleted ? "Meeting Completed" : "Meeting Scheduled",
        subtitle: meeting.title || "Untitled meeting",
        at,
      });
    });

    invoices.forEach((invoice) => {
      const isOverdue =
        invoice.status !== "Paid" &&
        invoice.dueDate &&
        new Date(invoice.dueDate) < new Date();
      const at = invoice.updatedAt || invoice.dueDate || invoice.createdAt;
      if (!at) return;
      items.push({
        id: `invoice-${invoice._id}`,
        type: "invoices",
        icon: <FileText className="w-4 h-4" />,
        iconBg: isOverdue ? "bg-red-100 text-red-600" : "bg-teal-100 text-teal-600",
        title: isOverdue
          ? `Invoice #${invoice.invoiceNumber} is overdue`
          : `Invoice #${invoice.invoiceNumber} — ${invoice.status}`,
        subtitle: `₹${formatNumberToIndian(invoice.amount || 0)}`,
        at,
      });
    });

    return items
      .filter((item) => item.at)
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 20);
  }, [deals, tasks, meetings, invoices]);

  const filteredActivity =
    activityTab === "all"
      ? businessActivity
      : businessActivity.filter((item) => item.type === activityTab);

  const formatActivityDate = (at) => {
    const d = new Date(at);
    const datePart = d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const timePart = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${datePart} • ${timePart}`;
  };

  const dailyTrendsRawMax = Math.max(
    1000,
    ...chartData.dailyTrends.map((d) => (d.revenue || 0) + (d.purchases || 0) + (d.vendorSpends || 0)),
  );
  // Round up to a "nice" step (multiple of 1000) so 5 evenly-spaced ticks
  // (0, step, 2*step, ...) land on clean numbers AND each one rounds to a
  // distinct "Xk" label — a step below 1000 made adjacent ticks (e.g. 500 &
  // 1000) collapse onto the same displayed "1k".
  const dailyTrendsStep = Math.ceil(dailyTrendsRawMax / 4 / 1000) * 1000 || 1000;
  const dailyTrendsYMax = dailyTrendsStep * 4;
  const dailyTrendsTicks = [0, 1, 2, 3, 4].map((i) => i * dailyTrendsStep);
  const formatDailyTrendsTick = (v) => (v === 0 ? "₹0" : `₹${Math.round(v / 1000)}k`);
  // Every 5th day's date label, but always force the last entry (today) in
  // too, so the active/current date is never skipped off the right edge.
  const dailyTrendsDateTicks = chartData.dailyTrends
    .map((d) => d.date)
    .filter((_, i, arr) => i % 5 === 0 || i === arr.length - 1);

  // Scrolls the trends chart to the right edge (today) on load, instead of
  // defaulting to the leftmost/earliest date.
  const trendsScrollRef = useRef(null);
  const scrollTrendsToToday = () => {
    const el = trendsScrollRef.current;
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
  };
  useEffect(() => {
    const el = trendsScrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
    // Re-run whenever the Overview tab becomes active again — the scroll
    // container unmounts/remounts on tab switch (losing its scroll
    // position), so scrolling only on data-length change isn't enough to
    // land back on today after navigating away and back.
  }, [chartData.dailyTrends.length, activeTab]);

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Contacts"
            value={filteredData.filteredContacts.length}
            icon={<Users className="w-6 h-6" />}
            color="text-blue-600"
            bgColor="bg-blue-50"
            change={12}
          />
          <StatCard
            title="Total Companies"
            value={filteredData.filteredCompanies.length}
            icon={<Building className="w-6 h-6" />}
            color="text-green-600"
            bgColor="bg-green-50"
            change={8}
          />
          <StatCard
            title="Active Deals"
            value={filteredData.filteredDeals.length}
            icon={<Briefcase className="w-6 h-6" />}
            color="text-purple-600"
            bgColor="bg-purple-50"
            change={-3}
          />
          <StatCard
            title="Total Vendors"
            value={filteredData.filteredVendors.length}
            icon={<UserCheck className="w-6 h-6" />}
            color="text-indigo-600"
            bgColor="bg-indigo-50"
            change={5}
          />
          <StatCard
            title="Total Deal Value"
            value={`₹${formatNumberToIndian(
              filteredData.filteredDeals.reduce(
                (sum, deal) => sum + (deal.amount || 0),
                0
              )
            )}`}
            icon={<IndianRupeeIcon className="w-6 h-6" />}
            color="text-orange-600"
            bgColor="bg-orange-50"
            change={15}
          />
          <StatCard
            title="Total Purchases"
            value={`₹${formatNumberToIndian(
              filteredData.filteredPurchases.reduce(
                (sum, purchase) => sum + (purchase.totalAmount || 0),
                0
              )
            )}`}
            icon={<Package className="w-6 h-6" />}
            color="text-pink-600"
            bgColor="bg-pink-50"
            change={-2}
          />
          <StatCard
            title="Total Invoices"
            value={filteredData.filteredInvoices.length}
            icon={<FileText className="w-6 h-6" />}
            color="text-teal-600"
            bgColor="bg-teal-50"
            change={10}
          />
          <StatCard
            title="Total Invoice Value"
            value={`₹${formatNumberToIndian(
              filteredData.filteredInvoices.reduce(
                (sum, inv) => sum + (inv.amount || 0),
                0
              )
            )}`}
            icon={<IndianRupeeIcon className="w-6 h-6" />}
            color="text-indigo-600"
            bgColor="bg-indigo-50"
            change={18}
          />
        </div>
      </div>

      {/* Charts */}
      <div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Monthly Trends — spans the same width as the first 3 KPI cards */}
          <div className="lg:col-span-3 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold leading-[120%] text-[#0E121B]">
                  Revenue vs Business Spends
                </h3>
                <button
                  onClick={scrollTrendsToToday}
                  className="h-7 px-3 rounded-full text-xs font-medium bg-[#F8F8FB] text-[#1F2937] hover:bg-gray-200 transition-colors flex-shrink-0"
                >
                  Today
                </button>
              </div>
              <div className="flex flex-row flex-wrap items-center gap-4">
                {[
                  { color: "#0085FF", label: "Revenue" },
                  { color: "#00C950", label: "Purchases" },
                  { color: "#D87000", label: "Vendor Spends" },
                ].map((legend) => (
                  <div key={legend.label} className="flex items-center gap-2">
                    <span
                      className="inline-block w-10 h-2 rounded-full flex-shrink-0"
                      style={{ background: legend.color }}
                    />
                    <span
                      className="text-xs font-normal leading-6"
                      style={{ color: "rgba(33, 32, 31, 0.56)" }}
                    >
                      {legend.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-row items-stretch" style={{ height: 380 }}>
              {/* Fixed Y-axis column, mirrors Dashboard's Sales Revenue widget */}
              <div style={{ width: 68, height: "100%", flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData.dailyTrends} margin={{ top: 12, right: 0, left: 0, bottom: 8 }}>
                    <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
                    <YAxis
                      domain={[0, dailyTrendsYMax]}
                      ticks={dailyTrendsTicks}
                      tickFormatter={formatDailyTrendsTick}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      width={68}
                      tick={{ fontSize: 11, fontFamily: "Inter", fill: "rgba(33, 32, 31, 0.56)", textAnchor: "end" }}
                    />
                    <Area dataKey="revenue" stroke="none" fill="none" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Scrollable X-axis — pans across the full data range instead of
                  being capped to a fixed window. */}
              <div
                ref={trendsScrollRef}
                className="dc-scroll-visible flex-1 min-w-0 overflow-x-auto overflow-y-hidden"
                style={{ height: "100%", cursor: "grab" }}
              >
                <div
                  style={{
                    minWidth: `${Math.max(100, (chartData.dailyTrends.length / 20) * 100)}%`,
                    height: "100%",
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData.dailyTrends} margin={{ top: 12, right: 24, left: 8, bottom: 8 }}>
                      <defs>
                        <linearGradient
                          id="colorRevenue"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="5%" stopColor="#0085FF" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#0085FF" stopOpacity={0.1} />
                        </linearGradient>
                        <linearGradient
                          id="colorPurchases"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="5%" stopColor="#00C950" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#00C950" stopOpacity={0.1} />
                        </linearGradient>
                        <linearGradient id="colorVendorSpends" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#D87000" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#D87000" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E7E4E3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={20}
                        ticks={dailyTrendsDateTicks}
                        interval="preserveStart"
                        tick={{ fontSize: 12, fontFamily: "Inter", fill: "rgba(33, 32, 31, 0.56)" }}
                      />
                      <YAxis domain={[0, dailyTrendsYMax]} ticks={dailyTrendsTicks} hide />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#0085FF"
                        strokeWidth={2}
                        fill="none"
                      />
                      <Area
                        type="monotone"
                        dataKey="purchases"
                        stroke="#00C950"
                        strokeWidth={2}
                        fill="none"
                      />
                      <Area
                        type="monotone"
                        dataKey="vendorSpends"
                        stroke="#D87000"
                        strokeWidth={2}
                        fill="none"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Business Activity — remaining 1-column width, matching the 4th KPI card */}
          <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
            <h3 className="text-base font-bold text-gray-900 mb-4">
              Business Activity
            </h3>
            <div className="flex flex-row items-center gap-2 mb-4 overflow-x-auto max-w-full">
              {[
                { id: "all", label: "All" },
                { id: "deals", label: "Deals" },
                { id: "tasks", label: "Tasks" },
                { id: "meetings", label: "Meetings" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActivityTab(tab.id)}
                  className={`flex items-center justify-center h-7 px-3 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                    activityTab === tab.id
                      ? "bg-[#0085FF] text-white"
                      : "bg-[#F8F8FB] text-[#1F2937]"
                  }`}
                  style={{ boxShadow: "0px 0px 6px rgba(0, 0, 0, 0.1)" }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="dc-scroll-visible relative flex-1 max-h-[380px] overflow-y-auto pl-4 pr-2">
              {filteredActivity.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">
                  No recent activity
                </p>
              ) : (
                <>
                  <div className="absolute left-8 top-2 bottom-2 w-px bg-gray-200" />
                  <div className="space-y-5">
                    {filteredActivity.map((item) => (
                      <div key={item.id} className="relative flex items-start gap-3">
                        <div
                          className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${item.iconBg}`}
                        >
                          {item.icon}
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {item.title}
                          </p>
                          {item.subtitle && (
                            <p className="text-xs text-gray-500 truncate">
                              {item.subtitle}
                            </p>
                          )}
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {formatActivityDate(item.at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sales Performance / Revenue & Collections / Deal Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {(() => {
          const dealsForStats = filteredData.filteredDeals;
          const totalDeals = dealsForStats.length;
          const wonDeals = dealsForStats.filter((d) => d.status === "Won").length;
          const lostDeals = dealsForStats.filter((d) => d.status === "Lost").length;
          const decidedDeals = wonDeals + lostDeals;
          const winRate = decidedDeals > 0 ? Math.round((wonDeals / decidedDeals) * 100) : 0;
          const totalDealValue = dealsForStats.reduce((sum, d) => sum + (d.amount || 0), 0);
          const avgDealSize = totalDeals > 0 ? totalDealValue / totalDeals : 0;

          const invoicesForStats = filteredData.filteredInvoices;
          const totalRevenue = invoicesForStats.reduce((sum, inv) => sum + (inv.amount || 0), 0);
          const collected = invoicesForStats
            .filter((inv) => inv.status === "Paid")
            .reduce((sum, inv) => sum + (inv.amount || 0), 0);
          const outstanding = totalRevenue - collected;
          const collectionRate = totalRevenue > 0 ? Math.round((collected / totalRevenue) * 100) : 0;

          const stageCounts = {};
          dealsForStats.forEach((d) => {
            const stage = d.status || "Unknown";
            stageCounts[stage] = (stageCounts[stage] || 0) + 1;
          });
          const stageEntries = Object.entries(stageCounts).sort((a, b) => b[1] - a[1]);
          const maxStageCount = Math.max(1, ...stageEntries.map(([, count]) => count));
          const pipelineStageColors = ["#0085FF", "#0C4FCD", "#2E7D32", "#D97706", "#E82222", "#00C950"];

          // Monthly Invoiced / Collected / Outstanding for the Revenue &
          // Collections chart — 12 buckets by calendar month (all years
          // merged into one, same convention as the earlier monthlyTrends).
          const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const revenueCollectionsData = monthLabels.map((label, idx) => {
            const monthInvoices = invoicesForStats.filter((inv) => {
              const d = inv.date || inv.createdAt;
              return d && new Date(d).getMonth() === idx;
            });
            const invoiced = monthInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
            const monthCollected = monthInvoices
              .filter((inv) => inv.status === "Paid")
              .reduce((sum, inv) => sum + (inv.amount || 0), 0);
            return {
              month: label,
              invoiced,
              collected: monthCollected,
              outstanding: invoiced - monthCollected,
            };
          });

          const openDeals = totalDeals - wonDeals - lostDeals;
          const salesPerformanceData = [
            { name: "Won", value: wonDeals, color: "#00C950" },
            { name: "Lost", value: lostDeals, color: "#E82222" },
            { name: "Open", value: openDeals, color: "#0085FF" },
          ];
          const hasAnyDeals = totalDeals > 0;

          return (
            <>
              {/* Sales Performance */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-base font-bold text-gray-900 mb-4">
                  Sales Performance
                </h3>
                {hasAnyDeals ? (
                  <div className="flex items-center gap-8">
                    <div className="relative flex-shrink-0" style={{ width: 148, height: 148 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={salesPerformanceData.filter((s) => s.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={52}
                            outerRadius={74}
                            paddingAngle={salesPerformanceData.filter((s) => s.value > 0).length > 1 ? 2 : 0}
                            dataKey="value"
                            stroke="none"
                          >
                            {salesPerformanceData
                              .filter((s) => s.value > 0)
                              .map((entry) => (
                                <Cell key={entry.name} fill={entry.color} />
                              ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[28px] font-semibold leading-tight text-[#0A0A0A]">
                          {winRate}%
                        </span>
                        <span className="text-[11px] font-medium text-[#525252]">
                          Win Rate
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 space-y-3">
                      {salesPerformanceData.map((entry) => (
                        <div key={entry.name} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-3 h-3 rounded-sm flex-shrink-0"
                              style={{ background: entry.color }}
                            />
                            <span className="text-sm font-medium text-[#0A0A0A] truncate">
                              {entry.name === "Open" ? "Open Deals" : `${entry.name} Deals`}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-[#525252] flex-shrink-0">
                            {entry.value}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
                        <span className="text-sm text-gray-500">Avg Deal Size</span>
                        <span className="text-sm font-semibold text-gray-900">
                          ₹{formatNumberToIndian(Math.round(avgDealSize))}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 py-10 text-center">No deals yet</p>
                )}
              </div>

              {/* Revenue & Collections */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-base font-bold text-gray-900 mb-4">
                  Revenue &amp; Collections
                </h3>
                {totalRevenue === 0 ? (
                  <p className="text-sm text-gray-400 py-10 text-center">No invoices yet</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={revenueCollectionsData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorInvoiced" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0085FF" stopOpacity={0.6} />
                            <stop offset="95%" stopColor="#0085FF" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0F766E" stopOpacity={0.6} />
                            <stop offset="95%" stopColor="#0F766E" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorOutstanding" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#E82222" stopOpacity={0.6} />
                            <stop offset="95%" stopColor="#E82222" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fontFamily: "Inter", fill: "#525252" }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          width={40}
                          tickFormatter={(v) => (v === 0 ? "₹0" : `₹${(v / 100000).toFixed(0)}L`)}
                          tick={{ fontSize: 10, fontFamily: "Inter", fill: "#525252" }}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload || payload.length === 0) return null;
                            const row = payload[0].payload;
                            const rows = [
                              { label: "Invoiced", value: row.invoiced, color: "#0085FF" },
                              { label: "Collected", value: row.collected, color: "#00C950" },
                              { label: "Outstanding", value: row.outstanding, color: "#E82222" },
                            ];
                            return (
                              <div className="bg-white border border-gray-200 rounded-md shadow-lg p-2">
                                <p className="text-xs font-medium text-gray-500 mb-1.5">{label}</p>
                                <div className="space-y-1.5">
                                  {rows.map((r) => (
                                    <div key={r.label} className="flex items-center gap-1.5">
                                      <span
                                        className="w-1 self-stretch rounded-full flex-shrink-0"
                                        style={{ background: r.color }}
                                      />
                                      <div>
                                        <p className="text-[11px] text-gray-500 leading-tight">{r.label}</p>
                                        <p className="text-xs font-medium text-gray-900 leading-tight">
                                          ₹{formatNumberToIndian(Math.round(r.value))}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Area type="monotone" dataKey="invoiced" stroke="#0085FF" strokeWidth={2} fill="url(#colorInvoiced)" />
                        <Area type="monotone" dataKey="collected" stroke="#0F766E" strokeWidth={2} fill="url(#colorCollected)" />
                        <Area type="monotone" dataKey="outstanding" stroke="#E82222" strokeWidth={2} fill="url(#colorOutstanding)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </>
                )}
              </div>

              {/* Deal Pipeline */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-[#0E121B]">Deal Pipeline</h3>
                  <p className="text-xs text-[#525866] mt-0.5">Active Opportunities by Stage</p>
                </div>
                {stageEntries.length === 0 ? (
                  <p className="text-sm text-gray-400 py-10 text-center">No deals yet</p>
                ) : (
                  <>
                    {/* Segmented bar — one block per stage, sized by share of total */}
                    <div className="flex flex-row items-stretch gap-0.5 h-10 rounded-lg overflow-hidden mb-4">
                      {stageEntries.map(([stage, count], idx) => (
                        <div
                          key={stage}
                          title={`${stage}: ${count}`}
                          style={{
                            background: pipelineStageColors[idx % pipelineStageColors.length],
                            flexGrow: count,
                            flexBasis: 0,
                          }}
                        />
                      ))}
                    </div>
                    <div className="border-t border-gray-100 pt-3 space-y-3">
                      {stageEntries.map(([stage, count], idx) => (
                        <div key={stage} className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                              style={{ background: pipelineStageColors[idx % pipelineStageColors.length] }}
                            />
                            <span className="text-xs font-medium text-[#0A0A0A] truncate">{stage}</span>
                          </div>
                          <span className="text-xs text-[#525252] flex-shrink-0">
                            {count} ({Math.round((count / totalDeals) * 100)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );

  const renderContactsReport = () => {
    // Calculate metrics
    const totalContacts = filteredData.filteredContacts.length;
    const contactsWithPhone = filteredData.filteredContacts.filter(
      (c) => c.phone
    ).length;
    const contactsWithCompany = filteredData.filteredContacts.filter(
      (c) => c.company?.name
    ).length;
    const contactIdsWithDeals = new Set(
      filteredData.filteredDeals.filter((d) => d.contact).map((d) => d.contact._id || d.contact)
    );
    const contactsWithDeals = filteredData.filteredContacts.filter((c) =>
      contactIdsWithDeals.has(c._id)
    ).length;
    const wonContacts = filteredData.filteredContacts.filter(
      (c) => c.stageStatus === "Won"
    ).length;
    const lostContacts = filteredData.filteredContacts.filter(
      (c) => c.stageStatus === "Lost"
    ).length;

    // Status distribution
    const statusDistribution = filteredData.filteredContacts.reduce(
      (acc, contact) => {
        const status = contact.stageStatus || "Unknown";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      {}
    );

    // Contacts created this month
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const contactsThisMonth = filteredData.filteredContacts.filter((c) => {
      const createdDate = new Date(c.createdAt);
      return (
        createdDate.getMonth() === currentMonth &&
        createdDate.getFullYear() === currentYear
      );
    }).length;
    // Total Contacts card's trend: how many contacts existed at the start of
    // this month vs the current total, i.e. growth over the current month.
    const monthStart = new Date(currentYear, currentMonth, 1);
    const contactsBeforeThisMonth = filteredData.filteredContacts.filter(
      (c) => new Date(c.createdAt) < monthStart
    ).length;
    const totalContactsChange =
      contactsBeforeThisMonth > 0
        ? Math.round((contactsThisMonth / contactsBeforeThisMonth) * 100)
        : totalContacts > 0
        ? 100
        : 0;
    // New Contacts card's trend: this month's new contacts vs last month's.
    const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();
    const contactsLastMonth = filteredData.filteredContacts.filter((c) => {
      const createdDate = new Date(c.createdAt);
      return (
        createdDate.getMonth() === lastMonth &&
        createdDate.getFullYear() === lastMonthYear
      );
    }).length;
    const newContactsChange =
      contactsLastMonth > 0
        ? Math.round(((contactsThisMonth - contactsLastMonth) / contactsLastMonth) * 100)
        : contactsThisMonth > 0
        ? 100
        : 0;
    // Contacts with Deals card's trend: deals opened (linked to a contact)
    // this month vs last month.
    const dealsWithContactThisMonth = filteredData.filteredDeals.filter((d) => {
      if (!d.contact) return false;
      const createdDate = new Date(d.createdAt);
      return (
        createdDate.getMonth() === currentMonth &&
        createdDate.getFullYear() === currentYear
      );
    }).length;
    const dealsWithContactLastMonth = filteredData.filteredDeals.filter((d) => {
      if (!d.contact) return false;
      const createdDate = new Date(d.createdAt);
      return (
        createdDate.getMonth() === lastMonth &&
        createdDate.getFullYear() === lastMonthYear
      );
    }).length;
    const contactsWithDealsChange =
      dealsWithContactLastMonth > 0
        ? Math.round(
            ((dealsWithContactThisMonth - dealsWithContactLastMonth) / dealsWithContactLastMonth) * 100
          )
        : dealsWithContactThisMonth > 0
        ? 100
        : 0;
    // Won/Lost Contacts cards' trend: contacts of that status created this
    // month vs last month.
    const wonContactsThisMonth = filteredData.filteredContacts.filter((c) => {
      if (c.stageStatus !== "Won") return false;
      const createdDate = new Date(c.createdAt);
      return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
    }).length;
    const wonContactsLastMonth = filteredData.filteredContacts.filter((c) => {
      if (c.stageStatus !== "Won") return false;
      const createdDate = new Date(c.createdAt);
      return createdDate.getMonth() === lastMonth && createdDate.getFullYear() === lastMonthYear;
    }).length;
    const wonContactsChange =
      wonContactsLastMonth > 0
        ? Math.round(((wonContactsThisMonth - wonContactsLastMonth) / wonContactsLastMonth) * 100)
        : wonContactsThisMonth > 0
        ? 100
        : 0;

    const lostContactsThisMonth = filteredData.filteredContacts.filter((c) => {
      if (c.stageStatus !== "Lost") return false;
      const createdDate = new Date(c.createdAt);
      return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
    }).length;
    const lostContactsLastMonth = filteredData.filteredContacts.filter((c) => {
      if (c.stageStatus !== "Lost") return false;
      const createdDate = new Date(c.createdAt);
      return createdDate.getMonth() === lastMonth && createdDate.getFullYear() === lastMonthYear;
    }).length;
    const lostContactsChange =
      lostContactsLastMonth > 0
        ? Math.round(((lostContactsThisMonth - lostContactsLastMonth) / lostContactsLastMonth) * 100)
        : lostContactsThisMonth > 0
        ? 100
        : 0;

    // Company distribution (top 5)
    const companyDistribution = filteredData.filteredContacts
      .filter((c) => c.company?.name)
      .reduce((acc, contact) => {
        const company = contact.company.name;
        acc[company] = (acc[company] || 0) + 1;
        return acc;
      }, {});

    const topCompanies = Object.entries(companyDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    return (
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Total Contacts"
            value={totalContacts}
            icon={<Users className="w-6 h-6" />}
            color="text-blue-600"
            bgColor="bg-blue-50"
            change={totalContactsChange}
            changeLabel="growth this month"
          />
          <StatCard
            title="New Contacts"
            value={contactsThisMonth}
            icon={<TrendingUp className="w-6 h-6" />}
            color="text-green-600"
            bgColor="bg-green-50"
            change={newContactsChange}
            changeLabel="vs last month"
          />
          <StatCard
            title="Contacts with Deals"
            value={contactsWithDeals}
            icon={<Briefcase className="w-6 h-6" />}
            color="text-purple-600"
            bgColor="bg-purple-50"
            change={contactsWithDealsChange}
            changeLabel="new deals vs last month"
          />
          <StatCard
            title="Won Contacts"
            value={wonContacts}
            icon={<CheckSquare className="w-6 h-6" />}
            color="text-emerald-600"
            bgColor="bg-emerald-50"
            change={wonContactsChange}
            changeLabel="wins vs last month"
          />
          <StatCard
            title="Lost Contacts"
            value={lostContacts}
            icon={<XCircle className="w-6 h-6" />}
            color="text-red-600"
            bgColor="bg-red-50"
            change={lostContactsChange}
            changeLabel="losses vs last month"
          />
        </div>

        {(() => {
          // No true "lead source" field exists on Contact yet, so this
          // reuses stageStatus as the closest available breakdown of "where
          // contacts stand" until a real acquisition-source field is added.
          const sourceColors = ["#0085FF", "#34C759", "#8E62EF", "#2A2726", "#E7E4E3", "#D97706", "#EC4899"];
          const sourceEntries = Object.entries(statusDistribution).sort((a, b) => b[1] - a[1]);
          const sourceData = sourceEntries.map(([status, count], idx) => ({
            name: status,
            value: count,
            color: sourceColors[idx % sourceColors.length],
          }));

          // Contact Commercial Impact heatmap — deal value tied to contacts,
          // bucketed by day-of-week x the last 6 weeks, using each deal's
          // amount as the "impact" intensity for the day it was created.
          const impactWeeks = 6;
          const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
          const todayForHeatmap = new Date();
          todayForHeatmap.setHours(0, 0, 0, 0);
          const mondayOffset = (todayForHeatmap.getDay() + 6) % 7; // days since this week's Monday
          const currentWeekMonday = new Date(todayForHeatmap.getTime() - mondayOffset * 24 * 60 * 60 * 1000);
          const impactGrid = Array.from({ length: impactWeeks }, () => Array(7).fill(0));
          filteredData.filteredDeals
            .filter((d) => d.contact && d.createdAt)
            .forEach((d) => {
              const createdAt = new Date(d.createdAt);
              createdAt.setHours(0, 0, 0, 0);
              const daysAgo = Math.round((currentWeekMonday.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000));
              const weeksAgo = Math.floor(daysAgo / 7);
              const rowFromBottom = impactWeeks - 1 - weeksAgo;
              if (rowFromBottom < 0 || rowFromBottom >= impactWeeks) return;
              const dayCol = 6 - (daysAgo - weeksAgo * 7);
              if (dayCol < 0 || dayCol > 6) return;
              impactGrid[rowFromBottom][dayCol] += d.amount || 0;
            });
          const impactMax = Math.max(1, ...impactGrid.flat());
          const impactOpacity = (value) => {
            if (value === 0) return 0.1;
            const ratio = value / impactMax;
            if (ratio > 0.6) return 1;
            if (ratio > 0.35) return 0.75;
            if (ratio > 0.15) return 0.5;
            return 0.25;
          };

          // Contact Commercial Impact: deals tied to a contact, their KPI
          // rollups, and a scatter of each deal (month created x amount)
          // colored by outcome.
          const dealsWithContact = filteredData.filteredDeals.filter((d) => d.contact);
          const pipelineInfluenced = dealsWithContact.reduce((sum, d) => sum + (d.amount || 0), 0);
          const wonDealsWithContact = dealsWithContact.filter((d) => d.status === "Won");
          const revenueWon = wonDealsWithContact.reduce((sum, d) => sum + (d.amount || 0), 0);
          const avgDealInfluenced =
            dealsWithContact.length > 0 ? pipelineInfluenced / dealsWithContact.length : 0;
          const formatCr = (v) => {
            if (v >= 1e7) return `₹${(v / 1e7).toFixed(1)} Cr`;
            if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`;
            if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}k`;
            return `₹${Math.round(v)}`;
          };
          const dealsForScatter = dealsWithContact.filter((d) => d.createdAt);
          const scatterAmountMax = Math.max(1, ...dealsForScatter.map((d) => d.amount || 0));
          const valueTierColor = (amount) => {
            const ratio = amount / scatterAmountMax;
            if (ratio > 0.66) return { fill: "#148FFF", tier: "High Value" };
            if (ratio > 0.33) return { fill: "#FFA908", tier: "Medium Value" };
            return { fill: "#8E62EF", tier: "Low Value" };
          };
          const scatterPoints = dealsForScatter.map((d) => {
            const { fill, tier } = valueTierColor(d.amount || 0);
            const createdDate = new Date(d.createdAt);
            const daysInMonth = new Date(
              createdDate.getFullYear(),
              createdDate.getMonth() + 1,
              0,
            ).getDate();
            // Spread points across each month based on the actual day of
            // the deal's creation, instead of stacking every deal from the
            // same month on one exact X position.
            const monthFraction = (createdDate.getDate() - 1) / daysInMonth;
            return {
              month: createdDate.getMonth() + monthFraction,
              amount: d.amount || 0,
              stage: d.status,
              title: d.title,
              fill,
              tier,
            };
          });

          return (
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm min-h-[560px]">
                <h3 className="text-sm font-semibold text-[#0E121B]">Contact Commercial Impact</h3>
                <p className="text-xs text-[#525866] mt-1">
                  Connect relationship activity with pipeline and revenue outcomes.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pb-5 border-b border-[#E1E4EA]">
                  <StatCard
                    title="Pipeline Influenced"
                    value={formatCr(pipelineInfluenced)}
                    icon={<Briefcase className="w-6 h-6" />}
                    color="text-blue-600"
                  />
                  <StatCard
                    title="Revenue Won"
                    value={formatCr(revenueWon)}
                    icon={<CheckSquare className="w-6 h-6" />}
                    color="text-emerald-600"
                  />
                  <StatCard
                    title="Avg. Deal Influenced"
                    value={formatCr(avgDealInfluenced)}
                    icon={<IndianRupee className="w-6 h-6" />}
                    color="text-purple-600"
                  />
                </div>

                {scatterPoints.length === 0 ? (
                  <p className="text-sm text-gray-400 py-16 text-center">No deals tied to contacts yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={340}>
                    <ScatterChart margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E7E7E7" />
                      <XAxis
                        dataKey="month"
                        type="number"
                        domain={[0, 12]}
                        ticks={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]}
                        tickFormatter={(m) =>
                          ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m]
                        }
                        tick={{ fontSize: 11, fill: "rgba(31, 31, 33, 0.56)" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        dataKey="amount"
                        tickFormatter={(v) => formatCr(v)}
                        tick={{ fontSize: 10, fill: "rgba(31, 31, 33, 0.56)" }}
                        tickLine={false}
                        axisLine={false}
                        width={56}
                      />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        formatter={(value, name) => (name === "amount" ? formatCr(value) : value)}
                        content={({ active, payload }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const p = payload[0].payload;
                          return (
                            <div className="bg-white border border-gray-200 rounded-md shadow-lg p-2 text-xs">
                              <p className="font-medium text-gray-900">{p.title || "Deal"}</p>
                              <p className="text-gray-500">{formatCr(p.amount)} • {p.tier} • {p.stage}</p>
                            </div>
                          );
                        }}
                      />
                      <Scatter
                        data={scatterPoints}
                        shape={(props) => {
                          const { cx, cy, payload } = props;
                          // Anchor the square's bottom edge at the data point
                          // instead of centering on it — with a ₹0 y-axis
                          // floor, a centered square for a near-zero amount
                          // would render half below the x-axis line.
                          return (
                            <rect
                              x={cx - 8}
                              y={cy - 16}
                              width={16}
                              height={16}
                              rx={4}
                              fill={payload.fill}
                              fillOpacity={0.9}
                            />
                          );
                        }}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                )}
                {scatterPoints.length > 0 && (
                  <div className="flex flex-row flex-wrap justify-center items-center gap-4 mt-2">
                    {[
                      { color: "#148FFF", label: "High Value" },
                      { color: "#FFA908", label: "Medium Value" },
                      { color: "#8E62EF", label: "Low Value" },
                    ].map((legend) => (
                      <div key={legend.label} className="flex items-center gap-2">
                        <span
                          className="w-4 h-4 rounded flex-shrink-0"
                          style={{ background: legend.color }}
                        />
                        <span
                          className="text-sm"
                          style={{ color: "rgba(31, 31, 33, 0.56)" }}
                        >
                          {legend.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-4">
                <div className="bg-white p-5 rounded-xl border border-[#E7E4E3] shadow-sm min-h-[272px]">
                  <h3 className="text-sm font-semibold text-[#0E121B]">Contact Commercial Impact</h3>
                  <p className="text-xs text-[#525866] mt-1">
                    Deal value tied to contacts, by day of week
                  </p>
                  <div className="mt-4 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-1">
                      {dayLabels.map((d) => (
                        <span
                          key={d}
                          className="flex-1 text-center text-[10px]"
                          style={{ color: "rgba(33, 32, 31, 0.56)" }}
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                    {impactGrid.map((row, rowIdx) => (
                      <div key={rowIdx} className="flex items-center gap-1">
                        {row.map((value, colIdx) => (
                          <div
                            key={colIdx}
                            title={`₹${formatNumberToIndian(Math.round(value))}`}
                            className="flex-1 rounded"
                            style={{
                              height: 20,
                              background: `rgba(0, 133, 255, ${impactOpacity(value)})`,
                            }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-3">
                    <span className="text-[10px]" style={{ color: "rgba(33, 32, 31, 0.56)" }}>
                      Low
                    </span>
                    {[0.1, 0.25, 0.5, 0.75, 1].map((op) => (
                      <span
                        key={op}
                        className="rounded-sm"
                        style={{ width: 16, height: 12, background: `rgba(0, 133, 255, ${op})` }}
                      />
                    ))}
                    <span className="text-[10px]" style={{ color: "rgba(33, 32, 31, 0.56)" }}>
                      High
                    </span>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-[#E7E4E3] shadow-sm min-h-[272px]">
                  <h3 className="text-sm font-semibold text-[#0E121B]">Contact Acquisition Sources</h3>
                  <p className="text-xs text-[#525866] mt-1">Where your contacts are coming from</p>
                  {totalContacts === 0 ? (
                    <p className="text-sm text-gray-400 py-10 text-center">No contacts yet</p>
                  ) : (
                    <div className="flex items-center justify-between gap-4 mt-4 flex-wrap">
                      <div className="relative flex-shrink-0" style={{ width: 160, height: 160 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={sourceData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              cornerRadius={8}
                              paddingAngle={sourceData.length > 1 ? 4 : 0}
                              dataKey="value"
                              stroke="none"
                              label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
                                const RADIAN = Math.PI / 180;
                                const r = (innerRadius + outerRadius) / 2;
                                const x = cx + r * Math.cos(-midAngle * RADIAN);
                                const y = cy + r * Math.sin(-midAngle * RADIAN);
                                const pct = Math.round((value / totalContacts) * 100);
                                const text = `${pct}%`;
                                const w = text.length * 6 + 10;
                                return (
                                  <g>
                                    <rect
                                      x={x - w / 2}
                                      y={y - 8}
                                      width={w}
                                      height={16}
                                      rx={6}
                                      fill="#FFFFFF"
                                    />
                                    <text
                                      x={x}
                                      y={y}
                                      textAnchor="middle"
                                      dominantBaseline="central"
                                      fontSize={11}
                                      fontWeight={500}
                                      fill="#21201F"
                                    >
                                      {text}
                                    </text>
                                  </g>
                                );
                              }}
                              labelLine={false}
                            >
                              {sourceData.map((entry) => (
                                <Cell key={entry.name} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-col gap-1.5 max-w-[220px] flex-shrink-0">
                        {sourceData.map((entry) => (
                          <div key={entry.name} className="flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                              style={{ background: entry.color }}
                            />
                            <span className="text-xs text-[#21201F]/70 truncate min-w-[80px]">{entry.name}</span>
                            <span className="text-[11px] text-[#525866] text-right flex-shrink-0 ml-4">
                              {Math.round((entry.value / totalContacts) * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {(() => {
          const dayMs = 24 * 60 * 60 * 1000;
          const nowTs = Date.now();
          const dealsByContactId = {};
          filteredData.filteredDeals.forEach((d) => {
            const cid = d.contact?._id || d.contact;
            if (!cid) return;
            if (!dealsByContactId[cid]) dealsByContactId[cid] = [];
            dealsByContactId[cid].push(d);
          });

          // Card 1: Contact Alerts — real, computed from contacts + their deals.
          const contactsWithAnyDeal = filteredData.filteredContacts.filter(
            (c) => dealsByContactId[c._id]?.length > 0,
          );
          const coldContacts = contactsWithAnyDeal.filter((c) =>
            dealsByContactId[c._id].every(
              (d) => nowTs - new Date(d.updatedAt || d.createdAt).getTime() > 30 * dayMs,
            ),
          );
          const coldPipeline = coldContacts.reduce(
            (sum, c) => sum + dealsByContactId[c._id].reduce((s, d) => s + (d.amount || 0), 0),
            0,
          );
          const followUpContacts = filteredData.filteredContacts.filter(
            (c) => c.stageStatus === "Contacted" || c.stageStatus === "New",
          );
          const followUpPipeline = followUpContacts.reduce(
            (sum, c) => sum + (dealsByContactId[c._id] || []).reduce((s, d) => s + (d.amount || 0), 0),
            0,
          );
          const noOwnerContacts = filteredData.filteredContacts.filter((c) => !c.user);
          const noOwnerPipeline = noOwnerContacts.reduce(
            (sum, c) => sum + (dealsByContactId[c._id] || []).reduce((s, d) => s + (d.amount || 0), 0),
            0,
          );
          const formatCrAlert = (v) => {
            if (v >= 1e7) return `₹${(v / 1e7).toFixed(1)} Cr`;
            if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`;
            if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}k`;
            return `₹${Math.round(v)}`;
          };
          const alertRows = [
            {
              icon: <AlertCircle className="w-4 h-4" />,
              iconBg: "#FCCCCD",
              iconColor: "#DF120B",
              title: `${coldContacts.length} Contacts going cold`,
              subtitle: `${formatCrAlert(coldPipeline)} associated pipeline has had no activity for 30+ days`,
            },
            {
              icon: <Clock className="w-4 h-4" />,
              iconBg: "rgba(255, 204, 0, 0.15)",
              iconColor: "#D4BF00",
              title: `${followUpContacts.length} Contacts awaiting follow-up`,
              subtitle: `${formatCrAlert(followUpPipeline)} associated pipeline still in early stages`,
            },
            {
              icon: <Users className="w-4 h-4" />,
              iconBg: "rgba(0, 133, 255, 0.1)",
              iconColor: "#0085FF",
              title: `${noOwnerContacts.length} Contacts with no owner`,
              subtitle: `${formatCrAlert(noOwnerPipeline)} associated pipeline is unassigned`,
            },
          ];

          // Card 2: Contacts by Industry (via linked company), with pipeline value.
          const industryGroups = {};
          filteredData.filteredContacts.forEach((c) => {
            const industry = c.company?.industry || "Unspecified";
            if (!industryGroups[industry]) industryGroups[industry] = { count: 0, pipeline: 0 };
            industryGroups[industry].count += 1;
            industryGroups[industry].pipeline += (dealsByContactId[c._id] || []).reduce(
              (s, d) => s + (d.amount || 0),
              0,
            );
          });
          const industryEntries = Object.entries(industryGroups)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 4);
          const industryMaxCount = Math.max(1, ...industryEntries.map(([, v]) => v.count));
          const industryColors = ["#0085FF", "#0C4FCD", "#2E7D32", "#D97706", "#E82222", "#00C950"];

          // Card 3: Recent Contact Activity — deals-with-contact events and
          // their invoices, merged into one timeline.
          const contactActivity = [];
          filteredData.filteredDeals
            .filter((d) => d.contact)
            .forEach((d) => {
              const at = d.updatedAt || d.createdAt;
              if (!at) return;
              contactActivity.push({
                id: `deal-${d._id}`,
                icon: <Briefcase className="w-4 h-4" />,
                iconBg: "#CCE7FF",
                iconColor: "#0085FF",
                title: d.title || "Deal",
                subtitle: `${d.status || "Update"} • ${formatCrAlert(d.amount || 0)}`,
                at,
              });
            });
          filteredData.filteredInvoices
            .filter((inv) => inv.deal?.contact)
            .forEach((inv) => {
              const at = inv.updatedAt || inv.date || inv.createdAt;
              if (!at) return;
              contactActivity.push({
                id: `invoice-${inv._id}`,
                icon: <FileText className="w-4 h-4" />,
                iconBg: "#FCCCCD",
                iconColor: "#EF0004",
                title: `Invoice #${inv.invoiceNumber}`,
                subtitle: `${inv.status} • ${formatCrAlert(inv.amount || 0)}`,
                at,
              });
            });
          const recentContactActivity = contactActivity
            .sort((a, b) => new Date(b.at) - new Date(a.at))
            .slice(0, 6);

          return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
              {/* Contact Alerts */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm min-h-[320px] flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#1C1C1D]">Contact Alerts</h3>
                  <button
                    onClick={() => (window.location.href = "/contacts")}
                    className="text-xs font-semibold text-[#0085FF] hover:underline flex-shrink-0"
                  >
                    View All
                  </button>
                </div>
                <div className="flex flex-col gap-0 flex-1">
                  {alertRows.map((row, idx) => (
                    <div
                      key={row.title}
                      className={`flex items-center justify-between gap-3 py-3 ${
                        idx < alertRows.length - 1 ? "border-b border-[#E1E4EA]" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: row.iconBg }}
                        >
                          <span style={{ color: row.iconColor }}>{row.icon}</span>
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#525252] truncate">{row.title}</p>
                          <p className="text-[10px] text-[rgba(107,114,128,0.7)] truncate">
                            {row.subtitle}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contacts by Industry */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm min-h-[320px] flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#1C1C1D]">Contacts by Industry</h3>
                  <button
                    onClick={() => (window.location.href = "/companies")}
                    className="text-xs font-semibold text-[#0085FF] hover:underline flex-shrink-0"
                  >
                    View All
                  </button>
                </div>
                {industryEntries.length === 0 ? (
                  <p className="text-sm text-gray-400 py-10 text-center">No contacts yet</p>
                ) : (
                  <div className="flex flex-col gap-4 flex-1">
                    {industryEntries.map(([industry, data], idx) => (
                      <div key={industry} className="flex items-center gap-3">
                        <span
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: industryColors[idx % industryColors.length] + "22" }}
                        >
                          <Building
                            className="w-4 h-4"
                            style={{ color: industryColors[idx % industryColors.length] }}
                          />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#525252] truncate">{industry}</p>
                          <p className="text-[10px] text-[rgba(107,114,128,0.7)]">{data.count} Contacts</p>
                          <div className="h-1.5 bg-[rgba(0,133,255,0.2)] rounded-full mt-1.5 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(data.count / industryMaxCount) * 100}%`,
                                background: industryColors[idx % industryColors.length],
                              }}
                            />
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[10px] font-medium text-[#404040]">
                            {formatCrAlert(data.pipeline)}
                          </p>
                          <p className="text-[10px] text-[rgba(107,114,128,0.7)]">Pipeline Value</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Contact Activity */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm min-h-[320px] flex flex-col">
                <h3 className="text-sm font-semibold text-[#1C1C1D] mb-3">Recent Contact Activity</h3>
                {recentContactActivity.length === 0 ? (
                  <p className="text-sm text-gray-400 py-10 text-center">No recent activity</p>
                ) : (
                  <div className="flex flex-col gap-3 flex-1 overflow-y-auto dc-scroll-visible">
                    {recentContactActivity.map((item) => (
                      <div key={item.id} className="flex items-center gap-3">
                        <span
                          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: item.iconBg }}
                        >
                          <span style={{ color: item.iconColor }}>{item.icon}</span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[#1C1C1D] truncate">{item.title}</p>
                          <p className="text-[10px] text-[#78788D] truncate">{item.subtitle}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  const renderCompaniesReport = () => {
    // Calculate metrics
    const totalCompanies = filteredData.filteredCompanies.length;
    const companiesWithWebsite = filteredData.filteredCompanies.filter(
      (c) => c.website
    ).length;
    const companiesWithAddress = filteredData.filteredCompanies.filter(
      (c) => c.address
    ).length;
    const companiesWithIndustry = filteredData.filteredCompanies.filter(
      (c) => c.industry
    ).length;

    // Companies created this month
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const companiesThisMonth = filteredData.filteredCompanies.filter((c) => {
      const createdDate = new Date(c.createdAt);
      return (
        createdDate.getMonth() === currentMonth &&
        createdDate.getFullYear() === currentYear
      );
    }).length;

    // Industry distribution (top 5)
    const industryDistribution = filteredData.filteredCompanies
      .filter((c) => c.industry)
      .reduce((acc, company) => {
        acc[company.industry] = (acc[company.industry] || 0) + 1;
        return acc;
      }, {});

    const topIndustries = Object.entries(industryDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    // Location distribution (top 5 cities/regions)
    const locationDistribution = filteredData.filteredCompanies
      .filter((c) => c.address)
      .reduce((acc, company) => {
        // Extract city/region (you can customize this based on your address format)
        const location = company.address.split(",")[0].trim();
        acc[location] = (acc[location] || 0) + 1;
        return acc;
      }, {});

    const topLocations = Object.entries(locationDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    // Data completeness score
    const completenessScore = Math.round(
      ((companiesWithWebsite + companiesWithAddress + companiesWithIndustry) /
        (totalCompanies * 3)) *
        100
    );

    // KPI row — same StatCard pattern used on the Contacts tab.
    const companyIdsWithDeals = new Set(
      filteredData.filteredDeals.filter((d) => d.company).map((d) => d.company._id || d.company),
    );
    const activeCompanies = filteredData.filteredCompanies.filter((c) =>
      companyIdsWithDeals.has(c._id),
    ).length;
    const dealsWithCompany = filteredData.filteredDeals.filter((d) => d.company);
    const avgDealSizeCompanies =
      dealsWithCompany.length > 0
        ? dealsWithCompany.reduce((sum, d) => sum + (d.amount || 0), 0) / dealsWithCompany.length
        : 0;
    const wonDealsWithCompany = dealsWithCompany.filter((d) => d.status === "Won");
    const avgSalesCycleDays =
      wonDealsWithCompany.length > 0
        ? Math.round(
            wonDealsWithCompany.reduce((sum, d) => {
              const created = new Date(d.createdAt).getTime();
              const closed = new Date(d.updatedAt || d.createdAt).getTime();
              return sum + Math.max(0, (closed - created) / (24 * 60 * 60 * 1000));
            }, 0) / wonDealsWithCompany.length,
          )
        : 0;

    // Month-over-month trends for each KPI card, mirroring the Contacts tab.
    const lastMonthDateCo = new Date(currentYear, currentMonth - 1, 1);
    const lastMonthCo = lastMonthDateCo.getMonth();
    const lastMonthYearCo = lastMonthDateCo.getFullYear();
    const companiesBeforeThisMonth = filteredData.filteredCompanies.filter(
      (c) => new Date(c.createdAt) < new Date(currentYear, currentMonth, 1),
    ).length;
    const totalCompaniesChange =
      companiesBeforeThisMonth > 0
        ? Math.round((companiesThisMonth / companiesBeforeThisMonth) * 100)
        : totalCompanies > 0
        ? 100
        : 0;

    const dealsWithCompanyThisMonth = dealsWithCompany.filter((d) => {
      const created = new Date(d.createdAt);
      return created.getMonth() === currentMonth && created.getFullYear() === currentYear;
    });
    const dealsWithCompanyLastMonth = dealsWithCompany.filter((d) => {
      const created = new Date(d.createdAt);
      return created.getMonth() === lastMonthCo && created.getFullYear() === lastMonthYearCo;
    });
    const activeCompaniesChange =
      dealsWithCompanyLastMonth.length > 0
        ? Math.round(
            ((dealsWithCompanyThisMonth.length - dealsWithCompanyLastMonth.length) /
              dealsWithCompanyLastMonth.length) *
              100,
          )
        : dealsWithCompanyThisMonth.length > 0
        ? 100
        : 0;

    const companiesLastMonth = filteredData.filteredCompanies.filter((c) => {
      const created = new Date(c.createdAt);
      return created.getMonth() === lastMonthCo && created.getFullYear() === lastMonthYearCo;
    }).length;
    const newCompaniesChange =
      companiesLastMonth > 0
        ? Math.round(((companiesThisMonth - companiesLastMonth) / companiesLastMonth) * 100)
        : companiesThisMonth > 0
        ? 100
        : 0;

    const avgDealSizeThisMonth =
      dealsWithCompanyThisMonth.length > 0
        ? dealsWithCompanyThisMonth.reduce((sum, d) => sum + (d.amount || 0), 0) /
          dealsWithCompanyThisMonth.length
        : 0;
    const avgDealSizeLastMonth =
      dealsWithCompanyLastMonth.length > 0
        ? dealsWithCompanyLastMonth.reduce((sum, d) => sum + (d.amount || 0), 0) /
          dealsWithCompanyLastMonth.length
        : 0;
    const avgDealSizeChange =
      avgDealSizeLastMonth > 0
        ? Math.round(((avgDealSizeThisMonth - avgDealSizeLastMonth) / avgDealSizeLastMonth) * 100)
        : avgDealSizeThisMonth > 0
        ? 100
        : 0;

    const wonThisMonth = wonDealsWithCompany.filter((d) => {
      const closed = new Date(d.updatedAt || d.createdAt);
      return closed.getMonth() === currentMonth && closed.getFullYear() === currentYear;
    });
    const wonLastMonth = wonDealsWithCompany.filter((d) => {
      const closed = new Date(d.updatedAt || d.createdAt);
      return closed.getMonth() === lastMonthCo && closed.getFullYear() === lastMonthYearCo;
    });
    const cycleFor = (deals) =>
      deals.length > 0
        ? deals.reduce((sum, d) => {
            const created = new Date(d.createdAt).getTime();
            const closed = new Date(d.updatedAt || d.createdAt).getTime();
            return sum + Math.max(0, (closed - created) / (24 * 60 * 60 * 1000));
          }, 0) / deals.length
        : 0;
    const cycleThisMonth = cycleFor(wonThisMonth);
    const cycleLastMonth = cycleFor(wonLastMonth);
    // Shorter sales cycle is an improvement, so invert the sign.
    const salesCycleChange =
      cycleLastMonth > 0
        ? Math.round(((cycleLastMonth - cycleThisMonth) / cycleLastMonth) * 100)
        : 0;

    const companySourceColors = ["#0085FF", "#34C759", "#8E62EF", "#2A2726", "#D97706", "#EC4899"];
    const companySourceData = topIndustries.map(([industry, count], idx) => ({
      name: industry,
      value: count,
      color: companySourceColors[idx % companySourceColors.length],
    }));
    // "Other" covers every industry outside the top 5 (plus companies with
    // no industry set at all), so the chart reflects every company instead
    // of silently dropping the long tail.
    const topIndustriesSum = topIndustries.reduce((sum, [, count]) => sum + count, 0);
    const otherIndustriesCount = totalCompanies - topIndustriesSum;
    if (otherIndustriesCount > 0) {
      companySourceData.push({
        name: "Other",
        value: otherIndustriesCount,
        color: "#E7E4E3",
      });
    }
    // Percentages are relative to the shown segments (top-5 + Other), which
    // now cover every company, so they sum to a true 100%.
    const companySourceTotal = Math.max(
      1,
      companySourceData.reduce((sum, entry) => sum + entry.value, 0),
    );

    // Deal Velocity by Company — one bubble per company: X = avg deal
    // size, Y = avg deal age in days (time since each deal was opened —
    // using every deal rather than only Won ones, since Won-only cycle
    // time is mostly same-day in this dataset and wouldn't show any real
    // spread), bubble size = total Won revenue generated by that company.
    const dealsByCompanyId = {};
    filteredData.filteredDeals.forEach((d) => {
      const cid = d.company?._id || d.company;
      if (!cid) return;
      if (!dealsByCompanyId[cid]) dealsByCompanyId[cid] = [];
      dealsByCompanyId[cid].push(d);
    });
    const velocityNow = Date.now();
    const velocityPoints = Object.entries(dealsByCompanyId)
      .map(([companyId, deals]) => {
        const company = filteredData.filteredCompanies.find((c) => c._id === companyId);
        const avgDealSize =
          deals.reduce((sum, d) => sum + (d.amount || 0), 0) / deals.length;
        const avgAgeDays =
          deals.reduce((sum, d) => {
            const created = new Date(d.createdAt).getTime();
            return sum + Math.max(0, (velocityNow - created) / (24 * 60 * 60 * 1000));
          }, 0) / deals.length;
        const wonForCompany = deals.filter((d) => d.status === "Won");
        const revenue = wonForCompany.reduce((sum, d) => sum + (d.amount || 0), 0);
        return {
          name: company?.name || "Unknown",
          cycle: Math.round(avgAgeDays),
          dealSize: Math.round(avgDealSize),
          revenue,
        };
      })
      .filter((p) => p.dealSize > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 15);
    // Give every bubble a visible minimum size, then scale up by revenue
    // share — a company with zero Won revenue still renders as a small
    // dot instead of disappearing or looking identical to the rest.
    const velocityRevenueMax = Math.max(1, ...velocityPoints.map((p) => p.revenue));
    velocityPoints.forEach((p) => {
      p.bubbleSize = 50 + Math.round((p.revenue / velocityRevenueMax) * 1800);
    });

    // Top Revenue Generating Companies — total revenue per company across
    // Won deals + invoiced amounts, ranked descending.
    const revenueByCompanyId = {};
    filteredData.filteredDeals.forEach((d) => {
      if (d.status !== "Won") return;
      const cid = d.company?._id || d.company;
      if (!cid) return;
      revenueByCompanyId[cid] = (revenueByCompanyId[cid] || 0) + (d.amount || 0);
    });
    filteredData.filteredInvoices.forEach((inv) => {
      // Invoices don't carry a company reference directly — only their deal,
      // whose `company` field is an unpopulated ObjectId string.
      const dealCompany = inv.deal?.company;
      const cid = dealCompany?._id || dealCompany;
      if (!cid) return;
      revenueByCompanyId[cid] = (revenueByCompanyId[cid] || 0) + (inv.amount || 0);
    });
    // Pipeline Contribution by Company — Open pipeline value (blue) vs Won
    // pipeline value (green) per company, ranked by combined total.
    const pipelineByCompanyId = {};
    Object.entries(dealsByCompanyId).forEach(([companyId, deals]) => {
      const open = deals
        .filter((d) => d.status !== "Won" && d.status !== "Lost")
        .reduce((sum, d) => sum + (d.amount || 0), 0);
      const won = deals
        .filter((d) => d.status === "Won")
        .reduce((sum, d) => sum + (d.amount || 0), 0);
      pipelineByCompanyId[companyId] = { open, won };
    });
    const pipelineContributionData = Object.entries(pipelineByCompanyId)
      .map(([companyId, { open, won }]) => {
        const company =
          filteredData.filteredCompanies.find((c) => String(c._id) === String(companyId)) ||
          companies.find((c) => String(c._id) === String(companyId));
        return { name: company?.name || "Unknown", open, won, total: open + won };
      })
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    const pipelineContributionMax = Math.max(1, ...pipelineContributionData.map((c) => c.total));

    const topRevenueColors = ["#0085FF", "#34C759", "#8E62EF", "#2A2726", "#D97706", "#FC9C32"];
    const topRevenueCompaniesAll = Object.entries(revenueByCompanyId)
      .map(([companyId, revenue]) => {
        // Fall back to the unfiltered `companies` list — a company can be
        // excluded from `filteredCompanies` by the date-range filter while
        // still having deals/invoices in range, which would otherwise show
        // as "Unknown".
        const company =
          filteredData.filteredCompanies.find((c) => String(c._id) === String(companyId)) ||
          companies.find((c) => String(c._id) === String(companyId));
        // "Last active" = most recent deal touch for this company, not the
        // company record's own updatedAt (which barely changes).
        const companyDeals = dealsByCompanyId[companyId] || [];
        const lastActiveTime = Math.max(
          0,
          ...companyDeals.map((d) => new Date(d.updatedAt || d.createdAt).getTime()),
        );
        const activeDeals = companyDeals.filter(
          (d) => d.status !== "Won" && d.status !== "Lost",
        ).length;
        return {
          name: company?.name || "Unknown",
          industry: company?.industry || "—",
          lastActive: lastActiveTime > 0 ? new Date(lastActiveTime) : null,
          activeDeals,
          revenue,
        };
      })
      .filter((c) => c.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .map((c, idx) => ({ ...c, color: topRevenueColors[idx % topRevenueColors.length] }));

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Total Companies"
            value={totalCompanies}
            icon={<Building className="w-6 h-6" />}
            color="text-blue-600"
            change={totalCompaniesChange}
            changeLabel="growth this month"
          />
          <StatCard
            title="Active Companies"
            value={activeCompanies}
            icon={<Briefcase className="w-6 h-6" />}
            color="text-green-600"
            change={activeCompaniesChange}
            changeLabel="active deals vs last month"
          />
          <StatCard
            title="New This Month"
            value={companiesThisMonth}
            icon={<TrendingUp className="w-6 h-6" />}
            color="text-purple-600"
            change={newCompaniesChange}
            changeLabel="vs last month"
          />
          <StatCard
            title="Avg. Deal Size"
            value={`₹${formatNumberToIndian(Math.round(avgDealSizeCompanies))}`}
            icon={<IndianRupee className="w-6 h-6" />}
            color="text-emerald-600"
            change={avgDealSizeChange}
            changeLabel="vs last month"
          />
          <StatCard
            title="Avg. Sales Cycle"
            value={`${avgSalesCycleDays}d`}
            icon={<Clock className="w-6 h-6" />}
            color="text-orange-600"
            change={salesCycleChange}
            changeLabel="faster vs last month"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 items-stretch">
        {/* Deal Velocity by Company */}
        <div className="bg-white p-5 rounded-xl border border-[#E7E4E3] shadow-sm">
          <h3 className="text-sm font-semibold text-[#0E121B]">Deal Velocity by Company</h3>
          <p className="text-xs text-[#525866] mt-1">Analyse average deal size vs sales cycle</p>
          <p className="text-[10px] text-[#525866] text-center mt-1">
            Bubble Size = Revenue Generated
          </p>
          {velocityPoints.length === 0 ? (
            <p className="text-sm text-gray-400 py-16 text-center">No won deals with companies yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(31,41,55,0.1)" />
                <XAxis
                  dataKey="dealSize"
                  type="number"
                  name="Deal Size"
                  tickFormatter={(v) => (v === 0 ? "₹0" : `₹${(v / 1000).toFixed(0)}k`)}
                  tick={{ fontSize: 10, fill: "#1F2937" }}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(31,41,55,0.3)" }}
                />
                <YAxis
                  dataKey="cycle"
                  type="number"
                  name="Sales Cycle"
                  unit=" Days"
                  tick={{ fontSize: 10, fill: "#1F2937" }}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(31,41,55,0.3)" }}
                  width={50}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const p = payload[0].payload;
                    return (
                      <div className="bg-white border border-gray-200 rounded-md shadow-lg p-2 text-xs">
                        <p className="font-medium text-gray-900">{p.name}</p>
                        <p className="text-gray-500">
                          {p.cycle}d avg age • ₹{formatNumberToIndian(p.dealSize)} avg deal
                        </p>
                        <p className="text-gray-500">₹{formatNumberToIndian(p.revenue)} revenue</p>
                      </div>
                    );
                  }}
                />
                <Scatter
                  data={velocityPoints}
                  shape={(props) => {
                    const { cx, cy, payload } = props;
                    const radius = Math.sqrt((payload.bubbleSize || 60) / Math.PI);
                    return (
                      <circle cx={cx} cy={cy} r={radius} fill="#0085FF" fillOpacity={0.75} />
                    );
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Companies by Industry — same size/style/proportion as the
            Contacts tab's Contact Acquisition Sources donut (1fr of a
            2fr_1fr grid). */}
        <div className="bg-white p-5 rounded-xl border border-[#E7E4E3] shadow-sm">
          <h3 className="text-sm font-semibold text-[#0E121B]">Companies by Industry</h3>
          <p className="text-xs text-[#525866] mt-1">Where your companies are concentrated</p>
          {totalCompanies === 0 || companySourceData.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">No companies yet</p>
          ) : (
            <div className="flex items-center justify-between gap-4 mt-4 flex-wrap">
              <div className="relative flex-shrink-0" style={{ width: 220, height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={companySourceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={68}
                      outerRadius={108}
                      cornerRadius={8}
                      paddingAngle={companySourceData.length > 1 ? 4 : 0}
                      dataKey="value"
                      stroke="none"
                      label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
                        const RADIAN = Math.PI / 180;
                        const r = (innerRadius + outerRadius) / 2;
                        const x = cx + r * Math.cos(-midAngle * RADIAN);
                        const y = cy + r * Math.sin(-midAngle * RADIAN);
                        const pct = Math.round((value / companySourceTotal) * 100);
                        const text = `${pct}%`;
                        const w = text.length * 6 + 10;
                        return (
                          <g>
                            <rect x={x - w / 2} y={y - 8} width={w} height={16} rx={6} fill="#FFFFFF" />
                            <text
                              x={x}
                              y={y}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize={11}
                              fontWeight={500}
                              fill="#21201F"
                            >
                              {text}
                            </text>
                          </g>
                        );
                      }}
                      labelLine={false}
                    >
                      {companySourceData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                {companySourceData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ background: entry.color }}
                    />
                    <span className="text-xs text-[#21201F]/70 truncate min-w-[90px]">{entry.name}</span>
                    <span className="text-[11px] text-[#525866] text-right flex-shrink-0 w-8">
                      {Math.round((entry.value / companySourceTotal) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </div>

        {/* Placeholder row — content TBD */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4 items-stretch">
          {/* Pipeline Contribution by Company */}
          <div className="bg-white p-5 rounded-xl border border-[#E7E4E3] shadow-sm min-h-[400px] flex flex-col">
            <div>
              <h3 className="text-sm font-semibold text-[#0E121B]">Pipeline Contribution by Company</h3>
              <p className="text-xs text-[#525866] mt-1">Open and Won deal value by company</p>
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-2 rounded-full" style={{ background: "#0085FF" }} />
                <span className="text-xs text-[#21201F]/70">Open</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-2 rounded-full" style={{ background: "#34C759" }} />
                <span className="text-xs text-[#21201F]/70">Won</span>
              </div>
            </div>
            {pipelineContributionData.length === 0 ? (
              <p className="text-sm text-gray-400 py-16 text-center">No pipeline data yet</p>
            ) : (
              <div className="flex flex-col flex-1 justify-around mt-2">
                {pipelineContributionData.map((c, idx) => {
                  const openPct = Math.max(c.open > 0 ? 8 : 0, Math.round((c.open / pipelineContributionMax) * 100));
                  const wonPct = Math.max(c.won > 0 ? 8 : 0, Math.round((c.won / pipelineContributionMax) * 100));
                  return (
                    <div
                      key={c.name + idx}
                      className="flex items-center justify-between gap-3 py-2.5 border-b border-[#E7E7E9] last:border-b-0"
                    >
                      <span className="text-xs text-[#1F1F21] w-28 truncate flex-shrink-0">{c.name}</span>
                      <div className="flex items-center flex-1">
                        {c.open > 0 && (
                          <div
                            className="h-[15px] rounded-lg flex items-center justify-center overflow-hidden"
                            style={{ width: `${openPct}%`, background: "#0085FF" }}
                          >
                            <span className="text-[8px] font-medium text-white px-1 truncate">
                              ₹{formatNumberToIndian(c.open)}
                            </span>
                          </div>
                        )}
                        {c.won > 0 && (
                          <div
                            className="h-[15px] rounded-lg flex items-center justify-center overflow-hidden ml-1"
                            style={{ width: `${wonPct}%`, background: "#34C759" }}
                          >
                            <span className="text-[8px] font-medium text-white px-1 truncate">
                              ₹{formatNumberToIndian(c.won)}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-medium text-[#1F1F21] w-20 text-right flex-shrink-0">
                        ₹{formatNumberToIndian(c.total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top Revenue Generating Companies */}
          {(() => {
            const pageRows = topRevenueCompaniesAll.slice(0, 5);
            return (
              <div className="bg-white p-5 rounded-xl border border-[#E7E4E3] shadow-sm min-h-[400px] flex flex-col">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#0E121B]">Top Revenue Generating Companies</h3>
                    <p className="text-xs text-[#525866] mt-1">Companies ranked by total revenue (Won + Invoiced)</p>
                  </div>
                  <button
                    onClick={() => setActiveTab("companies")}
                    className="text-[10px] text-[#0085FF] underline flex-shrink-0"
                  >
                    View All Companies
                  </button>
                </div>
                {topRevenueCompaniesAll.length === 0 ? (
                  <p className="text-sm text-gray-400 py-16 text-center">No revenue data yet</p>
                ) : (
                  <>
                    <div
                      className="grid items-center mt-4 pb-2 border-b border-[#E7E7E9] text-[11px] font-medium text-[#525866]"
                      style={{ gridTemplateColumns: "24px minmax(0,220px) minmax(30px,1fr) 160px 32px 90px 32px 80px 32px 110px" }}
                    >
                      <span>#</span>
                      <span>Company</span>
                      <span />
                      <span>Industry</span>
                      <span />
                      <span>Last Active</span>
                      <span />
                      <span>Active Deals</span>
                      <span />
                      <span className="text-right">Revenue</span>
                    </div>
                    <div className="flex flex-col flex-1 justify-around">
                      {pageRows.map((c, idx) => (
                        <div
                          key={c.name + idx}
                          className="grid items-center py-5 border-b border-[#E7E7E9] last:border-b-0"
                          style={{ gridTemplateColumns: "24px minmax(0,220px) minmax(30px,1fr) 160px 32px 90px 32px 80px 32px 110px" }}
                        >
                          <span className="text-xs text-[#525866]">{idx + 1}</span>
                          <span className="flex items-center min-w-0">
                            <span className="text-xs text-[#1F1F21] truncate">{c.name}</span>
                          </span>
                          <span />
                          <span className="text-xs text-[#525866] pr-2">{c.industry}</span>
                          <span />
                          <span className="text-xs text-[#525866]">
                            {c.lastActive
                              ? c.lastActive.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                              : "—"}
                          </span>
                          <span />
                          <span className="text-xs text-[#525866]">{c.activeDeals}</span>
                          <span />
                          <span className="text-xs font-medium text-[#1F1F21] text-right">
                            ₹{formatNumberToIndian(c.revenue)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    );
  };

  const renderDealsReport = () => {
    // Calculate basic metrics
    const totalDeals = filteredData.filteredDeals.length;
    const totalValue = filteredData.filteredDeals.reduce(
      (sum, deal) => sum + (deal.amount || 0),
      0
    );
    const averageDealValue = totalValue / totalDeals || 0;

    // State for user filter

    // Status distribution
    const statusDistribution = filteredData.filteredDeals.reduce(
      (acc, deal) => {
        const status = deal.status || "Unknown";
        acc[status] = acc[status] || { count: 0, amount: 0 };
        acc[status].count += 1;
        acc[status].amount += deal.amount || 0;
        return acc;
      },
      {}
    );

    // Won, Lost, Open deals
    const wonDeals = filteredData.filteredDeals.filter(
      (d) => d.status === "Won"
    );
    const lostDeals = filteredData.filteredDeals.filter(
      (d) => d.status === "Lost"
    );
    const openDeals = filteredData.filteredDeals.filter(
      (d) => d.status !== "Won" && d.status !== "Lost"
    );

    const wonValue = wonDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
    const lostValue = lostDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
    const openValue = openDeals.reduce((sum, d) => sum + (d.amount || 0), 0);

    // Conversion metrics
    const totalClosedDeals = wonDeals.length + lostDeals.length;
    const winRate =
      totalClosedDeals > 0 ? (wonDeals.length / totalClosedDeals) * 100 : 0;
    const lossRate =
      totalClosedDeals > 0 ? (lostDeals.length / totalClosedDeals) * 100 : 0;

    // Deals this month
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const dealsThisMonth = filteredData.filteredDeals.filter((d) => {
      const createdDate = new Date(d.createdAt);
      return (
        createdDate.getMonth() === currentMonth &&
        createdDate.getFullYear() === currentYear
      );
    });
    const dealsThisMonthCount = dealsThisMonth.length;
    const dealsThisMonthValue = dealsThisMonth.reduce(
      (sum, d) => sum + (d.amount || 0),
      0
    );

    // User-wise analysis
    const userDeals = filteredData.filteredDeals.reduce((acc, deal) => {
      const userId = deal.user?._id;
      const userName = deal.user?.name || "Unknown User";

      if (!acc[userId]) {
        acc[userId] = {
          id: userId,
          name: userName,
          totalDeals: 0,
          wonDeals: 0,
          lostDeals: 0,
          openDeals: 0,
          totalValue: 0,
          wonValue: 0,
          lostValue: 0,
          openValue: 0,
        };
      }

      acc[userId].totalDeals += 1;
      acc[userId].totalValue += deal.amount || 0;

      if (deal.status === "Won") {
        acc[userId].wonDeals += 1;
        acc[userId].wonValue += deal.amount || 0;
      } else if (deal.status === "Lost") {
        acc[userId].lostDeals += 1;
        acc[userId].lostValue += deal.amount || 0;
      } else {
        acc[userId].openDeals += 1;
        acc[userId].openValue += deal.amount || 0;
      }

      return acc;
    }, {});

    const userStats = Object.values(userDeals)
      .map((user) => ({
        ...user,
        conversionRate:
          user.wonDeals + user.lostDeals > 0
            ? (user.wonDeals / (user.wonDeals + user.lostDeals)) * 100
            : 0,
      }))
      .sort((a, b) => b.totalValue - a.totalValue);

    // Get unique users for dropdown
    const uniqueUsers = userStats.map((user) => ({
      id: user.id,
      name: user.name,
    }));

    // Top companies by deal value
    const companyDeals = filteredData.filteredDeals
      .filter((d) => d.company?.name)
      .reduce((acc, deal) => {
        const companyName = deal.company.name;
        acc[companyName] = acc[companyName] || { count: 0, amount: 0, won: 0 };
        acc[companyName].count += 1;
        acc[companyName].amount += deal.amount || 0;
        if (deal.status === "Won") acc[companyName].won += 1;
        return acc;
      }, {});

    const topCompanies = Object.entries(companyDeals)
      .sort(([, a], [, b]) => b.amount - a.amount)
      .slice(0, 5);

    // Largest deals
    const largestDeals = [...filteredData.filteredDeals]
      .sort((a, b) => (b.amount || 0) - (a.amount || 0))
      .slice(0, 5);

    // Chart data for deal status pie chart
    const dealStatusChartData = Object.entries(statusDistribution)
      .map(([status, data]) => ({
        name: status,
        value: data.count,
        amount: data.amount,
        color:
          status === "Won"
            ? "#10b981"
            : status === "Lost"
            ? "#ef4444"
            : status === "Negotiation"
            ? "#f59e0b"
            : status === "Open"
            ? "#3b82f6"
            : "#6b7280",
      }))
      .filter((item) => item.value > 0);

    // Chart data for user performance - filtered
    const userPerformanceChartData = (() => {
      if (selectedUser === "all") {
        // Show top 10 users when "All Users" is selected
        return userStats.slice(0, 10).map((user) => ({
          name: user.name.split(" ")[0],
          Total: user.totalDeals,
          Won: user.wonDeals,
          Lost: user.lostDeals,
          Open: user.openDeals,
        }));
      } else {
        // Show only selected user
        const user = userStats.find((u) => u.id === selectedUser);
        if (!user) return [];
        return [
          {
            name: user.name.split(" ")[0],
            Total: user.totalDeals,
            Won: user.wonDeals,
            Lost: user.lostDeals,
            Open: user.openDeals,
          },
        ];
      }
    })();

    return (
      <div className="space-y-6">
        {/* Header with Actions */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900">
            Deals Insights
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => (window.location.href = "/deals")}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Briefcase className="w-4 h-4" />
              View All Deals
            </button>
            <button
              onClick={() => exportToPDF("Deals")}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Deals */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Deals</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {totalDeals}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Total Value */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Pipeline Value
                </p>
                <h6 className="text-3xl font-bold text-gray-900 mt-2">
                  ₹{formatNumberToIndian(totalValue)}
                </h6>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <IndianRupeeIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Average Deal Value */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Average Deal Size
                </p>
                <h6 className="text-3xl font-bold text-gray-900 mt-2">
                  ₹{formatNumberToIndian(Math.round(averageDealValue))}
                </h6>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          {/* Win Rate */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Win Rate</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {winRate.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {wonDeals.length} won / {totalClosedDeals} closed
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Target className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Won, Lost, Open Deals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Won Deals */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-green-600 rounded-lg flex items-center justify-center">
                <Trophy className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-700">Won Deals</p>
                <p className="text-3xl font-bold text-green-900 mt-1">
                  {wonDeals.length}
                </p>
                <h6 className="text-sm text-green-600 mt-1">
                  ₹{formatNumberToIndian(wonValue)} •{" "}
                  {((wonValue / totalValue) * 100).toFixed(1)}% of value
                </h6>
              </div>
            </div>
          </div>

          {/* Open Deals */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-600 rounded-lg flex items-center justify-center">
                <Clock className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-700">Open Deals</p>
                <p className="text-3xl font-bold text-blue-900 mt-1">
                  {openDeals.length}
                </p>
                <h6 className="text-sm text-blue-600 mt-1">
                  ₹{formatNumberToIndian(openValue)} •{" "}
                  {((openValue / totalValue) * 100).toFixed(1)}% of value
                </h6>
              </div>
            </div>
          </div>

          {/* Lost Deals */}
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg border border-red-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-red-600 rounded-lg flex items-center justify-center">
                <XCircle className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-700">Lost Deals</p>
                <p className="text-3xl font-bold text-red-900 mt-1">
                  {lostDeals.length}
                </p>
                <h6 className="text-sm text-red-600 mt-1">
                  ₹{formatNumberToIndian(lostValue)} • {lossRate.toFixed(1)}%
                  loss rate
                </h6>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Deal Status Distribution */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">
                Deal Status Distribution
              </h3>
              <PieChartIcon className="w-5 h-5 text-gray-400" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dealStatusChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dealStatusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name, props) => [
                    `${value} deals (₹${formatNumberToIndian(
                      props.payload.amount
                    )})`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* User Performance Chart with Filter */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">
                Deals by User
              </h3>
              <div className="flex items-center gap-3">
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="all">All Users (Top 10)</option>
                  {uniqueUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
                <BarChart3 className="w-5 h-5 text-gray-400" />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={userPerformanceChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Won" fill="#10b981" />
                <Bar dataKey="Open" fill="#3b82f6" />
                <Bar dataKey="Lost" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* User Performance Table */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Sales Performance by User
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Total Deals
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Won
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Open
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Lost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Total Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Won Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Conversion Rate
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {userStats.map((user, index) => (
                  <tr
                    key={index}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                      {user.totalDeals}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">
                      {user.wonDeals}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-semibold">
                      {user.openDeals}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-semibold">
                      {user.lostDeals}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                      <h6>₹{formatNumberToIndian(user.totalValue)}</h6>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">
                      <h6>₹{formatNumberToIndian(user.wonValue)}</h6>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-2 w-20">
                          <div
                            className="bg-green-600 h-full rounded-full transition-all duration-300"
                            style={{ width: `${user.conversionRate}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-gray-900">
                          {user.conversionRate.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Companies */}
          {topCompanies.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Top Companies by Deal Value
              </h3>
              <div className="space-y-3">
                {topCompanies.map(([companyName, data], index) => (
                  <div
                    key={companyName}
                    className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-sm font-bold text-white">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {companyName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {data.count} deals • {data.won} won
                      </p>
                    </div>
                    <div className="text-right">
                      <h6 className="text-sm font-bold text-gray-900">
                        ₹{formatNumberToIndian(data.amount)}
                      </h6>
                      <p className="text-xs text-gray-500">
                        {((data.amount / totalValue) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Largest Deals */}
          {largestDeals.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Largest Deals
              </h3>
              <div className="space-y-3">
                {largestDeals.map((deal, index) => (
                  <div
                    key={deal._id}
                    className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-sm font-bold text-white">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {deal.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {deal.company?.name || "No company"} • {deal.user?.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <h6 className="text-sm font-bold text-gray-900">
                        ₹{formatNumberToIndian(deal.amount || 0)}
                      </h6>
                      <div className="mt-1">{getStatusBadge(deal.status)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* This Month Summary */}
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg border border-indigo-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Calendar className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-indigo-700">
                Deals Created This Month
              </p>
              <p className="text-3xl font-bold text-indigo-900 mt-1">
                {dealsThisMonthCount} Deals
              </p>
              <p className="text-sm text-indigo-600 mt-1">
                Total Value:
                <h6>₹{formatNumberToIndian(dealsThisMonthValue)}</h6> •{" "}
                {((dealsThisMonthCount / totalDeals) * 100).toFixed(1)}% of all
                deals
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderVendorsReport = () => {
    // Calculate metrics
    const totalVendors = filteredData.filteredVendors.length;
    const vendorsWithEmail = filteredData.filteredVendors.filter(
      (v) => v.email
    ).length;
    const vendorsWithPhone = filteredData.filteredVendors.filter(
      (v) => v.phone
    ).length;
    const vendorsWithGSTIN = filteredData.filteredVendors.filter(
      (v) => v.gstin
    ).length;
    const vendorsWithCompany = filteredData.filteredVendors.filter(
      (v) => v.company
    ).length;

    // Financial metrics
    const totalBalance = filteredData.filteredVendors.reduce(
      (sum, v) => sum + (v.balance || 0),
      0
    );
    const averageBalance = totalBalance / totalVendors;
    const vendorsWithPositiveBalance = filteredData.filteredVendors.filter(
      (v) => (v.balance || 0) > 0
    ).length;
    const vendorsWithNegativeBalance = filteredData.filteredVendors.filter(
      (v) => (v.balance || 0) < 0
    ).length;
    const vendorsWithZeroBalance = filteredData.filteredVendors.filter(
      (v) => (v.balance || 0) === 0
    ).length;

    // Vendors created this month
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const vendorsThisMonth = filteredData.filteredVendors.filter((v) => {
      const createdDate = new Date(v.createdAt);
      return (
        createdDate.getMonth() === currentMonth &&
        createdDate.getFullYear() === currentYear
      );
    }).length;

    // Top vendors by balance
    const topVendorsByBalance = [...filteredData.filteredVendors]
      .sort((a, b) => (b.balance || 0) - (a.balance || 0))
      .slice(0, 5);

    // Company distribution (top 5)
    const companyDistribution = filteredData.filteredVendors
      .filter((v) => v.company)
      .reduce((acc, vendor) => {
        acc[vendor.company] = (acc[vendor.company] || 0) + 1;
        return acc;
      }, {});

    const topCompanies = Object.entries(companyDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    // Data completeness score
    const completenessScore = Math.round(
      ((vendorsWithEmail +
        vendorsWithPhone +
        vendorsWithGSTIN +
        vendorsWithCompany) /
        (totalVendors * 4)) *
        100
    );

    return (
      <div className="space-y-6">
        {/* Header with Actions */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900">
            Vendors Insights
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => (window.location.href = "/vendors")}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              View All Vendors
            </button>
            <button
              onClick={() => exportToPDF("Vendors")}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Vendors */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Vendors
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {totalVendors}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Total Outstanding */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Outstanding
                </p>
                <h6 className="text-3xl font-bold text-gray-900 mt-2">
                  ₹{formatNumberToIndian(totalBalance)}
                </h6>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <IndianRupeeIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Average Balance */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Average Balance
                </p>
                <h6 className="text-3xl font-bold text-gray-900 mt-2">
                  ₹{formatNumberToIndian(Math.round(averageBalance))}
                </h6>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          {/* New This Month */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  New This Month
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {vendorsThisMonth}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* With GSTIN */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">With GSTIN</p>
                <p className="text-2xl font-bold text-gray-900">
                  {vendorsWithGSTIN}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {((vendorsWithGSTIN / totalVendors) * 100).toFixed(1)}% of
                  total
                </p>
              </div>
            </div>
          </div>

          {/* With Email */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-pink-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">With Email</p>
                <p className="text-2xl font-bold text-gray-900">
                  {vendorsWithEmail}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {((vendorsWithEmail / totalVendors) * 100).toFixed(1)}% of
                  total
                </p>
              </div>
            </div>
          </div>

          {/* With Phone */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                <Phone className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">With Phone</p>
                <p className="text-2xl font-bold text-gray-900">
                  {vendorsWithPhone}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {((vendorsWithPhone / totalVendors) * 100).toFixed(1)}% of
                  total
                </p>
              </div>
            </div>
          </div>

          {/* Data Completeness */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Data Completeness
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {completenessScore}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Based on key fields
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Balance Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Balance Distribution
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">
                    Positive Balance
                  </p>
                  <p className="text-2xl font-bold text-green-900 mt-1">
                    {vendorsWithPositiveBalance}
                  </p>
                </div>
                <div className="w-10 h-10 bg-green-200 rounded-lg flex items-center justify-center">
                  <ArrowUp className="w-5 h-5 text-green-700" />
                </div>
              </div>
              <p className="text-xs text-green-600 mt-2">
                {((vendorsWithPositiveBalance / totalVendors) * 100).toFixed(1)}
                % of vendors
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    Zero Balance
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {vendorsWithZeroBalance}
                  </p>
                </div>
                <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                  <Minus className="w-5 h-5 text-gray-700" />
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {((vendorsWithZeroBalance / totalVendors) * 100).toFixed(1)}% of
                vendors
              </p>
            </div>

            {/* <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700">Negative Balance</p>
                <p className="text-2xl font-bold text-red-900 mt-1">{vendorsWithNegativeBalance}</p>
              </div>
              <div className="w-10 h-10 bg-red-200 rounded-lg flex items-center justify-center">
                <ArrowDown className="w-5 h-5 text-red-700" />
              </div>
            </div>
            <p className="text-xs text-red-600 mt-2">
              {((vendorsWithNegativeBalance / totalVendors) * 100).toFixed(1)}% of vendors
            </p>
          </div> */}
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Vendors by Outstanding Balance */}
          {topVendorsByBalance.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Top Vendors by Balance
              </h3>
              <div className="space-y-3">
                {topVendorsByBalance.map((vendor, index) => (
                  <div
                    key={vendor._id}
                    className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-sm font-bold text-white">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {vendor.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {vendor.company || "No company"}
                      </p>
                    </div>
                    <div className="text-right">
                      <h6 className="text-sm font-bold text-gray-900">
                        ₹{formatNumberToIndian(vendor.balance || 0)}
                      </h6>
                      {vendor.gstin && (
                        <p className="text-xs text-gray-500 font-mono">
                          {vendor.gstin}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Companies */}
          {topCompanies.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Vendors by Company
              </h3>
              <div className="space-y-3">
                {topCompanies.map(([company, count], index) => (
                  <div key={company} className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-sm font-bold text-white">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {company}
                      </p>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden mt-2">
                        <div
                          className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${(count / totalVendors) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 min-w-[70px] text-right">
                      {count} vendors
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Data Quality Overview */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Data Quality Overview
          </h3>
          <div className="space-y-4">
            {/* Email Coverage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  Email Information
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {vendorsWithEmail} / {totalVendors} (
                  {((vendorsWithEmail / totalVendors) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-pink-600 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${(vendorsWithEmail / totalVendors) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Phone Coverage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  Phone Information
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {vendorsWithPhone} / {totalVendors} (
                  {((vendorsWithPhone / totalVendors) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-teal-600 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${(vendorsWithPhone / totalVendors) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* GSTIN Coverage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  GSTIN Information
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {vendorsWithGSTIN} / {totalVendors} (
                  {((vendorsWithGSTIN / totalVendors) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${(vendorsWithGSTIN / totalVendors) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Company Coverage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Building className="w-4 h-4 text-gray-400" />
                  Company Information
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {vendorsWithCompany} / {totalVendors} (
                  {((vendorsWithCompany / totalVendors) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-purple-600 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${(vendorsWithCompany / totalVendors) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPurchaseOrdersReport = () => {
    // Calculate metrics
    const totalPOs = filteredData.filteredPurchaseOrders.length;
    const totalAmount = filteredData.filteredPurchaseOrders.reduce(
      (sum, po) => sum + (po.totalAmount || 0),
      0
    );
    const averagePOAmount = totalAmount / totalPOs || 0;

    // Status distribution
    const statusDistribution = filteredData.filteredPurchaseOrders.reduce(
      (acc, po) => {
        const status = po.status || "Unknown";
        acc[status] = acc[status] || { count: 0, amount: 0 };
        acc[status].count += 1;
        acc[status].amount += po.totalAmount || 0;
        return acc;
      },
      {}
    );

    // POs this month
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const posThisMonth = filteredData.filteredPurchaseOrders.filter((po) => {
      const orderDate = new Date(po.orderDate);
      return (
        orderDate.getMonth() === currentMonth &&
        orderDate.getFullYear() === currentYear
      );
    });
    const posThisMonthCount = posThisMonth.length;
    const posThisMonthAmount = posThisMonth.reduce(
      (sum, po) => sum + (po.totalAmount || 0),
      0
    );

    // POs this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const posThisWeek = filteredData.filteredPurchaseOrders.filter(
      (po) => new Date(po.orderDate) >= oneWeekAgo
    ).length;

    // Pending/Active POs
    const pendingPOs = filteredData.filteredPurchaseOrders.filter(
      (po) =>
        po.status === "Pending" ||
        po.status === "Approved" ||
        po.status === "In Progress"
    );
    const pendingPOsCount = pendingPOs.length;
    const pendingPOsAmount = pendingPOs.reduce(
      (sum, po) => sum + (po.totalAmount || 0),
      0
    );

    // Top vendors by PO amount
    const vendorPOs = filteredData.filteredPurchaseOrders
      .filter((po) => po.vendor?.name)
      .reduce((acc, po) => {
        const vendorName = po.vendor.name;
        acc[vendorName] = acc[vendorName] || { count: 0, amount: 0 };
        acc[vendorName].count += 1;
        acc[vendorName].amount += po.totalAmount || 0;
        return acc;
      }, {});

    const topVendors = Object.entries(vendorPOs)
      .sort(([, a], [, b]) => b.amount - a.amount)
      .slice(0, 5);

    // Largest POs
    const largestPOs = [...filteredData.filteredPurchaseOrders]
      .sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0))
      .slice(0, 5);

    // Recent POs (last 10)
    const recentPOs = [...filteredData.filteredPurchaseOrders]
      .sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate))
      .slice(0, 5);

    // Monthly trend (last 6 months)
    const monthlyData = {};
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    filteredData.filteredPurchaseOrders.forEach((po) => {
      const date = new Date(po.orderDate);
      if (date >= sixMonthsAgo) {
        const monthKey = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`;
        monthlyData[monthKey] = monthlyData[monthKey] || {
          count: 0,
          amount: 0,
        };
        monthlyData[monthKey].count += 1;
        monthlyData[monthKey].amount += po.totalAmount || 0;
      }
    });

    const monthlyTrend = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6);

    return (
      <div className="space-y-6">
        {/* Header with Actions */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900">
            Purchase Orders Insights
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => (window.location.href = "/purchase-order")}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              View All Purchase Orders
            </button>
            <button
              onClick={() => exportToPDF("Purchase Orders")}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total POs */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Purchase Orders
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {totalPOs}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Total Amount */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total PO Amount
                </p>
                <h6 className="text-3xl font-bold text-gray-900 mt-2">
                  ₹{formatNumberToIndian(totalAmount)}
                </h6>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <IndianRupeeIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Average PO */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Average PO Value
                </p>
                <h6 className="text-3xl font-bold text-gray-900 mt-2">
                  ₹{formatNumberToIndian(Math.round(averagePOAmount))}
                </h6>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          {/* This Week */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Created This Week
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {posThisWeek}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* This Month & Pending Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-600 rounded-lg flex items-center justify-center">
                <ClipboardList className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-700">
                  POs This Month
                </p>
                <p className="text-3xl font-bold text-blue-900 mt-1">
                  {posThisMonthCount}
                </p>
                <p className="text-sm text-blue-600 mt-1 flex">
                  <h6>
                    ₹{formatNumberToIndian(posThisMonthAmount)} •{" "}
                    {((posThisMonthAmount / totalAmount) * 100).toFixed(1)}%
                  </h6>{" "}
                  of total
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg border border-yellow-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-yellow-600 rounded-lg flex items-center justify-center">
                <Clock className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-yellow-700">
                  Pending/Active POs
                </p>
                <p className="text-3xl font-bold text-yellow-900 mt-1">
                  {pendingPOsCount}
                </p>
                <p className="text-sm text-yellow-600 mt-1 flex">
                  <h6>
                    ₹{pendingPOsAmount.toLocaleString()} •{" "}
                    {((pendingPOsCount / totalPOs) * 100).toFixed(1)}%
                  </h6>{" "}
                  of total
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Purchase Order Status Overview
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(statusDistribution).map(([status, data]) => (
              <div
                key={status}
                className="bg-gray-50 rounded-lg p-4 border border-gray-200"
              >
                <div className="flex items-center justify-between mb-3">
                  {getStatusBadge(status)}
                  <span className="text-sm font-semibold text-gray-900">
                    {data.count} POs
                  </span>
                </div>
                <h6 className="text-2xl font-bold text-gray-900">
                  ₹{data.amount.toLocaleString()}
                </h6>
                <div className="mt-3 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${(data.amount / totalAmount) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  {((data.count / totalPOs) * 100).toFixed(1)}% of orders •{" "}
                  {((data.amount / totalAmount) * 100).toFixed(1)}% of value
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Vendors */}
          {topVendors.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Top Vendors by PO Value
              </h3>
              <div className="space-y-3">
                {topVendors.map(([vendorName, data], index) => (
                  <div
                    key={vendorName}
                    className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-sm font-bold text-white">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {vendorName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {data.count} purchase orders
                      </p>
                    </div>
                    <div className="text-right">
                      <h6 className="text-sm font-bold text-gray-900">
                        ₹{data.amount.toLocaleString()}
                      </h6>
                      <p className="text-xs text-gray-500">
                        {((data.amount / totalAmount) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Largest POs */}
          {largestPOs.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Largest Purchase Orders
              </h3>
              <div className="space-y-3">
                {largestPOs.map((po, index) => (
                  <div
                    key={po._id}
                    className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-sm font-bold text-white">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {po.poNumber}
                      </p>
                      <p className="text-xs text-gray-500">
                        {po.vendor?.name || "Unknown vendor"} •{" "}
                        {new Date(po.orderDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <h6 className="text-sm font-bold text-gray-900">
                        ₹{(po.totalAmount || 0).toLocaleString()}
                      </h6>
                      <div className="mt-1">{getStatusBadge(po.status)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recent Purchase Orders */}
        {recentPOs.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Recent Purchase Orders
            </h3>
            <div className="space-y-3">
              {recentPOs.map((po) => (
                <div
                  key={po._id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {po.poNumber}
                      </p>
                      <p className="text-xs text-gray-500">
                        {po.vendor?.name || "Unknown vendor"} •{" "}
                        {new Date(po.orderDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <h6 className="text-sm font-bold text-gray-900">
                        ₹{(po.totalAmount || 0).toLocaleString()}
                      </h6>
                    </div>
                    {getStatusBadge(po.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Monthly Trend */}
        {monthlyTrend.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Monthly PO Trend (Last 6 Months)
            </h3>
            <div className="space-y-4">
              {monthlyTrend.map(([month, data]) => {
                const [year, monthNum] = month.split("-");
                const monthName = new Date(
                  year,
                  monthNum - 1
                ).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                });
                const maxAmount = Math.max(
                  ...monthlyTrend.map(([, d]) => d.amount)
                );

                return (
                  <div key={month}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        {monthName}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-600">
                          {data.count} POs
                        </span>
                        <h6 className="text-sm font-semibold text-gray-900">
                          ₹{data.amount.toLocaleString()}
                        </h6>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${(data.amount / maxAmount) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPurchasesReport = () => {
    // Calculate metrics
    const totalPurchases = filteredData.filteredPurchases.length;
    const totalAmount = filteredData.filteredPurchases.reduce(
      (sum, p) => sum + (p.totalAmount || 0),
      0
    );
    const averagePurchaseAmount = totalAmount / totalPurchases || 0;

    // Status distribution
    const statusDistribution = filteredData.filteredPurchases.reduce(
      (acc, purchase) => {
        const status = purchase.status || "Unknown";
        acc[status] = acc[status] || { count: 0, amount: 0 };
        acc[status].count += 1;
        acc[status].amount += purchase.totalAmount || 0;
        return acc;
      },
      {}
    );

    // Purchases this month
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const purchasesThisMonth = filteredData.filteredPurchases.filter((p) => {
      const purchaseDate = new Date(p.purchaseDate);
      return (
        purchaseDate.getMonth() === currentMonth &&
        purchaseDate.getFullYear() === currentYear
      );
    });
    const purchasesThisMonthCount = purchasesThisMonth.length;
    const purchasesThisMonthAmount = purchasesThisMonth.reduce(
      (sum, p) => sum + (p.totalAmount || 0),
      0
    );

    // Purchases this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const purchasesThisWeek = filteredData.filteredPurchases.filter(
      (p) => new Date(p.purchaseDate) >= oneWeekAgo
    ).length;

    // Top vendors by purchase amount
    const vendorPurchases = filteredData.filteredPurchases
      .filter((p) => p.vendor?.name)
      .reduce((acc, purchase) => {
        const vendorName = purchase.vendor.name;
        acc[vendorName] = acc[vendorName] || { count: 0, amount: 0 };
        acc[vendorName].count += 1;
        acc[vendorName].amount += purchase.totalAmount || 0;
        return acc;
      }, {});

    const topVendors = Object.entries(vendorPurchases)
      .sort(([, a], [, b]) => b.amount - a.amount)
      .slice(0, 5);

    // Largest purchases
    const largestPurchases = [...filteredData.filteredPurchases]
      .sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0))
      .slice(0, 5);

    // Monthly trend (last 6 months)
    const monthlyData = {};
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    filteredData.filteredPurchases.forEach((purchase) => {
      const date = new Date(purchase.purchaseDate);
      if (date >= sixMonthsAgo) {
        const monthKey = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`;
        monthlyData[monthKey] = monthlyData[monthKey] || {
          count: 0,
          amount: 0,
        };
        monthlyData[monthKey].count += 1;
        monthlyData[monthKey].amount += purchase.totalAmount || 0;
      }
    });

    const monthlyTrend = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6);

    return (
      <div className="space-y-6">
        {/* Header with Actions */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900">
            Purchases Insights
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => (window.location.href = "/purchase")}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              View All Purchases
            </button>
            <button
              onClick={() => exportToPDF("Purchases")}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Purchases */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Purchases
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {totalPurchases}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Total Amount */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Amount
                </p>
                <h6 className="text-3xl font-bold text-gray-900 mt-2">
                  ₹{totalAmount.toLocaleString()}
                </h6>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <IndianRupeeIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Average Purchase */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Average Purchase
                </p>
                <h6 className="text-3xl font-bold text-gray-900 mt-2">
                  ₹{Math.round(averagePurchaseAmount).toLocaleString()}
                </h6>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          {/* This Week */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">This Week</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {purchasesThisWeek}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* This Month Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-600 rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-700">
                  Purchases This Month
                </p>
                <p className="text-3xl font-bold text-blue-900 mt-1">
                  {purchasesThisMonthCount}
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  {((purchasesThisMonthCount / totalPurchases) * 100).toFixed(
                    1
                  )}
                  % of total purchases
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-green-600 rounded-lg flex items-center justify-center">
                <Wallet className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-700">
                  Amount This Month
                </p>
                <p className="text-3xl font-bold text-green-900 mt-1">
                  ₹{purchasesThisMonthAmount.toLocaleString()}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  {((purchasesThisMonthAmount / totalAmount) * 100).toFixed(1)}%
                  of total amount
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Purchase Status Overview
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(statusDistribution).map(([status, data]) => (
              <div
                key={status}
                className="bg-gray-50 rounded-lg p-4 border border-gray-200"
              >
                <div className="flex items-center justify-between mb-3">
                  {getStatusBadge(status)}
                  <span className="text-sm font-semibold text-gray-900">
                    {data.count} orders
                  </span>
                </div>
                <h6 className="text-2xl font-bold text-gray-900">
                  ₹{data.amount.toLocaleString()}
                </h6>
                <div className="mt-3 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${(data.amount / totalAmount) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  {((data.amount / totalAmount) * 100).toFixed(1)}% of total
                  amount
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Vendors */}
          {topVendors.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Top Vendors by Purchase Amount
              </h3>
              <div className="space-y-3">
                {topVendors.map(([vendorName, data], index) => (
                  <div
                    key={vendorName}
                    className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-sm font-bold text-white">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {vendorName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {data.count} purchases
                      </p>
                    </div>
                    <div className="text-right">
                      <h6 className="text-sm font-bold text-gray-900">
                        ₹{data.amount.toLocaleString()}
                      </h6>
                      <p className="text-xs text-gray-500">
                        {((data.amount / totalAmount) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Largest Purchases */}
          {largestPurchases.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Largest Purchases
              </h3>
              <div className="space-y-3">
                {largestPurchases.map((purchase, index) => (
                  <div
                    key={purchase._id}
                    className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-sm font-bold text-white">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {purchase.purchaseNumber}
                      </p>
                      <p className="text-xs text-gray-500">
                        {purchase.vendor?.name || "Unknown vendor"} •{" "}
                        {new Date(purchase.purchaseDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <h6 className="text-sm font-bold text-gray-900">
                        ₹{(purchase.totalAmount || 0).toLocaleString()}
                      </h6>
                      {getStatusBadge(purchase.status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Monthly Trend */}
        {monthlyTrend.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Monthly Purchase Trend (Last 6 Months)
            </h3>
            <div className="space-y-4">
              {monthlyTrend.map(([month, data]) => {
                const [year, monthNum] = month.split("-");
                const monthName = new Date(
                  year,
                  monthNum - 1
                ).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                });
                const maxAmount = Math.max(
                  ...monthlyTrend.map(([, d]) => d.amount)
                );

                return (
                  <div key={month}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        {monthName}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-600">
                          {data.count} purchases
                        </span>
                        <h6 className="text-sm font-semibold text-gray-900">
                          ₹{data.amount.toLocaleString()}
                        </h6>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${(data.amount / maxAmount) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderInvoicesReport = () => {
    // Calculate basic metrics
    const totalInvoices = filteredData.filteredInvoices.length;
    const totalAmount = filteredData.filteredInvoices.reduce(
      (sum, invoice) => sum + (invoice.amount || 0),
      0
    );
    const averageInvoiceAmount = totalAmount / totalInvoices || 0;

    // Status distribution
    const statusDistribution = filteredData.filteredInvoices.reduce(
      (acc, invoice) => {
        const status = invoice.status || "Unknown";
        acc[status] = acc[status] || { count: 0, amount: 0 };
        acc[status].count += 1;
        acc[status].amount += invoice.amount || 0;
        return acc;
      },
      {}
    );

    // Paid, Pending, Overdue invoices
    const paidInvoices = filteredData.filteredInvoices.filter(
      (i) => i.status === "Paid"
    );
    const pendingInvoices = filteredData.filteredInvoices.filter(
      (i) => i.status === "Pending" || i.status === "Sent"
    );
    const overdueInvoices = filteredData.filteredInvoices.filter((i) => {
      if (!i.dueDate) return false;
      const today = new Date();
      const dueDate = new Date(i.dueDate);
      return i.status !== "Paid" && dueDate < today;
    });

    const paidAmount = paidInvoices.reduce(
      (sum, i) => sum + (i.amount || 0),
      0
    );
    const pendingAmount = pendingInvoices.reduce(
      (sum, i) => sum + (i.amount || 0),
      0
    );
    const overdueAmount = overdueInvoices.reduce(
      (sum, i) => sum + (i.amount || 0),
      0
    );

    // Collection rate
    const collectionRate =
      totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

    // Invoices this month
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const invoicesThisMonth = filteredData.filteredInvoices.filter((i) => {
      const invoiceDate = new Date(i.date);
      return (
        invoiceDate.getMonth() === currentMonth &&
        invoiceDate.getFullYear() === currentYear
      );
    });
    const invoicesThisMonthCount = invoicesThisMonth.length;
    const invoicesThisMonthAmount = invoicesThisMonth.reduce(
      (sum, i) => sum + (i.amount || 0),
      0
    );

    // Top deals by invoice amount
    const dealInvoices = filteredData.filteredInvoices
      .filter((i) => i.deal?.title)
      .reduce((acc, invoice) => {
        const dealTitle = invoice.deal.title;
        acc[dealTitle] = acc[dealTitle] || { count: 0, amount: 0, paid: 0 };
        acc[dealTitle].count += 1;
        acc[dealTitle].amount += invoice.amount || 0;
        if (invoice.status === "Paid") acc[dealTitle].paid += 1;
        return acc;
      }, {});

    const topDeals = Object.entries(dealInvoices)
      .sort(([, a], [, b]) => b.amount - a.amount)
      .slice(0, 5);

    // Largest invoices
    const largestInvoices = [...filteredData.filteredInvoices]
      .sort((a, b) => (b.amount || 0) - (a.amount || 0))
      .slice(0, 5);

    // Recent invoices
    const recentInvoices = [...filteredData.filteredInvoices]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    // Chart data for invoice status
    const invoiceStatusChartData = Object.entries(statusDistribution)
      .map(([status, data]) => ({
        name: status,
        value: data.count,
        amount: data.amount,
        color:
          status === "Paid"
            ? "#10b981"
            : status === "Pending"
            ? "#f59e0b"
            : status === "Sent"
            ? "#3b82f6"
            : status === "Overdue"
            ? "#ef4444"
            : "#6b7280",
      }))
      .filter((item) => item.value > 0);

    // Monthly trend (last 6 months)
    const monthlyData = {};
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    filteredData.filteredInvoices.forEach((invoice) => {
      const date = new Date(invoice.date);
      if (date >= sixMonthsAgo) {
        const monthKey = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`;
        monthlyData[monthKey] = monthlyData[monthKey] || {
          count: 0,
          amount: 0,
          paid: 0,
        };
        monthlyData[monthKey].count += 1;
        monthlyData[monthKey].amount += invoice.amount || 0;
        if (invoice.status === "Paid") {
          monthlyData[monthKey].paid += invoice.amount || 0;
        }
      }
    });

    const monthlyTrend = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6);

    return (
      <div className="space-y-6">
        {/* Header with Actions */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900">
            Invoices Insights
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => (window.location.href = "/invoices")}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              View All Invoices
            </button>
            <button
              onClick={() => exportToPDF("Invoices")}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Invoices */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Invoices
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {totalInvoices}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Total Amount */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Invoice Value
                </p>
                <h6 className="text-3xl font-bold text-gray-900 mt-2">
                  ₹{totalAmount.toLocaleString()}
                </h6>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <IndianRupeeIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Average Invoice */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Average Invoice
                </p>
                <h6 className="text-3xl font-bold text-gray-900 mt-2">
                  ₹{Math.round(averageInvoiceAmount).toLocaleString()}
                </h6>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          {/* Collection Rate */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Collection Rate
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {collectionRate.toFixed(1)}%
                </p>
                <h6 className="text-xs text-gray-500 mt-1">
                  ₹{paidAmount.toLocaleString()} collected
                </h6>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Target className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Paid, Pending, Overdue */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Paid Invoices */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-green-600 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-700">
                  Paid Invoices
                </p>
                <p className="text-3xl font-bold text-green-900 mt-1">
                  {paidInvoices.length}
                </p>
                <h6 className="text-sm text-green-600 mt-1">
                  ₹{paidAmount.toLocaleString()} •{" "}
                  {((paidAmount / totalAmount) * 100).toFixed(1)}% of total
                </h6>
              </div>
            </div>
          </div>

          {/* Pending Invoices */}
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg border border-yellow-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-yellow-600 rounded-lg flex items-center justify-center">
                <Clock className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-yellow-700">
                  Pending Invoices
                </p>
                <p className="text-3xl font-bold text-yellow-900 mt-1">
                  {pendingInvoices.length}
                </p>
                <h6 lassName="text-sm text-yellow-600 mt-1">
                  ₹{pendingAmount.toLocaleString()} •{" "}
                  {((pendingAmount / totalAmount) * 100).toFixed(1)}% of total
                </h6>
              </div>
            </div>
          </div>

          {/* Overdue Invoices */}
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg border border-red-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-red-600 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-700">
                  Overdue Invoices
                </p>
                <p className="text-3xl font-bold text-red-900 mt-1">
                  {overdueInvoices.length}
                </p>
                <h6 className="text-sm text-red-600 mt-1">
                  ₹{overdueAmount.toLocaleString()} • Immediate attention needed
                </h6>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Invoice Status Distribution */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">
                Invoice Status Distribution
              </h3>
              <PieChartIcon className="w-5 h-5 text-gray-400" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={invoiceStatusChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {invoiceStatusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name, props) => [
                    `${value} invoices (₹${props.payload.amount.toLocaleString()})`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Trend */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">
                Monthly Invoice Trend
              </h3>
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={monthlyTrend.map(([month, data]) => {
                  const [year, monthNum] = month.split("-");
                  const monthName = new Date(
                    year,
                    monthNum - 1
                  ).toLocaleDateString("en-US", { month: "short" });
                  return {
                    month: monthName,
                    Total: data.amount,
                    Paid: data.paid,
                  };
                })}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="Total" fill="#3b82f6" />
                <Bar dataKey="Paid" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Deals by Invoice Value */}
          {topDeals.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Top Deals by Invoice Value
              </h3>
              <div className="space-y-3">
                {topDeals.map(([dealTitle, data], index) => (
                  <div
                    key={dealTitle}
                    className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-sm font-bold text-white">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {dealTitle}
                      </p>
                      <p className="text-xs text-gray-500">
                        {data.count} invoices • {data.paid} paid
                      </p>
                    </div>
                    <div className="text-right">
                      <h6 className="text-sm font-bold text-gray-900">
                        ₹{data.amount.toLocaleString()}
                      </h6>
                      <h6 className="text-xs text-gray-500">
                        {((data.amount / totalAmount) * 100).toFixed(1)}%
                      </h6>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Largest Invoices */}
          {largestInvoices.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Largest Invoices
              </h3>
              <div className="space-y-3">
                {largestInvoices.map((invoice, index) => (
                  <div
                    key={invoice._id}
                    className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-sm font-bold text-white">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {invoice.invoiceNumber}
                      </p>
                      <p className="text-xs text-gray-500">
                        {invoice.deal?.title || "No deal"} •{" "}
                        {new Date(invoice.date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <h6 className="text-sm font-bold text-gray-900">
                        ₹{(invoice.amount || 0).toLocaleString()}
                      </h6>
                      <div className="mt-1">
                        {getStatusBadge(invoice.status)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recent Invoices */}
        {recentInvoices.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Recent Invoices
            </h3>
            <div className="space-y-3">
              {recentInvoices.map((invoice) => (
                <div
                  key={invoice._id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {invoice.invoiceNumber}
                      </p>
                      <p className="text-xs text-gray-500">
                        {invoice.deal?.title || "No deal"} • Issued:{" "}
                        {new Date(invoice.date).toLocaleDateString()}
                        {invoice.dueDate &&
                          ` • Due: ${new Date(
                            invoice.dueDate
                          ).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <h6 className="text-sm font-bold text-gray-900">
                        ₹{(invoice.amount || 0).toLocaleString()}
                      </h6>
                    </div>
                    {getStatusBadge(invoice.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* This Month Summary */}
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg border border-indigo-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Calendar className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-indigo-700">
                Invoices Created This Month
              </p>
              <p className="text-3xl font-bold text-indigo-900 mt-1">
                {invoicesThisMonthCount} Invoices
              </p>
              <p className="text-sm text-indigo-600 mt-1">
                Total Value:{" "}
                <h6>₹{invoicesThisMonthAmount.toLocaleString()}</h6> •{" "}
                {((invoicesThisMonthCount / totalInvoices) * 100).toFixed(1)}%
                of all invoices
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <PageSkeleton variant="cards" />
    );
  }

  const activeFilterCount =
    (dateRange.startDate ? 1 : 0) +
    (dateRange.endDate ? 1 : 0) +
    (filters.contactStatus !== "all" ? 1 : 0) +
    (filters.poStatus !== "all" ? 1 : 0) +
    (filters.purchaseStatus !== "all" ? 1 : 0);

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
      {/* Fixed strip — same pinned-below-header treatment as Companies.jsx's
          toolbar. Title text lives in the top navbar (Header.jsx) instead;
          this strip is just the spacer bar. */}
      <div
        className="fixed right-0 h-16 px-4 lg:px-6 border-b border-[#E1E4EA] bg-white flex items-center justify-between top-[54px] lg:top-16"
        style={{
          left: "var(--sidebar-width, 0px)",
          zIndex: 40,
          minHeight: "64px",
          maxHeight: "64px",
          boxSizing: "border-box",
        }}
      >
        <div className="inline-flex items-center gap-1 h-11 p-1 bg-[#F1F1F5] rounded-full overflow-x-auto max-w-full">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-[#0085FF] shadow-sm"
                  : "text-gray-700 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowFiltersPanel((prev) => !prev)}
            className="relative flex items-center justify-center w-10 h-10 rounded-full border border-[#E1E4EA] text-gray-500 hover:bg-gray-50 transition-colors"
            title="Filters"
          >
            <Filter className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#0085FF] text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>

          {showFiltersPanel && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowFiltersPanel(false)}
              />
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(90vw,720px)] bg-white p-6 rounded-xl border border-gray-200 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-base font-bold text-gray-900">Filters</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              From Date
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, startDate: e.target.value }))
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              To Date
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, endDate: e.target.value }))
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Status
            </label>
            <select
              value={filters.contactStatus}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  contactStatus: e.target.value,
                }))
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Qualified">Qualified</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PO Status
            </label>
            <select
              value={filters.poStatus}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, poStatus: e.target.value }))
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Delivered">Delivered</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Purchase Status
            </label>
            <select
              value={filters.purchaseStatus}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  purchaseStatus: e.target.value,
                }))
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="Draft">Draft</option>
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setDateRange({ startDate: "", endDate: "" });
                setFilters({
                  contactStatus: "all",
                  companySize: "all",
                  dealStage: "all",
                  vendorStatus: "all",
                  purchaseStatus: "all",
                  poStatus: "all",
                });
              }}
              className="w-full px-4 py-2 flex items-center justify-center gap-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Clear Filters
            </button>
          </div>
        </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="pt-[80px] lg:pt-[90px]">
      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === "overview" && renderOverview()}
        {activeTab === "contacts" && renderContactsReport()}
        {activeTab === "companies" && renderCompaniesReport()}
        {activeTab === "deals" && renderDealsReport()}
        {activeTab === "vendors" && renderVendorsReport()}
        {activeTab === "purchase-orders" && renderPurchaseOrdersReport()}
        {activeTab === "purchases" && renderPurchasesReport()}
        {activeTab === "invoices" && renderInvoicesReport()}
      </div>
      </div>
    </div>
  );
};

export default Insights;
import PageSkeleton from "../components/common/PageSkeleton";
