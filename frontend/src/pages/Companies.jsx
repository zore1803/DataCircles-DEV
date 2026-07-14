import React, { useEffect, useState, useMemo, useRef } from "react";
import API from "../services/api";
import { Link } from "react-router-dom";
import logo from "/DataCircles.png";
import {
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Upload,
  Building2,
  MapPin,
  Briefcase,
  Globe,
  Edit2,
  Trash2,
  FileText,
  CheckSquare,
  MoreVertical,
  ChevronDown as ExpandIcon,
  ChevronUp as CollapseIcon,
  Settings,
  FolderPlus,
  Download,
  StickyNote,
  MoreHorizontal,
  Eye,
  Pin,
  PinOff,
  Star
} from "lucide-react";
import ImportClients from "../components/company/ImportClients";
import Hotlist from "../components/company/Hotlist";
import BulkActions from "../components/BulkActions";
import CompanyForm from "../components/company/CompanyForm";
import ProfilePicture from "../components/contact/ProfilePicture";
import VideoTutorialModal from "../components/VideoTutorialModal";
import VideoTutorialButton from "../components/VideoTutorialButton";
import ColumnSettingsPanel from "../components/ColumnSettingsPanel";
import { useColumnSettings } from "../hooks/useColumnSettings";
import { useLocation } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { getVideoTutorial } from "../utils/videoTutorials";
import AdvancedFilterPanel from "../components/common/AdvancedFilterPanel";
import useCompanyStore from "../store/useCompanyStore";
import AddToCompanyHotlistModal from "../components/company/AddToCompanyHotlistModal";
import ExportModal from "../components/common/ExportModal";
import { NoteEditor } from "../components/company/NoteSection";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import CompanyQuickView from "../components/company/CompanyQuickView";

