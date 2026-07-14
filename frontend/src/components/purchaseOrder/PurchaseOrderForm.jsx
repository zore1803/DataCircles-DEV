import React, { useEffect, useState, useRef } from "react";
import {
  Search,
  Plus,
  Trash2,
  X,
  ChevronDown,
  ListFilter,
  GripVertical,
  Clock,
  CheckCircle2,
  Truck,
} from "lucide-react";
import SearchableDropdown from "../contact/SearchableDropdown";
import QuickVendorForm from "../vendor/QuickVendorForm";
import API from "../../services/api";
import toast from "react-hot-toast";

const API_BASE = `${import.meta.env.VITE_APP_API_URL}/api`;

const SingleSelectDropdown = ({ options, value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selectedOption = options.find(opt => opt.value?.toLowerCase() === value?.toLowerCase()) || options[0];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`w-full flex items-center justify-between px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded-md ${selectedOption.className} border-none`}>
            {selectedOption.icon && <selectedOption.icon className="w-3.5 h-3.5" />}
          </div>
          <span className="font-medium text-gray-700 capitalize">{selectedOption.label}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-2xl z-[10003] py-1 overflow-hidden animate-in fade-in zoom-in duration-200">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 ${value?.toLowerCase() === option.value?.toLowerCase() ? 'bg-blue-50/50 text-blue-600' : 'text-gray-600'
                }`}
            >
              <div className={`p-1.5 rounded-lg ${option.className} border-none`}>
                {option.icon && <option.icon className="w-4 h-4" />}
              </div>
              <span className="font-medium text-left flex-1">{option.label}</span>
              {value?.toLowerCase() === option.value?.toLowerCase() && (
                <div className="w-1.5 h-1.5 rounded-full bg-blue-600 ml-auto" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Helper component for Item Search within the form
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
          // Flatten variants logic
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

  const displayValue = value?.name || searchTerm;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          placeholder={value?.name ? value.name : "Choose Existing Item"}
          value={searchTerm} // Use searchTerm to allow typing
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

const PurchaseOrderForm = ({
  editingPO,
  vendors,
  onRequestClose,
  onSuccess,
  onError,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const statusOptions = [
    { value: "Pending", label: "Pending", icon: Clock, className: "bg-yellow-50 text-yellow-700" },
    { value: "Approved", label: "Approved", icon: CheckCircle2, className: "bg-green-50 text-green-700" },
    { value: "Rejected", label: "Rejected", icon: X, className: "bg-red-50 text-red-700" },
    { value: "Delivered", label: "Delivered", icon: Truck, className: "bg-blue-50 text-blue-700" },
  ];

  // Form State
  const [vendorId, setVendorId] = useState("");
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
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Approved");

  const [localVendors, setLocalVendors] = useState(vendors || []);
  const [showQuickVendorForm, setShowQuickVendorForm] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsOpen(true), 10);
    if (editingPO) {
      setVendorId(editingPO.vendor?._id || "");
      setItems(
        editingPO.items?.map((item) => ({
          _id: item.itemId || null,
          variantId: item.variantId || null,
          name: item.name,
          description: item.description || "",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          sku: item.sku || null,
        })) || [],
      );
      setPaymentTerms(editingPO.paymentTerms || "Net 30");
      setNotes(editingPO.notes || "");
      setStatus(editingPO.status || "Pending");
    }
    setLocalVendors(vendors);
  }, [editingPO, vendors]);

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

  const totalAmount = items.reduce(
    (sum, item) =>
      sum +
      (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0),
    0,
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vendorId) {
      toast.error("Please select a vendor");
      return;
    }

    // Basic validation
    for (let item of items) {
      if (!item.name && !item.unitPrice) {
        // Allow name to be typed if manual
        toast.error("Please ensure all items have at least a name or price");
        // Actually name is usually required
      }
    }

    setLoading(true);
    const payload = {
      vendorId,
      items: items.map((item) => ({
        itemId: item._id,
        variantId: item.variantId,
        name: item.name || "Unknown Item", // Fallback
        description: item.description,
        quantity: parseFloat(item.quantity) || 0,
        unitPrice: parseFloat(item.unitPrice) || 0,
        amount:
          (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0),
        sku: item.sku,
      })),
      paymentTerms,
      notes,
      status, // Include status update if creating/editing?
    };

    try {
      if (editingPO) {
        await API.put(`/purchase-orders/${editingPO._id}`, payload);
        // Also update status if different
        if (editingPO.status !== status) {
          await API.put(`/purchase-orders/${editingPO._id}/status`, { status });
        }
        onSuccess();
      } else {
        // Create
        // API might expect status in payload or separate? Assuming payload for now or default pending
        // If API doesn't support status in create, we might need to update it after.
        // Let's assume standard create payload first.
        const res = await API.post("/purchase-orders", payload);
        if (status !== "Pending" && res.data?.purchaseOrder?._id) {
          await API.put(
            `/purchase-orders/${res.data.purchaseOrder._id}/status`,
            { status },
          );
        }
        onSuccess();
      }
      handleClose();
    } catch (err) {
      console.error(err);
      if (err.response?.status === 402) {
        onError(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        onError(err.response?.data?.error || "Failed to save purchase order");
      }
    } finally {
      setLoading(false);
    }
  };

  // Use today's date formatted
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
              {editingPO ? "Edit Purchase Order" : "Create New Purchase Order"}
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
          {/* Vendor Section */}
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
                onClick={() => setShowQuickVendorForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
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
                    {/* Description */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        Description <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Add Item Description"
                        value={item.description}
                        onChange={(e) =>
                          updateItem(index, "description", e.target.value)
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
              Add Another Item
            </button>
          </div>

          {/* Terms and Notes */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Payment Terms <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

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
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Status
            </label>
            <SingleSelectDropdown
              options={statusOptions}
              value={status}
              onChange={setStatus}
            />
          </div>

          {/* Total Amount Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-6 py-4 flex justify-between items-center">
            <span className="text-blue-800 font-medium text-sm">
              Total Amount
            </span>
            <span className="text-blue-700 font-bold text-xl">
              ₹{totalAmount.toFixed(2)}
            </span>
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
              : editingPO
                ? "Update Purchase Order"
                : "Create Purchase Order"}
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

export default PurchaseOrderForm;
