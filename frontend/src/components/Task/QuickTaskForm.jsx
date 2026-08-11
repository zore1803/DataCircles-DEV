import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import API from "../../services/api";
import toast from "react-hot-toast";
import SearchIcon from "../common/SearchIcon";
import {
  X,
  Plus,
  Calendar,
  Clock,
  Users,
  Building,
  Building2,
  Truck,
  Briefcase,
  Loader2,
  Save,
  Timer,
  Flag,
  ChevronDown,
  CheckCircle2 as CheckIcon,
  User as UserIcon,
} from "lucide-react";
import QuickCompanyForm from "../company/QuickCompanyForm";
import QuickContactForm from "../contact/QuickContactForm";
import QuickDealForm from "../deal/QuickDealForm";
import QuickVendorForm from "../vendor/QuickVendorForm";

// isOpen/onOpenChange are controlled by the parent form (a single shared
// "which dropdown is open" key) rather than each instance owning its own
// state — otherwise opening Status doesn't close Priority, and their option
// lists render stacked on top of each other.
const SingleSelectDropdown = ({ options, value, onChange, disabled, isOpen, onOpenChange }) => {
  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onOpenChange(!isOpen)}
        className={`w-full flex items-center justify-end gap-2 px-3 py-1.5 rounded-full text-xs font-semibold focus:outline-none transition-all ${disabled ? "cursor-not-allowed" : "cursor-pointer"
          } ${selectedOption.className}`}
      >
        <div className="flex items-center gap-1.5">
          {selectedOption.icon && <selectedOption.icon className="w-3 h-3" />}
          <span className="capitalize">{selectedOption.label}</span>
        </div>
        {!disabled && <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} />
          <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in duration-200">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  onOpenChange(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 ${value === option.value ? "bg-blue-50/50 text-blue-600" : "text-gray-600"
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

