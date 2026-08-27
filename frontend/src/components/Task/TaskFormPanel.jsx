import React, { useEffect, useState, useRef } from "react";
import API from "../../services/api";
import toast from "react-hot-toast";
import {
  X,
  Timer,
  Flag,
  Plus,
  Search,
  ChevronDown,
  Clock,
  Loader2,
  CheckCircle2 as CheckIcon,
  User as UserIcon,
  Building2,
  Truck,
  Briefcase,
  Trash2,
} from "lucide-react";
import QuickCompanyForm from "../company/QuickCompanyForm";
import QuickContactForm from "../contact/QuickContactForm";
import QuickDealForm from "../deal/QuickDealForm";
import QuickVendorForm from "../vendor/QuickVendorForm";

/*
 * The one task create/edit form used everywhere in the app (company/contact/
 * vendor tabs, calendars, the Tasks page, the global quick-add). Previously
 * five near-identical components existed (CompanyTaskForm, ContactTaskForm,
 * VendorTaskForm, QuickTaskForm, TaskForm) with drifting field sets and
 * visual styles — this replaces all of them.
 *
 * The form owns its own create/update API calls (POST/PUT /tasks) and
 * reports the result via onTaskCreated/onTaskUpdated, so callers stay thin.
 * Delete stays the caller's responsibility (passed in as onDelete) since
 * every prior call site already owned a delete confirmation/flow of its own.
 */

// Compact searchable picker — a plain <select> with many options has no
// search and pops open as a tall, unstyled native list; this keeps a pill
// trigger but opens a small card with a search box and a capped-height list.
const SearchableEntityDropdown = ({ options, value, onChange, displayKey, placeholder, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((o) => o._id === value);
  const filtered = options.filter((o) =>
    (o[displayKey] || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          const next = !isOpen;
          setIsOpen(next);
          if (next) setTimeout(() => e.currentTarget.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
        }}
        className={`w-full border border-[#1F2937]/10 rounded-full px-3 h-8 text-[12px] text-left flex items-center justify-between gap-2 transition-all bg-white font-inter disabled:bg-gray-50 disabled:text-gray-400 ${disabled ? "cursor-not-allowed" : "cursor-pointer"} ${selected ? "text-[#1F2937]" : "text-[#1F2937] opacity-50"}`}
      >
        <span className="truncate">{selected ? selected[displayKey] : placeholder}</span>
        {!disabled && <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsOpen(false);
              setSearch("");
            }}
          />
          <div className="absolute left-0 right-0 mt-1.5 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-8 pr-2 h-7 border border-gray-200 rounded-full text-[12px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto py-1">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                  setSearch("");
                }}
                className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors hover:bg-gray-50 ${!value ? "bg-blue-50/50 text-blue-600" : "text-gray-600"}`}
              >
                None
              </button>
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-[12px] text-center text-gray-400">No results</p>
              ) : (
                filtered.map((o) => (
                  <button
                    key={o._id}
                    type="button"
                    onClick={() => {
                      onChange(o._id);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[12px] truncate transition-colors hover:bg-gray-50 ${value === o._id ? "bg-blue-50/50 text-blue-600" : "text-gray-700"}`}
                  >
                    {o[displayKey]}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Pill-shaped select used for the entity-type / Status / Priority fields.
