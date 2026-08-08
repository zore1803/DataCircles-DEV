import React, { useEffect, useState, useRef } from "react";
import API from "../../services/api";
import { Upload, X } from "lucide-react";
import toast from "react-hot-toast";

const QuickVendorForm = ({ onVendorCreated, onVendorUpdated, onRequestClose, editVendor = null }) => {
  const isEditing = !!editVendor;
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    gstin: "",
    address: {
      line1: "",
      line2: "",
      city: "",
      state: "",
      pincode: "",
      country: "India",
    },
  });
  const [additionalFields, setAdditionalFields] = useState({});
  const [fieldDefinitions, setFieldDefinitions] = useState([]);
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const [gstinLoading, setGstinLoading] = useState(false);
  const [gstinData, setGstinData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const fileInputRef = useRef(null);

  // GSTIN API configuration
  const GSTIN_API_KEY = import.meta.env.VITE_APP_GSTIN_API_KEY || "";
  const GSTIN_API_URL = "https://sheet.gstincheck.co.in/check/";
  const gstinRegex =
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/;

  useEffect(() => {
    setShouldRender(true);
    setTimeout(() => setIsOpen(true), 10);
    fetchFieldDefinitions();
    return () => {
      setIsOpen(false);
      setProfilePicture(null);
      setProfilePreview(null);
      setGstinData(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
  }, []);

  // Pre-fill when editing so edit and create share one form.
  useEffect(() => {
    if (!editVendor) return;
    setForm({
      name: editVendor.name || "",
      email: editVendor.email || "",
      phone: editVendor.phone || "",
      company: editVendor.company || "",
      gstin: editVendor.gstin || "",
      address: {
        line1: editVendor.address?.line1 || "",
        line2: editVendor.address?.line2 || "",
        city: editVendor.address?.city || "",
        state: editVendor.address?.state || "",
        pincode: editVendor.address?.pincode || "",
        country: editVendor.address?.country || "India",
      },
    });
    if (editVendor.profilePicture) setProfilePreview(editVendor.profilePicture);
    const pf = {};
    (editVendor.additionalFields || []).forEach((f) => {
      pf[f.key] = f.value;
    });
    setAdditionalFields(pf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editVendor]);

  const fetchFieldDefinitions = async () => {
    try {
      const res = await API.get("/vendor-fields");
      if (res.data && res.data.fields) {
        setFieldDefinitions(res.data.fields);
      }
    } catch (err) {
      console.error("Failed to fetch vendor field definitions");
      toast.error("Failed to fetch vendor field definitions");
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

  const fetchGSTINDetails = async () => {
    const gstin = form.gstin?.trim().toUpperCase();

    if (!gstin) {
      toast.error("Please enter GSTIN number first");
      return;
    }

    if (!gstinRegex.test(gstin)) {
      toast.error("Invalid GSTIN format. Please check the number");
      return;
    }

    setGstinLoading(true);
    setGstinData(null);

    try {
      const response = await fetch(`${GSTIN_API_URL}${GSTIN_API_KEY}/${gstin}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.flag === true && data.data) {
        const result = data.data;
        setGstinData(result);

        const addressInfo = result.pradr || {};
        const fullAddress = addressInfo.adr || "";
        const location = addressInfo.loc || "";
        const city = addressInfo.addr.dst || location || "";
        const state =
          addressInfo.std || extractStateFromString(result.stj) || "";
        const pincode = addressInfo.addr.pncd || "";

        const addressParts = fullAddress.split(",").map((part) => part.trim());

        let addressLine1 = "";
        let addressLine2 = "";

        if (addressParts.length >= 2) {
          addressLine1 = addressParts.slice(0, 2).join(", ");
          addressLine2 = addressParts.slice(2).join(", ");
        } else {
          addressLine1 = fullAddress;
        }

        setForm((prevForm) => ({
          ...prevForm,
          name: result.lgnm || prevForm.name,
          company: result.tradeNam || result.lgnm || prevForm.company,
          address: {
            ...prevForm.address,
            line1: addressLine1 || prevForm.address.line1,
            line2: addressLine2 || prevForm.address.line2,
            city: city || prevForm.address.city,
            state: state || prevForm.address.state,
            pincode: pincode || prevForm.address.pincode,
            country: "India",
          },
        }));
        setIsFormDirty(true);
        toast.success("GSTIN details fetched and applied");
      } else if (data.flag === false) {
        const errorMsg = data.message || "GSTIN not found or invalid";
        toast.error(errorMsg);
      } else {
        toast.error("Unexpected response from GSTIN API. Please try again.");
      }
    } catch (error) {
      console.error("GSTIN fetch error:", error);
      toast.error(`Failed to fetch GSTIN details: ${error.message}`);
    } finally {
      setGstinLoading(false);
    }
  };

  const extractStateFromString = (jurisdictionString) => {
    if (!jurisdictionString) return "";
    const stateMatch = jurisdictionString.match(/State\s*-\s*([^,]+)/);
    return stateMatch ? stateMatch[1].trim() : "";
  };

  const clearGSTINData = () => {
    setGstinData(null);
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
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfilePreview(e.target.result);
      };
      reader.readAsDataURL(file);
      setIsFormDirty(true);
    }
  };

  const getRandomColor = (name) => {
    const colors = [
      "bg-red-500",
      "bg-green-500",
      "bg-blue-500",
      "bg-yellow-500",
      "bg-purple-500",
      "bg-pink-500",
    ];
    const index = name ? name.charCodeAt(0) % colors.length : 0;
    return colors[index];
  };

  const getInitials = (name) => {
    return (
      name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "?"
    );
  };

  const renderFieldInput = (fieldDef, value) => {
    const handleFieldChange = (newValue) => {
      setAdditionalFields((prev) => ({
        ...prev,
        [fieldDef.name]: newValue,
      }));
      setIsFormDirty(true);
    };

    const inputClassName = "w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] font-inter";

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
            required={fieldDef.required}
          />
        );

      case "dropdown":
        return (
          <div className="relative">
            <select
              value={value || ""}
              onChange={(e) => handleFieldChange(e.target.value)}
              className={`${inputClassName.replace('h-12', 'h-12 appearance-none')} cursor-pointer bg-white`}
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
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        );

      case "text":
        return (
          <textarea
            rows={3}
            value={value || ""}
            onChange={(e) => handleFieldChange(e.target.value)}
            className={`${inputClassName.replace('h-12', 'py-3')} resize-vertical`}
            placeholder={`Enter ${fieldDef.name}`}
            required={fieldDef.required}
          />
        );

      case "date":
        return (
          <input
            type="date"
            value={value || ""}
            onChange={(e) => handleFieldChange(e.target.value)}
            className={inputClassName}
            required={fieldDef.required}
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
            required={fieldDef.required}
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
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
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
            required={fieldDef.required}
          />
        );
    }
  };


  const handleFormChange = (key, value) => {
    if (key.startsWith("address.")) {
      const addressKey = key.split(".")[1];
      setForm((prev) => ({
        ...prev,
        address: { ...prev.address, [addressKey]: value },
      }));
    } else {
      setForm((prev) => ({ ...prev, [key]: value }));
    }
    setIsFormDirty(true);
  };

  const handleSubmit = async (e, isSaveAndExit = false) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Vendor name is required");
      if (!isSaveAndExit) closeForm();
      return;
    }

    const formData = new FormData();
    formData.append("name", form.name);
    formData.append("email", form.email);
    formData.append("phone", form.phone);
    formData.append("company", form.company);
    formData.append("gstin", form.gstin);
    formData.append("address", JSON.stringify(form.address));

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

    formData.append(
      "additionalFields",
      JSON.stringify(processedAdditionalFields)
    );

    if (profilePicture) {
      formData.append("avatar", profilePicture);
    }

    try {
      setLoading(true);
      const res = isEditing
        ? await API.put(`/vendors/${editVendor._id}`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          })
        : await API.post("/vendors", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
      toast.success(isEditing ? "Vendor updated successfully!" : "Vendor added successfully!");
      const cb = isEditing ? onVendorUpdated || onVendorCreated : onVendorCreated;
      if (cb && res.data) {
        cb(res.data);
      }
      setIsFormDirty(false);
      closeForm();
    } catch (err) {
      let errorMessage = "Failed to save vendor. Please try again.";
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
          errorMessage = "Subscription expired. Please renew to add vendors.";
        } else if (
          errorMessage.includes("Write access to vendors not allowed")
        ) {
          errorMessage =
            "Your plan does not allow adding vendors. Please upgrade your plan.";
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
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[10000] transition-opacity duration-300 ease-in-out"
        style={{ opacity: isOpen ? 1 : 0 }}
        onClick={handleClose}
      />

      <div
 className={`fixed dc-panel-card dc-panel-w z-[10002] bg-white shadow-2xl flex flex-col overflow-hidden transform transition-transform duration-300 ease-in-out font-inter ${isOpen ? "translate-x-0" : "translate-x-[calc(100%+2rem)]"
          }`}
      >
        <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
          <div className="flex justify-between items-center p-4 border-b border-gray-100 flex-shrink-0">
            <h3 className="text-base font-semibold text-gray-700">
              {isEditing ? "Edit Vendor" : "Create New Vendor"}
            </h3>
            <button
              type="button"
              onClick={handleClose}
              className="p-1 px-2 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-8 space-y-6">
            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-3">
                Profile Picture
              </label>
              <div className="flex items-center space-x-6 p-4 border border-[#E0E0E1] rounded-xl bg-gray-50/50">
                <div className="relative">
                  {profilePreview ? (
                    <img
                      src={profilePreview}
                      alt="Preview"
                      className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-sm"
                    />
                  ) : (
                    <div
                      className={`w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-inner ${getRandomColor(
                        form.name
                      )}`}
                    >
                      {getInitials(form.name)}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="avatar"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="avatar"
                    className="inline-flex items-center px-6 py-2 bg-white text-[#111216] text-[14px] font-bold rounded-xl hover:bg-gray-50 focus:outline-none cursor-pointer border border-[#E0E0E1] transition-colors shadow-sm"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose Photo
                  </label>
                  <p className="text-[12px] text-gray-500 mt-2 font-inter italic">
                    PNG, JPG up to 5MB
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Vendor Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleFormChange("name", e.target.value)}
                className="w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] font-inter"
                placeholder="Enter Vendor Name"
                required
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                GSTIN <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.gstin}
                  onChange={(e) =>
                    handleFormChange("gstin", e.target.value.toUpperCase())
                  }
                  className="flex-1 border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] font-inter"
                  placeholder="GSTIN123456789"
                  maxLength="15"
                />
                <button
                  type="button"
                  onClick={fetchGSTINDetails}
                  disabled={gstinLoading || !form.gstin?.trim()}
                  className={`px-8 h-12 text-[14px] font-bold rounded-xl transition-colors font-inter shadow-sm ${gstinLoading || !form.gstin?.trim()
                      ? "bg-[#F2F2F7] text-gray-400 cursor-not-allowed"
                      : "bg-[#F2F2F7] text-[#111216] hover:bg-gray-200"
                    }`}
                >
                  {gstinLoading ? "Fetching..." : "Fetch"}
                </button>
              </div>
              {gstinData && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-green-600"></div>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-green-800 mb-2">
                        ✓ GSTIN Details Found & Applied
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-medium text-green-700">
                            Legal Name:
                          </span>
                          <p className="text-green-600">
                            {gstinData.lgnm || "N/A"}
                          </p>
                        </div>
                        {gstinData.tradeNam && (
                          <div>
                            <span className="font-medium text-green-700">
                              Trade Name:
                            </span>
                            <p className="text-green-600">
                              {gstinData.tradeNam}
                            </p>
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-green-700">
                            Business Type:
                          </span>
                          <p className="text-green-600">
                            {gstinData.ctb || "N/A"}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-green-700">
                            Status:
                          </span>
                          <p className="text-green-600">
                            {gstinData.sts || "N/A"}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={clearGSTINData}
                        className="text-xs text-green-600 hover:text-green-800 mt-2 underline"
                      >
                        Clear GSTIN Data
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <p className="text-[12px] text-gray-500 mt-2 font-inter italic">
                Enter a valid 15-digit GSTIN and click "FETCH" to auto-fill company details
              </p>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleFormChange("email", e.target.value)}
                className="w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] font-inter"
                placeholder="Enter Vendor Email"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Phone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => handleFormChange("phone", e.target.value)}
                className="w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] font-inter"
                placeholder="Enter Phone Number"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Company
              </label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => handleFormChange("company", e.target.value)}
                className="w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] font-inter"
                placeholder="Enter Company Name"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Address Line 1
              </label>
              <input
                type="text"
                value={form.address.line1}
                onChange={(e) =>
                  handleFormChange("address.line1", e.target.value)
                }
                className="w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] font-inter"
                placeholder="Enter Address line 1"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Address Line 2
              </label>
              <input
                type="text"
                value={form.address.line2}
                onChange={(e) =>
                  handleFormChange("address.line2", e.target.value)
                }
                className="w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] font-inter"
                placeholder="Enter Address line 2"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                City
              </label>
              <input
                type="text"
                value={form.address.city}
                onChange={(e) =>
                  handleFormChange("address.city", e.target.value)
                }
                className="w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] font-inter"
                placeholder="Enter City"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                State
              </label>
              <input
                type="text"
                value={form.address.state}
                onChange={(e) =>
                  handleFormChange("address.state", e.target.value)
                }
                className="w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] font-inter"
                placeholder="Enter State"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Pincode
              </label>
              <input
                type="text"
                value={form.address.pincode}
                onChange={(e) =>
                  handleFormChange("address.pincode", e.target.value)
                }
                className="w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] font-inter"
                placeholder="Enter Pincode"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Country
              </label>
              <input
                type="text"
                value={form.address.country}
                onChange={(e) =>
                  handleFormChange("address.country", e.target.value)
                }
                className="w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] font-inter"
                placeholder="Enter Country"
              />
            </div>

            {fieldDefinitions.length > 0 && (
              <div className="pt-4 space-y-6">
                <h3 className="text-[16px] font-bold text-[#111216]">
                  Additional Information
                </h3>
                <div className="space-y-6 font-inter">
                  {fieldDefinitions.map((fieldDef) => (
                    <div key={fieldDef.name}>
                      <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                        {fieldDef.name} {fieldDef.required && <span className="text-red-500">*</span>}
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

          <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-3 flex-shrink-0 bg-white">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors font-inter"
            >
              Cancel
            </button>
            <button
              className="px-6 py-2.5 bg-[#0C4FCD] text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-inter"
              type="submit"
              disabled={loading}
            >
              {loading ? "Saving..." : isEditing ? "Update Vendor" : "Create New Vendor"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default QuickVendorForm;
