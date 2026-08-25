import React, { useState, useEffect } from "react";
import { X, Save, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import API from "../../services/api";

const ChangeSignatureModal = ({ isOpen, onClose, selectedIds, activeTab, onSuccess }) => {
  const [signatures, setSignatures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedSignature, setSelectedSignature] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchSignatures();
      setSelectedSignature("");
    }
  }, [isOpen]);

  const fetchSignatures = async () => {
    try {
      setLoading(true);
      const res = await API.get("/document-settings/signatures");
      setSignatures(res.data || []);
      if (res.data && res.data.length > 0) {
        // Select the default signature initially if available
        const def = res.data.find(s => s.isDefault);
        if (def) setSelectedSignature(def.dataUrl);
        else setSelectedSignature(res.data[0].dataUrl);
      }
    } catch (error) {
      console.error("Failed to fetch signatures", error);
      toast.error("Failed to load signatures from Document Settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedSignature) {
      toast.error("Please select a signature");
      return;
    }
    
    try {
      setSaving(true);
      // Map activeTab to proper endpoint
      let endpoint = "";
      if (activeTab === "tax") endpoint = "/invoices/bulk-signature";
      else if (activeTab === "quotation") endpoint = "/quotations/bulk-signature";
      else if (activeTab === "performa") endpoint = "/performa-invoices/bulk-signature";
      else if (activeTab === "deliveryChallan") endpoint = "/delivery-challans/bulk-signature";
      else {
        throw new Error("Unknown tab for signature update");
      }

      const res = await API.post(endpoint, {
        ids: selectedIds,
        signature: selectedSignature,
        signatureType: "image"
      });

      const { successfulIds, failedIds } = res.data;
      if (failedIds && failedIds.length > 0) {
        toast.error(`Failed to update ${failedIds.length} documents. Updated ${successfulIds.length}.`);
      } else {
        toast.success(`Successfully updated signature on ${successfulIds?.length || selectedIds.length} documents.`);
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Bulk signature error:", error);
      toast.error(`Failed to apply signature: ${error.response?.data?.error || error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="relative z-[100]">
      <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" aria-hidden="true" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="mx-auto max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden pointer-events-auto">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
            <h2 className="text-lg font-semibold text-gray-900">
              Apply Signature
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Select a saved signature to apply to all <strong>{selectedIds.length}</strong> selected documents.
            </p>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
              </div>
            ) : signatures.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-sm text-gray-500">No signatures found.</p>
                <p className="text-xs text-gray-400 mt-1">Add them in Settings &gt; Document Settings.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Select Signature
                </label>
                <select
                  value={selectedSignature}
                  onChange={(e) => setSelectedSignature(e.target.value)}
                  className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
                >
                  <option value="" disabled>Choose a signature...</option>
                  {signatures.map((sig) => (
                    <option key={sig._id} value={sig.dataUrl}>
                      {sig.name} {sig.isDefault ? "(Default)" : ""}
                    </option>
                  ))}
                </select>

                {selectedSignature && (
                  <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50 flex justify-center">
                    <img 
                      src={selectedSignature} 
                      alt="Preview" 
                      className="max-h-24 object-contain"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !selectedSignature}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Apply Signature
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangeSignatureModal;
