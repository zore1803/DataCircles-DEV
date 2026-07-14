import React, { useEffect, useState, useRef } from "react";
import {
  Search,
  Plus,
  Trash2,
  X,
  ListFilter,
  ChevronDown,
  Calendar,
} from "lucide-react";
import SearchableDropdown from "../contact/SearchableDropdown";
import QuickVendorForm from "../vendor/QuickVendorForm";
import API from "../../services/api";
import toast from "react-hot-toast";

const API_BASE = `${import.meta.env.VITE_APP_API_URL}/api`;

const ItemSearchSelect = ({ value, onSelect, onAddNew, error = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchItems = async (search = "") => {
    try {
      setLoading(true);
      const res = await API.get(`/items?search=${search}`);
      const transformedItems = res.data
        .filter((item) => item.isActive)
        .flatMap((item) => {
          if (item.variants && item.variants.length > 0) {
            return item.variants.map((variant) => ({
              _id: item._id,
              variantId: variant._id,
              name: `${item.name} – ${variant.name}`,
              description: item.description || "",
              unitPrice:
                variant.purchasePrice ||
                item.purchasePrice ||
                item.sellingPrice,
              type: item.type,
              sku: variant.sku,
            }));
          }
          return [
            {
              _id: item._id,
              variantId: null,
              name: item.name,
              description: item.description || "",
              unitPrice: item.purchasePrice || item.sellingPrice,
              type: item.type,
              sku: null,
            },
          ];
        });
      setItems(transformedItems);
    } catch (error) {
      console.error("Error fetching items:", error);
      toast.error("Failed to fetch items");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value.length >= 2 || value === "") {
      fetchItems(value);
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    if (items.length === 0) fetchItems();
  };

  const handleItemClick = (item) => {
    onSelect({
      _id: item._id,
      variantId: item.variantId,
      name: item.name,
      description: item.description || "",
      unitPrice: item.unitPrice,
      quantity: 1,
      sku: item.sku,
    });
    setIsOpen(false);
    setSearchTerm("");
  };

  const getBorderColor = () => {
    if (error) return "border-red-300 focus:ring-red-500";
    return "border-gray-200 focus:ring-blue-500";
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          placeholder={value?.name ? value.name : "Choose Existing Item"}
          value={searchTerm}
          onChange={handleSearchChange}
          onFocus={handleInputFocus}
          className={`w-full pl-10 pr-4 py-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 transition-all ${getBorderColor()}`}
        />
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              Loading...
            </div>
          ) : items.length > 0 ? (
            items.map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleItemClick(item)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
              >
                <div className="flex justify-between">
                  <div>
                    <div className="font-medium text-gray-800 text-sm">
                      {item.name}
                    </div>
                    {item.sku && (
                      <div className="text-xs text-gray-500">
                        SKU: {item.sku}
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-gray-700">
                    ₹{item.unitPrice}
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-gray-500 text-sm">
              No items found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const PurchaseForm = ({
  editingPurchase,
  vendors,
  onRequestClose,
  onSuccess,
  onError,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showQuickVendorForm, setShowQuickVendorForm] = useState(false);
  const [localVendors, setLocalVendors] = useState(vendors || []);
  const [purchaseOrders, setPurchaseOrders] = useState([]);

  // Form State
  const [vendorId, setVendorId] = useState("");
  const [selectedPO, setSelectedPO] = useState("");
  const [items, setItems] = useState([
    {
      _id: null,
      variantId: null,
      name: "",
      description: "",
      quantity: 1,
      unitPrice: "",
      sku: null,
    },
  ]);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Draft");
  const [transactionType, setTransactionType] = useState("intra");
  const [gstRate, setGstRate] = useState(0);

  // Fetch POs
  useEffect(() => {
    const fetchPOs = async () => {
      try {
        const res = await API.get("/purchase-orders");
        setPurchaseOrders(res.data.purchaseOrders || res.data || []);
      } catch (err) {
        console.error("Failed to fetch POs", err);
      }
    };
    fetchPOs();
  }, []);

  useEffect(() => {
    setTimeout(() => setIsOpen(true), 10);
    setLocalVendors(vendors);

    if (editingPurchase) {
      setVendorId(editingPurchase.vendor?._id || editingPurchase.vendor || "");
      setSelectedPO(
        editingPurchase.purchaseOrder?._id ||
          editingPurchase.purchaseOrder ||
          "",
      );
      setItems(
        editingPurchase.items?.map((item) => ({
          _id: item.itemId || null,
          variantId: item.variantId || null,
          name: item.name,
          description: item.description || "",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          sku: item.sku || null,
        })) || [],
      );
      setNotes(editingPurchase.notes || "");
      setStatus(editingPurchase.status || "Draft");
      setTransactionType(editingPurchase.transactionType || "intra");
      setGstRate(editingPurchase.gstRate || 0);
    }
  }, [editingPurchase, vendors]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onRequestClose, 300);
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        _id: null,
        variantId: null,
        name: "",
        description: "",
        quantity: 1,
        unitPrice: "",
        sku: null,
      },
    ]);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const subtotal = items.reduce(
    (sum, item) =>
      sum +
      (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0),
    0,
  );

  // Calculate tax
  let totalTax = 0;
  if (gstRate > 0) {
    if (transactionType === "intra") {
      // CGST + SGST (half each)
      totalTax = subtotal * (gstRate / 100);
    } else {
      // IGST
      totalTax = subtotal * (gstRate / 100);
    }
  }

  const grandTotal = subtotal + totalTax;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vendorId) {
      toast.error("Please select a vendor");
      return;
    }

    setLoading(true);
    const payload = {
      vendor: vendorId,
      purchaseOrder: selectedPO || null,
      items: items.map((item) => ({
        itemId: item._id,
        variantId: item.variantId,
        name: item.name || "Unknown Item",
        description: item.description,
        quantity: parseFloat(item.quantity) || 0,
        unitPrice: parseFloat(item.unitPrice) || 0,
        amount:
          (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0),
        sku: item.sku,
        variantAttributes: item.variantAttributes,
      })),
      notes,
      status,
      transactionType,
      gstRate,
      subtotal,
      totalTax,
      grandTotal,
    };

    try {
      if (editingPurchase) {
        await API.put(`/purchases/${editingPurchase._id}`, payload);
        // Force status update if changed
        if (editingPurchase.status !== status) {
          await API.put(`/purchases/${editingPurchase._id}/status`, { status });
        }
        onSuccess("Purchase updated successfully!");
      } else {
        const res = await API.post("/purchases", payload);
        // If status is not default, update it
        if (status !== "Draft" && res.data?.purchase?._id) {
          await API.put(`/purchases/${res.data.purchase._id}/status`, {
            status,
          });
        }
        onSuccess("Purchase created successfully!");
      }
      handleClose();
    } catch (err) {
      console.error(err);
      if (err.response?.status === 402) {
        onError(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        onError(err.response?.data?.error || "Failed to save purchase");
      }
    } finally {
      setLoading(false);
    }
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = today.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 transition-opacity duration-300"
      style={{ opacity: isOpen ? 1 : 0 }}
      onClick={handleClose}
    >
      <div
        className="bg-white w-full max-w-4xl rounded-xl shadow-2xl max-h-[95vh] flex flex-col transition-transform duration-300 transform"
        style={{ transform: isOpen ? "scale(100%)" : "scale(95%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {editingPurchase ? "Edit Purchase" : "Create New Purchase"}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {dateStr} at {timeStr}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
          {/* Vendor & PO Link */}
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Vendor <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <SearchableDropdown
                  options={localVendors}
                  value={vendorId}
                  onChange={setVendorId}
                  placeholder="Select Vendor"
                  displayKey="name"
                  valueKey="_id"
                  className="flex-1 w-full"
                  required={true}
                />
                <button
                  type="button"
                  onClick={() => setShowQuickVendorForm(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Link to Purchase Order (Optional)
              </label>
              <div className="relative">
                <select
                  value={selectedPO}
                  onChange={(e) => setSelectedPO(e.target.value)}
                  className="w-full appearance-none px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">Select Purchase Order</option>
                  {purchaseOrders.map((po) => (
                    <option key={po._id} value={po._id}>
                      {po.poNumber} - {po.vendor?.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add Items
            </h3>

            <div className="space-y-6">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="bg-gray-50/50 rounded-xl border border-gray-200 p-5 relative group"
                >
                  {/* Remove Button for Item */}
                  {items.length > 1 && (
                    <button
                      onClick={() => removeItem(index)}
                      className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    {/* Item Search */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        Select Item <span className="text-red-500">*</span>
                      </label>
                      <ItemSearchSelect
                        value={item}
                        onSelect={(data) => {
                          const newItems = [...items];
                          newItems[index] = { ...newItems[index], ...data };
                          setItems(newItems);
                        }}
                      />
                    </div>
                    {/* Manual Name */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        Manual Item Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Or Enter Item name Manually"
                        value={item.name}
                        onChange={(e) =>
                          updateItem(index, "name", e.target.value)
                        }
                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Quantity */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        Quantity
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(index, "quantity", e.target.value)
                          }
                          className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="01"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                          <ListFilter className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                    {/* Unit Price */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        Unit Price <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItem(index, "unitPrice", e.target.value)
                          }
                          className="w-full pl-8 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                          ₹
                        </span>
                      </div>
                    </div>
                    {/* Amount */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        Amount
                      </label>
                      <div className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800">
                        ₹
                        {(
                          (parseFloat(item.quantity) || 0) *
                          (parseFloat(item.unitPrice) || 0)
                        ).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addItem}
              className="mt-4 flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Item Manually
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Additional Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add Additional Notes"
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-none"
            />
          </div>

          {/* Status, Transaction Type, GST Rate */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Status
              </label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full appearance-none px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="Draft">Draft</option>
                  <option value="Pending">Pending</option>
                  <option value="Paid">Paid</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Transaction Type
              </label>
              <div className="relative">
                <select
                  value={transactionType}
                  onChange={(e) => setTransactionType(e.target.value)}
                  className="w-full appearance-none px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="intra">Intra State (CGST + SGST)</option>
                  <option value="inter">Inter State (IGST)</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                GST Rate (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={gstRate}
                  onChange={(e) => setGstRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Total Amount Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-6 py-4 flex flex-col gap-2">
            <div className="flex justify-between items-center text-sm text-blue-800">
              <span>Subtotal:</span>
              <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
            </div>
            {gstRate > 0 && (
              <div className="flex justify-between items-center text-sm text-blue-800">
                <span>Tax ({gstRate}%):</span>
                <span className="font-semibold">₹{totalTax.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-blue-200 my-1"></div>
            <div className="flex justify-between items-center">
              <span className="text-blue-800 font-medium text-sm">
                Grand Total:
              </span>
              <span className="text-blue-700 font-bold text-xl">
                ₹{grandTotal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-gray-100 flex justify-between gap-4 bg-gray-50 rounded-b-xl">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 bg-white text-gray-700 font-medium rounded-lg hover:bg-gray-50 text-sm transition-colors shadow-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 text-sm transition-colors shadow-sm disabled:opacity-70"
          >
            {loading
              ? "Creating..."
              : editingPurchase
                ? "Update Purchase"
                : "Create Purchase"}
          </button>
        </div>
      </div>

      {showQuickVendorForm && (
        <QuickVendorForm
          onVendorCreated={(vendor) => {
            setLocalVendors([...localVendors, vendor]);
            setVendorId(vendor._id);
            setShowQuickVendorForm(false);
          }}
          onRequestClose={() => setShowQuickVendorForm(false)}
        />
      )}
    </div>
  );
};

export default PurchaseForm;
