import React, { useEffect, useState } from "react";
import API from "../../services/api";
import { Twitter, Linkedin, Facebook, FolderOpen, ChevronDown } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
const CompanyForm = ({
  form,
  setForm,
  additionalFields,
  setAdditionalFields,
  companyFieldNames,
  loading,
  setLoading,
  setError: propSetError,
  setSuccess: propSetSuccess,
  fetchCompanies,
  onRequestClose,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);
  const [fieldDefinitions, setFieldDefinitions] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [errors, setErrors] = useState({
    name: false,
    industry: false,
    gstin: false,
  });

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

  // Fetch field definitions and industries on mount
  useEffect(() => {
    setShouldRender(true);
    setTimeout(() => setIsOpen(true), 10);
    fetchFieldDefinitions();
    fetchIndustries();
    return () => {
      setIsOpen(false);
    };
  }, []);

  // Initialize socialMedia and additionalFields when form data is loaded
  useEffect(() => {
    if (form._id && form.name) {
      console.log("Form data received:", form); // Debug log
      console.log("Social media data:", form.socialMedia); // Debug log

      // Ensure socialMedia is initialized
      if (!form.socialMedia || typeof form.socialMedia !== 'object') {
        setForm((prev) => ({
          ...prev,
          socialMedia: {
            twitter: "",
            linkedin: "",
            facebook: "",
            whatsapp: "",
          },
        }));
      }

      // Populate additional fields
      if (form.additionalFields && Array.isArray(form.additionalFields) && form.additionalFields.length > 0) {
        const fieldsObject = {};
        form.additionalFields.forEach((field) => {
          fieldsObject[field.key] = field.value;
        });
        setAdditionalFields(fieldsObject);
      }
    }
  }, [form._id]);

  const fetchFieldDefinitions = async () => {
    try {
      const res = await API.get("/company-fields");
      if (res.data && res.data.fields) {
        setFieldDefinitions(res.data.fields);
      }
    } catch (err) {
      console.error("Failed to fetch field definitions:", err);
    }
  };

  const fetchIndustries = async () => {
    try {
      const res = await API.get("/company-industries");
      if (res.data) {
        setIndustries(res.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch industries:", err);
      setError("Failed to load industries");
    }
  };

  const validateGSTIN = (gstin) => {
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstinRegex.test(gstin);
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setIsFormDirty(true);
    setErrors((prev) => ({ ...prev, [field]: false }));
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
    setAdditionalFields((prev) => ({
      ...prev,
      [fieldName]: newValue,
    }));
    setIsFormDirty(true);
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
    setErrors({ name: false, industry: false, gstin: false });
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

  const renderFieldInput = (fieldDef, rawValue) => {
    const handleFieldChange = (newValue) => {
      handleAdditionalFieldChange(fieldDef.name, newValue);
    };

    // 1. Safely handle values (fixes the bug where Number '0' gets erased by '|| ""')
    const value = rawValue !== undefined && rawValue !== null ? rawValue : "";

    // 2. Normalize the field type to handle both exact strings from your screenshot and standard slugs
    const typeStr = (fieldDef.type || "").toLowerCase();
    let normalizedType = "string"; // default to String (Single-line)

    if (typeStr.includes("multi-line") || typeStr === "text") normalizedType = "text";
    else if (typeStr.includes("number")) normalizedType = "number";
    else if (typeStr.includes("dropdown")) normalizedType = "dropdown";
    else if (typeStr.includes("url")) normalizedType = "url";
    else if (typeStr.includes("date")) normalizedType = "date";
    else if (typeStr.includes("multi-select") || typeStr.includes("checkbox") || typeStr === "multiselect") normalizedType = "multiselect";

    // 3. Render based on the normalized type
    switch (normalizedType) {
      case "number":
        return (
          <input
            type="number"
            step="any"
            value={value}
            onChange={(e) => handleFieldChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
            required={fieldDef.required}
            placeholder={`Enter ${fieldDef.name}`}
          />
        );

      case "dropdown":
        return (
          <select
            value={value}
            onChange={(e) => handleFieldChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm cursor-pointer"
            required={fieldDef.required}
          >
            <option value="">Select {fieldDef.name}</option>
            {fieldDef.options &&
              fieldDef.options.map((option, index) => (
                <option key={index} value={option}>
                  {option}
                </option>
              ))}
          </select>
        );

      case "text": // Text (Multi-line)
        return (
          <textarea
            rows={3}
            value={value}
            onChange={(e) => handleFieldChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm resize-vertical"
            required={fieldDef.required}
            placeholder={`Enter ${fieldDef.name}`}
          />
        );

      case "date": // Date Picker
        // Ensure date is formatted correctly for the input type="date" (YYYY-MM-DD)
        const formattedDate = value && value.includes("T") ? value.split("T")[0] : value;
        return (
          <input
            type="date"
            value={formattedDate}
            onChange={(e) => handleFieldChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
            required={fieldDef.required}
          />
        );

      case "url": // URL
        return (
          <input
            type="url"
            value={value}
            onChange={(e) => handleFieldChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
            required={fieldDef.required}
            placeholder={`https://example.com`}
          />
        );

      case "multiselect": // Multi-Select Checkbox
        return (
          <div className="space-y-2">
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
                  <label
                    key={index}
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        let newValues;
                        if (e.target.checked) {
                          newValues = [...selectedValues, option.trim()];
                        } else {
                          newValues = selectedValues.filter((v) => v !== option.trim());
                        }
                        handleFieldChange(newValues);
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="text-sm text-gray-900">{option}</span>
                  </label>
                );
              })
            ) : (
              <p className="text-sm text-gray-500 italic">No options available</p>
            )}
          </div>
        );

      case "string": // String (Single-line)
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
            required={fieldDef.required}
            placeholder={`Enter ${fieldDef.name}`}
          />
        );
    }
  };


  // In your CompanyForm component, update handleSubmit:

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    const newErrors = {
      name: !form.name || !form.name.trim(),
      industry: !form.industry || !form.industry.trim()
    };

    setErrors(newErrors);

    if (newErrors.name || newErrors.industry) {
      const errorMessages = [];
      if (newErrors.name) errorMessages.push("Company name is required");
      if (newErrors.industry) errorMessages.push("Industry is required");
      setError(errorMessages.join(", "));
      return;
    }

    const payload = new FormData();
    payload.append("name", form.name);
    payload.append("industry", form.industry);
    payload.append("gstin", form.gstin || "");
    payload.append("address", form.address || "");
    payload.append("website", form.website || "");

    // Add social media links - using bracket notation
    if (form.socialMedia) {
      payload.append("socialMedia[twitter]", form.socialMedia.twitter || "");
      payload.append("socialMedia[linkedin]", form.socialMedia.linkedin || "");
      payload.append("socialMedia[facebook]", form.socialMedia.facebook || "");
      payload.append("socialMedia[whatsapp]", form.socialMedia.whatsapp || "");
    }

    const processedAdditionalFields = fieldDefinitions
      .map((fieldDef) => {
        let value = additionalFields[fieldDef.name] || "";

        // 👉 FIXED: Convert multiselect arrays to comma-separated strings for clean DB storage
        if (Array.isArray(value)) {
          value = value.join(", ");
        }

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

    if (form.profilePicture) {
      payload.append("profilePicture", form.profilePicture);
    }

    try {
      setLoading(true);
      if (form._id) {
        await API.put(`/companies/${form._id}`, payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setSuccess("Company updated successfully!");
      } else {
        await API.post("/companies", payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setSuccess("Company added successfully!");
      }
      await fetchCompanies();
      setIsFormDirty(false);
      setErrors({ name: false, industry: false, gstin: false });
      setTimeout(() => setSuccess(""), 3000);
      closeForm();
    } catch (err) {
      if (err.response && err.response.status === 402) {
        const errorMessage = err.response.data?.message || err.response.data?.error || "Subscription required. Please upgrade your plan.";
        setError(errorMessage);
      } else if (err.response && err.response.status === 403) {
        const errorMessage = err.response.data.error || "Access denied";
        const match = errorMessage.match(/\((\d+)\/(\d+)\s*records/);
        if (match) {
          const used = match[1];
          const limit = match[2];
          setError(
            <span>
              Record limit reached ({used}/{limit}). Please{" "}
              <a href="/settings">upgrade your plan to add more records.</a>
            </span>
          );
        } else if (errorMessage.includes("Subscription expired")) {
          setError(
            "Subscription expired. Please renew to add or update companies."
          );
        } else if (
          errorMessage.includes("Write access to companies not allowed")
        ) {
          setError(
            "Your plan does not allow adding or updating companies. Please upgrade your plan."
          );
        } else {
          setError(errorMessage);
        }
        closeForm();
      } else {
        const errorMessage = err.response?.data?.message || err.response?.data?.error || "Failed to save company. Please try again.";
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };
  console.log("Form Industry:", form.industry);
  console.log("Industries:", industries);

  // 👉 ADD THIS ENTIRE MISSING BLOCK RIGHT HERE
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
        const cat = fieldDef.category || "Uncategorized";
        defaultExpanded[cat] = true; // Opens all categories by default
      });
      setExpandedSections(defaultExpanded);
    }
  }, [fieldDefinitions]);
  // 👉 END OF MISSING BLOCK

  // 1. First, we create an object that groups all fields by their category name
  const groupedFields = fieldDefinitions.reduce((acc, fieldDef) => {
    // If a field doesn't have a category, we force it into "Uncategorized"
    const cat = (fieldDef.category && typeof fieldDef.category === 'string')
      ? fieldDef.category
      : "Uncategorized";

    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(fieldDef);
    return acc;
  }, {});

  // 2. THIS IS WHERE sortedCategories IS INITIALIZED:
  // We take the keys (the category names) from the grouped object and sort them alphabetically
  const sortedCategories = Object.keys(groupedFields).sort((a, b) => {
    if (a === "Uncategorized") return 1; // This forces "Uncategorized" to always stay at the very bottom
    if (b === "Uncategorized") return -1;
    return a.localeCompare(b);
  });


  return (
    <>
      {/* Responsive backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-[10000] transition-opacity duration-300 ease-in-out"
        style={{ opacity: isOpen ? 1 : 0 }}
        onClick={handleClose}
      />

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 z-[10002] flex items-center justify-center">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-sm sm:max-w-lg mx-4">
            <h3 className="text-lg font-medium font-sf text-gray-900 mb-4">
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
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium font-sf hover:bg-gray-300 transition-colors cursor-pointer hidden sm:block"
              >
                Cancel
              </button>
              <div className="flex space-x-1">
                <button
                  type="button"
                  onClick={handleConfirmExit}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium font-sf hover:bg-red-700 transition-colors cursor-pointer"
                >
                  Exit Without Saving
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndExit}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium font-sf hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  Save and Exit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Responsive modal container */}
      <div
        className={`
          fixed inset-y-0 right-0 z-[10001] 
          w-full sm:w-[500px] md:w-[600px] lg:w-[700px] xl:w-[800px]
          max-w-full bg-white shadow-2xl overflow-y-auto 
          transform transition-transform duration-300 ease-in-out font-inter
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Responsive form container */}
        <form onSubmit={handleSubmit} className="p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-[24px] font-bold text-[#111216]">
              {form._id ? "Edit Company" : "Create New Company"}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Form fields */}
          <div className="space-y-6">
            {/* Company Name */}
            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name || ""}
                onChange={(e) => handleFormChange("name", e.target.value)}
                className={`w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] ${errors.name ? "border-red-500" : ""
                  }`}
                placeholder="Enter Company Name"
                required
              />
              {errors.name && (
                <p className="mt-1 text-xs font-sf text-red-600">
                  Company name is required
                </p>
              )}
            </div>

            {/* Industry */}
            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Industry <span className="text-red-500">*</span>
              </label>
              <select
                value={form.industry || ""}
                onChange={(e) => handleFormChange("industry", e.target.value)}
                className={`w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer ${errors.industry ? "border-red-500" : ""
                  }`}
                required
              >
                <option value="">Select Industry</option>
                {industries.map((industry) => (
                  <option
                    key={industry._id || industry.name}
                    value={industry.name}
                  >
                    {industry.name}
                  </option>
                ))}
              </select>
              {errors.industry && (
                <p className="mt-1 text-xs text-red-600 font-sf">
                  Industry is required
                </p>
              )}
            </div>

            {/* GSTIN */}
            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                GSTIN
              </label>
              <input
                type="text"
                value={form.gstin || ""}
                onChange={(e) => handleFormChange("gstin", e.target.value)}
                className={`w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] ${errors.gstin ? "border-red-500" : ""
                  }`}
                placeholder="e.g., 22ABCDE1234F1Z5"
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Address
              </label>
              <input
                type="text"
                value={form.address || ""}
                onChange={(e) => handleFormChange("address", e.target.value)}
                className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]"
                placeholder="Enter Address Here"
              />
            </div>

            {/* Website */}
            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Website
              </label>
              <input
                type="url"
                value={form.website || ""}
                onChange={(e) => handleFormChange("website", e.target.value)}
                className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]"
                placeholder="www.company.com"
              />
            </div>

            {/* Profile Picture */}
            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Select Profile Picture
              </label>
              {form.profilePictureUrl && (
                <div className="mb-2">
                  <img
                    src={`${form.profilePictureUrl}`}
                    alt="Profile"
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover"
                  />
                </div>
              )}
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      handleFormChange("profilePicture", e.target.files[0]);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  <div className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 flex items-center text-[14px] text-[#A0A0A0] bg-white">
                    {form.profilePicture
                      ? form.profilePicture.name
                      : "Choose a File"}
                  </div>
                </div>
                <button
                  type="button"
                  className="bg-[#F2F2F7] text-[#111216] px-8 rounded-xl h-12 text-[14px] font-medium hover:bg-gray-200 transition-colors"
                >
                  Upload
                </button>
              </div>
            </div>

            {/* Social Media Links Section */}
            <div className="pt-2">
              <h3 className="text-[16px] font-bold text-[#111216] mb-4 flex items-center gap-2">
                <span>Social Media Links</span>
              </h3>
              <div className="space-y-4">
                {/* Twitter/X */}
                <div>
                  <label className="block text-[13px] font-semibold text-[#111216] mb-1.5 flex items-center gap-2">
                    <Twitter className="w-4 h-4" />X (Twitter)
                  </label>
                  <input
                    type="url"
                    value={form.socialMedia?.twitter || ""}
                    onChange={(e) =>
                      handleSocialMediaChange("twitter", e.target.value)
                    }
                    className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]"
                    placeholder="https://twitter.com/yourcompany"
                  />
                </div>

                {/* LinkedIn */}
                <div>
                  <label className="block text-[13px] font-semibold text-[#111216] mb-1.5 flex items-center gap-2">
                    <Linkedin className="w-4 h-4" />
                    LinkedIn
                  </label>
                  <input
                    type="url"
                    value={form.socialMedia?.linkedin || ""}
                    onChange={(e) =>
                      handleSocialMediaChange("linkedin", e.target.value)
                    }
                    className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]"
                    placeholder="https://linkedin.com/company/yourcompany"
                  />
                </div>

                {/* Facebook */}
                <div>
                  <label className="block text-[13px] font-semibold text-[#111216] mb-1.5 flex items-center gap-2">
                    <Facebook className="w-4 h-4" />
                    Facebook
                  </label>
                  <input
                    type="url"
                    value={form.socialMedia?.facebook || ""}
                    onChange={(e) =>
                      handleSocialMediaChange("facebook", e.target.value)
                    }
                    className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]"
                    placeholder="https://facebook.com/yourcompany"
                  />
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="block text-[13px] font-semibold text-[#111216] mb-1.5 flex items-center gap-2">
                    <FaWhatsapp className="w-4 h-4" />
                    WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={form.socialMedia?.whatsapp || ""}
                    onChange={(e) =>
                      handleSocialMediaChange("whatsapp", e.target.value)
                    }
                    className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]"
                    placeholder="e.g., +1234567890"
                  />
                </div>
              </div>
            </div>

            {/* Dynamic Additional Fields */}
            {/* 👉 FIXED: Dynamic Additional Fields (Categorized & Collapsible) */}
            {sortedCategories.length > 0 && (
              <div className="pt-4 space-y-4">
                <h3 className="text-[16px] font-bold text-[#111216]">
                  Additional Information
                </h3>

                {sortedCategories.map((category) => (
                  <div key={category} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    {/* Category Header / Button */}
                    <button
                      type="button"
                      onClick={() => toggleSection(category)}
                      className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors focus:outline-none"
                    >
                      <div className="flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-indigo-600" />
                        <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">
                          {category}
                        </span>
                        <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium ml-2">
                          {groupedFields[category].length}
                        </span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${expandedSections[category] ? "rotate-180" : ""}`}
                      />
                    </button>

                    {/* Category Fields (Visible only when expanded) */}
                    {expandedSections[category] && (
                      <div className="p-5 bg-white border-t border-gray-200 space-y-5">
                        {groupedFields[category].map((fieldDef) => (
                          <div key={fieldDef.name}>
                            <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                              {fieldDef.name}
                              {fieldDef.required && (
                                <span className="text-red-500 ml-1">*</span>
                              )}
                              <span className="text-xs text-gray-500 ml-2 font-normal">
                                ({fieldDef.type})
                              </span>
                            </label>
                            {renderFieldInput(
                              fieldDef,
                              additionalFields[fieldDef.name]
                            )}
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
              {loading
                ? "Saving..."
                : form._id
                  ? "Update Company"
                  : "Create Company"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default CompanyForm;
