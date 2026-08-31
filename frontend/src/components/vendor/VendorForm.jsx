import React, { useEffect, useState, useRef } from "react";
import API from "../../services/api";
import { Upload, Twitter, Linkedin, Instagram, Facebook, FolderOpen, ChevronDown, X, Pencil, Trash2 } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import toast from "react-hot-toast";

const VendorForm = ({
  form,
  setForm,
  additionalFieldValues = {},
  setAdditionalFieldValues,
  vendorFields = [], // Default to empty array to prevent mapping errors
  loading,
  setLoading,
  fetchVendors,
  onRequestClose,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);
  const [profilePreview, setProfilePreview] = useState(null);
  const [gstinLoading, setGstinLoading] = useState(false);
  const fileInputRef = useRef(null);
  const [profilePicture, setProfilePicture] = useState(null);

  // Consistency States added from ContactForm
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // GSTIN API configuration
  const GSTIN_API_KEY = import.meta.env.VITE_APP_GSTIN_API_KEY || "";
  const GSTIN_API_URL = "https://sheet.gstincheck.co.in/check/";
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/;

  useEffect(() => {
    setShouldRender(true);
    setTimeout(() => setIsOpen(true), 10);
    return () => {
      setIsOpen(false);
    };
  }, []);

  useEffect(() => {
    if (form._id && form.avatar) {
      setProfilePreview(`${form.avatar}`);
    } else {
      setProfilePreview(null);
    }
  }, [form._id, form.avatar]);

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
    await handleSubmit({ preventDefault: () => { } });
  };

  const handleDeleteVendor = async () => {
    if (!form._id) return;
    setDeleting(true);
    try {
      await API.delete(`/vendors/${form._id}`);
      toast.success("Vendor deleted successfully!");
      await fetchVendors();
      setShowDeleteConfirm(false);
      setIsFormDirty(false);
      closeForm();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to delete vendor");
    } finally {
      setDeleting(false);
    }
  };

  const handleFormChange = (newFormData) => {
    setForm(newFormData);
    setIsFormDirty(true);
  };

  const handleValidationClear = (field, isAddress = false) => {
    if (isAddress) {
      if (validationErrors[`address_${field}`]) {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[`address_${field}`];
          return newErrors;
        });
      }
    } else {
      if (validationErrors[field]) {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
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
    setAdditionalFieldValues((prev) => ({
      ...prev,
      [fieldName]: newValue,
    }));
    setIsFormDirty(true);
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
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfilePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const fetchGSTINDetails = async () => {
    const gstin = form.gstin?.trim().toUpperCase();
    if (!gstin) {
      toast.error("Please enter GSTIN number first");
      return;
    }
    if (!gstinRegex.test(gstin)) {
      toast.error("Invalid GSTIN format");
      return;
    }

    setGstinLoading(true);
    try {
      const response = await fetch(`${GSTIN_API_URL}${GSTIN_API_KEY}/${gstin}`);
      const data = await response.json();

      if (data.flag === true && data.data) {
        const result = data.data;
        const addressInfo = result.pradr || {};
        const fullAddress = addressInfo.adr || "";
        const city = addressInfo.addr?.dst || "";
        const state = addressInfo.addr?.stcd ? result.stj : "";
        const pincode = addressInfo.addr?.pncd || "";

        setForm((prev) => ({
          ...prev,
          name: result.lgnm || prev.name,
          company: result.tradeNam || result.lgnm || prev.company,
          address: {
            ...prev.address,
            line1: fullAddress,
            city: city,
            state: state,
            pincode: pincode,
            country: "India",
          },
        }));
        setIsFormDirty(true);
        setValidationErrors({}); // Clear validation errors on successful fetch
        toast.success("GSTIN details fetched!");
      } else {
        toast.error(data.message || "GSTIN not found");
      }
    } catch (error) {
      console.error("GSTIN fetch error:", error);
      toast.error("Failed to fetch GSTIN details");
    } finally {
      setGstinLoading(false);
    }
  };

  const validateForm = () => {
    const errors = {};

    // 👉 FIX 2: A helper to safely convert anything (Numbers/Null) to a String before trimming
    const safeTrim = (val) => String(val || "").trim();

    if (!safeTrim(form.name)) errors.name = "Vendor Name is required";
    if (!safeTrim(form.email)) errors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeTrim(form.email))) errors.email = "Invalid email format";
    if (!safeTrim(form.phone)) errors.phone = "Phone is required";
    if (!safeTrim(form.company)) errors.company = "Company is required";
    if (!safeTrim(form.address?.line1)) errors.address_line1 = "Address Line 1 is required";
    if (!safeTrim(form.address?.city)) errors.address_city = "City is required";
    if (!safeTrim(form.address?.state)) errors.address_state = "State is required";
    if (!safeTrim(form.address?.pincode)) errors.address_pincode = "Pincode is required";
    if (!safeTrim(form.address?.country)) errors.address_country = "Country is required";

    vendorFields?.forEach((fieldDef) => {
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
      const formData = new FormData();
      formData.append("name", form.name);
      formData.append("email", form.email);
      formData.append("phone", form.phone);
      formData.append("company", form.company);
      formData.append("gstin", form.gstin || "");
      formData.append("address", JSON.stringify(form.address));

      if (form.socialMedia) {
        formData.append("socialMedia[twitter]", form.socialMedia.twitter || "");
        formData.append("socialMedia[linkedin]", form.socialMedia.linkedin || "");
        formData.append("socialMedia[instagram]", form.socialMedia.instagram || "");
        formData.append("socialMedia[facebook]", form.socialMedia.facebook || "");
        formData.append("socialMedia[whatsapp]", form.socialMedia.whatsapp || "");
      }

      // Process Dynamic Additional Fields
      if (vendorFields && vendorFields.length > 0) {
        const processedAdditionalFields = vendorFields
          .map((fieldDef) => {
            let value = additionalFieldValues[fieldDef.name] || "";

            // 👉 FIX 3: Convert Arrays (from checkboxes) into a clean comma-separated string
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
          formData.append(`additionalFields[${index}][key]`, field.key);
          formData.append(`additionalFields[${index}][value]`, field.value);
          formData.append(`additionalFields[${index}][type]`, field.type);
        });
      }

      if (profilePicture) {
        formData.append("avatar", profilePicture);
      }

      if (form._id) {
        // 👉 FIX 4: Double check this route! 
        // Your Contact form uses `/contacts/update/${form._id}`. 
        // Does your backend expect `/vendors/update/${form._id}` or just `/vendors/${form._id}`?
        await API.put(`/vendors/${form._id}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Vendor updated successfully!");
      } else {
        await API.post("/vendors", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Vendor added successfully!");
      }

      await fetchVendors();
      setIsFormDirty(false);
      closeForm();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to save vendor");
    } finally {
      setLoading(false);
    }
  };

  // Render function for Additional Fields
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

      case "date": {
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
      }

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

  // --- CATEGORY & GROUPING LOGIC ---
  const [expandedSections, setExpandedSections] = useState({});

  const toggleSection = (category) => {
    setExpandedSections((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  useEffect(() => {
    if (vendorFields && vendorFields.length > 0) {
      const defaultExpanded = {};
      vendorFields.forEach((fieldDef) => {
        const cat = (fieldDef.category && typeof fieldDef.category === 'string')
          ? fieldDef.category
          : "Uncategorized";
        defaultExpanded[cat] = true; // Opens all by default
      });
      setExpandedSections(defaultExpanded);
    }
  }, [vendorFields]);

  const groupedFields = (vendorFields || []).reduce((acc, fieldDef) => {
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
  // ---------------------------------

  if (!shouldRender) return null;

  return (
    <>
      {/* Unsaved Changes Dialog */}
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

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[10002] flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Vendor
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete "{form.name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteVendor}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[10000] transition-opacity duration-300"
        style={{ opacity: isOpen ? 1 : 0 }}
        onClick={handleClose}
      />

      {/* Panel — reusing CompanyForm.jsx's exact card treatment (dc-panel-card
          + dc-panel-w: floating, rounded, inset from top/bottom/right by
          1.5rem) instead of inventing a new modal style. */}
      <div
        className={`
          fixed dc-panel-card z-[10001]
          dc-panel-w bg-white shadow-2xl flex flex-col overflow-hidden
          transform transition-transform duration-300 ease-in-out font-inter
          ${isOpen ? "translate-x-0" : "translate-x-[calc(100%+2rem)]"}
        `}
      >
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-[#F2F2F7] flex-shrink-0 bg-white">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
              {form._id ? "Edit Vendor" : "Create New Vendor"}
            </h2>
            <div className="flex items-center gap-3">
              {/* Edit/Delete only apply to an existing vendor — nothing to
                  edit or delete before it's been created. The pencil isn't
                  a button: this form IS the edit surface already, so there's
                  no separate "edit mode" for it to toggle into. */}
              {form._id && (
                <>
                  <Pencil className="w-4 h-4 text-blue-500" />
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    title="Delete vendor"
                    className="text-red-500 hover:text-red-600 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <span className="w-px h-4 bg-gray-200" />
                </>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 space-y-6">

            {/* Profile Picture matched to ContactForm */}
            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-2">
                Profile Picture
              </label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {profilePreview ? (
                    <img
                      src={profilePreview}
                      alt="Preview"
                      className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                    />
                  ) : (
                    <div
                      className={`w-20 h-20 rounded-full flex items-center justify-center text-white font-semibold text-lg ${form.name
                        ? ["bg-red-500", "bg-green-500", "bg-blue-500", "bg-yellow-500", "bg-purple-500", "bg-pink-500"][form.name.charCodeAt(0) % 6]
                        : "bg-gray-500"
                        }`}
                    >
                      {form.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                    </div>
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 h-10 border border-[#E0E0E1] rounded-xl text-[14px] font-semibold text-[#111216] hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Choose Photo
                  </button>
                  <p className="text-xs text-gray-400 mt-2 ml-1">
                    PNG, JPEG up to 5MB
                  </p>
                </div>
              </div>
            </div>

            <h3 className="text-[13px] font-bold text-[#111216] uppercase tracking-wide border-t border-[#F2F2F7] pt-5">
              Vendor Information
            </h3>

            {/* Fields — single column, matching the reference exactly. Phone
                isn't in that reference screenshot but is still required by
                validateForm()/the backend, so it's kept right after Vendor
                Name rather than silently dropped. */}
            <div className="space-y-5">

              {/* Vendor Name */}
              <div>
                <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                  Vendor Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name || ""}
                  onChange={(e) => {
                    handleFormChange({ ...form, name: e.target.value });
                    handleValidationClear("name");
                  }}
                  className={`w-full border rounded-full px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] ${validationErrors.name ? 'border-red-500' : 'border-[#E0E0E1]'
                    }`}
                  placeholder="Enter Vendor Name"
                />
                {validationErrors.name && <p className="text-red-500 text-xs mt-1">{validationErrors.name}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.phone || ""}
                  onChange={(e) => {
                    handleFormChange({ ...form, phone: e.target.value });
                    handleValidationClear("phone");
                  }}
                  className={`w-full border rounded-full px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] ${validationErrors.phone ? 'border-red-500' : 'border-[#E0E0E1]'
                    }`}
                  placeholder="Enter Phone Number"
                />
                {validationErrors.phone && <p className="text-red-500 text-xs mt-1">{validationErrors.phone}</p>}
              </div>

              {/* GSTIN */}
              <div>
                <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                  GSTIN
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.gstin || ""}
                    onChange={(e) =>
                      handleFormChange({ ...form, gstin: e.target.value.toUpperCase() })
                    }
                    className="flex-1 min-w-0 border border-[#E0E0E1] rounded-full px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]"
                    placeholder="Enter GSTIN (15 Digits)"
                    maxLength={15}
                  />
                  <button
                    type="button"
                    onClick={fetchGSTINDetails}
                    disabled={gstinLoading}
                    className="px-6 h-11 bg-[#0C4FCD] text-white text-[14px] font-bold rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0"
                  >
                    {gstinLoading ? "..." : "Fetch"}
                  </button>
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={form.email || ""}
                  onChange={(e) => {
                    handleFormChange({ ...form, email: e.target.value });
                    handleValidationClear("email");
                  }}
                  className={`w-full border rounded-full px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] ${validationErrors.email ? 'border-red-500' : 'border-[#E0E0E1]'
                    }`}
                  placeholder="Enter Vendor Email"
                />
                {validationErrors.email && <p className="text-red-500 text-xs mt-1">{validationErrors.email}</p>}
              </div>

              {/* Company */}
              <div>
                <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.company || ""}
                  onChange={(e) => {
                    handleFormChange({ ...form, company: e.target.value });
                    handleValidationClear("company");
                  }}
                  className={`w-full border rounded-full px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] ${validationErrors.company ? 'border-red-500' : 'border-[#E0E0E1]'
                    }`}
                  placeholder="Enter Vendor Company Name"
                />
                {validationErrors.company && <p className="text-red-500 text-xs mt-1">{validationErrors.company}</p>}
              </div>

              {/* Address 1 */}
              <div>
                <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                  Address Line 1 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.address?.line1 || ""}
                  onChange={(e) => {
                    handleFormChange({ ...form, address: { ...form.address, line1: e.target.value } });
                    handleValidationClear("line1", true);
                  }}
                  className={`w-full border rounded-full px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] ${validationErrors.address_line1 ? 'border-red-500' : 'border-[#E0E0E1]'
                    }`}
                  placeholder="Enter Vendor Address Line 1"
                />
                {validationErrors.address_line1 && <p className="text-red-500 text-xs mt-1">{validationErrors.address_line1}</p>}
              </div>

              {/* Address 2 */}
              <div>
                <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={form.address?.line2 || ""}
                  onChange={(e) =>
                    handleFormChange({ ...form, address: { ...form.address, line2: e.target.value } })
                  }
                  className="w-full border border-[#E0E0E1] rounded-full px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]"
                  placeholder="Enter Vendor Address Line 2"
                />
              </div>

              {/* City / State */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.address?.city || ""}
                    onChange={(e) => {
                      handleFormChange({ ...form, address: { ...form.address, city: e.target.value } });
                      handleValidationClear("city", true);
                    }}
                    className={`w-full border rounded-full px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] ${validationErrors.address_city ? 'border-red-500' : 'border-[#E0E0E1]'
                      }`}
                    placeholder="Enter Vendor City"
                  />
                  {validationErrors.address_city && <p className="text-red-500 text-xs mt-1">{validationErrors.address_city}</p>}
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.address?.state || ""}
                    onChange={(e) => {
                      handleFormChange({ ...form, address: { ...form.address, state: e.target.value } });
                      handleValidationClear("state", true);
                    }}
                    className={`w-full border rounded-full px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] ${validationErrors.address_state ? 'border-red-500' : 'border-[#E0E0E1]'
                      }`}
                    placeholder="Enter Vendor State"
                  />
                  {validationErrors.address_state && <p className="text-red-500 text-xs mt-1">{validationErrors.address_state}</p>}
                </div>
              </div>

              {/* Pincode / Country */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                    Pincode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.address?.pincode || ""}
                    onChange={(e) => {
                      handleFormChange({ ...form, address: { ...form.address, pincode: e.target.value } });
                      handleValidationClear("pincode", true);
                    }}
                    className={`w-full border rounded-full px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] ${validationErrors.address_pincode ? 'border-red-500' : 'border-[#E0E0E1]'
                      }`}
                    placeholder="Enter Vendor Pincode"
                  />
                  {validationErrors.address_pincode && <p className="text-red-500 text-xs mt-1">{validationErrors.address_pincode}</p>}
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                    Country <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.address?.country || "India"}
                    onChange={(e) => {
                      handleFormChange({ ...form, address: { ...form.address, country: e.target.value } });
                      handleValidationClear("country", true);
                    }}
                    className={`w-full border rounded-full px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] ${validationErrors.address_country ? 'border-red-500' : 'border-[#E0E0E1]'
                      }`}
                    placeholder="Enter Vendor Country"
                  />
                  {validationErrors.address_country && <p className="text-red-500 text-xs mt-1">{validationErrors.address_country}</p>}
                </div>
              </div>
            </div>

            {/* Custom Fields (Categorized & Collapsible) — sits directly
                after the basic info above, ahead of the additional-info
                sections below, so org-defined fields aren't buried at the
                very bottom of the form. */}
            {sortedCategories.length > 0 && (
              <div className="pt-4 space-y-4">
                <h3 className="text-[16px] font-bold text-[#111216]">Custom Fields</h3>
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
                            {/* No raw "(type)" annotation here — that's field-builder
                                metadata for the admin configuring this field in Settings,
                                not something an end user filling out the form needs to
                                see. The input control itself already communicates the
                                type (dropdown, checkboxes, etc). */}
                            <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                              {fieldDef.name}
                              {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
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

            {/* Additional Info — Social Media Links Section */}
            <div className="border-t border-[#F2F2F7] pt-5">
              <h3 className="text-[13px] font-bold text-[#111216] uppercase tracking-wide mb-3">Social Media Links</h3>
              <div className="space-y-3">
                {/* Twitter/X */}
                <div>
                  <label className="block text-[13px] font-semibold text-[#111216] mb-1.5 flex items-center gap-2">
                    <Twitter className="w-4 h-4 text-gray-600" />
                    X (Twitter)
                  </label>
                  <input
                    type="url"
                    value={form.socialMedia?.twitter || ""}
                    onChange={(e) => handleSocialMediaChange("twitter", e.target.value)}
                    className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]"
                    placeholder="https://twitter.com/username"
                  />
                </div>

                {/* LinkedIn */}
                <div>
                  <label className="block text-[13px] font-semibold text-[#111216] mb-1.5 flex items-center gap-2">
                    <Linkedin className="w-4 h-4 text-gray-600" />
                    LinkedIn
                  </label>
                  <input
                    type="url"
                    value={form.socialMedia?.linkedin || ""}
                    onChange={(e) => handleSocialMediaChange("linkedin", e.target.value)}
                    className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]"
                    placeholder="https://linkedin.com/in/username"
                  />
                </div>

                {/* Instagram */}
                <div>
                  <label className="block text-[13px] font-semibold text-[#111216] mb-1.5 flex items-center gap-2">
                    <Instagram className="w-4 h-4 text-gray-600" />
                    Instagram
                  </label>
                  <input
                    type="url"
                    value={form.socialMedia?.instagram || ""}
                    onChange={(e) => handleSocialMediaChange("instagram", e.target.value)}
                    className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]"
                    placeholder="https://instagram.com/username"
                  />
                </div>

                {/* Facebook */}
                <div>
                  <label className="block text-[13px] font-semibold text-[#111216] mb-1.5 flex items-center gap-2">
                    <Facebook className="w-4 h-4 text-gray-600" />
                    Facebook
                  </label>
                  <input
                    type="url"
                    value={form.socialMedia?.facebook || ""}
                    onChange={(e) => handleSocialMediaChange("facebook", e.target.value)}
                    className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]"
                    placeholder="https://facebook.com/username"
                  />
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="block text-[13px] font-semibold text-[#111216] mb-1.5 flex items-center gap-2">
                    <FaWhatsapp className="w-4 h-4 text-gray-600" />
                    WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={form.socialMedia?.whatsapp || ""}
                    onChange={(e) => handleSocialMediaChange("whatsapp", e.target.value)}
                    className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]"
                    placeholder="e.g., +1234567890"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Footer — same as CompanyForm.jsx's action row */}
          <div className="p-8 pt-6 border-t border-[#F2F2F7] flex gap-4 flex-shrink-0 bg-white">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 border border-[#E0E0E1] text-[#111216] h-12 rounded-xl text-[14px] font-bold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#0C4FCD] text-white h-12 rounded-xl text-[14px] font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading
                ? "Saving..."
                : form._id
                  ? "Update Vendor"
                  : "Create New Vendor"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default VendorForm;