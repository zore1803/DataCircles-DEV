import React, { useState } from "react";
import { X, Loader2, Save } from "lucide-react";

export default function BulkJournalUpdateModal({ isOpen, onClose, selectedCount, onConfirm }) {
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const updates = {};
    if (category) updates.category = category;
    if (status) updates.status = status;
    
    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    await onConfirm(updates);
    setIsSubmitting(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[999]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white shadow-2xl rounded-2xl z-[1000] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E1E4EA]">
          <h2 className="text-xl font-bold text-gray-900">Bulk Update</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <p className="text-sm text-gray-600 mb-6">
            Update fields for <strong className="text-blue-700">{selectedCount}</strong> selected journal{selectedCount !== 1 && "s"}.
            Leave fields blank to keep their current values.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Enter new category..."
                className="w-full h-10 px-3 rounded-lg border border-[#E1E4EA] focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF] outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#E1E4EA] focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF] outline-none text-sm bg-white"
              >
                <option value="">-- No Change --</option>
                <option value="active">Active</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-full text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!category && !status)}
              className="px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
