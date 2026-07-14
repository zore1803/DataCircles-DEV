import { useEffect, useState } from "react";
import {
  Search,
  FileText,
  X,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import API from "../services/api";
import PerformaInvoiceForm from "../components/PerformaInvoice/PerformaInvoiceForm";
import PerformaInvoiceStylePreview from "../components/PerformaInvoice/PerformaInvoiceStylePreview";
import toast, { Toaster } from "react-hot-toast";

const statusOptions = ["Draft", "Sent", "Paid", "Overdue", "Void"];

// Shimmer component for loading state
const Shimmer = () => (
  <div className="animate-pulse">
    <div className="md:flex flex-row justify-between items-center mb-6">
      <div className="h-8 bg-gray-200 rounded w-1/4 mb-4 md:mb-0"></div>
      <div className="h-10 bg-gray-200 rounded w-40"></div>
    </div>
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="h-10 bg-gray-200 rounded w-full md:flex-1"></div>
        <div className="h-10 bg-gray-200 rounded w-full md:w-60"></div>
      </div>
    </div>
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </th>
              <th className="px-6 py-3">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </th>
              <th className="px-6 py-3">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </th>
              <th className="px-6 py-3">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </th>
              <th className="px-6 py-3">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </th>
              <th className="px-6 py-3">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </th>
              <th className="px-6 py-3">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </th>
              <th className="px-6 py-3">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {[...Array(5)].map((_, index) => (
              <tr key={index}>
                <td className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
        <div className="h-4 bg-gray-200 rounded w-48"></div>
        <div className="flex items-center space-x-1">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="h-8 bg-gray-200 rounded w-8"></div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const PerformaInvoiceManager = () => {
  const [performaInvoices, setPerformaInvoices] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPerformaInvoice, setEditingPerformaInvoice] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewStyle, setPreviewStyle] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [debouncedFilterStatus, setDebouncedFilterStatus] = useState("");

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
    key: "performaInvoiceNumber",
    direction: "asc",
  });

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Debounce filter status
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilterStatus(filterStatus);
    }, 300);
    return () => clearTimeout(timer);
  }, [filterStatus]);

  // Reset to page 1 when search/filter changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  }, [debouncedSearchTerm, debouncedFilterStatus]);

  // Fetch data when dependencies change
  useEffect(() => {
    fetchData();
  }, [pagination.currentPage, pagination.limit, sortConfig]);

  // Separate effect for search/filter to trigger reset + fetch
  useEffect(() => {
    if (pagination.currentPage === 1) {
      fetchData();
    }
  }, [debouncedSearchTerm, debouncedFilterStatus]);

  useEffect(() => {
    fetchDeals();
  }, []);

  // Fetch Deals
  const fetchDeals = async () => {
    try {
      const res = await API.get("/deals");
      setDeals(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load deals");
    }
  };

  // Fetch proformaInvoices with Pagination
  const fetchData = async () => {
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
      if (debouncedFilterStatus) {
        params.append("status", debouncedFilterStatus);
      }

      const res = await API.get(
        `/performa-invoices/pagination?${params.toString()}`
      );

      if (res.data.performaInvoices && res.data.pagination) {
        setPerformaInvoices(res.data.performaInvoices);
        setPagination((prev) => ({
          ...prev,
          currentPage: res.data.pagination.currentPage,
          totalPages: res.data.pagination.totalPages,
          totalCount: res.data.pagination.totalCount,
          hasNextPage: res.data.pagination.hasNextPage,
          hasPrevPage: res.data.pagination.hasPrevPage,
        }));
      } else {
        setPerformaInvoices(res.data || []);
      }
    } catch (err) {
      toast.error(
        err.response?.data?.error || "Failed to load proformainvoices"
      );
      setPerformaInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  // Pagination handlers
  const handlePageChange = (newPage) => {
    if (
      newPage >= 1 &&
      newPage <= pagination.totalPages &&
      newPage !== pagination.currentPage
    ) {
      setPagination((prev) => ({ ...prev, currentPage: newPage }));
    }
  };

  const handleLimitChange = (newLimit) => {
    setPagination((prev) => ({
      ...prev,
      limit: newLimit,
      currentPage: 1,
    }));
  };

  // Sorting function
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  };

  // Component for sortable column header
  const SortableHeader = ({ field, children, className = "" }) => (
    <th
      className={`px-6 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
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
        (item, index, arr) => index === 0 || arr[index - 1] !== item
      );
    };

    return (
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
        <div className="flex-1 flex justify-between sm:hidden">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={!hasPrevPage}
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={!hasNextPage}
            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>

        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center space-x-2">
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{startItem}</span> to{" "}
              <span className="font-medium">{endItem}</span> of{" "}
              <span className="font-medium">{totalCount}</span> results
            </p>
            <select
              value={limit}
              onChange={(e) => handleLimitChange(parseInt(e.target.value))}
              className="ml-2 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            {totalPages > 0 &&
              getPageNumbers().map((pageNum, index) =>
                pageNum === "..." ? (
                  <span
                    key={`dots-${index}`}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={`page-${pageNum}`}
                    onClick={() => handlePageChange(pageNum)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      pageNum === currentPage
                        ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                        : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              )}

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!hasNextPage}
              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleEditPerformaInvoice = (performaInvoice) => {
    setEditingPerformaInvoice({
      ...performaInvoice,
      items: performaInvoice.items.map((item) => ({
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
      date: performaInvoice.date ? performaInvoice.date.slice(0, 10) : "",
      dueDate: performaInvoice.dueDate
        ? performaInvoice.dueDate.slice(0, 10)
        : "",
      receiverGSTIN: performaInvoice.receiverGSTIN || "",
      discount: performaInvoice.discount || { type: "fixed", value: 0 },
    });
    setShowForm(true);
  };

  const handleDeletePerformaInvoice = async (id) => {
    if (
      !window.confirm("Are you sure you want to delete this proformainvoice?")
    )
      return;
    try {
      setLoading(true);
      await API.delete(`/performa-invoices/${id}`);
      await fetchData();
      toast.success("proformaInvoice deleted successfully");
    } catch (err) {
      toast.error(
        err.response?.data?.error || "Failed to delete proformainvoice"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (id) => {
    try {
      setLoading(true);
      const response = await API.get(`/performa-invoices/download/${id}`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `performa-invoice-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("proformaInvoice downloaded successfully");
    } catch (error) {
      toast.error("Failed to download proformainvoice");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      setLoading(true);
      await API.put(`/performa-invoices/status/${id}`, { status: newStatus });
      await fetchData();
      toast.success("proformaInvoice status updated successfully");
    } catch (err) {
      toast.error(
        err.response?.data?.error || "Failed to update proformainvoice status"
      );
    } finally {
      setLoading(false);
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
      case "overdue":
        return "bg-red-100 text-red-800 border-red-200";
      case "void":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (loading && performaInvoices.length === 0) {
    return (
      <>
        <Toaster position="top-right" toastOptions={{ duration: 5000 }} />
        <Shimmer />
      </>
    );
  }

  return (
    <>
      <Toaster position="top-right" toastOptions={{ duration: 5000 }} />
      <div className="">
        {/* Header */}
        <div className="md:flex flex-row justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4 md:mb-0">
            proformaInvoices
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditingPerformaInvoice(null);
                setShowForm(true);
              }}
              className="bg-gray-200 text-black px-4 py-2 rounded-lg font-medium text-sm hover:bg-gray-300 transition cursor-pointer"
            >
              Add proformaInvoice
            </button>
          </div>
        </div>

        {/* proformaInvoice Form */}
        {showForm && (
          <PerformaInvoiceForm
            deals={deals}
            isOpen={showForm}
            onClose={() => {
              setShowForm(false);
              setEditingPerformaInvoice(null);
            }}
            fetchData={fetchData}
            editingPerformaInvoice={editingPerformaInvoice}
            onPreview={(formData) => {
              if (!formData.style) {
                toast.error(
                  "Please select a proformainvoice style to preview."
                );
                return;
              }
              setPreviewStyle(formData.style);
              setShowPreview(true);
            }}
          />
        )}

        {/* Main Content Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Search & Filter */}
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative w-full md:flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search proformainvoices by number, deal name, or receiver GSTIN..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-200 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full md:w-60 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent cursor-pointer"
              >
                <option value="">All Statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* proformaInvoices Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader field="performaInvoiceNumber">
                    proformaInvoice Number
                  </SortableHeader>
                  <SortableHeader field="deal.title">Deal</SortableHeader>
                  <SortableHeader field="receiverGSTIN">
                    Receiver GSTIN
                  </SortableHeader>
                  <SortableHeader field="date">Issue Date</SortableHeader>
                  <SortableHeader field="dueDate">Due Date</SortableHeader>
                  <SortableHeader field="amount">Amount</SortableHeader>
                  <SortableHeader field="status">Status</SortableHeader>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading && performaInvoices.length === 0 && (
                  <tr>
                    <td colSpan="8" className="px-6 py-4 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p className="mt-2 text-gray-600">
                        Loading proformainvoices...
                      </p>
                    </td>
                  </tr>
                )}
                {!loading && performaInvoices.length === 0 && (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      No proformainvoices found matching your criteria.
                    </td>
                  </tr>
                )}
                {performaInvoices.map((inv) => (
                  <tr key={inv?._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      #{inv.performaInvoiceNumber || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {inv.deal?.title || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {inv.receiverGSTIN || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {inv.date
                        ? new Date(inv.date).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {inv.dueDate
                        ? new Date(inv.dueDate).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <h6>₹{inv.amount?.toFixed(2) || "0.00"}</h6>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={inv?.status}
                        onChange={(e) =>
                          handleStatusChange(inv._id, e.target.value)
                        }
                        className={`px-3 py-1.5 border rounded-lg text-xs font-semibold ${getStatusBadgeColor(
                          inv.status
                        )} focus:outline-none focus:ring-2 focus:ring-blue-500/30`}
                      >
                        {statusOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-4">
                        <button
                          onClick={() => handleEditPerformaInvoice(inv)}
                          className="text-blue-600 hover:underline cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDownload(inv._id)}
                          className="text-blue-600 hover:underline cursor-pointer"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => handleDeletePerformaInvoice(inv._id)}
                          className="text-red-600 hover:underline cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && <PaginationControls />}

          {showPreview && (
            <PerformaInvoiceStylePreview
              style={previewStyle}
              isOpen={showPreview}
              onClose={() => {
                setShowPreview(false);
                setPreviewStyle(null);
              }}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default PerformaInvoiceManager;
