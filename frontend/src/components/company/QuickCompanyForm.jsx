import React, { useEffect, useState, useRef } from "react";
import API from "../../services/api";
import CustomDropdown from "../common/CustomDropdown";
import toast from "react-hot-toast";

const QuickCompanyForm = ({ onCompanyCreated, onRequestClose }) => {
  const [form, setForm] = useState({
    name: "",
    industry: "",
    address: "",
    website: "",
    gstin: "", // Added gstin field
    profilePicture: null,
  });
  const [additionalFields, setAdditionalFields] = useState({});
  const [fieldDefinitions, setFieldDefinitions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [industries, setIndustries] = useState([]);

  useEffect(() => {
    setShouldRender(true);
    setTimeout(() => setIsOpen(true), 10);
    fetchFieldDefinitions();
    fetchIndustries();
    return () => {
      setIsOpen(false);
    };
  }, []);

  const fetchFieldDefinitions = async () => {
    try {
      const res = await API.get("/company-fields");
      if (res.data && res.data.fields) {
        setFieldDefinitions(res.data.fields);
      }
    } catch (err) {
      console.error("Failed to fetch field definitions");
      toast.error("Failed to fetch field definitions");
    }
  };

  const fetchIndustries = async () => {
    try {
      const res = await API.get("/company-industries");
      if (res.data) {
        // Ensure we extract names if the API returns objects
        const data = res.data;
        const industryList = Array.isArray(data)
          ? data.map((item) => (typeof item === "object" ? item.name : item))
          : [];
        setIndustries(industryList);
      }
    } catch (err) {
      console.error("Failed to fetch industries:", err);
      toast.error("Failed to load industries");
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

  const renderFieldInput = (fieldDef, value) => {
    const handleFieldChange = (newValue) => {
      setAdditionalFields((prev) => ({
        ...prev,
        [fieldDef.name]: newValue,
      }));
      setIsFormDirty(true);
    };

    switch (fieldDef.type) {
      case "number":
        return (
          <input
            type="number"
            step="any"
            value={value || ""}
            onChange={(e) => handleFieldChange(e.target.value)}
            className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-inter"
            required={fieldDef.required}
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
            className="w-full border border-[#E0E0E1] rounded-xl px-4 py-3 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-inter resize-vertical"
            required={fieldDef.required}
          />
        );

      case "date":
        return (
          <input
            type="date"
            value={value || ""}
            onChange={(e) => handleFieldChange(e.target.value)}
            className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-inter"
            required={fieldDef.required}
          />
        );

      case "url":
        return (
          <input
            type="url"
            value={value || ""}
            onChange={(e) => handleFieldChange(e.target.value)}
            className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-inter placeholder:text-[#A0A0A0]"
            required={fieldDef.required}
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
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-xl px-4 py-3 transition-colors border border-transparent hover:border-[#E0E0E1]"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        let newValues;
                        if (e.target.checked) {
                          // Add option to array
                          newValues = [...selectedValues, option];
                        } else {
                          // Remove option from array
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
              <p className="text-sm text-gray-500 italic">
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
            className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-inter"
            required={fieldDef.required}
          />
        );
    }
  };


  const handleSubmit = async (e, isSaveAndExit = false) => {
    e.preventDefault();
    if (!form.name.trim() || !form.industry.trim()) {
      toast.error("Company name and industry are required");
      if (!isSaveAndExit) closeForm();
      return;
    }

    const payload = new FormData();
    payload.append("name", form.name);
    payload.append("industry", form.industry);
    payload.append("address", form.address);
    payload.append("website", form.website);
    payload.append("gstin", form.gstin); // Added gstin to payload

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

    if (form.profilePicture) {
      payload.append("profilePicture", form.profilePicture);
    }

    try {
      setLoading(true);
      const res = await API.post("/companies", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Company added successfully!");
      if (onCompanyCreated && res.data) {
        onCompanyCreated(res.data);
      }
      setIsFormDirty(false);
      closeForm();
    } catch (err) {
      let errorMessage = "Failed to save company. Please try again.";
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
          errorMessage =
            "Subscription expired. Please renew to add or update companies.";
        } else if (
          errorMessage.includes("Write access to companies not allowed")
        ) {
          errorMessage =
            "Your plan does not allow adding or updating companies. Please upgrade your plan.";
        }
      }
      toast.error(errorMessage);
      if (!isSaveAndExit) closeForm();
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsFormDirty(true);
  };

  if (!shouldRender) return null;

  return (
    <>
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 z-[10004] flex items-center justify-center">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-sm sm:max-w-lg mx-4">
            <h3 className="text-lg font-semibold font-sf text-gray-900 mb-4">
              Unsaved Changes
            </h3>
            <p className="text-sm text-gray-600 mb-6 font-inter">
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

      <div
        className="fixed inset-0 bg-black/20 z-[10000] transition-opacity duration-300 ease-in-out"
        style={{ opacity: isOpen ? 1 : 0 }}
        onClick={handleClose}
      />

      <div
        className={`
          fixed inset-y-0 right-0 z-[10003] 
          w-full sm:w-[500px] md:w-[600px]
          max-w-full bg-white shadow-2xl overflow-y-auto 
          transform transition-transform duration-300 ease-in-out font-inter
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        <form onSubmit={handleSubmit} className="p-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-[24px] font-bold text-[#111216]">
              Create New Company
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

          <div className="space-y-6">
            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleFormChange("name", e.target.value)}
                className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]"
                required
                placeholder="Enter Company Name"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Industry <span className="text-red-500">*</span>
              </label>
              <CustomDropdown
                options={industries}
                value={form.industry}
                onChange={(value) => handleFormChange("industry", value)}
                placeholder="Select Industry"
                required
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                GSTIN <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.gstin}
                onChange={(e) => handleFormChange("gstin", e.target.value)}
                className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]"
                placeholder="GSTIN-1234567890"
                required
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => handleFormChange("address", e.target.value)}
                className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]"
                placeholder="Enter Address Here"
                required
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Website <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => handleFormChange("website", e.target.value)}
                className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]"
                placeholder="www.company.com"
                required
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Select Profile Picture <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      handleFormChange("profilePicture", e.target.files[0]);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    required
                  />
                  <div className="w-full border border-[#E0E0E1] rounded-xl px-4 h-12 flex items-center text-[14px] text-[#A0A0A0] bg-white">
                    {form.profilePicture ? form.profilePicture.name : "Choose a File"}
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

            {fieldDefinitions.length > 0 && (
              <div className="pt-4 space-y-6">
                <h3 className="text-[16px] font-bold text-[#111216]">
                  Additional Information
                </h3>
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
            )}
          </div>

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
              {loading ? "Saving..." : "Create Company"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default QuickCompanyForm;