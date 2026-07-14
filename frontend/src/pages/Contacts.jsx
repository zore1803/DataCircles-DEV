import React, { useEffect, useState, useMemo, useRef } from "react";
import logo from "/DataCircles.png";
import {
  Search,
  Plus,
  Edit,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Users,
  Building2,
  Mail,
  Phone,
  User,
  MoreVertical,
  Trash2,
  Edit2,
  CheckSquare,
  X,
  Upload,
  Download,
  Target,
  TrendingUp,
  AlertCircle,
  Sparkles,
  BarChart2,
  Briefcase,
  FolderPlus,
  StickyNote,
  Eye,
  Pin,
  PinOff,
  Star
} from "lucide-react";
import API from "../services/api";
import ContactFolder from "../components/contact/ContactFolder";
import ProfilePicture from "../components/contact/ProfilePicture";
import BulkActions from "../components/BulkActions";
import { Link, useNavigate } from "react-router-dom";
import ContactForm from "../components/contact/ContactForm";
import { useLocation } from "react-router-dom";
import CallLogForm from "../components/contact/CallLogForm";
import ImportContacts from "../components/contact/ImportContacts";
import KanbanBoard from "../components/contact/KanbanBoard";
import toast, { Toaster } from "react-hot-toast";
import VideoTutorialButton from "../components/VideoTutorialButton";
import VideoTutorialModal from "../components/VideoTutorialModal";
import { getVideoTutorial } from "../utils/videoTutorials";
import { Settings } from "lucide-react"; // Add this to your lucide-react imports
import ColumnSettingsPanel from "../components/ColumnSettingsPanel";
import { useColumnSettings } from "../hooks/useColumnSettings";
import {
  lifecycleStageOptions, // Added
  allLifecycleStages, // Added
  allStageStatuses, // Added
  getLifecycleStageForStatus, // Added
  getColumnColor,
  getBadgeColor,
} from "../utils/contactConstants";
import StatusDropdown from "../components/contact/StatusDropdown";
import AdvancedFilterPanel from "../components/common/AdvancedFilterPanel";
import useContactStore from "../store/useContactStore";
import AddToContactHotlistModal from "../components/contact/AddToContactHotlistModal";
import ExportModal from "../components/common/ExportModal";
import { NoteEditor } from "../components/contact/NoteSection";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import ContactQuickView from "../components/contact/ContactQuickView";

// Custom hook to detect mobile screen
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);

    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);

  return isMobile;
};

