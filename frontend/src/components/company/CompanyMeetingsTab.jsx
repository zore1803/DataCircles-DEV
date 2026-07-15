import React, { useEffect, useMemo, useState } from "react";
import {
  Handshake,
  CalendarDays,
  CalendarCheck,
  MapPin,
  Search,
  Filter,
  Plus,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import API from "../../services/api";
import CompanyMeetingForm from "./CompanyMeetingForm";
import MeetingDetailsModal from "./MeetingDetailsModal";

export default function CompanyMeetingsTab({ companyId, meetings = [], setMeetings }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState([]);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await API.get(`/contacts/company/${companyId}`);
        setUsers(res.data || []);
      } catch (err) {
        console.error("Failed to load contacts:", err);
      }
    };
    if (companyId) fetchUsers();
  }, [companyId]);

  const refetchMeetings = async () => {
    try {
      const res = await API.get("/meetings", { params: { companyId } });
      setMeetings(res.data.meetings);
    } catch (err) {
      console.error("Failed to refetch meetings:", err);
    }
  };

  const handleMeetingSave = async (meetingData) => {
    try {
      await API.post("/meetings", meetingData);
      await refetchMeetings();
      toast.success("Meeting created successfully!");
      setShowMeetingForm(false);
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to create meeting.");
      }
      throw err;
    }
  };

  const handleMeetingDelete = async (meetingId) => {
    try {
      await API.delete(`/meetings/${meetingId}`);
      await refetchMeetings();
      toast.success("Meeting deleted successfully!");
      setIsDetailsOpen(false);
      setSelectedMeeting(null);
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to delete meeting.");
      }
      throw err;
    }
  };

  const handleMeetingClick = (meeting) => {
    setSelectedMeeting(meeting);
    setIsDetailsOpen(true);
  };

  const filteredMeetings = useMemo(() => {
    if (!searchTerm.trim()) return meetings;
    const q = searchTerm.toLowerCase();
    return meetings.filter((m) => (m.title || "").toLowerCase().includes(q));
  }, [meetings, searchTerm]);

  const now = new Date();
  const in15Days = new Date();
  in15Days.setDate(in15Days.getDate() + 15);

  const total = meetings.length;
  const upcoming = meetings.filter(
    (m) => m.scheduledAt && new Date(m.scheduledAt) >= now,
  );
  const upcomingIn15 = upcoming.filter(
    (m) => new Date(m.scheduledAt) <= in15Days,
  ).length;
  const completed = meetings.filter(
    (m) => m.scheduledAt && new Date(m.scheduledAt) < now,
  ).length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const nextMeeting = [...upcoming].sort(
    (a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt),
  )[0];

  const nextMeetingLabel = (() => {
    if (!nextMeeting) return "—";
    const d = new Date(nextMeeting.scheduledAt);
    const isTomorrow =
      d.toDateString() ===
      new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
    const isToday = d.toDateString() === now.toDateString();
    const dayLabel = isToday
      ? "Today"
      : isTomorrow
        ? "Tomorrow"
        : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const time = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${dayLabel} • ${time}`;
  })();

  const kpiTiles = [
    {
      label: "Total Meetings",
      value: total,
      icon: Handshake,
      subtitle: "Since Onboarding",
      subtitleClass: "text-gray-400",
    },
    {
      label: "Upcoming",
      value: upcomingIn15,
      icon: CalendarDays,
      subtitle: "Next 15 Days",
      subtitleClass: "text-blue-500",
    },
    {
      label: "Completed",
      value: completed,
      icon: CalendarCheck,
      subtitle: `${completionRate}% Completion Rate`,
      subtitleClass: "text-green-600",
    },
    {
      label: "Next Meeting",
      value: nextMeetingLabel,
      icon: MapPin,
      valueSmall: true,
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
                <p
                  className={`font-semibold text-gray-900 ${tile.valueSmall ? "text-sm" : "text-base"}`}
                >
                  {tile.value}
                </p>
                {tile.subtitle && (
                  <span className={`text-[11px] ${tile.subtitleClass}`}>
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
            placeholder="Search by meetings by type, time, or contact..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-blue-300"
          />
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50">
          <Filter size={14} />
          Filter
        </button>
        <button
          onClick={() => setShowMeetingForm(true)}
          className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
          title="Add Meeting"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Meeting list or empty state */}
      {filteredMeetings.length === 0 ? (
        <button
          onClick={() => setShowMeetingForm(true)}
          className="flex flex-col items-center justify-center w-full min-h-[300px] bg-gray-50 border border-gray-200 rounded-xl text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-colors"
        >
          <Users size={28} className="mb-2" />
          <span className="text-sm font-medium">Add New Meetings</span>
        </button>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMeetings.map((meeting) => (
            <button
              key={meeting._id}
              onClick={() => handleMeetingClick(meeting)}
              className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:shadow-sm hover:border-blue-300 transition-all text-left"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-semibold text-blue-700 flex-shrink-0">
                <Users size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {meeting.title}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {meeting.scheduledAt &&
                    new Date(meeting.scheduledAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "2-digit",
                    })}{" "}
                  · {meeting.status}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {showMeetingForm && (
        <CompanyMeetingForm
          open={showMeetingForm}
          mode="create"
          companyId={companyId}
          users={users}
          onSave={handleMeetingSave}
          onDelete={handleMeetingDelete}
          onClose={() => setShowMeetingForm(false)}
        />
      )}

      {selectedMeeting && (
        <MeetingDetailsModal
          open={isDetailsOpen}
          meetingData={selectedMeeting}
          users={users}
          onDelete={handleMeetingDelete}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedMeeting(null);
          }}
        />
      )}
    </div>
  );
}
