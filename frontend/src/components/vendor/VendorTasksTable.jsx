import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Plus, Calendar, Search, Trash2, Eye } from "lucide-react";
import API from "../../services/api";
import VendorTaskForm from "./VendorTaskForm";
import TaskDetailsModal from "../Task/TaskDetailsModal";
import DataTable from "../common/DataTable";
import BulkActionBar from "../common/BulkActionBar";
import CompanyFilterPanel from "../company/CompanyFilterPanel";
import FilterIcon from "../common/FilterIcon";
import { useBulkSelection, useBulkStrip } from "../../hooks/useBulkSelection";
import toast from "react-hot-toast";

/* Columns offered in the filter panel. `options` seeds the dropdown with the
   schema's full enum so a value is still filterable when no row currently uses
   it (models/Task.js). */
const TASK_FILTER_COLUMNS = [
  { key: "status", label: "Status", options: ["Pending", "In Progress", "Completed"] },
  { key: "priority", label: "Priority", options: ["low", "medium", "high"] },
  { key: "assignedTo", label: "Assigned To" },
];

const getTaskFieldValue = (task, key) => {
  switch (key) {
    case "status":
      return task.status;
    case "priority":
      return task.priority;
    case "assignedTo":
      return task.users?.map((u) => u?.name).filter(Boolean).join(", ");
    default:
      return task[key];
  }
};

const STATUS_BADGE = {
  Pending: "bg-gray-100 text-gray-700",
  "In Progress": "bg-blue-50 text-blue-700",
  Completed: "bg-green-50 text-green-700",
  Cancelled: "bg-gray-200 text-gray-700",
};

const PRIORITY_BADGE = {
  high: "bg-red-50 text-red-600",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-gray-100 text-gray-600",
};

const stripHtml = (html) => String(html || "").replace(/<[^>]*>/g, "").trim();

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";

