import React, { useState, useEffect } from "react";
import API from "../../services/api";
import toast from "react-hot-toast";
import {
  X,
  Calendar,
  Clock,
  User,
  Users,
  FileText,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Loader2,
  Edit3,
  Save,
  Plus,
  Building,
  ChevronDown,
  CheckCircle2 as CheckIcon,
  Timer,
  Flag,
  User as UserIcon,
} from "lucide-react";

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
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
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
                <div className={`p-1.5 rounded-lg ${option.className} border-none`}>
                  {option.icon && <option.icon className="w-3.5 h-3.5" />}
                </div>
                <span className="font-medium text-right flex-1">{option.label}</span>
                {value === option.value && <CheckIcon className="w-4 h-4 ml-auto text-blue-600" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const initialState = {
  title: "",
  dueDate: "",
  selectedDate: "",
  description: "",
  status: "Pending",
  priority: "medium", // Added local priority
  users: [],
};

const StatusBadge = ({ status }) => {
  const configs = {
    Pending: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
      icon: <Clock className="w-3 h-3" />,
    },
    Completed: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
  };

  const config = configs[status] || configs.Pending;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${config.bg} ${config.text} ${config.border}`}
    >
      {config.icon}
      {status}
    </div>
  );
};

const UserChip = ({ user, onRemove, isRemovable = false }) => (
  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-200">
    <User className="w-3 h-3" />
    <span>{user?.name || user?.email || "Unknown User"}</span>
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

const FormField = ({ label, required, children, error, description }) => (
  <div className="space-y-2">
    <label className="block text-sm font-semibold text-gray-900">
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
    {description && <p className="text-xs text-gray-500">{description}</p>}
    {error && (
      <p className="text-xs text-red-600 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        {error}
      </p>
    )}
  </div>
);

const CompanyTaskForm = ({
  open,
  mode,
  taskData,
  companyId,
  calendarDate,
  users,
  onSave,
  onDelete,
  onClose,
  onUpdate,
}) => {
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [isSliding, setIsSliding] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [errors, setErrors] = useState({});
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(mode === "create");
  const [company, setCompany] = useState(null);

  const statusOptions = [
    { value: 'Pending', label: 'Pending', icon: Clock, className: 'bg-amber-50 text-amber-600' },
    { value: 'Completed', label: 'Completed', icon: CheckIcon, className: 'bg-emerald-50 text-emerald-600' },
    { value: 'In Progress', label: 'In Progress', icon: Loader2, className: 'bg-blue-50 text-blue-600' },
  ];

  const priorityOptions = [
    { value: 'low', label: 'Low', icon: Flag, className: 'bg-green-50 text-green-600' },
    { value: 'medium', label: 'Medium', icon: Flag, className: 'bg-yellow-50 text-yellow-600' },
    { value: 'high', label: 'High', icon: Flag, className: 'bg-red-50 text-red-600' },
  ];

  const fetchCompanyDetails = async () => {
    if (!companyId) return;
    try {
      const res = await API.get(`/companies/${companyId}`);
      setCompany(res.data);
    } catch (error) {
      console.error("Error fetching company details:", error);
    }
  };

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      setTimeout(() => setIsSliding(true), 10);
      fetchCompanyDetails();

      if (taskData && mode === "view") {
        setForm({
          ...taskData,
          dueDate: taskData.dueDate
            ? new Date(taskData.dueDate).toISOString().split("T")[0]
            : "",
          selectedDate: taskData.selectedDate
            ? new Date(taskData.selectedDate).toISOString().split("T")[0]
            : "",
          users: taskData.users?.map((u) => u._id || u) || [],
          priority: taskData.priority || "medium",
        });
      } else {
        setForm({
          ...initialState,
          selectedDate: calendarDate,
        });
      }
      setErrors({});
      setIsEditMode(mode === "create");
    } else {
      setIsSliding(false);
      setTimeout(() => setShouldRender(false), 300);
      setShowUserSelector(false);
    }
  }, [open, mode, taskData, calendarDate, companyId]);

  const handleChange = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!form.title?.trim()) newErrors.title = "Task title is required";
    if (!form.dueDate) newErrors.dueDate = "Due date is required";
    if (!calendarDate && !form.selectedDate)
      newErrors.selectedDate = "Selected date is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUserSelection = (userId) => {
    const currentUsers = form.users || [];
    if (currentUsers.includes(userId)) {
      setForm((f) => ({
        ...f,
        users: currentUsers.filter((id) => id !== userId),
      }));
    } else {
      setForm((f) => ({
        ...f,
        users: [...currentUsers, userId],
      }));
    }
  };

  const removeUser = (userId) => {
    setForm((f) => ({
      ...f,
      users: f.users.filter((id) => id !== userId),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the errors before submitting");
      return;
    }

    setLoading(true);

    try {
      const createLocalDate = (dateString) => {
        if (!dateString) return null;
        const [year, month, day] = dateString.split("-");
        // Create date at noon UTC to avoid timezone issues
        return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      };

      // Convert to new relatedEntities array format
      const payload = {
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority, // Added to payload
        users: form.users,
        dueDate: createLocalDate(form.dueDate),
        selectedDate: calendarDate || createLocalDate(form.selectedDate),
        relatedEntities: [
          {
            entityModel: "Company",
            entityId: companyId,
          },
        ],
      };

      if (isEditMode && mode === "view") {
        await API.put(`/tasks/${taskData._id}`, payload);
        onUpdate();
        toast.success("Task updated successfully");
      } else {
        await onSave(payload);
        toast.success("Task saved successfully");
      }
      onClose();
    } catch (err) {
      console.error("Error saving task:", err);
      const errorMessage =
        err.response?.data?.error ||
        (isEditMode && mode === "view"
          ? "Failed to update task"
          : "Failed to save task");
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await onDelete(taskData._id);
      toast.success("Task deleted successfully");
      onClose();
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to delete task");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (!shouldRender) return null;

  const assignedUsers =
    form.users
      ?.map((userId) => users?.find((u) => u._id === userId))
      .filter(Boolean) || [];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[10000] transition-all duration-300"
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
              Add New Task
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
                    placeholder="Task Title"
                    disabled={!isEditMode && mode === "view"}
                  />
                  {errors.title && <p className="text-xs text-red-500 font-medium">*{errors.title}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    rows={8}
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:border-blue-500 transition-all focus:outline-none resize-none text-sm text-gray-600"
                    placeholder="Description the task objectives, requirements and important details"
                    disabled={!isEditMode && mode === "view"}
                  />
                </div>
              </div>

              {/* Right Column: Meta */}
              <div className="w-full lg:w-80 p-6 space-y-6 bg-white">
                <div className="space-y-4">
                  {/* Related to */}
                  <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                      <UserIcon className="w-4 h-4" />
                      <span>Related to</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-900 text-sm font-medium">
                      <Building className="w-4 h-4 text-gray-400" />
                      <span className="truncate max-w-[150px]">{company?.name || "Company Name"}</span>
                    </div>
                  </div>

                  {/* Selected Date (Start Date) */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                      <Calendar className="w-4 h-4" />
                      <span>Selected Date</span>
                    </div>
                    <input
                      type="date"
                      value={form.selectedDate || calendarDate || ""}
                      onChange={(e) => handleChange("selectedDate", e.target.value)}
                      disabled={!isEditMode && mode === "view"}
                      className="text-sm font-medium text-gray-900 border-none bg-transparent p-0 focus:ring-0 text-right cursor-pointer"
                    />
                  </div>

                  {/* Due Date (End Date) */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                      <Calendar className="w-4 h-4" />
                      <span>Due Date</span>
                    </div>
                    <input
                      type="date"
                      value={form.dueDate}
                      onChange={(e) => handleChange("dueDate", e.target.value)}
                      disabled={!isEditMode && mode === "view"}
                      className="text-sm font-medium text-gray-900 border-none bg-transparent p-0 focus:ring-0 text-right cursor-pointer"
                    />
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                      <Timer className="w-4 h-4" />
                      <span>Status</span>
                    </div>
                    <SingleSelectDropdown
                      options={statusOptions}
                      value={form.status}
                      onChange={(val) => handleChange("status", val)}
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

                  {/* Assignees */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                      <Users className="w-4 h-4" />
                      <span>Assignees</span>
                    </div>

                    {/* User chips and selector */}
                    <div className="space-y-2 relative">
                      {assignedUsers.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {assignedUsers.map(user => (
                            <div key={user._id} className="w-6 h-6 rounded-full overflow-hidden border-2 border-white ring-1 ring-gray-100 flex items-center justify-center bg-gray-100" title={user.name}>
                              <UserIcon className="w-3 h-3 text-gray-400" />
                            </div>
                          ))}
                        </div>
                      )}

                      {isEditMode && (
                        <button
                          type="button"
                          onClick={() => setShowUserSelector(!showUserSelector)}
                          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs hover:bg-gray-100 transition-colors focus:outline-none"
                        >
                          <span className="text-gray-500">Select Users</span>
                          <Plus className="w-3 h-3 text-gray-400" />
                        </button>
                      )}

                      {showUserSelector && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowUserSelector(false)}
                          />
                          <div className="absolute z-50 left-0 right-0 bottom-full mb-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto p-2 space-y-1 animate-in fade-in slide-in-from-bottom-2">
                            {users?.map((user) => (
                              <label
                                key={user._id}
                                className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={form.users?.includes(user._id)}
                                  onChange={() => handleUserSelection(user._id)}
                                  className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-xs font-medium text-gray-700 truncate">{user.name || user.email}</span>
                              </label>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
            {mode === "view" && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all border border-gray-100 bg-white mr-auto"
                title="Delete Task"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}

            {!isEditMode && mode === "view" && (
              <button
                type="button"
                onClick={() => setIsEditMode(true)}
                className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-all border border-gray-100 bg-white"
                title="Edit Task"
              >
                <Edit3 className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={onClose}
              className="px-6 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
            >
              Cancel
            </button>

            {isEditMode && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {mode === "create" ? "Create Task" : "Update Task"}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export { StatusBadge, UserChip };
export default CompanyTaskForm;