const SingleSelectDropdown = ({ options, value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          const next = !isOpen;
          setIsOpen(next);
          if (next) setTimeout(() => e.currentTarget.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
        }}
        className={`w-full border border-[#1F2937]/10 rounded-full px-3 h-8 text-[12px] text-left flex items-center justify-between transition-all bg-white font-inter text-[#1F2937] disabled:bg-gray-50 disabled:text-gray-400 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <div className="flex items-center gap-1.5">
          {selectedOption.icon && <selectedOption.icon className="w-3.5 h-3.5" />}
          <span className="capitalize">{selectedOption.label}</span>
        </div>
        {!disabled && <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in duration-200">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 ${value === option.value ? "bg-blue-50/50 text-blue-600" : "text-gray-600"}`}
              >
                <div className={`p-1.5 rounded-lg ${option.className} border-none`}>
                  {option.icon && <option.icon className="w-3.5 h-3.5" />}
                </div>
                <span className="font-medium text-left flex-1">{option.label}</span>
                {value === option.value && <CheckIcon className="w-4 h-4 ml-auto text-blue-600" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const statusOptions = [
  { value: "Pending", label: "Pending", icon: Clock, className: "bg-amber-50 text-amber-600" },
  { value: "In Progress", label: "In Progress", icon: Loader2, className: "bg-blue-50 text-blue-600" },
  { value: "Completed", label: "Completed", icon: CheckIcon, className: "bg-emerald-50 text-emerald-600" },
];

const priorityOptions = [
  { value: "low", label: "Low", icon: Flag, className: "bg-green-50 text-green-600" },
  { value: "medium", label: "Medium", icon: Flag, className: "bg-yellow-50 text-yellow-600" },
  { value: "high", label: "High", icon: Flag, className: "bg-red-50 text-red-600" },
];

const relationOptions = [
  { value: "Company", label: "Company", icon: Building2, className: "bg-cyan-50 text-cyan-600" },
  { value: "Contact", label: "Contact", icon: UserIcon, className: "bg-blue-50 text-blue-600" },
  { value: "Deal", label: "Deal", icon: Briefcase, className: "bg-indigo-50 text-indigo-600" },
  { value: "Vendor", label: "Vendor", icon: Truck, className: "bg-purple-50 text-purple-600" },
];

const TaskFormPanel = ({
  editTask = null,
  initialRelation = null, // { model: "Company"|"Contact"|"Deal"|"Vendor", id }
  initialDueDate = "",
  companies: companiesProp,
  contacts: contactsProp,
  onTaskCreated,
  onTaskUpdated,
  onDelete,
  onRequestClose,
}) => {
  const isEditing = !!editTask;
  const [form, setForm] = useState({
    title: "",
    dueDate: initialDueDate,
    selectedDate: initialDueDate,
    description: "",
    status: "Pending",
    priority: "medium",
    relationModel: initialRelation?.model || "Company",
    relatedTo: initialRelation?.id || "",
    users: [],
  });
  const [companies, setCompanies] = useState(companiesProp || []);
  const [contacts, setContacts] = useState(contactsProp || []);
  const [deals, setDeals] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [errors, setErrors] = useState({});
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [userSelectorSearch, setUserSelectorSearch] = useState("");
  const assigneesFieldRef = useRef(null);
  const [showQuickCompanyForm, setShowQuickCompanyForm] = useState(false);
  const [showQuickContactForm, setShowQuickContactForm] = useState(false);
  const [showQuickDealsForm, setShowQuickDealsForm] = useState(false);
  const [showQuickVendorForm, setShowQuickVendorForm] = useState(false);

  useEffect(() => {
    setShouldRender(true);
    setTimeout(() => setIsOpen(true), 10);
    fetchData();
    return () => setIsOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-fill when editing so create and edit share one form.
  useEffect(() => {
    if (!editTask) return;
    const rel = (editTask.relatedEntities && editTask.relatedEntities[0]) || {};
    setForm({
      title: editTask.title || "",
      dueDate: editTask.dueDate ? new Date(editTask.dueDate).toISOString().slice(0, 10) : "",
      selectedDate: editTask.selectedDate ? new Date(editTask.selectedDate).toISOString().slice(0, 10) : "",
      description: editTask.description || "",
      status: editTask.status || "Pending",
      priority: editTask.priority || "medium",
      relationModel: rel.entityModel || "Company",
      relatedTo: rel.entityId?._id || rel.entityId || "",
      users: (editTask.users || []).map((u) => u._id || u),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTask]);

  const fetchData = async () => {
    try {
      const requests = [API.get("/deals"), API.get("/vendors"), API.get("/auth/all-user")];
      if (!companiesProp) requests.push(API.get("/companies"));
      if (!contactsProp) requests.push(API.get("/contacts"));
      const results = await Promise.all(requests);
      setDeals(results[0].data);
      setVendors(results[1].data);
      setUsers(results[2].data.allUsers);
      let i = 3;
      if (!companiesProp) setCompanies(results[i++].data);
      if (!contactsProp) {
        setContacts(
          results[i++].data.map((c) => ({
            ...c,
            displayName: `${c.name} (${c.company?.name || "No Company"})`,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to fetch task-related data:", err);
      toast.error("Failed to fetch task-related data");
    }
  };

  // Scroll the Assignees field into view when its list opens — it can sit at
  // the bottom of the scrollable body, right against the sticky footer.
  useEffect(() => {
    if (showUserSelector) {
      assigneesFieldRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      setUserSelectorSearch("");
    }
  }, [showUserSelector]);

  const handleClose = () => {
    if (isFormDirty) setShowConfirmDialog(true);
    else closeForm();
  };

  const closeForm = () => {
    setIsOpen(false);
    setTimeout(() => onRequestClose(), 300);
  };

  const handleConfirmExit = () => {
    setShowConfirmDialog(false);
    closeForm();
  };

  const handleSaveAndExit = async () => {
    setShowConfirmDialog(false);
    await handleSubmit({ preventDefault: () => {} });
  };

  const handleChange = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "relationModel") next.relatedTo = "";
      return next;
    });
    setIsFormDirty(true);
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }));
    if (key === "relationModel" && errors.relatedTo) {
      setErrors((prev) => ({ ...prev, relatedTo: null }));
    }
  };

  const handleUserSelection = (userId) => {
    const current = form.users || [];
    setForm((f) => ({
      ...f,
      users: current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    }));
    setIsFormDirty(true);
    if (errors.users) setErrors((prev) => ({ ...prev, users: null }));
  };

  const handleCompanyCreated = (c) => {
    setCompanies((prev) => [...prev, c]);
    handleChange("relatedTo", c._id);
    setShowQuickCompanyForm(false);
  };
  const handleContactCreated = (c) => {
    setContacts((prev) => [...prev, { ...c, displayName: `${c.name} (${c.company?.name || "No Company"})` }]);
    handleChange("relatedTo", c._id);
    setShowQuickContactForm(false);
  };
  const handleDealCreated = (d) => {
    setDeals((prev) => [...prev, d]);
    handleChange("relatedTo", d._id);
    setShowQuickDealsForm(false);
  };
  const handleVendorCreated = (v) => {
    setVendors((prev) => [...prev, v]);
    handleChange("relatedTo", v._id);
    setShowQuickVendorForm(false);
  };

  const openQuickCreate = () => {
    if (form.relationModel === "Company") setShowQuickCompanyForm(true);
    else if (form.relationModel === "Contact") setShowQuickContactForm(true);
    else if (form.relationModel === "Deal") setShowQuickDealsForm(true);
    else if (form.relationModel === "Vendor") setShowQuickVendorForm(true);
  };

  const getEntityOptions = () => {
    const map = { Company: companies, Contact: contacts, Deal: deals, Vendor: vendors };
    return map[form.relationModel] || [];
  };
  const getDisplayKey = () => {
    if (form.relationModel === "Deal") return "title";
    if (form.relationModel === "Contact") return "displayName";
    return "name";
  };

  const assignedUsers = form.users?.map((id) => users.find((u) => u._id === id)).filter(Boolean) || [];

  const validateForm = () => {
    const newErrors = {};
    if (!form.title?.trim()) newErrors.title = "Task title is required";
    if (!form.relatedTo) newErrors.relatedTo = `Please select a ${form.relationModel.toLowerCase()}`;
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please fill in all required fields");
      return;
    }

    // Plain YYYY-MM-DD dates are pinned to noon UTC so they land on the
    // intended day regardless of the viewer's timezone.
    const createLocalDate = (dateString) => {
      if (!dateString) return null;
      const [year, month, day] = dateString.split("-");
      return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    };

    try {
      setLoading(true);
      const payload = {
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        users: form.users,
        dueDate: createLocalDate(form.dueDate),
        selectedDate: createLocalDate(form.selectedDate || form.dueDate),
        relatedEntities: [{ entityModel: form.relationModel, entityId: form.relatedTo }],
      };

      const res = isEditing
        ? await API.put(`/tasks/${editTask._id}`, payload)
        : await API.post("/tasks", payload);
      toast.success(isEditing ? "Task updated successfully!" : "Task added successfully!");
      const cb = isEditing ? onTaskUpdated || onTaskCreated : onTaskCreated;
      if (cb && res.data) cb(res.data);
      setIsFormDirty(false);
      closeForm();
    } catch (err) {
      let errorMessage = "Failed to save task. Please try again.";
      if (err.response?.status === 402) {
        errorMessage = err.response?.data?.message || "An active subscription is required to make changes.";
      } else if (err.response?.status === 403) {
        errorMessage = err.response.data.error || "Access denied";
        const match = errorMessage.match(/\((\d+)\/(\d+)\s*records/);
        if (match) {
          errorMessage = `Record limit reached (${match[1]}/${match[2]}). Please upgrade your plan to add more records.`;
        } else if (errorMessage.includes("Subscription expired")) {
          errorMessage = "Subscription expired. Please renew to add tasks.";
        } else if (errorMessage.includes("Write access to tasks not allowed")) {
          errorMessage = "Your plan does not allow adding tasks. Please upgrade your plan.";
        }
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    try {
      setIsDeleting(true);
      await onDelete(editTask._id);
      toast.success("Task deleted successfully");
      closeForm();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete task");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!shouldRender) return null;

  return (
    <>
      {showQuickCompanyForm && (
        <QuickCompanyForm onCompanyCreated={handleCompanyCreated} onRequestClose={() => setShowQuickCompanyForm(false)} />
      )}
      {showQuickContactForm && (
        <QuickContactForm companies={companies} onContactCreated={handleContactCreated} onRequestClose={() => setShowQuickContactForm(false)} />
      )}
      {showQuickDealsForm && (
        <QuickDealForm companies={companies} contacts={contacts} onDealCreated={handleDealCreated} onRequestClose={() => setShowQuickDealsForm(false)} />
      )}
      {showQuickVendorForm && (
        <QuickVendorForm onVendorCreated={handleVendorCreated} onRequestClose={() => setShowQuickVendorForm(false)} />
      )}

      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 z-[10004] flex items-center justify-center">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-sm sm:max-w-lg mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Unsaved Changes</h3>
            <p className="text-sm text-gray-600 mb-6">
              You have unsaved changes. Are you sure you want to exit without saving?
            </p>
            <div className="flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmDialog(false)}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors cursor-pointer hidden sm:block"
              >
                Cancel
              </button>
              <div className="flex space-x-1">
                <button
                  type="button"
                  onClick={handleConfirmExit}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors cursor-pointer"
                >
                  Exit Without Saving
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndExit}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  Save and Exit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[10000] transition-opacity duration-300 ease-in-out"
        style={{ opacity: isOpen ? 1 : 0 }}
        onClick={handleClose}
      />

      <div
        className={`fixed dc-panel-card dc-panel-w z-[10001] bg-white shadow-2xl flex flex-col overflow-hidden transform transition-transform duration-300 ease-in-out font-inter ${
          isOpen ? "translate-x-0" : "translate-x-[calc(100%+2rem)]"
        }`}
      >
        <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
          {/* Sticky header */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-[#D9D9D9] flex-shrink-0 bg-white gap-1">
            <h2 className="text-[14px] font-normal leading-5 text-[#78788D] uppercase tracking-wide">
              {isEditing ? "Edit Task" : "Add New Task"}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              title="Close"
              className="w-5 h-5 flex items-center justify-center text-[#1C1B1F] hover:opacity-70 transition-opacity"
              aria-label="Close"
            >
              <X className="w-[18px] h-[18px]" strokeWidth={2} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 space-y-6">
            <div>
              <label className="flex items-center gap-0.5 text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                Task Title <span className="text-[#FF4935]">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => handleChange("title", e.target.value)}
                className="w-full border border-[#1F2937]/10 rounded-full px-3 h-8 text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#1F2937] placeholder:opacity-50"
                placeholder="Enter Task Title"
              />
              {errors.title && <p className="text-[12px] text-[#FF4935] font-medium mt-1.5">{errors.title}</p>}
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
                rows={4}
                className="w-full border border-[#1F2937]/10 rounded-2xl px-3 py-2 text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-inter resize-vertical placeholder:text-[#1F2937] placeholder:opacity-50"
                placeholder="Describe the task objectives, requirements and important details"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                  Related to Type
                </label>
                <SingleSelectDropdown
                  options={relationOptions}
                  value={form.relationModel}
                  onChange={(val) => handleChange("relationModel", val)}
                />
              </div>

              <div>
                <label className="flex items-center gap-0.5 text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                  {form.relationModel} <span className="text-[#FF4935]">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 min-w-0">
                    <SearchableEntityDropdown
                      options={getEntityOptions()}
                      value={form.relatedTo}
                      onChange={(val) => handleChange("relatedTo", val)}
                      displayKey={getDisplayKey()}
                      placeholder={`Select ${form.relationModel}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={openQuickCreate}
                    className="flex-shrink-0 w-8 h-8 rounded-full border border-[#1F2937]/10 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
                    title={`Add New ${form.relationModel}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                {errors.relatedTo && <p className="text-[12px] text-[#FF4935] font-medium mt-1.5">{errors.relatedTo}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                  Selected Date
                </label>
                <input
                  type="date"
                  value={form.selectedDate}
                  onChange={(e) => handleChange("selectedDate", e.target.value)}
                  className="w-full border border-[#1F2937]/10 rounded-full px-3 h-8 text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                  Due Date
                </label>
                <input
                  type="date"
                  value={form.dueDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => handleChange("dueDate", e.target.value)}
                  className="w-full border border-[#1F2937]/10 rounded-full px-3 h-8 text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                  <Timer className="w-3.5 h-3.5" />
                  Status
                </label>
                <SingleSelectDropdown
                  options={statusOptions}
                  value={form.status}
                  onChange={(val) => handleChange("status", val)}
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                  <Flag className="w-3.5 h-3.5" />
                  Priority
                </label>
                <SingleSelectDropdown
                  options={priorityOptions}
                  value={form.priority}
                  onChange={(val) => handleChange("priority", val)}
                />
              </div>
            </div>

            <div ref={assigneesFieldRef}>
              <label className="block text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                Assignees
              </label>
              <div className="space-y-2 relative">
                {assignedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {assignedUsers.map((user) => (
                      <div
                        key={user._id}
                        className="w-7 h-7 rounded-full overflow-hidden border-2 border-white ring-1 ring-gray-100 flex items-center justify-center bg-gray-100"
                        title={user.name || user.email}
                      >
                        <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowUserSelector(!showUserSelector)}
                  className="w-full flex items-center justify-between border border-[#1F2937]/10 rounded-full px-3 h-8 text-[12px] bg-white hover:bg-gray-50 transition-colors focus:outline-none"
                >
                  <span className="text-[#1F2937] opacity-50">
                    {form.users?.length ? `${form.users.length} selected` : "Select Users"}
                  </span>
                  <Plus className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                </button>

                {showUserSelector && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserSelector(false)} />
                    <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                      <div className="p-2 border-b border-gray-100">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                          <input
                            type="text"
                            autoFocus
                            value={userSelectorSearch}
                            onChange={(e) => setUserSelectorSearch(e.target.value)}
                            placeholder="Search users..."
                            className="w-full pl-8 pr-2 h-7 border border-gray-200 rounded-full text-[12px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div className="max-h-40 overflow-y-auto p-1">
                        {users
                          .filter((user) =>
                            (user.name || user.email || "").toLowerCase().includes(userSelectorSearch.toLowerCase())
                          )
                          .map((user) => (
                            <label
                              key={user._id}
                              className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={form.users?.includes(user._id)}
                                onChange={() => handleUserSelection(user._id)}
                                className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-[12px] font-medium text-[#1F2937] truncate">{user.name || user.email}</span>
                            </label>
                          ))}
                        {users.filter((user) =>
                          (user.name || user.email || "").toLowerCase().includes(userSelectorSearch.toLowerCase())
                        ).length === 0 && (
                          <p className="px-3 py-2 text-[12px] text-center text-gray-400">No results</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
                {errors.users && <p className="text-[12px] text-[#FF4935] font-medium">{errors.users}</p>}
              </div>
            </div>
          </div>

          {/* Sticky footer. dc-form-footer marks its top edge as the
              boundary dropdown popups (see useAnchoredDropdown) must not
              render over. */}
          <div className="dc-form-footer flex-shrink-0 py-2.5 px-4 border-t border-gray-100 bg-white flex items-center justify-end gap-3">
            {isEditing && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="mr-auto w-8 h-8 flex items-center justify-center text-[#DF120B] hover:bg-red-50 rounded-full transition-colors disabled:opacity-50"
                title="Delete Task"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            )}

            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2 border border-gray-200 text-gray-700 rounded-[25px] text-sm font-bold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-[#158FFF] text-white rounded-[25px] text-sm font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Saving..." : isEditing ? "Update Task" : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default TaskFormPanel;
