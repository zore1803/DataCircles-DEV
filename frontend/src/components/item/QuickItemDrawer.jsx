import React, { useState, useEffect } from "react";
import {
  X,
  Wand2,
  Plus,
  ChevronRight,
  Lock,
} from "lucide-react";
import ReactQuill from "react-quill-new";
import toast from "react-hot-toast";
import API from "../../services/api";

// onSaved(item) fires after the item is actually created in the backend —
// callers use it to refresh their item list / picker, same as ItemForm's
// fetchItems callback.
export default function QuickItemDrawer({ isOpen, onClose, onSaved }) {
  const [type, setType] = useState("Product");
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);

  // Same source the full ItemForm's category picker would use.
  useEffect(() => {
    if (!isOpen) return;
    API.get("/items/categories")
      .then((res) => setCategories(res.data || []))
      .catch((err) => console.error("Failed to load item categories:", err));
  }, [isOpen]);

  // Form State
  const [form, setForm] = useState({
    name: "",
    sellingPrice: "",
    sellingPriceTax: "without Tax",
    taxPercent: "0",
    taxType: "(0% CGST & 0% SGST, 0% IGST)",
    primaryUnit: "",
    hsnSac: "",
    purchasePrice: "",
    purchasePriceTax: "with Tax",
    barcode: "",
    category: "",
    description: "",
    // Opening Stock and More Details fields below aren't in the Item
    // backend schema yet — they're UI-only for now (matched to the
    // reference layout) and don't go into the create payload.
    openingQuantity: "0",
    openingPurchasePrice: "0",
    openingStockValue: "0",
    discountValue: "0",
    discountType: "percentage",
    lowStockAlert: "0",
    showInOnlineStore: true,
    notForSale: false,
  });

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Maps this drawer's fields onto the Item model's shape (see ItemForm.jsx),
  // then actually creates it via the same /items endpoint.
  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        type: type === "Service" ? "service" : "product",
        name: form.name,
        description: form.description,
        purchasePrice: parseFloat(form.purchasePrice) || 0,
        sellingPrice: parseFloat(form.sellingPrice) || 0,
        taxInclusive: form.sellingPriceTax === "with Tax",
        gstRate: parseFloat(form.taxPercent) || 0,
        hsnSac: form.hsnSac,
        barcode: form.barcode,
        category: form.category,
        primaryUnit: form.primaryUnit || "OTH OTHERS",
        images: [],
        isActive: true,
      };
      const res = await API.post("/items", payload);
      toast.success("Item added successfully!");
      if (onSaved) onSaved(res.data);
      onClose();
    } catch (err) {
      console.error("Failed to add item:", err);
      toast.error(err.response?.data?.error || "Failed to add item");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100005] flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-[900px] bg-[#F9FAFB] h-full flex flex-col shadow-2xl animate-slide-in-right transform transition-transform duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-gray-900">Add Item</h2>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-[#2563EB] text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Adding..." : "Add Item"}
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Details */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-bold text-gray-800">Basic Details</h3>
              <button className="flex items-center gap-1 text-[13px] font-medium text-gray-500 hover:text-gray-700">
                <Plus className="w-4 h-4" /> Add Custom Fields
              </button>
            </div>

            {/* Product / Service Toggle */}
            <div className="inline-flex p-0.5 bg-gray-100 rounded-lg mb-5 border border-gray-200">
              <button
                onClick={() => setType("Product")}
                className={`px-6 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                  type === "Product"
                    ? "bg-[#2563EB] text-white shadow"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Product
              </button>
              <button
                onClick={() => setType("Service")}
                className={`px-6 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                  type === "Service"
                    ? "bg-[#2563EB] text-white shadow"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Service
              </button>
            </div>

            {/* Product Name */}
            <div className="mb-5">
              <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                <span className="text-red-500">*</span>Product Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Enter Item Name"
                className="w-full h-10 px-3 border border-gray-300 rounded-md text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400"
              />
            </div>

            {/* Selling Price & Tax */}
            <div className="grid grid-cols-2 gap-5 mb-5">
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                  Selling Price
                </label>
                <div className="flex border border-gray-300 rounded-md focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 overflow-hidden">
                  <div className="flex items-center justify-center px-3 bg-gray-50 border-r border-gray-300 text-gray-500 font-medium">
                    ₹
                  </div>
                  <input
                    type="number"
                    value={form.sellingPrice}
                    onChange={(e) => handleChange("sellingPrice", e.target.value)}
                    placeholder="Enter Selling Price"
                    className="flex-1 h-10 px-3 text-[13px] focus:outline-none placeholder:text-gray-400 min-w-0"
                  />
                  <select
                    value={form.sellingPriceTax}
                    onChange={(e) => handleChange("sellingPriceTax", e.target.value)}
                    className="h-10 px-2 bg-gray-50 border-l border-gray-300 text-[13px] text-gray-600 focus:outline-none"
                  >
                    <option value="without Tax">without Tax</option>
                    <option value="with Tax">with Tax</option>
                  </select>
                </div>
                <div className="mt-1.5 text-[11px] font-semibold text-gray-700">
                  Exclusive of Taxes
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                  <span className="text-red-500">*</span>Tax %
                </label>
                <div className="flex border border-gray-300 rounded-md focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 overflow-hidden bg-white">
                  <input
                    type="number"
                    value={form.taxPercent}
                    onChange={(e) => handleChange("taxPercent", e.target.value)}
                    className="w-16 h-10 px-3 text-[13px] focus:outline-none min-w-0"
                  />
                  <select
                    value={form.taxType}
                    onChange={(e) => handleChange("taxType", e.target.value)}
                    className="flex-1 h-10 px-2 bg-white text-[13px] text-gray-600 focus:outline-none truncate"
                  >
                    <option value="(0% CGST & 0% SGST, 0% IGST)">
                      (0% CGST & 0% SGST, 0% IGST)
                    </option>
                    <option value="(9% CGST & 9% SGST, 18% IGST)">
                      (9% CGST & 9% SGST, 18% IGST)
                    </option>
                  </select>
                </div>
                <div className="mt-1.5 text-[11px] font-medium text-blue-600 hover:underline cursor-pointer">
                  Zero Rated (Default)
                </div>
              </div>
            </div>

            {/* Primary Unit */}
            <div className="w-1/2 pr-2.5">
              <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                Primary Unit
              </label>
              <input
                type="text"
                value={form.primaryUnit}
                onChange={(e) => handleChange("primaryUnit", e.target.value)}
                className="w-full h-10 px-3 border border-gray-300 rounded-md text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Additional Information */}
          <div>
            <h3 className="text-[13px] font-bold text-gray-600 uppercase tracking-wider mb-3">
              Additional Information <span className="font-normal text-gray-400">OPTIONAL</span>
            </h3>

            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-5">
              {/* Row 1 */}
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                    HSN/SAC
                  </label>
                  <input
                    type="text"
                    value={form.hsnSac}
                    onChange={(e) => handleChange("hsnSac", e.target.value)}
                    placeholder="HSN/SAC"
                    className="w-full h-10 px-3 border border-gray-300 rounded-md text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400"
                  />
                  <div className="mt-1.5 text-[11px] font-medium text-blue-600 hover:underline cursor-pointer">
                    Click here to check GST approved HSN/SAC codes.
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                    Purchase Price
                  </label>
                  <div className="flex border border-gray-300 rounded-md focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 overflow-hidden bg-white">
                    <input
                      type="number"
                      value={form.purchasePrice}
                      onChange={(e) => handleChange("purchasePrice", e.target.value)}
                      className="flex-1 h-10 px-3 text-[13px] focus:outline-none min-w-0"
                    />
                    <select
                      value={form.purchasePriceTax}
                      onChange={(e) => handleChange("purchasePriceTax", e.target.value)}
                      className="h-10 px-2 bg-gray-50 border-l border-gray-300 text-[13px] text-gray-600 focus:outline-none"
                    >
                      <option value="with Tax">with Tax</option>
                      <option value="without Tax">without Tax</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                    Barcode
                  </label>
                  <div className="flex border border-gray-300 rounded-md focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 overflow-hidden bg-white">
                    <input
                      type="text"
                      value={form.barcode}
                      onChange={(e) => handleChange("barcode", e.target.value)}
                      placeholder="2273546838467"
                      className="flex-1 h-10 px-3 text-[13px] focus:outline-none placeholder:text-gray-300 min-w-0"
                    />
                    <button className="flex items-center gap-1.5 h-10 px-4 bg-gray-50 border-l border-gray-300 text-[13px] font-semibold text-gray-700 hover:bg-gray-100 transition-colors">
                      <Wand2 className="w-4 h-4 text-gray-500" /> Auto Generate
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                    Category
                  </label>
                  {/* Text input + datalist so an existing category (fetched
                      from GET /items/categories) can be picked, or a new one
                      typed in — a plain <select> can't offer both. */}
                  <input
                    type="text"
                    list="quick-item-categories"
                    value={form.category}
                    onChange={(e) => handleChange("category", e.target.value)}
                    placeholder="Select or type a category"
                    className="w-full h-10 px-3 border border-gray-300 rounded-md text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white placeholder:text-gray-400"
                  />
                  <datalist id="quick-item-categories">
                    {categories.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Images */}
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                  Product Images & Videos
                </label>
                <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl bg-[#FAFAFA] flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-gray-400 transition-colors cursor-pointer mb-2">
                  <Plus className="w-5 h-5 mb-1" />
                  <span className="text-[12px] font-medium">Upload</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-snug">
                  Upload up to 10 files (3MB per image, 50MB per video).<br/>
                  Images: 1024×1024 recommended. Videos: 9:16 or 1:1 (min 1000×1000px).
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                  Description
                </label>
                <div className="border border-gray-300 rounded-md bg-white overflow-hidden">
                  <ReactQuill
                    theme="snow"
                    value={form.description}
                    onChange={(val) => handleChange("description", val)}
                    placeholder="Add product description here..."
                    className="h-28 [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-gray-200 [&_.ql-container]:border-none text-[13px]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Opening Stock */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-bold text-gray-600 uppercase tracking-wider">
                Opening Stock <span className="font-normal text-gray-400">OPTIONAL</span>
              </h3>
              <button
                type="button"
                disabled
                title="Upgrade to track batches"
                className="flex items-center gap-1.5 text-[12px] font-medium text-gray-400 cursor-not-allowed"
              >
                <Lock className="w-3.5 h-3.5" /> Add batches
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                    Opening Quantity
                  </label>
                  <input
                    type="number"
                    value={form.openingQuantity}
                    onChange={(e) => handleChange("openingQuantity", e.target.value)}
                    className="w-full h-10 px-3 border border-gray-300 rounded-md text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="mt-1.5 text-[11px] text-gray-500">
                    *Quantity of the product available in your existing inventory
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                    Opening Purchase Price (with tax)
                  </label>
                  <input
                    type="number"
                    value={form.openingPurchasePrice}
                    onChange={(e) => handleChange("openingPurchasePrice", e.target.value)}
                    className="w-full h-10 px-3 border border-gray-300 rounded-md text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="mt-5 w-1/2 pr-2.5">
                <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                  Opening Stock Value (with tax)
                </label>
                <input
                  type="number"
                  value={form.openingStockValue}
                  onChange={(e) => handleChange("openingStockValue", e.target.value)}
                  className="w-full h-10 px-3 border border-gray-300 rounded-md text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* More Details */}
          <div className="border border-[#FDE3CC] bg-[#FFF8F1] rounded-xl overflow-hidden">
            <div
              className="p-4 flex items-start gap-2 cursor-pointer"
              onClick={() => setShowMoreDetails(!showMoreDetails)}
            >
              <ChevronRight className={`w-5 h-5 text-gray-600 transition-transform flex-shrink-0 mt-0.5 ${showMoreDetails ? "rotate-90" : ""}`} />
              <div>
                <h4 className="text-[14px] font-bold text-gray-900 mb-1">More Details?</h4>
                <p className="text-[12px] text-gray-700">
                  Cess, Show Online Discount, Inventory tracking, Low stock alerts etc..
                </p>
              </div>
            </div>
            {showMoreDetails && (
              <div className="p-5 border-t border-[#FDE3CC] bg-white grid grid-cols-2 gap-x-5 gap-y-5">
                {/* Discount */}
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                    Discount
                  </label>
                  <div className="flex border border-gray-300 rounded-md focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 overflow-hidden bg-white">
                    <input
                      type="number"
                      min="0"
                      value={form.discountValue}
                      onChange={(e) => handleChange("discountValue", e.target.value)}
                      className="flex-1 h-10 px-3 text-[13px] focus:outline-none min-w-0"
                    />
                    <select
                      value={form.discountType}
                      onChange={(e) => handleChange("discountType", e.target.value)}
                      className="h-10 px-2 bg-gray-50 border-l border-gray-300 text-[13px] text-gray-600 focus:outline-none"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="amount">Amount</option>
                    </select>
                  </div>
                  <p className="mt-1.5 text-[11px] text-gray-500 leading-snug">
                    Discount will be calculated based on the selected option. In Online Store, discount will be shown as per the selected option.
                  </p>
                </div>

                {/* Max Discount % Allowed — premium/locked */}
                <div>
                  <label className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 mb-1.5">
                    Max Discount % Allowed <Lock className="w-3 h-3 text-gray-400" />
                  </label>
                  <input
                    type="text"
                    disabled
                    placeholder="eg. 10"
                    className="w-full h-10 px-3 border border-gray-200 rounded-md text-[13px] bg-gray-100 text-gray-400 placeholder:text-gray-400 cursor-not-allowed"
                  />
                  <p className="mt-1.5 text-[11px] text-gray-500 leading-snug">
                    Upgrade to set a per-product discount limit. You can configure the company-level setting <span className="text-blue-600 hover:underline cursor-pointer">here</span>.
                  </p>
                </div>

                {/* Low Stock Alert */}
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                    Low Stock Alert at
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.lowStockAlert}
                    onChange={(e) => handleChange("lowStockAlert", e.target.value)}
                    className="w-full h-10 px-3 border border-gray-300 rounded-md text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="mt-1.5 text-[11px] text-gray-500 leading-snug">
                    You will be notified once the stock reaches the minimum stock qty. (BETA)
                  </p>
                </div>

                {/* Show in Online Store */}
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                    Show in Online Store
                  </label>
                  <button
                    type="button"
                    onClick={() => handleChange("showInOnlineStore", !form.showInOnlineStore)}
                    className="flex-shrink-0"
                  >
                    <span
                      className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${form.showInOnlineStore ? "bg-green-500" : "bg-gray-300"}`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.showInOnlineStore ? "translate-x-4" : "translate-x-0"}`}
                      />
                    </span>
                  </button>
                  <p className="mt-1.5 text-[11px] text-gray-500 leading-snug">
                    Show or hide the product in catalogue/ online store
                  </p>
                </div>

                {/* Not For Sale */}
                <div className="col-span-2">
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                    Not For Sale
                  </label>
                  <button
                    type="button"
                    onClick={() => handleChange("notForSale", !form.notForSale)}
                    className="flex-shrink-0"
                  >
                    <span
                      className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${form.notForSale ? "bg-green-500" : "bg-gray-300"}`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.notForSale ? "translate-x-4" : "translate-x-0"}`}
                      />
                    </span>
                  </button>
                  <p className="mt-1.5 text-[11px] text-gray-500 leading-snug">
                    Hides the item for sale and shows only while making a purchase. eg. Office equipment
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="pb-10" />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-gray-200 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-[#2563EB] text-white text-[13px] font-semibold rounded-md hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Adding..." : "Add Item"}
          </button>
        </div>
      </div>
    </div>
  );
}
