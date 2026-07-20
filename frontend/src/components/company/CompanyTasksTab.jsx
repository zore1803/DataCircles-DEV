import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Filter,
  Plus,
  ListChecks,
  CirclePlus,
  Hourglass,
  CheckCircle2,
  ArrowUp,
  AlertCircle,
  CheckSquare,
} from "lucide-react";
import toast from "react-hot-toast";
import API from "../../services/api";
import CompanyTaskForm from "./CompanyTaskForm";
import TaskDetailsModal from "../Task/TaskDetailsModal";

const SlidersIcon = ({ size = 14, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M1.66667 2.91667C1.66667 2.22631 2.22631 1.66667 2.91667 1.66667C3.60702 1.66667 4.16667 2.22631 4.16667 2.91667C4.16667 3.60703 3.60702 4.16667 2.91667 4.16667C2.22631 4.16667 1.66667 3.60703 1.66667 2.91667ZM2.91667 0C1.30583 0 0 1.30583 0 2.91667C0 4.5275 1.30583 5.83333 2.91667 5.83333C4.5275 5.83333 5.83333 4.5275 5.83333 2.91667C5.83333 1.30583 4.5275 0 2.91667 0ZM7.5 3.75H14.1667V2.08333H7.5V3.75ZM10.8333 11.25C10.8333 10.5597 11.393 10 12.0833 10C12.7737 10 13.3333 10.5597 13.3333 11.25C13.3333 11.9403 12.7737 12.5 12.0833 12.5C11.393 12.5 10.8333 11.9403 10.8333 11.25ZM12.0833 8.33333C10.4725 8.33333 9.16667 9.63917 9.16667 11.25C9.16667 12.8608 10.4725 14.1667 12.0833 14.1667C13.6942 14.1667 15 12.8608 15 11.25C15 9.63917 13.6942 8.33333 12.0833 8.33333ZM0.833333 10.4167V12.0833H7.5V10.4167H0.833333Z" fill="#1F2937" />
  </svg>
);

export default function CompanyTasksTab({ companyId, tasks = [], setTasks }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await API.get("/auth/all-user");
        setUsers(res.data.allUsers || []);
      } catch (err) {
        console.error("Failed to load users:", err);
      }
    };
    fetchUsers();
  }, []);

  const refetchTasks = async () => {
    try {
      const res = await API.get(`/tasks/company/${companyId}`);
      setTasks(res.data || []);
    } catch (err) {
      console.error("Failed to refetch tasks:", err);
    }
  };

  const handleTaskSave = async (taskData) => {
    try {
      await API.post("/tasks", taskData);
      await refetchTasks();
      toast.success("Task created successfully!");
      setShowTaskForm(false);
    } catch (err) {
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
      toast.success("Task deleted successfully!");
      setIsDetailsOpen(false);
      setSelectedTask(null);
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to delete task.");
      }
      throw err;
    }
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setIsDetailsOpen(true);
  };

  const filteredTasks = useMemo(() => {
    if (!searchTerm.trim()) return tasks;
    const q = searchTerm.toLowerCase();
    return tasks.filter((t) => (t.title || "").toLowerCase().includes(q));
  }, [tasks, searchTerm]);

  const total = tasks.length;
  const pending = tasks.filter((t) => t.status !== "Completed").length;
  const overdue = tasks.filter(
    (t) =>
      t.status !== "Completed" && t.dueDate && new Date(t.dueDate) < new Date(),
  ).length;
  const completed = tasks.filter((t) => t.status === "Completed").length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const kpiTiles = [
    {
      label: "Total Tasks",
      value: total,
      icon: ListChecks,
    },
    {
      label: "Pending Tasks",
      value: pending,
      icon: CirclePlus,
      subtitle: "Awaiting action",
      subtitleClass: "text-amber-500",
      subtitleIcon: AlertCircle,
    },
    {
      label: "Overdue Tasks",
      value: overdue,
      icon: Hourglass,
      subtitle: "Action Required",
      subtitleClass: "text-red-500",
      subtitleIcon: AlertCircle,
    },
    {
      label: "Completed Tasks",
      value: completed,
      icon: CheckCircle2,
      subtitle: `${completionRate}% Completion Rate`,
      subtitleClass: "text-green-600",
      subtitleIcon: ArrowUp,
    },
  ];

  return (
    <div>
      {/* KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {kpiTiles.map((tile) => (
          <div
            key={tile.label}
            className="h-[72px] flex items-center gap-3 px-3 bg-white border border-gray-200 rounded-xl"
          >
            <div className="w-10 h-10 text-blue-600 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
              <tile.icon size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-500 truncate">{tile.label}</p>
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-base font-semibold text-gray-900">
                  {tile.value}
                </p>
                {tile.subtitle && (
                  <span
                    className={`text-[11px] flex items-center gap-0.5 ${tile.subtitleClass}`}
                  >
                    {tile.subtitleIcon && <tile.subtitleIcon size={10} />}
                    {tile.subtitle}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Controls */}
      <div className="flex items-center gap-4 mb-4" style={{ height: "44px" }}>
        <div className="relative flex-1 h-full">
          <Search size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-900 opacity-50" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by tasks by name, team, or deal..."
            className="w-full h-full pl-10 pr-3.5 border rounded-full text-sm focus:outline-none focus:border-blue-300"
            style={{ borderColor: "rgba(31, 41, 55, 0.1)" }}
          />
        </div>
        <button
          className="flex items-center justify-center gap-2 px-3 text-sm font-medium text-gray-800 bg-white border rounded-full hover:bg-gray-50 flex-shrink-0"
          style={{ height: "44px", borderColor: "#E1E4EA" }}
        >
          <SlidersIcon size={16} />
          Filter
        </button>
        <button
          onClick={() => setShowTaskForm(true)}
          className="flex items-center justify-center rounded-full border hover:bg-gray-50 flex-shrink-0"
          style={{ width: "44px", height: "44px", borderColor: "#E1E4EA" }}
          title="Add Task"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Task list or empty state */}
      {filteredTasks.length === 0 ? (
        <button
          onClick={() => setShowTaskForm(true)}
          className="flex flex-col items-center justify-center w-full min-h-[300px] bg-gray-50 border border-gray-200 rounded-xl text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-colors"
        >
          <CheckSquare size={28} className="mb-2" />
          <span className="text-sm font-medium">Add New Task</span>
        </button>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTasks.map((task) => (
            <button
              key={task._id}
              onClick={() => handleTaskClick(task)}
              className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:shadow-sm hover:border-blue-300 transition-all text-left"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-semibold text-blue-700 flex-shrink-0">
                <CheckSquare size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {task.title}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {task.status}
                  {task.dueDate &&
                    ` · Due ${new Date(task.dueDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "2-digit",
                    })}`}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <CompanyTaskForm
        open={showTaskForm}
        mode="create"
        taskData={null}
        companyId={companyId}
        users={users}
        onSave={handleTaskSave}
        onClose={() => setShowTaskForm(false)}
      />

      <TaskDetailsModal
        open={isDetailsOpen}
        taskData={selectedTask}
        users={users}
        onDelete={handleTaskDelete}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedTask(null);
        }}
      />
    </div>
  );
}
