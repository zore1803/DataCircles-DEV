import React, { useState, useEffect, useRef } from "react";
import { X, Upload } from "lucide-react";
import API from "../../services/api";

const UpdateVendorModal = ({ isOpen, onClose, vendor, onUpdateSuccess }) => {
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
      country: "",
    },
  });
  const [vendorFields, setVendorFields] = useState([]);
  const [additionalFieldValues, setAdditionalFieldValues] = useState({});
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

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

  useEffect(() => {
    if (vendor && isOpen) {
      // Initialize form with vendor data
      setForm({
        name: vendor.name || "",
        email: vendor.email || "",
        phone: vendor.phone || "",
        company: vendor.company || "",
        gstin: vendor.gstin || "",
        address: {
          line1: vendor.address?.line1 || "",
          line2: vendor.address?.line2 || "",
          city: vendor.address?.city || "",
          state: vendor.address?.state || "",
          pincode: vendor.address?.pincode || "",
          country: vendor.address?.country || "India",
        },
      });

      // Initialize additional fields
      const additionalFields = {};
      if (vendor.additionalFields && Array.isArray(vendor.additionalFields)) {
        vendor.additionalFields.forEach(({ key, value }) => {
          additionalFields[key] = value || "";
        });
      }
      setAdditionalFieldValues(additionalFields);
      setError("");
    }
  }, [vendor, isOpen]);

  useEffect(() => {
    // Fetch additional vendor fields
    const fetchVendorFields = async () => {
      try {
        const res = await API.get("/vendor-fields");
        if (res.data?.fields) {
          setVendorFields(res.data.fields);
        }
      } catch (error) {
        console.error("Failed to fetch vendor fields", error);
        setError("Failed to load additional fields");
      }
    };

    if (isOpen) {
      fetchVendorFields();
    }
  }, [isOpen]);

  // Cleanup when modal closes
  useEffect(() => {
    if (!isOpen) {
      setProfilePicture(null);
      setProfilePreview(null);
      setAdditionalFieldValues({});
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [isOpen]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];

    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        setError("File size should be less than 5MB");
        return;
      }

      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }

      setProfilePicture(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfilePreview(e.target.result);
      };
      reader.readAsDataURL(file);
      setError("");
    }
  };

  const handleAdditionalFieldChange = (key, value) => {
    setAdditionalFieldValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name) {
      setError("Name is required");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const formData = new FormData();
      formData.append("name", form.name);
      formData.append("email", form.email);
      formData.append("phone", form.phone);
      formData.append("company", form.company);
      formData.append("gstin", form.gstin);
      formData.append("address", JSON.stringify(form.address));

      // Add additional fields
      const additionalFields = Object.entries(additionalFieldValues).map(
        ([key, value]) => ({ key, value })
      );
      formData.append("additionalFields", JSON.stringify(additionalFields));

      // Add profile picture if selected
      if (profilePicture) {
        formData.append("avatar", profilePicture);
      }

      const response = await API.put(`/vendors/${vendor._id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      onUpdateSuccess();
      onClose();
    } catch (err) {
      if (err.response?.status === 402) {
        setError(err.response?.data?.message || "An active subscription is required to make changes.");
      } else if (err.response?.status === 403) {
        setError(err.response.data.message || "Access denied");
      } else {
        console.error("Error updating vendor:", err);
        setError(err.response?.data?.error || "Failed to update vendor");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4 pt-20">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Update Vendor</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Profile Picture Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Profile Picture
            </label>
            <div className="flex items-center space-x-4">
              {/* Current/Preview Image */}
              <div className="relative">
                {profilePreview ? (
                  <img
                    src={profilePreview}
                    alt="Preview"
                    className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : vendor?.avatar ? (
                  <img
                    src={`${import.meta.env.VITE_APP_API_URL}${vendor.avatar}`}
                    alt={vendor.name}
                    className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div
                    className={`w-20 h-20 rounded-full flex items-center justify-center text-white font-semibold text-lg ${getRandomColor(
                      vendor?.name
                    )}`}
                  >
                    {getInitials(vendor?.name)}
                  </div>
                )}
              </div>

              {/* Upload Button */}
              <div>
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
                  className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 focus:outline-none cursor-pointer border border-gray-300"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Photo
                </label>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                placeholder="Enter Name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                placeholder="Enter Email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                placeholder="Enter Phone number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company
              </label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                placeholder="Enter Company"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GSTIN
              </label>
              <input
                type="text"
                value={form.gstin}
                onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                placeholder="Enter GSTIN"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address Line 1
              </label>
              <input
                type="text"
                value={form.address.line1}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: { ...form.address, line1: e.target.value },
                  })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                placeholder="Enter Address Line 1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address Line 2
              </label>
              <input
                type="text"
                value={form.address.line2}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: { ...form.address, line2: e.target.value },
                  })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                placeholder="Enter Address Line 2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City
              </label>
              <input
                type="text"
                value={form.address.city}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: { ...form.address, city: e.target.value },
                  })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                placeholder="Enter City"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                State
              </label>
              <input
                type="text"
                value={form.address.state}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: { ...form.address, state: e.target.value },
                  })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                placeholder="Enter State"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pincode
              </label>
              <input
                type="text"
                value={form.address.pincode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: { ...form.address, pincode: e.target.value },
                  })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                placeholder="Enter Pincode"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Country
              </label>
              <input
                type="text"
                value={form.address.country}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: { ...form.address, country: e.target.value },
                  })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                placeholder="Enter Country"
              />
            </div>

            {/* Additional Fields */}
            {vendorFields.map((field) => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {field}
                </label>
                <input
                  type="text"
                  value={additionalFieldValues[field] || ""}
                  onChange={(e) =>
                    handleAdditionalFieldChange(field, e.target.value)
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  placeholder={`Enter ${field}`}
                />
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Updating..." : "Update Vendor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UpdateVendorModal;
