import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import API from "../../services/api";
import toast from "react-hot-toast";

export default function PaymentFormModal({ isOpen, onClose, onSuccess }) {
  const [vendors, setVendors] = useState([]);
  const [banks, setBanks] = useState([]);
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
    }
  }, [isOpen]);

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
        setFormData(prev => ({ ...prev, bank: defaultBank.bankName }));
      }
    } catch (err) {
      console.error("Fetch banks failed", err);
    }
  };

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

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E1E4EA] bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900">Add Payment</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors p-1 rounded-md hover:bg-gray-200">
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
                    value={formData.amount}
                    onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))}
                    className="w-full h-10 pl-8 pr-3 py-2 border border-[#E1E4EA] rounded-lg focus:outline-none focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF]"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank</label>
              {banks.length > 0 ? (
                <select 
                  value={formData.bank}
                  onChange={e => setFormData(p => ({ ...p, bank: e.target.value }))}
                  className="w-full h-10 px-3 py-2 border border-[#E1E4EA] rounded-lg focus:outline-none focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF] bg-white"
                >
                  <option value="">Select a bank...</option>
                  {banks.map(b => (
                    <option key={b._id} value={b.bankName}>{b.bankName} - {b.accountNumber ? b.accountNumber.slice(-4) : ''}</option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center justify-between p-3 border border-yellow-200 bg-yellow-50 rounded-lg">
                  <span className="text-sm text-yellow-800">No banks found in settings.</span>
                  <a href="/settings" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#0085FF] hover:underline">
                    Add Bank Details
                  </a>
                </div>
              )}
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
