import React, { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import API from "../../services/api";
import SearchableDropdown from "../contact/SearchableDropdown";
import QuickVendorForm from "./QuickVendorForm";
import toast from "react-hot-toast";

// Module-level so the fallback keeps the SAME reference across renders. As an
// inline `vendors = []` default it was re-created on every render, and the
// `[vendors]` effect below (which compares by reference) then fired on every
// render — setLocalVendors → re-render → new [] → fire again, i.e. "Maximum
// update depth exceeded". Only callers that omit the prop hit this, which is
// why it surfaced from PaymentsTable and not from Vendors/PaymentPage.
const EMPTY_VENDORS = [];

const VendorPaymentForm = ({
  open,
  vendorId,
  direction,
  onSave,
  onClose,
  paymentToEdit = null,
  onUpdateSuccess,
  onDeleteSuccess,
  vendors = EMPTY_VENDORS,
}) => {
  const initialState = {
    vendorId: "",
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    paymentType: "Card",
    bank: "",
    reference: "",
    notes: "",
    direction: "",
  };

  const [form, setForm] = useState({
    ...initialState,
    vendorId: vendorId || "",
    direction: direction || "",
  });
  const [loading, setLoading] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [localVendors, setLocalVendors] = useState(vendors);

  const isEditMode = !!paymentToEdit;

  useEffect(() => {
    setLocalVendors(vendors);
  }, [vendors]);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      if (paymentToEdit) {
        setForm({
          vendorId: vendorId || paymentToEdit.vendor?._id || "",
          amount: paymentToEdit.amount || "",
          paymentDate: paymentToEdit.paymentDate
            ? new Date(paymentToEdit.paymentDate).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
          paymentType: paymentToEdit.paymentType || "Card",
          bank: paymentToEdit.bank || "",
          reference: paymentToEdit.reference || "",
          notes: paymentToEdit.notes || "",
          direction: paymentToEdit.direction || direction || "",
        });
      } else {
        setForm({
          ...initialState,
          vendorId: vendorId || "",
          direction: direction || "",
        });
      }
    } else {
      setTimeout(() => setShouldRender(false), 300);
    }
  }, [open, vendorId, direction, paymentToEdit]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      !form.vendorId ||
      !form.amount ||
      !form.paymentType ||
      !form.direction
    ) {
      toast.error("Vendor, amount, payment type, and direction are required");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        vendor: form.vendorId,
        amount: parseFloat(form.amount),
        paymentDate: form.paymentDate,
        paymentType: form.paymentType,
        bank: form.bank,
        reference: form.reference,
        notes: form.notes,
        direction: form.direction,
      };

      if (isEditMode) {
        const res = await API.put(
          `/vendors/${form.vendorId}/payments/${paymentToEdit._id}`,
          payload,
        );
        if (onUpdateSuccess) onUpdateSuccess(res.data);
        toast.success("Payment updated successfully!");
      } else {
        await onSave(payload);
        toast.success("Payment added successfully!");
      }

      setForm({
        ...initialState,
        vendorId: vendorId || "",
        direction: direction || "",
      });
      onClose();
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          `Failed to ${isEditMode ? "update" : "add"} payment`,
      );
    } finally {
      setLoading(false);
    }
  };

  if (!shouldRender && !open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-[10000] transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />

      {/* Slide-out Panel */}
      <div
        className={`
          fixed dc-panel-card z-[10001]
          dc-panel-w bg-white shadow-2xl flex flex-col overflow-hidden
          transform transition-transform duration-300 ease-in-out font-inter
          ${open ? "translate-x-0" : "translate-x-[calc(100%+2rem)]"}
        `}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-8 pb-6 border-b border-[#F2F2F7] flex-shrink-0 bg-white">
          <h2 className="text-[24px] font-bold text-[#111216]">
            {isEditMode ? "Edit Payment" : form.direction === "IN" ? "Add Incoming Payment" : form.direction === "OUT" ? "Add Outgoing Payment" : "Add Payment"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="space-y-6">
          {/* Vendor Selection - Only if not pre-selected */}
          {!vendorId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor <span className="text-red-500">*</span>
              </label>
              <SearchableDropdown
                options={localVendors}
                value={form.vendorId}
                onChange={(value) => handleChange("vendorId", value)}
                placeholder="Select Vendor"
                displayKey="name"
                valueKey="_id"
                required={true}
                className="w-full border border-gray-300 rounded-lg"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => handleChange("amount", e.target.value)}
              placeholder="Enter Amount"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.paymentDate}
              onChange={(e) => handleChange("paymentDate", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Direction <span className="text-red-500">*</span>
            </label>
            <select
              value={form.direction}
              onChange={(e) => handleChange("direction", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="">Select Direction</option>
              <option value="IN">You Got ( Incoming )</option>
              <option value="OUT">You Gave ( Outgoing )</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Type <span className="text-red-500">*</span>
            </label>
            <select
              value={form.paymentType}
              onChange={(e) => handleChange("paymentType", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="Card">Card</option>
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
              <option value="Net Banking">Net Banking</option>
              <option value="UPI">UPI</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bank <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.bank}
              onChange={(e) => handleChange("bank", e.target.value)}
              placeholder="Enter Bank Name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reference
            </label>
            <input
              type="text"
              value={form.reference}
              onChange={(e) => handleChange("reference", e.target.value)}
              placeholder="UTR / Cheque no. / Txn ID"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Add Notes"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              rows={3}
            />
          </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 pt-6 border-t border-[#F2F2F7] bg-white flex justify-end gap-3 flex-shrink-0 mt-auto">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-[#2D31A6] text-white rounded-xl text-sm font-semibold hover:bg-opacity-90 disabled:opacity-50 transition-colors"
          >
            {loading ? "Saving..." : isEditMode ? "Save Changes" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
};

export default VendorPaymentForm;
