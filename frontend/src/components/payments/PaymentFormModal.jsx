import React, { useState, useEffect, useRef } from "react";
import { X, Bold as BoldIcon, Italic as ItalicIcon, Underline as UnderlineIcon, Strikethrough as StrikethroughIcon, List as ListIcon, ListOrdered, Link as LinkIcon } from "lucide-react";
import API from "../../services/api";
import toast from "react-hot-toast";
import BankLogo from "../BankLogo";

export default function PaymentFormModal({ isOpen, onClose, onSuccess }) {
  const [vendors, setVendors] = useState([]);
  const [banks, setBanks] = useState([]);
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const notesEditorRef = useRef(null);
  const [selectedBankId, setSelectedBankId] = useState("");
  const [loading, setLoading] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [formData, setFormData] = useState({
    amount: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    direction: "OUT",
    paymentType: "UPI",
    bank: "",
    notes: ""
  });

  const fetchVendors = async () => {
    try {
      const res = await API.get("/vendors");
      setVendors(res.data.vendors || res.data || []);
    } catch (err) {
      console.error("Fetch vendors failed", err);
    }
  };

  const fetchBanks = async () => {
    try {
      const res = await API.get("/bank-details/all");
      const fetchedBanks = Array.isArray(res.data) ? res.data : [];
      setBanks(fetchedBanks);
      const defaultBank = fetchedBanks.find(b => b.isDefault) || fetchedBanks[0];
      if (defaultBank) {
        setFormData(prev => ({ ...prev, bank: defaultBank.bankName || defaultBank.bank || "" }));
        setSelectedBankId(defaultBank._id);
      }
    } catch (err) {
      console.error("Fetch banks failed", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchVendors();
      fetchBanks();
      setVendorSearch("");
      setSelectedVendorId("");
      setFormData({
        amount: "",
        paymentDate: new Date().toISOString().slice(0, 10),
        direction: "OUT",
        paymentType: "UPI",
        bank: "",
        notes: ""
      });
      // notesEditorRef is an uncontrolled contentEditable (see execCmd below)
      // so re-opening the panel must also clear its live DOM content, not
      // just the notes state — otherwise the previous payment's notes (and
      // formatting) would still be visible underneath the reset state.
      if (notesEditorRef.current) notesEditorRef.current.innerHTML = "";
    }
  }, [isOpen]);

  // execCommand is deprecated but still the simplest way to drive a handful
  // of basic rich-text commands (bold/italic/underline/lists) against a
  // contentEditable div without pulling in an editor library — same pattern
  // Accounting.jsx's email composer uses.
  const execNotesCmd = (cmd, value = null) => {
    notesEditorRef.current?.focus();
    document.execCommand(cmd, false, value);
    setFormData((p) => ({ ...p, notes: notesEditorRef.current?.innerHTML || "" }));
  };
  const insertNotesLink = () => {
    const url = window.prompt("Enter URL");
    if (url) execNotesCmd("createLink", url);
  };
  const notesToolbarButtons = [
    { icon: <BoldIcon className="w-3.5 h-3.5" />, title: "Bold", onClick: () => execNotesCmd("bold") },
    { icon: <ItalicIcon className="w-3.5 h-3.5" />, title: "Italic", onClick: () => execNotesCmd("italic") },
    { icon: <UnderlineIcon className="w-3.5 h-3.5" />, title: "Underline", onClick: () => execNotesCmd("underline") },
    { icon: <StrikethroughIcon className="w-3.5 h-3.5" />, title: "Strikethrough", onClick: () => execNotesCmd("strikeThrough") },
    { icon: <ListOrdered className="w-3.5 h-3.5" />, title: "Numbered list", onClick: () => execNotesCmd("insertOrderedList") },
    { icon: <ListIcon className="w-3.5 h-3.5" />, title: "Bulleted list", onClick: () => execNotesCmd("insertUnorderedList") },
    { icon: <LinkIcon className="w-3.5 h-3.5" />, title: "Insert link", onClick: insertNotesLink },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        vendor: selectedVendorId || undefined,
        vendorName: selectedVendorId ? undefined : vendorSearch
      };
      await API.post("/payments-timeline", payload);
      toast.success("Payment added successfully!");
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to add payment");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredVendors = vendors.filter(v => 
    (v.name || v.companyName || "").toLowerCase().includes(vendorSearch.toLowerCase())
  );

  const selectedBankObj = banks.find(bk => bk._id === selectedBankId);

  return (
    <div className="fixed inset-0 z-[100000] flex justify-end bg-black/40 backdrop-blur-sm transition-opacity duration-300">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
        aria-hidden="true" 
      />
      <div className="fixed dc-panel-card dc-panel-w payment-panel bg-white shadow-2xl flex flex-col z-10 overflow-hidden animate-slideInRight">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50/50">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Add Vendor Payment</h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="overflow-y-auto flex-1 p-4 space-y-3 bg-gray-50/30">
          <form id="payment-form" onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendor <span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  type="text"
                  value={vendorSearch}
                  onChange={(e) => {
                    setVendorSearch(e.target.value);
                    setSelectedVendorId("");
                  }}
                  required={!selectedVendorId}
                  placeholder="Search or enter new vendor name"
                  className="w-full h-9 px-3 border border-[#E1E4EA] rounded-lg focus:outline-none focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF]"
                />
                {vendorSearch && !selectedVendorId && filteredVendors.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-[#E1E4EA] rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredVendors.map(v => (
                      <button
                        key={v._id}
                        type="button"
                        onClick={() => {
                          setSelectedVendorId(v._id);
                          setVendorSearch(v.name || v.companyName);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 focus:bg-blue-50 transition-colors"
                      >
                        {v.name || v.companyName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))}
                  className="w-full h-9 pl-8 pr-3 border border-[#E1E4EA] rounded-lg focus:outline-none focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                required
                value={formData.paymentDate}
                onChange={e => setFormData(p => ({ ...p, paymentDate: e.target.value }))}
                className="w-full h-9 px-3 border border-[#E1E4EA] rounded-lg focus:outline-none focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Direction <span className="text-red-500">*</span></label>
              <select
                value={formData.direction}
                onChange={e => setFormData(p => ({ ...p, direction: e.target.value }))}
                className="w-full h-9 px-3 border border-[#E1E4EA] rounded-lg focus:outline-none focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF] bg-white"
              >
                <option value="OUT">Debit (Out)</option>
                <option value="IN">Credit (In)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type <span className="text-red-500">*</span></label>
              <select
                value={formData.paymentType}
                onChange={e => setFormData(p => ({ ...p, paymentType: e.target.value }))}
                className="w-full h-9 px-3 border border-[#E1E4EA] rounded-lg focus:outline-none focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF] bg-white"
              >
                <option value="UPI">UPI</option>
                <option value="Net Banking">Net Banking</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Cheque">Cheque</option>
                <option value="EMI">EMI</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Bank Account</label>
              <div className="relative w-full">
                <button 
                  type="button"
                  onClick={() => setBankDropdownOpen(!bankDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 border border-[#E1E4EA] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0085FF] bg-white"
                >
                  {selectedBankObj ? (
                    <div className="flex items-center gap-2.5">
                      <BankLogo bankName={selectedBankObj.bankName || selectedBankObj.bank || ""} size={28} />
                      <span className="text-sm font-medium text-gray-800">
                        {selectedBankObj.bankName || selectedBankObj.bank}
                        {selectedBankObj.branch ? ` (${selectedBankObj.branch})` : ""}
                        {selectedBankObj.accountNumber ? ` - XXXX${selectedBankObj.accountNumber.slice(-4)}` : ""}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-500 text-sm">Select a bank...</span>
                  )}
                  <svg className="h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {bankDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-[#E1E4EA] rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {banks.map(b => {
                      const name = b.bankName || b.bank || "Bank";
                      const branch = b.branch ? ` (${b.branch})` : "";
                      const lastFour = b.accountNumber ? b.accountNumber.slice(-4) : "";
                      return (
                        <button 
                          key={b._id} 
                          type="button"
                          onClick={() => {
                            setSelectedBankId(b._id);
                            setFormData(p => ({ ...p, bank: name }));
                            setBankDropdownOpen(false);
                          }}
                          className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-blue-50 text-left transition-colors"
                        >
                          <BankLogo bankName={name} size={28} />
                          <span className="font-medium text-gray-800">{name}{branch}</span>
                          {lastFour && <span className="text-gray-500 text-xs ml-auto">XXXX{lastFour}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <div className="flex items-center gap-0.5 border border-[#E1E4EA] border-b-0 rounded-t-lg bg-gray-50 px-1.5 py-1">
                {notesToolbarButtons.map(({ icon, title, onClick }) => (
                  <button
                    key={title}
                    type="button"
                    title={title}
                    // Mousedown (not click) so the editor's text selection
                    // survives — a click first steals focus/selection away
                    // from the contentEditable.
                    onMouseDown={(e) => { e.preventDefault(); onClick(); }}
                    className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors"
                  >
                    {icon}
                  </button>
                ))}
              </div>
              <div
                ref={(el) => {
                  notesEditorRef.current = el;
                  if (el && el.dataset.init !== "true") {
                    el.innerHTML = formData.notes;
                    el.dataset.init = "true";
                  }
                }}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => setFormData((p) => ({ ...p, notes: e.currentTarget.innerHTML }))}
                data-placeholder="Optional payment notes..."
                className="w-full min-h-[72px] px-3 py-2 border border-[#E1E4EA] rounded-b-lg text-sm focus:outline-none focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF] empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 [&_a]:text-blue-600 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
              />
            </div>
          </form>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 p-4 border-t border-gray-200 bg-gray-50/50">
          <button 
            type="button" 
            onClick={onClose}
            className="min-w-[120px] px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-[#E1E4EA] rounded-full hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            form="payment-form"
            disabled={loading}
            className="min-w-[140px] justify-center px-5 py-2 text-sm font-medium text-white bg-[#0085FF] rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Add Payment
          </button>
        </div>
      </div>
    </div>
  );
}
