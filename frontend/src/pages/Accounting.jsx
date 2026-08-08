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
  Printer,
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
  Maximize2,
  Minimize2,
  Settings,
  ChevronsLeftRight,
} from "lucide-react";
import { createPortal } from "react-dom";
import API from "../services/api";
import toast from "react-hot-toast";
import AppToaster from "../components/AppToaster";
import HighlightText from "../components/common/HighlightText";
import InvoiceForm from "../components/invoice/InvoiceForm";
import PerformaInvoiceForm from "../components/PerformaInvoice/PerformaInvoiceForm";
import QuotationForm from "../components/quotation/QuotationForm";
import DeliveryChallanForm from "../components/deliveryChallan/DeliveryChallanForm";
import InvoiceStylePreview from "../components/invoice/InvoiceStylePreview";
import InvoiceLivePreview from "../components/invoice/InvoiceLivePreview";
import TemplateDrawer from "../components/invoice/TemplateDrawer";
import NotesTermsDrawer from "../components/invoice/NotesTermsDrawer";
import { buildDocumentHtml } from "../../../shared/documentTemplates.js";
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
import HighlightText from "../components/common/HighlightText";

import SearchIcon from "../components/common/SearchIcon";
const SectionHeader = ({ number, title }) => (
  <div className="flex items-center gap-2.5 w-full mb-1.5 mt-2 first:mt-0">
    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-[#F0F6FF] text-[#0085FF] text-[10px] font-semibold flex-shrink-0">
      {number}
    </div>
    <span className="text-[15px] font-semibold text-[#1F2937] whitespace-nowrap">
      {title}
    </span>
  </div>
);

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
      return `₹${doc.amount?.toFixed(2) || "0.00"}`;
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

  useEffect(() => {
    if (isOpen && id && type) {
      fetchPdf();
    }
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, id, type]);

  const fetchPdf = async () => {
    try {
      const response = await API.get(`/${apiPathFor(type)}/download/${id}`, {
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

/* Same converter InvoiceForm.jsx uses for its "Amount in Words" line, so the
   two Create-Invoice screens agree on wording. */
function numberToWords(num) {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy",
    "Eighty", "Ninety",
  ];

  function toWords(n) {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) {
      return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    }
    if (n < 1000) {
      return (
        ones[Math.floor(n / 100)] +
        " Hundred" +
        (n % 100 ? " " + toWords(n % 100) : "")
      );
    }
    let result = "";
    if (n >= 10000000) {
      result += toWords(Math.floor(n / 10000000)) + " Crore ";
      n %= 10000000;
    }
    if (n >= 100000) {
      result += toWords(Math.floor(n / 100000)) + " Lakh ";
      n %= 100000;
    }
    if (n >= 1000) {
      result += toWords(Math.floor(n / 1000)) + " Thousand ";
      n %= 1000;
    }
    if (n > 0) result += toWords(n);
    return result.trim();
  }

  if (num === 0) return "Zero Rupees Only";
  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);
  let words = toWords(integerPart) + " Rupees";
  if (decimalPart > 0) words += " and " + toWords(decimalPart) + " Paise";
  words += " Only";
  return words;
}

// Single source of truth for the template list — the same one the renderer and
// the PDF generator use, so a template added there shows up here automatically.
const GSTIN_REGEX =
  /^[0-9]{2}[A-Z0-9]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/;

const blankItem = () => ({
  _id: null,
  name: "",
  description: "",
  rate: "",
  quantity: 1,
  hsn: "",
  isVariant: false,
  parentItemId: null,
  discountType: "amount",
  discount: 0,
});

/* Small searchable select used for the Deal and Item pickers. Kept local so the
   panel doesn't inherit behaviour from the older form's dropdowns. */
const PickerSelect = ({
  value,
  options,
  placeholder,
  onSelect,
  searchable = true,
  icon: Icon,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState({});
  const wrapRef = useRef(null);
  const dropdownRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (open && wrapRef.current) {
      // rect is VISUAL px; this dropdown portals to document.body, which
      // paints inside the app's dynamic <html> zoom, so every rect-derived
      // value has to be divided by that zoom or it drifts off-position —
      // same correction the column menu and drag ghost already apply.
      const zoom = getAncestorZoom(document.body);
      const rect = wrapRef.current.getBoundingClientRect();
      const left = rect.left / zoom;
      const top = rect.top / zoom;
      const bottom = rect.bottom / zoom;
      const triggerWidth = rect.width / zoom;
      const viewportWidth = window.innerWidth / zoom;
      const viewportHeight = window.innerHeight / zoom;
      const spaceBelow = viewportHeight - bottom;
      const spaceAbove = top;
      const MARGIN = 8;

      // Item pickers sit in narrow grid columns — tying the dropdown's width
      // to the trigger's own width (as narrow as ~80px there) is what made
      // it look like a crushed little box. Give it a real minimum width
      // instead, and clamp so it never runs past the right edge.
      const width = Math.max(triggerWidth, 260);
      let left_ = Math.min(left, viewportWidth - width - MARGIN);
      left_ = Math.max(left_, MARGIN);

      let style = {
        position: "fixed",
        left: `${left_}px`,
        width: `${width}px`,
        zIndex: 99999, // Ensure it floats above dialogs
      };

      if (spaceBelow < 256 && spaceAbove > spaceBelow) {
        style.bottom = `${viewportHeight - top + 4}px`;
        style.maxHeight = `${Math.min(256, spaceAbove - 16)}px`;
      } else {
        style.top = `${bottom + 4}px`;
        style.maxHeight = `${Math.min(256, spaceBelow - 16)}px`;
      }
      setDropdownStyle(style);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }
  }, [open, updatePosition]);

  useEffect(() => {
    const onDocClick = (e) => {
      const clickedInWrap = wrapRef.current && wrapRef.current.contains(e.target);
      const clickedInDropdown = dropdownRef.current && dropdownRef.current.contains(e.target);
      if (!clickedInWrap && !clickedInDropdown) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selected = options.find((o) => o.value === value);
  const filtered = query
    ? options.filter((o) =>
      o.label.toLowerCase().includes(query.toLowerCase())
    )
    : options;

  return (
    <div ref={wrapRef} className="relative w-full min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-10 flex items-center gap-2 px-3 rounded-[25px] border border-[#E1E4EA] bg-white text-left hover:border-[#C9CFD8] focus:outline-none focus:border-[#0085FF] transition-colors"
      >
        {Icon && <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />}
        <span
          className={`flex-1 truncate text-sm ${selected ? "text-[#1F2937]" : "text-[#99A0AE]"
            }`}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="bg-white border border-[#E1E4EA] rounded-lg shadow-xl flex flex-col overflow-hidden"
        >
          {searchable && (
            <div className="p-2 bg-white border-b border-[#E1E4EA] flex-shrink-0">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full h-8 px-2 text-sm rounded-md border border-[#E1E4EA] focus:outline-none focus:border-[#0085FF]"
              />
            </div>
          )}
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-sm text-gray-400">No results</p>
            )}
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onSelect(o);
                  setOpen(false);
                  setQuery("");
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors ${o.value === value ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-700"
                  }`}
              >
                <span className="flex-1 truncate">{o.label}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const FieldLabel = ({ children, required }) => (
  <label className="block text-xs text-[#525866] mb-1.5">
    {children}
    {required && <span className="text-red-500 ml-0.5">*</span>}
  </label>
);

/* The "Add Invoice" experience for the Invoices tab: details on the left,
   live preview on the right. */
const CreateInvoicePanel = ({
  deals,
  onClose,
  onCreated,
  onAddDeal,
  initialDoc = null,
  onFullView,
  type = "tax",
}) => {
  const isEditing = !!initialDoc;
  // Per-type capabilities. Delivery challans have no GSTIN / tax / HSN; the
  // quotation tax flag is stored under a different key.
  const isChallan = type === "deliveryChallan";
  const supportsTax = !isChallan;
  const supportsGSTIN = !isChallan;
  const taxFlagKey = type === "quotation" ? "isTaxQuotation" : "isTaxInvoice";
  const docName = docNameFor(type);
  // Section badges are numbered by position so a hidden section doesn't leave
  // a gap in the sequence.
  const sectionNo = (() => {
    let n = 1;
    const pad = (v) => String(v).padStart(2, "0");
    const out = { details: pad(n++) };
    if (supportsGSTIN) out.billing = pad(n++);
    out.items = pad(n++);
    out.notes = pad(n++);
    out.terms = pad(n++);
    out.summary = pad(n++);
    return out;
  })();
  const [form, setForm] = useState(() =>
    initialDoc
      ? {
          deal: initialDoc.deal?._id || initialDoc.deal || "",
          style: initialDoc.style || "",
          date: initialDoc.date ? initialDoc.date.slice(0, 10) : "",
          dueDate: initialDoc.dueDate ? initialDoc.dueDate.slice(0, 10) : "",
          receiverGSTIN: initialDoc.receiverGSTIN || "",
          isTaxInvoice:
            initialDoc[type === "quotation" ? "isTaxQuotation" : "isTaxInvoice"] ||
            false,
          transactionType: initialDoc.transactionType || "intra",
          gstRate: initialDoc.gstRate || 18,
          invoicePrefix: initialDoc.invoicePrefix || "INV-",
          invoiceSuffix: initialDoc.invoiceSuffix || "",
          invoiceNumber: initialDoc.invoiceNumber || "",
          nextInvoiceNumber: initialDoc.nextInvoiceNumber || 1,
          items:
            initialDoc.items && initialDoc.items.length
              ? initialDoc.items.map((item) => ({
                  _id: item.itemId || item._id,
                  name: item.name,
                  description: item.description || "",
                  rate: item.rate,
                  quantity: item.quantity,
                  hsn: item.hsn || "",
                  isVariant: item.isVariant || false,
                  parentItemId: item.parentItemId || null,
                  discountType: item.discountType || "amount",
                  discount: item.discount || 0,
                }))
              : [blankItem()],
          discount: initialDoc.discount || { type: "fixed", value: 0 },
          notes: initialDoc.notes || "",
          terms: initialDoc.terms || "",
          status: initialDoc.status || "Draft",
        }
      : {
          deal: "",
          style: "",
          date: "",
          dueDate: "",
          receiverGSTIN: "",
          isTaxInvoice: false,
          transactionType: "intra",
          gstRate: 18,
          invoicePrefix: "INV-",
          invoiceSuffix: "",
          invoiceNumber: "",
          nextInvoiceNumber: 1,
          items: [blankItem()],
          discount: { type: "fixed", value: 0 },
          notes: "",
          terms: "",
          status: "Draft",
        }
  );
  const [catalogue, setCatalogue] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [orgDetails, setOrgDetails] = useState(null);
  const [bankDetails, setBankDetails] = useState(null);
  // Numbering (prefix/suffix/next number) comes from DocumentSettings.
  const [docSettings, setDocSettings] = useState({
    invoicePrefix: "INV-",
    invoiceSuffix: "",
    invoicePrefixes: ["INV-"],
    invoiceSuffixes: [],
    nextInvoiceNumber: 1,
    defaultNotes: "",
    defaultTerms: "",
    documentTypeSettings: {
      invoice: { prefix: "INV-", suffix: "", prefixes: ["INV-"], suffixes: [] },
    },
  });
  // Rendering template comes from DocumentTemplateSettings — a separate model.
  const [orgTemplate, setOrgTemplate] = useState("Classic");

  // Draggable split between the form (left) and the preview (right).
  const splitRef = useRef(null);
  const [leftPct, setLeftPct] = useState(50);
  // Collapses the preview entirely so the form gets the full width — useful
  // when filling in a long item list on a narrow screen.
  const [hidePreview, setHidePreview] = useState(false);
  // null when closed; otherwise the section to focus ("notes" | "terms").
  const [notesDrawer, setNotesDrawer] = useState(null);
  // Width the two columns actually use; the split only applies while the
  // preview is on screen.
  const formWidth = hidePreview ? "100%" : `${leftPct}%`;

  // Document number, renamed inline from the header. Only the trailing part
  // after the last hyphen is editable — the prefix (INV-, QUO-, …) identifies
  // the document type and must survive any rename.
  const numberKey = numberKeyFor(type);
  const [docNumber, setDocNumber] = useState(initialDoc?.[numberKey] || "");
  const numberPrefix = docNumber.includes("-")
    ? docNumber.slice(0, docNumber.lastIndexOf("-") + 1)
    : "";
  const numberSuffix = docNumber.slice(numberPrefix.length);
  const [numberDraft, setNumberDraft] = useState(null); // null = not editing
  const [savingNumber, setSavingNumber] = useState(false);

  const saveDocNumber = async () => {
    const suffix = (numberDraft || "").trim();
    if (!suffix) return toast.error(`${docName} number cannot be empty.`);
    const next = `${numberPrefix}${suffix}`;
    if (next === docNumber) return setNumberDraft(null);
    try {
      setSavingNumber(true);
      await API.patch(`/${apiPathFor(type)}/number/${initialDoc._id}`, {
        [numberKey]: next,
      });
      setDocNumber(next);
      setNumberDraft(null);
      toast.success(`${docName} number updated.`);
      onCreated?.(); // refresh the list behind the panel so it shows the new number
    } catch (err) {
      toast.error(
        err?.response?.status === 409
          ? `${next} already exists.`
          : err?.response?.data?.error || "Failed to update the number."
      );
    } finally {
      setSavingNumber(false);
    }
  };

  // "Full view" renders the same live preview blown up in a modal rather than
  // fetching the server's PDF — the PDF only knows the *saved* invoice, so
  // opening it would silently discard whatever the user has edited since.
  const [showFullView, setShowFullView] = useState(false);

  // The preview renders at a fixed design width and is scaled to fit the panel
  // (like zooming an image) so resizing never reflows the invoice layout.
  const PREVIEW_BASE_W = 760;
  const previewAreaRef = useRef(null);
  const sheetRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [sheetHeight, setSheetHeight] = useState(0);
  useLayoutEffect(() => {
    const area = previewAreaRef.current;
    if (!area) return;
    const update = () => {
      const avail = area.clientWidth - 12; // minus the p-1.5 padding
      const s = Math.max(0.1, avail / PREVIEW_BASE_W);
      setPreviewScale(s);
      if (sheetRef.current)
        setSheetHeight(sheetRef.current.offsetHeight * s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(area);
    if (sheetRef.current) ro.observe(sheetRef.current);
    return () => ro.disconnect();
  }, [leftPct]);
  const startSplitDrag = (e) => {
    e.preventDefault();
    const container = splitRef.current;
    if (!container) return;
    const onMove = (ev) => {
      const rect = container.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(70, Math.max(30, pct)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // Same branding + bank details the backend feeds into the PDF, so the live
  // preview shows the real seller header, GSTIN and bank block. The template
  // chosen in the Template drawer renders every document of this type, which is
  // exactly how the backend resolves it when generating the PDF.
  // Re-runs when the drawer closes so a change made there shows up right away.
  useEffect(() => {
    if (showTemplates) return;
    (async () => {
      try {
        const [b, bank, settings] = await Promise.allSettled([
          API.get("/branding"),
          API.get("/bank-details"),
          API.get("/document-templates"),
        ]);
        if (b.status === "fulfilled") setOrgDetails(b.value.data || null);
        if (bank.status === "fulfilled")
          setBankDetails(bank.value.data || null);
        if (settings.status === "fulfilled") {
          const chosen = settings.value.data?.templates?.[type];
          if (chosen) setOrgTemplate(chosen);
        }
      } catch (err) {
        console.error("Fetch branding/bank error:", err);
      }
    })();
  }, [type, showTemplates]);

  // The panel is an overlay, not a route. Push a history entry while it's open
  // so the browser Back button closes the panel and stays on Accounting,
  // instead of navigating away to the previous page.
  useEffect(() => {
    window.history.pushState({ accountingPanel: true }, "");
    const handlePop = () => onClose();
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await API.get("/items?search=&includeVariants=true");
        const flattened = (res.data || [])
          .filter((item) => item.isActive)
          .flatMap((item) => {
            const base = {
              _id: item._id,
              displayName: item.name,
              name: item.name,
              description: item.description || "",
              sellingPrice: item.sellingPrice,
              hsnSac: item.hsnSac || "",
              isVariant: false,
              parentItemId: null,
            };
            const variants = (item.variants || []).map((v) => ({
              _id: v._id,
              displayName: `${item.name} - ${v.name}`,
              name: v.name,
              description: v.description || item.description || "",
              sellingPrice: v.sellingPrice || item.sellingPrice,
              hsnSac: v.hsnSac || item.hsnSac || "",
              isVariant: true,
              parentItemId: item._id,
            }));
            return [base, ...variants];
          });
        setCatalogue(flattened);
      } catch (err) {
        console.error("Fetch items error:", err);
      }
    };
    fetchItems();
  }, []);

  useEffect(() => {
    const loadDocSettings = async () => {
      try {
        const res = await API.get("/document-settings");
        setDocSettings({
          invoicePrefix: res.data?.invoicePrefix || "INV-",
          invoiceSuffix: res.data?.invoiceSuffix || "",
          invoicePrefixes: res.data?.invoicePrefixes || ["INV-"],
          invoiceSuffixes: res.data?.invoiceSuffixes || [],
          nextInvoiceNumber: res.data?.nextInvoiceNumber || 1,
          defaultNotes: res.data?.defaultNotes || "",
          defaultTerms: res.data?.defaultTerms || "",
          documentTypeSettings: res.data?.documentTypeSettings || { invoice: { prefix: "INV-", suffix: "", prefixes: ["INV-"], suffixes: [] } },
        });
        setForm((prev) => ({
          ...prev,
          invoicePrefix: res.data?.invoicePrefix || "INV-",
          invoiceSuffix: res.data?.invoiceSuffix || "",
          nextInvoiceNumber: res.data?.nextInvoiceNumber || 1,
        }));
      } catch (error) {
        console.error("Failed to load document settings", error);
      }
    };

    loadDocSettings();
  }, []);

  const setField = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const updateItem = (index, patch) =>
    setForm((p) => ({
      ...p,
      items: p.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    }));

  const addItem = () =>
    setForm((p) => ({ ...p, items: [...p.items, blankItem()] }));

  const removeItem = (index) =>
    setForm((p) => ({
      ...p,
      items:
        p.items.length === 1 ? [blankItem()] : p.items.filter((_, i) => i !== index),
    }));

  // Same breakdown as InvoiceForm.jsx: line total -> per-item discount ->
  // subtotal after item discounts -> invoice-level discount -> GST -> final.
  const lineTotal = (item) =>
    (parseFloat(item.rate) || 0) * (parseInt(item.quantity) || 0);

  const itemDiscountAmount = (item) => {
    const base = lineTotal(item);
    const discount = parseFloat(item.discount) || 0;
    return item.discountType === "percentage" ? (base * discount) / 100 : discount;
  };

  const subtotal = form.items.reduce((sum, it) => sum + lineTotal(it), 0);
  const itemDiscountsTotal = form.items.reduce(
    (sum, it) => sum + itemDiscountAmount(it),
    0
  );
  const afterItemDiscounts = subtotal - itemDiscountsTotal;
  const invoiceDiscountAmount =
    form.discount.value > 0
      ? form.discount.type === "percentage"
        ? (afterItemDiscounts * form.discount.value) / 100
        : form.discount.value
      : 0;
  const netTaxable = afterItemDiscounts - invoiceDiscountAmount;
  const taxAmount = form.isTaxInvoice ? netTaxable * (form.gstRate / 100) : 0;
  const finalTotal = netTaxable + taxAmount;

  const money = (n) =>
    `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const submitInvoice = async (statusValue) => {
    const isDraft = statusValue === "Draft";
    if (!form.deal) return toast.error("Please select a deal.");
    if (!form.date) return toast.error(`Please pick a ${docName} date.`);
    // A quick draft only needs enough to identify the document; full GSTIN and
    // item validation apply once it's actually being created for real.
    if (!isDraft) {
      if (supportsGSTIN) {
        if (!form.receiverGSTIN.trim())
          return toast.error("Receiver GSTIN is required.");
        if (!GSTIN_REGEX.test(form.receiverGSTIN.trim().toUpperCase()))
          return toast.error(
            "Invalid GSTIN format. It should be 15 characters (e.g., 22AAAAA0000A1Z5)."
          );
      }
      const needsHsn = supportsTax && form.isTaxInvoice;
      const badItem = form.items.find(
        (it) => !it.name || !it.rate || !it.quantity || (needsHsn && !it.hsn)
      );
      if (badItem)
        return toast.error(
          needsHsn
            ? "Every item needs a name, rate, quantity and HSN."
            : "Every item needs a name, rate and quantity."
        );
    }

    try {
      setSubmitting(true);
      const payload = {
        deal: form.deal,
        date: form.date,
        dueDate: form.dueDate,
        status: statusValue,
        // Saved blank on purpose when no style was picked: the document then
        // follows the organization's template instead of freezing today's
        // choice into the record.
        transactionType: form.transactionType,
        gstRate: form.gstRate,
        discount: form.discount,
        notes: form.notes,
        terms: form.terms,
        amount: finalTotal,
        items: form.items.map((it) => ({
          itemId: it._id,
          name: it.name,
          description: it.description,
          rate: parseFloat(it.rate) || 0,
          quantity: parseInt(it.quantity) || 0,
          hsn: it.hsn,
          isVariant: it.isVariant,
          parentItemId: it.parentItemId,
          discountType: it.discountType,
          discount: parseFloat(it.discount) || 0,
        })),
      };
      if (supportsGSTIN) {
        payload.receiverGSTIN = form.receiverGSTIN.trim().toUpperCase();
      }
      if (supportsTax) {
        payload[taxFlagKey] = form.isTaxInvoice;
      }
      // Numbering is configured per document type and only wired up for
      // invoices, so the prefix/suffix/next-number fields ride along on that
      // type alone rather than on every document.
      if (type === "tax") {
        payload.invoicePrefix =
          form.invoicePrefix?.trim() || docSettings.invoicePrefix || "INV-";
        payload.invoiceSuffix = form.invoiceSuffix ?? docSettings.invoiceSuffix ?? "";
        payload.invoiceNumber = form.invoiceNumber?.toString().trim() || undefined;
        payload.nextInvoiceNumber =
          form.nextInvoiceNumber ?? docSettings.nextInvoiceNumber ?? 1;
      }

      const path = apiPathFor(type);
      if (isEditing) {
        await API.put(`/${path}/${initialDoc._id}`, payload);
        toast.success(isDraft ? "Saved as draft!" : `${docName} updated successfully!`);
      } else {
        await API.post(`/${path}`, payload);
        toast.success(isDraft ? "Saved as draft!" : `${docName} created successfully!`);
      }
      onCreated();
      onClose();
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
        `Failed to ${isEditing ? "update" : isDraft ? "save draft" : "create"} ${docName.toLowerCase()}`
      );
      console.error(`${isEditing ? "Update" : "Create"} ${type} error:`, err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = () => submitInvoice("Draft");

  // The template this document renders with. The organization's choice wins
  // outright: htmlDocumentPdf.resolveTemplate ignores the document's stored
  // `style` entirely, and every document saved before that change still
  // carries style:"Classic" from the old schema default. Honouring it here
  // would pin the preview to Classic forever *and* disagree with the PDF.
  // Used by the preview *and* the print window so all three agree.
  const previewTemplate = orgTemplate;

  // Prints exactly what the preview shows — the same shared fragment the PDF
  // is rendered from — including edits that haven't been saved yet, rather
  // than fetching the server's copy of the document.
  const handlePrint = () => {
    const html = buildDocumentHtml(
      {
        ...form,
        isTaxInvoice: supportsTax && !!form.isTaxInvoice,
        isTaxQuotation: supportsTax && !!form.isTaxInvoice,
      },
      {
        type,
        template: previewTemplate,
        orgDetails,
        bankDetails,
        dealName: dealOptions.find((d) => d.value === form.deal)?.label,
        documentNumber: docNumber,
      }
    );
    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) {
      toast.error("Allow pop-ups for this site to print.");
      return;
    }
    win.document.write(`<!doctype html>
<html>
<head><meta charset="utf-8" /><title>${docNumber || docName}</title>
<style>
  @page { size: A4; margin: 12mm; }
  html, body { margin: 0; padding: 0; }
  .dcsheet { padding: 0 !important; }
  /* Browsers drop background fills when printing unless asked not to, which
     would strip the header bands and tinted rows some templates rely on. */
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  /* The sheet is authored at 760px and Chrome scales it to the printable
     width, so 1px rules land on fractions of a device pixel and get rounded
     away — the <table> blocks keep theirs (collapsed borders round up), the
     plain div boxes lose theirs entirely and only reappear when zoomed in.
     Printing at a slightly thicker hairline survives the downscale. */
  .dcsheet { --line-w: 1.5px; }
</style>
</head>
<body>${html}</body>
</html>`);
    win.document.close();
    win.focus();
    // Give the styles (and the logo, if any) a moment to apply before the
    // dialog snapshots the page. document.write can finish loading before
    // onload is attached, so fall back to a timer rather than never printing.
    let printed = false;
    const print = () => {
      if (printed) return;
      printed = true;
      win.print();
    };
    win.onload = print;
    setTimeout(print, 500);
  };
  const handleSubmit = () => submitInvoice(form.status || "Draft");

  const dealOptions = deals.map((d) => ({ value: d._id, label: d.title }));
  const inputClass =
    "w-full h-10 px-2.5 rounded-[25px] border border-[#E1E4EA] bg-white text-[13px] text-[#1F2937] placeholder:text-[#99A0AE] focus:outline-none focus:border-[#0085FF] transition-colors";

  // Catalogue descriptions can be stored as rich-text HTML; show plain text in
  // the description field instead of raw markup.
  const stripHtml = (html) => {
    if (!html) return "";
    if (!/[<&]/.test(html)) return html;
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
  };

  // Grid template for the wide (row/list) item layout — includes an HSN column
  // only for tax invoices. Card layout ignores this and stacks fields.
  // Description isn't a column any more — it's an optional box under each row.
  const itemRowCols = form.isTaxInvoice
    ? "@2xl:grid-cols-[1.9fr_0.7fr_0.7fr_0.55fr_1.1fr_0.9fr_32px]"
    : "@2xl:grid-cols-[2.2fr_0.8fr_0.6fr_1.2fr_0.9fr_32px]";

  return (
    <div
      className="fixed right-0 bottom-0 bg-white z-[60] flex flex-col top-[54px] lg:top-16"
      style={{ left: "var(--sidebar-width, 0px)" }}
    >
      {/* Single continuous resizer line spanning the strip + panels, so the
          divider reads as one line from the navbar down. */}
      <div
        onMouseDown={startSplitDrag}
        title="Drag to resize"
        style={{ left: `calc(0.5rem + (100% - 1rem) * ${leftPct / 100} + 3px)` }}
        className={`${hidePreview ? "hidden" : "hidden lg:flex"} absolute top-0 bottom-0 w-4 -translate-x-1/2 cursor-col-resize items-center justify-center gap-[3px] z-20 group`}
      >
        {/* Two hairlines at rest; on hover the gap between them fills so the
            pair reads as one solid blue bar. */}
        <div className="flex h-full gap-[3px] rounded-full group-hover:bg-[#0085FF] group-active:bg-[#0085FF] transition-colors">
          <span className="w-px h-full rounded-full bg-[#E1E4EA] group-hover:bg-[#0085FF] group-active:bg-[#0085FF] transition-colors" />
          <span className="w-px h-full rounded-full bg-[#E1E4EA] group-hover:bg-[#0085FF] group-active:bg-[#0085FF] transition-colors" />
        </div>

        {/* Decoration only — it marks the divider so the split reads as
            draggable. `pointer-events-none` is deliberate: clicks and drags
            pass straight through to the resizer behind it, so grabbing the
            knob resizes rather than doing nothing. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-24 left-1/2 -translate-x-1/2 z-30 w-7 h-7 flex items-center justify-center rounded-full bg-white border border-[#E1E4EA] text-[#525866] shadow-md group-hover:text-[#0085FF] group-hover:border-[#0085FF] group-active:text-[#0085FF] group-active:border-[#0085FF] transition-colors"
        >
          <ChevronsLeftRight className="w-3.5 h-3.5" />
        </div>
      </div>
      {/* Fixed top strip — one 64px header bar (same height as the Companies
          toolbar), not part of the scrolling panels. Same border + shadow as
          the app navbar so the header reads as a separate layer above the
          form. Each column draws its own divider *and* its own shadow, so the
          two segments stay visually separate and the resizer gap between them
          casts nothing. `relative z-10` matters: without it the panels below
          paint their white background over the shadows and they vanish. */}
      <div className="relative z-10 flex-shrink-0 h-16 flex items-stretch bg-white px-2">
        {/* Left: form header */}
        <div
          style={{ width: formWidth }}
          className={`flex items-stretch px-3 lg:px-4 lg:pr-6 min-w-0 self-stretch ${hidePreview ? "" : "max-lg:!w-1/2"}`}
        >
          <div className="w-full flex items-center justify-between gap-2 border-b border-[#E1E4EA] shadow-[0_4px_5px_-3px_rgba(0,0,0,0.16)]">
            <div className="min-w-0">
              {isEditing && docNumber ? (
                <>
                  {numberDraft === null ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h2 className="text-xl font-bold text-[#1F2937] truncate">
                        {docNumber}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setNumberDraft(numberSuffix)}
                        title={`Rename this ${docName.toLowerCase()}`}
                        aria-label={`Rename this ${docName.toLowerCase()}`}
                        className="p-1 rounded-md text-[#99A0AE] hover:text-[#0085FF] hover:bg-[#F0F6FF] transition-colors flex-shrink-0"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    // The prefix sits outside the input so it reads as part of
                    // the number but can't be edited or deleted.
                    <div className="flex items-center gap-1 min-w-0">
                      <div className="flex items-center h-9 pl-2.5 pr-1 border border-[#E1E4EA] rounded-lg focus-within:border-[#0085FF] min-w-0">
                        <span className="text-xl font-bold text-[#99A0AE] flex-shrink-0">
                          {numberPrefix}
                        </span>
                        <input
                          autoFocus
                          value={numberDraft}
                          disabled={savingNumber}
                          onChange={(e) => setNumberDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveDocNumber();
                            if (e.key === "Escape") setNumberDraft(null);
                          }}
                          className="w-28 min-w-0 px-1 text-xl font-bold text-[#1F2937] outline-none bg-transparent"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={saveDocNumber}
                        disabled={savingNumber}
                        className="h-7 px-2 rounded-lg bg-[#0085FF] hover:bg-blue-600 text-white text-[11px] font-medium transition-colors disabled:opacity-60 flex-shrink-0"
                      >
                        {savingNumber ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNumberDraft(null)}
                        disabled={savingNumber}
                        className="h-7 px-2 rounded-lg border border-[#E1E4EA] text-[11px] font-medium text-[#525866] hover:bg-gray-50 transition-colors flex-shrink-0"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <h2 className="text-xl font-bold text-[#1F2937] truncate">
                  {isEditing ? `Edit ${docName}` : `Create New ${docName}`}
                </h2>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setHidePreview((v) => !v)}
                title={hidePreview ? "Show preview" : "Hide preview — full width form"}
                aria-pressed={hidePreview}
                className="h-8 w-8 flex items-center justify-center bg-white border border-[#E1E4EA] rounded-full text-[#525866] hover:bg-gray-50 transition-colors shadow-sm flex-shrink-0"
              >
                {hidePreview ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
              {/* Document-level settings for this screen — distinct from the
                  app's global Settings page. Saving moved to the sticky bar at
                  the bottom of the form, so this slot hosts it instead.
                  Reachable even with the preview hidden, unlike the "Change
                  Template" button that lives in the preview header. */}
              <button
                type="button"
                onClick={() => setShowTemplates(true)}
                title={`${docName} settings`}
                className="h-8 px-4 flex items-center gap-1.5 bg-white border border-[#E1E4EA] rounded-full text-[13px] font-medium text-[#1F2937] hover:bg-gray-50 transition-colors shadow-sm flex-shrink-0"
              >
                <Settings className="w-3.5 h-3.5 text-[#525866]" />
                Settings
              </button>
              {/* Saving/creating lives in the sticky bar at the foot of the
                  form; this slot offers the draft escape hatch instead. */}
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={submitting}
                className="h-8 px-4 flex items-center gap-1.5 rounded-full bg-[#0085FF] hover:bg-blue-600 text-white text-[13px] font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0"
              >
                <FileText className="w-3.5 h-3.5" />
                Save as Draft
              </button>
            </div>
          </div>
        </div>
        {/* Gap reserved for the absolute resizer line — no bottom border here,
            so the strip line reads as two separate parts (left / right). */}
        {!hidePreview && <div className="hidden lg:block w-1.5 flex-shrink-0 self-stretch" />}
        {/* Right: preview header */}
        <div
          className={`flex-1 min-w-0 items-stretch px-3 lg:pl-6 self-stretch ${hidePreview ? "hidden" : "flex"}`}
        >
          <div className="w-full flex items-center justify-between gap-4 border-b border-[#E1E4EA] shadow-[0_4px_5px_-3px_rgba(0,0,0,0.16)]">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-[#1F2937] truncate">
              {docName} Preview
            </h2>
            <p className="text-xs text-[#99A0AE] truncate">
              This is how your {docName.toLowerCase()} will appear to the customer.
            </p>
          </div>
          {/* The template is an organization-wide setting, so this opens the
              same Template drawer the Accounting toolbar uses rather than
              pinning a style onto this one document. */}
          <div className="flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowTemplates(true)}
              className="h-8 px-4 flex items-center gap-1.5 rounded-full bg-[#0085FF] hover:bg-blue-600 text-white text-sm font-medium transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Change Template
            </button>
          </div>
          </div>
        </div>
      </div>

      {/* Frame 2147225003 — the two panels sit side by side, each scrolling
          independently, so neither one's height depends on the other. */}
      <div ref={splitRef} className="flex-1 min-h-0 flex flex-col lg:flex-row items-stretch px-2 pb-2 pt-0 gap-0 overflow-hidden">
        {/* Left: form. Frame 1351649637
            The scrolling element itself must NOT be a flex container: when a
            flex item's parent has `overflow` other than visible, the spec
            drops that item's min-height from `auto` to `0`, so flex-shrink:1
            (the default) is free to squash it below its content size instead
            of the overflow ever kicking in — exactly the "top of the item
            list collapses to a sliver" bug reported at 100% zoom (less
            available height = more squashing; zooming out to 90% just gave
            the content more room, masking it). Fix: keep `overflow-y-auto`
            on this outer box but make it a plain block, and put all the
            flex-col spacing on a single inner wrapper instead — that
            wrapper isn't itself inside an overflow context, so its children
            keep their natural `min-height: auto` and the outer box scrolls
            for real instead of silently crushing them. */}
        <div
          style={{ width: formWidth }}
          className="@container max-lg:!w-full flex-shrink-0 bg-white p-3 lg:p-4 lg:pr-6 overflow-y-auto self-stretch"
        >
          <div className="w-full flex flex-col items-start gap-1">
          <SectionHeader number={sectionNo.details} title={`${docName} Details`} />
          <div className="grid grid-cols-1 @md:grid-cols-2 gap-x-6 gap-y-2 w-full">
            <div className="flex flex-col gap-1">
              <FieldLabel required>Select Deal</FieldLabel>
              <div className="flex items-center gap-2">
                <PickerSelect
                  value={form.deal}
                  options={dealOptions}
                  placeholder="Search and select deal"
                  icon={Search}
                  onSelect={(o) => setField("deal", o.value)}
                />
                <button
                  type="button"
                  onClick={onAddDeal}
                  title="Create a new deal"
                  className="w-10 h-10 flex-shrink-0 rounded-full bg-[#0085FF] hover:bg-blue-600 text-white flex items-center justify-center transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <FieldLabel required>{docName} Date</FieldLabel>
              {/* Reserve the same 40px + gap the Select Deal "+" button takes,
                  so this input lines up with the deal picker's width. */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setField("date", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="w-10 flex-shrink-0" aria-hidden="true" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <FieldLabel>Due Date</FieldLabel>
              {/* Same reserved 40px + gap as the fields above, so this input
                  ends flush with the deal picker instead of running past it. */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setField("dueDate", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="w-10 flex-shrink-0" aria-hidden="true" />
              </div>
            </div>
          </div>

          {supportsGSTIN && (
          <>
          <SectionHeader number={sectionNo.billing} title="Billing & Tax Information" />
          <div className="grid grid-cols-1 @md:grid-cols-2 gap-x-6 gap-y-2 w-full">
            <div className="flex flex-col gap-1">
              <FieldLabel required>Receiver GSTIN</FieldLabel>
              {/* Match the Select Deal picker width (reserve the "+" button space). */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={form.receiverGSTIN}
                  onChange={(e) => setField("receiverGSTIN", e.target.value)}
                  placeholder="Enter Receiver GSTIN (e.g., 22AAAAA0000A1Z5)"
                  className={`${inputClass} flex-1 min-w-0`}
                />
                <div className="w-10 flex-shrink-0" aria-hidden="true" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <FieldLabel>Tax Invoice</FieldLabel>
              <div className="flex items-center gap-2.5 h-8">
                <button
                  type="button"
                  onClick={() => setField("isTaxInvoice", !form.isTaxInvoice)}
                  className="flex-shrink-0"
                >
                  <span
                    className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${form.isTaxInvoice ? "bg-[#0085FF]" : "bg-[#E1E4EA]"
                      }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.isTaxInvoice ? "translate-x-4" : "translate-x-0"
                        }`}
                    />
                  </span>
                </button>
                <div className="flex flex-col">
                  <span className="text-[12px] font-medium text-[#1F2937]">
                    Enable Tax Invoice
                  </span>
                  <span className="text-[10px] text-[#99A0AE]">
                    Include GST and tax details in this invoice
                  </span>
                </div>
              </div>
            </div>
          </div>
          </>
          )}

          {/* Items — one card per line item, every field labelled and
              full-width so nothing is cramped regardless of panel width. */}
          <SectionHeader number={sectionNo.items} title={`${docName} Items`} />
          <div className="w-full flex flex-col gap-2 @2xl:gap-0 mb-1">
            {/* Column header — only shown in the wide (row/list) layout. */}
            <div
              className={`hidden @2xl:grid @2xl:items-center gap-2 px-2 pb-1 text-[11px] font-medium text-[#525866] ${itemRowCols}`}
            >
              <span>Item</span>
              {form.isTaxInvoice && <span>HSN</span>}
              <span>Rate (₹)</span>
              <span>Qty</span>
              <span>Discount</span>
              <span className="text-right">Amount</span>
              <span />
            </div>

            {form.items.map((item, index) => {
              const numInput =
                "w-full h-10 px-2.5 rounded-[25px] border border-[#E1E4EA] text-[13px] focus:outline-none focus:border-[#0085FF] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
              const txtInput =
                "w-full h-10 px-2.5 rounded-[25px] border border-[#E1E4EA] text-[13px] placeholder:text-[#99A0AE] focus:outline-none focus:border-[#0085FF]";
              // Label shows in card mode, hidden in the wide row layout (the
              // column header covers it there).
              const lbl =
                "text-[11px] font-medium text-[#525866] mb-1 block @2xl:hidden";
              const hasDescription =
                item.showDescription || !!item.description;
              return (
                <div
                  key={index}
                  className="border border-[#E1E4EA] rounded-lg bg-white p-3 @2xl:border-0 @2xl:border-b @2xl:rounded-none @2xl:p-0 @2xl:last:border-b-0"
                >
                <div
                  className={`grid grid-cols-1 @md:grid-cols-2 gap-x-3 gap-y-2 @2xl:items-center @2xl:gap-2 @2xl:px-2 @2xl:py-1.5 ${itemRowCols}`}
                >
                  {/* Card-only header: index + remove (hidden in row layout) */}
                  <div className="flex items-center justify-between mb-1 @md:col-span-2 @2xl:hidden">
                    <span className="text-[12px] font-semibold text-[#1F2937]">
                      Item {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      title="Remove item"
                      disabled={form.items.length === 1}
                      className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Item picker */}
                  <div className="@md:col-span-2 @2xl:col-span-1 min-w-0">
                    <label className={lbl}>Item</label>
                    <PickerSelect
                      value={item._id}
                      options={catalogue.map((c) => ({
                        value: c._id,
                        label: c.displayName,
                      }))}
                      placeholder="Search items or variants"
                      onSelect={(o) => {
                        const picked = catalogue.find(
                          (c) => c._id === o.value
                        );
                        if (!picked) return;
                        updateItem(index, {
                          _id: picked._id,
                          name: picked.name,
                          description: stripHtml(picked.description),
                          rate: picked.sellingPrice ?? "",
                          hsn: picked.hsnSac || "",
                          isVariant: picked.isVariant,
                          parentItemId: picked.parentItemId,
                        });
                      }}
                    />
                  </div>

                  {/* HSN (tax invoices only) */}
                  {form.isTaxInvoice && (
                    <div className="min-w-0">
                      <label className={lbl}>HSN / SAC</label>
                      <input
                        value={item.hsn}
                        onChange={(e) =>
                          updateItem(index, { hsn: e.target.value })
                        }
                        placeholder="HSN"
                        className={txtInput}
                      />
                    </div>
                  )}

                  {/* Rate */}
                  <div className="min-w-0">
                    <label className={lbl}>Rate (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={item.rate}
                      onChange={(e) =>
                        updateItem(index, { rate: e.target.value })
                      }
                      placeholder="0.00"
                      className={numInput}
                    />
                  </div>

                  {/* Quantity */}
                  <div className="min-w-0">
                    <label className={lbl}>Qty</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, { quantity: e.target.value })
                      }
                      placeholder="1"
                      className={numInput}
                    />
                  </div>

                  {/* Discount + type */}
                  <div className="min-w-0">
                    <label className={lbl}>Discount</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        value={item.discount}
                        onChange={(e) => {
                          const rawValue = e.target.value;
                          const parsed = parseFloat(rawValue) || 0;
                          const base = lineTotal(item);
                          let clamped = rawValue;
                          if (
                            item.discountType === "amount" &&
                            parsed > base
                          ) {
                            clamped = base;
                            toast.error(
                              "Item discount cannot exceed item total."
                            );
                          } else if (
                            item.discountType === "percentage" &&
                            parsed > 100
                          ) {
                            clamped = 100;
                            toast.error(
                              "Percentage discount cannot exceed 100%."
                            );
                          }
                          updateItem(index, { discount: clamped });
                        }}
                        placeholder="0"
                        className={`${numInput} flex-1 min-w-0`}
                      />
                      <select
                        value={item.discountType}
                        onChange={(e) =>
                          updateItem(index, { discountType: e.target.value })
                        }
                        className="h-10 px-1.5 rounded-[25px] border border-[#E1E4EA] text-[13px] text-gray-700 bg-white focus:outline-none focus:border-[#0085FF] flex-shrink-0"
                      >
                        <option value="amount">₹</option>
                        <option value="percentage">%</option>
                      </select>
                    </div>
                  </div>

                  {/* Row-layout amount cell (hidden in card mode) */}
                  <span className="hidden @2xl:block text-right text-[13px] font-semibold text-[#1F2937] pr-1">
                    {money(lineTotal(item) - itemDiscountAmount(item))}
                  </span>

                  {/* Row-layout remove button (hidden in card mode) */}
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    title="Remove item"
                    disabled={form.items.length === 1}
                    className="hidden @2xl:flex w-8 h-8 items-center justify-center text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Card-only amount footer (hidden in row layout) */}
                  <div className="flex items-center justify-between border-t border-[#E1E4EA] mt-2 pt-2 @md:col-span-2 @2xl:hidden">
                    <span className="text-[12px] text-[#525866]">Amount</span>
                    <span className="text-[14px] font-semibold text-[#1F2937]">
                      {money(lineTotal(item) - itemDiscountAmount(item))}
                    </span>
                  </div>
                </div>

                {/* Optional description, printed under the item name on the
                    document. Hidden behind a link until asked for, so a plain
                    line item stays a single row. */}
                <div className="mt-2 @2xl:mt-0 @2xl:px-2 @2xl:pb-2">
                  {hasDescription ? (
                    <textarea
                      rows={2}
                      autoFocus={item.showDescription && !item.description}
                      value={item.description}
                      onChange={(e) =>
                        updateItem(index, { description: e.target.value })
                      }
                      onBlur={() => {
                        // Collapse again if they opened it and typed nothing.
                        if (!item.description)
                          updateItem(index, { showDescription: false });
                      }}
                      placeholder="Describe this item — appears under its name on the document"
                      className="w-full px-2.5 py-2 rounded-[25px] border border-[#E1E4EA] text-[13px] placeholder:text-[#99A0AE] focus:outline-none focus:border-[#0085FF] resize-y"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        updateItem(index, { showDescription: true })
                      }
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0085FF] hover:underline"
                    >
                      <Plus className="w-3 h-3" />
                      Add description
                    </button>
                  )}
                </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="w-full h-10 min-h-[40px] flex-shrink-0 flex items-center justify-center gap-2 rounded-lg bg-white border border-[#0085FF]/20 text-sm font-medium text-[#0085FF] hover:bg-blue-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Another Item
          </button>

          {/* Notes and terms — free text printed in the document's footer.
              Left empty, that footer block simply doesn't appear. They sit
              side by side: both are short, and the document prints them as one
              footer block. Stacks again when the form is narrow. */}
          <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-x-6 gap-y-2 w-full mt-3">
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <SectionHeader number={sectionNo.notes} title="Notes" />
                <OpenNotesTermsButton
                  label="Add Notes"
                  onClick={() => setNotesDrawer("notes")}
                />
              </div>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder={`A short message to the customer, e.g. "Thank you for the business!"`}
                className="w-full px-3 py-2 rounded-[25px] border border-[#E1E4EA] text-[13px] placeholder:text-[#99A0AE] focus:outline-none focus:border-[#0085FF] resize-y"
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <SectionHeader
                  number={sectionNo.terms}
                  title="Terms and Conditions"
                />
                <OpenNotesTermsButton
                  label="Add Terms"
                  onClick={() => setNotesDrawer("terms")}
                />
              </div>
              <textarea
                rows={4}
                value={form.terms}
                onChange={(e) => setField("terms", e.target.value)}
                placeholder={"1. Goods once sold cannot be taken back or exchanged.\n2. Subject to local jurisdiction."}
                className="w-full px-3 py-2 rounded-[25px] border border-[#E1E4EA] text-[13px] placeholder:text-[#99A0AE] focus:outline-none focus:border-[#0085FF] resize-y"
              />
            </div>
          </div>

          <SectionHeader number={sectionNo.summary} title={`${docName} Summary`} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 w-full">
            {/* Invoice-level discount, applied after the per-item ones */}
            <div className="flex flex-col gap-1">
              <FieldLabel>{docName} Discount</FieldLabel>
              {/* Leading unit (₹ / %) with an up/down toggle built into the
                  field — switches the discount type in place, no separate
                  switcher. Reserve the same trailing space as Invoice Date so
                  the two fields line up in width. */}
              <div className="flex items-center gap-2">
              <div className="relative flex items-center flex-1 min-w-0 h-10 rounded-[25px] border border-[#E1E4EA] focus-within:border-[#0085FF] overflow-hidden">
                <input
                  type="number"
                  min="0"
                  value={form.discount.value}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const parsed = parseFloat(raw) || 0;
                    let clamped = raw;
                    if (
                      form.discount.type === "percentage" &&
                      parsed > 100
                    ) {
                      clamped = 100;
                      toast.error("Percentage discount cannot exceed 100%.");
                    } else if (
                      form.discount.type === "fixed" &&
                      parsed > afterItemDiscounts
                    ) {
                      clamped = afterItemDiscounts;
                      toast.error(
                        "Invoice discount cannot exceed subtotal after item discounts."
                      );
                    }
                    setField("discount", { ...form.discount, value: clamped });
                  }}
                  className="flex-1 min-w-0 h-full px-2.5 text-[13px] focus:outline-none"
                />
                <div className="flex items-stretch h-full">
                  <span className="w-7 flex items-center justify-center text-[13px] font-semibold text-[#0085FF]">
                    {form.discount.type === "percentage" ? "%" : "₹"}
                  </span>
                  <div className="flex flex-col justify-center">
                    {[ChevronUp, ChevronDown].map((Icon, i) => (
                      <button
                        key={i}
                        type="button"
                        title="Switch between ₹ and %"
                        onClick={() =>
                          setField("discount", {
                            ...form.discount,
                            type:
                              form.discount.type === "percentage"
                                ? "fixed"
                                : "percentage",
                          })
                        }
                        className={`w-5 h-2.5 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded transition-colors ${i === 1 ? "-mt-0.5" : ""}`}
                      >
                        <Icon className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
                <div className="w-10 flex-shrink-0" aria-hidden="true" />
              </div>
            </div>

            {/* Breakdown + Create Invoice */}
            <div className="flex flex-col gap-1.5">
              <div className="space-y-1 text-[13px]">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-medium text-[#1F2937]">
                    {money(subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-red-500">
                  <span>Item Discounts</span>
                  <span>- {money(itemDiscountsTotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>After Item Discounts</span>
                  <span className="font-medium text-[#1F2937]">
                    {money(afterItemDiscounts)}
                  </span>
                </div>
                <div className="flex justify-between text-red-500">
                  <span>Invoice Discount</span>
                  <span>- {money(invoiceDiscountAmount)}</span>
                </div>
                {form.isTaxInvoice && (
                  <div className="flex justify-between text-gray-600">
                    <span>GST ({form.gstRate}%)</span>
                    <span className="font-medium text-[#1F2937]">
                      {money(taxAmount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center px-2.5 py-1.5 rounded-lg bg-[#F0F6FF]">
                  <span className="font-bold text-[#0085FF]">Final Total</span>
                  <span className="font-bold text-[#0085FF]">
                    {money(finalTotal)}
                  </span>
                </div>
                <div className="pt-1">
                  <p className="text-xs text-[#99A0AE]">Amount in Words</p>
                  <p className="text-xs font-medium text-[#525866]">
                    {numberToWords(finalTotal)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Running total + primary actions, pinned to the bottom of the form
              column. It sticks inside this scroll container rather than being
              fixed to the viewport, so it stays inside the form even when the
              preview is showing and the split is dragged. */}
          {/* Sized to its contents and centred, so it reads as a floating bar
              over the form rather than another full-width section. The wrapper
              ignores pointer events so the empty space either side of the pill
              doesn't block the fields underneath it. */}
          <div className="sticky bottom-0 z-20 w-full pt-3 pb-1 flex justify-center pointer-events-none">
            <div className="pointer-events-auto flex w-full max-w-2xl items-center justify-between gap-5 rounded-full border border-[#E1E4EA] bg-white/95 backdrop-blur-sm pl-6 pr-2.5 py-2.5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.22)]">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-wide text-[#99A0AE] uppercase leading-none">
                  Total
                </p>
                <p className="text-[18px] font-bold text-[#1F2937] leading-tight truncate">
                  {money(finalTotal)}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="h-9 px-4 flex items-center gap-1.5 bg-white border border-[#E1E4EA] rounded-full text-[13px] font-medium text-[#1F2937] hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5 text-[#525866]" />
                  Print
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="h-9 px-4 flex items-center gap-1.5 rounded-full bg-[#0085FF] hover:bg-blue-600 text-white text-[13px] font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {submitting
                    ? isEditing
                      ? "Updating..."
                      : "Creating..."
                    : isEditing
                      ? `Update ${docName}`
                      : `Create ${docName}`}
                  {!submitting && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* Gap reserved for the absolute resizer line (rendered at panel level). */}
        {!hidePreview && <div className="hidden lg:block w-1.5 flex-shrink-0" />}

        {/* Right: preview. Frame 1351649638 — stretches to fill whatever's left beside the form panel. */}
        <div
          className={`relative w-full lg:flex-1 min-w-0 bg-white p-3 lg:pl-6 flex-col items-start gap-4 self-stretch ${hidePreview ? "hidden" : "flex"}`}
        >
          {/* Live invoice preview — mirrors the structure of the downloaded /
              printed document and reflects the form's changes in real time. */}
          <div
            ref={previewAreaRef}
            className="group w-full flex-1 min-h-0 self-stretch overflow-y-auto overflow-x-hidden relative p-1.5"
          >
            {/* Full-view button — appears on hover, opens the same document
                viewer as the eye action in the list (edit mode only). */}
            {isEditing && (
              <button
                type="button"
                onClick={() => setShowFullView(true)}
                title="Full view"
                className="absolute top-3 right-3 z-10 flex items-center gap-1.5 h-8 px-3 rounded-full bg-[#1F2937] text-white text-xs font-medium shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Eye className="w-3.5 h-3.5" />
                Full view
              </button>
            )}
            {/* Fixed-width sheet scaled to fit — resizing zooms the invoice
                instead of reflowing it. Outer div reserves the scaled height. */}
            <div style={{ height: sheetHeight || undefined }}>
              <div
                ref={sheetRef}
                style={{
                  width: PREVIEW_BASE_W,
                  transform: `scale(${previewScale})`,
                  transformOrigin: "top left",
                }}
              >
                <InvoiceLivePreview
                  form={form}
                  orgDetails={orgDetails}
                  bankDetails={bankDetails}
                  type={type}
                  template={previewTemplate}
                  supportsTax={supportsTax}
                  invoiceNumber={docNumber}
                  dealName={dealOptions.find((d) => d.value === form.deal)?.label}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full view — the same live preview at full size, driven by the current
          (possibly unsaved) form state, so it always shows what's on screen. */}
      {/* Opened by the "Add Notes" / "Add Terms" links beside those sections.
          Writes to the same form fields the inline boxes use, so the preview
          updates as you type either way. */}
      <NotesTermsDrawer
        isOpen={notesDrawer !== null}
        focus={notesDrawer || "notes"}
        onClose={() => setNotesDrawer(null)}
        type={type}
        docName={docName}
        onApplyNotes={(v) => setField("notes", v)}
        onApplyTerms={(v) => setField("terms", v)}
      />

      {/* Opened by "Change Template" above — edits the organization-wide
          choice, so closing it refreshes orgTemplate and the preview restyles. */}
      <TemplateDrawer
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        type={type}
        docLabel={docName}
      />

      {showFullView &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100002] flex flex-col"
            onClick={() => setShowFullView(false)}
          >
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-white border-b border-[#E1E4EA]">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-[#1F2937] truncate">
                  {docName} Preview
                  {initialDoc?.[numberKeyFor(type)]
                    ? ` #${initialDoc[numberKeyFor(type)]}`
                    : ""}
                </h2>
                <p className="text-xs text-[#99A0AE] truncate">
                  Showing your current edits, including unsaved changes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFullView(false)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-6">
              <div
                className="mx-auto bg-white shadow-2xl"
                style={{ width: PREVIEW_BASE_W }}
                onClick={(e) => e.stopPropagation()}
              >
                <InvoiceLivePreview
                  form={form}
                  orgDetails={orgDetails}
                  bankDetails={bankDetails}
                  type={type}
                  template={previewTemplate}
                  supportsTax={supportsTax}
                  invoiceNumber={docNumber}
                  dealName={dealOptions.find((d) => d.value === form.deal)?.label}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

const Accounting = () => {
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
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [editPanelDoc, setEditPanelDoc] = useState(null);
  const [showQuickDealForm, setShowQuickDealForm] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
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
    setSelectedIds((prev) =>
      prev.length === currentDocuments.length && currentDocuments.length > 0
        ? []
        : currentDocuments.map((doc) => doc._id)
    );
  };

  const handleSelectOne = (id) => {
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
    const sourcePath = `converter/${apiPathFor(convertDocType)}/convert-to`;
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
      toast.success(`Converted to ${docNameFor(convertTargetType)} successfully`);
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
            ₹<HighlightText text={doc.amount?.toFixed(2) || "0.00"} query={searchQuery} />
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
            className="fixed right-0 h-[72px] px-4 lg:px-[24px] border-b border-blue-200 bg-blue-50 flex items-center top-[54px] lg:top-16"
            style={{ left: "var(--sidebar-width, 0px)", zIndex: 41 }}
          >
            <div
              className={`${bulkStripClosing ? "animate-slideOutRight" : "animate-slideInLeft"} flex flex-nowrap lg:flex-wrap items-center justify-start lg:justify-between gap-4 lg:gap-6 w-full h-full overflow-x-auto lg:overflow-visible`}
            >
              {/* Left: bulk action buttons */}
              <div className="flex flex-nowrap lg:flex-wrap items-center gap-3 flex-shrink-0">
                <button
                  onClick={handleExportSelected}
                  className="h-10 px-4 bg-white border border-green-600 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 focus:outline-none transition-colors flex items-center gap-2 flex-shrink-0 whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <button
                  onClick={() => {
                    setBulkUpdateStatus("");
                    setShowBulkUpdateModal(true);
                  }}
                  className="h-10 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none transition-colors flex items-center gap-2 flex-shrink-0 whitespace-nowrap"
                >
                  <Pencil className="w-4 h-4" />
                  Bulk Update
                </button>
                <button
                  onClick={() => setShowBulkDeleteModal(true)}
                  disabled={bulkDeleting}
                  className="h-10 px-4 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 focus:outline-none transition-colors flex items-center gap-2 disabled:opacity-50 flex-shrink-0 whitespace-nowrap"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="h-10 px-4 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none transition-colors flex items-center gap-2 flex-shrink-0 whitespace-nowrap"
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
          className="fixed right-0 h-[72px] px-4 lg:px-[24px] border-b border-[#E1E4EA] bg-white flex items-center justify-between gap-3 top-[54px] lg:top-16"
          style={{ left: "var(--sidebar-width, 0px)", zIndex: 39 }}
        >
          {/* Left Side: Tabs Container — same pill selector as the Company tabs.
              Never skeletoned: the tabs are navigation, not data, so they stay
              mounted and clickable while the table loads. */}
          <div className="relative flex-shrink-0 inline-flex items-center gap-1 h-11 p-1 bg-[#F1F1F5] rounded-full overflow-x-auto no-scrollbar">
            <span
              className="absolute top-1 bottom-1 rounded-full bg-white shadow-sm transition-all duration-300 ease-out pointer-events-none"
              style={{ left: tabIndicator.left, width: tabIndicator.width }}
            />
            {TABS.map((tab) => (
              <button
                key={tab.key}
                ref={(el) => (tabRefs.current[tab.key] = el)}
                onClick={() => setActiveTab(tab.key)}
                className={`relative z-10 flex items-center justify-center h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.key
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
              <Skeleton width={44} height={44} shape="circle" />
              <Skeleton width={44} height={44} shape="circle" />
              <Skeleton width={44} height={44} shape="circle" />
              <Skeleton width={146} height={44} shape="circle" className="ml-1" />
            </div>
          ) : (
            <div className="flex flex-row items-center gap-2 flex-shrink-0 min-w-0">
              {/* Search field — expands in place from the search icon,
                  matching the Companies strip behaviour. */}
              <div
                className={`relative h-11 flex items-center border border-[#E1E4EA] rounded-full bg-white transition-all duration-300 ease-in-out hover:bg-gray-50 focus-within:border-[#0085FF] focus-within:hover:bg-white ${isSearchExpanded ? "w-[220px] sm:w-[300px] lg:w-[380px]" : "w-11"} max-w-full flex-shrink-0`}
              >
                <SearchIcon
                  className="absolute left-3.5 text-[#1F2937] w-[18px] h-[18px] cursor-pointer z-10 flex-shrink-0 top-1/2 -translate-y-1/2 w-4 h-4 text-[#525866]"
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
                  className={`w-full h-full bg-transparent rounded-full pl-11 pr-4 text-[14px] leading-[20px] text-[#1F2937] placeholder:text-[#99A0AE] focus:outline-none transition-opacity duration-200 cursor-pointer ${isSearchExpanded ? "opacity-100 focus:cursor-text" : "opacity-0"}`}
                />
              </div>

              {/* Filter Button — status filter */}
              <div className="relative flex-shrink-0">
                <button
                  title="Filter by status"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFilterMenu((v) => !v);
                  }}
                  className={`flex items-center justify-center w-11 h-11 rounded-full border transition-colors bg-white ${filterStatuses[activeTab]
                      ? "border-[#0085FF] text-[#0085FF]"
                      : "border-[#E1E4EA] text-gray-500 hover:bg-gray-50"
                    }`}
                >
                  <SlidersHorizontal
                    size={18}
                    strokeWidth={2}
                    className={
                      filterStatuses[activeTab]
                        ? "text-[#0085FF]"
                        : "text-[#1F2937]"
                    }
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
                  className="flex items-center justify-center w-11 h-11 rounded-full border border-[#E1E4EA] text-gray-500 hover:bg-gray-50 transition-colors bg-white"
                >
                  <MoreVertical size={18} strokeWidth={2} className="text-[#1F2937]" />
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
                  height: 44,
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
          className="fixed right-0 overflow-x-auto overflow-y-auto bg-white top-[126px] lg:top-[136px]"
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
                        <span className="truncate flex-1">
                          {typeof col.label === "function"
                            ? col.label(activeTab)
                            : col.label}
                        </span>
                        {pinnedCols[col.id] && (
                          <Pin className="w-3 h-3 text-[#0085FF] flex-shrink-0" />
                        )}
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
                      className="px-4 py-3 align-middle whitespace-nowrap border-b border-r border-[#E1E4EA] overflow-hidden bg-inherit"
                    >
                      {renderCell(col.id, doc)}
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
            className="fixed bottom-0 right-0 bg-white border-t border-[#E1E4EA] shadow-sm z-[9992] flex items-center justify-between px-4 lg:px-6"
            style={{ left: "var(--sidebar-width, 0px)", height: 64 }}
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

        {/* Two-pane create/edit screen — shared by all document types. */}
        {showCreatePanel && (
          <CreateInvoicePanel
            key={`${activeTab}-${editPanelDoc?._id || "new"}`}
            type={activeTab}
            deals={deals}
            initialDoc={editPanelDoc}
            onFullView={(doc) => handleView(doc, activeTab)}
            onClose={() => {
              setShowCreatePanel(false);
              setEditPanelDoc(null);
            }}
            onCreated={() => fetchData(activeTab)}
            onAddDeal={async () => {
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
            }}
          />
        )}
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
                toast.error("Please select a Pro Forma invoice style to preview.");
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
                toast.error("Please select a Delivery Challan style to preview.");
                return;
              }
              setPreviewStyle(formData.style);
              setPreviewType("deliveryChallan");
              setShowPreview(true);
            }}
          />
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

export default Accounting;
