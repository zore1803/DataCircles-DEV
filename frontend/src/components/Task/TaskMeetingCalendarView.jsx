import React, { useState, useRef, useLayoutEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Users,
  CheckSquare,
  X,
  Calendar,
  Loader2,
} from "lucide-react";
import SearchIcon from "../common/SearchIcon";
import HighlightText from "../common/HighlightText";

// Same visual language as CompanyProfilePage's Calendar tab (CompanyCalendar.jsx),
// but scoped to the whole org instead of one company, and driven by
// callback props into Tasks.jsx's own create/edit forms instead of owning them.
const CompactEventCard = ({ item, type, onClick, searchTerm }) => {
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
      <span className="truncate">
        <HighlightText text={item.title} query={searchTerm} />
      </span>
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
  const displayDate = date ? new Date(date + "T00:00:00") : null;

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-xs border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-semibold text-gray-900">Quick Add</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-600 mb-4">
          {displayDate
            ? displayDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
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
              <div className="text-xs text-gray-600">Schedule with contacts</div>
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
  onAddMeeting,
  onAddTask,
  onClose,
  searchTerm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-sm border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">
            {date?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto space-y-2">
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-gray-700">Meetings</h4>
              <button
                onClick={() => onAddMeeting(date)}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>
            {meetings.length === 0 ? (
              <p className="text-xs text-gray-500">No meetings scheduled.</p>
            ) : (
              meetings.map((meeting) => (
                <div
                  key={meeting._id}
                  className="flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 rounded-md cursor-pointer text-sm mb-1"
                  onClick={() => onMeetingClick(meeting)}
                >
                  <Users className="w-3 h-3 text-gray-600 flex-shrink-0" />
                  <span className="truncate">
                    <HighlightText text={meeting.title} query={searchTerm} />
                  </span>
                </div>
              ))
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-gray-700">Tasks</h4>
              <button
                onClick={() => onAddTask(date)}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>
            {tasks.length === 0 ? (
              <p className="text-xs text-gray-500">No tasks scheduled.</p>
            ) : (
              tasks.map((task) => (
                <div
                  key={task._id}
                  className="flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 rounded-md cursor-pointer text-sm mb-1"
                  onClick={() => onTaskClick(task)}
                >
                  <CheckSquare className="w-3 h-3 text-gray-600 flex-shrink-0" />
                  <span className="truncate">
                    <HighlightText text={task.title} query={searchTerm} />
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const formatDateToString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const TaskMeetingCalendarView = ({
  meetings = [],
  tasksList = [],
  isLoading = false,
  onMeetingClick,
  onTaskClick,
  onQuickAddMeeting,
  onQuickAddTask,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month");
  const viewRefs = useRef({});
  const [viewIndicator, setViewIndicator] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const el = viewRefs.current[viewMode];
    if (el) setViewIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [viewMode]);

  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = useRef(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddDate, setQuickAddDate] = useState(null);
  const [activityPopup, setActivityPopup] = useState({ isOpen: false, date: null, meetings: [], tasks: [] });

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const weekdays = ["M", "T", "W", "T", "F", "S", "S"];

  const meetingsByDate = {};
  meetings.forEach((meeting) => {
    if (!meeting.scheduledAt) return;
    const key = new Date(meeting.scheduledAt).toDateString();
    if (!meetingsByDate[key]) meetingsByDate[key] = [];
    meetingsByDate[key].push(meeting);
  });

  const tasksByDate = {};
  tasksList.forEach((task) => {
    if (!task.dueDate) return;
    const key = new Date(task.dueDate).toDateString();
    if (!tasksByDate[key]) tasksByDate[key] = [];
    tasksByDate[key].push(task);
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const calendarDays = [];
  for (let i = adjustedFirstDay - 1; i >= 0; i--) {
    calendarDays.push({ date: new Date(year, month, -i), isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }
  const extraDays = 35 - calendarDays.length;
  for (let d = 1; d <= extraDays; d++) {
    calendarDays.push({ date: new Date(year, month + 1, d), isCurrentMonth: false });
  }

  const goToMonth = (offset) => setCurrentDate(new Date(year, month + offset, 1));
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
    return currentDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  })();

  const handleDayClick = (date) => {
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    if (day >= today) {
      setQuickAddDate(formatDateToString(day));
      setQuickAddOpen(true);
    }
  };

  const handleQuickAddMeeting = () => {
    onQuickAddMeeting(quickAddDate);
    setQuickAddOpen(false);
  };

  const handleQuickAddTask = () => {
    onQuickAddTask(quickAddDate);
    setQuickAddOpen(false);
  };

  const handleAddMeetingForDate = (date) => {
    onQuickAddMeeting(formatDateToString(date));
    setActivityPopup({ isOpen: false, date: null, meetings: [], tasks: [] });
  };

  const handleAddTaskForDate = (date) => {
    onQuickAddTask(formatDateToString(date));
    setActivityPopup({ isOpen: false, date: null, meetings: [], tasks: [] });
  };

  const handleMeetingClick = (meeting) => {
    onMeetingClick(meeting);
    setActivityPopup({ isOpen: false, date: null, meetings: [], tasks: [] });
  };

  const handleTaskClick = (task) => {
    onTaskClick(task);
    setActivityPopup({ isOpen: false, date: null, meetings: [], tasks: [] });
  };

  const filteredEvents = (dayMeetings, dayTasks) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return { meetings: dayMeetings, tasks: dayTasks };
    const filteredMeetings = dayMeetings.filter((m) => (m.title || "").toLowerCase().includes(term));
    const filteredTasks = dayTasks.filter((t) => (t.title || "").toLowerCase().includes(term));
    return { meetings: filteredMeetings, tasks: filteredTasks };
  };

  return (
    <div className="min-h-[868px]">
      {/* Header */}
      <div className="relative flex items-center gap-1.5 lg:gap-3 mb-4">
        <div className="flex items-center gap-1 lg:gap-2 flex-shrink-0">
          <button
            onClick={() => goToPeriod(-1)}
            className="p-1 lg:p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-gray-600" />
          </button>
          <span className="text-xs lg:text-sm font-semibold text-gray-900 max-w-[76px] lg:max-w-none lg:min-w-[90px] text-center truncate lg:whitespace-nowrap">
            {periodLabel}
          </span>
          <button
            onClick={() => goToPeriod(1)}
            className="p-1 lg:p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-gray-600" />
          </button>
        </div>

        <div className="relative flex items-center bg-gray-100 rounded-full p-0.5 lg:p-1 flex-shrink-0 overflow-hidden">
          <span
            className="absolute top-0.5 lg:top-1 bottom-0.5 lg:bottom-1 rounded-full bg-white shadow-sm transition-all duration-300 ease-out pointer-events-none"
            style={{ left: viewIndicator.left, width: viewIndicator.width }}
          />
          {["month", "week", "day"].map((mode) => (
            <button
              key={mode}
              ref={(el) => (viewRefs.current[mode] = el)}
              onClick={() => setViewMode(mode)}
              className={`relative z-10 px-2 lg:px-3 py-1 lg:py-1.5 rounded-full text-[11px] lg:text-sm font-medium capitalize transition-colors ${viewMode === mode ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
                }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <button
          onClick={() => setCurrentDate(new Date())}
          className="px-2.5 lg:px-3 py-1 lg:py-1.5 border border-gray-200 rounded-full text-[11px] lg:text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
        >
          Today
        </button>

        <div className="relative flex items-center flex-1 min-w-0 rounded-full bg-white">
          <SearchIcon className="absolute left-2.5 lg:left-3 -translate-y-1/2 lg:top-1/2 w-4 h-4 text-[#525866]" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search Events"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-8 lg:h-9 pl-11 lg:pl-9 pr-8 border border-gray-200 rounded-full text-xs lg:text-sm focus:outline-none focus:border-[#0085FF]"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 lg:right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900 focus:outline-none"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button
          onClick={() => handleDayClick(today)}
          className="w-8 h-8 lg:w-9 lg:h-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 flex-shrink-0"
          title="Add Event"
        >
          <Plus className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
        </button>
      </div>

      {isLoading && (
        <div className="bg-white border border-gray-200 rounded-lg flex flex-col items-center justify-center gap-2 min-h-[740px] text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <p className="text-sm">Loading meetings and tasks…</p>
        </div>
      )}

      {/* Month View */}
      {!isLoading && viewMode === "month" && (
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
              const dayMeetings = meetingsByDate[key] || [];
              const dayTasks = tasksByDate[key] || [];
              const { meetings: filteredMeetings, tasks: filteredTasks } = filteredEvents(dayMeetings, dayTasks);

              const allDayItems = [
                ...filteredMeetings.map((m) => ({ item: m, type: "meeting" })),
                ...filteredTasks.map((t) => ({ item: t, type: "task" })),
              ];
              const totalItems = allDayItems.length;
              const maxDisplay = 4;
              const visibleItems = allDayItems.slice(0, maxDisplay);
              const hasMore = totalItems > maxDisplay;
              const hasHighPriority = filteredMeetings.some((m) => m.priority === "high");

              return (
                <div
                  key={key + idx}
                  className={`
                    min-h-[148px] p-1 border-b border-r border-gray-200 last:border-r-0 relative transition-all
                    ${!isCurrentMonth ? "bg-gray-50 text-gray-400" : "bg-white text-gray-900"}
                    ${isCurrentMonth && isFuture ? "hover:bg-gray-50 cursor-pointer" : ""}
                    ${isToday ? "bg-gray-100 border-gray-300" : ""}
                  `}
                  onClick={() => isCurrentMonth && isFuture && handleDayClick(date)}
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
                    {visibleItems.map(({ item, type }) => (
                      <CompactEventCard
                        key={item._id}
                        item={item}
                        type={type}
                        onClick={type === "meeting" ? handleMeetingClick : handleTaskClick}
                        searchTerm={searchTerm}
                      />
                    ))}
                    {hasMore && (
                      <div
                        className="text-[9px] text-gray-500 px-1 py-0.5 bg-gray-100 rounded cursor-pointer hover:bg-gray-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivityPopup({ isOpen: true, date, meetings: filteredMeetings, tasks: filteredTasks });
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
      {!isLoading && viewMode === "week" && (
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
          <div className="grid grid-cols-7 min-h-[740px]">
            {weekDays.map((date, idx) => {
              const key = date.toDateString();
              const isFuture = date >= today;
              const dayMeetings = meetingsByDate[key] || [];
              const dayTasks = tasksByDate[key] || [];
              const { meetings: filteredMeetings, tasks: filteredTasks } = filteredEvents(dayMeetings, dayTasks);

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
                      searchTerm={searchTerm}
                    />
                  ))}
                  {filteredTasks.map((task) => (
                    <CompactEventCard
                      key={task._id}
                      item={task}
                      type="task"
                      onClick={handleTaskClick}
                      searchTerm={searchTerm}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Day View */}
      {!isLoading && viewMode === "day" && (() => {
        const key = currentDate.toDateString();
        const isFuture = currentDate >= today;
        const dayMeetings = meetingsByDate[key] || [];
        const dayTasks = tasksByDate[key] || [];
        const { meetings: filteredMeetings, tasks: filteredTasks } = filteredEvents(dayMeetings, dayTasks);
        const hasEvents = filteredMeetings.length > 0 || filteredTasks.length > 0;

        return (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden min-h-[740px] p-4">
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
                      <span className="text-sm font-medium truncate">
                        <HighlightText text={meeting.title} query={searchTerm} />
                      </span>
                    </div>
                    {meeting.scheduledAt && (
                      <span className="text-xs flex-shrink-0">
                        {new Date(meeting.scheduledAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
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
                      <span className="text-sm font-medium truncate">
                        <HighlightText text={task.title} query={searchTerm} />
                      </span>
                    </div>
                    {task.dueDate && (
                      <span className="text-xs flex-shrink-0">
                        {new Date(task.dueDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
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
        onAddMeeting={handleAddMeetingForDate}
        onAddTask={handleAddTaskForDate}
        onClose={() => setActivityPopup({ isOpen: false, date: null, meetings: [], tasks: [] })}
        searchTerm={searchTerm}
      />
    </div>
  );
};

export default TaskMeetingCalendarView;
