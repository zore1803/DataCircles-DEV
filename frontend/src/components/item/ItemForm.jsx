import React, { useEffect, useState, useRef } from "react";
import API from "../../services/api";
import {
  Upload,
  X,
  Plus,
  Trash2,
  Box,
  Barcode as BarcodeIcon,
  RefreshCw,
  Check,
  Type,
  Layers,
} from "lucide-react";
import toast from "react-hot-toast";
import ReactQuill from "react-quill-new";

const ItemForm = ({
  form,
  setForm,
  loading,
  setLoading,
  setError,
  setSuccess,
  fetchItems,
  onRequestClose,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [variants, setVariants] = useState(form.variants || []);
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [currentVariant, setCurrentVariant] = useState({
    name: "",
    sku: "",
    attributes: {},
    purchasePrice: 0,
    sellingPrice: 0,
    stock: 0,
    isActive: true,
  });
  const [variantIndex, setVariantIndex] = useState(null);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const fileInputRef = useRef(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [variantValidationErrors, setVariantValidationErrors] = useState({});

  useEffect(() => {
    setShouldRender(true);
    setTimeout(() => setIsOpen(true), 10);
    if (form._id && form.images && form.images.length > 0) {
      setImagePreviews(
        form.images.map((img) => `${import.meta.env.VITE_APP_API_URL}${img}`),
      );
    } else {
      setImagePreviews([]);
    }
    setVariants(form.variants || []);
    return () => {
      setIsOpen(false);
      setImages([]);
      setImagePreviews([]);
    };
  }, [form._id, form.images, form.variants]);

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
      onRequestClose();
    }, 300);
  };

  const handleConfirmExit = () => {
    setShowConfirmDialog(false);
    closeForm();
  };

  const handleSaveAndExit = async () => {
    setShowConfirmDialog(false);
    await handleSubmit({ preventDefault: () => {} }, true);
  };

  const generateBarcode = () => {
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 10000);
    const barcode = `${timestamp}${randomNum}`.slice(-12);
    setForm({ ...form, barcode });
    setIsFormDirty(true);
  };

  const generateVariantSku = () => {
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 10000);
    const sku = `${timestamp}${randomNum}`.slice(-12);
    setCurrentVariant({ ...currentVariant, sku });
    setIsFormDirty(true);
  };

  const handleFormChange = (field, value) => {
    if (field === "purchasePrice" || field === "sellingPrice") {
      setForm({ ...form, [field]: value === "" ? "" : parseFloat(value) || 0 });
    } else {
      setForm({ ...form, [field]: value });
    }
    setIsFormDirty(true);
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = "Item name is required";
    if (form.purchasePrice < 0) errors.purchasePrice = "Invalid price";
    if (form.sellingPrice < 0) errors.sellingPrice = "Invalid price";
    return errors;
  };

  const handleSubmit = async (e, isSaveAndExit = false) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);
      const payload = { ...form, variants };
      if (form._id) {
        await API.put(`/items/${form._id}`, payload);
        toast.success("Item updated successfully!");
      } else {
        await API.post("/items", payload);
        toast.success("Item added successfully!");
      }
      await fetchItems();
      setIsFormDirty(false);
      closeForm();
    } catch (err) {
      console.error("Submit error:", err);
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || (form._id ? "Failed to update item" : "Failed to add item"));
      }
    } finally {
      setLoading(false);
    }
  };

  // Variant Handlers
  const handleVariantChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCurrentVariant({
      ...currentVariant,
      [name]:
        type === "checkbox"
          ? checked
          : name === "stock" || name.includes("Price")
            ? value === ""
              ? ""
              : parseFloat(value)
            : value,
    });
  };

  const handleAddVariant = () => {
    // Basic validation
    if (!currentVariant.name) {
      toast.error("Variant name is required");
      return;
    }

    const updatedVariants =
      variantIndex !== null
        ? variants.map((v, i) => (i === variantIndex ? currentVariant : v))
        : [...variants, currentVariant];

    setVariants(updatedVariants);
    setForm({ ...form, variants: updatedVariants });
    setShowVariantForm(false);
    setCurrentVariant({
      name: "",
      sku: "",
      attributes: {},
      purchasePrice: 0,
      sellingPrice: 0,
      stock: 0,
      isActive: true,
    });
    setVariantIndex(null);
  };

  const handleEditVariant = (index) => {
    setCurrentVariant(variants[index]);
    setVariantIndex(index);
    setShowVariantForm(true);
  };

  const handleRemoveVariant = (index) => {
    const updated = variants.filter((_, i) => i !== index);
    setVariants(updated);
    setForm({ ...form, variants: updated });
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 transition-opacity duration-300"
      style={{ opacity: isOpen ? 1 : 0 }}
      onClick={handleClose}
    >
      <div
        className="bg-white w-full max-w-4xl rounded-xl shadow-2xl max-h-[90vh] flex flex-col transition-transform duration-300 transform"
        style={{ transform: isOpen ? "scale(100%)" : "scale(95%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900 font-sf">
              {form._id ? "Edit Item" : "Create New Item"}
            </h2>
            <p className="text-xs text-gray-400 mt-1 font-inter">
              Lorem ipsum dolor sit amet consectetur
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 font-inter custom-scrollbar">
          {/* Title & Meta Controls */}
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700">
              Item Title
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleFormChange("name", e.target.value)}
              placeholder="Item Name"
              className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2 ${validationErrors.name ? "border-red-300" : "border-gray-200"}`}
            />

            <div className="flex flex-wrap items-center gap-3">
              {/* Category Pill */}
              <div className="relative group">
                <div className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-full text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 cursor-pointer">
                  <Layers className="w-3.5 h-3.5" />
                  {form.category || "Category"}
                </div>
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-100 rounded-lg shadow-lg hidden group-hover:block z-10 p-2">
                  <input
                    type="text"
                    placeholder="Enter Category"
                    value={form.category}
                    onChange={(e) =>
                      handleFormChange("category", e.target.value)
                    }
                    className="w-full text-xs border border-gray-200 rounded p-1.5"
                  />
                </div>
              </div>

              {/* Active Toggle Pill */}
              <button
                type="button"
                onClick={() => handleFormChange("isActive", !form.isActive)}
                className={`flex items-center gap-2 px-3 py-1.5 border rounded-full text-xs font-medium transition-colors ${
                  form.isActive
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-gray-50 text-gray-600 border-gray-200"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${form.isActive ? "bg-green-500" : "bg-gray-400"}`}
                />
                {form.isActive ? "Active" : "Inactive"}
              </button>

              {/* Add Variant Button */}
              <button
                type="button"
                onClick={() => setShowVariantForm(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white border border-blue-600 rounded-full text-xs font-medium hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Variant
              </button>

              <span className="text-xs text-gray-400 italic ml-2">
                A new variant will be added to the item
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Description of the item <span className="text-red-500">*</span>
            </label>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <ReactQuill
                theme="snow"
                value={form.description}
                onChange={(val) => handleFormChange("description", val)}
                className="h-32 mb-10"
              />
            </div>
          </div>

          {/* Price Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Purchase Price <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                value={form.purchasePrice}
                onChange={(e) =>
                  handleFormChange("purchasePrice", e.target.value)
                }
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter Purchase Price"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Selling Price <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                value={form.sellingPrice}
                onChange={(e) =>
                  handleFormChange("sellingPrice", e.target.value)
                }
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter Selling Price"
              />
            </div>
          </div>

          {/* Tax Inclusive */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.taxInclusive}
              onChange={(e) =>
                handleFormChange("taxInclusive", e.target.checked)
              }
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label className="text-sm text-gray-700 font-medium">
              Tax Inclusive
            </label>
          </div>

          {/* HSN/SAC */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              HSN/SAC Code
            </label>
            <input
              type="text"
              value={form.hsnSac}
              onChange={(e) => handleFormChange("hsnSac", e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter HSN/SAC Code"
            />
          </div>

          {/* Barcode */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Barcode
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.barcode}
                onChange={(e) => handleFormChange("barcode", e.target.value)}
                className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter or Generate Barcode"
              />
              <button
                type="button"
                onClick={generateBarcode}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-xs font-medium transition-colors"
              >
                Generate Barcode
              </button>
            </div>
          </div>

          {/* Primary Unit */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Primary Unit
            </label>
            <select
              value={form.primaryUnit}
              onChange={(e) => handleFormChange("primaryUnit", e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
            >
              <option value="OTH-OTHERS">OTH-OTHERS</option>
              <option value="PCS-PIECES">PCS-PIECES</option>
              <option value="NOS-NUMBERS">NOS-NUMBERS</option>
              <option value="KGS-KILOGRAMS">KGS-KILOGRAMS</option>
              {/* Add more as needed */}
            </select>
          </div>

          {/* Variants List (Minified) */}
          {variants.length > 0 && (
            <div className="mt-6 border-t border-gray-100 pt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Variants ({variants.length})
              </h3>
              <div className="space-y-2">
                {variants.map((v, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center bg-gray-50 border border-gray-100 rounded-lg p-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {v.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        SKU: {v.sku} | ₹{v.sellingPrice}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditVariant(i)}
                        className="text-blue-600 hover:text-blue-700 p-1"
                      >
                        <Type className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRemoveVariant(i)}
                        className="text-red-600 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-gray-100 flex justify-between gap-4 bg-white rounded-b-xl">
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 text-sm transition-colors shadow-sm disabled:opacity-70"
          >
            {loading ? "Saving..." : form._id ? "Update Item" : "Create Item"}
          </button>
        </div>
      </div>

      {/* Nested Variant Form */}
      {showVariantForm && (
        <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px] z-[10001] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-semibold text-gray-900">
                {variantIndex !== null ? "Edit Variant" : "Add New Variant"}
              </h3>
              <button
                onClick={() => setShowVariantForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">
                  Variant Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={currentVariant.name}
                  onChange={handleVariantChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="e.g. Red, XL"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">
                  SKU
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="sku"
                    value={currentVariant.sku}
                    onChange={handleVariantChange}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                  <button
                    onClick={generateVariantSku}
                    className="bg-gray-800 text-white text-xs px-3 rounded-lg"
                  >
                    Generate SKU
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">
                    Purchase Price
                  </label>
                  <input
                    type="number"
                    name="purchasePrice"
                    value={currentVariant.purchasePrice}
                    onChange={handleVariantChange}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">
                    Selling Price
                  </label>
                  <input
                    type="number"
                    name="sellingPrice"
                    value={currentVariant.sellingPrice}
                    onChange={handleVariantChange}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">
                  Stock
                </label>
                <input
                  type="number"
                  name="stock"
                  value={currentVariant.stock}
                  onChange={handleVariantChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>

              <button
                onClick={handleAddVariant}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {variantIndex !== null ? "Update Variant" : "Add Variant"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemForm;
