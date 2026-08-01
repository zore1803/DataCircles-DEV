import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import {
  MoreVertical,
  Plus,
  Search,
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
} from "lucide-react";
import API from "../services/api";
import toast from "react-hot-toast";
import AppToaster from "../components/AppToaster";
import InvoiceForm from "../components/invoice/InvoiceForm";
import PerformaInvoiceForm from "../components/PerformaInvoice/PerformaInvoiceForm";
import QuotationForm from "../components/quotation/QuotationForm";
import DeliveryChallanForm from "../components/deliveryChallan/DeliveryChallanForm";
import InvoiceStylePreview from "../components/invoice/InvoiceStylePreview";
import PerformaInvoiceStylePreview from "../components/PerformaInvoice/PerformaInvoiceStylePreview";
import QuickBrandingModal from "../components/invoice/QuickBrandingModal";

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

const Accounting = () => {
  const [activeTab, setActiveTab] = useState("tax");
  const tabRefs = useRef({});
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const el = tabRefs.current[activeTab];
    if (el) setTabIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [activeTab]);

  const emptyByType = { tax: "", performa: "", quotation: "", deliveryChallan: "" };
  const emptyPagination = {
    currentPage: 1,
    totalPages: 0,
    totalCount: 0,
    limit: 10,
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

  // UI state
  const [selectedIds, setSelectedIds] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
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
  const [showBrandingModal, setShowBrandingModal] = useState(false);
  const [pendingInvoiceCreation, setPendingInvoiceCreation] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState(null);
  const [deleteDocType, setDeleteDocType] = useState(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertDocId, setConvertDocId] = useState(null);
  const [convertDocType, setConvertDocType] = useState(null);
  const [convertTargetType, setConvertTargetType] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [tempInvoiceValue, setTempInvoiceValue] = useState("");
  const [renamingLoading, setRenamingLoading] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => {
      if (openConvertMenu) setOpenConvertMenu(null);
      if (showFilterMenu) setShowFilterMenu(false);
    };
    if (openConvertMenu || showFilterMenu) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openConvertMenu, showFilterMenu]);

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

  // Selections belong to the rows currently on screen, so drop them whenever
  // the tab or page changes.
  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab, paginations[activeTab]?.currentPage]);

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
    if (paginations[activeTab]?.currentPage === 1) fetchData(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedSearchTerms[activeTab],
    debouncedFilterStatuses[activeTab],
    activeTab,
  ]);

  useEffect(() => {
    fetchDeals();
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

  const handleSort = (type, key) => {
    let direction = "asc";
    if (sortConfigs[type].key === key && sortConfigs[type].direction === "asc") {
      direction = "desc";
    }
    setSortConfigs((prev) => ({ ...prev, [type]: { key, direction } }));
    setPaginations((prev) => ({
      ...prev,
      [type]: { ...prev[type], currentPage: 1 },
    }));
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

  const startEditInvoice = (doc, type) => {
    setEditingId(doc._id);
    setTempInvoiceValue(doc[numberKeyFor(type)] ?? "");
  };

  const saveInvoiceName = async (docId, type) => {
    const newValue = (tempInvoiceValue || "").trim();
    if (!newValue) {
      toast.error("Invoice number cannot be empty");
      return;
    }
    try {
      setRenamingLoading(true);
      await API.patch(`/${apiPathFor(type)}/number/${docId}`, {
        [numberKeyFor(type)]: newValue,
      });
      toast.success("Updated successfully");
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

  const getPageNumbers = () => {
    const { currentPage, totalPages } = pagination;
    const delta = 1;
    const range = [];
    const rangeWithDots = [];
    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }
    if (currentPage - delta > 2) rangeWithDots.push(1, "...");
    else rangeWithDots.push(1);
    rangeWithDots.push(...range);
    if (currentPage + delta < totalPages - 1)
      rangeWithDots.push("...", totalPages);
    else if (totalPages > 1) rangeWithDots.push(totalPages);
    return rangeWithDots.filter(
      (item, index, arr) => index === 0 || arr[index - 1] !== item
    );
  };

  const SortableHeader = ({ field, icon: Icon, children, width }) => (
    <th
      style={width ? { width } : undefined}
      className="px-4 py-3 text-left text-xs font-bold text-[#525866] uppercase tracking-wider cursor-pointer hover:bg-[#EDF0F5] select-none transition-colors whitespace-nowrap border-b border-[#E1E4EA]"
      onClick={() => handleSort(activeTab, field)}
    >
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-[#525866] flex-shrink-0" />}
        <span>{children}</span>
        <div className="flex flex-col ml-auto">
          <ChevronUp
            className={`w-3 h-3 ${
              sortConfigs[activeTab].key === field &&
              sortConfigs[activeTab].direction === "asc"
                ? "text-blue-600"
                : "text-gray-400"
            }`}
          />
          <ChevronDown
            className={`w-3 h-3 -mt-1 ${
              sortConfigs[activeTab].key === field &&
              sortConfigs[activeTab].direction === "desc"
                ? "text-blue-600"
                : "text-gray-400"
            }`}
          />
        </div>
      </div>
    </th>
  );

  return (
    <>
      <AppToaster />

      <div className="bg-[#F9FAFB] min-h-screen -mx-4 sm:-mx-6 lg:-mx-8 -mt-6">
        {/* 2nd Header - Tab Bar & Actions Row */}
        <div
          className="fixed right-0 h-[72px] px-4 lg:px-[24px] border-b border-[#E1E4EA] bg-white flex items-center justify-between gap-3 top-[54px] lg:top-16"
          style={{ left: "var(--sidebar-width, 0px)", zIndex: 39 }}
        >
          {/* Left Side: Tabs Container — same pill selector as the Company tabs */}
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
                className={`relative z-10 flex items-center justify-center h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? "text-[#0085FF]"
                    : "text-gray-700 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right Side: Search, Filter, More, Add */}
          <div className="flex flex-row items-center gap-2 flex-shrink-0 min-w-0">
            {/* Search field — expands in place of the search button */}
            {showSearch ? (
              <div className="relative flex items-center h-11 w-[220px] sm:w-[300px] lg:w-[380px] rounded-full border border-[#E1E4EA] bg-white focus-within:border-[#0085FF] transition-colors">
                <Search
                  size={18}
                  strokeWidth={2}
                  className="absolute left-3.5 text-[#1F2937] pointer-events-none"
                />
                <input
                  autoFocus
                  type="text"
                  value={searchTerms[activeTab]}
                  onChange={(e) =>
                    setSearchTerms((prev) => ({
                      ...prev,
                      [activeTab]: e.target.value,
                    }))
                  }
                  placeholder={`Search by ${
                    activeTab === "tax" ? "invoice" : "document"
                  } ID, deal, or date...`}
                  className="w-full h-full bg-transparent rounded-full pl-11 pr-10 text-[14px] leading-[20px] text-[#1F2937] placeholder:text-[#99A0AE] focus:outline-none"
                />
                <button
                  onClick={() => {
                    setSearchTerms((prev) => ({ ...prev, [activeTab]: "" }));
                    setShowSearch(false);
                  }}
                  className="absolute right-3 text-gray-400 hover:text-gray-600"
                  title="Close search"
                >
                  <X size={16} strokeWidth={2} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSearch(true)}
                title="Search"
                className="flex items-center justify-center w-11 h-11 rounded-full border border-[#E1E4EA] text-gray-500 hover:bg-gray-50 transition-colors flex-shrink-0 bg-white"
              >
                <Search size={18} strokeWidth={2} className="text-[#1F2937]" />
              </button>
            )}

            {/* Filter Button — status filter */}
            <div className="relative flex-shrink-0">
              <button
                title="Filter by status"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFilterMenu((v) => !v);
                }}
                className={`flex items-center justify-center w-11 h-11 rounded-full border transition-colors bg-white ${
                  filterStatuses[activeTab]
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
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        filterStatuses[activeTab] === status
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
            <button className="flex items-center justify-center w-11 h-11 rounded-full border border-[#E1E4EA] text-gray-500 hover:bg-gray-50 transition-colors flex-shrink-0 bg-white">
              <MoreVertical size={18} strokeWidth={2} className="text-[#1F2937]" />
            </button>

            {/* Add Button */}
            <button
              onClick={async () => {
                const canProceed = await checkBrandingBeforeInvoice();
                if (canProceed) {
                  setEditing(null);
                  setEditingType(activeTab);
                  setShowForm(true);
                }
              }}
              className="h-11 px-4 flex items-center justify-center gap-1.5 bg-[#0085FF] hover:bg-blue-600 rounded-full transition-colors flex-shrink-0 ml-1"
            >
              <Plus size={18} className="text-white" />
              <span className="hidden lg:inline text-white text-[14px] font-medium leading-[20px] whitespace-nowrap">
                Add {docNameFor(activeTab)}
              </span>
            </button>
          </div>
        </div>

        {/* Main Content Area — full-bleed table, no card. Same fixed scroll
            region Companies.jsx uses: edge to edge under the tab bar, stopping
            above the pagination bar. */}
        <div
          className="fixed right-0 overflow-x-auto overflow-y-auto bg-white top-[126px] lg:top-[136px]"
          style={{ left: "var(--sidebar-width, 0px)", bottom: 64 }}
        >
          <table className="w-full border-separate border-spacing-0 text-left">
          <thead className="bg-[#F5F7FA] sticky top-0 z-20 select-none">
            <tr>
              <th
                style={{ width: 60 }}
                className="px-4 py-3 border-b border-[#E1E4EA]"
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
              </th>
              <SortableHeader
                field={numberKeyFor(activeTab)}
                width={180}
                icon={FileText}
              >
                {activeTab === "tax" ? "Invoice ID" : "Document ID"}
              </SortableHeader>
              <SortableHeader field="deal.title" icon={Briefcase}>
                Deal
              </SortableHeader>
              <SortableHeader field="date" icon={Calendar} width={160}>
                Issue Date
              </SortableHeader>
              <SortableHeader field="dueDate" icon={Clock} width={160}>
                Due Date
              </SortableHeader>
              <SortableHeader
                field="amount"
                icon={IndianRupee}
                width={160}
              >
                Amount
              </SortableHeader>
              <SortableHeader
                field="status"
                icon={CheckCircle2}
                width={160}
              >
                Status
              </SortableHeader>
              <th
                style={{ width: 220 }}
                className="px-4 py-3 text-left text-xs font-bold text-[#525866] uppercase tracking-wider whitespace-nowrap border-b border-[#E1E4EA]"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {currentLoading && currentDocuments.length === 0 && (
              <tr>
                <td colSpan="8" className="px-6 py-16 text-center">
                  <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mb-3"></div>
                  <p className="text-gray-600 font-medium">
                    Loading {pluralNameFor(activeTab)}...
                  </p>
                </td>
              </tr>
            )}
            {!currentLoading && currentDocuments.length === 0 && (
              <tr>
                <td colSpan="8" className="px-6 py-20 text-center">
                  <FileText className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                  <p className="text-sm font-medium text-gray-500">
                    Create New {docNameFor(activeTab)}
                  </p>
                </td>
              </tr>
            )}
            {currentDocuments.map((doc, index) => (
              <tr
                key={doc?._id}
                className={`bg-white hover:bg-blue-50 transition-colors ${
                  selectedIds.includes(doc._id) ? "!bg-blue-50" : ""
                }`}
              >
                <td className="px-4 py-3 align-middle border-b border-[#E1E4EA]">
                  <div className="flex justify-center items-center w-full">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(doc._id)}
                      onChange={() => handleSelectOne(doc._id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                  </div>
                </td>
                <td className="px-4 py-3 align-middle whitespace-nowrap border-b border-[#E1E4EA]">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    {editingId === doc._id ? (
                      <input
                        value={tempInvoiceValue}
                        autoFocus
                        onChange={(e) =>
                          setTempInvoiceValue(e.target.value)
                        }
                        onBlur={() => saveInvoiceName(doc._id, activeTab)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            saveInvoiceName(doc._id, activeTab);
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
                        #{doc[numberKeyFor(activeTab)]}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 align-middle whitespace-nowrap text-sm text-[#1C1B1F] font-medium border-b border-[#E1E4EA]">
                  {doc.deal?.title || "N/A"}
                </td>
                <td className="px-4 py-3 align-middle whitespace-nowrap text-sm text-gray-600 border-b border-[#E1E4EA]">
                  {doc.date ? new Date(doc.date).toLocaleDateString() : "N/A"}
                </td>
                <td className="px-4 py-3 align-middle whitespace-nowrap text-sm text-gray-600 border-b border-[#E1E4EA]">
                  {doc.dueDate
                    ? new Date(doc.dueDate).toLocaleDateString()
                    : "N/A"}
                </td>
                <td className="px-4 py-3 align-middle whitespace-nowrap text-sm font-semibold text-gray-900 border-b border-[#E1E4EA]">
                  ₹{doc.amount?.toFixed(2) || "0.00"}
                </td>
                <td className="px-4 py-3 align-middle whitespace-nowrap border-b border-[#E1E4EA]">
                  <select
                    value={doc?.status}
                    onChange={(e) =>
                      handleStatusChange(
                        doc._id,
                        e.target.value,
                        activeTab
                      )
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
                <td className="px-4 py-3 align-middle whitespace-nowrap border-b border-[#E1E4EA]">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Pagination bar — its own fixed strip below the table, not inside it
            (same treatment as Companies.jsx). */}
        <div
          className="fixed bottom-0 right-0 bg-white border-t border-[#E1E4EA] shadow-sm z-[9992] flex items-center justify-between px-4 lg:px-6"
          style={{ left: "var(--sidebar-width, 0px)", height: 64 }}
        >
          <p className="text-sm text-gray-700 font-inter">
            Showing{" "}
            <span className="font-semibold">{currentDocuments.length}</span> of{" "}
            <span className="font-semibold">{pagination.totalCount}</span>{" "}
            {pluralNameFor(activeTab)}
          </p>

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
              getPageNumbers().map((pageNum, i) =>
                pageNum === "..." ? (
                  <span
                    key={`dots-${i}`}
                    className="flex items-center justify-center w-8 h-8 text-sm font-medium text-gray-400 select-none"
                  >
                    ....
                  </span>
                ) : (
                  <button
                    key={`page-${pageNum}`}
                    onClick={() => handlePageChange(activeTab, pageNum)}
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                      pageNum === pagination.currentPage
                        ? "bg-[#0085FF] text-white"
                        : "bg-white border border-[#E1E4EA] text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              )}

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
        </div>

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

export default Accounting;
