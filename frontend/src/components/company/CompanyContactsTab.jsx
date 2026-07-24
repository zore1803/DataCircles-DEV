import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import API from "../../services/api";
import toast from "react-hot-toast";
import QuickContactForm from "../contact/QuickContactForm";
import FilterIcon from "../common/FilterIcon";
import CompanyFilterPanel from "./CompanyFilterPanel";
import { applyColumnFilters } from "../../utils/advancedFilters";
import {
  Search,
  Filter,
  Plus,
  UserPlus,
  Contact as ContactIcon,
  BadgeCheck,
  Activity,
  CalendarClock,
  Phone,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  User,
  Building2,
  Target,
  Pin,
  PinOff,
  MoreVertical,
} from "lucide-react";

const ContactNameIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size * (13 / 16)} viewBox="0 0 16 13" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M9.6475 6.85896H13.4294V5.60896H9.6475V6.85896ZM9.6475 4.45521H13.4294V3.20521H9.6475V4.45521ZM2.40396 9.29479H8.49354V8.99687C8.49354 8.44132 8.21868 8.00486 7.66896 7.6875C7.11938 7.37014 6.37931 7.21146 5.44875 7.21146C4.51819 7.21146 3.77806 7.37014 3.22833 7.6875C2.67875 8.00486 2.40396 8.44132 2.40396 8.99687V9.29479ZM6.48146 5.69625C6.76521 5.41264 6.90708 5.0684 6.90708 4.66354C6.90708 4.25854 6.76521 3.91424 6.48146 3.63063C6.19785 3.34701 5.85361 3.20521 5.44875 3.20521C5.04389 3.20521 4.69958 3.34701 4.41583 3.63063C4.13222 3.91424 3.99042 4.25854 3.99042 4.66354C3.99042 5.0684 4.13222 5.41264 4.41583 5.69625C4.69958 5.98 5.04389 6.12187 5.44875 6.12187C5.85361 6.12187 6.19785 5.98 6.48146 5.69625ZM1.50646 12.5C1.08549 12.5 0.729167 12.3542 0.4375 12.0625C0.145833 11.7708 0 11.4145 0 10.9935V1.50646C0 1.08549 0.145833 0.729167 0.4375 0.4375C0.729167 0.145833 1.08549 0 1.50646 0H14.3269C14.7478 0 15.1042 0.145833 15.3958 0.4375C15.6875 0.729167 15.8333 1.08549 15.8333 1.50646V10.9935C15.8333 11.4145 15.6875 11.7708 15.3958 12.0625C15.1042 12.3542 14.7478 12.5 14.3269 12.5H1.50646ZM1.50646 11.25H14.3269C14.391 11.25 14.4498 11.2233 14.5031 11.1698C14.5566 11.1165 14.5833 11.0577 14.5833 10.9935V1.50646C14.5833 1.44229 14.5566 1.38354 14.5031 1.33021C14.4498 1.27674 14.391 1.25 14.3269 1.25H1.50646C1.44229 1.25 1.38354 1.27674 1.33021 1.33021C1.27674 1.38354 1.25 1.44229 1.25 1.50646V10.9935C1.25 11.0577 1.27674 11.1165 1.33021 11.1698C1.38354 11.2233 1.44229 11.25 1.50646 11.25Z" fill="#525252" />
  </svg>
);

