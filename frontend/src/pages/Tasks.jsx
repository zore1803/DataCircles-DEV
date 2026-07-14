import React, { useEffect, useState, useMemo } from "react";
import API from "../services/api";
import TaskForm from "../components/Task/TaskForm";
import AdminMeetingForm from "../components/admin/AdminMeetingForm";
import { useLocation, Link } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Edit2,
  Trash2,
  Plus,
  Filter,
  Calendar,
  Users,
  X,
  Download,
  Clock,
  MapPin,
  Building2,
  User,
  Truck,
  Settings,
  Upload,
  MoreVertical,
  CheckCircle,
  List,
  Layout,
} from "lucide-react";
import BulkActions from "../components/BulkActions";
import TaskDetailsModal from "../components/Task/TaskDetailsModal";
import logo from "/DataCircles.png";
import * as XLSX from "xlsx";
import VideoTutorialModal from "../components/VideoTutorialModal";
import { getVideoTutorial } from "../utils/videoTutorials";
import VideoTutorialButton from "../components/VideoTutorialButton";
import TaskKanbanBoard from "../components/Task/TaskKanbanBoard";

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";

// Task Status Dropdown Component
const StatusSelect = ({ task, onUpdate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef(null);
  const statuses = ["Pending", "In Progress", "Completed"];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getBadgeColor = (status) => {
    if (status === "Completed")
      return "bg-green-100 text-green-800 border-green-200";
    if (status === "In Progress")
      return "bg-blue-100 text-blue-800 border-blue-200";
    if (status === "Pending")
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${getBadgeColor(
          task.status,
        )} border-transparent hover:brightness-95`}
      >
        {task.status === "Completed" && <CheckCircle className="w-3 h-3" />}
        <span className="truncate max-w-[100px]">
          {task.status || "Pending"}
        </span>
        <ChevronDown className="w-3 h-3 opacity-50 flex-shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-40 bg-white rounded-lg shadow-xl border border-gray-100 py-1 left-0 max-h-60 overflow-y-auto">
          {statuses.map((status) => (
            <button
              key={status}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(task._id, status);
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between group transition-colors"
            >
              <span
                className={
                  task.status === status ? "font-medium text-blue-600" : ""
                }
              >
                {status}
              </span>
              {task.status === status && (
                <CheckSquare className="w-3 h-3 text-blue-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Meeting Priority Dropdown Component
const MeetingPriorityDropdown = ({ meeting, onUpdate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef(null);
  const priorities = ["low", "medium", "high"];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getBadgeColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "bg-red-50 text-red-600 border-red-100";
      case "medium":
        return "bg-yellow-50 text-yellow-600 border-yellow-100";
      case "low":
        return "bg-green-50 text-green-600 border-green-100";
      default:
        return "bg-gray-50 text-gray-500 border-gray-100";
    }
  };

  const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${getBadgeColor(
          meeting.priority || "medium",
        )} border-transparent hover:brightness-95`}
      >
        <span className="truncate max-w-[100px]">
          {capitalize(meeting.priority || "medium")}
        </span>
        <ChevronDown className="w-3 h-3 opacity-50 flex-shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-32 bg-white rounded-lg shadow-xl border border-gray-100 py-1 left-0 overflow-y-auto">
          {priorities.map((priority) => (
            <button
              key={priority}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(meeting._id, priority);
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between group transition-colors"
            >
              <span
                className={
                  meeting.priority === priority
                    ? "font-medium text-blue-600"
                    : ""
                }
              >
                {capitalize(priority)}
              </span>
              {meeting.priority === priority && (
                <CheckSquare className="w-3 h-3 text-blue-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

function Tasks() {
  // Tab state
  const [activeTab, setActiveTab] = useState("tasks"); // "tasks" or "meetings"
  const [showKanban, setShowKanban] = useState(false);

  // Tasks state
  const [tasks, setTasks] = useState([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    status: "Pending",
    relatedTo: "",
    relationModel: "Company",
    users: [],
  });
  // Available Task Statuses for Kanban
  const taskStatuses = ["Pending", "In Progress", "Completed"];

  // Meetings state
  const [meetings, setMeetings] = useState([]);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [meetingModalMode, setMeetingModalMode] = useState("create");

  // Shared state
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [debouncedFilterStatus, setDebouncedFilterStatus] = useState("");

  // Bulk Selection for Tasks
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [selectionMode, setSelectionMode] = useState(true);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Bulk Selection for Meetings
  const [selectedMeetings, setSelectedMeetings] = useState([]);
  const [showMeetingBulkActions, setShowMeetingBulkActions] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState("task"); // "task" or "meeting"
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [showVideoTutorial, setShowVideoTutorial] = useState(false);
  const [userFilter, setUserFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Debounced states
  const [debouncedUserFilter, setDebouncedUserFilter] = useState("");
  const [debouncedDateFilter, setDebouncedDateFilter] = useState("");

  const location = useLocation();
  const { state } = location;
  useEffect(() => {
    if (state && state.tab && state.tab !== activeTab) {
      setActiveTab(state.tab);
    }
  }, [state]);

  // Pagination & Sorting for Tasks
  const [taskPagination, setTaskPagination] = useState({
    currentPage: 1,
    totalPages: 0,
    totalCount: 0,
    limit: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [taskSortConfig, setTaskSortConfig] = useState({
    key: "createdAt",
    direction: "desc",
  });

  // Pagination & Sorting for Meetings
  const [meetingPagination, setMeetingPagination] = useState({
    currentPage: 1,
    totalPages: 0,
    totalCount: 0,
    limit: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [taskColumnSizing, setTaskColumnSizing] = useState({});
  const [meetingColumnSizing, setMeetingColumnSizing] = useState({});
  const [meetingSortConfig, setMeetingSortConfig] = useState({
    key: "scheduledAt",
    direction: "desc",
  });

  // Debounce effects
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilterStatus(filterStatus), 300);
    return () => clearTimeout(timer);
  }, [filterStatus]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedUserFilter(userFilter), 300);
    return () => clearTimeout(timer);
  }, [userFilter]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedDateFilter(dateFilter), 300);
    return () => clearTimeout(timer);
  }, [dateFilter]);

  // Reset selection on filter/search/tab change
  useEffect(() => {
    exitSelectionMode();
    if (activeTab === "tasks") {
      setTaskPagination((prev) => ({ ...prev, currentPage: 1 }));
    } else {
      setMeetingPagination((prev) => ({ ...prev, currentPage: 1 }));
    }
  }, [debouncedSearchTerm, debouncedFilterStatus, activeTab]);

  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === "tasks") {
      fetchTasks();
    } else {
      fetchMeetings();
    }
  }, [
    activeTab,
    taskPagination.currentPage,
    taskPagination.limit,
    taskSortConfig,
    meetingPagination.currentPage,
    meetingPagination.limit,
    meetingSortConfig,
    debouncedSearchTerm,
    debouncedFilterStatus,
    debouncedUserFilter,
    debouncedDateFilter,
  ]);

  useEffect(() => {
    fetchRelatedData();
  }, []);

  const fetchRelatedData = async () => {
    try {
      const [comp, cont, dl, vend, usr] = await Promise.all([
        API.get("/companies"),
        API.get("/contacts"),
        API.get("/deals"),
        API.get("/vendors"),
        API.get("/auth/all-user"),
      ]);
      setCompanies(comp.data || []);
      setContacts(cont.data || []);
      setDeals(dl.data || []);
      setVendors(vend.data || []);
      setUsers(usr.data?.allUsers || []);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load related data");
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: taskPagination.currentPage,
        limit: taskPagination.limit,
        sortBy: taskSortConfig.key,
        sortOrder: taskSortConfig.direction,
      });
      if (debouncedSearchTerm) params.append("search", debouncedSearchTerm);
      if (debouncedFilterStatus) params.append("status", debouncedFilterStatus);
      if (debouncedUserFilter) params.append("user", debouncedUserFilter);
      if (debouncedDateFilter) params.append("dueDate", debouncedDateFilter);

      const res = await API.get(`/tasks/pagination?${params.toString()}`);
      setTasks(res.data.tasks || []);
      setTaskPagination((prev) => ({
        ...prev,
        ...res.data.pagination,
      }));
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: meetingPagination.currentPage,
        limit: meetingPagination.limit,
        sortBy: meetingSortConfig.key,
        sortOrder: meetingSortConfig.direction,
      });
      if (debouncedSearchTerm) params.append("search", debouncedSearchTerm);
      if (debouncedFilterStatus)
        params.append("priority", debouncedFilterStatus);
      if (debouncedUserFilter) params.append("user", debouncedUserFilter);
      if (debouncedDateFilter)
        params.append("scheduledAt", debouncedDateFilter);

      const res = await API.get(`/meetings/pagination?${params.toString()}`);
      setMeetings(res.data.meetings || []);
      setMeetingPagination((prev) => ({
        ...prev,
        ...res.data.pagination,
      }));
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load meetings");
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  };

  
  // Task handlers
  const toggleTaskForm = () => {
    if (showTaskForm) resetTaskForm();
    setShowTaskForm(!showTaskForm);
  };

  const resetTaskForm = () => {
    setTaskForm({
      title: "",
      description: "",
      dueDate: "",
      status: "Pending",
      relatedTo: "",
      relationModel: "Company",
      users: [],
    });
  };

  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return toast.error("Title is required");

    try {
      setLoading(true);
      if (taskForm._id) {
        await API.put(`/tasks/${taskForm._id}`, taskForm);
        toast.success("Task updated");
      } else {
        await API.post("/tasks", taskForm);
        toast.success("Task created");
      }
      await fetchTasks();
      setShowTaskForm(false);
      exitSelectionMode();
    } catch (err) {
      toast.error(err.response?.data?.error || "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const handleTaskEdit = (task) => {
    setTaskForm({
      _id: task._id || task.id,
      title: task.title,
      description: task.description,
      dueDate: task.dueDate?.substring(0, 10),
      status: task.status || "Pending",
      relatedEntities:
        Array.isArray(task.relatedEntities) && task.relatedEntities.length
          ? task.relatedEntities.map((e) => ({
            entityModel: e.entityModel,
            entityId: e.entityId?._id || e.entityId?.id || e.entityId,
          }))
          : task.relatedTo && task.relationModel
            ? [{ entityModel: task.relationModel, entityId: task.relatedTo }]
            : [{ entityModel: "Company", entityId: "" }],

      users: Array.isArray(task.users)
        ? task.users.map((u) => u.id || u._id)
        : [],
    });

    setShowTaskForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleTaskStatusChange = async (id, status) => {
    try {
      await API.put(`/tasks/${id}/status`, { status });
      fetchTasks();
      toast.success("Status updated");
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Update failed");
      }
    }
  };

  const handleTaskMove = async (taskId, newStatus, oldStatus) => {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t)),
    );
    try {
      await API.put(`/tasks/${taskId}/status`, { status: newStatus });
      toast.success("Task status updated");
    } catch (err) {
      console.error("Move failed", err);
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to update status");
      }
      fetchTasks(); // Revert
    }
  };

  const handleMeetingPriorityChange = async (id, priority) => {
    try {
      setMeetings((prev) =>
        prev.map((m) => (m._id === id ? { ...m, priority } : m)),
      );
      // Using generic update route or specific if available
      await API.put(`/meetings/${id}`, { priority });
      toast.success("Priority updated");
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Update failed");
      }
      fetchMeetings(); // Revert
    }
  };

  // Meeting handlers
  const toggleMeetingForm = () => {
    if (showMeetingForm) {
      setSelectedMeeting(null);
      setMeetingModalMode("create");
    }
    setShowMeetingForm(!showMeetingForm);
  };

  const handleMeetingEdit = (meeting) => {
    setSelectedMeeting(meeting);
    setMeetingModalMode("view");
    setShowMeetingForm(true);
  };

  const handleMeetingSave = async (form) => {
    try {
      if (selectedMeeting) {
        await API.put(`/meetings/${selectedMeeting._id}`, form);
        toast.success("Meeting updated");
      } else {
        await API.post("/meetings", form);
        toast.success("Meeting created");
      }
      await fetchMeetings();
      setShowMeetingForm(false);
      setSelectedMeeting(null);
      exitSelectionMode();
    } catch (err) {
      toast.error(err.response?.data?.error || "Save failed");
    }
  };

  const handleMeetingDelete = async (id) => {
    try {
      await API.delete(`/meetings/${id}`);
      await fetchMeetings();
      toast.success("Meeting deleted");
      exitSelectionMode();
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Delete failed");
      }
    }
  };

  // Generic delete handler
  const handleDelete = (id, type) => {
    setItemToDelete(id);
    setDeleteType(type);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const toastId = toast.loading("Deleting...");
    try {
      if (deleteType === "task") {
        await API.delete(`/tasks/${itemToDelete}`);
        await fetchTasks();
      } else {
        await API.delete(`/meetings/${itemToDelete}`);
        await fetchMeetings();
      }
      toast.success(
        `${deleteType.charAt(0).toUpperCase() + deleteType.slice(1)} deleted`,
        { id: toastId },
      );
      exitSelectionMode();
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.", { id: toastId });
      } else {
        toast.error(err.response?.data?.error || "Delete failed", { id: toastId });
      }
    } finally {
      setShowDeleteModal(false);
      setItemToDelete(null);
    }
  };

  // Selection handlers
  const handleExport = () => {
    const dataToExport = activeTab === "tasks" ? tasks : meetings;
    const filename =
      activeTab === "tasks" ? "tasks_export.xlsx" : "meetings_export.xlsx";

    if (!dataToExport || dataToExport.length === 0) {
      toast.error("No data to export");
      return;
    }

    // Flatten data for export
    const flatData = dataToExport.map((item) => {
      const flatItem = { ...item };

      // Handle nested objects
      if (flatItem.relatedEntities && Array.isArray(flatItem.relatedEntities)) {
        flatItem.relatedEntities = flatItem.relatedEntities
          .map(
            (e) =>
              `${e.entityModel}: ${e.entityId?.name || e.entityId?.title || e.entityId}`,
          )
          .join(", ");
      }

      if (flatItem.participants && Array.isArray(flatItem.participants)) {
        flatItem.participants = flatItem.participants
          .map((p) => p.name || p.email)
          .join(", ");
      }

      if (flatItem.users && Array.isArray(flatItem.users)) {
        flatItem.users = flatItem.users
          .map((u) => u.name || u.email)
          .join(", ");
      }

      // Format dates
      if (flatItem.dueDate)
        flatItem.dueDate = new Date(flatItem.dueDate).toLocaleDateString();
      if (flatItem.scheduledAt)
        flatItem.scheduledAt = new Date(flatItem.scheduledAt).toLocaleString();
      if (flatItem.createdAt)
        flatItem.createdAt = new Date(flatItem.createdAt).toLocaleDateString();
      if (flatItem.updatedAt)
        flatItem.updatedAt = new Date(flatItem.updatedAt).toLocaleDateString();

      // Remove internal fields
      delete flatItem.__v;
      delete flatItem._id;
      delete flatItem.organization;

      return flatItem;
    });

    const ws = XLSX.utils.json_to_sheet(flatData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, filename);
    toast.success(
      `${activeTab === "tasks" ? "Tasks" : "Meetings"} exported successfully`,
    );
  };

  const handleSelectTask = (taskId) => {
    setSelectedTasks((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  };

  const handleSelectMeeting = (meetingId) => {
    setSelectedMeetings((prev) =>
      prev.includes(meetingId)
        ? prev.filter((id) => id !== meetingId)
        : [...prev, meetingId],
    );
  };

  const handleSelectAll = () => {
    if (activeTab === "tasks") {
      if (selectedTasks.length === tasks.length && tasks.length > 0) {
        setSelectedTasks([]);
      } else {
        setSelectedTasks(tasks.map((t) => t._id));
      }
    } else {
      if (selectedMeetings.length === meetings.length && meetings.length > 0) {
        setSelectedMeetings([]);
      } else {
        setSelectedMeetings(meetings.map((m) => m._id));
      }
    }
    setSelectionMode(true);
  };

  const exitSelectionMode = () => {
    setSelectionMode(true);
    setSelectedTasks([]);
    setSelectedMeetings([]);
    setShowBulkActions(false);
    setShowMeetingBulkActions(false);
  };

  // Long press handlers
  const handleMouseDown = (id) => {
    const timer = setTimeout(() => {
      setSelectionMode(true);
      if (activeTab === "tasks") {
        handleSelectTask(id);
      } else {
        handleSelectMeeting(id);
      }
    }, 500);
    setLongPressTimer(timer);
  };

  const handleMouseUp = () => {
    if (longPressTimer) clearTimeout(longPressTimer);
  };

  const handleTouchStart = (id) => {
    const timer = setTimeout(() => {
      setSelectionMode(true);
      if (activeTab === "tasks") {
        handleSelectTask(id);
      } else {
        handleSelectMeeting(id);
      }
    }, 500);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) clearTimeout(longPressTimer);
  };

  const getMeetingEntityName = (meeting) => {
    if (meeting.contact) {
      return typeof meeting.contact === "object"
        ? meeting.contact.name
        : "Contact";
    } else if (meeting.company) {
      return typeof meeting.company === "object"
        ? meeting.company.name
        : "Company";
    } else if (meeting.vendor) {
      return typeof meeting.vendor === "object"
        ? meeting.vendor.name
        : "Vendor";
    }
    return "N/A";
  };

  const getMeetingEntityType = (meeting) => {
    if (meeting.contact) return "Contact";
    if (meeting.company) return "Company";
    if (meeting.vendor) return "Vendor";
    return "Unknown";
  };
  const getRelatedToName = (task) => {
    if (
      task.relatedEntities &&
      Array.isArray(task.relatedEntities) &&
      task.relatedEntities.length > 0
    ) {
      return task.relatedEntities.map((entity, index) => {
        const entityData = entity.entityId;

        let name = "N/A";
        if (entityData && typeof entityData === "object") {
          name = entityData.name || entityData.title || "N/A";
        } else {
          const entityId = entityData;
          const map = {
            Company: companies,
            Contact: contacts,
            Deal: deals,
            Vendor: vendors,
          };
          const options = map[entity.entityModel] || [];
          const related = options.find((item) => item._id === entityId);
          name = related ? related.name || related.title || "N/A" : "N/A";
        }

        return (
          <React.Fragment key={index}>
            <div className="inline-flex flex-col mr-1">
              <span className="font-semibold text-sm text-gray-900">
                {name}
              </span>
              <span className="text-xs text-gray-500 font-normal">
                {entity.entityModel}
              </span>
            </div>
            {index < task.relatedEntities.length - 1 && (
              <span className="text-gray-400 mx-1 self-start">,</span>
            )}
          </React.Fragment>
        );
      });
    }

    if (task.relatedTo && task.relationModel) {
      const map = {
        Company: companies,
        Contact: contacts,
        Deal: deals,
        Vendor: vendors,
      };
      const options = map[task.relationModel] || [];
      const relatedToId = task.relatedTo?._id || task.relatedTo;
      const related = options.find((item) => item._id === relatedToId);
      const name = related ? related.name || related.title || "N/A" : "N/A";

      return (
        <div className="flex flex-col">
          <span className="font-semibold text-sm text-gray-900">{name}</span>
          <span className="text-xs text-gray-500 font-normal">
            {task.relationModel}
          </span>
        </div>
      );
    }

    return <span className="text-sm text-gray-500">N/A</span>;
  };

  const getAssignedUsers = (task) => {
    const ids = Array.isArray(task.users)
      ? task.users.map((u) => u._id || u)
      : task.user
        ? [task.user._id || task.user]
        : [];
    if (!ids.length) return "Self Assigned";
    const names = ids
      .map(
        (id) =>
          users.find((u) => u._id === id)?.name ||
          users.find((u) => u._id === id)?.email,
      )
      .filter(Boolean);
    if (!names.length) return "Self Assigned";
    return names.length > 3
      ? `${names.slice(0, 2).join(", ")} +${names.length - 2} more`
      : names.join(", ");
  };

  const getMeetingParticipants = (meeting) => {
    if (!meeting.participants || meeting.participants.length === 0)
      return "No participants";
    const names = meeting.participants
      .map((p) =>
        typeof p === "object" ? p.name : users.find((u) => u._id === p)?.name,
      )
      .filter(Boolean);
    if (!names.length) return "No participants";
    return names.length > 3
      ? `${names.slice(0, 2).join(", ")} +${names.length - 2} more`
      : names.join(", ");
  };

  const getStatusColor = (status) => {
    if (status === "Completed")
      return "bg-green-100 text-green-800 border-green-200";
    if (status === "In Progress")
      return "bg-blue-100 text-blue-800 border-blue-200";
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  };

  const getMeetingTypeIcon = (type) => {
    switch (type) {
      case "video-call":
        return "🎥";
      case "phone-call":
        return "📞";
      default:
        return "🏢";
    }
  };

  // Sorting handlers
  const handleSort = (key) => {
    if (activeTab === "tasks") {
      setTaskSortConfig((prev) => ({
        key,
        direction:
          prev.key === key && prev.direction === "asc" ? "desc" : "asc",
      }));
      setTaskPagination((prev) => ({ ...prev, currentPage: 1 }));
    } else {
      setMeetingSortConfig((prev) => ({
        key,
        direction:
          prev.key === key && prev.direction === "asc" ? "desc" : "asc",
      }));
      setMeetingPagination((prev) => ({ ...prev, currentPage: 1 }));
    }
    exitSelectionMode();
  };

  const SortIcons = ({ field, config }) => (
    <div className="flex flex-col ml-1">
      <ChevronUp
        className={`w-3 h-3 ${config.key === field && config.direction === "asc" ? "text-blue-600" : "text-gray-400"}`}
      />
      <ChevronDown
        className={`w-3 h-3 -mt-1 ${config.key === field && config.direction === "desc" ? "text-blue-600" : "text-gray-400"}`}
      />
    </div>
  );

  const SortableHeader = ({ field, children }) => {
    const sortConfig =
      activeTab === "tasks" ? taskSortConfig : meetingSortConfig;

    return (
      <th
        onClick={() => handleSort(field)}
        className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none border-r border-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {children}
          <div className="flex flex-col">
            <ChevronUp
              className={`w-3 h-3 ${sortConfig.key === field && sortConfig.direction === "asc"
                ? "text-blue-600"
                : "text-gray-300"
                }`}
            />
            <ChevronDown
              className={`w-3 h-3 -mt-1 ${sortConfig.key === field && sortConfig.direction === "desc"
                ? "text-blue-600"
                : "text-gray-300"
                }`}
            />
          </div>
        </div>
      </th>
    );
  };

  const taskColumnHelper = createColumnHelper();
  const taskColumnsConfig = useMemo(
    () => [
      taskColumnHelper.display({
        id: "selection",
        size: 60,
        enableResizing: false,
        header: () => (
          <div className="flex justify-center items-center w-full">
            <input
              type="checkbox"
              checked={
                tasks.length > 0 && selectedTasks.length === tasks.length
              }
              onChange={(e) => {
                e.stopPropagation();
                handleSelectAllTasks();
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex justify-center items-center w-full">
            <input
              type="checkbox"
              checked={selectedTasks.includes(row.original._id)}
              onChange={(e) => {
                e.stopPropagation();
                handleSelectTask(row.original._id);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        ),
      }),
      taskColumnHelper.accessor("title", {
        id: "title",
        size: 250,
        header: () => (
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => handleSort("title")}
          >
            <span className="truncate" title="Task">
              Task
            </span>
            <SortIcons field="title" config={taskSortConfig} />
          </div>
        ),
        cell: ({ row }) => {
          const task = row.original;
          return (
            <div className="flex items-start gap-3 w-full overflow-hidden">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleTaskStatusChange(
                    task._id,
                    task.status === "Completed" ? "Pending" : "Completed",
                  );
                }}
                className={`flex-shrink-0 mt-0.5 p-0.5 rounded-full transition-all duration-200 ${task.status === "Completed" ? "bg-green-100 text-green-600" : "text-gray-300 hover:text-green-500 hover:bg-green-50"}`}
              >
                <CheckCircle className="w-5 h-5" />
              </button>
              <div className="flex flex-col flex-1 min-w-0">
                <span
                  className={`font-medium text-gray-900 truncate ${task.status === "Completed" ? "line-through text-gray-400" : ""}`}
                  title={task.title}
                >
                  {task.title}
                </span>
                {task.description && (
                  <p
                    className={`text-xs text-gray-500 truncate mt-0.5 ${task.status === "Completed" ? "line-through text-gray-300" : ""}`}
                    title={task.description}
                  >
                    {task.description}
                  </p>
                )}
              </div>
            </div>
          );
        },
      }),
      taskColumnHelper.accessor("dueDate", {
        id: "dueDate",
        size: 150,
        header: () => (
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => handleSort("dueDate")}
          >
            <span className="truncate" title="Due Date">
              Due Date
            </span>
            <SortIcons field="dueDate" config={taskSortConfig} />
          </div>
        ),
        cell: ({ getValue }) => {
          const val = getValue();
          return (
            <div
              className="truncate text-gray-700"
              title={val ? new Date(val).toLocaleDateString() : "No Date"}
            >
              {val ? new Date(val).toLocaleDateString() : "No Date"}
            </div>
          );
        },
      }),
      taskColumnHelper.accessor("status", {
        id: "status",
        size: 160,
        header: () => (
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => handleSort("status")}
          >
            <span className="truncate" title="Status">
              Status
            </span>
            <SortIcons field="status" config={taskSortConfig} />
          </div>
        ),
        cell: ({ row }) => (
          <div
            className="w-full flex items-center"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <StatusSelect
              task={row.original}
              onUpdate={handleTaskStatusChange}
            />
          </div>
        ),
      }),
      taskColumnHelper.accessor("relatedTo", {
        id: "relatedTo",
        size: 200,
        header: () => (
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => handleSort("relatedTo")}
          >
            <span className="truncate" title="Related To">
              Related To
            </span>
            <SortIcons field="relatedTo" config={taskSortConfig} />
          </div>
        ),
        cell: ({ row }) => (
          <div className="truncate text-gray-700 w-full">
            {getRelatedToName(row.original)}
          </div>
        ),
      }),
      taskColumnHelper.accessor("users", {
        id: "users",
        size: 200,
        header: () => (
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => handleSort("users")}
          >
            <span className="truncate" title="Assigned Users">
              Assigned Users
            </span>
            <SortIcons field="users" config={taskSortConfig} />
          </div>
        ),
        cell: ({ row }) => (
          <div
            className="truncate text-gray-700 w-full"
            title={getAssignedUsers(row.original)}
          >
            {getAssignedUsers(row.original)}
          </div>
        ),
      }),
      taskColumnHelper.display({
        id: "actions",
        size: 80,
        enableResizing: false,
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center justify-end w-full relative">
            <div
              className="relative inline-block text-left group/action"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <MoreVertical className="w-4 h-4" />
              </button>
              <div className="hidden group-hover/action:block absolute right-0 mt-0 w-32 bg-white rounded-lg shadow-lg border border-gray-100 z-50 py-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTaskEdit(row.original);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 flex items-center gap-2"
                >
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(row.original._id, "task");
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          </div>
        ),
      }),
    ],
    [
      tasks,
      selectedTasks,
      taskSortConfig,
      users,
      companies,
      contacts,
      deals,
      vendors,
    ],
  );

  const taskTable = useReactTable({
    data: tasks,
    columns: taskColumnsConfig,
    state: { columnSizing: taskColumnSizing },
    onColumnSizingChange: setTaskColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    getRowId: (row) => row._id, // Ensures stable clicking/selection when sorting
  });

  /* ==================== TANSTACK TABLE: MEETINGS ==================== */
  const meetingColumnHelper = createColumnHelper();
  const meetingColumnsConfig = useMemo(
    () => [
      meetingColumnHelper.display({
        id: "selection",
        size: 60,
        enableResizing: false,
        header: () => (
          <div className="flex justify-center items-center w-full">
            <input
              type="checkbox"
              checked={
                meetings.length > 0 &&
                selectedMeetings.length === meetings.length
              }
              onChange={(e) => {
                e.stopPropagation();
                handleSelectAllMeetings();
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex justify-center items-center w-full">
            <input
              type="checkbox"
              checked={selectedMeetings.includes(row.original._id)}
              onChange={(e) => {
                e.stopPropagation();
                handleSelectMeeting(row.original._id);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        ),
      }),
      meetingColumnHelper.accessor("title", {
        id: "title",
        size: 250,
        header: () => (
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => handleSort("title")}
          >
            <span className="truncate" title="Topic">
              Topic
            </span>
            <SortIcons field="title" config={meetingSortConfig} />
          </div>
        ),
        cell: ({ row }) => {
          const meeting = row.original;
          return (
            <div className="w-full truncate">
              <div
                className="text-sm font-medium text-gray-900 truncate"
                title={meeting.title}
              >
                {meeting.title}
              </div>
              <div
                className="text-xs text-gray-500 mt-0.5 truncate"
                title={`With ${getMeetingEntityName(meeting)}`}
              >
                With {getMeetingEntityName(meeting)}
              </div>
            </div>
          );
        },
      }),
      meetingColumnHelper.accessor("type", {
        id: "type",
        size: 150,
        header: () => (
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => handleSort("type")}
          >
            <span className="truncate" title="Type">
              Type
            </span>
            <SortIcons field="type" config={meetingSortConfig} />
          </div>
        ),
        cell: ({ getValue }) => {
          const val = getValue();
          return (
            <div
              className="flex items-center gap-2 truncate text-gray-700 w-full"
              title={val}
            >
              <span className="text-xl flex-shrink-0">
                {getMeetingTypeIcon(val)}
              </span>
              <span className="capitalize truncate">
                {val ? val.replace("-", " ") : "Meeting"}
              </span>
            </div>
          );
        },
      }),
      meetingColumnHelper.accessor("scheduledAt", {
        id: "scheduledAt",
        size: 180,
        header: () => (
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => handleSort("scheduledAt")}
          >
            <span className="truncate" title="Date">
              Date
            </span>
            <SortIcons field="scheduledAt" config={meetingSortConfig} />
          </div>
        ),
        cell: ({ getValue }) => {
          const val = getValue();
          if (!val)
            return <div className="text-gray-700 truncate w-full">No Date</div>;
          const d = new Date(val);
          return (
            <div
              className="w-full truncate text-gray-700"
              title={d.toLocaleString()}
            >
              <div>{d.toLocaleDateString()}</div>
              <div className="text-xs text-gray-500">
                {d.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          );
        },
      }),
      meetingColumnHelper.accessor("duration", {
        id: "duration",
        size: 120,
        header: () => (
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => handleSort("duration")}
          >
            <span className="truncate" title="Duration">
              Duration
            </span>
            <SortIcons field="duration" config={meetingSortConfig} />
          </div>
        ),
        cell: ({ getValue }) => (
          <div className="truncate text-gray-700 w-full">
            {getValue() ? `${getValue()} min` : "N/A"}
          </div>
        ),
      }),
      meetingColumnHelper.accessor("priority", {
        id: "priority",
        size: 150,
        header: () => (
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => handleSort("priority")}
          >
            <span className="truncate" title="Priority">
              Priority
            </span>
            <SortIcons field="priority" config={meetingSortConfig} />
          </div>
        ),
        cell: ({ row }) => (
          <div
            className="w-full flex items-center"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <MeetingPriorityDropdown
              meeting={row.original}
              onUpdate={handleMeetingPriorityChange}
            />
          </div>
        ),
      }),
      meetingColumnHelper.accessor("participants", {
        id: "participants",
        size: 200,
        header: () => (
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => handleSort("participants")}
          >
            <span className="truncate" title="Participants">
              Participants
            </span>
            <SortIcons field="participants" config={meetingSortConfig} />
          </div>
        ),
        cell: ({ row }) => (
          <div
            className="truncate text-gray-700 w-full"
            title={getMeetingParticipants(row.original)}
          >
            {getMeetingParticipants(row.original)}
          </div>
        ),
      }),
      meetingColumnHelper.display({
        id: "actions",
        size: 80,
        enableResizing: false,
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center justify-end w-full relative">
            <div
              className="relative inline-block text-left group/action"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <MoreVertical className="w-4 h-4" />
              </button>
              <div className="hidden group-hover/action:block absolute right-0 mt-0 w-32 bg-white rounded-lg shadow-lg border border-gray-100 z-50 py-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMeetingEdit(row.original);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 flex items-center gap-2"
                >
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(row.original._id, "meeting");
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          </div>
        ),
      }),
    ],
    [
      meetings,
      selectedMeetings,
      meetingSortConfig,
      users,
      companies,
      contacts,
      vendors,
    ],
  );

  const meetingTable = useReactTable({
    data: meetings,
    columns: meetingColumnsConfig,
    state: { columnSizing: meetingColumnSizing },
    onColumnSizingChange: setMeetingColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    getRowId: (row) => row._id, // Ensures stable clicking/selection when sorting
  });

  // Pagination handlers
  const handlePageChange = (page) => {
    const pagination =
      activeTab === "tasks" ? taskPagination : meetingPagination;
    if (
      page >= 1 &&
      page <= pagination.totalPages &&
      page !== pagination.currentPage
    ) {
      if (activeTab === "tasks") {
        setTaskPagination((prev) => ({ ...prev, currentPage: page }));
      } else {
        setMeetingPagination((prev) => ({ ...prev, currentPage: page }));
      }
      exitSelectionMode();
    }
  };

  const handleLimitChange = (limit) => {
    if (activeTab === "tasks") {
      setTaskPagination((prev) => ({ ...prev, limit, currentPage: 1 }));
    } else {
      setMeetingPagination((prev) => ({ ...prev, limit, currentPage: 1 }));
    }
    exitSelectionMode();
  };

  const PaginationControls = () => {
    const pagination =
      activeTab === "tasks" ? taskPagination : meetingPagination;

    if (pagination.totalCount === 0) return null;
    const start = (pagination.currentPage - 1) * pagination.limit + 1;
    const end = Math.min(
      pagination.currentPage * pagination.limit,
      pagination.totalCount,
    );

    const pages = [];
    const delta = 2;
    for (
      let i = Math.max(2, pagination.currentPage - delta);
      i <= Math.min(pagination.totalPages - 1, pagination.currentPage + delta);
      i++
    )
      pages.push(i);
    const pageNumbers = [1];
    if (pagination.currentPage - delta > 2) pageNumbers.push("...");
    pageNumbers.push(...pages);
    if (pagination.currentPage + delta < pagination.totalPages - 1)
      pageNumbers.push("...");
    if (pagination.totalPages > 1) pageNumbers.push(pagination.totalPages);

    return (
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center space-x-2">
            <p className="text-sm text-gray-700 font-inter">
              Showing <span className="font-semibold">{start}</span> to{" "}
              <span className="font-semibold">{end}</span> of{" "}
              <span className="font-semibold">{pagination.totalCount}</span>{" "}
              results
            </p>
            <select
              value={pagination.limit}
              onChange={(e) => handleLimitChange(parseInt(e.target.value))}
              className="ml-2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-gray-700"
            >
              {[10, 20, 50, 100].map((v) => (
                <option key={v} value={v}>
                  {v} per page
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={!pagination.hasPrevPage}
              className="relative inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pageNumbers.map((p, i) =>
              p === "..." ? (
                <span
                  key={`dots-${i}`}
                  className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700"
                >
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => handlePageChange(p)}
                  className={`relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${p === pagination.currentPage ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                >
                  {p}
                </button>
              ),
            )}
            <button
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={!pagination.hasNextPage}
              className="relative inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white min-h-screen">
      <Toaster position="top-right" toastOptions={{ duration: 5000 }} />

      {/* Video Tutorial Modal */}
      <VideoTutorialModal
        isOpen={showVideoTutorial}
        onClose={() => setShowVideoTutorial(false)}
        videoId={getVideoTutorial("tasks")?.videoId}
        title={getVideoTutorial("tasks")?.title}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 mt-5 gap-4">
        <div className="flex items-center gap-3">
          <div className="mb-10 mt-10">
            <div className="flex items-center gap-2 mb-1">
              <Link
                to="/"
                className="text-gray-500 hover:text-gray-900 text-sm font-medium"
              >
                Dashboard
              </Link>
            </div>
            <h1 className="font-bold text-3xl font-sf text-gray-900">
              Tasks and Meetings
            </h1>
            <p className="text-sm text-gray-500 font-inter">
              Manage your customer relationships
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white overflow-hidden border-b border-gray-100">
        {/* ======================= TABS ======================= */}
        <div className="border-b border-gray-200 bg-white">
          <nav className="flex px-4 sm:px-6 gap-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab("tasks")}
              className={`group flex items-center gap-2 py-4 px-1 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === "tasks"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <List
                className={`w-4 h-4 ${activeTab === "tasks" ? "text-blue-600" : "text-gray-400 group-hover:text-gray-500"}`}
              />
              Tasks
            </button>
            <button
              onClick={() => setActiveTab("meetings")}
              className={`group flex items-center gap-2 py-4 px-1 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === "meetings"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <Calendar
                className={`w-4 h-4 ${activeTab === "meetings" ? "text-blue-600" : "text-gray-400 group-hover:text-gray-500"}`}
              />
              Meetings
            </button>
          </nav>
        </div>

        {/* ======================= SUB-HEADER (Search, Filter, View Toggle) ======================= */}
        <div className="p-4 sm:p-6 mb-2">
          <div className="flex flex-col gap-4">
            {/* Search Row */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-[70%] pl-10 pr-4 py-2.5 border border-[#E0E0E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 transition-colors font-inter bg-gradient-to-r from-white to-blue-100"
                  placeholder={
                    activeTab === "tasks"
                      ? "Search Task by Title or Description..."
                      : "Search Meetings by Title..."
                  }
                />
              </div>

              <button
                onClick={
                  activeTab === "tasks" ? toggleTaskForm : toggleMeetingForm
                }
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 btn-primary bg-[#0C4FCD] text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none cursor-pointer shadow-sm transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                {activeTab === "tasks" ? "New Task" : "New Meeting"}
              </button>
            </div>

            {/* Second Row: View Toggle (Tasks Only) and Filters */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-2">
              {/* Left: View Toggle */}
              {activeTab === "tasks" ? (
                <div className="flex space-x-6 border-b border-transparent">
                  <button
                    onClick={() => setShowKanban(false)}
                    className={`pb-2 text-sm font-bold transition-colors relative ${
                      !showKanban
                        ? "text-blue-600 after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-blue-600"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    List View
                  </button>
                  <button
                    onClick={() => setShowKanban(true)}
                    className={`pb-2 text-sm font-bold transition-colors relative ${
                      showKanban
                        ? "text-blue-600 after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-blue-600"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    Kanban View
                  </button>
                </div>
              ) : (
                <div></div> /* Spacer for meetings tab */
              )}

              {/* Right: Filters / Import */}
              <div className="flex items-center gap-4 self-end sm:self-auto">
                <button
                  onClick={handleExport}
                  className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>

                <button
                  className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors cursor-pointer"
                  onClick={() => {
                    setShowMobileFilters(!showMobileFilters);
                    toast("Filter options toggled", { icon: "🔍" });
                  }}
                >
                  <Filter className="w-4 h-4" />
                  Filter
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ======================= CONTENT AREA ======================= */}

        {/* TASKS CONTENT */}
        {activeTab === "tasks" && (
          <>
            {showKanban ? (
              <div className="p-4 sm:p-6 bg-gray-50 min-h-[500px]">
                <TaskKanbanBoard
                  columns={taskStatuses}
                  items={tasks}
                  getItemColumn={(task) => task.status || "Pending"}
                  renderItem={null}
                  onItemMove={handleTaskMove}
                  onCardEdit={handleTaskEdit}
                  onCardDelete={(task) => handleDelete(task._id, "task")}
                  onAddTask={() => toggleTaskForm()}
                />
              </div>
            ) : (
              <div
                className={`relative overflow-hidden mx-4 sm:mx-6 mb-6 border border-gray-200 rounded-lg ${loading ? "pointer-events-none opacity-60" : ""}`}
              >
                <div className="overflow-x-auto overflow-y-visible">
                  <table
                    className="w-full text-sm text-gray-700 border-collapse text-left"
                    style={{
                      width: "100%",
                      minWidth: `${taskTable.getTotalSize()}px`,
                      tableLayout: "fixed",
                    }}
                  >
                    <thead className="bg-gray-50 border-b border-gray-200">
                      {taskTable.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <th
                              key={header.id}
                              style={{
                                width: header.getSize(),
                                position: "relative",
                              }}
                              className="px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs border-r border-gray-200 last:border-r-0 hover:bg-gray-100 transition-colors"
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
                                  className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-blue-400 z-50 ${header.column.getIsResizing() ? "bg-blue-500" : "bg-transparent"}`}
                                />
                              )}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {loading && tasks.length === 0 ? (
                        <tr>
                          <td
                            colSpan={taskTable.getAllColumns().length}
                            className="px-6 py-12 text-center text-gray-500 font-medium"
                          >
                            Loading Tasks...
                          </td>
                        </tr>
                      ) : tasks.length === 0 ? (
                        <tr>
                          <td
                            colSpan={taskTable.getAllColumns().length}
                            className="px-6 py-12 text-center text-gray-500 font-medium"
                          >
                            No tasks found.
                          </td>
                        </tr>
                      ) : (
                        taskTable.getRowModel().rows.map((row) => (
                          <tr
                            key={row.id}
                            onMouseDown={() =>
                              handleMouseDown(row.original._id, "task")
                            }
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onTouchStart={() =>
                              handleTouchStart(row.original._id, "task")
                            }
                            onTouchEnd={handleTouchEnd}
                            className={`group hover:bg-gray-50 transition-colors ${selectedTasks.includes(row.original._id) ? "bg-blue-50/50" : "bg-white"}`}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <td
                                key={cell.id}
                                style={{ width: cell.column.getSize() }}
                                className="px-4 py-2 border-r border-gray-100 last:border-r-0 align-middle"
                              >
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext(),
                                )}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {!loading && !showKanban && <PaginationControls />}
          </>
        )}

        {/* MEETINGS CONTENT */}
        {activeTab === "meetings" && (
          <>
            <div
              className={`relative overflow-hidden mx-4 sm:mx-6 mb-6 border border-gray-200 rounded-lg ${loading ? "pointer-events-none opacity-60" : ""}`}
            >
              <div className="overflow-x-auto overflow-y-visible">
                <table
                  className="w-full text-sm text-gray-700 border-collapse text-left"
                  style={{
                    width: "100%",
                    minWidth: `${meetingTable.getTotalSize()}px`,
                    tableLayout: "fixed",
                  }}
                >
                  <thead className="bg-gray-50 border-b border-gray-200">
                    {meetingTable.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            style={{
                              width: header.getSize(),
                              position: "relative",
                            }}
                            className="px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs border-r border-gray-200 last:border-r-0 hover:bg-gray-100 transition-colors"
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
                                className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-blue-400 z-50 ${header.column.getIsResizing() ? "bg-blue-500" : "bg-transparent"}`}
                              />
                            )}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {loading && meetings.length === 0 ? (
                      <tr>
                        <td
                          colSpan={meetingTable.getAllColumns().length}
                          className="px-6 py-12 text-center text-gray-500 font-medium"
                        >
                          Loading Meetings...
                        </td>
                      </tr>
                    ) : meetings.length === 0 ? (
                      <tr>
                        <td
                          colSpan={meetingTable.getAllColumns().length}
                          className="px-6 py-12 text-center text-gray-500 font-medium"
                        >
                          No meetings found.
                        </td>
                      </tr>
                    ) : (
                      meetingTable.getRowModel().rows.map((row) => (
                        <tr
                          key={row.id}
                          onMouseDown={() =>
                            handleMouseDown(row.original._id, "meeting")
                          }
                          onMouseUp={handleMouseUp}
                          onMouseLeave={handleMouseUp}
                          onTouchStart={() =>
                            handleTouchStart(row.original._id, "meeting")
                          }
                          onTouchEnd={handleTouchEnd}
                          className={`group hover:bg-gray-50 transition-colors ${selectedMeetings.includes(row.original._id) ? "bg-blue-50/50" : "bg-white"}`}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td
                              key={cell.id}
                              style={{ width: cell.column.getSize() }}
                              className="px-4 py-2 border-r border-gray-100 last:border-r-0 align-middle"
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {!loading && <PaginationControls />}
          </>
        )}
      </div>

      {/* Legacy Forms/Modals */}
      {showTaskForm && (
        <TaskForm
          form={taskForm}
          setForm={setTaskForm}
          users={users}
          companies={companies}
          contacts={contacts}
          deals={deals}
          vendors={vendors}
          loading={loading}
          onSubmit={handleTaskSubmit}
          onCancel={() => setShowTaskForm(false)}
          fetchTasks={fetchTasks}
        />
      )}

      {showMeetingForm && (
        <AdminMeetingForm
          open={showMeetingForm}
          onClose={() => setShowMeetingForm(false)}
          onSubmit={handleMeetingSave}
          initialData={selectedMeeting || {}}
          contacts={contacts}
          companies={companies}
          vendors={vendors}
          mode={meetingModalMode}
          onSave={handleMeetingSave}
        />
      )}

      {/* {showMeetingForm && (
        <AdminMeetingForm
          open={showMeetingForm}
          mode={meetingModalMode}
          meetingData={selectedMeeting}
          calendarDate={null} // optional
          users={users}
          contacts={contacts}
          companies={companies}
          vendors={vendors}
          candidates={null} // if you have candidates
          onSave={async (payload) => {
            await API.post("/meetings", payload);
            // refresh meetings list
          }}
          onDelete={async (id) => {
            await API.delete(`/meetings/${id}`);
            // refresh
          }}
          onClose={() => setShowMeetingForm(false)}
        />
      )} */}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            {/* Same content as before */}
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-lg">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800 font-sf">
                Delete {deleteType === "task" ? "Task" : "Meeting"}
              </h2>
            </div>
            <p className="text-gray-600 mb-6 font-inter">
              Are you sure you want to delete this {deleteType}? This action
              cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions (Optional integration) */}
      <BulkActions
        isOpen={showBulkActions}
        onClose={() => setShowBulkActions(false)}
        selectedItems={selectedTasks.map((id) =>
          tasks.find((t) => t._id === id),
        )}
        module="tasks"
        // Implement handleBulkUpdate/Delete if strictly needed, otherwise hide/disable
      />
    </div>
  );
}

export default Tasks;
