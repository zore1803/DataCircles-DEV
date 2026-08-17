import React, { useState, useEffect } from "react";
import { X, IndianRupee, CreditCard, Calendar, FileText, CheckCircle2, Clock, ChevronDown } from "lucide-react";
import API from "../../services/api";
import toast from "react-hot-toast";
import { formatNumberToIndian } from "../../utils/numberFormatter";

const PAYMENT_METHODS = ["UPI", "Cash", "Net Banking", "NEFT", "RTGS", "IMPS", "Cheque", "Card", "Other"];

const RecordPaymentModal = ({ isOpen, onClose, invoice, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("record"); // "record" | "history"
  // Local copy of the invoice so payment history updates immediately within
  // the same modal open (without needing a full page refresh).
  const [localInvoice, setLocalInvoice] = useState(invoice);

  useEffect(() => { setLocalInvoice(invoice); }, [invoice]);

  // Calculate existing payment state from the live local copy
  const totalPaid = (localInvoice?.payments || []).reduce((sum, p) => sum + p.amount, 0);
  const totalAmount = localInvoice?.amount || 0;
  const amountDue = totalAmount - totalPaid;

  const [formData, setFormData] = useState({
    amount: amountDue > 0 ? amountDue.toString() : "",
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: "UPI",
    reference: "",
    notes: ""
  });

  useEffect(() => {
    if (isOpen && localInvoice) {
      const due = localInvoice.amount - (localInvoice.payments || []).reduce((sum, p) => sum + p.amount, 0);
      setFormData(prev => ({
        ...prev,
        amount: due > 0 ? due.toString() : "",
        paymentDate: new Date().toISOString().split('T')[0],
        reference: "",
        notes: "",
      }));
      setActiveTab("record");
    }
  }, [isOpen, invoice]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen || !localInvoice) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const paymentAmount = parseFloat(formData.amount);

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }

    if (paymentAmount > amountDue) {
      toast.error(`Payment cannot exceed the remaining balance of ₹${formatNumberToIndian(amountDue)}`);
      return;
    }

    setLoading(true);
    try {
      const res = await API.post(`/invoices/${localInvoice._id}/payments`, {
        amount: paymentAmount,
        paymentDate: formData.paymentDate,
        paymentMethod: formData.paymentMethod,
        reference: formData.reference,
        notes: formData.notes,
      });

      const updatedInvoice = res.data?.invoice;

      // Update local copy immediately so history tab and due amount reflect
      // the new payment without waiting for the parent list to re-fetch.
      if (updatedInvoice) setLocalInvoice(updatedInvoice);

      const remaining = updatedInvoice
        ? updatedInvoice.amount - (updatedInvoice.payments || []).reduce((s, p) => s + p.amount, 0)
        : 0;

      if (remaining <= 0) {
        toast.success(`✓ Payment of ₹${formatNumberToIndian(paymentAmount)} recorded — Invoice fully paid!`);
        onSuccess(updatedInvoice);
        onClose();
      } else {
        // Partial payment — stay open, show history, reset form for next payment
        toast.success(`✓ ₹${formatNumberToIndian(paymentAmount)} recorded — ₹${formatNumberToIndian(remaining)} still due`);
        setFormData(prev => ({
          ...prev,
          amount: remaining.toString(),
          reference: "",
          notes: "",
        }));
        setActiveTab("history");
        onSuccess(updatedInvoice);
      }
    } catch (error) {
      const rawMessage = error.response?.data?.error || "";
      // Backend validation errors (Mongoose's "X validation failed: ...")
      // are internal implementation details, not something a user can act
      // on — show a plain message instead of leaking that phrasing.
      const friendlyMessage = /validation failed/i.test(rawMessage)
        ? "Couldn't record the payment due to a data issue on this invoice. Please contact support if this keeps happening."
        : rawMessage || "Failed to record payment";
      toast.error(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderHistory = () => {
    if (!localInvoice.payments || localInvoice.payments.length === 0) {
      return (
        <div className="py-8 text-center text-gray-500 flex flex-col items-center">
          <Clock className="w-8 h-8 text-gray-300 mb-2" />
          <p>No payments recorded yet</p>
        </div>
      );
    }

    return (
      <div className="space-y-3 mt-4 max-h-[300px] overflow-y-auto pr-2">
        {localInvoice.payments.slice().reverse().map((payment, idx) => (
          <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-sm text-gray-900">₹{formatNumberToIndian(payment.amount)}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{new Date(payment.paymentDate).toLocaleDateString('en-IN')}</span>
                  <span>•</span>
                  <span>{payment.paymentMethod}</span>
                  {payment.reference && (
                    <>
                      <span>•</span>
                      <span>Ref: {payment.reference}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100020] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Record Payment</h2>
            <p className="text-sm text-gray-500">{localInvoice.invoiceNumber}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
          <button
            onClick={() => setActiveTab("record")}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "record" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Record Payment
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "history" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            History
            {localInvoice.payments?.length > 0 && (
              <span className="bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs font-semibold">
                {localInvoice.payments.length}
              </span>
            )}
          </button>
        </div>

        <div className="px-6 py-4 flex-1 overflow-y-auto">
          {/* Summary — 3 cards + progress bar */}
          <div className="mb-6 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <p className="text-[10px] font-medium text-gray-500 mb-1">Total</p>
                <p className="text-sm font-bold text-gray-900">₹{formatNumberToIndian(totalAmount)}</p>
              </div>
              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                <p className="text-[10px] font-medium text-emerald-600 mb-1">Paid</p>
                <p className="text-sm font-bold text-emerald-700">₹{formatNumberToIndian(totalPaid)}</p>
              </div>
              <div className={`p-3 rounded-lg border ${amountDue > 0 ? 'bg-orange-50 border-orange-100' : 'bg-emerald-50 border-emerald-100'}`}>
                <p className={`text-[10px] font-medium mb-1 ${amountDue > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                  {amountDue > 0 ? 'Due' : 'Settled'}
                </p>
                <p className={`text-sm font-bold ${amountDue > 0 ? 'text-orange-700' : 'text-emerald-700'}`}>
                  ₹{formatNumberToIndian(Math.max(0, amountDue))}
                </p>
              </div>
            </div>
            {/* Payment progress bar */}
            {totalAmount > 0 && (
              <div>
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                  <span>{totalPaid > 0 ? `${Math.round((totalPaid / totalAmount) * 100)}% paid` : "Not yet paid"}</span>
                  {amountDue > 0 && <span>₹{formatNumberToIndian(amountDue)} remaining</span>}
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (totalPaid / totalAmount) * 100)}%`,
                      backgroundColor: amountDue <= 0 ? "#10b981" : "#3b82f6",
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {activeTab === "record" ? (
            <form id="payment-form" onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount (₹) <span className="text-red-500">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <IndianRupee className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    max={amountDue}
                    step="0.01"
                    disabled={amountDue <= 0}
                    className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      name="paymentDate"
                      value={formData.paymentDate}
                      onChange={handleChange}
                      disabled={amountDue <= 0}
                      className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Method <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <CreditCard className="h-4 w-4 text-gray-400" />
                    </div>
                    <select
                      name="paymentMethod"
                      value={formData.paymentMethod}
                      onChange={handleChange}
                      disabled={amountDue <= 0}
                      className="block w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 appearance-none bg-white"
                      required
                    >
                      {PAYMENT_METHODS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference #</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FileText className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="reference"
                    value={formData.reference}
                    onChange={handleChange}
                    disabled={amountDue <= 0}
                    className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50"
                    placeholder="Transaction ID, Cheque No, etc."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  disabled={amountDue <= 0}
                  rows="2"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 resize-none"
                  placeholder="Optional notes about this payment"
                />
              </div>
            </form>
          ) : (
            renderHistory()
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Cancel
          </button>
          {activeTab === "record" && (
            <button
              type="submit"
              form="payment-form"
              disabled={loading || amountDue <= 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Payment'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecordPaymentModal;
