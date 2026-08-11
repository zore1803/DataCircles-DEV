import React, { useEffect, useState, useRef } from "react";
import API from "../../services/api";
import CustomDropdown from "../common/CustomDropdown";
import toast from "react-hot-toast";
import { INDIA_STATES, COUNTRIES } from "../../constants/addressOptions";

const QuickCompanyForm = ({ onCompanyCreated, onCompanyUpdated, onRequestClose, editCompany = null }) => {
  const isEditing = !!editCompany;
  const emptyAddress = {
    addressLine1: "",
    addressLine2: "",
    pincode: "",
    city: "",
    state: "",
    country: "",
  };
  const [form, setForm] = useState({
    name: "",
    industry: "",
    // Exactly one billing address (GST is derived from its state).
    billingAddress: { ...emptyAddress },
    // One or more shipping addresses; each can mirror the billing address.
    shippingAddresses: [{ ...emptyAddress, sameAsBilling: false }],
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
  const profilePictureInputRef = useRef(null);
  // Object URL for whatever file is currently picked, so both create and edit
  // show the actual image instead of just its filename. Revoked whenever the
  // selection changes or the form unmounts, since object URLs otherwise leak.
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  useEffect(() => {
    if (!form.profilePicture) {
      setProfilePicturePreview(null);
      return;
    }
    const url = URL.createObjectURL(form.profilePicture);
    setProfilePicturePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [form.profilePicture]);
  // Edit mode starts with the company's already-uploaded picture; a freshly
  // picked file (above) takes over from it once one is chosen.
  const profilePictureDisplayUrl =
    profilePicturePreview || (isEditing ? editCompany?.profilePicture : null);

  useEffect(() => {
    setShouldRender(true);
    setTimeout(() => setIsOpen(true), 10);
    fetchFieldDefinitions();
    fetchIndustries();
    return () => {
      setIsOpen(false);
    };
  }, []);

  // Pre-fill when editing an existing company so edit and create share one form.
  useEffect(() => {
    if (!editCompany) return;
    setForm({
      name: editCompany.name || "",
      industry: editCompany.industry || "",
      billingAddress: { ...emptyAddress, ...(editCompany.billingAddress || {}) },
      shippingAddresses:
        editCompany.shippingAddresses && editCompany.shippingAddresses.length
          ? editCompany.shippingAddresses.map((a) => ({ ...emptyAddress, ...a, sameAsBilling: false }))
          : [{ ...emptyAddress, sameAsBilling: false }],
      website: editCompany.website || "",
      gstin: editCompany.gstin || "",
      profilePicture: null,
    });
    const pf = {};
    (editCompany.additionalFields || []).forEach((f) => {
      pf[f.key] = f.value;
    });
    setAdditionalFields(pf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editCompany]);

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
            className="w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-inter"
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
            buttonClassName={`w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-left flex items-center justify-between transition-all bg-white font-inter ${value ? "text-gray-900 font-medium" : "text-[#A0A0A0]"}`}
          />
        );

      case "text":
        return (
          <textarea
            rows={3}
            value={value || ""}
            onChange={(e) => handleFieldChange(e.target.value)}
            className="w-full border border-[#E0E0E1] rounded-[25px] px-4 py-3 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-inter resize-vertical"
            required={fieldDef.required}
          />
        );

      case "date":
        return (
          <input
            type="date"
            value={value || ""}
            onChange={(e) => handleFieldChange(e.target.value)}
            className="w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-inter"
            required={fieldDef.required}
          />
        );

      case "url":
        return (
          <input
            type="url"
            value={value || ""}
            onChange={(e) => handleFieldChange(e.target.value)}
            className="w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-inter placeholder:text-[#A0A0A0]"
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
            className="w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-inter"
            required={fieldDef.required}
          />
        );
    }
  };


  const handleSubmit = async (e, isSaveAndExit = false) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Company name is required");
      if (!isSaveAndExit) closeForm();
      return;
    }

    // Address fields are compulsory.
    if (!isAddressComplete(form.billingAddress)) {
      toast.error("Please complete the billing address");
      return;
    }
    for (let i = 0; i < form.shippingAddresses.length; i++) {
      if (!isAddressComplete(form.shippingAddresses[i])) {
        toast.error(
          form.shippingAddresses.length > 1
            ? `Please complete shipping address ${i + 1}`
            : "Please complete the shipping address"
        );
        return;
      }
    }

    // One-line summary of the billing address, kept in the legacy `address`
    // field so existing search/filters keep working.
    const legacyAddress = [
      form.billingAddress.addressLine1,
      form.billingAddress.addressLine2,
      form.billingAddress.city,
      form.billingAddress.state,
      form.billingAddress.pincode,
      form.billingAddress.country,
    ]
      .filter(Boolean)
      .join(", ");

    // Strip the UI-only `sameAsBilling` flag before sending.
    const shippingPayload = form.shippingAddresses.map(
      ({ sameAsBilling, ...addr }) => addr
    );

    const payload = new FormData();
    payload.append("name", form.name);
    payload.append("industry", form.industry);
    payload.append("address", legacyAddress);
    payload.append("billingAddress", JSON.stringify(form.billingAddress));
    payload.append("shippingAddresses", JSON.stringify(shippingPayload));
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
      const res = isEditing
        ? await API.put(`/companies/${editCompany._id}`, payload, {
            headers: { "Content-Type": "multipart/form-data" },
          })
        : await API.post("/companies", payload, {
            headers: { "Content-Type": "multipart/form-data" },
          });
      toast.success(isEditing ? "Company updated successfully!" : "Company added successfully!");
      const cb = isEditing ? onCompanyUpdated || onCompanyCreated : onCompanyCreated;
      if (cb && res.data) {
        cb(res.data);
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

  // Update one field of the single billing address. Any shipping address that
  // is set to "same as billing" mirrors the change.
  const handleBillingChange = (field, value) => {
    setForm((prev) => {
      const billingAddress = { ...prev.billingAddress, [field]: value };
      const shippingAddresses = prev.shippingAddresses.map((s) =>
        s.sameAsBilling ? { ...billingAddress, sameAsBilling: true } : s
      );
      return { ...prev, billingAddress, shippingAddresses };
    });
    setIsFormDirty(true);
  };

  // Update one field of the shipping address at `index`.
  const handleShippingChange = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      shippingAddresses: prev.shippingAddresses.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      ),
    }));
    setIsFormDirty(true);
  };

  // Toggle "same as billing" for one shipping address; copy billing in when on.
  const handleShippingSameAsBilling = (index, checked) => {
    setForm((prev) => ({
      ...prev,
      shippingAddresses: prev.shippingAddresses.map((s, i) =>
        i === index
          ? checked
            ? { ...prev.billingAddress, sameAsBilling: true }
            : { ...s, sameAsBilling: false }
          : s
      ),
    }));
    setIsFormDirty(true);
  };

  const addShippingAddress = () => {
    setForm((prev) => ({
      ...prev,
      shippingAddresses: [...prev.shippingAddresses, { ...emptyAddress, sameAsBilling: false }],
    }));
    setIsFormDirty(true);
  };

  const removeShippingAddress = (index) => {
    setForm((prev) => ({
      ...prev,
      shippingAddresses: prev.shippingAddresses.filter((_, i) => i !== index),
    }));
    setIsFormDirty(true);
  };

  // Address is compulsory: line1, city, state, pincode, country (line2 optional).
  const isAddressComplete = (a) =>
    !!(a.addressLine1?.trim() && a.city?.trim() && a.state?.trim() && a.pincode?.trim() && a.country?.trim());

  // Shared 6-field address grid, reused by billing and each shipping address.
  const renderAddressGrid = (address, onFieldChange, disabled) => {
    const inputCls =
      "w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0] disabled:bg-gray-50 disabled:text-gray-400";
    const ddCls = (val) =>
      `w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-left flex items-center justify-between transition-all bg-white font-inter disabled:bg-gray-50 disabled:text-gray-400 ${val ? "text-gray-900" : "text-[#A0A0A0]"}`;
    return (
      <fieldset disabled={disabled} className={`space-y-3 ${disabled ? "opacity-70" : ""}`}>
        <input
          type="text"
          value={address.addressLine1}
          onChange={(e) => onFieldChange("addressLine1", e.target.value)}
          className={inputCls}
          placeholder="Address Line 1 *"
        />
        <input
          type="text"
          value={address.addressLine2}
          onChange={(e) => onFieldChange("addressLine2", e.target.value)}
          className={inputCls}
          placeholder="Address Line 2"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            value={address.city}
            onChange={(e) => onFieldChange("city", e.target.value)}
            className={inputCls}
            placeholder="City *"
          />
          <CustomDropdown
            options={INDIA_STATES}
            value={address.state}
            onChange={(value) => onFieldChange("state", value)}
            placeholder="State *"
            searchable
            buttonClassName={ddCls(address.state)}
          />
          <input
            type="text"
            value={address.pincode}
            onChange={(e) => onFieldChange("pincode", e.target.value)}
            className={inputCls}
            placeholder="Pincode *"
          />
          <CustomDropdown
            options={COUNTRIES}
            value={address.country}
            onChange={(value) => onFieldChange("country", value)}
            placeholder="Country *"
            searchable
            buttonClassName={ddCls(address.country)}
          />
        </div>
      </fieldset>
    );
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
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[10000] transition-opacity duration-300 ease-in-out"
        style={{ opacity: isOpen ? 1 : 0 }}
        onClick={handleClose}
      />

      <div
        className={`
          fixed dc-panel-card dc-panel-w z-[10003]
          bg-white shadow-2xl flex flex-col overflow-hidden
          transform transition-transform duration-300 ease-in-out font-inter
          ${isOpen ? "translate-x-0" : "translate-x-[calc(100%+2rem)]"}
        `}
      >
        <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
          {/* Sticky header — compact, matching the note editor card */}
          <div className="flex justify-between items-center flex-shrink-0 p-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-700">
              {isEditing ? "Edit Company" : "Create New Company"}
            </h3>
            <button
              type="button"
              onClick={handleClose}
              className="p-1 px-2 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100"
              aria-label="Close"
            >
              <svg
                className="w-5 h-5 text-gray-400"
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

          {/* Scrollable body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 space-y-6">
            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Select Profile Picture <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-3">
                {/* The filename text field this replaced told you nothing
                    useful — the image itself is the confirmation. No fixed
                    box: the tile sizes to the image (capped so a huge photo
                    can't blow out the modal) instead of squeezing a tall or
                    wide image down into a small square. */}
                <div className="relative flex-shrink-0 inline-block rounded-xl border border-[#E0E0E1] bg-[#F9F9FB] overflow-hidden">
                  <input
                    ref={profilePictureInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      handleFormChange("profilePicture", e.target.files[0]);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    // Only required when there's no picture yet — a browser
                    // can't pre-populate a file input with the company's
                    // already-uploaded image, so requiring it unconditionally
                    // forced a re-upload on every edit even though one was
                    // already on file (and showing right here as a preview).
                    required={!profilePictureDisplayUrl}
                  />
                  {profilePictureDisplayUrl ? (
                    <img
                      src={profilePictureDisplayUrl}
                      alt="Company"
                      className="block max-h-32 max-w-[260px] w-auto h-auto object-contain"
                    />
                  ) : (
                    <div className="w-20 h-20 flex items-center justify-center text-[10px] text-[#A0A0A0] text-center px-1">
                      No image
                    </div>
                  )}
                </div>
                {/* The tile above already opens the picker (it's the
                    invisible input overlaying it) — this button was a dead
                    click, doing nothing when pressed. Wired to trigger the
                    same picker so it actually does what it looks like it
                    should. */}
                <button
                  type="button"
                  onClick={() => profilePictureInputRef.current?.click()}
                  className="bg-[#F2F2F7] text-[#111216] px-8 rounded-[25px] h-11 text-[14px] font-medium hover:bg-gray-200 transition-colors"
                >
                  Upload
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleFormChange("name", e.target.value)}
                className="w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]"
                required
                placeholder="Enter Company Name"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Industry
              </label>
              <CustomDropdown
                options={industries}
                value={form.industry}
                onChange={(value) => handleFormChange("industry", value)}
                placeholder="Select Industry"
                searchable
                buttonClassName={`w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-left flex items-center justify-between transition-all bg-white font-inter ${form.industry ? "text-gray-900 font-medium" : "text-[#A0A0A0]"}`}
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
                className="w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]"
                placeholder="GSTIN-1234567890"
                required
              />
            </div>

            {/* Billing Address (single — GST is calculated from its state) */}
            <div>
              <label className="block text-[14px] font-bold text-[#111216] mb-3">
                Billing Address <span className="text-red-500">*</span>
              </label>
              {renderAddressGrid(
                form.billingAddress,
                (field, value) => handleBillingChange(field, value),
                false
              )}
            </div>

            {/* Shipping Addresses (one or more) */}
            {form.shippingAddresses.map((ship, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-[14px] font-bold text-[#111216]">
                    Shipping Address{form.shippingAddresses.length > 1 ? ` ${index + 1}` : ""}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!ship.sameAsBilling}
                        onChange={(e) => handleShippingSameAsBilling(index, e.target.checked)}
                        className="w-4 h-4 rounded border-[#E0E0E1] text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-[13px] font-medium text-[#525866]">
                        Same as billing
                      </span>
                    </label>
                    {form.shippingAddresses.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeShippingAddress(index)}
                        className="text-[13px] font-medium text-[#DF120B] hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                {renderAddressGrid(
                  ship,
                  (field, value) => handleShippingChange(index, field, value),
                  !!ship.sameAsBilling
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addShippingAddress}
              className="self-start text-[13px] font-semibold text-[#0C4FCD] hover:underline"
            >
              + Add another shipping address
            </button>

            {fieldDefinitions.length > 0 && (
              <div className="pt-4 space-y-6">
                <h3 className="text-[16px] font-bold text-[#111216]">
                  Custom Fields
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

            <div>
              <label className="block text-[13px] font-semibold text-[#111216] mb-1.5">
                Website <span className="text-red-500">*</span>
              </label>
              {/* "https://" is a fixed prefix, not part of the typed value — only
                  the domain is editable, so nobody has to type the scheme. An
                  existing website (from editing a company) that already has a
                  protocol keeps it stripped here for display and re-added on
                  change; one saved without a protocol is treated the same way. */}
              <div className="w-full border border-[#E0E0E1] rounded-[25px] px-4 h-11 flex items-center gap-0.5 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                <span className="text-[14px] text-[#A0A0A0] flex-shrink-0">
                  https://
                </span>
                <input
                  type="text"
                  value={form.website.replace(/^https?:\/\//i, "")}
                  onChange={(e) =>
                    handleFormChange(
                      "website",
                      `https://${e.target.value.replace(/^https?:\/\//i, "")}`
                    )
                  }
                  className="flex-1 min-w-0 h-full text-[14px] text-gray-900 focus:outline-none placeholder:text-[#A0A0A0] bg-transparent"
                  placeholder="www.company.com"
                  required
                />
              </div>
            </div>

          </div>

          {/* Sticky footer — compact, matching the note editor card */}
          <div className="flex-shrink-0 p-4 border-t border-gray-100 bg-white flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              className="px-6 py-2.5 bg-[#0C4FCD] text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              type="submit"
              disabled={loading}
            >
              {loading ? "Saving..." : isEditing ? "Update Company" : "Create Company"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default QuickCompanyForm;