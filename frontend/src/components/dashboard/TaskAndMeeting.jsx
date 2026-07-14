import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";
import TaskDetailsModal from "../Task/TaskDetailsModal";
import MeetingDetailsModal from "../company/MeetingDetailsModal";
import { Calendar, Clock, Users, FileText, ChevronDown, ArrowUpRight, MoreHorizontal, Layout } from "lucide-react";

// NEW: Exported TasksCard to be used in Dashboard side-by-side
export const TasksCard = ({ tasks, totalTasks }) => {
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const total = totalTasks || tasks.length || 0;

    // Calculate counts
    const scheduledCount = tasks.filter(t => t.status === "Pending" || t.status === "In Progress" || t.status === "To Do").length;
    const completedCount = tasks.filter(t => t.status === "Completed").length;
    const pendingCount = tasks.filter(t => t.status === "Pending").length; // strictly pending for the third bar? Or "Overdue"? 
    // Let's map to the UI labels: Scheduled, Completed, Pending
    // Based on previous code:
    // Scheduled: "Pending" || "In Progress"
    // Completed: "Completed"
    // Pending (3rd bar): "To Do"? Or maybe "High Priority"? 
    // Re-reading original code: 
    // scheduled = Pending || In Progress
    // completed = Completed
    // pending = To Do (fallback 0)

    // New logic for better real data representation:
    // 1. Scheduled: In Progress + To Do (Open tasks)
    // 2. Completed: Completed
    // 3. Pending: Let's treat this as "Overdue" or high priority pending? 
    // Or stick to:
    // Scheduled = In Progress
    // Completed = Completed
    // Pending = To Do / Open / Created

    const scheduled = tasks.filter(t => t.status === "In Progress").length;
    const completed = tasks.filter(t => t.status === "Completed").length;
    const pending = tasks.filter(t => t.status === "Pending" || t.status === "To Do").length;

    const calcPercent = (val) => total > 0 ? Math.round((val / total) * 100) : 0;

    return {
      scheduled: { count: scheduled, percent: calcPercent(scheduled) },
      completed: { count: completed, percent: calcPercent(completed) },
      pending: { count: pending, percent: calcPercent(pending) }
    };
  }, [tasks, totalTasks]);

  return (
    <div className="bg-white rounded-[20px] border border-[#F2F2F7] p-6 shadow-sm h-full relative font-inter">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-50 rounded-[10px] flex items-center justify-center border border-[#F2F2F7]">
            <Layout className="w-5 h-5 text-[#111216]" />
          </div>
          <h2 className="text-[18px] font-bold text-[#111216]">Tasks</h2>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[#F2F2F7] rounded-xl text-[12px] font-bold text-[#111216] hover:bg-gray-50 transition-colors shadow-sm">
            Monthly <ChevronDown className="w-3 h-3" />
          </button>
          <button className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
            <ArrowUpRight className="w-4 h-4 text-gray-500" />
          </button>
          <button className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
            <MoreHorizontal className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      <p className="text-[14px] text-gray-400 font-medium mb-8">Track your tasks!</p>

      <div className="space-y-8">
        {/* Scheduled Tasks */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-[14px] font-bold text-[#111216]">Scheduled Tasks</h4>
            <span className="text-[12px] font-medium text-gray-400">
              <span className="text-[#111216]">{stats.scheduled.percent}%</span> • {stats.scheduled.count}
            </span>
          </div>
          <div className="w-full h-2.5 bg-[#F2F2F7] rounded-full overflow-hidden bg-hatched">
            <div
              className="h-full bg-[#3863ff] rounded-full transition-all duration-500"
              style={{ width: `${stats.scheduled.percent}%` }}
            />
          </div>
        </div>

        {/* Completed Tasks */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-[14px] font-bold text-[#111216]">Completed Tasks</h4>
            <span className="text-[12px] font-medium text-gray-400">
              <span className="text-[#111216]">{stats.completed.percent}%</span> • {stats.completed.count}
            </span>
          </div>
          <div className="w-full h-2.5 bg-[#F2F2F7] rounded-full overflow-hidden bg-hatched">
            <div
              className="h-full bg-[#10b981] rounded-full transition-all duration-500"
              style={{ width: `${stats.completed.percent}%` }}
            />
          </div>
        </div>

        {/* Pending Tasks */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-[14px] font-bold text-[#111216]">Pending Tasks</h4>
            <span className="text-[12px] font-medium text-gray-400">
              <span className="text-[#111216]">{stats.pending.percent}%</span> • {stats.pending.count}
            </span>
          </div>
          <div className="w-full h-2.5 bg-[#F2F2F7] rounded-full overflow-hidden bg-hatched">
            <div
              className="h-full bg-[#f59e0b] rounded-full transition-all duration-500"
              style={{ width: `${stats.pending.percent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const formatDate = (isoDate) => {
  return new Date(isoDate).toISOString().split("T")[0];
};

const formatDateTime = (isoDate) => {
  const date = new Date(isoDate);
  return (
    date.toLocaleDateString() +
    " " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
};

const TaskAndMeeting = ({
  tasks,
  meetings,
  TotalTask,
  TotalMeeting,
  allMeeting,
}) => {
  const [userMap, setUserMap] = useState({});
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        let [usersRes, companiesRes, contactsRes, dealsRes, vendorsRes] =
          await Promise.all([
            API.get("/auth/all-user"),
            API.get("/companies"),
            API.get("/contacts"),
            API.get("/deals"),
            API.get("/vendors"),
          ]);

        // Set userMap
        usersRes.data.allUsers = [
          ...usersRes.data.allUsers,
          ...contactsRes.data,
          ...vendorsRes.data,
        ];
        const userObj = {};
        usersRes.data.allUsers.forEach((u) => {
          userObj[u._id] = u;
        });
        setUserMap(userObj);

        // Set related data
        setCompanies(companiesRes.data);
        setContacts(contactsRes.data);
        setDeals(dealsRes.data);
        setVendors(vendorsRes.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  // const highPriorityMeetingsCount = useMemo(() => {
  //   return meetings.filter((m) => m.priority === "high").length;
  // }, [meetings]);
  const highPriorityMeetingsCount = useMemo(() => {
    const meetingsArray = Array.isArray(meetings) ? meetings : []; // SAFE
    return meetingsArray.filter((m) => m.priority === "high").length;
  }, [meetings]);

  // Updated function to handle relatedEntities array
  const getRelatedToDisplay = (task) => {
    // Handle new structure with relatedEntities array
    if (
      task.relatedEntities &&
      Array.isArray(task.relatedEntities) &&
      task.relatedEntities.length > 0
    ) {
      return task.relatedEntities.map((entity, index) => {
        const entityData = entity.entityId;
        let name = "N/A";

        // Get name from populated data or find in local state
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

        return {
          type: entity.entityModel,
          name: name,
        };
      });
    }

    // Fallback for old structure (single relatedTo)
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

      return [
        {
          type: task.relationModel,
          name: name,
        },
      ];
    }

    return [{ type: "N/A", name: "N/A" }];
  };

  const getTaskStatusBadge = (status) => {
    const statusClasses = {
      "To Do": "bg-yellow-100 text-yellow-700",
      Pending: "bg-yellow-100 text-yellow-700",
      "In Progress": "bg-blue-100 text-blue-700",
      Completed: "bg-green-100 text-green-700",
      Cancelled: "bg-red-100 text-red-700",
    };
    return statusClasses[status] || "bg-gray-100 text-gray-700";
  };

  const getMeetingStatusBadge = (status) => {
    const statusClasses = {
      scheduled: "bg-blue-100 text-blue-700",
      completed: "bg-green-100 text-green-700",
      cancelled: "bg-red-100 text-red-700",
      "no-show": "bg-orange-100 text-orange-700",
    };
    return statusClasses[status] || "bg-gray-100 text-gray-700";
  };

  const getPriorityBadge = (priority) => {
    const priorityClasses = {
      high: "bg-red-100 text-red-700",
      medium: "bg-yellow-100 text-yellow-700",
      low: "bg-green-100 text-green-700",
    };
    return priorityClasses[priority] || "bg-gray-100 text-gray-700";
  };

  const getAssignedUsers = (item, isMeeting = false) => {
    const users = isMeeting ? item.participants : item.users || [];
    if (users.length === 0) return "Self Assigned";

    const assignedUsers = users
      .map((u) => {
        const user = userMap[u._id || u];
        return user ? user.name || user.email : null;
      })
      .filter(Boolean);

    if (assignedUsers.length === 0) return "Self Assigned";
    if (assignedUsers.length === 1) return assignedUsers[0];
    if (assignedUsers.length <= 3) return assignedUsers.join(", ");
    return `${assignedUsers.slice(0, 2).join(", ")} +${assignedUsers.length - 2
      } more`;
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const handleMeetingClick = (meeting) => {
    setSelectedMeeting(meeting);
    setIsMeetingModalOpen(true);
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await API.delete(`/tasks/${taskId}`);
      // Optionally, update the tasks list by refetching or filtering out the deleted task
      // For simplicity, we'll rely on the parent component to handle state updates
    } catch (err) {
      console.error("Error deleting task:", err);
      throw err; // Let TaskDetailsModal handle the error and show toast
    }
  };

  const handleDeleteMeeting = async (meetingId) => {
    try {
      await API.delete(`/meetings/${meetingId}`);
      // Optionally, update the meetings list by refetching or filtering out the deleted meeting
      // For simplicity, we'll rely on the parent component to handle state updates
    } catch (err) {
      console.error("Error deleting meeting:", err);
      throw err; // Let MeetingDetailsModal handle the error and show toast
    }
  };

  const handleCloseTaskModal = () => {
    setIsTaskModalOpen(false);
    setSelectedTask(null);
  };

  const handleCloseMeetingModal = () => {
    setIsMeetingModalOpen(false);
    setSelectedMeeting(null);
  };

  // Helper for TasksCard calculation
  const taskStats = useMemo(() => {
    const total = TotalTask || tasks.length || 1; // Avoid div by zero
    const scheduled = tasks.filter(t => t.status === "Pending" || t.status === "In Progress").length;
    const completed = tasks.filter(t => t.status === "Completed").length;
    const pending = tasks.filter(t => t.status === "Cancelled" || t.status === "To Do").length;

    return {
      scheduled: { count: scheduled, percent: Math.round((scheduled / total) * 100) },
      completed: { count: completed, percent: Math.round((completed / total) * 100) },
      pending: { count: pending, percent: Math.round((pending / total) * 100) }
    };
  }, [tasks, TotalTask]);

  return (
    <div className="mt-6 flex flex-col gap-6">
      {/* Side-by-Side Summary Row (Optional: can be moved to Dashboard.jsx) */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Placeholder for ClientsAndDeals if needed, but we handle it in Dashboard.jsx */}
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 gap-6">
        {/* Tasks Section */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6 hover:shadow-md transition-shadow">
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-6 py-4 border-b border-gray-200/50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Tasks</h2>
              <div className="flex items-center space-x-3">
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                  {TotalTask} {TotalTask === 1 ? "Task" : "Tasks"}
                </span>
                {TotalTask > 0 && (
                  <button
                    onClick={() => navigate("/tasks")}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-full text-sm font-medium transition-colors duration-200"
                  >
                    View All
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Task Title</th>
                  <th className="px-6 py-4">Due Date</th>
                  <th className="px-6 py-4">Related To</th>
                  <th className="px-6 py-4">Assigned To</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm text-slate-700">
                {tasks.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-8 text-center text-slate-500"
                    >
                      No tasks found
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => {
                    const relatedEntities = getRelatedToDisplay(task);
                    return (
                      <tr
                        key={task._id}
                        className="hover:bg-slate-50/50 transition-colors duration-200 cursor-pointer"
                        onClick={() => handleTaskClick(task)}
                      >
                        <td className="px-6 py-4 font-medium text-slate-900">
                          {task.title}
                        </td>
                        <td className="px-6 py-4 text-blue-600 font-medium">
                          {formatDate(task.dueDate)}
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          <div className="flex flex-wrap items-center gap-1">
                            {relatedEntities.map((entity, idx) => (
                              <React.Fragment key={idx}>
                                <div className="inline-flex flex-col">
                                  <span className="font-semibold text-slate-900">
                                    {entity.name}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {entity.type}
                                  </span>
                                </div>
                                {idx < relatedEntities.length - 1 && (
                                  <span className="text-gray-400">,</span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-slate-600">
                          {getAssignedUsers(task)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${getTaskStatusBadge(
                              task.status
                            )}`}
                          >
                            {task.status === "Pending" ? "To Do" : task.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Meetings Section */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow mb-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200/50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Meetings</h2>
              <div className="flex items-center space-x-3">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  {TotalMeeting} {TotalMeeting === 1 ? "Meeting" : "Meetings"}
                </span>
                {TotalMeeting > 0 && (
                  <button
                    onClick={() =>
                      navigate("/tasks", { state: { tab: "meetings" } })
                    }
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-medium transition-colors duration-200"
                  >
                    View All
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Meeting Title</th>
                  <th className="px-6 py-4">Scheduled At</th>
                  <th className="px-6 py-4">Duration</th>
                  <th className="px-6 py-4">Assigned To</th>
                  <th className="px-6 py-4">Priority</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm text-slate-700">
                {meetings.length === 0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="px-6 py-8 text-center text-slate-500"
                    >
                      No meetings found
                    </td>
                  </tr>
                ) : (
                  meetings.map((meeting) => (
                    <tr
                      key={meeting._id}
                      className="hover:bg-slate-50/50 transition-colors duration-200 cursor-pointer"
                      onClick={() => handleMeetingClick(meeting)}
                    >
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {meeting.title}
                      </td>
                      <td className="px-6 py-4 text-blue-600 font-medium">
                        {formatDateTime(meeting.scheduledAt)}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {meeting.duration} min
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {meeting.contact || meeting.vendor || meeting.company
                          ? meeting.contact?.name ||
                          meeting.vendor?.name ||
                          meeting.participants[0].name ||
                          "Unknown"
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${getPriorityBadge(
                            meeting.priority
                          )}`}
                        >
                          {meeting.priority || "medium"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${getMeetingStatusBadge(
                            meeting.status
                          )}`}
                        >
                          {meeting.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium capitalize">
                          {meeting.meetingType?.replace("-", " ") || "in-person"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
            <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">
              Pending Tasks
            </div>
            <div className="text-2xl font-bold text-yellow-600">
              {
                tasks.filter(
                  (t) => t.status === "Pending" || t.status === "In Progress"
                ).length
              }
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
            <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">
              Completed Tasks
            </div>
            <div className="text-2xl font-bold text-green-600">
              {tasks.filter((t) => t.status === "Completed").length}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
            <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">
              Scheduled Meetings
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {meetings.filter((m) => m.status === "scheduled").length}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
            <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">
              High Priority Meetings
            </div>
            <div className="text-2xl font-bold text-red-600">
              {meetings.filter((m) => m.priority === "high").length}
            </div>
          </div>
        </div>

        {/* Task Details Modal */}
        {selectedTask && (
          <TaskDetailsModal
            open={isTaskModalOpen}
            taskData={selectedTask}
            users={Object.values(userMap)}
            onDelete={handleDeleteTask}
            onClose={handleCloseTaskModal}
            getRelatedToName={getRelatedToDisplay}
          />
        )}

        {/* Meeting Details Modal */}
        {selectedMeeting && (
          <MeetingDetailsModal
            open={isMeetingModalOpen}
            meetingData={selectedMeeting}
            users={Object.values(userMap)}
            onDelete={handleDeleteMeeting}
            onClose={handleCloseMeetingModal}
          />
        )}
      </div>
    </div>
  );
};

export default TaskAndMeeting;
