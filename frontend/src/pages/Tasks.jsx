import React, { useEffect, useState, useMemo } from "react";
import API from "../services/api";
import TaskForm from "../components/Task/TaskForm";
import AdminMeetingForm from "../components/admin/AdminMeetingForm";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";
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
import AppToaster from "../components/AppToaster";

const TuneFilterIcon = (props) => (
  <svg viewBox="433 15 24 24" width={16} height={16} fill="none" {...props}>
    <path
      d="M444.167 19.8346C444.167 19.1443 444.726 18.5846 445.417 18.5846C446.107 18.5846 446.667 19.1443 446.667 19.8346C446.667 20.525 446.107 21.0846 445.417 21.0846C444.726 21.0846 444.167 20.525 444.167 19.8346ZM445.417 16.918C443.806 16.918 442.5 18.2238 442.5 19.8346C442.5 21.4455 443.806 22.7513 445.417 22.7513C447.027 22.7513 448.333 21.4455 448.333 19.8346C448.333 18.2238 447.027 16.918 445.417 16.918ZM450 20.668H456.667V19.0013H450V20.668ZM453.333 28.168C453.333 27.4776 453.893 26.918 454.583 26.918C455.274 26.918 455.833 27.4776 455.833 28.168C455.833 28.8583 455.274 29.418 454.583 29.418C453.893 29.418 453.333 28.8583 453.333 28.168ZM454.583 25.2513C452.972 25.2513 451.667 26.5571 451.667 28.168C451.667 29.7788 452.972 31.0846 454.583 31.0846C456.194 31.0846 457.5 29.7788 457.5 28.168C457.5 26.5571 456.194 25.2513 454.583 25.2513ZM443.333 27.3346V29.0013H450V27.3346H443.333Z"
      fill="currentColor"
    />
  </svg>
);

const CustomListIcon = (props) => (
  <svg viewBox="498.5 16.917 15 14.167" width={16} height={16} fill="none" {...props}>
    <path
      d="M502.667 17.3337H513.5V19.0003H502.667V17.3337ZM498.5 16.917H501V19.417H498.5V16.917ZM498.5 22.7503H501V25.2503H498.5V22.7503ZM498.5 28.5837H501V31.0837H498.5V28.5837ZM502.667 23.167H513.5V24.8337H502.667V23.167ZM502.667 29.0003H513.5V30.667H502.667V29.0003Z"
      fill="currentColor"
    />
  </svg>
);

