import React, { useState } from "react";

const MeetingModal = ({
  open,
  mode, // 'create' or 'view'
  meetingData,
  calendarDate,
  onSave,
  onDelete,
  onClose
}) => {
  // Only required for 'create' mode
  const initialState = {
    title: "",
    time: "09:00",
    duration: 60,
    priority: "medium",
    meetingType: "in-person",
    location: "",
    description: ""
  };
  const [form, setForm] = useState(
    meetingData
      ? {
          ...meetingData,
          time: meetingData.scheduledAt
            ? new Date(meetingData.scheduledAt).toISOString().slice(11, 16)
            : "09:00"
        }
      : initialState
  );
  const [loading, setLoading] = useState(false);

  // Merge calendarDate + time input into ISO scheduledAt
  const getScheduledAt = () => {
    const date = new Date(calendarDate);
    const [h, m] = form.time.split(":").map(Number);
    date.setHours(h, m, 0, 0);
    return date.toISOString();
  };

  const handleChange = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        ...form,
        scheduledAt: getScheduledAt()
      });
      setForm({});
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/20 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between px-8 py-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            {mode === "create" ? "Schedule Meeting" : "Meeting Details"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition"
            aria-label="Close"
          >
            <svg className="w-7 h-7" stroke="currentColor" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="px-8 py-8 bg-gray-50">
          {mode === "create" ? (
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-8">
                {/* Left: Main fields */}
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Title<span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={form.title}
                      onChange={e => handleChange("title", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100"
                      placeholder="Meeting subject"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
                    <input
                      type="text"
                      value={form.location}
                      onChange={e => handleChange("location", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100"
                      placeholder="Office / Link"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                    <textarea
                      value={form.description}
                      onChange={e => handleChange("description", e.target.value)}
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100"
                      placeholder="Meeting agenda or notes..."
                    />
                  </div>
                </div>
                {/* Right: Details and dropdowns */}
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                    <div className="py-2 px-4 bg-gray-200 text-gray-800 font-medium rounded-lg border border-gray-200">{calendarDate ? calendarDate.toLocaleDateString() : "-"}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Time<span className="text-red-500">*</span></label>
                    <input
                      type="time"
                      required
                      value={form.time}
                      onChange={e => handleChange("time", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Duration</label>
                    <select
                      value={form.duration}
                      onChange={e => handleChange("duration", parseInt(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100"
                    >
                      <option value={15}>15 mins</option>
                      <option value={30}>30 mins</option>
                      <option value={60}>1 hour</option>
                      <option value={120}>2 hours</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
                    <select
                      value={form.meetingType}
                      onChange={e => handleChange("meetingType", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100"
                    >
                      <option value="in-person">In person</option>
                      <option value="video-call">Video call</option>
                      <option value="phone-call">Phone call</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-4 pt-8">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 font-semibold text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-7 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow transition"
                >
                  {loading ? "Saving..." : "Schedule"}
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-2 gap-8">
              {/* Left: Main info */}
              <div className="space-y-5 pr-4 border-r border-gray-200">
                <div className="text-2xl font-bold text-blue-700 mb-2">{meetingData.title}</div>
                <div>
                  <span className="block font-semibold text-gray-700 mb-2">Location</span>
                  <span className="text-gray-900"><span className="bg-gray-200 rounded px-2 py-1">{meetingData.location}</span></span>
                </div>
                <div>
                  <span className="block font-semibold text-gray-700 mb-2">Description</span>
                  <div className="text-gray-900 whitespace-pre-line bg-gray-100 border border-gray-200 rounded-lg px-4 py-2">{meetingData.description}</div>
                </div>
              </div>
              {/* Right: Meta */}
              <div className="space-y-5 pl-4">
                <div>
                  <span className="block font-semibold text-gray-700 mb-2">Date & Time</span>
                  <span className="text-gray-900 font-semibold">{new Date(meetingData.scheduledAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="block font-semibold text-gray-700 mb-2">Duration</span>
                  <span className="text-gray-900">{meetingData.duration} min</span>
                </div>
                <div>
                  <span className="block font-semibold text-gray-700 mb-2">Type</span>
                  <span className="text-gray-900 capitalize">{meetingData.meetingType}</span>
                </div>
                <div className="pt-7">
                  {onDelete && (
                    <button
                      onClick={() => onDelete(meetingData._id)}
                      className="px-6 py-2 font-semibold text-red-700 bg-red-100 hover:bg-red-200 rounded-lg border border-red-200 transition"
                    >
                      Delete Meeting
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingModal;
