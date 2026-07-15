import { useEffect, useState, useRef } from "react";
import {
  Search,
  FileText,
  X,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Eye,
  Download,
  Send,
  Trash2,
  Repeat,
  Plus,
  Filter,
  Calendar,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Mail,
  IndianRupee,
  MoreVertical,
} from "lucide-react";
import API from "../services/api";
import InvoiceForm from "../components/invoice/InvoiceForm";
import PerformaInvoiceForm from "../components/PerformaInvoice/PerformaInvoiceForm";
import QuotationForm from "../components/quotation/QuotationForm";
import DeliveryChallanForm from "../components/deliveryChallan/DeliveryChallanForm";
import InvoiceStylePreview from "../components/invoice/InvoiceStylePreview";
import PerformaInvoiceStylePreview from "../components/PerformaInvoice/PerformaInvoiceStylePreview";
// import QuotationStylePreview from "../components/quotation/QuotationStylePreview";
// import DeliveryChallanStylePreview from "../components/deliveryChallan/DeliveryChallanStylePreview";
import toast from "react-hot-toast";
import logo from "/DataCircles.png";
import VideoTutorialModal from "../components/VideoTutorialModal";
import { getVideoTutorial } from "../utils/videoTutorials";
import VideoTutorialButton from "../components/VideoTutorialButton";
import QuickBrandingModal from "../components/invoice/QuickBrandingModal";
import { useLocation, useNavigate } from "react-router-dom";
import AppToaster from "../components/AppToaster";

const statusOptions = [
  "Draft",
  "Sent",
  "Paid",
  "Accepted",
  "Rejected",
  "Delivered",
  "Void",
];

const loadingMessages = [
  "Generating documents as fast as your business grows!",
  "Smart document management that saves time and boosts accuracy.",
  "Let’s crunch the numbers for you — documents loading!",
  "Because every rupee deserves to be tracked right.",
  "Documents that look professional, because you are!",
  "DataCircles — where CRM meets seamless document management.",
  "Never lose track of a document again.",
  "From deals to deliveries — we’ve got you covered.",
  "Your finances, your control — loading secure insights!",
];

const randomMessage =
  loadingMessages[Math.floor(Math.random() * loadingMessages.length)];

