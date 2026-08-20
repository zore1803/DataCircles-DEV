import React, { useEffect, useState, useRef } from "react";
import {
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
import { formatNumberFixed } from "../../utils/numberFormatter";

import SearchIcon from "../common/SearchIcon";
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
              stock: variant.stock ?? item.inventory?.currentStock ?? 0,
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
        <SearchIcon className="absolute left-3 -translate-y-1/2 top-1/2 w-4 h-4 text-[#525866]" />
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
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[10000] transition-opacity duration-300 ease-in-out"
        style={{ opacity: isOpen ? 1 : 0 }}
        onClick={handleClose}
      />

      {/* Compact card — narrow single-column layout, matched to
          PurchaseOrderForm.jsx and the reference design. */}
      <div
        className={`
          fixed top-6 bottom-6 right-6 rounded-[24px] z-[10001]
          w-full sm:w-[600px]
          bg-white shadow-2xl flex flex-col overflow-hidden
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-[calc(100%+2rem)]"}
        `}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
          <h2 className="text-sm text-gray-500 font-medium uppercase tracking-wide">
            {editingPurchase ? "EDIT PURCHASE" : "CREATE NEW PURCHASE"}
          </h2>
          <div className="flex items-center gap-4">
            {editingPurchase && (
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
          {/* Vendor & PO Link */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Select Vendor <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
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

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Link to Purchase Order (Optional)
              </label>
              <div className="relative">
                <select
                  value={selectedPO}
                  onChange={(e) => setSelectedPO(e.target.value)}
                  className="w-full appearance-none px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">Select Purchase Order</option>
                  {purchaseOrders.map((po) => (
                    <option key={po._id} value={po._id}>
                      {po.poNumber} - {po.vendor?.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Items</h3>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium text-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item Manually
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
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
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
                  {/* Manual Name */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Manual Item Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Or Enter Item Name Manually"
                      value={item.name}
                      onChange={(e) =>
                        updateItem(index, "name", e.target.value)
                      }
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Quantity */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Quantity
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(index, "quantity", e.target.value)
                          }
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="01"
                        />
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                          <ListFilter className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                    {/* Unit Price */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Unit Price <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItem(index, "unitPrice", e.target.value)
                          }
                          className="w-full pl-7 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                        />
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">
                          ₹
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Amount
                    </label>
                    <div className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800">
                      ₹
                      {formatNumberFixed(
                        (parseFloat(item.unitPrice) || 0) * (parseFloat(item.quantity) || 0)
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Additional Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add Additional Notes"
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[90px] resize-none"
            />
          </div>

          {/* Status, Transaction Type, GST Rate */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Status
              </label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full appearance-none px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="Draft">Draft</option>
                  <option value="Pending">Pending</option>
                  <option value="Paid">Paid</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Transaction Type
                </label>
                <div className="relative">
                  <select
                    value={transactionType}
                    onChange={(e) => setTransactionType(e.target.value)}
                    className="w-full appearance-none px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="intra">Intra State</option>
                    <option value="inter">Inter State</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  GST Rate (%)
                </label>
                <div className="relative">
                  <select
                    value={gstRate}
                    onChange={(e) => setGstRate(parseFloat(e.target.value) || 0)}
                    className="w-full appearance-none px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value={0}>0</option>
                    <option value={5}>5</option>
                    <option value={12}>12</option>
                    <option value={18}>18</option>
                    <option value={28}>28</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Total Amount Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-slate-700">
              <span className="text-sm">Subtotal</span>
              <span className="font-semibold">₹{formatNumberFixed(subtotal)}</span>
            </div>

            {gstRate > 0 && (
              <div className="flex justify-between items-center text-slate-700">
                <span className="text-sm">Total Tax</span>
                <span className="font-semibold">₹{formatNumberFixed(totalTax)}</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              <span className="font-bold text-slate-900">Grand Total</span>
              <span className="font-bold text-blue-600 text-lg">
                ₹{formatNumberFixed(grandTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-dashed border-gray-300 flex gap-3 items-center bg-white flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 border border-red-200 text-red-500 font-medium rounded-full hover:bg-red-50 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-[#0085FF] text-white font-medium rounded-full hover:bg-blue-600 text-sm transition-colors disabled:opacity-70"
          >
            {loading
              ? "Creating..."
              : editingPurchase
                ? "Update"
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
    </>
  );
};

export default PurchaseForm;
