import React, { useEffect, useState } from "react";
import API from "../../services/api";
import SearchableDropdown from "../contact/SearchableDropdown";
import QuickCompanyForm from "../company/QuickCompanyForm";
import QuickContactForm from "../contact/QuickContactForm";
import QuickDealForm from "../deal/QuickDealForm";
import QuickVendorForm from "../vendor/QuickVendorForm";
import { Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import ReactQuill from 'react-quill-new';

const TaskForm = ({
  form,
  setForm,
  companies,
  contacts,
  deals,
  vendors,
  users,
  loading,
  onSubmit,
  onCancel,
  fetchTasks,
}) => {
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
  const [localDeals, setLocalDeals] = useState(deals);
  const [localVendors, setLocalVendors] = useState(vendors);
  const [validationErrors, setValidationErrors] = useState({});

  // Initialize relatedEntities if it doesn't exist or if form has old structure
  useEffect(() => {
    if (form && (!form.relatedEntities || form.relatedEntities.length === 0)) {
      // Check if old structure exists (relatedTo and relationModel)
      if (form.relatedTo && form.relationModel) {
        setForm({
          ...form,
          relatedEntities: [{
            entityModel: form.relationModel,
            entityId: form.relatedTo
          }]
        });
      } else {
        // Initialize with empty Company entity
        setForm({
          ...form,
          relatedEntities: [{ entityModel: "Company", entityId: "" }]
        });
      }
    }
  }, []);

  // Handle open animation and sync local state with props
  useEffect(() => {
    setShouldRender(true);
    setTimeout(() => setIsOpen(true), 10);
    setLocalCompanies(companies);
    setLocalContacts(
      contacts.map(contact => ({
        ...contact,
        displayName: `${contact.name} (${contact.company?.name || 'No Company'})`
      }))
    );
    setLocalDeals(deals);
    setLocalVendors(vendors);
    return () => {
      setIsOpen(false);
    };
  }, [companies, contacts, deals, vendors]);

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
      onCancel();
      setShouldRender(false);
    }, 300);
  };

  const handleConfirmExit = () => {
    setShowConfirmDialog(false);
    closeForm();
  };

  const handleSaveAndExit = async () => {
    setShowConfirmDialog(false);
    await handleSubmitWithValidation({ preventDefault: () => {} });
  };

  // Add new related entity
  const addRelatedEntity = () => {
    const existingTypes = form.relatedEntities.map(e => e.entityModel);
    
    let nextType = "Company";
    if (!existingTypes.includes("Company")) {
      nextType = "Company";
    } else if (!existingTypes.includes("Contact")) {
      nextType = "Contact";
    } else if (!existingTypes.includes("Deal")) {
      nextType = "Deal";
    } else if (!existingTypes.includes("Vendor")) {
      nextType = "Vendor";
    } else {
      toast.error("Maximum related entities reached");
      return;
    }
    
    setForm({
      ...form,
      relatedEntities: [
        ...form.relatedEntities,
        { entityModel: nextType, entityId: "" }
      ]
    });
    setIsFormDirty(true);
  };

  // Update related entity at specific index
  const updateRelatedEntity = (index, field, value) => {
    const updated = [...form.relatedEntities];
    updated[index] = { ...updated[index], [field]: value };
    
    // If changing model type, reset entityId
    if (field === 'entityModel') {
      updated[index].entityId = "";
    }
    
    setForm({
      ...form,
      relatedEntities: updated
    });
    setIsFormDirty(true);
    
    if (validationErrors.relatedEntities) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.relatedEntities;
        return newErrors;
      });
    }
  };

  // Remove related entity at specific index
  const removeRelatedEntity = (index) => {
    if (form.relatedEntities.length === 1) {
      toast.error("At least one related entity is required");
      return;
    }
    
    setForm({
      ...form,
      relatedEntities: form.relatedEntities.filter((_, i) => i !== index)
    });
    setIsFormDirty(true);
  };

  // Get available types for dropdown at specific index
  const getAvailableTypes = (currentIndex) => {
    const existingTypes = form.relatedEntities
      .map((e, i) => i !== currentIndex ? e.entityModel : null)
      .filter(Boolean);
    
    const allTypes = ["Company", "Contact", "Deal", "Vendor"];
    
    return allTypes.filter(type => {
      // Deal and Vendor can only appear once
      if ((type === "Deal" || type === "Vendor") && existingTypes.includes(type)) {
        return false;
      }
      return true;
    });
  };

  // Handle user selection for multiple users
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
    
    if (validationErrors.users) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.users;
        return newErrors;
      });
    }
  };

  // Handle form changes with validation error clearing
  const handleFormChange = (newFormData) => {
    setForm(newFormData);
    setIsFormDirty(true);
    
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

  // Handle creation of new entities
  const handleCompanyCreated = (newCompany) => {
    setLocalCompanies((prev) => [...prev, newCompany]);
    const companyIndex = form.relatedEntities.findIndex(e => e.entityModel === "Company" && !e.entityId);
    if (companyIndex !== -1) {
      updateRelatedEntity(companyIndex, "entityId", newCompany._id);
    }
    setShowQuickCompanyForm(false);
  };

  const handleContactCreated = (newContact) => {
    const contactWithDisplay = {
      ...newContact,
      displayName: `${newContact.name} (${newContact.company?.name || 'No Company'})`
    };
    setLocalContacts((prev) => [...prev, contactWithDisplay]);
    const contactIndex = form.relatedEntities.findIndex(e => e.entityModel === "Contact" && !e.entityId);
    if (contactIndex !== -1) {
      updateRelatedEntity(contactIndex, "entityId", newContact._id);
    }
    setShowQuickContactForm(false);
  };

  const handleDealCreated = (newDeal) => {
    setLocalDeals((prev) => [...prev, newDeal]);
    const dealIndex = form.relatedEntities.findIndex(e => e.entityModel === "Deal");
    if (dealIndex !== -1) {
      updateRelatedEntity(dealIndex, "entityId", newDeal._id);
    }
    setShowQuickDealsForm(false);
  };

  const handleVendorCreated = (newVendor) => {
    setLocalVendors((prev) => [...prev, newVendor]);
    const vendorIndex = form.relatedEntities.findIndex(e => e.entityModel === "Vendor");
    if (vendorIndex !== -1) {
      updateRelatedEntity(vendorIndex, "entityId", newVendor._id);
    }
    setShowQuickVendorForm(false);
  };

  // Get options for entity dropdown
  const getOptionsForEntity = (entityModel) => {
    const map = {
      Company: localCompanies,
      Contact: localContacts,
      Deal: localDeals,
      Vendor: localVendors,
    };
    return map[entityModel] || [];
  };

  const getDisplayKeyForEntity = (entityModel) => {
    if (entityModel === "Deal") return "title";
    if (entityModel === "Contact") return "displayName";
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
    
    if (!form.title || !form.title.trim()) {
      errors.title = "Task title is required";
    }
    
    if (!form.users || form.users.length === 0) {
      errors.users = "At least one user must be assigned to this task";
    }
    
    // Validate all related entities have selected values
    const hasEmptyEntity = form.relatedEntities?.some(e => !e.entityId);
    if (!form.relatedEntities || form.relatedEntities.length === 0 || hasEmptyEntity) {
      errors.relatedEntities = "All related entities must have a selection";
    }
    
    return errors;
  };

  // Enhanced submit handler with validation
  const handleSubmitWithValidation = async (e) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error("Please fill in all required fields");
      return;
    }
    
    await onSubmit(e);
  };

  if (!shouldRender) return null;

  return (
    <>
      {showQuickCompanyForm && (
        <QuickCompanyForm
          onCompanyCreated={handleCompanyCreated}
          onRequestClose={() => setShowQuickCompanyForm(false)}
        />
      )}

      {showQuickContactForm && (
        <QuickContactForm
          companies={localCompanies}
          onContactCreated={handleContactCreated}
          onRequestClose={() => setShowQuickContactForm(false)}
        />
      )}

      {showQuickDealsForm && (
        <QuickDealForm
          companies={localCompanies}
          contacts={localContacts}
          onDealCreated={handleDealCreated}
          onRequestClose={() => setShowQuickDealsForm(false)}
        />
      )}

      {showQuickVendorForm && (
        <QuickVendorForm
          onVendorCreated={handleVendorCreated}
          onRequestClose={() => setShowQuickVendorForm(false)}
        />
      )}

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

      <div
        className="fixed inset-0 bg-black/20 z-[10000] transition-opacity duration-300 ease-in-out"
        style={{ opacity: isOpen ? 1 : 0 }}
        onClick={handleClose}
      />

      <div
        className={`fixed inset-y-0 right-0 z-[10000] w-full md:w-[600px] bg-white shadow-2xl overflow-y-auto transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <form onSubmit={handleSubmitWithValidation} className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {form._id ? "Edit Task" : "Create New Task"}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            {/* Task Title */}
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
                onChange={(e) =>
                  handleFormChange({ ...form, title: e.target.value })
                }
                required
              />
              {validationErrors.title && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.title}</p>
              )}
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                value={form.dueDate}
                onChange={(e) =>
                  handleFormChange({ ...form, dueDate: e.target.value })
                }
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <ReactQuill
                value={form.description || ''}
                onChange={(value) => handleFormChange({ ...form, description: value })}
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

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm cursor-pointer"
                value={form.status}
                onChange={(e) =>
                  handleFormChange({ ...form, status: e.target.value })
                }
              >
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            {/* Related Entities */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Related To *
                </label>
                <button
                  type="button"
                  onClick={addRelatedEntity}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1 cursor-pointer"
                  disabled={form.relatedEntities?.length >= 4}
                >
                  <Plus className="w-4 h-4" />
                  Add More
                </button>
              </div>

              {validationErrors.relatedEntities && (
                <p className="text-red-500 text-xs mb-2">{validationErrors.relatedEntities}</p>
              )}

              <div className="space-y-3">
                {form.relatedEntities?.map((entity, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        {/* Entity Type Selector */}
                        <select
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm cursor-pointer"
                          value={entity.entityModel}
                          onChange={(e) => updateRelatedEntity(index, "entityModel", e.target.value)}
                        >
                          {getAvailableTypes(index).map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>

                        {/* Entity Selection */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <SearchableDropdown
                              options={getOptionsForEntity(entity.entityModel)}
                              value={entity.entityId}
                              onChange={(value) => updateRelatedEntity(index, "entityId", value)}
                              placeholder={`Select ${entity.entityModel}`}
                              displayKey={getDisplayKeyForEntity(entity.entityModel)}
                              valueKey="_id"
                              required={true}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (entity.entityModel === "Company") {
                                setShowQuickCompanyForm(true);
                              } else if (entity.entityModel === "Contact") {
                                setShowQuickContactForm(true);
                              } else if (entity.entityModel === "Deal") {
                                setShowQuickDealsForm(true);
                              } else if (entity.entityModel === "Vendor") {
                                setShowQuickVendorForm(true);
                              }
                            }}
                            className="p-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-300 cursor-pointer"
                            title={`Add New ${entity.entityModel}`}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Remove Button */}
                      {form.relatedEntities.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRelatedEntity(index)}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer mt-7"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* User Assignment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assign Users * ({form.users ? form.users.length : 0} selected)
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
                          checked={form.users ? form.users.includes(user._id) : false}
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

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors shadow-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
              type="submit"
              disabled={loading}
            >
              {loading ? "Saving..." : form._id ? "Update Task" : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default TaskForm;
