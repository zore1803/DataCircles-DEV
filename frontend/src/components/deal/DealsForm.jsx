import React, { useEffect, useState } from "react";
import API from "../../services/api";
import SearchableDropdown from "../contact/SearchableDropdown";
import QuickCompanyForm from "../company/QuickCompanyForm";
import QuickContactForm from "../contact/QuickContactForm";
import CustomDropdown from "../common/CustomDropdown";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";

const DealsForm = ({
  form,
  setForm,
  additionalFieldValues,
  setAdditionalFieldValues,
  dealFields,
  companies,
  contacts,
  loading,
  setLoading,
  setError: propSetError,
  setSuccess: propSetSuccess,
  fetchDeals,
  fetchStatuses,
  onRequestClose,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);
  const [fieldDefinitions, setFieldDefinitions] = useState([]);
  const [statusOptions, setStatusOptions] = useState(["Open", "Won", "Lost"]);
  const [showQuickCompanyForm, setShowQuickCompanyForm] = useState(false);
  const [showQuickContactForm, setShowQuickContactForm] = useState(false);
  const [localCompanies, setLocalCompanies] = useState(companies);
  const [localContacts, setLocalContacts] = useState(contacts);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Add validation errors state
  const [validationErrors, setValidationErrors] = useState({});

  const [error, setErrorState] = useState(null);
  const [success, setSuccessState] = useState(null);

  const setError = (msg) => {
    setErrorState(msg);
    if (propSetError) propSetError(msg);
  };

  const setSuccess = (msg) => {
    setSuccessState(msg);
    if (propSetSuccess) propSetSuccess(msg);
  };

  useEffect(() => {
    setShouldRender(true);
    setTimeout(() => setIsOpen(true), 10);
    fetchFieldDefinitions();
    loadStatuses();
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

  const [isAddingStatus, setIsAddingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [boardId, setBoardId] = useState(null);

  // ... (previous useEffects)

  const loadStatuses = async () => {
    try {
      const res = await API.get("/kanban");
      setStatusOptions(res.data?.statuses || ["Open", "Won", "Lost"]);
      setBoardId(res.data?._id);
    } catch (error) {
      console.error("Error fetching statuses:", error);
      toast.error("Failed to fetch deal statuses");
    }
  };

  const handleAddStatus = async () => {
    if (!newStatus.trim()) {
      setIsAddingStatus(false);
      return;
    }

    if (statusOptions.includes(newStatus.trim())) {
      toast.error("Status already exists");
      return;
    }

    try {
      const updatedStatuses = [...statusOptions, newStatus.trim()];

      if (boardId) {
        await API.put(`/kanban/${boardId}`, { statuses: updatedStatuses });
      } else {
        const res = await API.post("/kanban", { statuses: updatedStatuses });
        setBoardId(res.data._id);
      }

      setStatusOptions(updatedStatuses);
      handleFormChange({ ...form, status: newStatus.trim() });
      if (fetchStatuses) fetchStatuses(); // Refresh parent/kanban
      toast.success("Status added successfully");
      setIsAddingStatus(false);
      setNewStatus("");
    } catch (error) {
      console.error("Failed to add status:", error);
      if (error.response?.status === 402) {
        toast.error(error.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(error.response?.data?.error || "Failed to add status");
      }
    }
  };


  const fetchFieldDefinitions = async () => {
    try {
      const res = await API.get("/deal-fields");
      if (res.data && res.data.fields) {
        setFieldDefinitions(res.data.fields);
      }
    } catch (err) {
      console.error("Failed to fetch field definitions");
      toast.error("Failed to fetch deal field definitions");
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
    }, 100);
  };

  const handleConfirmExit = () => {
    setShowConfirmDialog(false);
    closeForm();
  };

  const handleSaveAndExit = async () => {
    setShowConfirmDialog(false);
    await handleSubmit({ preventDefault: () => { } });
  };

  const handleCompanyCreated = (newCompany) => {
    setLocalCompanies((prev) => [...prev, newCompany]);
    setForm((prev) => ({ ...prev, company: newCompany._id }));
    setIsFormDirty(true);
    setShowQuickCompanyForm(false);

    // Clear validation error when company is selected
    if (validationErrors.company) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.company;
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
    setForm((prev) => ({ ...prev, contact: newContact._id }));
    setIsFormDirty(true);
    setShowQuickContactForm(false);

    // Clear validation error when contact is selected
    if (validationErrors.contact) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.contact;
        return newErrors;
      });
    }
  };

  const handleFormChange = (newFormData) => {
    setForm(newFormData);
    setIsFormDirty(true);

    // Clear validation errors for the changed fields
    const changedFields = Object.keys(newFormData).filter(
      key => newFormData[key] !== form[key]
    );

    if (changedFields.length > 0) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        changedFields.forEach(field => {
          if (newErrors[field]) {
            delete newErrors[field];
          }
        });
        return newErrors;
      });
    }
  };

  const renderFieldInput = (fieldDef, value) => {
    const handleFieldChange = (newValue) => {
      setAdditionalFieldValues((prev) => ({
        ...prev,
        [fieldDef.name]: newValue,
      }));
      setIsFormDirty(true);

      // Clear validation error for this field
      if (validationErrors[fieldDef.name]) {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[fieldDef.name];
          return newErrors;
        });
      }
    };

    const hasError = validationErrors[fieldDef.name];
    const inputClassName = `w-full border rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 transition-all placeholder:text-[#A0A0A0] font-inter ${hasError
      ? 'border-red-300 ring-1 ring-red-500'
      : 'border-[#E0E0E1] focus:ring-blue-500'
      }`;

    switch (fieldDef.type) {
      case "number":
        return (
          <input
            type="number"
            step="any"
            value={value || ""}
            onChange={(e) => handleFieldChange(e.target.value)}
            className={inputClassName}
            placeholder={`Enter ${fieldDef.name}`}
          />
        );

      case "dropdown":
        return (
          <CustomDropdown
            options={fieldDef.options || []}
            value={value || ""}
            onChange={(newValue) => handleFieldChange(newValue)}
            placeholder={`Select ${fieldDef.name}`}
            required={fieldDef.required}
          />
        );

      case "text":
        return (
          <textarea
            rows={3}
            value={value || ""}
            onChange={(e) => handleFieldChange(e.target.value)}
            className={`${inputClassName.replace('h-12', 'py-3')} resize-vertical`}
            placeholder={`Enter ${fieldDef.name}`}
          />
        );

      case "date":
        return (
          <input
            type="date"
            value={value || ""}
            onChange={(e) => handleFieldChange(e.target.value)}
            className={inputClassName}
          />
        );

      case "url":
        return (
          <input
            type="url"
            value={value || ""}
            onChange={(e) => handleFieldChange(e.target.value)}
            className={inputClassName}
            placeholder="https://example.com"
          />
        );

      case "multiselect":
        return (
          <div className="space-y-2">
            {fieldDef.options &&
              fieldDef.options.map((option, index) => {
                const selectedValues = Array.isArray(value) ? value : [];
                const isChecked = selectedValues.includes(option);

                return (
                  <label
                    key={index}
                    className="flex items-center gap-2 cursor-pointer hover:bg-[#F2F2F7] rounded-xl px-4 py-3 transition-colors border border-transparent hover:border-[#E0E0E1]"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        let newValues;
                        if (e.target.checked) {
                          newValues = [...selectedValues, option];
                        } else {
                          newValues = selectedValues.filter((v) => v !== option);
                        }
                        handleFieldChange(newValues);
                      }}
                      className="w-4 h-4 text-blue-600 border-[#E0E0E1] rounded focus:ring-blue-500"
                    />
                    <span className="text-[14px] text-gray-900 font-medium font-inter">{option}</span>
                  </label>
                );
              })}
            {(!fieldDef.options || fieldDef.options.length === 0) && (
              <p className="text-[14px] text-gray-400 italic px-4 py-2 font-inter">
                No options available
              </p>
            )}
          </div>
        );

      case "string":
      default:
        return (
          <input
            type="text"
            value={value || ""}
            onChange={(e) => handleFieldChange(e.target.value)}
            className={inputClassName}
            placeholder={`Enter ${fieldDef.name}`}
          />
        );
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();

    // Comprehensive validation
    let hasErrors = false;
    const errors = {};

    // Validate required fields
    if (!form.title || !form.title.trim()) {
      errors.title = "Title is required";
      hasErrors = true;
    }

    if (!form.amount || form.amount === "" || parseFloat(form.amount) <= 0) {
      errors.amount = "Amount is required and must be greater than 0";
      hasErrors = true;
    }

    // Validate required company
    if (!form.company) {
      errors.company = "Please select a company";
      hasErrors = true;
    }

    // Validate required contact
    if (!form.contact) {
      errors.contact = "Please select a contact";
      hasErrors = true;
    }

    // Check required additional fields
    fieldDefinitions.forEach((fieldDef) => {
      if (fieldDef.required) {
        const value = additionalFieldValues[fieldDef.name];
        if (!value || value.toString().trim() === "") {
          errors[fieldDef.name] = `${fieldDef.name} is required`;
          hasErrors = true;
        }
      }
    });

    if (hasErrors) {
      setValidationErrors(errors);
      toast.error("Please fill in all required fields");
      return;
    }

    const processedAdditionalFields = fieldDefinitions
      .map((fieldDef) => {
        const value = additionalFieldValues[fieldDef.name] || "";
        return {
          key: fieldDef.name,
          value: value,
          type: fieldDef.type,
        };
      })
      .filter((field) => field.value !== "");

    const payload = {
      ...form,
      additionalFields: processedAdditionalFields,
    };

    try {
      setLoading(true);
      if (form._id) {
        await API.put(`/deals/${form._id}`, payload);
        setSuccess("Deal updated successfully!");
      } else {
        await API.post("/deals", payload);
        setSuccess("Deal added successfully!");
      }
      await fetchDeals();
      setIsFormDirty(false);
      setTimeout(() => setSuccess(""), 3000);
      closeForm();
    } catch (err) {
      if (err.response?.status === 402) {
        const errorMessage = err.response.data?.message || err.response.data?.error || "Subscription required. Please upgrade your plan.";
        setError(errorMessage);
      } else if (err.response?.status === 403) {
        const errorMessage = err.response.data.error || "Access denied";
        const match = errorMessage.match(/\((\d+)\/(\d+)\s*records/);
        if (match) {
          const used = match[1];
          const limit = match[2];
          setError(
            <span>
              Record limit reached ({used}/{limit}). Please{" "}
              <a href="/pricing">upgrade your plan</a> to add more records.
            </span>
          );
        } else if (errorMessage.includes("Subscription expired")) {
          setError(
            "Subscription expired. Please renew to add or update deals."
          );
        } else if (errorMessage.includes("Write access to deals not allowed")) {
          setError(
            "Your plan does not allow adding or updating deals. Please upgrade your plan."
          );
        } else {
          setError(errorMessage);
        }
        closeForm();
      } else {
        const errorMessage = err.response?.data?.message || err.response?.data?.error || (form._id ? "Failed to update deal. Please try again." : "Failed to add deal. Please try again.");
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

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

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 z-[10002] flex items-center justify-center">
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

      {/* Backdrop */}
      <div
        className="fixed top-0 left-0 w-screen h-screen bg-black/20 z-[10000] transition-opacity duration-300 ease-in-out"
        style={{ opacity: isOpen ? 1 : 0 }}
        onClick={handleClose}
      />

      {/* Modal Container */}
      <div
        className={`fixed top-0 right-0 h-screen z-[10001] w-full md:w-[600px] bg-white shadow-2xl overflow-y-auto transform transition-transform duration-300 ease-in-out font-inter ${isOpen ? "translate-x-0" : "translate-x-full"
          }`}
      >
        <form onSubmit={handleSubmit} className="p-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-[24px] font-bold text-[#111216]">
              {form._id ? "Edit Deal" : "Create New Deal"}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Deal Made <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) =>
                  handleFormChange({ ...form, title: e.target.value })
                }
                className={`w-full border rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 transition-all placeholder:text-[#A0A0A0] font-inter ${validationErrors.title ? 'border-red-300 ring-1 ring-red-500' : 'border-[#E0E0E1] focus:ring-blue-500'
                  }`}
                placeholder="Enter Deal Title"
                required
              />
              {validationErrors.title && (
                <p className="text-red-500 text-xs mt-1 font-inter">{validationErrors.title}</p>
              )}
            </div>

            {/* Amount */}
            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) =>
                  handleFormChange({ ...form, amount: e.target.value })
                }
                className={`w-full border rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 transition-all placeholder:text-[#A0A0A0] font-inter ${validationErrors.amount ? 'border-red-300 ring-1 ring-red-500' : 'border-[#E0E0E1] focus:ring-blue-500'
                  }`}
                placeholder="Enter Deal Amount"
                min={"0"}
                step={"1"}
                required
              />
              {validationErrors.amount && (
                <p className="text-red-500 text-xs mt-1 font-inter">{validationErrors.amount}</p>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Status <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <SearchableDropdown
                  options={statusOptions.map(opt => ({ name: opt, _id: opt }))}
                  value={form.status}
                  onChange={(value) =>
                    handleFormChange({ ...form, status: value })
                  }
                  placeholder="Choose Status of the Deal"
                  displayKey="name"
                  valueKey="_id"
                  className="flex-1"
                  required={true}
                />

                {isAddingStatus ? (
                  <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-4 duration-200">
                    <input
                      type="text"
                      className="w-32 h-12 border border-[#E0E0E1] rounded-xl px-3 text-[14px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="New Status"
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddStatus();
                        } else if (e.key === 'Escape') {
                          setIsAddingStatus(false);
                        }
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddStatus}
                      className="w-10 h-10 flex items-center justify-center bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                      title="Save Status"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingStatus(false)}
                      className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                      title="Cancel"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingStatus(true)}
                    className="w-12 h-12 flex items-center justify-center bg-[#F2F2F7] text-[#111216] rounded-xl hover:bg-gray-200 transition-colors border border-[#E0E0E1] cursor-pointer"
                    title="Add New Status"
                  >
                    <Plus className="w-5 h-5 text-gray-600" />
                  </button>
                )}
              </div>
            </div>

            {/* Company with Add New Button - NOW REQUIRED */}
            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Company <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <SearchableDropdown
                  options={localCompanies}
                  value={form.company}
                  onChange={(value) =>
                    handleFormChange({ ...form, company: value })
                  }
                  placeholder="Select Company"
                  displayKey="name"
                  valueKey="_id"
                  className="flex-1"
                  required={true}
                  error={validationErrors.company}
                />
                <button
                  type="button"
                  onClick={() => setShowQuickCompanyForm(true)}
                  className="w-12 h-12 flex items-center justify-center bg-[#F2F2F7] text-[#111216] rounded-xl hover:bg-gray-200 transition-colors border border-[#E0E0E1] cursor-pointer"
                  title="Add New Company"
                >
                  <Plus className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              {validationErrors.company && (
                <p className="text-red-500 text-xs mt-1 font-inter">{validationErrors.company}</p>
              )}
            </div>

            {/* Contact with Add New Button - NOW REQUIRED */}
            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Contact <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <SearchableDropdown
                  options={localContacts}
                  value={form.contact}
                  onChange={(value) =>
                    handleFormChange({ ...form, contact: value })
                  }
                  placeholder="Choose Contact"
                  displayKey="displayName"
                  valueKey="_id"
                  className="flex-1"
                  required={true}
                  error={validationErrors.contact}
                />
                <button
                  type="button"
                  onClick={() => setShowQuickContactForm(true)}
                  className="w-12 h-12 flex items-center justify-center bg-[#F2F2F7] text-[#111216] rounded-xl hover:bg-gray-200 transition-colors border border-[#E0E0E1] cursor-pointer"
                  title="Add New Contact"
                >
                  <Plus className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              {validationErrors.contact && (
                <p className="text-red-500 text-xs mt-1 font-inter">{validationErrors.contact}</p>
              )}
            </div>

            {/* Dynamic Additional Fields */}
            {fieldDefinitions.length > 0 && (
              <div className="pt-4 space-y-6">
                <h3 className="text-[16px] font-bold text-[#111216]">
                  Additional Information
                </h3>
                <div className="space-y-4">
                  {fieldDefinitions.map((fieldDef) => (
                    <div key={fieldDef.name}>
                      <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                        {fieldDef.name} {fieldDef.required && <span className="text-red-500">*</span>}
                      </label>
                      {renderFieldInput(
                        fieldDef,
                        additionalFieldValues[fieldDef.name]
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 text-xs font-sf text-red-600 border border-red-200">
              {error}
            </div>
          )}
          {success && (
            <div className="mt-4 p-3 rounded-lg bg-green-50 text-xs font-sf text-green-600 border border-green-200">
              {success}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-12 pt-6 border-t border-[#F2F2F7] flex gap-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 border border-[#E0E0E1] text-[#111216] h-12 rounded-xl text-[14px] font-bold hover:bg-gray-50 transition-colors font-inter"
            >
              Cancel
            </button>
            <button
              className="flex-1 bg-[#0C4FCD] text-white h-12 rounded-xl text-[14px] font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-inter"
              type="submit"
              disabled={loading}
            >
              {loading ? "Saving..." : form._id ? "Update Deal" : "Create New Deal"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default DealsForm;