import React, { useEffect, useState } from "react";
import API from "../../services/api";
import SearchableDropdown from "../contact/SearchableDropdown"; // Adjust path if needed
import { FolderOpen, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";

const DealForm = ({
  form,
  setForm,
  additionalFieldValues = {},
  setAdditionalFieldValues,
  dealFields = [],
  companies = [], // Pass from parent
  contacts = [],  // Pass from parent
  loading,
  setLoading,
  setError: propSetError,
  setSuccess: propSetSuccess,
  fetchDeals, // Callback to refresh data
  onRequestClose,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);

  // States for tracking changes and validation
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
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

  // Standard Kanban Statuses
  const dealStatuses = ["Open", "Won", "Lost"];

  useEffect(() => {
    setShouldRender(true);
    setTimeout(() => setIsOpen(true), 10);
    return () => setIsOpen(false);
  }, []);

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
      setShouldRender(false);
    }, 300);
  };

  const handleConfirmExit = () => {
    setShowConfirmDialog(false);
    closeForm();
  };

  const handleSaveAndExit = async () => {
    setShowConfirmDialog(false);
    await handleSubmit({ preventDefault: () => {} });
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setIsFormDirty(true);
    
    // Clear validation error when user types
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleAdditionalFieldChange = (fieldName, newValue) => {
    setAdditionalFieldValues((prev) => ({ ...prev, [fieldName]: newValue }));
    setIsFormDirty(true);

    if (validationErrors[`additional_${fieldName}`]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`additional_${fieldName}`];
        return newErrors;
      });
    }
  };

  const safeTrim = (val) => String(val || "").trim();

  const validateForm = () => {
    const errors = {};

    // Mandatory System Fields
    if (!safeTrim(form.title)) errors.title = "Deal Title is required";
    if (!safeTrim(form.amount)) errors.amount = "Amount is required";
    if (!form.status) errors.status = "Status is required";
    if (!form.company) errors.company = "Company is required";
    if (!form.contact) errors.contact = "Contact is required";

    // Custom Fields
    dealFields?.forEach((fieldDef) => {
      if (fieldDef.required) {
        const value = additionalFieldValues[fieldDef.name];
        if (!value || String(value).trim() === "") {
          errors[`additional_${fieldDef.name}`] = `${fieldDef.name} is required`;
        }
      }
    });

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);

      // Process Dynamic Additional Fields
      let processedAdditionalFields = [];
      if (dealFields && dealFields.length > 0) {
        processedAdditionalFields = dealFields
          .map((fieldDef) => {
            let value = additionalFieldValues[fieldDef.name] || "";
            if (Array.isArray(value)) value = value.join(", "); // Convert multiselect arrays

            return {
              key: fieldDef.name,
              value: value,
              type: fieldDef.type,
              category: fieldDef.category || "Uncategorized"
            };
          })
          .filter((field) => field.value !== "");
      }

      // JSON Payload (No files, so we don't need FormData!)
      const payload = {
        title: form.title,
        amount: Number(form.amount) || 0,
        status: form.status || "Open",
        company: form.company,
        contact: form.contact,
        additionalFields: processedAdditionalFields,
      };

      if (form._id) {
        await API.put(`/deals/${form._id}`, payload);
        if (setSuccess) setSuccess("Deal updated successfully!");
        else toast.success("Deal updated successfully!");
      } else {
        await API.post("/deals", payload);
        if (setSuccess) setSuccess("Deal added successfully!");
        else toast.success("Deal added successfully!");
      }

      if (fetchDeals) await fetchDeals();
      setIsFormDirty(false);
      closeForm(); // Close smoothly

    } catch (err) {
      console.error(err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || "Failed to save deal";
      
      if (err.response && err.response.status === 402) {
        const msg = err.response.data?.message || err.response.data?.error || "Subscription required. Please upgrade your plan.";
        setError(msg);
      } else if (err.response && err.response.status === 403) {
        if (errorMessage.includes("records")) setError("Record limit reached. Please upgrade your plan.");
        else if (errorMessage.includes("expired")) setError("Subscription expired. Please renew.");
        else setError("You do not have permission to modify deals.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // --- Type Normalizer & Renderer ---
  const renderFieldInput = (fieldDef, rawValue) => {
    const hasError = validationErrors[`additional_${fieldDef.name}`];
    const value = rawValue !== undefined && rawValue !== null ? rawValue : "";
    
    const typeStr = (fieldDef.type || "").toLowerCase();
    let normalizedType = "string";

    if (typeStr.includes("multi-line") || typeStr === "text") normalizedType = "text";
    else if (typeStr.includes("number")) normalizedType = "number";
    else if (typeStr.includes("dropdown")) normalizedType = "dropdown";
    else if (typeStr.includes("url")) normalizedType = "url";
    else if (typeStr.includes("date")) normalizedType = "date";
    else if (typeStr.includes("multi-select") || typeStr.includes("checkbox") || typeStr === "multiselect") normalizedType = "multiselect";

    const baseInputClass = `w-full border rounded-xl px-4 text-[14px] text-gray-900 focus:outline-none focus:ring-1 transition-all placeholder:text-[#A0A0A0] ${
      hasError ? 'border-red-500 focus:ring-red-500' : 'border-[#E0E0E1] focus:ring-blue-500'
    }`;

    switch (normalizedType) {
      case "number":
        return (
          <><input type="number" step="any" value={value} onChange={(e) => handleAdditionalFieldChange(fieldDef.name, e.target.value)} className={`${baseInputClass} h-12`} placeholder={`Enter ${fieldDef.name}`} />{hasError && <p className="text-red-500 text-xs mt-1">{hasError}</p>}</>
        );
      case "dropdown":
        return (
          <><select value={value} onChange={(e) => handleAdditionalFieldChange(fieldDef.name, e.target.value)} className={`${baseInputClass} h-12 cursor-pointer`}><option value="">Select {fieldDef.name}</option>{fieldDef.options && fieldDef.options.map((option, index) => (<option key={index} value={option}>{option}</option>))}</select>{hasError && <p className="text-red-500 text-xs mt-1">{hasError}</p>}</>
        );
      case "text":
        return (
          <><textarea rows={3} value={value} onChange={(e) => handleAdditionalFieldChange(fieldDef.name, e.target.value)} className={`${baseInputClass} py-3 resize-vertical`} placeholder={`Enter ${fieldDef.name}`} />{hasError && <p className="text-red-500 text-xs mt-1">{hasError}</p>}</>
        );
      case "date":
        const formattedDate = value && value.includes("T") ? value.split("T")[0] : value;
        return (
          <><input type="date" value={formattedDate} onChange={(e) => handleAdditionalFieldChange(fieldDef.name, e.target.value)} className={`${baseInputClass} h-12`} />{hasError && <p className="text-red-500 text-xs mt-1">{hasError}</p>}</>
        );
      case "url":
        return (
          <><input type="url" value={value} onChange={(e) => handleAdditionalFieldChange(fieldDef.name, e.target.value)} className={`${baseInputClass} h-12`} placeholder="https://example.com" />{hasError && <p className="text-red-500 text-xs mt-1">{hasError}</p>}</>
        );
      case "multiselect":
        return (
          <>
            <div className={`space-y-2 ${hasError ? 'border border-red-300 rounded-xl p-3' : ''}`}>
              {fieldDef.options && fieldDef.options.length > 0 ? fieldDef.options.map((option, index) => {
                let selectedValues = [];
                if (Array.isArray(value)) selectedValues = value;
                else if (typeof value === "string" && value.trim() !== "") selectedValues = value.split(",").map((v) => v.trim());
                const isChecked = selectedValues.includes(option.trim());
                return (
                  <label key={index} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors">
                    <input type="checkbox" checked={isChecked} onChange={(e) => {
                      let newValues;
                      if (e.target.checked) newValues = [...selectedValues, option.trim()];
                      else newValues = selectedValues.filter((v) => v !== option.trim());
                      handleAdditionalFieldChange(fieldDef.name, newValues);
                    }} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2" />
                    <span className="text-[14px] text-gray-900">{option}</span>
                  </label>
                );
              }) : <p className="text-sm text-gray-500 italic px-3 py-2">No options available</p>}
            </div>
            {hasError && <p className="text-red-500 text-xs mt-1">{hasError}</p>}
          </>
        );
      case "string":
      default:
        return (
          <><input type="text" value={value} onChange={(e) => handleAdditionalFieldChange(fieldDef.name, e.target.value)} className={`${baseInputClass} h-12`} placeholder={`Enter ${fieldDef.name}`} />{hasError && <p className="text-red-500 text-xs mt-1">{hasError}</p>}</>
        );
    }
  };

  if (!shouldRender) return null;

  // --- CATEGORY GROUPING ---
  const [expandedSections, setExpandedSections] = useState({});
  const toggleSection = (category) => setExpandedSections((prev) => ({ ...prev, [category]: !prev[category] }));

  useEffect(() => {
    if (dealFields && dealFields.length > 0) {
      const defaultExpanded = {};
      dealFields.forEach((fieldDef) => {
        const cat = (fieldDef.category && typeof fieldDef.category === 'string') ? fieldDef.category : "Uncategorized";
        defaultExpanded[cat] = true;
      });
      setExpandedSections(defaultExpanded);
    }
  }, [dealFields]);

  const groupedFields = (dealFields || []).reduce((acc, fieldDef) => {
    const cat = (fieldDef.category && typeof fieldDef.category === 'string') ? fieldDef.category : "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(fieldDef);
    return acc;
  }, {});

  const sortedCategories = Object.keys(groupedFields).sort((a, b) => {
    if (a === "Uncategorized") return 1;
    if (b === "Uncategorized") return -1;
    return a.localeCompare(b);
  });

  return (
    <>
      {/* Unsaved Changes Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 z-[10002] flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Unsaved Changes</h3>
            <p className="text-sm text-gray-600 mb-6">You have unsaved changes. Are you sure you want to exit without saving?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowConfirmDialog(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
              <button onClick={handleConfirmExit} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Exit Without Saving</button>
              <button onClick={handleSaveAndExit} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save and Exit</button>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-[10000] transition-opacity duration-300" style={{ opacity: isOpen ? 1 : 0 }} onClick={handleClose} />

      {/* Sliding Side Panel */}
      <div className={`fixed inset-y-0 right-0 z-[10001] w-full sm:w-[500px] md:w-[600px] lg:w-[700px] xl:w-[800px] bg-white shadow-2xl transform transition-transform duration-300 flex flex-col font-inter ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          
          {/* Header */}
          <div className="flex justify-between items-center p-6 sm:p-8 border-b border-gray-100">
            <h2 className="text-[24px] font-bold text-[#111216]">{form._id ? "Edit Deal" : "Create New Deal"}</h2>
            <button type="button" onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
              {/* Title */}
              <div className="md:col-span-2">
                <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">Deal Title <span className="text-red-500">*</span></label>
                <input type="text" value={form.title || ""} onChange={(e) => handleFormChange("title", e.target.value)} className={`w-full border rounded-xl px-4 h-12 text-[14px] focus:outline-none focus:ring-1 transition-all ${validationErrors.title ? 'border-red-500 focus:ring-red-500' : 'border-[#E0E0E1] focus:ring-blue-500'}`} placeholder="E.g., Q3 Software License" />
                {validationErrors.title && <p className="text-red-500 text-xs mt-1">{validationErrors.title}</p>}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">Amount <span className="text-red-500">*</span></label>
                <input type="number" value={form.amount || ""} onChange={(e) => handleFormChange("amount", e.target.value)} className={`w-full border rounded-xl px-4 h-12 text-[14px] focus:outline-none focus:ring-1 transition-all ${validationErrors.amount ? 'border-red-500 focus:ring-red-500' : 'border-[#E0E0E1] focus:ring-blue-500'}`} placeholder="Enter amount" />
                {validationErrors.amount && <p className="text-red-500 text-xs mt-1">{validationErrors.amount}</p>}
              </div>

              {/* Status */}
              <div>
                <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">Status <span className="text-red-500">*</span></label>
                <select value={form.status || "Open"} onChange={(e) => handleFormChange("status", e.target.value)} className={`w-full border rounded-xl px-4 h-12 text-[14px] cursor-pointer focus:outline-none focus:ring-1 transition-all ${validationErrors.status ? 'border-red-500 focus:ring-red-500' : 'border-[#E0E0E1] focus:ring-blue-500'}`}>
                  {dealStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {validationErrors.status && <p className="text-red-500 text-xs mt-1">{validationErrors.status}</p>}
              </div>

              {/* Company (Searchable Dropdown) */}
              <div>
                <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">Company <span className="text-red-500">*</span></label>
                <div className="w-full">
                  <SearchableDropdown
                    options={companies}
                    value={form.company}
                    onChange={(value) => handleFormChange("company", value)}
                    placeholder="Select Company"
                    displayKey="name"
                    valueKey="_id"
                    error={validationErrors.company}
                  />
                </div>
                {validationErrors.company && <p className="text-red-500 text-xs mt-1">{validationErrors.company}</p>}
              </div>

              {/* Contact (Searchable Dropdown) */}
              <div>
                <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">Contact Person <span className="text-red-500">*</span></label>
                <div className="w-full">
                  <SearchableDropdown
                    options={contacts}
                    value={form.contact}
                    onChange={(value) => handleFormChange("contact", value)}
                    placeholder="Select Contact"
                    displayKey="name"
                    valueKey="_id"
                    error={validationErrors.contact}
                  />
                </div>
                {validationErrors.contact && <p className="text-red-500 text-xs mt-1">{validationErrors.contact}</p>}
              </div>
            </div>

            {/* Dynamic Collapsible Additional Fields */}
            {sortedCategories.length > 0 && (
              <div className="pt-4 space-y-4">
                <h3 className="text-[16px] font-bold text-[#111216]">Additional Information</h3>
                {sortedCategories.map((category) => (
                  <div key={category} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <button type="button" onClick={() => toggleSection(category)} className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors focus:outline-none">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-indigo-600" />
                        <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">{category}</span>
                        <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium ml-2">{groupedFields[category].length}</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${expandedSections[category] ? "rotate-180" : ""}`} />
                    </button>
                    {expandedSections[category] && (
                      <div className="p-5 bg-white border-t border-gray-200 space-y-5">
                        {groupedFields[category].map((fieldDef) => (
                          <div key={fieldDef.name}>
                            <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                              {fieldDef.name} {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
                              <span className="text-xs text-gray-500 ml-2 font-normal">({fieldDef.type})</span>
                            </label>
                            {renderFieldInput(fieldDef, additionalFieldValues[fieldDef.name])}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="mx-6 sm:mx-8 mt-4 p-3 rounded-lg bg-red-50 text-xs font-sf text-red-600 border border-red-200">
              {error}
            </div>
          )}
          {success && (
            <div className="mx-6 sm:mx-8 mt-4 p-3 rounded-lg bg-green-50 text-xs font-sf text-green-600 border border-green-200">
              {success}
            </div>
          )}

          {/* Footer */}
          <div className="px-6 sm:px-8 py-4 border-t border-gray-100 flex justify-between gap-4 bg-gray-50/50 mt-auto">
            <button type="button" onClick={handleClose} className="flex-1 px-4 py-3 border border-[#E0E0E1] text-[#111216] rounded-xl text-[14px] font-bold hover:bg-gray-100 bg-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-3 bg-[#0C4FCD] text-white rounded-xl text-[14px] font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loading ? "Saving..." : form._id ? "Update Deal" : "Create New Deal"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default DealForm;