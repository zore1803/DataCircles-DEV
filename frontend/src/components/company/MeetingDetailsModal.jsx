import React from "react";
import { X, Trash2, Loader2, Edit3, Users, Plus, Video, CalendarX, CalendarClock } from "lucide-react";
import toast from "react-hot-toast";

const CircleCheckIcon = (props) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M10 18.3333C5.39763 18.3333 1.66667 14.6024 1.66667 10C1.66667 5.39763 5.39763 1.66667 10 1.66667C14.6024 1.66667 18.3333 5.39763 18.3333 10C18.3333 14.6024 14.6024 18.3333 10 18.3333ZM9.16912 13.3333L15.0616 7.44005L13.885 6.2634L9.16912 10.98L6.81057 8.62145L5.63398 9.7981L9.16912 13.3333Z" fill="currentColor" />
  </svg>
);

const DealIcon = (props) => (
  <svg width="17" height="16" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M1.66667 15.8333C1.20833 15.8333 0.815972 15.6701 0.489583 15.3438C0.163194 15.0174 0 14.625 0 14.1667V5C0 4.54167 0.163194 4.14931 0.489583 3.82292C0.815972 3.49653 1.20833 3.33333 1.66667 3.33333H5V1.66667C5 1.20833 5.16319 0.815972 5.48958 0.489583C5.81597 0.163194 6.20833 0 6.66667 0H10C10.4583 0 10.8507 0.163194 11.1771 0.489583C11.5035 0.815972 11.6667 1.20833 11.6667 1.66667V3.33333H15C15.4583 3.33333 15.8507 3.49653 16.1771 3.82292C16.5035 4.14931 16.6667 4.54167 16.6667 5V14.1667C16.6667 14.625 16.5035 15.0174 16.1771 15.3438C15.8507 15.6701 15.4583 15.8333 15 15.8333H1.66667ZM1.66667 14.1667H15V5H1.66667V14.1667ZM6.66667 3.33333H10V1.66667H6.66667V3.33333Z" fill="#D4AA00" />
  </svg>
);

const InvoiceIcon = (props) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M5.83333 15.5H14.1667V14H5.83333V15.5ZM5.83333 11.75H14.1667V10.25H5.83333V11.75ZM4.16667 18.3333C3.70833 18.3333 3.31597 18.1701 2.98958 17.8438C2.66319 17.5174 2.5 17.125 2.5 16.6667V3.33333C2.5 2.875 2.66319 2.48264 2.98958 2.15625C3.31597 1.82986 3.70833 1.66667 4.16667 1.66667H12.5L17.5 6.66667V16.6667C17.5 17.125 17.3368 17.5174 17.0104 17.8438C16.684 18.1701 16.2917 18.3333 15.8333 18.3333H4.16667ZM11.6667 7.5V3.33333H4.16667V16.6667H15.8333V7.5H11.6667Z" fill="#6155F5" />
  </svg>
);

