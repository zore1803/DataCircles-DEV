import React, { useState, useEffect } from "react";
import { X, Plus, Minus, AlertTriangle } from "lucide-react";
import API from "../../services/api";
import toast from "react-hot-toast";

/*
 * Records a single stock-in or stock-out against one item. The direction is fixed by the caller
 * (the row's Stock In / Stock Out buttons), so this form never asks the user which way stock is
 * moving — only how much, and why.
 *
 * The backend is the authority on whether an out-movement is allowed: it rejects removing more
 * than is on hand unless `allowNegative` is sent. This form surfaces that as an inline
 * confirmation rather than silently forcing it through.
 */

const REASONS = {
  in: [
    { value: "purchase", label: "Purchase" },
    { value: "return", label: "Customer Return" },
    { value: "adjustment", label: "Adjustment" },
    { value: "transfer", label: "Transfer In" },
    { value: "other", label: "Other" },
  ],
  out: [
    { value: "sale", label: "Sale" },
    { value: "damage", label: "Damage / Loss" },
    { value: "adjustment", label: "Adjustment" },
    { value: "transfer", label: "Transfer Out" },
    { value: "other", label: "Other" },
  ],
};

export default function StockMovementModal({ isOpen, onClose, item, direction, onSuccess }) {
  const [form, setForm] = useState({ quantity: "", reason: "", notes: "", referenceNumber: "" });
  const [loading, setLoading] = useState(false);
  // Set when the server rejects an over-issue; turns the submit button into an explicit
  // "record anyway" confirmation instead of repeating the same failing request.
  const [negativeWarning, setNegativeWarning] = useState(null);

  const isIn = direction === "in";

  useEffect(() => {
    if (isOpen) {
      setForm({ quantity: "", reason: isIn ? "purchase" : "sale", notes: "", referenceNumber: "" });
      setNegativeWarning(null);
    }
  }, [isOpen, direction, item?._id]);

  if (!isOpen || !item) return null;

  const currentStock = Number(item.inventory?.currentStock) || 0;
  const qty = parseFloat(form.quantity);
  const projected = Number.isFinite(qty) ? (isIn ? currentStock + qty : currentStock - qty) : currentStock;

  const submit = async (allowNegative = false) => {
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Enter a quantity greater than zero");
      return;
    }
    setLoading(true);
    try {
      await API.post(`/inventory/${item._id}/stock-${isIn ? "in" : "out"}`, {
        quantity: qty,
        reason: form.reason,
        notes: form.notes,
        referenceNumber: form.referenceNumber,
        ...(allowNegative ? { allowNegative: true } : {}),
      });
      toast.success(`Stock ${isIn ? "added" : "removed"} successfully`);
      onSuccess?.();
      onClose();
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === "INSUFFICIENT_STOCK") {
        setNegativeWarning(data.error);
      } else {
        toast.error(data?.error || `Failed to record stock ${isIn ? "in" : "out"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50/50">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isIn ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
              }`}
            >
              {isIn ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900 truncate">
                {isIn ? "Stock In" : "Stock Out"}
              </h2>
              <p className="text-xs text-gray-500 truncate">{item.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Current -> projected, so the effect of the entry is visible before saving. */}
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-50 border border-[#E1E4EA]">
            <span className="text-xs text-gray-500">Current stock</span>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="text-gray-900">{currentStock}</span>
              {Number.isFinite(qty) && qty > 0 && (
                <>
                  <span className="text-gray-400">→</span>
                  <span className={projected < 0 ? "text-red-600" : "text-gray-900"}>{projected}</span>
                </>
              )}
              <span className="text-[11px] font-medium text-gray-400 uppercase">{item.primaryUnit || ""}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              autoFocus
              min="0"
              step="any"
              value={form.quantity}
              onChange={(e) => {
                setForm((p) => ({ ...p, quantity: e.target.value }));
                setNegativeWarning(null);
              }}
              placeholder="0"
              className="w-full h-9 px-3 border border-[#E1E4EA] rounded-lg text-sm focus:outline-none focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <select
              value={form.reason}
              onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
              className="w-full h-9 px-3 border border-[#E1E4EA] rounded-lg text-sm bg-white focus:outline-none focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF]"
            >
              {REASONS[isIn ? "in" : "out"].map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reference No.</label>
            <input
              type="text"
              value={form.referenceNumber}
              onChange={(e) => setForm((p) => ({ ...p, referenceNumber: e.target.value }))}
              placeholder="Invoice / PO / Challan number"
              className="w-full h-9 px-3 border border-[#E1E4EA] rounded-lg text-sm focus:outline-none focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Optional notes..."
              className="w-full px-3 py-2 border border-[#E1E4EA] rounded-lg text-sm resize-none focus:outline-none focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF]"
            />
          </div>

          {negativeWarning && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-900">{negativeWarning}</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Recording this will leave the item with negative stock.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 p-4 border-t border-gray-200 bg-gray-50/50">
          <button
            type="button"
            onClick={onClose}
            className="min-w-[100px] px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-[#E1E4EA] rounded-full hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => submit(!!negativeWarning)}
            disabled={loading}
            className={`min-w-[140px] justify-center px-4 py-2 text-sm font-medium text-white rounded-full transition-colors disabled:opacity-50 flex items-center gap-2 ${
              negativeWarning
                ? "bg-amber-500 hover:bg-amber-600"
                : isIn
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {negativeWarning ? "Record Anyway" : isIn ? "Add Stock" : "Remove Stock"}
          </button>
        </div>
      </div>
    </div>
  );
}
