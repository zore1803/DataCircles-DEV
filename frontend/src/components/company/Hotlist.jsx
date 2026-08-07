import React, { useEffect, useState, useCallback, useRef } from "react";
import API from "../../services/api";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import HighlightText from "../common/HighlightText";
import SearchIcon from "../common/SearchIcon";
import {
  Plus,
  Edit3,
  Trash2,
  X,
  Building2,
  MapPin,
  Briefcase,
  Check,
  Menu,
  ArrowLeft,
  List,
  LayoutGrid,
} from "lucide-react";

const FolderIcon = ({ className = "h-8 w-8" }) => (
  <svg viewBox="0 0 40 34" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="folderBack" x1="20" y1="2" x2="20" y2="34" gradientUnits="userSpaceOnUse">
        <stop stopColor="#5BB1E0" />
        <stop offset="0.35" stopColor="#0591DE" />
      </linearGradient>
      <linearGradient id="folderFront" x1="20" y1="10" x2="20" y2="32" gradientUnits="userSpaceOnUse">
        <stop stopColor="#73D7FF" />
        <stop offset="1" stopColor="#6BCBF3" />
      </linearGradient>
    </defs>
    <path
      d="M4 6C4 4.34315 5.34315 3 7 3H14.5C15.5 3 16.4 3.4 17.2 4.1L19 5.7C19.8 6.4 20.7 6.8 21.7 6.8H33C34.6569 6.8 36 8.14315 36 9.8V28C36 29.6569 34.6569 31 33 31H7C5.34315 31 4 29.6569 4 28V6Z"
      fill="url(#folderBack)"
    />
    <rect x="4" y="12" width="32" height="19" rx="4" fill="url(#folderFront)" />
  </svg>
);

/**
 * One company, in the "card" arrangement of an opened folder.
 *
 * Deliberately a <div> (not <Link>) wrapping the whole surface, with
 * navigation done via onClick + a button-guard, matching the row-click
 * pattern already used for Companies/Contacts/Tasks elsewhere in this app.
 * That's what makes adding an expandable task list here later a small,
 * additive change instead of a redesign: a <Link> wrapping the entire card
 * cannot legally contain nested interactive content (a future task list
 * would have its own buttons/checkboxes — invalid HTML inside <a>, and it
 * breaks click handling). A plain div with a guarded onClick has no such
 * ceiling — an expand chevron + a conditionally-rendered task block can be
 * dropped in below the existing content without touching the grid, the
 * search, or any other row/card.
 */
const FolderCompanyCard = ({ company, query, onOpen, onEdit, onRemove }) => (
  <div
    onClick={(e) => {
      if (e.target.closest("button") || e.target.closest("a")) return;
      onOpen(company._id);
    }}
    className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all group cursor-pointer"
  >
    <div className="flex items-start gap-2 sm:gap-3">
      <div className="p-1.5 sm:p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors flex-shrink-0">
        <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <h5 className="font-medium text-gray-900 truncate text-sm sm:text-base">
          <HighlightText text={company.name || "Unnamed Company"} query={query} />
        </h5>
        <div className="mt-1 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Briefcase className="h-3 w-3 flex-shrink-0" />
            <span className="truncate"><HighlightText text={company.industry || "N/A"} query={query} /></span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate"><HighlightText text={company.address || "N/A"} query={query} /></span>
          </div>
        </div>
      </div>

      {/* Always visible, not hover-only — same reasoning as the list row:
          hover-only actions are undiscoverable and don't work on touch. The
          card's onClick has a closest("button") guard, so these never also
          trigger navigation. */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onEdit(company._id)}
          className="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          title="Open company to edit"
        >
          <Edit3 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onRemove(company)}
          className="p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Remove from this hotlist"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
    {/* Reserved: an expand chevron + conditional task block belong here, as
        siblings of the row above — no change needed to this component's
        outer shape or the grid it sits in. */}
  </div>
);

/**
 * One company, in the "list" arrangement — a row in a div-based table (not
 * a literal <table>/<tr>), for the same forward-compatibility reason as
 * FolderCompanyCard above: a task block can be added as a sibling <div>
 * inside this row later without fighting table row/cell semantics.
 */
