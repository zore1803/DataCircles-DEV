import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import API from "../../services/api";
import toast from "react-hot-toast";
import BankLogo from "../BankLogo";

export default function PaymentFormModal({ isOpen, onClose, onSuccess, editItem = null }) {
  const [vendors, setVendors] = useState([]);
  const [banks, setBanks] = useState([]);
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
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

  const isEdit = Boolean(editItem);

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
      
      if (!isEdit) {
        const defaultBank = fetchedBanks.find(b => b.isDefault) || fetchedBanks[0];
        if (defaultBank) {
          setFormData(prev => ({ ...prev, bank: defaultBank.bankName || defaultBank.bank || "" }));
          setSelectedBankId(defaultBank._id);
        }
      }
    } catch (err) {
      console.error("Fetch banks failed", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchVendors();
      fetchBanks();
      if (editItem) {
        setVendorSearch(editItem.party || editItem.vendorName || "");
        setSelectedVendorId(editItem.vendorId || editItem.vendor || "");
        const formattedDate = editItem.date ? new Date(editItem.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
        setFormData({
          amount: editItem.amount !== undefined ? editItem.amount : "",
          paymentDate: formattedDate,
          direction: editItem.direction || "OUT",
          paymentType: editItem.paymentType || "UPI",
          bank: editItem.bank || "",
          notes: editItem.notes || ""
        });
      } else {
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
      }
    }
  }, [isOpen, editItem]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        vendor: selectedVendorId || undefined,
        vendorName: selectedVendorId ? undefined : vendorSearch
      };
      if (isEdit) {
        payload.source = editItem.source;
        await API.put(`/payments-timeline/${editItem._id}`, payload);
        toast.success("Entry updated successfully!");
      } else {
        await API.post("/payments-timeline", payload);
        toast.success("Payment added successfully!");
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || `Failed to ${isEdit ? "update" : "add"} payment`);
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
      <div className="relative w-1/2 max-w-none h-full bg-white shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E1E4EA] bg-white">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? "Edit Payment" : "Add Payment"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-full hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>
        
        <div className="overflow-y-auto flex-1 p-6">
          <form id="payment-form" onSubmit={handleSubmit} className="space-y-5">
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
                  className="w-full h-10 px-3 py-2 border border-[#E1E4EA] rounded-lg focus:outline-none focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF]"
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                  <input 
                    type="number" 
                    required
                    min="0"
                    step="0.01"
                    disabled={isEdit}
                    title={isEdit ? "Amount cannot be edited" : ""}
                    value={formData.amount}
                    onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))}
                    className={`w-full h-10 pl-8 pr-3 py-2 border border-[#E1E4EA] rounded-lg focus:outline-none ${isEdit ? "bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200" : "focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF]"}`}
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
                  className="w-full h-10 px-3 py-2 border border-[#E1E4EA] rounded-lg focus:outline-none focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Direction <span className="text-red-500">*</span></label>
                <select 
                  value={formData.direction}
                  onChange={e => setFormData(p => ({ ...p, direction: e.target.value }))}
                  className="w-full h-10 px-3 py-2 border border-[#E1E4EA] rounded-lg focus:outline-none focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF] bg-white"
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
                  className="w-full h-10 px-3 py-2 border border-[#E1E4EA] rounded-lg focus:outline-none focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF] bg-white"
                >
                  <option value="UPI">UPI</option>
                  <option value="Net Banking">Net Banking</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Cheque">Cheque</option>
                  <option value="EMI">EMI</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Bank Account</label>
              <div className="relative w-full">
                <button 
                  type="button"
                  onClick={() => setBankDropdownOpen(!bankDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2.5 border border-[#E1E4EA] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0085FF] bg-white"
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
              <textarea 
                value={formData.notes}
                onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                rows={3}
                placeholder="Optional payment notes..."
                className="w-full px-3 py-2 border border-[#E1E4EA] rounded-lg focus:outline-none focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF]"
              />
            </div>
          </form>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#E1E4EA] bg-gray-50">
          <button 
            type="button" 
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-[#E1E4EA] rounded-full hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            form="payment-form"
            disabled={loading}
            className="px-5 py-2 text-sm font-medium text-white bg-[#0085FF] rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Save Payment
          </button>
        </div>
      </div>
    </div>
  );
}
