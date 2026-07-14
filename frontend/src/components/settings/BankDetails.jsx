import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import API from "../../services/api"; // adjust this path if needed

const BankDetails = () => {
  const [form, setForm] = useState({
    contact: { email: "", phone: "" },
    bank: "",
    accountHolder: "",
    accountNumber: "",
    ifscCode: "",
    branch: "",
  });

  useEffect(() => {
    API.get("/bank-details")
      .then((res) => {
        if (res.data) {
          setForm(res.data);
        }
      })
      .catch((error) => {
        console.error("Failed to load banking data:", error);
      })
  },[])

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const handleContactChange = (field, value) => {
    setForm({
      ...form,
      contact: { ...form.contact, [field]: value },
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.put(`/bank-details/${form._id}`, form);
      toast.success("Bank details saved successfully!");
    } catch (err) {
      console.error(err);
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to save bank details.");
      }
    }
  };

  return (
    <div className="mt-10 bg-white border border-gray-200 rounded-lg shadow-sm p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Bank Account Settings
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">

        <div>
          <h3 className="font-semibold text-gray-800 mb-2">
            Contact Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Email
              </label>
              <input
                type="email"
                value={form.contact.email}
                onChange={(e) => handleContactChange("email", e.target.value)}
                required
                className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={form.contact.phone}
                onChange={(e) => handleContactChange("phone", e.target.value)}
                required
                className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-gray-800 mb-2">
            Bank Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Bank Name
              </label>
              <input
                type="text"
                value={form.bank}
                onChange={(e) => handleChange("bank", e.target.value)}
                required
                className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Account Holder
              </label>
              <input
                type="text"
                value={form.accountHolder}
                onChange={(e) => handleChange("accountHolder", e.target.value)}
                required
                className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Account Number
              </label>
              <input
                type="text"
                value={form.accountNumber}
                onChange={(e) => handleChange("accountNumber", e.target.value)}
                required
                className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                IFSC Code
              </label>
              <input
                type="text"
                value={form.ifscCode}
                onChange={(e) => handleChange("ifscCode", e.target.value)}
                required
                className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Branch
              </label>
              <input
                type="text"
                value={form.branch}
                onChange={(e) => handleChange("branch", e.target.value)}
                required
                className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-2 border-t border-gray-100 pt-4">
          <button
            type="reset"
            className="cursor-pointer px-4 py-2 rounded bg-gray-200 text-black hover:bg-gray-300 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="cursor-pointer px-4 py-2 rounded bg-gray-200 text-black hover:bg-gray-300 text-sm font-medium"
          >
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
};

export default BankDetails;
