import React from "react";
import { X, Trash2, Loader2, Edit3, Calendar, Users, Flag, Video } from "lucide-react";
import toast from "react-hot-toast";

const CircleCheckIcon = (props) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M10 18.3333C5.39763 18.3333 1.66667 14.6024 1.66667 10C1.66667 5.39763 5.39763 1.66667 10 1.66667C14.6024 1.66667 18.3333 5.39763 18.3333 10C18.3333 14.6024 14.6024 18.3333 10 18.3333ZM9.16912 13.3333L15.0616 7.44005L13.885 6.2634L9.16912 10.98L6.81057 8.62145L5.63398 9.7981L9.16912 13.3333Z" fill="currentColor" />
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

  const selectedUsersList =
    users?.filter(
      (user) =>
        meetingData.participants?.includes(user._id) ||
        meetingData.contact?._id === user._id ||
        meetingData.vendor?._id === user._id ||
        meetingData.company?._id === user._id,
    ) || [];

  const priorityColors = {
    high: { bg: "rgba(205, 54, 54, 0.1)", color: "#CD3636" },
    medium: { bg: "rgba(188, 170, 0, 0.1)", color: "#BCAA00" },
    low: { bg: "rgba(0, 201, 80, 0.1)", color: "#00C950" },
  };
  const priorityStyle = priorityColors[meetingData.priority] || priorityColors.medium;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-end z-[10001] p-4 transition-opacity duration-300"
      style={{ opacity: isSliding ? 1 : 0 }}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-[26px] w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl border border-gray-100 flex flex-col transform transition-transform duration-300 ${
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
            <div className="flex flex-row items-center justify-between w-full" style={{ gap: 16 }}>
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
                  className="inline-flex items-center justify-center capitalize"
                  style={{
                    padding: "4px 10px",
                    borderRadius: 53,
                    backgroundColor: priorityStyle.bg,
                    fontFamily: "Inter",
                    fontWeight: 500,
                    fontSize: 12,
                    color: priorityStyle.color,
                    whiteSpace: "nowrap",
                  }}
                >
                  <Flag className="w-3 h-3 mr-1" />
                  {meetingData.priority || "Medium"}
                </span>
                <span
                  className="inline-flex items-center justify-center"
                  style={{
                    padding: "4px 10px",
                    borderRadius: 53,
                    border: "1px solid #BFDBFE",
                    backgroundColor: "#EFF6FF",
                    fontFamily: "Inter",
                    fontWeight: 500,
                    fontSize: 12,
                    color: "#1D4ED8",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Video className="w-3 h-3 mr-1" />
                  Video Call
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          {meetingData.description && (
            <div className="box-border flex flex-col items-start w-full" style={{ padding: "12px 24px" }}>
              <div
                className="flex flex-col items-start justify-center w-full"
                style={{ padding: 14, gap: 8, backgroundColor: "#F8FAFC", borderRadius: 14 }}
              >
                <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
                  Description
                </span>
                <p
                  className="w-full whitespace-pre-line"
                  style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 12, color: "#1F2937" }}
                >
                  {meetingData.description}
                </p>
              </div>
            </div>
          )}

          <div style={{ margin: "0 24px", borderBottom: "1px solid #D9D9D9" }} />

          {/* Date & Time / Participants */}
          <div className="flex flex-row items-start w-full" style={{ padding: "12px 24px", gap: 16 }}>
            <div
              className="flex flex-col items-start flex-1"
              style={{ padding: 14, gap: 6, backgroundColor: "#F8FAFC", borderRadius: 14 }}
            >
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" style={{ color: "#6B7280" }} />
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#6B7280" }}>
                  Date &amp; Time
                </span>
              </div>
              <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 13, lineHeight: "140%", color: "#0E121B" }}>
                {meetingData.scheduledAt
                  ? new Date(meetingData.scheduledAt).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
                  : "—"}
              </span>
              <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "140%", color: "#0085FF" }}>
                {meetingData.scheduledAt
                  ? new Date(meetingData.scheduledAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
                  : ""}
                {meetingData.duration ? ` • ${meetingData.duration} minutes` : ""}
              </span>
            </div>

            <div
              className="flex flex-col items-start flex-1"
              style={{ padding: 14, gap: 8, backgroundColor: "#F8FAFC", borderRadius: 14 }}
            >
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" style={{ color: "#6B7280" }} />
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#6B7280" }}>
                  Participants ({selectedUsersList.length})
                </span>
              </div>
              {selectedUsersList.length > 0 ? (
                <div className="flex flex-wrap items-start" style={{ gap: 6 }}>
                  {selectedUsersList.map((user) => (
                    <span
                      key={user._id}
                      className="inline-flex items-center"
                      style={{
                        padding: "4px 8px",
                        borderRadius: 53,
                        backgroundColor: "rgba(0, 133, 255, 0.1)",
                        fontFamily: "Inter",
                        fontWeight: 500,
                        fontSize: 12,
                        color: "#0085FF",
                        gap: 4,
                      }}
                    >
                      <Users className="w-3 h-3" />
                      {user.name || "Unknown"}
                    </span>
                  ))}
                </div>
              ) : (
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, color: "#8D8D8E" }}>
                  No participants assigned
                </span>
              )}
            </div>
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
