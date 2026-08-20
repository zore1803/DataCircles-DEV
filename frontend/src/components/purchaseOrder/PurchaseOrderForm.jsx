import React, { useEffect, useState, useRef } from "react";
import {
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
import { formatNumberFixed } from "../../utils/numberFormatter";
import toast from "react-hot-toast";

import SearchIcon from "../common/SearchIcon";
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
        className={`w-full flex items-center justify-between px-3 h-8 bg-white border border-[#1F2937]/10 rounded-full text-[12px] transition-all focus:outline-none focus:ring-1 focus:ring-blue-500 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-1.5">
          <div className={`p-1 rounded-full ${selectedOption.className} border-none`}>
            {selectedOption.icon && <selectedOption.icon className="w-3 h-3" />}
          </div>
          <span className="font-medium text-[#1F2937] capitalize">{selectedOption.label}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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
              stock: variant.stock ?? item.inventory?.currentStock ?? 0,
              gstRate: variant.gstRate ?? item.gstRate ?? 0,
              taxInclusive: variant.taxInclusive ?? item.taxInclusive ?? false,
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
              stock: item.inventory?.currentStock ?? 0,
              gstRate: item.gstRate || 0,
              taxInclusive: item.taxInclusive || false,
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
      gstRate: item.gstRate || 0,
      taxInclusive: item.taxInclusive || false,
    });
    setIsOpen(false);
    setSearchTerm("");
  };

  const getBorderColor = () => {
    if (error) return "border-red-300 focus:ring-red-500";
    return "border-[#1F2937]/10 focus:ring-blue-500";
  };

  const displayValue = value?.name || searchTerm;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative">
        <SearchIcon className="absolute left-3 -translate-y-1/2 top-1/2 w-4 h-4 text-[#525866]" />
        <input
          ref={inputRef}
          type="text"
          placeholder={value?.name ? value.name : "Choose Existing Item"}
          value={searchTerm} // Use searchTerm to allow typing
          onChange={handleSearchChange}
          onFocus={handleInputFocus}
          className={`w-full pl-9 pr-4 h-8 bg-white border rounded-full text-[12px] focus:outline-none focus:ring-1 transition-all ${getBorderColor()}`}
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
                    {item.type === "product" && (
                      <div className="text-xs font-medium text-slate-600 mt-0.5">
                        Stock: {item.stock ?? 0}
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
  const [transactionType, setTransactionType] = useState("intra");

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
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[10000] transition-opacity duration-300 ease-in-out"
        style={{ opacity: isOpen ? 1 : 0 }}
        onClick={handleClose}
      />

      {/* Same dc-panel-card/dc-panel-w shell as CompanyForm/DealForm/ItemForm
          etc. — width now matches the rest of the app's quick-drawers
          instead of a wider one-off 600px. */}
      <div
        className={`
          fixed dc-panel-card dc-panel-w z-[10001]
          bg-white shadow-2xl flex flex-col overflow-hidden
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-[calc(100%+2rem)]"}
        `}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
          <h2 className="text-[14px] font-normal leading-5 text-[#78788D] uppercase tracking-wide">
            {editingPO ? "EDIT PURCHASE ORDER" : "CREATE NEW PURCHASE ORDER"}
          </h2>
          <div className="flex items-center gap-4">
            {editingPO && (
              <>
                <button type="button" className="text-[#0085FF] hover:text-blue-600 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                </button>
                <button type="button" className="text-red-500 hover:text-red-600 transition-colors">
                  <Trash2 className="w-[18px] h-[18px]" />
                </button>
                <div className="w-px h-4 bg-gray-300"></div>
              </>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content — single column throughout, tightened spacing to suit
            the narrower card. */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* Vendor Section */}
          <div>
            <label className="block text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
              Select Vendor <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <SearchableDropdown
                options={localVendors}
                value={vendorId}
                onChange={setVendorId}
                placeholder="Choose Vendor"
                displayKey="name"
                valueKey="_id"
                className="flex-1 w-full"
                required={true}
              />
              {/* Matched to the dropdown's own h-12 / rounded-[25px] pill
                  shape — was a mismatched rounded-lg square before. */}
              <button
                type="button"
                onClick={() => setShowQuickVendorForm(true)}
                className="w-12 h-12 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors flex-shrink-0"
                aria-label="Add new vendor"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Items Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Items</h3>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 text-[#0085FF] hover:text-blue-700 font-medium text-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Another Item
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="bg-gray-50/50 rounded-xl border border-gray-200 p-4 relative group space-y-3"
                >
                  {/* Remove Button for Item */}
                  {items.length > 1 && (
                    <button
                      onClick={() => removeItem(index)}
                      className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  {/* Item Search */}
                  <div>
                    <label className="block text-[11px] font-medium text-[#161618] tracking-[-0.05em] mb-1.5">
                      Item <span className="text-red-500">*</span>
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
                    <label className="block text-[11px] font-medium text-[#161618] tracking-[-0.05em] mb-1.5">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Add Item Description"
                      value={item.description}
                      onChange={(e) =>
                        updateItem(index, "description", e.target.value)
                      }
                      className="w-full px-3 h-8 bg-white border border-[#1F2937]/10 rounded-full text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {/* Quantity */}
                    <div>
                      <label className="block text-[11px] font-medium text-[#161618] tracking-[-0.05em] mb-1.5">
                        Quantity
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(index, "quantity", e.target.value)
                          }
                          className="w-full px-3 h-8 bg-white border border-[#1F2937]/10 rounded-full text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                          placeholder="01"
                        />
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                          <ListFilter className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                    {/* Unit Price */}
                    <div>
                      <label className="block text-[11px] font-medium text-[#161618] tracking-[-0.05em] mb-1.5">
                        Unit Price <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItem(index, "unitPrice", e.target.value)
                          }
                          className="w-full pl-7 pr-3 h-8 bg-white border border-[#1F2937]/10 rounded-full text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                          placeholder="0"
                        />
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-[12px]">
                          ₹
                        </span>
                      </div>
                    </div>
                    {/* GST % */}
                    <div>
                      <label className="block text-[11px] font-medium text-[#161618] tracking-[-0.05em] mb-1.5">
                        GST %
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={item.gstRate ?? ""}
                          onChange={(e) =>
                            updateItem(index, "gstRate", e.target.value)
                          }
                          className="w-full pl-3 pr-7 h-8 bg-white border border-[#1F2937]/10 rounded-full text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                          placeholder="0"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-[12px]">
                          %
                        </span>
                      </div>
                      <label className="flex items-center gap-2 mt-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.taxInclusive || false}
                          onChange={(e) =>
                            updateItem(index, "taxInclusive", e.target.checked)
                          }
                          className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                          Tax Inc.
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-[11px] font-medium text-[#161618] tracking-[-0.05em] mb-1.5">
                      Amount
                    </label>
                    <div className="w-full px-3 h-8 flex items-center bg-gray-100 border border-[#1F2937]/10 rounded-full text-[12px] font-semibold text-gray-800">
                      ₹
                      {formatNumberFixed(
                        (parseFloat(item.quantity) || 0) *
                        (parseFloat(item.unitPrice) || 0)
                      )}
                    </div>
                  </div>

                  {/* Purchase Price & Selling Price */}
                  <div>
                    <label className="block text-[11px] font-medium text-[#161618] tracking-[-0.05em] mb-1.5">
                      Purchase Price <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter Purchase Price"
                      className="w-full px-3 h-8 bg-white border border-[#1F2937]/10 rounded-full text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#161618] tracking-[-0.05em] mb-1.5">
                      Selling Price <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter Selling Price"
                      className="w-full px-3 h-8 bg-white border border-[#1F2937]/10 rounded-full text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Terms and Notes */}
          <div className="space-y-6">
            <div>
              <label className="block text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                Payment Terms <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full px-3 h-8 bg-white border border-[#1F2937]/10 rounded-full text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                Notes
              </label>
              <div className="w-full bg-white border border-[#1F2937]/10 rounded-2xl overflow-hidden focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                {/* Rich Text Editor Mock Toolbar */}
                <div className="px-2 py-1.5 border-b border-gray-100 flex items-center gap-1.5 overflow-x-auto bg-gray-50/50">
                  <div className="flex items-center gap-0.5">
                    <button type="button" className="w-7 h-7 flex-shrink-0 flex justify-center items-center hover:bg-white rounded text-gray-500 text-xs font-medium font-serif shadow-sm border border-transparent hover:border-gray-200">H₁</button>
                    <button type="button" className="w-7 h-7 flex-shrink-0 flex justify-center items-center hover:bg-white rounded text-gray-500 text-xs font-medium font-serif shadow-sm border border-transparent hover:border-gray-200">H₂</button>
                    <button type="button" className="w-7 h-7 flex-shrink-0 flex justify-center items-center hover:bg-white rounded text-gray-500 text-xs font-medium font-serif shadow-sm border border-transparent hover:border-gray-200">H₃</button>
                    <button type="button" className="w-7 h-7 flex-shrink-0 flex justify-center items-center hover:bg-white rounded text-gray-500 text-xs font-medium font-serif shadow-sm border border-transparent hover:border-gray-200">H₄</button>
                  </div>
                  <div className="w-px h-5 bg-gray-200 flex-shrink-0"></div>
                  <div className="flex items-center gap-0.5">
                    <button type="button" className="w-7 h-7 flex-shrink-0 flex justify-center items-center hover:bg-white rounded text-gray-500 font-serif font-bold text-sm shadow-sm border border-transparent hover:border-gray-200">B</button>
                    <button type="button" className="w-7 h-7 flex-shrink-0 flex justify-center items-center hover:bg-white rounded text-gray-500 font-serif italic text-sm shadow-sm border border-transparent hover:border-gray-200">I</button>
                    <button type="button" className="w-7 h-7 flex-shrink-0 flex justify-center items-center hover:bg-white rounded text-gray-500 font-serif underline text-sm shadow-sm border border-transparent hover:border-gray-200">U</button>
                    <button type="button" className="w-7 h-7 flex-shrink-0 flex justify-center items-center hover:bg-white rounded text-gray-500 font-serif line-through text-sm shadow-sm border border-transparent hover:border-gray-200">S</button>
                  </div>
                  <div className="w-px h-5 bg-gray-200 flex-shrink-0"></div>
                  <div className="flex items-center gap-0.5">
                    <button type="button" className="w-7 h-7 flex-shrink-0 flex justify-center items-center hover:bg-white rounded text-gray-500 shadow-sm border border-transparent hover:border-gray-200">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                    </button>
                    <button type="button" className="w-7 h-7 flex-shrink-0 flex justify-center items-center hover:bg-white rounded text-gray-500 shadow-sm border border-transparent hover:border-gray-200">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="21" y2="6"></line><line x1="10" y1="12" x2="21" y2="12"></line><line x1="10" y1="18" x2="21" y2="18"></line><path d="M4 6h1v4"></path><path d="M4 10h2"></path><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path></svg>
                    </button>
                  </div>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional Notes"
                  className="w-full px-3 py-2 text-[12px] focus:outline-none min-h-[100px] resize-none"
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
              Status
            </label>
            <SingleSelectDropdown
              options={statusOptions}
              value={status}
              onChange={setStatus}
            />
          </div>

          {/* Total Amount Banner */}
          <div className="bg-blue-50 rounded-full px-5 py-2.5 flex justify-between items-center">
            <span className="text-gray-900 font-medium text-sm">
              Total Amount
            </span>
            <span className="text-[#0085FF] font-medium text-base">
              ₹{formatNumberFixed(totalAmount)}
            </span>
          </div>
        </div>

        {/* Footer — matches the CompanyForm/ItemForm quick-drawer footer spec */}
        <div className="flex-shrink-0 py-2.5 px-4 border-t border-gray-100 bg-white flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-2 border border-gray-200 text-gray-700 rounded-[25px] text-sm font-bold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-[#158FFF] text-white rounded-[25px] text-sm font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
    </>
  );
};

export default PurchaseOrderForm;