const FolderCompanyRow = ({ company, query, onOpen, onEdit, onRemove }) => (
  <div
    onClick={(e) => {
      if (e.target.closest("button") || e.target.closest("a")) return;
      onOpen(company._id);
    }}
    // No grid `gap` — cells carry their own padding and a right border instead,
    // so the vertical column dividers run edge-to-edge with no break between
    // them (a gap would leave the divider floating with blank space either
    // side, which is why this isn't just `gap-3` + `border-r`).
    className="grid grid-cols-[auto_1fr_1fr_1fr_auto] items-stretch hover:bg-gray-50 transition-colors group cursor-pointer"
  >
    <div className="flex items-center px-4 py-3 border-r border-gray-100">
      <div className="p-1.5 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors flex-shrink-0">
        <Building2 className="h-3.5 w-3.5 text-blue-600" />
      </div>
    </div>
    <div className="flex items-center px-4 py-3 border-r border-gray-100 min-w-0">
      <span className="font-medium text-gray-900 text-sm truncate">
        <HighlightText text={company.name || "Unnamed Company"} query={query} />
      </span>
    </div>
    <div className="flex items-center gap-1.5 px-4 py-3 border-r border-gray-100 min-w-0 text-xs text-gray-600">
      <Briefcase className="h-3 w-3 flex-shrink-0" />
      <span className="truncate"><HighlightText text={company.industry || "N/A"} query={query} /></span>
    </div>
    <div className="flex items-center gap-1.5 px-4 py-3 border-r border-gray-100 min-w-0 text-xs text-gray-600">
      <MapPin className="h-3 w-3 flex-shrink-0" />
      <span className="truncate"><HighlightText text={company.address || "N/A"} query={query} /></span>
    </div>

    {/* Actions — always visible now, not hover-only. Hover-only buttons are
        undiscoverable (you can't tell the action exists until you happen to
        mouse over the row) and unusable on touch, where there is no hover. */}
    <div className="flex items-center gap-1 px-3 py-3 flex-shrink-0">
      <button
        onClick={() => onEdit(company._id)}
        className="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        title="Open company to edit"
      >
        <Edit3 className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => onRemove(company)}
        className="p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
        title="Remove from this hotlist"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
);

