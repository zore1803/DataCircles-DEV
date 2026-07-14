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
  Building2,
  Truck,
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
  linkedTo: "",
  contactId: null,
  companyId: null,
  vendorId: null,
};

const PriorityChip = ({ priority }) => {
  const colors = {
    low: {
      bg: "bg-green-50",
      text: "text-green-700",
      border: "border-green-200",
    },
    medium: {
      bg: "bg-yellow-50",
      text: "text-yellow-700",
      border: "border-yellow-200",
    },
    high: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  };
  const color = colors[priority] || colors.medium;

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 ${color.bg} ${color.text} rounded-lg text-sm font-medium ${color.border}`}
    >
      <Flag className="w-3 h-3" />
      <span className="capitalize">{priority}</span>
    </div>
  );
};

const ParticipantChip = ({ user, onRemove, isRemovable = false }) => (
  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-200">
    <User className="w-3 h-3" />
    <span>{user?.name || "Unknown"}</span>
    {isRemovable && onRemove && (
      <button
        onClick={onRemove}
        className="hover:bg-blue-100 rounded-full p-0.5"
      >
        <X className="w-3 h-3" />
      </button>
    )}
  </div>
);

const EntitySelector = ({ value, onChange, entities, entityType }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const getIcon = () => {
    switch (entityType) {
      case "contact":
        return <User className="w-4 h-4" />;
      case "company":
        return <Building2 className="w-4 h-4" />;
      case "vendor":
        return <Truck className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const filteredEntities = entities.filter((entity) =>
    entity.name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const selectedEntity = entities.find((e) => e._id === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-xl text-left hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <div className="flex items-center gap-2">
          {getIcon()}
          <span className={selectedEntity ? "text-gray-900" : "text-gray-500"}>
            {selectedEntity ? selectedEntity.name : `Select ${entityType}`}
          </span>
        </div>
        <Search className="w-4 h-4 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-300 rounded-xl shadow-xl max-h-64 overflow-hidden">
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder={`Search ${entityType}s...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto p-2">
            {filteredEntities.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {getIcon()}
                <p className="text-sm mt-2">No {entityType}s found</p>
              </div>
            ) : (
              filteredEntities.map((entity) => (
                <button
                  key={entity._id}
                  type="button"
                  onClick={() => {
                    onChange(entity._id);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors text-left"
                >
                  {getIcon()}
                  <span className="text-sm font-medium text-gray-700">
                    {entity.name}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const MultiSelectDropdown = ({
  users,
  selectedUsers,
  onSelectionChange,
  isLoading,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredUsers = users.filter((user) =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleUserToggle = (userId) => {
    const updatedSelection = selectedUsers.includes(userId)
      ? selectedUsers.filter((id) => id !== userId)
      : [...selectedUsers, userId];
    onSelectionChange(updatedSelection);
  };

  const selectedUsersList = users.filter((user) =>
    selectedUsers.includes(user._id),
  );

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
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-xl text-left hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-gray-400" />
          <span
            className={
              selectedUsers.length === 0 ? "text-gray-500" : "text-gray-900"
            }
          >
            {isLoading
              ? "Loading contacts..."
              : selectedUsers.length === 0
                ? "Add participants"
                : `${selectedUsers.length} participant(s) selected`}
          </span>
        </div>
        <Users className="w-4 h-4 text-gray-400" />
      </button>

      {isOpen && (
        <div className="relative z-50 w-full mt-2 bg-white border border-gray-300 rounded-xl shadow-xl max-h-64 overflow-hidden">
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
          <div className="max-h-48 overflow-y-auto p-2">
            {filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No contacts found</p>
              </div>
            ) : (
              filteredUsers.map((user) => (
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
                    <span className="text-sm font-medium text-gray-700">
                      {user.name}
                    </span>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const FormField = ({
  label,
  required,
  children,
  error,
  description,
  icon: Icon,
}) => (
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

const MeetingTypeIcon = ({ type }) => {
  const icons = {
    "in-person": <Building className="w-4 h-4" />,
    "video-call": <Video className="w-4 h-4" />,
    "phone-call": <Phone className="w-4 h-4" />,
  };
  return icons[type] || icons["in-person"];
};

const AdminMeetingForm = ({
  open,
  mode,
  meetingData,
  calendarDate,
  users,
  contacts: allContacts,
  companies,
  vendors,
  onSave,
  onDelete,
  onClose,
}) => {
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [isSliding, setIsSliding] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [errors, setErrors] = useState({});
  const [isEditMode, setIsEditMode] = useState(false);

  // Company contacts state
  const [companyContacts, setCompanyContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Fetch company contacts when company is selected
  const fetchCompanyContacts = useCallback(async (companyId) => {
    if (!companyId) {
      setCompanyContacts([]);
      return;
    }

    setLoadingContacts(true);
    try {
      const response = await API.get(`/contacts/company/${companyId}`);
      setCompanyContacts(response.data || []);
    } catch (error) {
      console.error("Error fetching company contacts:", error);
      toast.error("Failed to load company contacts");
      setCompanyContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      setTimeout(() => setIsSliding(true), 10);

      if (meetingData && mode === "view") {
        const initialFormData = {
          ...meetingData,
          date: meetingData?.scheduledAt
            ? new Date(meetingData?.scheduledAt).toISOString().slice(0, 10)
            : "",
          time: meetingData?.scheduledAt
            ? new Date(meetingData?.scheduledAt).toISOString().slice(11, 16)
            : "09:00",
          participants: meetingData.participants?.map((p) => p._id || p) || [],
          linkedTo:
            meetingData.linkedTo ||
            (meetingData.contact
              ? "contact"
              : meetingData.company
                ? "company"
                : "vendor"),
          contactId: meetingData.contact?._id || meetingData.contact || null,
          companyId: meetingData.company?._id || meetingData.company || null,
          vendorId: meetingData.vendor?._id || meetingData.vendor || null,
        };
        setForm(initialFormData);
        setIsEditMode(false);

        // If it's a company meeting, fetch the company contacts
        if (
          initialFormData.linkedTo === "company" &&
          initialFormData.companyId
        ) {
          fetchCompanyContacts(initialFormData.companyId);
        }
      } else {
        const initialFormData = {
          ...initialState,
          date: calendarDate,
        };
        setForm(initialFormData);
        setIsEditMode(true);
      }

      setErrors({});
    } else {
      setIsSliding(false);
      setTimeout(() => setShouldRender(false), 300);
      setIsEditMode(false);
      setCompanyContacts([]);
    }
  }, [open, meetingData, mode, calendarDate, fetchCompanyContacts]);

  const handleChange = (key, val) => {
    setForm((f) => {
      const newForm = { ...f, [key]: val };

      // Reset entity IDs when linkedTo changes
      if (key === "linkedTo") {
        newForm.contactId = null;
        newForm.companyId = null;
        newForm.vendorId = null;
        newForm.participants = [];
        setCompanyContacts([]);
      }

      // Fetch company contacts when company is selected
      if (key === "companyId" && val) {
        fetchCompanyContacts(val);
        newForm.participants = []; // Reset participants when company changes
      }

      return newForm;
    });

    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.title?.trim()) newErrors.title = "Meeting title is required";
    if (!form.date && !calendarDate) newErrors.date = "Date is required";
    if (!form.linkedTo) newErrors.linkedTo = "Please select entity type";

    const entityId =
      form.linkedTo === "contact"
        ? form.contactId
        : form.linkedTo === "company"
          ? form.companyId
          : form.vendorId;
    if (!entityId) newErrors.entity = `Please select a ${form.linkedTo}`;

    // Participants required for company meetings
    if (form.linkedTo === "company" && form.participants.length === 0) {
      newErrors.participants =
        "At least one participant is required for company meetings";
    }

    setErrors(newErrors);
    console.log(newErrors)
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

    setLoading(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        duration: form.duration,
        priority: form.priority,
        meetingType: form.meetingType,
        location: form.location,
        linkedTo: form.linkedTo,
        scheduledAt: getScheduledAt(),
        participants: form.participants || [],
      };

      // Add entity IDs based on linkedTo
      if (form.linkedTo === "contact") {
        payload.contactId = form.contactId;
      } else if (form.linkedTo === "company") {
        payload.companyId = form.companyId;
      } else if (form.linkedTo === "vendor") {
        payload.vendorId = form.vendorId;
      }

      if (meetingData && mode === "view") {
        await API.put(`/meetings/${meetingData._id}`, payload);
        toast.success("Meeting updated successfully");
      } else {
        await onSave(payload);
      }
      onClose();
    } catch (err) {
      console.error("Error saving meeting:", err);
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(
          err.response?.data?.error ||
          (meetingData && mode === "view"
            ? "Failed to update meeting"
            : "Failed to schedule meeting"),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this meeting?")) {
      try {
        await onDelete(meetingData._id);
        onClose();
      } catch (err) {
        // Error handled by parent
      }
    }
  };

  const handleEdit = () => {
    setIsEditMode(true);
    // Fetch company contacts if it's a company meeting
    if (form.linkedTo === "company" && form.companyId) {
      fetchCompanyContacts(form.companyId);
    }
  };

  const handleCancelEdit = () => {
    if (meetingData) {
      const resetFormData = {
        ...meetingData,
        date: meetingData?.scheduledAt
          ? new Date(meetingData?.scheduledAt).toISOString().slice(0, 10)
          : "",
        time: meetingData?.scheduledAt
          ? new Date(meetingData?.scheduledAt).toISOString().slice(11, 16)
          : "09:00",
        participants: meetingData.participants?.map((p) => p._id || p) || [],
      };
      setForm(resetFormData);
    }
    setIsEditMode(false);
    setErrors({});
  };

  if (!shouldRender) return null;

  const isCreating = mode === "create" || !meetingData;
  const isViewing = mode === "view" && meetingData && !isEditMode;
  const isEditing = isEditMode && meetingData;

  const getEntityColor = () => {
    switch (form.linkedTo) {
      case "contact":
        return {
          from: "from-blue-50",
          to: "to-indigo-50",
          icon: "bg-blue-600",
        };
      case "company":
        return { from: "from-cyan-50", to: "to-blue-50", icon: "bg-cyan-600" };
      case "vendor":
        return {
          from: "from-purple-50",
          to: "to-indigo-50",
          icon: "bg-purple-600",
        };
      default:
        return { from: "from-gray-50", to: "to-gray-50", icon: "bg-gray-600" };
    }
  };

  const colors = getEntityColor();

  // Get participants list - use company contacts if company is selected
  const participantsList =
    form.linkedTo === "company" ? companyContacts : users || [];
  const selectedUsersList = participantsList.filter((user) =>
    form.participants.includes(user._id),
  );

  const getEntityName = () => {
    if (form.linkedTo === "contact") {
      return (
        allContacts?.find((c) => c._id === form.contactId)?.name ||
        "Unknown Contact"
      );
    } else if (form.linkedTo === "company") {
      return (
        companies?.find((c) => c._id === form.companyId)?.name ||
        "Unknown Company"
      );
    } else if (form.linkedTo === "vendor") {
      return (
        vendors?.find((v) => v._id === form.vendorId)?.name || "Unknown Vendor"
      );
    }
    return "";
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 transition-all duration-300"
      style={{ opacity: isSliding ? 1 : 0 }}
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-[900px] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col transform transition-transform duration-300 scale-100"
        style={{ transform: isSliding ? "scale(100%)" : "scale(95%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-900">
            {isCreating
              ? "Schedule New Meeting"
              : isViewing
                ? "Meeting Details"
                : "Edit Meeting"}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isViewing ? (
            /* VIEW MODE (Keep existing view mode logic but inside the new modal structure) */
            <div className="p-8 space-y-8">
              {/* ... (View mode content similar to before but adapted for modal) ... */}
              {/* For brevity, using the same view structure but cleaner */}
              <div className="space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                      {form.title}
                    </h2>
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                          form.priority === "high"
                            ? "bg-red-50 text-red-700"
                            : form.priority === "low"
                              ? "bg-green-50 text-green-700"
                              : "bg-yellow-50 text-yellow-700"
                        }`}
                      >
                        {form.priority.charAt(0).toUpperCase() +
                          form.priority.slice(1)}{" "}
                        Priority
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium capitalize">
                        {form.meetingType.replace("-", " ")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="col-span-2 space-y-6">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Description
                      </h4>
                      <p className="text-gray-700 whitespace-pre-line leading-relaxed text-lg">
                        {form.description || "No description provided."}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Location
                      </h4>
                      <div className="flex items-center gap-2 text-gray-900">
                        <MapPin className="w-5 h-5 text-gray-400" />
                        <span className="text-lg">
                          {form.location || "No location specified"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 bg-gray-50 p-6 rounded-xl">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                        Date & Time
                      </h4>
                      <p className="text-xl font-bold text-gray-900">
                        {new Date(meetingData?.scheduledAt).toLocaleDateString(
                          "en-US",
                          { weekday: "short", month: "short", day: "numeric" },
                        )}
                      </p>
                      <p className="text-gray-600">
                        {form.time} ({form.duration} mins)
                      </p>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                        Participants
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedUsersList.length > 0 ? (
                          selectedUsersList.map((u) => (
                            <div
                              key={u._id}
                              className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-gray-200 shadow-sm"
                            >
                              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                                {u.name.charAt(0)}
                              </div>
                              <span className="text-sm font-medium text-gray-700">
                                {u.name}
                              </span>
                            </div>
                          ))
                        ) : (
                          <span className="text-gray-500 italic">
                            No participants
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                        Related To
                      </h4>
                      <div className="flex items-center gap-2">
                        {form.linkedTo === "company" ? (
                          <Building2 className="w-4 h-4 text-gray-400" />
                        ) : form.linkedTo === "contact" ? (
                          <User className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Truck className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-gray-900 font-medium">
                          {getEntityName()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                {onDelete && (
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={handleEdit}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-colors"
                >
                  Edit Meeting
                </button>
              </div>
            </div>
          ) : (
            /* EDIT/CREATE MODE - The New Design */
            <form onSubmit={handleSubmit} className="flex flex-col h-full">
              <div className="flex-1 p-8">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 h-full">
                  {/* Left Column: Main Inputs */}
                  <div className="md:col-span-7 space-y-8">
                    <div>
                      <input
                        type="text"
                        value={form.title}
                        onChange={(e) => handleChange("title", e.target.value)}
                        placeholder="Meeting Title"
                        className="w-full text-3xl font-bold text-gray-900 placeholder:text-gray-300 border-none focus:ring-0 px-0 py-2 bg-transparent"
                        required
                        autoFocus
                      />
                      {errors.title && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors.title}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-900">
                        Description
                      </label>
                      <textarea
                        value={form.description}
                        onChange={(e) =>
                          handleChange("description", e.target.value)
                        }
                        placeholder="Description of task objectives, requirements and important details..."
                        className="w-full p-4 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 resize-none min-h-[120px] transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-900">
                        Location
                      </label>
                      <input
                        type="text"
                        value={form.location}
                        onChange={(e) =>
                          handleChange("location", e.target.value)
                        }
                        placeholder="Meeting Room Address or Link"
                        className="w-full p-3 rounded-xl border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
                      />
                    </div>
                  </div>

                  {/* Right Column: Details Config */}
                  <div className="md:col-span-5 space-y-1">
                    {/* Entity Type Selector Row */}
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <div className="flex items-center gap-2 text-gray-500">
                        <User className="w-4 h-4" />
                        <span className="text-sm font-medium">Entity Type</span>
                      </div>
                      <div className="w-[60%]">
                        <select
                          value={form.linkedTo}
                          onChange={(e) =>
                            handleChange("linkedTo", e.target.value)
                          }
                          className="w-full text-right text-sm font-medium text-gray-900 bg-transparent border-none focus:ring-0 cursor-pointer pr-0"
                        >
                          <option value="company">Company</option>
                          <option value="contact">Contact</option>
                          <option value="vendor">Vendor</option>
                        </select>
                      </div>
                    </div>

                    {/* Dynamic Entity Selector based on Type */}
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <div className="flex items-center gap-2 text-gray-500">
                        {form.linkedTo === "company" ? (
                          <Building2 className="w-4 h-4" />
                        ) : form.linkedTo === "contact" ? (
                          <User className="w-4 h-4" />
                        ) : (
                          <Truck className="w-4 h-4" />
                        )}
                        <span className="text-sm font-medium capitalize">
                          {form.linkedTo} Name
                        </span>
                      </div>
                      <div className="w-[60%] flex justify-end">
                        {/* We reuse EntitySelector but style it minimally if possible, or keep it functional. 
                                Since it uses a custom dropdown, we might wrap it to align right. 
                                For visual simplicity in this layout, let's use a standard select if list is simple, 
                                but EntitySelector is better for search. We'll stick to EntitySelector but maybe style it?
                                Actually, let's just put the EntitySelector here.
                            */}
                        <div className="w-full">
                          <EntitySelector
                            value={
                              form.linkedTo === "contact"
                                ? form.contactId
                                : form.linkedTo === "company"
                                  ? form.companyId
                                  : form.vendorId
                            }
                            onChange={(id) => {
                              if (form.linkedTo === "contact")
                                handleChange("contactId", id);
                              else if (form.linkedTo === "company")
                                handleChange("companyId", id);
                              else handleChange("vendorId", id);
                            }}
                            entities={
                              form.linkedTo === "contact"
                                ? allContacts
                                : form.linkedTo === "company"
                                  ? companies
                                  : vendors
                            }
                            entityType={form.linkedTo}
                          />
                          {errors.entity && (
                            <p className="text-xs text-red-500 text-right mt-1">
                              {errors.entity}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm font-medium">Date</span>
                      </div>
                      <input
                        type="date"
                        value={form.date}
                        onChange={(e) => handleChange("date", e.target.value)}
                        className="text-right text-sm font-medium text-gray-900 bg-transparent border-none focus:ring-0 p-0"
                        required
                      />
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-medium">Time</span>
                      </div>
                      <input
                        type="time"
                        value={form.time}
                        onChange={(e) => handleChange("time", e.target.value)}
                        className="text-right text-sm font-medium text-gray-900 bg-transparent border-none focus:ring-0 p-0"
                        required
                      />
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Timer className="w-4 h-4" />
                        <span className="text-sm font-medium">Duration</span>
                      </div>
                      <select
                        value={form.duration}
                        onChange={(e) =>
                          handleChange("duration", parseInt(e.target.value))
                        }
                        className="text-right text-sm font-medium text-gray-900 bg-transparent border-none focus:ring-0 cursor-pointer pr-0"
                      >
                        <option value={15}>15 Mins</option>
                        <option value={30}>30 Mins</option>
                        <option value={60}>60 Mins</option>
                        <option value={90}>90 Mins</option>
                        <option value={120}>2 Hours</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Video className="w-4 h-4" />
                        <span className="text-sm font-medium">
                          Meeting Type
                        </span>
                      </div>
                      <select
                        value={form.meetingType}
                        onChange={(e) =>
                          handleChange("meetingType", e.target.value)
                        }
                        className="text-right text-sm font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-md border-none focus:ring-0 cursor-pointer"
                      >
                        <option value="in-person">In-person</option>
                        <option value="video-call">Video Call</option>
                        <option value="phone-call">Phone Call</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Flag className="w-4 h-4" />
                        <span className="text-sm font-medium">Priority</span>
                      </div>
                      <select
                        value={form.priority}
                        onChange={(e) =>
                          handleChange("priority", e.target.value)
                        }
                        className={`text-right text-sm font-medium px-3 py-1 rounded-full border-none focus:ring-0 cursor-pointer appearance-none ${
                          form.priority === "high"
                            ? "bg-red-100 text-red-600"
                            : form.priority === "medium"
                              ? "bg-yellow-100 text-yellow-600"
                              : "bg-green-100 text-green-600"
                        }`}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>

                    {form.linkedTo === "company" && (
                      <div className="py-3 border-b border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-gray-500">
                            <Users className="w-4 h-4" />
                            <span className="text-sm font-medium">
                              Participants
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">
                            {form.participants.length} selected
                          </span>
                        </div>
                        {form.companyId ? (
                          <MultiSelectDropdown
                            users={companyContacts}
                            selectedUsers={form.participants}
                            onSelectionChange={(participants) =>
                              handleChange("participants", participants)
                            }
                            isLoading={loadingContacts}
                          />
                        ) : (
                          <p className="text-xs text-gray-400 italic text-right">
                            Select a company first
                          </p>
                        )}
                        {errors.participants && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors.participants}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-8 py-5 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
                {onDelete && isEditing ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                    title="Delete Meeting"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                ) : (
                  <div></div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={isEditing ? handleCancelEdit : onClose}
                    className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors border border-gray-300 bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2"
                  >
                    {loading
                      ? "Saving..."
                      : isEditing
                        ? "Update Meeting"
                        : "Schedule Meeting"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export { PriorityChip, MeetingTypeIcon, ParticipantChip };
export default AdminMeetingForm;

// import React, { useState, useEffect } from "react";
// import API from "../../services/api";
// import toast from "react-hot-toast";
// import {
//   X,
//   Calendar,
//   ChevronDown,
//   Bold,
//   Italic,
//   Strikethrough,
//   Underline,
//   Link as LinkIcon,
//   List,
//   ListOrdered,
//   Quote,
//   Type,
//   Video,
//   User,
//   Building2,
//   Truck,
//   MapPin,
//   Clock,
//   Bell,
//   Users,
//   UserPlus,
//   Briefcase,
//   Tag,
//   CheckSquare,
//   Globe,
//   AlertCircle,
//   Loader2,
// } from "lucide-react";

// const AdminMeetingForm = ({
//   open,
//   mode,
//   meetingData,
//   calendarDate,
//   users = [],
//   contacts = [],
//   companies = [],
//   vendors = [],
//   deals = [],
//   onSave,
//   onDelete,
//   onClose,
// }) => {
//   const currentUser = JSON.parse(localStorage.getItem("user"));

//   const [form, setForm] = useState({
//     title: "",
//     owner: currentUser?.id || "",
//     linkedTo: "contact",
//     relatedEntityId: "",
//     activeLinkType: null,
//     platformLinks: { googleMeet: "", msTeams: "", zoom: "" },
//     location: "",
//     startDate: calendarDate || new Date().toISOString().slice(0, 10),
//     startTime: "16:30",
//     endTime: "17:00",
//     reminder: "30 Min Before",
//     participants: [],
//     collaborators: [],
//     associations: [],
//     meetingType: "Business Development Meeting",
//     description: "",
//     doNotSendInvites: false,
//     createFollowUpTask: false,
//   });

//   const [loading, setLoading] = useState(false);
//   const [generatingLink, setGeneratingLink] = useState(false);
//   const [isSliding, setIsSliding] = useState(false);
//   const [shouldRender, setShouldRender] = useState(false);
//   const [isEditMode, setIsEditMode] = useState(false);

//   // Dropdown states
//   const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);
//   const [showRelatedDropdown, setShowRelatedDropdown] = useState(false);
//   const [showAttendeesDropdown, setShowAttendeesDropdown] = useState(false);
//   const [showCollaboratorsDropdown, setShowCollaboratorsDropdown] =
//     useState(false);

//   // Ensure owner is always set when users list is available
//   useEffect(() => {
//     if (users.length > 0 && !form.owner) {
//       // Set to first user or current user if available
//       const defaultOwner = currentUser?.id || users[0]?._id;
//       if (defaultOwner) handleChange("owner", defaultOwner);
//     }
//   }, [users]);

//   useEffect(() => {
//     if (open) {
//       setShouldRender(true);
//       setTimeout(() => setIsSliding(true), 10);
//       setIsEditMode(mode === "view" ? false : true);

//       if (meetingData && mode === "view") {
//         const start = new Date(meetingData.scheduledAt);
//         const end = meetingData.endDate
//           ? new Date(meetingData.endDate)
//           : new Date(start.getTime() + (meetingData.duration || 30) * 60000);
//         setForm({
//           ...meetingData,
//           owner: meetingData.owner || currentUser?.id,
//           startDate: start.toISOString().slice(0, 10),
//           startTime: start.toTimeString().slice(0, 5),
//           endTime: end.toTimeString().slice(0, 5),
//           relatedEntityId:
//             meetingData.contact?._id ||
//             meetingData.company?._id ||
//             meetingData.vendor?._id ||
//             "",
//           participants: meetingData.participants?.map((p) => p._id || p) || [],
//           collaborators:
//             meetingData.collaborators?.map((c) => c._id || c) || [],
//         });
//       }
//     } else {
//       setIsSliding(false);
//       setTimeout(() => setShouldRender(false), 300);
//     }
//   }, [open, meetingData, mode, calendarDate]);

//   useEffect(() => {
//     if (form.linkedTo === "contact" && form.relatedEntityId) {
//       const selectedContact = contacts.find(
//         (c) => c._id === form.relatedEntityId,
//       );
//       const newAssociations = [];
//       if (selectedContact?.company) {
//         newAssociations.push({
//           entityModel: "Company",
//           entityId: selectedContact.company._id || selectedContact.company,
//         });
//       }
//       const relatedDeals = deals.filter(
//         (d) =>
//           d.contact === form.relatedEntityId ||
//           d.contact?._id === form.relatedEntityId,
//       );
//       relatedDeals.forEach((d) =>
//         newAssociations.push({ entityModel: "Deal", entityId: d._id }),
//       );
//       setForm((prev) => ({ ...prev, associations: newAssociations }));
//     }
//   }, [form.relatedEntityId, form.linkedTo, contacts, deals]);

//   const handleChange = (key, val) =>
//     setForm((prev) => ({ ...prev, [key]: val }));

//   // Generate meeting link via API
//   const generateLink = async (platform) => {
//     if (!form.title) {
//       toast.error("Please enter a meeting title first");
//       return;
//     }
//     setGeneratingLink(true);
//     try {
//       const startDateTime = new Date(`${form.startDate}T${form.startTime}:00`);
//       const endDateTime = new Date(`${form.startDate}T${form.endTime}:00`);
//       const response = await API.post("/meetings/generate-link", {
//         platform,
//         title: form.title,
//         startDateTime: startDateTime.toISOString(),
//         endDateTime: endDateTime.toISOString(),
//         attendees: form.participants.map((pId) => {
//           const contact = contacts.find((c) => c._id === pId);
//           return { email: contact?.email };
//         }),
//       });
//       const link = response.data.link;
//       if (link) {
//         // Store the link in platformLinks and also optionally append to location
//         setForm((prev) => ({
//           ...prev,
//           platformLinks: { ...prev.platformLinks, [`${platform}Meet`]: link },
//           location: link, // or keep separate; we'll put in location for simplicity
//         }));
//         toast.success(`${platform} link generated successfully`);
//       } else {
//         toast.error(`Failed to generate ${platform} link`);
//       }
//     } catch (err) {
//       console.error(err);
//       toast.error(
//         err.response?.data?.error || `Could not generate ${platform} link`,
//       );
//     } finally {
//       setGeneratingLink(false);
//     }
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     // Validate owner
//     if (!form.owner) {
//       toast.error("Owner is required");
//       return;
//     }
//     setLoading(true);
//     const payload = {
//       title: form.title,
//       owner: form.owner,
//       linkedTo: form.linkedTo,
//       relatedEntityId: form.relatedEntityId,
//       activeLinkType: form.activeLinkType,
//       location: form.location,
//       startDate: form.startDate,
//       startTime: form.startTime,
//       endTime: form.endTime,
//       reminder: form.reminder,
//       participants: form.participants,
//       collaborators: form.collaborators,
//       associations: form.associations,
//       meetingType: form.meetingType,
//       description: form.description,
//       doNotSendInvites: form.doNotSendInvites,
//       createFollowUpTask: form.createFollowUpTask,
//     };
//     try {
//       if (meetingData && mode === "view") {
//         await API.put(`/meetings/${meetingData._id}`, payload);
//         toast.success("Meeting updated");
//       } else {
//         await onSave(payload);
//       }
//       onClose();
//     } catch (err) {
//       console.error(err);
//       toast.error(err.response?.data?.error || "Failed to save meeting");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const getEntityName = (id, type) => {
//     if (type === "user")
//       return users.find((u) => u._id === id)?.name || "Select User";
//     if (type === "contact")
//       return contacts.find((c) => c._id === id)?.name || "Select Contact";
//     if (type === "company")
//       return companies.find((c) => c._id === id)?.name || "Select Company";
//     return "";
//   };

//   if (!shouldRender) return null;

//   return (
//     <div
//       className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 font-sans transition-all duration-300 ${
//         isSliding ? "opacity-100" : "opacity-0"
//       }`}
//       onClick={onClose}
//     >
//       <div
//         className={`bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[95vh] overflow-hidden transform transition-all duration-300 ${
//           isSliding ? "scale-100" : "scale-95"
//         }`}
//         onClick={(e) => e.stopPropagation()}
//       >
//         {/* Header */}
//         <div className="px-6 py-5 flex justify-between items-center border-b border-gray-100 bg-gradient-to-r from-white to-gray-50/50">
//           <div>
//             <h2 className="text-xl font-bold text-gray-800 tracking-tight">
//               {mode === "create"
//                 ? "Add Meeting"
//                 : isEditMode
//                   ? "Edit Meeting"
//                   : "Meeting Details"}
//             </h2>
//             <p className="text-xs text-gray-500 mt-0.5">
//               Schedule and manage client meetings
//             </p>
//           </div>
//           <button
//             onClick={onClose}
//             className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full p-2 transition-all duration-200"
//           >
//             <X className="w-5 h-5" />
//           </button>
//         </div>

//         {/* Scrollable Body */}
//         <div className="flex-1 overflow-y-auto px-8 py-6 space-y-7 custom-scrollbar">
//           {/* Title */}
//           <div>
//             <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
//               Meeting Title
//             </label>
//             <input
//               type="text"
//               value={form.title}
//               onChange={(e) => handleChange("title", e.target.value)}
//               placeholder="e.g., Staff meeting & Review to discuss issue"
//               className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
//               disabled={!isEditMode}
//             />
//           </div>

//           {/* Two column layout for Owner & Related */}
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//             {/* Owner */}
//             <div className="relative">
//               <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
//                 Owner
//               </label>
//               <div
//                 className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 cursor-pointer flex justify-between items-center bg-white hover:border-gray-300 transition-all"
//                 onClick={() =>
//                   isEditMode && setShowOwnerDropdown(!showOwnerDropdown)
//                 }
//               >
//                 <span>{getEntityName(form.owner, "user")}</span>
//                 {form.owner && (
//                   <X
//                     className="w-4 h-4 text-gray-300 hover:text-gray-500"
//                     onClick={(e) => {
//                       e.stopPropagation();
//                       handleChange("owner", "");
//                     }}
//                   />
//                 )}
//               </div>
//               {showOwnerDropdown && (
//                 <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto animate-fadeIn">
//                   {users.map((u) => (
//                     <div
//                       key={u._id}
//                       onClick={() => {
//                         handleChange("owner", u._id);
//                         setShowOwnerDropdown(false);
//                       }}
//                       className="px-4 py-2.5 text-sm hover:bg-gray-50 cursor-pointer transition-colors"
//                     >
//                       {u.name}
//                     </div>
//                   ))}
//                 </div>
//               )}
//             </div>

//             {/* Related To */}
//             <div className="relative">
//               <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
//                 Related to
//               </label>
//               <div className="flex gap-3 mb-2">
//                 {["contact", "company", "vendor"].map((type) => (
//                   <button
//                     key={type}
//                     type="button"
//                     onClick={() => isEditMode && handleChange("linkedTo", type)}
//                     className={`text-xs font-medium px-3 py-1 rounded-full transition-all ${
//                       form.linkedTo === type
//                         ? "bg-blue-100 text-blue-700 border border-blue-200"
//                         : "text-gray-500 hover:bg-gray-100"
//                     }`}
//                     disabled={!isEditMode}
//                   >
//                     {type.charAt(0).toUpperCase() + type.slice(1)}
//                   </button>
//                 ))}
//               </div>
//               <div
//                 className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 cursor-pointer flex justify-between items-center bg-white hover:border-gray-300"
//                 onClick={() =>
//                   isEditMode && setShowRelatedDropdown(!showRelatedDropdown)
//                 }
//               >
//                 <span>
//                   {getEntityName(form.relatedEntityId, form.linkedTo) ||
//                     `Select ${form.linkedTo}`}
//                 </span>
//                 {form.relatedEntityId && (
//                   <X
//                     className="w-4 h-4 text-gray-300 hover:text-gray-500"
//                     onClick={(e) => {
//                       e.stopPropagation();
//                       handleChange("relatedEntityId", "");
//                     }}
//                   />
//                 )}
//               </div>
//               {showRelatedDropdown && (
//                 <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
//                   {(form.linkedTo === "contact"
//                     ? contacts
//                     : form.linkedTo === "company"
//                       ? companies
//                       : vendors
//                   ).map((item) => (
//                     <div
//                       key={item._id}
//                       onClick={() => {
//                         handleChange("relatedEntityId", item._id);
//                         setShowRelatedDropdown(false);
//                       }}
//                       className="px-4 py-2.5 text-sm hover:bg-gray-50 cursor-pointer flex items-center gap-2"
//                     >
//                       {form.linkedTo === "contact" && (
//                         <User className="w-4 h-4 text-gray-400" />
//                       )}
//                       {form.linkedTo === "company" && (
//                         <Building2 className="w-4 h-4 text-gray-400" />
//                       )}
//                       {form.linkedTo === "vendor" && (
//                         <Truck className="w-4 h-4 text-gray-400" />
//                       )}
//                       {item.name}
//                     </div>
//                   ))}
//                 </div>
//               )}
//             </div>
//           </div>

//           {/* Where section with link generation */}
//           <div>
//             <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
//               Where
//             </label>
//             <div className="flex flex-wrap gap-3 mb-3">
//               {[
//                 {
//                   id: "google",
//                   label: "Google Meet",
//                   icon: (
//                     <div className="flex -space-x-1">
//                       <div className="w-2 h-2 rounded-full bg-blue-500"></div>
//                       <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
//                       <div className="w-2 h-2 rounded-full bg-green-500"></div>
//                     </div>
//                   ),
//                 },
//                 {
//                   id: "teams",
//                   label: "MS Teams",
//                   icon: <Video className="w-4 h-4 text-indigo-600" />,
//                 },
//                 {
//                   id: "zoom",
//                   label: "Zoom",
//                   icon: <Video className="w-4 h-4 text-blue-500" />,
//                 },
//               ].map((link) => (
//                 <button
//                   key={link.id}
//                   type="button"
//                   onClick={() => {
//                     handleChange("activeLinkType", link.id);
//                     generateLink(link.id);
//                   }}
//                   disabled={!isEditMode || generatingLink}
//                   className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
//                     form.activeLinkType === link.id
//                       ? "border-2 border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
//                       : "border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
//                   }`}
//                 >
//                   {generatingLink ? (
//                     <Loader2 className="w-4 h-4 animate-spin" />
//                   ) : (
//                     link.icon
//                   )}
//                   {link.label}
//                 </button>
//               ))}
//             </div>
//             {/* Show generated link if any */}
//             {form.location && form.location.startsWith("http") && (
//               <div className="mb-2 text-xs text-blue-600 break-all">
//                 Generated link:{" "}
//                 <a
//                   href={form.location}
//                   target="_blank"
//                   rel="noopener noreferrer"
//                 >
//                   {form.location}
//                 </a>
//               </div>
//             )}
//             <div className="relative">
//               <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
//               <input
//                 type="text"
//                 value={form.location}
//                 onChange={(e) => handleChange("location", e.target.value)}
//                 placeholder="Address or meeting link (e.g., 35, WF Park, New York)"
//                 className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
//                 disabled={!isEditMode}
//               />
//             </div>
//           </div>

//           {/* Date & Time row */}
//           <div>
//             <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
//               <div className="relative">
//                 <label className="text-[11px] font-semibold text-gray-500 uppercase block mb-1">
//                   Starting On
//                 </label>
//                 <div className="flex items-center border border-gray-200 rounded-xl px-3 py-2 bg-white">
//                   <Calendar className="w-4 h-4 text-gray-400 mr-2" />
//                   <input
//                     type="date"
//                     value={form.startDate}
//                     onChange={(e) => handleChange("startDate", e.target.value)}
//                     className="w-full text-sm focus:outline-none bg-transparent"
//                     disabled={!isEditMode}
//                   />
//                 </div>
//               </div>
//               <div>
//                 <label className="text-[11px] font-semibold text-gray-500 uppercase block mb-1">
//                   Start Time
//                 </label>
//                 <div className="flex items-center border border-gray-200 rounded-xl px-3 py-2 bg-white">
//                   <Clock className="w-4 h-4 text-gray-400 mr-2" />
//                   <input
//                     type="time"
//                     value={form.startTime}
//                     onChange={(e) => handleChange("startTime", e.target.value)}
//                     className="w-full text-sm focus:outline-none bg-transparent"
//                     disabled={!isEditMode}
//                   />
//                 </div>
//               </div>
//               <div>
//                 <label className="text-[11px] font-semibold text-gray-500 uppercase block mb-1">
//                   End Time
//                 </label>
//                 <div className="flex items-center border border-gray-200 rounded-xl px-3 py-2 bg-white">
//                   <Clock className="w-4 h-4 text-gray-400 mr-2" />
//                   <input
//                     type="time"
//                     value={form.endTime}
//                     onChange={(e) => handleChange("endTime", e.target.value)}
//                     className="w-full text-sm focus:outline-none bg-transparent"
//                     disabled={!isEditMode}
//                   />
//                 </div>
//               </div>
//               <div>
//                 <label className="text-[11px] font-semibold text-gray-500 uppercase block mb-1">
//                   Reminder
//                 </label>
//                 <div className="flex items-center border border-gray-200 rounded-xl px-3 py-2 bg-white">
//                   <Bell className="w-4 h-4 text-gray-400 mr-2" />
//                   <select
//                     value={form.reminder}
//                     onChange={(e) => handleChange("reminder", e.target.value)}
//                     className="w-full text-sm focus:outline-none bg-transparent"
//                     disabled={!isEditMode}
//                   >
//                     <option>15 Min Before</option>
//                     <option>30 Min Before</option>
//                     <option>1 Hour Before</option>
//                     <option>1 Day Before</option>
//                   </select>
//                 </div>
//               </div>
//             </div>
//             <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
//               <Globe className="w-3 h-3" /> Time Zone: (India, Sri Lanka Time)
//             </p>
//           </div>

//           {/* Attendees */}
//           <div className="relative">
//             <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
//               Attendees
//             </label>
//             <div
//               className="w-full min-h-[46px] px-3 py-2 border border-gray-200 rounded-xl flex items-center flex-wrap gap-2 cursor-text bg-white hover:border-gray-300 transition-all"
//               onClick={() => isEditMode && setShowAttendeesDropdown(true)}
//             >
//               {form.participants.map((pId) => (
//                 <span
//                   key={pId}
//                   className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 text-xs font-medium px-2.5 py-1 rounded-full"
//                 >
//                   <User className="w-3 h-3" />
//                   {getEntityName(pId, "contact")}
//                   {isEditMode && (
//                     <X
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         handleChange(
//                           "participants",
//                           form.participants.filter((id) => id !== pId),
//                         );
//                       }}
//                       className="w-3 h-3 text-blue-400 hover:text-blue-700 cursor-pointer"
//                     />
//                   )}
//                 </span>
//               ))}
//               {isEditMode && (
//                 <input
//                   type="text"
//                   placeholder="Candidates, Contact, Users"
//                   readOnly
//                   className="flex-1 min-w-[150px] text-sm focus:outline-none text-gray-400 placeholder:text-gray-300"
//                 />
//               )}
//             </div>
//             {showAttendeesDropdown && isEditMode && (
//               <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto animate-fadeIn">
//                 {contacts.map((c) => (
//                   <div
//                     key={c._id}
//                     onClick={() => {
//                       if (!form.participants.includes(c._id))
//                         handleChange("participants", [
//                           ...form.participants,
//                           c._id,
//                         ]);
//                       setShowAttendeesDropdown(false);
//                     }}
//                     className="px-4 py-2.5 text-sm hover:bg-gray-50 cursor-pointer flex items-center gap-2"
//                   >
//                     <User className="w-4 h-4 text-gray-400" />
//                     {c.name}
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>

//           {/* Collaborators */}
//           <div className="relative">
//             <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
//               Collaborators
//             </label>
//             <div
//               className="w-full min-h-[46px] px-3 py-2 border border-gray-200 rounded-xl flex items-center justify-between cursor-pointer bg-white hover:border-gray-300 transition-all"
//               onClick={() =>
//                 isEditMode &&
//                 setShowCollaboratorsDropdown(!showCollaboratorsDropdown)
//               }
//             >
//               <div className="flex flex-wrap gap-2">
//                 {form.collaborators.length > 0 ? (
//                   form.collaborators.map((cId) => (
//                     <span
//                       key={cId}
//                       className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-1 rounded-full"
//                     >
//                       <UserPlus className="w-3 h-3" />
//                       {getEntityName(cId, "user")}
//                       <X
//                         onClick={(e) => {
//                           e.stopPropagation();
//                           handleChange(
//                             "collaborators",
//                             form.collaborators.filter((id) => id !== cId),
//                           );
//                         }}
//                         className="w-3 h-3 text-gray-400 hover:text-gray-700 cursor-pointer"
//                       />
//                     </span>
//                   ))
//                 ) : (
//                   <span className="text-sm text-gray-400">Select Users</span>
//                 )}
//               </div>
//               <ChevronDown className="w-4 h-4 text-gray-400" />
//             </div>
//             {showCollaboratorsDropdown && isEditMode && (
//               <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
//                 {users.map((u) => (
//                   <div
//                     key={u._id}
//                     onClick={() => {
//                       if (!form.collaborators.includes(u._id))
//                         handleChange("collaborators", [
//                           ...form.collaborators,
//                           u._id,
//                         ]);
//                       setShowCollaboratorsDropdown(false);
//                     }}
//                     className="px-4 py-2.5 text-sm hover:bg-gray-50 cursor-pointer flex items-center gap-2"
//                   >
//                     <User className="w-4 h-4 text-gray-400" />
//                     {u.name}
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>

//           {/* Associations & Type */}
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//             <div>
//               <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
//                 Create associations
//               </label>
//               <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
//                 <span className="text-sm font-medium text-gray-700">
//                   {form.associations.length} Association(s) Auto-Linked
//                 </span>
//                 <Briefcase className="w-4 h-4 text-gray-400" />
//               </div>
//               {form.associations.length > 0 && (
//                 <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-2">
//                   {form.associations.map((assoc, idx) => (
//                     <span
//                       key={idx}
//                       className="bg-gray-100 px-2 py-0.5 rounded-full"
//                     >
//                       {assoc.entityModel}
//                     </span>
//                   ))}
//                 </div>
//               )}
//             </div>
//             <div>
//               <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
//                 Type
//               </label>
//               <select
//                 value={form.meetingType}
//                 onChange={(e) => handleChange("meetingType", e.target.value)}
//                 disabled={!isEditMode}
//                 className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
//               >
//                 <option>Business Development Meeting</option>
//                 <option>Client Check-in</option>
//                 <option>Product Demo</option>
//                 <option>Strategy Session</option>
//               </select>
//             </div>
//           </div>

//           {/* Rich Text Description */}
//           <div>
//             <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
//               Description
//             </label>
//             <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
//               <textarea
//                 rows="4"
//                 value={form.description}
//                 onChange={(e) => handleChange("description", e.target.value)}
//                 placeholder="Type a short description of the event for attendees."
//                 className="w-full p-4 text-sm focus:outline-none resize-none placeholder:text-gray-400 text-gray-700"
//                 disabled={!isEditMode}
//               />
//               <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 flex items-center gap-4 text-gray-500">
//                 <div className="flex items-center gap-2">
//                   <button type="button" className="hover:text-black font-bold">
//                     B
//                   </button>
//                   <button type="button" className="hover:text-black italic">
//                     I
//                   </button>
//                   <button
//                     type="button"
//                     className="hover:text-black line-through"
//                   >
//                     S
//                   </button>
//                   <button type="button" className="hover:text-black underline">
//                     U
//                   </button>
//                 </div>
//                 <div className="w-px h-4 bg-gray-300"></div>
//                 <div className="flex items-center gap-2">
//                   <button type="button" className="hover:text-black">
//                     <LinkIcon className="w-4 h-4" />
//                   </button>
//                   <button type="button" className="hover:text-black">
//                     <List className="w-4 h-4" />
//                   </button>
//                   <button type="button" className="hover:text-black">
//                     <ListOrdered className="w-4 h-4" />
//                   </button>
//                   <button type="button" className="hover:text-black">
//                     <Quote className="w-4 h-4" />
//                   </button>
//                 </div>
//                 <div className="w-px h-4 bg-gray-300"></div>
//                 <div className="flex items-center gap-2">
//                   <button
//                     type="button"
//                     className="hover:text-black flex items-center"
//                   >
//                     <Type className="w-4 h-4" />
//                     <ChevronDown className="w-3 h-3" />
//                   </button>
//                   <button
//                     type="button"
//                     className="hover:text-black flex items-center"
//                   >
//                     <div className="w-4 h-4 bg-gray-800 rounded-sm text-white flex items-center justify-center text-[10px] font-bold">
//                       A
//                     </div>
//                     <ChevronDown className="w-3 h-3" />
//                   </button>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Checkboxes */}
//           <div className="flex flex-wrap gap-6 pt-2 pb-1">
//             <label className="flex items-center gap-2 cursor-pointer group">
//               <input
//                 type="checkbox"
//                 checked={form.doNotSendInvites}
//                 onChange={(e) =>
//                   handleChange("doNotSendInvites", e.target.checked)
//                 }
//                 disabled={!isEditMode}
//                 className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
//               />
//               <span className="text-sm text-gray-700 font-medium group-hover:text-gray-900">
//                 Do not send calendar invites
//               </span>
//               <AlertCircle className="w-4 h-4 text-gray-400" />
//             </label>
//             <label className="flex items-center gap-2 cursor-pointer group">
//               <input
//                 type="checkbox"
//                 checked={form.createFollowUpTask}
//                 onChange={(e) =>
//                   handleChange("createFollowUpTask", e.target.checked)
//                 }
//                 disabled={!isEditMode}
//                 className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
//               />
//               <span className="text-sm text-gray-700 font-medium group-hover:text-gray-900">
//                 Create a follow up task
//               </span>
//             </label>
//           </div>
//         </div>

//         {/* Footer */}
//         <div className="px-8 py-5 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
//           <button
//             onClick={onClose}
//             type="button"
//             className="px-6 py-2.5 border border-gray-300 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-100 transition-all shadow-sm"
//           >
//             Close
//           </button>
//           {isEditMode ? (
//             <button
//               onClick={handleSubmit}
//               disabled={loading}
//               className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md disabled:opacity-50"
//             >
//               {loading
//                 ? "Saving..."
//                 : meetingData
//                   ? "Save Changes"
//                   : "Add Meeting"}
//             </button>
//           ) : (
//             <button
//               onClick={() => setIsEditMode(true)}
//               className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md"
//             >
//               Edit Meeting
//             </button>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// };

// export default AdminMeetingForm;
