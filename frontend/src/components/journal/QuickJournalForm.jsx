import React, { useEffect, useRef, useState } from "react";
import { X, Paperclip } from "lucide-react";
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
          {/* Sticky header — matches the QuickCompanyForm header spec */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-[#D9D9D9] flex-shrink-0 bg-white gap-1">
            <h2 className="text-[14px] font-normal leading-5 text-[#78788D] uppercase tracking-wide">
              Create New Journal
            </h2>
            <button
              type="button"
              onClick={handleClose}
              title="Close"
              className="w-5 h-5 flex items-center justify-center text-[#1C1B1F] hover:opacity-70 transition-opacity"
              aria-label="Close"
            >
              <X className="w-[18px] h-[18px]" strokeWidth={2} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 space-y-6">
            <div>
              <label className="block text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                Journal Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleFormChange("name", e.target.value)}
                className="w-full border border-[#1F2937]/10 rounded-full px-3 h-8 text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#1F2937] placeholder:opacity-50"
                placeholder="e.g. Petty Cash Journal"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                Journal Date
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => handleFormChange("date", e.target.value)}
                className="w-full border border-[#1F2937]/10 rounded-full px-3 h-8 text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                Category
              </label>
              <CustomDropdown
                options={JOURNAL_CATEGORIES}
                value={form.category}
                onChange={(value) => handleFormChange("category", value)}
                placeholder="Select Category"
                searchable
                buttonClassName={`w-full border border-[#1F2937]/10 rounded-full px-3 h-8 text-[12px] text-left flex items-center justify-between transition-all bg-white font-inter ${form.category ? "text-[#1F2937]" : "text-[#1F2937] opacity-50"}`}
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                Opening Balance
              </label>
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-full border border-[#1F2937]/10 p-1 flex-shrink-0">
                  {["Debit", "Credit"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleFormChange("balanceType", type)}
                      className={`h-6 px-3 rounded-full text-[12px] font-medium transition-colors ${
                        form.balanceType === type
                          ? type === "Debit"
                            ? "bg-red-50 text-red-600"
                            : "bg-emerald-50 text-emerald-600"
                          : "text-[#1F2937] opacity-50 hover:opacity-100"
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
                  className="flex-1 min-w-0 border border-[#1F2937]/10 rounded-full px-3 h-8 text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#1F2937] placeholder:opacity-50"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => handleFormChange("notes", e.target.value)}
                rows={4}
                className="w-full border border-[#1F2937]/10 rounded-2xl px-3 py-2 text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#1F2937] placeholder:opacity-50 resize-none"
                placeholder="Optional notes for this journal entry"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                Attach Files
              </label>
              <div className="flex items-center gap-3">
                <div
                  onClick={() => attachments.length < MAX_FILES && fileInputRef.current?.click()}
                  className={`flex-1 flex items-center px-3 h-8 rounded-full border border-[#1F2937]/10 ${
                    attachments.length >= MAX_FILES ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                  }`}
                >
                  <span className="text-[12px] leading-5 text-[#1F2937] opacity-50 truncate">
                    {attachments.length >= MAX_FILES
                      ? `Maximum ${MAX_FILES} files attached`
                      : "Click to upload files"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={attachments.length >= MAX_FILES}
                  title="Attach files"
                  className="flex-shrink-0 w-8 h-8 rounded-full bg-[#158FFF] border border-[#1F2937]/10 flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Paperclip className="w-[18px] h-[18px] text-white" strokeWidth={2} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFilesSelected}
                  className="hidden"
                />
              </div>
              <p className="text-[12px] font-inter text-[#A0A0A0] mt-1.5 uppercase font-medium">
                Up to {MAX_FILES} files ({attachments.length}/{MAX_FILES} attached)
              </p>

              {attachments.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {attachments.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between gap-2 px-3 h-8 rounded-full bg-[#F9F9FB] border border-[#1F2937]/10"
                    >
                      <span className="text-[12px] text-[#1F2937] truncate">
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        aria-label={`Remove ${file.name}`}
                        className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                      >
                        <X className="w-3 h-3 text-[#1F2937]" strokeWidth={2.5} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Sticky footer — matches the QuickCompanyForm footer spec */}
          <div className="flex-shrink-0 py-2.5 px-4 border-t border-gray-100 bg-white flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2 border border-gray-200 text-gray-700 rounded-[25px] text-sm font-bold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              className="px-6 py-2 bg-[#158FFF] text-white rounded-[25px] text-sm font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
