import React, { useState, useEffect } from "react";
import { X, Upload, User } from "lucide-react";
import API from "../../services/api";

const UpdateContactModal = ({
  isOpen,
  onClose,
  contact,
  companies,
  contactFieldList,
  onUpdateSuccess,
}) => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    tag: "",
    company: "",
  });
  const [additionalValues, setAdditionalValues] = useState({});
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    if (contact && isOpen) {
      setForm({
        name: contact.name || "",
        email: contact.email || "",
        phone: contact.phone || "",
        tag: contact.tag || "",
        company: contact.company?._id || "",
      });

      // Set additional fields
      const additionalFields = {};
      if (contact.additionalFields) {
        contact.additionalFields.forEach((field) => {
          additionalFields[field.key] = field.value;
        });
      }
      setAdditionalValues(additionalFields);

      // Reset file inputs
      setProfilePicture(null);
      setProfilePreview(null);
      setError("");
    }
  }, [contact, isOpen]);

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

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfilePreview(e.target.result);
      };
      reader.readAsDataURL(file);
      setError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name || !form.email) {
      setError("Name and email are required");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const formData = new FormData();
      formData.append("name", form.name);
      formData.append("email", form.email);
      formData.append("phone", form.phone);
      formData.append("tag", form.tag);
      formData.append("company", form.company);

      // Add additional fields
      formData.append(
        "additionalFields",
        JSON.stringify(
          Object.entries(additionalValues).map(([key, value]) => ({
            key,
            value,
          }))
        )
      );

      // Add profile picture if selected
      if (profilePicture) {
        formData.append("avatar", profilePicture);
      }

      const response = await API.put(
        `/contacts/update/${contact._id}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      onUpdateSuccess(response.data);
      onClose();
    } catch (err) {
      if (err.response?.status === 402) {
        setError(err.response?.data?.message || "An active subscription is required to make changes.");
      } else if (err.response?.status === 403) {
        setError(err.response.data.message || "Access denied");
      } else {
        setError(err.response?.data?.error || "Failed to update contact");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Update Contact
          </h2>
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
                ) : contact?.avatar ? (
                  <img
                    src={`${import.meta.env.VITE_APP_API_URL}${contact.avatar}`}
                    alt={contact.name}
                    className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div
                    className={`w-20 h-20 rounded-full flex items-center justify-center text-white font-semibold text-lg ${getRandomColor(
                      contact?.name
                    )}`}
                  >
                    {getInitials(contact?.name)}
                  </div>
                )}
              </div>

              {/* Upload Button */}
              <div>
                <input
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
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                placeholder="Enter Email"
                required
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
                Status
              </label>
              <select
                value={form.tag}
                onChange={(e) => setForm({ ...form, tag: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              >
                <option value="">Select Status</option>
                <option value="Lead">Lead</option>
                <option value="Customer">Customer</option>
                <option value="Hot">Hot</option>
                <option value="Warm">Warm</option>
                <option value="Cold">Cold</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company
              </label>
              <select
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              >
                <option value="">Select Company</option>
                {companies.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Additional Fields */}
            {contactFieldList.map((fieldKey, index) => (
              <div key={index}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {fieldKey}
                </label>
                <input
                  type="text"
                  value={additionalValues[fieldKey] || ""}
                  onChange={(e) =>
                    setAdditionalValues({
                      ...additionalValues,
                      [fieldKey]: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  placeholder={`Enter ${fieldKey}`}
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
              {loading ? "Updating..." : "Update Contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UpdateContactModal;
