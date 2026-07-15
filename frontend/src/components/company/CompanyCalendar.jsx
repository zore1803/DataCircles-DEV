import React, { useState, useEffect, useCallback } from "react";
import API from "../../services/api";
import CompanyMeetingForm from "./CompanyMeetingForm";
import CompanyTaskForm from "./CompanyTaskForm";
import toast from "react-hot-toast";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Users,
  CheckSquare,
  X,
  Calendar,
} from "lucide-react";
import AppToaster from "../AppToaster";

const CompactEventCard = ({ item, type, onClick }) => {
  const time = item.scheduledAt || item.dueDate;
  return (
    <div
      className={`
        flex items-center justify-between gap-1 text-[10px] px-1.5 py-0.5 rounded cursor-pointer mb-0.5 transition-all
        ${type === "meeting"
          ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }
      `}
      onClick={(e) => {
        e.stopPropagation();
        onClick(item);
      }}
      title={`${type}: ${item.title}`}
    >
      <span className="truncate">{item.title}</span>
      {time && (
        <span className="flex-shrink-0 opacity-70">
          {new Date(time).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      )}
    </div>
  );
};

const QuickAddModal = ({ isOpen, onClose, onAddMeeting, onAddTask, date }) => {
  if (!isOpen) return null;

  // Parse the string date for display
  const displayDate = date ? new Date(date + "T00:00:00") : null;

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-xs border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-semibold text-gray-900">Quick Add</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-600 mb-4">
          {displayDate
            ? displayDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
            : ""}
        </p>
        <div className="space-y-2">
          <button
            onClick={onAddMeeting}
            className="w-full flex items-center gap-2 p-2 text-left hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
          >
            <Users className="w-4 h-4 text-gray-600" />
            <div>
              <div className="text-sm font-medium text-gray-900">Meeting</div>
              <div className="text-xs text-gray-600">
                Schedule with contacts
              </div>
            </div>
          </button>
          <button
            onClick={onAddTask}
            className="w-full flex items-center gap-2 p-2 text-left hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
          >
            <CheckSquare className="w-4 h-4 text-gray-600" />
            <div>
              <div className="text-sm font-medium text-gray-900">Task</div>
              <div className="text-xs text-gray-600">Create action item</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

const ActivityListPopup = ({
  isOpen,
  date,
  meetings,
  tasks,
  onMeetingClick,
  onTaskClick,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-sm border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">
            {date?.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto space-y-2">
          {meetings.length === 0 && tasks.length === 0 ? (
            <p className="text-sm text-gray-600">No activities for this day.</p>
          ) : (
            <>
              {meetings.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-xs font-medium text-gray-700 mb-2">
                    Meetings
                  </h4>
                  {meetings.map((meeting) => (
                    <div
                      key={meeting._id}
                      className="flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 rounded-md cursor-pointer text-sm mb-1"
                      onClick={() => onMeetingClick(meeting)}
                    >
                      <Users className="w-3 h-3 text-gray-600 flex-shrink-0" />
                      <span className="truncate">{meeting.title}</span>
                    </div>
                  ))}
                </div>
              )}
              {tasks.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-700 mb-2">
                    Tasks
                  </h4>
                  {tasks.map((task) => (
                    <div
                      key={task._id}
                      className="flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 rounded-md cursor-pointer text-sm mb-1"
                      onClick={() => onTaskClick(task)}
                    >
                      <CheckSquare className="w-3 h-3 text-gray-600 flex-shrink-0" />
                      <span className="truncate">{task.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const CompanyCalendar = ({ companyId }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month");
  const [meetings, setMeetings] = useState({});
  const [tasks, setTasks] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [modalType, setModalType] = useState("meeting");
  const [calendarDate, setCalendarDate] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [users, setUsers] = useState([]);
  const [taskUsers, setTaskUsers] = useState([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddDate, setQuickAddDate] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activityPopup, setActivityPopup] = useState({
    isOpen: false,
    date: null,
    meetings: [],
    tasks: [],
  });

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const weekdays = ["M", "T", "W", "T", "F", "S", "S"];

  // ✅ Add helper function to convert Date to string
  const formatDateToString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const fetchData = useCallback(async () => {
    try {
      const meetingsRes = await API.get("/meetings", { params: { companyId } });
      const meetingsWithNames = await Promise.all(
        meetingsRes.data.meetings.map(async (meeting) => {
          if (meeting.assignedTo) {
            try {
              const contactRes = await API.get(
                `/contacts/${meeting.assignedTo}`
              );
              meeting.assignedToName = contactRes?.data?.name || "Unknown";
            } catch {
              meeting.assignedToName = "Unknown";
            }
          }
          return meeting;
        })
      );

      const meetingsByDate = {};
      meetingsWithNames.forEach((meeting) => {
        const key = new Date(meeting.scheduledAt).toDateString();
        if (!meetingsByDate[key]) meetingsByDate[key] = [];
        meetingsByDate[key].push(meeting);
      });
      setMeetings(meetingsByDate);

      const tasksRes = await API.get(`/tasks/company/${companyId}`);
      const tasksByDate = {};
      tasksRes.data.forEach((task) => {
        if (task.selectedDate) {
          const key = new Date(task.selectedDate).toDateString();
          if (!tasksByDate[key]) tasksByDate[key] = [];
          tasksByDate[key].push(task);
        }
      });
      setTasks(tasksByDate);
    } catch (error) {
      toast.error(err.response?.data?.error || "Failed to fetch calendar data");
    }
  }, [companyId]);

  const fetchUsers = useCallback(async () => {
    try {
      const [contactsRes, usersRes] = await Promise.all([
        API.get(`/contacts/company/${companyId}`),
        API.get(`/auth/all-user`),
      ]);
      setUsers(contactsRes.data);
      setTaskUsers(usersRes.data.allUsers);
    } catch (error) {
      toast.error("Failed to fetch users");
    }
  }, [companyId]);

  useEffect(() => {
    fetchData();
    fetchUsers();
  }, [fetchData, fetchUsers]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const calendarDays = [];
  for (let i = adjustedFirstDay - 1; i >= 0; i--) {
    calendarDays.push({
      date: new Date(year, month, -i),
      isCurrentMonth: false,
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }
  const extraDays = 35 - calendarDays.length;
  for (let d = 1; d <= extraDays; d++) {
    calendarDays.push({
      date: new Date(year, month + 1, d),
      isCurrentMonth: false,
    });
  }

  const goToMonth = (offset) =>
    setCurrentDate(new Date(year, month + offset, 1));
  const goToPeriod = (offset) => {
    if (viewMode === "month") {
      goToMonth(offset);
    } else if (viewMode === "week") {
      const next = new Date(currentDate);
      next.setDate(next.getDate() + offset * 7);
      setCurrentDate(next);
    } else {
      const next = new Date(currentDate);
      next.setDate(next.getDate() + offset);
      setCurrentDate(next);
    }
  };

  // Monday-start week containing currentDate
  const weekStart = (() => {
    const d = new Date(currentDate);
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
    d.setDate(d.getDate() - dow);
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const periodLabel = (() => {
    if (viewMode === "month") return `${months[month]} ${year}`;
    if (viewMode === "week") {
      const end = weekDays[6];
      const startLabel = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const endLabel = end.toLocaleDateString("en-US", {
        month: weekStart.getMonth() === end.getMonth() ? undefined : "short",
        day: "numeric",
        year: "numeric",
      });
      return `${startLabel} - ${endLabel}`;
    }
    return currentDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  })();

  // ✅ Updated to convert Date to string
  const handleDayClick = (date) => {
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    if (day >= today) {
      const dateString = formatDateToString(day); // ✅ Convert to "YYYY-MM-DD"
      setQuickAddDate(dateString);
      setQuickAddOpen(true);
    }
  };

  const handleQuickAddMeeting = () => {
    setModalType("meeting");
    setModalMode("create");
    setCalendarDate(quickAddDate); // ✅ Now a string like "2025-11-23"
    setSelectedMeeting(null);
    setModalOpen(true);
    setQuickAddOpen(false);
  };

  const handleQuickAddTask = () => {
    setModalType("task");
    setModalMode("create");
    setCalendarDate(quickAddDate); // ✅ Now a string like "2025-11-23"
    setSelectedTask(null);
    setModalOpen(true);
    setQuickAddOpen(false);
  };

  const handleMeetingClick = (meeting) => {
    setModalType("meeting");
    setModalMode("view");
    setSelectedMeeting(meeting);
    setModalOpen(true);
    setActivityPopup({ isOpen: false, date: null, meetings: [], tasks: [] });
  };

  const handleTaskClick = (task) => {
    setModalType("task");
    setModalMode("view");
    setSelectedTask(task);
    setModalOpen(true);
    setActivityPopup({ isOpen: false, date: null, meetings: [], tasks: [] });
  };

  const handleSave = async (form, type) => {
    const loadingToast = toast.loading(`Saving ${type}...`);
    try {
      if (type === "meeting") {
        await API.post("/meetings", {
          ...form,
          companyId,
          linkedTo: "company",
        });
      } else {
        await API.post("/tasks", { ...form, companyId });
      }
      toast.success(`${type} saved`, { id: loadingToast });
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(`Failed to save ${type}`, { id: loadingToast });
    }
  };

  const onUpdate = async () => {
    fetchData();
  };

  const handleDelete = async (id, type) => {
    const loadingToast = toast.loading(`Deleting ${type}...`);
    try {
      await API.delete(`/${type}s/${id}`);
      toast.success(`${type} deleted`, { id: loadingToast });
      setModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(`Failed to delete ${type}`, { id: loadingToast });
    }
  };

  const resetForm = () => {
    setCalendarDate(null);
    setSelectedMeeting(null);
    setSelectedTask(null);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const filteredEvents = (dayMeetings, dayTasks) => {
    if (!searchTerm) return { meetings: dayMeetings, tasks: dayTasks };

    const meetings = dayMeetings.filter((m) =>
      m.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const tasks = dayTasks.filter((t) =>
      t.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return { meetings, tasks };
  };

  return (
    <div className="min-h-[868px]">
      <AppToaster />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => goToPeriod(-1)}
            className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-sm font-semibold text-gray-900 min-w-[90px] text-center whitespace-nowrap">
            {periodLabel}
          </span>
          <button
            onClick={() => goToPeriod(1)}
            className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search Events"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-9 pl-9 pr-3 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-blue-300"
          />
        </div>

        <div className="flex items-center bg-gray-100 rounded-full p-1 flex-shrink-0">
          {["month", "week", "day"].map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${viewMode === mode
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
                }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <button
          onClick={() => handleDayClick(today)}
          className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 flex-shrink-0"
          title="Add Event"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Calendar Grid */}
      {viewMode === "month" && (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {weekdays.map((day, index) => (
            <div key={index} className="p-1 text-center">
              <span className="text-xs font-medium text-gray-600">{day}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarDays.map(({ date, isCurrentMonth }, idx) => {
            const key = date.toDateString();
            const isToday = date.toDateString() === today.toDateString();
            const isFuture = date >= today;
            const dayMeetings = meetings[key] || [];
            const dayTasks = tasks[key] || [];
            const { meetings: filteredMeetings, tasks: filteredTasks } =
              filteredEvents(dayMeetings, dayTasks);

            const totalItems = filteredMeetings.length + filteredTasks.length;
            const maxDisplay = 1;
            const hasMore = totalItems > maxDisplay;
            const hasHighPriority = filteredMeetings.some(
              (m) => m.priority === "high",
            );

            return (
              <div
                key={key + idx}
                className={`
                  min-h-[110px] p-1 border-b border-r border-gray-200 last:border-r-0 relative transition-all
                  ${!isCurrentMonth
                    ? "bg-gray-50 text-gray-400"
                    : "bg-white text-gray-900"
                  }
                  ${isCurrentMonth && isFuture
                    ? "hover:bg-gray-50 cursor-pointer"
                    : ""
                  }
                  ${isToday ? "bg-gray-100 border-gray-300" : ""}
                `}
                onClick={() =>
                  isCurrentMonth && isFuture && handleDayClick(date)
                }
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`
                      text-xs
                      ${isToday
                        ? "bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center"
                        : !isCurrentMonth
                          ? "text-gray-400"
                          : "text-gray-900"
                      }
                    `}
                  >
                    {date.getDate()}
                  </span>
                  {hasHighPriority && (
                    <span className="text-[9px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                      High
                    </span>
                  )}
                </div>

                <div className="space-y-0.5">
                  {filteredMeetings.slice(0, 1).map((meeting) => (
                    <CompactEventCard
                      key={meeting._id}
                      item={meeting}
                      type="meeting"
                      onClick={handleMeetingClick}
                    />
                  ))}
                  {filteredTasks
                    .slice(0, maxDisplay - filteredMeetings.slice(0, 1).length)
                    .map((task) => (
                      <CompactEventCard
                        key={task._id}
                        item={task}
                        type="task"
                        onClick={handleTaskClick}
                      />
                    ))}
                  {hasMore && (
                    <div
                      className="text-[9px] text-gray-500 px-1 py-0.5 bg-gray-100 rounded cursor-pointer hover:bg-gray-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivityPopup({
                          isOpen: true,
                          date,
                          meetings: filteredMeetings,
                          tasks: filteredTasks,
                        });
                      }}
                    >
                      +{totalItems - maxDisplay}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Week View */}
      {viewMode === "week" && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {weekDays.map((date, idx) => {
              const isToday = date.toDateString() === today.toDateString();
              return (
                <div key={idx} className="p-2 text-center border-r border-gray-200 last:border-r-0">
                  <div className="text-xs font-medium text-gray-500">{weekdays[idx]}</div>
                  <div
                    className={`text-sm mt-0.5 ${isToday
                      ? "inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white"
                      : "text-gray-900"
                      }`}
                  >
                    {date.getDate()}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-7 min-h-[600px]">
            {weekDays.map((date, idx) => {
              const key = date.toDateString();
              const isFuture = date >= today;
              const dayMeetings = meetings[key] || [];
              const dayTasks = tasks[key] || [];
              const { meetings: filteredMeetings, tasks: filteredTasks } =
                filteredEvents(dayMeetings, dayTasks);

              return (
                <div
                  key={idx}
                  className={`p-1.5 border-r border-gray-200 last:border-r-0 space-y-1 ${isFuture ? "hover:bg-gray-50 cursor-pointer" : "bg-gray-50/50"
                    }`}
                  onClick={() => isFuture && handleDayClick(date)}
                >
                  {filteredMeetings.map((meeting) => (
                    <CompactEventCard
                      key={meeting._id}
                      item={meeting}
                      type="meeting"
                      onClick={handleMeetingClick}
                    />
                  ))}
                  {filteredTasks.map((task) => (
                    <CompactEventCard
                      key={task._id}
                      item={task}
                      type="task"
                      onClick={handleTaskClick}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Day View */}
      {viewMode === "day" && (() => {
        const key = currentDate.toDateString();
        const isFuture = currentDate >= today;
        const dayMeetings = meetings[key] || [];
        const dayTasks = tasks[key] || [];
        const { meetings: filteredMeetings, tasks: filteredTasks } =
          filteredEvents(dayMeetings, dayTasks);
        const hasEvents = filteredMeetings.length > 0 || filteredTasks.length > 0;

        return (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden min-h-[600px] p-4">
            {!hasEvents ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-gray-400">
                <Calendar className="w-8 h-8 mb-2" />
                <p className="text-sm">No events on this day</p>
                {isFuture && (
                  <button
                    onClick={() => handleDayClick(currentDate)}
                    className="mt-3 text-sm text-blue-600 hover:underline"
                  >
                    + Add event
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMeetings.map((meeting) => (
                  <div
                    key={meeting._id}
                    onClick={() => handleMeetingClick(meeting)}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Users className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm font-medium truncate">{meeting.title}</span>
                    </div>
                    {meeting.scheduledAt && (
                      <span className="text-xs flex-shrink-0">
                        {new Date(meeting.scheduledAt).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                ))}
                {filteredTasks.map((task) => (
                  <div
                    key={task._id}
                    onClick={() => handleTaskClick(task)}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckSquare className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm font-medium truncate">{task.title}</span>
                    </div>
                    {task.dueDate && (
                      <span className="text-xs flex-shrink-0">
                        {new Date(task.dueDate).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      <QuickAddModal
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onAddMeeting={handleQuickAddMeeting}
        onAddTask={handleQuickAddTask}
        date={quickAddDate}
      />

      <ActivityListPopup
        isOpen={activityPopup.isOpen}
        date={activityPopup.date}
        meetings={activityPopup.meetings}
        tasks={activityPopup.tasks}
        onMeetingClick={handleMeetingClick}
        onTaskClick={handleTaskClick}
        onClose={() =>
          setActivityPopup({
            isOpen: false,
            date: null,
            meetings: [],
            tasks: [],
          })
        }
      />

      {modalType === "meeting" && (
        <CompanyMeetingForm
          open={modalOpen}
          mode={modalMode}
          meetingData={modalMode === "view" ? selectedMeeting : undefined}
          calendarDate={calendarDate}
          companyId={companyId}
          users={users}
          onSave={(form) => handleSave(form, "meeting")}
          onDelete={
            modalMode === "view"
              ? (id) => handleDelete(id, "meeting")
              : undefined
          }
          onClose={closeModal}
        />
      )}

      {modalType === "task" && (
        <CompanyTaskForm
          open={modalOpen}
          mode={modalMode}
          taskData={modalMode === "view" ? selectedTask : undefined}
          companyId={companyId}
          calendarDate={calendarDate}
          users={taskUsers}
          onSave={(form) => handleSave(form, "task")}
          onDelete={
            modalMode === "view" ? (id) => handleDelete(id, "task") : undefined
          }
          onClose={closeModal}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
};

export default CompanyCalendar;
