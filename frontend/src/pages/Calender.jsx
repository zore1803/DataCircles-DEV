import React, { useState, useEffect, useCallback } from "react";
import API from "../services/api";
import AdminMeetingForm from "../components/admin/AdminMeetingForm";
import AdminTaskForm from "../components/admin/AdminTaskForm";
import toast from "react-hot-toast";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  MoreVertical,
  X,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  AlignLeft,
  CheckCircle2,
  Users,
  Building2,
  Truck,
  User,
} from "lucide-react";
import logo from "/DataCircles.png";
import AppToaster from "../components/AppToaster";

// --- Components ---

const EntityIcon = ({ type, className = "w-3 h-3" }) => {
  switch (type) {
    case "Contact": return <User className={className} />;
    case "Company": return <Building2 className={className} />;
    case "Vendor": return <Truck className={className} />;
    default: return <User className={className} />;
  }
};

const ViewSwitcher = ({ view, setView }) => {
  return (
    <div className="flex bg-gray-100 p-1 rounded-lg">
      {["Month", "Week", "Day"].map((v) => (
        <button
          key={v}
          onClick={() => setView(v.toLowerCase())}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${view === v.toLowerCase()
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
            }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
};

const EventCard = ({ item, type, onClick }) => {
  const isMeeting = type === "meeting";

  // Helper to resolve entity info safely
  const getEntityDetails = () => {
    let name = "Unknown";
    let entityType = "Contact";

    if (isMeeting) {
      if (item.contact) { name = item.contact.name; entityType = "Contact"; }
      else if (item.company) { name = item.company.name; entityType = "Company"; }
      else if (item.vendor) { name = item.vendor.name; entityType = "Vendor"; }
    } else {
      // Task logic
      if (item.relatedEntities?.[0]) {
        name = item.relatedEntities[0].entityId?.name || item.relatedEntities[0].entityModel;
        entityType = item.relatedEntities[0].entityModel;
      } else if (item.contactId) { name = item.contactId.name; entityType = "Contact"; }
      else if (item.companyId) { name = item.companyId.name; entityType = "Company"; }
      else if (item.vendorId) { name = item.vendorId.name; entityType = "Vendor"; }
    }
    return { name, entityType };
  };

  const { name, entityType } = getEntityDetails();

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(item); }}
      className={`
        group relative px-2 py-1.5 rounded-md border-l-[3px] shadow-sm cursor-pointer transition-all hover:shadow-md mb-1.5
        ${isMeeting
          ? "bg-blue-50 border-blue-500 hover:bg-blue-100"
          : "bg-emerald-50 border-emerald-500 hover:bg-emerald-100"}
      `}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold truncate ${isMeeting ? "text-blue-900" : "text-emerald-900"}`}>
          {item.title}
        </span>
        {item.priority === 'High' && (
          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
        )}
      </div>

      <div className="flex items-center gap-1 mt-1 opacity-75">
        <EntityIcon type={entityType} className={`w-3 h-3 ${isMeeting ? "text-blue-700" : "text-emerald-700"}`} />
        <span className={`text-[10px] truncate ${isMeeting ? "text-blue-800" : "text-emerald-800"}`}>
          {name}
        </span>
      </div>
    </div>
  );
};

const QuickAddMenu = ({ isOpen, onClose, position, onAddType }) => {
  if (!isOpen) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose}></div>
      <div
        className="absolute z-50 bg-white rounded-lg shadow-xl border border-gray-100 p-2 w-48 animate-in fade-in zoom-in-95 duration-100"
        style={{ top: position.y, left: position.x }}
      >
        <div className="text-xs font-semibold text-gray-500 px-2 py-1.5 uppercase tracking-wider">Create New</div>
        <button
          onClick={() => onAddType("meeting")}
          className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-blue-600" />
          </div>
          Meeting
        </button>
        <button
          onClick={() => onAddType("task")}
          className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-md transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          Task
        </button>
      </div>
    </>
  );
};

const WeekView = ({ currentDate, meetings, tasks, onEventClick }) => {
  // 1. Get Start/End of Week (Assuming Mon start)
  const getWeekDays = () => {
    const curr = new Date(currentDate);
    const day = curr.getDay();
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const startOfWeek = new Date(curr.setDate(diff));

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const weekDays = getWeekDays();
  const hours = Array.from({ length: 13 }, (_, i) => i + 7); // 7 AM to 7 PM

  return (
    <div className="flex-1 overflow-auto bg-white relative h-full">
      {/* Sticky Header Row */}
      <div className="flex border-b border-gray-200 min-h-[50px] sticky top-0 z-30 bg-white w-max">
        {/* Top-Left Corner (Sticky Left + Top) */}
        <div className="w-[104px] border-r border-gray-100 flex-shrink-0 sticky left-0 z-40 bg-white border-b border-gray-200"></div>

        {/* Date Headers */}
        {weekDays.map((day, i) => (
          <div key={i} className="flex-none w-[230px] border-r border-gray-100 flex flex-col items-center justify-center py-2 bg-white">
            <span className="text-lg font-bold text-gray-900">{day.getDate()}</span>
            <span className="text-xs text-gray-500 uppercase">{day.toLocaleString('default', { weekday: 'long' })}</span>
          </div>
        ))}
      </div>

      {/* Time Grid (Rows) */}
      <div className="w-max">
        {hours.map((hour) => (
          <div key={hour} className="flex h-[153px] border-b border-gray-100 relative group">
            {/* Sticky Time Label */}
            <div className="w-[104px] border-r border-gray-100 flex-shrink-0 flex justify-center pt-2 bg-gray-50 text-xs text-gray-500 font-medium sticky left-0 z-20">
              {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
            </div>

            {/* Day Columns */}
            {weekDays.map((day, dayIdx) => {
              const dateKey = day.toDateString();
              const dayEvents = [
                ...(meetings[dateKey] || []).map(m => ({ ...m, type: 'meeting' })),
                ...(tasks[dateKey] || []).map(t => ({ ...t, type: 'task' }))
              ];

              // Filter events for this hour block
              const hourEvents = dayEvents.filter(ev => {
                const d = new Date(ev.scheduledAt || ev.dueDate);
                return d.getHours() === hour;
              });

              return (
                <div key={dayIdx} className="flex-none w-[230px] border-r border-gray-100 relative p-1 transition-colors hover:bg-gray-50/30">
                  {hourEvents.map((ev, evIdx) => (
                    <div
                      key={ev._id || evIdx}
                      onClick={() => onEventClick(ev, ev.type)}
                      className="bg-red-50 border-l-[3px] border-red-500 p-2 rounded-r-md cursor-pointer hover:shadow-md transition-shadow mb-1"
                    >
                      <h4 className="text-xs font-bold text-red-700 truncate">{ev.title}</h4>
                      {ev.description && <p className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">{ev.description}</p>}
                      <div className="mt-1.5 space-y-0.5">
                        <div className="flex items-center gap-1 text-[9px] text-gray-500">
                          <CalendarIcon className="w-2.5 h-2.5" />
                          {new Date(ev.scheduledAt || ev.dueDate).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1 text-[9px] text-gray-500">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(ev.scheduledAt || ev.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {ev.location && (
                          <div className="flex items-center gap-1 text-[9px] text-gray-500">
                            <MapPin className="w-2.5 h-2.5" />
                            {ev.location}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

const AdminCalendar = () => {
  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("month");
  const [meetings, setMeetings] = useState({});
  const [tasks, setTasks] = useState({});
  const [loading, setLoading] = useState(false);

  // Modals & Popups
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("meeting"); // meeting | task
  const [modalMode, setModalMode] = useState("create"); // create | view
  const [selectedItem, setSelectedItem] = useState(null);
  const [quickAddPos, setQuickAddPos] = useState(null);
  const [selectedDateForAdd, setSelectedDateForAdd] = useState(null);

  // Entities Data
  const [users, setUsers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [vendors, setVendors] = useState([]);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    meetings: true,
    tasks: true,
    highPriority: false
  });

  // --- Fetch Data ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [meetingsRes, tasksRes] = await Promise.all([
        API.get("/meetings/all-meetings"),
        API.get("/tasks/admin"),
      ]);

      const meetingsByDate = {};
      meetingsRes.data.forEach((m) => {
        const key = new Date(m.scheduledAt).toDateString();
        if (!meetingsByDate[key]) meetingsByDate[key] = [];
        meetingsByDate[key].push(m);
      });

      const tasksByDate = {};
      tasksRes.data.forEach((t) => {
        if (t.selectedDate) {
          const key = new Date(t.selectedDate).toDateString();
          if (!tasksByDate[key]) tasksByDate[key] = [];
          tasksByDate[key].push(t);
        }
      });

      setMeetings(meetingsByDate);
      setTasks(tasksByDate);
    } catch (error) {
      toast.error("Failed to load calendar data");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEntities = useCallback(async () => {
    try {
      const [u, c, comp, v] = await Promise.all([
        API.get("/auth/all-user"),
        API.get("/contacts"),
        API.get("/companies"),
        API.get("/vendors")
      ]);
      setUsers(u.data.allUsers || []);
      setContacts(c.data || []);
      setCompanies(comp.data || []);
      setVendors(v.data || []);
    } catch (e) {
      console.error("Error fetching entities", e);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchEntities();
  }, [fetchData, fetchEntities]);

  // --- Calendar Logic ---
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  const getCalendarDays = () => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun

    // Adjust for Monday start if needed. Let's stick to Sunday start for standard view or Monday?
    // Standard is often Sunday. Let's use Monday start as per many business apps.
    // Mon=0, Tue=1... Sun=6
    const startDay = firstDay === 0 ? 6 : firstDay - 1;

    const days = [];
    // Previous month filler
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month - 1, prevMonthDays - i), isCurrent: false });
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrent: true });
    }
    // Next month filler
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrent: false });
    }
    return days;
  };

  const calendarDays = getCalendarDays();
  const today = new Date();

  // --- Handlers ---
  const handleDayClick = (e, date) => {
    // Open quick add menu at click position
    if (!quickAddPos) {
      const rect = e.currentTarget.getBoundingClientRect();
      setQuickAddPos({ x: rect.left + window.scrollX + 20, y: rect.top + window.scrollY + 20 });
      setSelectedDateForAdd(date);
    } else {
      setQuickAddPos(null);
    }
  };

  const handleCreate = (type) => {
    setModalType(type);
    setModalMode("create");
    setSelectedItem(null);
    setModalOpen(true);
    setQuickAddPos(null);
  };

  const handleEventClick = (item, type) => {
    setModalType(type);
    setModalMode("view");
    setSelectedItem(item);
    setModalOpen(true);
  };

  const handleSave = async (form, type) => {
    const toastId = toast.loading("Saving...");
    try {
      const endpoint = type === "meeting" ? "/meetings" : "/tasks";
      await API.post(endpoint, form);
      toast.success("Saved successfully!", { id: toastId });
      setModalOpen(false);
      fetchData();
    } catch (error) {
      if (error.response?.status === 402) {
        toast.error(error.response?.data?.message || "An active subscription is required to make changes.", { id: toastId });
      } else {
        toast.error(error.response?.data?.error || "Failed to save", { id: toastId });
      }
    }
  };

  const handleDelete = async (id, type) => {
    const toastId = toast.loading("Deleting...");
    try {
      const endpoint = type === "meeting" ? "/meetings" : "/tasks";
      await API.delete(`${endpoint}s/${id}`); // Note: endpoint usually plural in REST
      toast.success("Deleted successfully!", { id: toastId });
      setModalOpen(false);
      fetchData();
    } catch (error) {
      if (error.response?.status === 402) {
        toast.error(error.response?.data?.message || "An active subscription is required to make changes.", { id: toastId });
      } else {
        toast.error(error.response?.data?.error || "Failed to delete", { id: toastId });
      }
    }
  };

  const formatDateForForm = (date) => {
    if (!date) return "";
    return date.toISOString().split('T')[0];
  };

  // --- Stats Calculation ---
  const totalMeetings = Object.values(meetings).flat().length;
  const totalTasks = Object.values(tasks).flat().length;
  const highPriorityMeetings = Object.values(meetings).flat().filter(m => m.priority === 'High').length;

  // --- Render ---
  return (
    <div className="flex flex-col h-full bg-gray-50/50 min-h-screen -mx-4 sm:-mx-6 lg:-mx-8">
      <AppToaster />

      <div
        className="flex flex-col flex-shrink-0 self-stretch"
        style={{
          width: "100%",
          background: "#FFFFFF",
          borderBottom: "1px solid #E1E4EA",
          borderRadius: 0,
        }}
      >
      <div
        className="box-border flex flex-row justify-between items-center flex-shrink-0 self-stretch"
        style={{
          padding: "0px 24px 12px",
          gap: 16,
          width: "100%",
        }}
      >
        <div
          className="flex flex-col items-start flex-shrink min-w-0"
          style={{ gap: 6, height: 39 }}
        >
          <span
            className="truncate w-full"
            style={{
              fontFamily: "Inter",
              fontWeight: 500,
              fontSize: 16,
              lineHeight: "120%",
              letterSpacing: "-0.5px",
              color: "#0E121B",
            }}
          >
            Calendar
          </span>
          <span
            className="truncate w-full"
            style={{
              fontFamily: "Inter",
              fontWeight: 400,
              fontSize: 12,
              lineHeight: "120%",
              color: "#525866",
            }}
          >
            View all meetings and tasks across contacts, companies and vendors
          </span>
        </div>

        <div
          className="flex flex-row items-center flex-shrink-0"
          style={{ gap: 12, height: 44 }}
        >
          <div
            className="box-border flex flex-row items-center flex-shrink"
            style={{
              padding: "12px 14px",
              gap: 10,
              width: 416,
              maxWidth: "40vw",
              minWidth: 120,
              height: 44,
              border: "1px solid rgba(31, 41, 55, 0.1)",
              borderRadius: 95,
            }}
          >
            <Search size={20} style={{ color: "#1F2937", opacity: 0.5 }} />
            <span
              className="truncate"
              style={{
                fontFamily: "Inter",
                fontWeight: 400,
                fontSize: 14,
                lineHeight: "20px",
                color: "#1F2937",
                opacity: 0.5,
              }}
            >
              Search by events by name, task, or meeting...
            </span>
          </div>

          <button
            className="box-border flex flex-row justify-center items-center flex-shrink-0"
            style={{
              padding: 12,
              gap: 8,
              width: 44,
              height: 44,
              background: "#FFFFFF",
              border: "1px solid #E1E4EA",
              borderRadius: 95,
            }}
          >
            <Filter size={20} style={{ color: "#1F2937" }} />
          </button>

          <button
            className="box-border flex flex-row justify-center items-center flex-shrink-0"
            style={{
              padding: 12,
              gap: 8,
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
            className="flex flex-row justify-center items-center flex-shrink-0"
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
              Add Activity
            </span>
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};

export default AdminCalendar;