const Hotlist = () => {
  const [folders, setFolders] = useState([]);
  const [folderSearchTerm, setFolderSearchTerm] = useState("");
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  // Drill-down: which folder's contents currently take over the page (null =
  // showing the folder grid). Holds the folder's _id — the object itself is
  // looked up fresh from `folders` on every render, so it stays in sync if
  // the folder is edited (companies added/removed) while it's open.
  const navigate = useNavigate();
  const [openFolderId, setOpenFolderId] = useState(null);
  const [folderViewMode, setFolderViewMode] = useState("card"); // "card" | "list"
  // Search scoped to the companies inside whichever folder is currently open —
  // separate from folderSearchTerm, which searches the folder GRID. Reset
  // whenever a different folder opens so a stale query doesn't silently
  // filter the next folder's contents.
  const [companySearchTerm, setCompanySearchTerm] = useState("");
  useEffect(() => {
    setCompanySearchTerm("");
  }, [openFolderId]);

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
      setShowCreateFolder(false);
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

  // Removes a company FROM THIS HOTLIST FOLDER only — it does NOT delete the
  // company record from the CRM. A hotlist is a saved shortlist, so "remove"
  // here means "take it off this list"; the company, its deals, contacts and
  // history are all untouched and it still exists on the Companies page.
  // Deleting the actual company record from a shortlist view would be a
  // surprising and destructive default, so that is deliberately not what this
  // does. Uses the existing PUT /company-folders/:id/remove-company endpoint.
  const removeCompanyFromFolder = async (folderId, company) => {
    if (
      !window.confirm(
        `Remove "${company.name || "this company"}" from this hotlist?\n\nThis only takes it off the list — the company itself is not deleted.`,
      )
    )
      return;

    const loadingToast = toast.loading("Removing from hotlist...");

    try {
      await API.put(`/company-folders/${folderId}/remove-company`, {
        companyId: company._id,
      });
      toast.success("Removed from hotlist", { id: loadingToast });
      fetchFolders();
    } catch (error) {
      if (error.response?.status === 402) {
        toast.error(error.response?.data?.message || "An active subscription is required to make changes.", { id: loadingToast });
      } else {
        toast.error(error.response?.data?.error || "Failed to remove from hotlist", { id: loadingToast });
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

  useEffect(() => {
    fetchFolders();
  }, []);

  // Was matching ONLY folder.name, even though the placeholder says "Search
  // by companies by name, industry, or location..." — typing a company name,
  // industry, or address here matched nothing, because it never looked at
  // the folder's companies at all. Now a folder stays visible if its own
  // name matches OR any company inside it matches on name/industry/address.
  const folderQuery = folderSearchTerm.trim().toLowerCase();
  const visibleFolders = folders?.filter((folder) => {
    if (!folderQuery) return true;
    if (folder.name.toLowerCase().includes(folderQuery)) return true;
    return (folder.companies || []).some((c) =>
      [c.name, c.industry, c.address].some((field) =>
        field?.toLowerCase().includes(folderQuery),
      ),
    );
  });

  // Looked up by id (not stored as the object itself) so it stays in sync if
  // `folders` refetches while this one happens to be open.
  const openFolder = folders?.find((f) => f._id === openFolderId) || null;

  // Computed once, rendered from BOTH the drill-down view and the folder
  // grid below — this used to live only inside the grid's own JSX, so it was
  // completely unreachable from the drill-down view (an early return that
  // never got to that code). Same instance either way; no duplicated modal.
  const editFolderModal = editingFolder && (
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
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#525866]" />

              {isDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredCompanies.length ? (
                    filteredCompanies.map((company) => {
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
                                  <span>Industry: {company.industry}</span>
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
                      <SearchIcon className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                      <p className="text-sm">
                        {searchTerm ? "No companies found" : "Start typing to search..."}
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
  );

  // Drill-down: opening a folder replaces the whole grid with a dedicated
  // workspace for just that folder — not an inline accordion, and not a
  // horizontal scroll strip. Everything below wraps/stacks vertically; the
  // page itself scrolls normally for large folders (100+ companies), same
  // as every other list in this app — no virtualization, no internal
  // scroll cap, consistent with how the folder grid above already behaves.
  if (openFolder) {
    const query = companySearchTerm.trim();
    const q = query.toLowerCase();
    const visibleCompanies = (openFolder.companies || []).filter((c) => {
      if (!q) return true;
      return [c.name, c.industry, c.address].some((field) =>
        field?.toLowerCase().includes(q),
      );
    });

    return (
      <>
      <div className="mx-4 mt-6 space-y-4">
        {/* Workspace navbar: Back + folder name, search, List/Card toggle,
            Add Companies — wraps to a second line on narrow widths rather
            than ever scrolling sideways. */}
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-5">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
              <button
                onClick={() => setOpenFolderId(null)}
                className="flex items-center gap-1.5 h-9 px-3 rounded-full border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900 truncate">{openFolder.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {q
                    ? `${visibleCompanies.length} of ${openFolder.companies?.length || 0} compan${(openFolder.companies?.length || 0) === 1 ? "y" : "ies"}`
                    : `${openFolder.companies?.length || 0} compan${(openFolder.companies?.length || 0) === 1 ? "y" : "ies"}`}
                </p>
              </div>
            </div>

            <div className="relative flex-1 min-w-[200px]">
              <SearchIcon className="absolute left-3 -translate-y-1/2 top-1/2 w-4 h-4 text-[#525866]" />
              <input
                className="w-full h-10 pl-11 pr-4 border border-gray-200 rounded-full text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="Search this folder by name, industry, or location..."
                value={companySearchTerm}
                onChange={(e) => setCompanySearchTerm(e.target.value)}
              />
            </div>

            {/* List / Card Toggle — same pill pattern as Deals' List/Kanban toggle */}
            <div className="relative flex items-center bg-gray-100 rounded-full p-1 flex-shrink-0 overflow-hidden">
              <span
                className="absolute top-1 w-8 h-8 rounded-full bg-white shadow-sm transition-all duration-300 ease-out pointer-events-none"
                style={{ left: folderViewMode === "list" ? 36 : 4 }}
              />
              <button
                onClick={() => setFolderViewMode("card")}
                className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full transition-colors ${folderViewMode === "card" ? "text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                title="Card View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setFolderViewMode("list")}
                className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full transition-colors ${folderViewMode === "list" ? "text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Was only reachable via the pencil icon back on the folder grid
                — this drill-down view had no way to add companies to the
                folder you're actually looking at. Reuses the exact same
                edit/add flow (startEdit -> editFolderModal), just triggered
                from here too. */}
            <button
              onClick={() => startEdit(openFolder)}
              className="flex items-center gap-1.5 h-10 px-4 rounded-full bg-[#0085FF] text-white text-sm font-medium hover:bg-blue-600 transition-colors flex-shrink-0"
            >
              <Plus className="h-4 w-4" />
              Add Companies
            </button>
          </div>
        </div>

        {/* No outer white card wrapper here any more. The list/grid used to sit
            inside `bg-white rounded-xl border p-6`, which put a bordered box
            inside another bordered box — a visible double frame with dead
            padding between them, and it stretched full-height regardless of
            content. Now each view supplies its own single surface, so the
            content reads as sitting on the page background rather than in a
            nested panel. */}
        {!openFolder.companies || openFolder.companies.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 text-center py-10 sm:py-14 px-6 text-gray-500">
            <Building2 className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No companies in this folder</h3>
            <p className="text-sm mb-4">Add companies to this folder to get started.</p>
            <button
              onClick={() => startEdit(openFolder)}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-[#0085FF] text-white text-sm font-medium hover:bg-blue-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Companies
            </button>
          </div>
        ) : visibleCompanies.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 text-center py-10 sm:py-14 px-6 text-gray-500">
            <SearchIcon className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-sm">No companies in this folder match "{companySearchTerm}".</p>
          </div>
        ) : folderViewMode === "card" ? (
          // Wrapping grid — reads left-to-right, top-to-bottom, wraps to a new
          // row instead of scrolling sideways. 1/2/3/4 columns as the viewport
          // widens, so a 100+ company folder is just a taller page (normal
          // vertical scroll), never a wider one. Cards are their own surfaces,
          // so there's no wrapper panel behind them.
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {visibleCompanies.map((company) => (
              <FolderCompanyCard
                key={company._id}
                company={company}
                query={query}
                onOpen={(id) => navigate(`/companies/${id}`)}
                onEdit={(id) => navigate(`/companies/${id}`)}
                onRemove={(c) => removeCompanyFromFolder(openFolder._id, c)}
              />
            ))}
          </div>
        ) : (
          // Clean vertical list with a proper header row. Div-based, not a
          // literal <table> — see FolderCompanyRow's comment for why. This
          // bordered container IS the single surface now.
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Header cell structure mirrors FolderCompanyRow exactly — same
                column template, same per-cell padding, same right borders — so
                the vertical dividers line up continuously from header through
                every row. */}
            <div className="hidden sm:grid grid-cols-[auto_1fr_1fr_1fr_auto] items-stretch bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span className="px-4 py-2.5 border-r border-gray-200 w-[26px] box-content" />
              <span className="px-4 py-2.5 border-r border-gray-200">Company</span>
              <span className="px-4 py-2.5 border-r border-gray-200">Industry</span>
              <span className="px-4 py-2.5 border-r border-gray-200">Location</span>
              <span className="px-3 py-2.5">Actions</span>
            </div>
            <div className="divide-y divide-gray-100">
              {visibleCompanies.map((company) => (
                <FolderCompanyRow
                  key={company._id}
                  company={company}
                  query={query}
                  onOpen={(id) => navigate(`/companies/${id}`)}
                  onEdit={(id) => navigate(`/companies/${id}`)}
                  onRemove={(c) => removeCompanyFromFolder(openFolder._id, c)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      {editFolderModal}
      </>
    );
  }

  return (
    <>
    <div className="mx-4 mt-6 space-y-4">
      {/* Header Card */}
      <div className="bg-white rounded-xl border border-gray-200 px-6 py-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Company Hotlists</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Organise your companies into custom folders
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-[320px] max-w-full">
              <SearchIcon className="absolute left-3 -translate-y-1/2 top-1/2 w-4 h-4 text-[#525866]" />
              <input
                className="w-full h-10 pl-11 pr-4 border border-gray-200 rounded-full text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="Search by companies by name, industry, or location..."
                value={folderSearchTerm}
                onChange={(e) => setFolderSearchTerm(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowCreateFolder((prev) => !prev)}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-[#0085FF] text-white text-sm font-medium rounded-full hover:bg-blue-600 transition-colors flex-shrink-0"
            >
              <Plus className="h-4 w-4" />
              New Folder
            </button>
          </div>
        </div>

        {showCreateFolder && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
            <input
              className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
              placeholder="Enter folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && createFolder()}
              autoFocus
            />
            <button
              onClick={createFolder}
              className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 font-medium flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <Plus className="h-4 w-4" />
              Create
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        {/* Folders List - Mobile Responsive */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {visibleFolders?.map((folder) => (
            <div key={folder._id} className="relative group">
              {/* Folder Tile — clicking it drills into the full-page view above,
                  it no longer expands inline here. */}
              <div className="absolute -top-1 right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => startEdit(folder)}
                  className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => deleteFolder(folder._id)}
                  className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Was `hover:opacity-80` only — a much weaker cue than the
                  card-style hover (border + shadow) already used one level
                  down for the companies inside a folder (line ~278). Matched
                  it here: border/shadow/bg lift on hover, plus the icon gets
                  a subtle scale so the tile reads as clickable, not just
                  dimming like a disabled control. */}
              <button
                onClick={() => setOpenFolderId(folder._id)}
                className="flex flex-col items-center text-center w-full pt-3 pb-2 px-2 rounded-xl border border-transparent hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-sm transition-all"
              >
                <FolderIcon className="h-14 w-14 transition-transform group-hover:scale-105" />
                <h4 className="mt-2 font-semibold text-gray-900 text-sm truncate max-w-full">
                  <HighlightText text={folder.name} query={folderSearchTerm} />
                </h4>
                <p className="text-xs text-gray-500">
                  {folder.companies?.length || 0} companies
                </p>
              </button>
            </div>
          ))}

          {visibleFolders?.length === 0 && (
            <div className="text-center py-8 sm:py-12 text-gray-500">
              <Building2 className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                {folders?.length === 0 ? "No folders yet" : "No folders match your search"}
              </h3>
              <p className="text-sm">
                {folders?.length === 0
                  ? "Create your first folder to start organizing companies"
                  : "Try a different search term"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
    {editFolderModal}
    </>
  );
};

export default Hotlist;
