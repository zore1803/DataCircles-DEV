import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
} from "react";
import {
  MoreVertical,
  Plus,
  SlidersHorizontal,
  FileText,
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
  X,
  AlertCircle,
  Calendar,
  Briefcase,
  Clock,
  CheckCircle2,
  IndianRupee,
  Pin,
  PinOff,
  EyeOff,
  CheckSquare,
  LayoutTemplate,
  Settings,
  Search,
  Share2,
  MessageCircle,
  Mail,
  Copy,
  MessageSquare,
} from "lucide-react";
import { createPortal } from "react-dom";
import API from "../services/api";
import SearchIcon from "../components/common/SearchIcon";
import AppToaster from "../components/AppToaster";
import { useSubscription } from "../contexts/SubscriptionContext";
import { hasMinPlan } from "../utils/subscriptionHelpers";
import UpgradeRequiredModal from "../components/subscription/UpgradeRequiredModal";
import HighlightText from "../components/common/HighlightText";
import { formatNumberFixed } from "../utils/numberFormatter";
import InvoiceForm, { CreateInvoicePanel } from "../components/invoice/InvoiceForm";
import PerformaInvoiceForm from "../components/PerformaInvoice/PerformaInvoiceForm";
import { CreatePerformaPanel } from "../components/PerformaInvoice/PerformaInvoiceForm";
import PerformaInvoiceFormFull from "../components/PerformaInvoice/PerformaInvoiceFormFull";
import QuotationForm from "../components/quotation/QuotationForm";
import { CreateQuotationPanel } from "../components/quotation/QuotationForm";
import InvoiceFormFull from "../components/invoice/InvoiceFormFull";
import DeliveryChallanForm from "../components/deliveryChallan/DeliveryChallanForm";
import { CreateChallanPanel } from "../components/deliveryChallan/DeliveryChallanForm";
import DeliveryChallanFormFull from "../components/deliveryChallan/DeliveryChallanFormFull";
import InvoiceStylePreview from "../components/invoice/InvoiceStylePreview";
import TemplateDrawer from "../components/invoice/TemplateDrawer";
import useNavReset from "../hooks/useNavReset";
import PerformaInvoiceStylePreview from "../components/PerformaInvoice/PerformaInvoiceStylePreview";
import QuickBrandingModal from "../components/invoice/QuickBrandingModal";
import QuickDealForm from "../components/deal/QuickDealForm";
import { getAncestorZoom } from "../utils/domUtils";
import { exportToCSV } from "../utils/exportToCSV";
import useMinDelay from "../hooks/useMinDelay";
import { useTopLoadingSignal } from "../components/common/TopLoadingBar";
import Skeleton from "../components/common/Skeleton";
import TableSkeletonRows from "../components/common/TableSkeletonRows";
import useSearchOverlayOpen from "../hooks/useSearchOverlayOpen";

import { getPinnedBoundaryOverlayStyle } from "../utils/pinnedColumnShadow";
/* Drops the organization's saved boilerplate (Settings → document defaults)
   into a notes/terms box, so the same footer text doesn't have to be retyped
   on every document. Disabled — with the reason in the tooltip — when there's
   nothing saved yet or the box already holds exactly that text; appends rather
   than overwrites when the box has other content. */
/* Opens the Notes & Terms drawer. Inserting the saved default text now lives
   inside that drawer, next to the field it applies to. */
const OpenNotesTermsButton = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title="Edit notes and terms"
    className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0085FF] hover:underline flex-shrink-0"
  >
    <Plus className="w-3 h-3" />
    {label}
  </button>
);

/* Tab labels shown in the pill selector, mapped to the document type keys the
   API (and Invoices1) already use. */
const TABS = [
  { label: "Invoices", key: "tax" },
  { label: "Pro Forma Invoices", key: "performa" },
  { label: "Quotations", key: "quotation" },
  { label: "Delivery Challans", key: "deliveryChallan" },
];

const statusOptions = [
  "Draft",
  "Sent",
  "Paid",
  "Accepted",
  "Rejected",
  "Delivered",
  "Void",
];

const apiPathFor = (type) =>
  type === "tax"
    ? "invoices"
    : type === "performa"
      ? "performa-invoices"
      : type === "quotation"
        ? "quotations"
        : "delivery-challans";

const dataKeyFor = (type) =>
  type === "tax"
    ? "invoices"
    : type === "performa"
      ? "performaInvoices"
      : type === "quotation"
        ? "quotations"
        : "deliveryChallans";

const numberKeyFor = (type) =>
  type === "tax"
    ? "invoiceNumber"
    : type === "performa"
      ? "performaInvoiceNumber"
      : type === "quotation"
        ? "quotationNumber"
        : "deliveryChallanNumber";

const docNameFor = (type) =>
  type === "tax"
    ? "Invoice"
    : type === "performa"
      ? "Pro Forma Invoice"
      : type === "quotation"
        ? "Quotation"
        : "Delivery Challan";

const pluralNameFor = (type) =>
  type === "tax"
    ? "Invoices"
    : type === "performa"
      ? "Pro Forma Invoices"
      : type === "quotation"
        ? "Quotations"
        : "Delivery Challans";

/* Starting width per column; each one is draggable from its right-hand border. */
const DEFAULT_COL_WIDTHS = {
  selection: 60,
  number: 200,
  deal: 260,
  date: 170,
  dueDate: 170,
  amount: 170,
  status: 170,
  actions: 230,
};
const MIN_COL_WIDTH = 60;

/* One definition per data column. The header row, the body cells, the column
   popup menu and the reorder logic are all driven off this list, so all four
   tabs share exactly the same column behaviour. */
const COLUMN_DEFS = [
  {
    id: "number",
    label: (tab) => (tab === "tax" ? "Invoice ID" : "Document ID"),
    icon: FileText,
    field: (tab) => numberKeyFor(tab),
  },
  { id: "deal", label: "Deal", icon: Briefcase, field: "deal.title" },
  { id: "date", label: "Issue Date", icon: Calendar, field: "date" },
  { id: "dueDate", label: "Due Date", icon: Clock, field: "dueDate" },
  { id: "amount", label: "Amount", icon: IndianRupee, field: "amount" },
  { id: "status", label: "Status", icon: CheckCircle2, field: "status" },
  {
    id: "actions",
    label: "Actions",
    icon: MoreVertical,
    field: null,
    required: true,
  },
];

/* Sits on the column's right-hand border. Module-scope + memo so the header
   cells don't remount it on every parent render. Stops click and the header's
   drag-start from firing while a resize is in progress. */
