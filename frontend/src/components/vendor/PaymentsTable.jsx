import React, { useState, useEffect, useMemo } from "react";
import API from "../../services/api";
import { useParams } from "react-router-dom";
import { autoTable } from "jspdf-autotable";
import {
  Edit,
  Trash2,
  Eye,
  Calendar,
  ArrowUpCircle,
  ArrowDownCircle,
  Download,
  X,
  Filter,
  EyeOff,
  RefreshCw,
  User,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
} from "lucide-react";
import VendorForm from "../vendor/VendorForm";
import VendorPaymentForm from "../vendor/VendorPaymentForm";
import PaymentPreview from "../vendor/venerPaymentPreview";
import DataTable from "../common/DataTable";
import BulkActionBar from "../common/BulkActionBar";
import TablePaginationFooter from "../common/TablePaginationFooter";
import CompanyFilterPanel from "../company/CompanyFilterPanel";
import FilterIcon from "../common/FilterIcon";
import { useBulkSelection, useBulkStrip } from "../../hooks/useBulkSelection";
import { useTopLoadingSignal } from "../common/TopLoadingBar";
import { Search } from "lucide-react";
import toast from "react-hot-toast";
import AppToaster from "../AppToaster";

/* `options` seeds each dropdown with the schema's full enum (models/Payment.js)
   so a value stays filterable even when no current row uses it. */
const PAYMENT_FILTER_COLUMNS = [
  { key: "direction", label: "Direction", options: ["IN", "OUT"] },
  { key: "paymentType", label: "Mode", options: ["Card", "Cash", "Cheque", "EMI", "Net Banking", "UPI"] },
  { key: "bank", label: "Bank" },
];

const getPaymentFieldValue = (payment, key) => payment[key];

