import React, { useState, useEffect } from "react";
import { PenTool, Check, X } from "lucide-react";
import API from "../../services/api";

const BulkSignatureModal = ({ isOpen, onClose, onConfirm }) => {
  const [signatures, setSignatures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSignature, setSelectedSignature] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadSignatures();
      setSelectedSignature(null);
    }
  }, [isOpen]);

  const loadSignatures = async () => {
    setLoading(true);
    try {
      const res = await API.get("/document-settings/signatures");
      const sigs = Array.isArray(res.data) ? res.data : [];
      setSignatures(sigs);
    } catch (err) {
      console.error("Failed to load signatures:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedSignature) {
      onConfirm(selectedSignature.dataUrl);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100003] p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 p-2 rounded-lg">
              <PenTool className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Change Signature</h2>
              <p className="text-sm text-gray-500 mt-0.5">Select a signature to apply to all selected documents</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : signatures.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No saved signatures found.</p>
              <p className="text-sm text-gray-400 mt-1">Add signatures in Settings &gt; Document Settings.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {signatures.map((sig) => (
                <div
                  key={sig._id}
                  onClick={() => setSelectedSignature(sig)}
                  className={`
                    relative cursor-pointer rounded-xl border-2 p-4 transition-all
                    ${
                      selectedSignature?._id === sig._id
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                    }
                  `}
                >
                  {selectedSignature?._id === sig._id && (
                    <div className="absolute top-3 right-3 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center shadow-sm">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className="flex justify-center items-center h-24 bg-white rounded border border-gray-100 mb-3 shadow-sm">
                    <img
                      src={sig.dataUrl}
                      alt={sig.name}
                      className="max-h-full max-w-full object-contain p-2"
                    />
                  </div>
                  <div className="text-sm font-medium text-gray-900 text-center truncate">
                    {sig.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-gray-50/50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedSignature}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <PenTool className="w-4 h-4" />
            Apply Signature
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkSignatureModal;
