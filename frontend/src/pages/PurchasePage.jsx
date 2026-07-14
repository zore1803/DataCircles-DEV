import React, { useEffect, useState, useRef } from "react";
import API from "../services/api";
import PurchaseForm from "../components/purchase/PurchaseForm";
import PurchasePreview from "../components/purchase/PurchasePreview";
import BulkActions from "../components/BulkActions";
import { useNavigate } from "react-router-dom";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  ShoppingCart,
  Edit2,
  Trash2,
  Truck,
  IndianRupee,
  Filter,
  Calendar,
  MoreVertical,
  CheckSquare,
  X,
  Plus,
  Eye,
  Upload,
  ChevronDown as SelectChevron,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import logo from "/DataCircles.png";
import VideoTutorialModal from "../components/VideoTutorialModal";
import { getVideoTutorial } from "../utils/videoTutorials";
import VideoTutorialButton from "../components/VideoTutorialButton";

const PurchasePage = () => {
  const [vendors, setVendors] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Bulk Selection
  const [selectedPurchases, setSelectedPurchases] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Delete Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState(null);

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

  const statusOptions = ["Draft", "Pending", "Paid", "Cancelled"];

  // Click outside for action dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectPurchase = (purchaseId) => {
    setSelectedPurchases((prev) =>
      prev.includes(purchaseId)
        ? prev.filter((id) => id !== purchaseId)
        : [...prev, purchaseId],
    );
    setSelectionMode(true);
  };

  const handleSelectAll = () => {
    if (selectedPurchases.length === purchases.length && purchases.length > 0) {
      setSelectedPurchases([]);
    } else {
      setSelectedPurchases(purchases.map((p) => p._id));
    }
    setSelectionMode(true);
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedPurchases([]);
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

  // Fetch purchases
  useEffect(() => {
    fetchPurchases();
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

  const fetchPurchases = async () => {
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

      const res = await API.get(`/purchases/pagination?${params.toString()}`);
      setPurchases(res.data.purchases || []);
      setPagination((prev) => ({
        ...prev,
        ...res.data.pagination,
      }));
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load purchases");
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    toast.success("Purchase saved successfully");
    fetchPurchases();
    exitSelectionMode();
  };

  const handleEdit = (purchase) => {
    setEditingPurchase(purchase);
    setShowForm(true);
  };

  const handleView = (purchase) => {
    setSelectedPurchase(purchase);
    setShowPreview(true);
  };

  const handleDelete = (id) => {
    setPurchaseToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!purchaseToDelete) return;
    const toastId = toast.loading("Deleting...");
    try {
      await API.delete(`/purchases/${purchaseToDelete}`);
      toast.success("Purchase deleted", { id: toastId });
      fetchPurchases();
      exitSelectionMode();
    } catch (err) {
      toast.error(err.response?.data?.error || "Delete failed", {
        id: toastId,
      });
    } finally {
      setShowDeleteModal(false);
      setPurchaseToDelete(null);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await API.put(`/purchases/${id}/status`, { status });
      fetchPurchases();
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
      await Promise.all(itemIds.map((id) => API.delete(`/purchases/${id}`)));
      toast.success(`Deleted ${itemIds.length} purchases`);
      fetchPurchases();
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
        itemIds.map((id) => API.put(`/purchases/${id}`, { [field]: value })),
      );
      toast.success(`Updated ${itemIds.length} purchases`);
      fetchPurchases();
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

  const purchaseFieldConfig = {
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
    switch (status?.toLowerCase()) {
      case "paid":
        return "bg-green-100 text-green-800 border-transparent";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-transparent";
      case "cancelled":
        return "bg-red-100 text-red-800 border-transparent";
      case "draft":
        return "bg-blue-100 text-blue-800 border-transparent";
      default:
        return "bg-gray-100 text-gray-800 border-transparent";
    }
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
      className={`px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border border-gray-200 cursor-pointer hover:bg-gray-100 select-none transition-colors ${className}`}
    >
      <div className="flex items-center gap-2">
        {children}
        <div className="flex flex-col">
          <ChevronUp
            className={`w-3 h-3 ${
              sortConfig.key === field && sortConfig.direction === "asc"
                ? "text-blue-600"
                : "text-gray-400"
            }`}
          />
          <ChevronDown
            className={`w-3 h-3 -mt-1 ${
              sortConfig.key === field && sortConfig.direction === "desc"
                ? "text-blue-600"
                : "text-gray-400"
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
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
        <div className="flex-1 flex justify-between sm:hidden">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={!hasPrevPage}
            className="btn-pagination"
          >
            Previous
          </button>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={!hasNextPage}
            className="btn-pagination ml-3"
          >
            Next
          </button>
        </div>

        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center space-x-2">
            <p className="text-sm text-gray-700">
              Showing <span className="font-semibold">{startItem}</span> to{" "}
              <span className="font-semibold">{endItem}</span> of{" "}
              <span className="font-semibold">{totalCount}</span> results
            </p>
            <select
              value={limit}
              onChange={(e) => handleLimitChange(parseInt(e.target.value))}
              className="ml-2 border rounded-lg px-3 py-1.5 text-sm"
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
              className="pagination-btn"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {getPageNumbers().map((num, i) =>
              num === "..." ? (
                <span key={i} className="px-4 py-2 text-sm text-gray-700">
                  ...
                </span>
              ) : (
                <button
                  key={num}
                  onClick={() => handlePageChange(num)}
                  className={`pagination-btn ${
                    num === currentPage ? "bg-blue-600 text-white" : ""
                  }`}
                >
                  {num}
                </button>
              ),
            )}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!hasNextPage}
              className="pagination-btn"
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
        videoId={getVideoTutorial("purchases")?.videoId}
        title={getVideoTutorial("purchases")?.title}
      />

      <BulkActions
        isOpen={showBulkActions}
        onClose={() => setShowBulkActions(false)}
        selectedItems={purchases.filter((p) =>
          selectedPurchases.includes(p._id),
        )}
        onBulkUpdate={handleBulkUpdate}
        onBulkDelete={handleBulkDelete}
        fieldConfig={purchaseFieldConfig}
        module="purchases"
        loading={bulkLoading}
      />

      <div className="">
        {/* Header - Simplified */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold font-sf text-gray-900">
            Purchases
          </h1>
          <p className="text-sm text-gray-500 font-inter">
            Manage your purchases
          </p>
        </div>

        {/* Form & Preview */}
        {showForm && (
          <PurchaseForm
            editingPurchase={editingPurchase}
            vendors={vendors}
            onRequestClose={() => {
              setShowForm(false);
              setEditingPurchase(null);
            }}
            onSuccess={handleSuccess}
            onError={(msg) => toast.error(msg)}
          />
        )}

        {showPreview && (
          <PurchasePreview
            purchase={selectedPurchase}
            isOpen={showPreview}
            onClose={() => setShowPreview(false)}
          />
        )}

        {/* Selection Banner */}
        {selectionMode && selectedPurchases.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <CheckSquare className="w-5 h-5 text-blue-600" />
              <span className="text-blue-800 font-semibold font-inter">
                {selectedPurchases.length} purchase
                {selectedPurchases.length > 1 ? "s" : ""} selected
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
                placeholder="Search Purchases Order by Number or Vendor..."
                className="font-inter w-full pl-10 pr-4 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
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
                Import/Export
              </button>

              <div className="relative">
                <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium text-sm px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap">
                  <Filter className="w-4 h-4" />
                  All Status
                  <SelectChevron className="w-3 h-3 ml-1" />
                </button>
                <div className="absolute inset-0 opacity-0 cursor-pointer">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full h-full cursor-pointer"
                  >
                    <option value="">All Status</option>
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={() => {
                  setEditingPurchase(null);
                  setShowForm(true);
                }}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium font-sf text-sm hover:bg-blue-700 transition shadow-sm whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                New Purchase
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 font-inter shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-200">
              <thead className="bg-white">
                <tr>
                  <th className="px-4 py-4 text-left w-12 border border-gray-200">
                    <input
                      type="checkbox"
                      checked={
                        selectedPurchases.length === purchases.length &&
                        purchases.length > 0
                      }
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <SortableHeader field="purchaseNumber">
                    # Purchase Number
                  </SortableHeader>
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
                          Loading purchases...
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : purchases.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center py-12 text-gray-500 border border-gray-200"
                    >
                      <ShoppingCart className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                      <p className="font-medium">No purchases found</p>
                    </td>
                  </tr>
                ) : (
                  purchases.map((p) => (
                    <tr
                      key={p._id}
                      className={`hover:bg-gray-50 transition-colors ${
                        selectedPurchases.includes(p._id) ? "bg-blue-50" : ""
                      }`}
                    >
                      <td className="px-4 py-4 border border-gray-200">
                        <input
                          type="checkbox"
                          checked={selectedPurchases.includes(p._id)}
                          onChange={() => handleSelectPurchase(p._id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4 border border-gray-200">
                        <span className="text-sm font-semibold text-blue-600 block">
                          {p.purchaseNumber || "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4 border border-gray-200">
                        <span className="text-sm font-bold text-gray-900 block">
                          {p.vendor?.name || "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4 border border-gray-200">
                        <span className="text-sm font-medium text-gray-700 block">
                          ₹
                          {p.grandTotal?.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }) || "0.00"}
                        </span>
                      </td>
                      <td className="px-6 py-4 border border-gray-200">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeColor(
                            p.status,
                          )}`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 border border-gray-200">
                        <span className="text-sm text-gray-600 block">
                          {new Date(p.createdAt).toLocaleDateString("en-IN")}
                        </span>
                      </td>
                      <td className="px-6 py-4 border border-gray-200 text-center relative">
                        <div className="flex justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDropdown(
                                showDropdown === p._id ? null : p._id,
                              );
                            }}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {showDropdown === p._id && (
                            <div
                              ref={dropdownRef}
                              className="absolute right-8 mt-2 top-0 flex flex-col w-40 bg-white border border-gray-200 rounded-lg shadow-xl z-50 text-left py-1 overflow-hidden"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  handleView(p);
                                  setShowDropdown(null);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                              >
                                <Eye className="w-4 h-4 text-gray-500" /> View
                              </button>
                              <button
                                onClick={() => {
                                  handleEdit(p);
                                  setShowDropdown(null);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                              >
                                <Edit2 className="w-4 h-4 text-gray-500" /> Edit
                              </button>
                              <button
                                onClick={() => {
                                  handleDelete(p._id);
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
                  Delete Purchase
                </h2>
              </div>
              <p className="text-gray-600 mb-6 font-inter">
                Are you sure you want to delete this purchase? This action
                cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setPurchaseToDelete(null);
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

export default PurchasePage;
