import React, { useState, useEffect } from "react";
import API from "../services/api";

function Invoices() {
  const [dealId, setDealId] = useState("");
  const [amount, setAmount] = useState("");
  const [deals, setDeals] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [permission, setPermission] = useState("");

  useEffect(() => {
    fetchData();
    fetchPermission();
  }, []);

  const fetchPermission = async () => {
    try {
      const res = await API.get("/auth/me");
      const user = res.data.user;
      const invoicePerm = user?.permissions?.find(
        (p) => p.name.toLowerCase() === "invoices"
      );
      setPermission(invoicePerm?.permission || "no");
    } catch (err) {
      console.error("Failed to fetch invoice permission", err);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");
      const [dealsRes, invoicesRes] = await Promise.all([
        API.get("/deals"),
        API.get("/invoices"),
      ]);
      setDeals(dealsRes.data);
      setInvoices(invoicesRes.data);
    } catch (err) {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const createInvoice = async () => {
    if (permission !== "read-write") {
      setError("You do not have permission to create invoices.");
      return;
    }
    if (!dealId || !amount) {
      setError("Please select a deal and enter an amount");
      return;
    }

    if (parseFloat(amount) <= 0) {
      setError("Amount must be greater than 0");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await API.post("/invoices", {
        deal: dealId,
        amount: parseFloat(amount),
        date: new Date(),
      });
      setDealId("");
      setAmount("");
      await fetchData();
      setSuccess("Invoice created successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      if (err.response?.status === 402) {
        setError(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        setError(err.response?.data?.error || "Failed to create invoice");
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteInvoice = async (invoiceId) => {
    if (permission !== "read-write") {
      setError("You do not have permission to delete invoices.");
      return;
    }
    if (
      !window.confirm(
        "Are you sure you want to delete this invoice? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      await API.delete(`/invoices/${invoiceId}`);
      setInvoices(invoices.filter((inv) => inv._id !== invoiceId));
      setSuccess("Invoice deleted successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      if (err.response?.status === 402) {
        setError(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        setError(err.response?.data?.error || "Failed to delete invoice");
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async (id) => {
    if (permission === "no") {
      setError("You do not have permission to download invoices.");
      return;
    }

    try {
      setLoading(true);
      window.open(
        `${import.meta.env.VITE_APP_API_URL}/api/invoices/download/${id}`,
        "_blank"
      );
    } catch (err) {
      setError("Failed to download PDF");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getInvoiceStatus = (invoice) => {
    const today = new Date();
    const invoiceDate = new Date(invoice.date);
    const daysDiff = Math.floor((today - invoiceDate) / (1000 * 60 * 60 * 24));

    if (daysDiff <= 30) return "recent";
    if (daysDiff <= 90) return "pending";
    return "overdue";
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "recent":
        return "bg-green-100 text-green-800 border-green-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "overdue":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "recent":
        return "Recent";
      case "pending":
        return "Pending";
      case "overdue":
        return "Overdue";
      default:
        return "Unknown";
    }
  };

  const filteredAndSortedInvoices = invoices
    .filter((invoice) => {
      const matchesSearch =
        invoice.invoiceNumber
          .toString()
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        invoice.amount.toString().includes(searchTerm) ||
        invoice.deal?.title?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter =
        filterStatus === "" || getInvoiceStatus(invoice) === filterStatus;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "date":
          return new Date(b.date) - new Date(a.date);
        case "amount":
          return b.amount - a.amount;
        case "invoiceNumber":
          return (a.invoiceNumber || "").localeCompare(b.invoiceNumber || "");
        default:
          return 0;
      }
    });

  const totalAmount = filteredAndSortedInvoices.reduce(
    (sum, inv) => sum + inv.amount,
    0
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Invoices</h3>
          <p className="text-gray-600">Create and manage your invoices</p>
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="mx-6 mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        )}

        {/* Create Invoice Form */}
        {permission === "read-write" && (
          <div className="p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              Create New Invoice
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Deal <span className="text-red-500">*</span>
                </label>
                <select
                  value={dealId}
                  onChange={(e) => setDealId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                >
                  <option value="">Choose a deal...</option>
                  {deals.map((deal) => (
                    <option key={deal._id} value={deal._id}>
                      {deal.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter amount"
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={createInvoice}
                  disabled={loading || !dealId || !amount}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Creating..." : "Create Invoice"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search, Filter, and Sort */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Invoices
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gradient-to-r from-white to-blue-100 border border-[#E0E0E1] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Search by invoice number, amount, or deal..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="recent">Recent</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort by
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="date">Date (Newest First)</option>
              <option value="amount">Amount (Highest First)</option>
              <option value="invoiceNumber">Invoice Number</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                Total Invoices
              </p>
              <p className="text-xl font-semibold text-gray-900">
                {filteredAndSortedInvoices.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg
                className="h-6 w-6 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Amount</p>
              <h6 className="text-xl font-semibold text-gray-900">
                {formatCurrency(totalAmount)}
              </h6>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <svg
                className="h-6 w-6 text-yellow-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                Average Amount
              </p>
              <h6 className="text-xl font-semibold text-gray-900">
                {filteredAndSortedInvoices.length > 0
                  ? formatCurrency(
                    totalAmount / filteredAndSortedInvoices.length
                  )
                  : formatCurrency(0)}
              </h6>
            </div>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900">
            Invoice History ({filteredAndSortedInvoices.length})
          </h4>
        </div>

        {loading && (
          <div className="p-6 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            <p className="mt-2 text-gray-600">Loading invoices...</p>
          </div>
        )}

        {!loading && filteredAndSortedInvoices.length === 0 && (
          <div className="p-6 text-center text-gray-500">
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p>No invoices found matching your criteria.</p>
          </div>
        )}

        {!loading && filteredAndSortedInvoices.length > 0 && (
          <div className="divide-y divide-gray-200">
            {filteredAndSortedInvoices.map((invoice) => {
              const status = getInvoiceStatus(invoice);
              return (
                <div
                  key={invoice._id}
                  className="p-4 sm:p-6 hover:bg-gray-50 transition-colors"
                >
                  {/* Desktop Layout */}
                  <div className="hidden sm:flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h5 className="text-lg font-semibold text-gray-900">
                          Invoice #{invoice.invoiceNumber || "N/A"}
                        </h5>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(
                            status
                          )}`}
                        >
                          {getStatusLabel(status)}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Amount</p>
                          <h6 className="font-medium text-lg text-green-600">
                            {formatCurrency(invoice.amount)}
                          </h6>
                        </div>
                        <div>
                          <p className="text-gray-600">Deal</p>
                          <p className="font-medium">
                            {invoice.deal?.title || "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Date</p>
                          <p className="font-medium">
                            {formatDate(invoice.date)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-6">
                      <button
                        onClick={() => downloadPDF(invoice._id)}
                        disabled={loading || permission === "no"}
                        className={`px-3 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 ${permission === "no"
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                          }`}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <span>Download</span>
                      </button>
                      {permission === "read-write" && (
                        <button
                          onClick={() => deleteInvoice(invoice._id)}
                          disabled={loading}
                          className="px-3 py-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mobile Layout */}
                  <div className="sm:hidden space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h5 className="text-base font-semibold text-gray-900 truncate">
                          Invoice #{invoice.invoiceNumber || "N/A"}
                        </h5>
                        <span
                          className={`inline-block mt-1 px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(
                            status
                          )}`}
                        >
                          {getStatusLabel(status)}
                        </span>
                      </div>
                      <div className="flex-shrink-0 ml-2">
                        <h6 className="text-lg font-bold text-green-600">
                          {formatCurrency(invoice.amount)}
                        </h6>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Deal:</span>
                        <span className="font-medium truncate ml-2">
                          {invoice.deal?.title || "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Date:</span>
                        <span className="font-medium">
                          {formatDate(invoice.date)}
                        </span>
                      </div>
                    </div>

                    <div className="flex space-x-2 pt-2">
                      <button
                        onClick={() => downloadPDF(invoice._id)}
                        disabled={loading}
                        className="flex-1 px-3 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1 border border-blue-200"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <span>Download</span>
                      </button>
                      {permission === "read-write" && (
                        <button
                          onClick={() => deleteInvoice(invoice._id)}
                          disabled={loading}
                          className="flex-1 px-3 py-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1 border border-red-200"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Invoices;
