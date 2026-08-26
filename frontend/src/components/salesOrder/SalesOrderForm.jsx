import React, { useEffect, useState, useRef } from "react";
import {
  Plus,
  Trash2,
  X,
  ChevronDown,
  ListFilter,
  FileEdit,
  CheckCircle2,
  Ban,
} from "lucide-react";
import SearchableDropdown from "../contact/SearchableDropdown";
import API from "../../services/api";
import { formatNumberFixed } from "../../utils/numberFormatter";
import toast from "react-hot-toast";
import ReactQuill from "react-quill-new";

import SearchIcon from "../common/SearchIcon";
// The product's description is rich text ("<p>...</p>" etc, same as
// PurchaseOrderForm.jsx's own stripHtml) — strip the markup before it lands
// in the plain <input> below.
const stripHtml = (html) => String(html || "").replace(/<[^>]*>/g, "").trim();

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

// Item Search — same lookup/flatten-variants pattern as
// PurchaseOrderForm.jsx's ItemSearchSelect, but returns `rate` (not
// `unitPrice`) to match SalesOrder's item schema, which mirrors Quotation's.
const ItemSearchSelect = ({ value, onSelect, error = null }) => {
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
              description: stripHtml(item.description),
              rate: variant.sellingPrice || item.sellingPrice || item.purchasePrice,
              hsn: variant.hsnSac || item.hsnSac || "",
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
              description: stripHtml(item.description),
              rate: item.sellingPrice || item.purchasePrice,
              hsn: item.hsnSac || "",
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
      itemId: item._id,
      variantId: item.variantId,
      name: item.name,
      description: stripHtml(item.description),
      rate: item.rate,
      hsn: item.hsn,
      quantity: 1,
      gstRate: item.gstRate || 0,
      taxInclusive: item.taxInclusive || false,
      isVariant: !!item.variantId,
      parentItemId: item.variantId ? item._id : null,
    });
    setIsOpen(false);
    setSearchTerm("");
  };

  const getBorderColor = () => {
    if (error) return "border-red-300 focus:ring-red-500";
    return "border-[#1F2937]/10 focus:ring-blue-500";
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
          className={`w-full pl-9 pr-4 h-8 bg-white border rounded-full text-[12px] focus:outline-none focus:ring-1 transition-all ${getBorderColor()}`}
        />
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
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
                    <div className="font-medium text-gray-800 text-sm">{item.name}</div>
                    {item.hsn && <div className="text-xs text-gray-500">HSN: {item.hsn}</div>}
                    <div className="text-xs font-medium text-slate-600 mt-0.5">Stock: {item.stock ?? 0}</div>
                  </div>
                  <div className="text-sm font-semibold text-gray-700">₹{item.rate}</div>
                </div>
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-gray-500 text-sm">No items found</div>
          )}
        </div>
      )}
    </div>
  );
};

const emptyItem = () => ({
  itemId: null,
  variantId: null,
  name: "",
  description: "",
  quantity: 1,
  rate: "",
  hsn: "",
  gstRate: 0,
  taxInclusive: false,
  discountType: "amount",
  discount: 0,
});