const EmailIcon = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M7.91667 15.8333C6.82264 15.8333 5.7941 15.6253 4.83104 15.2092C3.86785 14.7931 3.02993 14.2287 2.31729 13.516C1.60465 12.8034 1.04028 11.9655 0.624167 11.0023C0.208056 10.0392 0 9.01069 0 7.91667C0 6.82264 0.208056 5.7941 0.624167 4.83104C1.04028 3.86785 1.60465 3.02993 2.31729 2.31729C3.02993 1.60465 3.86785 1.04028 4.83104 0.624167C5.7941 0.208056 6.82264 0 7.91667 0C9.01069 0 10.0392 0.208056 11.0023 0.624167C11.9655 1.04028 12.8034 1.60465 13.516 2.31729C14.2287 3.02993 14.7931 3.86785 15.2092 4.83104C15.6253 5.7941 15.8333 6.82264 15.8333 7.91667V8.93271C15.8333 9.6934 15.5721 10.3392 15.0496 10.8702C14.5272 11.4012 13.8857 11.6667 13.125 11.6667C12.6335 11.6667 12.1778 11.5465 11.7579 11.306C11.3381 11.0656 11.0063 10.7349 10.7627 10.314C10.4027 10.7435 9.97729 11.0764 9.48646 11.3125C8.99549 11.5486 8.47222 11.6667 7.91667 11.6667C6.87611 11.6667 5.99097 11.3018 5.26125 10.5721C4.53153 9.84236 4.16667 8.95722 4.16667 7.91667C4.16667 6.87611 4.53153 5.99097 5.26125 5.26125C5.99097 4.53153 6.87611 4.16667 7.91667 4.16667C8.95722 4.16667 9.84236 4.53153 10.5721 5.26125C11.3018 5.99097 11.6667 6.87611 11.6667 7.91667V8.93271C11.6667 9.34187 11.8074 9.69153 12.089 9.98167C12.3705 10.2717 12.7158 10.4167 13.125 10.4167C13.5342 10.4167 13.8795 10.2717 14.161 9.98167C14.4426 9.69153 14.5833 9.34187 14.5833 8.93271V7.91667C14.5833 6.05556 13.9375 4.47917 12.6458 3.1875C11.3542 1.89583 9.77778 1.25 7.91667 1.25C6.05556 1.25 4.47917 1.89583 3.1875 3.1875C1.89583 4.47917 1.25 6.05556 1.25 7.91667C1.25 9.77778 1.89583 11.3542 3.1875 12.6458C4.47917 13.9375 6.05556 14.5833 7.91667 14.5833H12.0833V15.8333H7.91667ZM9.6875 9.6875C10.1736 9.20139 10.4167 8.61111 10.4167 7.91667C10.4167 7.22222 10.1736 6.63194 9.6875 6.14583C9.20139 5.65972 8.61111 5.41667 7.91667 5.41667C7.22222 5.41667 6.63194 5.65972 6.14583 6.14583C5.65972 6.63194 5.41667 7.22222 5.41667 7.91667C5.41667 8.61111 5.65972 9.20139 6.14583 9.6875C6.63194 10.1736 7.22222 10.4167 7.91667 10.4167C8.61111 10.4167 9.20139 10.1736 9.6875 9.6875Z" fill="#525252" />
  </svg>
);

const DecisionMakersIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 18 19" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M0 18.1923V16.6923H11.5V18.1923H0ZM5.80375 13.0345L0.5 7.73075L2.25375 5.927L7.6075 11.2308L5.80375 13.0345ZM11.7308 7.1075L6.427 1.75375L8.23075 0L13.5345 5.30375L11.7308 7.1075ZM16.5422 17.096L3.8385 4.39225L4.89225 3.3385L17.596 16.0423L16.5422 17.096Z" fill="#0085FF" />
  </svg>
);

const RecentInteractionsIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M22.5 13.4615H17.925C17.875 13.1948 17.807 12.9381 17.721 12.6912C17.6352 12.4446 17.5282 12.2013 17.4 11.9615H20.9538C20.9064 11.7615 20.8331 11.5958 20.7337 11.4645C20.6342 11.333 20.4942 11.2211 20.3135 11.1288C19.8417 10.8659 19.3218 10.673 18.7538 10.55C18.1859 10.4268 17.5597 10.3652 16.875 10.3652C16.7558 10.3652 16.6392 10.3701 16.525 10.3798C16.4108 10.3894 16.2942 10.4071 16.175 10.4328C15.9202 10.1581 15.643 9.91917 15.3435 9.716C15.044 9.513 14.7186 9.33717 14.3673 9.1885C14.7634 9.086 15.1698 9.0065 15.5865 8.95C16.0033 8.89367 16.4328 8.8655 16.875 8.8655C17.6813 8.8655 18.4454 8.95075 19.1672 9.12125C19.8891 9.29175 20.5673 9.54233 21.202 9.873C21.6288 10.1 21.9518 10.4138 22.171 10.8145C22.3903 11.215 22.5 11.6877 22.5 12.2327V13.4615ZM16.8755 7.923C16.1252 7.923 15.4872 7.65942 14.9615 7.13225C14.4358 6.60492 14.173 5.96467 14.173 5.2115C14.173 4.45833 14.4357 3.81817 14.961 3.291C15.4862 2.76367 16.124 2.5 16.8745 2.5C17.6248 2.5 18.2628 2.76367 18.7885 3.291C19.3142 3.81817 19.577 4.45833 19.577 5.2115C19.577 5.96467 19.3143 6.60492 18.789 7.13225C18.2637 7.65942 17.6258 7.923 16.8755 7.923ZM16.8755 6.423C17.2162 6.423 17.5016 6.30717 17.7318 6.0755C17.9619 5.84367 18.077 5.5565 18.077 5.214C18.077 4.87133 17.9618 4.58333 17.7313 4.35C17.5008 4.11667 17.2152 4 16.8745 4C16.5338 4 16.2484 4.11592 16.0182 4.34775C15.7881 4.57942 15.673 4.86658 15.673 5.20925C15.673 5.55175 15.7882 5.83967 16.0188 6.073C16.2493 6.30633 16.5348 6.423 16.8755 6.423ZM1.5 13.4615V12.2327C1.5 11.6877 1.60967 11.215 1.829 10.8145C2.04817 10.4138 2.37117 10.1 2.798 9.873C3.43267 9.54233 4.11092 9.29175 4.83275 9.12125C5.55458 8.95075 6.31867 8.8655 7.125 8.8655C7.56717 8.8655 7.99667 8.89367 8.4135 8.95C8.83017 9.0065 9.23658 9.086 9.63275 9.1885C9.28142 9.33717 8.956 9.513 8.6565 9.716C8.357 9.91917 8.07983 10.1581 7.825 10.4328C7.70583 10.4071 7.58917 10.3894 7.475 10.3798C7.36083 10.3701 7.24417 10.3652 7.125 10.3652C6.44033 10.3652 5.81408 10.4268 5.24625 10.55C4.67825 10.673 4.15833 10.8659 3.6865 11.1288C3.50583 11.2211 3.36575 11.333 3.26625 11.4645C3.16692 11.5958 3.09358 11.7615 3.04625 11.9615H6.6C6.47183 12.2013 6.36483 12.4446 6.279 12.6912C6.193 12.9381 6.125 13.1948 6.075 13.4615H1.5ZM7.1255 7.923C6.37517 7.923 5.73717 7.65942 5.2115 7.13225C4.68583 6.60492 4.423 5.96467 4.423 5.2115C4.423 4.45833 4.68567 3.81817 5.211 3.291C5.73633 2.76367 6.37417 2.5 7.1245 2.5C7.87483 2.5 8.51283 2.76367 9.0385 3.291C9.56417 3.81817 9.827 4.45833 9.827 5.2115C9.827 5.96467 9.56433 6.60492 9.039 7.13225C8.51383 7.65942 7.876 7.923 7.1255 7.923ZM7.1255 6.423C7.46617 6.423 7.75158 6.30717 7.98175 6.0755C8.21192 5.84367 8.327 5.5565 8.327 5.214C8.327 4.87133 8.21175 4.58333 7.98125 4.35C7.75075 4.11667 7.46517 4 7.1245 4C6.78383 4 6.49842 4.11592 6.26825 4.34775C6.03808 4.57942 5.923 4.86658 5.923 5.20925C5.923 5.55175 6.03825 5.83967 6.26875 6.073C6.49925 6.30633 6.78483 6.423 7.1255 6.423ZM12 16.5865C11.5205 16.5865 11.1137 16.4179 10.7797 16.0807C10.4458 15.7436 10.2788 15.3352 10.2788 14.8558V11.9135C10.2788 11.434 10.4458 11.0257 10.7797 10.6885C11.1137 10.3513 11.5205 10.1828 12 10.1828C12.4795 10.1828 12.8863 10.3513 13.2203 10.6885C13.5542 11.0257 13.7212 11.434 13.7212 11.9135V14.8558C13.7212 15.3352 13.5542 15.7436 13.2203 16.0807C12.8863 16.4179 12.4795 16.5865 12 16.5865ZM11.4038 21.5V19.498C10.2616 19.3532 9.30133 18.8413 8.523 17.9625C7.74483 17.0837 7.35575 16.0481 7.35575 14.8558H8.5385C8.5385 15.8224 8.87533 16.6458 9.549 17.326C10.2227 18.0062 11.0397 18.3462 12 18.3462C12.9603 18.3462 13.7773 18.0055 14.451 17.324C15.1247 16.6425 15.4615 15.8197 15.4615 14.8558H16.6538C16.6538 16.0481 16.2631 17.0837 15.4818 17.9625C14.7003 18.8413 13.7384 19.3532 12.5963 19.498V21.5H11.4038Z" fill="#0085FF" />
  </svg>
);

