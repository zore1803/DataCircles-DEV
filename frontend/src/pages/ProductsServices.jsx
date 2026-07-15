import React, { useEffect, useState, useRef } from "react";
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
  Boxes,
  Upload,
  Filter,
  ChevronDown as SelectChevron,
  CheckSquare,
  Eye,
  Package,
  Tag,
  IndianRupee,
  FileText,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import BulkActions from "../components/BulkActions";
import ItemForm from "../components/item/ItemForm";
import ImportItems from "../components/item/ImportItems";
import { useLocation } from "react-router-dom";
import "react-quill/dist/quill.snow.css";
import logo from "/DataCircles.png";
import VideoTutorialModal from "../components/VideoTutorialModal";
import { getVideoTutorial } from "../utils/videoTutorials";
import VideoTutorialButton from "../components/VideoTutorialButton";
import AppToaster from "../components/AppToaster";

const ViewDetails = ({ item, onRequestClose }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);
  const [imagePreviews, setImagePreviews] = useState([]);

  useEffect(() => {
    setShouldRender(true);
    setTimeout(() => setIsOpen(true), 10);
    if (item.images && item.images.length > 0) {
      setImagePreviews(
        item.images.map((img) => `${import.meta.env.VITE_APP_API_URL}${img}`),
      );
    } else {
      setImagePreviews([]);
    }
    return () => {
      setIsOpen(false);
      setImagePreviews([]);
    };
  }, [item]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      onRequestClose();
    }, 300);
  };

  const formatCurrency = (amount) => {
    return `₹${parseFloat(amount || 0).toFixed(2)}`;
  };

  if (!shouldRender) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 transition-opacity duration-300"
      style={{ opacity: isOpen ? 1 : 0 }}
      onClick={handleClose}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-xl shadow-2xl max-h-[90vh] flex flex-col transition-transform duration-300 transform"
        style={{ transform: isOpen ? "scale(100%)" : "scale(95%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900 font-sf">
              Item Details
            </h2>
            <p className="text-sm text-gray-500 mt-1 font-inter">
              View item information and variants
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-400 transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3 font-inter">
              Variants
            </h3>
            {item.variants && item.variants.length > 0 ? (
              <div className="space-y-2">
                {item.variants.map((variant, index) => (
                  <div
                    key={index}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-900 font-inter">
                          {variant.name}
                        </p>
                        <p className="text-xs text-gray-500 font-inter mt-0.5">
                          SKU: {variant.sku || "N/A"}
                        </p>
                        <p className="text-xs text-gray-500 font-inter mt-0.5">
                          {Object.entries(variant.attributes || {})
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(", ")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900 font-inter">
                          {formatCurrency(variant.sellingPrice)}
                        </p>
                        <p className="text-xs text-gray-500 font-inter mt-0.5">
                          Stock: {variant.stock}
                        </p>
                        <span
                          className={`inline-flex mt-1 px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold border ${variant.isActive ? "bg-green-50 text-green-700 border-green-100" : "bg-gray-50 text-gray-600 border-gray-200"}`}
                        >
                          {variant.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <p className="text-sm text-gray-500 font-inter">
                  No variants configured
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 font-inter">
                  Type
                </label>
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold uppercase ${
                    item.type === "product"
                      ? "bg-blue-50 text-blue-700 border border-blue-100"
                      : "bg-purple-50 text-purple-700 border border-purple-100"
                  }`}
                >
                  {item.type}
                </span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 font-inter">
                  Status
                </label>
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold uppercase ${
                    item.isActive
                      ? "bg-green-50 text-green-700 border border-green-100"
                      : "bg-red-50 text-red-700 border border-red-100"
                  }`}
                >
                  {item.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 font-inter">
                Item Name
              </label>
              <p className="text-sm text-gray-900 font-inter font-medium bg-gray-50 p-2 rounded-lg border border-gray-100">
                {item.name}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 font-inter">
                Description
              </label>
              {item.description ? (
                <div
                  className="ql-editor p-3 bg-gray-50 rounded-lg text-sm text-gray-900 font-inter border border-gray-100"
                  dangerouslySetInnerHTML={{
                    __html: item.description,
                  }}
                />
              ) : (
                <p className="text-sm text-gray-400 italic">
                  No description provided
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 font-inter">
                  Purchase Price
                </label>
                <div className="text-sm text-gray-900 font-inter font-semibold bg-gray-50 p-2 rounded-lg border border-gray-100">
                  {formatCurrency(item.purchasePrice)}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 font-inter">
                  Selling Price
                </label>
                <div className="text-sm text-gray-900 font-inter font-semibold bg-gray-50 p-2 rounded-lg border border-gray-100">
                  {formatCurrency(item.sellingPrice)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 font-inter">
                  Tax Inclusive
                </label>
                <p className="text-sm text-gray-900 font-inter">
                  {item.taxInclusive ? "Yes" : "No"}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 font-inter">
                  HSN/SAC
                </label>
                <p className="text-sm text-gray-900 font-inter">
                  {item.hsnSac || "N/A"}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 font-inter">
                  Category
                </label>
                <p className="text-sm text-gray-900 font-inter">
                  {item.category || "N/A"}
                </p>
              </div>
            </div>

            {imagePreviews.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 font-inter">
                  Images
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {imagePreviews.map((preview, index) => (
                    <img
                      key={index}
                      src={preview}
                      alt={`Image ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg border border-gray-200"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function ProductsServices() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    type: "product",
    name: "",
    description: "",
    purchasePrice: 0,
    sellingPrice: 0,
    taxInclusive: true,
    hsnSac: "",
    barcode: "",
    category: "",
    primaryUnit: "OTH-OTHERS",
    images: [],
    isActive: true,
    variants: [],
  });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(null);
  const dropdownRef = useRef(null);
  const [showImport, setShowImport] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Selection Mode
  const [selectionMode, setSelectionMode] = useState(false);

  // Video Tutorial
  const [showVideoTutorial, setShowVideoTutorial] = useState(false);

  // Pagination state
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 0,
    totalCount: 0,
    limit: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Sorting state
  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "desc",
  });

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSelectAll = () => {
    if (selectedItems.length === items.length && items.length > 0) {
      setSelectedItems([]);
      setSelectionMode(false);
    } else {
      setSelectedItems(items.map((i) => i._id));
      setSelectionMode(true);
    }
  };

  const handleSelectItem = (itemId) => {
    setSelectedItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId],
    );
    setSelectionMode(true);
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedItems([]);
    setShowBulkActions(false);
  };

  // Reset to page 1 when search/filter changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
    exitSelectionMode();
  }, [debouncedSearchTerm, filterType]);

  // Fetch data
  useEffect(() => {
    fetchItems();
  }, [
    pagination.currentPage,
    pagination.limit,
    sortConfig,
    debouncedSearchTerm,
    filterType,
  ]);

  const fetchItems = async () => {
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
      if (filterType) {
        params.append("type", filterType);
      }

      const res = await API.get(`/items/pagination?${params.toString()}`);

      if (res.data.items) {
        setItems(res.data.items);
        setPagination((prev) => ({
          ...prev,
          ...res.data.pagination,
        }));
      } else {
        setItems([]);
      }
    } catch (err) {
      toast.error("Failed to load items");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (itemId) => {
    setItemToDelete(itemId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const loadingToast = toast.loading("Deleting item...");
    try {
      await API.delete(`/items/${itemToDelete}`);
      await fetchItems();
      toast.success("Item deleted successfully", { id: loadingToast });
      exitSelectionMode();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete item", {
        id: loadingToast,
      });
    } finally {
      setShowDeleteModal(false);
      setItemToDelete(null);
    }
  };

  const handleBulkDeleteItems = async (itemIds) => {
    setBulkLoading(true);
    try {
      await Promise.all(itemIds.map((id) => API.delete(`/items/${id}`)));
      await fetchItems();
      toast.success(`Successfully deleted ${itemIds.length} items`);
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

  const handleBulkUpdateItems = async ({ field, value, itemIds }) => {
    setBulkLoading(true);
    try {
      await Promise.all(
        itemIds.map((id) => API.put(`/items/${id}`, { [field]: value })),
      );
      await fetchItems();
      toast.success(`Successfully updated ${itemIds.length} items`);
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

  const itemFieldConfig = {
    fields: [
      { key: "isActive", label: "Status", type: "boolean" },
      {
        key: "type",
        label: "Type",
        type: "select",
        options: ["product", "service"],
      },
    ],
  };

  const handleEditItem = (item) => {
    setForm({
      _id: item._id,
      type: item.type || "product",
      name: item.name || "",
      description: item.description || "",
      purchasePrice: item.purchasePrice || 0,
      sellingPrice: item.sellingPrice || 0,
      taxInclusive: item.taxInclusive !== undefined ? item.taxInclusive : true,
      hsnSac: item.hsnSac || "",
      barcode: item.barcode || "",
      category: item.category || "",
      primaryUnit: item.primaryUnit || "OTH-OTHERS",
      images: item.images || [],
      isActive: item.isActive !== undefined ? item.isActive : true,
      variants: item.variants || [],
    });
    setShowForm(true);
  };

  // Sorting
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  };

  const SortableHeader = ({ field, children, className = "" }) => (
    <th
      className={`px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors border border-gray-200 ${className}`}
      onClick={() => handleSort(field)}
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

  // Pagination component
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
            <p className="text-sm text-gray-700 font-inter">
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

  const handlePageChange = (newPage) => {
    if (
      newPage >= 1 &&
      newPage <= pagination.totalPages &&
      newPage !== pagination.currentPage
    ) {
      setPagination((prev) => ({ ...prev, currentPage: newPage }));
      exitSelectionMode();
    }
  };

  const handleLimitChange = (newLimit) => {
    setPagination((prev) => ({ ...prev, limit: newLimit, currentPage: 1 }));
    exitSelectionMode();
  };

  return (
    <>
      <AppToaster />

      <VideoTutorialModal
        isOpen={showVideoTutorial}
        onClose={() => setShowVideoTutorial(false)}
        videoId={getVideoTutorial("products")?.videoId}
        title={getVideoTutorial("products")?.title}
      />

      <BulkActions
        isOpen={showBulkActions}
        onClose={() => setShowBulkActions(false)}
        selectedItems={items.filter((i) => selectedItems.includes(i._id))}
        onBulkUpdate={handleBulkUpdateItems}
        onBulkDelete={handleBulkDeleteItems}
        fieldConfig={itemFieldConfig}
        module="items"
        loading={bulkLoading}
      />

      {showImport && (
        <ImportItems
          onRequestClose={() => setShowImport(false)}
          onSuccess={() => fetchItems()}
        />
      )}

      {showDetails && selectedItem && (
        <ViewDetails
          item={selectedItem}
          onRequestClose={() => {
            setShowDetails(false);
            setSelectedItem(null);
          }}
        />
      )}

      <div className="">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold font-sf text-gray-900">
            Products & Services
          </h1>
          <p className="text-sm text-gray-500 font-inter">
            Manage your products and services
          </p>
        </div>

        {/* Toolbar */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 font-inter shadow-sm">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search Items, Variant Names, SKU..."
                className="font-inter w-full pl-10 pr-4 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium text-sm px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                <Upload className="w-4 h-4" />
                Import/Export
              </button>

              <div className="relative">
                <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium text-sm px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap">
                  <Filter className="w-4 h-4" />
                  {filterType
                    ? filterType.charAt(0).toUpperCase() + filterType.slice(1)
                    : "All Types"}
                  <SelectChevron className="w-3 h-3 ml-1" />
                </button>
                <div className="absolute inset-0 opacity-0 cursor-pointer">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full h-full cursor-pointer"
                  >
                    <option value="">All Types</option>
                    <option value="product">Product</option>
                    <option value="service">Service</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => {
                  setForm({
                    type: "product",
                    name: "",
                    description: "",
                    purchasePrice: 0,
                    sellingPrice: 0,
                    taxInclusive: true,
                    hsnSac: "",
                    barcode: "",
                    category: "",
                    primaryUnit: "OTH-OTHERS",
                    images: [],
                    isActive: true,
                    variants: [],
                  });
                  setShowForm(true);
                }}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium font-sf text-sm hover:bg-blue-700 transition shadow-sm whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>
          </div>
        </div>

        {/* Form Modal */}
        {showForm && (
          <ItemForm
            form={form}
            setForm={setForm}
            loading={loading}
            setLoading={setLoading}
            // Add specific error handlers to ItemForm if needed
            fetchItems={fetchItems}
            onRequestClose={() => setShowForm(false)}
            setSuccess={(msg) => toast.success(msg)}
            setError={(msg) => toast.error(msg)}
          />
        )}

        {/* Selection Banner */}
        {selectedItems.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <CheckSquare className="w-5 h-5 text-blue-600" />
              <span className="text-blue-800 font-semibold font-inter">
                {selectedItems.length} item{selectedItems.length > 1 ? "s" : ""}{" "}
                selected
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
                        selectedItems.length === items.length &&
                        items.length > 0
                      }
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <SortableHeader field="name">Item Name</SortableHeader>
                  <SortableHeader field="type">Type</SortableHeader>
                  <SortableHeader field="category">Category</SortableHeader>
                  <SortableHeader field="purchasePrice">
                    Purchase Price
                  </SortableHeader>
                  <SortableHeader field="sellingPrice">
                    Selling Price
                  </SortableHeader>
                  <SortableHeader field="hsnSac">HSN/SAC</SortableHeader>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase border border-gray-200">
                    Variants
                  </th>
                  <SortableHeader field="isActive">Status</SortableHeader>
                  <th className="px-6 py-4 text-center w-20 text-xs font-semibold text-gray-600 uppercase border border-gray-200">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="text-center py-12 border border-gray-200"
                    >
                      <div className="flex flex-col items-center">
                        <img
                          src={logo}
                          alt="Loading"
                          className="animate-spin-slow w-12 h-12"
                        />
                        <p className="mt-3 text-gray-600 font-medium">
                          Loading items...
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="text-center py-12 text-gray-500 border border-gray-200"
                    >
                      <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                      <p className="font-medium">No items found</p>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={item._id}
                      className={`hover:bg-gray-50 transition-colors ${
                        selectedItems.includes(item._id) ? "bg-blue-50" : ""
                      }`}
                    >
                      <td className="px-4 py-4 border border-gray-200">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item._id)}
                          onChange={() => handleSelectItem(item._id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4 border border-gray-200">
                        <div className="font-semibold text-sm text-gray-900">
                          {item.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 border border-gray-200">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${
                            item.type === "product"
                              ? "bg-green-100 text-green-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {item.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 border border-gray-200 text-sm text-gray-700">
                        {item.category || "-"}
                      </td>
                      <td className="px-6 py-4 border border-gray-200 text-sm text-gray-700 font-mono">
                        ₹{item.purchasePrice?.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 border border-gray-200 text-sm text-gray-700 font-mono">
                        ₹{item.sellingPrice?.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 border border-gray-200 text-sm text-gray-700">
                        {item.hsnSac || "-"}
                      </td>
                      <td className="px-6 py-4 border border-gray-200">
                        {item.variants && item.variants.length > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {item.variants.length} Variant
                            {item.variants.length > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">
                            0 Variants
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 border border-gray-200">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            item.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {item.isActive ? "Active" : "In-Active"}
                        </span>
                      </td>
                      <td className="px-6 py-4 border border-gray-200 text-center relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDropdown(
                              showDropdown === item._id ? null : item._id,
                            );
                          }}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {showDropdown === item._id && (
                          <div
                            ref={dropdownRef}
                            className="absolute right-8 top-0 mt-2 flex flex-col w-40 bg-white border border-gray-200 rounded-lg shadow-xl z-50 text-left py-1 overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setSelectedItem(item);
                                setShowDetails(true);
                                setShowDropdown(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                            >
                              <Eye className="w-4 h-4 text-gray-500" /> View
                            </button>
                            <button
                              onClick={() => {
                                handleEditItem(item);
                                setShowDropdown(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                            >
                              <Edit2 className="w-4 h-4 text-gray-500" /> Edit
                            </button>
                            <button
                              onClick={() => {
                                handleDelete(item._id);
                                setShowDropdown(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors border-t border-gray-100"
                            >
                              <Trash2 className="w-4 h-4" /> Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && <PaginationControls />}
        </div>
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
                Delete Item
              </h2>
            </div>
            <p className="text-gray-600 mb-6 font-inter">
              Are you sure you want to delete this item? This action cannot be
              undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setItemToDelete(null);
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
    </>
  );
}

export default ProductsServices;
