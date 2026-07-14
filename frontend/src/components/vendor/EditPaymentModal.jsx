// components/vendor/EditPaymentModal.jsx
import React, { useState } from "react";
import { X } from "lucide-react";

const EditPaymentModal = ({
  isOpen,
  onClose,
  payment,
  vendorId,
  onUpdateSuccess,
  onDeleteSuccess,
}) => {
  const [form, setForm] = useState({
    paymentDate: payment?.paymentDate
      ? new Date(payment.paymentDate).toISOString().split("T")[0]
      : "",
    paymentType: payment?.paymentType || "Card",
    bank: payment?.bank || "",
    notes: payment?.notes || "",
    direction: payment?.direction || "IN",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !payment) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.paymentType || !form.direction) {
      setError("Payment type and direction are required");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        paymentDate: form.paymentDate,
        paymentType: form.paymentType,
        bank: form.bank,
        notes: form.notes,
        direction: form.direction,
        // Amount is intentionally excluded from updates
        amount: payment.amount,
      };

      const response = await fetch(
        `${import.meta.env.VITE_APP_API_URL}/api/vendors/${vendorId}/payments/${
          payment._id
        }`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`, // Adjust based on your auth
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update payment");
      }

      const updatedPayment = await response.json();
      onUpdateSuccess(updatedPayment);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to update payment");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this payment?"))
      return;

    try {
      setLoading(true);
      const response = await fetch(
        `${import.meta.env.VITE_APP_API_URL}/api/vendors/${vendorId}/payments/${payment._id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`, // Adjust based on your auth
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete payment");
      }

      onDeleteSuccess(payment._id);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to delete payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center pt-20 z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">Edit Payment</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Payment Amount (Read-only) */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
          <div className="text-sm text-gray-600 mb-1">
            Payment Amount (Cannot be changed)
          </div>
          <h6 className="text-2xl font-bold text-gray-900">
            ₹{payment.amount?.toFixed(2)}
          </h6>
          <div className="text-sm text-gray-500">
            {payment.direction === "IN"
              ? "Incoming Payment"
              : "Outgoing Payment"}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Payment Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Date *
            </label>
            <input
              type="date"
              value={form.paymentDate}
              onChange={(e) =>
                setForm({ ...form, paymentDate: e.target.value })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Payment Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Type *
            </label>
            <select
              value={form.paymentType}
              onChange={(e) =>
                setForm({ ...form, paymentType: e.target.value })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="Card">Card</option>
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
              <option value="EMI">EMI</option>
              <option value="Net Banking">Net Banking</option>
              <option value="UPI">UPI</option>
            </select>
          </div>

          {/* Direction */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Direction *
            </label>
            <select
              value={form.direction}
              onChange={(e) => setForm({ ...form, direction: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="IN">You Got (Incoming)</option>
              <option value="OUT">You Gave (Outgoing)</option>
            </select>
          </div>

          {/* Bank */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bank
            </label>
            <input
              type="text"
              value={form.bank}
              onChange={(e) => setForm({ ...form, bank: e.target.value })}
              placeholder="Enter bank name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Add notes..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
              rows="3"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-400 transition-colors"
            >
              {loading ? "Updating..." : "Update Payment"}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-red-400 transition-colors"
            >
              {loading ? "Deleting..." : "Delete Payment"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 focus:outline-none transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditPaymentModal;
