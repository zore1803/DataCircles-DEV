import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import API from "../services/api";
import { Link } from "react-router-dom";
import {
  MoreVertical,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Edit2,
  Trash2,
  Truck,
  Upload,
  Building2,
  CheckSquare,
  MapPin,
  History,
  IndianRupee,
  User,
  SlidersHorizontal,
  Settings,
  Mail,
  Phone,
  FileText,
  Pin,
  PinOff,
  EyeOff,
} from "lucide-react";
import BulkActions from "../components/BulkActions";
import VendorForm from "../components/vendor/VendorForm";
import VendorPaymentForm from "../components/vendor/VendorPaymentForm";
import { useLocation } from "react-router-dom";
import ImportVendors from "../components/vendor/ImportVendors";
import toast from "react-hot-toast";
import logo from "/DataCircles.png";
import AppToaster from "../components/AppToaster";
import { getAncestorZoom } from "../utils/domUtils";

function useOutsideClick(ref, callback) {
  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        callback();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [ref, callback]);
}

// Fixed columns every vendor has. Custom fields (from vendorFields) are
// appended after these, and "actions" always comes last.
const BASE_COLUMN_DEFS = [
  { id: "name", label: "Name", icon: User, required: true, width: 200 },
  { id: "email", label: "Email", icon: Mail, width: 220 },
  { id: "phone", label: "Phone", icon: Phone, width: 160 },
  { id: "company", label: "Company", icon: Building2, width: 180 },
  { id: "address", label: "Address", icon: MapPin, width: 260 },
  { id: "balance", label: "Closing Balance", icon: IndianRupee, width: 160 },
];
const ACTIONS_COLUMN_DEF = {
  id: "actions",
  label: "Actions",
  icon: MoreVertical,
  required: true,
  sortable: false,
  width: 120,
};
const MIN_COL_WIDTH = 60;

