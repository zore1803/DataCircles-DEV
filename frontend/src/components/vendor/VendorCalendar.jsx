import React, { useState, useEffect, useCallback } from "react";
import API from "../../services/api";
import VendorMeetingForm from "./VendorMeetingForm";
import VendorTaskForm from "./VendorTaskForm";
import toast, { Toaster } from "react-hot-toast";
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

const CompactEventCard = ({ item, type, onClick }) => (
  <div
    className={`
      text-[10px] px-1 py-0.5 rounded cursor-pointer truncate mb-0.5 transition-all
      ${
        type === "meeting"
          ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
          : "bg-gray-200 text-gray-800 hover:bg-gray-300"
      }
    `}
    onClick={(e) => {
      e.stopPropagation();
      onClick(item);
    }}
    title={`${type}: ${item.title}`}
  >
    <div className="flex items-center gap-0.5">
      {type === "meeting" ? (
        <Users className="w-2 h-2 flex-shrink-0" />
      ) : (
        <CheckSquare className="w-2 h-2 flex-shrink-0" />
      )}
      <span className="truncate">{item.title}</span>
    </div>
  </div>
);

const QuickAddModal = ({ isOpen, onClose, onAddMeeting, onAddTask, date }) => {
  if (!isOpen) return null;

  // Parse the string date for display
  const displayDate = date ? new Date(date + "T00:00:00") : null;

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-xs border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">Quick Add</h3>
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
              <div className="text-xs text-gray-600">Schedule with vendor</div>
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

const VendorCalendar = ({ vendorId }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [meetings, setMeetings] = useState({});
  const [tasks, setTasks] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [modalType, setModalType] = useState("meeting");
  const [calendarDate, setCalendarDate] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [users, setUsers] = useState([]);
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
      const meetingsRes = await API.get("/meetings", { params: { vendorId } });
      const meetingsByDate = {};
      meetingsRes.data.meetings.forEach((meeting) => {
        const key = new Date(meeting.scheduledAt).toDateString();
        if (!meetingsByDate[key]) meetingsByDate[key] = [];
        meetingsByDate[key].push(meeting);
      });
      setMeetings(meetingsByDate);

      const tasksRes = await API.get(`/tasks/vendor/${vendorId}`);
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
  }, [vendorId]);

  const fetchUsers = useCallback(async () => {
    try {
      const usersRes = await API.get(`/auth/all-user`);
      setUsers(usersRes.data.allUsers);
    } catch (error) {
      toast.error("Failed to fetch users");
    }
  }, []);

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
  const goToToday = () => setCurrentDate(new Date());

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
        await API.post("/meetings", { ...form, vendorId, linkedTo: "vendor" });
      } else {
        await API.post("/tasks", { ...form, vendorId });
      }
      toast.success(`${type} saved`, { id: loadingToast });
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(`Failed to save ${type}`, { id: loadingToast });
    }
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
    <div className="h-full">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {months[month]} {year}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => goToMonth(-1)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={goToToday}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <Calendar className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={() => goToMonth(1)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-7 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-gray-400"
        />
      </div>

      {/* Calendar Grid */}
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

            return (
              <div
                key={key + idx}
                className={`
                  min-h-[60px] p-1 border-b border-r border-gray-200 last:border-r-0 relative transition-all
                  ${
                    !isCurrentMonth
                      ? "bg-gray-50 text-gray-400"
                      : "bg-white text-gray-900"
                  }
                  ${
                    isCurrentMonth && isFuture
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
                      ${
                        isToday
                          ? "bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center"
                          : !isCurrentMonth
                          ? "text-gray-400"
                          : "text-gray-900"
                      }
                    `}
                  >
                    {date.getDate()}
                  </span>
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

      {/* Stats */}
      <div className="flex items-center justify-center gap-4 py-3 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
          <span>{Object.values(meetings).flat().length} meetings</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
          <span>{Object.values(tasks).flat().length} tasks</span>
        </div>
      </div>

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
        <VendorMeetingForm
          open={modalOpen}
          mode={modalMode}
          meetingData={modalMode === "view" ? selectedMeeting : undefined}
          calendarDate={calendarDate}
          vendorId={vendorId}
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
        <VendorTaskForm
          open={modalOpen}
          mode={modalMode}
          taskData={modalMode === "view" ? selectedTask : undefined}
          vendorId={vendorId}
          calendarDate={calendarDate}
          users={users}
          onSave={(form) => handleSave(form, "task")}
          onDelete={
            modalMode === "view" ? (id) => handleDelete(id, "task") : undefined
          }
          onClose={closeModal}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
};

export default VendorCalendar;
