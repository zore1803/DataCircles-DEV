// src/components/company/AddToCompanyHotlistModal.jsx
import React, { useState, useEffect } from "react";
import { X, FolderPlus, Plus, Folder } from "lucide-react";
import API from "../../services/api";
import toast from "react-hot-toast";

export default function AddToCompanyHotlistModal({
  isOpen,
  onClose,
  selectedCompanyIds,
  onComplete,
}) {
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchFolders();
      setSelectedFolderId("");
      setIsCreatingNew(false);
      setNewFolderName("");
    }
  }, [isOpen]);

  const fetchFolders = async () => {
    try {
      const res = await API.get("/company-folders/");
      setFolders(res.data);
    } catch (error) {
      toast.error("Failed to load hotlists");
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const loadingToast = toast.loading("Adding to hotlist...");

    try {
      if (isCreatingNew) {
        if (!newFolderName.trim()) {
          toast.error("Please enter a folder name", { id: loadingToast });
          setLoading(false);
          return;
        }
        await API.post("/company-folders", {
          name: newFolderName,
          companies: selectedCompanyIds,
        });
        toast.success("Created hotlist and added companies", {
          id: loadingToast,
        });
      } else {
        if (!selectedFolderId) {
          toast.error("Please select a hotlist", { id: loadingToast });
          setLoading(false);
          return;
        }

        // Find existing folder to merge companies (avoid replacing existing ones)
        const folder = folders.find((f) => f._id === selectedFolderId);
        const existingIds = folder?.companies?.map((c) => c._id || c) || [];

        // Merge and remove duplicates
        const mergedIds = [...new Set([...existingIds, ...selectedCompanyIds])];

        await API.put(`/company-folders/${selectedFolderId}`, {
          name: folder.name,
          companies: mergedIds,
        });
        toast.success("Added companies to hotlist", { id: loadingToast });
      }
      onComplete();
      onClose();
    } catch (error) {
      console.error(error);
      if (error.response?.status === 402) {
        toast.error(error.response?.data?.message || "An active subscription is required to make changes.", { id: loadingToast });
      } else {
        toast.error(error.response?.data?.error || "Failed to add to hotlist", { id: loadingToast });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FolderPlus className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 font-sf">
              Add to Hotlist
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 bg-blue-50 text-blue-700 p-3 rounded-lg text-sm font-medium mb-4">
            Adding {selectedCompanyIds.length} selected compan
            {selectedCompanyIds.length === 1 ? "y" : "ies"}
          </div>

          {!isCreatingNew ? (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">
                Select Existing Hotlist
              </label>
              <select
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              >
                <option value="">-- Choose a hotlist --</option>
                {folders.map((folder) => (
                  <option key={folder._id} value={folder._id}>
                    {folder.name} ({folder.companies?.length || 0} items)
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2 mt-4">
                <div className="h-px bg-gray-200 flex-1"></div>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  OR
                </span>
                <div className="h-px bg-gray-200 flex-1"></div>
              </div>

              <button
                onClick={() => setIsCreatingNew(true)}
                className="w-full py-2.5 flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
              >
                <Plus className="w-4 h-4" /> Create New Hotlist
              </button>
            </div>
          ) : (
            <div className="space-y-3 animate-in fade-in zoom-in duration-200">
              <label className="block text-sm font-semibold text-gray-700">
                New Hotlist Name
              </label>
              <input
                type="text"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. Q3 Top Prospects"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              />
              <button
                onClick={() => setIsCreatingNew(false)}
                className="text-sm text-blue-600 hover:underline font-medium mt-2 block"
              >
                ← Back to existing hotlists
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={
              loading ||
              (!isCreatingNew && !selectedFolderId) ||
              (isCreatingNew && !newFolderName.trim())
            }
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {loading ? "Saving..." : "Save to Hotlist"}
          </button>
        </div>
      </div>
    </div>
  );
}