// Compact searchable picker for the linked record, styled as a right-aligned
// pill so it sits in the same meta-row rhythm as Status / Priority rather
// than being a full-width labelled field.
const EntityPickerDropdown = ({ entities, value, onChange, entityLabel, displayKey, isOpen, onOpenChange }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const Icon =
    entityLabel === "Contact" ? UserIcon : entityLabel === "Vendor" ? Truck : entityLabel === "Deal" ? Briefcase : Building2;
  const selected = entities.find((e) => e._id === value);
  const filtered = entities.filter((e) =>
    (e[displayKey] || e.name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        className="flex items-center justify-end gap-2 px-3 py-1.5 rounded-full text-xs font-semibold focus:outline-none transition-all bg-gray-50 text-gray-700 cursor-pointer hover:bg-gray-100"
      >
        <Icon className="w-3 h-3 flex-shrink-0" />
        <span className="truncate max-w-[140px]">
          {selected ? selected[displayKey] || selected.name : `Select ${entityLabel}`}
        </span>
        <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} />
          <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <SearchIcon className="absolute left-3 -translate-y-1/2 top-1/2 w-3.5 h-3.5 text-[#525866]" />
                <input
                  type="text"
                  autoFocus
                  placeholder={`Search ${entityLabel.toLowerCase()}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-4 py-3 text-xs text-center text-gray-400">
                  No {entityLabel.toLowerCase()} found
                </p>
              ) : (
                filtered.map((entity) => (
                  <button
                    key={entity._id}
                    type="button"
                    onClick={() => {
                      onChange(entity._id);
                      onOpenChange(false);
                      setSearchTerm("");
                    }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs transition-colors hover:bg-gray-50 ${value === entity._id ? "bg-blue-50/50 text-blue-600" : "text-gray-600"}`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="font-medium truncate">{entity[displayKey] || entity.name}</span>
                    {value === entity._id && <CheckIcon className="w-3.5 h-3.5 ml-auto text-blue-600 flex-shrink-0" />}
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

const QuickTaskForm = ({
  companies,
  contacts,
  onTaskCreated,
  onTaskUpdated,
  onRequestClose,
  editTask = null,
}) => {
  const isEditing = !!editTask;
  const [form, setForm] = useState({
    title: "",
    dueDate: "",
    selectedDate: "",
    description: "",
    status: "Pending",
    priority: "medium",
    relationModel: "Company",
    relatedTo: "",
    users: [],
  });
  const [deals, setDeals] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  // Which of the Related To / entity / Status / Priority dropdowns is open,
  // if any — shared so opening one closes the others.
  const [openDropdown, setOpenDropdown] = useState(null);
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [showQuickCompanyForm, setShowQuickCompanyForm] = useState(false);
  const [showQuickContactForm, setShowQuickContactForm] = useState(false);
  const [showQuickDealsForm, setShowQuickDealsForm] = useState(false);
  const [showQuickVendorForm, setShowQuickVendorForm] = useState(false);
  const [localCompanies, setLocalCompanies] = useState(companies);
  const [localContacts, setLocalContacts] = useState(contacts);
  const [validationErrors, setValidationErrors] = useState({});

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

  useEffect(() => {
    setShouldRender(true);
    setTimeout(() => setIsOpen(true), 10);
    fetchData();
    setLocalCompanies(companies);
    setLocalContacts(
      contacts.map((contact) => ({
        ...contact,
        displayName: `${contact.name} (${contact.company?.name || "No Company"})`,
      }))
    );
    return () => {
      setIsOpen(false);
    };
  }, [companies, contacts]);

  // Pre-fill when editing so edit and create share one form.
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
      const [dealsRes, vendorsRes, usersRes] = await Promise.all([
        API.get("/deals"),
        API.get("/vendors"),
        API.get("/auth/all-user"),
      ]);
      setDeals(dealsRes.data);
      setVendors(vendorsRes.data);
      setUsers(usersRes.data.allUsers);
    } catch (err) {
      console.error("Failed to fetch data:", err);
      toast.error("Failed to fetch task-related data");
    }
  };

  const handleClose = () => {
    if (isFormDirty) {
      setShowConfirmDialog(true);
    } else {
      closeForm();
    }
  };

  const closeForm = () => {
    setIsOpen(false);
    setTimeout(() => {
      onRequestClose();
    }, 300);
  };

  const handleConfirmExit = () => {
    setShowConfirmDialog(false);
    closeForm();
  };

  const handleSaveAndExit = async () => {
    setShowConfirmDialog(false);
    await handleSubmit({ preventDefault: () => {} }, true);
  };

  const handleFormChange = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Switching the related type invalidates whichever record was picked.
      if (key === "relationModel") next.relatedTo = "";
      return next;
    });
    setIsFormDirty(true);

    if (validationErrors[key]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
    if (key === "relationModel" && validationErrors.relatedTo) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.relatedTo;
        return newErrors;
      });
    }
  };

  const handleUserSelection = (userId) => {
    const currentUsers = form.users || [];
    setForm({
      ...form,
      users: currentUsers.includes(userId)
        ? currentUsers.filter((id) => id !== userId)
        : [...currentUsers, userId],
    });
    setIsFormDirty(true);

    if (validationErrors.users) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.users;
        return newErrors;
      });
    }
  };

  const handleCompanyCreated = (newCompany) => {
    setLocalCompanies((prev) => [...prev, newCompany]);
    handleFormChange("relatedTo", newCompany._id);
    setShowQuickCompanyForm(false);
  };

  const handleContactCreated = (newContact) => {
    setLocalContacts((prev) => [
      ...prev,
      { ...newContact, displayName: `${newContact.name} (${newContact.company?.name || "No Company"})` },
    ]);
    handleFormChange("relatedTo", newContact._id);
    setShowQuickContactForm(false);
  };

  const handleDealCreated = (newDeal) => {
    setDeals((prev) => [...prev, newDeal]);
    handleFormChange("relatedTo", newDeal._id);
    setShowQuickDealsForm(false);
  };

  const handleVendorCreated = (newVendor) => {
    setVendors((prev) => [...prev, newVendor]);
    handleFormChange("relatedTo", newVendor._id);
    setShowQuickVendorForm(false);
  };

  const openQuickCreate = () => {
    if (form.relationModel === "Company") setShowQuickCompanyForm(true);
    else if (form.relationModel === "Contact") setShowQuickContactForm(true);
    else if (form.relationModel === "Deal") setShowQuickDealsForm(true);
    else if (form.relationModel === "Vendor") setShowQuickVendorForm(true);
  };

  const getOptions = () => {
    const map = {
      Company: localCompanies,
      Contact: localContacts,
      Deal: deals,
      Vendor: vendors,
    };
    return map[form.relationModel] || [];
  };

  const getDisplayKey = () => {
    if (form.relationModel === "Deal") return "title";
    if (form.relationModel === "Contact") return "displayName";
    return "name";
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      user.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const assignedUsers = form.users?.map((id) => users.find((u) => u._id === id)).filter(Boolean) || [];

  const validateForm = () => {
    const errors = {};
    if (!form.title || !form.title.trim()) {
      errors.title = "Task title is required";
    }
    if (!form.users || form.users.length === 0) {
      errors.users = "At least one user must be assigned to this task";
    }
    if (form.relationModel && !form.relatedTo) {
      errors.relatedTo = `Please select a ${form.relationModel.toLowerCase()}`;
    }
    return errors;
  };

  const handleSubmit = async (e, isSaveAndExit = false) => {
    e.preventDefault();

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error("Please fill in all required fields");
      return;
    }

    // Dates are entered as plain YYYY-MM-DD. Pinning them to noon UTC keeps
    // them on the intended day regardless of the viewer's timezone, instead
    // of drifting a day earlier for anyone behind UTC.
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
        // The API takes a relatedEntities array — posting the raw
        // relationModel/relatedTo pair the form tracks internally gets
        // rejected by createTask's "at least one related entity" check.
        relatedEntities: [{ entityModel: form.relationModel, entityId: form.relatedTo }],
      };

      const res = isEditing
        ? await API.put(`/tasks/${editTask._id}`, payload)
        : await API.post("/tasks", payload);
      toast.success(isEditing ? "Task updated successfully!" : "Task added successfully!");
      const cb = isEditing ? onTaskUpdated || onTaskCreated : onTaskCreated;
      if (cb && res.data) {
        cb(res.data);
      }
      setIsFormDirty(false);
      closeForm();
    } catch (err) {
      let errorMessage = "Failed to add task. Please try again.";
      if (err.response?.status === 402) {
        errorMessage = err.response?.data?.message || "An active subscription is required to make changes.";
      } else if (err.response?.status === 403) {
        errorMessage = err.response.data.error || "Access denied";
        const match = errorMessage.match(/\((\d+)\/(\d+)\s*records/);
        if (match) {
          const used = match[1];
          const limit = match[2];
          errorMessage = `Record limit reached (${used}/${limit}). Please upgrade your plan to add more records.`;
        } else if (errorMessage.includes("Subscription expired")) {
          errorMessage = "Subscription expired. Please renew to add tasks.";
        } else if (errorMessage.includes("Write access to tasks not allowed")) {
          errorMessage = "Your plan does not allow adding tasks. Please upgrade your plan.";
        }
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      toast.error(errorMessage);
      if (!isSaveAndExit) closeForm();
    } finally {
      setLoading(false);
    }
  };

  if (!shouldRender) return null;

  return createPortal(
    <>
      {/* QuickCompanyForm Modal */}
      {showQuickCompanyForm && (
        <QuickCompanyForm
          onCompanyCreated={handleCompanyCreated}
          onRequestClose={() => setShowQuickCompanyForm(false)}
        />
      )}

      {/* QuickContactForm Modal */}
      {showQuickContactForm && (
        <QuickContactForm
          companies={localCompanies}
          onContactCreated={handleContactCreated}
          onRequestClose={() => setShowQuickContactForm(false)}
        />
      )}

      {/* QuickDealsForm Modal */}
      {showQuickDealsForm && (
        <QuickDealForm
          companies={localCompanies}
          contacts={localContacts}
          onDealCreated={handleDealCreated}
          onRequestClose={() => setShowQuickDealsForm(false)}
        />
      )}

      {/* QuickVendorForm Modal */}
      {showQuickVendorForm && (
        <QuickVendorForm
          onVendorCreated={handleVendorCreated}
          onRequestClose={() => setShowQuickVendorForm(false)}
        />
      )}

      {/* Confirmation Dialog */}
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
        className={`fixed dc-panel-card z-[10001] dc-panel-w bg-white shadow-2xl flex flex-col overflow-hidden transform transition-transform duration-300 ease-in-out font-inter ${
          isOpen ? "translate-x-0" : "translate-x-[calc(100%+2rem)]"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-bold text-gray-900">
              {isEditing ? "Edit Task" : "Add New Task"}
            </h3>
            <button
              type="button"
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <div className="flex-1 overflow-y-auto">
            <form onSubmit={handleSubmit} className="flex flex-col h-full">
              {/* Content */}
              <div className="p-6 space-y-8">
                <div className="space-y-4">
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => handleFormChange("title", e.target.value)}
                    className={`w-full text-3xl font-bold border-none bg-transparent placeholder-gray-300 focus:outline-none focus:ring-0 ${validationErrors.title ? "text-red-600" : "text-gray-900"
                      }`}
                    placeholder="Task Title"
                  />
                  {validationErrors.title && (
                    <p className="text-xs text-red-500 font-medium">*{validationErrors.title}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => handleFormChange("description", e.target.value)}
                    rows={6}
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:border-blue-500 transition-all focus:outline-none resize-none text-sm text-gray-600"
                    placeholder="Description the task objectives, requirements and important details"
                  />
                </div>
              </div>

              {/* Meta */}
              <div className="px-6 pb-6 space-y-6 bg-white border-t border-gray-100 pt-6">
                <div className="space-y-4">
                  {/* Related to (entity type) */}
                  <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                      <UserIcon className="w-4 h-4" />
                      <span>Related to</span>
                    </div>
                    <SingleSelectDropdown
                      options={relationOptions}
                      value={form.relationModel}
                      onChange={(val) => handleFormChange("relationModel", val)}
                      isOpen={openDropdown === "relationModel"}
                      onOpenChange={(open) => setOpenDropdown(open ? "relationModel" : null)}
                    />
                  </div>

                  {/* The record itself, with a quick-create shortcut */}
                  <div>
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-2 text-gray-600 text-sm">
                        <Building className="w-4 h-4" />
                        <span>{form.relationModel}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <EntityPickerDropdown
                          entities={getOptions()}
                          value={form.relatedTo}
                          onChange={(val) => handleFormChange("relatedTo", val)}
                          entityLabel={form.relationModel}
                          displayKey={getDisplayKey()}
                          isOpen={openDropdown === "entity"}
                          onOpenChange={(open) => setOpenDropdown(open ? "entity" : null)}
                        />
                        <button
                          type="button"
                          onClick={openQuickCreate}
                          className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                          title={`Add New ${form.relationModel}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {validationErrors.relatedTo && (
                      <p className="text-[10px] text-red-500 font-medium text-right mt-1">
                        {validationErrors.relatedTo}
                      </p>
                    )}
                  </div>

                  {/* Selected Date (Start Date) */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                      <Calendar className="w-4 h-4" />
                      <span>Selected Date</span>
                    </div>
                    <input
                      type="date"
                      value={form.selectedDate}
                      onChange={(e) => handleFormChange("selectedDate", e.target.value)}
                      className="text-sm font-medium text-gray-900 border-none bg-transparent p-0 focus:ring-0 text-right cursor-pointer"
                    />
                  </div>

                  {/* Due Date */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                      <Calendar className="w-4 h-4" />
                      <span>Due Date</span>
                    </div>
                    <input
                      type="date"
                      value={form.dueDate}
                      onChange={(e) => handleFormChange("dueDate", e.target.value)}
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
                      onChange={(val) => handleFormChange("status", val)}
                      isOpen={openDropdown === "status"}
                      onOpenChange={(open) => setOpenDropdown(open ? "status" : null)}
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
                      onChange={(val) => handleFormChange("priority", val)}
                      isOpen={openDropdown === "priority"}
                      onOpenChange={(open) => setOpenDropdown(open ? "priority" : null)}
                    />
                  </div>

                  {/* Assignees */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                      <Users className="w-4 h-4" />
                      <span>Assignees</span>
                    </div>

                    <div className="space-y-2 relative">
                      {assignedUsers.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {assignedUsers.map((user) => (
                            <div
                              key={user._id}
                              className="w-6 h-6 rounded-full overflow-hidden border-2 border-white ring-1 ring-gray-100 flex items-center justify-center bg-gray-100"
                              title={user.name || user.email}
                            >
                              <UserIcon className="w-3 h-3 text-gray-400" />
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setShowUserSelector(!showUserSelector)}
                        className={`w-full flex items-center justify-between px-3 py-2 bg-gray-50 border rounded-xl text-xs hover:bg-gray-100 transition-colors focus:outline-none ${validationErrors.users ? "border-red-300" : "border-gray-200"
                          }`}
                      >
                        <span className="text-gray-500">
                          {form.users.length > 0 ? `${form.users.length} selected` : "Select Users"}
                        </span>
                        <Plus className="w-3 h-3 text-gray-400" />
                      </button>

                      {showUserSelector && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowUserSelector(false)} />
                          <div className="absolute z-50 left-0 right-0 bottom-full mb-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                            <div className="p-2 border-b border-gray-100">
                              <div className="relative">
                                <SearchIcon className="absolute left-3 -translate-y-1/2 top-1/2 w-3.5 h-3.5 text-[#525866]" />
                                <input
                                  type="text"
                                  value={userSearch}
                                  onChange={(e) => setUserSearch(e.target.value)}
                                  placeholder="Search users..."
                                  className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                            <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                              {filteredUsers.length === 0 ? (
                                <p className="px-2 py-3 text-xs text-center text-gray-400">No users found</p>
                              ) : (
                                filteredUsers.map((user) => (
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
                                    <span className="text-xs font-medium text-gray-700 truncate">
                                      {user.name || user.email}
                                    </span>
                                  </label>
                                ))
                              )}
                            </div>
                          </div>
                        </>
                      )}
                      {validationErrors.users && (
                        <p className="text-[10px] text-red-500 font-medium">{validationErrors.users}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
            >
              Cancel
            </button>
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
                  {isEditing ? "Update Task" : "Create Task"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default QuickTaskForm;
