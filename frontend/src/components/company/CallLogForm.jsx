import React, { useState, useEffect } from "react";
import { X, Phone } from "lucide-react";
import API from "../../services/api";
import toast from "react-hot-toast";

const CallLogForm = ({ companyId, editLog, isOpen, onClose, onSuccess, userId }) => {
  const [formData, setFormData] = useState({
    purpose: "",
    callType: "Outbound",
    status: "Connected",
    duration: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editLog) {
      setFormData({
        purpose: editLog.purpose || "",
        callType: editLog.callType || "Outbound",
        status: editLog.status || "Connected",
        // Stored in seconds; the field below collects minutes.
        duration: editLog.duration ? Math.round(editLog.duration / 60) : "",
        notes: editLog.notes || "",
      });
    } else {
      setFormData({
        purpose: "",
        callType: "Outbound",
        status: "Connected",
        duration: "",
        notes: "",
      });
    }
  }, [editLog, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        duration: formData.duration ? Math.round(Number(formData.duration) * 60) : undefined,
        company: companyId,
        user: userId,
      };
      if (editLog) {
        const res = await API.put(`/call-logs/${editLog._id}`, payload);
        toast.success("Call log updated");
        onSuccess(res.data);
      } else {
        const res = await API.post("/call-logs", payload);
        toast.success("Call logged successfully");
        onSuccess(res.data);
      }
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save call log");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Phone className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {editLog ? "Edit Call Log" : "Log a Call"}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purpose / Title *</label>
              <input
                type="text"
                name="purpose"
                value={formData.purpose}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                placeholder="E.g., Discovery Call, Follow up"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  name="callType"
                  value={formData.callType}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                >
                  <option value="Outbound">Outbound</option>
                  <option value="Inbound">Inbound</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                >
                  <option value="Connected">Connected</option>
                  <option value="Missed">Missed</option>
                  <option value="Voicemail">Voicemail</option>
                  <option value="No Answer">No Answer</option>
                </select>
              </div>
            </div>

            {(formData.status === "Connected" || formData.status === "Voicemail") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  name="duration"
                  value={formData.duration}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  placeholder="e.g., 15"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="4"
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                placeholder="What was discussed?"
              ></textarea>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-5 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? "Saving..." : "Save Call Log"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CallLogForm;
