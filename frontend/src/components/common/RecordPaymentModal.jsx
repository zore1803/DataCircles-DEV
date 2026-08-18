import React, { useState, useEffect, useRef } from "react";
import {
  X, CheckCircle2, Clock, Paperclip, MessageSquare, Mail,
  Plus, ChevronDown, Trash2, Check
} from "lucide-react";
import API from "../../services/api";
import toast from "react-hot-toast";
import { formatNumberToIndian } from "../../utils/numberFormatter";

const PAYMENT_TYPES = ["UPI", "Cash", "Card", "Net Banking", "Cheque", "EMI", "TDS"];

const fmt = (n) => `₹${formatNumberToIndian(n ?? 0)}`;

const RecordPaymentModal = ({ isOpen, onClose, invoice, onSuccess }) => {
  const [activeTab, setActiveTab] = useState("record");
  const [loading, setLoading] = useState(false);
  const [localInvoice, setLocalInvoice] = useState(invoice);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [notifySMS, setNotifySMS] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [signatures, setSignatures] = useState([]); // [{label, value, url}]
  const [selectedSignature, setSelectedSignature] = useState("");
  const drawerRef = useRef(null);

  useEffect(() => { setLocalInvoice(invoice); }, [invoice]);

  const totalPaid = (localInvoice?.payments || []).reduce((s, p) => s + p.amount, 0);
  const totalAmount = localInvoice?.amount || 0;
  const amountDue = Math.max(0, totalAmount - totalPaid);

  const [form, setForm] = useState({
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMethod: "Cash",
    reference: "",
    notes: "",
    internalNotes: "",
  });

  useEffect(() => {
    if (isOpen && localInvoice) {
      const due = Math.max(
        0,
        localInvoice.amount -
          (localInvoice.payments || []).reduce((s, p) => s + p.amount, 0)
      );
      setForm({
        amount: due > 0 ? due.toFixed(2) : "",
        paymentDate: new Date().toISOString().split("T")[0],
        paymentMethod: "Cash",
        reference: "",
        notes: "",
        internalNotes: "",
      });
      setActiveTab("record");
      setShowMoreDetails(false);
      setNotifySMS(false);
      setNotifyEmail(false);
      setCustomerEmail("");
      setCustomerPhone("");
      setSelectedSignature("");

      // Load saved signatures from Document Settings
      API.get("/document-settings/signatures").then((res) => {
        const sigs = Array.isArray(res.data) ? res.data : (res.data?.signatures || []);
        const mapped = sigs.map((s) => ({
          label: s.name || "Signature",
          value: s.id || s._id || s.name,
          url: s.dataUrl || "",
          isDefault: !!s.isDefault,
        }));
        setSignatures(mapped);
        const defaultSig = mapped.find((s) => s.isDefault);
        if (defaultSig) setSelectedSignature(defaultSig.value);
      }).catch(() => setSignatures([]));
    }
  }, [isOpen, invoice]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive customer name from invoice
  const customerName =
    localInvoice?.deal?.title ||
    localInvoice?.customerName ||
    "Customer";

  const invoiceDate = localInvoice?.invoiceDate
    ? new Date(localInvoice.invoiceDate).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      })
    : "";

  if (!isOpen || !localInvoice) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const paymentAmount = parseFloat(form.amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }
    if (paymentAmount > amountDue + 0.01) {
      toast.error(`Payment cannot exceed the remaining balance of ${fmt(amountDue)}`);
      return;
    }

    setLoading(true);
    try {
      const selectedSig = signatures.find((s) => s.value === selectedSignature);
      const res = await API.post(`/invoices/${localInvoice._id}/payments`, {
        amount: paymentAmount,
        paymentDate: form.paymentDate,
        paymentMethod: form.paymentMethod,
        reference: form.reference,
        notes: form.notes,
        internalNotes: form.internalNotes,
        notifyByEmail: notifyEmail && !!customerEmail,
        customerEmail: notifyEmail ? customerEmail : undefined,
        notifyBySMS: notifySMS && !!customerPhone,
        customerPhone: notifySMS ? customerPhone : undefined,
        signatureUrl: selectedSig?.url || undefined,
      });

      const updated = res.data?.invoice;
      if (updated) setLocalInvoice(updated);

      const remaining = updated
        ? updated.amount - (updated.payments || []).reduce((s, p) => s + p.amount, 0)
        : 0;

      if (remaining <= 0) {
        toast.success(`Payment of ${fmt(paymentAmount)} recorded — Invoice fully paid!`);
        onSuccess?.(updated);
        onClose();
      } else {
        toast.success(`${fmt(paymentAmount)} recorded — ${fmt(remaining)} still due`);
        setForm((p) => ({ ...p, amount: remaining.toFixed(2), reference: "", notes: "", internalNotes: "" }));
        setActiveTab("history");
        onSuccess?.(updated);
      }
    } catch (err) {
      const raw = err.response?.data?.error || "";
      toast.error(
        /validation failed/i.test(raw)
          ? "Couldn't record the payment due to a data issue. Please contact support."
          : raw || "Failed to record payment"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (paymentId) => {
    setDeletingId(paymentId);
    try {
      await API.delete(`/invoices/${localInvoice._id}/payments/${paymentId}`);
      const res = await API.get(`/invoices/${localInvoice._id}`);
      const updated = res.data;
      setLocalInvoice(updated);
      onSuccess?.(updated);
      toast.success("Payment deleted");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete payment");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100019] bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Right drawer */}
      <div
        ref={drawerRef}
        className="fixed inset-y-0 right-0 z-[100020] w-full max-w-[600px] bg-white shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Record Payment</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Invoice · {localInvoice.invoiceNumber}
              {invoiceDate ? ` · ${invoiceDate}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-5">
          {["record", "history"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2.5 px-3 text-xs font-medium border-b-2 transition-colors capitalize flex items-center gap-1.5 ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "record" ? "Record Payment" : "History"}
              {tab === "history" && (localInvoice.payments?.length ?? 0) > 0 && (
                <span className="bg-gray-100 text-gray-600 rounded-full px-1.5 py-px text-[10px] font-semibold">
                  {localInvoice.payments.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "record" ? (
            <form id="rp-form" onSubmit={handleSubmit}>
              {/* Payment gateway banner */}
              <div className="mx-5 mt-4 mb-1 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 flex items-start gap-3">
                <div className="mt-0.5 text-blue-500">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-blue-800">Set up Payment Gateway</p>
                  <p className="text-xs text-blue-600 mt-0.5">Want to get paid faster?</p>
                </div>
                <button type="button" className="text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap">
                  Connect Now
                </button>
              </div>

              {/* Payment Details header */}
              <div className="px-5 mt-4 mb-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    Payment Details
                  </p>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm font-medium text-gray-800">{customerName}</span>
                  <span className="text-sm font-semibold text-red-500">{fmt(amountDue)}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-gray-400">Balance</span>
                </div>
              </div>

              <div className="px-5 space-y-4">
                {/* Amount input */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    Amount to be Recorded
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 text-sm font-medium pointer-events-none">
                      ₹
                    </span>
                    <input
                      type="number"
                      name="amount"
                      value={form.amount}
                      onChange={handleChange}
                      onWheel={(e) => e.target.blur()}
                      max={amountDue}
                      step="0.01"
                      min="0.01"
                      disabled={amountDue <= 0}
                      placeholder="0.00"
                      required
                      className="block w-full pl-8 pr-4 py-2.5 text-base font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  </div>
                  {/* Total / Pending row */}
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span>
                      Total Amount{" "}
                      <span className="font-medium text-gray-700">{fmt(totalAmount)}</span>
                    </span>
                    <span>
                      Amount Pending{" "}
                      <span className="font-medium text-red-500">{fmt(amountDue)}</span>
                    </span>
                  </div>
                </div>

                {/* Payment Date */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    name="paymentDate"
                    value={form.paymentDate}
                    onChange={handleChange}
                    disabled={amountDue <= 0}
                    required
                    className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                  />
                </div>

                {/* Payment Type pills */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">
                    Payment Type
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        disabled={amountDue <= 0}
                        onClick={() => setForm((p) => ({ ...p, paymentMethod: type }))}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          form.paymentMethod === type
                            ? "bg-green-500 border-green-500 text-white"
                            : "bg-white border-gray-300 text-gray-600 hover:border-gray-400"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* More Details toggle */}
                <button
                  type="button"
                  onClick={() => setShowMoreDetails((p) => !p)}
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${showMoreDetails ? "rotate-180" : ""}`}
                  />
                  More Details
                </button>

                {showMoreDetails && (
                  <div className="space-y-3">
                    {/* Reference */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Payment Reference ID{" "}
                        <span className="text-gray-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        name="reference"
                        value={form.reference}
                        onChange={handleChange}
                        disabled={amountDue <= 0}
                        placeholder="Your UTR ID for the payment"
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">
                        A unique ID for each payment.
                      </p>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Notes{" "}
                        <span className="text-gray-400 font-normal">(Optional)</span>
                      </label>
                      <textarea
                        name="notes"
                        value={form.notes}
                        onChange={handleChange}
                        disabled={amountDue <= 0}
                        rows={2}
                        placeholder="Your notes on the payment"
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 resize-none"
                      />
                    </div>

                    {/* Internal Notes */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Internal Notes{" "}
                        <span className="text-gray-400 font-normal">(Optional)</span>
                      </label>
                      <textarea
                        name="internalNotes"
                        value={form.internalNotes}
                        onChange={handleChange}
                        disabled={amountDue <= 0}
                        rows={2}
                        placeholder="Enter notes here..."
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 resize-none"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">
                        This note is exclusively for internal reference and will not be shown elsewhere.
                      </p>
                    </div>

                    {/* Attachments */}
                    <div>
                      <button
                        type="button"
                        className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors w-full justify-center"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        Attachments (Max: 3)
                      </button>
                    </div>
                  </div>
                )}

                {/* Notify Customer */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Notify Customer
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {/* SMS toggle */}
                    <button
                      type="button"
                      onClick={() => setNotifySMS((p) => !p)}
                      className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-medium transition-colors ${
                        notifySMS
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <MessageSquare className={`w-3.5 h-3.5 ${notifySMS ? "text-green-500" : "text-green-400"}`} />
                      Send SMS
                      {notifySMS ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3 text-gray-400" />}
                    </button>

                    {/* Email toggle */}
                    <button
                      type="button"
                      onClick={() => setNotifyEmail((p) => !p)}
                      className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-medium transition-colors ${
                        notifyEmail
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Mail className={`w-3.5 h-3.5 ${notifyEmail ? "text-blue-500" : "text-blue-400"}`} />
                      Send Email
                      {notifyEmail ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3 text-gray-400" />}
                    </button>
                  </div>

                  {/* SMS input — shown when SMS toggle is ON */}
                  {notifySMS && (
                    <div className="mt-2">
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Customer mobile number (10 digits)"
                        maxLength={10}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">
                        A payment receipt SMS will be sent via Fast2SMS.
                      </p>
                    </div>
                  )}

                  {/* Email input — shown when email toggle is ON */}
                  {notifyEmail && (
                    <div className="mt-2">
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="Customer email address"
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">
                        A payment receipt will be sent via SendGrid to this address.
                      </p>
                    </div>
                  )}
                </div>

                {/* Select Signature */}
                <div className="pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Select Signature
                    </p>
                    <button
                      type="button"
                      onClick={() => window.open("/settings/brand", "_blank")}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <Plus className="w-3 h-3" />
                      Add New Signature
                    </button>
                  </div>
                  <div className="relative">
                    <select
                      value={selectedSignature}
                      onChange={(e) => setSelectedSignature(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 appearance-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">No Signature</option>
                      {signatures.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  </div>
                  {/* Signature preview */}
                  {selectedSignature && signatures.find((s) => s.value === selectedSignature)?.url && (
                    <div className="mt-2 p-2 border border-gray-200 rounded-lg bg-gray-50">
                      <img
                        src={signatures.find((s) => s.value === selectedSignature).url}
                        alt="Signature preview"
                        className="h-12 object-contain"
                      />
                    </div>
                  )}
                  <p className="text-[11px] text-gray-400 mt-1">Signature on the document</p>
                </div>
              </div>
            </form>
          ) : (
            /* History tab */
            <div className="px-5 py-4">
              {!localInvoice.payments || localInvoice.payments.length === 0 ? (
                <div className="py-12 flex flex-col items-center text-gray-400">
                  <Clock className="w-8 h-8 mb-2 text-gray-300" />
                  <p className="text-sm">No payments recorded yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {localInvoice.payments.slice().reverse().map((payment) => (
                    <div
                      key={payment._id}
                      className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{fmt(payment.amount)}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-gray-500">
                            <span>
                              {new Date(payment.paymentDate).toLocaleDateString("en-IN", {
                                day: "2-digit", month: "short", year: "numeric",
                              })}
                            </span>
                            <span>·</span>
                            <span>{payment.paymentMethod}</span>
                            {payment.reference && (
                              <>
                                <span>·</span>
                                <span>Ref: {payment.reference}</span>
                              </>
                            )}
                          </div>
                          {payment.notes && (
                            <p className="text-xs text-gray-400 mt-1">{payment.notes}</p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(payment._id)}
                        disabled={deletingId === payment._id}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete payment"
                      >
                        {deletingId === payment._id ? (
                          <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky footer — Record Payment button */}
        {activeTab === "record" && (
          <div className="px-5 py-4 border-t border-gray-100 bg-white">
            <button
              type="submit"
              form="rp-form"
              disabled={loading || amountDue <= 0}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : amountDue <= 0 ? (
                "Invoice Fully Paid"
              ) : (
                "Record Payment"
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default RecordPaymentModal;