const PaymentsTable = ({ payments, vendor }) => {
  const { id } = useParams();
  const [localPayments, setLocalPayments] = useState(payments || []);
  const [showForm, setShowForm] = useState(false);
  const [formDirection, setFormDirection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [_error, setError] = useState("");
  const [_success, setSuccess] = useState("");
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [vendorFields, setVendorFields] = useState([]);
  const [additionalFieldValues, setAdditionalFieldValues] = useState({});
  const [showKPIs, setShowKPIs] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedFilters, setSelectedFilters] = useState({});
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [columnSizing, setColumnSizing] = useState({});
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setLocalPayments(payments || []);
  }, [JSON.stringify(payments)]);

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
    }
  };

  const handleViewReceipt = (payment) => {
    setReceiptPayment(payment);
    setShowReceiptModal(true);
  };

  const filteredPayments = useMemo(() => {
    let rows = localPayments;

    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter((p) =>
        [p.direction, p.paymentType, p.bank, p.reference, p.notes, String(p.amount), p._id]
          .some((v) => String(v || "").toLowerCase().includes(term)),
      );
    }

    Object.entries(selectedFilters).forEach(([key, values]) => {
      if (!values?.length) return;
      rows = rows.filter((p) => values.includes(String(getPaymentFieldValue(p, key) ?? "")));
    });

    return rows;
  }, [localPayments, search, selectedFilters]);

  const activeFilterCount = Object.values(selectedFilters).reduce(
    (n, arr) => n + (arr?.length || 0),
    0,
  );

  /* ── Pagination — same client-side "first ... current ... last" pattern
     CompanyInvoicesTab uses. Search/filters reset back to page 1. */
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  useEffect(() => {
    setPage(1);
  }, [search, selectedFilters]);
  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / limit));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  // Brief top-edge progress flash on page change — same visual language as
  // Companies.jsx's server-paginated list, even though this data is already
  // in memory (client-side slice) rather than a fresh network round trip.
  const [isPaging, setIsPaging] = useState(false);
  useTopLoadingSignal(isPaging);
  const goToPage = (n) => {
    if (n === page) return;
    setIsPaging(true);
    setPage(n);
    setTimeout(() => setIsPaging(false), 220);
  };
  const paginatedPayments = useMemo(
    () => filteredPayments.slice((page - 1) * limit, page * limit),
    [filteredPayments, page, limit],
  );

  const { selectedItems, toggleItem, clearSelection, selectAll } = useBulkSelection({
    items: filteredPayments,
  });
  const { visible: stripVisible, closing: stripClosing } = useBulkStrip(selectedItems.length);

  const handleBulkDelete = async () => {
    if (!selectedItems.length) return;
    if (!window.confirm(`Delete ${selectedItems.length} payment(s)? This cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      await Promise.all(selectedItems.map((pid) => API.delete(`/vendors/${id}/payments/${pid}`)));
      setLocalPayments((prev) => prev.filter((p) => !selectedItems.includes(p._id)));
      clearSelection();
      toast.success("Payments deleted!");
    } catch (err) {
      console.error("Bulk delete failed:", err);
      toast.error(err.response?.data?.error || "Failed to delete some payments.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddPayment = async (payload) => {
    try {
      setLoading(true);
      const res = await API.post(`/vendors/${id}/payments`, payload);
      setLocalPayments([...localPayments, res.data]);
      toast.success("Payment added!");
      setError("");
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to add payment");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForm = (direction) => {
    setFormDirection(direction);
    setSelectedPayment(null);
    setShowForm(true);
    setError("");
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setFormDirection(null);
    setSelectedPayment(null);
    setError("");
  };

  const handleViewPDF = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(`Payments for ${vendor.name}`, 10, 10);

    const tableData = filteredPayments.map((payment) => [
      `${payment.direction === "OUT" ? "PAYOUT" : "PAYIN"}-${payment._id.slice(-4)}`,
      `${new Date(payment.paymentDate).toLocaleDateString()} ${new Date(payment.paymentDate).toLocaleTimeString()}`,
      payment.direction === "OUT" ? "Payment Out" : "Payment In",
      payment.paymentType || "UPI",
      `₹${payment.amount.toFixed(2)}`,
      `₹${payment.amount.toFixed(2)}`,
    ]);

    const tableHeaders = ["ID", "Date / Time", "Status", "Mode", "Amount", "Balance"];

    autoTable(doc, {
      head: [tableHeaders],
      body: tableData,
      startY: 20,
    });

    doc.save(`${vendor.name}_payments.pdf`);
  };

  const handleEditClick = () => {
    setSelectedVendor({
      _id: vendor._id,
      name: vendor.name || "",
      phone: vendor.phone || "",
      email: vendor.email || "",
      company: vendor.company || "",
      gstin: vendor.gstin || "",
      address: {
        line1: vendor.address?.line1 || "",
        line2: vendor.address?.line2 || "",
        city: vendor.address?.city || "",
        state: vendor.address?.state || "",
        pincode: vendor.address?.pincode || "",
        country: vendor.address?.country || "India",
      },
      avatar: vendor.avatar || "",
      balance: vendor.balance || 0,
      additionalFields: vendor.additionalFields || [],
    });
    setAdditionalFieldValues(
      vendor.additionalFields?.reduce(
        (acc, { key, value }) => ({ ...acc, [key]: value }),
        {}
      ) || {}
    );
    setShowUpdateModal(true);
  };

  const handleEditPayment = (payment) => {
    setSelectedPayment(payment);
    setFormDirection(payment.direction);
    setShowForm(true);
  };

  const handlePaymentUpdateSuccess = (updatedPayment) => {
    setLocalPayments(
      localPayments.map((payment) =>
        payment._id === updatedPayment._id ? updatedPayment : payment
      )
    );
    toast.success("Payment updated!");
    setError("");
  };

  const handlePaymentDeleteSuccess = (deletedPaymentId) => {
    setLocalPayments(localPayments.filter((payment) => payment._id !== deletedPaymentId));
    toast.success("Payment deleted!");
    setError("");
  };

  const handleQuickDeletePayment = async (payment) => {
    if (window.confirm('Delete this payment?')) {
      try {
        setLoading(true);
        await API.delete(`/vendors/${id}/payments/${payment._id}`);
        setLocalPayments(localPayments.filter((p) => p._id !== payment._id));
        toast.success("Payment deleted!");
      } catch (err) {
        if (err.response?.status === 402) {
          toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
        } else {
          toast.error(err.response?.data?.error || "Failed to delete payment");
        }
      } finally {
        setLoading(false);
      }
    }
  };

  // Calculate statistics
  const stats = {
    totalPaymentsIn: filteredPayments.filter((p) => p.direction === "IN").length,
    totalPaymentsOut: filteredPayments.filter((p) => p.direction === "OUT").length,
    totalAmountIn: filteredPayments
      .filter((p) => p.direction === "IN")
      .reduce((sum, p) => sum + p.amount, 0),
    totalAmountOut: filteredPayments
      .filter((p) => p.direction === "OUT")
      .reduce((sum, p) => sum + p.amount, 0),
  };

  const netBalance = stats.totalAmountIn - stats.totalAmountOut;

  /* ── Columns ──
     `bank` and `reference` are surfaced here for the first time; they were
     stored on the Payment but only ever visible inside the receipt preview. */
  const columns = useMemo(
    () => [
      {
        id: "selection",
        size: 44,
        enableResizing: false,
        header: () => (
          <div className="flex justify-center items-center w-full">
            <input
              type="checkbox"
              checked={
                paginatedPayments.length > 0 &&
                paginatedPayments.every((p) => selectedItems.includes(p._id))
              }
              onChange={(e) => (e.target.checked ? selectAll(paginatedPayments) : clearSelection())}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex justify-center items-center w-full">
            <input
              type="checkbox"
              checked={selectedItems.includes(row.original._id)}
              onChange={() => toggleItem(row.original._id)}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        ),
      },
      {
        id: "reference_id",
        size: 110,
        header: "ID",
        cell: ({ row }) => (
          <span className="text-xs font-mono font-medium text-gray-900">
            {row.original.direction === "OUT" ? "OUT" : "IN"}-
            {row.original._id.slice(-4).toUpperCase()}
          </span>
        ),
      },
      {
        id: "paymentDate",
        size: 150,
        header: "Date / Time",
        cell: ({ row }) => (
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-medium text-gray-900">
              {new Date(row.original.paymentDate).toLocaleDateString()}
            </span>
            <span className="text-xs text-gray-500">
              {new Date(row.original.paymentDate).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        ),
      },
      {
        id: "direction",
        size: 110,
        header: "Status",
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
              row.original.direction === "OUT"
                ? "bg-blue-100 text-blue-800"
                : "bg-blue-600 text-white"
            }`}
          >
            {row.original.direction === "OUT" ? (
              <ArrowUpCircle className="w-3 h-3" />
            ) : (
              <ArrowDownCircle className="w-3 h-3" />
            )}
            {row.original.direction === "OUT" ? "Out" : "In"}
          </span>
        ),
      },
      {
        id: "paymentType",
        size: 130,
        header: "Mode",
        cell: ({ row }) => (
          <span className="text-sm text-gray-700">{row.original.paymentType || "—"}</span>
        ),
      },
      {
        id: "bank",
        size: 120,
        header: "Bank",
        cell: ({ row }) => (
          <span className="text-sm text-gray-700">{row.original.bank || "—"}</span>
        ),
      },
      {
        id: "reference",
        size: 170,
        header: "Reference",
        cell: ({ row }) => (
          <span className="text-sm text-gray-700 truncate block" title={row.original.reference}>
            {row.original.reference || "—"}
          </span>
        ),
      },
      {
        id: "amount",
        size: 140,
        header: "Amount",
        cell: ({ row }) => (
          <span
            className={`text-sm font-bold ${
              row.original.direction === "OUT" ? "text-red-600" : "text-green-600"
            }`}
          >
            {row.original.direction === "OUT" ? "−" : "+"} ₹{row.original.amount.toFixed(2)}
          </span>
        ),
      },
      {
        id: "actions",
        size: 120,
        enableResizing: false,
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEditPayment(row.original);
              }}
              className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleQuickDeletePayment(row.original);
              }}
              className="p-1 text-gray-500 hover:text-red-600 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleViewReceipt(row.original);
              }}
              className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
              title="View receipt"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    [paginatedPayments, selectedItems, selectAll, clearSelection, toggleItem],
  );

  return (
    <div className="space-y-6">
      <AppToaster />

      {/* Action Buttons (Portaled to Tab Header) removed */}

      
      {/* Stats Cards */}
      {showKPIs && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-gray-600" />
              <span className="text-xs font-medium text-gray-600">Total Given</span>
            </div>
            <p className="text-xl font-bold text-gray-900">
              ₹{stats.totalAmountOut.toFixed(2)}
            </p>
            <p className="text-xs text-gray-600 mt-1">Paid to vendor</p>
          </div>

          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-gray-600" />
              <span className="text-xs font-medium text-gray-600">Total Got</span>
            </div>
            <p className="text-xl font-bold text-gray-900">
              ₹{stats.totalAmountIn.toFixed(2)}
            </p>
            <p className="text-xs text-gray-600 mt-1">Received from vendor</p>
          </div>

          <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-gray-600" />
              <span className="text-xs font-medium text-gray-600">Balance</span>
            </div>
            <p
              className={`text-xl font-bold ${
                netBalance >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              <h6>₹{Math.abs(netBalance).toFixed(2)}</h6>
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {netBalance >= 0 ? "You'll receive" : "You owe"}
            </p>
          </div>

          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-gray-600" />
              <span className="text-xs font-medium text-gray-600">Total</span>
            </div>
            <p className="text-xl font-bold text-gray-900">
              {filteredPayments.length}
            </p>
            <p className="text-xs text-gray-600 mt-1">All transactions</p>
          </div>
        </div>
      )}

      {/* Payments table — same chrome as the CompanyProfilePage tabs: bordered
          shell, sticky #F5F7FA header, per-row selection and a bulk strip. */}
      {stripVisible ? (
        <BulkActionBar
          selectedCount={selectedItems.length}
          entityName="payment"
          isClosing={stripClosing}
          onSelectAll={() => selectAll(filteredPayments)}
          onDeselectAll={clearSelection}
          onDelete={handleBulkDelete}
          isDeleting={isDeleting}
        />
      ) : (
        <div className="flex items-center gap-4 mb-4" style={{ height: "44px" }}>
          <div className="relative flex-1 h-full">
            <Search size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-900 opacity-50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search payments..."
              className="w-full h-full pl-10 pr-3.5 border rounded-full text-sm focus:outline-none focus:border-blue-300"
              style={{ borderColor: "rgba(31, 41, 55, 0.1)" }}
            />
          </div>
          <button
            onClick={() => setShowFilterPanel(true)}
            className="relative flex items-center justify-center gap-2 px-3 text-sm font-medium text-gray-800 bg-white border rounded-full hover:bg-gray-50 flex-shrink-0"
            style={{
              height: "44px",
              borderColor: activeFilterCount > 0 ? "#0085FF" : "#E1E4EA",
            }}
          >
            <FilterIcon size={16} />
            Filter
            {activeFilterCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full ring-2 ring-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={() => handleOpenForm("IN")}
            className="flex items-center justify-center gap-2 h-[44px] px-4 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-800 transition-colors flex-shrink-0 shadow-sm"
          >
            <ArrowDownCircle size={18} />
            <span>Got</span>
          </button>
          <button
            onClick={() => handleOpenForm("OUT")}
            className="flex items-center justify-center gap-2 h-[44px] px-4 bg-blue-700 text-white text-sm font-medium rounded-full hover:bg-blue-900 transition-colors flex-shrink-0 shadow-sm"
          >
            <ArrowUpCircle size={18} />
            <span>Gave</span>
          </button>
          <button
            onClick={handleViewPDF}
            className="flex items-center justify-center h-[44px] w-[44px] border border-[#E1E4EA] text-gray-700 rounded-full hover:bg-gray-50 transition-colors flex-shrink-0"
            title="Download PDF"
          >
            <Download size={18} />
          </button>
          <button
            onClick={handleEditClick}
            className="flex items-center justify-center h-[44px] w-[44px] border border-[#E1E4EA] text-gray-700 rounded-full hover:bg-gray-50 transition-colors flex-shrink-0"
            title="Edit Vendor"
          >
            <Edit size={18} />
          </button>
          <button
            onClick={() => setShowKPIs(!showKPIs)}
            className="flex items-center justify-center h-[44px] w-[44px] border border-[#E1E4EA] text-gray-700 rounded-full hover:bg-gray-50 transition-colors flex-shrink-0"
            title={showKPIs ? "Hide KPIs" : "Show KPIs"}
          >
            {showKPIs ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      )}

      <div className="bg-white border border-[#E1E4EA] rounded-xl shadow-[0px_2px_4px_rgba(28,27,31,0.04)] overflow-hidden">
        <DataTable
          data={paginatedPayments}
          columns={columns}
          loading={loading}
          columnSizing={columnSizing}
          onColumnSizingChange={setColumnSizing}
          variant="card"
          rowClassName={(p) => (selectedItems.includes(p._id) ? "!bg-blue-50" : "")}
          emptyContent={
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                <CreditCard className="w-8 h-8 text-gray-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-1">No Payments Found</h3>
                <p className="text-sm text-gray-600">
                  {search || activeFilterCount
                    ? "Try clearing the search or filters."
                    : "Add your first payment to get started."}
                </p>
              </div>
              {!search && !activeFilterCount && (
                <button
                  onClick={() => handleOpenForm("IN")}
                  className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Add Payment
                </button>
              )}
            </div>
          }
        />
        
        <div className="border-t border-[#E1E4EA] px-5">
          <TablePaginationFooter
            currentPage={page}
            totalPages={totalPages}
            totalCount={filteredPayments.length}
            limit={limit}
            onPageChange={goToPage}
            onLimitChange={(n) => {
              setLimit(n);
              setPage(1);
            }}
          />
        </div>
      </div>

      <CompanyFilterPanel
        isOpen={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        columns={PAYMENT_FILTER_COLUMNS}
        data={localPayments}
        getFieldValue={getPaymentFieldValue}
        selected={selectedFilters}
        onApply={setSelectedFilters}
      />

      {/* Modals */}
      <VendorPaymentForm
        open={showForm}
        vendorId={id}
        direction={formDirection}
        onSave={handleAddPayment}
        onClose={handleCloseForm}
        paymentToEdit={selectedPayment}
        onUpdateSuccess={handlePaymentUpdateSuccess}
        onDeleteSuccess={handlePaymentDeleteSuccess}
      />

      {showUpdateModal && (
        <VendorForm
          form={selectedVendor}
          setForm={(updatedForm) => setSelectedVendor(updatedForm)}
          additionalFieldValues={additionalFieldValues}
          setAdditionalFieldValues={setAdditionalFieldValues}
          vendorFields={vendorFields}
          loading={loading}
          setLoading={setLoading}
          setError={setError}
          setSuccess={setSuccess}
          fetchVendors={() => {}}
          onRequestClose={() => {
            setShowUpdateModal(false);
            setSelectedVendor(null);
            setAdditionalFieldValues({});
          }}
        />
      )}

      {showReceiptModal && (
        <PaymentPreview
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          payment={receiptPayment}
          vendor={vendor}
        />
      )}
    </div>
  );
};

export default PaymentsTable;
