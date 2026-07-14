import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Search,
  ChevronDown,
  ArrowRight,
  Building2,
  Info,
} from "lucide-react";
import API from "../../services/api";
import toast from "react-hot-toast";
import ProfilePicture from "../contact/ProfilePicture";

const MergeCompanyModal = ({ primaryCompany, isOpen, onClose, onSuccess }) => {
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [selectedSecondary, setSelectedSecondary] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchCompanies();
      setSelectedSecondary(null);
      setSearchTerm("");
    }
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await API.get("/companies");
      // Exclude the primary company from the list of merge candidates
      setAvailableCompanies(
        res.data.filter((c) => c._id !== primaryCompany._id),
      );
    } catch (err) {
      toast.error("Failed to load companies");
    }
  };

  const filteredCompanies = availableCompanies.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.industry &&
        c.industry.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const handleSelectCompany = (comp) => {
    setSelectedSecondary(comp);
    setSearchTerm(comp.name);
    setIsDropdownOpen(false);
  };

  const handleMerge = async () => {
    if (!selectedSecondary)
      return toast.error("Please select a company to merge.");
    if (
      !window.confirm(
        `Are you sure you want to merge ${selectedSecondary.name} into ${primaryCompany.name}? ${selectedSecondary.name} will be permanently deleted.`,
      )
    )
      return;

    setLoading(true);
    try {
      await API.post(`/companies/${primaryCompany._id}/merge`, {
        secondaryId: selectedSecondary._id,
      });
      toast.success("Companies merged successfully");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to merge companies");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Merge Duplicate</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8">
          {/* Visual Merge Area */}
          <div className="flex items-center justify-between mb-8">
            {/* Left Side: Secondary Company Select */}
            <div className="w-[40%] flex flex-col items-center">
              <div className="w-20 h-20 bg-cyan-50 rounded-full flex items-center justify-center text-cyan-400 mb-4 shadow-sm border border-cyan-100">
                {selectedSecondary ? (
                  <ProfilePicture
                    contact={{
                      name: selectedSecondary.name,
                      avatar: selectedSecondary.profilePicture,
                    }}
                    size="w-16 h-16"
                    textSize="text-2xl"
                  />
                ) : (
                  <Building2 size={32} />
                )}
              </div>

              <label className="text-sm font-semibold text-gray-700 mb-2">
                Search & Select Company To Be Merged
              </label>

              <div className="relative w-full" ref={dropdownRef}>
                <div
                  className="w-full px-3 py-2.5 border border-blue-300 bg-blue-50/30 rounded-md flex items-center gap-2 cursor-pointer"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <Search className="w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setIsDropdownOpen(true);
                      if (selectedSecondary) setSelectedSecondary(null);
                    }}
                    placeholder="Search By Name, Link..."
                    className="flex-1 outline-none bg-transparent text-sm placeholder-gray-400"
                  />
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </div>

                {isDropdownOpen && (
                  <div className="absolute mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto z-50">
                    {filteredCompanies.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500 text-center">
                        No companies found
                      </div>
                    ) : (
                      filteredCompanies.map((comp) => (
                        <div
                          key={comp._id}
                          onClick={() => handleSelectCompany(comp)}
                          className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer text-gray-700"
                        >
                          {comp.name}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Middle: Arrow Indicator */}
            <div className="flex flex-col items-center justify-center px-4 mt-[-40px]">
              <div className="flex items-center text-gray-400 gap-1 mb-6">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                </div>
                <ArrowRight
                  size={32}
                  strokeWidth={3}
                  className="text-gray-400"
                />
              </div>
            </div>

            {/* Right Side: Primary Company Display */}
            <div className="w-[40%] flex flex-col items-center">
              <div className="w-20 h-20 mb-4 flex items-center justify-center">
                <ProfilePicture
                  contact={{
                    name: primaryCompany.name,
                    avatar: primaryCompany.profilePicture,
                  }}
                  size="w-20 h-20"
                  textSize="text-3xl"
                />
              </div>
              <h4 className="text-lg font-semibold text-gray-800">
                {primaryCompany.name}
              </h4>
              <p className="text-sm text-gray-500 mb-2">
                {primaryCompany.address || "No Address Provided"}
              </p>
              <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                Primary Record
              </span>
            </div>
          </div>

          <div className="text-center mb-6 text-gray-600">
            <span className="border-b border-gray-300 font-medium inline-block min-w-[80px] text-center">
              {selectedSecondary?.name || "_________"}
            </span>{" "}
            will be merged into{" "}
            <span className="font-semibold text-gray-800">
              {primaryCompany.name}
            </span>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50 text-blue-900 p-5 rounded-lg text-sm border border-blue-100 mb-6">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                All related information of the selected company will be merged
                in to <strong>"{primaryCompany.name}"</strong>
              </li>
              <li>
                The selected company will be deleted after merging into{" "}
                <strong>"{primaryCompany.name}"</strong>
              </li>
              <li>
                Only the empty fields of the <strong>"Primary Record"</strong>{" "}
                will be updated from selected company
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 font-medium"
          >
            Close
          </button>

          <button
            onClick={handleMerge}
            disabled={loading || !selectedSecondary}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50 transition-colors"
          >
            {loading ? "Merging..." : "Merge"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MergeCompanyModal;