const ColumnResizeHandle = React.memo(({ colId, onResizeStart }) => (
  <div
    data-resize-handle="true"
    onMouseDown={(e) => onResizeStart(e, colId)}
    onClick={(e) => e.stopPropagation()}
    title="Drag to resize column"
    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none z-30 hover:bg-[#0085FF]/40 active:bg-[#0085FF]"
  />
));
ColumnResizeHandle.displayName = "ColumnResizeHandle";

const fieldFor = (col, tab) =>
  typeof col.field === "function" ? col.field(tab) : col.field;

/* Plain-text value for a cell — used by the drag ghost so the floating panel
   shows the column's real contents while it's being moved. */
const cellText = (colId, doc, tab) => {
  switch (colId) {
    case "number":
      return `#${doc[numberKeyFor(tab)] ?? ""}`;
    case "deal":
      return doc.deal?.title || "N/A";
    case "date":
      return doc.date ? new Date(doc.date).toLocaleDateString() : "N/A";
    case "dueDate":
      return doc.dueDate ? new Date(doc.dueDate).toLocaleDateString() : "N/A";
    case "amount":
      return `₹${formatNumberFixed(doc.amount)}`;
    case "status":
      return doc.status || "—";
    default:
      return "—";
  }
};

const getStatusBadgeColor = (status) => {
  switch (status?.toLowerCase()) {
    case "draft":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "sent":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "paid":
      return "bg-green-100 text-green-800 border-green-200";
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

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, docType }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100003]">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-red-100 p-2 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Confirm Deletion</h2>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete this {docNameFor(docType)}? This action
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
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100003]">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-purple-100 p-2 rounded-lg">
            <Repeat className="w-5 h-5 text-purple-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Confirm Conversion</h2>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to convert this {docNameFor(docType)} to a{" "}
          {docNameFor(targetType)}? The original document will be deleted.
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
  // Standard Indian GST invoice practice: the same document is printed as
  // three otherwise-identical copies, distinguished only by this label —
  // "ORIGINAL FOR RECIPIENT" for the customer, "DUPLICATE FOR TRANSPORTER"
  // for the goods carrier, "TRIPLICATE FOR SUPPLIER" for the seller's own
  // records. Re-fetches the PDF with the chosen label baked in.
  const [copyType, setCopyType] = useState("original");

  useEffect(() => {
    if (isOpen && id && type) {
      fetchPdf();
    }
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, id, type, copyType]);

  const fetchPdf = async () => {
    try {
      const response = await API.get(`/${apiPathFor(type)}/download/${id}`, {
        responseType: "blob",
        params: { copyType },
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      setPdfUrl(URL.createObjectURL(blob));
    } catch (error) {
      toast.error("Failed to load PDF");
      console.error("PDF fetch error:", error);
      onClose();
    }
  };

  const handleDownloadCurrentCopy = () => {
    if (!pdfUrl) return;
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.setAttribute("download", `${apiPathFor(type)}-${docNumber || id}-${copyType}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const isTax =
    type === "tax"
      ? doc?.items?.some((item) => item.hsn && item.hsn.trim() !== "")
      : false;
  const title = type === "tax" ? (isTax ? "Tax Invoice" : "Invoice") : docNameFor(type);
  const docNumber = doc?.[numberKeyFor(type)];

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
                {title} #{docNumber || "N/A"}
              </h2>
              <p className="text-sm text-gray-600">View and manage document</p>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <select
              title="Copy type"
              value={copyType}
              onChange={(e) => setCopyType(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="original">Original for Recipient</option>
              <option value="duplicate">Duplicate for Transporter</option>
              <option value="triplicate">Triplicate for Supplier</option>
            </select>
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
                onClick={handleDownloadCurrentCopy}
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
                  title="Share"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenConvertMenu(openConvertMenu === "share" ? null : "share");
                  }}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                {openConvertMenu === "share" && (
                  <div className="absolute right-0 mt-1 w-60 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="py-1">
                      {[
                        {
                          label: "WhatsApp",
                          icon: MessageCircle,
                          iconClass: "text-green-600",
                          onClick: () => {
                            const url = `${window.location.origin}/accounting?view=${type}&id=${id}`;
                            const text = `${title} #${docNumber || ""}\n${url}`;
                            window.open(
                              `https://wa.me/?text=${encodeURIComponent(text)}`,
                              "_blank",
                              "noopener,noreferrer"
                            );
                          },
                        },
                        {
                          label: "Email",
                          icon: Mail,
                          iconClass: "text-blue-600",
                          onClick: () => {
                            const url = `${window.location.origin}/accounting?view=${type}&id=${id}`;
                            const subject = `${title} #${docNumber || ""}`;
                            window.location.href = `mailto:?subject=${encodeURIComponent(
                              subject
                            )}&body=${encodeURIComponent(url)}`;
                          },
                        },
                        {
                          label: "SMS",
                          icon: MessageSquare,
                          iconClass: "text-indigo-600",
                          onClick: () => {
                            const url = `${window.location.origin}/accounting?view=${type}&id=${id}`;
                            const text = `${title} #${docNumber || ""} - ${url}`;
                            window.location.href = `sms:?body=${encodeURIComponent(text)}`;
                          },
                        },
                        {
                          label: "Copy Link",
                          icon: Copy,
                          iconClass: "text-gray-600",
                          onClick: async () => {
                            const url = `${window.location.origin}/accounting?view=${type}&id=${id}`;
                            try {
                              await navigator.clipboard.writeText(url);
                              toast.success("Link copied to clipboard");
                            } catch {
                              toast.error("Failed to copy link");
                            }
                          },
                        },
                      ].map((option) => (
                        <button
                          key={option.label}
                          onClick={() => {
                            option.onClick();
                            setOpenConvertMenu(null);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                        >
                          <option.icon className={`w-4 h-4 ${option.iconClass}`} />
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
                              : docNameFor(targetType)}
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

const Accounting = () => {
  const isSearchOverlayOpen = useSearchOverlayOpen();
  const [activeTab, setActiveTab] = useState("tax");
  const tabRefs = useRef({});
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const el = tabRefs.current[activeTab];
    if (el) setTabIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [activeTab]);

  const emptyByType = { tax: "", performa: "", quotation: "", deliveryChallan: "" };
  // Tracks whether each tab has completed at least one fetch, so a
  // search/filter that narrows results to zero doesn't re-trigger the
  // toolbar/search-bar skeleton — that unmounted the search input mid-typing
  // and read as the whole page reloading on every keystroke.
  const hasLoadedOnceRef = useRef({
    tax: false,
    performa: false,
    quotation: false,
    deliveryChallan: false,
  });
  const emptyPagination = {
    currentPage: 1,
    totalPages: 0,
    totalCount: 0,
    limit: 50,
    hasNextPage: false,
    hasPrevPage: false,
  };

  const [deals, setDeals] = useState([]);
  const [documents, setDocuments] = useState({
    tax: [],
    performa: [],
    quotation: [],
    deliveryChallan: [],
  });
  const [loading, setLoading] = useState({
    tax: false,
    performa: false,
    quotation: false,
    deliveryChallan: false,
  });
  const [searchTerms, setSearchTerms] = useState(emptyByType);
  const [debouncedSearchTerms, setDebouncedSearchTerms] = useState(emptyByType);
  const [filterStatuses, setFilterStatuses] = useState(emptyByType);
  const [debouncedFilterStatuses, setDebouncedFilterStatuses] =
    useState(emptyByType);
  const [paginations, setPaginations] = useState({
    tax: { ...emptyPagination },
    performa: { ...emptyPagination },
    quotation: { ...emptyPagination },
    deliveryChallan: { ...emptyPagination },
  });
  const [sortConfigs, setSortConfigs] = useState({
    tax: { key: "invoiceNumber", direction: "desc" },
    performa: { key: "performaInvoiceNumber", direction: "desc" },
    quotation: { key: "quotationNumber", direction: "desc" },
    deliveryChallan: { key: "deliveryChallanNumber", direction: "desc" },
  });

  // Column widths — drag the divider on a header's right edge to shrink/widen it.
  const [colWidths, setColWidths] = useState({ ...DEFAULT_COL_WIDTHS });
  const resizeRef = useRef(null);

  const startColumnResize = (e, colId) => {
    e.preventDefault();
    e.stopPropagation();
    // Start width is measured from the rendered <th> rather than read out of
    // colWidths state, so this handler never closes over stale state and its
    // identity can stay stable across renders.
    const th = e.currentTarget.closest("th");
    resizeRef.current = {
      colId,
      startX: e.clientX,
      startWidth: th ? th.getBoundingClientRect().width : MIN_COL_WIDTH,
    };

    const onMove = (moveEvent) => {
      const r = resizeRef.current;
      if (!r) return;
      const next = Math.max(
        MIN_COL_WIDTH,
        r.startWidth + (moveEvent.clientX - r.startX)
      );
      setColWidths((prev) => ({ ...prev, [r.colId]: next }));
    };

    const onUp = () => {
      resizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const ResizeHandle = useCallback(
    ({ colId }) => (
      <ColumnResizeHandle colId={colId} onResizeStart={startColumnResize} />
    ),
    // startColumnResize reads its start width from the DOM at mousedown, so it
    // holds no stale state and this identity can stay stable across renders.
    []
  );

  // Column order / visibility / pinning — shared by all four tabs.
  const [columnOrder, setColumnOrder] = useState(COLUMN_DEFS.map((c) => c.id));
  const [hiddenCols, setHiddenCols] = useState([]);
  const [pinnedCols, setPinnedCols] = useState({});
  const [openColumnMenuKey, setOpenColumnMenuKey] = useState(null);
  const [columnMenuPos, setColumnMenuPos] = useState(null);
  const [draggedColKey, setDraggedColKey] = useState(null);
  const [dragOverColKey, setDragOverColKey] = useState(null);
  const [dragGhost, setDragGhost] = useState(null);
  const dragOverRef = useRef(null);
  const ghostElRef = useRef(null);

  const orderedColumns = useMemo(
    () =>
      columnOrder
        .map((id) => COLUMN_DEFS.find((c) => c.id === id))
        .filter((c) => c && !hiddenCols.includes(c.id))
        .sort((a, b) => {
          const rank = (c) =>
            pinnedCols[c.id] === "left"
              ? 0
              : pinnedCols[c.id] === "right"
                ? 2
                : 1;
          return rank(a) - rank(b);
        }),
    [columnOrder, hiddenCols, pinnedCols]
  );

  /* Pinned columns ride along on horizontal scroll. The selection checkbox is
     always the first left-sticky column, so left offsets start after it.
     Precomputed once per layout change rather than per cell. */
  const stickyStyles = useMemo(() => {
    const map = {};
    let leftOffset = colWidths.selection;
    for (const c of orderedColumns) {
      if (pinnedCols[c.id] === "left") {
        map[c.id] = { position: "sticky", left: leftOffset, zIndex: 15 };
        leftOffset += colWidths[c.id];
      }
    }
    let rightOffset = 0;
    for (const c of [...orderedColumns].reverse()) {
      if (pinnedCols[c.id] === "right") {
        map[c.id] = { position: "sticky", right: rightOffset, zIndex: 15 };
        rightOffset += colWidths[c.id];
      }
    }
    return map;
  }, [orderedColumns, pinnedCols, colWidths]);

  const stickyStyleFor = useCallback(
    (colId) => stickyStyles[colId] || {},
    [stickyStyles]
  );

  // Boundary shadow — same treatment as Companies: a soft edge on the
  // RIGHTMOST left-pinned column and the LEFTMOST right-pinned column, the
  // ones actually touching the scrollable content on screen.
  const lastLeftPinnedKey = useMemo(() => {
    const keys = orderedColumns.filter((c) => pinnedCols[c.id] === "left").map((c) => c.id);
    return keys.length ? keys[keys.length - 1] : null;
  }, [orderedColumns, pinnedCols]);
  const firstRightPinnedKey = useMemo(() => {
    const key = orderedColumns.find((c) => pinnedCols[c.id] === "right")?.id;
    return key || null;
  }, [orderedColumns, pinnedCols]);
  const boundaryShadowSideFor = useCallback(
    (colId) => {
      if (colId === lastLeftPinnedKey) return "left";
      if (colId === firstRightPinnedKey) return "right";
      return null;
    },
    [lastLeftPinnedKey, firstRightPinnedKey]
  );

  const closeColumnMenu = useCallback(() => {
    setOpenColumnMenuKey(null);
    setColumnMenuPos(null);
  }, []);

  const openColumnMenu = (e, colId) => {
    e.stopPropagation();
    if (openColumnMenuKey === colId) return closeColumnMenu();
    // rect is VISUAL px; the menu portals to document.body, which paints
    // inside this app's dynamic <html> zoom, so every rect-derived value has
    // to be divided by that zoom or it drifts further left the further right
    // the button sits — barely visible on columns 1-2, way off by column 6.
    // Same correction Companies.jsx uses for its column menu.
    const zMenu = getAncestorZoom(document.body);
    const MENU_W = 176;
    const MARGIN = 8;
    const rect = e.currentTarget.getBoundingClientRect();
    const viewportW = window.innerWidth / zMenu;
    let left = Math.min(rect.right / zMenu - MENU_W, viewportW - MENU_W - MARGIN);
    left = Math.max(left, MARGIN);
    setColumnMenuPos({ top: rect.bottom / zMenu + 4, left });
    setOpenColumnMenuKey(colId);
  };

  const handleColumnReorder = useCallback((draggedKey, targetKey) => {
    if (!draggedKey || draggedKey === targetKey) return;
    setColumnOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(draggedKey);
      const to = next.indexOf(targetKey);
      if (from === -1 || to === -1) return prev;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  /* Press-and-drag column reorder, same mechanics as Contacts.jsx: a 5px
     movement threshold so a plain click never starts a drag, a body-portalled
     ghost carrying the header plus its cell values, and a drop resolved from
     whatever <th data-col-id> is under the pointer on mouseup. */
  const startColumnDrag = (e, colId) => {
    if (e.button !== 0) return;
    if (e.target.closest("button") || e.target.closest("[data-resize-handle]"))
      return;

    const th = e.currentTarget;
    const startX = e.clientX;
    const startY = e.clientY;
    const DRAG_THRESHOLD = 5;

    const dragState = { started: false, offsetX: 0, offsetY: 0, zGhost: 1 };

    const positionGhost = (clientX, clientY) => {
      const el = ghostElRef.current;
      if (!el) return;
      const visualTop = clientY - dragState.offsetY;
      const visualLeft = clientX - dragState.offsetX;
      el.style.top = `${visualTop / dragState.zGhost}px`;
      el.style.left = `${visualLeft / dragState.zGhost}px`;
      el.style.maxHeight = `${Math.max(100, window.innerHeight - visualTop - 72) / dragState.zGhost
        }px`;
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
      closeColumnMenu();

      const rect = th.getBoundingClientRect();
      const col = COLUMN_DEFS.find((c) => c.id === colId);
      const label =
        typeof col?.label === "function" ? col.label(activeTab) : col?.label;
      const previewRows = (documents[activeTab] || []).map((doc) =>
        cellText(colId, doc, activeTab)
      );

      // Grab offset is measured in visual space; zGhost maps the values we set
      // on the body-portalled ghost back into that same space.
      dragState.zGhost = getAncestorZoom(document.body);
      dragState.offsetX = startX - rect.left;
      dragState.offsetY = startY - rect.top;

      dragOverRef.current = null;
      setDraggedColKey(colId);
      setDragOverColKey(null);
      document.body.style.userSelect = "none";
      setDragGhost({
        label,
        previewRows,
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
      if (overKey && overKey !== colId) handleColumnReorder(colId, overKey);
      dragOverRef.current = null;
      setDraggedColKey(null);
      setDragOverColKey(null);
      setDragGhost(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const setColumnPin = useCallback(
    (colId, side) =>
      setPinnedCols((prev) => {
        const next = { ...prev };
        if (next[colId] === side) delete next[colId];
        else next[colId] = side;
        return next;
      }),
    []
  );

  const tableWidth = useMemo(
    () => Object.values(colWidths).reduce((a, b) => a + b, 0),
    [colWidths]
  );

  // UI state
  const [selectedIds, setSelectedIds] = useState([]);
  const { subscription } = useSubscription();
  const hasBulkAccess = hasMinPlan(subscription?.subscription?.planName, "growth");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [editPanelDoc, setEditPanelDoc] = useState(null);
  const [conversionData, setConversionData] = useState(null);
  const [showQuickDealForm, setShowQuickDealForm] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showForm, setShowForm] = useState(false);
  // Quotations open in the shared split view (form + live preview) by default;
  // the header's expand button swaps to the dedicated full-width QuotationForm,
  // which carries the extended field set. Reset whenever the panel closes so a
  // later quotation always starts back in split view.
  const [quotationFullWidth, setQuotationFullWidth] = useState(false);
  const [invoiceFullWidth, setInvoiceFullWidth] = useState(false);
  const [performaFullWidth, setPerformaFullWidth] = useState(false);
  const [challanFullWidth, setChallanFullWidth] = useState(false);
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
  const [convertMenuPos, setConvertMenuPos] = useState(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showTemplateDrawer, setShowTemplateDrawer] = useState(false);
  const [showBrandingModal, setShowBrandingModal] = useState(false);
  const [pendingInvoiceCreation, setPendingInvoiceCreation] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState(null);
  const [deleteDocType, setDeleteDocType] = useState(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [bulkUpdateStatus, setBulkUpdateStatus] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  // Delays the bulk-strip's unmount so it can play a slide-out-right exit
  // animation on deselect (mirroring the slide-in-left entrance) — same as
  // the Companies page.
  const [showBulkStrip, setShowBulkStrip] = useState(false);
  const [bulkStripClosing, setBulkStripClosing] = useState(false);
  useEffect(() => {
    const active = selectedIds.length > 0;
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
  }, [selectedIds.length]);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertDocId, setConvertDocId] = useState(null);
  const [convertDocType, setConvertDocType] = useState(null);
  const [convertTargetType, setConvertTargetType] = useState(null);

  // Clicking "Accounting" in the sidebar while already here should come back to
  // the plain list, the same way it would if you'd navigated in from elsewhere.
  // The create/edit panel, viewer and drawers are overlays rather than routes,
  // so the router can't clear them on its own.
  useNavReset(() => {
    setShowCreatePanel(false);
    setEditPanelDoc(null);
    setShowViewer(false);
    setViewerId(null);
    setViewerType(null);
    setViewerDoc(null);
    setShowTemplateDrawer(false);
    setShowBrandingModal(false);
    setShowDeleteModal(false);
    setShowBulkDeleteModal(false);
    setShowBulkUpdateModal(false);
    setShowConvertModal(false);
    setShowFilterMenu(false);
    setShowMoreMenu(false);
    setOpenConvertMenu(null);
    setConvertMenuPos(null);
    setSelectedIds([]);
    setPreviewType(null);
  });

  useEffect(() => {
    const handleClickOutside = () => {
      if (openConvertMenu) {
        setOpenConvertMenu(null);
        setConvertMenuPos(null);
      }
      if (showFilterMenu) setShowFilterMenu(false);
      if (showMoreMenu) setShowMoreMenu(false);
    };
    // The convert menu is fixed-positioned, so any scroll would leave it
    // floating at stale coordinates — close it instead of tracking.
    const handleScroll = () => {
      if (openConvertMenu) {
        setOpenConvertMenu(null);
        setConvertMenuPos(null);
      }
    };
    if (openConvertMenu || showFilterMenu || showMoreMenu) {
      document.addEventListener("click", handleClickOutside);
      window.addEventListener("scroll", handleScroll, true);
    }
    return () => {
      document.removeEventListener("click", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [openConvertMenu, showFilterMenu, showMoreMenu]);

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

  // The fetch effects below key off these primitives rather than the whole
  // per-tab objects, so they're statically checkable and only re-run when the
  // value that actually drives a refetch changes.
  const activePage = paginations[activeTab]?.currentPage;
  const activeLimit = paginations[activeTab]?.limit;
  const activeSort = sortConfigs[activeTab];
  const activeSearch = debouncedSearchTerms[activeTab];
  const activeStatusFilter = debouncedFilterStatuses[activeTab];

  // Selections belong to the rows currently on screen, so drop them whenever
  // the tab or page changes.
  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab, activePage]);

  useEffect(() => {
    fetchData(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage, activeLimit, activeSort, activeTab]);

  useEffect(() => {
    if (activePage === 1) fetchData(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSearch, activeStatusFilter, activeTab]);

  useEffect(() => {
    fetchDeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDeals = useCallback(async () => {
    try {
      const res = await API.get("/deals");
      setDeals(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load deals");
      console.error("Fetch deals error:", err);
    }
  }, []);

  const fetchData = async (type) => {
    setLoading((prev) => ({ ...prev, [type]: true }));
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
      const res = await API.get(
        `/${apiPathFor(type)}/pagination?${params.toString()}`
      );
      setDocuments((prev) => ({
        ...prev,
        [type]: res.data[dataKeyFor(type)] || [],
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
        err.response?.data?.error || `Failed to load ${pluralNameFor(type)}`
      );
      console.error(`Fetch ${type} documents error:`, err.response?.data);
    } finally {
      setLoading((prev) => ({ ...prev, [type]: false }));
      hasLoadedOnceRef.current[type] = true;
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

  const handleSelectAll = () => {
    if (!hasBulkAccess) {
      setShowUpgradeModal(true);
      return;
    }
    setSelectedIds((prev) =>
      prev.length === currentDocuments.length && currentDocuments.length > 0
        ? []
        : currentDocuments.map((doc) => doc._id)
    );
  };

  const handleSelectOne = (id) => {
    if (!hasBulkAccess) {
      setShowUpgradeModal(true);
      return;
    }
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Bulk delete every selected document on the active tab. There's no
  // dedicated batch endpoint, so fan out the single-delete route in parallel.
  const confirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const type = activeTab;
    try {
      setBulkDeleting(true);
      setLoading((prev) => ({ ...prev, [type]: true }));
      const results = await Promise.allSettled(
        selectedIds.map((id) => API.delete(`/${apiPathFor(type)}/${id}`))
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      await fetchData(type);
      setSelectedIds([]);
      if (failed === 0) {
        toast.success(
          `${selectedIds.length} ${docNameFor(type)}${selectedIds.length !== 1 ? "s" : ""
          } deleted successfully`
        );
      } else {
        toast.error(`Failed to delete ${failed} of ${selectedIds.length} documents`);
      }
    } catch (err) {
      toast.error(`Failed to delete ${type} documents`);
      console.error(`Bulk delete ${type} documents error:`, err);
    } finally {
      setBulkDeleting(false);
      setLoading((prev) => ({ ...prev, [type]: false }));
      setShowBulkDeleteModal(false);
    }
  };

  // Export the selected rows on the active tab to a CSV, client-side.
  const handleExportSelected = () => {
    if (selectedIds.length === 0) return;
    const selectedSet = new Set(selectedIds);
    const docs = currentDocuments.filter((d) => selectedSet.has(d._id));
    if (docs.length === 0) return;
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["ID", "Deal", "Issue Date", "Due Date", "Amount", "Status"];
    const rows = docs.map((d) =>
      [
        `#${d[numberKeyFor(activeTab)] ?? ""}`,
        d.deal?.title || "N/A",
        d.date ? new Date(d.date).toLocaleDateString() : "",
        d.dueDate ? new Date(d.dueDate).toLocaleDateString() : "",
        d.amount ?? 0,
        d.status || "",
      ]
        .map(esc)
        .join(",")
    );
    exportToCSV(
      [header.map(esc).join(","), ...rows],
      `${apiPathFor(activeTab)}-export.csv`
    );
    toast.success(`Exported ${docs.length} ${docNameFor(activeTab)}${docs.length !== 1 ? "s" : ""}`);
  };

  // Bulk update: apply a chosen status to every selected document. Fans out the
  // single-status route in parallel since there's no batch endpoint.
  const confirmBulkUpdate = async () => {
    if (selectedIds.length === 0 || !bulkUpdateStatus) return;
    const type = activeTab;
    try {
      setBulkUpdating(true);
      setLoading((prev) => ({ ...prev, [type]: true }));
      const results = await Promise.allSettled(
        selectedIds.map((id) =>
          API.put(`/${apiPathFor(type)}/status/${id}`, {
            status: bulkUpdateStatus,
          })
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      await fetchData(type);
      setSelectedIds([]);
      if (failed === 0) {
        toast.success(
          `${results.length} ${docNameFor(type)}${results.length !== 1 ? "s" : ""
          } updated to ${bulkUpdateStatus}`
        );
      } else {
        toast.error(`Failed to update ${failed} of ${selectedIds.length} documents`);
      }
    } catch (err) {
      toast.error(`Failed to update ${type} documents`);
      console.error(`Bulk update ${type} documents error:`, err);
    } finally {
      setBulkUpdating(false);
      setLoading((prev) => ({ ...prev, [type]: false }));
      setShowBulkUpdateModal(false);
      setBulkUpdateStatus("");
    }
  };

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
      return true;
    }
  };

  // Repointed to the same two-pane CreateInvoicePanel the document number/
  // title click and the "Add [Document]" button use, so the pencil icon no
  // longer opens the legacy per-type *Form.jsx components. CreateInvoicePanel
  // does its own item/date normalization from the raw doc, same as the
  // number-click handler below.
  const handleEdit = (doc, type) => {
    if (activeTab !== type) setActiveTab(type);
    setEditPanelDoc(doc);
    setShowCreatePanel(true);
  };

  const handleDelete = (id, type) => {
    setDeleteDocId(id);
    setDeleteDocType(type);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      setLoading((prev) => ({ ...prev, [deleteDocType]: true }));
      await API.delete(`/${apiPathFor(deleteDocType)}/${deleteDocId}`);
      await fetchData(deleteDocType);
      toast.success(`${docNameFor(deleteDocType)} deleted successfully`);
    } catch (err) {
      toast.error(
        err.response?.data?.error || `Failed to delete ${deleteDocType} document`
      );
      console.error(`Delete ${deleteDocType} document error:`, err);
    } finally {
      setLoading((prev) => ({ ...prev, [deleteDocType]: false }));
      setShowDeleteModal(false);
      setDeleteDocId(null);
      setDeleteDocType(null);
    }
  };

  const handleConvert = (id, sourceType, targetType) => {
    setConvertDocId(id);
    setConvertDocType(sourceType);
    setConvertTargetType(targetType);
    setShowConvertModal(true);
  };

  const confirmConvert = async () => {
    const sourceDoc = documents[convertDocType].find((d) => d._id === convertDocId);
    if (!sourceDoc) {
      toast.error("Source document not found. Please refresh.");
      return;
    }

    setShowConvertModal(false);
    setOpenConvertMenu(null);

    setConversionData(sourceDoc);
    setActiveTab(convertTargetType);
    setShowCreatePanel(true);
    setShowViewer(false);

    setConvertDocId(null);
    setConvertDocType(null);
    setConvertTargetType(null);
  };

  const handleDownload = async (id, type) => {
    const path = apiPathFor(type);
    try {
      setLoading((prev) => ({ ...prev, [type]: true }));
      const response = await API.get(`/${path}/download/${id}`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${path.split("-").join("")}-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${docNameFor(type)} downloaded successfully`);
    } catch (error) {
      toast.error(`Failed to download ${type} document`);
      console.error(`Download ${type} document error:`, error);
    } finally {
      setLoading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handleView = (doc, type) => {
    setViewerDoc(doc);
    setViewerId(doc._id);
    setViewerType(type);
    setShowViewer(true);
  };

  const handleSend = async (id, type) => {
    const path = apiPathFor(type);
    try {
      const response = await API.get(`/${path}/download/${id}`, {
        responseType: "blob",
      });
      const file = new File(
        [response.data],
        `${path.split("-").join("")}-${id}.pdf`,
        { type: "application/pdf" }
      );
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Share ${docNameFor(type)}`,
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
    try {
      setLoading((prev) => ({ ...prev, [type]: true }));
      await API.put(`/${apiPathFor(type)}/status/${id}`, { status: newStatus });
      await fetchData(type);
      toast.success(`${docNameFor(type)} status updated successfully`);
    } catch (err) {
      toast.error(
        err.response?.data?.error || `Failed to update ${type} document status`
      );
      console.error(`Status update ${type} document error:`, err);
    } finally {
      setLoading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const currentLoading = loading[activeTab];
  const currentDocuments = documents[activeTab];
  const pagination = paginations[activeTab];

  // One flag drives every skeleton on the page, so the header, the table body
  // and the pagination strip all appear and resolve together. useMinDelay holds
  // it for 300ms so a fast fetch doesn't flash the placeholders.
  const showLoadingSkeleton = useMinDelay(
    currentLoading &&
    currentDocuments.length === 0 &&
    !hasLoadedOnceRef.current[activeTab],
    300
  );
  useTopLoadingSignal(currentLoading);

  // Same compact "first ... current ... last" pattern as Companies.jsx —
  // never more than 5 slots, so the strip can't overflow or wrap regardless
  // of how many pages there are.
  const [editingPage, setEditingPage] = useState(false);
  const [pageInput, setPageInput] = useState("");

  const pageItems = useMemo(() => {
    const { currentPage, totalPages } = pagination;
    const items = [1];
    if (currentPage > 2) items.push("left-dots");
    if (currentPage !== 1 && currentPage !== totalPages) items.push(currentPage);
    if (currentPage < totalPages - 1) items.push("right-dots");
    if (totalPages > 1) items.push(totalPages);
    return items;
  }, [pagination]);

  useEffect(() => {
    setEditingPage(false);
    setPageInput("");
  }, [activeTab]);

  const renderCell = (colId, doc) => {
    const searchQuery = searchTerms[activeTab];
    switch (colId) {
      case "number":
        return (
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span
              onClick={() => {
                // All document types open the same full two-pane edit screen;
                // the panel adapts its fields to the active tab's type.
                setEditPanelDoc(doc);
                setShowCreatePanel(true);
              }}
              className="text-sm font-semibold text-blue-600 cursor-pointer hover:underline truncate"
              title="Open to edit"
            >
              #<HighlightText text={doc[numberKeyFor(activeTab)]} query={searchQuery} />
            </span>
          </div>
        );

      case "deal":
        return (
          <span className="block truncate text-sm text-[#1C1B1F] font-medium">
            {doc.deal?.title ? (
              <HighlightText text={doc.deal.title} query={searchQuery} />
            ) : (
              "N/A"
            )}
          </span>
        );

      case "date":
        return (
          <span className="text-sm text-gray-600">
            {doc.date ? (
              <HighlightText
                text={new Date(doc.date).toLocaleDateString()}
                query={searchQuery}
              />
            ) : (
              "N/A"
            )}
          </span>
        );

      case "dueDate":
        return (
          <span className="text-sm text-gray-600">
            {doc.dueDate ? (
              <HighlightText
                text={new Date(doc.dueDate).toLocaleDateString()}
                query={searchQuery}
              />
            ) : (
              "N/A"
            )}
          </span>
        );

      case "amount":
        return (
          <span className="text-sm font-semibold text-gray-900">
            ₹<HighlightText text={formatNumberFixed(doc.amount)} query={searchQuery} />
          </span>
        );

      case "status":
        return (
          <div className="relative inline-block">
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
            {searchQuery && searchQuery.trim() && doc.status
              ?.toLowerCase()
              .includes(searchQuery.trim().toLowerCase()) && (
                <span className="absolute inset-0 rounded-lg ring-2 ring-yellow-300 pointer-events-none" />
              )}
          </div>
        );

      case "actions":
        return (
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
                title="Convert"
                onClick={(e) => {
                  e.stopPropagation();
                  if (openConvertMenu === doc._id) {
                    setOpenConvertMenu(null);
                    setConvertMenuPos(null);
                    return;
                  }
                  const rect = e.currentTarget.getBoundingClientRect();
                  const MENU_WIDTH = 240;
                  const MENU_HEIGHT = 160;
                  // Open leftward so the menu never runs off the right edge,
                  // and flip above the button when it would overflow the bottom.
                  const left = Math.max(8, rect.right - MENU_WIDTH);
                  const openUp =
                    rect.bottom + MENU_HEIGHT > window.innerHeight;
                  const top = openUp
                    ? rect.top - MENU_HEIGHT - 4
                    : rect.bottom + 4;
                  setConvertMenuPos({ top, left });
                  setOpenConvertMenu(doc._id);
                }}
                className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
              >
                <Repeat className="w-4 h-4" />
              </button>
              {openConvertMenu === doc._id && convertMenuPos && (
                <div
                  style={{
                    position: "fixed",
                    top: convertMenuPos.top,
                    left: convertMenuPos.left,
                  }}
                  className="w-60 bg-white rounded-lg shadow-lg border border-gray-200 z-[100]"
                >
                  <div className="py-1">
                    {["tax", "performa", "quotation", "deliveryChallan"]
                      .filter((t) => t !== activeTab)
                      .map((targetType) => (
                        <button
                          key={targetType}
                          onClick={() => {
                            handleConvert(doc._id, activeTab, targetType);
                            setOpenConvertMenu(null);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                        >
                          <Repeat className="w-4 h-4 text-orange-600" />
                          Convert to{" "}
                          {targetType === "tax"
                            ? "Tax Invoice"
                            : docNameFor(targetType)}
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
        );

      default:
        return null;
    }
  };

  return (
    <>
      <AppToaster />

      <div className="bg-[#F9FAFB] min-h-screen -mx-4 sm:-mx-6 lg:-mx-8 -mt-6">
        {/* Bulk selection strip — overlays the toolbar when rows are selected,
            mirroring the Companies page layout and slide animation. */}
        {showBulkStrip && (
          <div
            className="fixed right-0 h-16 px-4 lg:px-[24px] border-b border-blue-200 bg-blue-50 flex items-center top-[54px] lg:top-16"
            style={{ left: "var(--sidebar-width, 0px)", zIndex: 41 }}
          >
            <div
              className={`${bulkStripClosing ? "animate-slideOutRight" : "animate-slideInLeft"} flex flex-nowrap lg:flex-wrap items-center justify-start lg:justify-between gap-4 lg:gap-6 w-full h-full overflow-x-auto lg:overflow-visible`}
            >
              {/* Left: bulk action buttons */}
              {/* One joined strip instead of separate pills, matching Companies: no gap
    between buttons, rounding only on the two outer corners, and each
    border pulled left by 1px onto its neighbour so touching borders
    don't double up. Only the icons carry each action's colour. */}
              <div className="flex flex-nowrap lg:flex-wrap items-center flex-shrink-0">
                <button
                  onClick={handleExportSelected}
                  className="h-10 px-4 bg-white border border-gray-300 text-gray-900 text-sm font-medium rounded-l-lg hover:bg-gray-50 focus:outline-none focus:z-10 transition-colors flex items-center gap-2 flex-shrink-0 whitespace-nowrap"
                >
                  <Download className="w-4 h-4 text-green-600" />
                  Export
                </button>
                <button
                  onClick={() => {
                    setBulkUpdateStatus("");
                    setShowBulkUpdateModal(true);
                  }}
                  className="h-10 px-4 -ml-px bg-white border border-gray-300 text-gray-900 text-sm font-medium hover:bg-gray-50 focus:outline-none focus:z-10 transition-colors flex items-center gap-2 flex-shrink-0 whitespace-nowrap"
                >
                  <Pencil className="w-4 h-4 text-blue-600" />
                  Bulk Update
                </button>
                <button
                  onClick={() => setShowBulkDeleteModal(true)}
                  disabled={bulkDeleting}
                  className="h-10 px-4 -ml-px bg-white border border-gray-300 text-gray-900 text-sm font-medium hover:bg-gray-50 focus:outline-none focus:z-10 transition-colors flex items-center gap-2 disabled:opacity-50 flex-shrink-0 whitespace-nowrap"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                  Delete
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="h-10 px-4 -ml-px bg-white border border-gray-300 text-gray-900 text-sm font-medium rounded-r-lg hover:bg-gray-50 focus:outline-none focus:z-10 transition-colors flex items-center gap-2 flex-shrink-0 whitespace-nowrap"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
              {/* Right: selection count + select/deselect all */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <CheckSquare className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <span className="text-blue-800 font-semibold font-inter whitespace-nowrap">
                  {selectedIds.length} selected
                </span>
                <button
                  onClick={() =>
                    setSelectedIds(currentDocuments.map((d) => d._id))
                  }
                  className="h-10 px-4 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none transition-colors flex items-center gap-2 flex-shrink-0 whitespace-nowrap"
                >
                  <CheckSquare className="w-4 h-4" />
                  Select All
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="h-10 px-4 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none transition-colors flex items-center gap-2 flex-shrink-0 whitespace-nowrap"
                >
                  <X className="w-4 h-4" />
                  Deselect All
                </button>
              </div>
            </div>
          </div>
        )}
        {/* 2nd Header - Tab Bar & Actions Row */}
        <div
          className="fixed right-0 h-16 px-4 lg:px-[24px] border-b border-[#E1E4EA] bg-white flex items-center justify-between gap-3 top-[54px] lg:top-16"
          style={{ left: "var(--sidebar-width, 0px)", zIndex: 39 }}
        >
          {/* Left Side: Tabs Container — same pill selector as the Company tabs.
              Never skeletoned: the tabs are navigation, not data, so they stay
              mounted and clickable while the table loads. */}
          <div className="relative flex-shrink-0 inline-flex items-center gap-1 h-10 p-1 bg-[#F1F1F5] rounded-full overflow-x-auto no-scrollbar">
            <span
              className="absolute top-1 bottom-1 rounded-full bg-white shadow-sm transition-all duration-300 ease-out pointer-events-none"
              style={{ left: tabIndicator.left, width: tabIndicator.width }}
            />
            {TABS.map((tab) => (
              <button
                key={tab.key}
                ref={(el) => (tabRefs.current[tab.key] = el)}
                onClick={() => setActiveTab(tab.key)}
                className={`relative z-10 flex items-center justify-center h-8 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.key
                  ? "text-[#0085FF]"
                  : "text-gray-700 hover:text-gray-900"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right Side: Search, Filter, More, Add */}
          {showLoadingSkeleton ? (
            <div className="flex flex-row items-center gap-2 flex-shrink-0">
              <Skeleton width={40} height={40} shape="circle" />
              <Skeleton width={40} height={40} shape="circle" />
              <Skeleton width={40} height={40} shape="circle" />
              <Skeleton width={140} height={40} shape="circle" className="ml-1" />
            </div>
          ) : (
            <div className="flex flex-row items-center gap-2 flex-shrink-0 min-w-0">
              {/* Search field — expands in place from the search icon,
                  matching the Companies strip behaviour. */}
              <div
                className={`relative h-10 flex items-center border border-[#E1E4EA] rounded-full bg-white transition-all duration-300 ease-in-out hover:bg-gray-50 focus-within:border-[#0085FF] focus-within:hover:bg-white ${isSearchExpanded ? "w-[220px] sm:w-[300px] lg:w-[380px]" : "w-10"} max-w-full flex-shrink-0`}
              >
                <SearchIcon
                  className="absolute left-3 cursor-pointer z-10 flex-shrink-0 top-1/2 -translate-y-1/2 w-4 h-4 text-[#525866]"
                  onClick={() => {
                    setIsSearchExpanded(true);
                    searchInputRef.current?.focus();
                  }}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerms[activeTab]}
                  onChange={(e) =>
                    setSearchTerms((prev) => ({
                      ...prev,
                      [activeTab]: e.target.value,
                    }))
                  }
                  onFocus={() => setIsSearchExpanded(true)}
                  onBlur={() => {
                    if (!searchTerms[activeTab]) setIsSearchExpanded(false);
                  }}
                  placeholder={`Search by ${activeTab === "tax" ? "invoice" : "document"
                    } ID, deal, or date...`}
                  className={`w-full h-full bg-transparent rounded-full pl-11 pr-9 text-[14px] leading-[20px] text-[#1F2937] placeholder:text-[#99A0AE] focus:outline-none transition-opacity duration-200 cursor-pointer ${isSearchExpanded ? "opacity-100 focus:cursor-text" : "opacity-0"}`}
                />
                {/* Clears the typed text only — mousedown+preventDefault stops
                    the input's onBlur from firing before the click lands. */}
                {isSearchExpanded && searchTerms[activeTab] && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() =>
                      setSearchTerms((prev) => ({ ...prev, [activeTab]: "" }))
                    }
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-5 h-5 rounded-full text-gray-900 hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>
                )}
              </div>

              {/* Filter Button — status filter */}
              <div className="relative flex-shrink-0">
                <button
                  title="Filter by status"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFilterMenu((v) => !v);
                  }}
                  className={`flex items-center justify-center w-10 h-10 rounded-full border transition-colors bg-white ${filterStatuses[activeTab]
                    ? "border-[#0085FF] text-[#0085FF]"
                    : "border-[#E1E4EA] text-gray-500 hover:bg-gray-50"
                    }`}
                >
                  <SlidersHorizontal
                    strokeWidth={2.5}
                    className={`w-4 h-4 ${filterStatuses[activeTab]
                        ? "text-[#0085FF]"
                        : "text-gray-800"
                      }`}
                  />
                </button>
                {showFilterMenu && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-[#E1E4EA] py-1 z-50"
                  >
                    {["", ...statusOptions].map((status) => (
                      <button
                        key={status || "all"}
                        onClick={() => {
                          setFilterStatuses((prev) => ({
                            ...prev,
                            [activeTab]: status,
                          }));
                          setShowFilterMenu(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${filterStatuses[activeTab] === status
                          ? "text-[#0085FF] font-medium"
                          : "text-gray-700"
                          }`}
                      >
                        {status || "All Statuses"}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* More Options Button */}
              <div className="relative flex-shrink-0">
                <button
                  title="More options"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMoreMenu((v) => !v);
                  }}
                  className="flex items-center justify-center w-10 h-10 rounded-full border border-[#E1E4EA] text-gray-800 hover:bg-gray-50 transition-colors bg-white"
                >
                  <MoreVertical strokeWidth={2.5} className="w-4 h-4" />
                </button>
                {showMoreMenu && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-[#E1E4EA] py-1 z-50"
                  >
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        setShowTemplateDrawer(true);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <LayoutTemplate className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      Template
                    </button>
                  </div>
                )}
              </div>


              {/* Add Button */}
              <button
                onClick={async () => {
                  // Branding must be complete before creating a tax invoice;
                  // the other document types skip that gate.
                  if (activeTab === "tax") {
                    const canProceed = await checkBrandingBeforeInvoice();
                    if (!canProceed) return;
                  }
                  // All document types now use the same two-pane create screen.
                  setEditPanelDoc(null);
                  setShowCreatePanel(true);
                }}
                /* Figma "Frame 1351649616": 146x44, padding 12, gap 6,
                   #0085FF, radius 96. The fixed 146px width is the spec for the
                   "Add Invoice" label; the longer labels on the other three tabs
                   use it as a minimum so the text isn't clipped. */
                style={{
                  width: activeTab === "tax" ? 146 : undefined,
                  minWidth: 146,
                  height: 40,
                  padding: 12,
                  gap: 6,
                  background: "#0085FF",
                  borderRadius: 96,
                }}
                className="flex flex-row justify-center items-center hover:bg-blue-600 transition-colors flex-shrink-0 ml-1"
              >
                <Plus size={18} className="text-white flex-shrink-0" />
                <span className="text-white text-[14px] font-medium leading-[20px] whitespace-nowrap">
                  Add {docNameFor(activeTab)}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Main Content Area — full-bleed table, no card. Same fixed scroll
            region Companies.jsx uses: edge to edge under the tab bar, stopping
            above the pagination bar. */}
        <div
          className="fixed right-0 overflow-x-auto overflow-y-auto bg-white top-[118px] lg:top-[128px]"
          style={{ left: "var(--sidebar-width, 0px)", bottom: 64 }}
        >
          <table
            className="border-separate border-spacing-0 text-left"
            style={{ minWidth: "100%", width: tableWidth, tableLayout: "fixed" }}
          >
            <thead className="bg-[#F5F7FA] sticky top-0 z-20 select-none">
              <tr>
                <th
                  data-col-id="selection"
                  style={{
                    width: colWidths.selection,
                    position: "sticky",
                    left: 0,
                    zIndex: 25,
                  }}
                  className="relative px-4 py-3 border-b border-r border-[#E1E4EA] bg-[#F5F7FA]"
                >
                  <div className="flex justify-center items-center w-full">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.length === currentDocuments.length &&
                        currentDocuments.length > 0
                      }
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                  </div>
                  <ResizeHandle colId="selection" />
                </th>

                {orderedColumns.map((col) => {
                  const isDragging = draggedColKey === col.id;
                  const isDragOver =
                    dragOverColKey === col.id &&
                    draggedColKey &&
                    draggedColKey !== col.id;

                  return (
                    <th
                      key={col.id}
                      data-col-id={col.id}
                      onMouseDown={(e) => startColumnDrag(e, col.id)}
                      title="Drag to move this column"
                      style={{
                        width: colWidths[col.id],
                        opacity: isDragging ? 0.35 : 1,
                        ...stickyStyleFor(col.id),
                      }}
                      className={`relative px-4 py-3 text-left text-xs font-bold text-[#525866] uppercase tracking-wider whitespace-nowrap border-b border-r border-[#E1E4EA] transition-colors ${isDragOver ? "bg-blue-100" : "bg-[#F5F7FA] hover:bg-[#EDF0F5]"
                        } ${draggedColKey ? "cursor-grabbing" : "cursor-grab"
                        } active:cursor-grabbing`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate flex-1 min-w-0 flex items-center gap-1.5">
                          <span className="truncate">
                            {typeof col.label === "function"
                              ? col.label(activeTab)
                              : col.label}
                          </span>
                          {pinnedCols[col.id] && (
                            <Pin
                              size={12}
                              className="text-blue-500 fill-blue-500 flex-shrink-0 ml-1"
                              style={{ transform: "rotate(45deg)" }}
                            />
                          )}
                        </span>
                        {/* Actions isn't a data column — nothing to sort, pin or
                          hide, so it gets no options button at all instead of
                          a menu whose items would all be no-ops. */}
                        {col.id !== "actions" && (
                          <button
                            onClick={(e) => openColumnMenu(e, col.id)}
                            title="Column options"
                            className="p-1 rounded hover:bg-gray-200 transition-colors text-gray-500 flex-shrink-0"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <ResizeHandle colId={col.id} />
                      {boundaryShadowSideFor(col.id) && (
                        <div style={getPinnedBoundaryOverlayStyle(boundaryShadowSideFor(col.id))} />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="bg-white">
              {showLoadingSkeleton && (
                <TableSkeletonRows
                  numRows={pagination.limit}
                  columns={orderedColumns.map((c) => colWidths[c.id])}
                  hasCheckbox
                  checkboxWidth={colWidths.selection}
                />
              )}
              {!showLoadingSkeleton && !currentLoading && currentDocuments.length === 0 && (
                <tr>
                  <td colSpan={orderedColumns.length + 1} className="px-6 py-20 text-center">
                    <FileText className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                    <p className="text-sm font-medium text-gray-500">
                      Create New {docNameFor(activeTab)}
                    </p>
                  </td>
                </tr>
              )}
              {!showLoadingSkeleton && currentDocuments.map((doc) => (
                <tr
                  key={doc?._id}
                  className={`bg-white hover:bg-blue-50 transition-colors ${selectedIds.includes(doc._id) ? "!bg-blue-50" : ""
                    }`}
                >
                  <td
                    style={{
                      width: colWidths.selection,
                      position: "sticky",
                      left: 0,
                      zIndex: 10,
                    }}
                    className="px-4 py-3 align-middle border-b border-r border-[#E1E4EA] overflow-hidden bg-inherit"
                  >
                    <div className="flex justify-center items-center w-full">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(doc._id)}
                        onChange={() => handleSelectOne(doc._id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                    </div>
                  </td>

                  {orderedColumns.map((col) => (
                    <td
                      key={col.id}
                      style={{
                        width: colWidths[col.id],
                        ...stickyStyleFor(col.id),
                      }}
                      className="relative px-4 py-3 align-middle whitespace-nowrap border-b border-r border-[#E1E4EA] bg-inherit"
                    >
                      {renderCell(col.id, doc)}
                      {boundaryShadowSideFor(col.id) && (
                        <div style={getPinnedBoundaryOverlayStyle(boundaryShadowSideFor(col.id))} />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Shared column popup — one menu, used by every column on all four
            tabs. Opens on a single click of the header's chevron button. */}
        {openColumnMenuKey &&
          columnMenuPos &&
          createPortal(
            <>
              <div className="fixed inset-0 z-[9998]" onClick={closeColumnMenu} />
              <div
                style={{
                  position: "fixed",
                  top: columnMenuPos.top,
                  left: columnMenuPos.left,
                }}
                className="w-[176px] z-[9999] bg-white border border-[#E5E5EC] rounded-lg shadow-[7px_24px_24px_-7px_rgba(0,0,0,0.25)] p-1.5 flex flex-col gap-0.5"
              >
                {(() => {
                  const col = COLUMN_DEFS.find(
                    (c) => c.id === openColumnMenuKey
                  );
                  if (!col) return null;
                  const side = pinnedCols[col.id];
                  const sortKey = fieldFor(col, activeTab);
                  const itemClass =
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal whitespace-nowrap";

                  return (
                    <>
                      <button
                        onClick={() => {
                          closeColumnMenu();
                          setColumnPin(col.id, "left");
                        }}
                        className={`${itemClass} ${side === "left"
                          ? "bg-blue-50 text-blue-700"
                          : "text-[#161618] hover:bg-gray-50"
                          }`}
                      >
                        {side === "left" ? (
                          <PinOff className="w-3.5 h-3.5" />
                        ) : (
                          <Pin className="w-3.5 h-3.5 text-[#1C1B1F]" />
                        )}
                        {side === "left" ? "Unpin" : "Pin to Left"}
                      </button>
                      <button
                        onClick={() => {
                          closeColumnMenu();
                          setColumnPin(col.id, "right");
                        }}
                        className={`${itemClass} ${side === "right"
                          ? "bg-blue-50 text-blue-700"
                          : "text-[#161618] hover:bg-gray-50"
                          }`}
                      >
                        {side === "right" ? (
                          <PinOff className="w-3.5 h-3.5" />
                        ) : (
                          <Pin className="w-3.5 h-3.5 text-[#1C1B1F]" />
                        )}
                        {side === "right" ? "Unpin" : "Pin to Right"}
                      </button>

                      {sortKey && (
                        <>
                          <button
                            onClick={() => {
                              closeColumnMenu();
                              setSortConfigs((prev) => ({
                                ...prev,
                                [activeTab]: {
                                  key: sortKey,
                                  direction: "asc",
                                },
                              }));
                              setPaginations((prev) => ({
                                ...prev,
                                [activeTab]: {
                                  ...prev[activeTab],
                                  currentPage: 1,
                                },
                              }));
                            }}
                            className={`${itemClass} text-[#161618] hover:bg-gray-50`}
                          >
                            <ChevronUp className="w-3.5 h-3.5 text-[#1C1B1F]" />
                            Sort Ascending
                          </button>
                          <button
                            onClick={() => {
                              closeColumnMenu();
                              setSortConfigs((prev) => ({
                                ...prev,
                                [activeTab]: {
                                  key: sortKey,
                                  direction: "desc",
                                },
                              }));
                              setPaginations((prev) => ({
                                ...prev,
                                [activeTab]: {
                                  ...prev[activeTab],
                                  currentPage: 1,
                                },
                              }));
                            }}
                            className={`${itemClass} text-[#161618] hover:bg-gray-50`}
                          >
                            <ChevronDown className="w-3.5 h-3.5 text-[#1C1B1F]" />
                            Sort Descending
                          </button>
                        </>
                      )}

                      <div className="w-full border-t border-[#F1F1F5] my-0.5" />

                      <button
                        disabled={col.required}
                        onClick={() => {
                          if (col.required) return;
                          closeColumnMenu();
                          setHiddenCols((prev) => [...prev, col.id]);
                        }}
                        className={`${itemClass} ${col.required
                          ? "text-gray-300 cursor-not-allowed"
                          : "text-[#161618] hover:bg-gray-50"
                          }`}
                      >
                        <EyeOff
                          className={`w-3.5 h-3.5 ${col.required ? "text-gray-300" : "text-[#1C1B1F]"
                            }`}
                        />
                        Hide Column
                      </button>
                    </>
                  );
                })()}
              </div>
            </>,
            document.body
          )}

        {/* Drag ghost — the floating column panel that follows the cursor,
            carrying the header plus that column's cell values. */}
        {dragGhost &&
          createPortal(
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
              <div
                className="px-4 py-3 bg-[#F5F7FA] border-b border-[#E1E4EA]"
                style={{ height: dragGhost.height }}
              >
                <span className="text-sm font-bold text-[#525866] truncate block">
                  {dragGhost.label}
                </span>
              </div>
              {dragGhost.previewRows.map((rowVal, i) => (
                <div
                  key={i}
                  className="px-4 py-2 border-b border-[#F1F1F5] last:border-b-0"
                >
                  <span className="text-sm text-gray-700 truncate block">
                    {rowVal}
                  </span>
                </div>
              ))}
            </div>,
            document.body
          )}

        {/* Restore hidden columns */}
        {hiddenCols.length > 0 && (
          <button
            onClick={() => setHiddenCols([])}
            className="fixed z-[9993] bottom-[76px] right-6 h-9 px-3.5 flex items-center gap-1.5 rounded-full bg-white border border-[#E1E4EA] shadow-sm text-xs font-medium text-[#525866] hover:bg-gray-50 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            Show {hiddenCols.length} hidden column
            {hiddenCols.length > 1 ? "s" : ""}
          </button>
        )}

        {/* Pagination bar — its own fixed strip below the table, not inside it
            (same treatment as Companies.jsx). */}
        {!showForm && !showCreatePanel && (
          <div
            className={`fixed bottom-0 right-0 bg-white border-t border-[#E1E4EA] shadow-sm z-[9992] flex items-center justify-between px-4 lg:px-6 ${isSearchOverlayOpen ? "pointer-events-none" : ""}`}
            style={{
              left: "var(--sidebar-width, 0px)",
              height: 64,
              filter: isSearchOverlayOpen ? "brightness(0.6)" : "none",
            }}
          >
            {showLoadingSkeleton ? (
              <div className="flex items-center gap-2">
                <Skeleton width={190} height={14} />
                <Skeleton width={110} height={30} />
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <p className="text-sm text-gray-700 font-inter">
                  Showing{" "}
                  <span className="font-semibold">
                    {pagination.totalCount === 0
                      ? 0
                      : (pagination.currentPage - 1) * pagination.limit + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold">
                    {Math.min(
                      pagination.currentPage * pagination.limit,
                      pagination.totalCount
                    )}
                  </span>{" "}
                  of <span className="font-semibold">{pagination.totalCount}</span>{" "}
                  {pluralNameFor(activeTab)}
                </p>
                <div className="relative ml-2">
                  <select
                    value={pagination.limit}
                    onChange={(e) =>
                      handleLimitChange(activeTab, parseInt(e.target.value))
                    }
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
            )}

            {showLoadingSkeleton ? (
              <div className="flex items-center gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} width={32} height={32} shape="circle" />
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    handlePageChange(activeTab, pagination.currentPage - 1)
                  }
                  disabled={!pagination.hasPrevPage}
                  className="flex items-center justify-center w-8 h-8 rounded-full border border-[#E1E4EA] bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {pagination.totalPages > 0 &&
                  (() => {
                    const { currentPage, totalPages } = pagination;
                    const commitPage = () => {
                      const n = parseInt(pageInput, 10);
                      if (!Number.isNaN(n)) {
                        // Typing a page past the last one lands on the last page,
                        // not an out-of-range one.
                        handlePageChange(activeTab, Math.min(Math.max(n, 1), totalPages));
                      }
                      setEditingPage(false);
                    };

                    return pageItems.map((item, index) => {
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
                          onClick={() => handlePageChange(activeTab, item)}
                          onDoubleClick={() => {
                            if (isCurrent) {
                              setPageInput(String(currentPage));
                              setEditingPage(true);
                            }
                          }}
                          title={
                            isCurrent ? "Double-click to type a page number" : undefined
                          }
                          className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${isCurrent
                            ? "bg-[#0085FF] text-white"
                            : "bg-white border border-[#E1E4EA] text-gray-700 hover:bg-gray-50"
                            }`}
                        >
                          {item}
                        </button>
                      );
                    });
                  })()}

                <button
                  onClick={() =>
                    handlePageChange(activeTab, pagination.currentPage + 1)
                  }
                  disabled={!pagination.hasNextPage}
                  className="flex items-center justify-center w-8 h-8 rounded-full border border-[#E1E4EA] bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Two-pane create/edit screen — each document type uses its own
            thin wrapper around the shared CreateInvoicePanel. */}
        {showCreatePanel && (() => {
          const panelProps = {
            key: `${activeTab}-${editPanelDoc?._id || "new"}`,
            deals,
            initialDoc: editPanelDoc,
            conversionData,
            onFullView: (doc) => handleView(doc, activeTab),
            onClose: () => {
              setShowCreatePanel(false);
              setEditPanelDoc(null);
              setConversionData(null);
              setQuotationFullWidth(false);
            },
            onCreated: () => fetchData(activeTab),
            onAddDeal: async () => {
              if (companies.length === 0 || contacts.length === 0) {
                try {
                  const [c, ct] = await Promise.all([
                    API.get("/companies"),
                    API.get("/contacts"),
                  ]);
                  setCompanies(c.data || []);
                  setContacts(ct.data || []);
                } catch (err) {
                  console.error("Failed to load companies/contacts", err);
                }
              }
              setShowQuickDealForm(true);
            },
          };
          switch (activeTab) {
            case "tax": return invoiceFullWidth ? (
              <InvoiceFormFull
                deals={deals}
                isOpen={true}
                onClose={panelProps.onClose}
                onExitFullWidth={() => setInvoiceFullWidth(false)}
                fetchData={() => fetchData("tax")}
                editingInvoice={panelProps.initialDoc}
                conversionData={panelProps.conversionData}
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
            ) : (
              <CreateInvoicePanel 
                {...panelProps} 
                type="tax" 
                onRequestFullWidth={() => setInvoiceFullWidth(true)}
              />
            );
            // Split view by default; the panel's expand button flips
            // quotationFullWidth, swapping in the full-width QuotationForm
            // (its own fixed overlay), which flips back via onExitFullWidth.
            case "quotation": return quotationFullWidth ? (
              <QuotationForm
                deals={deals}
                isOpen={true}
                onClose={panelProps.onClose}
                onExitFullWidth={() => setQuotationFullWidth(false)}
                fetchData={() => fetchData("quotation")}
                editingQuotation={panelProps.initialDoc}
                conversionData={panelProps.conversionData}
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
            ) : (
              <CreateQuotationPanel
                {...panelProps}
                onRequestFullWidth={() => setQuotationFullWidth(true)}
              />
            );
            case "performa": return performaFullWidth ? (
              <PerformaInvoiceFormFull
                deals={deals}
                isOpen={true}
                onClose={panelProps.onClose}
                onExitFullWidth={() => setPerformaFullWidth(false)}
                fetchData={() => fetchData("performa")}
                editingPerformaInvoice={panelProps.initialDoc}
                conversionData={panelProps.conversionData}
                onPreview={(formData) => {
                  if (!formData.style) {
                    toast.error("Please select a Pro Forma invoice style to preview.");
                    return;
                  }
                  setPreviewStyle(formData.style);
                  setPreviewType("performa");
                  setShowPreview(true);
                }}
              />
            ) : (
              <CreatePerformaPanel 
                {...panelProps} 
                onRequestFullWidth={() => setPerformaFullWidth(true)}
              />
            );
            case "deliveryChallan": return challanFullWidth ? (
              <DeliveryChallanFormFull
                deals={deals}
                isOpen={true}
                onClose={panelProps.onClose}
                onExitFullWidth={() => setChallanFullWidth(false)}
                fetchData={() => fetchData("deliveryChallan")}
                editingDeliveryChallan={panelProps.initialDoc}
                conversionData={panelProps.conversionData}
              />
            ) : (
              <CreateChallanPanel 
                {...panelProps} 
                onRequestFullWidth={() => setChallanFullWidth(true)}
              />
            );
            default: return null;
          }
        })()}
        {showQuickDealForm && (
          <QuickDealForm
            companies={companies}
            contacts={contacts}
            onDealCreated={(newDeal) => {
              setDeals((prev) => [...prev, newDeal]);
              setShowQuickDealForm(false);
            }}
            onRequestClose={() => setShowQuickDealForm(false)}
          />
        )}

        {/* Forms — reused as-is from the Invoices module */}
        {showForm && editingType === "tax" && (
          invoiceFullWidth ? (
            <InvoiceFormFull
              deals={deals}
              isOpen={showForm}
              onClose={() => {
                setShowForm(false);
                setEditing(null);
                setEditingType(null);
                setInvoiceFullWidth(false);
              }}
              fetchData={() => fetchData("tax")}
              editingInvoice={editing}
              onExitFullWidth={() => setInvoiceFullWidth(false)}
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
          ) : (
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
              onRequestFullWidth={() => setInvoiceFullWidth(true)}
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
          )
        )}
        {showForm && editingType === "performa" && (
          performaFullWidth ? (
            <PerformaInvoiceFormFull
              deals={deals}
              isOpen={showForm}
              onClose={() => {
                setShowForm(false);
                setEditing(null);
                setEditingType(null);
                setPerformaFullWidth(false);
              }}
              fetchData={() => fetchData("performa")}
              editingPerformaInvoice={editing}
              onExitFullWidth={() => setPerformaFullWidth(false)}
              onPreview={(formData) => {
                if (!formData.style) {
                  toast.error("Please select a Pro Forma invoice style to preview.");
                  return;
                }
                setPreviewStyle(formData.style);
                setPreviewType("performa");
                setShowPreview(true);
              }}
            />
          ) : (
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
              onRequestFullWidth={() => setPerformaFullWidth(true)}
              onPreview={(formData) => {
                if (!formData.style) {
                  toast.error("Please select a Pro Forma invoice style to preview.");
                  return;
                }
                setPreviewStyle(formData.style);
                setPreviewType("performa");
                setShowPreview(true);
              }}
            />
          )
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
          challanFullWidth ? (
            <DeliveryChallanFormFull
              deals={deals}
              isOpen={showForm}
              onClose={() => {
                setShowForm(false);
                setEditing(null);
                setEditingType(null);
                setChallanFullWidth(false);
              }}
              fetchData={() => fetchData("deliveryChallan")}
              editingDeliveryChallan={editing}
              onExitFullWidth={() => setChallanFullWidth(false)}
            />
          ) : (
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
              onRequestFullWidth={() => setChallanFullWidth(true)}
            />
          )
        )}

        {showPreview && previewType === "performa" ? (
          <PerformaInvoiceStylePreview
            style={previewStyle}
            isOpen={showPreview}
            onClose={() => {
              setShowPreview(false);
              setPreviewStyle(null);
              setPreviewType(null);
            }}
          />
        ) : (
          showPreview && (
            <InvoiceStylePreview
              style={previewStyle}
              isOpen={showPreview}
              onClose={() => {
                setShowPreview(false);
                setPreviewStyle(null);
                setPreviewType(null);
              }}
            />
          )
        )}

        {/* Template picker — right-hand drawer opened from the toolbar's
            three-dot menu, scoped to whichever tab is active. */}
        <TemplateDrawer
          isOpen={showTemplateDrawer}
          onClose={() => setShowTemplateDrawer(false)}
          type={activeTab}
          docLabel={docNameFor(activeTab)}
        />

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
        {showBulkDeleteModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100003]">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-red-100 p-2 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  Confirm Deletion
                </h2>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete{" "}
                <strong>{selectedIds.length}</strong> selected{" "}
                {docNameFor(activeTab)}
                {selectedIds.length !== 1 ? "s" : ""}? This action cannot be
                undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowBulkDeleteModal(false)}
                  disabled={bulkDeleting}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBulkDelete}
                  disabled={bulkDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {bulkDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
        {showBulkUpdateModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100003]">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Pencil className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Bulk Update</h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Set a status for{" "}
                <strong>{selectedIds.length}</strong> selected{" "}
                {docNameFor(activeTab)}
                {selectedIds.length !== 1 ? "s" : ""}.
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Status
              </label>
              <select
                value={bulkUpdateStatus}
                onChange={(e) => setBulkUpdateStatus(e.target.value)}
                className="w-full mb-6 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">Select status…</option>
                {statusOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowBulkUpdateModal(false)}
                  disabled={bulkUpdating}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBulkUpdate}
                  disabled={bulkUpdating || !bulkUpdateStatus}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  <Pencil className="w-4 h-4" />
                  {bulkUpdating ? "Updating..." : "Update"}
                </button>
              </div>
            </div>
          </div>
        )}
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
              // Same two-pane panel the "Add [Document]" button opens when
              // branding is already complete — branding-gated tax invoices
              // now land in the same place as every other create/edit flow.
              setEditPanelDoc(null);
              setShowCreatePanel(true);
              setPendingInvoiceCreation(false);
            }
          }}
        />
      </div>

      <UpgradeRequiredModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        minPlan="growth"
        feature="Selecting multiple rows"
      />
    </>
  );
};

export default Accounting;
