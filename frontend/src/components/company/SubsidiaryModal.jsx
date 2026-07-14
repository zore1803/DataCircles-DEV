// src/components/company/SubsidiaryModal.jsx
import React, { useEffect, useState, useRef } from "react";
import API from "../../services/api";
import toast from "react-hot-toast";
import { X, Trash2, Building2, Search, ChevronDown } from "lucide-react";

const SubsidiaryModal = ({ companyId, isOpen, onClose, onSuccess }) => {
  const [subsidiaries, setSubsidiaries] = useState([]);
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [selectedSubsidiaryId, setSelectedSubsidiaryId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const dropdownRef = useRef(null);

  // Fetch data when modal opens
  useEffect(() => {
    if (!isOpen || !companyId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [subRes, compRes] = await Promise.all([
          API.get(`/companies/${companyId}/subsidiaries`),
          API.get("/companies"),
        ]);

        setSubsidiaries(subRes.data || []);

        const filtered = compRes.data.filter(
          (c) =>
            c._id !== companyId && !subRes.data.some((s) => s._id === c._id),
        );

        setAvailableCompanies(filtered);
      } catch (err) {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, companyId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtered companies
  const filteredCompanies = availableCompanies.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.industry &&
        c.industry.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  // Get selected company name for display
  const selectedCompany = availableCompanies.find(
    (c) => c._id === selectedSubsidiaryId,
  );

  const handleSelectCompany = (compId, compName) => {
    setSelectedSubsidiaryId(compId);
    setSearchTerm(compName); // ← Yeh line important thi!
    setIsDropdownOpen(false);
  };

  const handleAddSubsidiary = async () => {
    if (!selectedSubsidiaryId) return toast.error("Please select a company");

    setActionLoading(true);
    try {
      const res = await API.post(`/companies/${companyId}/add-subsidiary`, {
        subsidiaryId: selectedSubsidiaryId,
      });

      const newSub = availableCompanies.find(
        (c) => c._id === selectedSubsidiaryId,
      );
      if (newSub) setSubsidiaries((prev) => [...prev, newSub]);

      setAvailableCompanies((prev) =>
        prev.filter((c) => c._id !== selectedSubsidiaryId),
      );

      // Reset after adding
      setSelectedSubsidiaryId("");
      setSearchTerm("");
      toast.success("Subsidiary added successfully");

      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add subsidiary");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveSubsidiary = async (subId, subName) => {
    if (!window.confirm(`Remove "${subName}" as subsidiary?`)) return;

    setActionLoading(true);
    try {
      await API.delete(`/companies/${companyId}/remove-subsidiary/${subId}`);
      setSubsidiaries((prev) => prev.filter((s) => s._id !== subId));
      toast.success("Subsidiary removed");
      if (onSuccess) onSuccess();
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to remove subsidiary");
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Manage Subsidiaries
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-scroll">
          {/* Add Subsidiary Section */}
          <div className="mb-10">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">
              Link Existing Company as Subsidiary
            </h4>

            {/* Searchable Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <div
                className="w-full px-4 py-3 border border-gray-300 rounded-xl flex items-center gap-3 cursor-pointer focus-within:ring-2 focus-within:ring-blue-500/30"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  placeholder="Search company name or industry..."
                  className="flex-1 outline-none bg-transparent text-sm"
                />
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>

              {/* Dropdown */}
              {isDropdownOpen && (
                <div className="absolute mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto z-50">
                  {filteredCompanies.length === 0 ? (
                    <div className="px-4 py-6 text-center text-gray-500 text-sm">
                      No company found
                    </div>
                  ) : (
                    filteredCompanies.map((comp) => (
                      <div
                        key={comp._id}
                        onClick={() => handleSelectCompany(comp._id, comp.name)}
                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer flex items-center gap-3"
                      >
                        <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center text-xs font-medium">
                          {comp.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{comp.name}</p>
                          {comp.industry && (
                            <p className="text-xs text-gray-500">
                              {comp.industry}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Show selected company name clearly */}
            {selectedCompany && (
              <div className="mt-3 text-sm text-green-600 flex items-center gap-2">
                <span className="font-medium">Selected:</span>
                {selectedCompany.name}
              </div>
            )}

            <button
              onClick={handleAddSubsidiary}
              disabled={actionLoading || !selectedSubsidiaryId}
              className="mt-5 w-full py-3.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {actionLoading ? "Adding..." : "Add Subsidiary"}
            </button>
          </div>

          {/* Current Subsidiaries */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Current Subsidiaries ({subsidiaries.length})
            </h4>

            {subsidiaries.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                <p className="text-gray-500">No subsidiaries linked yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {subsidiaries.map((sub) => (
                  <div
                    key={sub._id}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-2xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center font-medium">
                        {sub.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{sub.name}</p>
                        <p className="text-xs text-gray-500">
                          {sub.industry || "—"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveSubsidiary(sub._id, sub.name)}
                      className="text-red-600 hover:bg-red-50 p-2 rounded-xl"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 rounded-xl font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubsidiaryModal;
