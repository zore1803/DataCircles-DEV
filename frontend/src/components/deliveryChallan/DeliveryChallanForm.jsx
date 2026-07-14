import React, { useState, useEffect, useRef, useCallback } from "react";
import { formatNumberToIndian } from "../../utils/numberFormatter";
import {
  Plus,
  IndianRupeeIcon,
  Trash2,
  Calendar,
  FileText,
  X,
  Search,
  Eye,
} from "lucide-react";
import API from "../../services/api";
import ItemForm from "../item/ItemForm";
import QuickDealForm from "../deal/QuickDealForm";
import SearchableDropdown from "../contact/SearchableDropdown";
import toast from "react-hot-toast";

// Function to convert number to words
function numberToWords(num) {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const scales = ["", "Thousand", "Lakh", "Crore"];

  function toWords(n) {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) {
      return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    }
    if (n < 1000) {
      return (
        ones[Math.floor(n / 100)] +
        " Hundred" +
        (n % 100 ? " " + toWords(n % 100) : "")
      );
    }
    let scaleIndex = 0;
    let result = "";
    if (n >= 10000000) {
      result += toWords(Math.floor(n / 10000000)) + " Crore ";
      n %= 10000000;
    }
    if (n >= 100000) {
      result += toWords(Math.floor(n / 100000)) + " Lakh ";
      n %= 100000;
    }
    if (n >= 1000) {
      result += toWords(Math.floor(n / 1000)) + " Thousand ";
      n %= 1000;
    }
    if (n > 0) {
      result += toWords(n);
    }
    return result.trim();
  }

  if (num === 0) return "Zero Rupees Only";

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);
  let words = toWords(integerPart) + " Rupees";
  if (decimalPart > 0) {
    words += " and " + toWords(decimalPart) + " Paise";
  }
  words += " Only";
  return words;
}

