import React, { useState, useEffect } from "react";
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
import toast from "react-hot-toast";
import AppToaster from "../AppToaster";

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

  const filteredPayments = localPayments.filter((payment) => {
    const paymentDate = new Date(payment.paymentDate);
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    return (!start || paymentDate >= start) && (!end || paymentDate <= end);
  });

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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-gray-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">{vendor.name}</h1>
            <p className="text-sm text-gray-600">Vendor Account</p>
          </div>
        </div>

        <div className="flex gap-2">
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
          >
            <Edit className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-gray-600" />
            <span className="text-xs font-medium text-gray-600">Total In</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            <h6>₹{stats.totalAmountIn.toFixed(2)}</h6>
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {stats.totalPaymentsIn} payments
          </p>
        </div>

        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-gray-600" />
            <span className="text-xs font-medium text-gray-600">Total Out</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            <h6>₹{stats.totalAmountOut.toFixed(2)}</h6>
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {stats.totalPaymentsOut} payments
          </p>
        </div>

        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-gray-600" />
            <span className="text-xs font-medium text-gray-600">Net Balance</span>
          </div>
          <p className={`text-xl font-bold ${netBalance >= 0 ? "text-gray-900" : "text-gray-700"}`}>
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

      {/* Filters */}
      <div className="border border-gray-200 rounded-lg">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between p-4"
        >
          <div className="flex items-center gap-2 text-gray-700 font-medium">
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {(startDate || endDate) && (
              <span className="text-xs text-gray-500">(Active)</span>
            )}
          </div>
          <X className={`w-4 h-4 text-gray-400 transition-transform ${showFilters ? '' : 'rotate-45'}`} />
        </button>

        {showFilters && (
          <div className="p-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 text-sm"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payments Table */}
      {filteredPayments?.length === 0 ? (
        <div className="border border-gray-200 rounded-lg p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <CreditCard className="w-8 h-8 text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                No Payments Found
              </h3>
              <p className="text-sm text-gray-600">
                Add your first payment to get started.
              </p>
            </div>
            <button
              onClick={() => handleOpenForm("IN")}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Add Payment
            </button>
          </div>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-900">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-900">Date / Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-900">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-900">Mode</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-900">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredPayments.map((payment) => (
                <tr key={payment._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono font-medium text-gray-900">
                    {payment.direction === "OUT" ? "OUT" : "IN"}-
                    {payment._id.slice(-4).toUpperCase()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">
                        {new Date(payment.paymentDate).toLocaleDateString()}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(payment.paymentDate).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        payment.direction === "OUT"
                          ? "bg-blue-200 text-gray-700"
                          : "bg-blue-600 text-white"
                      }`}
                    >
                      {payment.direction === "OUT" ? (
                        <ArrowUpCircle className="w-3 h-3" />
                      ) : (
                        <ArrowDownCircle className="w-3 h-3" />
                      )}
                      {payment.direction === "OUT" ? "Out" : "In"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">
                      {payment.paymentType || "UPI"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <h6 className="text-sm font-bold text-gray-900">
                      ₹{payment.amount.toFixed(2)}
                    </h6>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditPayment(payment)}
                        className="p-1 text-gray-600 hover:text-gray-900 transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleQuickDeletePayment(payment)}
                        className="p-1 text-gray-600 hover:text-gray-900 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleViewReceipt(payment)}
                        className="p-1 text-gray-600 hover:text-gray-900 transition-colors"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