const SalesOrderForm = ({ editingSO, deals, onRequestClose, onSuccess, onError }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const statusOptions = [
    { value: "Draft", label: "Draft", icon: FileEdit, className: "bg-gray-100 text-gray-600" },
    { value: "Confirmed", label: "Confirmed", icon: CheckCircle2, className: "bg-green-50 text-green-700" },
    { value: "Cancelled", label: "Cancelled", icon: Ban, className: "bg-red-50 text-red-700" },
  ];

  const [dealId, setDealId] = useState("");
  const [items, setItems] = useState([emptyItem()]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [status, setStatus] = useState("Draft");
  const [transactionType, setTransactionType] = useState("intra");
  const [discountType, setDiscountType] = useState("fixed");
  const [discountValue, setDiscountValue] = useState(0);

  const isLocked = editingSO?.status === "Cancelled" || !!editingSO?.convertedInvoice;

  useEffect(() => {
    setTimeout(() => setIsOpen(true), 10);
    if (editingSO) {
      setDealId(editingSO.deal?._id || editingSO.deal || "");
      setItems(
        editingSO.items?.map((item) => ({
          itemId: item.itemId?._id || item.itemId || null,
          variantId: item.variantId || null,
          name: item.name,
          description: stripHtml(item.description),
          quantity: item.quantity,
          rate: item.rate,
          hsn: item.hsn || "",
          gstRate: item.gstRate || 0,
          taxInclusive: item.taxInclusive || false,
          discountType: item.discountType || "amount",
          discount: item.discount || 0,
        })) || [emptyItem()]
      );
      setDate(editingSO.date ? new Date(editingSO.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
      setDueDate(editingSO.dueDate ? new Date(editingSO.dueDate).toISOString().slice(0, 10) : "");
      setReference(editingSO.reference || "");
      setNotes(editingSO.notes || "");
      setTerms(editingSO.terms || "");
      setStatus(editingSO.status || "Draft");
      setTransactionType(editingSO.transactionType || "intra");
      setDiscountType(editingSO.discount?.type || "fixed");
      setDiscountValue(editingSO.discount?.value || 0);
    }
  }, [editingSO]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onRequestClose, 300);
  };

  const addItem = () => setItems([...items, emptyItem()]);
  const removeItem = (index) => setItems(items.filter((_, i) => i !== index));
  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const lineTotal = (item) => {
    const gross = (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
    const discount = parseFloat(item.discount) || 0;
    const afterDiscount = item.discountType === "percentage" ? gross * (1 - discount / 100) : gross - discount;
    return item.taxInclusive ? afterDiscount / (1 + (parseFloat(item.gstRate) || 0) / 100) : afterDiscount;
  };

  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const afterDocDiscount = discountType === "percentage" ? subtotal * (1 - (parseFloat(discountValue) || 0) / 100) : subtotal - (parseFloat(discountValue) || 0);

  const totalTax = items.reduce((sum, item) => {
    const gross = (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
    const discount = parseFloat(item.discount) || 0;
    const afterDiscount = item.discountType === "percentage" ? gross * (1 - discount / 100) : gross - discount;
    const rate = parseFloat(item.gstRate) || 0;
    if (rate <= 0) return sum;
    if (item.taxInclusive) {
      const base = afterDiscount / (1 + rate / 100);
      return sum + (afterDiscount - base);
    }
    return sum + afterDiscount * (rate / 100);
  }, 0);

  const grandTotal = afterDocDiscount + totalTax;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!dealId) {
      toast.error("Please select a deal");
      return;
    }
    for (const item of items) {
      if (!item.name || !item.rate) {
        toast.error("Please ensure all items have a name and rate");
        return;
      }
    }

    setLoading(true);
    const payload = {
      deal: dealId,
      date,
      dueDate: dueDate || undefined,
      reference,
      amount: grandTotal,
      status,
      items: items.map((item) => ({
        itemId: item.itemId,
        variantId: item.variantId,
        name: item.name,
        description: item.description,
        quantity: parseFloat(item.quantity) || 0,
        rate: parseFloat(item.rate) || 0,
        hsn: item.hsn,
        gstRate: parseFloat(item.gstRate) || 0,
        taxInclusive: item.taxInclusive || false,
        discountType: item.discountType || "amount",
        discount: parseFloat(item.discount) || 0,
        isVariant: !!item.variantId,
      })),
      notes,
      terms,
      transactionType,
      discount: { type: discountType, value: parseFloat(discountValue) || 0 },
    };

    try {
      if (editingSO) {
        await API.put(`/sales-orders/${editingSO._id}`, payload);
      } else {
        await API.post("/sales-orders", payload);
      }
      onSuccess();
      handleClose();
    } catch (err) {
      console.error(err);
      if (err.response?.status === 402) {
        onError(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        onError(err.response?.data?.error || "Failed to save sales order");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[10000] transition-opacity duration-300 ease-in-out"
        style={{ opacity: isOpen ? 1 : 0 }}
        onClick={handleClose}
      />

      <div
        className={`
          fixed dc-panel-card dc-panel-w z-[10001]
          bg-white shadow-2xl flex flex-col overflow-hidden
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-[calc(100%+2rem)]"}
        `}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
          <h2 className="text-[14px] font-normal leading-5 text-[#78788D] uppercase tracking-wide">
            {editingSO ? "EDIT SALES ORDER" : "CREATE NEW SALES ORDER"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {isLocked && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[12px] rounded-xl px-3 py-2">
              {editingSO?.convertedInvoice
                ? `This Sales Order was converted to Invoice ${editingSO.convertedInvoice.invoiceNumber} — it's read-only.`
                : "A Cancelled Sales Order is read-only."}
            </div>
          )}

          {/* Deal Section */}
          <div>
            <label className="block text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
              Select Deal <span className="text-red-500">*</span>
            </label>
            <SearchableDropdown
              options={deals || []}
              value={dealId}
              onChange={setDealId}
              placeholder="Choose Deal"
              displayKey="title"
              valueKey="_id"
              className="flex-1 w-full"
              required={true}
              disabled={isLocked}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                Order Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isLocked}
                className="w-full px-3 h-8 bg-white border border-[#1F2937]/10 rounded-full text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                Expected Delivery Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isLocked}
                className="w-full px-3 h-8 bg-white border border-[#1F2937]/10 rounded-full text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
              Reference (customer PO #, etc.)
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={isLocked}
              className="w-full px-3 h-8 bg-white border border-[#1F2937]/10 rounded-full text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50"
            />
          </div>

          {/* Items Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Items</h3>
              {!isLocked && (
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1 text-[#0085FF] hover:text-blue-700 font-medium text-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Another Item
                </button>
              )}
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl border border-gray-200 p-4 relative group space-y-3"
                >
                  {items.length > 1 && !isLocked && (
                    <button
                      onClick={() => removeItem(index)}
                      className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <div>
                    <label className="block text-[11px] font-medium text-[#161618] tracking-[-0.05em] mb-1.5">
                      Item <span className="text-red-500">*</span>
                    </label>
                    {isLocked ? (
                      <div className="w-full px-3 h-8 flex items-center bg-gray-50 border border-[#1F2937]/10 rounded-full text-[12px] text-gray-600">
                        {item.name}
                      </div>
                    ) : (
                      <ItemSearchSelect
                        value={item}
                        onSelect={(data) => {
                          const newItems = [...items];
                          newItems[index] = { ...newItems[index], ...data };
                          setItems(newItems);
                        }}
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#161618] tracking-[-0.05em] mb-1.5">
                      Description
                    </label>
                    <input
                      type="text"
                      placeholder="Add Item Description"
                      value={item.description}
                      onChange={(e) => updateItem(index, "description", e.target.value)}
                      disabled={isLocked}
                      className="w-full px-3 h-8 bg-white border border-[#1F2937]/10 rounded-full text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[#161618] tracking-[-0.05em] mb-1.5">
                        Quantity
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", e.target.value)}
                          disabled={isLocked}
                          className="w-full px-3 h-8 bg-white border border-[#1F2937]/10 rounded-full text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50"
                          placeholder="01"
                        />
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                          <ListFilter className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#161618] tracking-[-0.05em] mb-1.5">
                        Rate <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) => updateItem(index, "rate", e.target.value)}
                          disabled={isLocked}
                          className="w-full pl-7 pr-3 h-8 bg-white border border-[#1F2937]/10 rounded-full text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50"
                          placeholder="0"
                        />
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-[12px]">₹</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#161618] tracking-[-0.05em] mb-1.5">
                        GST %
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={item.gstRate ?? ""}
                          onChange={(e) => updateItem(index, "gstRate", e.target.value)}
                          disabled={isLocked}
                          className="w-full pl-3 pr-7 h-8 bg-white border border-[#1F2937]/10 rounded-full text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50"
                          placeholder="0"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-[12px]">%</span>
                      </div>
                      <label className="flex items-center gap-2 mt-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.taxInclusive || false}
                          onChange={(e) => updateItem(index, "taxInclusive", e.target.checked)}
                          disabled={isLocked}
                          className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Tax Inc.</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#161618] tracking-[-0.05em] mb-1.5">
                      Amount
                    </label>
                    <div className="w-full px-3 h-8 flex items-center bg-gray-100 border border-[#1F2937]/10 rounded-full text-[12px] font-semibold text-gray-800">
                      ₹{formatNumberFixed((parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Discount + Terms/Notes */}
          <div className="space-y-6">
            <div>
              <label className="block text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                Discount
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value)}
                  disabled={isLocked}
                  className="h-8 px-3 bg-white border border-[#1F2937]/10 rounded-full text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="fixed">₹ Fixed</option>
                  <option value="percentage">% Percentage</option>
                </select>
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  disabled={isLocked}
                  className="flex-1 px-3 h-8 bg-white border border-[#1F2937]/10 rounded-full text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                Notes
              </label>
              <div className="border border-[#1F2937]/10 rounded-xl bg-white">
                <ReactQuill
                  theme="snow"
                  value={notes}
                  onChange={isLocked ? undefined : setNotes}
                  readOnly={isLocked}
                  placeholder="Additional Notes"
                  className="[&_.ql-editor]:min-h-[100px] [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-gray-100 [&_.ql-container]:border-none text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2">
                Terms &amp; Conditions
              </label>
              <div className="border border-[#1F2937]/10 rounded-xl bg-white">
                <ReactQuill
                  theme="snow"
                  value={terms}
                  onChange={isLocked ? undefined : setTerms}
                  readOnly={isLocked}
                  placeholder="Terms & Conditions"
                  className="[&_.ql-editor]:min-h-[100px] [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-gray-100 [&_.ql-container]:border-none text-sm"
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
              disabled={isLocked}
            />
          </div>

          {/* Total Amount Banner */}
          <div className="bg-blue-50 rounded-full px-5 py-2.5 flex justify-between items-center">
            <span className="text-gray-900 font-medium text-sm">Total Amount</span>
            <span className="text-[#0085FF] font-medium text-base">₹{formatNumberFixed(grandTotal)}</span>
          </div>
        </div>

        <div className="flex-shrink-0 py-2.5 px-4 border-t border-gray-100 bg-white flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-2 border border-gray-200 text-gray-700 rounded-[25px] text-sm font-bold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          {!isLocked && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-[#158FFF] text-white rounded-[25px] text-sm font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Saving..." : editingSO ? "Update Sales Order" : "Create Sales Order"}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default SalesOrderForm;