const EMAIL_DOMAIN_SUFFIXES = [
  ".com",
  ".in",
  ".org",
  ".net",
  ".co",
  ".io",
  ".biz",
  ".info",
  ".edu",
  ".gov",
  ".us",
  ".uk",
];

const CONTACT_FILTER_COLUMNS = [
  { key: "email", label: "Email", options: EMAIL_DOMAIN_SUFFIXES },
  { key: "role", label: "Role" },
  { key: "status", label: "Interaction" },
];

const getEmailSuffix = (email) => {
  const domain = (email || "").split("@")[1];
  if (!domain || !domain.includes(".")) return "";
  return "." + domain.split(".").pop();
};

const getContactFieldValue = (contact, key) => {
  if (key === "status") return contact.lifecycleStage || contact.status || "";
  if (key === "email") return getEmailSuffix(contact.email);
  if (key === "role") {
    return (
      contact.additionalFields?.find((f) =>
        /^(role|designation|job title)$/i.test(f.key || ""),
      )?.value || ""
    );
  }
  return contact[key];
};

export default function CompanyContactsTab({ contacts, meetings = [], tasks = [], showStats = true, companyId, company, setContacts }) {
  const [showContactForm, setShowContactForm] = useState(false);
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
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pinnedColumn, setPinnedColumn] = useState(null);
  const [colWidths, setColWidths] = useState({
    name: 275,
    email: 244,
    phone: 232,
    role: 244,
    status: 331,
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

  const filteredContacts = useMemo(() => {
    let result = contacts;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (c) =>
          (c.name || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q),
      );
    }
    return applyColumnFilters(result, selectedFilters, getContactFieldValue);
  }, [contacts, searchTerm, selectedFilters]);

  const sortedContacts = useMemo(() => {
    if (!sortConfig.key) return filteredContacts;
    return [...filteredContacts].sort((a, b) => {
      const aVal = (getContactFieldValue(a, sortConfig.key) || "").toString().toLowerCase();
      const bVal = (getContactFieldValue(b, sortConfig.key) || "").toString().toLowerCase();
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredContacts, sortConfig]);

  const decisionMakers = contacts.filter(
    (c) => c.lifecycleStage === "Customer",
  ).length;

  const upcomingFollowUps = [...tasks, ...meetings].filter((item) => {
    const date = item.dueDate || item.scheduledAt;
    return date && new Date(date) >= new Date();
  }).length;

  const totalCount = filteredContacts.length;
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

  const paginatedContacts = useMemo(
    () => sortedContacts.slice((currentPage - 1) * limit, currentPage * limit),
    [sortedContacts, currentPage, limit],
  );

  const kpiTiles = [
    { label: "Total Contacts", value: contacts.length, icon: ContactIcon },
    { label: "Decision Makers", value: decisionMakers, icon: DecisionMakersIcon },
    { label: "Recent Interactions", value: meetings.length, icon: RecentInteractionsIcon },
    { label: "Upcoming Follow-ups", value: upcomingFollowUps, icon: CalendarClock },
  ];

  return (
    <div>
      {/* KPI Tiles */}
      {showStats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
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
            placeholder="Search by contact by name, email, or phone..."
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
        <button
          type="button"
          onClick={() => setShowContactForm(true)}
          className="flex items-center justify-center rounded-full border hover:bg-gray-50 flex-shrink-0"
          style={{ width: "44px", height: "44px", borderColor: "#E1E4EA" }}
          title="Add Contact"
        >
          <Plus size={20} />
        </button>
      </div>

      {showContactForm && (
        <QuickContactForm
          companies={company ? [company] : []}
          initialCompanyId={companyId}
          onContactCreated={async () => {
            try {
              const res = await API.get("/contacts");
              setContacts?.(res.data.filter((c) => c.company?._id === companyId));
              toast.success("Contact created successfully!");
            } catch (err) {
              toast.error("Failed to refresh contacts list.");
            }
            setShowContactForm(false);
          }}
          onRequestClose={() => setShowContactForm(false)}
        />
      )}

      <CompanyFilterPanel
        isOpen={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        columns={CONTACT_FILTER_COLUMNS}
        data={contacts}
        getFieldValue={getContactFieldValue}
        selected={selectedFilters}
        onApply={setSelectedFilters}
        title="Filter Contacts"
        subtitle="Filter this list by column"
      />

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
                { id: "name", label: "Contact Name", width: 275, icon: ContactNameIcon, pinnable: true },
                { id: "email", label: "Email", width: 244, icon: EmailIcon, pinnable: true },
                { id: "phone", label: "Phone Number", width: 232, icon: Phone, pinnable: true },
                { id: "role", label: "Role", width: 244, icon: Building2, pinnable: true },
                { id: "status", label: "Interaction", width: 331, icon: Target },
              ].map((col) => {
                const isPinned = pinnedColumn === col.id;
                return (
                  <th
                    key={col.id}
                    style={{ width: colWidths[col.id], height: 56, position: "relative" }}
                    className={`px-3 py-2.5 font-medium text-[#525866] text-xs ${col.id === "status" ? "" : "border-r border-[#E1E4EA]"
                      }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      {col.pinnable ? (
                        <div
                          className="relative flex items-center justify-start flex-1 min-w-0 group cursor-pointer select-none"
                          onDoubleClick={() => togglePinColumn(col.id)}
                        >
                          <div className="flex items-center gap-1.5 flex-1 overflow-hidden">
                            <col.icon className="w-4 h-4 flex-shrink-0" />
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
                          {col.icon && <col.icon className="w-4 h-4 flex-shrink-0" />}
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

                    <div
                      onMouseDown={(e) => startResize(e, col.id)}
                      className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-blue-400 z-10 ${resizingCol === col.id ? "bg-blue-500" : "bg-transparent"
                        }`}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E1E4EA] bg-white">
            {paginatedContacts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-medium">
                  No contacts found.
                </td>
              </tr>
            ) : (
              paginatedContacts.map((contact) => (
                <tr key={contact._id} className="hover:bg-gray-50 transition-colors group">
                  <td style={{ height: 54 }} className="px-3 text-left">
                    <Link
                      to={`/contacts/${contact._id}`}
                      className="text-[14px] leading-5 font-medium text-[#222530] hover:text-blue-600 truncate block"
                    >
                      {contact.name || "-"}
                    </Link>
                  </td>
                  <td
                    style={{ height: 54 }}
                    className="px-3 text-[14px] leading-5 font-medium text-[#525866] truncate text-left"
                  >
                    {contact.email || "-"}
                  </td>
                  <td
                    style={{ height: 54 }}
                    className="px-3 text-[14px] leading-5 font-medium text-[#525866] whitespace-nowrap text-left"
                  >
                    {contact.phone || "-"}
                  </td>
                  <td
                    style={{ height: 54 }}
                    className="px-3 text-[14px] leading-5 font-medium text-[#222530] truncate text-left"
                  >
                    {contact.additionalFields?.find(
                      (f) => /^(role|designation|job title)$/i.test(f.key || "")
                    )?.value || "-"}
                  </td>
                  <td style={{ height: 54 }} className="px-3">
                    <div className="relative flex items-center justify-start">
                      <span className="text-[14px] leading-5 font-medium text-[#525866]">
                        {contact.lifecycleStage || contact.status || "-"}
                      </span>
                      <button
                        className="absolute right-0 p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        title="More options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
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
    </div>
  );
}