const Shimmer = () => (
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

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, docType }) => {
  if (!isOpen) return null;

  const getDocName = () => {
    switch (docType) {
      case "tax":
        return "Tax Invoice";
      case "performa":
        return "Pro Forma Invoice";
      case "quotation":
        return "Quotation";
      case "deliveryChallan":
        return "Delivery Challan";
      default:
        return "Document";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-red-100 p-2 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Confirm Deletion</h2>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete this {getDocName()}? This action
          cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

const ConvertConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  docType,
  targetType,
}) => {
  if (!isOpen) return null;

  const getDocName = () => {
    switch (docType) {
      case "tax":
        return "Tax Invoice";
      case "performa":
        return "Pro Forma Invoice";
      case "quotation":
        return "Quotation";
      case "deliveryChallan":
        return "Delivery Challan";
      default:
        return "Document";
    }
  };

  const getTargetName = () => {
    switch (targetType) {
      case "tax":
        return "Tax Invoice";
      case "performa":
        return "Pro Forma Invoice";
      case "quotation":
        return "Quotation";
      case "deliveryChallan":
        return "Delivery Challan";
      default:
        return "Document";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-purple-100 p-2 rounded-lg">
            <Repeat className="w-5 h-5 text-purple-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            Confirm Conversion
          </h2>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to convert this {getDocName()} to a{" "}
          {getTargetName()}? The original document will be deleted.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center gap-2"
          >
            <Repeat className="w-4 h-4" />
            Convert
          </button>
        </div>
      </div>
    </div>
  );
};

const InvoiceViewer = ({
  isOpen,
  onClose,
  id,
  type,
  onEdit,
  onDownload,
  onSend,
  doc,
  onConvert,
}) => {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [openConvertMenu, setOpenConvertMenu] = useState(null);
  useEffect(() => {
    if (isOpen && id && type) {
      fetchPdf();
    }
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, id, type]);

  const fetchPdf = async () => {
    const path =
      type === "tax"
        ? "invoices"
        : type === "performa"
        ? "performa-invoices"
        : type === "quotation"
        ? "quotations"
        : "delivery-challans";
    try {
      const response = await API.get(`/${path}/download/${id}`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      setPdfUrl(URL.createObjectURL(blob));
    } catch (error) {
      toast.error("Failed to load PDF");
      console.error("PDF fetch error:", error);
      onClose();
    }
  };

  const isTax =
    type === "tax"
      ? doc?.items?.some((item) => item.hsn && item.hsn.trim() !== "")
      : false;
  const getTitle = () => {
    switch (type) {
      case "tax":
        return isTax ? "Tax Invoice" : "Invoice";
      case "performa":
        return "Pro Forma Invoice";
      case "quotation":
        return "Quotation";
      case "deliveryChallan":
        return "Delivery Challan";
      default:
        return "Document";
    }
  };
  const docNumber =
    doc?.[
      type === "tax"
        ? "invoiceNumber"
        : type === "performa"
        ? "performaInvoiceNumber"
        : type === "quotation"
        ? "quotationNumber"
        : "deliveryChallanNumber"
    ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100002] p-4">
      <div className="bg-white rounded-xl w-full h-[90vh] max-w-5xl flex flex-col shadow-2xl">
        <div className="flex justify-between items-center px-5 py-2 border-b border-gray-200 bg-gray-50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {getTitle()} #{docNumber || "N/A"}
              </h2>
              <p className="text-sm text-gray-600">View and manage document</p>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <div className="flex gap-2">
              <button
                title="Edit"
                onClick={onEdit}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                title="Download"
                onClick={onDownload}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                title="Send"
                onClick={onSend}
                className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
              <div className="relative">
                <button
                  title="Convert"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenConvertMenu(
                      openConvertMenu === "viewer" ? null : "viewer"
                    );
                  }}
                  className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                >
                  <Repeat className="w-4 h-4" />
                </button>
                {openConvertMenu === "viewer" && (
                  <div className="absolute right-0 mt-1 w-60 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="py-1">
                      {["tax", "performa", "quotation", "deliveryChallan"]
                        .filter((t) => t !== type)
                        .map((targetType) => (
                          <button
                            key={targetType}
                            onClick={() => {
                              onConvert(targetType);
                              setOpenConvertMenu(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          >
                            <Repeat className="w-4 h-4 text-orange-600" />
                            Convert to{" "}
                            {targetType === "tax"
                              ? "Tax Invoice"
                              : targetType === "performa"
                              ? "Pro Forma Invoice"
                              : targetType === "quotation"
                              ? "Quotation"
                              : "Delivery Challan"}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 p-4 overflow-hidden">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              width="100%"
              height="100%"
              title="Document PDF"
              className="rounded-lg"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
              <p className="text-gray-600 font-medium">Loading PDF...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MergedInvoiceManager = () => {
  // router hooks for tab-sync
  const location = useLocation();
  const navigate = useNavigate();

  // map possible query values to internal tab keys
  const tabMap = {
    quotation: "quotation",
    quote: "quotation",
    tax: "tax",
    invoice: "tax",
    invoices: "tax",
    performa: "performa",
    proforma: "performa",
    delivery: "deliveryChallan",
    deliveryChallan: "deliveryChallan",
  };

  // read initial tab from URL (if present)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get("tab");
    const mapped = tabParam ? tabMap[tabParam] : null;
    if (mapped) {
      setActiveTab(mapped);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const [activeTab, setActiveTab] = useState("tax");
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState({
    tax: false,
    performa: false,
    quotation: false,
    deliveryChallan: false,
  });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewStyle, setPreviewStyle] = useState(null);
  const [previewType, setPreviewType] = useState(null);
  const [showViewer, setShowViewer] = useState(false);
  const [viewerId, setViewerId] = useState(null);
  const [viewerType, setViewerType] = useState(null);
  const [viewerDoc, setViewerDoc] = useState(null);
  const [openConvertMenu, setOpenConvertMenu] = useState(null);
  const [dropdownDirection, setDropdownDirection] = useState({});
  const [showBrandingModal, setShowBrandingModal] = useState(false);
  const [pendingInvoiceCreation, setPendingInvoiceCreation] = useState(false);
  // inline edit state
  const [editingId, setEditingId] = useState(null);
  const [tempInvoiceValue, setTempInvoiceValue] = useState("");
  const [renamingLoading, setRenamingLoading] = useState(false);

  // Add branding check function
  const checkBrandingBeforeInvoice = async () => {
    try {
      const response = await API.get("/branding/invoice-check");

      if (!response.data.isComplete) {
        setShowBrandingModal(true);
        setPendingInvoiceCreation(true);
        return false;
      }
      return true;
    } catch (error) {
      console.error("Branding check error:", error);
      return true; // Proceed anyway if check fails
    }
  };

  // Add this helper function
  const isLastRows = (index) => {
    const totalRows = currentDocuments.length;
    return index >= totalRows - 2; // Last 2 rows open upward
  };

  const buttonRefs = useRef({});

  // Calculate dropdown direction based on viewport space
  const calculateDropdownDirection = (buttonElement, docId) => {
    if (!buttonElement) return;

    const rect = buttonElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownHeight = 200; // Approximate dropdown height

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Open upward only if not enough space below AND enough space above
    const shouldOpenUpward =
      spaceBelow < dropdownHeight && spaceAbove > dropdownHeight;

    setDropdownDirection((prev) => ({
      ...prev,
      [docId]: shouldOpenUpward ? "up" : "down",
    }));
  };

  // Calculate direction when menu opens
  useEffect(() => {
    if (openConvertMenu && buttonRefs.current[openConvertMenu]) {
      calculateDropdownDirection(
        buttonRefs.current[openConvertMenu],
        openConvertMenu
      );
    }
  }, [openConvertMenu]);

  const [documents, setDocuments] = useState({
    tax: [],
    performa: [],
    quotation: [],
    deliveryChallan: [],
  });
  const [searchTerms, setSearchTerms] = useState({
    tax: "",
    performa: "",
    quotation: "",
    deliveryChallan: "",
  });
  const [debouncedSearchTerms, setDebouncedSearchTerms] = useState({
    tax: "",
    performa: "",
    quotation: "",
    deliveryChallan: "",
  });
  const [filterStatuses, setFilterStatuses] = useState({
    tax: "",
    performa: "",
    quotation: "",
    deliveryChallan: "",
  });
  const [debouncedFilterStatuses, setDebouncedFilterStatuses] = useState({
    tax: "",
    performa: "",
    quotation: "",
    deliveryChallan: "",
  });
  const [paginations, setPaginations] = useState({
    tax: {
      currentPage: 1,
      totalPages: 0,
      totalCount: 0,
      limit: 10,
      hasNextPage: false,
      hasPrevPage: false,
    },
    performa: {
      currentPage: 1,
      totalPages: 0,
      totalCount: 0,
      limit: 10,
      hasNextPage: false,
      hasPrevPage: false,
    },
    quotation: {
      currentPage: 1,
      totalPages: 0,
      totalCount: 0,
      limit: 10,
      hasNextPage: false,
      hasPrevPage: false,
    },
    deliveryChallan: {
      currentPage: 1,
      totalPages: 0,
      totalCount: 0,
      limit: 10,
      hasNextPage: false,
      hasPrevPage: false,
    },
  });
  const [sortConfigs, setSortConfigs] = useState({
    tax: { key: "invoiceNumber", direction: "desc" },
    performa: { key: "performaInvoiceNumber", direction: "desc" },
    quotation: { key: "quotationNumber", direction: "desc" },
    deliveryChallan: { key: "deliveryChallanNumber", direction: "desc" },
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState(null);
  const [deleteDocType, setDeleteDocType] = useState(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertDocId, setConvertDocId] = useState(null);
  const [convertDocType, setConvertDocType] = useState(null);
  const [convertTargetType, setConvertTargetType] = useState(null);
  // Video Tutorial State
  const [showVideoTutorial, setShowVideoTutorial] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openConvertMenu) {
        setOpenConvertMenu(null);
      }
    };

    if (openConvertMenu) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [openConvertMenu]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerms((prev) => ({
        ...prev,
        [activeTab]: searchTerms[activeTab],
      }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerms, activeTab]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilterStatuses((prev) => ({
        ...prev,
        [activeTab]: filterStatuses[activeTab],
      }));
    }, 300);
    return () => clearTimeout(timer);
  }, [filterStatuses, activeTab]);

  useEffect(() => {
    setPaginations((prev) => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], currentPage: 1 },
    }));
  }, [debouncedSearchTerms, debouncedFilterStatuses, activeTab]);

  useEffect(() => {
    fetchData(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    paginations[activeTab]?.currentPage,
    paginations[activeTab]?.limit,
    sortConfigs[activeTab],
    activeTab,
  ]);

  useEffect(() => {
    if (paginations[activeTab]?.currentPage === 1) {
      fetchData(activeTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedSearchTerms[activeTab],
    debouncedFilterStatuses[activeTab],
    activeTab,
  ]);

  useEffect(() => {
    fetchDeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDeals = async () => {
    try {
      const res = await API.get("/deals");
      setDeals(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load deals");
      console.error("Fetch deals error:", err);
    }
  };

  const fetchData = async (type) => {
    setLoading((prev) => ({ ...prev, [type]: true }));
    const apiPath =
      type === "tax"
        ? "invoices"
        : type === "performa"
        ? "performa-invoices"
        : type === "quotation"
        ? "quotations"
        : "delivery-challans";
    const params = new URLSearchParams({
      page: paginations[type].currentPage.toString(),
      limit: paginations[type].limit.toString(),
      sortBy: sortConfigs[type].key,
      sortOrder: sortConfigs[type].direction,
    });

    if (debouncedSearchTerms[type].trim()) {
      params.append("search", debouncedSearchTerms[type].trim());
    }
    if (debouncedFilterStatuses[type]) {
      params.append("status", debouncedFilterStatuses[type]);
    }

    try {
      const res = await API.get(`/${apiPath}/pagination?${params.toString()}`);
      const dataKey =
        type === "tax"
          ? "invoices"
          : type === "performa"
          ? "performaInvoices"
          : type === "quotation"
          ? "quotations"
          : "deliveryChallans";
      setDocuments((prev) => ({
        ...prev,
        [type]: res.data[dataKey] || [],
      }));
      setPaginations((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          currentPage: res.data.pagination.currentPage,
          totalPages: res.data.pagination.totalPages,
          totalCount: res.data.pagination.totalCount,
          hasNextPage: res.data.pagination.hasNextPage,
          hasPrevPage: res.data.pagination.hasPrevPage,
        },
      }));
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          `Failed to load ${type === "tax" ? "" : type} documents`
      );
      console.error(`Fetch ${type} documents error:`, err.response?.data);
    } finally {
      setLoading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handlePageChange = (type, newPage) => {
    const pagination = paginations[type];
    if (
      newPage >= 1 &&
      newPage <= pagination.totalPages &&
      newPage !== pagination.currentPage
    ) {
      setPaginations((prev) => ({
        ...prev,
        [type]: { ...prev[type], currentPage: newPage },
      }));
    }
  };

  const handleLimitChange = (type, newLimit) => {
    setPaginations((prev) => ({
      ...prev,
      [type]: { ...prev[type], limit: newLimit, currentPage: 1 },
    }));
  };

  const handleSort = (type, key) => {
    let direction = "asc";
    if (
      sortConfigs[type].key === key &&
      sortConfigs[type].direction === "asc"
    ) {
      direction = "desc";
    }
    setSortConfigs((prev) => ({ ...prev, [type]: { key, direction } }));
    setPaginations((prev) => ({
      ...prev,
      [type]: { ...prev[type], currentPage: 1 },
    }));
  };

  const SortableHeader = ({ type, field, children, className = "" }) => (
    <th
      className={`px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors ${className}`}
      onClick={() => handleSort(type, field)}
    >
      <div className="flex items-center gap-2">
        {children}
        <div className="flex flex-col ml-auto">
          <ChevronUp
            className={`w-3 h-3 ${
              sortConfigs[type].key === field &&
              sortConfigs[type].direction === "asc"
                ? "text-blue-600"
                : "text-gray-400"
            }`}
          />
          <ChevronDown
            className={`w-3 h-3 -mt-1 ${
              sortConfigs[type].key === field &&
              sortConfigs[type].direction === "desc"
                ? "text-blue-600"
                : "text-gray-400"
            }`}
          />
        </div>
      </div>
    </th>
  );

  const PaginationControls = ({ type }) => {
    const pagination = paginations[type];
    const {
      currentPage,
      totalPages,
      totalCount,
      limit,
      hasNextPage,
      hasPrevPage,
    } = pagination;

    if (totalCount === 0) return null;

    const startItem = (currentPage - 1) * limit + 1;
    const endItem = Math.min(currentPage * limit, totalCount);

    const getPageNumbers = () => {
      const delta = 2;
      const range = [];
      const rangeWithDots = [];

      for (
        let i = Math.max(2, currentPage - delta);
        i <= Math.min(totalPages - 1, currentPage + delta);
        i++
      ) {
        range.push(i);
      }

      if (currentPage - delta > 2) {
        rangeWithDots.push(1, "...");
      } else {
        rangeWithDots.push(1);
      }

      rangeWithDots.push(...range);

      if (currentPage + delta < totalPages - 1) {
        rangeWithDots.push("...", totalPages);
      } else {
        rangeWithDots.push(totalPages);
      }

      return rangeWithDots.filter(
        (item, index, arr) => index === 0 || arr[index - 1] !== item
      );
    };

    return (
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
        <div className="flex-1 flex justify-between sm:hidden">
          <button
            onClick={() => handlePageChange(type, currentPage - 1)}
            disabled={!hasPrevPage}
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <button
            onClick={() => handlePageChange(type, currentPage + 1)}
            disabled={!hasNextPage}
            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
              onChange={(e) =>
                handleLimitChange(type, parseInt(e.target.value))
              }
              className="ml-2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-inter"
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => handlePageChange(type, currentPage - 1)}
              disabled={!hasPrevPage}
              className="relative inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {totalPages > 0 &&
              getPageNumbers().map((pageNum, index) =>
                pageNum === "..." ? (
                  <span
                    key={`dots-${index}`}
                    className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={`page-${pageNum}`}
                    onClick={() => handlePageChange(type, pageNum)}
                    className={`relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      pageNum === currentPage
                        ? "bg-blue-600 text-white"
                        : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              )}

            <button
              onClick={() => handlePageChange(type, currentPage + 1)}
              disabled={!hasNextPage}
              className="relative inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleEdit = (doc, type) => {
    try {
      setEditing({
        ...doc,
        items: doc.items.map((item) => ({
          _id: item.itemId,
          name: item.name,
          description: item.description || "",
          rate: item.rate,
          quantity: item.quantity,
          hsn: item.hsn || "",
          isVariant: item.isVariant || false,
          parentItemId: item.parentItemId || null,
          discountType: item.discountType || "amount",
          discount: item.discount || 0,
        })),
        date: doc.date ? new Date(doc.date).toISOString().slice(0, 10) : "",
        dueDate: doc.dueDate
          ? new Date(doc.dueDate).toISOString().slice(0, 10)
          : "",
        discount: doc.discount || { type: "fixed", value: 0 },
      });
      setEditingType(type);
      setShowForm(true);
    } catch (err) {
      toast.error("Failed to prepare document for editing");
      console.error("Edit error:", err);
    }
  };

  const handleDelete = (id, type) => {
    setDeleteDocId(id);
    setDeleteDocType(type);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    const apiPath =
      deleteDocType === "tax"
        ? "invoices"
        : deleteDocType === "performa"
        ? "performa-invoices"
        : deleteDocType === "quotation"
        ? "quotations"
        : "delivery-challans";
    try {
      setLoading((prev) => ({ ...prev, [deleteDocType]: true }));
      await API.delete(`/${apiPath}/${deleteDocId}`);
      await fetchData(deleteDocType);
      toast.success(
        `${
          deleteDocType === "tax"
            ? "Invoice"
            : deleteDocType === "performa"
            ? "Pro Forma Invoice"
            : deleteDocType === "quotation"
            ? "Quotation"
            : "Delivery Challan"
        } deleted successfully`
      );
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          `Failed to delete ${deleteDocType} document`
      );
      console.error(`Delete ${deleteDocType} document error:`, err);
    } finally {
      setLoading((prev) => ({ ...prev, [deleteDocType]: false }));
      setShowDeleteModal(false);
      setDeleteDocId(null);
      setDeleteDocType(null);
    }
  };
  // determine key field name for current activeTab or a doc type
  const invoiceKeyForType = (type) =>
    type === "tax"
      ? "invoiceNumber"
      : type === "quotation"
      ? "quotationNumber"
      : type === "performa"
      ? "performaInvoiceNumber"
      : "deliveryChallanNumber";

  // begin editing
  const startEditInvoice = (doc, type) => {
    const key = invoiceKeyForType(type);
    setEditingId(doc._id);
    setTempInvoiceValue(doc[key] ?? "");
  };

  // perform save
  const saveInvoiceName = async (docId, type) => {
    const newValue = (tempInvoiceValue || "").trim();
    if (!newValue) {
      toast.error("Invoice number cannot be empty");
      return;
    }

    // const apiPath =
    //   type === "tax"
    //     ? "invoices"
    //     : /* similar mapping if you want */ "invoices";
    const apiPath =
      type === "tax"
        ? "invoices"
        : type === "quotation"
        ? "quotations"
        : type === "performa"
        ? "performa-invoices"
        : "delivery-challans";

    const fieldName =
      type === "tax"
        ? "invoiceNumber"
        : type === "quotation"
        ? "quotationNumber"
        : type === "performa"
        ? "performaInvoiceNumber"
        : "deliveryChallanNumber";

    try {
      setRenamingLoading(true);

      // PATCH WITH DYNAMIC KEY
      const res = await API.patch(`/${apiPath}/number/${docId}`, {
        [fieldName]: newValue, // << MAGIC FIX
      });

      toast.success("Updated successfully");
      // refresh the current tab/page
      await fetchData(type);

      setEditingId(null);
      setTempInvoiceValue("");
    } catch (err) {
      if (err?.response?.status === 409) {
        toast.error(`${newValue} already exists!`);
      } else {
        toast.error(
          err?.response?.data?.message || "Failed to update invoice number"
        );
        console.error("Rename error:", err);
      }
    } finally {
      setRenamingLoading(false);
    }
  };

  const handleConvert = (id, sourceType, targetType) => {
    setConvertDocId(id);
    setConvertDocType(sourceType);
    setConvertTargetType(targetType);
    setShowConvertModal(true);
  };

  const confirmConvert = async () => {
    const sourcePath =
      convertDocType === "tax"
        ? "converter/invoices/convert-to"
        : convertDocType === "performa"
        ? "converter/performa-invoices/convert-to"
        : convertDocType === "quotation"
        ? "converter/quotations/convert-to"
        : "converter/delivery-challans/convert-to";
    const targetPath =
      convertTargetType === "tax"
        ? "tax"
        : convertTargetType === "performa"
        ? "proforma"
        : convertTargetType === "quotation"
        ? "quotation"
        : "delivery-challan";
    try {
      setLoading((prev) => ({ ...prev, [convertDocType]: true }));
      await API.post(`/${sourcePath}-${targetPath}/${convertDocId}`);
      await Promise.all([
        fetchData(convertDocType),
        fetchData(convertTargetType),
      ]);
      toast.success(
        `Converted to ${
          convertTargetType === "tax"
            ? "Tax Invoice"
            : convertTargetType === "performa"
            ? "Pro Forma Invoice"
            : convertTargetType === "quotation"
            ? "Quotation"
            : "Delivery Challan"
        } successfully`
      );
      setShowViewer(false);
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          `Failed to convert ${convertDocType} document`
      );
      console.error(`Convert ${convertDocType} document error:`, err);
    } finally {
      setLoading((prev) => ({ ...prev, [convertDocType]: false }));
      setShowConvertModal(false);
      setConvertDocId(null);
      setConvertDocType(null);
      setConvertTargetType(null);
    }
  };

  const handleDownload = async (id, type) => {
    const apiPath =
      type === "tax"
        ? "invoices"
        : type === "performa"
        ? "performa-invoices"
        : type === "quotation"
        ? "quotations"
        : "delivery-challans";
    try {
      setLoading((prev) => ({ ...prev, [type]: true }));
      const response = await API.get(`/${apiPath}/download/${id}`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${apiPath.split("-").join("")}-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(
        `${
          type === "tax"
            ? "Invoice"
            : type === "performa"
            ? "Pro Forma Invoice"
            : type === "quotation"
            ? "Quotation"
            : "Delivery Challan"
        } downloaded successfully`
      );
    } catch (error) {
      toast.error(`Failed to download ${type} document`);
      console.error(`Download ${type} document error:`, error);
    } finally {
      setLoading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handleView = (doc, type) => {
    try {
      setViewerDoc(doc);
      setViewerId(doc._id);
      setViewerType(type);
      setShowViewer(true);
    } catch (err) {
      toast.error("Failed to open document viewer");
      console.error("View error:", err);
    }
  };

  const handleSend = async (id, type) => {
    const apiPath =
      type === "tax"
        ? "invoices"
        : type === "performa"
        ? "performa-invoices"
        : type === "quotation"
        ? "quotations"
        : "delivery-challans";
    try {
      const response = await API.get(`/${apiPath}/download/${id}`, {
        responseType: "blob",
      });
      const file = new File(
        [response.data],
        `${apiPath.split("-").join("")}-${id}.pdf`,
        { type: "application/pdf" }
      );
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Share ${
            type === "tax"
              ? "Tax Invoice"
              : type === "performa"
              ? "Proforma Invoice"
              : type === "quotation"
              ? "Quotation"
              : "Delivery Challan"
          }`,
          text: "Here is the document PDF",
        });
        toast.success("Shared successfully");
      } else {
        toast.error("Sharing not supported in this browser");
      }
    } catch (error) {
      toast.error(`Failed to prepare ${type} document for sharing`);
      console.error(`Send ${type} document error:`, error);
    }
  };

  const handleStatusChange = async (id, newStatus, type) => {
    const apiPath =
      type === "tax"
        ? "invoices"
        : type === "performa"
        ? "performa-invoices"
        : type === "quotation"
        ? "quotations"
        : "delivery-challans";
    try {
      setLoading((prev) => ({ ...prev, [type]: true }));
      await API.put(`/${apiPath}/status/${id}`, { status: newStatus });
      await fetchData(type);
      toast.success(
        `${
          type === "tax"
            ? "Invoice"
            : type === "performa"
            ? "Pro Forma Invoice"
            : type === "quotation"
            ? "Quotation"
            : "Delivery Challan"
        } status updated successfully`
      );
    } catch (err) {
      toast.error(
        err.response?.data?.error || `Failed to update ${type} document status`
      );
      console.error(`Status update ${type} document error:`, err);
    } finally {
      setLoading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status?.toLowerCase()) {
      case "draft":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "sent":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "accepted":
        return "bg-green-100 text-green-800 border-green-200";
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200";
      case "delivered":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "void":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case "draft":
        return <Clock className="w-3 h-3" />;
      case "sent":
        return <Mail className="w-3 h-3" />;
      case "accepted":
        return <CheckCircle2 className="w-3 h-3" />;
      case "rejected":
        return <XCircle className="w-3 h-3" />;
      case "delivered":
        return <CheckCircle2 className="w-3 h-3" />;
      case "void":
        return <XCircle className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const currentLoading = loading[activeTab];
  const currentDocuments = documents[activeTab];

  if (currentLoading && currentDocuments.length === 0) {
    return (
      <>
        <AppToaster />
        <Shimmer />
      </>
    );
  }

  // helper to get reverse map key for a given activeTab (used for navigation)
  const reverseTabKey = (tabKey) => {
    // prefer the canonical query values we used in Navbar
    const reverse = {
      tax: "tax",
      performa: "performa",
      quotation: "quotation",
      deliveryChallan: "deliveryChallan",
    };
    return reverse[tabKey] || "tax";
  };

  return (
    <>
      <AppToaster />

      {/* Video Tutorial Modal */}
      <VideoTutorialModal
        isOpen={showVideoTutorial}
        onClose={() => setShowVideoTutorial(false)}
        videoId={getVideoTutorial("invoices")?.videoId}
        title={getVideoTutorial("invoices")?.title}
      />
      <div className="">
        <div className="mb-4">
          {/* Header Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
            {/* Left: Icon & text */}
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2.5 rounded-xl flex-shrink-0">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  Document Management
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Create, manage, and track all your documents
                </p>
              </div>
            </div>
            {/* Right: Action buttons */}
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <VideoTutorialButton
                onClick={() => setShowVideoTutorial(true)}
                variant="minimal"
                className="w-full sm:w-auto"
              />
              <button
                onClick={async () => {
                  const canProceed = await checkBrandingBeforeInvoice();
                  if (canProceed) {
                    setEditing(null);
                    setEditingType(activeTab);
                    setShowForm(true);
                  }
                }}
                className="flex items-center justify-center gap-2 btn-primary text-white px-4 py-2.5 rounded-lg font-medium text-sm transition shadow-sm w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">
                  Add{" "}
                  {activeTab === "tax"
                    ? "Invoice"
                    : activeTab === "performa"
                    ? "Pro Forma Invoice"
                    : activeTab === "quotation"
                    ? "Quotation"
                    : "Delivery Challan"}
                </span>
                <span className="sm:hidden">
                  Add{" "}
                  {activeTab === "tax"
                    ? "Invoice"
                    : activeTab === "performa"
                    ? "Pro Forma Invoice"
                    : activeTab === "quotation"
                    ? "Quotation"
                    : "Delivery Challan"}
                </span>
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          {/* <div className="border-b border-gray-200 bg-white rounded-t-xl overflow-hidden">
            <nav className="flex overflow-x-auto whitespace-nowrap no-scrollbar px-2 sm:px-4">
              {[
                { key: "tax", label: "Invoices", color: "blue" },
                {
                  key: "performa",
                  label: "Pro Forma Invoices",
                  color: "purple",
                },
                { key: "quotation", label: "Quotations", color: "green" },
                {
                  key: "deliveryChallan",
                  label: "Delivery Challans",
                  color: "orange",
                },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    // navigate to keep URL in sync (so link / refresh works)
                    const paramValue = reverseTabKey(tab.key);
                    navigate(`/invoices?tab=${paramValue}`, { replace: false });
                  }}
                  className={`flex items-center justify-center gap-2 min-w-[130px] sm:min-w-[150px] px-3 sm:px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? `border-${tab.color}-600 text-${tab.color}-600 bg-white font-bold`
                      : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                  style={{ borderRadius: "0.75rem 0.75rem 0 0" }}
                >
                  <FileText className="w-4 h-4" />
                  <span className="truncate">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div> */}
          <div className="flex items-center text-sm font-medium text-gray-500 bg-white px-4 py-3 rounded-t-xl border-b border-gray-200">
            <span>Sales</span>
            <ChevronRight className="w-4 h-4 mx-2 text-gray-400 flex-shrink-0" />
            <span className="text-blue-600 font-semibold">
              {activeTab === "tax"
                ? "Invoices"
                : activeTab === "performa"
                ? "Pro Forma Invoices"
                : activeTab === "quotation"
                ? "Quotations"
                : "Delivery Challans"}
            </span>
          </div>
        </div>
        {showForm && editingType === "tax" && (
          <InvoiceForm
            deals={deals}
            isOpen={showForm}
            onClose={() => {
              setShowForm(false);
              setEditing(null);
              setEditingType(null);
            }}
            fetchData={() => fetchData("tax")}
            editingInvoice={editing}
            onPreview={(formData) => {
              if (!formData.style) {
                toast.error("Please select an invoice style to preview.");
                return;
              }
              setPreviewStyle(formData.style);
              setPreviewType("tax");
              setShowPreview(true);
            }}
          />
        )}
        {showForm && editingType === "performa" && (
          <PerformaInvoiceForm
            deals={deals}
            isOpen={showForm}
            onClose={() => {
              setShowForm(false);
              setEditing(null);
              setEditingType(null);
            }}
            fetchData={() => fetchData("performa")}
            editingPerformaInvoice={editing}
            onPreview={(formData) => {
              if (!formData.style) {
                toast.error(
                  "Please select a Pro Forma invoice style to preview."
                );
                return;
              }
              setPreviewStyle(formData.style);
              setPreviewType("performa");
              setShowPreview(true);
            }}
          />
        )}
        {showForm && editingType === "quotation" && (
          <QuotationForm
            deals={deals}
            isOpen={showForm}
            onClose={() => {
              setShowForm(false);
              setEditing(null);
              setEditingType(null);
            }}
            fetchData={() => fetchData("quotation")}
            editingQuotation={editing}
            onPreview={(formData) => {
              if (!formData.style) {
                toast.error("Please select a Quotation style to preview.");
                return;
              }
              setPreviewStyle(formData.style);
              setPreviewType("quotation");
              setShowPreview(true);
            }}
          />
        )}
        {showForm && editingType === "deliveryChallan" && (
          <DeliveryChallanForm
            deals={deals}
            isOpen={showForm}
            onClose={() => {
              setShowForm(false);
              setEditing(null);
              setEditingType(null);
            }}
            fetchData={() => fetchData("deliveryChallan")}
            editingDeliveryChallan={editing}
            onPreview={(formData) => {
              if (!formData.style) {
                toast.error(
                  "Please select a Delivery Challan style to preview."
                );
                return;
              }
              setPreviewStyle(formData.style);
              setPreviewType("deliveryChallan");
              setShowPreview(true);
            }}
          />
        )}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Search ${
                    activeTab === "tax" ? "" : activeTab
                  } documents by number or deal name...`}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  value={searchTerms[activeTab]}
                  onChange={(e) =>
                    setSearchTerms((prev) => ({
                      ...prev,
                      [activeTab]: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={filterStatuses[activeTab]}
                  onChange={(e) =>
                    setFilterStatuses((prev) => ({
                      ...prev,
                      [activeTab]: e.target.value,
                    }))
                  }
                  className="pl-9 pr-10 py-2.5 w-full md:w-60 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer bg-white hover:bg-gray-50 transition-colors appearance-none font-medium"
                >
                  <option value="">All Statuses</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader
                    type={activeTab}
                    field={
                      activeTab === "tax"
                        ? "invoiceNumber"
                        : activeTab === "performa"
                        ? "performaInvoiceNumber"
                        : activeTab === "quotation"
                        ? "quotationNumber"
                        : "deliveryChallanNumber"
                    }
                  >
                    {activeTab === "tax"
                      ? "Invoice #"
                      : activeTab === "performa"
                      ? "Pro Forma #"
                      : activeTab === "quotation"
                      ? "Quotation #"
                      : "Delivery Challan #"}
                  </SortableHeader>
                  <SortableHeader type={activeTab} field="deal.title">
                    <Briefcase className="w-4 h-4 inline mr-1" />
                    Deal
                  </SortableHeader>
                  <SortableHeader type={activeTab} field="date">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Issue Date
                  </SortableHeader>
                  <SortableHeader type={activeTab} field="dueDate">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Due Date
                  </SortableHeader>
                  <SortableHeader type={activeTab} field="amount">
                    <IndianRupee className="w-4 h-4 inline mr-1" />
                    Amount
                  </SortableHeader>
                  <SortableHeader type={activeTab} field="status">
                    <CheckCircle2 className="w-4 h-4 inline mr-1" />
                    Status
                  </SortableHeader>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <MoreVertical className="w-4 h-4 inline mr-1" />
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {currentLoading && currentDocuments.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mb-3"></div>
                      <p className="text-gray-600 font-medium">
                        Loading {activeTab} documents...
                      </p>
                    </td>
                  </tr>
                )}
                {!currentLoading && currentDocuments.length === 0 && (
                  <tr>
                    <td
                      colSpan="7"
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                      <p className="font-medium">
                        No {activeTab} documents found
                      </p>
                      <p className="text-sm">
                        Try adjusting your search or filters
                      </p>
                    </td>
                  </tr>
                )}
                {currentDocuments.map((doc, index) => (
                  <tr
                    key={doc?._id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {/* <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-semibold text-blue-600">
                          #
                          {doc[
                            activeTab === "tax"
                              ? "invoiceNumber"
                              : activeTab === "performa"
                              ? "performaInvoiceNumber"
                              : activeTab === "quotation"
                              ? "quotationNumber"
                              : "deliveryChallanNumber"
                          ] || "N/A"}
                        </span>
                      </div>
                    </td> */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />

                        {editingId === doc._id ? (
                          <input
                            value={tempInvoiceValue}
                            autoFocus
                            onChange={(e) =>
                              setTempInvoiceValue(e.target.value)
                            }
                            onBlur={() => saveInvoiceName(doc._id, activeTab)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                saveInvoiceName(doc._id, activeTab);
                              }
                              if (e.key === "Escape") {
                                setEditingId(null);
                                setTempInvoiceValue("");
                              }
                            }}
                            className="border px-2 py-1 text-sm rounded w-40"
                            disabled={renamingLoading}
                          />
                        ) : (
                          <span
                            onClick={() => startEditInvoice(doc, activeTab)}
                            className="text-sm font-semibold text-blue-600 cursor-pointer hover:underline"
                            title="Click to edit"
                          >
                            #
                            {
                              /* {doc[
                              activeTab === "tax"
                                ? "invoiceNumber"
                                : activeTab === "performa"
                                ? "performaInvoiceNumber"
                                : activeTab === "quotation"
                                ? "quotationNumber"
                                : "deliveryChallanNumber"
                            ] || "N/A"} */

                              doc[
                                activeTab === "tax"
                                  ? "invoiceNumber"
                                  : activeTab === "performa"
                                  ? "performaInvoiceNumber"
                                  : activeTab === "quotation"
                                  ? "quotationNumber"
                                  : "deliveryChallanNumber"
                              ]
                            }
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                      {doc.deal?.title || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {doc.date
                        ? new Date(doc.date).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {doc.dueDate
                        ? new Date(doc.dueDate).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      <h6>₹{doc.amount?.toFixed(2) || "0.00"}</h6>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={doc?.status}
                        onChange={(e) =>
                          handleStatusChange(doc._id, e.target.value, activeTab)
                        }
                        className={`inline-flex items-center gap-1 px-3 py-1.5 border rounded-lg text-xs font-semibold ${getStatusBadgeColor(
                          doc.status
                        )} focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer`}
                      >
                        {statusOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button
                          title="View"
                          onClick={() => handleView(doc, activeTab)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          title="Edit"
                          onClick={() => handleEdit(doc, activeTab)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          title="Download"
                          onClick={() => handleDownload(doc._id, activeTab)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          title="Send"
                          onClick={() => handleSend(doc._id, activeTab)}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                        <div className="relative">
                          <button
                            ref={(el) => {
                              buttonRefs.current[doc._id] = el; // Just store ref, don't call setState
                            }}
                            title="Convert"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenConvertMenu(
                                openConvertMenu === doc._id ? null : doc._id
                              );
                            }}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          >
                            <Repeat className="w-4 h-4" />
                          </button>

                          {openConvertMenu === doc._id && (
                            <div
                              className={`absolute ${
                                currentDocuments.length === 1
                                  ? "top-[-10px] -translate-y-1/2"
                                  : index === 0
                                  ? "top-1/2 -translate-y-1/2"
                                  : "bottom-full mb-2"
                              } right-0 w-60 bg-white rounded-lg shadow-lg border border-gray-200 z-50`}
                            >
                              <div className="py-1">
                                {[
                                  "tax",
                                  "performa",
                                  "quotation",
                                  "deliveryChallan",
                                ]
                                  .filter((t) => t !== activeTab)
                                  .map((targetType) => (
                                    <button
                                      key={targetType}
                                      onClick={() => {
                                        handleConvert(
                                          doc._id,
                                          activeTab,
                                          targetType
                                        );
                                        setOpenConvertMenu(null);
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                    >
                                      <Repeat className="w-4 h-4 text-orange-600" />
                                      Convert to{" "}
                                      {targetType === "tax"
                                        ? "Tax Invoice"
                                        : targetType === "performa"
                                        ? "Pro Forma Invoice"
                                        : targetType === "quotation"
                                        ? "Quotation"
                                        : "Delivery Challan"}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          title="Delete"
                          onClick={() => handleDelete(doc._id, activeTab)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!currentLoading && <PaginationControls type={activeTab} />}
        </div>
        {showPreview && previewType === "tax" && (
          <InvoiceStylePreview
            style={previewStyle}
            isOpen={showPreview}
            onClose={() => {
              setShowPreview(false);
              setPreviewStyle(null);
              setPreviewType(null);
            }}
          />
        )}
        {showPreview && previewType === "performa" && (
          <PerformaInvoiceStylePreview
            style={previewStyle}
            isOpen={showPreview}
            onClose={() => {
              setShowPreview(false);
              setPreviewStyle(null);
              setPreviewType(null);
            }}
          />
        )}
        {showPreview && previewType === "quotation" && (
          <InvoiceStylePreview
            style={previewStyle}
            isOpen={showPreview}
            onClose={() => {
              setShowPreview(false);
              setPreviewStyle(null);
              setPreviewType(null);
            }}
          />
        )}
        {showPreview && previewType === "deliveryChallan" && (
          <InvoiceStylePreview
            style={previewStyle}
            isOpen={showPreview}
            onClose={() => {
              setShowPreview(false);
              setPreviewStyle(null);
              setPreviewType(null);
            }}
          />
        )}
        <InvoiceViewer
          isOpen={showViewer}
          onClose={() => {
            setShowViewer(false);
            setViewerId(null);
            setViewerType(null);
            setViewerDoc(null);
          }}
          id={viewerId}
          type={viewerType}
          doc={viewerDoc}
          onEdit={() => {
            setShowViewer(false);
            handleEdit(viewerDoc, viewerType);
          }}
          onDownload={() => handleDownload(viewerId, viewerType)}
          onSend={() => handleSend(viewerId, viewerType)}
          onConvert={(targetType) =>
            handleConvert(viewerId, viewerType, targetType)
          }
        />
        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={confirmDelete}
          docType={deleteDocType}
        />
        <ConvertConfirmModal
          isOpen={showConvertModal}
          onClose={() => setShowConvertModal(false)}
          onConfirm={confirmConvert}
          docType={convertDocType}
          targetType={convertTargetType}
        />
        <QuickBrandingModal
          isOpen={showBrandingModal}
          onClose={() => {
            setShowBrandingModal(false);
            setPendingInvoiceCreation(false);
          }}
          onComplete={() => {
            if (pendingInvoiceCreation) {
              setEditing(null);
              setEditingType(activeTab);
              setShowForm(true);
              setPendingInvoiceCreation(false);
            }
          }}
        />
      </div>
    </>
  );
};

export default MergedInvoiceManager;
