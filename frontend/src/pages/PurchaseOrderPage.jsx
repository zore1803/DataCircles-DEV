import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import API from "../services/api";
import PurchaseOrderForm from "../components/purchaseOrder/PurchaseOrderForm";
import PurchaseOrderPreview from "../components/purchaseOrder/PurchaseOrderPreview";
import BulkActions from "../components/BulkActions";
import { useNavigate } from "react-router-dom";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  ClipboardList,
  Trash2,
  Edit2,
  Truck,
  IndianRupee,
  Calendar,
  MoreVertical,
  Plus,
  X,
  Filter,
  CheckSquare,
  Eye,
  Upload,
  Download,
  Clock,
  CheckCircle2,
  ChevronDown as SelectChevron,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import logo from "/DataCircles.png";
import VideoTutorialModal from "../components/VideoTutorialModal";
import { getVideoTutorial } from "../utils/videoTutorials";
import VideoTutorialButton from "../components/VideoTutorialButton";

const SingleSelectDropdown = ({ options, value, onChange, disabled, variant = "pill" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selectedOption = options.find(opt => opt.value?.toLowerCase() === value?.toLowerCase()) || options[0];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center gap-2 transition-all ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
          } ${variant === "pill"
            ? `px-3 py-1.5 rounded-full text-xs font-semibold border ${selectedOption.className}`
            : "text-gray-600 hover:text-gray-900 font-medium text-sm px-3 py-2 rounded-lg hover:bg-gray-50"
          }`}
      >
        <div className="flex items-center gap-1.5">
          {selectedOption.icon && <selectedOption.icon className="w-3.5 h-3.5" />}
          <span className="capitalize">{selectedOption.label}</span>
        </div>
        {!disabled && <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-2xl z-[100] py-1 overflow-hidden animate-in fade-in zoom-in duration-200">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 ${value?.toLowerCase() === option.value?.toLowerCase() ? 'bg-blue-50/50 text-blue-600' : 'text-gray-600'
                }`}
            >
              <div className={`p-1.5 rounded-lg ${option.className} border-none`}>
                {option.icon && <option.icon className="w-4 h-4" />}
              </div>
              <span className="font-medium text-left flex-1">{option.label}</span>
              {value?.toLowerCase() === option.value?.toLowerCase() && (
                <div className="w-1.5 h-1.5 rounded-full bg-blue-600 ml-auto" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const PurchaseOrderPage = () => {
  const [vendors, setVendors] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingPO, setEditingPO] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedPO, setSelectedPO] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Bulk Selection
  const [selectedPurchaseOrders, setSelectedPurchaseOrders] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Delete Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [poToDelete, setPoToDelete] = useState(null);

  // Video Tutorial
  const [showVideoTutorial, setShowVideoTutorial] = useState(false);

  // Dropdown
  const [showDropdown, setShowDropdown] = useState(null);
  const dropdownRef = useRef(null);

  const navigate = useNavigate();

  // Pagination
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 0,
    totalCount: 0,
    limit: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Sorting
  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "desc",
  });

  const statusOptions = [
    { value: "Pending", label: "Pending", icon: Clock, className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
    { value: "Approved", label: "Approved", icon: CheckCircle2, className: "bg-green-50 text-green-700 border-green-200" },
    { value: "Rejected", label: "Rejected", icon: X, className: "bg-red-50 text-red-700 border-red-200" },
    { value: "Delivered", label: "Delivered", icon: Truck, className: "bg-blue-50 text-blue-700 border-blue-200" },
  ];

  const filterOptions = [
    { value: "", label: "All Status", icon: Filter, className: "bg-gray-50 text-gray-700 border-gray-200" },
    ...statusOptions
  ];

  // Click outside for dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectPurchaseOrder = (poId) => {
    setSelectedPurchaseOrders((prev) =>
      prev.includes(poId) ? prev.filter((id) => id !== poId) : [...prev, poId],
    );
    setSelectionMode(true);
  };

  const handleSelectAll = () => {
    if (
      selectedPurchaseOrders.length === purchaseOrders.length &&
      purchaseOrders.length > 0
    ) {
      setSelectedPurchaseOrders([]);
    } else {
      setSelectedPurchaseOrders(purchaseOrders.map((po) => po._id));
    }
    setSelectionMode(true);
  };

  const exitSelectionMode = () => {
    setSelectionMode(false); // Changed default to false like in Vendors
    setSelectedPurchaseOrders([]);
    setShowBulkActions(false);
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset selection on filter/search/page change
  useEffect(() => {
    exitSelectionMode();
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  }, [debouncedSearchTerm, filterStatus]);

  // Fetch data
  useEffect(() => {
    fetchPurchaseOrders();
  }, [
    pagination.currentPage,
    pagination.limit,
    sortConfig,
    debouncedSearchTerm,
    filterStatus,
  ]);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const res = await API.get("/vendors");
      setVendors(res.data.vendors || res.data || []);
    } catch (err) {
      toast.error("Failed to load vendors");
    }
  };

  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.currentPage,
        limit: pagination.limit,
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction,
      });
      if (debouncedSearchTerm) params.append("search", debouncedSearchTerm);
      if (filterStatus) params.append("status", filterStatus);

      const res = await API.get(
        `/purchase-orders/pagination?${params.toString()}`,
      );
      setPurchaseOrders(res.data.purchaseOrders || []);
      setPagination((prev) => ({
        ...prev,
        ...res.data.pagination,
      }));
    } catch (err) {
      toast.error(
        err.response?.data?.error || "Failed to load purchase orders",
      );
      setPurchaseOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    toast.success("Purchase order saved successfully");
    fetchPurchaseOrders();
    exitSelectionMode();
  };

  const handleEdit = (po) => {
    setEditingPO(po);
    setShowForm(true);
  };

  const handleView = (po) => {
    setSelectedPO(po);
    setShowPreview(true);
  };

  const handleDelete = (id) => {
    setPoToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!poToDelete) return;
    const toastId = toast.loading("Deleting...");
    try {
      await API.delete(`/purchase-orders/${poToDelete}`);
      toast.success("Purchase order deleted", { id: toastId });
      fetchPurchaseOrders();
      exitSelectionMode();
    } catch (err) {
      toast.error(err.response?.data?.error || "Delete failed", {
        id: toastId,
      });
    } finally {
      setShowDeleteModal(false);
      setPoToDelete(null);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await API.put(`/purchase-orders/${id}/status`, { status });
      fetchPurchaseOrders();
      toast.success("Status updated");
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to update status");
      }
    }
  };

  // Bulk Actions
  const handleBulkDelete = async (itemIds) => {
    setBulkLoading(true);
    try {
      await Promise.all(
        itemIds.map((id) => API.delete(`/purchase-orders/${id}`)),
      );
      toast.success(`Deleted ${itemIds.length} purchase orders`);
      fetchPurchaseOrders();
      exitSelectionMode();
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Bulk delete failed");
      }
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkUpdate = async ({ field, value, itemIds }) => {
    setBulkLoading(true);
    try {
      await Promise.all(
        itemIds.map((id) =>
          API.put(`/purchase-orders/${id}`, { [field]: value }),
        ),
      );
      toast.success(`Updated ${itemIds.length} purchase orders`);
      fetchPurchaseOrders();
      exitSelectionMode();
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Bulk update failed");
      }
    } finally {
      setBulkLoading(false);
    }
  };

  const poFieldConfig = {
    fields: [
      {
        key: "status",
        label: "Status",
        type: "select",
        options: statusOptions,
      },
    ],
  };

  const getStatusBadgeColor = (status) => {
    const map = {
      pending: "bg-yellow-100 text-yellow-800 border border-yellow-200",
      approved: "bg-green-100 text-green-800 border border-green-200",
      rejected: "bg-red-100 text-red-800 border border-red-200",
      delivered: "bg-blue-100 text-blue-800 border border-blue-200",
    };
    return (
      map[status?.toLowerCase()] ||
      "bg-gray-100 text-gray-800 border border-gray-200"
    );
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  };

  const SortableHeader = ({ field, children, className = "" }) => (
    <th
      onClick={() => handleSort(field)}
      className={`px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200 cursor-pointer hover:bg-gray-50 select-none transition-colors ${className}`}
    >
      <div className="flex items-center gap-3">
        <span className="font-semibold text-gray-700">{children}</span>
        <div className="flex flex-col ml-auto">
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
      </div>
    </th>
  );

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
              {[10, 20, 50, 100].map((v) => (
                <option key={v} value={v}>
                  {v} per page
                </option>
              ))}
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

  const handlePageChange = (page) => {
    if (
      page >= 1 &&
      page <= pagination.totalPages &&
      page !== pagination.currentPage
    ) {
      setPagination((prev) => ({ ...prev, currentPage: page }));
      exitSelectionMode();
    }
  };

  const handleLimitChange = (limit) => {
    setPagination((prev) => ({ ...prev, limit, currentPage: 1 }));
    exitSelectionMode();
  };

  return (
    <>
      <Toaster position="top-right" toastOptions={{ duration: 5000 }} />

      <VideoTutorialModal
        isOpen={showVideoTutorial}
        onClose={() => setShowVideoTutorial(false)}
        videoId={getVideoTutorial("purchase-orders")?.videoId}
        title={getVideoTutorial("purchase-orders")?.title}
      />

      <BulkActions
        isOpen={showBulkActions}
        onClose={() => setShowBulkActions(false)}
        selectedItems={purchaseOrders.filter((po) =>
          selectedPurchaseOrders.includes(po._id),
        )}
        onBulkUpdate={handleBulkUpdate}
        onBulkDelete={handleBulkDelete}
        fieldConfig={poFieldConfig}
        module="purchase orders"
        loading={bulkLoading}
      />

      <div className="">
        {/* Header - Simplified */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold font-sf text-gray-900">
            Purchase Orders
          </h1>
          <p className="text-sm text-gray-500 font-inter">
            Manage your purchase orders
          </p>
        </div>

        {/* Form & Preview */}
        {showForm && (
          <PurchaseOrderForm
            editingPO={editingPO}
            vendors={vendors}
            onRequestClose={() => {
              setShowForm(false);
              setEditingPO(null);
            }}
            onSuccess={handleSuccess}
            onError={(msg) => toast.error(msg)}
          />
        )}

        {showPreview && (
          <PurchaseOrderPreview
            purchaseOrder={selectedPO}
            isOpen={showPreview}
            onClose={() => setShowPreview(false)}
          />
        )}

        {/* Selection Banner */}
        {selectionMode && selectedPurchaseOrders.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <CheckSquare className="w-5 h-5 text-blue-600" />
              <span className="text-blue-800 font-semibold font-inter">
                {selectedPurchaseOrders.length} purchase order(s) selected
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkActions(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Bulk Actions
              </button>
              <button
                onClick={exitSelectionMode}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Search & Filter */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 font-inter shadow-sm">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search Purchase Order by Number or Vendor..."
                className="font-inter w-full pl-10 pr-4 py-2.5 bg-gradient-to-r from-white to-blue-100 border border-[#E0E0E1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto flex-wrap pb-2 md:pb-0">
              <button
                onClick={() => setShowImport(!showImport)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium text-sm px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                <Upload className="w-4 h-4" />
                Import/Export
              </button>

              <SingleSelectDropdown
                options={filterOptions}
                value={filterStatus}
                onChange={setFilterStatus}
                variant="ghost"
              />

              <button
                onClick={() => {
                  setEditingPO(null);
                  setShowForm(true);
                }}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium font-sf text-sm hover:bg-blue-700 transition shadow-sm whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                New Purchase Order
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 font-inter shadow-sm">
          <div className="">
            <table className="min-w-full border-collapse border border-gray-200">
              <thead className="bg-white">
                <tr>
                  <th className="px-4 py-4 text-left w-12 border border-gray-200">
                    <input
                      type="checkbox"
                      checked={
                        selectedPurchaseOrders.length ===
                        purchaseOrders.length && purchaseOrders.length > 0
                      }
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <SortableHeader field="poNumber"># PO Number</SortableHeader>
                  <SortableHeader field="vendor.name">Vendor</SortableHeader>
                  <SortableHeader field="totalAmount">Amount</SortableHeader>
                  <SortableHeader field="status">Status</SortableHeader>
                  <SortableHeader field="createdAt">Date</SortableHeader>
                  <th className="px-6 py-4 text-center w-20 text-xs font-semibold text-gray-600 uppercase border border-gray-200">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center py-12 border border-gray-200"
                    >
                      <div className="flex flex-col items-center">
                        <img
                          src={logo}
                          alt="Loading"
                          className="animate-spin-slow w-12 h-12"
                        />
                        <p className="mt-3 text-gray-600 font-medium">
                          Loading purchase orders...
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : purchaseOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center py-12 text-gray-500 border border-gray-200"
                    >
                      <ClipboardList className="w-12 h-12  mx-auto text-gray-300 mb-3" />
                      <p className="font-medium">No purchase orders found</p>
                    </td>
                  </tr>
                ) : (
                  purchaseOrders.map((po) => (
                    <tr
                      key={po._id}
                      className={`hover:bg-gray-50 transition-colors ${selectedPurchaseOrders.includes(po._id)
                        ? "bg-blue-50"
                        : ""
                        }`}
                    >
                      <td className="px-4 py-4 border border-gray-200">
                        <input
                          type="checkbox"
                          checked={selectedPurchaseOrders.includes(po._id)}
                          onChange={() => handleSelectPurchaseOrder(po._id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4 border border-gray-200">
                        <span className="text-sm font-semibold text-blue-600 block">
                          {po.poNumber}
                        </span>
                      </td>
                      <td className="px-6 py-4 border border-gray-200">
                        <span className="text-sm font-bold text-gray-900 block">
                          {po.vendor?.name || "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4 border border-gray-200">
                        <span className="text-sm font-medium text-gray-700 block">
                          ₹
                          {po.totalAmount?.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }) || "0.00"}
                        </span>
                      </td>
                      <td className="px-6 py-4 border border-gray-200">
                        <SingleSelectDropdown
                          options={statusOptions}
                          value={po.status}
                          onChange={(newStatus) => handleStatusChange(po._id, newStatus)}
                        />
                      </td>
                      <td className="px-6 py-4 border border-gray-200">
                        <span className="text-sm text-gray-600 block">
                          {new Date(po.createdAt).toLocaleDateString("en-IN")}
                        </span>
                      </td>
                      <td className="px-6 py-4 border border-gray-200 text-center relative">
                        <div className="flex justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDropdown(
                                showDropdown === po._id ? null : po._id,
                              );
                            }}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {showDropdown === po._id && (
                            <div
                              ref={dropdownRef}
                              className="absolute right-8 mt-2 top-0 flex flex-col w-40 bg-white border border-gray-200 rounded-lg shadow-xl z-50 text-left py-1 overflow-hidden"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  handleView(po);
                                  setShowDropdown(null);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                              >
                                <Eye className="w-4 h-4 text-gray-500" /> View
                              </button>
                              <button
                                onClick={() => {
                                  handleEdit(po);
                                  setShowDropdown(null);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                              >
                                <Edit2 className="w-4 h-4 text-gray-500" /> Edit
                              </button>
                              <button
                                onClick={() => {
                                  handleDelete(po._id);
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
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-[10003]">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-red-100 p-2 rounded-lg">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-800 font-sf">
                  Delete Purchase Order
                </h2>
              </div>
              <p className="text-gray-600 mb-6 font-inter">
                Are you sure you want to delete this purchase order? This action
                cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setPoToDelete(null);
                  }}
                  className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-inter font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium font-inter flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PurchaseOrderPage;