// Item Search Component
const ItemSearchSelect = ({
  value,
  onSelect,
  onAddNew,
  fetchItems,
  items,
  setItems,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimeout = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const debouncedFetchItems = useCallback(
    (search) => {
      clearTimeout(debounceTimeout.current);
      debounceTimeout.current = setTimeout(() => {
        fetchItems(search);
      }, 300);
    },
    [fetchItems]
  );

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value.length >= 2 || value === "") {
      setLoading(true);
      debouncedFetchItems(value);
    }
  };

  const handleItemSelect = (item) => {
    onSelect({
      _id: item._id,
      name: item.displayName,
      description: item.description || "",
      rate: item.sellingPrice,
      quantity: 1,
      isVariant: item.isVariant || false,
      parentItemId: item.parentItemId || null,
      discountType: "amount",
      discount: 0,
    });
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    if (items.length === 0) {
      setLoading(true);
      fetchItems();
    }
  };

  const selectedItem = items.find((item) => item._id === value?._id);

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          placeholder={
            selectedItem
              ? selectedItem.displayName
              : "Search items or variants..."
          }
          value={selectedItem ? selectedItem.displayName : searchTerm}
          onChange={handleSearchChange}
          onFocus={handleInputFocus}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 bg-white"
          aria-label="Search items or variants"
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-slate-500">Loading...</div>
          ) : (
            <>
              <div className="p-2">
                <button
                  type="button"
                  onClick={() => {
                    onAddNew();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  aria-label="Add new item"
                >
                  <Plus className="w-4 h-4" />
                  Add New Item
                </button>
              </div>
              <div className="border-t border-slate-100"></div>
              {items.length === 0 ? (
                <div className="p-4 text-center text-slate-500">
                  {searchTerm
                    ? "No items or variants found"
                    : "No items or variants available"}
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto">
                  {items.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => handleItemSelect(item)}
                      className="w-full text-left p-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0"
                      aria-label={`Select ${item.displayName}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-slate-900">
                            {item.displayName}
                          </div>
                          {item.description && (
                            <div
                              className="text-sm text-slate-500 mt-1"
                              dangerouslySetInnerHTML={{
                                __html: item.description,
                              }}
                            ></div>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                item.isVariant
                                  ? "bg-purple-100 text-purple-800"
                                  : item.type === "product"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-green-100 text-green-800"
                              }`}
                            >
                              {item.isVariant ? "Variant" : item.type}
                            </span>
                            {item.category && (
                              <span className="text-xs text-slate-500">
                                {item.category}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="font-semibold text-slate-900">
                            ₹{item.sellingPrice}
                          </div>
                          <div className="text-xs text-slate-500">
                            {item.primaryUnit}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const styles = ["Classic", "Modern", "Minimal", "Elegant"];

const DeliveryChallanForm = ({
  deals,
  isOpen,
  onClose,
  fetchData,
  editingDeliveryChallan,
  onPreview,
}) => {
  const [form, setForm] = useState({
    deal: "",
    date: "",
    dueDate: "",
    items: [
      {
        _id: null,
        name: "",
        description: "",
        rate: "",
        quantity: 1,
        isVariant: false,
        parentItemId: null,
        discountType: "amount",
        discount: 0,
      },
    ],
    discount: { type: "fixed", value: 0 },
    amount: 0,
    status: "Draft",
    style: "",
  });
  const [isSliding, setIsSliding] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);
  const [showItemForm, setShowItemForm] = useState(false);
  const [showQuickDealForm, setShowQuickDealForm] = useState(false);
  const [localDeals, setLocalDeals] = useState(deals);
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [itemForm, setItemForm] = useState({
    type: "product",
    name: "",
    description: "",
    purchasePrice: 0,
    sellingPrice: 0,
    taxInclusive: true,
    hsnSac: "",
    barcode: "",
    category: "",
    primaryUnit: "OTH OTHERS",
    images: [],
    isActive: true,
  });
  const [itemFormLoading, setItemFormLoading] = useState(false);
  const [itemFormError, setItemFormError] = useState("");
  const [itemFormSuccess, setItemFormSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [items, setItems] = useState([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    if (showItemForm) {
      if (formRef.current) formRef.current.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      return () => {
        if (formRef.current) formRef.current.style.overflow = "auto";
        document.body.style.overflow = "";
      };
    }
  }, [showItemForm]);

  // Fetch items and variants
  const fetchItems = useCallback(async (search = "") => {
    try {
      setItemFormLoading(true);
      const res = await API.get(`/items?search=${search}&includeVariants=true`);
      const itemsWithVariants = res.data
        .filter((item) => item.isActive)
        .flatMap((item) => {
          const baseItem = {
            _id: item._id,
            displayName: item.name,
            name: item.name,
            description: item.description || "",
            sellingPrice: item.sellingPrice,
            type: item.type,
            category: item.category || "",
            primaryUnit: item.primaryUnit || "OTH OTHERS",
            isVariant: false,
            parentItemId: null,
          };
          const variants =
            item.variants?.map((variant) => ({
              _id: variant._id,
              displayName: `${item.name} - ${variant.name}`,
              name: variant.name,
              description: variant.description || item.description || "",
              sellingPrice: variant.sellingPrice || item.sellingPrice,
              type: item.type,
              category: item.category || "",
              primaryUnit:
                variant.primaryUnit || item.primaryUnit || "OTH OTHERS",
              isVariant: true,
              parentItemId: item._id,
            })) || [];
          return [baseItem, ...variants];
        });
      setItems(itemsWithVariants);
    } catch (error) {
      console.error("Error fetching items:", error);
      toast.error("Failed to fetch items.");
    } finally {
      setItemFormLoading(false);
    }
  }, []);

  // Fetch companies and contacts
  const fetchCompanies = useCallback(async () => {
    try {
      const res = await API.get("/companies");
      setCompanies(res.data);
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast.error("Failed to fetch companies.");
    }
  }, []);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await API.get("/contacts");
      setContacts(res.data);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      toast.error("Failed to fetch contacts.");
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setTimeout(() => setIsSliding(true), 10);
      fetchItems();
      fetchCompanies();
      fetchContacts();
      setLocalDeals(deals);
    } else {
      setIsSliding(false);
      setTimeout(() => setShouldRender(false), 300);
    }
  }, [isOpen, fetchItems, fetchCompanies, fetchContacts, deals]);

  useEffect(() => {
    if (editingDeliveryChallan) {
      setForm({
        deal: editingDeliveryChallan.deal?._id || "",
        date: editingDeliveryChallan.date
          ? editingDeliveryChallan.date.slice(0, 10)
          : "",
        dueDate: editingDeliveryChallan.dueDate
          ? editingDeliveryChallan.dueDate.slice(0, 10)
          : "",
        items: editingDeliveryChallan.items.map((item) => ({
          _id: item.itemId || null,
          name: item.name || "",
          description: item.description || "",
          rate: item.rate || "",
          quantity: item.quantity || 1,
          isVariant: item.isVariant || false,
          parentItemId: item.parentItemId || null,
          discountType: item.discountType || "amount",
          discount: item.discount || 0,
        })),
        discount: editingDeliveryChallan.discount || {
          type: "fixed",
          value: 0,
        },
        amount: editingDeliveryChallan.amount || 0,
        status: editingDeliveryChallan.status || "Draft",
        style: editingDeliveryChallan.style || "",
      });
      setHasUnsavedChanges(false);
    } else {
      setForm({
        deal: "",
        date: "",
        dueDate: "",
        items: [
          {
            _id: null,
            name: "",
            description: "",
            rate: "",
            quantity: 1,
            isVariant: false,
            parentItemId: null,
            discountType: "amount",
            discount: 0,
          },
        ],
        discount: { type: "fixed", value: 0 },
        amount: 0,
        status: "Draft",
        style: "",
      });
      setHasUnsavedChanges(false);
    }
  }, [editingDeliveryChallan]);

  const calculateItemAmount = (item) => {
    const rate = parseFloat(item.rate) || 0;
    const quantity = parseInt(item.quantity) || 0;
    const subtotal = rate * quantity;
    const discount = parseFloat(item.discount) || 0;
    if (item.discountType === "percentage") {
      return subtotal * (1 - discount / 100);
    }
    return subtotal - discount;
  };

  const calculateSubtotal = (items) =>
    items.reduce(
      (total, item) =>
        total + (parseFloat(item.rate) || 0) * (parseInt(item.quantity) || 0),
      0
    );

  const calculateTotalItemDiscounts = (items) =>
    items.reduce((total, item) => {
      const subtotal =
        (parseFloat(item.rate) || 0) * (parseInt(item.quantity) || 0);
      const discount = parseFloat(item.discount) || 0;
      if (item.discountType === "percentage") {
        return total + (subtotal * discount) / 100;
      }
      return total + discount;
    }, 0);

  const calculateSubtotalAfterItemDiscounts = (items) =>
    calculateSubtotal(items) - calculateTotalItemDiscounts(items);

  const calculateInvoiceDiscountAmount = (
    subtotalAfterItemDiscounts,
    discount
  ) => {
    if (discount && discount.value > 0) {
      if (discount.type === "percentage") {
        return (subtotalAfterItemDiscounts * discount.value) / 100;
      }
      return discount.value;
    }
    return 0;
  };

  const calculateTotalAmount = useCallback((items, discount) => {
    const subtotalAfterItemDiscounts =
      calculateSubtotalAfterItemDiscounts(items);
    const invoiceDiscountAmount = calculateInvoiceDiscountAmount(
      subtotalAfterItemDiscounts,
      discount
    );
    return subtotalAfterItemDiscounts - invoiceDiscountAmount;
  }, []);

  const handleItemChange = (index, field, value) => {
    setForm((prev) => {
      const newItems = [...prev.items];
      let newValue = value;

      if (field === "discount") {
        const item = newItems[index];
        const rate = parseFloat(item.rate) || 0;
        const quantity = parseInt(item.quantity) || 0;
        const subtotal = rate * quantity;
        const parsedDiscount = parseFloat(value) || 0;

        if (item.discountType === "amount" && parsedDiscount > subtotal) {
          newValue = subtotal;
          toast.error("Item discount cannot exceed item total price.");
        } else if (item.discountType === "percentage" && parsedDiscount > 100) {
          newValue = 100;
          toast.error("Percentage discount cannot exceed 100%.");
        }
      }

      newItems[index][field] = newValue;
      return {
        ...prev,
        items: newItems,
        amount: calculateTotalAmount(newItems, prev.discount),
      };
    });
    setHasUnsavedChanges(true);
  };

  const handleDiscountChange = (field, value) => {
    setForm((prev) => {
      const subtotalAfterItemDiscounts = calculateSubtotalAfterItemDiscounts(
        prev.items
      );
      let newValue = value;

      if (field === "value") {
        const parsedValue = parseFloat(value) || 0;
        if (
          prev.discount.type === "fixed" &&
          parsedValue > subtotalAfterItemDiscounts
        ) {
          newValue = subtotalAfterItemDiscounts;
          toast.error(
            "Delivery Challan discount cannot exceed subtotal after item discounts."
          );
        } else if (prev.discount.type === "percentage" && parsedValue > 100) {
          newValue = 100;
          toast.error("Percentage discount cannot exceed 100%.");
        }
      }

      const newDiscount = { ...prev.discount, [field]: newValue };
      const invoiceDiscountAmount = calculateInvoiceDiscountAmount(
        subtotalAfterItemDiscounts,
        newDiscount
      );

      if (invoiceDiscountAmount > subtotalAfterItemDiscounts) {
        newDiscount.value = subtotalAfterItemDiscounts;
        if (newDiscount.type === "percentage") {
          newDiscount.value = 100;
        }
        toast.error(
          "Delivery Challan discount cannot exceed subtotal after item discounts."
        );
      }

      return {
        ...prev,
        discount: newDiscount,
        amount: calculateTotalAmount(prev.items, newDiscount),
      };
    });
    setHasUnsavedChanges(true);
  };

  const handleItemSelect = (index, itemData) => {
    setForm((prev) => {
      const newItems = [...prev.items];
      newItems[index] = {
        ...itemData,
        quantity: newItems[index].quantity || 1,
        discountType: newItems[index].discountType || "amount",
        discount: newItems[index].discount || 0,
      };
      return {
        ...prev,
        items: newItems,
        amount: calculateTotalAmount(newItems, prev.discount),
      };
    });
    setHasUnsavedChanges(true);
  };

  const handleAddItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          _id: null,
          name: "",
          description: "",
          rate: "",
          quantity: 1,
          isVariant: false,
          parentItemId: null,
          discountType: "amount",
          discount: 0,
        },
      ],
      amount: calculateTotalAmount(
        [
          ...prev.items,
          {
            _id: null,
            name: "",
            description: "",
            rate: "",
            quantity: 1,
            isVariant: false,
            parentItemId: null,
            discountType: "amount",
            discount: 0,
          },
        ],
        prev.discount
      ),
    }));
    setHasUnsavedChanges(true);
  };

  const handleRemoveItem = (index) => {
    setForm((prev) => {
      const newItems = prev.items.filter((_, i) => i !== index);
      return {
        ...prev,
        items: newItems,
        amount: calculateTotalAmount(newItems, prev.discount),
      };
    });
    setHasUnsavedChanges(true);
  };

  const handleOpenItemForm = () => {
    if (formRef.current) formRef.current.scrollTop = 0;
    setShowItemForm(true);
  };

  const handleDealCreated = (newDeal) => {
    setLocalDeals((prev) => [...prev, newDeal]);
    setForm((prev) => ({ ...prev, deal: newDeal._id }));
    setHasUnsavedChanges(true);
    setShowQuickDealForm(false);
  };

  const resetItemForm = () => {
    setItemForm({
      type: "product",
      name: "",
      description: "",
      purchasePrice: 0,
      sellingPrice: 0,
      taxInclusive: true,
      hsnSac: "",
      barcode: "",
      category: "",
      primaryUnit: "OTH OTHERS",
      images: [],
      isActive: true,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!form.deal) {
      toast.error("Deal is required.");
      setIsSubmitting(false);
      return;
    }

    if (!form.date) {
      toast.error("Delivery Challan Date is required.");
      setIsSubmitting(false);
      return;
    }

    const invalidItems = form.items.filter(
      (item) =>
        !item.name ||
        !item.rate ||
        !item.quantity ||
        (item.discountType === "percentage" && item.discount > 100)
    );
    if (invalidItems.length > 0) {
      toast.error(
        "Please fill in all item details (name, rate, quantity) and ensure percentage discounts are not above 100."
      );
      setIsSubmitting(false);
      return;
    }

    const subtotalAfterItemDiscounts = calculateSubtotalAfterItemDiscounts(
      form.items
    );
    const invoiceDiscountAmount = calculateInvoiceDiscountAmount(
      subtotalAfterItemDiscounts,
      form.discount
    );
    if (invoiceDiscountAmount > subtotalAfterItemDiscounts) {
      toast.error(
        "Delivery Challan discount cannot exceed subtotal after item discounts."
      );
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        deal: form.deal,
        date: form.date,
        dueDate: form.dueDate,
        amount: calculateTotalAmount(form.items, form.discount),
        discount: form.discount,
        status: form.status,
        items: form.items.map((item) => ({
          itemId: item._id,
          name: item.name,
          description: item.description,
          rate: parseFloat(item.rate),
          quantity: parseInt(item.quantity),
          isVariant: item.isVariant,
          parentItemId: item.parentItemId,
          discountType: item.discountType,
          discount: parseFloat(item.discount),
        })),
        style: form.style,
      };

      if (editingDeliveryChallan) {
        await API.put(
          `/delivery-challans/${editingDeliveryChallan._id}`,
          payload
        );
        toast.success("Delivery Challan updated successfully!");
      } else {
        await API.post("/delivery-challans", payload);
        toast.success("Delivery Challan created successfully!");
      }

      setHasUnsavedChanges(false);
      setForm({
        deal: "",
        date: "",
        dueDate: "",
        items: [
          {
            _id: null,
            name: "",
            description: "",
            rate: "",
            quantity: 1,
            isVariant: false,
            parentItemId: null,
            discountType: "amount",
            discount: 0,
          },
        ],
        discount: { type: "fixed", value: 0 },
        amount: 0,
        status: "Draft",
        style: "",
      });
      await fetchData();
      onClose();
    } catch (err) {
      const errorMessage = err.response?.status === 402
        ? (err.response?.data?.message || "An active subscription is required to make changes.")
        : (err.response?.data?.error || (editingDeliveryChallan ? "Failed to update delivery challan" : "Failed to create delivery challan"));
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmExit = () => {
    setHasUnsavedChanges(false);
    setShowConfirmDialog(false);
    onClose();
  };

  const handleSaveAndExit = async () => {
    await handleSubmit(new Event("submit"));
    if (!toastMessage.includes("Failed")) {
      setShowConfirmDialog(false);
      onClose();
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowConfirmDialog(true);
    } else {
      onClose();
    }
  };

  if (!shouldRender) return null;

  const subtotal = calculateSubtotal(form.items);
  const totalItemDiscounts = calculateTotalItemDiscounts(form.items);
  const subtotalAfterItemDiscounts = subtotal - totalItemDiscounts;
  const invoiceDiscountAmount = calculateInvoiceDiscountAmount(
    subtotalAfterItemDiscounts,
    form.discount
  );
  const finalTotal = subtotalAfterItemDiscounts - invoiceDiscountAmount;

  return (
    <>
      {toastMessage && (
        <div className="fixed top-4 right-4 z-[10002] bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in-out">
          {toastMessage}
        </div>
      )}

      {showQuickDealForm && (
        <QuickDealForm
          companies={companies}
          contacts={contacts}
          onDealCreated={handleDealCreated}
          onRequestClose={() => setShowQuickDealForm(false)}
        />
      )}

      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 z-[10004] flex items-center justify-center">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-sm sm:max-w-lg mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Unsaved Changes
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              You have unsaved changes. Are you sure you want to exit without
              saving?
            </p>
            <div className="flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmDialog(false)}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors cursor-pointer hidden sm:block"
              >
                Cancel
              </button>
              <div className="flex space-x-1">
                <button
                  type="button"
                  onClick={handleConfirmExit}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors cursor-pointer"
                >
                  Exit Without Saving
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndExit}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  Save and Exit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className="fixed inset-0 bg-black/20 z-[10000] transition-opacity duration-300 ease-in-out"
        style={{ opacity: isSliding ? 1 : 0 }}
        onClick={handleClose}
      />
      <div
        ref={formRef}
        className={`fixed inset-y-0 right-0 z-[10000] w-full md:w-[600px] bg-white shadow-2xl overflow-y-auto transform transition-transform duration-300 ease-in-out ${
          isSliding ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              {editingDeliveryChallan
                ? "Edit Delivery Challan"
                : "Create New Delivery Challan"}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close form"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Select Deal *
                </label>
                <div className="flex items-center gap-2">
                  <div className="w-full">
                    <SearchableDropdown
                      options={localDeals}
                      value={form.deal}
                      onChange={(value) => {
                        setForm((prev) => ({ ...prev, deal: value }));
                        setHasUnsavedChanges(true);
                      }}
                      placeholder="Select Deal"
                      displayKey="title"
                      valueKey="_id"
                      className="flex-1"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowQuickDealForm(true)}
                    className="px-3 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-600 transition-all duration-200"
                    aria-label="Add new deal"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Delivery Challan Style
                </label>
                <div className="flex items-center gap-2">
                  <select
                    className="w-full border-2 border-slate-200 rounded-xl p-3 bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                    value={form.style}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, style: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                    aria-label="Select delivery challan style"
                  >
                    <option value="">Select style...</option>
                    {styles.map((s, idx) => (
                      <option key={idx} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {/* {form.style && (
                    <button
                      type="button"
                      onClick={() => onPreview(form)}
                      className="px-3 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      aria-label="Preview delivery challan"
                    >
                      <Eye className="w-6 h-6" />
                    </button>
                  )} */}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Delivery Challan Date *
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                    required
                    value={form.date}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, date: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                    aria-label="Select delivery challan date"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Due Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                    value={form.dueDate}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, dueDate: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                    aria-label="Select due date"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <IndianRupeeIcon className="w-5 h-5 text-slate-600" />
                <label className="block font-semibold text-slate-700">
                  Delivery Challan Items
                </label>
              </div>

              <div className="space-y-4">
                {form.items.map((item, index) => (
                  <div
                    key={index}
                    className="bg-white p-4 rounded-lg border border-slate-200 space-y-4"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-600">
                          Item
                        </label>
                        <ItemSearchSelect
                          value={item}
                          onSelect={(itemData) =>
                            handleItemSelect(index, itemData)
                          }
                          onAddNew={handleOpenItemForm}
                          fetchItems={fetchItems}
                          items={items}
                          setItems={setItems}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-600">
                          Description
                        </label>
                        <input
                          type="text"
                          placeholder="Item description"
                          value={item.description}
                          onChange={(e) => {
                            handleItemChange(
                              index,
                              "description",
                              e.target.value
                            );
                            setHasUnsavedChanges(true);
                          }}
                          className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                          aria-label="Item description"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-600">
                          Rate (₹)
                        </label>
                        <input
                          type="number"
                          placeholder="0"
                          min="0"
                          step="1"
                          value={item.rate}
                          onChange={(e) => {
                            handleItemChange(index, "rate", e.target.value);
                            setHasUnsavedChanges(true);
                          }}
                          className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                          required
                          aria-label="Item rate"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-600">
                          Quantity
                        </label>
                        <input
                          type="number"
                          placeholder="1"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => {
                            handleItemChange(index, "quantity", e.target.value);
                            setHasUnsavedChanges(true);
                          }}
                          className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                          required
                          aria-label="Item quantity"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-600">
                          Discount
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            placeholder="0"
                            min="0"
                            step={
                              item.discountType === "percentage" ? "1" : "1"
                            }
                            value={item.discount}
                            onChange={(e) => {
                              handleItemChange(
                                index,
                                "discount",
                                e.target.value
                              );
                              setHasUnsavedChanges(true);
                            }}
                            className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                            aria-label="Item discount"
                          />
                          <select
                            value={item.discountType}
                            onChange={(e) => {
                              handleItemChange(
                                index,
                                "discountType",
                                e.target.value
                              );
                              setHasUnsavedChanges(true);
                            }}
                            className="border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                            aria-label="Discount type"
                          >
                            <option value="amount">₹</option>
                            <option value="percentage">%</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-600">
                          Amount
                        </label>
                        <div className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-medium">
                          <h6>₹{calculateItemAmount(item).toFixed(2)}</h6>
                        </div>
                      </div>
                    </div>

                    {form.items.length > 1 && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="flex items-center gap-2 text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-all duration-200"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remove Item
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium p-2 rounded-lg hover:bg-blue-50 transition-all duration-200"
                  aria-label="Add another item"
                >
                  <Plus className="w-4 h-4" />
                  Add Another Item
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">
                Delivery Challan Discount
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="0"
                  min="0"
                  step={form.discount.type === "percentage" ? "1" : "1"}
                  value={form.discount.value}
                  onChange={(e) => {
                    handleDiscountChange("value", e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                  aria-label="Delivery challan discount"
                />
                <select
                  value={form.discount.type}
                  onChange={(e) => {
                    handleDiscountChange("type", e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  className="border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                  aria-label="Delivery challan discount type"
                >
                  <option value="fixed">₹</option>
                  <option value="percentage">%</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 p-6 bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-xl border border-slate-200/50">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-slate-600">
                  Subtotal
                </span>
                <span className="text-sm font-medium text-slate-900">
                  ₹{formatNumberToIndian(subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-slate-600">
                  Item Discounts
                </span>
                <span className="text-sm font-medium text-red-600">
                  - ₹{formatNumberToIndian(totalItemDiscounts)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-sm font-medium text-slate-600">
                  After Item Discounts
                </span>
                <span className="text-sm font-medium text-slate-900">
                  ₹{formatNumberToIndian(subtotalAfterItemDiscounts)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-slate-600">
                  Delivery Challan Discount
                </span>
                <h6 className="text-sm font-medium text-red-600">
                  - ₹{formatNumberToIndian(invoiceDiscountAmount)}
                </h6>
              </div>
              <div className="flex justify-between border-t pt-2 mt-2">
                <span className="text-lg font-bold text-slate-900">
                  Final Total
                </span>
                <span className="text-lg font-bold text-slate-900">
                  ₹{formatNumberToIndian(finalTotal)}
                </span>
              </div>
              <div className="text-sm text-slate-600 italic text-right mt-2">
                {numberToWords(finalTotal)}
              </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-6 bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-xl border border-slate-200/50">
              <button
                type="submit"
                className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-700 hover:to-blue-600 text-white font-semibold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
                disabled={isSubmitting}
                aria-label={
                  editingDeliveryChallan
                    ? "Update delivery challan"
                    : "Create delivery challan"
                }
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8h8a8 8 0 01-8 8v-8H4z"
                      ></path>
                    </svg>
                    Processing...
                  </>
                ) : editingDeliveryChallan ? (
                  "Update Delivery Challan"
                ) : (
                  "Create Delivery Challan"
                )}
              </button>
            </div>
          </div>
        </form>

        {showItemForm && (
          <ItemForm
            form={itemForm}
            setForm={setItemForm}
            loading={itemFormLoading}
            setLoading={setItemFormLoading}
            setError={setItemFormError}
            setSuccess={setItemFormSuccess}
            fetchItems={fetchItems}
            onRequestClose={() => {
              resetItemForm();
              setShowItemForm(false);
            }}
          />
        )}
      </div>
    </>
  );
};

export default DeliveryChallanForm;