function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    gstin: "",
    avatar: "",
    balance: 0,
    socialMedia: {
      twitter: "",
      linkedin: "",
      facebook: "",
    },
    address: {
      line1: "",
      line2: "",
      city: "",
      state: "",
      pincode: "",
      country: "India",
    },
  });
  const [vendorFields, setVendorFields] = useState([]);
  const [additionalFieldValues, setAdditionalFieldValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [debouncedFilterCompany, setDebouncedFilterCompany] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    vendorId: "",
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    paymentType: "Card",
    bank: "",
    notes: "",
    direction: "",
  });
  const [showDropdown, setShowDropdown] = useState(null);
  const dropdownRef = useRef(null);
  const location = useLocation();
  const { state } = location;
  const [showImport, setShowImport] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState(null);

  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 0,
    totalCount: 0,
    limit: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [sortConfig, setSortConfig] = useState({
    key: "name",
    direction: "asc",
  });

  // Toolbar UI state — same shape as Accounting.jsx's action row.
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Column order / visibility / pinning / widths — in-memory only, same
  // scheme as Accounting.jsx (no persistence, matched on purpose for parity).
  const customColumnDefs = useMemo(
    () =>
      (vendorFields || []).map((field) => ({
        id: field.name || field,
        label: field.name || field,
        icon: Settings,
      })),
    [vendorFields]
  );
  const allColumnDefs = useMemo(
    () => [...BASE_COLUMN_DEFS, ...customColumnDefs, ACTIONS_COLUMN_DEF],
    [customColumnDefs]
  );
  const columnDefById = useMemo(() => {
    const map = {};
    allColumnDefs.forEach((c) => (map[c.id] = c));
    return map;
  }, [allColumnDefs]);

  const [columnOrder, setColumnOrder] = useState(() =>
    [...BASE_COLUMN_DEFS, ACTIONS_COLUMN_DEF].map((c) => c.id)
  );
  const [hiddenCols, setHiddenCols] = useState([]);
  const [pinnedCols, setPinnedCols] = useState({});
  const [colWidths, setColWidths] = useState(() => {
    const widths = { selection: 60 };
    [...BASE_COLUMN_DEFS, ACTIONS_COLUMN_DEF].forEach((c) => {
      widths[c.id] = c.width || 180;
    });
    return widths;
  });

  // Custom fields load after the initial fetch; splice them into the order
  // (before "actions") and default them hidden, same as the old
  // useColumnSettings-based behaviour ("hidden by default, user can show").
  useEffect(() => {
    if (customColumnDefs.length === 0) return;
    const customIds = customColumnDefs.map((c) => c.id);
    setColumnOrder((prev) => {
      const missing = customIds.filter((id) => !prev.includes(id));
      if (missing.length === 0) return prev;
      const withoutActions = prev.filter((id) => id !== "actions");
      return [...withoutActions, ...missing, "actions"];
    });
    setHiddenCols((prev) => {
      const missing = customIds.filter((id) => !prev.includes(id));
      return missing.length ? [...prev, ...missing] : prev;
    });
    setColWidths((prev) => {
      const next = { ...prev };
      customIds.forEach((id) => {
        if (!(id in next)) next[id] = 180;
      });
      return next;
    });
  }, [customColumnDefs]);

  const orderedColumns = useMemo(
    () =>
      columnOrder
        .map((id) => columnDefById[id])
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
    [columnOrder, hiddenCols, pinnedCols, columnDefById]
  );

  const stickyStyles = useMemo(() => {
    const map = {};
    let leftOffset = colWidths.selection;
    for (const c of orderedColumns) {
      if (pinnedCols[c.id] === "left") {
        map[c.id] = { position: "sticky", left: leftOffset, zIndex: 5 };
        leftOffset += colWidths[c.id] || 0;
      }
    }
    let rightOffset = 0;
    for (const c of [...orderedColumns].reverse()) {
      if (pinnedCols[c.id] === "right") {
        map[c.id] = { position: "sticky", right: rightOffset, zIndex: 5 };
        rightOffset += colWidths[c.id] || 0;
      }
    }
    return map;
  }, [orderedColumns, pinnedCols, colWidths]);
  const stickyStyleFor = useCallback(
    (colId) => stickyStyles[colId] || {},
    [stickyStyles]
  );

  const tableWidth = useMemo(
    () => Object.values(colWidths).reduce((a, b) => a + b, 0),
    [colWidths]
  );

  // Column popup menu — one shared portal, same as Accounting.jsx.
  const [openColumnMenuKey, setOpenColumnMenuKey] = useState(null);
  const [columnMenuPos, setColumnMenuPos] = useState(null);
  const closeColumnMenu = useCallback(() => {
    setOpenColumnMenuKey(null);
    setColumnMenuPos(null);
  }, []);
  const openColumnMenu = (e, colId) => {
    e.stopPropagation();
    if (openColumnMenuKey === colId) return closeColumnMenu();
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

  // Column drag-reorder — press, drag past a 5px threshold, drop on another
  // header. Same mechanics as Accounting.jsx / Contacts.jsx.
  const [draggedColKey, setDraggedColKey] = useState(null);
  const [dragOverColKey, setDragOverColKey] = useState(null);
  const [dragGhost, setDragGhost] = useState(null);
  const dragOverRef = useRef(null);
  const ghostElRef = useRef(null);

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
      el.style.maxHeight = `${
        Math.max(100, window.innerHeight - visualTop - 72) / dragState.zGhost
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
      const col = columnDefById[colId];
      const previewRows = vendors.map((v) =>
        String(getFieldValue(v, colId) ?? "").trim() || "—"
      );

      dragState.zGhost = getAncestorZoom(document.body);
      dragState.offsetX = startX - rect.left;
      dragState.offsetY = startY - rect.top;

      dragOverRef.current = null;
      setDraggedColKey(colId);
      setDragOverColKey(null);
      document.body.style.userSelect = "none";
      setDragGhost({
        label: col?.label || colId,
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

  // Column resize — drag the handle on a header's right border. Start width
  // is read from the rendered <th>, so the handler holds no stale state.
  const resizeRef = useRef(null);
  const startColumnResize = (e, colId) => {
    e.preventDefault();
    e.stopPropagation();
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

  // Pagination — exact "first ... current ... last" editable pattern from
  // Companies.jsx.
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

  // Get field value from vendor
  const getFieldValue = (vendor, columnKey) => {
    if (columnKey === "address") {
      const addressText = [
        vendor.address?.line1,
        vendor.address?.city,
        vendor.address?.state,
        vendor.address?.pincode,
      ]
        .filter(Boolean)
        .join(", ");
      return addressText || "—";
    }
    if (vendor[columnKey] !== undefined) {
      return vendor[columnKey];
    }
    const additionalField = vendor.additionalFields?.find(
      (field) => field.key === columnKey,
    );
    return additionalField?.value || "—";
  };

  const truncateText = (text, maxLength = 30) => {
    if (!text) return "—";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const renderCellContent = (vendor, colId) => {
    switch (colId) {
      case "name":
        return (
          <Link
            to={`/vendors/${vendor._id}`}
            className="text-blue-600 font-bold text-sm hover:text-blue-700 transition-colors truncate block"
          >
            {vendor.name}
          </Link>
        );
      case "email":
        return vendor.email ? (
          <a
            href={`mailto:${vendor.email}`}
            className="text-sm text-gray-700 hover:text-blue-600 transition-colors truncate block"
          >
            {vendor.email}
          </a>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        );
      case "phone":
        return vendor.phone ? (
          <a
            href={`tel:${vendor.phone}`}
            className="text-sm text-gray-700 hover:text-blue-600 transition-colors truncate block"
          >
            {vendor.phone}
          </a>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        );
      case "company":
        return (
          <span className="text-sm text-gray-700 capitalize font-medium truncate block">
            {vendor.company || "—"}
          </span>
        );
      case "address":
        return (
          <span className="text-sm text-gray-700 truncate block">
            {truncateText(getFieldValue(vendor, "address"), 40)}
          </span>
        );
      case "balance":
        return (
          <span className="text-sm text-gray-700 font-mono">
            ₹{vendor.balance?.toFixed(2) || "0.00"}
          </span>
        );
      default:
        return (
          <span className="text-sm text-gray-700 truncate block">
            {truncateText(String(getFieldValue(vendor, colId)), 30)}
          </span>
        );
    }
  };

  const handleCloseDropdown = useCallback(() => {
    setShowDropdown(null);
  }, []);
  useOutsideClick(dropdownRef, handleCloseDropdown);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilterCompany(filterCompany);
    }, 300);
    return () => clearTimeout(timer);
  }, [filterCompany]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  }, [debouncedSearchTerm, debouncedFilterCompany]);

  useEffect(() => {
    fetchVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.currentPage, pagination.limit, sortConfig]);

  useEffect(() => {
    if (pagination.currentPage === 1) {
      fetchVendors();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm, debouncedFilterCompany]);

  useEffect(() => {
    fetchVendorFields();
  }, []);

  const fetchVendorFields = async () => {
    try {
      const res = await API.get("/vendor-fields");
      if (res.data?.fields) {
        setVendorFields(res.data.fields);
      }
    } catch (error) {
      console.error("Failed to fetch vendor fields", error);
      toast.error("Failed to fetch vendor fields");
    }
  };

  const fetchVendors = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: pagination.currentPage.toString(),
        limit: pagination.limit.toString(),
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction,
      });

      if (debouncedSearchTerm.trim()) {
        params.append("search", debouncedSearchTerm.trim());
      }
      if (debouncedFilterCompany) {
        params.append("company", debouncedFilterCompany);
      }

      const res = await API.get(`/vendors/pagination?${params.toString()}`);

      if (res.data.vendors && res.data.pagination) {
        setVendors(res.data.vendors);
        setPagination((prev) => ({
          ...prev,
          currentPage: res.data.pagination.currentPage,
          totalPages: res.data.pagination.totalPages,
          totalCount: res.data.pagination.totalCount,
          hasNextPage: res.data.pagination.hasNextPage,
          hasPrevPage: res.data.pagination.hasPrevPage,
        }));
      } else {
        setVendors(res.data || []);
      }
    } catch (err) {
      if (err.response && err.response.status === 403) {
        toast.error(err.response.data.message || "Access denied");
      } else {
        toast.error("Failed to load vendors");
      }
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedVendors.length === vendors.length && vendors.length > 0) {
      setSelectedVendors([]);
    } else {
      setSelectedVendors(vendors.map((v) => v._id));
    }
  };

  const handleSelectVendor = (vendorId) => {
    setSelectedVendors((prev) =>
      prev.includes(vendorId)
        ? prev.filter((id) => id !== vendorId)
        : [...prev, vendorId],
    );
  };

  const handleBulkDeleteVendors = async (itemIds) => {
    try {
      await Promise.all(itemIds.map((id) => API.delete(`/vendors/${id}`)));
      await fetchVendors();
      setSelectedVendors([]);
      setShowBulkActions(false);
      toast.success(`Successfully deleted ${itemIds.length} vendors`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Bulk delete failed");
    }
  };

  const vendorFieldConfig = {
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "phone", label: "Phone", type: "text" },
      { key: "email", label: "Email", type: "email" },
      { key: "company", label: "Company", type: "text" },
      { key: "gstin", label: "GSTIN", type: "text" },
      { key: "address.line1", label: "Address Line 1", type: "text" },
      { key: "address.line2", label: "Address Line 2", type: "text" },
      { key: "address.city", label: "City", type: "text" },
      { key: "address.state", label: "State", type: "text" },
      { key: "address.pincode", label: "Pincode", type: "text" },
      { key: "address.country", label: "Country", type: "text" },
      ...vendorFields.map((field) => ({
        key: field.name || field,
        label: field.name || field,
        type: field.type || "text",
        isCustomField: true,
        options: field.options,
      })),
    ],
  };

  const handleBulkUpdateVendors = async ({ field, value, itemIds }) => {
    try {
      await Promise.all(
        itemIds.map((id) => {
          let payload = {};
          if (field.includes("address.")) {
            const addressField = field.split(".")[1];
            payload.address = { [addressField]: value };
          } else if (vendorFields.some((f) => (f.name || f) === field)) {
            payload.additionalFields = [{ key: field, value }];
          } else {
            payload[field] = value;
          }
          return API.put(`/vendors/${id}`, payload);
        }),
      );
      await fetchVendors();
      setSelectedVendors([]);
      setShowBulkActions(false);
      toast.success(`Successfully updated ${itemIds.length} vendors`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Bulk update failed");
    }
  };

  const handleAddPayment = async (payload) => {
    try {
      await API.post(`/vendors/${payload.vendor}/payments`, payload);
      setVendors((prevVendors) =>
        prevVendors.map((vendor) =>
          vendor._id === payload.vendor
            ? {
                ...vendor,
                balance:
                  payload.direction === "IN"
                    ? vendor.balance + parseFloat(payload.amount)
                    : vendor.balance - parseFloat(payload.amount),
              }
            : vendor,
        ),
      );
      toast.success("Payment added successfully");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to add payment");
    }
  };

  const handleOpenPaymentModal = (vendorId, direction) => {
    setPaymentForm({
      vendorId,
      amount: "",
      paymentDate: new Date().toISOString().split("T")[0],
      paymentType: "Card",
      bank: "",
      notes: "",
      direction,
    });
    setShowPaymentModal(true);
    setShowDropdown(null);
  };

  const getUniqueCompanies = () => {
    const companies = vendors.map((v) => v.company).filter(Boolean);
    return [...new Set(companies)].sort();
  };

  const handleEditVendor = async (vendor) => {
    try {
      const response = await API.get(`/vendors/${vendor._id}`);
      const vendorData = response.data;

      setForm({
        _id: vendorData._id,
        name: vendorData.name || "",
        email: vendorData.email || "",
        phone: vendorData.phone || "",
        company: vendorData.company || "",
        gstin: vendorData.gstin || "",
        avatar: vendorData.avatar || "",
        socialMedia: {
          twitter: vendorData.socialMedia?.twitter || "",
          linkedin: vendorData.socialMedia?.linkedin || "",
          facebook: vendorData.socialMedia?.facebook || "",
        },
        address: vendorData.address || {
          line1: "",
          line2: "",
          city: "",
          state: "",
          pincode: "",
          country: "India",
        },
      });

      const processedFields = {};
      if (vendorData.additionalFields) {
        vendorData.additionalFields.forEach((field) => {
          processedFields[field.key] = field.value;
        });
      }
      setAdditionalFieldValues(processedFields);

      setShowForm(true);
    } catch (error) {
      console.error("Error fetching vendor:", error);
      toast.error("Failed to load vendor data");
    }
  };

  const resetForm = () => {
    setForm({
      name: "",
      email: "",
      phone: "",
      company: "",
      gstin: "",
      avatar: "",
      socialMedia: {
        twitter: "",
        linkedin: "",
        facebook: "",
      },
      address: {
        line1: "",
        line2: "",
        city: "",
        state: "",
        pincode: "",
        country: "India",
      },
      balance: 0,
    });
    setAdditionalFieldValues({});
  };

  const handleDelete = async (vendorId) => {
    setVendorToDelete(vendorId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!vendorToDelete) return;

    const loadingToast = toast.loading("Deleting vendor...");

    try {
      setLoading(true);
      await API.delete(`/vendors/${vendorToDelete}`);
      await fetchVendors();
      setSelectedVendors([]);
      toast.success("Vendor deleted successfully!", { id: loadingToast });
    } catch (err) {
      let errorMessage = "Failed to delete vendor";
      if (err.response && err.response.status === 402) {
        errorMessage = err.response.data.message || "An active subscription is required to make changes.";
      } else if (err.response && err.response.status === 403) {
        errorMessage = err.response.data.message || "Access denied";
      }
      toast.error(errorMessage, { id: loadingToast });
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
      setVendorToDelete(null);
    }
  };

  const handlePageChange = (newPage) => {
    if (
      newPage >= 1 &&
      newPage <= pagination.totalPages &&
      newPage !== pagination.currentPage
    ) {
      setPagination((prev) => ({ ...prev, currentPage: newPage }));
      setSelectedVendors([]);
    }
  };

  const handleLimitChange = (newLimit) => {
    setPagination((prev) => ({
      ...prev,
      limit: newLimit,
      currentPage: 1,
    }));
    setSelectedVendors([]);
  };

  const exitSelectionMode = () => {
    setSelectedVendors([]);
  };

  return (
    <div className="bg-white border border-[#E1E4EA] rounded-xl shadow-sm flex flex-col overflow-hidden relative z-0 w-full">
      <AppToaster />

      <div className="box-border flex flex-row justify-between items-center px-6 py-3 gap-4 w-full h-[72px] bg-white border-b border-[#E1E4EA] flex-shrink-0">
        <div className="flex flex-col justify-center">
          <h1 className="text-[20px] font-semibold text-[#1F2937] leading-[28px] tracking-[-0.02em]">Vendors</h1>
          <p className="text-[14px] text-[#525866] leading-[20px] font-normal">Manage your vendors.</p>
        </div>
        <div className="flex flex-row items-center gap-2 h-[44px] flex-shrink-0">
          <div className="relative flex items-center h-11 w-[220px] sm:w-[300px] lg:w-[380px] rounded-full border border-[#E1E4EA] bg-white focus-within:border-[#0085FF] transition-colors">
            <Search
              size={18}
              strokeWidth={2}
              className="absolute left-3.5 text-[#1F2937] pointer-events-none"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by vendor name, ID, company, or email..."
              className="w-full h-full bg-transparent rounded-full pl-11 pr-4 text-[14px] leading-[20px] text-[#1F2937] placeholder:text-[#99A0AE] focus:outline-none"
            />
          </div>

          <div className="relative flex-shrink-0">
            <button
              title="Filter by company"
              onClick={(e) => {
                e.stopPropagation();
                setShowFilterMenu((v) => !v);
              }}
              className={`flex items-center justify-center w-11 h-11 rounded-full border transition-colors bg-white ${
                filterCompany
                  ? "border-[#0085FF] text-[#0085FF]"
                  : "border-[#E1E4EA] text-gray-500 hover:bg-gray-50"
              }`}
            >
              <SlidersHorizontal
                size={18}
                strokeWidth={2}
                className={filterCompany ? "text-[#0085FF]" : "text-[#1F2937]"}
              />
            </button>
            {showFilterMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 mt-2 w-56 max-h-72 overflow-auto bg-white rounded-xl shadow-lg border border-[#E1E4EA] py-1 z-50"
              >
                <button
                  onClick={() => {
                    setFilterCompany("");
                    setShowFilterMenu(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                    !filterCompany ? "text-[#0085FF] font-medium" : "text-gray-700"
                  }`}
                >
                  All Companies
                </button>
                {getUniqueCompanies().map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setFilterCompany(c);
                      setShowFilterMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 truncate ${
                      filterCompany === c
                        ? "text-[#0085FF] font-medium"
                        : "text-gray-700"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMoreMenu((v) => !v);
              }}
              title="More"
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
                    setShowImport((v) => !v);
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Upload className="w-4 h-4 text-gray-400" />
                  {showImport ? "Hide Import/Export" : "Import/Export"}
                </button>
                <Link
                  to="/settings/forms?module=Vendor"
                  onClick={() => setShowMoreMenu(false)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-gray-400" />
                  Forms
                </Link>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="h-11 px-4 flex items-center justify-center gap-1.5 bg-[#0085FF] hover:bg-blue-600 rounded-full transition-colors flex-shrink-0 ml-1"
          >
            <Plus size={18} className="text-white" />
            <span className="text-white text-[14px] font-medium leading-[20px] whitespace-nowrap">
              {showForm ? "Cancel" : "Add Vendor"}
            </span>
          </button>
        </div>
      </div>

      {showForm && (
        <VendorForm
          form={form}
          setForm={setForm}
          additionalFieldValues={additionalFieldValues}
          setAdditionalFieldValues={setAdditionalFieldValues}
          vendorFields={vendorFields}
          loading={loading}
          setLoading={setLoading}
          setError={(message) =>
            toast.error(message || "Failed to save vendor")
          }
          setSuccess={(message) =>
            toast.success(message || "Vendor saved successfully")
          }
          fetchVendors={fetchVendors}
          onRequestClose={() => {
            resetForm();
            setShowForm(false);
          }}
        />
      )}

      {state?.showAddForm && (
        <VendorForm
          form={form}
          setForm={setForm}
          additionalFieldValues={additionalFieldValues}
          setAdditionalFieldValues={setAdditionalFieldValues}
          vendorFields={vendorFields}
          loading={loading}
          setLoading={setLoading}
          setError={(message) =>
            toast.error(message || "Failed to save vendor")
          }
          setSuccess={(message) =>
            toast.success(message || "Vendor saved successfully")
          }
          fetchVendors={fetchVendors}
          onRequestClose={() => {
            resetForm();
            setShowForm(false);
            state.showAddForm = false;
          }}
        />
      )}

      {selectedVendors.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-5 h-5 text-blue-600" />
            <span className="text-blue-800 font-semibold font-inter">
              {selectedVendors.length} vendor
              {selectedVendors.length !== 1 ? "s" : ""} selected
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowBulkActions(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none transition-colors flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Bulk Update
            </button>
            <button
              onClick={exitSelectionMode}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {showImport && (
        <div className="mb-4">
          <ImportVendors
            isOpen={true}
            onClose={() => setShowImport(false)}
            vendorFieldNames={vendorFields}
            onImportSuccess={fetchVendors}
          />
        </div>
      )}

      {/* Hidden columns are recoverable — same affordance as Accounting.jsx. */}
      {hiddenCols.length > 0 && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setHiddenCols([])}
            className="h-8 px-3 flex items-center gap-1.5 rounded-full bg-white border border-[#E1E4EA] text-xs font-medium text-[#525866] hover:bg-gray-50 transition-colors"
          >
            Show {hiddenCols.length} hidden column
            {hiddenCols.length > 1 ? "s" : ""}
          </button>
        </div>
      )}

      <div className="overflow-x-auto min-h-[400px]">
          <table
            className="border-separate border-spacing-0 text-left"
            style={{ minWidth: "100%", width: tableWidth, tableLayout: "fixed" }}
          >
            <thead className="bg-[#F5F7FA] select-none">
              <tr>
                <th
                  data-col-id="selection"
                  style={{ width: colWidths.selection }}
                  className="px-4 py-3 border-b border-r border-[#E1E4EA]"
                >
                  <div className="flex justify-center items-center w-full">
                    <input
                      type="checkbox"
                      checked={
                        selectedVendors.length === vendors.length &&
                        vendors.length > 0
                      }
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                  </div>
                </th>

                {orderedColumns.map((col) => {
                  const Icon = col.icon;
                  const isSortable = col.sortable !== false;
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
                      className={`relative px-4 py-3 text-left text-xs font-bold text-[#525866] uppercase tracking-wider whitespace-nowrap border-b border-r border-[#E1E4EA] transition-colors ${
                        isDragOver
                          ? "bg-blue-100"
                          : "bg-[#F5F7FA] hover:bg-[#EDF0F5]"
                      } ${
                        draggedColKey ? "cursor-grabbing" : "cursor-grab"
                      } active:cursor-grabbing`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {Icon && (
                          <Icon className="w-4 h-4 text-[#525866] flex-shrink-0" />
                        )}
                        <span className="truncate flex-1">{col.label}</span>
                        {pinnedCols[col.id] && (
                          <Pin className="w-3 h-3 text-[#0085FF] flex-shrink-0" />
                        )}
                        {isSortable && sortConfig.key === col.id && (
                          <span className="flex-shrink-0 text-[#0085FF]">
                            {sortConfig.direction === "asc" ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </span>
                        )}
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
                      <div
                        data-resize-handle="true"
                        onMouseDown={(e) => startColumnResize(e, col.id)}
                        onClick={(e) => e.stopPropagation()}
                        title="Drag to resize column"
                        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none z-30 hover:bg-[#0085FF]/40 active:bg-[#0085FF]"
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading && vendors.length === 0 ? (
                <tr>
                  <td
                    colSpan={orderedColumns.length + 1}
                    className="px-6 py-12 text-center"
                  >
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
                      <p className="mt-3 text-gray-600 font-medium">
                        Loading Vendors...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : vendors.length === 0 ? (
                <tr>
                  <td
                    colSpan={orderedColumns.length + 1}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <Truck className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="font-medium">No vendors found</p>
                    <p className="text-sm">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                vendors.map((vendor) => (
                  <tr
                    key={vendor._id}
                    className={`bg-white hover:bg-blue-50 transition-colors ${
                      selectedVendors.includes(vendor._id) ? "!bg-blue-50" : ""
                    }`}
                  >
                    <td
                      style={{
                        width: colWidths.selection,
                        position: "sticky",
                        left: 0,
                        zIndex: 4,
                      }}
                      className="px-4 py-3 align-middle border-b border-r border-[#E1E4EA] bg-inherit"
                    >
                      <div className="flex justify-center items-center w-full">
                        <input
                          type="checkbox"
                          checked={selectedVendors.includes(vendor._id)}
                          onChange={() => handleSelectVendor(vendor._id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                      </div>
                    </td>

                    {orderedColumns.map((col) =>
                      col.id === "actions" ? (
                        <td
                          key="actions"
                          style={{ width: colWidths.actions, ...stickyStyleFor("actions") }}
                          className="px-4 py-3 align-middle whitespace-nowrap border-b border-r border-[#E1E4EA] bg-inherit relative"
                        >
                          <div className="flex items-center justify-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDropdown(
                                  showDropdown === vendor._id ? null : vendor._id,
                                );
                              }}
                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {showDropdown === vendor._id && (
                              <div
                                ref={dropdownRef}
                                className="absolute right-2 mt-2 top-8 flex flex-col w-40 bg-white border border-[#E1E4EA] rounded-lg shadow-lg z-50 text-left py-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={() => {
                                    handleEditVendor(vendor);
                                    setShowDropdown(null);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                                >
                                  <Edit2 className="w-4 h-4 text-gray-400" /> Edit
                                </button>
                                <button
                                  onClick={() => {
                                    handleOpenPaymentModal(vendor._id, "IN");
                                    setShowDropdown(null);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-green-600 hover:bg-green-50 flex items-center gap-3 transition-colors"
                                >
                                  <History className="w-4 h-4" /> Credited
                                </button>
                                <button
                                  onClick={() => {
                                    handleOpenPaymentModal(vendor._id, "OUT");
                                    setShowDropdown(null);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                                >
                                  <History className="w-4 h-4" /> Debited
                                </button>
                                <button
                                  onClick={() => {
                                    handleDelete(vendor._id);
                                    setShowDropdown(null);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors border-t border-gray-100"
                                >
                                  <Trash2 className="w-4 h-4" /> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      ) : (
                        <td
                          key={col.id}
                          style={{ width: colWidths[col.id], ...stickyStyleFor(col.id) }}
                          className="px-4 py-3 align-middle whitespace-nowrap border-b border-r border-[#E1E4EA] overflow-hidden bg-inherit"
                        >
                          {renderCellContent(vendor, col.id)}
                        </td>
                      )
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination — same "first ... current ... last" editable pattern
            and per-page selector as Companies.jsx. */}
        {!loading && pagination.totalCount > 0 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-[#E1E4EA] sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={!pagination.hasPrevPage}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={!pagination.hasNextPage}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>

            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div className="flex items-center space-x-2">
                <p className="text-sm text-gray-700 font-inter">
                  Showing{" "}
                  <span className="font-semibold">
                    {(pagination.currentPage - 1) * pagination.limit + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold">
                    {Math.min(
                      pagination.currentPage * pagination.limit,
                      pagination.totalCount
                    )}
                  </span>{" "}
                  of <span className="font-semibold">{pagination.totalCount}</span>{" "}
                  results
                </p>
                <select
                  value={pagination.limit}
                  onChange={(e) => handleLimitChange(parseInt(e.target.value))}
                  className="ml-2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-inter"
                >
                  <option value={10}>10 per page</option>
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                  <option value={150}>150 per page</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={!pagination.hasPrevPage}
                  className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {pagination.totalPages > 0 &&
                  (() => {
                    const { currentPage, totalPages } = pagination;
                    const commitPage = () => {
                      const n = parseInt(pageInput, 10);
                      if (!Number.isNaN(n)) {
                        handlePageChange(Math.min(Math.max(n, 1), totalPages));
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
                          onClick={() => handlePageChange(item)}
                          onDoubleClick={() => {
                            if (isCurrent) {
                              setPageInput(String(currentPage));
                              setEditingPage(true);
                            }
                          }}
                          title={
                            isCurrent
                              ? "Double-click to type a page number"
                              : undefined
                          }
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
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={!pagination.hasNextPage}
                  className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Shared column popup — one menu, used by every column. */}
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
                const col = columnDefById[openColumnMenuKey];
                if (!col) return null;
                const side = pinnedCols[col.id];
                const isSortable = col.sortable !== false;
                const itemClass =
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal whitespace-nowrap";

                return (
                  <>
                    <button
                      onClick={() => {
                        closeColumnMenu();
                        setColumnPin(col.id, "left");
                      }}
                      className={`${itemClass} ${
                        side === "left"
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
                      className={`${itemClass} ${
                        side === "right"
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

                    {isSortable && (
                      <>
                        <button
                          onClick={() => {
                            closeColumnMenu();
                            setSortConfig({ key: col.id, direction: "asc" });
                            setPagination((prev) => ({ ...prev, currentPage: 1 }));
                          }}
                          className={`${itemClass} text-[#161618] hover:bg-gray-50`}
                        >
                          <ChevronUp className="w-3.5 h-3.5 text-[#1C1B1F]" />
                          Sort Ascending
                        </button>
                        <button
                          onClick={() => {
                            closeColumnMenu();
                            setSortConfig({ key: col.id, direction: "desc" });
                            setPagination((prev) => ({ ...prev, currentPage: 1 }));
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
                      className={`${itemClass} ${
                        col.required
                          ? "text-gray-300 cursor-not-allowed"
                          : "text-[#161618] hover:bg-gray-50"
                      }`}
                    >
                      <EyeOff
                        className={`w-3.5 h-3.5 ${
                          col.required ? "text-gray-300" : "text-[#1C1B1F]"
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

      {/* Drag ghost */}
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

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-lg">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800 font-sf">
                Delete Vendor
              </h2>
            </div>
            <p className="text-gray-600 mb-6 font-inter">
              Are you sure you want to delete this vendor? This action cannot
              be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setVendorToDelete(null);
                }}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-inter font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={loading}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium font-inter flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <VendorPaymentForm
        open={showPaymentModal}
        vendorId={paymentForm.vendorId}
        direction={paymentForm.direction}
        onSave={handleAddPayment}
        onClose={() => {
          setShowPaymentModal(false);
        }}
        vendors={vendors}
      />

      <BulkActions
        isOpen={showBulkActions}
        onClose={() => setShowBulkActions(false)}
        selectedItems={vendors.filter((v) => selectedVendors.includes(v._id))}
        onBulkUpdate={handleBulkUpdateVendors}
        onBulkDelete={handleBulkDeleteVendors}
        fieldConfig={vendorFieldConfig}
        module="vendors"
      />
    </div>
  );
}

export default Vendors;
