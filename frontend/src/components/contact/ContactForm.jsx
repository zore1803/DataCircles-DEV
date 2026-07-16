import React, { useEffect, useState } from "react";
import API from "../../services/api";
import SearchableDropdown from "./SearchableDropdown";
import { Upload, Plus, Twitter, Linkedin, Facebook, FolderOpen, ChevronDown } from "lucide-react";
import QuickCompanyForm from "../company/QuickCompanyForm";
import toast from "react-hot-toast";
import { FaWhatsapp } from "react-icons/fa";
const ContactForm = ({
  form,
  setForm,
  additionalValues,
  setAdditionalValues,
  contactFieldList,
  companies,
  loading,
  setLoading,
  setError: propSetError,
  setSuccess: propSetSuccess,
  fetchContacts,
  onRequestClose,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePreview, setProfilePreview] = useState(form.avatar || null);
  const [fieldDefinitions, setFieldDefinitions] = useState([]);
  const [showQuickCompanyForm, setShowQuickCompanyForm] = useState(false);
  const [localCompanies, setLocalCompanies] = useState(companies);
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

  useEffect(() => {
    setShouldRender(true);
    setTimeout(() => setIsOpen(true), 10);
    setProfilePreview(form.avatar || null);
    fetchFieldDefinitions();
    setLocalCompanies(companies);
    return () => {
      setIsOpen(false);
    };
  }, [form.avatar, companies]);

  const fetchFieldDefinitions = async () => {
    try {
      const res = await API.get("/contact-fields");
      if (res.data && res.data.fields) {
        setFieldDefinitions(res.data.fields);
      }
    } catch (err) {
      console.error("Failed to fetch field definitions");
      toast.error("Failed to fetch field definitions");
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
    await handleSubmit({ preventDefault: () => { } });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("File size should be less than 5MB");
        return;
      }

      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }

      setProfilePicture(file);
      setIsFormDirty(true);

      const reader = new FileReader();
      reader.onload = (e) => {
        setProfilePreview(e.target.result);
      };
      reader.readAsDataURL(file);
      setError("");
    }
  };

  const handleFormChange = (newFormData) => {
    setForm(newFormData);
    setIsFormDirty(true);

    if (newFormData.company && validationErrors.company) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.company;
        return newErrors;
      });
    }
  };

  const handleSocialMediaChange = (platform, value) => {
    setForm((prev) => ({
      ...prev,
      socialMedia: {
        ...(prev.socialMedia || {}),
        [platform]: value,
      },
    }));
    setIsFormDirty(true);
  };

  const handleAdditionalFieldChange = (fieldName, newValue) => {
    setAdditionalValues((prev) => ({
      ...prev,
      [fieldName]: newValue,
    }));
    setIsFormDirty(true);
  };

  const validateForm = () => {
    const errors = {};

    if (!form.name.trim()) {
      errors.name = "Name is required";
    }

    if (!form.email.trim()) {
      errors.email = "Email is required";
    }

    if (!form.company) {
      errors.company = "Please select a company";
    }

    fieldDefinitions.forEach((fieldDef) => {
      if (fieldDef.required) {
        const value = additionalValues[fieldDef.name];
        if (!value || value.toString().trim() === "") {
          errors[`additional_${fieldDef.name}`] = `${fieldDef.name} is required`;
        }
      }
    });

    return errors;
  };

  const renderFieldInput = (fieldDef, rawValue) => {
    const handleFieldChange = (newValue) => {
      handleAdditionalFieldChange(fieldDef.name, newValue);

      // Clear error on change
      if (validationErrors[`additional_${fieldDef.name}`]) {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[`additional_${fieldDef.name}`];
          return newErrors;
        });
      }
    };

    const hasError = validationErrors[`additional_${fieldDef.name}`];
    const value = rawValue !== undefined && rawValue !== null ? rawValue : "";

    // Type Normalizer
    const typeStr = (fieldDef.type || "").toLowerCase();
    let normalizedType = "string";

    if (typeStr.includes("multi-line") || typeStr === "text") normalizedType = "text";
    else if (typeStr.includes("number")) normalizedType = "number";
    else if (typeStr.includes("dropdown")) normalizedType = "dropdown";
    else if (typeStr.includes("url")) normalizedType = "url";
    else if (typeStr.includes("date")) normalizedType = "date";
    else if (typeStr.includes("multi-select") || typeStr.includes("checkbox") || typeStr === "multiselect") normalizedType = "multiselect";

    const baseInputClass = `w-full border rounded-xl px-4 text-[14px] text-gray-900 focus:outline-none focus:ring-1 transition-all placeholder:text-[#A0A0A0] ${hasError ? 'border-red-500 focus:ring-red-500' : 'border-[#E0E0E1] focus:ring-blue-500'
      }`;

    switch (normalizedType) {
      case "number":
        return (
          <>
            <input
              type="number"
              step="any"
              value={value}
              onChange={(e) => handleFieldChange(e.target.value)}
              className={`${baseInputClass} h-12`}
              placeholder={`Enter ${fieldDef.name}`}
            />
            {hasError && <p className="text-red-500 text-xs mt-1">{hasError}</p>}
          </>
        );

      case "dropdown":
        return (
          <>
            <select
              value={value}
              onChange={(e) => handleFieldChange(e.target.value)}
              className={`${baseInputClass} h-12 cursor-pointer`}
            >
              <option value="">Select {fieldDef.name}</option>
              {fieldDef.options && fieldDef.options.map((option, index) => (
                <option key={index} value={option}>{option}</option>
              ))}
            </select>
            {hasError && <p className="text-red-500 text-xs mt-1">{hasError}</p>}
          </>
        );

      case "text":
        return (
          <>
            <textarea
              rows={3}
              value={value}
              onChange={(e) => handleFieldChange(e.target.value)}
              className={`${baseInputClass} py-3 resize-vertical`}
              placeholder={`Enter ${fieldDef.name}`}
            />
            {hasError && <p className="text-red-500 text-xs mt-1">{hasError}</p>}
          </>
        );

      case "date":
        const formattedDate = value && value.includes("T") ? value.split("T")[0] : value;
        return (
          <>
            <input
              type="date"
              value={formattedDate}
              onChange={(e) => handleFieldChange(e.target.value)}
              className={`${baseInputClass} h-12`}
            />
            {hasError && <p className="text-red-500 text-xs mt-1">{hasError}</p>}
          </>
        );

      case "url":
        return (
          <>
            <input
              type="url"
              value={value}
              onChange={(e) => handleFieldChange(e.target.value)}
              className={`${baseInputClass} h-12`}
              placeholder="https://example.com"
            />
            {hasError && <p className="text-red-500 text-xs mt-1">{hasError}</p>}
          </>
        );

      case "multiselect":
        return (
          <>
            <div className={`space-y-2 ${hasError ? 'border border-red-300 rounded-xl p-3' : ''}`}>
              {fieldDef.options && fieldDef.options.length > 0 ? (
                fieldDef.options.map((option, index) => {
                  let selectedValues = [];
                  if (Array.isArray(value)) {
                    selectedValues = value;
                  } else if (typeof value === "string" && value.trim() !== "") {
                    selectedValues = value.split(",").map((v) => v.trim());
                  }

                  const isChecked = selectedValues.includes(option.trim());

                  return (
                    <label key={index} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          let newValues;
                          if (e.target.checked) newValues = [...selectedValues, option.trim()];
                          else newValues = selectedValues.filter((v) => v !== option.trim());
                          handleFieldChange(newValues);
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <span className="text-[14px] text-gray-900">{option}</span>
                    </label>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500 italic px-3 py-2">No options available</p>
              )}
            </div>
            {hasError && <p className="text-red-500 text-xs mt-1">{hasError}</p>}
          </>
        );

      case "string":
      default:
        return (
          <>
            <input
              type="text"
              value={value}
              onChange={(e) => handleFieldChange(e.target.value)}
              className={`${baseInputClass} h-12`}
              placeholder={`Enter ${fieldDef.name}`}
            />
            {hasError && <p className="text-red-500 text-xs mt-1">{hasError}</p>}
          </>
        );
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error("Please fill in all required fields");
      return;
    }

    const payload = new FormData();
    payload.append("name", form.name);
    payload.append("email", form.email);
    payload.append("phone", form.phone || "");
    payload.append("company", form.company);

    // Add social media links
    if (form.socialMedia) {
      payload.append("socialMedia[twitter]", form.socialMedia.twitter || "");
      payload.append("socialMedia[linkedin]", form.socialMedia.linkedin || "");
      payload.append("socialMedia[facebook]", form.socialMedia.facebook || "");
      payload.append("socialMedia[whatsapp]", form.socialMedia.whatsapp || "");
    }

    const processedAdditionalFields = fieldDefinitions
      .map((fieldDef) => {
        const value = additionalValues[fieldDef.name] || "";
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
      if (form._id) {
        await API.put(`/contacts/update/${form._id}`, payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setSuccess("Contact updated successfully!");
      } else {
        await API.post("/contacts", payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setSuccess("Contact added successfully!");
      }
      await fetchContacts();
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
        } else {
          setError(errorMessage);
        }
      } else {
        const errorMessage = err.response?.data?.message || err.response?.data?.error || "Failed to save contact. Please try again.";
        setError(errorMessage);
      }
      closeForm();
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyCreated = (newCompany) => {
    setLocalCompanies((prev) => [...prev, newCompany]);
    setForm((prev) => ({ ...prev, company: newCompany._id }));
    setIsFormDirty(true);
    setShowQuickCompanyForm(false);
  };

  // --- CATEGORY & GROUPING LOGIC ---
  const [expandedSections, setExpandedSections] = useState({});

  const toggleSection = (category) => {
    setExpandedSections((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  useEffect(() => {
    if (fieldDefinitions.length > 0) {
      const defaultExpanded = {};
      fieldDefinitions.forEach((fieldDef) => {
        const cat = (fieldDef.category && typeof fieldDef.category === 'string')
          ? fieldDef.category
          : "Uncategorized";
        defaultExpanded[cat] = true; // Opens all by default
      });
      setExpandedSections(defaultExpanded);
    }
  }, [fieldDefinitions]);

  const groupedFields = fieldDefinitions.reduce((acc, fieldDef) => {
    const cat = (fieldDef.category && typeof fieldDef.category === 'string')
      ? fieldDef.category
      : "Uncategorized";

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
      {showQuickCompanyForm && (
        <QuickCompanyForm
          onCompanyCreated={handleCompanyCreated}
          onRequestClose={() => setShowQuickCompanyForm(false)}
        />
      )}

      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 z-[10002] flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Unsaved Changes
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              You have unsaved changes. Are you sure you want to exit without saving?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmExit}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Exit Without Saving
              </button>
              <button
                onClick={handleSaveAndExit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save and Exit
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className="fixed inset-0 bg-black/20 z-[10000] transition-opacity duration-300"
        style={{ opacity: isOpen ? 1 : 0 }}
        onClick={handleClose}
      />

      <div
        className={`fixed inset-y-0 right-0 z-[10001] w-full sm:w-[500px] md:w-[600px] lg:w-[700px] xl:w-[800px] bg-white shadow-2xl overflow-y-auto transform transition-transform duration-300 font-inter ${isOpen ? "translate-x-0" : "translate-x-full"
          }`}
      >
        <form onSubmit={handleSubmit} className="p-8">

          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-[24px] font-bold text-[#111216]">
              {form._id ? "Edit Contact" : "Create New Contact"}
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

            {/* Profile Picture */}
            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">Profile Picture</label>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  {profilePreview ? (
                    <img src={profilePreview} alt="Profile" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-gray-200" />
                  ) : (
                    <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-white font-semibold text-lg ${form.name ? ["bg-red-500", "bg-green-500", "bg-blue-500", "bg-yellow-500", "bg-purple-500", "bg-pink-500"][form.name.charCodeAt(0) % 6] : "bg-gray-500"
                      }`}>
                      {form.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                    </div>
                  )}
                </div>
                <div className="flex-1 flex gap-3">
                  <div className="flex-1 relative">
                    <input type="file" id="avatar" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                    <div className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 flex items-center text-[14px] text-[#A0A0A0] bg-white">
                      {profilePicture ? profilePicture.name : "Choose a File"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => document.getElementById("avatar").click()}
                    className="bg-[#F2F2F7] text-[#111216] px-8 rounded-xl h-12 text-[14px] font-medium hover:bg-gray-200 transition-colors cursor-pointer"
                  >
                    Upload
                  </button>
                </div>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.name || ""}
                onChange={(e) => handleFormChange({ ...form, name: e.target.value })}
                className={`w-full border rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 transition-all placeholder:text-[#A0A0A0] ${validationErrors.name ? 'border-red-500 focus:ring-red-500' : 'border-[#E0E0E1] focus:ring-blue-500'
                  }`}
                placeholder="Enter Name"
                required
              />
              {validationErrors.name && <p className="text-red-500 text-xs mt-1">{validationErrors.name}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">Email <span className="text-red-500">*</span></label>
              <input
                type="email"
                value={form.email || ""}
                onChange={(e) => handleFormChange({ ...form, email: e.target.value })}
                className={`w-full border rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 transition-all placeholder:text-[#A0A0A0] ${validationErrors.email ? 'border-red-500 focus:ring-red-500' : 'border-[#E0E0E1] focus:ring-blue-500'
                  }`}
                placeholder="example@gmail.com"
                required
              />
              {validationErrors.email && <p className="text-red-500 text-xs mt-1">{validationErrors.email}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">Phone</label>
              <input
                type="tel"
                value={form.phone || ""}
                onChange={(e) => handleFormChange({ ...form, phone: e.target.value })}
                className="w-full border border-[#E0E0E1] focus:ring-blue-500 rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 transition-all placeholder:text-[#A0A0A0]"
                placeholder="9876543210"
              />
            </div>

            {/* Company */}
            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">Company <span className="text-red-500">*</span></label>
              <div className="flex items-center space-x-2">
                <div className="w-full">
                  <SearchableDropdown
                    options={localCompanies}
                    value={form.company}
                    onChange={(value) => handleFormChange({ ...form, company: value })}
                    placeholder="Select Company"
                    displayKey="name"
                    valueKey="_id"
                    required={true}
                    error={validationErrors.company}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickCompanyForm(true)}
                  className="w-12 h-12 flex items-center justify-center bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 border border-gray-300 cursor-pointer"
                  title="Add New Company"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              {validationErrors.company && <p className="text-red-500 text-xs mt-1">{validationErrors.company}</p>}
            </div>

            {/* Social Media Links */}
            <div className="pt-2">
              <h3 className="text-[16px] font-bold text-[#111216] mb-4">Social Media Links</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[13px] font-semibold text-[#111216] mb-1.5 flex items-center gap-2"><Twitter className="w-4 h-4" /> X (Twitter)</label>
                  <input type="url" value={form.socialMedia?.twitter || ""} onChange={(e) => handleSocialMediaChange("twitter", e.target.value)} className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]" placeholder="https://twitter.com/username" />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[#111216] mb-1.5 flex items-center gap-2"><Linkedin className="w-4 h-4" /> LinkedIn</label>
                  <input type="url" value={form.socialMedia?.linkedin || ""} onChange={(e) => handleSocialMediaChange("linkedin", e.target.value)} className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]" placeholder="https://linkedin.com/in/username" />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[#111216] mb-1.5 flex items-center gap-2"><Facebook className="w-4 h-4" /> Facebook</label>
                  <input type="url" value={form.socialMedia?.facebook || ""} onChange={(e) => handleSocialMediaChange("facebook", e.target.value)} className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]" placeholder="https://facebook.com/username" />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[#111216] mb-1.5 flex items-center gap-2"><FaWhatsapp className="w-4 h-4" /> WhatsApp Number</label>
                  <input type="text" value={form.socialMedia?.whatsapp || ""} onChange={(e) => handleSocialMediaChange("whatsapp", e.target.value)} className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]" placeholder="e.g., +1234567890" />
                </div>
              </div>
            </div>

            {/* Dynamic Collapsible Additional Fields */}
            {sortedCategories.length > 0 && (
              <div className="pt-4 space-y-4">
                <h3 className="text-[16px] font-bold text-[#111216]">Additional Information</h3>
                {sortedCategories.map((category) => (
                  <div key={category} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <button
                      type="button"
                      onClick={() => toggleSection(category)}
                      className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors focus:outline-none"
                    >
                      <div className="flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-indigo-600" />
                        <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">{category}</span>
                        <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium ml-2">
                          {groupedFields[category].length}
                        </span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${expandedSections[category] ? "rotate-180" : ""}`} />
                    </button>

                    {expandedSections[category] && (
                      <div className="p-5 bg-white border-t border-gray-200 space-y-5">
                        {groupedFields[category].map((fieldDef) => (
                          <div key={fieldDef.name}>
                            <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                              {fieldDef.name}
                              {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
                              <span className="text-xs text-gray-500 ml-2 font-normal">({fieldDef.type})</span>
                            </label>
                            {renderFieldInput(fieldDef, additionalValues[fieldDef.name])}
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
            <div className="mt-4 p-3 rounded-lg bg-red-50 text-xs font-sf text-red-600 border border-red-200">
              {error}
            </div>
          )}
          {success && (
            <div className="mt-4 p-3 rounded-lg bg-green-50 text-xs font-sf text-green-600 border border-green-200">
              {success}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-12 pt-6 border-t border-[#F2F2F7] flex gap-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 border border-[#E0E0E1] text-[#111216] h-12 rounded-xl text-[14px] font-bold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              className="flex-1 bg-[#0C4FCD] text-white h-12 rounded-xl text-[14px] font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              type="submit"
              disabled={loading}
            >
              {loading ? "Saving..." : form._id ? "Update Contact" : "Create Contact"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default ContactForm;
