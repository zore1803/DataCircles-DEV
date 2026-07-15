import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
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
  Filter,
  ChevronDown as SelectChevron,
  Settings,
  Mail,
  Phone,
} from "lucide-react";
import BulkActions from "../components/BulkActions";
import VendorForm from "../components/vendor/VendorForm";
import VendorPaymentForm from "../components/vendor/VendorPaymentForm";
import ProfilePicture from "../components/contact/ProfilePicture";
import { useLocation } from "react-router-dom";
import ImportVendors from "../components/vendor/ImportVendors";
import toast from "react-hot-toast";
import logo from "/DataCircles.png";
import VideoTutorialModal from "../components/VideoTutorialModal";
import { getVideoTutorial } from "../utils/videoTutorials";
import VideoTutorialButton from "../components/VideoTutorialButton";
import ColumnSettingsPanel from "../components/ColumnSettingsPanel";
import { useColumnSettings } from "../hooks/useColumnSettings";
import AppToaster from "../components/AppToaster";

// ✅ FIXED: Use useCallback to memoize the callback
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
  const [bulkLoading, setBulkLoading] = useState(false);
  const [permission, setPermission] = useState("");
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
  const [selectionMode, setSelectionMode] = useState(true);
  const [longPressTimer, setLongPressTimer] = useState(null);

  // Video Tutorial State
  const [showVideoTutorial, setShowVideoTutorial] = useState(false);

  // Column Settings State
  const [showColumnSettings, setShowColumnSettings] = useState(false);

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

  // Define default columns - NOW UPDATES WHEN vendorFields CHANGES
  const defaultColumns = useMemo(() => {
    const baseColumns = [
      {
        key: "name",
        label: "Name",
        visible: true,
        order: 0,
        required: true,
        defaultVisible: true,
        sortable: true,
        icon: User,
      },
      {
        key: "email",
        label: "Email",
        visible: true,
        order: 1,
        sortable: true,
        icon: Mail,
      },
      {
        key: "phone",
        label: "Phone",
        visible: true,
        order: 2,
        sortable: true,
        icon: Phone,
      },
      {
        key: "company",
        label: "Company",
        visible: true,
        order: 3,
        sortable: true,
        icon: Building2,
      },
      {
        key: "address",
        label: "Address",
        visible: true,
        order: 4,
        icon: MapPin,
      },
      {
        key: "balance",
        label: "Closing Balance",
        visible: true,
        order: 5,
        sortable: true,
        icon: IndianRupee,
      },
    ];

    // Add custom fields ONLY if they exist
    if (vendorFields && vendorFields.length > 0) {
      const customColumns = vendorFields.map((field, index) => ({
        key: field.name || field,
        label: field.name || field,
        visible: false, // Hidden by default - user can show them
        order: baseColumns.length + index,
        isCustomField: true,
        type: field.type || "text",
        options: field.options,
        description: `Custom field: ${field.name || field}`,
      }));

      return [...baseColumns, ...customColumns];
    }

    return baseColumns;
  }, [vendorFields]);

  // Use column settings hook
  const { columns, saveColumns, getVisibleColumns } = useColumnSettings(
    "vendors",
    defaultColumns,
  );

  const visibleColumns = useMemo(() => getVisibleColumns(), [columns]);

  // Get field value from vendor
  const getFieldValue = (vendor, columnKey) => {
    // Handle nested address fields
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

    // Check if it's a base field
    if (vendor[columnKey] !== undefined) {
      return vendor[columnKey];
    }

    // Check additional fields
    const additionalField = vendor.additionalFields?.find(
      (field) => field.key === columnKey,
    );
    return additionalField?.value || "—";
  };

  // Truncate text helper
  const truncateText = (text, maxLength = 30) => {
    if (!text) return "—";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  // Render cell content
  const renderCellContent = (vendor, column) => {
    switch (column.key) {
      case "name":
        return (
          <div className="flex items-center">
            <Link
              to={`/vendors/${vendor._id}`}
              className="text-blue-600 font-bold text-sm hover:text-blue-700 transition-colors block"
            >
              {vendor.name}
            </Link>
          </div>
        );

      case "email":
        return vendor.email ? (
          <a
            href={`mailto:${vendor.email}`}
            className="text-sm text-gray-700 hover:text-blue-600 transition-colors truncate"
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
            className="text-sm text-gray-700 hover:text-blue-600 transition-colors truncate"
          >
            {vendor.phone}
          </a>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        );

      case "company":
        return (
          <span className="text-sm text-gray-700 capitalize font-medium">
            {vendor.company || "—"}
          </span>
        );

      case "address":
        const addressText = getFieldValue(vendor, "address");
        return (
          <span className="text-sm text-gray-700">
            {truncateText(addressText, 30)}
          </span>
        );

      case "balance":
        return (
          <span className="text-sm text-gray-700 font-mono">
            ₹{vendor.balance?.toFixed(2) || "0.00"}
          </span>
        );

      default:
        // Handle custom fields
        const value = getFieldValue(vendor, column.key);
        return (
          <span className="text-sm text-gray-700">
            {truncateText(String(value), 30)}
          </span>
        );
    }
  };

  // Long press event handlers
  const handleMouseDown = (vendorId) => {
    const timer = setTimeout(() => {
      setSelectionMode(true);
      handleSelectVendor(vendorId);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleMouseUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleTouchStart = (vendorId) => {
    const timer = setTimeout(() => {
      setSelectionMode(true);
      handleSelectVendor(vendorId);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // ✅ FIXED: Memoize the callback with useCallback
  const handleCloseDropdown = useCallback(() => {
    setShowDropdown(null);
  }, []);

  useOutsideClick(dropdownRef, handleCloseDropdown);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Debounce filter company
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilterCompany(filterCompany);
    }, 300);
    return () => clearTimeout(timer);
  }, [filterCompany]);

  // Reset to page 1 when search/filter changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  }, [debouncedSearchTerm, debouncedFilterCompany]);

  // Fetch data when dependencies change
  useEffect(() => {
    fetchVendors();
  }, [pagination.currentPage, pagination.limit, sortConfig]);

  // Separate effect for search/filter to trigger reset + fetch
  useEffect(() => {
    if (pagination.currentPage === 1) {
      fetchVendors();
    }
  }, [debouncedSearchTerm, debouncedFilterCompany]);

  useEffect(() => {
    fetchUser();
    fetchVendorFields();
  }, []);

  const fetchUser = async () => {
    try {
      const res = await API.get("/auth/me");
      const user = res.data;
      const userPerm = user?.user?.permissions?.find(
        (p) => p.name.toLowerCase() === "vendors",
      );
      setPermission(userPerm?.permission || "no");
    } catch {
      setPermission("no");
      toast.error("Failed to fetch user permissions");
    }
  };

  const fetchVendorFields = async () => {
    try {
      const res = await API.get("/vendor-fields");
      if (res.data?.fields) {
        const fieldData = res.data.fields;
        console.log("✅ Fetched vendor custom fields:", fieldData);
        setVendorFields(fieldData);
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
    if (selectedVendors.length === vendors.length) {
      setSelectedVendors([]);
      setSelectionMode(true);
    } else {
      setSelectedVendors(vendors.map((v) => v._id));
      setSelectionMode(true);
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
    setBulkLoading(true);
    try {
      await Promise.all(itemIds.map((id) => API.delete(`/vendors/${id}`)));
      await fetchVendors();
      setSelectedVendors([]);
      setShowBulkActions(false);
      setSelectionMode(false);
      toast.success(`Successfully deleted ${itemIds.length} vendors`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Bulk delete failed");
    } finally {
      setBulkLoading(false);
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
    setBulkLoading(true);
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
      setSelectionMode(false);
      toast.success(`Successfully updated ${itemIds.length} vendors`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Bulk update failed");
    } finally {
      setBulkLoading(false);
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
      // Fetch full vendor data
      const response = await API.get(`/vendors/${vendor._id}`);
      const vendorData = response.data;

      console.log("Vendor data:", vendorData); // Debug

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

      // Process additional fields
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
      setSelectionMode(false);
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
      setSelectionMode(true);
    }
  };

  const handleLimitChange = (newLimit) => {
    setPagination((prev) => ({
      ...prev,
      limit: newLimit,
      currentPage: 1,
    }));
    setSelectedVendors([]);
    setSelectionMode(true);
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  };

  const SortableHeader = ({ field, children, className = "" }) => {
    const column = visibleColumns.find((col) => col.key === field);
    const isSortable = column?.sortable !== false;
    const Icon = column?.icon;

    return (
      <th
        className={`px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200 ${isSortable ? "cursor-pointer hover:bg-gray-50 select-none" : ""
          } transition-colors ${className}`}
        onClick={() => isSortable && handleSort(field)}
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className="w-4 h-4 inline text-gray-400" />}
          <span className="font-semibold text-gray-700">{children}</span>
          {isSortable && (
            <div className="flex flex-col ml-auto">
              {/* Arrows reduced for simpler look if needed, or kept */}
              <ChevronUp
                className={`w-3 h-3 ${sortConfig.key === field && sortConfig.direction === "asc"
                    ? "text-blue-600"
                    : "text-gray-300"
                  }`}
              />
              <ChevronDown
                className={`w-3 h-3 -mt-1 ${sortConfig.key === field && sortConfig.direction === "desc"
                    ? "text-blue-600"
                    : "text-gray-300"
                  }`}
              />
            </div>
          )}
        </div>
      </th>
    );
  };

  const PaginationControls = () => {
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
        (item, index, arr) => index === 0 || arr[index - 1] !== item,
      );
    };

    return (
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
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

          <div className="flex items-center space-x-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
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
                    onClick={() => handlePageChange(pageNum)}
                    className={`relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${pageNum === currentPage
                        ? "bg-blue-600 text-white"
                        : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                  >
                    {pageNum}
                  </button>
                ),
              )}

            <button
              onClick={() => handlePageChange(currentPage + 1)}
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

  const exitSelectionMode = () => {
    setSelectionMode(true);
    setSelectedVendors([]);
  };

  return (
    <>
      <AppToaster />

      {/* Video Tutorial Modal */}
      <VideoTutorialModal
        isOpen={showVideoTutorial}
        onClose={() => setShowVideoTutorial(false)}
        videoId={getVideoTutorial("vendors")?.videoId}
        title={getVideoTutorial("vendors")?.title}
      />

      {/* Column Settings Panel */}
      <ColumnSettingsPanel
        isOpen={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        columns={columns}
        onSave={saveColumns}
        moduleName="Vendors"
      />

      <div className="">
        {/* Header - Simplified */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold font-sf text-gray-900">Vendors</h1>
          <p className="text-sm text-gray-500 font-inter">
            Manage your vendors
          </p>
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

        {/* Selection Mode Banner */}
        {selectionMode && selectedVendors.length > 0 && (
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

        {/* Search and Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 font-inter shadow-sm">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search Vendor by Name or Company..."
                className="font-inter w-full pl-10 pr-4 py-2.5 bg-gradient-to-r from-white to-blue-100 border border-[#E0E0E1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
              <button
                onClick={() => setShowImport(!showImport)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium text-sm px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                <Upload className="w-4 h-4" />
                {showImport ? "Cancel" : "Import/Export"}
              </button>

              <div className="relative">
                <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium text-sm px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap">
                  <Filter className="w-4 h-4" />
                  Filter
                  <SelectChevron className="w-3 h-3 ml-1" />
                </button>
                {/* Simplified filter dropdown for visual match - logic remains checkable in future if needed */}
                <div className="absolute inset-0 opacity-0 cursor-pointer">
                  <select
                    value={filterCompany}
                    onChange={(e) => setFilterCompany(e.target.value)}
                    className="w-full h-full cursor-pointer"
                  >
                    <option value="">All Companies</option>
                    {getUniqueCompanies().map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={() => {
                  resetForm();
                  setShowForm(!showForm);
                }}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium font-sf text-sm hover:bg-blue-700 transition shadow-sm whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                {showForm ? "Cancel" : "New Vendor"}
              </button>
            </div>
          </div>

          {/* Expandable Import Section */}
          {showImport && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <ImportVendors
                isOpen={true} // It's visible when showImport is true
                onClose={() => setShowImport(false)}
                vendorFieldNames={vendorFields}
                onImportSuccess={fetchVendors}
              // Pass any new props if ImportVendors supports inline rendering or mode switching
              />
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 font-inter shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-200">
              <thead className="bg-white">
                <tr>
                  {selectionMode && (
                    <th className="px-4 py-4 text-left w-12 border border-gray-200">
                      <input
                        type="checkbox"
                        checked={
                          selectedVendors.length === vendors.length &&
                          vendors.length > 0
                        }
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-gray-500 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                  )}
                  {visibleColumns.map((column) => (
                    <SortableHeader key={column.key} field={column.key}>
                      {column.label}
                    </SortableHeader>
                  ))}
                  <th className="px-4 py-4 text-center border border-gray-200 w-10">
                    <div className="flex items-center justify-center">
                      {/* Empty header for actions or just border */}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {loading ? (
                  <tr>
                    <td
                      colSpan={visibleColumns.length + 2}
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
                      colSpan={visibleColumns.length + 2}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <Truck className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                      <p className="font-medium">No vendors found</p>
                      <p className="text-sm">
                        Try adjusting your search or filters
                      </p>
                    </td>
                  </tr>
                ) : (
                  vendors.map((vendor) => (
                    <tr
                      key={vendor._id}
                      onMouseDown={() => handleMouseDown(vendor._id)}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      onTouchStart={() => handleTouchStart(vendor._id)}
                      onTouchEnd={handleTouchEnd}
                      className={`hover:bg-gray-50 transition-colors ${selectedVendors.includes(vendor._id) ? "bg-blue-50" : ""
                        }`}
                    >
                      {selectionMode && (
                        <td className="px-4 py-4 border border-gray-200 w-12 text-center">
                          <input
                            type="checkbox"
                            checked={selectedVendors.includes(vendor._id)}
                            onChange={() => handleSelectVendor(vendor._id)}
                            className="w-4 h-4 text-gray-500 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                      )}
                      {visibleColumns.map((column) => (
                        <td
                          key={column.key}
                          className="px-6 py-4 whitespace-nowrap border border-gray-200 text-sm text-gray-700"
                        >
                          {renderCellContent(vendor, column)}
                        </td>
                      ))}
                      <td className="px-4 py-4 whitespace-nowrap border border-gray-200 text-center w-10 relative">
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
                              className="absolute right-0 mt-2 top-8 flex flex-col w-40 bg-white border border-gray-200 rounded-md shadow-lg z-50 text-left py-1"
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && <PaginationControls />}
        </div>

        {/* Delete Confirmation Modal */}
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
    </>
  );
}

export default Vendors;
