import React, { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import API from "../../services/api";
import SearchableDropdown from "../contact/SearchableDropdown";
import QuickVendorForm from "./QuickVendorForm";
import toast from "react-hot-toast";

const VendorPaymentForm = ({
  open,
  vendorId,
  direction,
  onSave,
  onClose,
  paymentToEdit = null,
  onUpdateSuccess,
  onDeleteSuccess,
  vendors = [],
}) => {
  const initialState = {
    vendorId: "",
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    paymentType: "Card",
    bank: "",
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
    <div
      className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
      onClick={onClose}
    >
      <div
        className={`bg-white w-full max-w-lg rounded-xl shadow-2xl flex flex-col transition-transform duration-300 ${open ? "scale-100" : "scale-95"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-800">
            {isEditMode ? "Edit Payment" : "Add Incoming Payment"}
          </h3>
          {/* Note: User wanted "Add Incoming Payment" specifically in the image, but logic handles both. 
              The header likely dynamic based on direction, but sticking to the image request: "Add Incoming Payment" as example logic.
              Actually, let's keep it dynamic or generic "Add Payment" if type not selected? 
              Ref image says "Add Incoming Payment" inside the modal. The user prompt says "make this" referring to image 3.
              Image 3 shows "Add Incoming Payment". I will keep logic to show specific text. 
          */}
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
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

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-between gap-4 bg-gray-50/50 rounded-b-xl">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-white bg-white shadow-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-blue-600 rounded-lg text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-70 shadow-sm"
          >
            {loading ? "Adding..." : "Add New Payment"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VendorPaymentForm;