function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    lifecycleStage: "Lead",
    stageStatus: "New",
    company: "",
    avatar: "",
    socialMedia: {
      twitter: "",
      linkedin: "",
      facebook: "",
    },
  });
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contactFieldList, setContactFieldList] = useState([]);
  const [additionalValues, setAdditionalValues] = useState({});
  const [permission, setPermission] = useState("");
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const location = useLocation();
  const { state } = location;
  const user = JSON.parse(localStorage.getItem("user"));
  const navigate = useNavigate();
  const [showImport, setShowImport] = useState(false);
  const isMobile = useIsMobile();
  const [showKanban, setShowKanban] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [folders, setFolders] = useState([]);
  const [contactToAddToFolder, setContactToAddToFolder] = useState(null);
  const [showAddToFolderModal, setShowAddToFolderModal] = useState(false);
  const [showAddToHotlistModal, setShowAddToHotlistModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  const [showBulkNoteModal, setShowBulkNoteModal] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [bulkNoteLoading, setBulkNoteLoading] = useState(false);

  // Video Tutorial State
  const [showVideoTutorial, setShowVideoTutorial] = useState(false);

  // Status Dropdown State
  const [openDropdownId, setOpenDropdownId] = useState(null);

  const [quickViewContactId, setQuickViewContactId] = useState(null);

  // Advanced Filter state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [columnSizing, setColumnSizing] = useState({});

  const [pinnedColumn, setPinnedColumn] = useState(null);

  const togglePinColumn = (colKey) => {
    setPinnedColumn((prev) => (prev === colKey ? null : colKey));
  };

  const [starredContacts, setStarredContacts] = useState(() => {
    const saved = localStorage.getItem("starred_contacts");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("starred_contacts", JSON.stringify(starredContacts));
  }, [starredContacts]);

  const toggleStar = (e, contactId) => {
    e.stopPropagation();
    setStarredContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  const {
    searchTerm,
    setSearchTerm,
    activeTab,
    setActiveTab,
    statusFilter,
    setStatusFilter,
    activeFilters,
    setActiveFilters,
    pagination,
    setPagination,
    sortConfig,
    setSortConfig,
    setCurrentContactIds,
  } = useContactStore();

  const fetchFolders = async () => {
    try {
      const res = await API.get("/contact-folders/");
      setFolders(res.data);
    } catch (error) {
      console.error("Failed to fetch folders", error);
      toast.error("Failed to load folders");
    }
  };

  const openAddToFolderModal = (contact) => {
    setContactToAddToFolder(contact);
    setShowAddToFolderModal(true);
    fetchFolders();
  };

  const addContactToFolder = async (folder) => {
    const loadingToast = toast.loading("Adding contact to folder...");
    try {
      // Check if contact is already in folder
      const currentContactIds = folder.contacts?.map((c) => c._id) || [];
      if (currentContactIds.includes(contactToAddToFolder._id)) {
        toast.error("Contact is already in this folder", { id: loadingToast });
        return;
      }

      await API.put(`/contact-folders/${folder._id}`, {
        contacts: [...currentContactIds, contactToAddToFolder._id],
      });

      toast.success("Contact added to folder", { id: loadingToast });
      setShowAddToFolderModal(false);
      setContactToAddToFolder(null);
    } catch (error) {
      console.error("Failed to add contact to folder", error);
      if (error.response?.status === 402) {
        toast.error(error.response?.data?.message || "An active subscription is required to make changes.", { id: loadingToast });
      } else {
        toast.error(error.response?.data?.error || "Failed to add contact to folder", { id: loadingToast });
      }
    }
  };

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(true);
  const [longPressTimer, setLongPressTimer] = useState(null);

  //Pinning rows
  const [pinnedIds, setPinnedIds] = useState(() => {
    const saved = localStorage.getItem("pinned_companies");
    return saved ? JSON.parse(saved) : [];
  });

  // Sync pins to local storage so they persist on refresh
  useEffect(() => {
    localStorage.setItem("pinned_companies", JSON.stringify(pinnedIds));
  }, [pinnedIds]);

  //function to toggle pinning
  const togglePin = (e, companyId) => {
    e.stopPropagation(); // Prevents triggering row selection or navigation
    setPinnedIds((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId) // Unpin
        : [companyId, ...prev] // Pin (adds to start of list)
    );
    toast.success(pinnedIds.includes(companyId) ? "Unpinned" : "Pinned to top");
  };

  // Pagination state

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [contactToDelete, setContactToDelete] = useState(null);

  const defaultColumns = useMemo(() => {
    const baseColumns = [
      {
        key: "name",
        label: "Name",
        visible: true,
        order: 0,
        required: true,
        defaultVisible: true,
        sortable: true,
        icon: User,
      },
      {
        key: "company",
        label: "Company",
        visible: true,
        order: 1,
        sortable: true,
        icon: Building2,
      },
      {
        key: "status",
        label: "Status",
        visible: true,
        order: 2,
        icon: Target,
      },
      {
        key: "email",
        label: "Email",
        visible: true,
        order: 3,
        sortable: true,
        icon: Mail,
      },
      {
        key: "phone",
        label: "Phone",
        visible: true,
        order: 4,
        sortable: true,
        icon: Phone,
      },
    ];

    // Add custom fields ONLY if they exist
    if (contactFieldList && contactFieldList.length > 0) {
      const customColumns = contactFieldList.map((field, index) => ({
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
  }, [contactFieldList]);

  // Use column settings hook
  const { columns, saveColumns, getVisibleColumns } = useColumnSettings(
    "contacts",
    defaultColumns,
  );

  const visibleColumns = useMemo(() => getVisibleColumns(), [columns]);

  const getFieldValue = (contact, columnKey) => {
    // Check if it's a base field
    if (contact[columnKey] !== undefined) {
      return contact[columnKey];
    }

    // Check additional fields
    const additionalField = contact.additionalFields?.find(
      (field) => field.key === columnKey,
    );
    return additionalField?.value || "—";
  };

  // Render cell content
  const renderCellContent = (contact, column) => {
    switch (column.key) {
      case "name":
        return (
          <div className="flex items-center space-x-3">
            <ProfilePicture contact={contact} />
            <Link to={`/contacts/${contact._id}`}>
              <div className="text-sm font-semibold text-gray-900 truncate hover:text-blue-600 transition-colors">
                {contact.name}
              </div>
            </Link>
          </div>
        );

      case "company":
        return (
          <div className="text-sm text-gray-700 truncate font-medium">
            {contact.company?.name || "—"}
          </div>
        );

      case "status":
        return (
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            {permission !== "readonly" ? (
              <StatusDropdown
                contact={contact}
                onUpdate={handleStatusUpdate}
                isOpen={openDropdownId === contact._id}
                onToggle={setOpenDropdownId}
              />
            ) : (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBadgeColor(contact.stageStatus)}`}
              >
                {contact.stageStatus || "New"}
              </span>
            )}
          </div>
        );

      case "email":
        return (
          <a
            href={`mailto:${contact.email}`}
            className="text-sm text-gray-700 hover:text-blue-600 transition-colors truncate"
          >
            {contact.email}
          </a>
        );

      case "phone":
        return contact.phone ? (
          <a
            href={`tel:${contact.phone}`}
            className="text-sm text-gray-700 hover:text-blue-600 transition-colors truncate"
          >
            {contact.phone}
          </a>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        );

      default:
        // Handle custom fields
        const value = getFieldValue(contact, column.key);
        return (
          <span className="text-sm text-gray-700">
            {String(value).length > 30
              ? String(value).substring(0, 30) + "..."
              : value}
          </span>
        );
    }
  };

  const columnHelper = createColumnHelper();

  // --- ADD THIS: Sort contacts so starred ones appear at top ---
  const sortedContacts = useMemo(() => {
    if (!contacts || contacts.length === 0) return [];

    const dataCopy = [...contacts];
    return dataCopy.sort((a, b) => {
      const isAStarred = starredContacts.includes(a._id);
      const isBStarred = starredContacts.includes(b._id);

      if (isAStarred && !isBStarred) return -1;
      if (!isAStarred && isBStarred) return 1;
      return 0;
    });
  }, [contacts, starredContacts]);

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
                  selectedContacts.length === contacts.length &&
                  contacts.length > 0
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
                checked={selectedContacts.includes(row.original._id)}
                onChange={() => handleSelectContact(row.original._id)}
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
          const isStarred = starredContacts.includes(row.original._id);
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

    // --- 2. DEFINE ACTIONS COLUMN ---
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
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openAddToFolderModal(row.original);
            }}
            className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
            title="Add to Folder"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
          <div className="relative inline-block text-left group/action">
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
              <MoreVertical className="w-4 h-4" />
            </button>
            <div className="hidden group-hover/action:block absolute right-0 mt-0 w-32 bg-white rounded-lg shadow-lg border border-gray-100 z-10 py-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditContact(row.original);
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600"
              >
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(row.original._id);
                }}
                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ),
    });

    // --- 3. PUSH ACTIONS (IF PINNED) ---
    if (isActionsPinned) {
      cols.push(actionsColumnDef);
    }

    // --- 4. DYNAMIC DATA COLUMNS ---
    const pinnedFields = visibleColumns.filter((vc) => vc.key === pinnedColumn);
    const unpinnedFields = visibleColumns.filter((vc) => vc.key !== pinnedColumn);

    [...pinnedFields, ...unpinnedFields].forEach((vc) => {
      cols.push(
        columnHelper.accessor((row) => getFieldValue(row, vc.key), {
          id: vc.key,
          size: vc.key === "name" ? 220 : vc.key === "email" ? 200 : 150,
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
            const contact = row.original;
            const val = getValue();

            if (vc.key === "name") {
              return (
                <div className="flex items-center justify-between w-full group relative">
                  <div className="flex items-center space-x-3 truncate flex-1 pr-4">
                    <div className="flex-shrink-0">
                      <ProfilePicture contact={contact} />
                    </div>
                    <Link
                      to={`/contacts/${contact._id}`}
                      className="text-sm font-semibold text-gray-900 truncate hover:text-blue-600 transition-all duration-150 ease-out"
                      title={contact.name}
                    >
                      {contact.name}
                    </Link>
                  </div>

                  <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-150 ease-out pointer-events-none group-hover:pointer-events-auto bg-white/80 backdrop-blur-[2px] rounded-lg">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setQuickViewContactId(contact._id);
                      }}
                      className="p-1.5 rounded-md bg-white shadow-sm border border-gray-200 hover:bg-blue-50 text-blue-600"
                      title="Quick view"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openAddToFolderModal(row.original);
                      }}
                      className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                      title="Add to Folder"
                    >
                      <FolderPlus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditContact(contact);
                      }}
                      className="p-1.5 rounded-md hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition-all duration-150 transform hover:scale-110 active:scale-95"
                      title="Edit Contact"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(contact._id);
                      }}
                      className="p-1.5 rounded-md hover:bg-red-50 text-gray-500 hover:text-red-600 transition-all duration-150 transform hover:scale-110 active:scale-95"
                      title="Delete Contact"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            }
            if (vc.key === "company") {
              return (
                <div
                  className="truncate text-sm text-gray-700 font-medium w-full"
                  title={contact.company?.name}
                >
                  {contact.company?.name || "—"}
                </div>
              );
            }
            if (vc.key === "status") {
              return (
                <div
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className="truncate w-full"
                >
                  {permission !== "readonly" ? (
                    <StatusDropdown
                      contact={contact}
                      onUpdate={handleStatusUpdate}
                      isOpen={openDropdownId === contact._id}
                      onToggle={setOpenDropdownId}
                    />
                  ) : (
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBadgeColor(
                        contact.stageStatus,
                      )}`}
                    >
                      {contact.stageStatus || "New"}
                    </span>
                  )}
                </div>
              );
            }
            if (vc.key === "email") {
              return (
                <div className="truncate w-full" title={contact.email}>
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-sm text-gray-700 hover:text-blue-600 transition-colors"
                  >
                    {contact.email}
                  </a>
                </div>
              );
            }
            if (vc.key === "phone") {
              return (
                <div className="truncate w-full" title={contact.phone}>
                  {contact.phone ? (
                    <a
                      href={`tel:${contact.phone}`}
                      className="text-sm text-gray-700 hover:text-blue-600 transition-colors"
                    >
                      {contact.phone}
                    </a>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </div>
              );
            }

            return (
              <div
                className="truncate text-sm text-gray-700 w-full"
                title={String(val)}
              >
                {String(val)}
              </div>
            );
          },
        })
      );
    });

    // --- 5. PUSH ACTIONS (IF NOT PINNED) ---
    if (!isActionsPinned) {
      cols.push(actionsColumnDef);
    }

    return cols;
  }, [
    selectionMode,
    visibleColumns,
    selectedContacts,
    sortedContacts,
    sortConfig,
    permission,
    openDropdownId,
    pinnedColumn, // <-- Make sure this is added to dependencies
    starredContacts,
  ]);

  const table = useReactTable({
    data: sortedContacts,
    columns: tableColumns,
    state: { columnSizing },
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
  });

  const handleStatusUpdate = async (contact, newStatus) => {
    try {
      const loadingToast = toast.loading("Updating status...");
      await API.put(`/contacts/${contact._id}`, {
        stageStatus: newStatus,
      });
      toast.success("Status updated", { id: loadingToast });

      // Optimistic update
      setContacts((prev) =>
        prev.map((c) =>
          c._id === contact._id ? { ...c, stageStatus: newStatus } : c,
        ),
      );

      // No need to fetch data immediately if we update optimistically, but let's do it to be safe
      // fetchData();
    } catch (error) {
      console.error("Failed to update status", error);
      if (error.response?.status === 402) {
        toast.error(error.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(error.response?.data?.error || "Failed to update status");
      }
    }
  };

  const handleDelete = async (contactId) => {
    setContactToDelete(contactId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!contactToDelete) return;

    const loadingToast = toast.loading("Deleting contact...");

    try {
      setLoading(true);
      await API.delete(`/contacts/${contactToDelete}`);
      await fetchData();
      toast.success("Contact deleted successfully!", { id: loadingToast });
    } catch (err) {
      let errorMessage = "Failed to delete contact";
      if (err.response?.status === 402) {
        errorMessage = err.response?.data?.message || "An active subscription is required to make changes.";
      } else if (err.response?.status === 403) {
        errorMessage = err.response.data.message || "Access denied";
      }
      toast.error(errorMessage, { id: loadingToast });
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
      setContactToDelete(null);
    }
  };

  // Long press handlers
  const handleMouseDown = (contactId) => {
    const timer = setTimeout(() => {
      setSelectionMode(true);
      handleSelectContact(contactId);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleMouseUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleTouchStart = (contactId) => {
    const timer = setTimeout(() => {
      setSelectionMode(true);
      handleSelectContact(contactId);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // Exit selection mode
  const exitSelectionMode = () => {
    setSelectionMode(true);
    setSelectedContacts([]);
  };

  // Status Filter Dropdown Component for Desktop
  const StatusFilterDropdown = () => {
    const dropdownRef = useRef(null);
    const isOpen = openDropdownId === "status-filter";

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target)
        ) {
          if (isOpen) setOpenDropdownId(null);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpenDropdownId(isOpen ? null : "status-filter")}
          className={`flex items-center gap-2 px-4 py-2.5 bg-white border border-[#E0E0E1] rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${statusFilter
            ? "text-blue-600 border-blue-200 bg-blue-50"
            : "text-gray-700 hover:bg-gray-50"
            }`}
        >
          <Filter
            className={`w-4 h-4 ${statusFilter ? "text-blue-600" : "text-gray-400"}`}
          />
          <span>{statusFilter || "Status"}</span>
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""
              }`}
          />
        </button>

        {isOpen && (
          <div className="absolute right-0 z-50 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-xl py-2 animate-in fade-in zoom-in duration-200 origin-top-right">
            <div className="px-3 pb-2 mb-2 border-b border-gray-50">
              <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 px-1">
                Filter by Status
              </p>
            </div>
            <div className="max-h-[280px] overflow-y-auto px-1 custom-scrollbar">
              <button
                onClick={() => {
                  setStatusFilter("");
                  setOpenDropdownId(null);
                  setPagination((p) => ({ ...p, currentPage: 1 }));
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${!statusFilter
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-gray-600 hover:bg-gray-50"
                  }`}
              >
                All Statuses
                {!statusFilter && (
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                )}
              </button>
              {allStageStatuses.map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status);
                    setOpenDropdownId(null);
                    setPagination((p) => ({ ...p, currentPage: 1 }));
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between mt-0.5 ${statusFilter === status
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-gray-600 hover:bg-gray-50"
                    }`}
                >
                  {status}
                  {statusFilter === status && (
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Mobile Filters Modal
  const MobileFiltersModal = () => {
    if (!showMobileFilters) return null;

    return (
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-end justify-center z-50 md:hidden">
        <div className="bg-white w-full max-h-96 rounded-t-xl shadow-2xl">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold font-sf">Filters</h3>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Filter by Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                {allStageStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex space-x-2 pt-4">
              <button
                onClick={() => {
                  setStatusFilter("");
                  setShowMobileFilters(false);
                }}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Component for the hierarchical status dropdown with logical coloring (Mobile Responsive)
  const LifecycleStageDropdown = ({ contact, onUpdate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedStage, setSelectedStage] = useState(
      contact.lifecycleStage || "Lead",
    );
    const [selectedStatus, setSelectedStatus] = useState(
      contact.stageStatus || "New",
    );

    // Lifecycle stage options with logical colors
    const lifecycleStageOptions = {
      Lead: [
        { name: "New", color: "bg-red-100 text-red-800 border-red-200" },
        {
          name: "Contacted",
          color: "bg-yellow-100 text-yellow-800 border-yellow-200",
        },
        {
          name: "Interested",
          color: "bg-blue-100 text-blue-800 border-blue-200",
        },
        {
          name: "Unqualified",
          color: "bg-red-200 text-red-900 border-red-300",
        },
      ],
      "Sales Qualified Lead": [
        {
          name: "Qualified",
          color: "bg-blue-100 text-blue-800 border-blue-200",
        },
        { name: "Lost", color: "bg-red-300 text-red-900 border-red-400" },
      ],
      Customer: [
        { name: "Won", color: "bg-green-100 text-green-800 border-green-200" },
        { name: "Churned", color: "bg-gray-200 text-gray-800 border-gray-300" },
      ],
    };

    const allLifecycleStages = Object.keys(lifecycleStageOptions);

    const handleSave = async () => {
      try {
        await onUpdate(contact._id, selectedStage, selectedStatus);
        setIsOpen(false);
        toast.success("Contact lifecycle stage updated successfully!");
      } catch (error) {
        console.error("Failed to update lifecycle stage:", error);
        toast.error(
          error.response?.data?.message || "Failed to update lifecycle stage",
        );
      }
    };

    const handleCancel = () => {
      setSelectedStage(contact.lifecycleStage || "Lead");
      setSelectedStatus(contact.stageStatus || "New");
      setIsOpen(false);
    };

    const handleStageChange = (newStage) => {
      setSelectedStage(newStage);
      setSelectedStatus(lifecycleStageOptions[newStage][0].name);
    };

    if (!isOpen) {
      const currentStatusOptions =
        lifecycleStageOptions[contact.lifecycleStage || "Lead"] || [];
      const currentStatusObj = currentStatusOptions.find(
        (s) => s.name === (contact.stageStatus || "New"),
      );
      const displayColor = currentStatusObj
        ? currentStatusObj.color
        : "bg-gray-100 text-gray-700 border-gray-200";

      return (
        <div
          className={`cursor-pointer hover:opacity-80 rounded-lg px-3 py-1.5 text-xs border transition-all duration-200 font-semibold ${displayColor}`}
          onClick={() => setIsOpen(true)}
        >
          {contact.stageStatus || "New"}
        </div>
      );
    }

    if (isMobile) {
      return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md mx-4 rounded-xl shadow-2xl">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Update Status</h3>
                <button
                  onClick={handleCancel}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Lifecycle stage
                </label>
                <select
                  value={selectedStage}
                  onChange={(e) => handleStageChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {allLifecycleStages.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Status
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {lifecycleStageOptions[selectedStage]?.map((statusObj) => (
                    <button
                      key={statusObj.name}
                      onClick={() => setSelectedStatus(statusObj.name)}
                      className={`
                        w-full px-4 py-3 rounded-lg border text-center font-semibold transition-all duration-200
                        ${selectedStatus === statusObj.name
                          ? statusObj.color +
                          " ring-2 ring-blue-400 ring-offset-1"
                          : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                        }
                      `}
                    >
                      {statusObj.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t bg-white border-gray-200">
              <div className="flex space-x-2">
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-[9999]"
        onClick={handleCancel} // Close on backdrop click
      >
        <div
          className="bg-white rounded-xl shadow-2xl p-6 min-w-[320px] max-w-md mx-4"
          onClick={(e) => e.stopPropagation()} // Prevent backdrop click from closing when clicking inside modal
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Update Status</h3>
              <button
                onClick={handleCancel}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Lifecycle stage
              </label>
              <select
                value={selectedStage}
                onChange={(e) => handleStageChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {allLifecycleStages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Status
              </label>
              <div className="space-y-2">
                {lifecycleStageOptions[selectedStage]?.map((statusObj) => (
                  <label
                    key={statusObj.name}
                    className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                  >
                    <input
                      type="radio"
                      name="status"
                      value={statusObj.name}
                      checked={selectedStatus === statusObj.name}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="sr-only"
                    />
                    <div
                      className={`
                    flex-1 px-3 py-2 rounded-lg border text-center font-semibold transition-all duration-200
                    ${selectedStatus === statusObj.name
                          ? statusObj.color +
                          " ring-2 ring-blue-400 ring-offset-1"
                          : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                        }
                  `}
                    >
                      {statusObj.name}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex space-x-2 pt-2 border-t border-gray-200 mt-4">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination((prev) => ({ ...prev, currentPage: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, activeTab, statusFilter]);

  // Fetch data when dependencies change
  useEffect(() => {
    fetchData();
  }, [pagination.currentPage, pagination.limit, sortConfig]);

  // Separate effect for search/filter to trigger reset + fetch
  useEffect(() => {
    if (pagination.currentPage === 1) {
      fetchData();
    }
  }, [searchTerm, activeTab, statusFilter]);

  useEffect(() => {
    fetchCompanies();
    fetchContactFields();
    fetchPermission();
  }, []);

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

  // Component for sortable column header
  const SortableHeader = ({ field, children, className = "" }) => {
    const column = visibleColumns.find((col) => col.key === field);
    const isSortable = column?.sortable !== false;
    const Icon = column?.icon;

    return (
      <th
        className={`px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 bg-white ${isSortable ? "cursor-pointer hover:bg-gray-50 select-none" : ""
          } transition-colors ${className}`}
        onClick={() => isSortable && handleSort(field)}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 inline mr-1" />}
          {children}
          {isSortable && (
            <div className="flex flex-col">
              <ChevronUp
                className={`w-3 h-3 ${sortConfig.key === field && sortConfig.direction === "asc"
                  ? "text-blue-600"
                  : "text-gray-400"
                  }`}
              />
              <ChevronDown
                className={`w-3 h-3 -mt-1 ${sortConfig.key === field && sortConfig.direction === "desc"
                  ? "text-blue-600"
                  : "text-gray-400"
                  }`}
              />
            </div>
          )}
        </div>
      </th>
    );
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

  const contactFieldConfig = useMemo(
    () => ({
      fields: [
        {
          key: "lifecycleStage",
          label: "Lifecycle Stage",
          type: "select",
          options: allLifecycleStages.map((stage) => ({
            value: stage,
            label: stage,
          })),
        },
        {
          key: "stageStatus",
          label: "Stage Status",
          type: "select",
          options: allStageStatuses.map((status) => ({
            value: status,
            label: status,
          })),
        },
        {
          key: "company",
          label: "Company",
          type: "select",
          options: companies.map((company) => ({
            value: company._id,
            label: company.name,
          })),
        },
        {
          key: "email",
          label: "Email",
          type: "email",
        },
        {
          key: "phone",
          label: "Phone",
          type: "phone",
        },
        ...contactFieldList.map((field) => ({
          key: field.name || field,
          label: field.name || field,
          type: field.type || "text",
          isCustomField: true,
          options: field.options,
        })),
      ],
    }),
    [companies, contactFieldList],
  );

  const handleSelectContact = (contactId) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId],
    );
  };

  const handleSelectAll = () => {
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([]);
      setSelectionMode(true);
    } else {
      setSelectedContacts(contacts.map((contact) => contact._id));
      setSelectionMode(true);
    }
  };

  const handleBulkUpdate = async ({ field, value, itemIds }) => {
    try {
      const updateData = { [field]: value };
      if (contactFieldList.includes(field)) {
        updateData.additionalFields = [{ key: field, value }];
        delete updateData[field];
      }
      await Promise.all(
        itemIds.map((contactId) =>
          API.put(`/contacts/${contactId}/lifecycle-stage`, updateData),
        ),
      );
      await fetchData();
      setSelectedContacts([]);
      setShowBulkActions(false);
      setSelectionMode(false);
      toast.success(`Successfully updated ${itemIds.length} contacts`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update contacts");
    }
  };

  const handleBulkDeleteContacts = async (itemIds) => {
    setLoading(true);
    try {
      await Promise.all(itemIds.map((id) => API.delete(`/contacts/${id}`)));
      await fetchData();
      setSelectedContacts([]);
      setShowBulkActions(false);
      setSelectionMode(false);
      toast.success(`Successfully deleted ${itemIds.length} contacts`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Bulk delete failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkNoteSave = async () => {
    if (!noteContent.trim() || noteContent === "<p><br></p>") {
      toast.error("Note content is required");
      return;
    }

    setBulkNoteLoading(true);
    const loadingToast = toast.loading(
      `Adding note to ${selectedContacts.length} contacts...`,
    );

    try {
      await API.post("/notes/bulk-contact-notes", {
        note: noteContent,
        contactIds: selectedContacts,
      });

      toast.success("Notes successfully added!", { id: loadingToast });

      // Cleanup
      setNoteContent("");
      setShowBulkNoteModal(false);
      exitSelectionMode(); // Clear selection
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.", { id: loadingToast });
      } else {
        toast.error(err.response?.data?.error || "Failed to add notes", { id: loadingToast });
      }
    } finally {
      setBulkNoteLoading(false);
    }
  };

  const selectedContactObjects = useMemo(
    () => contacts.filter((contact) => selectedContacts.includes(contact._id)),
    [contacts, selectedContacts],
  );

  const fetchPermission = async () => {
    try {
      const res = await API.get("/auth/me");
      const user = res.data.user;
      const contactPerm = user?.permissions?.find(
        (p) => p.name.toLowerCase() === "contacts",
      );
      setPermission(contactPerm?.permission || "no");
    } catch (err) {
      console.error("Failed to fetch user permissions");
      toast.error("Failed to fetch user permissions");
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await API.get("/companies");
      setCompanies(res.data.companies || res.data);
    } catch (err) {
      console.error("Failed to fetch companies");
      toast.error(err.response?.data?.error || "Failed to fetch companies");
    }
  };

  const fetchContactFields = async () => {
    try {
      const res = await API.get("/contact-fields");
      const fieldData = res.data?.fields || [];
      if (fieldData.length > 0 && typeof fieldData[0] === "object") {
        setContactFieldList(fieldData);
      } else {
        setContactFieldList(fieldData);
      }
    } catch (err) {
      console.error("Failed to fetch contact fields");
      toast.error(
        err.response?.data?.error || "Failed to fetch contact fields",
      );
    }
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setStatusFilter(""); // Reset status filter immediately
    setSearchTerm(""); // Optionally reset search
    setPagination((prev) => ({ ...prev, currentPage: 1 })); // Reset to first page
    if (tabId === "Hotlist") {
      setShowKanban(false);
    }
  };

  const fetchData = async () => {
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

      if (statusFilter) {
        params.append("stageStatus", statusFilter);
      }

      if (activeFilters && activeFilters.length > 0) {
        params.append("advancedFilters", JSON.stringify(activeFilters));
      }

      if (activeTab !== "All") {
        switch (activeTab) {
          case "Leads":
            params.append("lifecycleStage", "Lead");
            break;
          case "Sales Qualified Lead":
            params.append("lifecycleStage", "Sales Qualified Lead");
            break;
          case "Customers":
            params.append("lifecycleStage", "Customer");
            break;
        }
      }

      const res = await API.get(`/contacts/pagination?${params.toString()}`);

      if (res.data.contacts && res.data.pagination) {
        setContacts(res.data.contacts);
        setCurrentContactIds(res.data.contacts.map((c) => c._id));
        setPagination((prev) => ({
          ...prev,
          currentPage: res.data.pagination.currentPage,
          totalPages: res.data.pagination.totalPages,
          totalCount: res.data.pagination.totalCount,
          hasNextPage: res.data.pagination.hasNextPage,
          hasPrevPage: res.data.pagination.hasPrevPage,
        }));
      } else {
        setContacts(res.data || []);
        setCurrentContactIds((res.data || []).map((c) => c._id));
      }
    } catch (err) {
      console.error("Error fetching contacts:", err);
      toast.error(err.response?.data?.error || "Failed to load contacts");
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  // Trigger data refetch when filters are applied
  useEffect(() => {
    if (pagination.currentPage === 1) {
      fetchData();
    } else {
      setPagination((prev) => ({ ...prev, currentPage: 1 }));
    }
  }, [activeFilters]);

  const handleEditContact = async (contact) => {
    try {
      // Fetch the full contact data to ensure we have all fields
      const response = await API.get(`/contacts/${contact._id}`);
      const fullContactData = response.data;

      console.log("Full contact data:", fullContactData); // Debug log
      console.log("Social media data:", fullContactData.socialMedia); // Debug log

      setForm({
        _id: fullContactData._id,
        name: fullContactData.name || "",
        email: fullContactData.email || "",
        phone: fullContactData.phone || "",
        lifecycleStage: fullContactData.lifecycleStage || "Lead",
        stageStatus: fullContactData.stageStatus || "New",
        company: fullContactData.company?._id || "",
        avatar: fullContactData.avatar || "",
        socialMedia: {
          twitter: fullContactData.socialMedia?.twitter || "",
          linkedin: fullContactData.socialMedia?.linkedin || "",
          facebook: fullContactData.socialMedia?.facebook || "",
        },
      });

      // Process additional fields
      const processedFields = {};
      if (fullContactData.additionalFields) {
        fullContactData.additionalFields.forEach((field) => {
          processedFields[field.key] = field.value;
        });
      }
      setAdditionalValues(processedFields);
      setShowForm(true);
    } catch (error) {
      console.error("Error fetching contact details:", error);
      toast.error("Failed to load contact details");
    }
  };

  const handleLifecycleStageUpdate = async (
    contactId,
    lifecycleStage,
    stageStatus,
  ) => {
    try {
      await API.put(`/contacts/${contactId}/lifecycle-stage`, {
        lifecycleStage,
        stageStatus,
      });
      await fetchData();
      toast.success("Contact lifecycle stage updated successfully!");
    } catch (err) {
      toast.error(
        err.response?.data?.error || "Failed to update lifecycle stage",
      );
    }
  };

  const handleKanbanItemMove = async (contactId, newStatus) => {
    const newLifecycleStage = getLifecycleStageForStatus(newStatus);
    try {
      await API.put(`/contacts/${contactId}/lifecycle-stage`, {
        lifecycleStage: newLifecycleStage,
        stageStatus: newStatus,
      });
      setContacts((prev) =>
        prev.map((c) =>
          c._id === contactId
            ? {
              ...c,
              lifecycleStage: newLifecycleStage,
              stageStatus: newStatus,
            }
            : c,
        ),
      );
      toast.success("Contact status updated successfully!");
    } catch (err) {
      console.error("Failed to update contact status:", err);
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to update contact status");
      }
      throw err;
    }
  };

  const resetForm = () => {
    setForm({
      name: "",
      email: "",
      phone: "",
      lifecycleStage: "Lead",
      stageStatus: "New",
      company: "",
      avatar: "",
      socialMedia: {
        twitter: "",
        linkedin: "",
        facebook: "",
      },
    });
    setAdditionalValues({});
  };

  const toggleForm = () => {
    if (showForm) {
      resetForm();
    }
    setShowForm(!showForm);
  };

  // Render contact card for Kanban
  const renderContactCard = (contact, isDragging) => (
    <div
      className={`
        bg-white p-4 rounded-lg shadow-sm border border-gray-200 
        hover:shadow-md cursor-grab active:cursor-grabbing 
        transition-all duration-200 
        ${isDragging ? "rotate-1 shadow-xl z-50 scale-105" : "hover:border-blue-300"}
      `}
    >
      {/* Card Header with Avatar and Contact Name */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-shrink-0">
            <ProfilePicture contact={contact} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">
              {contact.name}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {contact.jobTitle || contact.company?.name || "—"}
            </p>
          </div>
        </div>
        <div className="relative inline-block text-left group/action">
          <button
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          <div className="hidden group-hover/action:block absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-xl border border-gray-100 z-50 py-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEditContact(contact);
              }}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600"
            >
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(contact._id);
              }}
              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-b border-gray-100 mb-3"></div>

      {/* Contact Details */}
      <div className="space-y-2 mb-3">
        {contact.email && (
          <div className="flex items-center gap-2 text-xs text-gray-600 group">
            <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <a
              href={`mailto:${contact.email}`}
              className="truncate hover:text-blue-600 hover:underline transition-colors"
            >
              {contact.email}
            </a>
          </div>
        )}
        {contact.phone && (
          <div className="flex items-center gap-2 text-xs text-gray-600 group">
            <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <a
              href={`tel:${contact.phone}`}
              className="hover:text-blue-600 hover:underline transition-colors"
            >
              {contact.phone}
            </a>
          </div>
        )}
      </div>

      {/* Status Badge */}
      {contact.stageStatus && (
        <div className="">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getBadgeColor(
              contact.stageStatus,
            )}`}
          >
            {contact.stageStatus}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white min-h-screen">
      <Toaster position="top-right" toastOptions={{ duration: 5000 }} />

      {/* Video Tutorial Modal */}
      <VideoTutorialModal
        isOpen={showVideoTutorial}
        onClose={() => setShowVideoTutorial(false)}
        videoId={getVideoTutorial("contacts")?.videoId}
        title={getVideoTutorial("contacts")?.title}
      />

      {/* Column Settings Panel */}
      <ColumnSettingsPanel
        isOpen={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        columns={columns}
        onSave={saveColumns}
        moduleName="Contacts"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 mt-5  gap-4">
        <div className="flex items-center gap-3">
          <div className="mb-10 mt-10">
            <h1 className="font-bold text-3xl font-sf text-gray-900">
              Contacts
            </h1>
            <p className="text-sm text-gray-500 font-inter">
              Manage your customer relationships
            </p>
          </div>
        </div>
        {/* ============================================================= Right side buttons start ============================================================= */}
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {/* <VideoTutorialButton
            onClick={() => setShowVideoTutorial(true)}
            variant="minimal" // Options: "default", "minimal", "icon"
          /> */}
          {/*  <button
            onClick={() => setShowColumnSettings(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none cursor-pointer shadow-sm transition-colors"
            title="Column Settings"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Columns</span>
          </button> */}
          {/* <button
            onClick={toggleForm}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 btn-primary bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none cursor-pointer shadow-sm transition-colors"
            >
            <Plus className="w-4 h-4" />
            {showForm ? "Cancel" : "New Contact"}
            </button> */}
          {/* <button
            onClick={() => setShowImport(true)}
            className="inline-flex btn-primary items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none cursor-pointer shadow-sm transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import
          </button> */}
          {/* <button
            onClick={() => setShowKanban(!showKanban)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 btn-secondary border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none cursor-pointer shadow-sm transition-colors"
          >
            <Target className="w-4 h-4" />
            {showKanban ? "Table View" : "Kanban View"}
          </button> */}
        </div>
        {/* ============================================================= Right side buttons end ============================================================= */}
      </div>

      <ImportContacts
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        contactFieldNames={contactFieldList}
        onImportSuccess={() => {
          fetchData();
          toast.success("Contacts imported successfully");
        }}
      />

      {/* Contact Form */}
      {showForm && (
        <ContactForm
          form={form}
          setForm={setForm}
          additionalValues={additionalValues}
          setAdditionalValues={setAdditionalValues}
          contactFieldList={contactFieldList}
          companies={companies}
          loading={loading}
          setLoading={setLoading}
          setError={(message) =>
            toast.error(message || "Failed to save contact")
          }
          setSuccess={(message) =>
            toast.success(message || "Contact saved successfully")
          }
          fetchContacts={fetchData}
          onRequestClose={() => {
            resetForm();
            setShowForm(false);
          }}
        />
      )}

      {state?.showAddForm && (
        <ContactForm
          form={form}
          setForm={setForm}
          additionalValues={additionalValues}
          setAdditionalValues={setAdditionalValues}
          contactFieldList={contactFieldList}
          companies={companies}
          loading={loading}
          setLoading={setLoading}
          setError={(message) =>
            toast.error(message || "Failed to save contact")
          }
          setSuccess={(message) =>
            toast.success(message || "Contact saved successfully")
          }
          fetchContacts={fetchData}
          onRequestClose={() => {
            resetForm();
            setShowForm(false);
            state.showAddForm = false;
          }}
        />
      )}

      {state?.showCallLogForm && (
        <CallLogForm
          isOpen={state?.showCallLogForm}
          onClose={() => {
            console.log("on close");
            state.showCallLogForm = false;
            navigate("/contacts");
          }}
          userId={user.id}
        />
      )}

      {/* Selection Mode Banner */}
      {/* Selection Mode Banner */}
      {selectionMode && selectedContacts.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-sm gap-4">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-5 h-5 text-blue-600" />
            <span className="text-blue-800 font-semibold font-inter">
              {selectedContacts.length} contact
              {selectedContacts.length !== 1 ? "s" : ""} selected
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* ✅ Export Button */}
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

            {/* Add to Folder Button */}
            <button
              onClick={() => setShowAddToHotlistModal(true)}
              className="px-4 py-2 bg-white border border-blue-600 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-50 focus:outline-none transition-colors flex items-center gap-2"
            >
              <FolderPlus className="w-4 h-4" />
              Add to Folder
            </button>

            {/* ✅ Bulk Update Button (Text Changed) */}
            <button
              onClick={() => setShowBulkActions(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none transition-colors flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Bulk Update
            </button>

            {/* ✅ New Bulk Delete Button */}
            <button
              onClick={() => setShowBulkDeleteModal(true)}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 focus:outline-none transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>

            {/* Cancel Button */}
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
        {/* Search Bar +======================================================================================= */}
        <div className="p-4 sm:p-6 border-b border-[#E0E0E1]">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-[70%] pl-10 pr-4 py-2.5 border border-[#E0E0E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 transition-colors font-inter bg-gradient-to-r from-white to-blue-100"
                placeholder="Search contacts by name, email, or company..."
              />
            </div>
            <VideoTutorialButton
              onClick={() => setShowVideoTutorial(true)}
              variant="minimal" // Options: "default", "minimal", "icon"
            />
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
              className="hidden md:inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none cursor-pointer shadow-sm transition-colors relative"
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilters.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                  {activeFilters.length}
                </span>
              )}
            </button>
            <button
              onClick={toggleForm}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 btn-primary bg-[#0C4FCD] text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none cursor-pointer shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              {showForm ? "Cancel" : "New Contact"}
            </button>

            <button
              onClick={() => setShowMobileFilters(true)}
              className="md:hidden p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors relative"
            >
              <Filter className="w-5 h-5 text-gray-600" />
              {statusFilter && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
              )}
            </button>
          </div>
        </div>

        {/* Tabs */}
        {/* <div className="border-b border-gray-200 bg-white">
          <nav className="flex px-4 sm:px-6 overflow-x-auto">
            {[
              "All",
              "Leads",
              "Sales Qualified Lead",
              "Customers",
              "Hotlist",
            ].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`cursor-pointer px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
                  }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div> */}

        <div className="border-[#E0E0E1] bg-white border-b mb-6">
          <nav className="flex px-4 sm:px-6 gap-6 overflow-x-auto">
            {[
              { id: "All", label: "All", icon: Sparkles },
              { id: "Leads", label: "Leads", icon: User },
              {
                id: "Sales Qualified Lead",
                label: "Sales Qualified Leads",
                icon: BarChart2,
              },
              { id: "Customers", label: "Customers", icon: Briefcase },
              { id: "Hotlist", label: "Hotlist", icon: Users },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={`group flex items-center gap-2 px-1 py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${activeTab === id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
              >
                <Icon
                  className={`w-4 h-4 ${activeTab === id
                    ? "text-blue-600"
                    : "text-gray-400 group-hover:text-gray-500"
                    }`}
                />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {activeTab !== "Hotlist" && (
          <div className="px-4 sm:px-6 py-2 bg-white flex justify-between items-center border-b border-gray-100 mb-4">
            {/* Left: View Switcher (List vs Kanban) */}
            <div className="flex space-x-6">
              <button
                onClick={() => setShowKanban(false)}
                className={`pb-2 text-sm font-medium transition-colors relative ${!showKanban
                  ? "text-blue-600 after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-blue-600"
                  : "text-gray-500 hover:text-gray-800"
                  }`}
              >
                List View
              </button>
              <button
                onClick={() => setShowKanban(true)}
                className={`pb-2 text-sm font-medium transition-colors relative ${showKanban
                  ? "text-blue-600 after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-blue-600"
                  : "text-gray-500 hover:text-gray-800"
                  }`}
              >
                Kanban
              </button>
            </div>

            {/* Right: Actions (Import/Filter) */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowImport(true)}
                className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
              >
                <Upload className="w-4 h-4" />
                Import/Export
              </button>

              <StatusFilterDropdown />
            </div>
          </div>
        )}

        {/* Content Area */}
        {showKanban ? (
          <KanbanBoard
            columns={allStageStatuses}
            items={contacts}
            getItemColumn={(contact) => contact.stageStatus || "New"}
            renderItem={renderContactCard}
            onItemMove={handleKanbanItemMove}
            getColumnColor={getColumnColor}
            getBadgeColor={getBadgeColor}
            permission={permission}
            itemIdKey="_id"
          />
        ) : activeTab === "Hotlist" ? (
          <ContactFolder />
        ) : (
          <>
            {/* Active Filters Display */}
            {statusFilter && (
              <div className="mx-4 sm:mx-6 mt-4 mb-4 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-blue-700 font-semibold">
                    Active Filter:
                  </span>
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-100 text-blue-800 font-medium">
                    Status: {statusFilter}
                    <button
                      onClick={() => setStatusFilter("")}
                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-200 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                </div>
              </div>
            )}

            <div className="overflow-visible border border-gray-200 rounded-lg mx-4 sm:mx-6 mb-6">
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
                              className={`px-6 py-4 text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 hover:bg-gray-100 transition-colors bg-white ${isRightMostSticky
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

                  <tbody className="bg-white divide-y divide-gray-100">
                    {loading && contacts.length === 0 ? (
                      <tr>
                        <td colSpan={table.getAllColumns().length} className="px-6 py-12 text-center bg-white">
                          <p>Loading Contacts...</p>
                        </td>
                      </tr>
                    ) : contacts.length === 0 ? (
                      <tr>
                        <td colSpan={table.getAllColumns().length} className="px-6 py-12 text-center text-gray-500">
                          <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                          <p className="font-medium">No contacts found</p>
                        </td>
                      </tr>
                    ) : (
                      table.getRowModel().rows.map((row) => (
                        <tr
                          key={row.id}
                          className={`group bg-white hover:bg-blue-50 transition-colors ${selectedContacts.includes(row.original._id) ? "!bg-blue-50" : ""}`}
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
                                className={`px-6 py-2 border-r border-gray-100 align-middle text-sm text-gray-700 bg-inherit ${isRightMostSticky
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

            {/* Pagination */}
            {!loading && <PaginationControls />}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800 font-sf">
                Delete Contact
              </h2>
            </div>
            <p className="text-gray-600 mb-6 font-inter">
              Are you sure you want to delete this contact? This action cannot
              be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setContactToDelete(null);
                }}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Filters Modal */}
      <MobileFiltersModal />

      {/* Export Selected Contacts Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        columns={defaultColumns}
        selectedIds={selectedContacts}
        exportUrl="/contacts/export-selected"
        fileName="Exported_Contacts.csv"
      />

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
                <strong>{selectedContacts.length}</strong> contacts? This action
                cannot be undone.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowBulkDeleteModal(false)}
                  disabled={loading}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await handleBulkDeleteContacts(selectedContacts);
                    setShowBulkDeleteModal(false);
                  }}
                  disabled={loading}
                  className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm flex items-center justify-center min-w-[120px]"
                >
                  {loading ? (
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

      {/* Place this anywhere outside your main layout wrappers */}
      <AdvancedFilterPanel
        isOpen={showAdvancedFilters}
        onClose={() => setShowAdvancedFilters(false)}
        columns={defaultColumns} // Your useMemo default columns handles custom fields perfectly
        filters={activeFilters}
        setFilters={setActiveFilters}
        onApply={(newFilters) => setActiveFilters(newFilters)}
        title="Filter Contacts"
        subtitle="Segment your people database"
        emptyStateText="Add a rule to find specific contacts."
      />

      {/* Bulk Actions Modal */}
      <BulkActions
        isOpen={showBulkActions}
        onClose={() => setShowBulkActions(false)}
        selectedItems={selectedContactObjects}
        onBulkUpdate={handleBulkUpdate}
        fieldConfig={contactFieldConfig}
        module="contacts"
      />
      {/* Add to Folder Modal */}
      <AddToContactHotlistModal
        isOpen={showAddToHotlistModal}
        onClose={() => setShowAddToHotlistModal(false)}
        selectedContactIds={selectedContacts}
        onComplete={() => {
          setSelectionMode(true);
          setSelectedContacts([]);
        }}
      />
      {/* Bulk Note Modal */}
      <NoteEditor
        isOpen={showBulkNoteModal}
        onClose={() => {
          setShowBulkNoteModal(false);
          setNoteContent("");
        }}
        noteContent={noteContent}
        setNoteContent={setNoteContent}
        onSave={handleBulkNoteSave}
        loading={bulkNoteLoading}
        isEditing={false}
        // Dynamic string passing the amount of contacts selected!
        contactName={`${selectedContacts.length} selected contacts`}
      />
      {quickViewContactId && (
        <ContactQuickView
          contactId={quickViewContactId}
          onClose={() => setQuickViewContactId(null)}
          onEdit={(contact) => {
            handleEdit(contact);
            // optionally close quick view
            // setQuickViewContactId(null);
          }}
        />
      )}
      {/* Add To Folder Modal */}
      {showAddToFolderModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-semibold text-gray-900">Add to Folder</h3>
              <button
                onClick={() => setShowAddToFolderModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                Select a folder to add{" "}
                <strong>{contactToAddToFolder?.name}</strong> to:
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {folders.length > 0 ? (
                  folders.map((folder) => (
                    <button
                      key={folder._id}
                      onClick={() => addContactToFolder(folder)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-all group text-left"
                    >
                      <div className="bg-blue-100 p-2 rounded-lg text-blue-600 group-hover:bg-blue-200">
                        <FolderPlus className="w-4 h-4" />
                      </div>
                      <span className="font-medium text-gray-700 group-hover:text-blue-700">
                        {folder.name}
                      </span>
                      <span className="ml-auto text-xs text-gray-400 border border-gray-100 px-2 py-0.5 rounded-full bg-white">
                        {folder.contacts?.length || 0}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-6 text-gray-400 border-2 border-dashed border-gray-100 rounded-lg">
                    No folders found
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Contacts;