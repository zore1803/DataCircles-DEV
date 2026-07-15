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
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by tasks by name, team, or deal..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-blue-300"
          />
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50">
          <Filter size={14} />
          Filter
        </button>
        <button
          onClick={() => setShowTaskForm(true)}
          className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
          title="Add Task"
        >
          <Plus size={16} />
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
