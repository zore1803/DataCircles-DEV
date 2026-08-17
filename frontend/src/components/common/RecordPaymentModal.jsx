import React, { useState, useEffect } from "react";
import { X, IndianRupee, CreditCard, Calendar, FileText, CheckCircle2, Clock } from "lucide-react";
import API from "../../services/api";
import { formatNumberToIndian } from "../../utils/numberFormatter";

const PAYMENT_METHODS = ["UPI", "Cash", "Net Banking", "NEFT", "RTGS", "IMPS", "Cheque", "Card", "Other"];

const RecordPaymentModal = ({ isOpen, onClose, invoice, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("record"); // "record" | "history"
  
  // Calculate existing payment state
  const totalPaid = (invoice?.payments || []).reduce((sum, p) => sum + p.amount, 0);
  const totalAmount = invoice?.amount || 0;
  const amountDue = totalAmount - totalPaid;

  const [formData, setFormData] = useState({
    amount: amountDue > 0 ? amountDue.toString() : "",
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: "UPI",
    reference: "",
    notes: ""
  });

  useEffect(() => {
    if (isOpen && invoice) {
      const due = invoice.amount - (invoice.payments || []).reduce((sum, p) => sum + p.amount, 0);
      setFormData(prev => ({
        ...prev,
        amount: due > 0 ? due.toString() : ""
      }));
      setActiveTab("record");
    }
  }, [isOpen, invoice]);

  if (!isOpen || !invoice) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const paymentAmount = parseFloat(formData.amount);
    
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      alert("Please enter a valid amount greater than 0");
      return;
    }
    
    if (paymentAmount > amountDue) {
      alert(`Payment amount cannot exceed the remaining balance of ₹${formatNumberToIndian(amountDue)}`);
      return;
    }

    setLoading(true);
    try {
      await API.post(`/invoices/${invoice._id}/payments`, {
        amount: paymentAmount,
        paymentDate: formData.paymentDate,
        paymentMethod: formData.paymentMethod,
        reference: formData.reference,
        notes: formData.notes
      });
      onSuccess();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to record payment");
    } finally {
      setLoading(false);
    }
  };

  const renderHistory = () => {
    if (!invoice.payments || invoice.payments.length === 0) {
      return (
        <div className="py-8 text-center text-gray-500 flex flex-col items-center">
          <Clock className="w-8 h-8 text-gray-300 mb-2" />
          <p>No payments recorded yet</p>
        </div>
      );
    }

    return (
      <div className="space-y-3 mt-4 max-h-[300px] overflow-y-auto pr-2">
        {invoice.payments.slice().reverse().map((payment, idx) => (
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Record Payment</h2>
            <p className="text-sm text-gray-500">{invoice.invoiceNumber}</p>
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
            {invoice.payments?.length > 0 && (
              <span className="bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs font-semibold">
                {invoice.payments.length}
              </span>
            )}
          </button>
        </div>

        <div className="px-6 py-4 flex-1 overflow-y-auto">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-1">Total Amount</p>
              <p className="text-sm font-semibold text-gray-900">₹{formatNumberToIndian(totalAmount)}</p>
            </div>
            <div className={`p-3 rounded-lg border ${amountDue > 0 ? 'bg-orange-50 border-orange-100' : 'bg-emerald-50 border-emerald-100'}`}>
              <p className={`text-xs font-medium mb-1 ${amountDue > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                {amountDue > 0 ? 'Amount Due' : 'Fully Paid'}
              </p>
              <p className={`text-sm font-semibold ${amountDue > 0 ? 'text-orange-700' : 'text-emerald-700'}`}>
                ₹{formatNumberToIndian(amountDue)}
              </p>
            </div>
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
                      className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 appearance-none bg-white"
                      required
                    >
                      {PAYMENT_METHODS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
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
