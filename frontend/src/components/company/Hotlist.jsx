import React, { useEffect, useState, useCallback, useRef } from "react";
import API from "../../services/api";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronRight,
  X,
  Building2,
  MapPin,
  Briefcase,
  Check,
  Menu,
} from "lucide-react";

const Hotlist = () => {
  const [folders, setFolders] = useState([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [openFolderIds, setOpenFolderIds] = useState([]);

  // Search and selection states
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [filteredCompanies, setFilteredCompanies] = useState([]);

  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Debounced search
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  const debouncedSearch = useCallback(
    debounce(async (term) => {
      try {
        // Fetch up to 20 results dynamically based on search
        const params = new URLSearchParams({ limit: "20" });
        if (term.trim()) {
          params.append("search", term.trim());
        }

        const res = await API.get(`/companies/pagination?${params.toString()}`);
        if (res.data.companies) {
          setFilteredCompanies(res.data.companies);
        } else if (Array.isArray(res.data)) {
          setFilteredCompanies(res.data);
        }
      } catch (error) {
        console.error("Search failed", error);
      }
    }, 300),
    [],
  );

  useEffect(() => {
    if (editingFolder) {
      debouncedSearch(searchTerm);
    }
  }, [searchTerm, editingFolder, debouncedSearch]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchFolders = async () => {
    try {
      const res = await API.get("/company-folders/");
      setFolders(res.data);
    } catch (error) {
      toast.error("Failed to fetch folders");
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error("Folder name is required");
      return;
    }

    const loadingToast = toast.loading("Creating folder...");

    try {
      await API.post("/company-folders", { name: newFolderName });
      setNewFolderName("");
      toast.success("Folder created successfully", { id: loadingToast });
      fetchFolders();
    } catch (error) {
      if (error.response?.status === 402) {
        toast.error(error.response?.data?.message || "An active subscription is required to make changes.", { id: loadingToast });
      } else {
        toast.error(error.response?.data?.error || "Failed to create folder", { id: loadingToast });
      }
    }
  };

  const startEdit = (folder) => {
    setEditingFolder(folder);
    setEditingName(folder.name);
    setSelectedCompanies(folder?.companies || []);
    setSearchTerm("");
    setFilteredCompanies([]);
  };

  const saveEdit = async () => {
    const loadingToast = toast.loading("Updating folder...");

    try {
      await API.put(`/company-folders/${editingFolder._id}`, {
        name: editingName,
        companies: selectedCompanies.map((c) => c._id),
      });
      setEditingFolder(null);
      setSelectedCompanies([]);
      setSearchTerm("");
      toast.success("Folder updated successfully", { id: loadingToast });
      fetchFolders();
    } catch (error) {
      if (error.response?.status === 402) {
        toast.error(error.response?.data?.message || "An active subscription is required to make changes.", { id: loadingToast });
      } else {
        toast.error(error.response?.data?.error || "Failed to update folder", { id: loadingToast });
      }
    }
  };

  const deleteFolder = async (id) => {
    if (!window.confirm("Are you sure you want to delete this folder?")) return;

    const loadingToast = toast.loading("Deleting folder...");

    try {
      await API.delete(`/company-folders/${id}`);
      toast.success("Folder deleted successfully", { id: loadingToast });
      fetchFolders();
    } catch (error) {
      if (error.response?.status === 402) {
        toast.error(error.response?.data?.message || "An active subscription is required to make changes.", { id: loadingToast });
      } else {
        toast.error(error.response?.data?.error || "Failed to delete folder", { id: loadingToast });
      }
    }
  };

  const toggleCompany = (companyObj) => {
    setSelectedCompanies((prev) =>
      prev.some((c) => c._id === companyObj._id)
        ? prev.filter((c) => c._id !== companyObj._id)
        : [...prev, companyObj],
    );
  };

  const removeSelectedCompany = (companyId) => {
    setSelectedCompanies((prev) => prev.filter((c) => c._id !== companyId));
  };

  const toggleFolder = (folderId) => {
    setOpenFolderIds((prev) =>
      prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId]
    );
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header - Mobile Responsive */}
      <div className="bg-gradient-to-r from-slate-50 to-gray-50 px-4 sm:px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
            <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              Company Hotlists
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">
              Organize companies into custom folders
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {/* Create New Folder - Mobile Responsive */}
        <div className="bg-gray-50 rounded-lg p-4 sm:p-5 mb-4 sm:mb-6 border border-gray-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-3">
            <Plus className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
              Create New Folder
            </h3>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
              placeholder="Enter folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && createFolder()}
            />
            <button
              onClick={createFolder}
              className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 font-medium flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <Plus className="h-4 w-4" />
              Create
            </button>
          </div>
        </div>

        {/* Folders List - Mobile Responsive */}
        <div className="space-y-3 sm:space-y-4">
          {folders?.map((folder) => (
            <div
              key={folder._id}
              className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Folder Header - Mobile Responsive */}
              <div className="bg-white p-3 sm:p-4">
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => toggleFolder(folder._id)}
                    className="flex items-center gap-2 sm:gap-3 text-left hover:text-blue-600 transition-colors group flex-1 min-w-0"
                  >
                    {openFolderIds.includes(folder._id) ? (
                      <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                        {folder.name}
                      </h4>
                      <p className="text-xs sm:text-sm text-gray-500">
                        {folder.companies?.length || 0} companies
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 sm:gap-2 ml-2">
                    <button
                      onClick={() => startEdit(folder)}
                      className="p-1.5 sm:p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Edit3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                    <button
                      onClick={() => deleteFolder(folder._id)}
                      className="p-1.5 sm:p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Folder Content - Mobile Responsive */}
              {openFolderIds.includes(folder._id) && (
                <div className="border-t border-gray-100 bg-gray-50 p-3 sm:p-4">
                  {folder.companies?.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {folder.companies.map((company) => (
                        <Link
                          key={company._id}
                          to={`/companies/${company._id}`}
                          className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all group"
                        >
                          <div className="flex items-start gap-2 sm:gap-3">
                            <div className="p-1.5 sm:p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors flex-shrink-0">
                              <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h5 className="font-medium text-gray-900 truncate text-sm sm:text-base">
                                {company.name || "Unnamed Company"}
                              </h5>
                              <div className="mt-1 space-y-1">
                                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                  <Briefcase className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">
                                    {company.industry || "N/A"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                  <MapPin className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">
                                    {company.address || "N/A"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 sm:py-8 text-gray-500">
                      <Building2 className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-gray-300 mb-3" />
                      <p className="text-sm">No companies in this folder</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {folders?.length === 0 && (
            <div className="text-center py-8 sm:py-12 text-gray-500">
              <Building2 className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                No folders yet
              </h3>
              <p className="text-sm">
                Create your first folder to start organizing companies
              </p>
            </div>
          )}
        </div>

        {/* Edit Mode Modal - Mobile Responsive */}
        {editingFolder && (
          <div
            className="fixed inset-0 z-[100002] bg-black/30 flex items-center justify-center sm:p-6 p-2"
            role="dialog"
            aria-modal="true"
            tabIndex="-1"
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditingFolder(null);
            }}
          >
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full h-full sm:h-[90vh] flex flex-col outline-none">
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-gray-200 flex-shrink-0 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 truncate">{`Edit: ${editingFolder.name}`}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Modify folder name and select companies
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingFolder(null);
                    setSelectedCompanies([]);
                    setSearchTerm("");
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  aria-label="Close modal"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              {/* Modal Content with own scroll */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                {/* Folder Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Folder Name
                  </label>
                  <input
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    autoFocus
                    maxLength={50}
                    aria-label="Folder name"
                  />
                </div>

                {/* Selected Companies */}
                {selectedCompanies.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Selected Companies ({selectedCompanies.length})
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {selectedCompanies.map((company) => (
                        <span
                          key={company._id}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
                        >
                          <span className="truncate max-w-[120px]">
                            {company.name || "Unknown"}
                          </span>
                          <button
                            onClick={() => removeSelectedCompany(company._id)}
                            className="hover:bg-blue-200 rounded-full p-0.5"
                            aria-label="Remove company"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search & Add Companies */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Add Companies
                  </label>
                  <div className="relative" ref={dropdownRef}>
                    <input
                      ref={searchInputRef}
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Search across all companies..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onFocus={() => setIsDropdownOpen(true)}
                      aria-label="Search companies"
                    />
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />

                    {isDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredCompanies.length ? (
                          filteredCompanies.map((company) => {
                            // ✅ CHANGED: Update check to look through the object array
                            const isSelected = selectedCompanies.some(
                              (c) => c._id === company._id,
                            );

                            return (
                              <button
                                key={company._id}
                                onClick={() => toggleCompany(company)}
                                className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                                  isSelected ? "bg-blue-50" : ""
                                }`}
                                type="button"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-medium text-gray-900 text-sm truncate">
                                      {company.name || "Unnamed Company"}
                                    </div>
                                    <div className="text-xs text-gray-600 mt-1 flex flex-col">
                                      {company.industry && (
                                        <span>
                                          Industry: {company.industry}
                                        </span>
                                      )}
                                      {company.address && (
                                        <span>Location: {company.address}</span>
                                      )}
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <Check className="h-4 w-4 text-blue-600" />
                                  )}
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-4 py-6 text-center text-gray-500">
                            <Search className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                            <p className="text-sm">
                              {searchTerm
                                ? "No companies found"
                                : "Start typing to search..."}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end flex-wrap">
                <button
                  onClick={() => {
                    setEditingFolder(null);
                    setSelectedCompanies([]);
                    setSearchTerm("");
                  }}
                  className="px-6 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  className={`px-6 py-2.5 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 ${
                    !editingName?.trim() ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                  type="button"
                  disabled={!editingName?.trim()}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Hotlist;
