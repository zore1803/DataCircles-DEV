import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import API from "../../services/api";
import SearchableDropdown from "./SearchableDropdown";
import CustomDropdown from "../common/CustomDropdown";
import QuickCompanyForm from "../company/QuickCompanyForm";
import { Plus, X, Paperclip } from "lucide-react";
import toast from "react-hot-toast";

const QuickContactForm = ({ companies, onContactCreated, onContactUpdated, onRequestClose, initialCompanyId = "", editContact = null }) => {
  const isEditing = !!editContact;
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: initialCompanyId,
    leadSource: "",
  });
  const [additionalFields, setAdditionalFields] = useState({});
  const [fieldDefinitions, setFieldDefinitions] = useState([]);
  const [profilePicture, setProfilePicture] = useState(null);
  const profilePictureInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const companyRef = useRef(null);
  const phoneInputRef = useRef(null);
  const leadSourceRef = useRef(null);
  // Object URL for the currently picked file, so the preview shows the actual
  // image instead of just its filename. Revoked whenever the selection
  // changes or the form unmounts, since object URLs otherwise leak.
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  useEffect(() => {
    if (!profilePicture) {
      setProfilePicturePreview(null);
      return;
    }
    const url = URL.createObjectURL(profilePicture);
    setProfilePicturePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [profilePicture]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);
  const [showQuickCompanyForm, setShowQuickCompanyForm] = useState(false);
  const [localCompanies, setLocalCompanies] = useState(companies);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Add validation state
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    setShouldRender(true);
    setTimeout(() => setIsOpen(true), 10);
    fetchFieldDefinitions();
    setLocalCompanies(companies);
    return () => {
      setIsOpen(false);
    };
  }, [companies]);

  // Pre-fill when editing so edit and create share one form.
  useEffect(() => {
    if (!editContact) return;
    setForm({
      name: editContact.name || "",
      email: editContact.email || "",
      phone: editContact.phone || "",
      company: editContact.company?._id || editContact.company || "",
      leadSource: editContact.leadSource || "",
    });
    const pf = {};
    (editContact.additionalFields || []).forEach((f) => {
      pf[f.key] = f.value;
    });
    setAdditionalFields(pf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editContact]);

  const fetchFieldDefinitions = async () => {
    try {
      const res = await API.get("/contact-fields");
      if (res.data && res.data.fields) {
        setFieldDefinitions(res.data.fields);
      }
    } catch (err) {
      console.error("Failed to fetch contact field definitions");
      toast.error("Failed to fetch contact field definitions");
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
      if (onRequestClose) {
        onRequestClose();
      }
    }, 300);
  };

  const handleConfirmExit = () => {
    setShowConfirmDialog(false);
    closeForm();
  };

  const handleSaveAndExit = async () => {
    setShowConfirmDialog(false);
    await handleSubmit({ preventDefault: () => { } }, true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size should be less than 5MB");
        return;
      }
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      setProfilePicture(file);
      setIsFormDirty(true);
    }
  };

  const handleCompanyCreated = (newCompany) => {
    setLocalCompanies((prev) => [...prev, newCompany]);
    setForm((prev) => ({ ...prev, company: newCompany._id }));
    setShowQuickCompanyForm(false);
    setIsFormDirty(true);

    // Clear validation error when company is selected
    if (validationErrors.company) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.company;
        return newErrors;
      });
    }
  };

  // Validation function
  const validateForm = () => {
    const errors = {};

    if (!form.name.trim()) {
      errors.name = "Name is required";
    }

    if (!form.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = "Invalid email format";
    }

    if (!form.phone.trim()) {
      errors.phone = "Phone is required";
    }

    if (!form.company) {
      errors.company = "Please select a company";
    }

    if (!form.leadSource) {
      errors.leadSource = "Please select a lead source";
    }

    // Validate required additional fields
    fieldDefinitions.forEach((fieldDef) => {
      if (fieldDef.required) {
        const value = additionalFields[fieldDef.name];
        if (!value || value.toString().trim() === "") {
          errors[`additional_${fieldDef.name}`] = `${fieldDef.name} is required`;
        }
      }
    });

    return errors;
  };

  const renderFieldInput = (fieldDef, value) => {
    const handleFieldChange = (newValue) => {
      setAdditionalFields((prev) => ({
        ...prev,
        [fieldDef.name]: newValue,
      }));
      setIsFormDirty(true);

      // Clear validation error when user fixes the field
      if (validationErrors[`additional_${fieldDef.name}`]) {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[`additional_${fieldDef.name}`];
          return newErrors;
        });
      }
    };

    const hasError = validationErrors[`additional_${fieldDef.name}`];
    const inputClassName = `w-full border rounded-full px-3 h-8 text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 transition-all placeholder:text-[#1F2937] placeholder:opacity-50 font-inter ${hasError
      ? 'border-red-500 focus:ring-red-500'
      : 'border-[#1F2937]/10 focus:ring-blue-500'
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
            buttonClassName={`w-full border border-[#1F2937]/10 rounded-full px-3 h-8 text-[12px] text-left flex items-center justify-between transition-all bg-white font-inter ${value ? "text-[#1F2937]" : "text-[#1F2937] opacity-50"}`}
          />
        );

      case "text":
        return (
          <textarea
            rows={3}
            value={value || ""}
            onChange={(e) => handleFieldChange(e.target.value)}
            className={`w-full border rounded-2xl px-3 py-2 text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 transition-all placeholder:text-[#1F2937] placeholder:opacity-50 font-inter resize-vertical ${hasError ? 'border-red-500 focus:ring-red-500' : 'border-[#1F2937]/10 focus:ring-blue-500'}`}
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
                    className="flex items-center gap-2 cursor-pointer hover:bg-[#F2F2F7] rounded-full px-3 h-8 transition-colors border border-transparent hover:border-[#1F2937]/10"
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
                      className="w-4 h-4 text-blue-600 border-[#1F2937]/10 rounded focus:ring-blue-500"
                    />
                    <span className="text-[12px] text-[#1F2937] font-medium font-inter">{option}</span>
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


  const handleFormChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsFormDirty(true);

    // Clear validation errors when user fixes the field
    if (validationErrors[key]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }

    // Special handling for company field
    if (key === 'company' && value && validationErrors.company) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.company;
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e, isSaveAndExit = false) => {
    e.preventDefault();

    // Validate every mandatory field up front — highlight all of them at
    // once, then scroll to whichever invalid one appears first on the page
    // (not necessarily the one checked first here), so the user always lands
    // on the top-most problem instead of being surprised by one further down
    // after fixing what looked like the only error.
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);

      const candidates = [
        errors.name ? nameInputRef.current : null,
        errors.email ? emailInputRef.current : null,
        errors.phone ? phoneInputRef.current : null,
        errors.company ? companyRef.current : null,
        errors.leadSource ? leadSourceRef.current : null,
      ].filter(Boolean);

      let topMost = null;
      for (const el of candidates) {
        if (!topMost || el.getBoundingClientRect().top < topMost.getBoundingClientRect().top) {
          topMost = el;
        }
      }
      topMost?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const payload = new FormData();
    payload.append("name", form.name);
    payload.append("email", form.email);
    payload.append("phone", form.phone);
    payload.append("company", form.company);
    payload.append("leadSource", form.leadSource);

    const processedAdditionalFields = fieldDefinitions
      .map((fieldDef) => {
        const value = additionalFields[fieldDef.name] || "";
        return {
          key: fieldDef.name,
          value: value,
          type: fieldDef.type,
        };
      })
      .filter((field) => field.value !== "");

    processedAdditionalFields.forEach((field, index) => {
      payload.append(`additionalFields[${index}][key]`, field.key);
      payload.append(`additionalFields[${index}][value]`, field.value);
      payload.append(`additionalFields[${index}][type]`, field.type);
    });

    if (profilePicture) {
      payload.append("avatar", profilePicture);
    }

    try {
      setLoading(true);
      const res = isEditing
        ? await API.put(`/contacts/${editContact._id}`, payload, {
            headers: { "Content-Type": "multipart/form-data" },
          })
        : await API.post("/contacts", payload, {
            headers: { "Content-Type": "multipart/form-data" },
          });
      toast.success(isEditing ? "Contact updated successfully!" : "Contact added successfully!");
      const cb = isEditing ? onContactUpdated || onContactCreated : onContactCreated;
      if (cb && res.data) {
        cb(res.data);
      }
      setIsFormDirty(false);
      closeForm();
    } catch (err) {
      let errorMessage = "Failed to save contact. Please try again.";
      if (err.response && err.response.status === 402) {
        errorMessage = err.response?.data?.message || "An active subscription is required to make changes.";
      } else if (err.response && err.response.status === 403) {
        errorMessage = err.response.data.error || "Access denied";
        const match = errorMessage.match(/\((\d+)\/(\d+)\s*records/);
        if (match) {
          const used = match[1];
          const limit = match[2];
          errorMessage = `Record limit reached (${used}/${limit}). Please upgrade your plan to add more records.`;
        } else if (errorMessage.includes("Subscription expired")) {
          errorMessage = "Subscription expired. Please renew to add contacts.";
        } else if (
          errorMessage.includes("Write access to contacts not allowed")
        ) {
          errorMessage =
            "Your plan does not allow adding contacts. Please upgrade your plan.";
        }
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
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 z-[10004] flex items-center justify-center">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-sm sm:max-w-lg mx-4">
            <h3 className="text-lg font-medium font-sf text-gray-900 mb-4">
              Unsaved Changes
            </h3>
            <p className="text-sm font-medium font-inter text-gray-600 mb-6">
              You have unsaved changes. Are you sure you want to exit without
              saving?
            </p>
            <div className="flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmDialog(false)}
                className="bg-gray-200 font-sf text-gray-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors cursor-pointer hidden sm:block"
              >
                Cancel
              </button>
              <div className="flex space-x-1">
                <button
                  type="button"
                  onClick={handleConfirmExit}
                  className="bg-red-600 font-sf text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors cursor-pointer"
                >
                  Exit Without Saving
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndExit}
                  className="bg-blue-600 font-sf text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  Save and Exit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showQuickCompanyForm && (
        <QuickCompanyForm
          onCompanyCreated={handleCompanyCreated}
          onRequestClose={() => setShowQuickCompanyForm(false)}
        />
      )}

      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[10000] transition-opacity duration-300 ease-in-out"
        style={{ opacity: isOpen ? 1 : 0 }}
        onClick={handleClose}
      />

      <div
        className={`
          fixed dc-panel-card dc-panel-w z-[10002]
          max-w-full bg-white shadow-2xl flex flex-col overflow-hidden
          transform transition-transform duration-300 ease-in-out font-inter
          ${isOpen ? "translate-x-0" : "translate-x-[calc(100%+2rem)]"}
        `}
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b border-[#D9D9D9] flex-shrink-0 bg-white gap-1">
            <h2 className="text-[14px] font-normal leading-5 text-[#78788D] uppercase tracking-wide">
              {isEditing ? "Edit Contact" : "Create New Contact"}
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

          <div className="space-y-6 overflow-y-auto flex-1 px-8 py-6">
            {/* Profile Picture */}
            <div>
              <label className="block text-[12px] font-medium text-[#161618] mb-2 tracking-[-0.05em]">
                Profile Picture
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center px-3 h-8 rounded-full border border-[#1F2937]/10">
                  <span className="text-[12px] leading-5 text-[#1F2937] opacity-50 truncate">
                    {profilePicture ? profilePicture.name : "Choose a file"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => profilePictureInputRef.current?.click()}
                  title="Upload profile picture"
                  className="flex-shrink-0 w-8 h-8 rounded-full bg-[#158FFF] border border-[#1F2937]/10 flex items-center justify-center hover:opacity-90 transition-opacity"
                >
                  <Paperclip className="w-[18px] h-[18px] text-white" strokeWidth={2} />
                </button>
                <input
                  ref={profilePictureInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
              <p className="text-[12px] font-inter text-[#A0A0A0] mt-1.5 uppercase font-medium">PNG, JPEG upto 5MB</p>
              {profilePicturePreview && (
                <div className="relative mt-2 inline-block">
                  <img
                    src={profilePicturePreview}
                    alt="Contact"
                    className="block max-h-20 max-w-[160px] w-auto h-auto object-contain rounded-lg border border-[#E0E0E1]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setProfilePicture(null);
                      if (profilePictureInputRef.current) {
                        profilePictureInputRef.current.value = "";
                      }
                    }}
                    title="Remove photo"
                    aria-label="Remove photo"
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white border border-[#E0E0E1] shadow-sm flex items-center justify-center text-[#1C1B1F] hover:bg-gray-50 transition-colors"
                  >
                    <X className="w-3 h-3" strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </div>

            {/* Name - Now with validation */}
            <div>
              <label className="flex items-center gap-0.5 text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                Full Name <span className="text-[#FF4935]">*</span>
              </label>
              <input
                ref={nameInputRef}
                type="text"
                placeholder="Enter Full Name"
                value={form.name}
                onChange={(e) => handleFormChange("name", e.target.value)}
                className={`w-full border rounded-full px-3 h-8 text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 transition-all placeholder:text-[#1F2937] placeholder:opacity-50 font-inter ${validationErrors.name
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-[#1F2937]/10 focus:ring-blue-500'
                  }`}
              />
              {validationErrors.name && (
                <p className="text-red-500 text-xs mt-1 font-inter">{validationErrors.name}</p>
              )}
            </div>

            {/* Email - Now with validation */}
            <div>
              <label className="flex items-center gap-0.5 text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                Email <span className="text-[#FF4935]">*</span>
              </label>
              <input
                ref={emailInputRef}
                type="email"
                placeholder="example@gmail.com"
                value={form.email}
                onChange={(e) => handleFormChange("email", e.target.value)}
                className={`w-full border rounded-full px-3 h-8 text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 transition-all placeholder:text-[#1F2937] placeholder:opacity-50 font-inter ${validationErrors.email
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-[#1F2937]/10 focus:ring-blue-500'
                  }`}
              />
              {validationErrors.email && (
                <p className="text-red-500 text-xs mt-1 font-inter">{validationErrors.email}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="flex items-center gap-0.5 text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                Phone <span className="text-[#FF4935]">*</span>
              </label>
              <input
                ref={phoneInputRef}
                type="tel"
                placeholder="+91 123456789"
                value={form.phone}
                onChange={(e) => handleFormChange("phone", e.target.value)}
                className={`w-full border rounded-full px-3 h-8 text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 transition-all placeholder:text-[#1F2937] placeholder:opacity-50 font-inter ${validationErrors.phone
                  ? "border-red-500 focus:ring-red-500"
                  : "border-[#1F2937]/10 focus:ring-blue-500"
                  }`}
              />
              {validationErrors.phone && (
                <p className="text-red-500 text-xs mt-1 font-inter">{validationErrors.phone}</p>
              )}
            </div>

            {/* Company - Now required with validation */}
            <div ref={companyRef}>
              <label className="flex items-center gap-0.5 text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                Company <span className="text-[#FF4935]">*</span>
              </label>
              <div className="flex items-center gap-3">
                <SearchableDropdown
                  options={localCompanies}
                  value={form.company}
                  onChange={(value) => handleFormChange("company", value)}
                  placeholder="Select Company"
                  displayKey="name"
                  valueKey="_id"
                  className="flex-1"
                  error={validationErrors.company}
                  compact
                />
                <button
                  type="button"
                  onClick={() => setShowQuickCompanyForm(true)}
                  className="flex-shrink-0 w-8 h-8 rounded-full bg-[#158FFF] border border-[#1F2937]/10 flex items-center justify-center hover:opacity-90 transition-opacity"
                  title="Add New Company"
                >
                  <Plus className="w-[18px] h-[18px] text-white" strokeWidth={2} />
                </button>
              </div>
              {validationErrors.company && (
                <p className="text-red-500 text-xs mt-1 font-inter">{validationErrors.company}</p>
              )}
            </div>

            {/* Lead Source */}
            <div ref={leadSourceRef}>
              <label className="flex items-center gap-0.5 text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                Lead Source <span className="text-[#FF4935]">*</span>
              </label>
              <CustomDropdown
                options={["Referral", "Website", "Cold Call", "Social Media", "Event", "Advertisement", "Other"]}
                value={form.leadSource}
                onChange={(value) => handleFormChange("leadSource", value)}
                placeholder="Choose Lead Source"
                buttonClassName={`w-full border rounded-full px-3 h-8 text-[12px] text-left flex items-center justify-between transition-all bg-white font-inter ${validationErrors.leadSource ? 'border-red-500 focus:ring-red-500' : 'border-[#1F2937]/10'} ${form.leadSource ? "text-[#1F2937]" : "text-[#1F2937] opacity-50"}`}
              />
              {validationErrors.leadSource && (
                <p className="text-red-500 text-xs mt-1 font-inter">{validationErrors.leadSource}</p>
              )}
            </div>

            {/* Additional Fields - Now with validation */}
            {fieldDefinitions.length > 0 && (
              <div className="pt-4 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex-1 h-px bg-[#D9D9D9]" />
                  <h3 className="flex-shrink-0 text-[14px] font-medium leading-[120%] text-[#1F2937]">
                    Custom Fields
                  </h3>
                  <span className="flex-1 h-px bg-[#D9D9D9]" />
                </div>
                <div className="space-y-3 sm:space-y-4">
                  {fieldDefinitions.map((fieldDef) => (
                    <div key={fieldDef.name}>
                      <label className="block text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                        {fieldDef.name} {fieldDef.required && <span className="text-[#FF4935]">*</span>}
                      </label>
                      {renderFieldInput(
                        fieldDef,
                        additionalFields[fieldDef.name]
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex-shrink-0 py-2.5 px-4 border-t border-gray-100 bg-white flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2 border border-gray-200 text-gray-700 rounded-[25px] text-sm font-bold hover:bg-gray-50 transition-colors font-inter"
            >
              Cancel
            </button>
            <button
              className="px-6 py-2 bg-[#158FFF] text-white rounded-[25px] text-sm font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-inter"
              type="submit"
              disabled={loading}
            >
              {loading ? "Saving..." : isEditing ? "Update Contact" : "Create New Contact"}
            </button>
          </div>
        </form>
      </div>
    </>,
    document.body
  );
};

export default QuickContactForm;
