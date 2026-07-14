import React, { useEffect, useState } from "react";
import API from "../../services/api";
import toast from "react-hot-toast";
import { X, Plus } from "lucide-react";
import SearchableDropdown from "../contact/SearchableDropdown";
import QuickCompanyForm from "../company/QuickCompanyForm";
import QuickContactForm from "../contact/QuickContactForm";
import QuickDealForm from "../deal/QuickDealForm";
import QuickVendorForm from "../vendor/QuickVendorForm";
import ReactQuill from 'react-quill-new';

const QuickTaskForm = ({
  companies,
  contacts,
  onTaskCreated,
  onRequestClose,
}) => {
  const [form, setForm] = useState({
    title: "",
    dueDate: "",
    description: "",
    status: "Pending",
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
  const [userSearch, setUserSearch] = useState("");
  const [showQuickCompanyForm, setShowQuickCompanyForm] = useState(false);
  const [showQuickContactForm, setShowQuickContactForm] = useState(false);
  const [showQuickDealsForm, setShowQuickDealsForm] = useState(false);
  const [showQuickVendorForm, setShowQuickVendorForm] = useState(false);
  const [localCompanies, setLocalCompanies] = useState(companies);
  const [localContacts, setLocalContacts] = useState(contacts);

  // Add validation errors state
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    setShouldRender(true);
    setTimeout(() => setIsOpen(true), 10);
    fetchData();
    setLocalCompanies(companies);
    setLocalContacts(
      contacts.map(contact => ({
        ...contact,
        displayName: `${contact.name} (${contact.company?.name || 'No Company'})`
      }))
    );
    return () => {
      setIsOpen(false);
    };
  }, [companies, contacts]);

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
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsFormDirty(true);
    
    // Clear validation error for this field
    if (validationErrors[key]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
    
    // Special handling for relationModel change
    if (key === 'relationModel') {
      setForm((prev) => ({ ...prev, [key]: value, relatedTo: "" }));
      if (validationErrors.relatedTo) {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.relatedTo;
          return newErrors;
        });
      }
    }
  };

  const handleUserSelection = (userId) => {
    const currentUsers = form.users || [];
    if (currentUsers.includes(userId)) {
      setForm({
        ...form,
        users: currentUsers.filter((id) => id !== userId),
      });
    } else {
      setForm({
        ...form,
        users: [...currentUsers, userId],
      });
    }
    setIsFormDirty(true);
    
    // Clear validation error when users are selected
    if (validationErrors.users) {
      setValidationErrors(prev => {
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
    
    // Clear validation error when related entity is selected
    if (validationErrors.relatedTo) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.relatedTo;
        return newErrors;
      });
    }
  };

  const handleContactCreated = (newContact) => {
    const contactWithDisplay = {
      ...newContact,
      displayName: `${newContact.name} (${newContact.company?.name || 'No Company'})`
    };
    setLocalContacts((prev) => [...prev, contactWithDisplay]);
    handleFormChange("relatedTo", newContact._id);
    setShowQuickContactForm(false);
    
    if (validationErrors.relatedTo) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.relatedTo;
        return newErrors;
      });
    }
  };

  const handleDealCreated = (newDeal) => {
    setDeals((prev) => [...prev, newDeal]);
    handleFormChange("relatedTo", newDeal._id);
    setShowQuickDealsForm(false);
    
    if (validationErrors.relatedTo) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.relatedTo;
        return newErrors;
      });
    }
  };

  const handleVendorCreated = (newVendor) => {
    setVendors((prev) => [...prev, newVendor]);
    handleFormChange("relatedTo", newVendor._id);
    setShowQuickVendorForm(false);
    
    if (validationErrors.relatedTo) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.relatedTo;
        return newErrors;
      });
    }
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
      user.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  // Validation function
  const validateForm = () => {
    const errors = {};
    
    // Validate required title
    if (!form.title || !form.title.trim()) {
      errors.title = "Task title is required";
    }
    
    // Validate at least one user is assigned
    if (!form.users || form.users.length === 0) {
      errors.users = "At least one user must be assigned to this task";
    }
    
    // Validate related entity if relationModel is selected
    if (form.relationModel && !form.relatedTo) {
      errors.relatedTo = `Please select a ${form.relationModel.toLowerCase()}`;
    }
    
    return errors;
  };

  const handleSubmit = async (e, isSaveAndExit = false) => {
    e.preventDefault();
    
    // Validate form
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);
      const res = await API.post("/tasks", form);
      toast.success("Task added successfully!");
      if (onTaskCreated && res.data) {
        onTaskCreated(res.data);
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
          errorMessage =
            "Your plan does not allow adding tasks. Please upgrade your plan.";
        }
      }
      toast.error(errorMessage);
      if (!isSaveAndExit) closeForm();
    } finally {
      setLoading(false);
    }
  };

  if (!shouldRender) return null;

  return (
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Unsaved Changes
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              You have unsaved changes. Are you sure you want to exit without
              saving?
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
        className="fixed inset-0 bg-black/20 z-[10000] transition-opacity duration-300 ease-in-out"
        style={{ opacity: isOpen ? 1 : 0 }}
        onClick={handleClose}
      />
      <div
        className={`fixed inset-y-0 right-0 z-[10000] w-full sm:w-[500px] md:w-[600px] max-w-full bg-white shadow-2xl overflow-y-auto transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 md:p-6">
          <div className="flex justify-between items-center mb-4 sm:mb-5 md:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              Create New Task
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 sm:p-0 cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
          <div className="space-y-3 sm:space-y-4">
            {/* Task Title - Now with validation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Task Title *
              </label>
              <input
                className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:border-transparent shadow-sm ${
                  validationErrors.title 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="Enter task title"
                value={form.title}
                onChange={(e) => handleFormChange("title", e.target.value)}
                required
              />
              {validationErrors.title && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.title}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                value={form.dueDate}
                onChange={(e) => handleFormChange("dueDate", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <ReactQuill
                value={form.description || ''}
                onChange={(value) => handleFormChange("description", value)}
                theme="snow"
                className="bg-white border border-gray-300 rounded-lg shadow-sm"
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, false] }],
                    ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                    [{'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
                    ['link'],
                    ['clean']
                  ],
                }}
                formats={[
                  'header',
                  'bold', 'italic', 'underline', 'strike', 'blockquote',
                  'list', 'bullet', 'indent',
                  'link'
                ]}
                placeholder="Enter task description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm cursor-pointer"
                value={form.status}
                onChange={(e) => handleFormChange("status", e.target.value)}
              >
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Related To
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm cursor-pointer"
                value={form.relationModel}
                onChange={(e) =>
                  handleFormChange("relationModel", e.target.value)
                }
              >
                <option value="Company">Company</option>
                <option value="Contact">Contact</option>
                <option value="Deal">Deal</option>
                <option value="Vendor">Vendor</option>
              </select>
            </div>

            {/* Related Entity Selection - Now with validation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select {form.relationModel} *
              </label>
              <div className="flex items-center space-x-2">
                <div className="w-full">
                  <SearchableDropdown
                    options={getOptions()}
                    value={form.relatedTo}
                    onChange={(value) => {
                      handleFormChange("relatedTo", value);
                      // Clear validation error when entity is selected
                      if (validationErrors.relatedTo) {
                        setValidationErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.relatedTo;
                          return newErrors;
                        });
                      }
                    }}
                    placeholder={`Select ${form.relationModel}`}
                    displayKey={getDisplayKey()}
                    valueKey="_id"
                    className="flex-1"
                    required={true}
                    error={validationErrors.relatedTo}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (form.relationModel === "Company") {
                      setShowQuickCompanyForm(true);
                    } else if (form.relationModel === "Contact") {
                      setShowQuickContactForm(true);
                    } else if (form.relationModel === "Deal") {
                      setShowQuickDealsForm(true);
                    } else if (form.relationModel === "Vendor") {
                      setShowQuickVendorForm(true);
                    }
                  }}
                  className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-300 cursor-pointer"
                  title={`Add New ${form.relationModel}`}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              {validationErrors.relatedTo && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.relatedTo}</p>
              )}
            </div>

            {/* User Assignment - Now with validation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assign Users * ({form.users.length} selected)
              </label>
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm mb-2"
              />
              <div className={`border rounded-lg p-3 max-h-40 overflow-y-auto bg-gray-50 shadow-sm ${
                validationErrors.users ? 'border-red-300' : 'border-gray-300'
              }`}>
                {filteredUsers.length === 0 ? (
                  <p className="text-gray-500 text-sm">No users found</p>
                ) : (
                  <div className="space-y-2">
                    {filteredUsers.map((user) => (
                      <label
                        key={user._id}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={form.users.includes(user._id)}
                          onChange={() => handleUserSelection(user._id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">
                          {user.name || user.email}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {validationErrors.users && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.users}</p>
              )}
            </div>
          </div>
          <div className="mt-4 sm:mt-5 md:mt-6 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="w-full sm:w-auto bg-gray-200 text-gray-800 px-4 sm:px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors shadow-sm order-2 sm:order-1 cursor-pointer"
            >
              Cancel
            </button>
            <button
              className="w-full sm:w-auto bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm order-1 sm:order-2 cursor-pointer"
              type="submit"
              disabled={loading}
            >
              {loading ? "Saving..." : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default QuickTaskForm;