const MeetingDetailsModal = ({ open, meetingData, users, onDelete, onClose, onEdit, onComplete }) => {
  const [isSliding, setIsSliding] = React.useState(false);
  const [shouldRender, setShouldRender] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setShouldRender(true);
      setTimeout(() => setIsSliding(true), 10);
    } else {
      setIsSliding(false);
      setTimeout(() => setShouldRender(false), 300);
    }
  }, [open]);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await onDelete(meetingData._id);
      toast.success("Meeting deleted successfully");
      onClose();
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to delete meeting");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (!shouldRender || !meetingData) return null;

  const meetingId = `MEETING-${(meetingData._id || "").slice(-5).toUpperCase()}`;
  const organizer = typeof meetingData.createdBy === "object" ? meetingData.createdBy : null;
  const internalTeam =
    users?.filter(
      (user) =>
        meetingData.participants?.includes(user._id) ||
        meetingData.contact?._id === user._id ||
        meetingData.vendor?._id === user._id ||
        meetingData.company?._id === user._id,
    ) || [];
  const primaryContact = internalTeam[0];

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-end z-[10001] p-4 transition-opacity duration-300"
      style={{ opacity: isSliding ? 1 : 0 }}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-[26px] w-full max-w-lg h-[90vh] overflow-hidden shadow-2xl border border-gray-100 flex flex-col transform transition-transform duration-300 ${
          isSliding ? "translate-x-0" : "translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex flex-row justify-between items-center flex-shrink-0"
          style={{ padding: "23px 24px", gap: 10, height: 55 }}
        >
          <span style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 14, lineHeight: "20px", color: "#78788D" }}>
            {meetingId}
          </span>
          <div className="flex flex-row items-center justify-end" style={{ gap: 4 }}>
            <button
              onClick={() => onEdit?.(meetingData)}
              className="p-1 rounded-lg hover:bg-blue-50 transition-colors"
              title="Edit"
            >
              <Edit3 className="w-5 h-5" style={{ color: "#0085FF" }} />
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              title="Delete"
            >
              {isDeleting ? (
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#F60000" }} />
              ) : (
                <Trash2 className="w-5 h-5" style={{ color: "#F60000" }} />
              )}
            </button>
            <div style={{ width: 1, height: 18, backgroundColor: "rgba(28, 27, 31, 0.3)" }} />
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors" title="Close">
              <X className="w-5 h-5" style={{ color: "#1C1B1F" }} />
            </button>
          </div>
        </div>

        <div style={{ borderBottom: "1px solid #D9D9D9" }} />

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {/* Title strip */}
          <div className="flex flex-col items-start" style={{ padding: 24, gap: 14 }}>
            <div className="flex flex-col items-start w-full" style={{ gap: 6 }}>
              <div className="flex flex-row items-center w-full" style={{ gap: 40 }}>
                <h1
                  style={{
                    fontFamily: "Inter",
                    fontWeight: 500,
                    fontSize: 16,
                    lineHeight: "120%",
                    letterSpacing: "-0.5px",
                    color: "#0E121B",
                  }}
                  className="truncate"
                >
                  {meetingData.title || "Untitled Meeting"}
                </h1>
                <div className="flex items-center flex-shrink-0" style={{ gap: 8 }}>
                  <span
                    className="inline-flex items-center justify-center"
                    style={{
                      padding: "4px 8px",
                      borderRadius: 35,
                      backgroundColor: "rgba(0, 133, 255, 0.1)",
                      fontFamily: "Inter",
                      fontWeight: 500,
                      fontSize: 12,
                      lineHeight: "120%",
                      color: "#0085FF",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {meetingData.scheduledAt && new Date(meetingData.scheduledAt) < new Date() ? "Completed" : "Upcoming"}
                  </span>
                  <span
                    className="inline-flex items-center justify-center capitalize"
                    style={{
                      padding: "4px 8px",
                      borderRadius: 35,
                      backgroundColor: "#EEE7FD",
                      fontFamily: "Inter",
                      fontWeight: 500,
                      fontSize: 12,
                      lineHeight: "120%",
                      color: "#CB30E0",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {meetingData.meetingType?.replace("-", " ") || "General"}
                  </span>
                </div>
                <button
                  onClick={() => toast("Join meeting isn't available yet")}
                  className="flex items-center justify-center gap-2 flex-shrink-0 whitespace-nowrap"
                  style={{
                    marginLeft: "auto",
                    padding: "12px 14px",
                    border: "1px solid rgba(39, 112, 121, 0.3)",
                    borderRadius: 80,
                    fontFamily: "Inter",
                    fontWeight: 500,
                    fontSize: 16,
                    lineHeight: "20px",
                    color: "#1F2937",
                  }}
                >
                  <Video className="w-5 h-5" style={{ color: "#1C1B1F" }} />
                  Join Meeting
                </button>
              </div>
              <div className="flex flex-row items-center w-full" style={{ gap: 6 }}>
                {meetingData.company?.logo ? (
                  <img
                    src={meetingData.company.logo}
                    alt={meetingData.company?.name}
                    className="rounded-full object-cover flex-shrink-0"
                    style={{ width: 16, height: 16 }}
                  />
                ) : (
                  <div
                    className="rounded-full bg-gray-200 flex items-center justify-center text-[8px] font-semibold text-gray-600 flex-shrink-0"
                    style={{ width: 16, height: 16 }}
                  >
                    {meetingData.company?.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                )}
                <span
                  className="truncate"
                  style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 12, lineHeight: "120%", color: "#525866" }}
                >
                  {meetingData.company?.name || "Company Name"}
                </span>
              </div>
            </div>
          </div>

          <div style={{ margin: "0 24px", borderBottom: "1px solid #D9D9D9" }} />

          {/* Meeting Information */}
          <div className="flex flex-col items-start w-full" style={{ padding: "12px 24px", gap: 14 }}>
            <p style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
              Meeting Information
            </p>
            <div
              className="flex flex-col items-start w-full"
              style={{ padding: 14, gap: 16, backgroundColor: "#F8FAFC", borderRadius: 14 }}
            >
              {/* Assigned User + Status pill */}
              <div className="flex flex-row items-center justify-between w-full" style={{ gap: 16 }}>
                <div className="flex flex-row items-start" style={{ gap: 12 }}>
                  <div
                    className="rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700 flex-shrink-0"
                    style={{ width: 32, height: 32 }}
                  >
                    {(typeof meetingData.createdBy === "object" ? meetingData.createdBy?.name : null)?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="flex flex-col items-start" style={{ gap: 4 }}>
                    <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 10, lineHeight: "120%", color: "#6B7280" }}>
                      Assigned User
                    </span>
                    <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
                      {(typeof meetingData.createdBy === "object" ? meetingData.createdBy?.name : null) || "Unknown"}
                    </span>
                  </div>
                </div>
                <span
                  className="inline-flex items-center justify-center"
                  style={{
                    padding: "4px 8px",
                    borderRadius: 35,
                    backgroundColor: meetingData.status === "completed" ? "#00C950" : "#0085FF",
                    fontFamily: "Inter",
                    fontWeight: 500,
                    fontSize: 12,
                    lineHeight: "120%",
                    color: "#FFFFFF",
                    whiteSpace: "nowrap",
                  }}
                >
                  {meetingData.status === "completed" ? "Completed" : "In-Progress"}
                </span>
              </div>

              {/* Scheduled Date / Time / Duration */}
              <div className="flex flex-row items-start w-full" style={{ gap: 16 }}>
                <div className="flex flex-col items-start flex-1" style={{ gap: 6 }}>
                  <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#6B7280" }}>
                    Scheduled Date
                  </span>
                  <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
                    {meetingData.scheduledAt
                      ? new Date(meetingData.scheduledAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", weekday: "short" })
                      : "—"}
                  </span>
                </div>
                <div className="flex flex-col items-start flex-1" style={{ gap: 6 }}>
                  <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#6B7280" }}>
                    Time
                  </span>
                  <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#0085FF" }}>
                    {meetingData.scheduledAt
                      ? (() => {
                          const start = new Date(meetingData.scheduledAt);
                          const end = new Date(start.getTime() + (meetingData.duration || 0) * 60000);
                          const fmt = (d) => d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
                          return `${fmt(start)} - ${fmt(end)}`;
                        })()
                      : "—"}
                  </span>
                </div>
                <div className="flex flex-col items-start flex-1" style={{ gap: 6 }}>
                  <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#6B7280" }}>
                    Duration
                  </span>
                  <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
                    {meetingData.duration ? `${meetingData.duration} Mins` : "—"}
                  </span>
                </div>
              </div>

              {/* Type / Time-zone */}
              <div className="flex flex-row items-start w-full" style={{ gap: 16 }}>
                <div className="flex flex-col items-start flex-1" style={{ gap: 6 }}>
                  <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#6B7280" }}>
                    Type
                  </span>
                  <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#1C1C1D" }} className="capitalize">
                    {meetingData.meetingType?.replace("-", " ") || "—"}
                  </span>
                </div>
                <div className="flex flex-col items-start flex-1" style={{ gap: 6 }}>
                  <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#6B7280" }}>
                    Time-zone
                  </span>
                  <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
                    {Intl.DateTimeFormat().resolvedOptions().timeZone || "—"}
                  </span>
                </div>
                <div className="flex-1" style={{ opacity: 0 }} aria-hidden="true" />
              </div>
            </div>
          </div>

          {/* Organiser / Internal Team / Client Contacts */}
          <div className="flex flex-col items-start w-full" style={{ padding: "12px 24px", gap: 14 }}>
            {/* Organiser */}
            <div className="flex items-center" style={{ gap: 6 }}>
              <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 10, lineHeight: "120%", color: "#6B7280" }}>
                Organiser
              </span>
            </div>
            <div className="flex flex-row items-center" style={{ gap: 12 }}>
              <div
                className="rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700 flex-shrink-0"
                style={{ width: 32, height: 32 }}
              >
                {organizer?.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="flex flex-col items-start" style={{ gap: 4 }}>
                <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
                  {organizer?.name || "Unknown"}
                </span>
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#6B7280" }}>
                  {organizer?.role || "—"}
                </span>
              </div>
              <span
                className="inline-flex items-center justify-center flex-shrink-0"
                style={{
                  padding: "4px 8px",
                  borderRadius: 35,
                  backgroundColor: "rgba(52, 199, 89, 0.1)",
                  fontFamily: "Inter",
                  fontWeight: 500,
                  fontSize: 12,
                  color: "#34C759",
                }}
              >
                Confirmed
              </span>
            </div>

            <div style={{ width: "100%", borderBottom: "1px solid #E7E7E9" }} />

            {/* Internal Team */}
            <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 10, lineHeight: "120%", color: "#6B7280" }}>
              Internal Team
            </span>
            <div className="flex flex-row flex-wrap items-start w-full" style={{ gap: 32 }}>
              {internalTeam.length > 0 ? (
                internalTeam.map((user) => (
                  <div key={user._id} className="flex flex-row items-center" style={{ gap: 12 }}>
                    <div
                      className="rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-600 flex-shrink-0"
                      style={{ width: 32, height: 32 }}
                    >
                      {user.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="flex flex-col items-start" style={{ gap: 4 }}>
                      <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
                        {user.name || "Unknown"}
                      </span>
                      <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#6B7280" }}>
                        {user.role || "—"}
                      </span>
                    </div>
                    <span
                      className="inline-flex items-center justify-center flex-shrink-0"
                      style={{
                        padding: "4px 8px",
                        borderRadius: 35,
                        backgroundColor: "rgba(52, 199, 89, 0.1)",
                        fontFamily: "Inter",
                        fontWeight: 500,
                        fontSize: 10,
                        color: "#34C759",
                      }}
                    >
                      Confirmed
                    </span>
                  </div>
                ))
              ) : (
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, color: "#8D8D8E" }}>
                  No internal team members
                </span>
              )}
            </div>
            <button
              onClick={() => onEdit?.(meetingData)}
              className="flex items-center hover:opacity-80 transition-opacity"
              style={{ gap: 6 }}
            >
              <Plus className="w-3.5 h-3.5" style={{ color: "#0085FF" }} />
              <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 10, lineHeight: "120%", color: "#0085FF" }}>
                Add Internal Participant
              </span>
            </button>

            <div style={{ width: "100%", borderBottom: "1px solid #E7E7E9" }} />

            {/* Client Contacts */}
            <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 10, lineHeight: "120%", color: "#6B7280" }}>
              Client Contacts
            </span>
            {meetingData.contact ? (
              <div className="flex flex-row items-center" style={{ gap: 12 }}>
                <div
                  className="rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-600 flex-shrink-0"
                  style={{ width: 32, height: 32 }}
                >
                  {meetingData.contact?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="flex flex-col items-start" style={{ gap: 4 }}>
                  <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
                    {meetingData.contact?.name}
                  </span>
                  <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#6B7280" }}>
                    {meetingData.contact?.role || "—"}
                  </span>
                </div>
              </div>
            ) : (
              <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, color: "#8D8D8E" }}>
                No client contacts
              </span>
            )}
            <button
              onClick={() => onEdit?.(meetingData)}
              className="flex items-center hover:opacity-80 transition-opacity"
              style={{ gap: 6 }}
            >
              <Plus className="w-3.5 h-3.5" style={{ color: "#0085FF" }} />
              <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 10, lineHeight: "120%", color: "#0085FF" }}>
                Add Client Contact
              </span>
            </button>
          </div>

          <div style={{ margin: "0 24px", borderBottom: "1px solid #D9D9D9" }} />

          {/* Meeting Purpose */}
          {meetingData.description && (
            <div className="box-border flex flex-col items-start w-full" style={{ padding: "12px 24px" }}>
              <div
                className="flex flex-col items-start w-full"
                style={{ padding: 14, gap: 16, backgroundColor: "#F8FAFC", borderRadius: 14 }}
              >
                <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
                  Meeting Purpose
                </span>
                <p
                  className="w-full whitespace-pre-line"
                  style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 12, lineHeight: "120%", color: "#1F2937" }}
                >
                  {meetingData.description}
                </p>
              </div>
            </div>
          )}

          {/* Linked Records */}
          <div className="box-border flex flex-col items-start w-full" style={{ padding: "12px 24px", gap: 14 }}>
            <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
              Linked Records
            </span>
            <div
              className="flex flex-col items-start w-full"
              style={{ padding: 14, gap: 16, backgroundColor: "#F8FAFC", borderRadius: 14 }}
            >
              <div className="flex flex-row justify-between items-center w-full" style={{ gap: 16 }}>
                <div className="flex flex-row items-center flex-1 min-w-0" style={{ gap: 12 }}>
                  <div
                    className="rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0"
                    style={{ width: 32, height: 32 }}
                  >
                    {primaryContact?.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="flex flex-col items-start min-w-0" style={{ gap: 4 }}>
                    <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 10, lineHeight: "120%", color: "#6B7280" }}>
                      Contact
                    </span>
                    <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#1F2937" }} className="truncate">
                      {primaryContact?.name || "—"}
                    </span>
                    <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 8, lineHeight: "120%", color: "#6B7280" }} className="truncate">
                      {primaryContact?.role || "—"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-row items-center flex-1 min-w-0" style={{ gap: 12 }}>
                  <div
                    className="rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ width: 32, height: 32, backgroundColor: "rgba(212, 170, 0, 0.1)" }}
                  >
                    <DealIcon className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col items-start min-w-0" style={{ gap: 4 }}>
                    <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 10, lineHeight: "120%", color: "#6B7280" }}>
                      Deal
                    </span>
                    <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#0085FF" }} className="truncate">
                      {meetingData.company?.name || "—"}
                    </span>
                    <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 8, lineHeight: "120%", color: "#6B7280" }} className="truncate">
                      —
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-row justify-start items-center w-full" style={{ gap: 16 }}>
                <div className="flex flex-row items-center flex-1 min-w-0" style={{ gap: 12 }}>
                  <div
                    className="rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ width: 32, height: 32, backgroundColor: "rgba(97, 85, 245, 0.1)" }}
                  >
                    <InvoiceIcon className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col items-start min-w-0" style={{ gap: 4 }}>
                    <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 10, lineHeight: "120%", color: "#6B7280" }}>
                      Invoice
                    </span>
                    <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#0085FF" }} className="truncate">
                      —
                    </span>
                    <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 8, lineHeight: "120%", color: "#6B7280" }} className="truncate">
                      —
                    </span>
                  </div>
                </div>
                <div className="flex-1" />
              </div>
            </div>
          </div>

          {/* Meeting actions row */}
          <div style={{ margin: "0 24px", borderTop: "1px solid #D9D9D9" }} />
          <div
            className="flex flex-row justify-center items-center w-full"
            style={{ padding: "23px 24px", gap: 12 }}
          >
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
              style={{
                padding: "12px 14px",
                border: "1px solid rgba(205, 54, 54, 0.3)",
                borderRadius: 80,
                fontFamily: "Inter",
                fontWeight: 500,
                fontSize: 16,
                lineHeight: "20px",
                color: "#CD3636",
              }}
            >
              {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarX className="w-5 h-5" />}
              Cancel Meeting
            </button>
            <button
              onClick={() => onEdit?.(meetingData)}
              className="flex items-center justify-center gap-2 whitespace-nowrap"
              style={{
                padding: "12px 14px",
                border: "1px solid rgba(0, 133, 255, 0.3)",
                borderRadius: 80,
                fontFamily: "Inter",
                fontWeight: 500,
                fontSize: 16,
                lineHeight: "20px",
                color: "#0085FF",
              }}
            >
              <CalendarClock className="w-5 h-5" />
              Reschedule
            </button>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #D9D9D9" }} />

        {/* Footer */}
        <div
          className="flex flex-row justify-between items-center flex-shrink-0"
          style={{ padding: "23px 24px", gap: 10 }}
        >
          <button
            onClick={() => (onComplete ? onComplete(meetingData) : toast("Mark as complete isn't available yet"))}
            className="flex items-center justify-center gap-2"
            style={{
              padding: "12px 14px",
              backgroundColor: "rgba(0, 201, 80, 0.05)",
              border: "1px solid rgba(28, 176, 97, 0.3)",
              borderRadius: 80,
              fontFamily: "Inter",
              fontWeight: 500,
              fontSize: 16,
              lineHeight: "20px",
              color: "#1CB061",
            }}
          >
            <CircleCheckIcon className="w-5 h-5" style={{ color: "#34C759" }} />
            Mark As Complete
          </button>
          <button
            onClick={() => onEdit?.(meetingData)}
            className="flex items-center justify-center"
            style={{
              padding: "12px 14px",
              backgroundColor: "#0085FF",
              borderRadius: 88,
              fontFamily: "Inter",
              fontWeight: 500,
              fontSize: 16,
              lineHeight: "20px",
              color: "#FFFFFF",
            }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default MeetingDetailsModal;
