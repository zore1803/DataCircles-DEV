// src/components/BulkActions.jsx
import React, { useState, useMemo } from "react";
import { X, Check } from "lucide-react";

const BulkActions = ({
  isOpen,
  onClose,
  selectedItems,
  onBulkUpdate,
  fieldConfig,
  module = "contacts",
}) => {
  const [selectedField, setSelectedField] = useState("");
  const [updateValue, setUpdateValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Get common fields that exist in all selected items
  const commonFields = useMemo(() => {
    if (!selectedItems?.length || !fieldConfig) return [];

    const allFields = fieldConfig.fields || [];
    return allFields.filter((field) => {
      return selectedItems.every(
        (item) => item.hasOwnProperty(field.key) || field.isCustomField,
      );
    });
  }, [selectedItems, fieldConfig]);

  // Get the selected field configuration
  const selectedFieldConfig = useMemo(() => {
    return commonFields.find((field) => field.key === selectedField);
  }, [commonFields, selectedField]);

  // Reset form when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setSelectedField("");
      setUpdateValue("");
      setError("");
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedField || !updateValue) {
      setError("Please select a field and enter a value");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await onBulkUpdate({
        field: selectedField,
        value: updateValue,
        itemIds: selectedItems.map((item) => item._id || item.id),
      });

      onClose();
    } catch (err) {
      setError(err.message || "Failed to update items");
    } finally {
      setLoading(false);
    }
  };

  const renderValueInput = () => {
    if (!selectedFieldConfig) return null;

    const { type, options } = selectedFieldConfig;

    switch (type) {
      case "select":
      case "dropdown":
        return (
          <select
            value={updateValue}
            onChange={(e) => setUpdateValue(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            required
          >
            <option value="">Select {selectedFieldConfig.label}</option>
            {options.map((option) => (
              <option
                key={option.value || option}
                value={option.value || option}
              >
                {option.label || option}
              </option>
            ))}
          </select>
        );

      case "boolean":
        return (
          <select
            value={updateValue}
            onChange={(e) => setUpdateValue(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            required
          >
            <option value="">Select Option</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        );

      default:
        return (
          <input
            type="text"
            value={updateValue}
            onChange={(e) => setUpdateValue(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder={`Enter ${selectedFieldConfig.label}`}
            required
          />
        );
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        {/* Modal */}
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <div>
              <h3 className="text-lg font-bold text-gray-900 font-sf">
                Bulk Update
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Updating {selectedItems?.length} selected {module}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Field Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Field to Update
                </label>
                <select
                  value={selectedField}
                  onChange={(e) => {
                    setSelectedField(e.target.value);
                    setUpdateValue(""); // Reset value when field changes
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                >
                  <option value="">-- Choose a field --</option>
                  {commonFields.map((field) => (
                    <option key={field.key} value={field.key}>
                      {field.label} {field.isCustomField ? "(Custom)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Value Input */}
              {selectedField && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    New Value
                  </label>
                  {renderValueInput()}
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !selectedField || !updateValue}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-sm"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Apply Update
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default BulkActions;