const CustomKanbanIcon = (props) => (
  <svg viewBox="538 14 20 20" width={16} height={16} fill="none" {...props}>
    <path
      d="M543.833 28.1667H545.5V19.8333H543.833V28.1667ZM550.5 26.5H552.167V19.8333H550.5V26.5ZM547.167 24H548.833V19.8333H547.167V24ZM542.167 31.5C541.708 31.5 541.316 31.3368 540.99 31.0104C540.663 30.684 540.5 30.2917 540.5 29.8333V18.1667C540.5 17.7083 540.663 17.316 540.99 16.9896C541.316 16.6632 541.708 16.5 542.167 16.5H553.833C554.292 16.5 554.684 16.6632 555.01 16.9896C555.337 17.316 555.5 17.7083 555.5 18.1667V29.8333C555.5 30.2917 555.337 30.684 555.01 31.0104C554.684 31.3368 554.292 31.5 553.833 31.5H542.167ZM542.167 29.8333H553.833V18.1667H542.167V29.8333Z"
      fill="currentColor"
    />
  </svg>
);

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
      <AppToaster />

      {/* Video Tutorial Modal */}
      <VideoTutorialModal
        isOpen={showVideoTutorial}
        onClose={() => setShowVideoTutorial(false)}
        videoId={getVideoTutorial("tasks")?.videoId}
        title={getVideoTutorial("tasks")?.title}
      />

      {/* Header */}
      <div
        className="flex flex-row justify-between items-center"
        style={{
          boxSizing: "border-box",
          padding: "12px 24px",
          gap: 16,
          width: "100%",
          height: 72,
          background: "#FFFFFF",
          borderBottom: "1px solid #E1E4EA",
        }}
      >
        <div className="flex flex-col items-start" style={{ gap: 6 }}>
          <span
            style={{
              fontFamily: "Inter",
              fontWeight: 500,
              fontSize: 16,
              lineHeight: "120%",
              letterSpacing: "-0.5px",
              color: "#0E121B",
            }}
          >
            Tasks & Meetings
          </span>
          <span
            style={{
              fontFamily: "Inter",
              fontWeight: 400,
              fontSize: 12,
              lineHeight: "120%",
              color: "#525866",
            }}
          >
            Manage your Tasks & reminders
          </span>
        </div>
        <div className="flex flex-row items-center flex-shrink-0" style={{ gap: 8 }}>
          <button
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 44,
              height: 44,
              background: "#FFFFFF",
              border: "1px solid #E1E4EA",
              borderRadius: 96,
            }}
          >
            <MoreVertical size={20} style={{ color: "#1F2937" }} />
          </button>
          <button
            className="flex items-center justify-center flex-shrink-0"
            style={{
              padding: 12,
              gap: 6,
              width: 146,
              height: 44,
              background: "#0085FF",
              borderRadius: 96,
            }}
          >
            <Plus size={20} style={{ color: "#FFFFFF" }} />
            <span
              style={{
                fontFamily: "Inter",
                fontWeight: 500,
                fontSize: 14,
                lineHeight: "20px",
                color: "#FFFFFF",
              }}
            >
              New Activity
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white overflow-hidden border-b border-gray-100">
        {/* ======================= TABBING STRIP ======================= */}
        <div
          className="flex flex-row justify-between items-center"
          style={{
            boxSizing: "border-box",
            padding: "0px 24px",
            width: "100%",
            height: 64,
            background: "#FFFFFF",
            borderBottom: "1px solid #F1F1F5",
          }}
        >
          <div className="flex flex-row items-center flex-shrink-0" style={{ height: 64 }}>
            <button
              onClick={() => setActiveTab("tasks")}
              className="flex flex-row justify-center items-center flex-shrink-0"
              style={{
                boxSizing: "border-box",
                padding: "0px 16px",
                gap: 10,
                height: 64,
                borderBottom: activeTab === "tasks" ? "3px solid #0085FF" : "3px solid transparent",
                fontFamily: "Inter",
                fontWeight: 600,
                fontSize: 14,
                lineHeight: "150%",
                letterSpacing: "-0.02em",
                color: activeTab === "tasks" ? "#0085FF" : "#44444A",
                whiteSpace: "nowrap",
              }}
            >
              Tasks
            </button>
            <button
              onClick={() => setActiveTab("meetings")}
              className="flex flex-row justify-center items-center flex-shrink-0"
              style={{
                boxSizing: "border-box",
                padding: "0px 16px",
                gap: 10,
                height: 64,
                borderBottom: activeTab === "meetings" ? "3px solid #0085FF" : "3px solid transparent",
                fontFamily: "Inter",
                fontWeight: 600,
                fontSize: 14,
                lineHeight: "150%",
                letterSpacing: "-0.02em",
                color: activeTab === "meetings" ? "#0085FF" : "#44444A",
                whiteSpace: "nowrap",
              }}
            >
              Meetings
            </button>
          </div>

          <div className="flex flex-row items-center flex-shrink-0" style={{ gap: 12 }}>
            <div
              className="flex flex-row items-center flex-shrink-0"
              style={{
                boxSizing: "border-box",
                padding: "12px 14px",
                gap: 10,
                width: 416,
                height: 44,
                border: "1px solid rgba(31, 41, 55, 0.1)",
                borderRadius: 95,
              }}
            >
              <Search className="w-5 h-5 flex-shrink-0" style={{ color: "#1F2937", opacity: 0.5 }} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent focus:outline-none"
                style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 14, lineHeight: "20px", color: "#1F2937" }}
                placeholder={
                  activeTab === "tasks"
                    ? "Search Task by Title or Description..."
                    : "Search Meetings by Title..."
                }
              />
            </div>

            <button
              onClick={() => {
                setShowMobileFilters(!showMobileFilters);
                toast("Filter options toggled", { icon: "🔍" });
              }}
              className="flex flex-row justify-center items-center flex-shrink-0"
              style={{
                boxSizing: "border-box",
                padding: 12,
                gap: 8,
                width: 44,
                height: 44,
                background: "#FFFFFF",
                border: "1px solid #E1E4EA",
                borderRadius: 95,
              }}
            >
              <TuneFilterIcon style={{ color: "#1F2937" }} />
            </button>

            {activeTab === "tasks" && (
              <div
                className="flex flex-row items-center flex-shrink-0"
                style={{ padding: 4, gap: 4, width: 68, height: 44, background: "#F1F1F5", borderRadius: 95 }}
              >
                <button
                  onClick={() => setShowKanban(false)}
                  className="flex flex-row justify-center items-center flex-shrink-0"
                  style={{
                    padding: 5,
                    gap: 10,
                    width: 28,
                    height: 28,
                    background: !showKanban ? "#FFFFFF" : "transparent",
                    boxShadow: !showKanban ? "0px 0px 6px rgba(0, 0, 0, 0.1)" : "none",
                    borderRadius: 95,
                  }}
                >
                  <CustomListIcon style={{ color: !showKanban ? "#0085FF" : "#525252" }} />
                </button>
                <button
                  onClick={() => setShowKanban(true)}
                  className="flex flex-row justify-center items-center flex-shrink-0"
                  style={{
                    padding: 5,
                    gap: 10,
                    width: 28,
                    height: 28,
                    background: showKanban ? "#FFFFFF" : "transparent",
                    boxShadow: showKanban ? "0px 0px 6px rgba(0, 0, 0, 0.1)" : "none",
                    borderRadius: 96,
                  }}
                >
                  <CustomKanbanIcon style={{ color: showKanban ? "#0085FF" : "#525252" }} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ======================= SUB-HEADER (New Task/Meeting, Export) ======================= */}
        <div
          className="border-b border-[#E1E4EA] flex items-center justify-end px-6"
          style={{ height: 64, minHeight: 64, maxHeight: 64, boxSizing: "border-box" }}
        >
          <div className="flex flex-row items-center gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Export
              </button>

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
