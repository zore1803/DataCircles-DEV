import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import API from "../../services/api";

function UpdateCompanyModal({
  company,
  isOpen,
  onClose,
  onUpdate,
  companyFieldNames,
  fetchCompanies,
}) {
  const [updatedForm, setUpdatedForm] = useState({
    name: company?.name || "",
    industry: company?.industry || "",
    address: company?.address || "",
    website: company?.website || "",
  });
  const [profilePicture, setProfilePicture] = useState(null);

  const [additionalFields, setAdditionalFields] = useState({});

  useEffect(() => {
    if (company) {
      setUpdatedForm({
        name: company?.name || "",
        industry: company?.industry || "",
        address: company?.address || "",
        website: company?.website || "",
      });
      setProfilePicture(null);

      // Convert array to object for easier editing
      const additional = {};
      (company.additionalFields || []).forEach((f) => {
        additional[f.key] = f.value;
      });
      setAdditionalFields(additional);
    }
  }, [company]);

  if (!isOpen) return null;

  const handleUpdate = async (e) => {
    e.preventDefault();
    const formData = new FormData();

    Object.entries(updatedForm).forEach(([key, value]) => {
      formData.append(key, value);
    });

    if (profilePicture) {
      formData.append("profilePicture", profilePicture);
    }

    try {
      await API.put(`/companies/${company._id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onClose();
      fetchCompanies(); // refresh after update
    } catch (err) {
      console.error(err);
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to update company");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 px-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
        >
          ✕
        </button>

        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Update Company
        </h2>

        <form onSubmit={handleUpdate} className="grid grid-cols-1 gap-4">
          {/* Core Fields */}
          {/* Profile Picture Preview */}
          <div className="flex items-center gap-4">
            {profilePicture ? (
              <img
                src={URL.createObjectURL(profilePicture)}
                alt="Preview"
                className="w-16 h-16 rounded-full object-cover border"
              />
            ) : company.profilePicture ? (
              <img
                src={`${import.meta.env.VITE_APP_API_URL}${
                  company.profilePicture
                }`}
                alt={company?.name}
                className="w-16 h-16 rounded-full object-cover border"
              />
            ) : (
              <div className="w-16 h-16 rounded-full flex items-center justify-center bg-gray-300 text-lg font-bold">
                {company?.name.charAt(0).toUpperCase()}
              </div>
            )}

            <input
              type="file"
              accept="image/*"
              onChange={(e) => setProfilePicture(e.target.files[0])}
              className="text-sm"
            />
          </div>

          <input
            type="text"
            value={updatedForm?.name}
            onChange={(e) =>
              setUpdatedForm({ ...updatedForm, name: e.target.value })
            }
            placeholder="Company Name *"
            required
            className="border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          <input
            type="text"
            value={updatedForm.industry}
            onChange={(e) =>
              setUpdatedForm({ ...updatedForm, industry: e.target.value })
            }
            placeholder="Industry *"
            required
            className="border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          <input
            type="text"
            value={updatedForm.address}
            onChange={(e) =>
              setUpdatedForm({ ...updatedForm, address: e.target.value })
            }
            placeholder="Address"
            className="border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          <input
            type="url"
            value={updatedForm.website}
            onChange={(e) =>
              setUpdatedForm({ ...updatedForm, website: e.target.value })
            }
            placeholder="Website"
            className="border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />

          {/* Additional Fields */}
          {companyFieldNames.map((field) => (
            <input
              key={field}
              type="text"
              value={additionalFields[field] || ""}
              onChange={(e) =>
                setAdditionalFields((prev) => ({
                  ...prev,
                  [field]: e.target.value,
                }))
              }
              placeholder={field}
              className="border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          ))}

          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-gray-200 font-medium text-black px-4 py-2 rounded-md text-sm hover:bg-gray-300 cursor-pointer"
            >
              Update
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UpdateCompanyModal;
