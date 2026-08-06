import React, { useState, useEffect, useMemo } from "react";
import API from "../../services/api";
import { useParams } from "react-router-dom";
import { createPortal } from "react-dom";
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
import CompanyFilterPanel from "../company/CompanyFilterPanel";
import FilterIcon from "../common/FilterIcon";
import { useBulkSelection, useBulkStrip } from "../../hooks/useBulkSelection";
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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [vendorFields, setVendorFields] = useState([]);
  const [additionalFieldValues, setAdditionalFieldValues] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [showKPIs, setShowKPIs] = useState(true);
  const [portalTarget, setPortalTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedFilters, setSelectedFilters] = useState({});
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [columnSizing, setColumnSizing] = useState({});
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setPortalTarget(document.getElementById("tab-actions-portal"));
  }, []);

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
    let rows = localPayments.filter((payment) => {
      const paymentDate = new Date(payment.paymentDate);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      return (!start || paymentDate >= start) && (!end || paymentDate <= end);
    });

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
  }, [localPayments, startDate, endDate, search, selectedFilters]);

  const activeFilterCount = Object.values(selectedFilters).reduce(
    (n, arr) => n + (arr?.length || 0),
    0,
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

  const handleUpdateSuccess = () => {
    setShowUpdateModal(false);
    setSelectedVendor(null);
    toast.success("Vendor updated!");
    setError("");
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

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
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

  return (
    <div className="space-y-6">
      <AppToaster />

      {/* Action Buttons (Portaled to Tab Header) */}
      {portalTarget && createPortal(
        <>
          <button
            onClick={() => handleOpenForm("IN")}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-800 transition-colors"
          >
            <ArrowDownCircle className="w-4 h-4" />
            <span>Got</span>
          </button>
          <button
            onClick={() => handleOpenForm("OUT")}
            className="flex items-center gap-2 px-3 py-2 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-900 transition-colors"
          >
            <ArrowUpCircle className="w-4 h-4" />
            <span>Gave</span>
          </button>
          <button
            onClick={handleViewPDF}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={handleEditClick}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            title="Edit Vendor"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowKPIs(!showKPIs)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            title={showKPIs ? "Hide KPIs" : "Show KPIs"}
          >
            {showKPIs ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </>,
        portalTarget
      )}
      
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
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <CreditCard className="w-4 h-4" />
          <span>{filteredPayments.length} payments</span>
        </div>
      )}

      <DataTable
        data={filteredPayments}
        columns={columns}
        columnSizing={columnSizing}
        onColumnSizingChange={setColumnSizing}
        variant="card"
        maxHeight={560}
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