const VendorTasksTable = ({ vendorId }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [vendorName, setVendorName] = useState("");
  const [portalTarget, setPortalTarget] = useState(null);

  const [search, setSearch] = useState("");
  const [selectedFilters, setSelectedFilters] = useState({});
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [columnSizing, setColumnSizing] = useState({});
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setPortalTarget(document.getElementById("tab-actions-portal"));
  }, []);

  const refetchTasks = useCallback(async () => {
    const response = await API.get(`/tasks/vendor/${vendorId}`);
    setTasks(response.data || []);
  }, [vendorId]);

  useEffect(() => {
    const fetchData = async () => {
      if (!vendorId) {
        setError("Vendor ID is missing");
        setLoading(false);
        return;
      }
      if (!/^[0-9a-fA-F]{24}$/.test(vendorId)) {
        setError("Invalid Vendor ID format");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        await refetchTasks();
        setError(null);
      } catch (err) {
        setError("Failed to load tasks");
        console.error("Error fetching tasks:", err);
        toast.error("Failed to load tasks.");
        setLoading(false);
        return;
      }

      // Supporting data only — the task list already rendered above, so a
      // failure here (e.g. a 403 on the permission-gated user list) must not
      // blank out tasks that loaded fine.
      try {
        const usersResponse = await API.get("/auth/all-user");
        setUsers(usersResponse.data?.allUsers || []);
      } catch (err) {
        console.error("Error fetching users for task assignment:", err);
      }

      try {
        const vendorResponse = await API.get(`/vendors/${vendorId}`);
        setVendorName(vendorResponse.data?.name || "");
      } catch (err) {
        console.error("Error fetching vendor name:", err);
      }

      setLoading(false);
    };

    fetchData();
  }, [vendorId, refetchTasks]);

  /* ── Search + filter ── */
  const filteredTasks = useMemo(() => {
    let rows = tasks;

    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter((t) =>
        [t.title, stripHtml(t.description), t.status, t.priority, getTaskFieldValue(t, "assignedTo")]
          .some((v) => String(v || "").toLowerCase().includes(term)),
      );
    }

    Object.entries(selectedFilters).forEach(([key, values]) => {
      if (!values?.length) return;
      rows = rows.filter((t) => values.includes(String(getTaskFieldValue(t, key) ?? "")));
    });

    return rows;
  }, [tasks, search, selectedFilters]);

  const activeFilterCount = Object.values(selectedFilters).reduce(
    (n, arr) => n + (arr?.length || 0),
    0,
  );

  /* ── Bulk selection ── */
  const { selectedItems, toggleItem, clearSelection, selectAll } = useBulkSelection({
    items: filteredTasks,
  });
  const { visible: stripVisible, closing: stripClosing } = useBulkStrip(selectedItems.length);

  const handleBulkDelete = async () => {
    if (!selectedItems.length) return;
    if (!window.confirm(`Delete ${selectedItems.length} task(s)? This cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      await Promise.all(selectedItems.map((id) => API.delete(`/tasks/${id}`)));
      await refetchTasks();
      clearSelection();
      toast.success("Tasks deleted!");
    } catch (err) {
      console.error("Bulk delete failed:", err);
      toast.error(err.response?.data?.error || "Failed to delete some tasks.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTaskSave = async (taskData) => {
    try {
      await API.post("/tasks", taskData);
      await refetchTasks();
      toast.success("Task created!");
      setShowTaskForm(false);
    } catch (err) {
      console.error("Error saving task:", err);
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to create task.");
      }
      throw err;
    }
  };

  const handleTaskDelete = async (taskId) => {
    try {
      await API.delete(`/tasks/${taskId}`);
      await refetchTasks();
      toast.success("Task deleted!");
      handleCloseTaskModal();
    } catch (err) {
      console.error("Error deleting task:", err);
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to delete task.");
      }
      throw err;
    }
  };

  const handleCloseTaskModal = () => {
    setIsTaskModalOpen(false);
    setSelectedTask(null);
  };

  const getRelatedToName = () => vendorName || "N/A";

  /* ── Columns ── */
  const columns = useMemo(
    () => [
      {
        id: "selection",
        size: 44,
        enableResizing: false,
        header: () => (
          <div className="flex justify-center items-center w-full">
            <input
              type="checkbox"
              checked={filteredTasks.length > 0 && selectedItems.length === filteredTasks.length}
              onChange={(e) => (e.target.checked ? selectAll(filteredTasks) : clearSelection())}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex justify-center items-center w-full">
            <input
              type="checkbox"
              checked={selectedItems.includes(row.original._id)}
              onChange={() => toggleItem(row.original._id)}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        ),
      },
      {
        id: "title",
        accessorKey: "title",
        size: 240,
        header: "Task",
        cell: ({ row }) => (
          <span className="font-medium text-gray-900 truncate block" title={row.original.title}>
            {row.original.title}
          </span>
        ),
      },
      {
        id: "description",
        size: 260,
        header: "Description",
        cell: ({ row }) => {
          const text = stripHtml(row.original.description);
          return (
            <span className="text-gray-600 truncate block" title={text}>
              {text || "—"}
            </span>
          );
        },
      },
      {
        id: "status",
        size: 130,
        header: "Status",
        cell: ({ row }) => (
          <span
            className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
              STATUS_BADGE[row.original.status] || "bg-gray-100 text-gray-800"
            }`}
          >
            {row.original.status === "Pending" ? "To Do" : row.original.status}
          </span>
        ),
      },
      {
        id: "priority",
        size: 110,
        header: "Priority",
        cell: ({ row }) => (
          <span
            className={`inline-flex px-2 py-1 text-xs font-medium rounded capitalize ${
              PRIORITY_BADGE[row.original.priority] || "bg-gray-100 text-gray-600"
            }`}
          >
            {row.original.priority || "—"}
          </span>
        ),
      },
      {
        id: "dueDate",
        size: 140,
        header: "Due Date",
        cell: ({ row }) => <span className="text-gray-700">{formatDate(row.original.dueDate)}</span>,
      },
      {
        id: "assignedTo",
        size: 170,
        header: "Assigned To",
        cell: ({ row }) => {
          const names = getTaskFieldValue(row.original, "assignedTo");
          return (
            <span className="text-gray-700 truncate block" title={names}>
              {names || "Unassigned"}
            </span>
          );
        },
      },
      {
        id: "actions",
        size: 100,
        enableResizing: false,
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTask(row.original);
                setIsTaskModalOpen(true);
              }}
              className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
              title="View"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm("Delete this task?")) handleTaskDelete(row.original._id);
              }}
              className="p-1 text-gray-500 hover:text-red-600 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    [filteredTasks, selectedItems, selectAll, clearSelection, toggleItem],
  );

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-900 font-medium mb-2">Error Loading Tasks</div>
        <p className="text-gray-600 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="h-full mt-2">
      {/* Action buttons, portaled into the tab header */}
      {portalTarget &&
        createPortal(
          <>
            <div className="relative h-9">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="h-9 w-56 pl-9 pr-3 border border-gray-300 rounded-full text-sm focus:outline-none focus:border-blue-300"
              />
            </div>
            <button
              onClick={() => setShowFilterPanel(true)}
              className="relative flex items-center justify-center gap-2 h-9 px-3 text-sm font-medium text-gray-800 bg-white border border-gray-300 rounded-full hover:bg-gray-50 flex-shrink-0"
            >
              <FilterIcon className="w-4 h-4" />
              Filter
              {activeFilterCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full ring-2 ring-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowTaskForm(true)}
              className="flex items-center gap-1 h-9 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-800 text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Task</span>
            </button>
          </>,
          portalTarget,
        )}

      {stripVisible ? (
        <BulkActionBar
          selectedCount={selectedItems.length}
          entityName="task"
          isClosing={stripClosing}
          onSelectAll={() => selectAll(filteredTasks)}
          onDeselectAll={clearSelection}
          onDelete={handleBulkDelete}
          isDeleting={isDeleting}
        />
      ) : (
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
          <Calendar className="w-4 h-4" />
          <span>{filteredTasks.length} tasks</span>
        </div>
      )}

      <DataTable
        data={filteredTasks}
        columns={columns}
        columnSizing={columnSizing}
        onColumnSizingChange={setColumnSizing}
        variant="card"
        maxHeight={560}
        loading={loading}
        rowClassName={(t) => (selectedItems.includes(t._id) ? "!bg-blue-50" : "")}
        emptyContent={
          <div className="flex flex-col items-center gap-2">
            <Calendar className="w-10 h-10 text-gray-400" />
            <p className="text-sm text-gray-600">
              {search || activeFilterCount ? "No tasks match your filters" : "No tasks yet"}
            </p>
            <p className="text-xs text-gray-500">
              {search || activeFilterCount
                ? "Try clearing the search or filters"
                : "Tasks will appear here once created"}
            </p>
          </div>
        }
      />

      <CompanyFilterPanel
        isOpen={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        columns={TASK_FILTER_COLUMNS}
        data={tasks}
        getFieldValue={getTaskFieldValue}
        selected={selectedFilters}
        onApply={setSelectedFilters}
      />

      {showTaskForm && (
        <VendorTaskForm
          open={showTaskForm}
          mode="create"
          vendorId={vendorId}
          users={users}
          onSave={handleTaskSave}
          onDelete={handleTaskDelete}
          onClose={() => setShowTaskForm(false)}
        />
      )}

      {selectedTask && (
        <TaskDetailsModal
          open={isTaskModalOpen}
          taskData={selectedTask}
          users={users}
          onDelete={handleTaskDelete}
          onClose={handleCloseTaskModal}
          getRelatedToName={getRelatedToName}
        />
      )}
    </div>
  );
};

export default VendorTasksTable;
