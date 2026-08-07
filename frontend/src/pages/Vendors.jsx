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
  CheckSquare,
  History,
  Download,
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
import AppToaster from "../components/AppToaster";
import HighlightText from "../components/common/HighlightText";
import TablePaginationFooter from "../components/common/TablePaginationFooter";
import { getAncestorZoom } from "../utils/domUtils";
import useMinDelay from "../hooks/useMinDelay";
import { useTopLoadingSignal } from "../components/common/TopLoadingBar";
import Skeleton from "../components/common/Skeleton";
import TableSkeletonRows from "../components/common/TableSkeletonRows";
import FilterIcon from "../components/common/FilterIcon";
import ExportModal from "../components/common/ExportModal";

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
  { id: "name", label: "Name", required: true, width: 200 },
  { id: "email", label: "Email", width: 220 },
  { id: "phone", label: "Phone", width: 160 },
  { id: "company", label: "Company", width: 180 },
  { id: "address", label: "Address", width: 260 },
  // Wider than the others so "CLOSING BALANCE" renders in full rather than
  // truncating to "CLOSING BAL...".
  { id: "balance", label: "Closing Balance", width: 190 },
];
const ACTIONS_COLUMN_DEF = {
  id: "actions",
  label: "Actions",
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
      instagram: "",
      facebook: "",
      whatsapp: "",
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
  const [showExportModal, setShowExportModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Delays the bulk-strip's unmount so it can play a slide-out-right exit
  // animation on deselect (mirroring the slide-in entrance) — same mechanism
  // Companies.jsx uses so the toolbar and the bulk strip feel identical.
  const [showBulkStrip, setShowBulkStrip] = useState(false);
  const [bulkStripClosing, setBulkStripClosing] = useState(false);
  useEffect(() => {
    if (selectedVendors.length > 0) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVendors.length]);
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
    limit: 50,
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

  // Search expand/collapse animation — same mechanics as Companies.jsx: the
  // title/subtitle shrink away and the search pill grows via a width
  // transition, instead of the field just appearing/disappearing.
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef(null);

  // Column order / visibility / pinning / widths — in-memory only, same
  // scheme as Accounting.jsx (no persistence, matched on purpose for parity).
  const customColumnDefs = useMemo(
    () =>
      (vendorFields || []).map((field) => ({
        id: field.name || field,
        label: field.name || field,
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

  // Column list handed to the shared ExportModal. Same shape Companies.jsx
  // passes: { key, label, isCustomField }. "actions" is a UI-only column, so
  // it is dropped — everything else, including vendor custom fields, is
  // offered as an exportable column.
  const baseColumnIds = useMemo(
    () => new Set(BASE_COLUMN_DEFS.map((c) => c.id)),
    []
  );
  const exportColumns = useMemo(
    () =>
      allColumnDefs
        .filter((c) => c.id !== "actions")
        .map((c) => ({
          key: c.id,
          label: c.label,
          isCustomField: !baseColumnIds.has(c.id),
        })),
    [allColumnDefs, baseColumnIds]
  );

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
            className="text-blue-600 font-bold text-sm underline hover:text-blue-700 transition-colors truncate block"
          >
            <HighlightText text={vendor.name} query={searchTerm} />
          </Link>
        );
      case "email":
        return vendor.email ? (
          <a
            href={`mailto:${vendor.email}`}
            className="text-sm text-gray-700 hover:text-blue-600 transition-colors truncate block"
          >
            <HighlightText text={vendor.email} query={searchTerm} />
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
            <HighlightText text={vendor.phone} query={searchTerm} />
          </a>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        );
      case "company":
        return (
          <span className="text-sm text-gray-700 capitalize font-medium truncate block">
            {vendor.company ? (
              <HighlightText text={vendor.company} query={searchTerm} />
            ) : (
              "—"
            )}
          </span>
        );
      case "address":
        return (
          <span className="text-sm text-gray-700 truncate block">
            <HighlightText
              text={truncateText(getFieldValue(vendor, "address"), 40)}
              query={searchTerm}
            />
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
            <HighlightText
              text={truncateText(String(getFieldValue(vendor, colId)), 30)}
              query={searchTerm}
            />
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

  // Reset to page 1 when the search/filter changes. Skips the initial mount —
  // otherwise it races the first fetch below. Returning `prev` unchanged when
  // already on page 1 avoids handing back a new pagination object on every
  // settled keystroke, which re-rendered the whole list for nothing.
  const skipInitialPageReset = useRef(true);
  useEffect(() => {
    if (skipInitialPageReset.current) {
      skipInitialPageReset.current = false;
      return;
    }
    setPagination((prev) =>
      prev.currentPage === 1 ? prev : { ...prev, currentPage: 1 },
    );
  }, [debouncedSearchTerm, debouncedFilterCompany]);

  useEffect(() => {
    fetchVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.currentPage, pagination.limit, sortConfig]);

  // Search/filter fetch. Skips the initial mount — the effect above already
  // fires the first fetch, and running both sent two identical requests on
  // every page load (the same guard Companies.jsx uses).
  const skipInitialSearchFetch = useRef(true);
  useEffect(() => {
    if (skipInitialSearchFetch.current) {
      skipInitialSearchFetch.current = false;
      return;
    }
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

  // Holds the id of the most recent request. Erasing a search term fires one
  // request per settled keystroke, and a slower earlier request could land
  // after a newer one and repaint the list with stale rows — which read as the
  // list "reloading again and again". Only the newest response is applied.
  const vendorRequestIdRef = useRef(0);

  const fetchVendors = async () => {
    const requestId = ++vendorRequestIdRef.current;
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

      // A newer request has been issued since this one started — discard.
      if (requestId !== vendorRequestIdRef.current) return;

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
      if (requestId !== vendorRequestIdRef.current) return;
      if (err.response && err.response.status === 403) {
        toast.error(err.response.data.message || "Access denied");
      } else {
        toast.error("Failed to load vendors");
      }
      setVendors([]);
    } finally {
      // Only the newest request owns the loading flag, so a stale response
      // resolving late can't switch the spinner off mid-flight.
      if (requestId === vendorRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  // Header checkbox: toggles the CURRENT PAGE only — synchronous, no network
  // call. Mirrors Companies.jsx's handleSelectAll exactly (pages/Companies.jsx),
  // which compares against `companies.length` (the current page's array), not
  // the total count across all pages. "Select every matching vendor across
  // every page" is a deliberately separate action — see
  // handleSelectAllAcrossPages below — so a stray click on the header
  // checkbox can't silently select hundreds of off-screen rows.
  const handleSelectAll = () => {
    if (selectedVendors.length === vendors.length && vendors.length > 0) {
      setSelectedVendors([]);
    } else {
      setSelectedVendors(vendors.map((v) => v._id));
    }
  };

  // Bulk-strip "Select All" button: fetches every vendor id matching the
  // current search/filter, ignoring pagination — mirrors
  // Companies.jsx's handleSelectAllAcrossPages against
  // GET /companies/pagination?allIds=true, backed here by the identical
  // allIds branch in getAllVendorsWithPagination.
  const handleSelectAllAcrossPages = async () => {
    try {
      const params = new URLSearchParams({ allIds: "true" });
      if (debouncedSearchTerm.trim()) params.append("search", debouncedSearchTerm.trim());
      if (debouncedFilterCompany) params.append("company", debouncedFilterCompany);

      const res = await API.get(`/vendors/pagination?${params.toString()}`);
      setSelectedVendors(res.data.ids || []);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to select all rows");
    }
  };

  // Bulk-strip "Deselect All" button: trims the selection back down to just
  // the current page, rather than clearing it entirely — mirrors
  // Companies.jsx's handleDeselectAllExtra. Use "Cancel" (exitSelectionMode)
  // to clear the selection completely and leave selection mode.
  const handleDeselectAllExtra = () => {
    setSelectedVendors(vendors.map((v) => v._id));
  };

  const handleSelectVendor = (vendorId) => {
    setSelectedVendors((prev) =>
      prev.includes(vendorId)
        ? prev.filter((id) => id !== vendorId)
        : [...prev, vendorId],
    );
  };

  const handleBulkDeleteVendors = async (itemIds) => {
    setBulkDeleting(true);
    try {
      await Promise.all(itemIds.map((id) => API.delete(`/vendors/${id}`)));
      await fetchVendors();
      setSelectedVendors([]);
      setShowBulkActions(false);
      toast.success(`Successfully deleted ${itemIds.length} vendors`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Bulk delete failed");
    } finally {
      setBulkDeleting(false);
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
        // All 5 fields, not a hand-picked subset — VendorForm renders inputs
        // for all 5 (twitter/linkedin/instagram/facebook/whatsapp) and saves
        // all 5 on every submit, so any field left out here gets silently
        // wiped to "" the next time this vendor is saved from an unrelated
        // edit (e.g. changing the phone number).
        socialMedia: {
          twitter: vendorData.socialMedia?.twitter || "",
          linkedin: vendorData.socialMedia?.linkedin || "",
          instagram: vendorData.socialMedia?.instagram || "",
          facebook: vendorData.socialMedia?.facebook || "",
          whatsapp: vendorData.socialMedia?.whatsapp || "",
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

  // One flag drives every skeleton on the page — header, table body, and
  // pagination all appear and resolve together, same as Companies.jsx.
  // useMinDelay holds it for 300ms so a fast fetch doesn't flash the
  // placeholders.
  const showLoadingSkeleton = useMinDelay(loading && vendors.length === 0, 300);
  // `loading` toggles around every fetchVendors() call, including page/limit
  // changes — same source Companies.jsx feeds its top-edge bar from, so
  // paging here now gets the identical progress flash Companies.jsx shows.
  useTopLoadingSignal(loading);

  return (
    <>
      <AppToaster />

      {/* Fixed toolbar — same positioning Companies.jsx uses (pinned right
          below the app header, not part of the scrolling page), and the
          same trick for bulk mode: instead of a banner pushed below the
          toolbar, the bulk-action strip slides in and takes over this exact
          bar, so nothing shifts and it feels identical to Companies.jsx. */}
      <div
        className={`fixed right-0 h-16 px-4 lg:px-6 border-b flex items-center top-[54px] lg:top-16 ${
          showBulkStrip ? "bg-blue-50 border-blue-200" : "bg-white border-[#E1E4EA]"
        }`}
        style={{ left: "var(--sidebar-width, 0px)", zIndex: 40 }}
      >
        {showBulkStrip ? (
          <div
            className={`${
              bulkStripClosing ? "animate-slideOutRight" : "animate-slideInLeft"
            } flex flex-nowrap lg:flex-wrap items-center justify-start lg:justify-between gap-4 lg:gap-6 w-full h-full overflow-x-auto lg:overflow-visible`}
          >
            <div className="flex flex-nowrap items-center gap-3 flex-shrink-0">
              <button
                onClick={() => setShowExportModal(true)}
                className="h-10 px-4 bg-white border border-green-600 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 focus:outline-none transition-colors flex items-center gap-2 flex-shrink-0 whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={() => setShowBulkActions(true)}
                className="h-10 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none transition-colors flex items-center gap-2 flex-shrink-0 whitespace-nowrap"
              >
                <Edit2 className="w-4 h-4" />
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
                onClick={exitSelectionMode}
                className="h-10 px-4 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none transition-colors flex items-center gap-2 flex-shrink-0 whitespace-nowrap"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
            <div className="flex flex-nowrap items-center gap-3 flex-shrink-0">
              <CheckSquare className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <span className="text-blue-800 font-semibold font-inter whitespace-nowrap">
                {selectedVendors.length} vendor
                {selectedVendors.length !== 1 ? "s" : ""} selected
              </span>
              <button
                onClick={handleSelectAllAcrossPages}
                className="h-10 px-4 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none transition-colors flex items-center gap-2 flex-shrink-0 whitespace-nowrap"
              >
                <CheckSquare className="w-4 h-4" />
                Select All
              </button>
              <button
                onClick={handleDeselectAllExtra}
                className="h-10 px-4 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none transition-colors flex items-center gap-2 flex-shrink-0 whitespace-nowrap"
              >
                <X className="w-4 h-4" />
                Deselect All
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 lg:gap-4 w-full h-full">
            <div
              className={`flex-shrink-0 flex flex-col justify-center gap-1.5 overflow-hidden transition-all duration-300 ease-in-out lg:!w-auto lg:!opacity-100 ${
                isSearchExpanded ? "w-0 opacity-0" : "w-[190px] opacity-100"
              }`}
            >
              {showLoadingSkeleton ? (
                <>
                  <Skeleton width={80} height={18} className="mb-1" />
                  <Skeleton width={130} height={12} />
                </>
              ) : (
                <>
                  <h1 className="m-0 leading-tight font-bold text-base sm:text-lg text-gray-900 truncate">Vendors</h1>
                  <p className="m-0 leading-tight text-[10px] sm:text-xs text-gray-500 font-inter truncate">
                    Manage your vendors.
                  </p>
                </>
              )}
            </div>

            <div className="flex-1" />

        {showLoadingSkeleton ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Skeleton width={44} height={44} shape="circle" />
            <Skeleton width={44} height={44} shape="circle" />
            <Skeleton width={44} height={44} shape="circle" />
            <Skeleton width={130} height={44} shape="circle" />
          </div>
        ) : (
        <div className="flex flex-row items-center gap-2 h-[44px] flex-shrink-0">
          <div
            className={`relative h-11 flex items-center border border-[#E1E4EA] rounded-full bg-white transition-all duration-300 ease-in-out hover:bg-gray-50 focus-within:border-[#0085FF] focus-within:hover:bg-white ${
              isSearchExpanded ? "w-[220px] sm:w-[300px] lg:w-[380px]" : "w-11"
            } max-w-full`}
          >
            <Search
              size={18}
              strokeWidth={2}
              className="absolute left-3.5 text-[#1F2937] cursor-pointer z-10 flex-shrink-0"
              onClick={() => {
                setIsSearchExpanded(true);
                searchInputRef.current?.focus();
              }}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsSearchExpanded(true)}
              onBlur={() => {
                if (!searchTerm) setIsSearchExpanded(false);
              }}
              placeholder="Search by vendor name, ID, company, or email..."
              className={`w-full h-full bg-transparent rounded-full pl-11 pr-4 text-[14px] leading-[20px] text-[#1F2937] placeholder:text-[#99A0AE] focus:outline-none transition-opacity duration-200 cursor-pointer ${
                isSearchExpanded ? "opacity-100 focus:cursor-text" : "opacity-0"
              }`}
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
              <FilterIcon
                size={16}
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
        )}
            </div>
        )}
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


      {showImport && (
        <ImportVendors
          isOpen={true}
          onClose={() => setShowImport(false)}
          vendorFieldNames={vendorFields}
          onImportSuccess={fetchVendors}
        />
      )}

      {/* Fixed table area — same offsets Companies.jsx uses: starts right
          below the 64px toolbar (which itself starts below the 54/64px app
          header), and stops 64px short of the bottom to leave room for the
          fixed pagination bar. */}
      <div
        className="overflow-x-auto overflow-y-auto top-[118px] lg:top-[128px]"
        style={{
          position: "fixed",
          left: "var(--sidebar-width, 0px)",
          right: 0,
          bottom: pagination.totalCount > 0 ? 64 : 0,
        }}
      >
        {/* Hidden columns are recoverable — same affordance as Accounting.jsx. */}
        {hiddenCols.length > 0 && (
          <div className="flex justify-end p-2 sticky left-0">
            <button
              onClick={() => setHiddenCols([])}
              className="h-8 px-3 flex items-center gap-1.5 rounded-full bg-white border border-[#E1E4EA] shadow-sm text-xs font-medium text-[#525866] hover:bg-gray-50 transition-colors"
            >
              Show {hiddenCols.length} hidden column
              {hiddenCols.length > 1 ? "s" : ""}
            </button>
          </div>
        )}

        <div className="bg-white border border-[#E1E4EA]">
          <table
            className="border-separate border-spacing-0 text-left"
            style={{ minWidth: "100%", width: tableWidth, tableLayout: "fixed" }}
          >
            <thead className="bg-[#F5F7FA] sticky top-0 z-20 select-none">
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
                        <span className="truncate flex-1">{col.label}</span>
                        {pinnedCols[col.id] && (
                          <Pin className="w-3 h-3 text-[#0085FF] flex-shrink-0" />
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
              {showLoadingSkeleton && (
                <TableSkeletonRows
                  numRows={pagination.limit}
                  columns={orderedColumns.map((c) => colWidths[c.id])}
                  hasCheckbox
                  checkboxWidth={colWidths.selection}
                />
              )}
              {!showLoadingSkeleton && vendors.length === 0 && (
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
              )}
              {!showLoadingSkeleton &&
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
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination — its own fixed strip pinned to the bottom */}
      {(showLoadingSkeleton || pagination.totalCount > 0) && (
        <div
          className="fixed bottom-0 right-0 bg-white border-t border-[#E1E4EA] shadow-sm z-[9992] flex items-center"
          style={{ left: "var(--sidebar-width, 0px)", height: 64 }}
        >
          {showLoadingSkeleton ? (
            <div className="w-full px-4 py-3 flex items-center justify-between sm:px-6">
              <Skeleton width={190} height={14} />
              <div className="flex items-center gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} width={32} height={32} shape="circle" />
                ))}
              </div>
            </div>
          ) : (
            <TablePaginationFooter
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalCount={pagination.totalCount}
              limit={pagination.limit}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
              className="w-full px-4 py-3 flex items-center justify-between sm:px-6"
            />
          )}
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

      {/* Bulk delete confirmation — same structure as Companies.jsx's. */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 font-sf">
                Confirm Bulk Delete
              </h3>
              <p className="text-sm text-gray-500 font-inter mb-6">
                Are you sure you want to delete{" "}
                <strong>{selectedVendors.length}</strong> vendor
                {selectedVendors.length !== 1 ? "s" : ""}? This action cannot
                be undone.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowBulkDeleteModal(false)}
                  disabled={bulkDeleting}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await handleBulkDeleteVendors(selectedVendors);
                    setShowBulkDeleteModal(false);
                  }}
                  disabled={bulkDeleting}
                  className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm flex items-center justify-center gap-2 min-w-[120px]"
                >
                  {bulkDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
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

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        columns={exportColumns}
        selectedIds={selectedVendors}
        exportUrl="/vendors/export-selected"
        fileName="Exported_Vendors.csv"
      />
    </>
  );
}

export default Vendors;
