import React, { useState, useEffect, useCallback } from "react";
import API from "../../services/api";
import toast from "react-hot-toast";
import {
  X,
  Calendar,
  Clock,
  Users,
  MapPin,
  FileText,
  Video,
  Phone,
  AlertTriangle,
  CheckCircle2,
  Search,
  Plus,
  Trash2,
  User,
  Building,
  Lightbulb,
  Timer,
  Flag,
  Pencil,
  ChevronDown
} from "lucide-react";

const initialState = {
  title: "",
  date: "",
  time: "09:00",
  duration: 60,
  priority: "medium",
  meetingType: "in-person",
  location: "",
  description: "",
  participants: [],
};

const ParticipantChip = ({ user, onRemove, isRemovable = false }) => (
  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-200">
    <User className="w-3 h-3" />
    <span>{user?.name || "Unknown"}</span>
    {isRemovable && onRemove && (
      <button onClick={onRemove} className="hover:bg-blue-100 rounded-full p-0.5">
        <X className="w-3 h-3" />
      </button>
    )}
  </div>
);

const PriorityChip = ({ priority }) => {
  const colors = {
    low: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    medium: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
    high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  };
  const color = colors[priority] || colors.medium;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 ${color.bg} ${color.text} rounded-lg text-sm font-medium ${color.border}`}>
      <Flag className="w-3 h-3" />
      <span className="capitalize">{priority}</span>
    </div>
  );
};

const SingleSelectDropdown = ({ options, value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-end gap-2 px-3 py-1.5 rounded-full text-xs font-semibold focus:outline-none transition-all ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'
          } ${selectedOption.className}`}
      >
        <div className="flex items-center gap-1.5">
          {selectedOption.icon && <selectedOption.icon className="w-3 h-3" />}
          <span className="capitalize">{selectedOption.label}</span>
        </div>
        {!disabled && <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in duration-200">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 ${value === option.value ? 'bg-blue-50/50 text-blue-600' : 'text-gray-600'
                }`}
            >
              <div className={`p-1.5 rounded-lg ${option.className}`}>
                {option.icon && <option.icon className="w-3.5 h-3.5" />}
              </div>
              <span className="font-medium">{option.label}</span>
              {value === option.value && <CheckCircle2 className="w-4 h-4 ml-auto text-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const MultiSelectDropdown = ({ users, selectedUsers, onSelectionChange, placeholder = "Select participants" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUserToggle = (userId) => {
    const updatedSelection = selectedUsers.includes(userId)
      ? selectedUsers.filter(id => id !== userId)
      : [...selectedUsers, userId];
    onSelectionChange(updatedSelection);
    setIsOpen(false);
  };

  const selectedUsersList = users.filter(user => selectedUsers.includes(user._id));

  return (
    <div className="space-y-3">
      {selectedUsersList.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
          {selectedUsersList.map((user) => (
            <ParticipantChip
              key={user._id}
              user={user}
              isRemovable={true}
              onRemove={() => handleUserToggle(user._id)}
            />
          ))}
        </div>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-xl text-left hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-gray-400" />
            <span className={selectedUsers.length === 0 ? "text-gray-500" : "text-gray-900"}>
              {selectedUsers.length === 0 ? placeholder : `${selectedUsers.length} participant(s) selected`}
            </span>
          </div>
          <Users className="w-4 h-4 text-gray-400" />
        </button>
        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-white border border-gray-300 rounded-xl shadow-xl max-h-64 overflow-hidden">
            <div className="p-3 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search participants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No users found</p>
                </div>
              ) : (
                <div className="p-2">
                  {filteredUsers.map((user) => (
                    <label
                      key={user._id}
                      className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user._id)}
                        onChange={() => handleUserToggle(user._id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="w-3 h-3 text-blue-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">{user.name}</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const FormField = ({ label, required, children, error, description, icon: Icon }) => (
  <div className="space-y-2">
    <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
      {Icon && <Icon className="w-4 h-4 text-gray-500" />}
      {label}
      {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {description && <p className="text-xs text-gray-500">{description}</p>}
    {error && (
      <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
        <AlertTriangle className="w-4 h-4 text-red-500" />
        <p className="text-xs text-red-600">{error}</p>
      </div>
    )}
  </div>
);

const TimeConflictAlert = ({ conflict, suggestedTimes, onTimeSelect }) => (
  <div className="space-y-3">
    <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-red-500" />
        <p className="text-sm font-semibold text-red-700">Time Conflict Detected</p>
      </div>
      <p className="text-sm text-red-600">{conflict.message}</p>
    </div>
    {suggestedTimes.length > 0 && (
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4 text-blue-500" />
          <p className="text-sm font-semibold text-blue-700">Suggested Available Times</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {suggestedTimes.map((time) => (
            <button
              key={time}
              type="button"
              onClick={() => onTimeSelect(time)}
              className="px-3 py-1.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors font-medium"
            >
              {new Date(`2024-01-01T${time}`).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })}
            </button>
          ))}
        </div>
      </div>
    )}
  </div>
);

const MeetingTypeIcon = ({ type }) => {
  const icons = {
    'in-person': <Building className="w-4 h-4" />,
    'video-call': <Video className="w-4 h-4" />,
    'phone-call': <Phone className="w-4 h-4" />
  };
  return icons[type] || icons['in-person'];
};

const CompanyMeetingForm = ({
  open,
  mode,
  meetingData,
  calendarDate,
  companyId,
  users,
  onSave,
  onDelete,
  onClose,
  startInEditMode
}) => {
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [isSliding, setIsSliding] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [existingMeetings, setExistingMeetings] = useState([]);
  const [company, setCompany] = useState(null);
  const [timeConflict, setTimeConflict] = useState(null);
  const [errors, setErrors] = useState({});
  const [isEditMode, setIsEditMode] = useState(mode === "create" || !!startInEditMode);

  const meetingTypeOptions = [
    { value: 'in-person', label: 'In-person', icon: Building, className: 'bg-orange-50 text-orange-600' },
    { value: 'video-call', label: 'Video Call', icon: Video, className: 'bg-blue-50 text-blue-600' },
    { value: 'phone-call', label: 'Phone Call', icon: Phone, className: 'bg-purple-50 text-purple-600' },
  ];

  const priorityOptions = [
    { value: 'low', label: 'Low', icon: Flag, className: 'bg-green-50 text-green-600' },
    { value: 'medium', label: 'Medium', icon: Flag, className: 'bg-yellow-50 text-yellow-600' },
    { value: 'high', label: 'High', icon: Flag, className: 'bg-red-50 text-red-600' },
  ];

  const durationOptions = [
    { value: 15, label: '15 Mins', icon: Timer, className: 'bg-slate-50 text-slate-600' },
    { value: 30, label: '30 Mins', icon: Timer, className: 'bg-slate-50 text-slate-600' },
    { value: 60, label: '60 Mins', icon: Timer, className: 'bg-slate-50 text-slate-600' },
    { value: 90, label: '1.5 Hours', icon: Timer, className: 'bg-slate-50 text-slate-600' },
    { value: 120, label: '2 Hours', icon: Timer, className: 'bg-slate-50 text-slate-600' },
  ];

  const fetchCompanyDetails = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await API.get(`/companies/${companyId}`);
      setCompany(res.data);
    } catch (error) {
      console.error("Error fetching company details:", error);
    }
  }, [companyId]);

  const fetchMeetingsForDate = useCallback(async (date) => {
    try {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      const res = await API.get("/meetings", {
        params: {
          companyId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });
      setExistingMeetings(res.data.meetings || []);
    } catch (error) {
      console.error("Error fetching meetings:", error);
      setExistingMeetings([]);
    }
  }, [companyId]);

  const checkTimeConflict = useCallback((selectedDate, selectedTime, duration) => {
    if (!selectedDate || !selectedTime) return null;

    const selectedDateTime = new Date(selectedDate);
    const [hours, minutes] = selectedTime.split(':');
    selectedDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    const selectedStartTime = selectedDateTime.getTime();
    const selectedEndTime = selectedStartTime + (duration * 60 * 1000);

    for (const meeting of existingMeetings) {
      if (mode === "view" && isEditMode && meeting._id === meetingData?._id) continue;

      const meetingStart = new Date(meeting.scheduledAt).getTime();
      const meetingEnd = meetingStart + (meeting.duration * 60 * 1000);

      if (
        (selectedStartTime >= meetingStart && selectedStartTime < meetingEnd) ||
        (selectedEndTime > meetingStart && selectedEndTime <= meetingEnd) ||
        (selectedStartTime <= meetingStart && selectedEndTime >= meetingEnd)
      ) {
        return {
          conflictWith: meeting,
          message: `Conflicts with "${meeting.title}" (${new Date(meeting.scheduledAt).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })} - ${new Date(meetingEnd).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })})`
        };
      }
    }
    return null;
  }, [existingMeetings, mode, isEditMode, meetingData]);

  // Initialize form when modal opens
  useEffect(() => {
    if (open) {
      setShouldRender(true);
      setTimeout(() => setIsSliding(true), 10);
      fetchCompanyDetails();

      if (meetingData && mode === "view") {
        const initialFormData = {
          ...meetingData,
          date: meetingData?.scheduledAt ? new Date(meetingData?.scheduledAt).toISOString().slice(0, 10) : "",
          time: meetingData?.scheduledAt ? new Date(meetingData?.scheduledAt).toISOString().slice(11, 16) : "09:00",
          participants: meetingData.participants?.map(p => p._id || p) || [],
        };
        setForm(initialFormData);

        // Fetch meetings for the selected date
        if (initialFormData.date) {
          fetchMeetingsForDate(new Date(initialFormData.date));
        }
      } else {
        const initialFormData = {
          ...initialState,
          date: calendarDate,
        };
        setForm(initialFormData);

        // Fetch meetings for calendar date if provided
        if (calendarDate) {
          fetchMeetingsForDate(calendarDate);
        }
      }

      setErrors({});
      setIsEditMode(mode === "create" || !!startInEditMode);
    } else {
      setIsSliding(false);
      setTimeout(() => setShouldRender(false), 300);
      setTimeConflict(null);
    }
  }, [open, meetingData, mode, calendarDate, fetchMeetingsForDate, startInEditMode]);

  const handleChange = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));

    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: null }));
    }

    if (key === 'date' || key === 'time' || key === 'duration') {
      const newDate = key === 'date' ? val : form.date || (calendarDate);
      const newTime = key === 'time' ? val : form.time;
      const newDuration = key === 'duration' ? val : form.duration;

      if (key === 'date' && val) {
        fetchMeetingsForDate(new Date(val));
      }

      if (newDate) {
        setTimeout(() => {
          const conflict = checkTimeConflict(newDate, newTime, newDuration);
          setTimeConflict(conflict);
        }, 100);
      }
    }
  };

  const getSuggestedTimes = () => {
    const selectedDate = form.date || (calendarDate);
    if (!selectedDate) return [];

    const suggestions = [];
    const businessHours = Array.from({ length: 10 }, (_, i) => 9 + i);

    for (const hour of businessHours) {
      const timeSlots = ['00', '30'];
      for (const minutes of timeSlots) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minutes}`;
        const conflict = checkTimeConflict(selectedDate, timeString, form.duration);
        if (!conflict) {
          suggestions.push(timeString);
        }
      }
    }

    return suggestions.slice(0, 4);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!form.title?.trim()) newErrors.title = "Meeting title is required";
    if (!form.date && !calendarDate) newErrors.date = "Date is required";
    if (form.participants.length === 0) newErrors.participants = "At least one participant is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getScheduledAt = () => {
    const date = new Date(form.date || calendarDate);
    const [h, m] = form.time.split(":").map(Number);
    date.setHours(h, m, 0, 0);
    return date.toISOString();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the errors before submitting");
      return;
    }

    const dateForValidation = form.date || (calendarDate);
    const conflict = checkTimeConflict(dateForValidation, form.time, form.duration);
    if (conflict) {
      toast.error(`Cannot schedule meeting: ${conflict.message}`);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        scheduledAt: getScheduledAt(),
        companyId,
        linkedTo: "company",
      };

      if (isEditMode && mode === "view") {
        await API.put(`/meetings/${meetingData._id}`, payload);
        toast.success("Meeting updated successfully");
      } else {
        if (onSave) {
          await onSave(payload);
        } else {
          await API.post("/meetings", payload);
          toast.success("Meeting scheduled successfully");
        }
      }
      onClose();
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || (isEditMode && mode === "view" ? "Failed to update meeting" : "Failed to schedule meeting"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(meetingData._id);
      toast.success("Meeting deleted successfully");
      onClose();
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to delete meeting");
      }
    }
  };

  if (!shouldRender) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[10000] transition-opacity duration-300"
        style={{ opacity: isSliding ? 1 : 0 }}
        onClick={onClose}
      />
      <div
        className={`fixed inset-0 flex items-center justify-center z-[10001] p-4 transition-all duration-300 ${isSliding ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-900">
              Add New Meeting
            </h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Form Body */}
          <div className="flex-1 overflow-y-auto">
            <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row h-full">
              {/* Left Column: Content */}
              <div className="flex-1 p-6 space-y-8 border-r border-gray-100">
                <div className="space-y-4">
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => handleChange("title", e.target.value)}
                    className={`w-full text-3xl font-bold border-none bg-transparent placeholder-gray-300 focus:outline-none focus:ring-0 ${errors.title ? 'text-red-600' : 'text-gray-900'
                      }`}
                    placeholder="Meeting Title"
                    disabled={!isEditMode && mode === "view"}
                  />
                  {errors.title && <p className="text-xs text-red-500 font-medium">*{errors.title}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    rows={6}
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:border-blue-500 transition-all focus:outline-none resize-none text-sm text-gray-600"
                    placeholder="Description the task objectives, requirements and important details"
                    disabled={!isEditMode && mode === "view"}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Location</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => handleChange("location", e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:border-blue-500 transition-all focus:outline-none text-sm text-gray-600"
                    placeholder="Meeting Room Address"
                    disabled={!isEditMode && mode === "view"}
                  />
                </div>
              </div>

              {/* Right Column: Meta */}
              <div className="w-full lg:w-80 p-6 space-y-6 bg-white">
                {/* Meta Rows */}
                <div className="space-y-4">
                  {/* Entity Type */}
                  <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                      <User className="w-4 h-4" />
                      <span>Entity Type</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-900 text-sm font-medium">
                      <Building className="w-4 h-4 text-gray-400" />
                      <span className="capitalize">{company?.industry || "Company"}</span>
                    </div>
                  </div>

                  {/* Company Name */}
                  <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                      <Building className="w-4 h-4" />
                      <span>Company</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-900 text-sm font-medium">
                      <span className="truncate max-w-[150px]">{company?.name || "Company Name"}</span>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                      <Calendar className="w-4 h-4" />
                      <span>Date</span>
                    </div>
                    <input
                      type="date"
                      value={form.date || calendarDate || ""}
                      onChange={(e) => handleChange("date", e.target.value)}
                      disabled={!isEditMode && mode === "view"}
                      className="text-sm font-medium text-gray-900 border-none bg-transparent p-0 focus:ring-0 text-right cursor-pointer"
                    />
                  </div>

                  {/* Time */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                      <Clock className="w-4 h-4" />
                      <span>Time</span>
                    </div>
                    <input
                      type="time"
                      value={form.time}
                      onChange={(e) => handleChange("time", e.target.value)}
                      disabled={!isEditMode && mode === "view"}
                      className="text-sm font-medium text-gray-900 border-none bg-transparent p-0 focus:ring-0 text-right cursor-pointer"
                    />
                  </div>

                  {/* Duration */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                      <Timer className="w-4 h-4" />
                      <span>Duration</span>
                    </div>
                    <SingleSelectDropdown
                      options={durationOptions}
                      value={form.duration}
                      onChange={(val) => handleChange("duration", val)}
                      disabled={!isEditMode && mode === "view"}
                    />
                  </div>

                  {/* Meeting Type */}
                  <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4" />
                        <span>Meeting Type</span>
                      </div>
                    </div>
                    <SingleSelectDropdown
                      options={meetingTypeOptions}
                      value={form.meetingType}
                      onChange={(val) => handleChange("meetingType", val)}
                      disabled={!isEditMode && mode === "view"}
                    />
                  </div>

                  {/* Priority */}
                  <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                      <Flag className="w-4 h-4" />
                      <span>Priority</span>
                    </div>
                    <SingleSelectDropdown
                      options={priorityOptions}
                      value={form.priority}
                      onChange={(val) => handleChange("priority", val)}
                      disabled={!isEditMode && mode === "view"}
                    />
                  </div>

                  {/* Participants */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                      <Users className="w-4 h-4" />
                      <span>Participants</span>
                    </div>
                    <MultiSelectDropdown
                      users={users}
                      selectedUsers={form.participants}
                      onSelectionChange={(participants) => handleChange("participants", participants)}
                      placeholder="Add meeting participants"
                    />
                    {errors.participants && <p className="text-[10px] text-red-500 font-medium">{errors.participants}</p>}
                  </div>
                </div>

                {/* Conflict Alert in Right Column */}
                {timeConflict && (
                  <div className="pt-2">
                    <TimeConflictAlert
                      conflict={timeConflict}
                      suggestedTimes={getSuggestedTimes()}
                      onTimeSelect={(time) => handleChange("time", time)}
                    />
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <div>
              {mode === "view" && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all border border-gray-100 bg-white"
                  title="Delete Meeting"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              {(!isEditMode && mode === "view") ? (
                <button
                  onClick={() => setIsEditMode(true)}
                  className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  Edit Meeting
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading || timeConflict}
                  className={`px-8 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2 ${loading || timeConflict
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                    }`}
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      {isEditMode && mode === "view" ? "Save Changes" : "Schedule Meeting"}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export { ParticipantChip, MeetingTypeIcon, PriorityChip };
export default CompanyMeetingForm;