function Companies() {
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({
    name: "",
    industry: "",
    address: "",
    website: "",
    gstin: "",
    profilePicture: null,
    profilePictureUrl: "",
  });
  const [additionalFields, setAdditionalFields] = useState({});
  const [companyFieldNames, setCompanyFieldNames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [industries, setIndustries] = useState([]);
  const [industriesLoading, setIndustriesLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showHotlist, setShowHotlist] = useState(false);
  const [permission, setPermission] = useState("");
  const [isIndustryDropdownOpen, setIsIndustryDropdownOpen] = useState(false);
  const [showAddToHotlistModal, setShowAddToHotlistModal] = useState(false);
  const industryDropdownRef = useRef(null);
  const location = useLocation();
  const { state } = location;

  const [showBulkNoteModal, setShowBulkNoteModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [taggedContacts, setTaggedContacts] = useState([]);
  const [allContacts, setAllContacts] = useState([]); // Needed for the tagging dropdown

  // Video Tutorial State
  const [showVideoTutorial, setShowVideoTutorial] = useState(false);

  // Column Settings State
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  const [quickViewCompanyId, setQuickViewCompanyId] = useState(null);

  // Advanced Filter state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Bulk selection
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(true);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [expandedRows, setExpandedRows] = useState([]);

  const [columnSizing, setColumnSizing] = useState({});

  const [pinnedColumn, setPinnedColumn] = useState(null);

  const [starredCompanies, setStarredCompanies] = useState(() => {
    const saved = localStorage.getItem("starred_companies");
    return saved ? JSON.parse(saved) : [];
  });

  // Sync to local storage whenever it changes
  useEffect(() => {
    localStorage.setItem("starred_companies", JSON.stringify(starredCompanies));
  }, [starredCompanies]);

  const toggleStar = (e, companyId) => {
    e.stopPropagation(); // Prevents row selection or expansion
    setStarredCompanies((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId]
    );
  };

  const togglePinColumn = (colKey) => {
    setPinnedColumn((prev) => (prev === colKey ? null : colKey));
  };

  const {
    searchTerm,
    setSearchTerm,
    filterIndustry,
    setFilterIndustry,
    activeFilters,
    setActiveFilters,
    pagination,
    setPagination,
    sortConfig,
    setSortConfig,
    setCurrentCompanyIds,
  } = useCompanyStore();

  // Define default columns - NOW UPDATES WHEN companyFieldNames CHANGES
  const defaultColumns = useMemo(() => {
    const baseColumns = [
      {
        key: "name",
        label: "Company Name",
        visible: true,
        order: 0,
        required: true,
        defaultVisible: true,
        sortable: true,
        icon: Building2,
      },
      {
        key: "industry",
        label: "Industry",
        visible: true,
        order: 1,
        sortable: true,
        icon: Briefcase,
      },
      {
        key: "address",
        label: "Location",
        visible: true,
        order: 2,
        icon: MapPin,
      },
      {
        key: "website",
        label: "Website",
        visible: true,
        order: 3,
        icon: Globe,
      },
      {
        key: "gstin",
        label: "GSTIN",
        visible: true,
        order: 4,
        sortable: true,
        icon: FileText,
      },
    ];

    // Add custom fields ONLY if they exist
    if (companyFieldNames && companyFieldNames.length > 0) {
      const customColumns = companyFieldNames.map((field, index) => ({
        key: field.name || field,
        label: field.name || field,
        visible: false, // Hidden by default - user can show them
        order: baseColumns.length + index,
        isCustomField: true,
        type: field.type || "text",
        options: field.options,
        description: `Custom field: ${field.name || field}`,
      }));

      return [...baseColumns, ...customColumns];
    }

    return baseColumns;
  }, [companyFieldNames]); // Re-run when companyFieldNames changes

  // Use column settings hook
  const { columns, saveColumns, getVisibleColumns } = useColumnSettings(
    "companies",
    defaultColumns,
  );

  const visibleColumns = useMemo(() => getVisibleColumns(), [columns]);

  const columnHelper = createColumnHelper();

  // Sort companies so that starred ones always appear at the top
  const sortedCompanies = useMemo(() => {
    if (!companies || companies.length === 0) return [];
    const dataCopy = [...companies];
    return dataCopy.sort((a, b) => {
      const isAStarred = starredCompanies.includes(a._id);
      const isBStarred = starredCompanies.includes(b._id);
      if (isAStarred && !isBStarred) return -1;
      if (!isAStarred && isBStarred) return 1;
      return 0;
    });
  }, [companies, starredCompanies]);

  const tableColumns = useMemo(() => {
    const cols = [];

    // 1. Checkbox Column
    if (selectionMode) {
      cols.push(
        columnHelper.display({
          id: "selection",
          size: 60,
          enableResizing: false,
          header: () => (
            <div className="flex justify-center items-center w-full">
              <input
                type="checkbox"
                checked={
                  selectedCompanies.length === companies.length &&
                  companies.length > 0
                }
                onChange={handleSelectAll}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
              />
            </div>
          ),
          cell: ({ row }) => (
            <div className="flex justify-center items-center w-full">
              <input
                type="checkbox"
                checked={selectedCompanies.includes(row.original._id)}
                onChange={() => handleSelectCompany(row.original._id)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
              />
            </div>
          ),
        }),
      );
    }


    cols.push(
      columnHelper.display({
        id: "star",
        size: 40,
        enableResizing: false,
        header: () => (
          <div className="flex justify-center items-center w-full">
            <Star className="w-4 h-4 text-gray-400" />
          </div>
        ),
        cell: ({ row }) => {
          const isStarred = starredCompanies.includes(row.original._id);
          return (
            <div className="flex justify-center items-center w-full">
              <button
                onClick={(e) => toggleStar(e, row.original._id)}
                className="focus:outline-none hover:scale-110 transition-transform"
                title={isStarred ? "Unstar" : "Star"}
              >
                <Star
                  className={`w-4 h-4 transition-colors ${isStarred
                    ? "text-yellow-400 fill-yellow-400"
                    : "text-gray-300 hover:text-yellow-400"
                    }`}
                />
              </button>
            </div>
          );
        },
      })
    );

    // --- ACTIONS COLUMN DEFINITION ---
    const isActionsPinned = pinnedColumn === "actions";
    const actionsColumnDef = columnHelper.display({
      id: "actions",
      size: 100,
      enableResizing: false,
      header: () => (
        <div
          className="flex items-center justify-between w-full group select-none cursor-pointer"
          onDoubleClick={(e) => {
            e.stopPropagation();
            togglePinColumn("actions");
          }}
        >
          <span>Actions</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePinColumn("actions");
            }}
            className={`ml-2 p-1 rounded hover:bg-gray-200 transition-opacity flex-shrink-0 ${isActionsPinned
              ? "opacity-100 text-blue-600"
              : "opacity-0 group-hover:opacity-100 text-gray-400"
              }`}
            title={isActionsPinned ? "Unpin Column" : "Pin Column"}
          >
            {isActionsPinned ? (
              <PinOff className="w-3.5 h-3.5" />
            ) : (
              <Pin className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(row.original);
            }}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(row.original._id);
            }}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    });

    // If Actions is pinned, it goes immediately after the selection checkbox
    if (isActionsPinned) {
      cols.push(actionsColumnDef);
    }

    // 2. Dynamic Data Columns
    const pinnedFields = visibleColumns.filter((vc) => vc.key === pinnedColumn);
    const unpinnedFields = visibleColumns.filter((vc) => vc.key !== pinnedColumn);

    [...pinnedFields, ...unpinnedFields].forEach((vc) => {
      cols.push(
        columnHelper.accessor((row) => getFieldValue(row, vc.key), {
          id: vc.key,
          size: vc.key === "name" ? 220 : vc.key === "address" ? 250 : 150,
          header: () => {
            const Icon = vc.icon;
            const isSortable = vc.sortable !== false;
            const isPinned = pinnedColumn === vc.key;

            return (
              <div
                className={`flex items-center justify-between w-full group ${isSortable ? "cursor-pointer select-none" : ""
                  }`}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  togglePinColumn(vc.key);
                }}
              >
                <div
                  className="flex items-center gap-2 flex-1 min-w-0"
                  onClick={() => isSortable && handleSort(vc.key)}
                >
                  {Icon && <Icon className="w-4 h-4 inline flex-shrink-0" />}
                  <span className="truncate" title={vc.label}>
                    {vc.label}
                  </span>
                  {isSortable && (
                    <div className="flex flex-col ml-1 flex-shrink-0">
                      <ChevronUp
                        className={`w-3 h-3 ${sortConfig.key === vc.key && sortConfig.direction === "asc"
                          ? "text-blue-600"
                          : "text-gray-400"
                          }`}
                      />
                      <ChevronDown
                        className={`w-3 h-3 -mt-1 ${sortConfig.key === vc.key && sortConfig.direction === "desc"
                          ? "text-blue-600"
                          : "text-gray-400"
                          }`}
                      />
                    </div>
                  )}
                </div>

                {/* Pin Icon */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePinColumn(vc.key);
                  }}
                  className={`ml-2 p-1 rounded hover:bg-gray-200 transition-opacity flex-shrink-0 ${isPinned
                    ? "opacity-100 text-blue-600"
                    : "opacity-0 group-hover:opacity-100 text-gray-400"
                    }`}
                  title={isPinned ? "Unpin Column" : "Pin Column"}
                >
                  {isPinned ? (
                    <PinOff className="w-3.5 h-3.5" />
                  ) : (
                    <Pin className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            );
          },
          cell: ({ row, getValue }) => {
            // ... Keep all your existing cell rendering logic here exactly as it is ...
            const company = row.original;
            const isExpanded = expandedRows.includes(company._id);
            const val = getValue();

            if (vc.key === "name") {
              // ... your existing name cell logic
              return (
                <div className="flex items-center justify-between w-full group relative">
                  <div className="truncate flex-1 pr-4">
                    <Link
                      to={`/companies/${company._id}`}
                      className="text-blue-600 font-semibold hover:underline truncate transition-all duration-150 ease-out group-hover:text-blue-700"
                      title={company.name}
                    >
                      {company.name}
                    </Link>
                  </div>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-150 ease-out pointer-events-none group-hover:pointer-events-auto bg-white/80 backdrop-blur-[2px] rounded-lg">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setQuickViewCompanyId(company._id);
                      }}
                      className="p-1.5 rounded-md bg-white shadow-sm border border-gray-200 hover:bg-blue-50 text-blue-600 transition-colors"
                      title="Quick view"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(company);
                      }}
                      className="p-1.5 rounded-md hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition-all duration-150 transform hover:scale-110 active:scale-95"
                      title="Edit Company"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(company._id);
                      }}
                      className="p-1.5 rounded-md hover:bg-red-50 text-gray-500 hover:text-red-600 transition-all duration-150 transform hover:scale-110 active:scale-95"
                      title="Delete Company"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            }
            if (vc.key === "industry") {
              return <div className="truncate text-sm text-gray-700 capitalize font-medium" title={company.industry}>{company.industry || "—"}</div>;
            }
            if (vc.key === "address") {
              const address = company.address;
              return (
                <div className="flex items-center gap-2 w-full">
                  <div className={`${isExpanded ? "whitespace-normal" : "truncate"} text-sm text-gray-700`} title={address}>
                    {isExpanded ? address || "—" : truncateText(address, 30)}
                  </div>
                  {address && address.length > 30 && (
                    <button onClick={(e) => { e.stopPropagation(); toggleExpandRow(company._id); }} className="text-blue-600 hover:text-blue-700 flex-shrink-0">
                      {isExpanded ? <CollapseIcon className="w-4 h-4" /> : <ExpandIcon className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              );
            }
            if (vc.key === "website") {
              return company.website ? (
                <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate block w-full" title={company.website}>{company.website}</a>
              ) : <span className="text-sm text-gray-400">—</span>;
            }
            if (vc.key === "gstin") {
              return <div className="truncate text-sm text-gray-700 font-mono w-full" title={company.gstin}>{company.gstin || "—"}</div>;
            }
            return <div className="truncate text-sm text-gray-700 w-full" title={String(val)}>{truncateText(String(val), 30)}</div>;
          },
        })
      );
    });

    // 3. If Actions is NOT pinned, push it at the end (its normal position)
    if (!isActionsPinned) {
      cols.push(actionsColumnDef);
    }


    return cols;
  }, [
    selectionMode,
    visibleColumns,
    selectedCompanies,
    sortedCompanies,
    sortConfig,
    expandedRows,
    pinnedColumn,
    starredCompanies
  ]);

  const table = useReactTable({
    data: sortedCompanies,
    columns: tableColumns,
    state: { columnSizing },
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
  });

  const handleDelete = async (companyId) => {
    setCompanyToDelete(companyId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!companyToDelete) return;

    const loadingToast = toast.loading("Deleting company...");

    try {
      setLoading(true);
      await API.delete(`/companies/${companyToDelete}`);
      await fetchCompanies();
      toast.success("Company deleted successfully!", { id: loadingToast });
    } catch (err) {
      let errorMessage = "Failed to delete company";
      if (err.response && err.response.status === 402) {
        errorMessage = err.response.data.message || "An active subscription is required to make changes.";
      } else if (err.response && err.response.status === 403) {
        errorMessage = err.response.data.message || "Access denied";
      }
      toast.error(errorMessage, { id: loadingToast });
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
      setCompanyToDelete(null);
    }
  };

  // Long press handlers
  const handleMouseDown = (companyId) => {
    const timer = setTimeout(() => {
      setSelectionMode(true);
      handleSelectCompany(companyId);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleMouseUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleTouchStart = (companyId) => {
    const timer = setTimeout(() => {
      setSelectionMode(true);
      handleSelectCompany(companyId);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // Toggle expanded row
  const toggleExpandRow = (companyId) => {
    setExpandedRows((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId],
    );
  };

  // Truncate text
  const truncateText = (text, maxLength = 30) => {
    if (!text) return "—";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  // Exit selection mode
  const exitSelectionMode = () => {
    setSelectionMode(true);
    setSelectedCompanies([]);
  };

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination((prev) => ({ ...prev, currentPage: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, filterIndustry]);

  // Fetch data when dependencies change
  useEffect(() => {
    fetchCompanies();
  }, [pagination.currentPage, pagination.limit, sortConfig]);

  const fetchAllContacts = async () => {
    try {
      const res = await API.get("/contacts");
      setAllContacts(res.data);
    } catch (err) {
      console.error("Failed to load contacts for notes");
    }
  };

  // Separate effect for search/filter to trigger reset + fetch
  useEffect(() => {
    if (pagination.currentPage === 1) {
      fetchCompanies();
    }
  }, [searchTerm, filterIndustry]);

  // INITIALIZE: Fetch field names first
  useEffect(() => {
    const initialize = async () => {
      await fetchCompanyFieldNames(); // Wait for this to complete
      await fetchUser();
      await fetchIndustries(); // Fetch industries
      await fetchAllContacts();
    };
    initialize();
  }, []);

  const fetchUser = async () => {
    try {
      const res = await API.get("/auth/me");
      const user = res.data;
      const userPerm = user?.user?.permissions?.find(
        (p) => p.name.toLowerCase() === "companies",
      );
      setPermission(userPerm?.permission || "no");
    } catch {
      setPermission("no");
      toast.error("Failed to fetch user permissions");
    }
  };

  const fetchCompanyFieldNames = async () => {
    try {
      const res = await API.get("/company-fields");
      if (res.data) {
        const fields = res.data.fields || [];
        console.log("✅ Fetched custom fields:", fields);
        setCompanyFieldNames(fields);
      }
    } catch (err) {
      console.error("Failed to fetch company fields");
      toast.error("Failed to fetch company fields");
    }
  };

  const fetchIndustries = async () => {
    try {
      setIndustriesLoading(true);

      // Default system industries
      const defaultIndustries = [
        "Information Technology & Services",
        "Finance & Banking",
        "Healthcare & Pharmaceuticals",
        "Education & EdTech",
        "Retail & E-Commerce",
        "Manufacturing",
        "Real Estate",
        "Marketing & Advertising",
        "Travel & Hospitality",
        "Nonprofit / Government / Public Sector",
      ];

      // Fetch custom industries from API
      const res = await API.get("/company-industries");
      let customIndustries = [];

      if (res.data) {
        // Get custom industries (filter out default ones from API)
        const custom = res.data.filter((ind) => !ind.isDefault) || [];
        customIndustries = custom.map((ind) => ind.name);
      }

      // Combine default and custom industries, remove duplicates, and sort
      const allIndustries = [
        ...new Set([...defaultIndustries, ...customIndustries]),
      ].sort();
      setIndustries(allIndustries);
    } catch (err) {
      console.error("Failed to fetch industries", err);
      toast.error("Failed to fetch industries");
    } finally {
      setIndustriesLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.currentPage.toString(),
        limit: pagination.limit.toString(),
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction,
      });

      if (searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }
      if (filterIndustry) {
        params.append("industry", filterIndustry);
      }

      if (activeFilters && activeFilters.length > 0) {
        params.append("advancedFilters", JSON.stringify(activeFilters));
      }

      const res = await API.get(`/companies/pagination?${params.toString()}`);

      if (res.data.companies && res.data.pagination) {
        setCompanies(res.data.companies);
        setCurrentCompanyIds(res.data.companies.map((c) => c._id));
        setPagination((prev) => ({
          ...prev,
          currentPage: res.data.pagination.currentPage,
          totalPages: res.data.pagination.totalPages,
          totalCount: res.data.pagination.totalCount,
          hasNextPage: res.data.pagination.hasNextPage,
          hasPrevPage: res.data.pagination.hasPrevPage,
        }));
      } else {
        setCompanies(res.data || []);
      }
    } catch (err) {
      console.error("Error fetching companies:", err);
      if (err.response && err.response.status === 403) {
        toast.error(err.response.data.error || "Access denied");
      } else {
        toast.error("Failed to load companies");
      }
      setCompanies([]);
    } finally {
      setLoading(false);
      setShowImport(false);
    }
  };

  // Pagination handlers
  const handlePageChange = (newPage) => {
    if (
      newPage >= 1 &&
      newPage <= pagination.totalPages &&
      newPage !== pagination.currentPage
    ) {
      setPagination((prev) => ({ ...prev, currentPage: newPage }));
    }
  };

  const handleLimitChange = (newLimit) => {
    setPagination((prev) => ({
      ...prev,
      limit: newLimit,
      currentPage: 1,
    }));
  };

  // Sorting function
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  };

  // Bulk selection and actions
  const handleSelectAll = () => {
    if (selectedCompanies.length === companies.length) {
      setSelectedCompanies([]);
      setSelectionMode(true);
    } else {
      setSelectedCompanies(companies.map((c) => c._id));
      setSelectionMode(true);
    }
  };

  const handleSelectCompany = (companyId) => {
    setSelectedCompanies((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId],
    );
  };

  const handleBulkDeleteCompanies = async (itemIds) => {
    setBulkLoading(true);
    try {
      await Promise.all(itemIds.map((id) => API.delete(`/companies/${id}`)));
      await fetchCompanies();
      setSelectedCompanies([]);
      setShowBulkActions(false);
      setSelectionMode(false);
      toast.success(`Successfully deleted ${itemIds.length} companies`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Bulk delete failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const companyFieldConfig = {
    fields: [
      {
        key: "industry",
        label: "Industry",
        type: "text",
      },
      {
        key: "address",
        label: "Address",
        type: "text",
      },
      {
        key: "website",
        label: "Website",
        type: "text",
      },
      {
        key: "gstin",
        label: "GSTIN",
        type: "text",
      },
      ...companyFieldNames.map((field) => ({
        key: field.name || field,
        label: field.name || field,
        type: field.type || "text",
        isCustomField: true,
        options: field.options,
      })),
    ],
  };

  const handleBulkUpdateCompanies = async ({ field, value, itemIds }) => {
    setBulkLoading(true);
    try {
      await Promise.all(
        itemIds.map((id) => {
          let payload = {};
          if (companyFieldNames.some((f) => (f.name || f) === field)) {
            payload.additionalFields = [{ key: field, value }];
          } else {
            payload[field] = value;
          }
          return API.put(`/companies/${id}`, payload);
        }),
      );
      await fetchCompanies();
      setSelectedCompanies([]);
      setShowBulkActions(false);
      setSelectionMode(false);
      toast.success(`Successfully updated ${itemIds.length} companies`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Bulk update failed");
    } finally {
      setBulkLoading(false);
    }
  };

  // Handle saving the bulk note
  const handleBulkNoteSave = async () => {
    if (!noteContent.trim() || noteContent === "<p><br></p>") {
      toast.error("Note content is required");
      return;
    }

    setBulkLoading(true);
    const loadingToast = toast.loading(
      `Adding note to ${selectedCompanies.length} companies...`,
    );

    try {
      await API.post("/notes/bulk", {
        title: noteTitle,
        note: noteContent,
        companyIds: selectedCompanies,
        taggedContacts: taggedContacts.map((c) => c.value),
      });

      toast.success("Notes successfully added!", { id: loadingToast });

      // Reset and close
      setNoteTitle("");
      setNoteContent("");
      setTaggedContacts([]);
      setShowBulkNoteModal(false);
      exitSelectionMode(); // Deselect rows
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.", { id: loadingToast });
      } else {
        toast.error(err.response?.data?.error || "Failed to add notes", { id: loadingToast });
      }
    } finally {
      setBulkLoading(false);
    }
  };

  const getUniqueIndustries = () => {
    return industries; // Return the fetched industries
  };

  // Click outside listener for industry dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        industryDropdownRef.current &&
        !industryDropdownRef.current.contains(event.target)
      ) {
        setIsIndustryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Separate effect for advanced filters
  useEffect(() => {
    if (pagination.currentPage === 1) {
      fetchCompanies();
    } else {
      setPagination((prev) => ({ ...prev, currentPage: 1 }));
    }
  }, [activeFilters]);

  // Get field value from company
  const getFieldValue = (company, columnKey) => {
    // Check if it's a base field
    if (company[columnKey] !== undefined) {
      return company[columnKey];
    }

    // Check additional fields
    const additionalField = company.additionalFields?.find(
      (field) => field.key === columnKey,
    );
    return additionalField?.value || "—";
  };


  // Pagination component
  const PaginationControls = () => {
    const {
      currentPage,
      totalPages,
      totalCount,
      limit,
      hasNextPage,
      hasPrevPage,
    } = pagination;

    if (totalCount === 0) return null;

    const startItem = (currentPage - 1) * limit + 1;
    const endItem = Math.min(currentPage * limit, totalCount);

    const getPageNumbers = () => {
      const delta = 2;
      const range = [];
      const rangeWithDots = [];

      for (
        let i = Math.max(2, currentPage - delta);
        i <= Math.min(totalPages - 1, currentPage + delta);
        i++
      ) {
        range.push(i);
      }

      if (currentPage - delta > 2) {
        rangeWithDots.push(1, "...");
      } else {
        rangeWithDots.push(1);
      }

      rangeWithDots.push(...range);

      if (currentPage + delta < totalPages - 1) {
        rangeWithDots.push("...", totalPages);
      } else {
        rangeWithDots.push(totalPages);
      }

      return rangeWithDots.filter(
        (item, index, arr) => index === 0 || arr[index - 1] !== item,
      );
    };

    return (
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
        <div className="flex-1 flex justify-between sm:hidden">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={!hasPrevPage}
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={!hasNextPage}
            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>

        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center space-x-2">
            <p className="text-sm text-gray-700 font-inter">
              Showing <span className="font-semibold">{startItem}</span> to{" "}
              <span className="font-semibold">{endItem}</span> of{" "}
              <span className="font-semibold">{totalCount}</span> results
            </p>
            <select
              value={limit}
              onChange={(e) => handleLimitChange(parseInt(e.target.value))}
              className="ml-2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-inter"
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={!hasPrevPage}
              className="relative inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {totalPages > 0 &&
              getPageNumbers().map((pageNum, index) =>
                pageNum === "..." ? (
                  <span
                    key={`dots-${index}`}
                    className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={`page-${pageNum}`}
                    onClick={() => handlePageChange(pageNum)}
                    className={`relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${pageNum === currentPage
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                  >
                    {pageNum}
                  </button>
                ),
              )}

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!hasNextPage}
              className="relative inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };



  const resetForm = () => {
    setForm({
      name: "",
      industry: "",
      address: "",
      website: "",
      gstin: "",
      profilePicture: null,
      profilePictureUrl: "",
    });
    setAdditionalFields({});
  };

  const toggleForm = () => {
    if (showForm) {
      resetForm();
    }
    setShowForm(!showForm);
  };

  const handleEdit = (company) => {
    console.log("Editing company:", company); // Debug log
    console.log("Social media:", company.socialMedia); // Debug log

    setForm({
      _id: company._id,
      name: company.name,
      industry: company.industry,
      gstin: company.gstin || "",
      address: company.address || "",
      website: company.website || "",
      profilePicture: null,
      profilePictureUrl: company.profilePicture || "",
      socialMedia: {
        twitter: company.socialMedia?.twitter || "",
        linkedin: company.socialMedia?.linkedin || "",
        facebook: company.socialMedia?.facebook || "",
      },
    });

    const processedFields = {};
    if (company.additionalFields) {
      company.additionalFields.forEach((field) => {
        processedFields[field.key] = field.value;
      });
    }
    setAdditionalFields(processedFields);
    setShowForm(true);
  };

  return (
    <div className="">
      <Toaster position="top-right" toastOptions={{ duration: 5000 }} />

      {/* Video Tutorial Modal */}
      <VideoTutorialModal
        isOpen={showVideoTutorial}
        onClose={() => setShowVideoTutorial(false)}
        videoId={getVideoTutorial("companies")?.videoId}
        title={getVideoTutorial("companies")?.title}
      />

      {/* Import Clients Modal */}
      <ImportClients
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        companyFieldNames={companyFieldNames}
        onImportSuccess={() => {
          fetchCompanies();
          toast.success("Companies imported successfully");
        }}
      />

      {/* Column Settings Panel */}
      <ColumnSettingsPanel
        isOpen={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        columns={columns}
        onSave={saveColumns}
        moduleName="Companies"
      />

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 font-sf">
                Confirm Delete
              </h3>
              <p className="text-sm text-gray-500 font-inter mb-6">
                Are you sure you want to delete this company? This action
                cannot be undone.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 mt-5 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-xl">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="font-bold text-3xl font-sf text-gray-900">
              Companies
            </h1>
            <p className="text-sm text-gray-500 font-inter">
              Manage your client relationships
            </p>
          </div>
        </div>
      </div>

      {showForm && (
        <CompanyForm
          form={form}
          setForm={setForm}
          loading={loading}
          setLoading={setLoading}
          companyFieldNames={companyFieldNames}
          additionalFields={additionalFields}
          setAdditionalFields={setAdditionalFields}
          fetchCompanies={fetchCompanies}
          onRequestClose={() => {
            resetForm();
            setShowForm(false);
          }}
        />
      )}

      {state?.showAddForm && (
        <CompanyForm
          form={form}
          setForm={setForm}
          loading={loading}
          setLoading={setLoading}
          companyFieldNames={companyFieldNames}
          additionalFields={additionalFields}
          setAdditionalFields={setAdditionalFields}
          fetchCompanies={fetchCompanies}
          onRequestClose={() => {
            resetForm();
            setShowForm(false);
            if (state) state.showAddForm = false;
          }}
        />
      )}

      {/* Selection Mode Banner */}
      {selectionMode && selectedCompanies.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-sm gap-4">
          {" "}
          <div className="flex items-center gap-3">
            <CheckSquare className="w-5 h-5 text-blue-600" />
            <span className="text-blue-800 font-semibold font-inter">
              {selectedCompanies.length} company
              {selectedCompanies.length !== 1 ? "ies" : ""} selected
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {" "}
            <button
              onClick={() => setShowExportModal(true)}
              className="px-4 py-2 bg-white border border-green-600 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 focus:outline-none transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={() => setShowBulkNoteModal(true)}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none transition-colors flex items-center gap-2"
            >
              <StickyNote className="w-4 h-4 text-emerald-600" />
              Add Note
            </button>
            <button
              onClick={() => setShowAddToHotlistModal(true)}
              className="px-4 py-2 bg-white border border-blue-600 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-50 focus:outline-none transition-colors flex items-center gap-2"
            >
              <FolderPlus className="w-4 h-4" />
              Add to Hotlist
            </button>
            <button
              onClick={() => setShowBulkActions(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none transition-colors flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Bulk Update
            </button>
            <button
              onClick={() => setShowBulkDeleteModal(true)}
              disabled={bulkLoading}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 focus:outline-none transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
            <button
              onClick={exitSelectionMode}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Content Card */}
      <div className="bg-white overflow-visible border-b border-gray-100">
        {/* Toolbar (Search + Buttons) */}
        <div className="p-4 sm:p-6 border-b border-[#E0E0E1]">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-[70%] pl-10 pr-4 py-2.5 border border-[#E0E0E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 transition-colors font-inter bg-gradient-to-r from-white to-blue-100"
                placeholder="Search companies by name, industry, or location..."
              />
            </div>

            {/* Custom Industry Filter Dropdown */}
            <div
              className="relative hidden sm:block"
              ref={industryDropdownRef}
            >
              <button
                onClick={() =>
                  setIsIndustryDropdownOpen(!isIndustryDropdownOpen)
                }
                className="flex items-center justify-between min-w-[160px] px-4 py-2.5 bg-white border border-[#E0E0E1] rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-gray-400" />
                  <span>{filterIndustry || "All Industries"}</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isIndustryDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isIndustryDropdownOpen && (
                <div className="absolute right-0 z-50 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-xl py-2 animate-in fade-in zoom-in duration-200 origin-top-right">
                  <div className="px-3 pb-2 mb-2 border-b border-gray-50">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 px-1">
                      Filter by Industry
                    </p>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto px-1 custom-scrollbar">
                    <button
                      onClick={() => {
                        setFilterIndustry("");
                        setIsIndustryDropdownOpen(false);
                        setPagination((p) => ({ ...p, currentPage: 1 }));
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${!filterIndustry ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-600 hover:bg-gray-50"}`}
                    >
                      All Industries
                      {!filterIndustry && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                      )}
                    </button>
                    {getUniqueIndustries().map((i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setFilterIndustry(i);
                          setIsIndustryDropdownOpen(false);
                          setPagination((p) => ({ ...p, currentPage: 1 }));
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between mt-0.5 ${filterIndustry === i ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-600 hover:bg-gray-50"}`}
                      >
                        {i}
                        {filterIndustry === i && (
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <VideoTutorialButton
              onClick={() => setShowVideoTutorial(true)}
              variant="minimal"
            />

            {/* Per-module Forms entry point — v1-simple, navigates to Forms List pre-filtered to
                this module. FORMS_FRONTEND_ARCHITECTURE.md §4. */}
            <Link
              to="/settings/forms?module=Company"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none cursor-pointer shadow-sm transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Forms</span>
            </Link>

            <button
              onClick={() => setShowColumnSettings(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none cursor-pointer shadow-sm transition-colors"
              title="Column Settings"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Columns</span>
            </button>

            <button
              onClick={() => setShowAdvancedFilters(true)}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors relative"
            >
              <Filter className="w-4 h-4" />
              Filters
              {activeFilters.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                  {activeFilters.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowImport(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none cursor-pointer shadow-sm transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import</span>
            </button>

            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0C4FCD] text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none cursor-pointer shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              {showForm ? "Cancel" : "New Company"}
            </button>
            <button
              className="md:hidden flex items-center justify-center p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50"
              onClick={() => {
                /* Mobile filter trigger if needed */
              }}
            >
              <Filter className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Tabs / Secondary Header for Hotlist */}
        <div className="border-b border-gray-200 bg-white">
          <div className="flex px-4 sm:px-6 justify-end py-2">
            <button
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${showHotlist ? "bg-blue-100 text-blue-700 border border-blue-200" : "text-gray-600 hover:bg-gray-200"}`}
              onClick={() => setShowHotlist(!showHotlist)}
            >
              <FileText className="w-3 h-3" />
              {showHotlist ? "Showing Hotlist" : "Show Hotlist"}
            </button>
          </div>
        </div>

        {showHotlist ? (
          <Hotlist />
        ) : (
          <div
            className={`relative bg-white overflow-hidden ${loading ? "pointer-events-none opacity-60" : ""}`}
          >
            <div className="overflow-x-auto overflow-y-visible">
              <table
                className="w-full border-collapse text-left"
                style={{
                  minWidth: `${table.getTotalSize()}px`,
                  tableLayout: "fixed",
                }}
              >
                <thead className="bg-gray-50 border-b border-gray-200">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        const colId = header.column.id;
                        const isSticky = colId === "selection" || colId === "star" || colId === pinnedColumn;
                        const isRightMostSticky = pinnedColumn ? colId === pinnedColumn : colId === "star";

                        // Calculate left offset
                        let leftOffset = "auto";
                        if (colId === "selection") leftOffset = 0;
                        if (colId === "star") leftOffset = selectionMode ? 60 : 0;
                        if (colId === pinnedColumn) leftOffset = (selectionMode ? 60 : 0) + 40;

                        return (
                          <th
                            key={header.id}
                            style={{
                              width: header.getSize(),
                              position: isSticky ? "sticky" : "relative",
                              left: leftOffset,
                              zIndex: isSticky ? 20 : 1,
                            }}
                            className={`px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 hover:bg-gray-100 transition-colors bg-gray-50 ${isRightMostSticky
                              ? "border-r-2 border-r-gray-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                              : "last:border-r-0"
                              }`}
                          >
                            <div className="truncate w-full">
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                            </div>

                            {header.column.getCanResize() && (
                              <div
                                onMouseDown={header.getResizeHandler()}
                                onTouchStart={header.getResizeHandler()}
                                className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-blue-400 z-50 ${header.column.getIsResizing() ? "bg-blue-500" : "bg-transparent"
                                  }`}
                              />
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>

                <tbody className="divide-y divide-gray-100 bg-white">
                  {loading && companies.length === 0 ? (
                    <tr>
                      <td colSpan={table.getAllColumns().length} className="px-6 py-12 text-center">
                        <p>Loading Companies...</p>
                      </td>
                    </tr>
                  ) : companies.length === 0 ? (
                    <tr>
                      <td colSpan={table.getAllColumns().length} className="px-6 py-12 text-center text-gray-500 font-inter">
                        <p className="font-medium">No companies found</p>
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className={`bg-white hover:bg-blue-50 transition-colors ${selectedCompanies.includes(row.original._id) ? "!bg-blue-50" : ""}`}
                        onMouseDown={() => handleMouseDown(row.original._id)}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onTouchStart={() => handleTouchStart(row.original._id)}
                        onTouchEnd={handleTouchEnd}
                      >
                        {row.getVisibleCells().map((cell) => {
                          const colId = cell.column.id;
                          const isSticky = colId === "selection" || colId === "star" || colId === pinnedColumn;
                          const isRightMostSticky = pinnedColumn ? colId === pinnedColumn : colId === "star";

                          // Calculate left offset
                          let leftOffset = "auto";
                          if (colId === "selection") leftOffset = 0;
                          if (colId === "star") leftOffset = selectionMode ? 60 : 0;
                          if (colId === pinnedColumn) leftOffset = (selectionMode ? 60 : 0) + 40;

                          return (
                            <td
                              key={cell.id}
                              style={{
                                width: cell.column.getSize(),
                                position: isSticky ? "sticky" : "static",
                                left: leftOffset,
                                zIndex: isSticky ? 10 : 1,
                              }}
                              className={`px-4 py-2 border-r border-gray-100 align-middle text-sm bg-inherit ${isRightMostSticky
                                ? "border-r-2 border-r-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"
                                : "last:border-r-0"
                                }`}
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && !showHotlist && <PaginationControls />}
      </div>

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 font-sf">
                Confirm Bulk Delete
              </h3>
              <p className="text-sm text-gray-500 font-inter mb-6">
                Are you sure you want to delete{" "}
                <strong>{selectedCompanies.length}</strong> companies? This
                action cannot be undone.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowBulkDeleteModal(false)}
                  disabled={bulkLoading}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await handleBulkDeleteCompanies(selectedCompanies);
                    setShowBulkDeleteModal(false);
                  }}
                  disabled={bulkLoading}
                  className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm flex items-center justify-center min-w-[120px]"
                >
                  {bulkLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Deleting...
                    </>
                  ) : (
                    "Delete All"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BulkActions
        isOpen={showBulkActions}
        onClose={() => setShowBulkActions(false)}
        selectedItems={companies.filter((c) =>
          selectedCompanies.includes(c._id),
        )}
        onBulkUpdate={handleBulkUpdateCompanies}
        fieldConfig={companyFieldConfig}
        module="companies"
      />

      <AdvancedFilterPanel
        isOpen={showAdvancedFilters}
        onClose={() => setShowAdvancedFilters(false)}
        columns={defaultColumns}
        filters={activeFilters}
        setFilters={setActiveFilters}
        onApply={(newFilters) => setActiveFilters(newFilters)}
        title="Filter Companies"
        subtitle="Find specific accounts quickly"
        emptyStateText="Add a rule to narrow down your company list."
      />

      <AddToCompanyHotlistModal
        isOpen={showAddToHotlistModal}
        onClose={() => setShowAddToHotlistModal(false)}
        selectedCompanyIds={selectedCompanies}
        onComplete={() => {
          setSelectionMode(true);
          setSelectedCompanies([]);
        }}
      />
      {/* Export Selected Companies Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        columns={defaultColumns}
        selectedIds={selectedCompanies} //  Pass the Array of IDs
        exportUrl="/companies/export-selected" // The backend route
        fileName="Exported_Companies.csv"
      />

      {/* Bulk Note Modal */}
      <NoteEditor
        isOpen={showBulkNoteModal}
        onClose={() => setShowBulkNoteModal(false)}
        noteTitle={noteTitle}
        setNoteTitle={setNoteTitle}
        noteContent={noteContent}
        setNoteContent={setNoteContent}
        taggedContacts={taggedContacts}
        setTaggedContacts={setTaggedContacts}
        contacts={allContacts} // Pass all contacts for tagging
        onSave={handleBulkNoteSave}
        loading={bulkLoading}
        isEditing={false}
      />

      {quickViewCompanyId && (
        <CompanyQuickView
          companyId={quickViewCompanyId}
          onClose={() => setQuickViewCompanyId(null)}
          onEdit={(company) => {
            handleEdit(company);
            setQuickViewCompanyId(null); // optional: close quick view after opening edit
          }}
        />
      )}
    </div>
  );
}

export default Companies;