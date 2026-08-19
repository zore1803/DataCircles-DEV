import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import CustomDropdown from "../common/CustomDropdown";

const MAX_FILES = 3;

const JOURNAL_CATEGORIES = [
  "Cash",
  "Bank",
  "Sales",
  "Purchase",
  "Expense",
  "Income",
  "Adjustment",
  "Other",
];

// Drawer chrome (overlay, sliding panel, sticky header/footer) copied from
// QuickCompanyForm so it matches the rest of the app's "New X" pattern.
const QuickJournalForm = ({ onRequestClose, onJournalCreated }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    date: "",
    category: "",
    balanceType: "Debit",
    openingBalance: "",
    notes: "",
  });
  const [attachments, setAttachments] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => setIsOpen(true), 10);
  }, []);

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      if (onRequestClose) onRequestClose();
    }, 300);
  };

  const handleFilesSelected = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (!picked.length) return;

    const room = MAX_FILES - attachments.length;
    if (room <= 0) {
      toast.error(`You can attach up to ${MAX_FILES} files`);
      return;
    }
    if (picked.length > room) {
      toast.error(`Only ${room} more file${room === 1 ? "" : "s"} allowed`);
    }
    setAttachments((prev) => [...prev, ...picked.slice(0, room)]);
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // TODO: wire up to the Journals API once the data model is defined —
      // will need multipart/form-data to carry `attachments` alongside `form`.
      if (onJournalCreated) onJournalCreated({ ...form, attachments });
      handleClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[10000] transition-opacity duration-300 ease-in-out"
        style={{ opacity: isOpen ? 1 : 0 }}
        onClick={handleClose}
      />

      <div
        className={`
          fixed dc-panel-card dc-panel-w z-[10003]
          bg-white shadow-2xl flex flex-col overflow-hidden
          transform transition-transform duration-300 ease-in-out font-inter
          ${isOpen ? "translate-x-0" : "translate-x-[calc(100%+2rem)]"}
        `}
      >
        <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
          {/* Sticky header — compact, matching the note editor card */}
          <div className="flex justify-between items-center flex-shrink-0 p-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-700">
              Create New Journal
            </h3>
            <button
              type="button"
              onClick={handleClose}
              className="p-1 px-2 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100"
              aria-label="Close"
            >
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Form body */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Journal Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleFormChange("name", e.target.value)}
                className="w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]"
                placeholder="e.g. Petty Cash Journal"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Journal Date
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => handleFormChange("date", e.target.value)}
                className="w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Category
              </label>
              <CustomDropdown
                options={JOURNAL_CATEGORIES}
                value={form.category}
                onChange={(value) => handleFormChange("category", value)}
                placeholder="Select Category"
                searchable
                buttonClassName={`w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-left flex items-center justify-between transition-all bg-white ${form.category ? "text-gray-900 font-medium" : "text-[#A0A0A0]"}`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Opening Balance
              </label>
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-full border border-[#E0E0E1] p-1 flex-shrink-0">
                  {["Debit", "Credit"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleFormChange("balanceType", type)}
                      className={`h-9 px-3.5 rounded-full text-[13px] font-semibold transition-colors ${
                        form.balanceType === type
                          ? type === "Debit"
                            ? "bg-red-50 text-red-600"
                            : "bg-emerald-50 text-emerald-600"
                          : "text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.openingBalance}
                  onChange={(e) => handleFormChange("openingBalance", e.target.value)}
                  className="flex-1 min-w-0 border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => handleFormChange("notes", e.target.value)}
                rows={4}
                className="w-full border border-[#E0E0E1] rounded-2xl px-4 py-3 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] resize-none"
                placeholder="Optional notes for this journal entry"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Attach Files
              </label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFilesSelected}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={attachments.length >= MAX_FILES}
                className="w-full border border-dashed border-[#D0D0D2] rounded-2xl px-4 py-3 text-[13px] text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                {attachments.length >= MAX_FILES
                  ? `Maximum ${MAX_FILES} files attached`
                  : "Click to upload files"}
              </button>
              <p className="mt-1 text-[11px] text-gray-400">
                Up to {MAX_FILES} files ({attachments.length}/{MAX_FILES} attached)
              </p>

              {attachments.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {attachments.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100"
                    >
                      <span className="text-[13px] text-gray-700 truncate">
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        aria-label={`Remove ${file.name}`}
                        className="flex-shrink-0 p-1 rounded-full hover:bg-gray-200 transition-colors"
                      >
                        <svg
                          className="w-3.5 h-3.5 text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Sticky footer — compact, matching the note editor card */}
          <div className="flex-shrink-0 p-4 border-t border-gray-100 bg-white flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              className="px-6 py-2.5 bg-[#0C4FCD] text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              type="submit"
              disabled={loading}
            >
              {loading ? "Saving..." : "Create Journal"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default QuickJournalForm;
